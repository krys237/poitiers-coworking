// Un canal sortant, vu par le moteur de notifications (lot S3, réutilisé par S4).
// Le moteur ne connaît AUCUN fournisseur : il connaît cette interface. Le hub WhatsApp (S3)
// et Firebase (S4) en sont deux implémentations, remplaçables sans toucher au moteur.
//
// Décision du propriétaire (06/11/2026) : le fournisseur WhatsApp a déjà changé une fois
// (UltraMsg → hub interne). Rien dans le moteur ne doit en dépendre.
//
// PUR : aucun appel réseau, aucun import serveur.

export type Canal = "whatsapp" | "push";

/** Mode d'un canal : réel si sa clé est présente ET son interrupteur ouvert. */
export type ModeCanal = "reel" | "simulation";

export type ChargeWhatsapp = {
  modele: string;               // "poitiers_bon_a_valider"
  langue: string;               // "fr"
  parametres: string[];         // dans l'ORDRE des {{1}}, {{2}}…
  metadonnees?: Record<string, string>;
};

export type ChargePush = {
  titre: string;
  corps?: string;
  lien?: string;
};

/** Ce que le moteur demande à un transport d'envoyer. */
export type MessageSortant = {
  canal: Canal;
  destinataireId: string;
  adresse: string;              // numéro +237… pour WhatsApp, jeton d'appareil pour le push
  /** Clé d'idempotence, générée et ENREGISTRÉE avant l'appel. */
  cleIdempotence: string;
  /** Charge utile propre au canal (modèle + paramètres, ou titre + corps). */
  charge: ChargeWhatsapp | ChargePush;
};

/** Résultat d'un envoi, tel que le journal l'enregistre. */
export type ResultatEnvoi =
  | { issue: "accepte"; messageId?: string }
  | { issue: "simule" }
  | { issue: "echec"; code: string; detail?: string; rejouable: boolean };

export type StatutEnvoi =
  | "a_envoyer"
  | "accepte"
  | "envoye"
  | "delivre"
  | "lu"
  | "echec"
  | "simule";

/** Attentes croissantes entre tentatives locales sur erreur rejouable (spec S3 §6). */
export const REPRISES_MS = [2_000, 5_000, 15_000, 60_000] as const;

/** Décalage entre deux envois WhatsApp d'un même événement (50/min < plafond 60/min du hub). */
export const ETALEMENT_WHATSAPP_MS = 1_200;

export function delaiEtalementMs(index: number): number {
  return Math.max(0, Math.floor(index)) * ETALEMENT_WHATSAPP_MS;
}

/** Patron de la maison : réel uniquement si la clé d'env est présente ET l'interrupteur ouvert. */
export function modeCanal(clePresente: boolean, interrupteurActif: boolean): ModeCanal {
  return clePresente && interrupteurActif ? "reel" : "simulation";
}

/**
 * Clé d'idempotence déterministe, lisible, ASCII sans espace, bornée à 255 caractères.
 * Pour un rappel répété (S5), `dateJour` ("YYYY-MM-DD") évite que la relance du lendemain
 * soit traitée comme un doublon de celle de la veille.
 */
export function cleIdempotence(
  canal: Canal,
  type: string,
  table: string,
  objetId: string,
  destinataireId: string,
  dateJour?: string,
): string {
  const nettoyer = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9_.-]/g, "_")
      .replace(/_+/g, "_");
  const segments = [canal, type, table, objetId, destinataireId];
  if (dateJour) segments.push(dateJour);
  return segments.map(nettoyer).join("-").slice(0, 255);
}

/** Classement des erreurs du hub WhatsApp (spec S3 §6 & reference/HUB-WHATSAPP-API.md §9). */
export function classerErreurHub(
  httpStatus: number,
  errorCode?: string,
): {
  rejouable: boolean;
  alerteProprietaire: boolean;
  numeroDouteux: boolean;
  neJamaisRelancer: boolean;
} {
  // 0 = timeout ou erreur réseau locale
  if (httpStatus === 0 || httpStatus === 429 || httpStatus >= 500) {
    return { rejouable: true, alerteProprietaire: false, numeroDouteux: false, neJamaisRelancer: false };
  }
  if (httpStatus === 401 || errorCode === "not_authenticated" || errorCode === "authentication_failed") {
    // Critique : 20 échecs 401 en 5 min bannissent l'IP côté hub. Jamais de reprise.
    return { rejouable: false, alerteProprietaire: true, numeroDouteux: false, neJamaisRelancer: true };
  }
  if (errorCode === "131026") {
    return { rejouable: false, alerteProprietaire: false, numeroDouteux: true, neJamaisRelancer: true };
  }
  if (
    errorCode === "recipient_opted_out" ||
    errorCode === "131049" ||
    errorCode === "131050"
  ) {
    return { rejouable: false, alerteProprietaire: false, numeroDouteux: false, neJamaisRelancer: true };
  }
  if (
    errorCode === "template_not_available" ||
    errorCode === "132001" ||
    errorCode === "132015"
  ) {
    return { rejouable: false, alerteProprietaire: true, numeroDouteux: false, neJamaisRelancer: true };
  }
  // 400, 403, 404, 409, 413, 422 (dont invalid_template_parameters) : jamais rejouable.
  return { rejouable: false, alerteProprietaire: false, numeroDouteux: false, neJamaisRelancer: false };
}

const RANG_STATUT: Record<StatutEnvoi, number> = {
  simule: 0,
  a_envoyer: 1,
  accepte: 2,
  envoye: 3,
  delivre: 4,
  lu: 5,
  echec: 99,
};

/**
 * Monotonie des statuts (spec S3 §8) : `delivered` peut arriver après `read`.
 * Conserve toujours le statut le plus avancé (`echec` est final).
 */
export function avancerStatut(actuel: StatutEnvoi, recu: StatutEnvoi): StatutEnvoi {
  if (actuel === "echec") return "echec";
  if (recu === "echec") return "echec";
  return RANG_STATUT[recu] > RANG_STATUT[actuel] ? recu : actuel;
}

/** Traduit un statut du hub (`sent`, `delivered`, `read`, `failed`) en statut interne. */
export function statutDepuisHub(hubStatus: string): StatutEnvoi | null {
  switch (hubStatus) {
    case "queued":
    case "processing":
    case "accepted_by_provider":
      return "accepte";
    case "sent":
      return "envoye";
    case "delivered":
      return "delivre";
    case "read":
      return "lu";
    case "failed":
      return "echec";
    default:
      return null;
  }
}

export const MOTIF_VIDE_REPLI = "Aucun motif précisé";

/** Nettoie un paramètre texte destiné à Meta (jamais vide). */
export function paramNonVide(valeur: string | undefined | null, repli = "—"): string {
  const propre = (valeur ?? "").trim();
  return propre.length > 0 ? propre : repli;
}

/**
 * Construction pure des paramètres des 8 modèles WhatsApp (spec S3 §4).
 * L'ordre correspond exactement aux `{{1}}`, `{{2}}`, `{{3}}` soumis à Meta.
 */
export const MODELES_WHATSAPP = [
  "poitiers_bon_a_valider",
  "poitiers_bon_arbitre",
  "poitiers_litige_commande",
  "poitiers_intervention_a_arbitrer",
  "poitiers_intervention_suite",
  "poitiers_document_partage",
  "poitiers_rappel_compte_rendu",
  "poitiers_dossier_en_attente",
] as const;

export type ModeleWhatsapp = (typeof MODELES_WHATSAPP)[number];

export function construireParametresModele(
  modele: ModeleWhatsapp,
  c: {
    reference?: string;
    acteurNom?: string;
    libelle?: string;
    motif?: string;
    decision?: string;
    date?: string;
    heure?: string;
    duree?: string;
  },
): string[] {
  switch (modele) {
    case "poitiers_bon_a_valider":
      return [paramNonVide(c.reference, "N/A"), paramNonVide(c.acteurNom, "un collaborateur")];
    case "poitiers_bon_arbitre":
      return [
        paramNonVide(c.reference, "N/A"),
        paramNonVide(c.decision, "traité"),
        paramNonVide(c.motif, MOTIF_VIDE_REPLI),
      ];
    case "poitiers_litige_commande":
      return [paramNonVide(c.reference, "N/A"), paramNonVide(c.motif, MOTIF_VIDE_REPLI)];
    case "poitiers_intervention_a_arbitrer":
      return [paramNonVide(c.reference, "N/A"), paramNonVide(c.libelle, "demande d'intervention")];
    case "poitiers_intervention_suite":
      return [paramNonVide(c.reference, "N/A"), paramNonVide(c.decision, "traitée")];
    case "poitiers_document_partage":
      return [paramNonVide(c.libelle, "sans titre"), paramNonVide(c.acteurNom, "un collaborateur")];
    case "poitiers_rappel_compte_rendu":
      return [paramNonVide(c.date, "jour"), paramNonVide(c.heure, "20h00")];
    case "poitiers_dossier_en_attente":
      return [paramNonVide(c.reference, "N/A"), paramNonVide(c.duree, "plus de 24 h")];
  }
}

/** Comparaison en temps constant sur chaînes ASCII. */
export function comparaisonTempsConstant(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Vérifie la signature HMAC-SHA256 d'un webhook du hub WhatsApp (`sha256=<hex>`),
 * ainsi que la fenêtre anti-rejeu de 5 minutes sur `X-Hub-Timestamp`.
 * Utilise Web Crypto (`crypto.subtle`) : compatible Convex V8 et Node 18+.
 */
export async function verifierSignatureWebhookHub(
  corpsBrut: string,
  timestampHeader: string | null,
  signatureHeader: string | null,
  secret: string,
  maintenantSec = Math.floor(Date.now() / 1000),
): Promise<{ ok: boolean; raison?: string }> {
  if (!secret) return { ok: false, raison: "secret_absent" };
  if (!timestampHeader || !/^\d+$/.test(timestampHeader)) {
    return { ok: false, raison: "horodatage_invalide" };
  }
  const ts = Number(timestampHeader);
  if (Math.abs(maintenantSec - ts) > 300) {
    return { ok: false, raison: "horodatage_expire" };
  }
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) {
    return { ok: false, raison: "signature_absente" };
  }

  const enc = new TextEncoder();
  const cle = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", cle, enc.encode(`${timestampHeader}.${corpsBrut}`));
  const hex = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const attendue = `sha256=${hex}`;

  if (!comparaisonTempsConstant(signatureHeader, attendue)) {
    return { ok: false, raison: "signature_invalide" };
  }
  return { ok: true };
}

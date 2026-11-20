import { webcrypto } from "node:crypto";
if (!globalThis.crypto) (globalThis as any).crypto = webcrypto;
// Tests du transport sortant et du hub WhatsApp (lot S3) — 100 % pur, sans réseau.
// Lancer : npm run test:transport
import { CLES_S1, TYPE_PAR_CLE } from "../convex/lib/notifications.ts";
import {
  MOTIF_VIDE_REPLI,
  avancerStatut,
  classerErreurHub,
  cleIdempotence,
  construireParametresModele,
  delaiEtalementMs,
  modeCanal,
  verifierSignatureWebhookHub,
} from "../convex/lib/transport.ts";

let ok = 0, ko = 0;
function verifie(nom: string, cond: boolean) {
  if (cond) ok++; else { ko++; console.log("ÉCHEC", nom); }
}

// 1. Construction des paramètres des 8 modèles : nombre et ordre exacts.
const p1 = construireParametresModele("poitiers_bon_a_valider", { reference: "CMD-2026-012", acteurNom: "AMEFFO Lucie" });
verifie("1. poitiers_bon_a_valider (2 params dans l'ordre)", p1.length === 2 && p1[0] === "CMD-2026-012" && p1[1] === "AMEFFO Lucie");

const p2 = construireParametresModele("poitiers_bon_arbitre", { reference: "CMD-2026-012", decision: "rejeté", motif: "Budget insuffisant" });
verifie("1. poitiers_bon_arbitre (3 params dans l'ordre)", p2.length === 3 && p2[0] === "CMD-2026-012" && p2[1] === "rejeté" && p2[2] === "Budget insuffisant");

const p3 = construireParametresModele("poitiers_litige_commande", { reference: "CMD-2026-012", motif: "Carton manquant" });
verifie("1. poitiers_litige_commande (2 params)", p3.length === 2 && p3[0] === "CMD-2026-012" && p3[1] === "Carton manquant");

const p4 = construireParametresModele("poitiers_intervention_a_arbitrer", { reference: "INT-2026-004", libelle: "Panne climatiseur" });
verifie("1. poitiers_intervention_a_arbitrer (2 params)", p4.length === 2 && p4[0] === "INT-2026-004" && p4[1] === "Panne climatiseur");

const p5 = construireParametresModele("poitiers_intervention_suite", { reference: "INT-2026-004", decision: "validée" });
verifie("1. poitiers_intervention_suite (2 params)", p5.length === 2 && p5[0] === "INT-2026-004" && p5[1] === "validée");

const p6 = construireParametresModele("poitiers_document_partage", { libelle: "Note de service", acteurNom: "Direction" });
verifie("1. poitiers_document_partage (2 params)", p6.length === 2 && p6[0] === "Note de service" && p6[1] === "Direction");

const p7 = construireParametresModele("poitiers_rappel_compte_rendu", { date: "2026-11-20", heure: "20h00" });
verifie("1. poitiers_rappel_compte_rendu (2 params)", p7.length === 2 && p7[0] === "2026-11-20" && p7[1] === "20h00");

const p8 = construireParametresModele("poitiers_dossier_en_attente", { reference: "CMD-2026-012", duree: "26 h" });
verifie("1. poitiers_dossier_en_attente (2 params)", p8.length === 2 && p8[0] === "CMD-2026-012" && p8[1] === "26 h");

// 2. Motif vide sur poitiers_bon_arbitre → "Aucun motif précisé", jamais chaîne vide.
const pVide = construireParametresModele("poitiers_bon_arbitre", { reference: "CMD-2026-012", decision: "validé", motif: "   " });
verifie("2. motif vide replié sur 'Aucun motif précisé'", pVide[2] === MOTIF_VIDE_REPLI && pVide[2].length > 0);

// 3. Clé d'idempotence : déterministe, ASCII, sans espace, <= 255 caractères.
const k1 = cleIdempotence("whatsapp", "commande_soumise", "commandes", "j57abc", "j91def");
const k2 = cleIdempotence("whatsapp", "commande_soumise", "commandes", "j57abc", "j91def");
verifie("3. clé déterministe", k1 === k2);
verifie("3. clé ASCII sans espace <= 255", /^[\x21-\x7E]+$/.test(k1) && k1.length <= 255);

// 4. Clé d'un rappel répété : diffère d'un jour à l'autre.
const r1 = cleIdempotence("whatsapp", "rappel_compte_rendu", "comptesRendus", "u1", "u1", "2026-11-12");
const r2 = cleIdempotence("whatsapp", "rappel_compte_rendu", "comptesRendus", "u1", "u1", "2026-11-13");
verifie("4. clé rappel répété diffère d'un jour à l'autre", r1 !== r2);

// 5. Politique de canal : les 13 types de S1 donnent exactement la table du §7.
const ATTENDUS_WHATSAPP = new Set([
  "commande_soumise",
  "commande_rejetee",
  "commande_litige",
  "intervention_creee",
  "intervention_arbitree",
  "document_adresse",
]);
for (const cle of CLES_S1) {
  const actif = Boolean(TYPE_PAR_CLE[cle]?.canaux?.includes("whatsapp"));
  verifie(`5. politique WhatsApp pour ${cle}`, actif === ATTENDUS_WHATSAPP.has(cle));
}

// 6. Classement des codes d'échec : 429/5xx/réseau rejouables ; 401/403/409/422 non.
verifie("6. 429 rejouable", classerErreurHub(429, "throttled").rejouable);
verifie("6. 503 rejouable", classerErreurHub(503).rejouable);
verifie("6. erreur réseau (0) rejouable", classerErreurHub(0).rejouable);
verifie("6. 401 non rejouable + alerte", !classerErreurHub(401, "not_authenticated").rejouable && classerErreurHub(401, "not_authenticated").alerteProprietaire);
verifie("6. 403 non rejouable", !classerErreurHub(403, "application_suspended").rejouable);
verifie("6. 409 non rejouable", !classerErreurHub(409, "idempotency_key_conflict").rejouable);
verifie("6. 422 non rejouable", !classerErreurHub(422, "invalid_template_parameters").rejouable);
verifie("6. 131026 numéro douteux", classerErreurHub(422, "131026").numeroDouteux && !classerErreurHub(422, "131026").rejouable);

// 7. Mode du canal : clé absente → simulation ; clé + interrupteur fermé → simulation ; les deux → réel.
verifie("7. clé absente → simulation", modeCanal(false, true) === "simulation");
verifie("7. interrupteur fermé → simulation", modeCanal(true, false) === "simulation");
verifie("7. clé présente + interrupteur ouvert → réel", modeCanal(true, true) === "reel");

// 8. Étalement : i-ème destinataire décalé de i * 1200 ms.
verifie("8. étalement 0 → 0 ms", delaiEtalementMs(0) === 0);
verifie("8. étalement 3 → 3600 ms", delaiEtalementMs(3) === 3600);

// 9. Monotonie des statuts : `lu` reçu puis `delivre` → reste `lu`.
verifie("9. lu puis delivre reste lu", avancerStatut("lu", "delivre") === "lu");
verifie("9. accepte puis delivre avance à delivre", avancerStatut("accepte", "delivre") === "delivre");
verifie("9. echec est final", avancerStatut("echec", "lu") === "echec");

// 10. Vérification de signature HMAC-SHA256 : corps modifié d'un octet refusé.
async function testerSignature() {
  const secret = "whsec_test_secret_poitiers";
  const corps = JSON.stringify({ type: "message.delivered", data: { message_id: "m1", status: "delivered" } });
  const ts = "1794400000";
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(`${ts}.${corps}`));
  const sigHex = "sha256=" + Array.from(new Uint8Array(sigBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");

  const okRes = await verifierSignatureWebhookHub(corps, ts, sigHex, secret, 1794400010);
  verifie("10. signature valide acceptée", okRes.ok);

  const modRes = await verifierSignatureWebhookHub(corps + " ", ts, sigHex, secret, 1794400010);
  verifie("10. corps modifié d'un octet refusé", !modRes.ok);

  const expRes = await verifierSignatureWebhookHub(corps, ts, sigHex, secret, 1794400400);
  verifie("10. horodatage > 5 min refusé", !expRes.ok);

  console.log(`transportWhatsapp : ${ok} contrôles OK, ${ko} échec(s)`);
  if (ko) process.exit(1);
}

await testerSignature();

// Catalogue des événements notifiables, calcul des destinataires, préférences (S2),
// politique de canaux sortants (S3/S4), rappels (S5/S7) et routage par service (S6).
//
// Ce fichier est la SOURCE UNIQUE : l'émetteur (convex/notifications.ts), les transports,
// les tests et l'écran `/notifications` en dérivent. Ajouter un événement ici, jamais ailleurs.
//
// PUR : importable par un test et par une page, sans contexte Convex.

import type { Droits } from "../rbac.ts";
import {
  construireParametresModele,
  type Canal,
  type ModeleWhatsapp,
} from "./transport.ts";

export type Importance = "info" | "a_traiter" | "urgent";

/** Ce qu'un événement sait de lui-même au moment du rendu de son libellé. */
export type ContexteRendu = {
  reference?: string;   // "CMD-2026-012"
  acteurNom?: string;   // "AMEFFO Lucie"
  libelle?: string;     // objet du dossier, titre de l'intervention…
  motif?: string;       // motif de rejet, description d'un litige
  extrait?: string;     // début d'un commentaire, durée d'attente, heure de fermeture
};

export type TypeEvenement = {
  /** Clé stable, stockée en base. Ne la renomme JAMAIS : l'historique la porte. */
  cle: string;
  /** Libellé du type, pour les préférences et les tests. */
  libelle: string;
  /** Module rbac auquel l'objet appartient. Sert au filtre de visibilité (invariant 2). */
  module: string;
  importance: Importance;
  /**
   * Qui doit être prévenu, exprimé EN DROIT — jamais en rôle.
   * `null` : personne par ce biais (seuls le propriétaire ou les destinataires explicites).
   */
  cible: { module: string; action: "voir" | "faire" } | null;
  /** Le propriétaire du dossier (son créateur) est-il prévenu de cet événement ? */
  previentLeProprietaire: boolean;
  /** Le responsable du service concerné par l'objet est-il prévenu ? (lot S6) */
  previentLeServiceConcerne?: boolean;
  /**
   * Portée par objet : sans CE droit, l'objet n'est visible que de son propriétaire.
   * Encode la décision du 13/10/2026 sur les interventions. Absent = objet visible de
   * tous ceux qui ont `module` en Voir.
   */
  portee?: string;
  /** Canaux sortants actifs pour ce type (S3 WhatsApp, S4 Push). */
  canaux?: Canal[];
  /** Modèle WhatsApp et construction de ses paramètres, si le type part sur WhatsApp (S3). */
  whatsapp?: {
    modele: ModeleWhatsapp;
    parametres: (c: ContexteRendu) => string[];
  };
  /** Rendu du titre affiché. Figé à l'émission (voir spec S1 §5). */
  titre: (c: ContexteRendu) => string;
  /** Rendu du corps, optionnel. */
  corps?: (c: ContexteRendu) => string | undefined;
};

// Catalogue complet : 13 types de S1 + rappels S5 + pense-bête S7.
export const TYPES: TypeEvenement[] = [
  // ---------------- Commandes ----------------
  {
    cle: "commande_soumise",
    libelle: "Bon de commande soumis à validation",
    module: "/commandes",
    importance: "a_traiter",
    cible: { module: "/commandes/validation", action: "faire" },
    previentLeProprietaire: false,
    previentLeServiceConcerne: true,
    canaux: ["whatsapp", "push"],
    whatsapp: {
      modele: "poitiers_bon_a_valider",
      parametres: (c) =>
        construireParametresModele("poitiers_bon_a_valider", {
          reference: c.reference,
          acteurNom: c.acteurNom,
        }),
    },
    titre: (c) => `Bon ${c.reference ?? ""} à valider`.replace(/\s+/g, " ").trim(),
    corps: (c) => [c.libelle, c.acteurNom && `soumis par ${c.acteurNom}`].filter(Boolean).join(" — ") || undefined,
  },
  {
    cle: "commande_validee",
    libelle: "Bon de commande validé",
    module: "/commandes",
    importance: "info",
    cible: { module: "/commandes", action: "faire" },
    previentLeProprietaire: true,
    previentLeServiceConcerne: true,
    titre: (c) => `Bon ${c.reference ?? ""} validé`.replace(/\s+/g, " ").trim(),
    corps: (c) => (c.acteurNom ? `Validé par ${c.acteurNom}` : undefined),
  },
  {
    cle: "commande_rejetee",
    libelle: "Bon de commande rejeté",
    module: "/commandes",
    importance: "a_traiter",
    cible: { module: "/commandes", action: "faire" },
    previentLeProprietaire: true,
    previentLeServiceConcerne: true,
    canaux: ["whatsapp", "push"],
    whatsapp: {
      modele: "poitiers_bon_arbitre",
      parametres: (c) =>
        construireParametresModele("poitiers_bon_arbitre", {
          reference: c.reference,
          decision: "rejeté",
          motif: c.motif,
        }),
    },
    titre: (c) => `Bon ${c.reference ?? ""} rejeté`.replace(/\s+/g, " ").trim(),
    corps: (c) => c.motif,
  },
  {
    cle: "commande_litige",
    libelle: "Litige signalé sur une commande",
    module: "/commandes",
    importance: "urgent",
    cible: { module: "/commandes", action: "faire" },
    previentLeProprietaire: true,
    previentLeServiceConcerne: true,
    canaux: ["whatsapp", "push"],
    whatsapp: {
      modele: "poitiers_litige_commande",
      parametres: (c) =>
        construireParametresModele("poitiers_litige_commande", {
          reference: c.reference,
          motif: c.motif,
        }),
    },
    titre: (c) => `Litige sur le bon ${c.reference ?? ""}`.replace(/\s+/g, " ").trim(),
    corps: (c) => c.motif,
  },
  {
    cle: "commande_commentaire",
    libelle: "Commentaire sur une commande",
    module: "/commandes",
    importance: "info",
    cible: { module: "/commandes", action: "faire" },
    previentLeProprietaire: true,
    titre: (c) => `Commentaire sur le bon ${c.reference ?? ""}`.replace(/\s+/g, " ").trim(),
    corps: (c) => (c.acteurNom ? `${c.acteurNom} : ${c.extrait ?? ""}`.trim() : c.extrait),
  },

  // ---------------- Interventions ----------------
  {
    cle: "intervention_creee",
    libelle: "Demande d'intervention déposée",
    module: "/interventions",
    importance: "a_traiter",
    cible: { module: "/interventions", action: "faire" },
    previentLeProprietaire: false,
    previentLeServiceConcerne: true,
    portee: "/interventions/toutes",
    canaux: ["whatsapp", "push"],
    whatsapp: {
      modele: "poitiers_intervention_a_arbitrer",
      parametres: (c) =>
        construireParametresModele("poitiers_intervention_a_arbitrer", {
          reference: c.reference,
          libelle: c.libelle,
        }),
    },
    titre: (c) => `Intervention ${c.reference ?? ""} à arbitrer`.replace(/\s+/g, " ").trim(),
    corps: (c) => [c.libelle, c.acteurNom && `déposée par ${c.acteurNom}`].filter(Boolean).join(" — ") || undefined,
  },
  {
    cle: "intervention_arbitree",
    libelle: "Intervention validée ou rejetée",
    module: "/interventions",
    importance: "info",
    cible: null,
    previentLeProprietaire: true,
    previentLeServiceConcerne: true,
    portee: "/interventions/toutes",
    canaux: ["whatsapp", "push"],
    whatsapp: {
      modele: "poitiers_intervention_suite",
      parametres: (c) =>
        construireParametresModele("poitiers_intervention_suite", {
          reference: c.reference,
          decision: c.motif ? `traitée (${c.motif})` : "traitée",
        }),
    },
    titre: (c) => `Intervention ${c.reference ?? ""} : suite donnée`.replace(/\s+/g, " ").trim(),
    corps: (c) => c.motif,
  },
  {
    cle: "intervention_cloturee",
    libelle: "Intervention clôturée",
    module: "/interventions",
    importance: "info",
    cible: null,
    previentLeProprietaire: true,
    previentLeServiceConcerne: true,
    portee: "/interventions/toutes",
    titre: (c) => `Intervention ${c.reference ?? ""} clôturée`.replace(/\s+/g, " ").trim(),
  },
  {
    cle: "intervention_commentaire",
    libelle: "Commentaire sur une intervention",
    module: "/interventions",
    importance: "info",
    cible: null,
    previentLeProprietaire: true,
    portee: "/interventions/toutes",
    titre: (c) => `Commentaire sur l'intervention ${c.reference ?? ""}`.replace(/\s+/g, " ").trim(),
    corps: (c) => (c.acteurNom ? `${c.acteurNom} : ${c.extrait ?? ""}`.trim() : c.extrait),
  },

  // ---------------- Comptes rendus ----------------
  {
    cle: "cr_remarque",
    libelle: "Remarque du superviseur sur un compte rendu",
    module: "/comptes-rendus",
    importance: "a_traiter",
    cible: null,
    previentLeProprietaire: true,
    titre: () => "Remarque sur votre compte rendu",
    corps: (c) => (c.acteurNom ? `${c.acteurNom} : ${c.extrait ?? ""}`.trim() : c.extrait),
  },
  {
    cle: "cr_valide",
    libelle: "Compte rendu validé",
    module: "/comptes-rendus",
    importance: "info",
    cible: null,
    previentLeProprietaire: true,
    titre: () => "Votre compte rendu est validé",
  },

  // ---------------- Documents ----------------
  {
    cle: "document_adresse",
    libelle: "Document partagé nominativement",
    module: "/documents",
    importance: "a_traiter",
    cible: null,
    previentLeProprietaire: false,
    canaux: ["whatsapp", "push"],
    whatsapp: {
      modele: "poitiers_document_partage",
      parametres: (c) =>
        construireParametresModele("poitiers_document_partage", {
          libelle: c.libelle,
          acteurNom: c.acteurNom,
        }),
    },
    titre: (c) => `Document partagé : ${c.libelle ?? "sans titre"}`,
    corps: (c) => (c.acteurNom ? `Déposé par ${c.acteurNom}` : undefined),
  },

  // ---------------- Membres ----------------
  {
    cle: "compte_en_attente",
    libelle: "Nouveau compte en attente d'autorisation",
    module: "/membres",
    importance: "a_traiter",
    cible: { module: "/membres", action: "faire" },
    previentLeProprietaire: false,
    titre: (c) => `Compte à autoriser : ${c.libelle ?? ""}`.trim(),
  },

  // ---------------- Rappels automatiques (lot S5) ----------------
  {
    cle: "rappel_compte_rendu",
    libelle: "Rappel : compte rendu du jour",
    module: "/comptes-rendus",
    importance: "a_traiter",
    cible: null,
    previentLeProprietaire: true,
    canaux: ["whatsapp", "push"],
    whatsapp: {
      modele: "poitiers_rappel_compte_rendu",
      parametres: (c) =>
        construireParametresModele("poitiers_rappel_compte_rendu", {
          date: c.libelle,
          heure: c.extrait,
        }),
    },
    titre: (c) => `Compte rendu du ${c.libelle ?? "jour"} non déposé`,
    corps: (c) => (c.extrait ? `Le créneau se ferme à ${c.extrait}.` : undefined),
  },
  {
    cle: "rappel_journee_financiere",
    libelle: "Rappel : journée financière non saisie",
    module: "/financier",
    importance: "a_traiter",
    cible: { module: "/financier", action: "faire" },
    previentLeProprietaire: false,
    canaux: ["push"],
    titre: (c) => `Journée financière du ${c.libelle ?? "jour"} non saisie`,
    corps: () => "Aucune écriture enregistrée à ce jour dans le grand livre.",
  },
  {
    cle: "rappel_cloture_paie",
    libelle: "Rappel : clôture de paie à effectuer",
    module: "/paie/bulletins",
    importance: "a_traiter",
    cible: { module: "/paie/bulletins", action: "faire" },
    previentLeProprietaire: false,
    canaux: ["push"],
    titre: (c) => `Paie ${c.libelle ?? ""} non clôturée`.replace(/\s+/g, " ").trim(),
    corps: (c) => c.extrait,
  },
  {
    cle: "rappel_dossier_en_attente",
    libelle: "Rappel : dossier en attente",
    module: "/commandes", // surchargé à l'émission selon le dossier (voir S5 §4)
    importance: "a_traiter",
    cible: null,
    previentLeProprietaire: false,
    canaux: ["whatsapp", "push"],
    whatsapp: {
      modele: "poitiers_dossier_en_attente",
      parametres: (c) =>
        construireParametresModele("poitiers_dossier_en_attente", {
          reference: c.reference,
          duree: c.extrait,
        }),
    },
    titre: (c) => `${c.reference ?? "Dossier"} attend une décision`,
    corps: (c) => (c.extrait ? `En attente depuis ${c.extrait}.` : undefined),
  },
  {
    cle: "rappel_verrou_financier",
    libelle: "Rappel : verrou financier bientôt expiré",
    module: "/financier",
    importance: "urgent",
    cible: null,
    previentLeProprietaire: true,
    canaux: ["push"],
    titre: (c) => `Verrou du ${c.libelle ?? "grand livre"} bientôt expiré`,
    corps: () => "Enregistrez votre saisie avant expiration du verrou (3 min restantes).",
  },
  {
    cle: "rappel_delai_caisse",
    libelle: "Rappel : délai de correction caisse",
    module: "/caisse",
    importance: "info",
    cible: null,
    previentLeProprietaire: true,
    titre: (c) => `Correction caisse (${c.libelle ?? "ligne"}) : 10 min restantes`,
    corps: () => "Au-delà de ce délai, seul un déverrouillage permettra de modifier cette ligne.",
  },

  // ---------------- Pense-bête personnel (lot S7) ----------------
  {
    cle: "pense_bete",
    libelle: "Pense-bête personnel",
    module: "/notifications",
    importance: "a_traiter",
    cible: null,
    previentLeProprietaire: true,
    canaux: ["push"],
    titre: (c) => `Rappel : ${c.libelle ?? ""}`.trim(),
    corps: (c) => c.extrait,
  },
];

export const TYPE_PAR_CLE: Record<string, TypeEvenement> =
  Object.fromEntries(TYPES.map((t) => [t.cle, t]));

/** Les 13 types métier initiaux du lot S1 (pour tests de politique S3). */
export const CLES_S1 = [
  "commande_soumise",
  "commande_validee",
  "commande_rejetee",
  "commande_litige",
  "commande_commentaire",
  "intervention_creee",
  "intervention_arbitree",
  "intervention_cloturee",
  "intervention_commentaire",
  "cr_remarque",
  "cr_valide",
  "document_adresse",
  "compte_en_attente",
] as const;

/** Ce que l'émetteur sait de l'événement en cours. */
export type Evenement = {
  type: string;                       // clé du catalogue
  acteurId?: string;                  // qui a agi (absent sur inscription / cron)
  acteurNom?: string;
  proprietaireId?: string;            // créateur du dossier (commandes.creePar, …)
  serviceResponsableId?: string;      // responsable du service concerné (lot S6)
  destinatairesExplicites?: string[]; // documents nominatifs, rappels ciblés S5
  /** Surcharge de module pour un type polymorphe (ex. rappel_dossier_en_attente). */
  moduleSurcharge?: string;
  rendu?: ContexteRendu;
};

/** Un membre, vu par l'adressage. */
export type MembreAdressable = {
  id: string;
  actif: boolean;
  enAttente: boolean;
  droits: Droits;
};

/**
 * Qui doit être prévenu de cet événement. PUR.
 *
 * Ordre : candidats par droit + propriétaire + responsable de service (S6) + destinataires
 * explicites, puis retrait de l'acteur, puis filtre de visibilité, puis dédoublonnage.
 */
export function destinataires(
  type: TypeEvenement,
  e: Evenement,
  membres: MembreAdressable[],
): string[] {
  const parId = new Map(membres.map((m) => [m.id, m]));
  const retenus = new Set<string>();
  const moduleEffectif = e.moduleSurcharge ?? type.module;

  // 1. Par droit — l'adressage normal, déduit de la matrice du DG.
  if (type.cible) {
    for (const m of membres) {
      if (m.droits[type.cible.module]?.[type.cible.action]) retenus.add(m.id);
    }
  }
  // 2. Le propriétaire du dossier, s'il suit cet événement.
  if (type.previentLeProprietaire && e.proprietaireId) retenus.add(e.proprietaireId);
  // 2 bis. Le responsable du service concerné par le dossier (lot S6).
  if (type.previentLeServiceConcerne && e.serviceResponsableId) {
    retenus.add(e.serviceResponsableId);
  }
  // 3. Les destinataires nominatifs (documents, rappels ciblés).
  for (const id of e.destinatairesExplicites ?? []) retenus.add(id);

  // 4. Jamais l'auteur de son propre geste (invariant 1).
  if (e.acteurId) retenus.delete(e.acteurId);

  // 5. Filtre final : compte utilisable, et droit de VOIR l'objet (invariants 2 et 3).
  return [...retenus].filter((id) => {
    const m = parId.get(id);
    if (!m || !m.actif || m.enAttente) return false;
    if (!m.droits[moduleEffectif]?.voir) return false;
    // Portée par objet : sans le droit d'ensemble, on ne voit que son propre dossier.
    if (type.portee && !m.droits[type.portee]?.voir && id !== e.proprietaireId) return false;
    return true;
  });
}

/** Titre et corps figés à l'émission. */
export function rendre(type: TypeEvenement, c: ContexteRendu = {}) {
  return { titre: type.titre(c), corps: type.corps?.(c) };
}

// ---------------- Préférences utilisateur (lot S2) ----------------

/**
 * Exclut les types mis en silence par le membre du compteur et du panneau (S2 §6).
 * L'historique, lui, conserve toutes les lignes.
 */
export function filtrerNonLuesParPreferences<T extends { type: string }>(
  lignes: T[],
  notifsSilencieuses: string[] = [],
): T[] {
  if (!notifsSilencieuses.length) return lignes;
  const sil = new Set(notifsSilencieuses);
  return lignes.filter((l) => !sil.has(l.type));
}

/** Vérifie que toutes les clés de préférences existent dans le catalogue. */
export function validerPreferencesSilencieuses(cles: string[]): {
  ok: boolean;
  inconnues: string[];
  normalisees: string[];
} {
  const inconnues: string[] = [];
  const vues = new Set<string>();
  for (const c of cles) {
    if (!TYPE_PAR_CLE[c]) inconnues.push(c);
    else vues.add(c);
  }
  return { ok: inconnues.length === 0, inconnues, normalisees: [...vues] };
}

const RANG_IMPORTANCE: Record<Importance, number> = {
  info: 1,
  a_traiter: 2,
  urgent: 3,
};

/** Importance la plus élevée d'un lot de notifications non lues (teinte du badge S2). */
export function importanceDominante(
  lignes: { importance: Importance }[],
): Importance | null {
  let max: Importance | null = null;
  for (const l of lignes) {
    if (!max || RANG_IMPORTANCE[l.importance] > RANG_IMPORTANCE[max]) {
      max = l.importance;
    }
  }
  return max;
}

// Modèle d'accès : un NIVEAU par rôle (hiérarchie des membres, droits par défaut) et des droits
// VOIR / FAIRE par module que le directeur ajuste (voir « Droits par module » plus bas).
//
// Ce fichier est la SOURCE UNIQUE : les gardes serveur (`lib/authz.requireDroit`), les gardes
// d'écran (`src/auth/Guard.tsx`), le menu et l'onglet « Rôles & accès » des paramètres en dérivent.
// Ajouter un droit ici, jamais dans un composant.

export type Role =
  | "employe" | "chef_equipe" | "comptable" | "gestionnaire_rh"
  | "da1" | "dg" | "super_admin" | "auditeur_externe";

export const NIVEAU: Record<Role, number> = {
  employe: 1,
  chef_equipe: 2,
  comptable: 3,
  gestionnaire_rh: 4,
  da1: 5,
  dg: 7,           // le niveau 6 (ex-DA2) a été retiré : aucun droit ne le distinguait du niveau 5
  super_admin: 8,  // technique : données de démo, fiche API, état du déploiement — pas un rôle métier
  auditeur_externe: 0, // hors hiérarchie (orthogonal)
};

export const LIBELLE: Record<Role, string> = {
  employe: "Employé",
  chef_equipe: "Chef d'équipe",
  comptable: "Comptable",
  gestionnaire_rh: "Gestionnaire RH",
  da1: "Directeur Administratif (DAF)",
  dg: "Directeur Général (Admin)",
  super_admin: "Super administrateur (technique)",
  auditeur_externe: "Auditeur Externe",
};

// Ce que le rôle apporte EN PLUS du niveau précédent — c'est ce que le DG lit en attribuant un rôle.
export const DESCRIPTION: Record<Role, string> = {
  employe: "Comptes rendus, documents ouverts, interventions, tableau de bord.",
  chef_equipe: "+ vue superviseur des comptes rendus de l'équipe.",
  comptable: "+ employés, commandes, caisse & primes médecins, récapitulatif financier (grand livre).",
  gestionnaire_rh: "+ toute la paie (saisie, bulletins, courrier, planning, archives) et le barème.",
  da1: "+ grand livre financier, validation des commandes et interventions, documents confidentiels.",
  dg: "+ membres et rôles, paramètres, journal, audit, nouvelle version du barème.",
  super_admin: "Tout, plus le technique : données de démo, fiche API, état du déploiement. Réservé au développeur.",
  auditeur_externe: "Consulte tous les modules sans agir, sauf Paramètres, Journal, Archives et documents ; saisit l'audit.",
};

// Rôles proposés dans « Membres » : dans l'ordre des niveaux, l'auditeur à part.
export const ROLES_ORDONNES: Role[] = ["employe", "chef_equipe", "comptable", "gestionnaire_rh", "da1", "dg", "super_admin", "auditeur_externe"];

// ============================================================================================
// Droits par module : VOIR et FAIRE, choisis par le directeur (décision du 28/09/2026).
// --------------------------------------------------------------------------------------------
// Le niveau ne décide plus seul : il fournit les droits PAR DÉFAUT d'un rôle. Le directeur les
// modifie dans Paramètres → Rôles & accès (surcharges par rôle, `parametresEntreprise.droitsRoles`)
// et peut accorder ou retirer un droit à une personne (`users.droitsPerso`).
// Ordre d'application : défaut du rôle → surcharge du rôle → exception de la personne → garde-fous.
// ============================================================================================

export type Action = "voir" | "faire";
export type Cellule = { voir: boolean; faire: boolean };
export type Droits = Record<string, Cellule>;
export type SurchargeRole = { role: string; module: string; voir: boolean; faire: boolean };
export type Exception = { module: string; voir: boolean; faire: boolean };

export type Categorie = "Exploitation" | "Paie" | "Finances" | "Direction";
export type Module = {
  cle: string;
  libelle: string;
  categorie: Categorie;
  /** Ce que « Voir » ouvre ; `null` : ligne sans consultation propre (une seule case, « Faire »). */
  voir: string | null;
  /** Ce que « Faire » ajoute ; `null` : module en lecture seule. */
  faire: string | null;
  /** Niveaux qui donnent le droit par défaut (l'ancienne hiérarchie). */
  niveauVoir: number;
  niveauFaire: number;
  /** Audit : cloisonné, ouvert par défaut à l'auditeur externe et au DG seulement. */
  cloisonne?: boolean;
};

export const MODULES: Module[] = [
  { cle: "/comptes-rendus", libelle: "Comptes rendus", categorie: "Exploitation", voir: "Rédiger et suivre ses comptes rendus", faire: "Superviser l'équipe (taux, validation)", niveauVoir: 1, niveauFaire: 2 },
  { cle: "/interventions", libelle: "Interventions", categorie: "Exploitation", voir: "Consulter, déclarer, commenter", faire: "Valider, clôturer, rejeter", niveauVoir: 1, niveauFaire: 5 },
  { cle: "/documents", libelle: "Documents", categorie: "Exploitation", voir: "Consulter (selon le niveau de chaque document)", faire: "Déposer, supprimer ses dépôts", niveauVoir: 1, niveauFaire: 1 },
  { cle: "/documents/confidentiels", libelle: "Documents confidentiels", categorie: "Exploitation", voir: "Lire les documents confidentiels", faire: "Déposer un document confidentiel", niveauVoir: 5, niveauFaire: 5 },
  { cle: "/employes", libelle: "Employés", categorie: "Exploitation", voir: "Consulter les fiches", faire: "Créer, modifier, importer", niveauVoir: 3, niveauFaire: 4 },
  { cle: "/commandes", libelle: "Commandes", categorie: "Exploitation", voir: "Consulter", faire: "Créer, modifier, commenter, livrer", niveauVoir: 3, niveauFaire: 3 },
  { cle: "/commandes/validation", libelle: "Validation des commandes", categorie: "Exploitation", voir: null, faire: "Valider ou rejeter une commande", niveauVoir: 5, niveauFaire: 5 },
  { cle: "/statistiques", libelle: "Caisse & primes médecins", categorie: "Exploitation", voir: "Consulter", faire: "Saisir, importer, supprimer", niveauVoir: 3, niveauFaire: 3 },
  { cle: "/statistiques/deverrouillage", libelle: "Caisse & primes : modifier après le délai", categorie: "Exploitation", voir: null, faire: "Corriger ou supprimer une ligne verrouillée (délai réglé dans Paramètres)", niveauVoir: 7, niveauFaire: 7 },
  { cle: "/paie/saisie", libelle: "Récapitulatif salaires", categorie: "Paie", voir: "Consulter", faire: "Saisir le mois", niveauVoir: 4, niveauFaire: 4 },
  { cle: "/paie/bulletins", libelle: "Bulletins du mois", categorie: "Paie", voir: "Consulter, imprimer, PDF", faire: "Générer et clôturer le mois", niveauVoir: 4, niveauFaire: 4 },
  { cle: "/paie/liste", libelle: "Liste des salaires", categorie: "Paie", voir: "Consulter, imprimer", faire: null, niveauVoir: 4, niveauFaire: 4 },
  { cle: "/paie/courrier", libelle: "Courrier de paie", categorie: "Paie", voir: "Consulter, imprimer", faire: "Envoyer, modifier la lettre", niveauVoir: 4, niveauFaire: 4 },
  { cle: "/paie/planning", libelle: "Planning des absences", categorie: "Paie", voir: "Consulter", faire: "Saisir, synchroniser la paie", niveauVoir: 4, niveauFaire: 4 },
  { cle: "/paie/primes", libelle: "Primes & retenues", categorie: "Paie", voir: "Consulter", faire: "Ajouter, modifier, supprimer", niveauVoir: 4, niveauFaire: 4 },
  { cle: "/paie/archives", libelle: "Archives de paie", categorie: "Paie", voir: "Consulter les mois clôturés", faire: "Générer les PDF", niveauVoir: 4, niveauFaire: 4 },
  { cle: "/bareme", libelle: "Barème", categorie: "Paie", voir: "Consulter, contrôler la source", faire: "Publier une nouvelle version", niveauVoir: 4, niveauFaire: 7 },
  { cle: "/financier", libelle: "Récapitulatif financier (grand livre)", categorie: "Finances", voir: "Consulter", faire: "Saisir la journée, justificatifs, clôturer", niveauVoir: 5, niveauFaire: 5 },
  { cle: "/audit", libelle: "Audit", categorie: "Finances", voir: "Consulter", faire: "Saisir, rapports", niveauVoir: 7, niveauFaire: 7, cloisonne: true },
  { cle: "/membres", libelle: "Membres", categorie: "Direction", voir: "Consulter", faire: "Créer, modifier, rôles (jusqu'à son niveau)", niveauVoir: 7, niveauFaire: 7 },
  { cle: "/parametres", libelle: "Paramètres", categorie: "Direction", voir: "Consulter", faire: "Modifier, dont ces droits", niveauVoir: 7, niveauFaire: 7 },
  { cle: "/journal", libelle: "Journal d'activité", categorie: "Direction", voir: "Consulter, exporter", faire: null, niveauVoir: 7, niveauFaire: 7 },
];
export const MODULE_PAR_CLE: Record<string, Module> = Object.fromEntries(MODULES.map((m) => [m.cle, m]));

// Ce que l'auditeur externe ne voit pas (décision du 28/09/2026 ; comptes rendus : ce sont des rapports
// quotidiens du personnel, sans objet pour un externe) ; ailleurs il consulte sans agir.
const AUDITEUR_EXCLUS = new Set(["/parametres", "/journal", "/paie/archives", "/documents", "/documents/confidentiels", "/comptes-rendus"]);
// Rôles qui voient l'audit en plus de l'auditeur : cloisonné (un niveau 5 est refusé).
export const ROLES_AUDIT: Role[] = ["dg", "super_admin"];

/** Droit par défaut d'un rôle sur un module (ce que donne l'ancienne hiérarchie, plus les décisions). */
export function celluleParDefaut(role: Role, m: Module): Cellule {
  if (m.cloisonne) { const ok = role === "auditeur_externe" || ROLES_AUDIT.includes(role); return { voir: ok, faire: ok }; }
  if (role === "auditeur_externe") return { voir: !AUDITEUR_EXCLUS.has(m.cle), faire: false };
  if (role === "comptable" && m.cle === "/financier") return { voir: true, faire: true }; // décision du 28/09/2026
  const n = NIVEAU[role];
  return { voir: n >= m.niveauVoir, faire: n >= m.niveauFaire };
}

/** Garde-fous : ce qu'aucune case ne peut retirer. */
export function estVerrouille(role: Role, module: string): boolean {
  if (role === "super_admin") return true; // technique : tout, toujours
  return role === "dg" && (module === "/parametres" || module === "/membres"); // le directeur ne s'enferme pas dehors
}

/** Normalise une cellule selon le module : « Faire » implique « Voir », lecture seule sans « Faire ». */
export function normaliser(m: Module, c: Cellule): Cellule {
  if (m.faire === null) c = { voir: c.voir, faire: false };
  if (m.voir === null) c = { voir: c.faire, faire: c.faire };
  return c.faire ? { voir: true, faire: true } : c;
}

/**
 * Droits effectifs d'un membre, module par module. Pur : partagé par le serveur (gardes) et
 * l'écran (matrice).
 */
export function droitsEffectifs(role: Role, surcharges: SurchargeRole[] = [], exceptions: Exception[] = []): Droits {
  const d: Droits = {};
  for (const m of MODULES) {
    let c = celluleParDefaut(role, m);
    const s = surcharges.find((x) => x.role === role && x.module === m.cle);
    if (s) c = { voir: s.voir, faire: s.faire };
    const e = exceptions.find((x) => x.module === m.cle);
    if (e) c = { voir: e.voir, faire: e.faire };
    if (estVerrouille(role, m.cle)) c = { voir: true, faire: true };
    d[m.cle] = normaliser(m, c);
  }
  // Clés dérivées, hors matrice.
  d["/"] = { voir: true, faire: false }; // tableau de bord : tout membre autorisé
  const paie = MODULES.filter((m) => m.cle.startsWith("/paie/")).some((m) => d[m.cle].voir);
  d["/paie"] = { voir: paie, faire: false };
  const tech = role === "super_admin";
  d["/api-readme"] = { voir: tech, faire: tech }; // technique, jamais délégué
  return d;
}

/** Droits par défaut d'un rôle (sans surcharge) : ce que montre la matrice avant toute retouche. */
export const droitsParDefaut = (role: Role): Droits => droitsEffectifs(role);

/** Accès par défaut d'un rôle à un module (sans surcharge ni exception). */
export function canAccess(role: Role, module: string): boolean {
  return droitsParDefaut(role)[module]?.voir ?? false;
}

// Accès par objet (documents, lignes financières) — au-delà du rôle.
// Un document confidentiel suit le droit « Documents confidentiels » (`lireConfidentiel`) ;
// les autres, le niveau de visibilité / téléchargement porté par le document.
export const NIVEAU_CONFIDENTIEL = 5;

export function canView(role: Role, obj: { niveauVisible: number; confidentiel?: boolean }, lireConfidentiel = NIVEAU[role] >= NIVEAU_CONFIDENTIEL): boolean {
  if (obj.confidentiel) return lireConfidentiel;
  return NIVEAU[role] >= obj.niveauVisible;
}

export function canDownload(role: Role, obj: { niveauTelechargement: number; confidentiel?: boolean }, lireConfidentiel = NIVEAU[role] >= NIVEAU_CONFIDENTIEL): boolean {
  if (obj.confidentiel) return lireConfidentiel;
  return NIVEAU[role] >= obj.niveauTelechargement;
}

// Un membre ne peut ni attribuer un rôle au-dessus du sien, ni modifier un membre au-dessus de lui.
// (Le DG ne fabrique pas de super administrateur ; le super administrateur, lui, peut tout.)
export function peutAttribuer(auteur: Role, cible: Role): boolean {
  return NIVEAU[cible] <= NIVEAU[auteur];
}
export function peutModifierMembre(auteur: Role, membre: Role): boolean {
  return NIVEAU[membre] <= NIVEAU[auteur];
}

// Projection des rôles simples (style Lovable) vers les niveaux fins.
export const ROLE_SIMPLE: Record<"administrateur" | "gestionnaire_rh" | "employe", Role> = {
  administrateur: "dg",
  gestionnaire_rh: "gestionnaire_rh",
  employe: "employe",
};

// Modèle d'accès : niveaux cumulatifs + rôle auditeur orthogonal.
// Un niveau N hérite des accès de 1..N. L'auditeur externe ne voit QUE /audit + le tableau de bord.
//
// Ce fichier est la SOURCE UNIQUE : les gardes serveur (`lib/authz.requireLevel`), les gardes
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
  comptable: "+ employés, commandes, caisse & primes médecins.",
  gestionnaire_rh: "+ toute la paie (saisie, bulletins, courrier, planning, archives) et le barème.",
  da1: "+ grand livre financier, validation des commandes et interventions, documents confidentiels.",
  dg: "+ membres et rôles, paramètres, journal, audit, nouvelle version du barème.",
  super_admin: "Tout, plus le technique : données de démo, fiche API, état du déploiement. Réservé au développeur.",
  auditeur_externe: "Audit confidentiel et tableau de bord uniquement, rien d'autre.",
};

// Rôles proposés dans « Membres » : dans l'ordre des niveaux, l'auditeur à part.
export const ROLES_ORDONNES: Role[] = ["employe", "chef_equipe", "comptable", "gestionnaire_rh", "da1", "dg", "super_admin", "auditeur_externe"];

// Niveau minimum requis par module (route).
export const NIVEAU_MODULE: Record<string, number> = {
  "/": 1,
  "/comptes-rendus": 1,
  "/documents": 1,
  "/interventions": 1,
  "/employes": 3,
  "/commandes": 3,
  "/statistiques": 3,
  "/paie": 4,
  "/paie/saisie": 4,
  "/paie/bulletins": 4,
  "/paie/liste": 4,
  "/paie/planning": 4,
  "/paie/primes": 4,
  "/paie/courrier": 4,
  "/paie/archives": 4,
  "/financier": 5,
  "/parametres": 7,
  "/membres": 7,
  "/journal": 7,
  "/api-readme": 8,
  "/bareme": 4,
};

// Modules réservés à l'auditeur externe (et au DG / super administrateur).
const MODULES_AUDIT = new Set(["/", "/audit"]);
// Rôles qui voient l'audit en plus de l'auditeur : cloisonné (un niveau 5 est refusé).
export const ROLES_AUDIT: Role[] = ["dg", "super_admin"];

export function canAccess(role: Role, module: string): boolean {
  if (role === "auditeur_externe") return MODULES_AUDIT.has(module);
  if (module === "/audit") return ROLES_AUDIT.includes(role);
  const requis = NIVEAU_MODULE[module];
  if (requis === undefined) return false;
  return NIVEAU[role] >= requis;
}

// Accès par objet (documents, lignes financières) — au-delà du rôle.
// Confidentiel = direction : DAF et au-dessus.
export const NIVEAU_CONFIDENTIEL = 5;

export function canView(role: Role, obj: { niveauVisible: number; confidentiel?: boolean }): boolean {
  if (obj.confidentiel) return NIVEAU[role] >= NIVEAU_CONFIDENTIEL;
  return NIVEAU[role] >= obj.niveauVisible;
}

export function canDownload(role: Role, obj: { niveauTelechargement: number; confidentiel?: boolean }): boolean {
  if (obj.confidentiel) return NIVEAU[role] >= NIVEAU_CONFIDENTIEL;
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

// --- Matrice des droits, pour l'onglet « Rôles & accès » ------------------------------
// `niveau` = niveau minimum ; `audit` = cloisonné (auditeur externe + ROLES_AUDIT).
export type Droit = { libelle: string; niveau: number; audit?: boolean; categorie: "Exploitation" | "Paie" | "Finances" | "Direction" | "Technique" };
export const DROITS: Droit[] = [
  { categorie: "Exploitation", libelle: "Tableau de bord, documents ouverts, interventions, comptes rendus", niveau: 1 },
  { categorie: "Exploitation", libelle: "Vue superviseur des comptes rendus", niveau: 2 },
  { categorie: "Exploitation", libelle: "Employés, commandes, caisse & primes médecins", niveau: 3 },
  { categorie: "Paie", libelle: "Récapitulatif, liste, bulletins, courrier, planning, primes & retenues, archives", niveau: 4 },
  { categorie: "Paie", libelle: "Clôturer un mois de paie", niveau: 4 },
  { categorie: "Paie", libelle: "Barème : consultation, contrôle de la source", niveau: 4 },
  { categorie: "Finances", libelle: "Récapitulatif financier (grand livre), clôture financière", niveau: 5 },
  { categorie: "Finances", libelle: "Valider ou rejeter commandes et interventions", niveau: 5 },
  { categorie: "Finances", libelle: "Documents confidentiels (dépôt et lecture)", niveau: NIVEAU_CONFIDENTIEL },
  { categorie: "Direction", libelle: "Membres & rôles (jusqu'à son propre niveau), paramètres, journal d'activité", niveau: 7 },
  { categorie: "Direction", libelle: "Nouvelle version du barème", niveau: 7 },
  { categorie: "Direction", libelle: "Audit confidentiel", niveau: 7, audit: true },
  { categorie: "Technique", libelle: "Données de démo, fiche API, état du déploiement", niveau: 8 },
];

export function aLeDroit(role: Role, d: Droit): boolean {
  if (d.audit) return role === "auditeur_externe" || ROLES_AUDIT.includes(role);
  if (role === "auditeur_externe") return false; // il ne voit que l'audit (et le tableau de bord)
  return NIVEAU[role] >= d.niveau;
}

// Projection des rôles simples (style Lovable) vers les niveaux fins.
export const ROLE_SIMPLE: Record<"administrateur" | "gestionnaire_rh" | "employe", Role> = {
  administrateur: "dg",
  gestionnaire_rh: "gestionnaire_rh",
  employe: "employe",
};

// Modèle d'accès : 7 niveaux cumulatifs + rôle auditeur orthogonal.
// Un niveau N hérite des accès de 1..N. L'auditeur externe ne voit QUE /audit + le tableau de bord.

export type Role =
  | "employe" | "chef_equipe" | "comptable" | "gestionnaire_rh"
  | "da1" | "da2" | "dg" | "auditeur_externe";

export const NIVEAU: Record<Role, number> = {
  employe: 1,
  chef_equipe: 2,
  comptable: 3,
  gestionnaire_rh: 4,
  da1: 5,
  da2: 6,
  dg: 7,
  auditeur_externe: 0, // hors hiérarchie (orthogonal)
};

export const LIBELLE: Record<Role, string> = {
  employe: "Employé",
  chef_equipe: "Chef d'équipe",
  comptable: "Comptable",
  gestionnaire_rh: "Gestionnaire RH",
  da1: "Directeur Administratif 1",
  da2: "Directeur Administratif 2",
  dg: "Directeur Général (Admin)",
  auditeur_externe: "Auditeur Externe",
};

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
  "/paie/bulletins": 4,
  "/paie/planning": 4,
  "/paie/primes": 4,
  "/paie/courrier": 4,
  "/paie/archives": 4,
  "/financier": 5,
  "/parametres": 7,
  "/membres": 7,
  "/journal": 7,
  "/api-readme": 7,
  "/bareme": 4,
};

// Modules réservés à l'auditeur externe (et au DG).
const MODULES_AUDIT = new Set(["/", "/audit"]);

export function canAccess(role: Role, module: string): boolean {
  if (role === "auditeur_externe") return MODULES_AUDIT.has(module);
  if (module === "/audit") return role === "dg";
  const requis = NIVEAU_MODULE[module];
  if (requis === undefined) return false;
  return NIVEAU[role] >= requis;
}

// Accès par objet (documents, lignes financières) — au-delà du rôle.
export function canView(role: Role, obj: { niveauVisible: number; confidentiel?: boolean }): boolean {
  if (obj.confidentiel) return role === "dg" || role === "da1" || role === "da2";
  return NIVEAU[role] >= obj.niveauVisible;
}

export function canDownload(role: Role, obj: { niveauTelechargement: number; confidentiel?: boolean }): boolean {
  if (obj.confidentiel) return role === "dg" || role === "da1" || role === "da2";
  return NIVEAU[role] >= obj.niveauTelechargement;
}

// Projection des rôles simples (style Lovable) vers les niveaux fins.
export const ROLE_SIMPLE: Record<"administrateur" | "gestionnaire_rh" | "employe", Role> = {
  administrateur: "dg",
  gestionnaire_rh: "gestionnaire_rh",
  employe: "employe",
};

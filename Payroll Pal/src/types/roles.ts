export type Role = "ADMIN" | "RH" | "UTILISATEUR";

export type Permission =
  | "paie:lire"
  | "paie:editer"
  | "employes:gerer"
  | "societe:affecter"
  | "bulletin:imprimer"
  | "simulation:reinitialiser"
  | "tous:voir";

export type ProfilRole = {
  role: Role;
  libelle: string;
  description: string;
  utilisateur: string;
  email: string;
  permissions: Permission[];
};

export const PROFILS: ProfilRole[] = [
  {
    role: "ADMIN",
    libelle: "Administrateur",
    description: "Accès total : paie, employés, affectation société, export.",
    utilisateur: "TCHIDJO Magloire",
    email: "tkmagloire@gmail.com",
    permissions: [
      "paie:lire",
      "paie:editer",
      "employes:gerer",
      "societe:affecter",
      "bulletin:imprimer",
      "simulation:reinitialiser",
      "tous:voir",
    ],
  },
  {
    role: "RH",
    libelle: "Gestionnaire RH",
    description:
      "Saisit les éléments variables et génère les bulletins, sans supprimer d'employé.",
    utilisateur: "NGUEMA Adèle",
    email: "adele.nguema@talento.cm",
    permissions: [
      "paie:lire",
      "paie:editer",
      "societe:affecter",
      "bulletin:imprimer",
      "tous:voir",
    ],
  },
  {
    role: "UTILISATEUR",
    libelle: "Employé",
    description: "Consulte uniquement son propre bulletin, en lecture seule.",
    utilisateur: "TARGNE JEAN BEAU",
    email: "jean.targne@talento.cm",
    permissions: ["paie:lire", "bulletin:imprimer"],
  },
];

export const profilDe = (role: Role): ProfilRole =>
  PROFILS.find((p) => p.role === role) ?? (PROFILS[0] as ProfilRole);

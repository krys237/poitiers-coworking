// Vocabulaire PUR du journal d'activité (sans import serveur) : importable par les pages.
// Les actions elles-mêmes sont déclarées dans ./journal.ts ; ici, leur regroupement en familles.
export const ACTIONS_LIBELLES = [
  ["connexion", "Connexion"],
  ["connexion_attente", "Connexion (compte en attente)"],
  ["membre_creation", "Création de membre"],
  ["membre_rattachement", "Rattachement d'un compte"],
  ["membre_autorisation", "Autorisation d'un compte en attente"],
  ["membre_role", "Changement de rôle"],
  ["membre_activation", "Activation / désactivation"],
  ["membre_modification", "Modification de membre"],
  ["cloture_paie", "Clôture de paie"],
  ["cloture_financier", "Clôture financière"],
  ["api_financial", "Appel API financière"],
  ["bareme_controle", "Contrôle du barème"],
  ["bareme_version", "Nouvelle version du barème"],
  ["audit_rapport", "Rapport d'audit"],
  ["verrous_purge", "Purge des verrous"],
  ["parametres_modification", "Modification des paramètres"],
] as const;
export type ActionJournal = typeof ACTIONS_LIBELLES[number][0];

// Familles d'actions, pour filtrer et colorer le journal à l'écran.
export const FAMILLES = [
  ["acces", "Accès & membres"],
  ["paie", "Paie"],
  ["finances", "Finances"],
  ["api", "API"],
  ["bareme", "Barème"],
  ["audit", "Audit"],
] as const;
export type FamilleJournal = typeof FAMILLES[number][0];
export const FAMILLE_ACTION: Record<ActionJournal, FamilleJournal> = {
  connexion: "acces", connexion_attente: "acces", membre_creation: "acces", membre_rattachement: "acces",
  membre_autorisation: "acces", membre_role: "acces", membre_activation: "acces", membre_modification: "acces",
  cloture_paie: "paie", cloture_financier: "finances", verrous_purge: "finances", api_financial: "api",
  bareme_controle: "bareme", bareme_version: "bareme", audit_rapport: "audit", parametres_modification: "acces",
};

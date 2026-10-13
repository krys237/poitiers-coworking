// Règles de mot de passe (décisions du 13/10/2026) : PURE, partagée par le serveur (auth.ts, compte.ts)
// et les écrans (formulaire de changement). Importée par les tests : dépendances avec extension .ts.

/** Mot de passe de départ posé par la Direction à la création d'un membre ou à une réinitialisation.
 *  Il doit être changé à la première connexion (`users.doitChangerMotDePasse`). */
export const MOT_DE_PASSE_PROVISOIRE = "Cowork2026";

export const LONGUEUR_MIN = 8;

/** Message d'erreur si le mot de passe ne respecte pas les règles, sinon `null`. */
export function erreurMotDePasse(mot: string): string | null {
  if (mot.length < LONGUEUR_MIN) return `Le mot de passe doit contenir au moins ${LONGUEUR_MIN} caractères.`;
  if (!/[a-zA-Z]/.test(mot) || !/[0-9]/.test(mot)) return "Le mot de passe doit mêler lettres et chiffres.";
  return null;
}

/** Règles supplémentaires pour un mot de passe choisi par le membre (pas pour le provisoire). */
export function erreurNouveauMotDePasse(nouveau: string, ancien?: string): string | null {
  const e = erreurMotDePasse(nouveau);
  if (e) return e;
  if (nouveau === MOT_DE_PASSE_PROVISOIRE) return "Choisissez un mot de passe différent du mot de passe provisoire.";
  if (ancien !== undefined && nouveau === ancien) return "Le nouveau mot de passe doit être différent de l'actuel.";
  return null;
}

/** Adresse technique d'un membre créé sans e-mail : le compte est indexé par e-mail, le membre se connecte par téléphone. */
export function emailTechnique(telephone: string): string {
  return `${telephone.replace(/\D/g, "")}@membres.poitiers.local`;
}
export const estEmailTechnique = (email: string) => email.endsWith("@membres.poitiers.local");

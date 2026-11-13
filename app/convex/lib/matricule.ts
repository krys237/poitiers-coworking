// Suggestion de matricule à la création d'un employé (lot 6).
//
// « Le matricule se saisit entièrement à la main — risque de doublon ou d'erreur de frappe » :
// le motif observé sur les matricules existants (E001, E002…) est un préfixe fixe suivi d'un
// numéro. On reprend ce motif sur le matricule le plus ÉLEVÉ numériquement — pas le dernier
// inséré, un import pouvant les mélanger — pour proposer le suivant, dans le même format (même
// préfixe, même largeur de numéro). La fiche garde la main : la suggestion ne fait que pré-remplir.

/**
 * Prochain matricule proposé, ou `null` si aucun matricule existant ne se termine par un numéro
 * exploitable (base vide, ou motif entièrement non numérique) — la RH saisit alors comme avant.
 */
export function prochainMatricule(matriculesExistants: string[]): string | null {
  let meilleur: { prefixe: string; largeur: number; valeur: number } | null = null;
  for (const brut of matriculesExistants) {
    const m = brut.trim().match(/^(.*?)(\d+)$/);
    if (!m) continue;
    const valeur = parseInt(m[2], 10);
    if (!meilleur || valeur > meilleur.valeur) meilleur = { prefixe: m[1], largeur: m[2].length, valeur };
  }
  if (!meilleur) return null;
  const suivant = String(meilleur.valeur + 1).padStart(meilleur.largeur, "0");
  return `${meilleur.prefixe}${suivant}`;
}

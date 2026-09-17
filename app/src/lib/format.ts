// `toLocaleString("fr-FR")` separe les milliers par une espace fine insecable
// (U+202F). Deux raisons de ne pas la garder :
//   - en colonne, elle est si etroite que « 285 000 » se lit « 285000 », ce qui
//     annule le benefice de l'alignement des chiffres ;
//   - elle n'est pas encodable en Latin-1, donc elle casse la generation des
//     PDF (cf. le `clean()` de convex/paiePdf.ts et la note de CLAUDE.md).
// On la remplace par une espace insecable ordinaire (U+00A0) : lisible, et
// encodable par les polices standard du PDF.
const espacerMilliers = (n: number) =>
  Math.round(n).toLocaleString("fr-FR").replace(/ /g, " ");

export const fcfa = (n: number) => `${espacerMilliers(n)} FCFA`;
export const num = (n: number) => espacerMilliers(n);

// Formalisme des chiffres (skill poitiers-ui-ux-system §3) :
//   - décimales à la virgule, jamais de zéro décimal inutile : « 2,5 % », « 4 % » ;
//   - l'unité est séparée par une espace insécable, elle ne se détache pas du nombre.
export const pct = (n: number, decimales = 1) =>
  `${n.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: decimales })} %`;
export const jours = (n: number) =>
  `${n.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 1 })} j`;

const MOIS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
export const libellePeriode = (p: string) => {
  const [y, m] = p.split("-").map(Number);
  return `${MOIS[(m ?? 1) - 1] ?? p} ${y ?? ""}`.trim();
};
export const periodeCourante = () => new Date().toISOString().slice(0, 7);

// Message lisible d'une erreur Convex (retire l'enveloppe "[CONVEX …] Server Error Uncaught Error: … at handler …").
export const messageErreur = (e: unknown) => {
  const m = e instanceof Error ? e.message : String(e);
  const u = /Uncaught (?:Convex)?Error: ([\s\S]*?)(?:\n|\s+at handler| Called by)/.exec(m) ?? /Uncaught (?:Convex)?Error: ([\s\S]*)/.exec(m);
  return (u ? u[1] : m).trim();
};

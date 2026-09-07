export const fcfa = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} FCFA`;
export const num = (n: number) => Math.round(n).toLocaleString("fr-FR");

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

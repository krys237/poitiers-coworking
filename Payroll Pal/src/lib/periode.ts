export const MOIS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
] as const;

export type Periode = { mois: number; annee: number }; // mois : 1-12

const pad = (n: number) => String(n).padStart(2, "0");

export const joursDuMois = (p: Periode) => new Date(p.annee, p.mois, 0).getDate();

export const bornes = (p: Periode) => {
  const du = `01/${pad(p.mois)}/${p.annee}`;
  const au = `${pad(joursDuMois(p))}/${pad(p.mois)}/${p.annee}`;
  const suivant = p.mois === 12 ? { mois: 1, annee: p.annee + 1 } : { mois: p.mois + 1, annee: p.annee };
  const paiement = `05/${pad(suivant.mois)}/${suivant.annee}`;
  return { du, au, paiement };
};

export const libellePeriode = (p: Periode) => `${MOIS[p.mois - 1]} ${p.annee}`;

export const ANNEES = Array.from({ length: 7 }, (_, i) => 2023 + i);

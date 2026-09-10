// Périodes de paie (pur) : bornes du mois, date de paiement, libellés — modèle de référence
// « Période du 01/MM/AAAA au JJ/MM/AAAA · Paiement le 05 du mois suivant ».
export const MOIS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const pad = (n: number) => String(n).padStart(2, "0");

export const libellePeriode = (periode: string) => {
  const y = +periode.slice(0, 4), m = +periode.slice(5, 7);
  return `${MOIS[(m || 1) - 1] ?? periode} ${y || ""}`.trim();
};

export const joursDuMois = (periode: string) => {
  const y = +periode.slice(0, 4), m = +periode.slice(5, 7);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};

// Bornes affichées sur le bulletin (format JJ/MM/AAAA) et date de paiement (jour J du mois suivant).
export function bornesPeriode(periode: string, jourPaiement = 5) {
  const y = +periode.slice(0, 4), m = +periode.slice(5, 7);
  const du = `01/${pad(m)}/${y}`;
  const au = `${pad(joursDuMois(periode))}/${pad(m)}/${y}`;
  const ms = m === 12 ? 1 : m + 1, ys = m === 12 ? y + 1 : y;
  const paiement = `${pad(Math.min(Math.max(jourPaiement, 1), 28))}/${pad(ms)}/${ys}`;
  return { du, au, paiement, libelle: libellePeriode(periode) };
}

// Nom de fichier PDF : « ENTREPRISE - Nom employé - période ».
export const nomFichierPdf = (entreprise: string, employe: string, periode?: string) =>
  [entreprise.trim(), employe.trim().replace(/\s+/g, " "), periode].filter(Boolean).join(" - ").replace(/[\\/:*?"<>|]/g, "-");

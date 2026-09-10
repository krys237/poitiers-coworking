import { TAUX_DEFAUT, type Taux } from "./payroll";

/**
 * Barème officiel camerounais (CNPS, Code Général des Impôts).
 * Chaque entrée s'applique à partir de sa date d'effet, jusqu'à l'entrée suivante.
 * `verifieLe` sert à prévenir l'utilisateur quand la référence n'a pas été
 * revérifiée depuis longtemps (taux potentiellement obsolètes).
 */
export type ReferenceTaux = {
  /** Date d'effet au format AAAA-MM */
  effet: string;
  libelle: string;
  source: string;
  url: string;
  verifieLe: string; // AAAA-MM-JJ
  taux: Taux;
};

export const REFERENCES: ReferenceTaux[] = [
  {
    effet: "2016-07",
    libelle: "Barème CNPS / CGI en vigueur",
    source: "CNPS Cameroun – Code Général des Impôts",
    url: "https://www.cnps.cm/",
    verifieLe: "2026-01-15",
    taux: {
      ...TAUX_DEFAUT,
      plafondCnps: 750000,
      cnpsSalariePct: 4.2,
      cfcSalariePct: 1,
      abattementIrppAnnuel: 500000,
      cacPct: 10,
      pfPct: 7,
      pvidPatronalPct: 4.2,
      atmpPct: 1.75,
      fnePct: 1,
      cfcPatronalPct: 1.5,
      tdlActif: true,
      ravActif: true,
    },
  },
];

/** Nombre de mois avant de considérer une référence comme à revérifier. */
export const PEREMPTION_MOIS = 12;

/** Référence officielle applicable à un mois "AAAA-MM". */
export function referenceDe(cle: string): ReferenceTaux {
  const applicables = REFERENCES.filter((r) => !cle || r.effet <= cle);
  const derniere = applicables[applicables.length - 1] ?? REFERENCES[0];
  return derniere as ReferenceTaux;
}

/** Taux officiels applicables à un mois "AAAA-MM". */
export const tauxOfficiels = (cle: string): Taux => referenceDe(cle).taux;

const moisEcoules = (depuis: string) => {
  const d = new Date(depuis);
  if (Number.isNaN(d.getTime())) return 0;
  const now = new Date();
  return (
    (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth())
  );
};

/** Vrai si la référence n'a pas été revérifiée depuis plus d'un an. */
export const referenceObsolete = (r: ReferenceTaux) =>
  moisEcoules(r.verifieLe) > PEREMPTION_MOIS;

export const moisDepuisVerification = (r: ReferenceTaux) =>
  moisEcoules(r.verifieLe);

/** Vrai si les taux appliqués diffèrent du barème officiel du mois. */
export const ecartAvecOfficiel = (cle: string, t: Taux) => {
  const ref = tauxOfficiels(cle);
  return (Object.keys(ref) as (keyof Taux)[]).filter((k) => t[k] !== ref[k]);
};

// Jours fériés camerounais — logique PURE.
//
// Trois natures bien distinctes, qu'il ne faut pas confondre :
//
//  1. les fériés à DATE FIXE : connus avec certitude, générables pour n'importe quelle année ;
//  2. les fériés PASCAUX (Vendredi Saint, Ascension) : calculables par le comput de Pâques ;
//  3. les fériés MUSULMANS (Aïd el-Fitr, Aïd el-Adha) : NON calculables de façon fiable — ils
//     dépendent de l'observation lunaire et sont fixés chaque année par acte administratif.
//     Ils doivent être SAISIS à la main dans la table `joursFeries`.
//
// ⚠️ Résultat de la calibration sur le planning réel de la RH (61 lignes exploitables) :
//      · fériés fixes seuls ......... 48/56 lignes reproduites  ← meilleur ajustement
//      · aucun férié ................ 42/56
//      · tous les fériés ............ 39/56
//    Autrement dit, elle décompte les fériés FIXES mais pas les fériés mobiles. Rien ne dit que
//    ce soit volontaire : c'est une pratique à lui faire confirmer. D'où le choix d'architecture :
//    **la liste effective est une donnée d'entreprise, jamais une constante du moteur.**

import type { JourFerie } from "./congesOuvrables.ts";

export interface FerieFixe {
  mois: number; // 1–12
  jour: number;
  libelle: string;
}

/** Les 6 fériés à date fixe du calendrier camerounais. */
export const FERIES_FIXES: FerieFixe[] = [
  { mois: 1, jour: 1, libelle: "Jour de l'An" },
  { mois: 2, jour: 11, libelle: "Fête de la Jeunesse" },
  { mois: 5, jour: 1, libelle: "Fête du Travail" },
  { mois: 5, jour: 20, libelle: "Fête Nationale" },
  { mois: 8, jour: 15, libelle: "Assomption" },
  { mois: 12, jour: 25, libelle: "Noël" },
];

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (a: number, m: number, j: number) => `${a}-${pad(m)}-${pad(j)}`;

/** Les fériés fixes d'une année donnée. */
export function feriesFixesDeLAnnee(annee: number): JourFerie[] {
  return FERIES_FIXES.map((f) => ({
    date: iso(annee, f.mois, f.jour),
    libelle: f.libelle,
    chome: true,
  }));
}

/**
 * Dimanche de Pâques (comput grégorien, algorithme de Meeus/Jones/Butcher).
 * Renvoie une date ISO.
 */
export function paques(annee: number): string {
  const a = annee % 19;
  const b = Math.floor(annee / 100);
  const c = annee % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mois = Math.floor((h + l - 7 * m + 114) / 31); // 3 = mars, 4 = avril
  const jour = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(annee, mois, jour);
}

const JOUR_MS = 86_400_000;
const versT = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
const decaler = (s: string, n: number) => new Date(versT(s) + n * JOUR_MS).toISOString().slice(0, 10);

/**
 * Les fériés pascaux d'une année : Vendredi Saint (Pâques − 2) et Ascension (Pâques + 39).
 * `chome` est laissé à `false` par défaut : la calibration montre que la RH ne les décompte pas.
 * C'est un point à lui faire confirmer avant de basculer à `true`.
 */
export function feriesPascauxDeLAnnee(annee: number, chome = false): JourFerie[] {
  const p = paques(annee);
  return [
    { date: decaler(p, -2), libelle: "Vendredi Saint", chome },
    { date: decaler(p, 39), libelle: "Ascension", chome },
  ];
}

/**
 * Les fériés musulmans ne sont PAS calculés : ils sont fixés chaque année par acte administratif
 * sur avis des autorités religieuses. Cette fonction ne renvoie donc rien et sert de rappel
 * explicite : ces deux dates doivent être saisies dans l'écran « Jours fériés ».
 */
export const FERIES_A_SAISIR = ["Aïd el-Fitr (Djouldé Soumaé)", "Aïd el-Adha (Tabaski)"] as const;

/**
 * Jeu de fériés par défaut d'une année, tel qu'il sera proposé à l'initialisation :
 * les 6 fixes en chômés, les 2 pascaux présents mais non chômés, les 2 musulmans absents.
 * La RH ajuste ensuite dans l'écran.
 */
export function feriesParDefaut(annee: number): JourFerie[] {
  return [...feriesFixesDeLAnnee(annee), ...feriesPascauxDeLAnnee(annee, false)];
}

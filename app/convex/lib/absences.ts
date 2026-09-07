// Logique PURE du planning des absences : jours calendaires, ventilation par mois, acquisition et solde de congés.
export type TypeAbsence = "conge_paye" | "absence" | "maladie" | "autre";

export const PAYE_PAR_DEFAUT: Record<TypeAbsence, boolean> = { conge_paye: true, absence: false, maladie: true, autre: false };
export const LIBELLE_TYPE: Record<TypeAbsence, string> = {
  conge_paye: "Congé payé", absence: "Absence non justifiée", maladie: "Maladie", autre: "Autre",
};
export const CONGES_PAR_MOIS_DEFAUT = 1.5; // jours acquis par mois de service

export interface Evenement { type: TypeAbsence; dateDebut: string; dateFin: string; paye: boolean; }

const jour = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const round1 = (n: number) => Math.round(n * 10) / 10;

// Jours calendaires inclus entre deux dates ("YYYY-MM-DD").
export function joursCalendaires(debut: string, fin: string): number {
  return Math.max(0, Math.round((jour(fin) - jour(debut)) / 86400000) + 1);
}

// Bornes d'un mois "YYYY-MM" et son nombre de jours.
export function bornesMois(periode: string) {
  const y = +periode.slice(0, 4), m = +periode.slice(5, 7);
  const finT = Date.UTC(y, m, 0);
  return { debut: `${periode}-01`, fin: iso(finT), jours: new Date(finT).getUTCDate() };
}

// Part d'un événement (en jours) tombant dans un mois donné.
export function joursDansMois(ev: { dateDebut: string; dateFin: string }, periode: string): number {
  const { debut, fin } = bornesMois(periode);
  const a = ev.dateDebut > debut ? ev.dateDebut : debut;
  const b = ev.dateFin < fin ? ev.dateFin : fin;
  return a > b ? 0 : joursCalendaires(a, b);
}

// Liste des mois "YYYY-MM" couverts par un événement.
export function periodesTouchees(ev: { dateDebut: string; dateFin: string }): string[] {
  const out: string[] = [];
  let y = +ev.dateDebut.slice(0, 4), m = +ev.dateDebut.slice(5, 7);
  const finP = ev.dateFin.slice(0, 7);
  for (let i = 0; i < 120; i++) {
    const p = `${y}-${String(m).padStart(2, "0")}`;
    out.push(p);
    if (p >= finP) break;
    m++; if (m > 12) { m = 1; y++; }
  }
  return out;
}

// Mois de service ouvrant droit à congés jusqu'à la période incluse.
// Sans date d'embauche : depuis janvier de l'année de la période (acquisition année en cours).
export function moisDeService(dateDebut: string | undefined, periode: string): number {
  const y2 = +periode.slice(0, 4), m2 = +periode.slice(5, 7);
  if (!dateDebut) return m2;
  const y1 = +dateDebut.slice(0, 4), m1 = +dateDebut.slice(5, 7);
  return Math.max(0, (y2 - y1) * 12 + (m2 - m1) + 1);
}

export interface ResumeMois {
  joursCalendaires: number;
  joursBase: number;
  absencesNonPayees: number;   // entament les jours travaillés
  absencesPayees: number;      // maladie justifiée, autres absences rémunérées
  congesPrisMois: number;
  congesPrisCumul: number;     // jusqu'à la fin de la période
  congesAcquisCumul: number;   // solde initial + taux × mois de service
  soldeConges: number;         // acquis − pris (cumulés)
  joursTravailles: number;     // joursBase − absences non payées → alimente la paie
}

export function resumeMois(args: {
  employe: { dateDebut?: string; congesInitial?: number; joursBase?: number };
  evenements: Evenement[]; periode: string; congesParMois: number;
}): ResumeMois {
  const { employe, evenements, periode, congesParMois } = args;
  const { jours: joursCal, fin } = bornesMois(periode);
  let absencesNonPayees = 0, absencesPayees = 0, congesPrisMois = 0, congesPrisCumul = 0;

  for (const ev of evenements) {
    const j = joursDansMois(ev, periode);
    if (ev.type === "conge_paye") {
      congesPrisMois += j;
      if (ev.dateDebut <= fin) congesPrisCumul += joursCalendaires(ev.dateDebut, ev.dateFin < fin ? ev.dateFin : fin);
    } else if (ev.paye) absencesPayees += j;
    else absencesNonPayees += j;
  }

  const joursBase = employe.joursBase ?? 30;
  const congesAcquisCumul = round1((employe.congesInitial ?? 0) + congesParMois * moisDeService(employe.dateDebut, periode));
  return {
    joursCalendaires: joursCal, joursBase, absencesNonPayees, absencesPayees, congesPrisMois, congesPrisCumul,
    congesAcquisCumul, soldeConges: round1(congesAcquisCumul - congesPrisCumul),
    joursTravailles: Math.max(0, joursBase - absencesNonPayees),
  };
}

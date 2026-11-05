// Logique PURE du planning des absences : jours calendaires, ventilation par mois, acquisition et solde de congés.
import { TYPES_ABSENCE } from "./absencesLegales.ts";
import { compterOuvrables, type ReglesOuvrables } from "./congesOuvrables.ts";

export type TypeAbsence = string;

// Dérivés du catalogue légal (lib/absencesLegales.ts) : une seule source de vérité.
// « payé » = rémunéré par l'employeur ou la CNPS, donc n'entame pas les jours travaillés.
export const PAYE_PAR_DEFAUT: Record<string, boolean> = Object.fromEntries(
  TYPES_ABSENCE.map((t) => [t.cle, t.quiPaie !== "personne"]),
);
export const LIBELLE_TYPE: Record<string, string> = Object.fromEntries(
  TYPES_ABSENCE.map((t) => [t.cle, t.libelle]),
);
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

/**
 * La même intersection, mais comptée en jours OUVRABLES (lot R4).
 *
 * C'est la bascule annoncée depuis le lot R0 : le planning annuel compte en ouvrables
 * (dimanches et fériés exclus) tandis que la paie était alimentée en jours CALENDAIRES. Un congé
 * de 18 jours ouvrables s'étale sur 21 à 23 jours calendaires : la paie retirait donc trop de
 * jours travaillés, et l'indemnité portait sur trop de jours.
 */
export function joursOuvrablesDansMois(
  ev: { dateDebut: string; dateFin: string },
  periode: string,
  feries: Set<string>,
  regles?: ReglesOuvrables,
): number {
  const { debut, fin } = bornesMois(periode);
  const a = ev.dateDebut > debut ? ev.dateDebut : debut;
  const b = ev.dateFin < fin ? ev.dateFin : fin;
  return a > b ? 0 : compterOuvrables(a, b, feries, regles);
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
  /** Vrai si les congés payés ont été comptés en jours OUVRABLES (lot R4). */
  congesEnOuvrables: boolean;
}

export function resumeMois(args: {
  employe: { dateDebut?: string; congesInitial?: number; joursBase?: number };
  evenements: Evenement[]; periode: string; congesParMois: number;
  /**
   * Jours fériés de la période. **Présents → les congés payés se comptent en jours OUVRABLES**
   * (lot R4) ; absents → en jours calendaires, comme avant la bascule.
   *
   * L'option existe pour que les mois déjà CLOS gardent exactement les chiffres sous lesquels ils
   * ont été arrêtés : on ne rejoue pas une paie archivée avec une règle postérieure.
   */
  feries?: Set<string>;
  reglesOuvrables?: ReglesOuvrables;
}): ResumeMois {
  const { employe, evenements, periode, congesParMois } = args;
  const enOuvrables = args.feries !== undefined;
  const { jours: joursCal, fin } = bornesMois(periode);
  let absencesNonPayees = 0, absencesPayees = 0, congesPrisMois = 0, congesPrisCumul = 0;

  for (const ev of evenements) {
    const j = joursDansMois(ev, periode);
    if (ev.type === "conge_paye") {
      // Seuls les CONGÉS PAYÉS basculent en ouvrables : ce sont les seuls dont le décompte est
      // posé par le décret n°75/28. Une maladie ou une mise à pied reste en jours calendaires.
      congesPrisMois += enOuvrables
        ? joursOuvrablesDansMois(ev, periode, args.feries!, args.reglesOuvrables)
        : j;
      if (ev.dateDebut <= fin) {
        const borneFin = ev.dateFin < fin ? ev.dateFin : fin;
        congesPrisCumul += enOuvrables
          ? compterOuvrables(ev.dateDebut, borneFin, args.feries!, args.reglesOuvrables)
          : joursCalendaires(ev.dateDebut, borneFin);
      }
    } else if (ev.paye) absencesPayees += j;
    else absencesNonPayees += j;
  }

  const joursBase = employe.joursBase ?? 30;
  const congesAcquisCumul = round1((employe.congesInitial ?? 0) + congesParMois * moisDeService(employe.dateDebut, periode));
  return {
    joursCalendaires: joursCal, joursBase, absencesNonPayees, absencesPayees, congesPrisMois, congesPrisCumul,
    congesEnOuvrables: enOuvrables,
    congesAcquisCumul, soldeConges: round1(congesAcquisCumul - congesPrisCumul),
    // Les congés payés sont rémunérés par l'indemnité de congés (journalier × congés pris) : ils sortent des jours travaillés.
    joursTravailles: Math.max(0, joursBase - absencesNonPayees - congesPrisMois),
  };
}

// Logique PURE du décompte des congés en JOURS OUVRABLES (aucune dépendance Convex).
// Complète `lib/absences.ts`, qui compte en jours CALENDAIRES : les deux cohabitent le temps de
// la bascule (voir ANALYSE-RH-CONGES-IMPOT.md, lot R0).
//
// Règle de référence — Code du travail camerounais, art. 89 et décret n°75/28 :
//   · le congé se compte en jours ouvrables, la semaine comptant 6 jours ouvrables (samedi inclus) ;
//   · les dimanches et les jours fériés chômés ne sont pas décomptés ;
//   · la date de retour est le premier jour ouvrable qui suit le dernier jour de congé ;
//   · un droit fractionnaire s'arrondit au nombre entier SUPÉRIEUR.
//
// ⚠️ La liste des jours fériés est TOUJOURS passée en paramètre, jamais codée en dur : les fêtes
// religieuses et les dates pascales sont fixées chaque année par acte administratif, et la
// calibration sur le planning réel de la RH a montré que l'ensemble des fériés effectivement
// appliqués est un paramètre d'entreprise (voir `docs/rh/CALIBRATION-PLANNING.md`).

// `.ts` explicite : ce module est exécuté DIRECTEMENT par les tests (node --experimental-strip-types),
// qui n'ont pas de résolveur d'extension. Même convention que `absences.ts` → `absencesLegales.ts`.
// L'import est à sens unique : `allocationConge` ne dépend de rien d'ici.
import { moisEntre } from "./allocationConge.ts";

/** Jour férié. `chome: false` = férié travaillé dans l'entreprise, donc décompté normalement. */
export interface JourFerie {
  date: string; // "YYYY-MM-DD"
  libelle?: string;
  chome?: boolean; // défaut : true
}

/** Jours de la semaine non ouvrés : 0 = dimanche, 1 = lundi … 6 = samedi. */
export interface ReglesOuvrables {
  joursNonOuvres: number[];
  exclureFeries: boolean;
}

export const REGLES_OUVRABLES_DEFAUT: ReglesOuvrables = {
  joursNonOuvres: [0], // dimanche seul : la semaine ouvrable camerounaise compte 6 jours
  exclureFeries: true,
};

// ---------------------------------------------------------------------------
// Dates : arithmétique en UTC pur, pour éviter tout décalage de fuseau.
// ---------------------------------------------------------------------------

const JOUR_MS = 86_400_000;

const versT = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const versIso = (t: number) => new Date(t).toISOString().slice(0, 10);

/** Jour de la semaine : 0 = dimanche … 6 = samedi. */
export const jourSemaine = (iso: string) => new Date(versT(iso)).getUTCDay();

/** Décale une date ISO de `n` jours calendaires. */
export const decaler = (iso: string, n: number) => versIso(versT(iso) + n * JOUR_MS);

/** Index des fériés chômés, pour une recherche en O(1). */
export function indexFeries(feries: JourFerie[]): Set<string> {
  const s = new Set<string>();
  for (const f of feries) if (f.chome !== false) s.add(f.date);
  return s;
}

// ---------------------------------------------------------------------------
// Décompte
// ---------------------------------------------------------------------------

/** Un jour est-il ouvrable ? (ni jour non ouvré de la semaine, ni férié chômé) */
export function estOuvrable(
  iso: string,
  feries: Set<string>,
  regles: ReglesOuvrables = REGLES_OUVRABLES_DEFAUT,
): boolean {
  if (regles.joursNonOuvres.includes(jourSemaine(iso))) return false;
  if (regles.exclureFeries && feries.has(iso)) return false;
  return true;
}

/** Nombre de jours ouvrables entre deux dates, bornes INCLUSES. */
export function compterOuvrables(
  debut: string,
  fin: string,
  feries: Set<string>,
  regles: ReglesOuvrables = REGLES_OUVRABLES_DEFAUT,
): number {
  if (fin < debut) return 0;
  let n = 0;
  for (let d = debut; d <= fin; d = decaler(d, 1)) if (estOuvrable(d, feries, regles)) n++;
  return n;
}

/** Premier jour ouvrable à partir de `iso` (inclus). */
export function prochainJourOuvrable(
  iso: string,
  feries: Set<string>,
  regles: ReglesOuvrables = REGLES_OUVRABLES_DEFAUT,
): string {
  let d = iso;
  for (let i = 0; i < 400 && !estOuvrable(d, feries, regles); i++) d = decaler(d, 1);
  return d;
}

/**
 * Dernier jour de congé : la date à laquelle le `nbJours`-ième jour ouvrable est consommé.
 * Si la date de départ n'est pas ouvrable, le décompte commence au premier jour ouvrable suivant.
 */
export function dernierJourConge(
  depart: string,
  nbJours: number,
  feries: Set<string>,
  regles: ReglesOuvrables = REGLES_OUVRABLES_DEFAUT,
): string {
  if (nbJours <= 0) return depart;
  let d = prochainJourOuvrable(depart, feries, regles);
  let consommes = 1;
  while (consommes < nbJours) {
    d = decaler(d, 1);
    if (estOuvrable(d, feries, regles)) consommes++;
  }
  return d;
}

/**
 * Date de retour = premier jour ouvrable suivant le dernier jour de congé.
 * C'est la colonne « DATE DE RETOUR » du planning de la RH (« 1er jour de service après le congé »).
 */
export function dateRetour(
  depart: string,
  nbJours: number,
  feries: Set<string>,
  regles: ReglesOuvrables = REGLES_OUVRABLES_DEFAUT,
): string {
  if (nbJours <= 0) return prochainJourOuvrable(depart, feries, regles);
  const dernier = dernierJourConge(depart, nbJours, feries, regles);
  return prochainJourOuvrable(decaler(dernier, 1), feries, regles);
}

/**
 * Ventilation des jours ouvrables de congé par mois « YYYY-MM ».
 * C'est ce qui alimentera la paie (jours travaillés du mois) au lot R4.
 */
export function ventilerParMois(
  depart: string,
  dernier: string,
  feries: Set<string>,
  regles: ReglesOuvrables = REGLES_OUVRABLES_DEFAUT,
): Record<string, number> {
  const out: Record<string, number> = {};
  if (dernier < depart) return out;
  for (let d = depart; d <= dernier; d = decaler(d, 1)) {
    if (!estOuvrable(d, feries, regles)) continue;
    const p = d.slice(0, 7);
    out[p] = (out[p] ?? 0) + 1;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Droit à congé annuel — art. 89 et 90 du Code du travail
// ---------------------------------------------------------------------------

export interface ReglesDroitConge {
  /** Jours ouvrables acquis par mois de service effectif (art. 89). */
  joursParMois: number;
  /** Taux majoré pour les travailleurs de moins de 18 ans — REMPLACE `joursParMois` (art. 90). */
  joursParMoisJeune: number;
  ageJeune: number;
  /** Majoration d'ancienneté : `joursAnciennete` jours par tranche entière de `paliersAnciennete` ans. */
  joursAnciennete: number;
  paliersAnciennete: number;
  /** Majoration « mère de famille » : jours par enfant de moins de `ageEnfantMax` ans. */
  joursParEnfant: number;
  ageEnfantMax: number;
  /** Congé principal en deçà duquel la majoration « mère » tombe à 1 jour par enfant (art. 90). */
  seuilCongePrincipalReduit: number;
  /** Ancienneté minimale ouvrant le droit à la JOUISSANCE du congé, en mois (art. 92). */
  moisAvantJouissance: number;
  /** Plafond de la période de référence, en mois (16 → 24 j de principal). */
  plafondMois: number;
}

export const REGLES_DROIT_DEFAUT: ReglesDroitConge = {
  joursParMois: 1.5,
  joursParMoisJeune: 2.5,
  ageJeune: 18,
  joursAnciennete: 2,
  paliersAnciennete: 5,
  joursParEnfant: 2,
  ageEnfantMax: 6,
  seuilCongePrincipalReduit: 6,
  // Arbitrage du 05/11/2026 (A-VERIFIER R-3c) : le premier congé s'ouvre après 24 mois, et non
  // 12. ⚠️ Les trois contrats de travail promettent encore « 12 mois consécutifs » — voir R-6a.
  moisAvantJouissance: 24,
  // Plafond de la période de référence (R-3b) : 16 mois → 24 jours de principal. Garde-fou
  // général, qui ne joue pas sur le planning ANNUEL où les mois sont déjà bornés à 12.
  plafondMois: 16,
};

export interface Enfant {
  dateNaissance: string; // "YYYY-MM-DD"
}

export interface DroitCongeArgs {
  /** Mois de service effectif acquis sur la période de référence. */
  moisDeService: number;
  /** Date de départ en congé : c'est à cette date que l'âge des enfants est apprécié (art. 90). */
  dateDepart: string;
  dateEmbauche?: string;
  dateNaissance?: string;
  /** La majoration pour enfants est réservée aux mères salariées (art. 90). */
  sexe?: "F" | "M";
  enfants?: Enfant[];
  /**
   * Mois de service depuis l'embauche. Sert au SEUL seuil de jouissance, qui se juge sur
   * l'ancienneté totale et non sur les mois de l'année de référence. Déduit de `dateEmbauche`
   * quand il n'est pas fourni.
   */
  moisDepuisEmbauche?: number;
  regles?: Partial<ReglesDroitConge>;
}

export interface DroitConge {
  principal: number;
  /** Mois retenus pour juger la jouissance — ancienneté totale, pas les mois de l'année. */
  moisPourJouissance: number;
  majAnciennete: number;
  majEnfants: number;
  total: number;
  anneesAnciennete: number;
  enfantsRetenus: number;
  droitOuvert: boolean;
  /** Justification ligne à ligne, affichable dans l'écran pour que la RH puisse vérifier. */
  detail: string[];
}

/**
 * Mois de service effectif **sur une année de référence**, plafonnés à 12.
 *
 * ⚠️ Ne pas confondre avec `absences.moisDeService`, qui compte depuis la date d'embauche SANS
 * borne : c'est son rôle pour l'acquisition cumulée depuis l'entrée dans l'outil, mais l'employer
 * pour le droit ANNUEL donnait « 1,5 j × 70 mois » — soit 105 jours de congé au lieu de 18 pour
 * un salarié embauché en 2021 (défaut relevé par la RH le 22/10/2026).
 *
 * Un salarié embauché avant l'année de référence a ses 12 mois ; embauché en cours d'année, il a
 * le prorata (mars → 10 mois) ; embauché après, il n'a rien.
 *
 * ⚠️ L'année retenue est l'année CIVILE, comme dans le classeur de la RH. La période de référence
 * légale court du 1ᵉʳ juin au 31 mai (décret n°75/28) : à rendre paramétrable si elle le confirme.
 */
export function moisDeServiceSurAnnee(
  dateEmbauche: string | undefined,
  annee: number,
  plafond = 12,
): number {
  if (!dateEmbauche) return plafond;
  const an = +dateEmbauche.slice(0, 4);
  if (an < annee) return plafond;
  if (an > annee) return 0;
  const mois = +dateEmbauche.slice(5, 7);
  return Math.max(0, Math.min(plafond, 12 - mois + 1));
}

/** Âge révolu, en années, à une date donnée. */
export function ageA(dateNaissance: string, aLaDate: string): number {
  let ans = +aLaDate.slice(0, 4) - +dateNaissance.slice(0, 4);
  if (aLaDate.slice(5) < dateNaissance.slice(5)) ans--;
  return ans;
}

/** Arrondi au nombre entier SUPÉRIEUR (décret n°75/28) — tolérant aux flottants. */
export const arrondirSuperieur = (n: number) => Math.ceil(Math.round(n * 1e6) / 1e6);

/**
 * Droit à congé annuel : congé principal + majorations d'ancienneté et pour enfants.
 * Le résultat est arrondi au nombre entier supérieur et porte sa justification.
 */
export function droitConge(args: DroitCongeArgs): DroitConge {
  const r = { ...REGLES_DROIT_DEFAUT, ...(args.regles ?? {}) };
  const detail: string[] = [];

  const jeune =
    args.dateNaissance !== undefined && ageA(args.dateNaissance, args.dateDepart) < r.ageJeune;
  const taux = jeune ? r.joursParMoisJeune : r.joursParMois;
  const moisBruts = Math.max(0, args.moisDeService);
  const mois = Math.min(moisBruts, r.plafondMois);
  const principal = taux * mois;
  detail.push(
    `Congé principal : ${taux} j × ${mois} mois de service = ${principal} j` +
      (jeune ? ` (taux majoré, travailleur de moins de ${r.ageJeune} ans)` : "") +
      (mois < moisBruts ? ` — période écrêtée de ${moisBruts} à ${r.plafondMois} mois` : ""),
  );

  let anneesAnciennete = 0;
  let majAnciennete = 0;
  if (args.dateEmbauche) {
    anneesAnciennete = ageA(args.dateEmbauche, args.dateDepart);
    const paliers = Math.floor(anneesAnciennete / r.paliersAnciennete);
    majAnciennete = paliers * r.joursAnciennete;
    detail.push(
      `Majoration ancienneté : ${anneesAnciennete} ans → ${paliers} tranche(s) de ${r.paliersAnciennete} ans` +
        ` × ${r.joursAnciennete} j = ${majAnciennete} j`,
    );
  }

  let enfantsRetenus = 0;
  let majEnfants = 0;
  if (args.sexe === "F" && args.enfants?.length) {
    enfantsRetenus = args.enfants.filter(
      (e) => ageA(e.dateNaissance, args.dateDepart) < r.ageEnfantMax,
    ).length;
    // art. 90 : 1 jour seulement par enfant si le congé principal n'excède pas le seuil.
    const parEnfant =
      principal <= r.seuilCongePrincipalReduit ? 1 : r.joursParEnfant;
    majEnfants = enfantsRetenus * parEnfant;
    detail.push(
      `Majoration mère de famille : ${enfantsRetenus} enfant(s) de moins de ${r.ageEnfantMax} ans` +
        ` au ${args.dateDepart} × ${parEnfant} j = ${majEnfants} j`,
    );
  }

  const brut = principal + majAnciennete + majEnfants;
  const total = arrondirSuperieur(brut);
  if (total !== brut) detail.push(`Arrondi au nombre entier supérieur : ${brut} → ${total} j`);

  // ⚠️ La jouissance se juge sur l'ancienneté TOTALE, et non sur les mois de service de l'année.
  // Sur le planning annuel, `moisDeService` est borné à 12 par construction (`moisDeServiceSurAnnee`)
  // : comparer ces 12 mois au seuil de 24 le rendrait faux pour TOUT LE MONDE, y compris un
  // salarié présent depuis dix ans. On prend donc les mois depuis l'embauche quand on les
  // connaît, et on retombe sur `moisDeService` sinon — faute de mieux.
  const moisDepuisEmbauche = args.moisDepuisEmbauche
    ?? (args.dateEmbauche ? moisEntre(args.dateEmbauche, args.dateDepart) : null);
  const moisPourJouissance = moisDepuisEmbauche ?? moisBruts;
  const droitOuvert = moisPourJouissance >= r.moisAvantJouissance;
  if (!droitOuvert)
    detail.push(
      `⚠️ Droit à la jouissance non encore ouvert : ${moisPourJouissance} mois de service sur ${r.moisAvantJouissance} requis (décision du 05/11/2026)`,
    );

  return {
    principal,
    majAnciennete,
    majEnfants,
    total,
    anneesAnciennete,
    enfantsRetenus,
    droitOuvert,
    moisPourJouissance,
    detail,
  };
}

// ---------------------------------------------------------------------------
// Contrôles de cohérence d'une ligne de planning
// ---------------------------------------------------------------------------

export type AnomalieCode =
  | "retour_avant_depart"
  | "retour_incoherent"
  | "duree_aberrante"
  | "total_nul"
  | "depart_non_ouvrable";

export interface Anomalie {
  code: AnomalieCode;
  message: string;
  attendu?: string;
}

/**
 * Contrôle une ligne de planning (départ, total, retour saisi) et renvoie ses anomalies.
 * C'est ce qui remplace l'absence totale de contrôle du tableur : sur le planning réel de la RH,
 * 5 lignes sur 61 sont matériellement impossibles et 8 autres ne suivent aucune règle constante.
 */
export function controlerLigne(
  args: { depart: string; totalConge: number; retourSaisi?: string },
  feries: Set<string>,
  regles: ReglesOuvrables = REGLES_OUVRABLES_DEFAUT,
): Anomalie[] {
  const out: Anomalie[] = [];
  const { depart, totalConge, retourSaisi } = args;

  if (!totalConge) out.push({ code: "total_nul", message: "Total de congé nul ou absent" });
  if (!estOuvrable(depart, feries, regles))
    out.push({
      code: "depart_non_ouvrable",
      message: `Le départ du ${depart} tombe un jour non ouvrable`,
      attendu: prochainJourOuvrable(depart, feries, regles),
    });

  if (retourSaisi && totalConge) {
    if (retourSaisi <= depart) {
      out.push({
        code: "retour_avant_depart",
        message: `Retour (${retourSaisi}) antérieur ou égal au départ (${depart})`,
        attendu: dateRetour(depart, totalConge, feries, regles),
      });
    } else {
      const calendaires = Math.round((versT(retourSaisi) - versT(depart)) / JOUR_MS);
      const attendu = dateRetour(depart, totalConge, feries, regles);
      if (calendaires > totalConge * 2.2) {
        out.push({
          code: "duree_aberrante",
          message: `${calendaires} jours calendaires pour ${totalConge} jours de congé`,
          attendu,
        });
      } else if (attendu !== retourSaisi) {
        const ecart = Math.round((versT(retourSaisi) - versT(attendu)) / JOUR_MS);
        out.push({
          code: "retour_incoherent",
          message: `Retour saisi ${retourSaisi}, calculé ${attendu} (écart ${ecart > 0 ? "+" : ""}${ecart} j)`,
          attendu,
        });
      }
    }
  }
  return out;
}

// Allocation de congé payé — logique PURE (lot R4).
//
// C'est le poste où l'écart entre la pratique de la clinique et la loi était le plus lourd de tout
// le chantier : jusqu'à 1,6 fois le montant selon la lecture retenue. Les quatre inconnues ont été
// arbitrées par la Direction le 05/11/2026 (A-VERIFIER R-5), et ce module les applique telles
// quelles.
//
// LE MODÈLE
//
//   N                = nombre de mois ET FRACTIONS DE MOIS de la période de référence,
//                      plafonné à 16 (décret n°75/28)
//   droit en jours   = 1,5 × N                          → 24 jours au plafond
//   allocation       = arrondi( N × assiette ÷ 16 )
//   premier congé    = à l'issue de 24 mois de service
//
// D'OÙ VIENT LE DIVISEUR 16, ET POURQUOI IL N'EST PAS LE 18 DE SON CLASSEUR
//
// L'art. 89 pose l'équivalence : un mois de service ouvre 1,5 jour de congé, et un mois vaut
// 24 jours ouvrables. Or **1,5 ÷ 24 = 1/16** : le seizième encode déjà le 1,5 jour par mois. Il en
// découle que le taux journalier légal vaut `assiette ÷ 24` et qu'il est **invariant** — il ne
// dépend pas de N.
//
// Son classeur divisait par 18, ce qui revient à fixer le congé principal à 18 jours quel que soit
// N. Les deux lectures coïncident exactement quand N = 12 (car 1,5 × 12 = 18) et divergent de 33 %
// au-delà. L'arbitrage du 05/11 a retenu le plafond à **16 mois**, ce que disaient les données : la
// ligne 16 de son DIPE d'août affiche un rapport de 1,0000 (donc N = 16,00 pile), et son planning
// porte des lignes à 24 jours — 1,5 × 16 — sans aucune à 23.
//
// ⚠️ ÉCART ASSUMÉ AVEC SON DIPE D'AOÛT 2026
//
// Trois lignes de ce DIPE valent 99,8364 % de (salaire + ancienneté), soit 248, 349 et 263 FCFA de
// moins que ce modèle ne donne. Ce facteur de 0,1636 % n'a jamais été expliqué — un arrondi au
// franc ne peut produire que 0,5 FCFA d'écart, soit cinq cents fois moins. La Direction a tranché
// le 05/11 : on applique la règle énoncée et on n'attend plus les dates qui auraient permis de
// retrouver le facteur. Cet écart est donc une CONSÉQUENCE ACCEPTÉE, et non un défaut à corriger.

/**
 * Comment convertir des jours restants en fraction de mois. Le décret dit « mois et fractions de
 * mois » sans fixer la conversion, et les trois conventions donnent trois montants : le choix est
 * donc porté par le barème daté plutôt qu'écrit en dur.
 */
export type ConventionFraction = "jours_du_mois" | "trente" | "trente_virgule_44";

export interface ReglesAllocation {
  /** 1,5 j de congé par mois ÷ 24 j ouvrables par mois = 1/16. */
  diviseur: number;
  /** Plafond de la période de référence, en mois. 16 → 24 jours de principal. */
  plafondMois: number;
  /** Mois de service avant le PREMIER congé (arbitrage du 05/11/2026 : 24). */
  moisAvantPremierConge: number;
  joursParMois: number;
  conventionFraction: ConventionFraction;
}

export const REGLES_ALLOCATION_DEFAUT: ReglesAllocation = {
  diviseur: 16,
  plafondMois: 16,
  moisAvantPremierConge: 24,
  joursParMois: 1.5,
  // Lecture littérale de « fractions de mois », et la seule qui n'introduise aucun diviseur
  // arbitraire. Réversible sans toucher au code — voir A-VERIFIER R-5.
  conventionFraction: "jours_du_mois",
};

// ---------------------------------------------------------------------------
// Dates — strictement sur des chaînes « YYYY-MM-DD », sans fuseau horaire
// ---------------------------------------------------------------------------

const JOURS_DU_MOIS = (annee: number, mois: number) => new Date(Date.UTC(annee, mois, 0)).getUTCDate();

/** Ajoute `n` mois à une date, en ramenant le jour au dernier du mois s'il n'existe pas. */
export function ajouterMois(date: string, n: number): string {
  const an = +date.slice(0, 4);
  const mo = +date.slice(5, 7);
  const jo = +date.slice(8, 10);
  const total = (an * 12 + (mo - 1)) + n;
  const anCible = Math.floor(total / 12);
  const moCible = (total % 12) + 1;
  // 31 janvier + 1 mois = 28 (ou 29) février : le jour est ramené, jamais reporté sur mars.
  const joCible = Math.min(jo, JOURS_DU_MOIS(anCible, moCible));
  return `${anCible}-${String(moCible).padStart(2, "0")}-${String(joCible).padStart(2, "0")}`;
}

const AU_JOUR = 86400000;
const enJours = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / AU_JOUR;

/** Jours calendaires entre deux dates, bornes INCLUSES. */
export const joursInclus = (debut: string, fin: string) =>
  fin < debut ? 0 : enJours(fin) - enJours(debut) + 1;

export const jourSuivant = (d: string) => {
  const t = new Date((enJours(d) + 1) * AU_JOUR);
  return t.toISOString().slice(0, 10);
};

export interface MoisEtFractions {
  /** Le N de la formule : mois entiers + fraction. */
  n: number;
  moisEntiers: number;
  joursRestants: number;
  /** Diviseur effectivement employé pour la fraction. */
  denominateur: number;
}

/**
 * Mois et fractions de mois d'une période, bornes INCLUSES.
 *
 * `fin` est la **veille du départ** : la période de référence court du retour du congé précédent
 * à ce jour-là (décret n°75/28). Les bornes sont incluses, d'où le `+ 1 jour` dans la comparaison
 * d'anniversaire : du 3 mars au 2 avril, c'est un mois plein, pas un mois moins un jour.
 */
export function moisEtFractions(
  debut: string,
  fin: string,
  convention: ConventionFraction = REGLES_ALLOCATION_DEFAUT.conventionFraction,
): MoisEtFractions {
  if (fin < debut) return { n: 0, moisEntiers: 0, joursRestants: 0, denominateur: 30 };

  const lendemainDeFin = jourSuivant(fin);
  let moisEntiers = 0;
  while (ajouterMois(debut, moisEntiers + 1) <= lendemainDeFin) moisEntiers++;

  const debutDuReste = ajouterMois(debut, moisEntiers);
  const joursRestants = joursInclus(debutDuReste, fin);

  const denominateur =
    convention === "trente" ? 30
    : convention === "trente_virgule_44" ? 30.44
    // Le mois entamé, mesuré par son propre anniversaire : 28, 29, 30 ou 31 selon le cas.
    : joursInclus(debutDuReste, ajouterMois(debut, moisEntiers + 1)) - 1;

  return {
    moisEntiers,
    joursRestants,
    denominateur,
    n: moisEntiers + (denominateur ? joursRestants / denominateur : 0),
  };
}

/**
 * Période de référence d'un congé : du retour du congé précédent à la **veille** du départ.
 *
 * Faute de congé précédent, elle part de la date d'embauche — c'est le cas du premier congé, et
 * la raison pour laquelle le premier N vaut 24 mois en pratique (arbitrage R-3c).
 */
export function periodeDeReference(args: {
  dateDepart: string;
  dateRetourPrecedent?: string;
  dateEmbauche?: string;
}): { debut: string; fin: string } | null {
  const debut = args.dateRetourPrecedent ?? args.dateEmbauche;
  if (!debut) return null;
  const veille = new Date((enJours(args.dateDepart) - 1) * AU_JOUR).toISOString().slice(0, 10);
  return { debut, fin: veille };
}

// ---------------------------------------------------------------------------
// L'allocation
// ---------------------------------------------------------------------------

export interface AllocationArgs {
  /** Assiette de l'allocation — `calculerAssiettes(...).allocConge` (salaire de base + ancienneté). */
  assiette: number;
  dateDepart: string;
  dateRetourPrecedent?: string;
  dateEmbauche?: string;
  /** Surcharge de N, quand la RH le saisit à la main plutôt que de le laisser déduire des dates. */
  nForce?: number;
  regles?: Partial<ReglesAllocation>;
}

export interface Allocation {
  /** N retenu, APRÈS plafonnement. */
  n: number;
  /** N avant plafonnement — diffère du précédent quand la période dépasse le plafond. */
  nBrut: number;
  plafonne: boolean;
  /** Droit en jours : 1,5 × N, arrondi au jour. */
  droitJours: number;
  assiette: number;
  /** Le montant à verser, arrondi au franc. */
  montant: number;
  /** Taux journalier légal : assiette ÷ 24. Invariant — il ne dépend pas de N. */
  tauxJournalier: number;
  /** Faux tant que les `moisAvantPremierConge` ne sont pas atteints. */
  droitOuvert: boolean;
  moisDepuisEmbauche: number | null;
  periode: { debut: string; fin: string } | null;
  fraction: MoisEtFractions | null;
  /** Justification ligne à ligne, pour que la RH puisse vérifier sans nous. */
  detail: string[];
}

const fmt = (n: number) => n.toLocaleString("fr-FR").replace(/ /g, " ");

export function allocationConge(args: AllocationArgs): Allocation {
  const r = { ...REGLES_ALLOCATION_DEFAUT, ...(args.regles ?? {}) };
  const detail: string[] = [];

  const periode = periodeDeReference(args);
  let fraction: MoisEtFractions | null = null;
  let nBrut: number;

  if (args.nForce !== undefined) {
    nBrut = Math.max(0, args.nForce);
    detail.push(`N saisi à la main : ${nBrut.toFixed(4)} mois`);
  } else if (periode) {
    fraction = moisEtFractions(periode.debut, periode.fin, r.conventionFraction);
    nBrut = fraction.n;
    detail.push(
      `Période de référence : du ${periode.debut} au ${periode.fin} (veille du départ)`,
    );
    detail.push(
      `N = ${fraction.moisEntiers} mois entiers + ${fraction.joursRestants} j ÷ ${fraction.denominateur}` +
        ` = ${nBrut.toFixed(4)} mois`,
    );
  } else {
    nBrut = 0;
    detail.push(
      "⚠️ Ni retour du congé précédent ni date d'embauche : N ne peut pas être déduit. " +
        "Saisir N à la main, ou renseigner la fiche.",
    );
  }

  const plafonne = nBrut > r.plafondMois;
  const n = plafonne ? r.plafondMois : nBrut;
  if (plafonne)
    detail.push(
      `Plafond atteint : N ramené de ${nBrut.toFixed(4)} à ${r.plafondMois} mois ` +
        `(décision du 05/11/2026)`,
    );

  const droitJours = Math.round(r.joursParMois * n);
  detail.push(`Droit : ${r.joursParMois} j × ${n.toFixed(4)} mois = ${droitJours} j`);

  const montant = Math.round((n * args.assiette) / r.diviseur);
  detail.push(
    `Allocation : ${n.toFixed(4)} × ${fmt(args.assiette)} ÷ ${r.diviseur} = ${fmt(montant)} FCFA`,
  );

  // 24 = jours ouvrables d'un mois, par l'équivalence de l'art. 89. Le taux ne dépend pas de N :
  // c'est précisément ce que le diviseur 18 du classeur faisait varier à tort.
  const tauxJournalier = Math.round(args.assiette / 24);
  detail.push(`Taux journalier : ${fmt(args.assiette)} ÷ 24 = ${fmt(tauxJournalier)} FCFA/jour`);

  const moisDepuisEmbauche = args.dateEmbauche
    ? moisEntre(args.dateEmbauche, args.dateDepart)
    : null;
  const droitOuvert =
    moisDepuisEmbauche === null ? true : moisDepuisEmbauche >= r.moisAvantPremierConge;
  if (moisDepuisEmbauche !== null && !droitOuvert)
    detail.push(
      `⚠️ Premier congé non encore ouvert : ${moisDepuisEmbauche} mois de service sur ` +
        `${r.moisAvantPremierConge} requis (décision du 05/11/2026)`,
    );

  return {
    n, nBrut, plafonne, droitJours, assiette: args.assiette, montant, tauxJournalier,
    droitOuvert, moisDepuisEmbauche, periode, fraction, detail,
  };
}

/** Mois ENTIERS révolus entre deux dates. Sert au seuil du premier congé. */
export function moisEntre(debut: string, fin: string): number {
  if (fin < debut) return 0;
  let n = 0;
  while (ajouterMois(debut, n + 1) <= fin) n++;
  return n;
}

/**
 * Le même calcul dans la lecture du classeur (diviseur 18, congé principal fixé), pour que l'écran
 * puisse montrer les deux côte à côte. Ce n'est PAS la règle appliquée : c'est la pièce de
 * comparaison qui a permis de chiffrer l'enjeu à 33 %.
 */
export function allocationLectureClasseur(assiette: number, n: number, principalFixe = 18) {
  const montant = Math.round((n * assiette) / 16);
  return {
    montant,
    principalJours: principalFixe,
    tauxJournalier: Math.round(montant / principalFixe),
  };
}

/** Écart entre les deux lectures sur un nombre de jours supplémentaires donné. */
export function ecartSurJoursSupplementaires(assiette: number, n: number, joursSupp: number) {
  const legale = allocationConge({ assiette, dateDepart: "2026-01-01", nForce: n });
  const classeur = allocationLectureClasseur(assiette, Math.min(n, 16));
  const montantLegal = legale.tauxJournalier * joursSupp;
  const montantClasseur = classeur.tauxJournalier * joursSupp;
  return {
    montantLegal,
    montantClasseur,
    ecart: montantClasseur - montantLegal,
    pourcentage: montantLegal ? (montantClasseur / montantLegal - 1) * 100 : 0,
  };
}

// ---------------------------------------------------------------------------
// Repérage du congé d'un mois donné
// ---------------------------------------------------------------------------

export interface CongeRepere {
  /** Date de départ : c'est elle qui clôt la période de référence. */
  depart: string;
  retour: string;
  /** Retour du congé PRÉCÉDENT, qui ouvre la période de référence. Absent au premier congé. */
  retourPrecedent?: string;
}

/**
 * Le congé payé qui COMMENCE dans la période, et le retour du congé précédent.
 *
 * L'allocation se rattache au mois du DÉPART, pas à chaque mois traversé : un congé à cheval sur
 * juin et juillet ne doit pas produire deux allocations. C'est aussi pourquoi on repère le départ
 * et non le chevauchement.
 */
export function congePayeDuMois(
  evenements: { type: string; dateDebut: string; dateFin: string }[],
  periode: string,
): CongeRepere | null {
  const conges = evenements
    .filter((e) => e.type === "conge_paye")
    .sort((a, b) => a.dateDebut.localeCompare(b.dateDebut));
  const i = conges.findIndex((c) => c.dateDebut.slice(0, 7) === periode);
  if (i < 0) return null;
  const c = conges[i];
  // Le retour du congé précédent, c'est le LENDEMAIN de sa date de fin : la période de référence
  // commence le jour où le salarié reprend le travail, pas le dernier jour de son congé.
  const precedent = i > 0 ? conges[i - 1] : undefined;
  return {
    depart: c.dateDebut,
    retour: c.dateFin,
    retourPrecedent: precedent ? jourSuivant(precedent.dateFin) : undefined,
  };
}

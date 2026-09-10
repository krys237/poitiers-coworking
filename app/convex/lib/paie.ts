// Moteur de paie PUR (aucune dépendance Convex) — testable isolément.
// Aligné sur le modèle de référence du directeur (application « PAIE POITIERS COWORKING ») :
//   salaire journalier = brut ÷ 30 ; indemnité de congés = journalier × congés pris ;
//   prime de transport exonérée ; CNPS plafonnée ; IRPP annuel (base × 70 % − CNPS − abattement annuel)
//   avec tranches annuelles ; CAC sur IRPP ; TDL (barème sur le salaire de base) et RAV (barème sur la base
//   taxable) activables ; Total 1 (brut), Total 2 (net). Montants en ENTIERS FCFA.
//
// Le calcul dépend d'un BARÈME DATÉ (voir schema `baremes`) : un bulletin utilise
// toujours la version du barème applicable à sa période.

export interface Bareme {
  plafondCnps: number;
  tauxPvidSal: number;      // %
  tauxPvidPat: number;      // %
  tauxPf: number;           // %
  tauxAtmp: number;         // %
  tauxCfcSal: number;       // %
  tauxCfcPat: number;       // %
  tauxFne: number;          // %
  abattementIrppPct: number;// % d'abattement forfaitaire (30 % → base × 0,7)
  tauxCac: number;          // % de l'IRPP
  irppBrackets: { jusqua: number | null; taux: number }[]; // tranches exprimées en base MENSUELLE
  abattementIrppAnnuel?: number; // abattement annuel (déf. 500 000), appliqué ÷ 12
  tdlActif?: boolean;       // taxe de développement local (déf. actif)
  ravActif?: boolean;       // redevance audiovisuelle (déf. actif)
}

export interface SaisieMois {
  joursTravailles: number;
  joursBase: number;        // jours de référence (déf. 30)
  sanctions: number;        // FCFA
  primesVariables: number;  // « Primes fixes » du mois (FCFA)
  transport: number;        // prime de transport (exonérée)
  primeAssiduite: number;
  indemniteLogement: number;
  heuresSup: number;
  anciennete: number;
  mutuellePct: number;      // %
  dettesSoins: number;
  acompte: number;
  absences: number;         // retenue pour absences (FCFA)
  congesPris: number;       // jours de congé pris dans le mois → indemnité
  congesAcquis: number;     // cumul acquis (information bulletin)
  congesRestants?: number;  // reste à prendre (information bulletin)
}

// Lignes libres du registre "Primes & charges" (par employé et par mois).
export interface LigneLibre { libelle: string; montant: number; }
export interface Extras { primes?: LigneLibre[]; charges?: LigneLibre[]; }

export interface LigneGain { code: string; libelle: string; base: number; gain: number; }
export interface LigneCotisation { code: string; libelle: string; base: number; taux: number; retenue: number; chargePatronale: number; }

export interface DetailsBulletin {
  salaireJournalier: number; salaireBase: number; joursTravailles: number;
  congesAcquis: number; congesPris: number; congesRestants: number; indemniteConges: number;
  primes: number; heuresSup: number; anciennete: number;
  total1: number; total2: number; brutTaxable: number; baseCnps: number;
  mutuelle: number; acompteImpotsCnps: number; chargesSalariales: number; chargesPatronales: number;
  irpp: number; cac: number; tdl: number; rav: number; cnpsSalarie: number;
}

export interface Bulletin {
  brut: number;               // = Total 1 (TOTAL BRUT)
  totalRetenues: number;      // toutes les retenues salariales (cotisations, impôts et retenues diverses)
  net: number;                // = max(0, Total 2)
  chargesSalariales: number;  // cotisations & impôts seulement (CNPS, IRPP, CAC, TDL, RAV, CFC)
  chargesPatronales: number;  // info employeur
  lignesGain: LigneGain[];
  cotisations: LigneCotisation[];
  details: DetailsBulletin;
}

// Barèmes forfaitaires (Code général des impôts) — [plafond inclus, montant].
export const TDL_BAREME: [number, number][] = [
  [62000, 0], [75000, 250], [100000, 500], [125000, 750], [150000, 1000], [200000, 1250], [250000, 1500],
  [300000, 2000], [500000, 2250], [750000, 2500], [1000000, 2750], [1500000, 3000], [2000000, 4000], [Infinity, 4500],
];
export const RAV_BAREME: [number, number][] = [
  [50000, 0], [100000, 750], [200000, 1950], [300000, 3250], [400000, 4550], [500000, 5850], [600000, 7150],
  [700000, 8450], [800000, 9750], [900000, 11050], [1000000, 12350], [Infinity, 13000],
];
export const bareme = (table: [number, number][], montant: number) => table.find(([max]) => montant <= max)?.[1] ?? 0;

const pct = (montant: number, taux: number) => Math.round((montant * taux) / 100);

// IRPP progressif sur une base donnée avec des tranches exprimées dans la même unité (mensuelle ou annuelle).
export function computeIrpp(baseImposable: number, brackets: Bareme["irppBrackets"]): number {
  if (baseImposable <= 0) return 0;
  let irpp = 0;
  let plancher = 0;
  for (const b of brackets) {
    const plafond = b.jusqua ?? Infinity;
    if (baseImposable <= plancher) break;
    const portion = Math.min(baseImposable, plafond) - plancher;
    if (portion > 0) irpp += (portion * b.taux) / 100;
    plancher = plafond;
  }
  return Math.round(irpp);
}

export function computeBulletin(salaireBrutRef: number, s: SaisieMois, b: Bareme, extras: Extras = {}): Bulletin {
  const joursBase = s.joursBase || 30;
  const abattementAnnuel = b.abattementIrppAnnuel ?? 500000;
  const tdlActif = b.tdlActif ?? true;
  const ravActif = b.ravActif ?? true;

  // 1. Salaire journalier, salaire de base, indemnité de congés.
  const journalier = salaireBrutRef / joursBase;
  const salaireBase = Math.round(journalier * s.joursTravailles);
  const indemniteConges = Math.round(journalier * (s.congesPris || 0));
  const congesRestants = s.congesRestants ?? Math.max(0, (s.congesAcquis || 0) - (s.congesPris || 0));

  // 2. Gains — liste fixe (toujours présente, même à zéro) + lignes libres du registre.
  const primesRegistre = (extras.primes ?? []).map((p) => ({ libelle: p.libelle, montant: Math.round(p.montant) })).filter((p) => p.montant);
  const primes = s.primesVariables + s.transport + s.primeAssiduite + s.indemniteLogement + primesRegistre.reduce((t, p) => t + p.montant, 0);
  const total1 = salaireBase + primes + indemniteConges + s.heuresSup + s.anciennete;

  const lignesGain: LigneGain[] = [
    { code: "66111", libelle: "Salaire du mois", base: salaireBase, gain: salaireBase },
    { code: "66112", libelle: "Forfait heures supplémentaires", base: 0, gain: s.heuresSup },
    { code: "66116", libelle: "Ancienneté", base: 0, gain: s.anciennete },
    { code: "6613", libelle: "Congés payés", base: 0, gain: indemniteConges },
    { code: "66121", libelle: "Prime de transport", base: s.transport, gain: s.transport },
    { code: "66122", libelle: "Prime d'assiduité", base: s.primeAssiduite, gain: s.primeAssiduite },
    { code: "6631", libelle: "Indemnité de logement", base: s.indemniteLogement, gain: s.indemniteLogement },
    { code: "66125", libelle: "Primes fixes", base: 0, gain: s.primesVariables },
    ...primesRegistre.map((p) => ({ code: "PRIME", libelle: p.libelle, base: 0, gain: p.montant })),
  ];

  // 3. Bases : la prime de transport est exonérée ; CNPS plafonnée.
  const mutuelle = pct(total1, s.mutuellePct);
  const brutTaxable = Math.max(0, total1 - s.transport);
  const baseCnps = Math.min(brutTaxable, b.plafondCnps);

  const cnpsSalarie = pct(baseCnps, b.tauxPvidSal);
  const cfcSalarie = pct(brutTaxable, b.tauxCfcSal);

  // IRPP : (base taxable × (1 − abattement %) − CNPS salarié − abattement annuel ÷ 12), tranches annuelles.
  const baseIrppMensuelle = Math.max(0, brutTaxable * (1 - b.abattementIrppPct / 100) - cnpsSalarie - abattementAnnuel / 12);
  const tranchesAnnuelles = b.irppBrackets.map((t) => ({ jusqua: t.jusqua === null ? null : t.jusqua * 12, taux: t.taux }));
  const irpp = Math.round(computeIrpp(baseIrppMensuelle * 12, tranchesAnnuelles) / 12);
  const cac = pct(irpp, b.tauxCac);
  const tdl = tdlActif ? bareme(TDL_BAREME, salaireBase) : 0;
  const rav = ravActif ? bareme(RAV_BAREME, brutTaxable) : 0;

  // Charges patronales
  const pf = pct(baseCnps, b.tauxPf);
  const pvidPat = pct(baseCnps, b.tauxPvidPat);
  const atmp = pct(baseCnps, b.tauxAtmp);
  const fne = pct(brutTaxable, b.tauxFne);
  const cfcPat = pct(brutTaxable, b.tauxCfcPat);
  const chargesPatronales = pf + pvidPat + atmp + fne + cfcPat;

  const chargesSalariales = cnpsSalarie + irpp + cac + tdl + rav + cfcSalarie;
  const acompteImpotsCnps = s.acompte + chargesSalariales;

  const chargesRegistre = (extras.charges ?? []).map((c) => ({ libelle: c.libelle, montant: Math.round(c.montant) })).filter((c) => c.montant);
  const retenue = (code: string, libelle: string, base: number, taux: number, montant: number) =>
    ({ code, libelle, base, taux, retenue: montant, chargePatronale: 0 });
  const patron = (code: string, libelle: string, base: number, taux: number, montant: number) =>
    ({ code, libelle, base, taux, retenue: 0, chargePatronale: montant });

  const cotisations: LigneCotisation[] = [
    retenue("43131", "Retenue CNPS", baseCnps, b.tauxPvidSal, cnpsSalarie),
    patron("66411", "PF", baseCnps, b.tauxPf, pf),
    patron("66412", "PVID PAT", baseCnps, b.tauxPvidPat, pvidPat),
    patron("66413", "ATMP", baseCnps, b.tauxAtmp, atmp),
    retenue("44721", "IRPP", brutTaxable, 0, irpp),
    retenue("44722", "CAC", irpp, b.tauxCac, cac),
    retenue("44723", "TDL", salaireBase, 0, tdl),
    retenue("44724", "CFC SAL", brutTaxable, b.tauxCfcSal, cfcSalarie),
    patron("64131", "F.N.E.", brutTaxable, b.tauxFne, fne),
    patron("64132", "CFC PAT", brutTaxable, b.tauxCfcPat, cfcPat),
    retenue("44725", "RAV", brutTaxable, 0, rav),
    retenue("", "Sanctions", 0, 0, s.sanctions),
    retenue("", "Absences", 0, 0, s.absences),
    retenue("", "Dettes de soins", 0, 0, s.dettesSoins),
    retenue("", "Acompte", 0, 0, s.acompte),
    retenue("", `Mutuelle (${s.mutuellePct}%)`, total1, s.mutuellePct, mutuelle),
    ...chargesRegistre.map((c) => retenue("RETENUE", c.libelle, c.montant, 0, c.montant)),
  ];

  const totalRetenues = cotisations.reduce((t, c) => t + c.retenue, 0);
  const total2 = total1 - totalRetenues;
  const net = Math.max(0, total2);

  return {
    brut: total1, totalRetenues, net, chargesSalariales, chargesPatronales, lignesGain, cotisations,
    details: {
      salaireJournalier: Math.round(journalier), salaireBase, joursTravailles: s.joursTravailles,
      congesAcquis: s.congesAcquis || 0, congesPris: s.congesPris || 0, congesRestants, indemniteConges,
      primes, heuresSup: s.heuresSup, anciennete: s.anciennete,
      total1, total2, brutTaxable, baseCnps, mutuelle, acompteImpotsCnps, chargesSalariales, chargesPatronales,
      irpp, cac, tdl, rav, cnpsSalarie,
    },
  };
}

// Barème par défaut — Barème CNPS / CGI en vigueur (depuis 2016-07), tel qu'utilisé par la référence.
// À VALIDER avec la source officielle avant toute paie réelle.
export const BAREME_DEFAUT: Bareme = {
  plafondCnps: 750000,
  tauxPvidSal: 4.2,
  tauxPvidPat: 4.2,
  tauxPf: 7.0,
  tauxAtmp: 1.75,
  tauxCfcSal: 1.0,
  tauxCfcPat: 1.5,
  tauxFne: 1.0,
  abattementIrppPct: 30,
  tauxCac: 10,
  abattementIrppAnnuel: 500000,
  tdlActif: true,
  ravActif: true,
  // Tranches IRPP en base mensuelle (= tranches annuelles 2 M / 3 M / 5 M ÷ 12).
  irppBrackets: [
    { jusqua: 166667, taux: 10 },
    { jusqua: 250000, taux: 15 },
    { jusqua: 416667, taux: 25 },
    { jusqua: null, taux: 35 },
  ],
};

// Moteur de paie PUR (aucune dépendance Convex) — testable isolément.
//
// Les QUATRE ASSIETTES sont calculées par `lib/rubriques.ts` depuis le lot R2 : salaire brut,
// salaire brut intermédiaire, salaire taxable, salaire cotisable plafonné. Voir l'en-tête de ce
// fichier-là pour la définition de chacune et `ANALYSE-RH-CONGES-IMPOT.md` pour leur origine
// (les colonnes V, W, Z et AA du DIPE de la responsable RH).
//
// Formules : salaire journalier = brut ÷ 30 ; salaire de base = journalier × jours travaillés ;
// indemnité de congés = journalier × congés pris ; IRPP annuel exact (base × 70 % − CNPS −
// abattement annuel) sur les tranches annuelles ; CAC sur l'IRPP ; TDL sur le salaire de base ;
// RAV sur le salaire taxable ; Total 1 (brut), Total 2 (net). Montants en ENTIERS FCFA.
//
// Le calcul dépend d'un BARÈME DATÉ (voir schema `baremes`) : un bulletin utilise toujours la
// version du barème applicable à sa période. **Les interrupteurs introduits par le lot R2 sont
// optionnels et leur absence rejoue le comportement d'avant la correction** — un mois rejoué avec
// son barème d'époque redonne donc exactement les mêmes chiffres.

import {
  calculerAssiettes,
  RUBRIQUES_DEFAUT,
  type Assiettes,
  type Rubrique,
} from "./rubriques.ts";

/** Groupes de risque CNPS accidents du travail / maladies professionnelles. */
export const TAUX_ATMP: Record<"A" | "B" | "C", number> = { A: 1.75, B: 2.5, C: 5 };

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

  // --- Corrections du lot R2 (toutes optionnelles : absentes = comportement historique) -------
  /**
   * C1 — le transport entre dans l'assiette TAXABLE (tranché le 20/10/2026). Il reste hors de
   * l'assiette cotisable. Absent ou `false` = ancien comportement (transport détaxé).
   */
  transportTaxable?: boolean;
  /**
   * C3 — plafonner l'assiette AT/MP. La **loi ne la plafonne pas** (seuls PVID et prestations
   * familiales le sont) ; `true` rejoue la pratique du tableur. Voir A-VERIFIER B6.
   */
  atmpPlafonne?: boolean;
  /**
   * C4 — asseoir le CFC patronal et le FNE sur le salaire BRUT (et non sur le taxable),
   * conformément à son DIPE et à ses notes.
   */
  cfcPatronalEtFneSurBrut?: boolean;
  /**
   * C6 — plancher d'exonération des retenues SALARIALES (déf. 62 000, tranché le 20/10/2026).
   * Les charges PATRONALES n'ont jamais de plancher : « l'employeur a toujours un montant à payer
   * dès qu'il y a un salaire ».
   */
  seuilExoneration?: number;
  /** C8 — groupe de risque AT/MP de l'établissement ; prime sur `tauxAtmp` s'il est renseigné. */
  groupeRisqueAtmp?: "A" | "B" | "C";
  /** Catalogue de rubriques applicable à la période (déf. `RUBRIQUES_DEFAUT`). */
  rubriques?: Rubrique[];
}

export interface SaisieMois {
  joursTravailles: number;
  joursBase: number;        // jours de référence (déf. 30)
  sanctions: number;        // FCFA
  primesVariables: number;  // « Primes fixes » du mois (FCFA)
  transport: number;        // prime de transport
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
export interface Extras {
  primes?: LigneLibre[];
  charges?: LigneLibre[];
  /**
   * Montants des rubriques nommées que la saisie mensuelle ne porte pas en champ dédié
   * (salissure, panier, lait, représentation, véhicule, outillage, caisse, rendement,
   * gratification…), indexés par code de rubrique.
   */
  rubriques?: Record<string, number>;
  /** C9 — exonération « jeunes de moins de 35 ans » (LF 2026) : charges fiscales et patronales. */
  exonereJeune?: boolean;
}

export interface LigneGain { code: string; libelle: string; base: number; gain: number; }
export interface LigneCotisation { code: string; libelle: string; base: number; taux: number; retenue: number; chargePatronale: number; }

export interface DetailsBulletin {
  salaireJournalier: number; salaireBase: number; joursTravailles: number;
  congesAcquis: number; congesPris: number; congesRestants: number; indemniteConges: number;
  primes: number; heuresSup: number; anciennete: number;
  total1: number; total2: number; brutTaxable: number; baseCnps: number;
  mutuelle: number; acompteImpotsCnps: number; chargesSalariales: number; chargesPatronales: number;
  irpp: number; cac: number; tdl: number; rav: number; cnpsSalarie: number;
  /**
   * Les quatre assiettes, exposées telles quelles pour l'écran d'audit et le DIPE.
   * OPTIONNEL : les snapshots des mois clôturés AVANT le lot R2 ne les portent pas.
   */
  assiettes?: Assiettes;
  /** Vrai si le salarié est sous le plancher d'exonération des retenues salariales. */
  exonereSalarial?: boolean;
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

/**
 * Barèmes forfaitaires (Code général des impôts) — `[seuil EXCLUSIF, montant]` : la première
 * ligne dont `montant < seuil` s'applique. Cette forme reproduit littéralement le texte légal
 * (« en deçà de 62 000 FCFA ») et les formules du DIPE (`IF(F < 62000 ; 0 ; IF(F < 75001 ; 250 …`).
 */
export const TDL_BAREME: [number, number][] = [
  [62000, 0], [75001, 250], [100001, 500], [125001, 750], [150001, 1000], [200001, 1250],
  [250001, 1500], [300001, 2000], [500001, 2250], [Infinity, 2500], // C5 : plafond légal 2 500
];
export const RAV_BAREME: [number, number][] = [
  [62000, 0], // C10 : première tranche alignée sur 62 000 (et non 50 000)
  [100000, 750], [200000, 1950], [300000, 3250], [400000, 4550], [500000, 5850], [600000, 7150],
  [700000, 8450], [800000, 9750], [900000, 11050], [1000000, 12350], [Infinity, 13000],
];

/** Lecture d'un barème forfaitaire à seuils exclusifs. */
export const baremeInf = (table: [number, number][], montant: number) =>
  table.find(([seuil]) => montant < seuil)?.[1] ?? table[table.length - 1][1];

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
  const seuil = b.seuilExoneration ?? 0;
  const rubriques = b.rubriques ?? RUBRIQUES_DEFAUT;

  // 1. Salaire journalier, salaire de base, indemnité de congés.
  const journalier = salaireBrutRef / joursBase;
  const salaireBase = Math.round(journalier * s.joursTravailles);
  const indemniteConges = Math.round(journalier * (s.congesPris || 0));
  const congesRestants = s.congesRestants ?? Math.max(0, (s.congesAcquis || 0) - (s.congesPris || 0));

  // 2. Gains — liste fixe (toujours présente, même à zéro) + lignes libres du registre.
  const primesRegistre = (extras.primes ?? []).map((p) => ({ libelle: p.libelle, montant: Math.round(p.montant) })).filter((p) => p.montant);
  const primesLibres = primesRegistre.reduce((t, p) => t + p.montant, 0);
  const autresRubriques = extras.rubriques ?? {};
  const primes = s.primesVariables + s.transport + s.primeAssiduite + s.indemniteLogement + primesLibres
    + Object.values(autresRubriques).reduce((t, m) => t + Math.round(m || 0), 0);
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
    ...Object.entries(autresRubriques)
      .filter(([, m]) => Math.round(m || 0))
      .map(([code, m]) => ({
        code,
        libelle: rubriques.find((r) => r.code === code)?.libelle ?? code,
        base: 0,
        gain: Math.round(m),
      })),
    ...primesRegistre.map((p) => ({ code: "PRIME", libelle: p.libelle, base: 0, gain: p.montant })),
  ];

  // 3. LES QUATRE ASSIETTES, calculées depuis le catalogue de rubriques daté.
  const montants: Record<string, number> = {
    "66111": salaireBase,
    "66112": s.heuresSup,
    "66116": s.anciennete,
    "6613": indemniteConges,
    "66121": s.transport,
    "66122": s.primeAssiduite,
    "6631": s.indemniteLogement,
    "66125": s.primesVariables,
    ...autresRubriques,
  };
  if (primesLibres) montants["PRIME"] = (montants["PRIME"] ?? 0) + primesLibres;

  const assiettes = calculerAssiettes(montants, rubriques, {
    plafondCnps: b.plafondCnps,
    atmpPlafonne: b.atmpPlafonne ?? true,              // historique : plafonné
    transportTaxable: b.transportTaxable ?? false,      // historique : transport détaxé
    codeTransport: "66121",
  });

  const mutuelle = pct(total1, s.mutuellePct);
  const brutTaxable = assiettes.taxable;
  const baseCnps = assiettes.cotisablePlafonne;

  // 4. Retenues SALARIALES — soumises au plancher d'exonération (62 000) et à l'exonération jeunes.
  const exonereSalarial = brutTaxable < seuil || extras.exonereJeune === true;
  const siDu = (montant: number) => (exonereSalarial ? 0 : montant);

  const cnpsSalarie = pct(baseCnps, b.tauxPvidSal); // la CNPS n'est PAS une retenue fiscale : pas de plancher
  const cfcSalarie = siDu(pct(brutTaxable, b.tauxCfcSal));

  // IRPP : (base taxable × (1 − abattement %) − CNPS salarié − abattement annuel ÷ 12), tranches annuelles.
  const baseIrppMensuelle = Math.max(0, brutTaxable * (1 - b.abattementIrppPct / 100) - cnpsSalarie - abattementAnnuel / 12);
  const tranchesAnnuelles = b.irppBrackets.map((t) => ({ jusqua: t.jusqua === null ? null : t.jusqua * 12, taux: t.taux }));
  const irpp = siDu(Math.round(computeIrpp(baseIrppMensuelle * 12, tranchesAnnuelles) / 12));
  const cac = pct(irpp, b.tauxCac);
  const tdl = tdlActif ? siDu(baremeInf(TDL_BAREME, salaireBase)) : 0;
  const rav = ravActif ? siDu(baremeInf(RAV_BAREME, brutTaxable)) : 0;

  // 5. Charges PATRONALES — aucun plancher : dès qu'un salaire est versé, l'employeur cotise.
  //    L'exonération « jeunes » de la LF 2026 ne couvre PAS les charges sociales CNPS.
  const baseCfcFne = b.cfcPatronalEtFneSurBrut ? assiettes.brut : brutTaxable;
  const tauxAtmp = b.groupeRisqueAtmp ? TAUX_ATMP[b.groupeRisqueAtmp] : b.tauxAtmp;
  const pf = pct(baseCnps, b.tauxPf);
  const pvidPat = pct(baseCnps, b.tauxPvidPat);
  const atmp = pct(assiettes.cotisableAtmp, tauxAtmp);
  const fne = extras.exonereJeune ? 0 : pct(baseCfcFne, b.tauxFne);
  const cfcPat = extras.exonereJeune ? 0 : pct(baseCfcFne, b.tauxCfcPat);
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
    patron("66413", "ATMP", assiettes.cotisableAtmp, tauxAtmp, atmp),
    retenue("44721", "IRPP", brutTaxable, 0, irpp),
    retenue("44722", "CAC", irpp, b.tauxCac, cac),
    retenue("44723", "TDL", salaireBase, 0, tdl),
    retenue("44724", "CFC SAL", brutTaxable, b.tauxCfcSal, cfcSalarie),
    patron("64131", "F.N.E.", baseCfcFne, b.tauxFne, fne),
    patron("64132", "CFC PAT", baseCfcFne, b.tauxCfcPat, cfcPat),
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
      irpp, cac, tdl, rav, cnpsSalarie, assiettes, exonereSalarial,
    },
  };
}

// Barème par défaut — CNPS / CGI, avec les corrections du lot R2 ACTIVÉES.
// Les versions déjà enregistrées dans la table `baremes` ne portent pas ces champs : elles
// conservent donc le comportement d'avant la correction, ce qui garde les mois passés rejouables.
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
  // --- Corrections du lot R2 ---
  transportTaxable: true,          // C1, tranché le 20/10/2026
  atmpPlafonne: false,             // C3 : la loi ne plafonne pas l'assiette AT/MP
  cfcPatronalEtFneSurBrut: true,   // C4
  seuilExoneration: 62000,         // C6, tranché le 20/10/2026
};

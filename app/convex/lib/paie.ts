// Moteur de paie PUR (aucune dépendance Convex) — testable isolément.
// Contexte Cameroun : CNPS (PVID), CFC, FNE, IRPP progressif, CAC. Montants en ENTIERS FCFA.
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
  abattementIrppPct: number;// % d'abattement forfaitaire avant IRPP
  tauxCac: number;          // % de l'IRPP
  irppBrackets: { jusqua: number | null; taux: number }[]; // base MENSUELLE
}

export interface SaisieMois {
  joursTravailles: number;
  joursBase: number;        // jours de référence (déf. 30)
  sanctions: number;
  primesVariables: number;
  transport: number;
  heuresSup: number;
  anciennete: number;
  mutuellePct: number;      // %
  dettesSoins: number;
  acompte: number;
}

// Lignes libres du registre "Primes & charges" (par employé et par mois).
export interface LigneLibre { libelle: string; montant: number; }
export interface Extras { primes?: LigneLibre[]; charges?: LigneLibre[]; }

export interface LigneGain { code: string; libelle: string; base: number; gain: number; }
export interface LigneCotisation { code: string; libelle: string; base: number; taux: number; retenue: number; chargePatronale: number; }

export interface Bulletin {
  brut: number;
  totalRetenues: number;      // retenues salariales (ce qui diminue le net)
  net: number;
  chargesPatronales: number;  // info employeur
  lignesGain: LigneGain[];
  cotisations: LigneCotisation[];
}

const pct = (montant: number, taux: number) => Math.round((montant * taux) / 100);

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

export function computeBulletin(salaireBrutRef: number, s: SaisieMois, bareme: Bareme, extras: Extras = {}): Bulletin {
  // 1. Salaire de base proratisé par les jours travaillés.
  const joursBase = s.joursBase || 30;
  const salaireBase = Math.round((salaireBrutRef * Math.min(s.joursTravailles, joursBase)) / joursBase);

  // 2. Gains (saisie mensuelle + registre des primes — soumises aux cotisations).
  const lignesGain: LigneGain[] = [
    { code: "66111", libelle: "Salaire du mois", base: salaireBase, gain: salaireBase },
  ];
  if (s.heuresSup) lignesGain.push({ code: "66112", libelle: "Heures supplémentaires", base: 0, gain: s.heuresSup });
  if (s.anciennete) lignesGain.push({ code: "66116", libelle: "Ancienneté", base: 0, gain: s.anciennete });
  if (s.primesVariables) lignesGain.push({ code: "66117", libelle: "Autres primes", base: 0, gain: s.primesVariables });
  if (s.transport) lignesGain.push({ code: "66121", libelle: "Prime de transport", base: 0, gain: s.transport });
  for (const p of extras.primes ?? []) {
    const m = Math.round(p.montant);
    if (m) lignesGain.push({ code: "PRIME", libelle: p.libelle, base: 0, gain: m });
  }

  const brut = lignesGain.reduce((t, l) => t + l.gain, 0);

  // 3. Cotisations
  const baseCnps = Math.min(brut, bareme.plafondCnps);

  // Salariales
  const pvidSal = pct(baseCnps, bareme.tauxPvidSal);
  const cfcSal = pct(brut, bareme.tauxCfcSal);

  // IRPP : abattement forfaitaire + retenue PVID déductible, puis barème progressif mensuel.
  const abattement = pct(brut, bareme.abattementIrppPct);
  const baseImposable = Math.max(0, brut - pvidSal - abattement);
  const irpp = computeIrpp(baseImposable, bareme.irppBrackets);
  const cac = pct(irpp, bareme.tauxCac);

  const mutuelle = pct(brut, s.mutuellePct);

  // Patronales (info employeur, hors net)
  const pf = pct(baseCnps, bareme.tauxPf);
  const pvidPat = pct(baseCnps, bareme.tauxPvidPat);
  const atmp = pct(baseCnps, bareme.tauxAtmp);
  const fne = pct(brut, bareme.tauxFne);
  const cfcPat = pct(brut, bareme.tauxCfcPat);

  const cotisations: LigneCotisation[] = [
    { code: "43131", libelle: "CNPS PVID (salarié)", base: baseCnps, taux: bareme.tauxPvidSal, retenue: pvidSal, chargePatronale: 0 },
    { code: "44724", libelle: "CFC (salarié)", base: brut, taux: bareme.tauxCfcSal, retenue: cfcSal, chargePatronale: 0 },
    { code: "44721", libelle: "IRPP", base: baseImposable, taux: 0, retenue: irpp, chargePatronale: 0 },
    { code: "44722", libelle: "CAC (sur IRPP)", base: irpp, taux: bareme.tauxCac, retenue: cac, chargePatronale: 0 },
    { code: "MUT", libelle: "Mutuelle", base: brut, taux: s.mutuellePct, retenue: mutuelle, chargePatronale: 0 },
    { code: "66411", libelle: "Prestations familiales", base: baseCnps, taux: bareme.tauxPf, retenue: 0, chargePatronale: pf },
    { code: "66412", libelle: "CNPS PVID (patronal)", base: baseCnps, taux: bareme.tauxPvidPat, retenue: 0, chargePatronale: pvidPat },
    { code: "66413", libelle: "ATMP", base: baseCnps, taux: bareme.tauxAtmp, retenue: 0, chargePatronale: atmp },
    { code: "64131", libelle: "FNE", base: brut, taux: bareme.tauxFne, retenue: 0, chargePatronale: fne },
    { code: "64132", libelle: "CFC (patronal)", base: brut, taux: bareme.tauxCfcPat, retenue: 0, chargePatronale: cfcPat },
  ];

  // 4. Retenues hors cotisations (listées sur le bulletin, déduites du net).
  const retenue = (code: string, libelle: string, montant: number) =>
    ({ code, libelle, base: montant, taux: 0, retenue: montant, chargePatronale: 0 });
  if (s.sanctions) cotisations.push(retenue("SANCTION", "Sanctions", s.sanctions));
  if (s.dettesSoins) cotisations.push(retenue("DETTE", "Dettes de soins", s.dettesSoins));
  if (s.acompte) cotisations.push(retenue("42121", "Acompte", s.acompte));
  let totalCharges = 0;
  for (const c of extras.charges ?? []) {
    const m = Math.round(c.montant);
    if (m) { cotisations.push(retenue("RETENUE", c.libelle, m)); totalCharges += m; }
  }

  const totalRetenues = pvidSal + cfcSal + irpp + cac + mutuelle + s.sanctions + s.dettesSoins + s.acompte + totalCharges;
  const chargesPatronales = pf + pvidPat + atmp + fne + cfcPat;
  const net = brut - totalRetenues;

  return { brut, totalRetenues, net, chargesPatronales, lignesGain, cotisations };
}

// Barème par défaut indicatif (Cameroun) — À VALIDER avec la source officielle avant production.
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
  // Tranches IRPP mensuelles indicatives (base imposable).
  irppBrackets: [
    { jusqua: 166667, taux: 10 },
    { jusqua: 250000, taux: 15 },
    { jusqua: 416667, taux: 25 },
    { jusqua: null, taux: 35 },
  ],
};

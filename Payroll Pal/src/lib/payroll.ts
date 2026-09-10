export type Societe = "SESAME" | "SOFINA" | "SGC";

export type Employe = {
  id: string;
  nom: string;
  fonction: string;
  adresse: string;
  niu: string;
  cnps: string;
  matricule: string;
  categorie: string;
  echelon: string;
  departement: string;
  section: string;
  dateEmbauche: string;
  salaireBrut: number; // salaire brut mensuel de référence
  joursTravailles: number;
  primesFixes: number;
  primeTransport: number;
  primeAssiduite: number;
  indemniteLogement: number;
  heuresSup: number;
  anciennete: number;
  congesJoursAcquis: number;
  congesJoursPris: number;
  sanctions: number;
  absences: number;
  dettesSoins: number;
  acompte: number;
  mutuellePct: number;
  societe: Societe;
  periodeDu: string;
  periodeAu: string;
  datePaiement: string;
  valide: boolean;
  valideLe: string;
  responsableRH: string;
  signatureRH: string;
};

const PLAFOND_CNPS = 750000;

const TDL_BAREME: [number, number][] = [
  [62000, 0],
  [75000, 250],
  [100000, 500],
  [125000, 750],
  [150000, 1000],
  [200000, 1250],
  [250000, 1500],
  [300000, 2000],
  [500000, 2250],
  [750000, 2500],
  [1000000, 2750],
  [1500000, 3000],
  [2000000, 4000],
  [Infinity, 4500],
];

const RAV_BAREME: [number, number][] = [
  [50000, 0],
  [100000, 750],
  [200000, 1950],
  [300000, 3250],
  [400000, 4550],
  [500000, 5850],
  [600000, 7150],
  [700000, 8450],
  [800000, 9750],
  [900000, 11050],
  [1000000, 12350],
  [Infinity, 13000],
];

const bareme = (table: [number, number][], montant: number) =>
  table.find(([max]) => montant <= max)?.[1] ?? 0;

const irppAnnuel = (baseAnnuelle: number) => {
  const b = Math.max(0, baseAnnuelle);
  const tranches: [number, number][] = [
    [2000000, 0.1],
    [3000000, 0.15],
    [5000000, 0.25],
    [Infinity, 0.35],
  ];
  let reste = b;
  let precedent = 0;
  let total = 0;
  for (const [plafond, taux] of tranches) {
    if (reste <= 0) break;
    const part = Math.min(b, plafond) - precedent;
    if (part > 0) total += part * taux;
    precedent = plafond;
    reste = b - precedent;
  }
  return total;
};

export type Taux = {
  plafondCnps: number;
  cnpsSalariePct: number;
  cfcSalariePct: number;
  abattementIrppAnnuel: number;
  cacPct: number;
  pfPct: number;
  pvidPatronalPct: number;
  atmpPct: number;
  fnePct: number;
  cfcPatronalPct: number;
  tdlActif: boolean;
  ravActif: boolean;
};

export const TAUX_DEFAUT: Taux = {
  plafondCnps: PLAFOND_CNPS,
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
};

export type Bulletin = ReturnType<typeof calculer>;

export function calculer(e: Employe, t: Taux = TAUX_DEFAUT) {
  const salaireJournalier = e.salaireBrut / 30;
  const salaireBase = Math.round(salaireJournalier * e.joursTravailles);
  const congesRestants = Math.max(0, e.congesJoursAcquis - e.congesJoursPris);
  const indemniteConges = Math.round(salaireJournalier * e.congesJoursPris);

  const primes =
    e.primesFixes + e.primeTransport + e.primeAssiduite + e.indemniteLogement;

  const total1 =
    salaireBase + primes + indemniteConges + e.heuresSup + e.anciennete;

  const mutuelle = Math.round((total1 * e.mutuellePct) / 100);

  // Base cotisable / imposable (transport exonéré)
  const brutTaxable = Math.max(0, total1 - e.primeTransport);
  const baseCnps = Math.min(brutTaxable, t.plafondCnps);

  const cnpsSalarie = Math.round((baseCnps * t.cnpsSalariePct) / 100);
  const cfcSalarie = Math.round((brutTaxable * t.cfcSalariePct) / 100);

  const baseIrppMensuelle = Math.max(
    0,
    brutTaxable * 0.7 - cnpsSalarie - t.abattementIrppAnnuel / 12,
  );
  const irpp = Math.round(irppAnnuel(baseIrppMensuelle * 12) / 12);
  const cac = Math.round((irpp * t.cacPct) / 100);
  const tdl = t.tdlActif ? bareme(TDL_BAREME, salaireBase) : 0;
  const rav = t.ravActif ? bareme(RAV_BAREME, brutTaxable) : 0;

  // Charges patronales
  const pf = Math.round((baseCnps * t.pfPct) / 100);
  const pvidPatronal = Math.round((baseCnps * t.pvidPatronalPct) / 100);
  const atmp = Math.round((baseCnps * t.atmpPct) / 100);
  const fne = Math.round((brutTaxable * t.fnePct) / 100);
  const cfcPatronal = Math.round((brutTaxable * t.cfcPatronalPct) / 100);
  const chargesPatronales = pf + pvidPatronal + atmp + fne + cfcPatronal;


  const retenuesFiscales = irpp + cac + tdl + rav + cfcSalarie;
  const totalRetenues = cnpsSalarie + retenuesFiscales;

  const acompteImpotsCnps = e.acompte + totalRetenues;

  const total2 =
    total1 -
    e.sanctions -
    e.absences -
    e.dettesSoins -
    acompteImpotsCnps -
    mutuelle;

  return {
    salaireJournalier: Math.round(salaireJournalier),
    salaireBase,
    primes,
    indemniteConges,
    congesRestants,
    total1,
    mutuelle,
    brutTaxable,
    baseCnps,
    cnpsSalarie,
    cfcSalarie,
    irpp,
    cac,
    tdl,
    rav,
    pf,
    pvidPatronal,
    atmp,
    fne,
    cfcPatronal,
    chargesPatronales,
    totalRetenues,
    acompteImpotsCnps,
    total2,
    netAPayer: Math.max(0, total2),
  };
}

export const fcfa = (n: number) =>
  n === 0 ? "-" : new Intl.NumberFormat("fr-FR").format(Math.round(n));

let compteurId = 0;
/** Identifiant stable, sans I/O global (compatible SSR Worker). */
export const genererId = () => `emp-${++compteurId}-${nom32()}`;
const nom32 = () => (compteurId * 2654435761 % 4294967296).toString(36);

export const nouvelEmploye = (
  nom: string,
  salaireBrut: number,
  fonction = "",
): Employe => ({
  id: genererId(),
  nom,
  fonction,
  adresse: "Douala, Cameroun",
  niu: "",
  cnps: "",
  matricule: "",
  categorie: "",
  echelon: "",
  departement: "",
  section: "",
  dateEmbauche: "01/08/2025",
  salaireBrut,
  joursTravailles: 30,
  primesFixes: 0,
  primeTransport: 0,
  primeAssiduite: 0,
  indemniteLogement: 0,
  heuresSup: 0,
  anciennete: 0,
  congesJoursAcquis: 0,
  congesJoursPris: 0,
  sanctions: 0,
  absences: 0,
  dettesSoins: 0,
  acompte: 0,
  mutuellePct: 0,
  societe: "SGC",
  periodeDu: "01/12/2025",
  periodeAu: "31/12/2025",
  datePaiement: "05/01/2026",
  valide: false,
  valideLe: "",
  responsableRH: "NGUEMA Adèle",
  signatureRH: "",
});

export const SEED: Employe[] = [
  {
    ...nouvelEmploye("TARGNE JEAN BEAU", 150000, "AGENT COMMERCIAL"),
    niu: "M072517858332C",
    cnps: "351-1213677-6",
    matricule: "EMP-001",
    departement: "COMMERCIAL",
    joursTravailles: 30,
    primeTransport: 15000,
    societe: "SGC",
    congesJoursAcquis: 9,
  },
  {
    ...nouvelEmploye("PROSPERE ANTOINE", 1300000, "DIRECTEUR GENERAL"),
    niu: "M072517858333D",
    cnps: "351-1213677-7",
    matricule: "EMP-002",
    departement: "DIRECTION GENERALE",
    primeTransport: 30000,
    indemniteLogement: 50000,
    societe: "SGC",
    congesJoursAcquis: 12,
  },
  {
    ...nouvelEmploye("INOUSSA CHARLES", 1110000, "CHEF DE PROJET"),
    niu: "M072517858334E",
    cnps: "351-1213677-8",
    matricule: "EMP-003",
    departement: "TECHNIQUE",
    primeTransport: 25000,
    societe: "SOFINA",
    congesJoursAcquis: 6,
  },
  {
    ...nouvelEmploye("EBOCOLO JOSEPH", 236000, "TECHNICIEN EXTERNE"),
    niu: "M072517858335F",
    cnps: "351-1213677-9",
    matricule: "EMP-004",
    departement: "TECHNIQUE",
    primeTransport: 15000,
    societe: "SESAME",
    congesJoursAcquis: 4,
  },
];

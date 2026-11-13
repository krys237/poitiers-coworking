// DIPE — Document d'Information sur le Personnel Employé. Logique PURE (lot R3).
//
// C'est l'état mensuel destiné aux impôts et à la CNPS, dû **avant le 15 du mois suivant**.
// À ne pas confondre avec le bulletin de paie : décision E7 du 20/10/2026, « le bulletin présenté
// aux impôts ne doit pas porter d'autres retenues ». Le net du DIPE ne déduit donc que les
// retenues fiscales et sociales — ni acompte, ni sanction, ni dette de soins, ni mutuelle.
// Les deux « nets » sont légitimement différents et ne doivent jamais être confondus.
//
// Trois défauts de son classeur ne sont PAS reproduits ici :
//   · sa colonne « Total des Retenues Fiscales (IMPOTS) » additionnait les retenues du SALARIÉ
//     et les charges de l'EMPLOYEUR — le total n'avait pas de signification comptable ;
//   · ses « Charges Patronales » utilisaient la PVID salariale et oubliaient les prestations
//     familiales et l'AT/MP, donc sous-évaluaient fortement le coût employeur ;
//   · ses totaux de récapitulatif retranchaient « −1 » en dur pour faire tomber un arrondi.

import type { Assiettes, Rubrique } from "./rubriques.ts";

export interface SourceBulletin {
  /** Clé du couple (employé, société) : un pluri-employé a une ligne par DÉCLARANT. */
  cle: string;
  matricule: string;
  matriculeCnps?: string;
  nom: string;
  societe: string;
  joursTravailles: number;
  /** Montant par code de rubrique de gain. */
  gains: Record<string, number>;
  assiettes: Assiettes;
  irpp: number;
  cac: number;
  cfcSalarie: number;
  cfcPatronal: number;
  tdl: number;
  fne: number;
  rav: number;
  pvidSalarie: number;
  pvidPatronal: number;
  prestationsFamiliales: number;
  atmp: number;
}

export interface LigneDipe {
  no: number;
  cle: string;
  matricule: string;
  matriculeCnps: string;
  nom: string;
  societe: string;
  joursTravailles: number;
  gains: Record<string, number>;
  // Les quatre assiettes, dans l'ordre de ses colonnes V, W, X, Y, Z, AA.
  salaireBrut: number;
  salaireBrutIntermediaire: number;
  evaluationAvantages: number;
  avantagesRetenus: number;
  salaireTaxable: number;
  salaireCotisablePlafonne: number;
  // Impôts et taxes
  irpp: number;
  cac: number;
  totalIrpp: number;
  cfcSalarie: number;
  tdl: number;
  rav: number;
  /** IRPP + CAC + CFC salarial + TDL + RAV — retenues FISCALES du salarié, sans mélange. */
  totalFiscalSalarial: number;
  // Cotisations sociales
  pvidSalarie: number;
  /** Total retenu au salarié : fiscal + PVID. */
  totalRetenuSalarie: number;
  /** Net du DIPE : brut − retenues fiscales et sociales SEULES (ni acompte, ni sanction…). */
  netDipe: number;
  // Employeur
  cfcPatronal: number;
  fne: number;
  pvidPatronal: number;
  prestationsFamiliales: number;
  atmp: number;
  /** CFC patronal + FNE — retenues FISCALES de l'employeur. */
  totalFiscalPatronal: number;
  /** PVID patronale + prestations familiales + AT/MP — cotisations SOCIALES de l'employeur. */
  totalSocialPatronal: number;
  /** Coût total employeur = brut + toutes ses charges. */
  coutEmployeur: number;
}

export function ligneDipe(src: SourceBulletin, no: number): LigneDipe {
  const a = src.assiettes;
  const totalIrpp = src.irpp + src.cac;
  const totalFiscalSalarial = totalIrpp + src.cfcSalarie + src.tdl + src.rav;
  const totalRetenuSalarie = totalFiscalSalarial + src.pvidSalarie;
  const totalFiscalPatronal = src.cfcPatronal + src.fne;
  const totalSocialPatronal = src.pvidPatronal + src.prestationsFamiliales + src.atmp;

  return {
    no,
    cle: src.cle,
    matricule: src.matricule,
    matriculeCnps: src.matriculeCnps ?? "",
    nom: src.nom,
    societe: src.societe,
    joursTravailles: src.joursTravailles,
    gains: src.gains,
    salaireBrut: a.brut,
    salaireBrutIntermediaire: a.brutIntermediaire,
    evaluationAvantages: a.avantagesEvalues,
    avantagesRetenus: a.avantagesRetenus,
    salaireTaxable: a.taxable,
    salaireCotisablePlafonne: a.cotisablePlafonne,
    irpp: src.irpp,
    cac: src.cac,
    totalIrpp,
    cfcSalarie: src.cfcSalarie,
    tdl: src.tdl,
    rav: src.rav,
    totalFiscalSalarial,
    pvidSalarie: src.pvidSalarie,
    totalRetenuSalarie,
    netDipe: a.brut - totalRetenuSalarie,
    cfcPatronal: src.cfcPatronal,
    fne: src.fne,
    pvidPatronal: src.pvidPatronal,
    prestationsFamiliales: src.prestationsFamiliales,
    atmp: src.atmp,
    totalFiscalPatronal,
    totalSocialPatronal,
    coutEmployeur: a.brut + totalFiscalPatronal + totalSocialPatronal,
  };
}

// ---------------------------------------------------------------------------
// Récapitulatif de bas de page — avec la séparation salarial / patronal
// ---------------------------------------------------------------------------

export interface RecapitulatifDipe {
  effectif: number;
  masseBrute: number;
  masseTaxable: number;
  masseCotisable: number;
  /** Ce que l'employeur doit RETENIR puis verser pour le compte du salarié. */
  retenuesSalariales: { libelle: string; montant: number }[];
  totalRetenuesSalariales: number;
  /** Ce que l'employeur doit en PROPRE. */
  chargesPatronales: { libelle: string; montant: number }[];
  totalChargesPatronales: number;
  /** Total à reverser aux impôts (DGI). */
  totalImpots: number;
  /** Total à reverser à la CNPS. */
  totalCnps: number;
  netAPayer: number;
  coutEmployeur: number;
}

const somme = <K extends keyof LigneDipe>(l: LigneDipe[], k: K) =>
  l.reduce((t, x) => t + (x[k] as number), 0);

export function recapitulatifDipe(lignes: LigneDipe[]): RecapitulatifDipe {
  const irpp = somme(lignes, "irpp");
  const cac = somme(lignes, "cac");
  const cfcSal = somme(lignes, "cfcSalarie");
  const tdl = somme(lignes, "tdl");
  const rav = somme(lignes, "rav");
  const pvidSal = somme(lignes, "pvidSalarie");
  const cfcPat = somme(lignes, "cfcPatronal");
  const fne = somme(lignes, "fne");
  const pvidPat = somme(lignes, "pvidPatronal");
  const pf = somme(lignes, "prestationsFamiliales");
  const atmp = somme(lignes, "atmp");

  const retenuesSalariales = [
    { libelle: "Impôt sur traitements et salaires (IRPP)", montant: irpp },
    { libelle: "Centimes additionnels communaux (CAC)", montant: cac },
    { libelle: "Crédit Foncier — part salariale", montant: cfcSal },
    { libelle: "Taxe de développement local (TDL)", montant: tdl },
    { libelle: "Redevance audiovisuelle (RAV)", montant: rav },
    { libelle: "CNPS — PVID part salariale", montant: pvidSal },
  ];
  const chargesPatronales = [
    { libelle: "Crédit Foncier — part patronale", montant: cfcPat },
    { libelle: "Fonds National de l'Emploi (FNE)", montant: fne },
    { libelle: "CNPS — PVID part patronale", montant: pvidPat },
    { libelle: "CNPS — Prestations familiales", montant: pf },
    { libelle: "CNPS — Accidents du travail / maladies professionnelles", montant: atmp },
  ];

  const totalRetenuesSalariales = retenuesSalariales.reduce((t, x) => t + x.montant, 0);
  const totalChargesPatronales = chargesPatronales.reduce((t, x) => t + x.montant, 0);

  return {
    effectif: lignes.length,
    masseBrute: somme(lignes, "salaireBrut"),
    masseTaxable: somme(lignes, "salaireTaxable"),
    masseCotisable: somme(lignes, "salaireCotisablePlafonne"),
    retenuesSalariales,
    totalRetenuesSalariales,
    chargesPatronales,
    totalChargesPatronales,
    // Les deux destinataires sont distincts : on ne les additionne jamais.
    totalImpots: irpp + cac + cfcSal + tdl + rav + cfcPat + fne,
    totalCnps: pvidSal + pvidPat + pf + atmp,
    netAPayer: somme(lignes, "netDipe"),
    coutEmployeur: somme(lignes, "coutEmployeur"),
  };
}

// ---------------------------------------------------------------------------
// Un DIPE PAR DÉCLARANT (lot R2 bis)
//
// « SESAME déclare de son côté » (20/10/2026) : chaque société dépose son propre DIPE, sous son
// propre NIU et son propre numéro CNPS, et n'y reprend QUE les rémunérations qu'elle a versées.
// On ne consolide donc jamais les trois états : les additionner n'aurait aucun destinataire.
// ---------------------------------------------------------------------------

/** Identité sous laquelle une société dépose sa déclaration. */
export interface Declarant {
  societe: string;
  raisonSociale: string;
  adresse: string;
  niu: string;
  numeroCnps: string;
  /** Faux si le NIU ou le numéro CNPS propres à cette société manquent encore (Paramètres). */
  complet: boolean;
  /** Vrai quand l'identité vient de l'entreprise globale, faute d'identité propre renseignée. */
  reprisDeLEntreprise: boolean;
}

/**
 * Identité déclarante d'une société : la sienne si elle est renseignée dans les paramètres, sinon
 * celle de l'entreprise — ce qui reproduit le comportement d'avant ce lot, en le signalant.
 */
export function declarantPourSociete(
  societe: string,
  propres: { societe: string; raisonSociale?: string; adresse?: string; niu?: string; numeroCnps?: string }[] | undefined,
  entreprise: { nom?: string; adresse?: string; niu?: string; numeroCnps?: string },
): Declarant {
  const p = (propres ?? []).find((x) => x.societe === societe);
  const niu = p?.niu?.trim() || "";
  const numeroCnps = p?.numeroCnps?.trim() || "";
  const reprisDeLEntreprise = !niu && !numeroCnps;
  return {
    societe,
    raisonSociale: p?.raisonSociale?.trim() || entreprise.nom || societe,
    adresse: p?.adresse?.trim() || entreprise.adresse || "",
    niu: niu || entreprise.niu || "",
    numeroCnps: numeroCnps || entreprise.numeroCnps || "",
    complet: !!(niu || entreprise.niu) && !!(numeroCnps || entreprise.numeroCnps),
    reprisDeLEntreprise,
  };
}

/**
 * Découpe l'état du mois en une déclaration PAR SOCIÉTÉ. Les numéros de ligne sont renumérotés
 * dans chaque déclaration : le DIPE déposé par SOFINA commence à 1, comme tout formulaire.
 */
export function grouperParSociete(lignes: LigneDipe[]): { societe: string; lignes: LigneDipe[]; recapitulatif: RecapitulatifDipe }[] {
  const par = new Map<string, LigneDipe[]>();
  for (const l of lignes) par.set(l.societe, [...(par.get(l.societe) ?? []), l]);
  return [...par.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([societe, siennes]) => {
      const renumerotees = siennes.map((l, i) => ({ ...l, no: i + 1 }));
      return { societe, lignes: renumerotees, recapitulatif: recapitulatifDipe(renumerotees) };
    });
}

// ---------------------------------------------------------------------------
// Export CSV
// ---------------------------------------------------------------------------

/** Colonnes fixes du DIPE, dans l'ordre de son classeur. */
export const COLONNES_FIXES: { cle: keyof LigneDipe; entete: string }[] = [
  { cle: "no", entete: "N°" },
  { cle: "matriculeCnps", entete: "Matricule CNPS" },
  { cle: "matricule", entete: "Matricule Entreprise" },
  { cle: "nom", entete: "Nom et prénoms" },
  { cle: "societe", entete: "Société" },
  { cle: "joursTravailles", entete: "Nbre jours" },
];

export const COLONNES_CALCULEES: { cle: keyof LigneDipe; entete: string }[] = [
  { cle: "salaireBrut", entete: "SALAIRE BRUT" },
  { cle: "salaireBrutIntermediaire", entete: "Salaire brut intermédiaire" },
  { cle: "evaluationAvantages", entete: "Évaluation AVN" },
  { cle: "avantagesRetenus", entete: "AVN à considérer" },
  { cle: "salaireTaxable", entete: "Salaire taxable" },
  { cle: "salaireCotisablePlafonne", entete: "Salaire cotisable plafonné" },
  { cle: "irpp", entete: "IRPP principal" },
  { cle: "cac", entete: "CAC/IRPP" },
  { cle: "totalIrpp", entete: "Total IRPP" },
  { cle: "cfcSalarie", entete: "CFC Sal" },
  { cle: "tdl", entete: "TDL" },
  { cle: "rav", entete: "RAV" },
  { cle: "totalFiscalSalarial", entete: "Total retenues fiscales SALARIALES" },
  { cle: "pvidSalarie", entete: "PVID Sal" },
  { cle: "totalRetenuSalarie", entete: "Total retenu au salarié" },
  { cle: "netDipe", entete: "NET À PAYER" },
  { cle: "cfcPatronal", entete: "CFC Pat" },
  { cle: "fne", entete: "FNE" },
  { cle: "totalFiscalPatronal", entete: "Total retenues fiscales PATRONALES" },
  { cle: "pvidPatronal", entete: "PVID Pat" },
  { cle: "prestationsFamiliales", entete: "Prestations familiales" },
  { cle: "atmp", entete: "AT/MP" },
  { cle: "totalSocialPatronal", entete: "Total cotisations sociales patronales" },
  { cle: "coutEmployeur", entete: "Coût total employeur" },
];

const csvCell = (v: unknown) => {
  const s = String(v ?? "");
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * Export CSV du DIPE. Les colonnes de gain sont dynamiques : elles suivent le catalogue de
 * rubriques daté, donc ajouter une prime n'exige aucune modification du code.
 */
export function exportCsvDipe(lignes: LigneDipe[], rubriques: Rubrique[]): string {
  const gains = rubriques
    .filter((r) => r.sens === "gain" && r.code !== "PRIME")
    .sort((a, b) => a.ordre - b.ordre);
  const entetes = [
    ...COLONNES_FIXES.map((c) => c.entete),
    ...gains.map((g) => g.libelle),
    ...COLONNES_CALCULEES.map((c) => c.entete),
  ];
  const corps = lignes.map((l) =>
    [
      ...COLONNES_FIXES.map((c) => l[c.cle]),
      ...gains.map((g) => l.gains[g.code] ?? 0),
      ...COLONNES_CALCULEES.map((c) => l[c.cle]),
    ].map(csvCell),
  );
  // Ligne de totaux : uniquement sur les colonnes numériques, et sur TOUTES les lignes
  // (son classeur démarrait certaines sommes à la ligne 67 et en oubliait une).
  const totaux = [
    "TOTAL",
    "",
    "",
    `${lignes.length} salarié(s)`,
    "",
    "",
    ...gains.map((g) => lignes.reduce((t, l) => t + (l.gains[g.code] ?? 0), 0)),
    ...COLONNES_CALCULEES.map((c) => somme(lignes, c.cle)),
  ].map(csvCell);

  return [entetes.map(csvCell).join(";"), ...corps.map((r) => r.join(";")), totaux.join(";")].join("\n");
}

// ---------------------------------------------------------------------------
// Rapport d'écart — le livrable qui fait accepter l'outil
// ---------------------------------------------------------------------------

export type CodeEcart =
  | "arrondi"
  | "assiette_transport"
  | "assiette_logement"
  | "assiette_cotisable"
  | "irpp_methode"
  | "tdl_plafond"
  | "rav_seuil"
  | "base_cfc_fne"
  | "atmp_plafond"
  | "plancher_62000"
  | "totaux_melanges"
  | "inexplique";

/** Explication typée de chaque écart : c'est ce qui transforme un désaccord en arbitrage. */
export const EXPLICATIONS: Record<CodeEcart, string> = {
  arrondi:
    "Écart d'arrondi : son tableur calcule en décimales, l'application arrondit à l'entier FCFA.",
  assiette_transport:
    "La prime de transport entre désormais dans l'assiette taxable (tranché le 20/10/2026) ; elle reste hors de l'assiette CNPS.",
  assiette_logement:
    "L'indemnité de logement est retenue au minimum entre le forfait de 15 % du salaire brut intermédiaire et le montant versé.",
  assiette_cotisable:
    "L'assiette CNPS exclut le transport et inclut le logement en entier : elle diffère par construction de l'assiette taxable.",
  irpp_methode:
    "Son tableur applique une linéarisation mensuelle à seuils figés (310 000 / 429 000 / 667 000) qui sur-impose de 4 à 8 % au-delà de 310 000. L'application applique le barème annuel exact de l'art. 69 du CGI.",
  tdl_plafond:
    "La TDL est plafonnée à 2 500 FCFA par mois (loi de finances 2025) ; tout montant supérieur est erroné.",
  rav_seuil:
    "La RAV démarre à 62 000 FCFA de salaire taxable, conformément au plancher d'exonération retenu.",
  base_cfc_fne:
    "Le CFC patronal et le FNE sont assis sur le salaire BRUT, et non sur le salaire taxable.",
  atmp_plafond:
    "L'assiette AT/MP n'est pas plafonnée par la loi, contrairement à la PVID et aux prestations familiales (plafond 750 000).",
  plancher_62000:
    "Le plancher d'exonération de 62 000 FCFA ne vaut que pour les retenues salariales ; les charges patronales sont dues dès le premier franc de salaire.",
  totaux_melanges:
    "Sa colonne « Total des retenues fiscales » additionnait les retenues du salarié et les charges de l'employeur. L'application les sépare : les deux totaux n'ont pas le même destinataire.",
  inexplique:
    "Écart non expliqué par une règle connue : à examiner ligne à ligne avec la responsable RH.",
};

export interface Ecart {
  matricule: string;
  nom: string;
  colonne: string;
  nous: number;
  elle: number;
  difference: number;
  code: CodeEcart;
}

/** Colonnes comparables et la règle qui explique un écart sur chacune. */
const REGLE_PAR_COLONNE: { cle: keyof LigneDipe; entete: string; code: CodeEcart }[] = [
  { cle: "salaireBrut", entete: "SALAIRE BRUT", code: "inexplique" },
  { cle: "salaireBrutIntermediaire", entete: "Salaire brut intermédiaire", code: "assiette_transport" },
  { cle: "salaireTaxable", entete: "Salaire taxable", code: "assiette_transport" },
  { cle: "salaireCotisablePlafonne", entete: "Salaire cotisable plafonné", code: "assiette_cotisable" },
  { cle: "avantagesRetenus", entete: "AVN à considérer", code: "assiette_logement" },
  { cle: "irpp", entete: "IRPP principal", code: "irpp_methode" },
  { cle: "cac", entete: "CAC/IRPP", code: "irpp_methode" },
  { cle: "cfcSalarie", entete: "CFC Sal", code: "assiette_transport" },
  { cle: "tdl", entete: "TDL", code: "tdl_plafond" },
  { cle: "rav", entete: "RAV", code: "rav_seuil" },
  { cle: "cfcPatronal", entete: "CFC Pat", code: "base_cfc_fne" },
  { cle: "fne", entete: "FNE", code: "base_cfc_fne" },
  { cle: "pvidSalarie", entete: "PVID Sal", code: "assiette_cotisable" },
  { cle: "atmp", entete: "AT/MP", code: "atmp_plafond" },
  { cle: "netDipe", entete: "NET À PAYER", code: "inexplique" },
];

/**
 * Compare notre DIPE au sien, colonne par colonne, et TYPE chaque écart.
 * `sien` est indexé par matricule ; une valeur absente n'est pas comparée.
 * `tolerance` absorbe les arrondis (1 FCFA par défaut).
 */
export function comparerDipe(
  nos: LigneDipe[],
  sien: Record<string, Partial<Record<keyof LigneDipe, number>>>,
  tolerance = 1,
): { ecarts: Ecart[]; parCode: Record<string, number>; absents: string[]; compares: number } {
  const ecarts: Ecart[] = [];
  const absents: string[] = [];
  let compares = 0;

  for (const l of nos) {
    const s = sien[l.matricule];
    if (!s) {
      absents.push(l.matricule);
      continue;
    }
    compares++;
    for (const { cle, entete, code } of REGLE_PAR_COLONNE) {
      const elle = s[cle];
      if (elle === undefined || elle === null || Number.isNaN(elle)) continue;
      const nous = l[cle] as number;
      const difference = nous - elle;
      if (Math.abs(difference) <= tolerance) continue;
      ecarts.push({
        matricule: l.matricule,
        nom: l.nom,
        colonne: entete,
        nous,
        elle,
        difference,
        // Un écart qui ne dépasse pas le double de la tolérance reste un arrondi.
        code: Math.abs(difference) <= tolerance * 2 ? "arrondi" : code,
      });
    }
  }

  const parCode: Record<string, number> = {};
  for (const e of ecarts) parCode[e.code] = (parCode[e.code] ?? 0) + 1;

  return {
    ecarts: ecarts.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference)),
    parCode,
    absents,
    compares,
  };
}

/** Correspondance entre les en-têtes de son classeur et nos clés, pour l'import du comparatif. */
export const ENTETES_RECONNUES: Record<string, keyof LigneDipe> = {
  matricule_entreprise: "matricule",
  matricule_cnps: "matriculeCnps",
  salaire_brute: "salaireBrut",
  salaire_brut: "salaireBrut",
  salaire_de_reference: "salaireBrutIntermediaire",
  salaire_brut_intermediaire: "salaireBrutIntermediaire",
  "logement_a_considerer": "avantagesRetenus",
  salaire_taxable: "salaireTaxable",
  salaire_cotisable_plafonne: "salaireCotisablePlafonne",
  irpp_principal: "irpp",
  "cac/irpp": "cac",
  cac: "cac",
  total_irpp: "totalIrpp",
  cfc_sal: "cfcSalarie",
  cfc_pat: "cfcPatronal",
  tdl: "tdl",
  fne: "fne",
  rav: "rav",
  pvid_sal: "pvidSalarie",
  pvid_pat: "pvidPatronal",
  net_a_payer: "netDipe",
  atmp: "atmp",
};

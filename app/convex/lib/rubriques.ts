// Rubriques de paie et ASSIETTES — logique PURE (lot R2).
//
// C'est la pièce qui manquait au moteur. La responsable RH parlait « d'une donnée appelée
// l'assiette » : il n'y en a pas une, il y en a QUATRE, et toute l'automatisation consiste à
// déclarer, pour chaque rubrique de paie, à laquelle de ces quatre elle appartient.
// Les quatre sont reprises telles quelles de son DIPE (colonnes V, W, Z, AA) :
//
//   V — Salaire brut .................. somme de TOUTES les rubriques de gain
//                                       → base du CFC patronal et du FNE
//   W — Salaire brut intermédiaire .... les éléments ENTIÈREMENT taxables (son vocabulaire)
//                                       → sert à évaluer les avantages en nature
//   Z — Salaire taxable ............... W + avantages en nature retenus
//                                       → base de l'IRPP, du CFC salarial et de la RAV
//   AA — Salaire cotisable plafonné ... éléments cotisables, plafonnés
//                                       → base CNPS (PVID, prestations familiales, AT/MP)
//
// Les deux lignes qui expliquent tout :
//   · le TRANSPORT est taxable mais NON cotisable (arrêtés n°003/MTPS/DPS et n°94/MINFI du
//     01/03/1974 — tranché le 20/10/2026 : « oui le transport est taxable ») ;
//   · le LOGEMENT est cotisable en entier mais taxable seulement à hauteur du forfait de 15 %.
//
// ⚠️ Cette table est DATÉE comme le barème (décision E4 du 20/10/2026 : « ajout au niveau du
// barème »). Un bulletin résout la version de rubrique applicable à SA période, exactement comme
// il résout son barème — on ne recalcule jamais un mois clôturé avec une définition d'assiette
// plus récente.

export interface AvantageNature {
  /** Taux forfaitaire d'évaluation, en % du salaire brut intermédiaire (logement 15 %, véhicule 10 %…). */
  tauxForfait: number;
  /**
   * Retenir le MINIMUM entre le forfait et le montant versé — c'est la règle appliquée par la RH
   * (`Y = IF(X < J ; X ; J)` dans son DIPE). À `false`, l'indemnité est taxée en entier.
   * Voir A-VERIFIER B3 : défendable pour un avantage en nature, discutable pour une indemnité
   * versée en espèces.
   */
  plafonnerAuForfait: boolean;
}

export interface Rubrique {
  code: string;
  libelle: string;
  sens: "gain" | "retenue";
  ordre: number;
  /** V — entre dans le salaire brut. */
  dansBrut: boolean;
  /** W — élément entièrement taxable (« salaire brut intermédiaire »). */
  dansBrutIntermediaire: boolean;
  /** AA — entre dans l'assiette CNPS. */
  dansCotisable: boolean;
  /** Entre dans l'assiette de l'allocation de congé (art. 73 du Code du travail). */
  dansAllocConge: boolean;
  /** Suit les jours travaillés : montant ÷ joursBase × joursTravaillés. */
  proratisable: boolean;
  /** Si renseigné, la rubrique est un avantage en nature évalué au forfait. */
  avantageNature?: AvantageNature;
}

/**
 * Le catalogue par défaut, reconstitué **intégralement** à partir des formules de son DIPE
 * d'août 2026. Les codes reprennent ceux déjà utilisés par le bulletin quand ils existent
 * (66111, 66112, 66116, 6613, 66121, 66122, 6631, 66125) ; les autres suivent la même logique
 * de plan comptable et sont conventionnels.
 *
 * Les primes de salissure, panier, lait, représentation, outillage et usage de véhicule sont dans
 * le brut mais dans AUCUNE autre assiette : elles sont traitées en **remboursement de frais
 * professionnels**. C'est sa lecture, défendable mais à confirmer (A-VERIFIER B4).
 */
export const RUBRIQUES_DEFAUT: Rubrique[] = [
  // code,                libellé,                         ordre  brut    W      cotis. alloc. prorat.
  r("66111", "Salaire du mois", 10, true, true, true, true, true),
  r("66112", "Forfait heures supplémentaires", 20, true, true, true, true, false),
  r("66116", "Prime d'ancienneté", 30, true, true, true, true, false),
  // Second élément d'ancienneté (colonne distincte du récapitulatif, demande du 21/10/2026) :
  // même nature fiscale et sociale que la prime d'ancienneté.
  r("66117", "Ancienneté (colonne distincte)", 35, true, true, true, true, false),
  r("6613", "Congés payés", 40, true, true, true, false, false),
  r("66121", "Prime de transport", 50, true, true, /* cotisable */ false, false, true),
  r("66122", "Prime d'assiduité", 60, true, true, true, true, true),
  r("66123", "Prime de caisse", 70, true, true, true, true, false),
  r("66124", "Prime de rendement", 80, true, true, true, true, false),
  r("66118", "Gratification annuelle", 90, true, true, true, false, false),
  r("66125", "Primes fixes", 100, true, true, true, true, false),
  // Indemnité de logement : hors W, mais cotisable en entier et taxable via le forfait de 15 %.
  {
    ...r("6631", "Indemnité de logement", 110, true, false, true, false, true),
    avantageNature: { tauxForfait: 15, plafonnerAuForfait: true },
  },
  // Remboursements de frais : dans le brut seulement.
  r("6632", "Prime de salissure", 120, true, false, false, false, true),
  r("6633", "Prime de panier", 130, true, false, false, false, true),
  r("6634", "Prime de lait", 140, true, false, false, false, true),
  r("6635", "Indemnité de représentation", 150, true, false, false, false, false),
  r("6636", "Indemnité d'usage de motocyclette / véhicule", 160, true, false, false, false, false),
  r("6637", "Indemnité d'outillage", 170, true, false, false, false, false),
  // Lignes libres du registre « Primes & charges » : assimilées à une prime pleinement soumise.
  r("PRIME", "Prime (ligne libre)", 900, true, true, true, true, false),
];

function r(
  code: string,
  libelle: string,
  ordre: number,
  dansBrut: boolean,
  dansBrutIntermediaire: boolean,
  dansCotisable: boolean,
  dansAllocConge: boolean,
  proratisable: boolean,
): Rubrique {
  return {
    code,
    libelle,
    sens: "gain",
    ordre,
    dansBrut,
    dansBrutIntermediaire,
    dansCotisable,
    dansAllocConge,
    proratisable,
  };
}

export const rubriqueParCode = (rubriques: Rubrique[] = RUBRIQUES_DEFAUT) =>
  new Map(rubriques.map((x) => [x.code, x]));

/** Résout la version de catalogue applicable à une période « YYYY-MM » (comme le barème). */
export function rubriquesApplicables<T extends { effectiveFrom: string; rubriques: Rubrique[] }>(
  versions: T[],
  periode: string,
): Rubrique[] {
  const fin = `${periode}-31`;
  const candidates = versions.filter((v) => v.effectiveFrom <= fin);
  if (!candidates.length) return RUBRIQUES_DEFAUT;
  candidates.sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  return candidates[0].rubriques;
}

// ---------------------------------------------------------------------------
// Calcul des assiettes
// ---------------------------------------------------------------------------

export interface Assiettes {
  /** V — salaire brut : toutes les rubriques de gain. */
  brut: number;
  /** W — salaire brut intermédiaire : les éléments entièrement taxables. */
  brutIntermediaire: number;
  /** Évaluation forfaitaire des avantages en nature (avant plafonnement). */
  avantagesEvalues: number;
  /** Montant d'avantage en nature effectivement retenu dans l'assiette taxable. */
  avantagesRetenus: number;
  /** Z — salaire taxable : base IRPP, CFC salarial, RAV. */
  taxable: number;
  /** Assiette CNPS avant plafond. */
  cotisable: number;
  /** AA — assiette CNPS plafonnée : PVID et prestations familiales. */
  cotisablePlafonne: number;
  /** Assiette AT/MP : la loi ne la plafonne pas (voir A-VERIFIER B6). */
  cotisableAtmp: number;
  /** Assiette de l'allocation de congé (art. 73). */
  allocConge: number;
  /** Détail par rubrique, pour l'écran d'audit des assiettes. */
  detail: { code: string; libelle: string; montant: number; brut: boolean; intermediaire: boolean; cotisable: boolean }[];
}

export interface OptionsAssiettes {
  plafondCnps: number;
  /** Plafonner aussi l'assiette AT/MP. La loi dit NON ; la pratique de la RH dit oui (B6). */
  atmpPlafonne?: boolean;
  /** `false` ramène le transport hors de l'assiette taxable (comportement historique du moteur). */
  transportTaxable?: boolean;
  /** Code de la rubrique « transport », pour la bascule ci-dessus. */
  codeTransport?: string;
}

const arrondi = (n: number) => Math.round(n);

/**
 * Calcule les quatre assiettes à partir des montants par rubrique.
 * `montants` est indexé par code de rubrique ; une rubrique absente du catalogue est ignorée
 * (et signalée par `inconnues`) plutôt que silencieusement versée dans le brut.
 */
export function calculerAssiettes(
  montants: Record<string, number>,
  rubriques: Rubrique[],
  o: OptionsAssiettes,
): Assiettes & { inconnues: string[] } {
  const parCode = rubriqueParCode(rubriques);
  const inconnues: string[] = [];
  const detail: Assiettes["detail"] = [];

  let brut = 0;
  let brutIntermediaire = 0;
  let cotisable = 0;
  let allocConge = 0;
  const avantages: { montant: number; avantage: AvantageNature }[] = [];

  for (const [code, brutMontant] of Object.entries(montants)) {
    const montant = arrondi(brutMontant || 0);
    if (!montant) continue;
    const def = parCode.get(code);
    if (!def) {
      inconnues.push(code);
      continue;
    }
    if (def.sens !== "gain") continue;

    if (def.dansBrut) brut += montant;
    if (def.dansBrutIntermediaire) brutIntermediaire += montant;
    if (def.dansCotisable) cotisable += montant;
    if (def.dansAllocConge) allocConge += montant;
    if (def.avantageNature) avantages.push({ montant, avantage: def.avantageNature });

    detail.push({
      code,
      libelle: def.libelle,
      montant,
      brut: def.dansBrut,
      intermediaire: def.dansBrutIntermediaire,
      cotisable: def.dansCotisable,
    });
  }

  // Avantages en nature : évalués en % du salaire brut intermédiaire (X = W × 15 % chez elle),
  // puis retenus au minimum entre le forfait et le montant versé si la règle le prévoit.
  let avantagesEvalues = 0;
  let avantagesRetenus = 0;
  for (const { montant, avantage } of avantages) {
    const forfait = arrondi((brutIntermediaire * avantage.tauxForfait) / 100);
    avantagesEvalues += forfait;
    avantagesRetenus += avantage.plafonnerAuForfait ? Math.min(forfait, montant) : montant;
  }

  let taxable = brutIntermediaire + avantagesRetenus;
  // Repli historique : avant la décision du 20/10/2026, le transport sortait de l'assiette
  // taxable. Les versions de barème antérieures conservent ce comportement, pour qu'un mois
  // rejoué avec son barème d'époque redonne exactement les mêmes chiffres.
  if (o.transportTaxable === false) {
    const t = arrondi(montants[o.codeTransport ?? "66121"] || 0);
    const def = parCode.get(o.codeTransport ?? "66121");
    if (t && def?.dansBrutIntermediaire) taxable = Math.max(0, taxable - t);
  }

  const cotisablePlafonne = Math.min(cotisable, o.plafondCnps);

  return {
    brut,
    brutIntermediaire,
    avantagesEvalues,
    avantagesRetenus,
    taxable,
    cotisable,
    cotisablePlafonne,
    // L'assiette AT/MP n'est pas plafonnée par la loi ; l'interrupteur existe pour la pratique.
    cotisableAtmp: o.atmpPlafonne ? cotisablePlafonne : cotisable,
    allocConge,
    detail: detail.sort((a, b) => (parCode.get(a.code)!.ordre - parCode.get(b.code)!.ordre)),
    inconnues,
  };
}

/** Contrôle de cohérence d'un catalogue, pour l'écran de paramétrage. */
export function validerRubriques(rubriques: Rubrique[]): string[] {
  const erreurs: string[] = [];
  const vus = new Set<string>();
  for (const x of rubriques) {
    if (!x.code.trim()) erreurs.push("Une rubrique sans code.");
    if (vus.has(x.code)) erreurs.push(`Code en double : ${x.code}.`);
    vus.add(x.code);
    if (!x.libelle.trim()) erreurs.push(`Rubrique ${x.code} : libellé obligatoire.`);
    // Une rubrique taxable ou cotisable qui ne serait pas dans le brut n'a pas de sens :
    // le brut est la somme de tous les gains.
    if (!x.dansBrut && (x.dansBrutIntermediaire || x.dansCotisable))
      erreurs.push(`Rubrique ${x.code} : hors du brut mais taxable ou cotisable — incohérent.`);
    if (x.avantageNature) {
      const t = x.avantageNature.tauxForfait;
      if (!(t > 0 && t <= 100)) erreurs.push(`Rubrique ${x.code} : taux forfaitaire hors de 0–100 %.`);
      if (x.dansBrutIntermediaire)
        erreurs.push(
          `Rubrique ${x.code} : un avantage en nature entre dans l'assiette taxable par son forfait, pas par le salaire brut intermédiaire.`,
        );
    }
  }
  return erreurs;
}

/**
 * Correspondance entre les champs de `saisiesMensuelles` et les codes de rubrique.
 * Les quatre premiers existaient déjà ; les neuf suivants sont les primes du DIPE ajoutées au
 * récapitulatif des salaires le 21/10/2026, à la demande de la responsable RH.
 */
export const CHAMP_SAISIE_VERS_RUBRIQUE: Record<string, string> = {
  primesVariables: "66125",
  ancienneteSeparee: "66117",
  transport: "66121",
  primeAssiduite: "66122",
  indemniteLogement: "6631",
  primeSalissure: "6632",
  primePanier: "6633",
  primeLait: "6634",
  indemniteRepresentation: "6635",
  indemniteVehicule: "6636",
  primeCaisse: "66123",
  primeRendement: "66124",
  indemniteOutillage: "6637",
  gratification: "66118",
};

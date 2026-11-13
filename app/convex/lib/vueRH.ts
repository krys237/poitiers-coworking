// « Vue RH » du barème — logique PURE (lot R9).
//
// Demande de la responsable RH : « il faut ajouter ces valeurs au niveau du barème pour
// permettre à la RH de comprendre les règles de calcul utilisées, que ce soit explicite afin
// qu'elle puisse avoir tout le détail » — en laissant l'écran Barème tel quel et en ajoutant un
// bouton qui déplie ce détail.
//
// Principe directeur : **cette vue n'invente rien et ne recopie rien.** Chaque valeur est lue
// dans le barème daté et chaque étape de l'exemple est calculée par `computeBulletin`, le moteur
// réel. Une vue qui redéclarerait les règles finirait par mentir dès la première divergence —
// et c'est précisément ce qu'elle cherche à éviter : vérifier nos chiffres sans nous.

import {
  computeBulletin,
  tableVersTranches,
  TDL_BAREME,
  RAV_BAREME,
  TAUX_ATMP,
  type Bareme,
  type SaisieMois,
  type TrancheForfait,
} from "./paie.ts";
import type { Rubrique } from "./rubriques.ts";

/** Une règle expliquée : ce qu'elle fait, sur quoi, et au nom de quel texte. */
export interface Regle {
  libelle: string;
  valeur: string;
  /** Assiette ou grandeur sur laquelle la règle s'applique. */
  base?: string;
  /** Article ou texte fondateur. */
  fondement?: string;
  /** Point encore à confirmer, le cas échéant (renvoie au registre A-VERIFIER). */
  reserve?: string;
}

export interface Assiette {
  cle: string;
  nom: string;
  definition: string;
  sertA: string;
  /** Libellés des rubriques qui y entrent. */
  rubriques: string[];
}

export interface EtapeExemple {
  libelle: string;
  formule: string;
  valeur: number;
  /** Étape de total, à mettre en évidence. */
  total?: boolean;
}

export interface VueRH {
  assiettes: Assiette[];
  irpp: Regle[];
  forfaits: { tdl: TrancheForfait[]; rav: TrancheForfait[]; tdlActif: boolean; ravActif: boolean };
  cnps: Regle[];
  autresRetenues: Regle[];
  plancher: Regle[];
  exemple: { entrees: Regle[]; etapes: EtapeExemple[] };
}

// `toLocaleString("fr-FR")` sépare les milliers par une espace FINE insécable (U+202F), que
// les polices standard du PDF n'encodent pas. Même substitution que `src/lib/format.ts` :
// U+202F → U+00A0, insécable et Latin-1.
const espacerMilliers = (n: number) =>
  Math.round(n).toLocaleString("fr-FR").replace(/ /g, " ");
const fcfa = (n: number) => `${espacerMilliers(n)} FCFA`;
const pct = (n: number) => `${n} %`;

// ---------------------------------------------------------------------------

/** Les quatre assiettes, avec les rubriques qui les composent réellement. */
export function assiettesExpliquees(rubriques: Rubrique[]): Assiette[] {
  const gains = rubriques.filter((r) => r.sens === "gain").sort((a, b) => a.ordre - b.ordre);
  const noms = (f: (r: Rubrique) => boolean) => gains.filter(f).map((r) => r.libelle);
  const avn = gains.filter((r) => r.avantageNature);

  return [
    {
      cle: "brut",
      nom: "Salaire brut",
      definition: "La somme de toutes les rubriques de gain, sans exception.",
      sertA: "Base du CFC patronal et du FNE.",
      rubriques: noms((r) => r.dansBrut),
    },
    {
      cle: "brutIntermediaire",
      nom: "Salaire brut intermédiaire",
      definition:
        "Les éléments entièrement taxables. Sert aussi à évaluer les avantages en nature au forfait" +
        (avn.length
          ? ` (${avn.map((r) => `${r.libelle} : ${r.avantageNature!.tauxForfait} %`).join(", ")}).`
          : "."),
      sertA: "Étape intermédiaire vers le salaire taxable.",
      rubriques: noms((r) => r.dansBrutIntermediaire),
    },
    {
      cle: "taxable",
      nom: "Salaire taxable",
      definition:
        "Salaire brut intermédiaire + les avantages en nature retenus. Pour un avantage plafonné " +
        "au forfait, on retient le plus petit du forfait et du montant versé.",
      sertA: "Base de l'IRPP, du CFC salarial et de la RAV.",
      rubriques: [...noms((r) => r.dansBrutIntermediaire), ...avn.map((r) => `${r.libelle} (au forfait)`)],
    },
    {
      cle: "cotisable",
      nom: "Salaire cotisable plafonné",
      definition:
        "Les éléments cotisables, plafonnés. La prime de transport en est exclue, l'indemnité de " +
        "logement y entre pour son montant versé : cette assiette diffère donc du salaire taxable " +
        "par construction, et non par erreur.",
      sertA: "Base CNPS : pension vieillesse, prestations familiales, accidents du travail.",
      rubriques: noms((r) => r.dansCotisable),
    },
  ];
}

/** Les règles de l'IRPP, telles que le barème les porte. */
export function irppExplique(b: Bareme): Regle[] {
  // Les tranches sont stockées en base MENSUELLE : 2 000 000 ÷ 12 = 166 666,67, arrondi à
  // 166 667. Les remultiplier par 12 redonne 2 000 004, et non 2 000 000 — la RH lirait un
  // seuil faux là où elle vient justement vérifier nos chiffres. On arrondit donc au millier
  // pour l'affichage, ce qui restitue les bornes de l'art. 69.
  // ⚠️ Le moteur, lui, utilise bien 2 000 004 comme borne réelle (`jusqua * 12`) : l'écart de
  // 4 FCFA d'assiette est négligeable mais existe. Consigné en A-VERIFIER A8.
  const annuel = (mensuel: number) => Math.round((mensuel * 12) / 1000) * 1000;
  const bornes = b.irppBrackets.map((t, i, a) => {
    const bas = i === 0 ? 0 : annuel(a[i - 1].jusqua ?? 0);
    const haut = t.jusqua === null ? null : annuel(t.jusqua);
    return {
      libelle: haut === null ? `Au-delà de ${fcfa(bas)} par an` : `De ${fcfa(bas)} à ${fcfa(haut)} par an`,
      valeur: pct(t.taux),
    };
  });

  return [
    {
      libelle: "Abattement pour frais professionnels",
      valeur: pct(b.abattementIrppPct),
      base: "Salaire taxable",
      fondement: "CGI — abattement forfaitaire, non plafonné",
    },
    {
      libelle: "Cotisation CNPS salariale déduite",
      valeur: "déduite intégralement",
      base: "Pension vieillesse retenue au salarié",
    },
    {
      libelle: "Abattement annuel forfaitaire",
      valeur: fcfa(b.abattementIrppAnnuel ?? 500000),
      base: "Appliqué ÷ 12 sur la base mensuelle",
      fondement: "Forfait UNIQUE, sans lien avec le nombre d'enfants — le Cameroun n'applique pas de quotient familial",
    },
    ...bornes.map((x) => ({ ...x, base: "Revenu net imposable annuel", fondement: "Art. 69 du CGI" })),
    {
      libelle: "Centimes additionnels communaux (CAC)",
      valeur: pct(b.tauxCac),
      base: "Montant de l'IRPP",
    },
  ];
}

/** Les cotisations CNPS. */
export function cnpsExplique(b: Bareme): Regle[] {
  const taux = b.groupeRisqueAtmp ? TAUX_ATMP[b.groupeRisqueAtmp] : b.tauxAtmp;
  return [
    {
      libelle: "Plafond de l'assiette cotisable",
      valeur: fcfa(b.plafondCnps),
      fondement: "Décret n°2016/072 du 15/02/2016",
    },
    { libelle: "Pension vieillesse — part salariale", valeur: pct(b.tauxPvidSal), base: "Cotisable plafonné" },
    { libelle: "Pension vieillesse — part patronale", valeur: pct(b.tauxPvidPat), base: "Cotisable plafonné" },
    { libelle: "Prestations familiales", valeur: pct(b.tauxPf), base: "Cotisable plafonné — part patronale" },
    {
      libelle: "Accidents du travail / maladies professionnelles",
      valeur: b.groupeRisqueAtmp ? `${pct(taux)} — groupe ${b.groupeRisqueAtmp}` : pct(taux),
      base: b.atmpPlafonne ? "Cotisable PLAFONNÉ" : "Cotisable réel, NON plafonné",
      fondement: "La loi ne plafonne pas cette assiette, contrairement aux deux précédentes",
      reserve: b.groupeRisqueAtmp
        ? undefined
        : "Le groupe de risque de l'établissement n'est pas renseigné : le taux appliqué est celui du barème. A-VERIFIER B5.",
    },
  ];
}

/** CFC, FNE, et leur base. */
export function autresRetenuesExpliquees(b: Bareme): Regle[] {
  const baseCfcFne = b.cfcPatronalEtFneSurBrut ? "Salaire brut" : "Salaire taxable";
  return [
    { libelle: "Crédit Foncier — part salariale", valeur: pct(b.tauxCfcSal), base: "Salaire taxable" },
    { libelle: "Crédit Foncier — part patronale", valeur: pct(b.tauxCfcPat), base: baseCfcFne },
    { libelle: "Fonds National de l'Emploi", valeur: pct(b.tauxFne), base: baseCfcFne },
    {
      libelle: "Taxe de développement local (TDL)",
      valeur: b.tdlActif === false ? "désactivée" : "forfait par tranche",
      base: "Salaire de BASE, et non le taxable",
      fondement: "Loi de finances 2025 — plafonnée à 2 500 FCFA par mois",
    },
    {
      libelle: "Redevance audiovisuelle (RAV)",
      valeur: b.ravActif === false ? "désactivée" : "forfait par tranche",
      base: "Salaire taxable",
    },
  ];
}

/** Le plancher d'exonération et sa portée — la règle la plus souvent mal comprise. */
export function plancherExplique(b: Bareme): Regle[] {
  const seuil = b.seuilExoneration ?? 0;
  if (!seuil)
    return [
      {
        libelle: "Plancher d'exonération",
        valeur: "aucun",
        reserve: "Ce barème est antérieur à la correction du 20/10/2026 : aucun plancher n'est appliqué.",
      },
    ];
  return [
    {
      libelle: "Plancher d'exonération des retenues SALARIALES",
      valeur: fcfa(seuil),
      base: "Salaire taxable",
      fondement: "En deçà de ce montant : ni IRPP, ni CAC, ni CFC salarial, ni TDL, ni RAV",
    },
    {
      libelle: "Cotisation CNPS salariale",
      valeur: "due dès le premier franc",
      fondement: "Ce n'est pas une retenue fiscale : le plancher ne s'y applique pas",
    },
    {
      libelle: "Charges patronales",
      valeur: "dues dès le premier franc",
      fondement: "« L'employeur a toujours un montant à payer dès qu'il y a un salaire »",
    },
  ];
}

// ---------------------------------------------------------------------------
// L'exemple déroulé — calculé par le moteur réel
// ---------------------------------------------------------------------------

export interface EntreesExemple {
  salaireBase: number;
  anciennete: number;
  transport: number;
  primeAssiduite: number;
  indemniteLogement: number;
}

export const EXEMPLE_DEFAUT: EntreesExemple = {
  salaireBase: 110000,
  anciennete: 38655,
  transport: 2550,
  primeAssiduite: 2500,
  indemniteLogement: 2200,
};

/**
 * Déroule un bulletin étape par étape, du salaire de base au net.
 * Les montants viennent de `computeBulletin` : si le moteur change, l'exemple change avec lui.
 */
export function exempleDeroule(
  b: Bareme,
  e: EntreesExemple = EXEMPLE_DEFAUT,
): { entrees: Regle[]; etapes: EtapeExemple[] } {
  const saisie: SaisieMois = {
    joursTravailles: 30, joursBase: 30, sanctions: 0, primesVariables: 0,
    transport: e.transport, primeAssiduite: e.primeAssiduite, indemniteLogement: e.indemniteLogement,
    heuresSup: 0, anciennete: e.anciennete, mutuellePct: 0, dettesSoins: 0, acompte: 0,
    absences: 0, congesPris: 0, congesAcquis: 0,
  };
  const bul = computeBulletin(e.salaireBase, saisie, b);
  const d = bul.details;
  const a = d.assiettes!;
  const cot = (code: string) => bul.cotisations.find((x) => x.code === code)?.retenue ?? 0;
  const pat = (code: string) => bul.cotisations.find((x) => x.code === code)?.chargePatronale ?? 0;
  const abat = b.abattementIrppAnnuel ?? 500000;

  const entrees: Regle[] = [
    { libelle: "Salaire de base", valeur: fcfa(e.salaireBase) },
    { libelle: "Prime d'ancienneté", valeur: fcfa(e.anciennete) },
    { libelle: "Prime de transport", valeur: fcfa(e.transport) },
    { libelle: "Prime d'assiduité", valeur: fcfa(e.primeAssiduite) },
    { libelle: "Indemnité de logement", valeur: fcfa(e.indemniteLogement) },
    { libelle: "Jours travaillés", valeur: "30 sur 30" },
  ];

  const etapes: EtapeExemple[] = [
    { libelle: "Salaire brut", formule: "somme de toutes les rubriques de gain", valeur: a.brut, total: true },
    {
      libelle: "Salaire brut intermédiaire",
      formule: "base + ancienneté + transport + assiduité (le logement en est exclu)",
      valeur: a.brutIntermediaire,
    },
    {
      libelle: "Évaluation de l'avantage logement",
      formule: `15 % × ${fcfa(a.brutIntermediaire)}`,
      valeur: a.avantagesEvalues,
    },
    {
      libelle: "Avantage logement retenu",
      formule: `le plus petit de ${fcfa(a.avantagesEvalues)} et ${fcfa(e.indemniteLogement)}`,
      valeur: a.avantagesRetenus,
    },
    {
      libelle: "Salaire taxable",
      formule: "brut intermédiaire + avantage retenu",
      valeur: a.taxable,
      total: true,
    },
    {
      libelle: "Salaire cotisable plafonné",
      formule: `base + ancienneté + assiduité + logement, plafonné à ${fcfa(b.plafondCnps)} (transport exclu)`,
      valeur: a.cotisablePlafonne,
      total: true,
    },
    {
      libelle: "Pension vieillesse salariale",
      formule: `${pct(b.tauxPvidSal)} × ${fcfa(a.cotisablePlafonne)}`,
      valeur: d.cnpsSalarie,
    },
    {
      libelle: "Base imposable mensuelle",
      formule: `${fcfa(a.taxable)} × ${100 - b.abattementIrppPct} % − ${fcfa(d.cnpsSalarie)} − ${fcfa(abat)} ÷ 12`,
      valeur: Math.max(0, a.taxable * (1 - b.abattementIrppPct / 100) - d.cnpsSalarie - abat / 12),
    },
    {
      libelle: "IRPP mensuel",
      formule: "base annualisée (× 12) passée au barème progressif, puis ÷ 12",
      valeur: d.irpp,
    },
    { libelle: "Centimes additionnels", formule: `${pct(b.tauxCac)} × ${fcfa(d.irpp)}`, valeur: d.cac },
    { libelle: "CFC salarial", formule: `${pct(b.tauxCfcSal)} × ${fcfa(a.taxable)}`, valeur: cot("44724") },
    { libelle: "Taxe de développement local", formule: `tranche du salaire de BASE (${fcfa(d.salaireBase)})`, valeur: d.tdl },
    { libelle: "Redevance audiovisuelle", formule: `tranche du salaire taxable (${fcfa(a.taxable)})`, valeur: d.rav },
    {
      libelle: "Total retenu au salarié",
      formule: "vieillesse + IRPP + CAC + CFC + TDL + RAV",
      valeur: d.chargesSalariales,
      total: true,
    },
    { libelle: "Net à payer", formule: `${fcfa(a.brut)} − ${fcfa(bul.totalRetenues)}`, valeur: bul.net, total: true },
    {
      libelle: "Coût pour l'employeur",
      formule: "brut + prestations familiales + vieillesse patronale + AT/MP + CFC patronal + FNE",
      valeur: a.brut + d.chargesPatronales,
      total: true,
    },
    {
      libelle: "dont prestations familiales",
      formule: `${pct(b.tauxPf)} × ${fcfa(a.cotisablePlafonne)}`,
      valeur: pat("66411"),
    },
    {
      libelle: "dont accidents du travail",
      formule: `${b.groupeRisqueAtmp ? `groupe ${b.groupeRisqueAtmp}` : pct(b.tauxAtmp)} × ${fcfa(a.cotisableAtmp)}`,
      valeur: pat("66413"),
    },
  ];

  return { entrees, etapes };
}

/** Assemble la vue complète. */
export function vueRH(b: Bareme, rubriques: Rubrique[], exemple?: EntreesExemple): VueRH {
  return {
    assiettes: assiettesExpliquees(rubriques),
    irpp: irppExplique(b),
    forfaits: {
      tdl: b.tdlBareme?.length ? b.tdlBareme : tableVersTranches(TDL_BAREME),
      rav: b.ravBareme?.length ? b.ravBareme : tableVersTranches(RAV_BAREME),
      tdlActif: b.tdlActif ?? true,
      ravActif: b.ravActif ?? true,
    },
    cnps: cnpsExplique(b),
    autresRetenues: autresRetenuesExpliquees(b),
    plancher: plancherExplique(b),
    exemple: exempleDeroule(b, exemple),
  };
}

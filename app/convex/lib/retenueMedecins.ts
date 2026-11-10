// Retenue à la source sur les honoraires des médecins — logique PURE (lot R6).
//
// Ce n'est PAS de la paie. Les médecins ne sont pas salariés de la clinique : elle leur reverse des
// honoraires et prélève à la source un impôt sur ces honoraires. Le module vit donc hors du moteur
// de paie, comme la RH l'avait demandé (A-VERIFIER E10), et ne touche ni au bulletin ni au DIPE.
//
// LA RÈGLE, telle qu'arbitrée le 05/11/2026
//
//   base    = 100 % du CA « assurance »  +  30 % du CA « espèces »
//   taux    = 5 % ou 10 % selon le médecin, décidé par la RH
//             + 10 % de centimes additionnels communaux  →  5,5 % ou 11 %
//   retenue = arrondi( base × taux )
//
// DEUX POINTS QUI ONT ÉTÉ TRANCHÉS, ET QUI NE SE DEVINENT PAS
//
//  • **M1 — le taux n'est PAS « tout compris ».** Il faut y ajouter les centimes additionnels
//    communaux de 10 %, comme pour l'IRPP des salariés. Un médecin « à 5 % » est donc prélevé à
//    5,5 %, et un médecin « à 10 % » à 11 %. C'est 10 % d'écart sur la recette, et c'est
//    exactement la question qui bloquait ce lot.
//
//  • **M2 — les 30 % sont une RÈGLE FIGÉE**, et non un abattement pour frais professionnels
//    susceptible d'évoluer. Ils sont donc une constante de ce module et non un paramètre du
//    barème daté. Si la Direction change d'avis, ce choix se renverse — mais il faut alors
//    décider ce qu'on fait des périodes déjà déclarées, et c'est précisément la décision que
//    « règle figée » évite d'avoir à prendre chaque mois.

/** Les deux taux possibles, avant centimes additionnels. La RH choisit par médecin. */
export const TAUX_BASE = [5, 10] as const;
export type TauxBase = typeof TAUX_BASE[number];

/** Centimes additionnels communaux, en % du taux — M1, tranché le 05/11/2026. */
export const CENTIMES_ADDITIONNELS_PCT = 10;

/** Part du CA « espèces » retenue dans la base — M2, règle FIGÉE. */
export const PART_ESPECES_PCT = 30;

export const estTauxBase = (x: unknown): x is TauxBase =>
  typeof x === "number" && (TAUX_BASE as readonly number[]).includes(x);

/**
 * Le taux réellement prélevé : le taux annoncé, majoré des centimes additionnels.
 * 5 % → 5,5 %  ·  10 % → 11 %.
 */
export const tauxEffectif = (tauxBase: number) =>
  Math.round(tauxBase * (1 + CENTIMES_ADDITIONNELS_PCT / 100) * 100) / 100;

export interface LigneSaisie {
  medecin: string;
  tauxBase: number;
  /** CA généré sur les patients ASSURÉS — retenu en entier. */
  caAssurance: number;
  /** CA généré sur les patients payant en ESPÈCES — retenu à 30 %. */
  caEspeces: number;
  notes?: string;
}

export interface LigneRetenue extends LigneSaisie {
  /** Part du CA espèces effectivement entrée dans la base. */
  partEspeces: number;
  base: number;
  taux: number;
  retenue: number;
  /** Ce que le médecin perçoit net de retenue, sur la base déclarée. */
  netDeRetenue: number;
  detail: string[];
}

const fmt = (n: number) => n.toLocaleString("fr-FR").replace(/ /g, " ");
const arr = (n: number) => Math.round(n || 0);
/** Un taux à la française : 5,5 et non 5.5. */
const pct = (n: number) => String(n).replace(".", ",");

/** Base de la retenue : tout l'assurance, 30 % des espèces. */
export function baseRetenue(caAssurance: number, caEspeces: number): number {
  return arr(arr(caAssurance) + (arr(caEspeces) * PART_ESPECES_PCT) / 100);
}

export function retenueMedecin(l: LigneSaisie): LigneRetenue {
  const caAssurance = arr(l.caAssurance);
  const caEspeces = arr(l.caEspeces);
  const partEspeces = arr((caEspeces * PART_ESPECES_PCT) / 100);
  const base = arr(caAssurance + partEspeces);
  const taux = tauxEffectif(l.tauxBase);
  const retenue = arr((base * taux) / 100);

  const detail = [
    `CA assurance : ${fmt(caAssurance)} FCFA, retenu en entier`,
    `CA espèces : ${fmt(caEspeces)} FCFA × ${PART_ESPECES_PCT} % = ${fmt(partEspeces)} FCFA`,
    `Base : ${fmt(caAssurance)} + ${fmt(partEspeces)} = ${fmt(base)} FCFA`,
    `Taux : ${l.tauxBase} % + ${CENTIMES_ADDITIONNELS_PCT} % de centimes additionnels = ${pct(taux)} %`,
    `Retenue : ${fmt(base)} × ${pct(taux)} % = ${fmt(retenue)} FCFA`,
  ];

  return {
    ...l, caAssurance, caEspeces, partEspeces, base, taux, retenue,
    netDeRetenue: arr(caAssurance + caEspeces) - retenue,
    detail,
  };
}

export interface Recapitulatif {
  medecins: number;
  caAssurance: number;
  caEspeces: number;
  base: number;
  retenue: number;
  /** Ventilation par taux de base, pour la déclaration. */
  parTaux: { tauxBase: number; taux: number; medecins: number; base: number; retenue: number }[];
  /** Lignes dont la saisie est incomplète ou douteuse. */
  anomalies: { medecin: string; motif: string }[];
}

export function recapitulatif(lignes: LigneSaisie[]): Recapitulatif {
  const calculees = lignes.map(retenueMedecin);
  const parTaux = new Map<number, { medecins: number; base: number; retenue: number }>();
  for (const l of calculees) {
    const e = parTaux.get(l.tauxBase) ?? { medecins: 0, base: 0, retenue: 0 };
    e.medecins++; e.base += l.base; e.retenue += l.retenue;
    parTaux.set(l.tauxBase, e);
  }

  const anomalies: { medecin: string; motif: string }[] = [];
  const vus = new Map<string, number>();
  for (const l of lignes) {
    const cle = l.medecin.trim().toLowerCase();
    vus.set(cle, (vus.get(cle) ?? 0) + 1);
    if (!l.medecin.trim()) anomalies.push({ medecin: "—", motif: "Nom du médecin manquant." });
    if (!estTauxBase(l.tauxBase))
      anomalies.push({ medecin: l.medecin, motif: `Taux ${l.tauxBase} % inattendu : 5 % ou 10 % attendus.` });
    if (arr(l.caAssurance) < 0 || arr(l.caEspeces) < 0)
      anomalies.push({ medecin: l.medecin, motif: "Chiffre d'affaires négatif." });
    if (!arr(l.caAssurance) && !arr(l.caEspeces))
      anomalies.push({ medecin: l.medecin, motif: "Aucun chiffre d'affaires : la retenue sera nulle." });
  }
  // Un médecin en double fausserait la déclaration sans qu'aucun total ne paraisse anormal.
  for (const [cle, n] of vus)
    if (n > 1 && cle)
      anomalies.push({ medecin: cle, motif: `${n} lignes pour le même médecin : à fusionner.` });

  return {
    medecins: calculees.length,
    caAssurance: calculees.reduce((t, l) => t + l.caAssurance, 0),
    caEspeces: calculees.reduce((t, l) => t + l.caEspeces, 0),
    base: calculees.reduce((t, l) => t + l.base, 0),
    retenue: calculees.reduce((t, l) => t + l.retenue, 0),
    parTaux: [...parTaux.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([tauxBase, e]) => ({ tauxBase, taux: tauxEffectif(tauxBase), ...e })),
    anomalies,
  };
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

const cellule = (v: string | number) => {
  const s = String(v ?? "");
  // Le séparateur du CSV est le point-virgule : un nom qui en contient un couperait la ligne.
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV de la déclaration, un médecin par ligne, séparateur point-virgule. */
export function exportCsv(periode: string, lignes: LigneSaisie[]): string {
  const calculees = lignes.map(retenueMedecin);
  const r = recapitulatif(lignes);
  const out = [
    ["Periode", "Medecin", "Taux de base (%)", "Taux applique (%)", "CA assurance", "CA especes",
      `Part especes (${PART_ESPECES_PCT}%)`, "Base", "Retenue", "Net de retenue"].join(";"),
    ...calculees.map((l) => [
      periode, cellule(l.medecin), l.tauxBase, l.taux, l.caAssurance, l.caEspeces,
      l.partEspeces, l.base, l.retenue, l.netDeRetenue,
    ].join(";")),
    ["", "TOTAL", "", "", r.caAssurance, r.caEspeces, r.base - r.caAssurance, r.base, r.retenue, ""].join(";"),
  ];
  return out.join("\n");
}

/**
 * Les explications affichées à côté de la déclaration, pour que la RH comprenne chaque chiffre
 * sans nous — même principe que les `EXPLICATIONS` du DIPE.
 */
export const EXPLICATIONS: { cle: string; titre: string; texte: string }[] = [
  {
    cle: "base",
    titre: "Pourquoi 30 % des espèces et 100 % de l'assurance",
    texte:
      "La retenue porte sur l'intégralité du chiffre d'affaires généré sur les patients assurés, " +
      "et sur 30 % seulement de celui généré sur les patients payant en espèces. C'est une règle " +
      "figée, arbitrée le 5 novembre 2026 : ce n'est pas un abattement pour frais que l'on " +
      "ajusterait d'un mois sur l'autre.",
  },
  {
    cle: "taux",
    titre: "Pourquoi 5,5 % et non 5 %",
    texte:
      "Le taux décidé par la RH — 5 % ou 10 % selon le médecin — n'est pas « tout compris ». Il " +
      "faut y ajouter les centimes additionnels communaux de 10 %, comme pour l'impôt sur le " +
      "revenu des salariés. Un médecin « à 5 % » est donc prélevé à 5,5 %, et un médecin " +
      "« à 10 % » à 11 %.",
  },
  {
    cle: "net",
    titre: "Ce que le médecin perçoit",
    texte:
      "La colonne « net de retenue » part du chiffre d'affaires DÉCLARÉ (assurance + espèces) et " +
      "en retire la retenue. Elle ne tient pas compte des rétrocessions de l'écran Primes " +
      "médecins, qui suivent une autre logique : c'est une indication, pas un ordre de paiement.",
  },
  {
    cle: "taux-par-medecin",
    titre: "Où se règle le taux d'un médecin",
    texte:
      "Le taux est porté par CHAQUE LIGNE, et pré-rempli d'après la dernière déclaration du même " +
      "médecin. Changer son taux n'altère donc jamais les périodes déjà déclarées : l'historique " +
      "reste exact, et une déclaration passée se relit telle qu'elle a été déposée.",
  },
];

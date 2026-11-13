// Catalogue des absences du Code du travail camerounais — logique PURE (lot R5).
//
// Chaque type d'absence porte les quatre informations dont la paie et le planning ont besoin :
//   · QUI PAIE (employeur, CNPS, personne) et à quel taux ;
//   · si la période compte comme SERVICE EFFECTIF, donc si elle acquiert du congé (art. 89) ;
//   · si elle est DÉDUCTIBLE du congé annuel ;
//   · son PLAFOND légal, et si ce plafond est annuel.
//
// Tout ce qui dépend de la convention collective sectorielle reste **paramétrable** : le catalogue
// ci-dessous est le PLANCHER légal, pas une vérité figée. Voir `docs/rh/REFERENTIEL-LEGAL-CAMEROUN.md`.

export type QuiPaie = "employeur" | "cnps" | "personne";

export interface TypeAbsenceLegal {
  cle: string;
  libelle: string;
  /** Article ou texte fondateur, affiché à l'écran pour justifier la règle. */
  base: string;
  quiPaie: QuiPaie;
  /** Taux de maintien de rémunération, en % du salaire de référence. */
  tauxRemuneration: number;
  /**
   * Taux dégressif par mois d'absence, quand il existe (chômage technique).
   * Prime sur `tauxRemuneration` et s'applique au rang du mois (1-indexé).
   */
  tauxDegressifs?: number[];
  /** La période compte comme service effectif → elle acquiert du congé (art. 89 al. 3). */
  serviceEffectif: boolean;
  /** Plafond de service effectif, en jours, au-delà duquel l'acquisition s'arrête. */
  plafondServiceEffectifJours?: number;
  /** S'impute sur le congé annuel du salarié. */
  deductibleDuCongeAnnuel: boolean;
  /** Durée maximale légale, en jours ouvrables. */
  plafondJours?: number;
  /** Le plafond se compte par année civile (et non par événement). */
  plafondAnnuel?: boolean;
  /** Entame les jours travaillés de la paie (donc réduit le salaire de base). */
  entameJoursTravailles: boolean;
  /** Justificatif exigé pour que l'absence soit opposable. */
  justificatif?: string;
}

const JOURS_PAR_MOIS = 30;

/**
 * Le catalogue légal. `conge_paye`, `absence`, `maladie` et `autre` conservent leurs clés
 * historiques : la table `absences` les contient déjà et aucune donnée ne doit être invalidée.
 */
export const TYPES_ABSENCE: TypeAbsenceLegal[] = [
  {
    cle: "conge_paye",
    libelle: "Congé payé",
    base: "art. 89 à 94 C. trav.",
    quiPaie: "employeur",
    tauxRemuneration: 100,
    serviceEffectif: true,
    deductibleDuCongeAnnuel: true,
    entameJoursTravailles: true,
    justificatif: "Ordre de départ en congé",
  },
  {
    cle: "maladie",
    libelle: "Maladie",
    base: "décret n°96/198 du 07/03/1996",
    quiPaie: "employeur",
    tauxRemuneration: 100,
    // Assimilée à du service effectif dans la limite de 6 mois (art. 89 al. 3).
    serviceEffectif: true,
    plafondServiceEffectifJours: 6 * JOURS_PAR_MOIS,
    deductibleDuCongeAnnuel: false,
    plafondJours: 6 * JOURS_PAR_MOIS,
    entameJoursTravailles: false,
    justificatif: "Certificat d'un médecin agréé ou d'un établissement reconnu",
  },
  {
    cle: "maternite",
    libelle: "Congé de maternité",
    base: "art. 84 C. trav. — 14 semaines, dont 4 avant l'accouchement",
    // L'indemnité journalière est versée par la CNPS à 100 % du salaire au moment de la
    // suspension, sous condition de 6 mois consécutifs de travail effectif.
    quiPaie: "cnps",
    tauxRemuneration: 100,
    serviceEffectif: true,
    deductibleDuCongeAnnuel: false,
    plafondJours: 14 * 7,
    entameJoursTravailles: false,
    justificatif: "Certificat de grossesse puis acte de naissance",
  },
  {
    cle: "accident_travail",
    libelle: "Accident du travail / maladie professionnelle",
    base: "loi n°77/11 du 13/07/1977 — indemnité journalière CNPS égale aux 2/3",
    quiPaie: "cnps",
    // 2/3 de la rémunération journalière moyenne.
    tauxRemuneration: 200 / 3,
    // Assimilé à du service effectif SANS limite de durée (art. 89 al. 3).
    serviceEffectif: true,
    deductibleDuCongeAnnuel: false,
    entameJoursTravailles: false,
    justificatif: "Déclaration à la CNPS dans les 3 jours ouvrables",
  },
  {
    cle: "evenement_familial",
    libelle: "Permission exceptionnelle (événement familial)",
    base: "décret n°75/29 et art. 89 al. 4 C. trav. — plafond 10 jours ouvrables par an",
    quiPaie: "employeur",
    tauxRemuneration: 100,
    serviceEffectif: true,
    // Non imputables sur le congé annuel dans la limite du plafond annuel.
    deductibleDuCongeAnnuel: false,
    plafondJours: 10,
    plafondAnnuel: true,
    entameJoursTravailles: false,
    justificatif: "Pièce d'état civil correspondant à l'événement",
  },
  {
    cle: "chomage_technique",
    libelle: "Chômage technique",
    base: "art. 32-k C. trav. et arrêté n°001/CAB/MTPS du 14/02/1995",
    quiPaie: "employeur",
    tauxRemuneration: 50,
    // Dégressif sur le salaire de base, mois par mois.
    tauxDegressifs: [50, 40, 35, 30, 25, 20],
    serviceEffectif: true,
    deductibleDuCongeAnnuel: false,
    plafondJours: 6 * JOURS_PAR_MOIS,
    entameJoursTravailles: false,
    justificatif: "Décision de mise en chômage technique, inspection du travail informée",
  },
  {
    cle: "mise_a_pied",
    libelle: "Mise à pied disciplinaire",
    base: "C. trav. — maximum 8 jours ouvrables, inspection informée sous 48 h",
    quiPaie: "personne",
    tauxRemuneration: 0,
    serviceEffectif: false,
    deductibleDuCongeAnnuel: false,
    plafondJours: 8,
    entameJoursTravailles: true,
    justificatif: "Notification écrite et motivée",
  },
  {
    cle: "sans_solde",
    libelle: "Congé sans solde",
    base: "Aucun droit légal général : purement conventionnel (hors art. 91)",
    quiPaie: "personne",
    tauxRemuneration: 0,
    serviceEffectif: false,
    deductibleDuCongeAnnuel: false,
    entameJoursTravailles: true,
    justificatif: "Accord écrit de l'employeur",
  },
  {
    cle: "formation_syndicale",
    libelle: "Congé de formation syndicale",
    base: "art. 91 C. trav. — non rémunéré, non imputable, 18 jours ouvrables assimilés",
    quiPaie: "personne",
    tauxRemuneration: 0,
    serviceEffectif: true,
    plafondServiceEffectifJours: 18,
    deductibleDuCongeAnnuel: false,
    entameJoursTravailles: true,
    justificatif: "Convocation de l'organisation syndicale",
  },
  {
    cle: "absence",
    libelle: "Absence non justifiée",
    base: "Retenue sur salaire ; abandon de poste après mise en demeure",
    quiPaie: "personne",
    tauxRemuneration: 0,
    serviceEffectif: false,
    deductibleDuCongeAnnuel: false,
    entameJoursTravailles: true,
  },
  {
    cle: "autre",
    libelle: "Autre",
    base: "À préciser dans le motif",
    quiPaie: "personne",
    tauxRemuneration: 0,
    serviceEffectif: false,
    deductibleDuCongeAnnuel: false,
    entameJoursTravailles: true,
  },
];

export const TYPE_ABSENCE = Object.fromEntries(TYPES_ABSENCE.map((t) => [t.cle, t])) as Record<
  string,
  TypeAbsenceLegal
>;
export const CLES_ABSENCE = TYPES_ABSENCE.map((t) => t.cle);

/** Les quatre clés historiques, qui doivent rester acceptées par le schéma. */
export const CLES_HISTORIQUES = ["conge_paye", "absence", "maladie", "autre"] as const;

// ---------------------------------------------------------------------------
// Barème des permissions exceptionnelles
// ---------------------------------------------------------------------------

/**
 * Plancher légal du décret n°75/29. Les conventions collectives l'ÉTENDENT fréquemment
 * (décès d'un frère, baptême…) : ce barème doit rester paramétrable par entreprise.
 */
export const EVENEMENTS_FAMILIAUX: { cle: string; libelle: string; jours: number }[] = [
  { cle: "mariage_travailleur", libelle: "Mariage du travailleur", jours: 3 },
  { cle: "deces_conjoint", libelle: "Décès du conjoint", jours: 3 },
  { cle: "deces_pere_mere", libelle: "Décès du père ou de la mère", jours: 3 },
  { cle: "naissance", libelle: "Accouchement de l'épouse", jours: 3 },
  { cle: "mariage_enfant", libelle: "Mariage d'un enfant", jours: 1 },
];

export const PLAFOND_EVENEMENTS_FAMILIAUX_AN = 10;

// ---------------------------------------------------------------------------
// Rémunération d'une absence
// ---------------------------------------------------------------------------

export interface RemunerationAbsence {
  /** Montant à la charge de l'EMPLOYEUR sur la période. */
  partEmployeur: number;
  /** Montant à la charge de la CNPS (information : l'employeur ne le verse pas). */
  partCnps: number;
  /** Retenue à opérer sur le salaire. */
  retenue: number;
  quiPaie: QuiPaie;
  taux: number;
  detail: string;
}

export interface OptionsRemuneration {
  /** Diviseur du salaire journalier. AUCUN n'est imposé par la loi : 30, 26 ou 24 (A-VERIFIER). */
  diviseurJournalier: number;
  /** Rang du mois d'absence, 1-indexé — utile au seul chômage technique. */
  rangMois?: number;
}

/**
 * Calcule la rémunération et la retenue d'une absence.
 * `salaireReference` est le salaire MENSUEL de référence (base + accessoires retenus).
 */
export function remunererAbsence(
  cle: string,
  jours: number,
  salaireReference: number,
  o: OptionsRemuneration,
): RemunerationAbsence {
  const t = TYPE_ABSENCE[cle];
  if (!t) throw new Error(`Type d'absence inconnu : ${cle}`);
  const journalier = salaireReference / (o.diviseurJournalier || 30);

  const taux = t.tauxDegressifs
    ? (t.tauxDegressifs[Math.min(Math.max((o.rangMois ?? 1) - 1, 0), t.tauxDegressifs.length - 1)] ??
       t.tauxRemuneration)
    : t.tauxRemuneration;

  const du = Math.round(journalier * jours * (taux / 100));
  const plein = Math.round(journalier * jours);

  return {
    partEmployeur: t.quiPaie === "employeur" ? du : 0,
    partCnps: t.quiPaie === "cnps" ? du : 0,
    retenue: plein - du,
    quiPaie: t.quiPaie,
    taux,
    detail:
      `${t.libelle} : ${jours} j × ${Math.round(journalier)} FCFA × ${taux} %` +
      (t.quiPaie === "cnps" ? " — pris en charge par la CNPS" : "") +
      (t.tauxDegressifs ? ` (mois ${o.rangMois ?? 1} du barème dégressif)` : ""),
  };
}

// ---------------------------------------------------------------------------
// Contrôles légaux
// ---------------------------------------------------------------------------

export interface Infraction {
  code: "plafond_depasse" | "plafond_annuel_depasse" | "justificatif_manquant" | "type_inconnu";
  message: string;
  /** Vrai si la règle vient de la loi ; faux si elle dépend de la convention collective. */
  legal: boolean;
}

/**
 * Vérifie une absence au regard des plafonds légaux.
 * `cumulAnneeJours` est le cumul DÉJÀ posé sur l'année pour ce type et cet employé,
 * hors absence en cours de saisie.
 */
export function controlerAbsence(args: {
  cle: string;
  jours: number;
  cumulAnneeJours?: number;
  justificatifFourni?: boolean;
}): Infraction[] {
  const t = TYPE_ABSENCE[args.cle];
  if (!t) return [{ code: "type_inconnu", message: `Type d'absence inconnu : ${args.cle}`, legal: true }];

  const out: Infraction[] = [];

  if (t.plafondJours !== undefined) {
    if (t.plafondAnnuel) {
      const cumul = (args.cumulAnneeJours ?? 0) + args.jours;
      if (cumul > t.plafondJours)
        out.push({
          code: "plafond_annuel_depasse",
          message:
            `${t.libelle} : ${cumul} jours sur l'année, pour un plafond légal de ${t.plafondJours} ` +
            `(${t.base}). Le surplus ne peut être imputé sur le congé annuel qu'à la demande du salarié.`,
          legal: true,
        });
    } else if (args.jours > t.plafondJours) {
      out.push({
        code: "plafond_depasse",
        message: `${t.libelle} : ${args.jours} jours demandés, plafond légal ${t.plafondJours} (${t.base}).`,
        legal: true,
      });
    }
  }

  if (t.justificatif && args.justificatifFourni === false)
    out.push({
      code: "justificatif_manquant",
      message: `${t.libelle} : justificatif attendu — ${t.justificatif}.`,
      legal: true,
    });

  return out;
}

/**
 * Jours de SERVICE EFFECTIF retenus pour l'acquisition du congé (art. 89 al. 3).
 * Les absences assimilées comptent, éventuellement dans la limite de leur plafond.
 */
export function joursServiceEffectif(
  absences: { cle: string; jours: number }[],
  joursTravaillesReels: number,
): { total: number; detail: { cle: string; retenus: number; ecartes: number }[] } {
  const detail: { cle: string; retenus: number; ecartes: number }[] = [];
  const cumulParCle = new Map<string, number>();
  let total = joursTravaillesReels;

  for (const a of absences) {
    const t = TYPE_ABSENCE[a.cle];
    if (!t?.serviceEffectif) {
      detail.push({ cle: a.cle, retenus: 0, ecartes: a.jours });
      continue;
    }
    const deja = cumulParCle.get(a.cle) ?? 0;
    const plafond = t.plafondServiceEffectifJours;
    const retenus = plafond === undefined ? a.jours : Math.max(0, Math.min(a.jours, plafond - deja));
    cumulParCle.set(a.cle, deja + retenus);
    total += retenus;
    detail.push({ cle: a.cle, retenus, ecartes: a.jours - retenus });
  }
  return { total, detail };
}

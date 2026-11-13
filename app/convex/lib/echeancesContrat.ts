// Échéances de contrat et rappels — logique PURE (demande N2).
//
// LA DEMANDE, du 05/11/2026
//
// « La durée max c'est 6 mois renouvelable une fois. Maintenant nous voulons un système d'alerte
//   et de rappel qui signale avant échéance. Le système de rappel doit être configurable ; par
//   défaut nous allons partir sur 1 rappel avant 1 mois, 1 rappel toutes les semaines du dernier
//   mois, et un rappel tous les jours de la dernière semaine. »
//
// POURQUOI CE N'EST PAS QU'UN COMPTE À REBOURS
//
// Un CDD qui arrive à terme sans décision se requalifie en CDI par l'écoulement du temps. L'enjeu
// du rappel n'est donc pas le confort : c'est d'empêcher qu'une inaction devienne un engagement.
// D'où la cadence qui s'accélère — mensuelle, puis hebdomadaire, puis quotidienne — et d'où le
// fait qu'un contrat ÉCHU continue d'alerter tous les jours, au lieu de disparaître de la liste.
//
// CE QUE CE MODULE NE FAIT PAS
//
// Il ne BLOQUE rien. Une durée hors plafond est signalée, jamais refusée : la RH peut avoir une
// raison que nous ne connaissons pas, et un formulaire qui refuse d'enregistrer la réalité pousse
// à la contourner. C'est aussi ce qu'elle a demandé — « un système d'alerte », pas un verrou.

export interface ReglesRappel {
  /** Un premier avis à ce nombre de jours de l'échéance. 30 = un mois. */
  premierAvisJours: number;
  /** En deçà de ce nombre de jours, un rappel par semaine. */
  hebdoDepuisJours: number;
  /** En deçà de ce nombre de jours, un rappel par jour. */
  quotidienDepuisJours: number;
}

export const REGLES_RAPPEL_DEFAUT: ReglesRappel = {
  premierAvisJours: 30,
  hebdoDepuisJours: 30,
  quotidienDepuisJours: 7,
};

/** Durée maximale d'un CDD et de son renouvellement, en mois (tranché le 05/11/2026, T3). */
export const CDD_MOIS_MAX = 6;
export const CDD_RENOUVELLEMENTS_MAX = 1;

export type Cadence = "aucune" | "ponctuelle" | "hebdomadaire" | "quotidienne" | "depassee";

export const LIBELLE_CADENCE: Record<Cadence, string> = {
  aucune: "Pas encore d'alerte",
  ponctuelle: "Premier avis",
  hebdomadaire: "Rappel hebdomadaire",
  quotidienne: "Rappel quotidien",
  depassee: "Échéance dépassée",
};

const AU_JOUR = 86400000;
const enJours = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / AU_JOUR;

/** Jours restants jusqu'à l'échéance. Négatif si elle est passée, 0 le jour même. */
export const joursRestants = (dateFin: string, aujourdhui: string) =>
  enJours(dateFin) - enJours(aujourdhui);

/**
 * La cadence applicable, d'après les jours restants.
 *
 * Elle ne dit pas si un rappel part AUJOURD'HUI — c'est `doitRappeler` qui le dit. Les deux sont
 * séparés parce que l'écran a besoin de la cadence en permanence (pour expliquer où en est le
 * contrat) alors que le rappel, lui, ne tombe que certains jours.
 */
export function cadence(restants: number, regles: ReglesRappel = REGLES_RAPPEL_DEFAUT): Cadence {
  if (restants < 0) return "depassee";
  if (restants <= regles.quotidienDepuisJours) return "quotidienne";
  if (restants <= regles.hebdoDepuisJours) return "hebdomadaire";
  if (restants <= regles.premierAvisJours) return "ponctuelle";
  return "aucune";
}

/**
 * Un rappel part-il aujourd'hui&nbsp;?
 *
 * Le premier avis tombe au jour exact de `premierAvisJours`, **indépendamment** de la cadence.
 * Sans cela, avec les valeurs par défaut (30 / 30 / 7), le premier rappel hebdomadaire n'arriverait
 * qu'à 28 jours : l'avis « un mois avant » qu'elle a demandé serait deux jours en retard.
 *
 * L'hebdomadaire s'ancre sur l'ÉCHÉANCE et non sur la date du jour : les rappels tombent à 28, 21
 * et 14 jours, toujours aux mêmes paliers, quel que soit le jour où l'on regarde.
 */
export function doitRappeler(
  restants: number,
  regles: ReglesRappel = REGLES_RAPPEL_DEFAUT,
): { rappel: boolean; cadence: Cadence; raison: string } {
  const c = cadence(restants, regles);
  // Le jour du premier avis est ÉTIQUETÉ « ponctuelle » même si la cadence hebdomadaire a déjà
  // commencé : afficher « rappel hebdomadaire » pour le tout premier message serait trompeur.
  if (restants === regles.premierAvisJours)
    return {
      rappel: true, cadence: "ponctuelle",
      raison: `Premier avis : ${restants} jours avant l'échéance.`,
    };
  switch (c) {
    case "depassee":
      return {
        rappel: true, cadence: c,
        raison: `Échéance dépassée de ${-restants} jour(s) : sans décision, le contrat se poursuit de fait.`,
      };
    case "quotidienne":
      return {
        rappel: true, cadence: c,
        raison: restants === 0
          ? "Dernier jour du contrat : la décision ne peut plus attendre."
          : `Plus que ${restants} jour(s) : rappel quotidien.`,
      };
    case "hebdomadaire":
      return {
        rappel: restants % 7 === 0, cadence: c,
        raison: restants % 7 === 0
          ? `${restants} jours avant l'échéance : rappel hebdomadaire.`
          : `${restants} jours avant l'échéance : prochain rappel à ${restants - (restants % 7)} jours.`,
      };
    case "ponctuelle":
      return { rappel: false, cadence: c, raison: `${restants} jours avant l'échéance.` };
    default:
      return { rappel: false, cadence: c, raison: `${restants} jours avant l'échéance : aucune alerte encore.` };
  }
}

// ---------------------------------------------------------------------------
// Durée d'un CDD
// ---------------------------------------------------------------------------

/** Mois ENTIERS entre deux dates, pour mesurer la durée d'un contrat. */
export function moisEntreDates(debut: string, fin: string): number {
  if (fin < debut) return 0;
  const an = (+fin.slice(0, 4) - +debut.slice(0, 4)) * 12;
  const mo = +fin.slice(5, 7) - +debut.slice(5, 7);
  const jo = +fin.slice(8, 10) >= +debut.slice(8, 10) ? 0 : -1;
  return Math.max(0, an + mo + jo);
}

export interface ControleDuree {
  mois: number;
  /** Nombre de renouvellements que cette durée implique, au plafond de `CDD_MOIS_MAX`. */
  renouvellementsImplicites: number;
  avertissements: string[];
}

/**
 * Contrôle de la durée d'un CDD. **Avertit, ne bloque pas** — voir l'en-tête du module.
 *
 * `renouvele` est l'information que la RH détient et que les dates ne portent pas : un contrat de
 * 12 mois peut être un CDD de 6 mois renouvelé une fois (régulier) ou un CDD de 12 mois d'un seul
 * trait (qui ne l'est pas). Sans cette précision, on ne peut qu'énoncer les deux lectures.
 */
export function controlerDureeCdd(args: {
  dateDebut: string;
  dateFin: string;
  renouvele?: boolean;
  moisMax?: number;
  renouvellementsMax?: number;
}): ControleDuree {
  const moisMax = args.moisMax ?? CDD_MOIS_MAX;
  const renouvMax = args.renouvellementsMax ?? CDD_RENOUVELLEMENTS_MAX;
  const mois = moisEntreDates(args.dateDebut, args.dateFin);
  const plafondTotal = moisMax * (1 + renouvMax);
  const avertissements: string[] = [];

  if (args.dateFin < args.dateDebut)
    avertissements.push("La date de fin précède la date de début.");

  if (mois > plafondTotal) {
    avertissements.push(
      `${mois} mois : au-delà du plafond de ${plafondTotal} mois ` +
        `(${moisMax} mois renouvelables ${renouvMax} fois). Le contrat risque la requalification en CDI.`,
    );
  } else if (mois > moisMax) {
    avertissements.push(
      args.renouvele
        ? `${mois} mois au total : c'est le renouvellement, et il n'en reste plus aucun de disponible.`
        : `${mois} mois d'un seul trait dépassent les ${moisMax} mois d'un CDD initial. ` +
            "S'il s'agit d'un renouvellement, cochez-le ; sinon la durée est irrégulière.",
    );
  }

  if (args.renouvele && mois <= moisMax && mois > 0)
    avertissements.push(
      `Marqué renouvelé pour ${mois} mois : plus aucun renouvellement ne sera possible ensuite.`,
    );

  return {
    mois,
    renouvellementsImplicites: mois > moisMax ? Math.ceil(mois / moisMax) - 1 : 0,
    avertissements,
  };
}

// ---------------------------------------------------------------------------
// La liste des échéances
// ---------------------------------------------------------------------------

export interface ContratSuivi {
  id: string;
  nom: string;
  matricule?: string;
  contrat?: string;
  dateDebut?: string;
  dateFin: string;
  renouvele?: boolean;
  serviceNom?: string | null;
}

export interface Echeance extends ContratSuivi {
  restants: number;
  cadence: Cadence;
  rappelAujourdhui: boolean;
  raison: string;
  /** Rang d'urgence, pour le tri : plus petit = plus urgent. */
  urgence: number;
}

const URGENCE: Record<Cadence, number> = {
  depassee: 0, quotidienne: 1, hebdomadaire: 2, ponctuelle: 3, aucune: 4,
};

/**
 * Les échéances à surveiller, de la plus urgente à la plus lointaine.
 *
 * Un contrat ÉCHU reste en tête et n'est jamais retiré : c'est le seul cas où l'inaction crée un
 * engagement, donc le dernier qu'il faudrait masquer.
 */
export function echeances(
  contrats: ContratSuivi[],
  aujourdhui: string,
  regles: ReglesRappel = REGLES_RAPPEL_DEFAUT,
): Echeance[] {
  return contrats
    .map((c) => {
      const restants = joursRestants(c.dateFin, aujourdhui);
      const d = doitRappeler(restants, regles);
      return {
        ...c, restants, cadence: d.cadence, rappelAujourdhui: d.rappel, raison: d.raison,
        urgence: URGENCE[d.cadence],
      };
    })
    .sort((a, b) => a.urgence - b.urgence || a.restants - b.restants || a.nom.localeCompare(b.nom, "fr"));
}

export interface ResumeEcheances {
  suivis: number;
  depassees: number;
  /** Échéances dans les sept jours — ce qui demande une décision cette semaine. */
  cetteSemaine: number;
  /** Rappels qui tombent aujourd'hui. */
  rappelsDuJour: number;
}

export function resumerEcheances(liste: Echeance[]): ResumeEcheances {
  return {
    suivis: liste.length,
    depassees: liste.filter((e) => e.cadence === "depassee").length,
    cetteSemaine: liste.filter((e) => e.restants >= 0 && e.restants <= 7).length,
    rappelsDuJour: liste.filter((e) => e.rappelAujourdhui).length,
  };
}

/** Vrai si ce contrat doit être suivi : une date de fin, et un type qui n'est pas un CDI. */
export function aSuivre(c: { contrat?: string; dateFin?: string; actif?: boolean }): boolean {
  if (!c.dateFin) return false;
  if (c.actif === false) return false;
  // Un CDI avec une date de fin existe — un départ programmé — et mérite le même suivi. On exclut
  // seulement ce qui n'a pas de terme : sans date de fin, il n'y a rien à rappeler.
  return true;
}

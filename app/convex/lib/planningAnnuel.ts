// Planning annuel des congés — logique PURE (aucune dépendance Convex).
//
// Répond à la demande de la RH : « paramètre de couleur par service pour le planning des absences,
// définir une couleur pour un service pour savoir qui dans quel service a déjà un congé ».
// Son vrai besoin derrière la couleur : **ne pas vider un service**. D'où la détection de
// chevauchement, qui est la fonction utile — la couleur n'en est que le support visuel.

import { compterOuvrables, decaler, type ReglesOuvrables } from "./congesOuvrables.ts";

/** Un congé posé, tel qu'il sera stocké (dates incluses). */
export interface CongePose {
  id: string;
  employeId: string;
  employeNom: string;
  serviceId?: string;
  serviceNom?: string;
  /** Premier jour de congé. */
  depart: string;
  /** Dernier jour de congé (et non la date de retour). */
  dernierJour: string;
}

// ---------------------------------------------------------------------------
// Palette des services
// ---------------------------------------------------------------------------

/**
 * Palette catégorielle de 8 teintes, dans un ORDRE FIXE et validé : elle passe la bande de
 * clarté, le plancher de chroma, la séparation en vision déficiente (ΔE 9,1 au pire sur les
 * paires adjacentes) et le plancher en vision normale (ΔE 19,6) sur la surface `--papier`
 * (#f6f9fb) de la charte.
 *
 * ⚠️ Deux règles à respecter :
 *  1. **L'ordre ne se réarrange pas** et les teintes ne se recyclent pas : la validation porte
 *     sur cette séquence précise et sur ses paires adjacentes.
 *  2. **Au-delà de 8 services**, on ne génère PAS une 9ᵉ teinte — elle ne serait plus
 *     distinguable. Les services suivants reçoivent `COULEUR_NEUTRE` et la RH leur attribue
 *     une couleur à la main si elle le souhaite. Dans la frise, l'encodage principal du service
 *     reste le **regroupement des lignes**, la couleur n'étant qu'un repère secondaire.
 *
 * Trois teintes (aqua, jaune, magenta) sont sous 3:1 de contraste avec la surface : la frise doit
 * donc toujours porter des libellés visibles et offrir la vue en tableau — ce qu'elle fait.
 */
export const PALETTE_SERVICES = [
  "#2a78d6", // 1 bleu
  "#eb6834", // 2 orange
  "#1baf7a", // 3 aqua
  "#eda100", // 4 jaune
  "#e87ba4", // 5 magenta
  "#008300", // 6 vert
  "#4a3aa7", // 7 violet
  "#e34948", // 8 rouge
] as const;

export const COULEUR_NEUTRE = "#64748b"; // --encre-pale

/** Couleur par défaut du n-ième service (0-indexé), neutre au-delà de la palette. */
export const couleurServiceParDefaut = (index: number) =>
  index < PALETTE_SERVICES.length ? PALETTE_SERVICES[index] : COULEUR_NEUTRE;

// ---------------------------------------------------------------------------
// Chevauchements
// ---------------------------------------------------------------------------

export interface Chevauchement {
  serviceId: string;
  serviceNom: string;
  /** Premier et dernier jour où l'effectif simultané atteint le seuil. */
  debut: string;
  fin: string;
  /** Nombre maximum de personnes simultanément absentes sur l'intervalle. */
  effectif: number;
  employeIds: string[];
  employeNoms: string[];
}

const chevauche = (a: CongePose, b: CongePose) => a.depart <= b.dernierJour && b.depart <= a.dernierJour;

/**
 * Détecte, service par service, les intervalles où au moins `seuil` personnes sont en congé
 * en même temps. Les congés sans service ne sont pas comparés (on ne sait pas qui ils privent).
 *
 * L'algorithme balaie les dates de début et de fin comme des bornes d'événement, ce qui évite
 * de parcourir chaque jour de l'année.
 */
export function detecterChevauchements(conges: CongePose[], seuil = 2): Chevauchement[] {
  const parService = new Map<string, CongePose[]>();
  for (const c of conges) {
    if (!c.serviceId) continue;
    if (c.dernierJour < c.depart) continue;
    const l = parService.get(c.serviceId);
    if (l) l.push(c);
    else parService.set(c.serviceId, [c]);
  }

  const out: Chevauchement[] = [];
  for (const [serviceId, liste] of parService) {
    if (liste.length < seuil) continue;
    // Bornes candidates : chaque début, et le lendemain de chaque fin.
    const bornes = [...new Set(liste.flatMap((c) => [c.depart, decaler(c.dernierJour, 1)]))].sort();
    let courant: Chevauchement | null = null;

    for (let i = 0; i < bornes.length; i++) {
      const jour = bornes[i];
      const presents = liste.filter((c) => c.depart <= jour && jour <= c.dernierJour);
      const finIntervalle = i + 1 < bornes.length ? decaler(bornes[i + 1], -1) : jour;

      if (presents.length >= seuil) {
        if (courant && decaler(courant.fin, 1) === jour) {
          // On prolonge l'intervalle en cours et on y cumule les personnes concernées.
          courant.fin = finIntervalle;
          courant.effectif = Math.max(courant.effectif, presents.length);
          for (const p of presents)
            if (!courant.employeIds.includes(p.employeId)) {
              courant.employeIds.push(p.employeId);
              courant.employeNoms.push(p.employeNom);
            }
        } else {
          if (courant) out.push(courant);
          courant = {
            serviceId,
            serviceNom: presents[0].serviceNom ?? serviceId,
            debut: jour,
            fin: finIntervalle,
            effectif: presents.length,
            employeIds: presents.map((p) => p.employeId),
            employeNoms: presents.map((p) => p.employeNom),
          };
        }
      } else if (courant) {
        out.push(courant);
        courant = null;
      }
    }
    if (courant) out.push(courant);
  }
  return out.sort((a, b) => a.debut.localeCompare(b.debut) || a.serviceNom.localeCompare(b.serviceNom));
}

/** Les congés d'un employé qui en recouvrent un autre — sert à signaler une double saisie. */
export function doublonsEmploye(conges: CongePose[]): [CongePose, CongePose][] {
  const out: [CongePose, CongePose][] = [];
  const parEmploye = new Map<string, CongePose[]>();
  for (const c of conges) {
    const l = parEmploye.get(c.employeId);
    if (l) l.push(c);
    else parEmploye.set(c.employeId, [c]);
  }
  for (const liste of parEmploye.values()) {
    const tri = [...liste].sort((a, b) => a.depart.localeCompare(b.depart));
    for (let i = 1; i < tri.length; i++) if (chevauche(tri[i - 1], tri[i])) out.push([tri[i - 1], tri[i]]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Frise annuelle
// ---------------------------------------------------------------------------

export interface SegmentFrise {
  id: string;
  employeId: string;
  /** Bornes effectivement visibles, après écrêtage sur l'année. */
  debut: string;
  fin: string;
  /** Position et largeur en POURCENTAGE de l'année, prêtes pour le rendu. */
  gauchePct: number;
  largeurPct: number;
  /** Vrai si le congé dépasse de l'année (à signaler par une flèche côté écran). */
  tronqueAvant: boolean;
  tronqueApres: boolean;
  joursOuvrables: number;
}

const estBissextile = (a: number) => (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0;
export const joursDeLAnnee = (annee: number) => (estBissextile(annee) ? 366 : 365);

const rang = (iso: string, annee: number) => {
  const t = Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
  return Math.round((t - Date.UTC(annee, 0, 1)) / 86_400_000);
};

/** Les 12 bornes de mois d'une année, en pourcentage — graduations de la frise. */
export function graduationsMois(annee: number): { mois: number; libelle: string; gauchePct: number; largeurPct: number }[] {
  const total = joursDeLAnnee(annee);
  const LIB = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  return LIB.map((libelle, i) => {
    const debut = rang(`${annee}-${String(i + 1).padStart(2, "0")}-01`, annee);
    const jours = new Date(Date.UTC(annee, i + 1, 0)).getUTCDate();
    return { mois: i + 1, libelle, gauchePct: (debut / total) * 100, largeurPct: (jours / total) * 100 };
  });
}

/**
 * Écrête un congé sur l'année demandée et calcule sa position en pourcentage.
 * Renvoie `null` si le congé ne touche pas l'année.
 */
export function segmentFrise(
  c: CongePose,
  annee: number,
  feries: Set<string>,
  regles?: ReglesOuvrables,
): SegmentFrise | null {
  const borneBasse = `${annee}-01-01`;
  const borneHaute = `${annee}-12-31`;
  if (c.dernierJour < borneBasse || c.depart > borneHaute) return null;

  const debut = c.depart < borneBasse ? borneBasse : c.depart;
  const fin = c.dernierJour > borneHaute ? borneHaute : c.dernierJour;
  const total = joursDeLAnnee(annee);
  const d = rang(debut, annee);
  const longueur = rang(fin, annee) - d + 1;

  return {
    id: c.id,
    employeId: c.employeId,
    debut,
    fin,
    gauchePct: (d / total) * 100,
    largeurPct: (longueur / total) * 100,
    tronqueAvant: c.depart < borneBasse,
    tronqueApres: c.dernierJour > borneHaute,
    joursOuvrables: compterOuvrables(debut, fin, feries, regles),
  };
}

// ---------------------------------------------------------------------------
// Observation / statut d'une ligne de planning
// ---------------------------------------------------------------------------

/**
 * Valeurs de la colonne « observation » réclamée par la RH
 * (« pris, non pris, reporter, retraite… »). `non_pris` est le sens de son « RAS ».
 */
export const OBSERVATIONS = [
  ["planifie", "Planifié"],
  ["en_cours", "En cours"],
  ["pris", "Pris"],
  ["non_pris", "Non pris"],
  ["reporte", "Reporté"],
  ["retraite", "Retraite"],
  ["solde_au_depart", "Soldé au départ"],
  ["annule", "Annulé"],
] as const;

export type Observation = (typeof OBSERVATIONS)[number][0];
export const LIBELLE_OBSERVATION = Object.fromEntries(OBSERVATIONS) as Record<Observation, string>;

/** Les observations qui consomment effectivement des jours de congé. */
export const OBSERVATION_CONSOMME: Record<Observation, boolean> = {
  planifie: false,
  en_cours: true,
  pris: true,
  non_pris: false,
  reporte: false,
  retraite: true,
  solde_au_depart: true,
  annule: false,
};

/**
 * Observation déduite des dates, quand la RH n'en a pas forcé une.
 * `aujourdHui` est passé explicitement : la logique reste pure et testable.
 */
export function observationDeduite(
  c: { depart: string; dernierJour: string },
  aujourdHui: string,
): Observation {
  if (aujourdHui < c.depart) return "planifie";
  if (aujourdHui > c.dernierJour) return "pris";
  return "en_cours";
}

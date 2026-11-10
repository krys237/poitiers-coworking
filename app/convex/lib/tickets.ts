// Tickets : dysfonctionnements et besoins remontés par les membres — logique PURE (demande N5).
//
// LA DEMANDE
//
// « Nous aimerions que les membres qui ont un besoin suite à un dysfonctionnement ou à une
//   fonctionnalité puissent juste ouvrir un ticket qui demande d'expliquer le problème ou la
//   situation ou besoin, et cela sera envoyé à 2 personnes : le Directeur (pour valider de la
//   pertinence) et le développeur. Ils peuvent aussi mettre des images ou des captures. »
//
// DEUX PISTES, ET NON UN SEUL STATUT
//
// C'est le choix de conception qui porte tout le module. Le Directeur juge la PERTINENCE ; le
// développeur juge la RÉALISATION. Ce ne sont pas deux étapes d'une même file :
//
//   • un ticket peut être pertinent et pas encore traité ;
//   • il peut être traité alors que le Directeur ne s'est pas prononcé — un plantage n'attend pas
//     un arbitrage ;
//   • il peut être jugé non pertinent et rester ouvert techniquement, le temps d'expliquer
//     pourquoi.
//
// Un statut unique écraserait l'une des deux informations, et on ne saurait plus si « fermé »
// veut dire « fait » ou « refusé ».

export const NATURES = [
  ["dysfonctionnement", "Quelque chose ne marche pas"],
  ["besoin", "Il me manque quelque chose"],
  ["question", "Je ne comprends pas comment faire"],
] as const;
export type Nature = typeof NATURES[number][0];
export const LIBELLE_NATURE: Record<string, string> = Object.fromEntries(NATURES);

/** Avis du Directeur sur la pertinence. */
export const AVIS = ["en_attente", "pertinent", "non_pertinent"] as const;
export type Avis = typeof AVIS[number];
export const LIBELLE_AVIS: Record<Avis, string> = {
  en_attente: "En attente d'arbitrage",
  pertinent: "Jugé pertinent",
  non_pertinent: "Jugé non pertinent",
};

/** État de traitement, côté développeur. */
export const ETATS = ["nouveau", "en_cours", "resolu", "abandonne"] as const;
export type Etat = typeof ETATS[number];
export const LIBELLE_ETAT: Record<Etat, string> = {
  nouveau: "Nouveau",
  en_cours: "En cours",
  resolu: "Résolu",
  abandonne: "Abandonné",
};

export const estNature = (x: unknown): x is Nature =>
  typeof x === "string" && NATURES.some(([k]) => k === x);
export const estAvis = (x: unknown): x is Avis =>
  typeof x === "string" && (AVIS as readonly string[]).includes(x);
export const estEtat = (x: unknown): x is Etat =>
  typeof x === "string" && (ETATS as readonly string[]).includes(x);

/** Un ticket est terminé quand il est résolu, abandonné, ou jugé non pertinent. */
export const estClos = (t: { avis: string; etat: string }) =>
  t.etat === "resolu" || t.etat === "abandonne" || t.avis === "non_pertinent";

// ---------------------------------------------------------------------------
// Contrôles de saisie
// ---------------------------------------------------------------------------

export interface SaisieTicket {
  titre: string;
  description: string;
  nature: string;
  ecran?: string;
}

/**
 * Contrôle d'un ticket à l'ouverture. Retourne les défauts, ou un tableau vide.
 *
 * La description a une longueur MINIMALE, et c'est délibéré : « ça ne marche pas » ne permet de
 * reproduire ni de décider. Le formulaire demande ce qui s'est passé, pas un signalement.
 */
export const MIN_DESCRIPTION = 30;

export function controlerTicket(t: SaisieTicket): string[] {
  const e: string[] = [];
  if (!t.titre.trim()) e.push("Un titre est requis : il sert à retrouver le ticket.");
  else if (t.titre.trim().length < 5) e.push("Le titre est trop court pour être reconnaissable.");
  if (!estNature(t.nature)) e.push("Précisez de quoi il s'agit : dysfonctionnement, besoin ou question.");
  const d = t.description.trim();
  if (!d) e.push("La description est requise.");
  else if (d.length < MIN_DESCRIPTION)
    e.push(
      `Décrivez un peu plus (${d.length} caractères sur ${MIN_DESCRIPTION} attendus) : ` +
        "ce que vous faisiez, ce que vous attendiez, ce qui s'est passé.",
    );
  return e;
}

/**
 * Contrôle d'un arbitrage. Un refus EXIGE un motif ; un accord non.
 *
 * Asymétrie volontaire : refuser le besoin de quelqu'un sans lui dire pourquoi est la meilleure
 * façon de le dissuader d'en signaler un autre.
 */
export function controlerArbitrage(avis: string, motif?: string): string[] {
  if (!estAvis(avis) || avis === "en_attente") return ["Avis attendu : pertinent ou non pertinent."];
  if (avis === "non_pertinent" && !motif?.trim())
    return ["Un refus doit être motivé : l'auteur doit savoir pourquoi."];
  return [];
}

/** Contrôle d'un changement d'état. L'abandon exige une note, pour la même raison qu'un refus. */
export function controlerEtat(etat: string, note?: string): string[] {
  if (!estEtat(etat)) return ["État inconnu."];
  if (etat === "abandonne" && !note?.trim())
    return ["Un abandon doit être expliqué : l'auteur doit savoir pourquoi."];
  return [];
}

// ---------------------------------------------------------------------------
// Pièces jointes
// ---------------------------------------------------------------------------

/** Types acceptés : des captures d'écran et des photos, rien d'autre. */
export const TYPES_PIECE = ["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"];
export const TAILLE_PIECE_MAX = 10 * 1024 * 1024; // 10 Mo
export const PIECES_MAX = 5;

export function controlerPiece(p: { typeMime: string; taille: number }): string | null {
  if (!TYPES_PIECE.includes(p.typeMime))
    return `Type de fichier refusé (${p.typeMime}) : captures d'écran, photos et PDF seulement.`;
  if (p.taille > TAILLE_PIECE_MAX)
    return `Fichier trop lourd (${Math.round(p.taille / 1024 / 1024)} Mo) : 10 Mo au maximum.`;
  if (p.taille <= 0) return "Fichier vide.";
  return null;
}

// ---------------------------------------------------------------------------
// Tri et compteurs
// ---------------------------------------------------------------------------

export interface TicketVu {
  avis: string;
  etat: string;
  nature: string;
  cree: string;
}

export interface Compteurs {
  total: number;
  ouverts: number;
  /** À arbitrer par le Directeur. */
  aArbitrer: number;
  /** À traiter par le développeur : pertinents ou non encore arbitrés, et pas finis. */
  aTraiter: number;
  parNature: { nature: string; libelle: string; n: number }[];
}

export function compter(tickets: TicketVu[]): Compteurs {
  const parNature = NATURES.map(([k, libelle]) => ({
    nature: k as string,
    libelle,
    n: tickets.filter((t) => t.nature === k).length,
  }));
  return {
    total: tickets.length,
    ouverts: tickets.filter((t) => !estClos(t)).length,
    aArbitrer: tickets.filter((t) => t.avis === "en_attente" && !estClos(t)).length,
    // Un ticket non encore arbitré compte quand même : un plantage n'attend pas un arbitrage.
    aTraiter: tickets.filter(
      (t) => t.avis !== "non_pertinent" && t.etat !== "resolu" && t.etat !== "abandonne",
    ).length,
    parNature,
  };
}

/**
 * Ordre d'affichage : ce qui demande une action d'abord, puis le plus récent.
 *
 * Un ticket clos n'est pas masqué — il descend. Masquer ferait perdre la trace de ce qui a été
 * refusé, et c'est précisément ce qu'un auteur viendra vérifier.
 */
export function trier<T extends TicketVu>(tickets: T[]): T[] {
  const rang = (t: TicketVu) => {
    if (estClos(t)) return 3;
    if (t.avis === "en_attente") return 0;
    if (t.etat === "nouveau") return 1;
    return 2;
  };
  return [...tickets].sort((a, b) => rang(a) - rang(b) || b.cree.localeCompare(a.cree));
}

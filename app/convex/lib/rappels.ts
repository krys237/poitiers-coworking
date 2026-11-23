// Logique pure du moteur de rappels (lot S5) et des pense-bêtes personnels (lot S7).
// Règle d'or : toute fonction reçoit l'instant `now` en paramètre — JAMAIS `new Date()` ici.
// PUR : aucun import serveur, 100 % testable isolément.

import {
  dispenseDeFenetre,
  estJourOuvrable,
  heureDouala,
  type Fenetre,
} from "./fenetre.ts";
import { NIVEAU, type Droits, type Role } from "../rbac.ts";

/**
 * Composition déterministe d'une clé d'idempotence de rappel (spec S5 §2).
 * Tout rappel récurrent porte sa date ; un rappel de dossier porte son palier.
 */
export function cleRappel(
  famille: "dort" | "cr" | "financier" | "paie" | "verrou",
  cible: string,
  palierOuDate: string,
  destinataireId?: string,
): string {
  const parts = [famille, cible, palierOuDate];
  if (destinataireId) parts.push(destinataireId);
  return parts.join("-");
}

export type PassageCr = "ouverture" | "fermeture" | null;

/**
 * Détermine si l'instant `now` (heure de Douala) correspond au passage d'ouverture
 * (`crHeureOuverture`:00) ou au passage avant fermeture (`crHeureFermeture - 1`:30).
 * Aucun rappel hors jours ouvrés (dimanche toujours exclu ; samedi selon `crSamedi`).
 */
export function passageRappelCr(now: Date, fenetre: Fenetre): PassageCr {
  if (!estJourOuvrable(now, fenetre)) return null;
  const h = heureDouala(now);
  if (h.h === fenetre.ouverture && h.min < 30) return "ouverture";
  const heureAvantFermeture = fenetre.fermeture - 1;
  if (h.h === heureAvantFermeture && h.min >= 30) return "fermeture";
  return null;
}

export type MembrePourRappelCr = {
  id: string;
  role: Role;
  actif: boolean;
  enAttente: boolean;
};

/**
 * Membres à rappeler pour le compte rendu du jour : actifs, non en attente,
 * non dispensés (niveau < 5, décision du 19/10/2026) et n'ayant pas encore déposé.
 */
export function membresARappelerCr(
  membres: MembrePourRappelCr[],
  auteursDejaDeposes: Set<string>,
): string[] {
  return membres
    .filter((m) => {
      if (!m.actif || m.enAttente) return false;
      if (dispenseDeFenetre(NIVEAU[m.role] ?? 0)) return false;
      if (auteursDejaDeposes.has(m.id)) return false;
      return true;
    })
    .map((m) => m.id);
}

/**
 * Contrôle de clôture de paie (spec S5 §3.3) : ne déclenche que les 3 derniers jours
 * avant `jourPaiement` (ex. les 2, 3 et 4 pour un paiement le 5).
 * Importance `urgent` le dernier jour (`joursRestants === 1`).
 */
export function evaluerRappelCloturePaie(
  now: Date,
  jourPaiement: number,
): { aRappeler: boolean; urgent: boolean; periodePrecedente: string; dateJour: string } {
  const h = heureDouala(now);
  const joursRestants = jourPaiement - h.d;
  const anneePrev = h.m === 1 ? h.y - 1 : h.y;
  const moisPrev = h.m === 1 ? 12 : h.m - 1;
  const periodePrecedente = `${anneePrev}-${String(moisPrev).padStart(2, "0")}`;
  const aRappeler = joursRestants >= 1 && joursRestants <= 3;
  return {
    aRappeler,
    urgent: joursRestants === 1,
    periodePrecedente,
    dateJour: h.iso,
  };
}

/**
 * Détermine si un dossier en attente déclenche le palier 1 ou le palier 2 (escalade).
 * Palier 2 part `escaladeH` heures après le palier 1 (et uniquement si palier 1 a été émis).
 */
export function evaluerPalierDossier(args: {
  ageHeures: number;
  seuilPalier1H: number;
  escaladeH: number;
  aEscalade: boolean;
  palier1EmisLeMs?: number | null;
  maintenantMs: number;
}): 1 | 2 | null {
  if (args.palier1EmisLeMs == null) {
    return args.ageHeures >= args.seuilPalier1H ? 1 : null;
  }
  if (!args.aEscalade) return null;
  const depuisPalier1H = (args.maintenantMs - args.palier1EmisLeMs) / 3_600_000;
  return depuisPalier1H >= args.escaladeH ? 2 : null;
}

/**
 * Escalade hiérarchique (spec S5 §4) : seule exception assumée au routage par droit seul.
 * Cible niveau ≥ 7 (DG, super_admin) ET détenteur du droit `voir` sur le module (invariant 2).
 */
export function destinatairesEscalade(
  membres: { id: string; role: Role; actif: boolean; enAttente: boolean; droits: Droits }[],
  module: string,
): string[] {
  return membres
    .filter(
      (m) =>
        m.actif &&
        !m.enAttente &&
        (NIVEAU[m.role] ?? 0) >= 7 &&
        Boolean(m.droits[module]?.voir),
    )
    .map((m) => m.id);
}

/** Borne stricte des dossiers traités par passage cron (spec S5 §4 : 50 max). */
export function bornerDossiers<T>(liste: T[], max = 50): T[] {
  return liste.slice(0, Math.max(0, max));
}

// ---------------- Pense-bêtes personnels (lot S7) ----------------

export const MAX_PENSE_BETE_TEXTE = 500;
export const MAX_PENSE_BETES_EN_ATTENTE = 50;
export const LIMITE_BALAYAGE_PENSE_BETES = 100;

/** Validation pure d'un pense-bête à la création ou modification (spec S7 §4). */
export function validerPenseBete(args: {
  texte: string;
  echeanceIso: string;
  maintenantIso: string;
  nbEnAttenteActuel: number;
  estModification?: boolean;
}): string | null {
  const propre = args.texte.trim();
  if (!propre) return "Le texte du pense-bête ne peut pas être vide.";
  if (propre.length > MAX_PENSE_BETE_TEXTE) {
    return `Le texte ne doit pas dépasser ${MAX_PENSE_BETE_TEXTE} caractères.`;
  }
  const echMs = Date.parse(args.echeanceIso);
  const nowMs = Date.parse(args.maintenantIso);
  if (!Number.isFinite(echMs)) return "Date d'échéance invalide.";
  if (echMs <= nowMs) return "L'échéance du pense-bête doit être dans le futur.";
  if (!args.estModification && args.nbEnAttenteActuel >= MAX_PENSE_BETES_EN_ATTENTE) {
    return `Vous avez atteint la limite de ${MAX_PENSE_BETES_EN_ATTENTE} pense-bêtes en attente.`;
  }
  return null;
}

/** Sélection pure du balayage cron : uniquement `en_attente` et `echeance <= maintenant`, bornée à 100. */
export function selectionnerPenseBetesAEcheance<
  T extends { etat: string; echeance: string },
>(liste: T[], maintenantIso: string, max = LIMITE_BALAYAGE_PENSE_BETES): T[] {
  return liste
    .filter((p) => p.etat === "en_attente" && p.echeance <= maintenantIso)
    .slice(0, max);
}

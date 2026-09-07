// Journal d'activité (table `journalActivite`) : qui a fait quoi, quand — rôles, clôtures, API, barème.
import { MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

export const ACTIONS = [
  ["membre_creation", "Création de membre"],
  ["membre_role", "Changement de rôle"],
  ["membre_activation", "Activation / désactivation"],
  ["membre_modification", "Modification de membre"],
  ["cloture_paie", "Clôture de paie"],
  ["cloture_financier", "Clôture financière"],
  ["api_financial", "Appel API financière"],
  ["bareme_controle", "Contrôle du barème"],
  ["bareme_version", "Nouvelle version du barème"],
  ["audit_rapport", "Rapport d'audit"],
  ["verrous_purge", "Purge des verrous"],
] as const;
export type ActionJournal = typeof ACTIONS[number][0];
export const LIBELLE_ACTION: Record<string, string> = Object.fromEntries(ACTIONS);

export interface Evenement {
  auteurId?: Id<"users">; auteurNom?: string; action: ActionJournal;
  cible?: string; detail?: string; statut?: number; ip?: string;
}

export async function journaliser(ctx: MutationCtx, e: Evenement) {
  await ctx.db.insert("journalActivite", { date: new Date().toISOString(), ...e });
}

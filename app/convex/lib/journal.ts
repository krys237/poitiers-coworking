// Journal d'activité (table `journalActivite`) : qui a fait quoi, quand — rôles, clôtures, API, barème.
import { MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { ACTIONS_LIBELLES } from "./journalFamilles";

export const ACTIONS = ACTIONS_LIBELLES;
export type ActionJournal = typeof ACTIONS[number][0];
export const LIBELLE_ACTION: Record<string, string> = Object.fromEntries(ACTIONS);

export { FAMILLES, FAMILLE_ACTION, type FamilleJournal } from "./journalFamilles";

export interface Evenement {
  auteurId?: Id<"users">; auteurNom?: string; action: ActionJournal;
  cible?: string; detail?: string; statut?: number; ip?: string;
}

export async function journaliser(ctx: MutationCtx, e: Evenement) {
  await ctx.db.insert("journalActivite", { date: new Date().toISOString(), ...e });
}

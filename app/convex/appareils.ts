// Appareils enregistrés pour le push système Firebase (lot S4).
// Toutes les opérations publiques sont strictement limitées au membre courant.
import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUser } from "./lib/authz";

/** Enregistre ou rafraîchit un jeton FCM pour le membre courant. Idempotente. */
export const enregistrer = mutation({
  args: {
    jeton: v.string(),
    libelle: v.optional(v.string()),
    plateforme: v.optional(v.string()),
    installeEnPwa: v.optional(v.boolean()),
  },
  handler: async (ctx, a) => {
    const user = await getCurrentUser(ctx);
    if (!user || !user.isActive || user.enAttente) throw new Error("Non authentifié.");
    const jeton = a.jeton.trim();
    if (!jeton) throw new Error("Jeton d'appareil vide.");

    const maintenant = new Date().toISOString();
    const existant = await ctx.db
      .query("appareils")
      .withIndex("by_jeton", (q) => q.eq("jeton", jeton))
      .first();

    if (existant) {
      await ctx.db.patch(existant._id, {
        membreId: user._id,
        libelle: a.libelle ?? existant.libelle,
        plateforme: a.plateforme ?? existant.plateforme,
        installeEnPwa: a.installeEnPwa ?? existant.installeEnPwa,
        vuLe: maintenant,
      });
      return existant._id;
    }

    return await ctx.db.insert("appareils", {
      membreId: user._id,
      jeton,
      libelle: a.libelle,
      plateforme: a.plateforme,
      installeEnPwa: a.installeEnPwa,
      creeLe: maintenant,
      vuLe: maintenant,
    });
  },
});

/** Retire un appareil appartenant au membre courant. */
export const oublier = mutation({
  args: { jeton: v.string() },
  handler: async (ctx, { jeton }) => {
    const user = await getCurrentUser(ctx);
    if (!user || !user.isActive || user.enAttente) throw new Error("Non authentifié.");

    const existant = await ctx.db
      .query("appareils")
      .withIndex("by_jeton", (q) => q.eq("jeton", jeton))
      .first();
    if (!existant || String(existant.membreId) !== String(user._id)) return;
    await ctx.db.delete(existant._id);
  },
});

/** Liste les appareils enregistrés du membre courant (écran Préférences). */
export const mesAppareils = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user || !user.isActive || user.enAttente) return [];
    const liste = await ctx.db
      .query("appareils")
      .withIndex("by_membre", (q) => q.eq("membreId", user._id))
      .collect();
    return liste.sort((a, b) => b.vuLe.localeCompare(a.vuLe));
  },
});

/** Supprime un jeton refusé par FCM (`UNREGISTERED` / `INVALID_ARGUMENT`). */
export const retirerJetonInvalide = internalMutation({
  args: { jeton: v.string() },
  handler: async (ctx, { jeton }) => {
    const existant = await ctx.db
      .query("appareils")
      .withIndex("by_jeton", (q) => q.eq("jeton", jeton))
      .first();
    if (existant) await ctx.db.delete(existant._id);
  },
});

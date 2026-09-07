import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireLevel } from "./lib/authz";

// Paramètres entreprise : singleton (première ligne). Apparaissent en en-tête/filigrane des PDF.
export const get = query({
  args: {},
  handler: async (ctx) => (await ctx.db.query("parametresEntreprise").first()) ?? null,
});

export const enregistrer = mutation({
  args: {
    nom: v.string(), adresse: v.string(), logoUrl: v.optional(v.string()),
    filigrane: v.optional(v.string()), couleurEntete: v.optional(v.string()),
    modeleCourrier: v.optional(v.string()), emailExpediteur: v.optional(v.string()),
    congesParMois: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireLevel(ctx, 7);
    const existant = await ctx.db.query("parametresEntreprise").first();
    if (existant) await ctx.db.patch(existant._id, args);
    else await ctx.db.insert("parametresEntreprise", args);
  },
});

// Modèle de lettre + expéditeur (accessible dès le niveau RH, sans toucher aux autres paramètres).
export const modifierCourrier = mutation({
  args: { modeleCourrier: v.optional(v.string()), emailExpediteur: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireLevel(ctx, 4);
    const existant = await ctx.db.query("parametresEntreprise").first();
    if (!existant) throw new Error("Paramètres entreprise non initialisés.");
    await ctx.db.patch(existant._id, args);
  },
});

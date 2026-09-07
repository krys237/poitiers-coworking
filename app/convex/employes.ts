import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireLevel } from "./lib/authz";

const SOCIETE = v.union(v.literal("SESAME"), v.literal("SOFINA"), v.literal("SGC"));

export const liste = query({
  args: { societe: v.optional(SOCIETE) },
  handler: async (ctx, { societe }) => {
    await requireLevel(ctx, 3);
    if (societe) {
      return await ctx.db.query("employes").withIndex("by_societe", (q) => q.eq("societe", societe)).collect();
    }
    return await ctx.db.query("employes").collect();
  },
});

export const creer = mutation({
  args: {
    matricule: v.string(), nom: v.string(), fonction: v.optional(v.string()),
    adresse: v.optional(v.string()), cnps: v.optional(v.string()), niu: v.optional(v.string()),
    email: v.optional(v.string()), societe: SOCIETE, salaireBrut: v.number(), contrat: v.optional(v.string()),
    dateDebut: v.optional(v.string()), dateFin: v.optional(v.string()), congesInitial: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireLevel(ctx, 4);
    return await ctx.db.insert("employes", { ...args, joursBase: 30, actif: true });
  },
});

// Mise à jour partielle d'une fiche (e-mail, fonction, société, dates, solde de congés initial…).
export const modifier = mutation({
  args: {
    employeId: v.id("employes"),
    email: v.optional(v.string()), fonction: v.optional(v.string()), adresse: v.optional(v.string()),
    cnps: v.optional(v.string()), niu: v.optional(v.string()), societe: v.optional(SOCIETE),
    salaireBrut: v.optional(v.number()), actif: v.optional(v.boolean()),
    dateDebut: v.optional(v.string()), dateFin: v.optional(v.string()), congesInitial: v.optional(v.number()),
  },
  handler: async (ctx, { employeId, ...patch }) => {
    await requireLevel(ctx, 4);
    const propre = Object.fromEntries(Object.entries(patch).filter(([, val]) => val !== undefined));
    await ctx.db.patch(employeId, propre);
  },
});

// Import Excel/CSV : upsert par matricule (sinon par nom). Recalcul réactif automatique ensuite.
export const importer = mutation({
  args: {
    lignes: v.array(v.object({
      matricule: v.string(), nom: v.string(), fonction: v.optional(v.string()),
      adresse: v.optional(v.string()), cnps: v.optional(v.string()), niu: v.optional(v.string()),
      email: v.optional(v.string()), societe: SOCIETE, salaireBrut: v.number(),
      dateDebut: v.optional(v.string()),
    })),
  },
  handler: async (ctx, { lignes }) => {
    await requireLevel(ctx, 4);
    let crees = 0, majs = 0;
    for (const l of lignes) {
      const existant = await ctx.db
        .query("employes")
        .withIndex("by_matricule", (q) => q.eq("matricule", l.matricule))
        .unique();
      if (existant) { await ctx.db.patch(existant._id, l); majs++; }
      else { await ctx.db.insert("employes", { ...l, joursBase: 30, actif: true }); crees++; }
    }
    return { crees, majs };
  },
});

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireLevel } from "./lib/authz";
import { journaliser } from "./lib/journal";
import { bulletinsPourPeriode } from "./lib/calculBulletins";

// Requête RÉACTIVE : les bulletins du mois (calcul à la volée, ou snapshots si le mois est clôturé).
export const bulletinsDuMois = query({
  args: { periode: v.string() },
  handler: async (ctx, { periode }) => {
    await requireLevel(ctx, 4);
    return await bulletinsPourPeriode(ctx, periode);
  },
});

// Génère et FIGE les bulletins du mois, puis clôture (verrou), comme le grand livre financier.
export const genererEtCloturer = mutation({
  args: { periode: v.string() },
  handler: async (ctx, { periode }) => {
    const user = await requireLevel(ctx, 4);
    const r = await bulletinsPourPeriode(ctx, periode);
    if (r.cloture) throw new Error("Ce mois est déjà clôturé.");
    if (!r.baremeId) throw new Error(r.erreur ?? "Aucun barème applicable à cette période.");

    const genereLe = new Date().toISOString();
    for (const b of r.bulletins) {
      await ctx.db.insert("bulletins", {
        employeId: b.employeId, periode, baremeId: b.baremeId, societe: b.societe,
        brut: b.brut, totalRetenues: b.totalRetenues, net: b.net,
        lignesGain: b.lignesGain, cotisations: b.cotisations, statut: "genere", genereLe,
      });
    }
    await ctx.db.insert("cloturesPaie", { periode, closedBy: user._id, closedAt: genereLe, baremeId: r.baremeId });
    await journaliser(ctx, { auteurId: user._id, auteurNom: user.nom ?? user.email, action: "cloture_paie", cible: periode, detail: `${r.bulletins.length} bulletin(s) figé(s)` });
    return { periode, bulletins: r.bulletins.length };
  },
});

// Les saisies brutes du mois (pour l'édition), indexées par employé.
export const saisiesDuMois = query({
  args: { periode: v.string() },
  handler: async (ctx, { periode }) => {
    await requireLevel(ctx, 4);
    const rows = await ctx.db.query("saisiesMensuelles").withIndex("by_periode", (q) => q.eq("periode", periode)).collect();
    return Object.fromEntries(rows.map((r) => [r.employeId, r]));
  },
});

// Saisie/màj des éléments variables d'un employé pour un mois (déclenche le recalcul réactif).
export const saisirMois = mutation({
  args: {
    employeId: v.id("employes"), periode: v.string(),
    valeurs: v.object({
      joursTravailles: v.number(), absencesJours: v.number(), sanctions: v.number(),
      primesVariables: v.number(), transport: v.number(), heuresSup: v.number(),
      anciennete: v.number(), mutuellePct: v.number(), dettesSoins: v.number(), acompte: v.number(),
    }),
  },
  handler: async (ctx, { employeId, periode, valeurs }) => {
    await requireLevel(ctx, 4);
    const existant = await ctx.db.query("saisiesMensuelles")
      .withIndex("by_employe_periode", (q) => q.eq("employeId", employeId).eq("periode", periode)).unique();
    if (existant) await ctx.db.patch(existant._id, valeurs);
    else await ctx.db.insert("saisiesMensuelles", { employeId, periode, ...valeurs });
  },
});

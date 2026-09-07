import { query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { requireLevel } from "./lib/authz";
import { ACTIONS, LIBELLE_ACTION } from "./lib/journal";

const jours = (n: number) => new Date(Date.now() - n * 86400000).toISOString();

// 200 derniers événements (DG), filtrables par action.
export const liste = query({
  args: { action: v.optional(v.string()), limite: v.optional(v.number()) },
  handler: async (ctx, { action, limite }) => {
    await requireLevel(ctx, 7);
    const n = Math.min(500, limite ?? 200);
    const rows = action
      ? await ctx.db.query("journalActivite").withIndex("by_action", (q) => q.eq("action", action)).order("desc").take(n)
      : await ctx.db.query("journalActivite").withIndex("by_date").order("desc").take(n);
    return rows.map((r) => ({ ...r, actionLibelle: LIBELLE_ACTION[r.action] ?? r.action }));
  },
});

export const actions = query({ args: {}, handler: async () => ACTIONS.map(([cle, libelle]) => ({ cle, libelle })) });

// Écriture depuis les HTTP actions et les actions planifiées (pas d'auth : interne).
export const ecrire = internalMutation({
  args: { auteurId: v.optional(v.id("users")), auteurNom: v.optional(v.string()), action: v.string(), cible: v.optional(v.string()), detail: v.optional(v.string()), statut: v.optional(v.number()), ip: v.optional(v.string()) },
  handler: async (ctx, e) => { await ctx.db.insert("journalActivite", { date: new Date().toISOString(), ...e }); },
});

// État de l'API pour la fiche et le tableau de bord : clé configurée (jamais affichée), appels 7 jours, 20 derniers appels.
export const etatApi = query({
  args: {},
  handler: async (ctx) => {
    await requireLevel(ctx, 7);
    const depuis = jours(7);
    const appels7j = (await ctx.db.query("journalActivite").withIndex("by_action", (q) => q.eq("action", "api_financial").gte("date", depuis)).collect()).length;
    const derniers = await ctx.db.query("journalActivite").withIndex("by_action", (q) => q.eq("action", "api_financial")).order("desc").take(20);
    const parStatut: Record<string, number> = {};
    for (const d of derniers) parStatut[String(d.statut ?? "?")] = (parStatut[String(d.statut ?? "?")] ?? 0) + 1;
    return { cleConfiguree: !!process.env.FINANCIAL_API_KEY, appels7j, derniers, parStatut, siteUrl: process.env.CONVEX_SITE_URL ?? null };
  },
});

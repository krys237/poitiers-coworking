// Primes médecins : rétrocessions par catégorie (montant = actes × montant unitaire).
// Module séparé de la Caisse du mois depuis le 09/10/2026 : les deux écrans relèvent de personnes
// différentes, donc de droits différents (`/primes-medecins` et `/caisse`).
//
// Les lignes vivent dans la table partagée `primesMedecins` avec `contexte: "stats"` ; le contexte
// « audit » appartient au module Audit, cloisonné (convex/audit.ts).
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireDroit } from "./lib/authz";
import { controlerVerrou, etatVerrou } from "./lib/verrouSaisie";
import { montantTotalPrime, CATEGORIES_PRIMES } from "./lib/stats";

const DEVERROUILLAGE = "/primes-medecins/deverrouillage";
const CATEGORIE = v.union(...CATEGORIES_PRIMES.map(([k]) => v.literal(k)));

export const liste = query({
  args: { periode: v.string(), categorie: v.optional(CATEGORIE) },
  handler: async (ctx, { periode, categorie }) => {
    const me = await requireDroit(ctx, "/primes-medecins");
    const rows = categorie
      ? await ctx.db.query("primesMedecins").withIndex("by_contexte_periode_categorie", (q) => q.eq("contexte", "stats").eq("periode", periode).eq("categorie", categorie)).collect()
      : await ctx.db.query("primesMedecins").withIndex("by_contexte_periode", (q) => q.eq("contexte", "stats").eq("periode", periode)).collect();
    const parCategorie: Record<string, number> = {};
    for (const [k] of CATEGORIES_PRIMES) parCategorie[k] = 0;
    for (const r of rows) parCategorie[r.categorie] = (parCategorie[r.categorie] ?? 0) + r.montant;
    return {
      periode, lignes: rows.sort((a, b) => a.designation.localeCompare(b.designation)),
      total: rows.reduce((t, r) => t + r.montant, 0), parCategorie,
      ...(await etatVerrou(ctx, me, DEVERROUILLAGE)),
    };
  },
});

export const enregistrer = mutation({
  args: {
    primeId: v.optional(v.id("primesMedecins")), periode: v.string(), categorie: CATEGORIE, designation: v.string(),
    dateDebut: v.optional(v.string()), dateFin: v.optional(v.string()), actes: v.number(), montantUnitaire: v.number(), notes: v.optional(v.string()),
  },
  handler: async (ctx, { primeId, ...p }) => {
    const me = await requireDroit(ctx, "/primes-medecins", "faire");
    if (!p.designation.trim()) throw new Error("Nom du médecin requis.");
    const doc = { contexte: "stats" as const, ...p, designation: p.designation.trim(), montant: montantTotalPrime(p.actes, p.montantUnitaire) };
    if (primeId) {
      const avant = await ctx.db.get(primeId);
      if (!avant) throw new Error("Prime introuvable.");
      await controlerVerrou(ctx, me, avant, DEVERROUILLAGE, `prime de ${avant.designation} (modification)`);
      await ctx.db.patch(primeId, doc); return primeId;
    }
    return await ctx.db.insert("primesMedecins", doc);
  },
});

export const supprimer = mutation({
  args: { primeId: v.id("primesMedecins") },
  handler: async (ctx, { primeId }) => {
    const me = await requireDroit(ctx, "/primes-medecins", "faire");
    const p = await ctx.db.get(primeId);
    if (!p) return;
    await controlerVerrou(ctx, me, p, DEVERROUILLAGE, `prime de ${p.designation} (suppression)`);
    await ctx.db.delete(primeId);
  },
});

export const importer = mutation({
  args: {
    periode: v.string(), categorie: CATEGORIE,
    lignes: v.array(v.object({ designation: v.string(), dateDebut: v.optional(v.string()), dateFin: v.optional(v.string()), actes: v.number(), montantUnitaire: v.number(), notes: v.optional(v.string()) })),
  },
  handler: async (ctx, { periode, categorie, lignes }) => {
    await requireDroit(ctx, "/primes-medecins", "faire");
    for (const l of lignes) await ctx.db.insert("primesMedecins", { contexte: "stats", periode, categorie, ...l, montant: montantTotalPrime(l.actes, l.montantUnitaire) });
    return { importees: lignes.length };
  },
});

/** Montant par catégorie du mois (graphe de l'écran). */
export const graphe = query({
  args: { periode: v.string() },
  handler: async (ctx, { periode }) => {
    await requireDroit(ctx, "/primes-medecins");
    const primes = await ctx.db.query("primesMedecins").withIndex("by_contexte_periode", (q) => q.eq("contexte", "stats").eq("periode", periode)).collect();
    return { primesParCategorie: CATEGORIES_PRIMES.map(([k, libelle]) => ({ categorie: k, libelle, montant: primes.filter((p) => p.categorie === k).reduce((t, p) => t + p.montant, 0) })) };
  },
});

/** Total des primes du mois, pour la tuile du tableau de bord. */
export const kpi = query({
  args: { periode: v.string() },
  handler: async (ctx, { periode }) => {
    await requireDroit(ctx, "/primes-medecins");
    const primes = await ctx.db.query("primesMedecins").withIndex("by_contexte_periode", (q) => q.eq("contexte", "stats").eq("periode", periode)).collect();
    return { periode, primes: primes.reduce((t, p) => t + p.montant, 0), nbLignes: primes.length };
  },
});

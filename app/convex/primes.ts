import { query, mutation, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { requireLevel } from "./lib/authz";

const TYPE = v.union(v.literal("prime"), v.literal("charge"));

async function verifierOuvert(ctx: MutationCtx, periode: string) {
  const clos = await ctx.db.query("cloturesPaie").withIndex("by_periode", (q) => q.eq("periode", periode)).unique();
  if (clos) throw new Error(`Le mois ${periode} est clôturé : registre en lecture seule.`);
}

// Registre du mois : lignes (avec nom d'employé), totaux et récapitulatif par employé.
export const liste = query({
  args: { periode: v.string() },
  handler: async (ctx, { periode }) => {
    await requireLevel(ctx, 4);
    const cloture = await ctx.db.query("cloturesPaie").withIndex("by_periode", (q) => q.eq("periode", periode)).unique();
    const employes = await ctx.db.query("employes").collect();
    const nomDe = new Map(employes.map((e) => [String(e._id), e.nom]));
    const lignes = (await ctx.db.query("primesCharges").withIndex("by_periode", (q) => q.eq("periode", periode)).collect())
      .sort((a, b) => b.date.localeCompare(a.date) || b._creationTime - a._creationTime)
      .map((l) => ({ ...l, nom: nomDe.get(String(l.employeId)) ?? "?" }));

    const parEmploye = new Map<string, { employeId: string; nom: string; primes: number; charges: number }>();
    let totalPrimes = 0, totalCharges = 0;
    for (const l of lignes) {
      const k = String(l.employeId);
      const r = parEmploye.get(k) ?? { employeId: k, nom: l.nom, primes: 0, charges: 0 };
      if (l.type === "prime") { r.primes += l.montant; totalPrimes += l.montant; } else { r.charges += l.montant; totalCharges += l.montant; }
      parEmploye.set(k, r);
    }
    return {
      periode, cloture: !!cloture, lignes,
      totaux: { primes: totalPrimes, charges: totalCharges, employes: parEmploye.size },
      parEmploye: [...parEmploye.values()].sort((a, b) => a.nom.localeCompare(b.nom)),
      employesActifs: employes.filter((e) => e.actif).map((e) => ({ employeId: e._id, nom: e.nom })).sort((a, b) => a.nom.localeCompare(b.nom)),
    };
  },
});

export const ajouter = mutation({
  args: { employeId: v.id("employes"), periode: v.string(), libelle: v.string(), montant: v.number(), type: TYPE, date: v.string() },
  handler: async (ctx, a) => {
    await requireLevel(ctx, 4);
    await verifierOuvert(ctx, a.periode);
    const libelle = a.libelle.trim();
    if (!libelle) throw new Error("Libellé requis.");
    if (!(a.montant > 0)) throw new Error("Le montant doit être strictement positif.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(a.date)) throw new Error("Date au format AAAA-MM-JJ.");
    return await ctx.db.insert("primesCharges", { ...a, libelle, montant: Math.round(a.montant) });
  },
});

export const supprimer = mutation({
  args: { ligneId: v.id("primesCharges") },
  handler: async (ctx, { ligneId }) => {
    await requireLevel(ctx, 4);
    const l = await ctx.db.get(ligneId);
    if (!l) return;
    await verifierOuvert(ctx, l.periode);
    await ctx.db.delete(ligneId);
  },
});

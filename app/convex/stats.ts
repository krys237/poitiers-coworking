import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireLevel } from "./lib/authz";
import { totalEspeces, chiffreAffaires, totauxCaisse, montantTotalPrime, CATEGORIES_PRIMES } from "./lib/stats";

const CHAMPS_CAISSE = {
  dateDebut: v.string(), dateFin: v.string(), horaires: v.optional(v.string()),
  caissePP: v.number(), scanner: v.number(), quantiferon: v.number(), tenofovir: v.number(), greenEnergy: v.number(),
  esthetique: v.number(), therapieVie: v.number(), therapieSommeil: v.number(), assurance: v.number(), tepScan: v.number(), sortiesDuJour: v.number(),
};
const CATEGORIE = v.union(...CATEGORIES_PRIMES.map(([k]) => v.literal(k)));

const moisPrecedents = (periode: string, n: number) => {
  const out: string[] = []; let y = +periode.slice(0, 4), m = +periode.slice(5, 7);
  for (let i = 0; i < n; i++) { out.unshift(`${y}-${String(m).padStart(2, "0")}`); m--; if (m === 0) { m = 12; y--; } }
  return out;
};

// ---- Tableau de caisse ----
export const caisse = query({
  args: { periode: v.string() },
  handler: async (ctx, { periode }) => {
    await requireLevel(ctx, 3);
    const lignes = (await ctx.db.query("statsCaisse").withIndex("by_periode", (q) => q.eq("periode", periode)).collect())
      .sort((a, b) => a.dateDebut.localeCompare(b.dateDebut))
      .map((l) => ({ ...l, totalEspeces: totalEspeces(l), chiffreAffaires: chiffreAffaires(l) }));
    return { periode, lignes, totaux: totauxCaisse(lignes) };
  },
});

export const enregistrerLigne = mutation({
  args: { ligneId: v.optional(v.id("statsCaisse")), periode: v.string(), ...CHAMPS_CAISSE },
  handler: async (ctx, { ligneId, ...l }) => {
    await requireLevel(ctx, 3);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(l.dateDebut) || !/^\d{4}-\d{2}-\d{2}$/.test(l.dateFin)) throw new Error("Dates au format AAAA-MM-JJ.");
    if (l.dateFin < l.dateDebut) throw new Error("La date de fin précède la date de début.");
    if (ligneId) { await ctx.db.patch(ligneId, l); return ligneId; }
    return await ctx.db.insert("statsCaisse", l);
  },
});

export const supprimerLigne = mutation({
  args: { ligneId: v.id("statsCaisse") },
  handler: async (ctx, { ligneId }) => { await requireLevel(ctx, 3); await ctx.db.delete(ligneId); },
});

export const importerCaisse = mutation({
  args: { periode: v.string(), lignes: v.array(v.object(CHAMPS_CAISSE)) },
  handler: async (ctx, { periode, lignes }) => {
    await requireLevel(ctx, 3);
    for (const l of lignes) await ctx.db.insert("statsCaisse", { periode, ...l });
    return { importees: lignes.length };
  },
});

// ---- Primes médecins (contexte "stats") ----
export const primes = query({
  args: { periode: v.string(), categorie: v.optional(CATEGORIE) },
  handler: async (ctx, { periode, categorie }) => {
    await requireLevel(ctx, 3);
    const rows = categorie
      ? await ctx.db.query("primesMedecins").withIndex("by_contexte_periode_categorie", (q) => q.eq("contexte", "stats").eq("periode", periode).eq("categorie", categorie)).collect()
      : await ctx.db.query("primesMedecins").withIndex("by_contexte_periode", (q) => q.eq("contexte", "stats").eq("periode", periode)).collect();
    const parCategorie: Record<string, number> = {};
    for (const [k] of CATEGORIES_PRIMES) parCategorie[k] = 0;
    for (const r of rows) parCategorie[r.categorie] = (parCategorie[r.categorie] ?? 0) + r.montant;
    return { periode, lignes: rows.sort((a, b) => a.designation.localeCompare(b.designation)), total: rows.reduce((t, r) => t + r.montant, 0), parCategorie };
  },
});

export const enregistrerPrime = mutation({
  args: {
    primeId: v.optional(v.id("primesMedecins")), periode: v.string(), categorie: CATEGORIE, designation: v.string(),
    dateDebut: v.optional(v.string()), dateFin: v.optional(v.string()), actes: v.number(), montantUnitaire: v.number(), notes: v.optional(v.string()),
  },
  handler: async (ctx, { primeId, ...p }) => {
    await requireLevel(ctx, 3);
    if (!p.designation.trim()) throw new Error("Nom du médecin requis.");
    const doc = { contexte: "stats" as const, ...p, designation: p.designation.trim(), montant: montantTotalPrime(p.actes, p.montantUnitaire) };
    if (primeId) { await ctx.db.patch(primeId, doc); return primeId; }
    return await ctx.db.insert("primesMedecins", doc);
  },
});

export const supprimerPrime = mutation({
  args: { primeId: v.id("primesMedecins") },
  handler: async (ctx, { primeId }) => { await requireLevel(ctx, 3); await ctx.db.delete(primeId); },
});

export const importerPrimes = mutation({
  args: {
    periode: v.string(), categorie: CATEGORIE,
    lignes: v.array(v.object({ designation: v.string(), dateDebut: v.optional(v.string()), dateFin: v.optional(v.string()), actes: v.number(), montantUnitaire: v.number(), notes: v.optional(v.string()) })),
  },
  handler: async (ctx, { periode, categorie, lignes }) => {
    await requireLevel(ctx, 3);
    for (const l of lignes) await ctx.db.insert("primesMedecins", { contexte: "stats", periode, categorie, ...l, montant: montantTotalPrime(l.actes, l.montantUnitaire) });
    return { importees: lignes.length };
  },
});

// ---- Graphes & KPI ----
export const graphes = query({
  args: { periode: v.string() },
  handler: async (ctx, { periode }) => {
    await requireLevel(ctx, 3);
    const caParMois = [];
    for (const p of moisPrecedents(periode, 6)) {
      const lignes = await ctx.db.query("statsCaisse").withIndex("by_periode", (q) => q.eq("periode", p)).collect();
      caParMois.push({ periode: p, chiffreAffaires: lignes.reduce((t, l) => t + chiffreAffaires(l), 0), totalEspeces: lignes.reduce((t, l) => t + totalEspeces(l), 0) });
    }
    const primes = await ctx.db.query("primesMedecins").withIndex("by_contexte_periode", (q) => q.eq("contexte", "stats").eq("periode", periode)).collect();
    const primesParCategorie = CATEGORIES_PRIMES.map(([k, libelle]) => ({ categorie: k, libelle, montant: primes.filter((p) => p.categorie === k).reduce((t, p) => t + p.montant, 0) }));
    return { caParMois, primesParCategorie };
  },
});

export const kpi = query({
  args: { periode: v.string() },
  handler: async (ctx, { periode }) => {
    await requireLevel(ctx, 1);
    const lignes = await ctx.db.query("statsCaisse").withIndex("by_periode", (q) => q.eq("periode", periode)).collect();
    const primes = await ctx.db.query("primesMedecins").withIndex("by_contexte_periode", (q) => q.eq("contexte", "stats").eq("periode", periode)).collect();
    return { periode, chiffreAffaires: lignes.reduce((t, l) => t + chiffreAffaires(l), 0), nbLignes: lignes.length, primes: primes.reduce((t, p) => t + p.montant, 0) };
  },
});

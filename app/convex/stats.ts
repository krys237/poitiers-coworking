import { query, mutation, MutationCtx, QueryCtx } from "./_generated/server";
import { Doc } from "./_generated/dataModel";
import { v } from "convex/values";
import { requireDroit, droitsDuMembre } from "./lib/authz";
import { journaliser } from "./lib/journal";
import { lireReglages } from "./parametres";
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

// ---- Verrou de saisie (demande de M. GAMBOU, 28/09/2026) ----
// Une ligne de caisse ou de prime médecin reste modifiable `verrouCaisseMin` minutes après sa saisie
// (Paramètres → Fonctionnement, 60 par défaut). Au-delà, seul le droit « Caisse & primes : modifier après
// le délai » (le DG par défaut) peut la corriger ou la supprimer — et c'est journalisé.
async function etatVerrou(ctx: QueryCtx | MutationCtx, user: Doc<"users">) {
  const { verrouCaisseMin } = await lireReglages(ctx);
  const peutDeverrouiller = (await droitsDuMembre(ctx, user))["/statistiques/deverrouillage"].faire;
  return { verrouMin: verrouCaisseMin, peutDeverrouiller };
}

async function controlerVerrou(ctx: MutationCtx, user: Doc<"users">, doc: { _creationTime: number }, quoi: string) {
  const { verrouMin, peutDeverrouiller } = await etatVerrou(ctx, user);
  if (Date.now() - doc._creationTime <= verrouMin * 60_000) return;
  if (!peutDeverrouiller) throw new Error(`Saisie verrouillée : une ligne reste modifiable ${verrouMin} min après sa saisie. Au-delà, seul un administrateur peut la corriger.`);
  await journaliser(ctx, { auteurId: user._id, auteurNom: user.nom ?? user.email, action: "caisse_modification_tardive", cible: quoi, detail: `saisie du ${new Date(doc._creationTime).toLocaleString("fr-FR", { timeZone: "Africa/Douala" })}` });
}

// ---- Tableau de caisse ----
export const caisse = query({
  args: { periode: v.string() },
  handler: async (ctx, { periode }) => {
    const me = await requireDroit(ctx, "/statistiques");
    const lignes = (await ctx.db.query("statsCaisse").withIndex("by_periode", (q) => q.eq("periode", periode)).collect())
      .sort((a, b) => a.dateDebut.localeCompare(b.dateDebut))
      .map((l) => ({ ...l, totalEspeces: totalEspeces(l), chiffreAffaires: chiffreAffaires(l) }));
    return { periode, lignes, totaux: totauxCaisse(lignes), ...(await etatVerrou(ctx, me)) };
  },
});

export const enregistrerLigne = mutation({
  args: { ligneId: v.optional(v.id("statsCaisse")), periode: v.string(), ...CHAMPS_CAISSE },
  handler: async (ctx, { ligneId, ...l }) => {
    const me = await requireDroit(ctx, "/statistiques", "faire");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(l.dateDebut) || !/^\d{4}-\d{2}-\d{2}$/.test(l.dateFin)) throw new Error("Dates au format AAAA-MM-JJ.");
    if (l.dateFin < l.dateDebut) throw new Error("La date de fin précède la date de début.");
    if (ligneId) {
      const avant = await ctx.db.get(ligneId);
      if (!avant) throw new Error("Ligne introuvable.");
      await controlerVerrou(ctx, me, avant, `caisse du ${avant.dateDebut} au ${avant.dateFin} (modification)`);
      await ctx.db.patch(ligneId, l); return ligneId;
    }
    return await ctx.db.insert("statsCaisse", l);
  },
});

export const supprimerLigne = mutation({
  args: { ligneId: v.id("statsCaisse") },
  handler: async (ctx, { ligneId }) => {
    const me = await requireDroit(ctx, "/statistiques", "faire");
    const l = await ctx.db.get(ligneId);
    if (!l) return;
    await controlerVerrou(ctx, me, l, `caisse du ${l.dateDebut} au ${l.dateFin} (suppression)`);
    await ctx.db.delete(ligneId);
  },
});

export const importerCaisse = mutation({
  args: { periode: v.string(), lignes: v.array(v.object(CHAMPS_CAISSE)) },
  handler: async (ctx, { periode, lignes }) => {
    await requireDroit(ctx, "/statistiques", "faire");
    for (const l of lignes) await ctx.db.insert("statsCaisse", { periode, ...l });
    return { importees: lignes.length };
  },
});

// ---- Primes médecins (contexte "stats") ----
export const primes = query({
  args: { periode: v.string(), categorie: v.optional(CATEGORIE) },
  handler: async (ctx, { periode, categorie }) => {
    const me = await requireDroit(ctx, "/statistiques");
    const rows = categorie
      ? await ctx.db.query("primesMedecins").withIndex("by_contexte_periode_categorie", (q) => q.eq("contexte", "stats").eq("periode", periode).eq("categorie", categorie)).collect()
      : await ctx.db.query("primesMedecins").withIndex("by_contexte_periode", (q) => q.eq("contexte", "stats").eq("periode", periode)).collect();
    const parCategorie: Record<string, number> = {};
    for (const [k] of CATEGORIES_PRIMES) parCategorie[k] = 0;
    for (const r of rows) parCategorie[r.categorie] = (parCategorie[r.categorie] ?? 0) + r.montant;
    return { periode, lignes: rows.sort((a, b) => a.designation.localeCompare(b.designation)), total: rows.reduce((t, r) => t + r.montant, 0), parCategorie, ...(await etatVerrou(ctx, me)) };
  },
});

export const enregistrerPrime = mutation({
  args: {
    primeId: v.optional(v.id("primesMedecins")), periode: v.string(), categorie: CATEGORIE, designation: v.string(),
    dateDebut: v.optional(v.string()), dateFin: v.optional(v.string()), actes: v.number(), montantUnitaire: v.number(), notes: v.optional(v.string()),
  },
  handler: async (ctx, { primeId, ...p }) => {
    const me = await requireDroit(ctx, "/statistiques", "faire");
    if (!p.designation.trim()) throw new Error("Nom du médecin requis.");
    const doc = { contexte: "stats" as const, ...p, designation: p.designation.trim(), montant: montantTotalPrime(p.actes, p.montantUnitaire) };
    if (primeId) {
      const avant = await ctx.db.get(primeId);
      if (!avant) throw new Error("Prime introuvable.");
      await controlerVerrou(ctx, me, avant, `prime de ${avant.designation} (modification)`);
      await ctx.db.patch(primeId, doc); return primeId;
    }
    return await ctx.db.insert("primesMedecins", doc);
  },
});

export const supprimerPrime = mutation({
  args: { primeId: v.id("primesMedecins") },
  handler: async (ctx, { primeId }) => {
    const me = await requireDroit(ctx, "/statistiques", "faire");
    const p = await ctx.db.get(primeId);
    if (!p) return;
    await controlerVerrou(ctx, me, p, `prime de ${p.designation} (suppression)`);
    await ctx.db.delete(primeId);
  },
});

export const importerPrimes = mutation({
  args: {
    periode: v.string(), categorie: CATEGORIE,
    lignes: v.array(v.object({ designation: v.string(), dateDebut: v.optional(v.string()), dateFin: v.optional(v.string()), actes: v.number(), montantUnitaire: v.number(), notes: v.optional(v.string()) })),
  },
  handler: async (ctx, { periode, categorie, lignes }) => {
    await requireDroit(ctx, "/statistiques", "faire");
    for (const l of lignes) await ctx.db.insert("primesMedecins", { contexte: "stats", periode, categorie, ...l, montant: montantTotalPrime(l.actes, l.montantUnitaire) });
    return { importees: lignes.length };
  },
});

// ---- Graphes & KPI ----
export const graphes = query({
  args: { periode: v.string() },
  handler: async (ctx, { periode }) => {
    await requireDroit(ctx, "/statistiques");
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
    await requireDroit(ctx, "/statistiques");
    const lignes = await ctx.db.query("statsCaisse").withIndex("by_periode", (q) => q.eq("periode", periode)).collect();
    const primes = await ctx.db.query("primesMedecins").withIndex("by_contexte_periode", (q) => q.eq("contexte", "stats").eq("periode", periode)).collect();
    return { periode, chiffreAffaires: lignes.reduce((t, l) => t + chiffreAffaires(l), 0), nbLignes: lignes.length, primes: primes.reduce((t, p) => t + p.montant, 0) };
  },
});

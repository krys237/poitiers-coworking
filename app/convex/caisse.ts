// Caisse du mois : intervalles de recettes (11 postes), total espèces et chiffre d'affaires calculés.
// Module séparé des Primes médecins depuis le 09/10/2026 : les deux écrans relèvent de personnes
// différentes, donc de droits différents (`/caisse` et `/primes-medecins`).
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireDroit, requireEntiteSiFournie } from "./lib/authz";
import { controlerVerrou, etatVerrou, moisPrecedents } from "./lib/verrouSaisie";
import { totalEspeces, chiffreAffaires, totauxCaisse } from "./lib/stats";
import { internal } from "./_generated/api";
import { lireReglages } from "./parametres";

const DEVERROUILLAGE = "/caisse/deverrouillage";

const CHAMPS = {
  dateDebut: v.string(), dateFin: v.string(), horaires: v.optional(v.string()),
  caissePP: v.number(), scanner: v.number(), quantiferon: v.number(), tenofovir: v.number(), greenEnergy: v.number(),
  esthetique: v.number(), therapieVie: v.number(), therapieSommeil: v.number(), assurance: v.number(), tepScan: v.number(), sortiesDuJour: v.number(),
};

export const liste = query({
  args: { entiteId: v.optional(v.id("entites")), periode: v.string() },
  handler: async (ctx, { entiteId, periode }) => {
    const me = await requireDroit(ctx, "/caisse");
    await requireEntiteSiFournie(ctx, entiteId);
    const lignes = (
      entiteId
        ? await ctx.db.query("statsCaisse").withIndex("by_entite_periode", (q) => q.eq("entiteId", entiteId).eq("periode", periode)).collect()
        : await ctx.db.query("statsCaisse").withIndex("by_periode", (q) => q.eq("periode", periode)).collect()
    )
      .sort((a, b) => a.dateDebut.localeCompare(b.dateDebut))
      .map((l) => ({ ...l, totalEspeces: totalEspeces(l), chiffreAffaires: chiffreAffaires(l) }));
    return { periode, lignes, totaux: totauxCaisse(lignes), ...(await etatVerrou(ctx, me, DEVERROUILLAGE)) };
  },
});

export const enregistrerLigne = mutation({
  args: { entiteId: v.optional(v.id("entites")), ligneId: v.optional(v.id("statsCaisse")), periode: v.string(), ...CHAMPS },
  handler: async (ctx, { ligneId, ...l }) => {
    const me = await requireDroit(ctx, "/caisse", "faire");
    await requireEntiteSiFournie(ctx, l.entiteId);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(l.dateDebut) || !/^\d{4}-\d{2}-\d{2}$/.test(l.dateFin)) throw new Error("Dates au format AAAA-MM-JJ.");
    if (l.dateFin < l.dateDebut) throw new Error("La date de fin précède la date de début.");
    if (ligneId) {
      const avant = await ctx.db.get(ligneId);
      if (!avant) throw new Error("Ligne introuvable.");
      await controlerVerrou(ctx, me, avant, DEVERROUILLAGE, `caisse du ${avant.dateDebut} au ${avant.dateFin} (modification)`);
      await ctx.db.patch(ligneId, l); return ligneId;
    }
    const id = await ctx.db.insert("statsCaisse", l);
    const doc = await ctx.db.get(id);
    const reglages = await lireReglages(ctx);
    if (doc && reglages.verrouCaisseMin > 10) {
      await ctx.scheduler.runAfter(
        (reglages.verrouCaisseMin - 10) * 60_000,
        internal.rappels.delaiCaisseBientotExpire,
        { ligneId: id, membreId: me._id, creationTime: doc._creationTime },
      );
    }
    return id;
  },
});

export const supprimerLigne = mutation({
  args: { ligneId: v.id("statsCaisse") },
  handler: async (ctx, { ligneId }) => {
    const me = await requireDroit(ctx, "/caisse", "faire");
    const l = await ctx.db.get(ligneId);
    if (!l) return;
    await controlerVerrou(ctx, me, l, DEVERROUILLAGE, `caisse du ${l.dateDebut} au ${l.dateFin} (suppression)`);
    await ctx.db.delete(ligneId);
  },
});

export const importer = mutation({
  args: { entiteId: v.optional(v.id("entites")), periode: v.string(), lignes: v.array(v.object(CHAMPS)) },
  handler: async (ctx, { entiteId, periode, lignes }) => {
    await requireDroit(ctx, "/caisse", "faire");
    await requireEntiteSiFournie(ctx, entiteId);
    for (const l of lignes) await ctx.db.insert("statsCaisse", { entiteId, periode, ...l });
    return { importees: lignes.length };
  },
});

/** Chiffre d'affaires et total espèces des 6 derniers mois (graphe de l'écran). */
export const graphe = query({
  args: { entiteId: v.optional(v.id("entites")), periode: v.string() },
  handler: async (ctx, { entiteId, periode }) => {
    await requireDroit(ctx, "/caisse");
    await requireEntiteSiFournie(ctx, entiteId);
    const caParMois = [];
    for (const p of moisPrecedents(periode, 6)) {
      const lignes = entiteId
        ? await ctx.db.query("statsCaisse").withIndex("by_entite_periode", (q) => q.eq("entiteId", entiteId).eq("periode", p)).collect()
        : await ctx.db.query("statsCaisse").withIndex("by_periode", (q) => q.eq("periode", p)).collect();
      caParMois.push({ periode: p, chiffreAffaires: lignes.reduce((t, l) => t + chiffreAffaires(l), 0), totalEspeces: lignes.reduce((t, l) => t + totalEspeces(l), 0) });
    }
    return { caParMois };
  },
});

/** Chiffre d'affaires du mois, pour la tuile du tableau de bord. */
export const kpi = query({
  args: { entiteId: v.optional(v.id("entites")), periode: v.string() },
  handler: async (ctx, { entiteId, periode }) => {
    await requireDroit(ctx, "/caisse");
    await requireEntiteSiFournie(ctx, entiteId);
    const lignes = entiteId
      ? await ctx.db.query("statsCaisse").withIndex("by_entite_periode", (q) => q.eq("entiteId", entiteId).eq("periode", periode)).collect()
      : await ctx.db.query("statsCaisse").withIndex("by_periode", (q) => q.eq("periode", periode)).collect();
    return { periode, chiffreAffaires: lignes.reduce((t, l) => t + chiffreAffaires(l), 0), nbLignes: lignes.length };
  },
});

import { query, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { requireLevel } from "./lib/authz";

// Mois clôturés : agrégats, état des envois et des PDF archivés.
export const liste = query({
  args: {},
  handler: async (ctx) => {
    await requireLevel(ctx, 4);
    const clotures = (await ctx.db.query("cloturesPaie").collect()).sort((a, b) => b.periode.localeCompare(a.periode));
    const out = [];
    for (const c of clotures) {
      const bulletins = await ctx.db.query("bulletins").withIndex("by_periode", (q) => q.eq("periode", c.periode)).collect();
      const user = await ctx.db.get(c.closedBy);
      out.push({
        periode: c.periode, closedAt: c.closedAt, closedBy: user?.nom ?? user?.email ?? "?",
        nombre: bulletins.length,
        brut: bulletins.reduce((t, b) => t + b.brut, 0),
        net: bulletins.reduce((t, b) => t + b.net, 0),
        envoyes: bulletins.filter((b) => b.statut === "envoye").length,
        pdfs: bulletins.filter((b) => b.pdfId).length,
      });
    }
    return out;
  },
});

// Bulletins figés d'un mois clôturé, avec nom d'employé et URL du PDF archivé.
export const bulletinsDuMois = query({
  args: { periode: v.string() },
  handler: async (ctx, { periode }) => {
    await requireLevel(ctx, 4);
    const bulletins = await ctx.db.query("bulletins").withIndex("by_periode", (q) => q.eq("periode", periode)).collect();
    const out = [];
    for (const b of bulletins) {
      const e = await ctx.db.get(b.employeId);
      out.push({
        bulletinId: b._id, employeId: b.employeId, nom: e?.nom ?? "?", matricule: e?.matricule ?? "", societe: b.societe,
        brut: b.brut, net: b.net, statut: b.statut, envoyeLe: b.envoyeLe, genereLe: b.genereLe,
        pdfUrl: b.pdfId ? await ctx.storage.getUrl(b.pdfId) : null,
      });
    }
    return out.sort((a, b) => a.nom.localeCompare(b.nom));
  },
});

// Données nécessaires à la génération des PDF d'un mois clôturé (appelé par l'action Node).
export const snapshotsPourPdf = internalQuery({
  args: { periode: v.string() },
  handler: async (ctx, { periode }) => {
    await requireLevel(ctx, 4);
    const cloture = await ctx.db.query("cloturesPaie").withIndex("by_periode", (q) => q.eq("periode", periode)).unique();
    if (!cloture) throw new Error(`Le mois ${periode} n'est pas clôturé : rien à archiver.`);
    const entreprise = await ctx.db.query("parametresEntreprise").first();
    const ent = { nom: entreprise?.nom ?? "", adresse: entreprise?.adresse, couleurEntete: entreprise?.couleurEntete, filigrane: entreprise?.filigrane };
    const bulletins = await ctx.db.query("bulletins").withIndex("by_periode", (q) => q.eq("periode", periode)).collect();
    const out = [];
    for (const b of bulletins) {
      const e = await ctx.db.get(b.employeId);
      if (!e) continue;
      out.push({
        bulletinId: b._id, pdfId: b.pdfId ?? null, entreprise: ent,
        bulletin: {
          nom: e.nom, matricule: e.matricule, fonction: e.fonction, cnps: e.cnps, niu: e.niu, societe: b.societe,
          brut: b.brut, totalRetenues: b.totalRetenues, net: b.net, lignesGain: b.lignesGain, cotisations: b.cotisations,
        },
      });
    }
    return out;
  },
});

export const enregistrerPdf = internalMutation({
  args: { bulletinId: v.id("bulletins"), pdfId: v.id("_storage") },
  handler: async (ctx, { bulletinId, pdfId }) => { await ctx.db.patch(bulletinId, { pdfId }); },
});

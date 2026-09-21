import { query, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { requireLevel } from "./lib/authz";
import { bulletinsPourPeriode } from "./lib/calculBulletins";

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
    // Pas de contrôle de niveau ici : l'action publique `paiePdf.archiverPdfs` l'exige (niv. 4), et la
    // variante planifiée à la clôture tourne sans identité. Interne = injoignable depuis le client.
    const cloture = await ctx.db.query("cloturesPaie").withIndex("by_periode", (q) => q.eq("periode", periode)).unique();
    if (!cloture) throw new Error(`Le mois ${periode} n'est pas clôturé : rien à archiver.`);
    const entreprise = await ctx.db.query("parametresEntreprise").first();
    const ent = {
      nom: entreprise?.nom ?? "", adresse: entreprise?.adresse, couleurEntete: entreprise?.couleurEntete, filigrane: entreprise?.filigrane,
      niu: entreprise?.niu, numeroCnps: entreprise?.numeroCnps, responsableRH: entreprise?.responsableRH,
    };
    // La forme unifiée (snapshots figés + identité + période + validation) : la même que l'écran et le courrier.
    const r = await bulletinsPourPeriode(ctx, periode);
    const figes = await ctx.db.query("bulletins").withIndex("by_periode", (q) => q.eq("periode", periode)).collect();
    const out = [];
    for (const f of figes) {
      const b = r.bulletins.find((x) => String(x.employeId) === String(f.employeId));
      if (!b) continue;
      out.push({ bulletinId: f._id, pdfId: f.pdfId ?? null, entreprise: ent, bulletin: b });
    }
    return out;
  },
});

export const enregistrerPdf = internalMutation({
  args: { bulletinId: v.id("bulletins"), pdfId: v.id("_storage") },
  handler: async (ctx, { bulletinId, pdfId }) => { await ctx.db.patch(bulletinId, { pdfId }); },
});

// Retire les PDF archivés d'un mois (fichiers supprimés du stockage, bulletins remis « à générer »).
// Outil d'administration (CLI) : `npx convex run archives:retirerPdfs '{"periode":"2026-07"}'`.
export const retirerPdfs = internalMutation({
  args: { periode: v.string() },
  handler: async (ctx, { periode }) => {
    const bulletins = await ctx.db.query("bulletins").withIndex("by_periode", (q) => q.eq("periode", periode)).collect();
    let retires = 0;
    for (const b of bulletins) {
      if (!b.pdfId) continue;
      await ctx.storage.delete(b.pdfId);
      await ctx.db.patch(b._id, { pdfId: undefined });
      retires++;
    }
    return { periode, retires };
  },
});

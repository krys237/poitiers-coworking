import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAudit } from "./lib/authz";
import { journaliser } from "./lib/journal";
import { CATEGORIES_AUDIT, LIBELLE_AUDIT, estCategorieAudit, totalLignes, variation, derniersMois, moisPrecedent } from "./lib/audit";
import { bulletinsPourPeriode } from "./lib/calculBulletins";

// Module Audit — cloisonné : chaque fonction exige l'auditeur externe ou le DG (lib/authz.requireAudit).
const verifierCategorie = (c: string) => { if (!estCategorieAudit(c)) throw new Error(`Catégorie d'audit inconnue : ${c}`); };
const ligneV = { designation: v.string(), dateDebut: v.optional(v.string()), dateFin: v.optional(v.string()), montant: v.number(), notes: v.optional(v.string()) };

export const categories = query({ args: {}, handler: async (ctx) => { await requireAudit(ctx); return CATEGORIES_AUDIT.map(([cle, libelle]) => ({ cle, libelle })); } });

export const lignes = query({
  args: { periode: v.string(), categorie: v.string() },
  handler: async (ctx, { periode, categorie }) => {
    await requireAudit(ctx); verifierCategorie(categorie);
    const rows = await ctx.db.query("primesMedecins")
      .withIndex("by_contexte_periode_categorie", (q) => q.eq("contexte", "audit").eq("periode", periode).eq("categorie", categorie)).collect();
    const l = rows.map((r) => ({ ligneId: r._id, designation: r.designation, dateDebut: r.dateDebut, dateFin: r.dateFin, montant: r.montant, notes: r.notes }))
      .sort((a, b) => a.designation.localeCompare(b.designation));
    return { periode, categorie, libelle: LIBELLE_AUDIT[categorie], lignes: l, total: totalLignes(l) };
  },
});

export const enregistrerLigne = mutation({
  args: { ligneId: v.optional(v.id("primesMedecins")), periode: v.string(), categorie: v.string(), ...ligneV },
  handler: async (ctx, { ligneId, periode, categorie, ...l }) => {
    await requireAudit(ctx); verifierCategorie(categorie);
    if (!l.designation.trim()) throw new Error("Désignation requise.");
    const doc = { contexte: "audit" as const, periode, categorie, designation: l.designation.trim(), dateDebut: l.dateDebut || undefined, dateFin: l.dateFin || undefined, montant: Math.round(l.montant), notes: l.notes || undefined };
    if (ligneId) { await ctx.db.patch(ligneId, doc); return ligneId; }
    return await ctx.db.insert("primesMedecins", doc);
  },
});

export const supprimerLigne = mutation({
  args: { ligneId: v.id("primesMedecins") },
  handler: async (ctx, { ligneId }) => { await requireAudit(ctx); const l = await ctx.db.get(ligneId); if (l?.contexte === "audit") await ctx.db.delete(ligneId); },
});

export const importerLignes = mutation({
  args: { periode: v.string(), categorie: v.string(), lignes: v.array(v.object(ligneV)) },
  handler: async (ctx, { periode, categorie, lignes }) => {
    await requireAudit(ctx); verifierCategorie(categorie);
    let n = 0;
    for (const l of lignes) {
      if (!l.designation.trim()) continue;
      await ctx.db.insert("primesMedecins", { contexte: "audit", periode, categorie, designation: l.designation.trim(), dateDebut: l.dateDebut || undefined, dateFin: l.dateFin || undefined, montant: Math.round(l.montant), notes: l.notes || undefined });
      n++;
    }
    return { importees: n };
  },
});

export const rapport = query({
  args: { periode: v.string(), categorie: v.string() },
  handler: async (ctx, { periode, categorie }) => {
    await requireAudit(ctx); verifierCategorie(categorie);
    const r = await ctx.db.query("rapportsAudit").withIndex("by_categorie_periode", (q) => q.eq("categorie", categorie).eq("periode", periode)).first();
    if (!r) return null;
    const auteur = await ctx.db.get(r.auteurId);
    return { contenu: r.contenu, majLe: r.majLe, auteur: auteur?.nom ?? auteur?.email ?? "?" };
  },
});

export const enregistrerRapport = mutation({
  args: { periode: v.string(), categorie: v.string(), contenu: v.string() },
  handler: async (ctx, { periode, categorie, contenu }) => {
    const me = await requireAudit(ctx); verifierCategorie(categorie);
    const majLe = new Date().toISOString();
    const r = await ctx.db.query("rapportsAudit").withIndex("by_categorie_periode", (q) => q.eq("categorie", categorie).eq("periode", periode)).first();
    if (r) await ctx.db.patch(r._id, { contenu, auteurId: me._id, majLe });
    else await ctx.db.insert("rapportsAudit", { periode, categorie, contenu, auteurId: me._id, majLe });
    await journaliser(ctx, { auteurId: me._id, auteurNom: me.nom ?? me.email, action: "audit_rapport", cible: `${categorie} ${periode}`, detail: `${contenu.length} caractères` });
  },
});

// Totaux par catégorie du mois, avec variation par rapport au mois précédent (cartes de synthèse).
export const resume = query({
  args: { periode: v.string() },
  handler: async (ctx, { periode }) => {
    await requireAudit(ctx);
    const prec = moisPrecedent(periode);
    const somme = async (p: string) => {
      const rows = await ctx.db.query("primesMedecins").withIndex("by_contexte_periode", (q) => q.eq("contexte", "audit").eq("periode", p)).collect();
      const t: Record<string, number> = {};
      for (const r of rows) t[r.categorie] = (t[r.categorie] ?? 0) + r.montant;
      return t;
    };
    const [cur, prev] = [await somme(periode), await somme(prec)];
    const rapports = await ctx.db.query("rapportsAudit").collect();
    const avecRapport = new Set(rapports.filter((r) => r.periode === periode).map((r) => r.categorie));
    return {
      periode, precedent: prec,
      categories: CATEGORIES_AUDIT.map(([cle, libelle]) => ({ cle, libelle, total: cur[cle] ?? 0, precedent: prev[cle] ?? 0, ...variation(prev[cle] ?? 0, cur[cle] ?? 0), rapport: avecRapport.has(cle) })),
      total: Object.values(cur).reduce((a, b) => a + b, 0), totalPrecedent: Object.values(prev).reduce((a, b) => a + b, 0),
    };
  },
});

// « Total salaires reçus » : 6 derniers mois — bulletins figés (mois clôturés) ou calcul du mois ouvert.
export const totalSalaires = query({
  args: { periode: v.string(), mois: v.optional(v.number()) },
  handler: async (ctx, { periode, mois }) => {
    await requireAudit(ctx);
    const out = [];
    let prev: number | null = null;
    for (const p of derniersMois(periode, mois ?? 6)) {
      const r = await bulletinsPourPeriode(ctx, p);
      const brut = r.bulletins.reduce((t, b) => t + b.brut, 0), retenues = r.bulletins.reduce((t, b) => t + b.totalRetenues, 0), net = r.bulletins.reduce((t, b) => t + b.net, 0);
      out.push({ periode: p, cloture: r.cloture, nombre: r.bulletins.length, brut, retenues, net, ...(prev === null ? { delta: 0, pct: null } : variation(prev, net)) });
      prev = net;
    }
    return out;
  },
});

export const graphes = query({
  args: { periode: v.string() },
  handler: async (ctx, { periode }) => {
    await requireAudit(ctx);
    const rows = await ctx.db.query("primesMedecins").withIndex("by_contexte_periode", (q) => q.eq("contexte", "audit").eq("periode", periode)).collect();
    const t: Record<string, number> = {};
    for (const r of rows) t[r.categorie] = (t[r.categorie] ?? 0) + r.montant;
    const parCategorie = CATEGORIES_AUDIT.filter(([cle]) => t[cle]).map(([cle, libelle]) => ({ key: cle, label: libelle, value: t[cle] }));
    const salaires = [];
    for (const p of derniersMois(periode, 6)) {
      const r = await bulletinsPourPeriode(ctx, p);
      salaires.push({ key: p, label: p, value: r.bulletins.reduce((s, b) => s + b.net, 0) });
    }
    return { parCategorie, salaires };
  },
});

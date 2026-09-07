import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Doc } from "./_generated/dataModel";
import { requireLevel } from "./lib/authz";
import { comparer, totalCommande, reference } from "./lib/commandes";

const TYPE = v.union(v.literal("medicale"), v.literal("fourniture"));
const STATUT = v.union(v.literal("en_attente"), v.literal("validee"), v.literal("rejetee"), v.literal("livree"));
const LIGNE = v.object({ produit: v.string(), dci: v.optional(v.string()), quantite: v.number(), prixUnitaire: v.number() });

// Transitions autorisées du workflow.
const TRANSITIONS: Record<string, string[]> = { en_attente: ["validee", "rejetee"], validee: ["livree"], rejetee: [], livree: [] };

// Commande précédente du même type (date antérieure, sinon créée avant le même jour).
function precedente(c: Doc<"commandes">, toutes: Doc<"commandes">[]) {
  return toutes
    .filter((x) => x.type === c.type && x._id !== c._id && (x.date < c.date || (x.date === c.date && x._creationTime < c._creationTime)))
    .sort((a, b) => b.date.localeCompare(a.date) || b._creationTime - a._creationTime)[0] ?? null;
}

export const liste = query({
  args: { type: v.optional(TYPE) },
  handler: async (ctx, { type }) => {
    await requireLevel(ctx, 3);
    const rows = type
      ? await ctx.db.query("commandes").withIndex("by_type_date", (q) => q.eq("type", type)).order("desc").collect()
      : await ctx.db.query("commandes").withIndex("by_date").order("desc").collect();
    return rows.map((c) => ({
      _id: c._id, reference: c.reference, type: c.type, libelle: c.libelle, date: c.date, demandeur: c.demandeur, service: c.service,
      statut: c.statut, total: totalCommande(c.lignes), nbLignes: c.lignes.length, nbCommentaires: c.commentaires.length, creeLe: c._creationTime,
    }));
  },
});

// Détail + comparaison automatique avec la commande précédente du même type.
export const detail = query({
  args: { commandeId: v.id("commandes") },
  handler: async (ctx, { commandeId }) => {
    await requireLevel(ctx, 3);
    const c = await ctx.db.get(commandeId);
    if (!c) return null;
    const toutes = await ctx.db.query("commandes").withIndex("by_type", (q) => q.eq("type", c.type)).collect();
    const prev = precedente(c, toutes);
    const validePar = c.validePar ? await ctx.db.get(c.validePar) : null;
    return {
      ...c, total: totalCommande(c.lignes), validateur: validePar?.nom ?? validePar?.email ?? null,
      precedente: prev ? { _id: prev._id, reference: prev.reference, date: prev.date, total: totalCommande(prev.lignes) } : null,
      comparaison: prev ? comparer(prev.lignes, c.lignes) : null,
    };
  },
});

export const creer = mutation({
  args: {
    type: TYPE, libelle: v.optional(v.string()), date: v.string(), demandeur: v.string(), service: v.optional(v.string()),
    lignes: v.array(LIGNE), commentaire: v.optional(v.string()),
  },
  handler: async (ctx, a) => {
    const user = await requireLevel(ctx, 3);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(a.date)) throw new Error("Date au format AAAA-MM-JJ.");
    const lignes = a.lignes.map((l) => ({ ...l, produit: l.produit.trim(), dci: l.dci?.trim() || undefined })).filter((l) => l.produit);
    if (!lignes.length) throw new Error("Au moins une ligne de produit est requise.");
    if (lignes.some((l) => !(l.quantite > 0) || l.prixUnitaire < 0)) throw new Error("Quantités > 0 et prix ≥ 0 requis.");
    const annee = +a.date.slice(0, 4);
    const existantes = await ctx.db.query("commandes").withIndex("by_date", (q) => q.gte("date", `${annee}-01-01`).lte("date", `${annee}-12-31`)).collect();
    const ref = reference("CMD", annee, existantes.length + 1);
    const auteur = user.nom ?? user.email;
    const id = await ctx.db.insert("commandes", {
      reference: ref, type: a.type, libelle: a.libelle?.trim() || undefined, date: a.date, demandeur: a.demandeur.trim() || auteur, service: a.service?.trim() || undefined,
      statut: "en_attente", lignes, creePar: user._id,
      commentaires: a.commentaire?.trim() ? [{ auteur, texte: a.commentaire.trim(), date: new Date().toISOString() }] : [],
    });
    return { id, reference: ref, total: totalCommande(lignes) };
  },
});

// Validation / rejet : niveau 5+ (direction administrative) ; livraison : niveau 3+ après validation.
export const changerStatut = mutation({
  args: { commandeId: v.id("commandes"), statut: STATUT, commentaire: v.optional(v.string()) },
  handler: async (ctx, { commandeId, statut, commentaire }) => {
    const user = await requireLevel(ctx, statut === "validee" || statut === "rejetee" ? 5 : 3);
    const c = await ctx.db.get(commandeId);
    if (!c) throw new Error("Commande introuvable.");
    if (!TRANSITIONS[c.statut].includes(statut)) throw new Error(`Transition ${c.statut} → ${statut} non autorisée.`);
    if (statut === "rejetee" && !commentaire?.trim()) throw new Error("Un motif de rejet est requis.");
    const maintenant = new Date().toISOString();
    const auteur = user.nom ?? user.email;
    const commentaires = commentaire?.trim() ? [...c.commentaires, { auteur, texte: commentaire.trim(), date: maintenant }] : c.commentaires;
    await ctx.db.patch(commandeId, {
      statut, commentaires,
      ...(statut === "validee" || statut === "rejetee" ? { validePar: user._id, valideLe: maintenant } : {}),
      ...(statut === "livree" ? { livreLe: maintenant } : {}),
    });
  },
});

export const commenter = mutation({
  args: { commandeId: v.id("commandes"), texte: v.string() },
  handler: async (ctx, { commandeId, texte }) => {
    const user = await requireLevel(ctx, 3);
    const c = await ctx.db.get(commandeId);
    if (!c || !texte.trim()) return;
    await ctx.db.patch(commandeId, { commentaires: [...c.commentaires, { auteur: user.nom ?? user.email, texte: texte.trim(), date: new Date().toISOString() }] });
  },
});

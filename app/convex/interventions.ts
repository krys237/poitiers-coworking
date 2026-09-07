import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireLevel } from "./lib/authz";
import { reference } from "./lib/commandes";

const PRIORITE = v.union(v.literal("basse"), v.literal("moyenne"), v.literal("haute"));
const STATUT = v.union(v.literal("ouverte"), v.literal("en_cours"), v.literal("cloturee"), v.literal("rejetee"));
const LIGNE = v.object({ produit: v.string(), quantite: v.number(), prixUnitaire: v.number() });

// Workflow : ouverte → en_cours (validation) | rejetee ; en_cours → cloturee | rejetee.
const TRANSITIONS: Record<string, string[]> = { ouverte: ["en_cours", "rejetee"], en_cours: ["cloturee", "rejetee"], cloturee: [], rejetee: [] };
const total = (lignes: { quantite: number; prixUnitaire: number }[]) => lignes.reduce((t, l) => t + Math.round(l.quantite * l.prixUnitaire), 0);

export const liste = query({
  args: { statut: v.optional(STATUT), priorite: v.optional(PRIORITE) },
  handler: async (ctx, { statut, priorite }) => {
    await requireLevel(ctx, 1);
    const rows = statut
      ? await ctx.db.query("interventions").withIndex("by_statut", (q) => q.eq("statut", statut)).collect()
      : await ctx.db.query("interventions").withIndex("by_date").order("desc").collect();
    return rows
      .filter((i) => !priorite || i.priorite === priorite)
      .sort((a, b) => b.dateDemande.localeCompare(a.dateDemande) || b._creationTime - a._creationTime)
      .map((i) => ({
        _id: i._id, reference: i.reference, titre: i.titre, priorite: i.priorite, lieu: i.lieu, service: i.service, demandeur: i.demandeur,
        dateDemande: i.dateDemande, statut: i.statut, nbPhotos: i.photos.length, total: total(i.lignes), nbCommentaires: i.commentaires.length,
      }));
  },
});

export const detail = query({
  args: { interventionId: v.id("interventions") },
  handler: async (ctx, { interventionId }) => {
    await requireLevel(ctx, 1);
    const i = await ctx.db.get(interventionId);
    if (!i) return null;
    const photosUrls: string[] = [];
    for (const p of i.photos) { const u = await ctx.storage.getUrl(p); if (u) photosUrls.push(u); }
    const validePar = i.validePar ? await ctx.db.get(i.validePar) : null;
    return { ...i, photosUrls, total: total(i.lignes), validateur: validePar?.nom ?? validePar?.email ?? null };
  },
});

export const genererUploadUrl = mutation({
  args: {},
  handler: async (ctx) => { await requireLevel(ctx, 1); return await ctx.storage.generateUploadUrl(); },
});

export const creer = mutation({
  args: {
    titre: v.string(), priorite: PRIORITE, lieu: v.optional(v.string()), service: v.optional(v.string()), chefService: v.optional(v.string()),
    methode: v.optional(v.string()), dateDemande: v.string(), demandeur: v.string(), photos: v.optional(v.array(v.id("_storage"))),
    lignes: v.optional(v.array(LIGNE)), commentaireInitial: v.optional(v.string()),
  },
  handler: async (ctx, a) => {
    const user = await requireLevel(ctx, 1);
    if (!a.titre.trim()) throw new Error("Titre requis.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(a.dateDemande)) throw new Error("Date au format AAAA-MM-JJ.");
    const lignes = (a.lignes ?? []).map((l) => ({ ...l, produit: l.produit.trim() })).filter((l) => l.produit && l.quantite > 0);
    const annee = +a.dateDemande.slice(0, 4);
    const existantes = await ctx.db.query("interventions").withIndex("by_date", (q) => q.gte("dateDemande", `${annee}-01-01`).lte("dateDemande", `${annee}-12-31`)).collect();
    const ref = reference("INT", annee, existantes.length + 1);
    const id = await ctx.db.insert("interventions", {
      reference: ref, titre: a.titre.trim(), priorite: a.priorite, lieu: a.lieu?.trim() || undefined, service: a.service?.trim() || undefined,
      chefService: a.chefService?.trim() || undefined, methode: a.methode?.trim() || undefined, dateDemande: a.dateDemande,
      demandeur: a.demandeur.trim() || (user.nom ?? user.email), statut: "ouverte", photos: a.photos ?? [], lignes,
      commentaireInitial: a.commentaireInitial?.trim() || undefined, commentaires: [], creePar: user._id,
    });
    return { id, reference: ref };
  },
});

export const ajouterPhoto = mutation({
  args: { interventionId: v.id("interventions"), storageId: v.id("_storage") },
  handler: async (ctx, { interventionId, storageId }) => {
    await requireLevel(ctx, 1);
    const i = await ctx.db.get(interventionId);
    if (!i) throw new Error("Intervention introuvable.");
    await ctx.db.patch(interventionId, { photos: [...i.photos, storageId] });
  },
});

// Valider (→ en_cours), rejeter, clôturer : niveau 5+ (direction administrative). Motif requis pour un rejet.
export const changerStatut = mutation({
  args: { interventionId: v.id("interventions"), statut: STATUT, commentaire: v.optional(v.string()) },
  handler: async (ctx, { interventionId, statut, commentaire }) => {
    const user = await requireLevel(ctx, 5);
    const i = await ctx.db.get(interventionId);
    if (!i) throw new Error("Intervention introuvable.");
    if (!TRANSITIONS[i.statut].includes(statut)) throw new Error(`Transition ${i.statut} → ${statut} non autorisée.`);
    if (statut === "rejetee" && !commentaire?.trim()) throw new Error("Un motif de rejet est requis.");
    const maintenant = new Date().toISOString();
    const auteur = user.nom ?? user.email;
    const commentaires = commentaire?.trim() ? [...i.commentaires, { auteur, texte: commentaire.trim(), date: maintenant }] : i.commentaires;
    await ctx.db.patch(interventionId, { statut, commentaires, validePar: user._id, valideLe: maintenant });
  },
});

export const commenter = mutation({
  args: { interventionId: v.id("interventions"), texte: v.string() },
  handler: async (ctx, { interventionId, texte }) => {
    const user = await requireLevel(ctx, 1);
    const i = await ctx.db.get(interventionId);
    if (!i || !texte.trim()) return;
    await ctx.db.patch(interventionId, { commentaires: [...i.commentaires, { auteur: user.nom ?? user.email, texte: texte.trim(), date: new Date().toISOString() }] });
  },
});

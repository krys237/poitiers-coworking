import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireDroit, requireEntiteSiFournie, droitsDuMembre } from "./lib/authz";
import { prochaineReference } from "./lib/scopeEntite";
import { dateDouala } from "./lib/fenetre";
import { Doc } from "./_generated/dataModel";
import { QueryCtx, MutationCtx } from "./_generated/server";
import { notifier } from "./notifications";

const PRIORITE = v.union(v.literal("basse"), v.literal("moyenne"), v.literal("haute"));
const STATUT = v.union(v.literal("ouverte"), v.literal("en_cours"), v.literal("cloturee"), v.literal("rejetee"));
const LIGNE = v.object({ produit: v.string(), quantite: v.number(), prixUnitaire: v.number() });

// Workflow : ouverte → en_cours (validation) | rejetee ; en_cours → cloturee | rejetee.
const TRANSITIONS: Record<string, string[]> = { ouverte: ["en_cours", "rejetee"], en_cours: ["cloturee", "rejetee"], cloturee: [], rejetee: [] };
const total = (lignes: { quantite: number; prixUnitaire: number }[]) => lignes.reduce((t, l) => t + Math.round(l.quantite * l.prixUnitaire), 0);

// Périmètre (décision du 13/10/2026) : sans le droit « Interventions : toutes les demandes », un membre ne voit
// que les demandes qu'il a déposées lui-même ; avec (chef d'équipe et au-dessus par défaut), il voit tout.
async function perimetre(ctx: QueryCtx | MutationCtx) {
  const user = await requireDroit(ctx, "/interventions");
  const toutes = (await droitsDuMembre(ctx, user))["/interventions/toutes"]?.voir ?? false;
  return { user, toutes, visible: (i: Doc<"interventions">) => toutes || String(i.creePar) === String(user._id) };
}
async function interventionVisible(ctx: QueryCtx | MutationCtx, id: Doc<"interventions">["_id"]) {
  const p = await perimetre(ctx);
  const i = await ctx.db.get(id);
  if (!i) throw new Error("Intervention introuvable.");
  if (!p.visible(i)) throw new Error("Accès refusé : cette demande n'est pas la vôtre.");
  return { ...p, intervention: i };
}

export const liste = query({
  args: { entiteId: v.optional(v.id("entites")), statut: v.optional(STATUT), priorite: v.optional(PRIORITE) },
  handler: async (ctx, { entiteId, statut, priorite }) => {
    const { visible } = await perimetre(ctx);
    await requireEntiteSiFournie(ctx, entiteId);
    const rows = entiteId
      ? (await ctx.db.query("interventions").withIndex("by_entite_date", (q) => q.eq("entiteId", entiteId)).order("desc").collect()).filter((i) => !statut || i.statut === statut)
      : statut
        ? await ctx.db.query("interventions").withIndex("by_statut", (q) => q.eq("statut", statut)).collect()
        : await ctx.db.query("interventions").withIndex("by_date").order("desc").collect();
    return rows
      .filter(visible)
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
    const { visible } = await perimetre(ctx);
    const i = await ctx.db.get(interventionId);
    if (!i || !visible(i)) return null;
    const photosUrls: string[] = [];
    for (const p of i.photos) { const u = await ctx.storage.getUrl(p); if (u) photosUrls.push(u); }
    const validePar = i.validePar ? await ctx.db.get(i.validePar) : null;
    return { ...i, photosUrls, total: total(i.lignes), validateur: validePar?.nom ?? validePar?.email ?? null };
  },
});

export const genererUploadUrl = mutation({
  args: {},
  handler: async (ctx) => { await requireDroit(ctx, "/interventions"); return await ctx.storage.generateUploadUrl(); },
});

export const creer = mutation({
  args: {
    entiteId: v.optional(v.id("entites")),
    titre: v.string(), priorite: PRIORITE, lieu: v.optional(v.string()), service: v.optional(v.string()), serviceId: v.optional(v.id("services")), chefService: v.optional(v.string()),
    methode: v.optional(v.string()), demandeur: v.string(), photos: v.optional(v.array(v.id("_storage"))),
    lignes: v.optional(v.array(LIGNE)), commentaireInitial: v.optional(v.string()),
  },
  handler: async (ctx, a) => {
    const user = await requireDroit(ctx, "/interventions");
    await requireEntiteSiFournie(ctx, a.entiteId);
    if (!a.titre.trim()) throw new Error("Titre requis.");
    // Décision du 13/10/2026 : la date de demande est le jour du dépôt (heure de Douala), jamais saisie.
    const dateDemande = dateDouala();
    const lignes = (a.lignes ?? []).map((l) => ({ ...l, produit: l.produit.trim() })).filter((l) => l.produit && l.quantite > 0);
    const annee = +dateDemande.slice(0, 4);
    const existantes = a.entiteId
      ? await ctx.db.query("interventions").withIndex("by_entite_date", (q) => q.eq("entiteId", a.entiteId).gte("dateDemande", `${annee}-01-01`).lte("dateDemande", `${annee}-12-31`)).collect()
      : await ctx.db.query("interventions").withIndex("by_date", (q) => q.gte("dateDemande", `${annee}-01-01`).lte("dateDemande", `${annee}-12-31`)).collect();
    const ref = prochaineReference(existantes.map((i) => i.reference), "INT", annee);
    const id = await ctx.db.insert("interventions", {
      entiteId: a.entiteId,
      reference: ref, titre: a.titre.trim(), priorite: a.priorite, lieu: a.lieu?.trim() || undefined, service: a.service?.trim() || (a.serviceId ? (await ctx.db.get(a.serviceId))?.nom : undefined), serviceId: a.serviceId,
      chefService: a.chefService?.trim() || undefined, methode: a.methode?.trim() || undefined, dateDemande,
      demandeur: a.demandeur.trim() || (user.nom ?? user.email), statut: "ouverte", photos: a.photos ?? [], lignes,
      commentaireInitial: a.commentaireInitial?.trim() || undefined, commentaires: [], creePar: user._id,
    });
    const auteur = user.nom ?? user.email;
    await notifier(ctx, {
      type: "intervention_creee",
      acteurId: user._id,
      acteurNom: auteur,
      proprietaireId: user._id,
      serviceId: a.serviceId,
      serviceNom: a.service?.trim() || undefined,
      objet: { table: "interventions", id, reference: ref },
      lien: `/interventions?ref=${ref}`,
      rendu: { reference: ref, acteurNom: auteur, libelle: a.titre.trim() },
    });
    return { id, reference: ref };
  },
});

export const ajouterPhoto = mutation({
  args: { interventionId: v.id("interventions"), storageId: v.id("_storage") },
  handler: async (ctx, { interventionId, storageId }) => {
    const { intervention: i } = await interventionVisible(ctx, interventionId);
    await ctx.db.patch(interventionId, { photos: [...i.photos, storageId] });
  },
});

// Valider (→ en_cours), rejeter, clôturer : niveau 5+ (direction administrative). Motif requis pour un rejet.
export const changerStatut = mutation({
  args: { interventionId: v.id("interventions"), statut: STATUT, commentaire: v.optional(v.string()) },
  handler: async (ctx, { interventionId, statut, commentaire }) => {
    const user = await requireDroit(ctx, "/interventions", "faire");
    const { intervention: i } = await interventionVisible(ctx, interventionId); // on n'arbitre pas ce qu'on ne voit pas
    if (!TRANSITIONS[i.statut].includes(statut)) throw new Error(`Transition ${i.statut} → ${statut} non autorisée.`);
    if (statut === "rejetee" && !commentaire?.trim()) throw new Error("Un motif de rejet est requis.");
    const maintenant = new Date().toISOString();
    const auteur = user.nom ?? user.email;
    const commentaires = commentaire?.trim() ? [...i.commentaires, { auteur, texte: commentaire.trim(), date: maintenant }] : i.commentaires;
    await ctx.db.patch(interventionId, { statut, commentaires, validePar: user._id, valideLe: maintenant });
    await notifier(ctx, {
      type: statut === "cloturee" ? "intervention_cloturee" : "intervention_arbitree",
      acteurId: user._id,
      acteurNom: auteur,
      proprietaireId: i.creePar,
      serviceId: i.serviceId,
      serviceNom: i.service,
      objet: { table: "interventions", id: interventionId, reference: i.reference },
      lien: `/interventions?ref=${i.reference}`,
      rendu: { reference: i.reference, acteurNom: auteur, motif: commentaire?.trim() },
    });
  },
});

export const commenter = mutation({
  args: { interventionId: v.id("interventions"), texte: v.string() },
  handler: async (ctx, { interventionId, texte }) => {
    const { user, intervention: i } = await interventionVisible(ctx, interventionId);
    if (!texte.trim()) return;
    const auteur = user.nom ?? user.email;
    await ctx.db.patch(interventionId, { commentaires: [...i.commentaires, { auteur, texte: texte.trim(), date: new Date().toISOString() }] });
    await notifier(ctx, {
      type: "intervention_commentaire",
      acteurId: user._id,
      acteurNom: auteur,
      proprietaireId: i.creePar,
      objet: { table: "interventions", id: interventionId, reference: i.reference },
      lien: `/interventions?ref=${i.reference}`,
      rendu: { reference: i.reference, acteurNom: auteur, extrait: texte.trim().slice(0, 120) },
    });
  },
});

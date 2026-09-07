import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUser, requireLevel } from "./lib/authz";
import { canView, canDownload, NIVEAU, Role } from "./rbac";

const MODE = v.union(v.literal("ia"), v.literal("heuristique"), v.literal("manuel"));

export const genererUploadUrl = mutation({
  args: {},
  handler: async (ctx) => { await requireLevel(ctx, 1); return await ctx.storage.generateUploadUrl(); },
});

export const deposer = mutation({
  args: {
    fichierId: v.id("_storage"), nomFichier: v.string(), taille: v.number(), typeMime: v.string(),
    titre: v.string(), description: v.optional(v.string()), categorie: v.optional(v.string()),
    niveauVisible: v.number(), niveauTelechargement: v.number(), confidentiel: v.boolean(),
    codeAcces: v.optional(v.string()), modeMeta: MODE,
  },
  handler: async (ctx, a) => {
    const me = await requireLevel(ctx, 1);
    if (!a.titre.trim()) throw new Error("Titre requis.");
    if (a.confidentiel && NIVEAU[me.role as Role] < 5) throw new Error("Seule la direction (niveau 5+) peut déposer un document confidentiel.");
    return await ctx.db.insert("documents", {
      ...a, titre: a.titre.trim(), codeAcces: a.codeAcces?.trim() || undefined,
      uploadedBy: me._id, deposeLe: new Date().toISOString(),
    });
  },
});

// Liste filtrée par l'ACCÈS PAR OBJET du membre courant (niveau, confidentiel). Jamais d'URL ici.
export const liste = query({
  args: { recherche: v.optional(v.string()), categorie: v.optional(v.string()) },
  handler: async (ctx, { recherche, categorie }) => {
    const me = await requireLevel(ctx, 1);
    const role = me.role as Role;
    const tous = await ctx.db.query("documents").collect();
    const q = (recherche ?? "").trim().toLowerCase();
    const visibles = tous.filter((d) => canView(role, d));
    const users = new Map<string, string>();
    const out = [];
    for (const d of visibles.sort((a, b) => b.deposeLe.localeCompare(a.deposeLe))) {
      if (categorie && (d.categorie ?? "Divers") !== categorie) continue;
      if (q && !`${d.titre} ${d.description ?? ""} ${d.categorie ?? ""} ${d.nomFichier}`.toLowerCase().includes(q)) continue;
      if (!users.has(String(d.uploadedBy))) { const u = await ctx.db.get(d.uploadedBy); users.set(String(d.uploadedBy), u?.nom ?? u?.email ?? "?"); }
      out.push({
        _id: d._id, titre: d.titre, description: d.description, categorie: d.categorie ?? "Divers", nomFichier: d.nomFichier,
        taille: d.taille, typeMime: d.typeMime, deposeLe: d.deposeLe, deposePar: users.get(String(d.uploadedBy)),
        niveauVisible: d.niveauVisible, niveauTelechargement: d.niveauTelechargement, confidentiel: d.confidentiel,
        codeRequis: !!d.codeAcces, telechargeable: canDownload(role, d), modeMeta: d.modeMeta,
      });
    }
    return { documents: out, categories: [...new Set(visibles.map((d) => d.categorie ?? "Divers"))].sort(), monNiveau: NIVEAU[role] };
  },
});

// L'URL n'est délivrée qu'après contrôle du niveau de téléchargement ET du code d'accès (s'il existe).
export const obtenirUrl = mutation({
  args: { documentId: v.id("documents"), code: v.optional(v.string()) },
  handler: async (ctx, { documentId, code }) => {
    const me = await requireLevel(ctx, 1);
    const d = await ctx.db.get(documentId);
    if (!d || !canView(me.role as Role, d)) throw new Error("Document introuvable.");
    if (!canDownload(me.role as Role, d)) throw new Error("Téléchargement réservé à un niveau supérieur.");
    if (d.codeAcces && d.codeAcces !== (code ?? "").trim()) throw new Error("Code d'accès incorrect.");
    const url = await ctx.storage.getUrl(d.fichierId);
    if (!url) throw new Error("Fichier indisponible.");
    return { url, nomFichier: d.nomFichier };
  },
});

export const supprimer = mutation({
  args: { documentId: v.id("documents") },
  handler: async (ctx, { documentId }) => {
    const me = await requireLevel(ctx, 1);
    const d = await ctx.db.get(documentId);
    if (!d) return;
    if (d.uploadedBy !== me._id && NIVEAU[me.role as Role] < 7) throw new Error("Seul le déposant ou le DG peut supprimer.");
    await ctx.storage.delete(d.fichierId);
    await ctx.db.delete(documentId);
  },
});

// Utilisé par le seed.
export const deposerInterne = internalMutation({
  args: {
    fichierId: v.id("_storage"), nomFichier: v.string(), taille: v.number(), typeMime: v.string(),
    titre: v.string(), description: v.optional(v.string()), categorie: v.optional(v.string()),
    niveauVisible: v.number(), niveauTelechargement: v.number(), confidentiel: v.boolean(),
    codeAcces: v.optional(v.string()), uploadedBy: v.id("users"),
  },
  handler: async (ctx, a) => {
    const existe = (await ctx.db.query("documents").collect()).find((d) => d.titre === a.titre);
    if (existe) { await ctx.storage.delete(a.fichierId); return { cree: false }; }
    await ctx.db.insert("documents", { ...a, modeMeta: "manuel", deposeLe: new Date().toISOString() });
    return { cree: true };
  },
});

export const utilisateurDev = query({
  args: {},
  handler: async (ctx) => (await getCurrentUser(ctx))?._id ?? null,
});

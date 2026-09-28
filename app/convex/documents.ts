import { query, mutation, internalQuery, internalMutation, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUser, requireDroit, droitsDuMembre, lireConfidentiel } from "./lib/authz";
import { canView, canDownload, NIVEAU, LIBELLE, Role } from "./rbac";
import { Doc, Id } from "./_generated/dataModel";

const MODE = v.union(v.literal("ia"), v.literal("heuristique"), v.literal("manuel"));

// Accès à un document : nominatif s'il a des destinataires (eux + le déposant, niveau ignoré), sinon par
// niveau / confidentialité (rbac.canView, canDownload).
type DocAcces = Doc<"documents">;
const estNominatif = (d: DocAcces) => (d.destinataires?.length ?? 0) > 0;
const estDestinataire = (d: DocAcces, moi: Id<"users">) => String(d.uploadedBy) === String(moi) || (d.destinataires ?? []).some((x) => String(x) === String(moi));
const peutVoir = (d: DocAcces, me: Doc<"users">, conf: boolean) => (estNominatif(d) ? estDestinataire(d, me._id) : canView(me.role as Role, d, conf));
const peutTelecharger = (d: DocAcces, me: Doc<"users">, conf: boolean) => (estNominatif(d) ? estDestinataire(d, me._id) : canDownload(me.role as Role, d, conf));

export const genererUploadUrl = mutation({
  args: {},
  handler: async (ctx) => { await requireDroit(ctx, "/documents", "faire"); return await ctx.storage.generateUploadUrl(); },
});

export const deposer = mutation({
  args: {
    fichierId: v.id("_storage"), nomFichier: v.string(), taille: v.number(), typeMime: v.string(),
    titre: v.string(), description: v.optional(v.string()), categorie: v.optional(v.string()),
    niveauVisible: v.number(), niveauTelechargement: v.number(), confidentiel: v.boolean(),
    codeAcces: v.optional(v.string()), modeMeta: MODE,
    destinataires: v.optional(v.array(v.id("users"))),
  },
  handler: async (ctx, a) => {
    const me = await requireDroit(ctx, "/documents", "faire");
    for (const id of a.destinataires ?? []) {
      const u = await ctx.db.get(id);
      if (!u || !u.isActive || u.enAttente) throw new Error("Un destinataire choisi n'est pas un membre actif.");
    }
    if (a.destinataires && !a.destinataires.length) a.destinataires = undefined;
    if (!a.titre.trim()) throw new Error("Titre requis.");
    if (a.confidentiel && !(await droitsDuMembre(ctx, me))["/documents/confidentiels"].faire) throw new Error("Vous n'avez pas le droit de déposer un document confidentiel.");
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
    const me = await requireDroit(ctx, "/documents");
    const role = me.role as Role;
    const conf = await lireConfidentiel(ctx, me);
    const tous = await ctx.db.query("documents").collect();
    const q = (recherche ?? "").trim().toLowerCase();
    const visibles = tous.filter((d) => peutVoir(d, me, conf));
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
        codeRequis: !!d.codeAcces, telechargeable: peutTelecharger(d, me, conf), modeMeta: d.modeMeta,
        destinataires: estNominatif(d) ? await nomsDe(ctx, d.destinataires!) : null,
        pourMoi: estNominatif(d) && String(d.uploadedBy) !== String(me._id),
      });
    }
    return { documents: out, categories: [...new Set(visibles.map((d) => d.categorie ?? "Divers"))].sort(), monNiveau: NIVEAU[role], deposeConfidentiel: (await droitsDuMembre(ctx, me))["/documents/confidentiels"].faire };
  },
});

// L'URL n'est délivrée qu'après contrôle du niveau de téléchargement ET du code d'accès (s'il existe).
export const obtenirUrl = mutation({
  args: { documentId: v.id("documents"), code: v.optional(v.string()) },
  handler: async (ctx, { documentId, code }) => {
    const me = await requireDroit(ctx, "/documents");
    const d = await ctx.db.get(documentId);
    const conf = await lireConfidentiel(ctx, me);
    if (!d || !peutVoir(d, me, conf)) throw new Error("Document introuvable.");
    if (!peutTelecharger(d, me, conf)) throw new Error("Téléchargement réservé à un niveau supérieur.");
    if (d.codeAcces && d.codeAcces !== (code ?? "").trim()) throw new Error("Code d'accès incorrect.");
    const url = await ctx.storage.getUrl(d.fichierId);
    if (!url) throw new Error("Fichier indisponible.");
    return { url, nomFichier: d.nomFichier };
  },
});

// Aperçu en lecture seule : dès qu'on a le droit de VOIR le document (le téléchargement, lui, peut
// rester réservé à un niveau supérieur). Le code d'accès s'applique de la même façon.
export const apercuUrl = mutation({
  args: { documentId: v.id("documents"), code: v.optional(v.string()) },
  handler: async (ctx, { documentId, code }) => {
    const me = await requireDroit(ctx, "/documents");
    const d = await ctx.db.get(documentId);
    if (!d || !peutVoir(d, me, await lireConfidentiel(ctx, me))) throw new Error("Document introuvable.");
    if (d.codeAcces && d.codeAcces !== (code ?? "").trim()) throw new Error("Code d'accès incorrect.");
    const url = await ctx.storage.getUrl(d.fichierId);
    if (!url) throw new Error("Fichier indisponible.");
    return { url, nomFichier: d.nomFichier, typeMime: d.typeMime, titre: d.titre };
  },
});

export const supprimer = mutation({
  args: { documentId: v.id("documents") },
  handler: async (ctx, { documentId }) => {
    const me = await requireDroit(ctx, "/documents", "faire");
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

// Garde-fou pour l'extraction IA (action Node) : exige un membre actif, et refuse qu'un fichier
// DÉJÀ rattaché à un document soit relu par quelqu'un qui n'a pas le droit de voir ce document
// (sans ce contrôle, un `_storage` id suffirait à extraire le texte d'une pièce confidentielle).
// Un fichier tout juste téléversé n'a pas encore de ligne `documents` : l'accès est alors accordé.
export const controleAccesFichier = internalQuery({
  args: { fichierId: v.id("_storage") },
  handler: async (ctx, { fichierId }) => {
    const me = await requireDroit(ctx, "/documents");
    const doc = await ctx.db.query("documents").withIndex("by_fichier", (q) => q.eq("fichierId", fichierId)).first();
    if (doc && !peutVoir(doc, me, await lireConfidentiel(ctx, me))) throw new Error("Accès refusé : ce document ne vous est pas visible.");
    return { userId: me._id };
  },
});

export const utilisateurDev = query({
  args: {},
  handler: async (ctx) => (await getCurrentUser(ctx))?._id ?? null,
});

async function nomsDe(ctx: QueryCtx, ids: Id<"users">[]) {
  const out: string[] = [];
  for (const id of ids) { const u = await ctx.db.get(id); out.push(u?.nom ?? u?.email ?? "?"); }
  return out;
}

// Destinataires possibles d'un dépôt : les membres actifs (nom et rôle, rien d'autre).
export const destinatairesPossibles = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireDroit(ctx, "/documents", "faire");
    const tous = await ctx.db.query("users").collect();
    return tous
      .filter((u) => u.isActive && !u.enAttente && String(u._id) !== String(me._id) && u.role !== "super_admin")
      .map((u) => ({ _id: u._id, nom: u.nom ?? u.email, role: LIBELLE[u.role as Role] }))
      .sort((a, b) => a.nom.localeCompare(b.nom));
  },
});

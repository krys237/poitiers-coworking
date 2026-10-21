import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Doc } from "./_generated/dataModel";
import { requireDroit } from "./lib/authz";
import { comparer, totalCommande, reference, normaliserCleProduit } from "./lib/commandes";

const TYPE = v.union(v.literal("medicale"), v.literal("fourniture"), v.literal("reactifs_labo"));
const STATUT = v.union(
  v.literal("preparation"),
  v.literal("en_attente"),
  v.literal("validee"),
  v.literal("en_reception"),
  v.literal("en_litige"),
  v.literal("rejetee"),
  v.literal("livree"),
  v.literal("cloturee")
);
const LIGNE = v.object({
  produit: v.string(),
  dci: v.optional(v.string()),
  ancienneDate: v.optional(v.string()),
  ancienneQuantite: v.optional(v.number()),
  quantiteUtilisee: v.optional(v.number()),
  quantiteRestante: v.optional(v.number()),
  quantite: v.number(),
  prixUnitaire: v.number(),
});

// Transitions autorisées du workflow (4 jalons principaux + litige/rejet).
const TRANSITIONS: Record<string, string[]> = {
  preparation: ["en_attente"],
  en_attente: ["validee", "en_reception", "rejetee", "preparation"],
  validee: ["en_reception", "rejetee"],
  en_reception: ["livree", "cloturee", "en_litige"],
  en_litige: ["en_reception", "cloturee", "livree"],
  rejetee: ["preparation"],
  livree: ["cloturee", "en_litige"],
  cloturee: [],
};

// Commande précédente du même type (date antérieure, sinon créée avant le même jour).
function precedente(c: Doc<"commandes">, toutes: Doc<"commandes">[]) {
  return toutes
    .filter((x) => x.type === c.type && x._id !== c._id && (x.date < c.date || (x.date === c.date && x._creationTime < c._creationTime)))
    .sort((a, b) => b.date.localeCompare(a.date) || b._creationTime - a._creationTime)[0] ?? null;
}

export const liste = query({
  args: {
    type: v.optional(TYPE),
    fournisseurId: v.optional(v.id("fournisseurs")),
    statut: v.optional(STATUT),
  },
  handler: async (ctx, { type, fournisseurId, statut }) => {
    await requireDroit(ctx, "/commandes");
    let rows: Doc<"commandes">[];
    if (type) {
      rows = await ctx.db.query("commandes").withIndex("by_type_date", (q) => q.eq("type", type)).order("desc").collect();
    } else {
      rows = await ctx.db.query("commandes").withIndex("by_date").order("desc").collect();
    }

    if (fournisseurId) {
      rows = rows.filter((c) => c.fournisseurId === fournisseurId);
    }
    if (statut) {
      rows = rows.filter((c) => c.statut === statut);
    }

    // Récupérer les fournisseurs pour enrichir l'affichage
    const fournisseurIds = Array.from(new Set(rows.map((r) => r.fournisseurId).filter(Boolean))) as any[];
    const fournisseursMap = new Map();
    for (const fId of fournisseurIds) {
      const f: any = await ctx.db.get(fId);
      if (f) fournisseursMap.set(fId, { _id: f._id, nom: f.nom, telephone: f.telephone });
    }

    return rows.map((c) => ({
      _id: c._id,
      reference: c.reference,
      type: c.type,
      libelle: c.libelle,
      date: c.date,
      demandeur: c.demandeur,
      service: c.service,
      statut: c.statut,
      total: totalCommande(c.lignes),
      nbLignes: c.lignes.length,
      nbCommentaires: c.commentaires.length,
      creeLe: c._creationTime,
      fournisseurId: c.fournisseurId,
      fournisseur: c.fournisseurId ? fournisseursMap.get(c.fournisseurId) ?? null : null,
      litige: c.litige ?? null,
      proformaRef: c.proformaRef ?? null,
    }));
  },
});

// Détail + comparaison automatique avec la commande précédente du même type.
export const detail = query({
  args: { commandeId: v.id("commandes") },
  handler: async (ctx, { commandeId }) => {
    await requireDroit(ctx, "/commandes");
    const c = await ctx.db.get(commandeId);
    if (!c) return null;
    const toutes = await ctx.db.query("commandes").withIndex("by_type", (q) => q.eq("type", c.type)).collect();
    const prev = precedente(c, toutes);
    const validePar = c.validePar ? await ctx.db.get(c.validePar) : null;
    const fournisseur: any = c.fournisseurId ? await ctx.db.get(c.fournisseurId) : null;

    return {
      ...c,
      total: totalCommande(c.lignes),
      validateur: validePar?.nom ?? validePar?.email ?? null,
      fournisseur: fournisseur ? { _id: fournisseur._id, nom: fournisseur.nom, telephone: fournisseur.telephone, ville: fournisseur.ville } : null,
      precedente: prev ? { _id: prev._id, reference: prev.reference, date: prev.date, total: totalCommande(prev.lignes) } : null,
      comparaison: prev ? comparer(prev.lignes, c.lignes) : null,
    };
  },
});

// Récupère les derniers achats par produit pour alimenter le registre (Option 1).
// Si la base est vierge ou un produit n'a aucun antécédent, la liste retournée ne le contiendra pas (Option 3 : saisie libre initiale).
export const derniersAchats = query({
  args: {
    type: v.optional(TYPE),
    saufCommandeId: v.optional(v.id("commandes")),
    dateMax: v.optional(v.string()),
  },
  handler: async (ctx, { type, saufCommandeId, dateMax }) => {
    await requireDroit(ctx, "/commandes");
    let orders: Doc<"commandes">[];
    if (type) {
      orders = await ctx.db
        .query("commandes")
        .withIndex("by_type_date", (q) => q.eq("type", type))
        .order("desc")
        .collect();
    } else {
      orders = await ctx.db
        .query("commandes")
        .withIndex("by_date")
        .order("desc")
        .collect();
    }

    const seen = new Set<string>();
    const result: {
      cle: string;
      produit: string;
      date: string;
      quantite: number;
      prixUnitaire: number;
      reference: string;
      commandeId: string;
    }[] = [];

    for (const c of orders) {
      if (saufCommandeId && c._id === saufCommandeId) continue;
      if (c.statut === "rejetee") continue;
      if (dateMax && c.date > dateMax) continue;

      for (const l of c.lignes) {
        if (!l.produit) continue;
        const cle = normaliserCleProduit(l.produit);
        if (!cle || seen.has(cle)) continue;

        seen.add(cle);
        result.push({
          cle,
          produit: l.produit,
          date: c.date,
          quantite: l.quantite,
          prixUnitaire: l.prixUnitaire,
          reference: c.reference,
          commandeId: c._id,
        });
      }
    }

    return result;
  },
});

export const creer = mutation({
  args: {
    type: TYPE,
    fournisseurId: v.optional(v.id("fournisseurs")),
    libelle: v.optional(v.string()),
    date: v.string(),
    demandeur: v.string(),
    service: v.optional(v.string()),
    statut: v.optional(STATUT),
    lignes: v.array(LIGNE),
    commentaire: v.optional(v.string()),
  },
  handler: async (ctx, a) => {
    const user = await requireDroit(ctx, "/commandes", "faire");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(a.date)) throw new Error("Date au format AAAA-MM-JJ.");

    // Recherche des antécédents d'achats dans les commandes antérieures non rejetées
    const commandesPrecedentes = await ctx.db
      .query("commandes")
      .withIndex("by_type_date", (q) => q.eq("type", a.type))
      .order("desc")
      .collect();

    const antecedentsMap = new Map<string, { date: string; quantite: number; prixUnitaire: number; reference: string }>();
    for (const cp of commandesPrecedentes) {
      if (cp.statut === "rejetee") continue;
      for (const lp of cp.lignes) {
        if (!lp.produit) continue;
        const cle = normaliserCleProduit(lp.produit);
        if (cle && !antecedentsMap.has(cle)) {
          antecedentsMap.set(cle, {
            date: cp.date,
            quantite: lp.quantite,
            prixUnitaire: lp.prixUnitaire,
            reference: cp.reference,
          });
        }
      }
    }

    const lignes = a.lignes
      .map((l) => {
        const prod = l.produit.trim();
        const cle = normaliserCleProduit(prod);
        const ant = antecedentsMap.get(cle);

        // Si antécédent en base (Option 1) : verrouille sur la commande précédente
        // Si aucun antécédent (Option 3 / démarrage à froid) : conserve les saisies manuelles
        const ancDate = ant ? ant.date : (l.ancienneDate || undefined);
        const ancQte = ant ? ant.quantite : l.ancienneQuantite;

        let qUtil = l.quantiteUtilisee;
        let qRest = l.quantiteRestante;
        if (ancQte !== undefined && ancQte > 0) {
          if (qRest !== undefined) {
            qUtil = Math.max(0, ancQte - qRest);
          } else if (qUtil !== undefined) {
            qRest = Math.max(0, ancQte - qUtil);
          }
        }

        return {
          ...l,
          produit: prod,
          dci: l.dci?.trim() || undefined,
          ancienneDate: ancDate,
          ancienneQuantite: ancQte,
          quantiteUtilisee: qUtil,
          quantiteRestante: qRest,
        };
      })
      .filter((l) => l.produit);

    if (!lignes.length) throw new Error("Au moins une ligne de produit est requise.");
    if (lignes.some((l) => !(l.quantite > 0) || l.prixUnitaire < 0)) throw new Error("Quantités > 0 et prix ≥ 0 requis.");
    const annee = +a.date.slice(0, 4);
    const existantes = await ctx.db
      .query("commandes")
      .withIndex("by_date", (q) => q.gte("date", `${annee}-01-01`).lte("date", `${annee}-12-31`))
      .collect();
    // Numérotation reprise sur la plus haute séquence existante, et non sur le nombre de bons :
    // depuis l'ajout de `supprimer`, l'année peut comporter des trous et `length + 1` réattribuerait
    // une référence déjà portée par un autre bon. L'index `by_reference` n'étant pas unique, la
    // collision passerait totalement inaperçue et deux bons partageraient la même identité.
    const prefixeRef = `CMD-${annee}-`;
    const sequenceMax = existantes.reduce((max, c) => {
      if (!c.reference.startsWith(prefixeRef)) return max;
      const n = Number.parseInt(c.reference.slice(prefixeRef.length), 10);
      return Number.isFinite(n) && n > max ? n : max;
    }, 0);
    const ref = reference("CMD", annee, sequenceMax + 1);
    const auteur = user.nom ?? user.email;
    const initialStatut = a.statut ?? "preparation";

    const id = await ctx.db.insert("commandes", {
      reference: ref,
      type: a.type,
      fournisseurId: a.fournisseurId,
      libelle: a.libelle?.trim() || undefined,
      date: a.date,
      demandeur: a.demandeur.trim() || auteur,
      service: a.service?.trim() || undefined,
      statut: initialStatut,
      lignes,
      creePar: user._id,
      commentaires: a.commentaire?.trim() ? [{ auteur, texte: a.commentaire.trim(), date: new Date().toISOString() }] : [],
    });
    return { id, reference: ref, total: totalCommande(lignes) };
  },
});

export const modifier = mutation({
  args: {
    commandeId: v.id("commandes"),
    type: v.optional(TYPE),
    fournisseurId: v.optional(v.id("fournisseurs")),
    libelle: v.optional(v.string()),
    date: v.string(),
    demandeur: v.string(),
    service: v.optional(v.string()),
    lignes: v.array(LIGNE),
    commentaire: v.optional(v.string()),
  },
  handler: async (ctx, a) => {
    const user = await requireDroit(ctx, "/commandes", "faire");
    const c = await ctx.db.get(a.commandeId);
    if (!c) throw new Error("Commande introuvable.");
    if (c.statut !== "preparation" && c.statut !== "rejetee") {
      throw new Error(`Seul un bon au statut "Préparation" (ou "Rejeté") peut être modifié. Ce bon est actuellement "${c.statut}".`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(a.date)) throw new Error("Date au format AAAA-MM-JJ.");

    const typeFinal = a.type ?? c.type;
    const commandesPrecedentes = await ctx.db
      .query("commandes")
      .withIndex("by_type_date", (q) => q.eq("type", typeFinal))
      .order("desc")
      .collect();

    const antecedentsMap = new Map<string, { date: string; quantite: number; prixUnitaire: number; reference: string }>();
    for (const cp of commandesPrecedentes) {
      if (cp._id === a.commandeId) continue; // Exclure ce bon en cours de modification
      if (cp.statut === "rejetee") continue;
      for (const lp of cp.lignes) {
        if (!lp.produit) continue;
        const cle = normaliserCleProduit(lp.produit);
        if (cle && !antecedentsMap.has(cle)) {
          antecedentsMap.set(cle, {
            date: cp.date,
            quantite: lp.quantite,
            prixUnitaire: lp.prixUnitaire,
            reference: cp.reference,
          });
        }
      }
    }

    const lignes = a.lignes
      .map((l) => {
        const prod = l.produit.trim();
        const cle = normaliserCleProduit(prod);
        const ant = antecedentsMap.get(cle);

        // Si antécédent en base (Option 1) : verrouille sur la commande précédente
        // Si aucun antécédent (Option 3 / démarrage à froid) : conserve les saisies manuelles
        const ancDate = ant ? ant.date : (l.ancienneDate || undefined);
        const ancQte = ant ? ant.quantite : l.ancienneQuantite;

        let qUtil = l.quantiteUtilisee;
        let qRest = l.quantiteRestante;
        if (ancQte !== undefined && ancQte > 0) {
          if (qRest !== undefined) {
            qUtil = Math.max(0, ancQte - qRest);
          } else if (qUtil !== undefined) {
            qRest = Math.max(0, ancQte - qUtil);
          }
        }

        return {
          ...l,
          produit: prod,
          dci: l.dci?.trim() || undefined,
          ancienneDate: ancDate,
          ancienneQuantite: ancQte,
          quantiteUtilisee: qUtil,
          quantiteRestante: qRest,
        };
      })
      .filter((l) => l.produit);

    if (!lignes.length) throw new Error("Au moins une ligne de produit est requise.");
    if (lignes.some((l) => !(l.quantite > 0) || l.prixUnitaire < 0)) {
      throw new Error("Quantités > 0 et prix ≥ 0 requis.");
    }
    const maintenant = new Date().toISOString();
    const auteur = user.nom ?? user.email;
    const commentaires = a.commentaire?.trim()
      ? [...c.commentaires, { auteur, texte: a.commentaire.trim(), date: maintenant }]
      : c.commentaires;

    await ctx.db.patch(a.commandeId, {
      ...(a.type ? { type: a.type } : {}),
      fournisseurId: a.fournisseurId,
      libelle: a.libelle?.trim() || undefined,
      date: a.date,
      demandeur: a.demandeur.trim() || auteur,
      service: a.service?.trim() || undefined,
      lignes,
      commentaires,
    });
    return { id: c._id, reference: c.reference, total: totalCommande(lignes) };
  },
});

export const supprimer = mutation({
  args: { commandeId: v.id("commandes") },
  handler: async (ctx, { commandeId }) => {
    await requireDroit(ctx, "/commandes", "faire");
    const c = await ctx.db.get(commandeId);
    if (!c) throw new Error("Commande introuvable.");
    if (c.statut !== "preparation" && c.statut !== "rejetee") {
      throw new Error(`Seul un bon au statut "Préparation" (ou "Rejeté") peut être supprimé.`);
    }
    await ctx.db.delete(commandeId);
  },
});

export const changerStatut = mutation({
  args: {
    commandeId: v.id("commandes"),
    statut: STATUT,
    commentaire: v.optional(v.string()),
    proformaRef: v.optional(v.string()),
  },
  handler: async (ctx, { commandeId, statut, commentaire, proformaRef }) => {
    const user = await (statut === "validee" || statut === "rejetee"
      ? requireDroit(ctx, "/commandes/validation", "faire")
      : requireDroit(ctx, "/commandes", "faire"));
    const c = await ctx.db.get(commandeId);
    if (!c) throw new Error("Commande introuvable.");
    const transitionsPossibles = TRANSITIONS[c.statut] ?? [];
    if (!transitionsPossibles.includes(statut)) {
      throw new Error(`Transition ${c.statut} → ${statut} non autorisée.`);
    }
    if (statut === "rejetee" && !commentaire?.trim()) throw new Error("Un motif de rejet est requis.");
    const maintenant = new Date().toISOString();
    const auteur = user.nom ?? user.email;
    const commentaires = commentaire?.trim()
      ? [...c.commentaires, { auteur, texte: commentaire.trim(), date: maintenant }]
      : c.commentaires;

    await ctx.db.patch(commandeId, {
      statut,
      commentaires,
      ...(statut === "validee" || statut === "rejetee"
        ? { validePar: user._id, valideLe: maintenant, proformaRef: proformaRef || `PRO-${c.reference}` }
        : {}),
      ...(statut === "livree" || statut === "cloturee" ? { livreLe: maintenant } : {}),
    });
  },
});

export const commenter = mutation({
  args: { commandeId: v.id("commandes"), texte: v.string() },
  handler: async (ctx, { commandeId, texte }) => {
    const user = await requireDroit(ctx, "/commandes", "faire");
    const c = await ctx.db.get(commandeId);
    if (!c || !texte.trim()) return;
    await ctx.db.patch(commandeId, { commentaires: [...c.commentaires, { auteur: user.nom ?? user.email, texte: texte.trim(), date: new Date().toISOString() }] });
  },
});

export const signalerLitige = mutation({
  args: {
    commandeId: v.id("commandes"),
    motif: v.union(
      v.literal("peremption"),
      v.literal("quantite_insuffisante"),
      v.literal("manquant"),
      v.literal("avarie"),
      v.literal("autre")
    ),
    description: v.string(),
  },
  handler: async (ctx, { commandeId, motif, description }) => {
    const user = await requireDroit(ctx, "/commandes", "faire");
    const c = await ctx.db.get(commandeId);
    if (!c) throw new Error("Commande introuvable.");
    if (c.statut !== "en_reception" && c.statut !== "livree") {
      throw new Error("Un litige ne peut être signalé que sur une commande en cours de réception.");
    }
    const maintenant = new Date().toISOString();
    const auteur = user.nom ?? user.email;
    const motifLabels: Record<string, string> = {
      peremption: "Date de péremption courte ou dépassée",
      quantite_insuffisante: "Quantité insuffisante",
      manquant: "Article(s) manquant(s)",
      avarie: "Avarie / Casse / Non-conformité emballage",
      autre: "Autre litige",
    };
    const tag = motifLabels[motif] ?? motif;
    const commentaireLitige = `⚠️ LITIGE SIGNALÉ [${tag}] : ${description.trim()}`;

    await ctx.db.patch(commandeId, {
      statut: "en_litige",
      litige: {
        type: motif,
        description: description.trim(),
        resolu: false,
        dateSignalement: maintenant,
      },
      commentaires: [
        ...c.commentaires,
        { auteur, texte: commentaireLitige, date: maintenant },
      ],
    });
  },
});

export const resoudreLitigeEtCloturer = mutation({
  args: {
    commandeId: v.id("commandes"),
    commentaire: v.optional(v.string()),
  },
  handler: async (ctx, { commandeId, commentaire }) => {
    const user = await requireDroit(ctx, "/commandes", "faire");
    const c = await ctx.db.get(commandeId);
    if (!c) throw new Error("Commande introuvable.");
    if (c.statut !== "en_litige") {
      throw new Error("Cette commande n'est pas en litige.");
    }
    const maintenant = new Date().toISOString();
    const auteur = user.nom ?? user.email;
    const noteResolution = commentaire?.trim()
      ? `✅ LITIGE RÉSOLU & COMMANDE CLÔTURÉE : ${commentaire.trim()}`
      : `✅ LITIGE RÉSOLU & COMMANDE CLÔTURÉE par ${auteur}`;

    await ctx.db.patch(commandeId, {
      statut: "cloturee",
      livreLe: maintenant,
      litige: c.litige
        ? {
            ...c.litige,
            resolu: true,
            dateResolution: maintenant,
          }
        : undefined,
      commentaires: [
        ...c.commentaires,
        { auteur, texte: noteResolution, date: maintenant },
      ],
    });
  },
});

export const confirmerReceptionConforme = mutation({
  args: {
    commandeId: v.id("commandes"),
    commentaire: v.optional(v.string()),
  },
  handler: async (ctx, { commandeId, commentaire }) => {
    const user = await requireDroit(ctx, "/commandes", "faire");
    const c = await ctx.db.get(commandeId);
    if (!c) throw new Error("Commande introuvable.");
    const maintenant = new Date().toISOString();
    const auteur = user.nom ?? user.email;
    const note = commentaire?.trim()
      ? `📦 RÉCEPTION CONFORME (Sans litige) : ${commentaire.trim()}`
      : `📦 RÉCEPTION CONFORME (Sans litige) pointée par ${auteur}`;

    await ctx.db.patch(commandeId, {
      statut: "cloturee",
      livreLe: maintenant,
      commentaires: [
        ...c.commentaires,
        { auteur, texte: note, date: maintenant },
      ],
    });
  },
});


// Pense-bêtes personnels (lot S7) : strictement limités au membre courant.
// Aucun assignement à autrui, aucune récurrence. Balayage cron toutes les 15 minutes.
import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUser } from "./lib/authz";
import {
  LIMITE_BALAYAGE_PENSE_BETES,
  selectionnerPenseBetesAEcheance,
  validerPenseBete,
} from "./lib/rappels";
import { notifier } from "./notifications";

const OBJET_OPT_V = v.optional(
  v.object({
    table: v.string(),
    id: v.string(),
    reference: v.optional(v.string()),
  }),
);

/** Liste les pense-bêtes du membre courant : `en_attente` d'abord, puis par échéance. */
export const miens = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user || !user.isActive || user.enAttente) return [];

    const enAttente = await ctx.db
      .query("penseBetes")
      .withIndex("by_membre_etat", (q) => q.eq("membreId", user._id).eq("etat", "en_attente"))
      .collect();
    const declenches = await ctx.db
      .query("penseBetes")
      .withIndex("by_membre_etat", (q) => q.eq("membreId", user._id).eq("etat", "declenche"))
      .order("desc")
      .take(30);
    const annules = await ctx.db
      .query("penseBetes")
      .withIndex("by_membre_etat", (q) => q.eq("membreId", user._id).eq("etat", "annule"))
      .order("desc")
      .take(20);

    enAttente.sort((a, b) => a.echeance.localeCompare(b.echeance));
    return [...enAttente, ...declenches, ...annules];
  },
});

export const creer = mutation({
  args: {
    texte: v.string(),
    echeance: v.string(),
    objet: OBJET_OPT_V,
    lien: v.optional(v.string()),
  },
  handler: async (ctx, a) => {
    const user = await getCurrentUser(ctx);
    if (!user || !user.isActive || user.enAttente) throw new Error("Non authentifié.");

    const enAttente = await ctx.db
      .query("penseBetes")
      .withIndex("by_membre_etat", (q) => q.eq("membreId", user._id).eq("etat", "en_attente"))
      .collect();

    const maintenant = new Date().toISOString();
    const erreur = validerPenseBete({
      texte: a.texte,
      echeanceIso: a.echeance,
      maintenantIso: maintenant,
      nbEnAttenteActuel: enAttente.length,
    });
    if (erreur) throw new Error(erreur);

    return await ctx.db.insert("penseBetes", {
      membreId: user._id,
      texte: a.texte.trim(),
      echeance: new Date(a.echeance).toISOString(),
      objet: a.objet,
      lien: a.lien,
      etat: "en_attente",
      creeLe: maintenant,
    });
  },
});

export const modifier = mutation({
  args: {
    penseBeteId: v.id("penseBetes"),
    texte: v.string(),
    echeance: v.string(),
  },
  handler: async (ctx, a) => {
    const user = await getCurrentUser(ctx);
    if (!user || !user.isActive || user.enAttente) throw new Error("Non authentifié.");

    const pb = await ctx.db.get(a.penseBeteId);
    if (!pb || String(pb.membreId) !== String(user._id)) {
      throw new Error("Accès refusé : ce pense-bête ne vous appartient pas.");
    }
    if (pb.etat !== "en_attente") {
      throw new Error("Seul un pense-bête en attente peut être modifié.");
    }

    const erreur = validerPenseBete({
      texte: a.texte,
      echeanceIso: a.echeance,
      maintenantIso: new Date().toISOString(),
      nbEnAttenteActuel: 0,
      estModification: true,
    });
    if (erreur) throw new Error(erreur);

    await ctx.db.patch(a.penseBeteId, {
      texte: a.texte.trim(),
      echeance: new Date(a.echeance).toISOString(),
    });
  },
});

export const annuler = mutation({
  args: { penseBeteId: v.id("penseBetes") },
  handler: async (ctx, { penseBeteId }) => {
    const user = await getCurrentUser(ctx);
    if (!user || !user.isActive || user.enAttente) throw new Error("Non authentifié.");

    const pb = await ctx.db.get(penseBeteId);
    if (!pb || String(pb.membreId) !== String(user._id)) {
      throw new Error("Accès refusé : ce pense-bête ne vous appartient pas.");
    }
    if (pb.etat === "annule") return;

    await ctx.db.patch(penseBeteId, { etat: "annule" });
  },
});

/** Balayage cron toutes les 15 minutes : bascule en `declenche` et émet par S1. */
export const declencher = internalMutation({
  args: {},
  handler: async (ctx) => {
    const maintenant = new Date().toISOString();
    const candidats = await ctx.db
      .query("penseBetes")
      .withIndex("by_echeance", (q) => q.eq("etat", "en_attente").lte("echeance", maintenant))
      .take(LIMITE_BALAYAGE_PENSE_BETES);

    const aDeclencher = selectionnerPenseBetesAEcheance(candidats, maintenant, LIMITE_BALAYAGE_PENSE_BETES);
    for (const pb of aDeclencher) {
      await ctx.db.patch(pb._id, { etat: "declenche" });
      await notifier(ctx, {
        type: "pense_bete",
        proprietaireId: pb.membreId,
        objet: pb.objet ?? { table: "penseBetes", id: String(pb._id) },
        lien: pb.lien ?? "/notifications",
        rendu: {
          libelle: pb.objet?.reference ? `${pb.objet.reference}` : pb.texte.slice(0, 60),
          extrait: pb.objet?.reference ? pb.texte : undefined,
        },
      });
    }
    return { declenches: aDeclencher.length };
  },
});

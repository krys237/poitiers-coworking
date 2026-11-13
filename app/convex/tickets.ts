// Tickets : dysfonctionnements et besoins remontés par les membres (demande N5).
//
// Les règles vivent dans `lib/tickets.ts`, pures et testées. Ici : lire, écrire, journaliser.
//
// QUI VOIT QUOI
//
//   `/tickets`             tout le monde — ouvrir un ticket et suivre les SIENS
//   `/tickets/arbitrage`   le Directeur (niveau 7) — juger la pertinence, et voir tous les tickets
//   `/tickets/traitement`  le développeur (super_admin, niveau 8) — avancer l'état
//
// « Envoyé à deux personnes » se traduit ici par un ACHEMINEMENT, pas par un e-mail : le ticket
// apparaît immédiatement dans l'écran du Directeur et dans celui du développeur, avec un compteur
// de ce qui attend chacun. Aucun courriel ne part de l'application — voir A-VERIFIER N5-a : il
// faudrait une adresse pour le développeur, et l'expéditeur configuré ne sert qu'aux bulletins.

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireDroit, droitsDuMembre } from "./lib/authz";
import { journaliser } from "./lib/journal";
import {
  LIBELLE_AVIS, LIBELLE_ETAT, LIBELLE_NATURE, NATURES, PIECES_MAX,
  compter, controlerArbitrage, controlerEtat, controlerPiece, controlerTicket, estClos, trier,
} from "./lib/tickets";

const NATURE = v.union(v.literal("dysfonctionnement"), v.literal("besoin"), v.literal("question"));
const maintenant = () => new Date().toISOString();

/** Dépôt d'une capture d'écran. Tout membre qui peut ouvrir un ticket peut y joindre une image. */
export const genererUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireDroit(ctx, "/tickets", "faire");
    return await ctx.storage.generateUploadUrl();
  },
});

export const ouvrir = mutation({
  args: {
    titre: v.string(),
    description: v.string(),
    nature: NATURE,
    ecran: v.optional(v.string()),
    pieces: v.optional(v.array(v.object({
      fichierId: v.id("_storage"),
      nomFichier: v.string(),
      typeMime: v.string(),
      taille: v.number(),
    }))),
  },
  handler: async (ctx, a) => {
    const me = await requireDroit(ctx, "/tickets", "faire");
    const erreurs = controlerTicket(a);
    if (erreurs.length) throw new Error(erreurs.join(" "));

    const pieces = a.pieces ?? [];
    if (pieces.length > PIECES_MAX)
      throw new Error(`${PIECES_MAX} pièces au maximum par ticket.`);
    for (const p of pieces) {
      const e = controlerPiece(p);
      if (e) throw new Error(e);
    }

    const id = await ctx.db.insert("tickets", {
      auteurId: me._id,
      auteurNom: me.nom ?? me.email,
      titre: a.titre.trim(),
      description: a.description.trim(),
      nature: a.nature,
      ecran: a.ecran?.trim() || undefined,
      cree: maintenant(),
      ...(pieces.length ? { pieces } : {}),
      avis: "en_attente" as const,
      etat: "nouveau" as const,
    });
    await journaliser(ctx, {
      auteurId: me._id, auteurNom: me.nom ?? me.email, action: "ticket_ouverture",
      cible: a.titre.trim(), detail: `${LIBELLE_NATURE[a.nature]}${pieces.length ? ` · ${pieces.length} pièce(s)` : ""}`,
    });
    return id;
  },
});

/**
 * Les tickets visibles : les siens, ou TOUS pour qui arbitre ou traite.
 *
 * Un employé ne voit pas les tickets des autres — ils peuvent décrire un cas nominatif, ou un
 * agacement qu'on n'écrit pas pour être lu de tous.
 */
export const liste = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireDroit(ctx, "/tickets");
    const droits = await droitsDuMembre(ctx, me);
    const arbitre = !!droits["/tickets/arbitrage"]?.faire;
    const traite = !!droits["/tickets/traitement"]?.faire;
    const voitTout = arbitre || traite;

    const rows = voitTout
      ? await ctx.db.query("tickets").collect()
      : await ctx.db.query("tickets").withIndex("by_auteur", (q) => q.eq("auteurId", me._id)).collect();

    const avecUrls = await Promise.all(
      rows.map(async (t) => ({
        ...t,
        clos: estClos(t),
        pieces: await Promise.all(
          (t.pieces ?? []).map(async (p) => ({ ...p, url: await ctx.storage.getUrl(p.fichierId) })),
        ),
      })),
    );

    return {
      tickets: trier(avecUrls),
      compteurs: compter(rows),
      // L'écran adapte ce qu'il montre : un employé n'a pas à voir les boutons d'arbitrage.
      peutArbitrer: arbitre,
      peutTraiter: traite,
      voitTout,
      natures: NATURES.map(([cle, libelle]) => ({ cle, libelle })),
      libelles: { avis: LIBELLE_AVIS, etat: LIBELLE_ETAT, nature: LIBELLE_NATURE },
    };
  },
});

/** Compteur pour le menu : ce qui attend une action de MA part. */
export const enAttente = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireDroit(ctx, "/tickets");
    const droits = await droitsDuMembre(ctx, me);
    const arbitre = !!droits["/tickets/arbitrage"]?.faire;
    const traite = !!droits["/tickets/traitement"]?.faire;
    if (!arbitre && !traite) return 0;
    const rows = await ctx.db.query("tickets").collect();
    const c = compter(rows);
    // Qui porte les deux casquettes voit le plus urgent des deux, pas la somme : un même ticket
    // compterait deux fois.
    return arbitre && traite ? Math.max(c.aArbitrer, c.aTraiter) : arbitre ? c.aArbitrer : c.aTraiter;
  },
});

/** Le Directeur juge la pertinence. Un refus exige un motif. */
export const arbitrer = mutation({
  args: {
    ticketId: v.id("tickets"),
    avis: v.union(v.literal("pertinent"), v.literal("non_pertinent")),
    motif: v.optional(v.string()),
  },
  handler: async (ctx, { ticketId, avis, motif }) => {
    const me = await requireDroit(ctx, "/tickets/arbitrage", "faire");
    const t = await ctx.db.get(ticketId);
    if (!t) throw new Error("Ticket introuvable.");
    const erreurs = controlerArbitrage(avis, motif);
    if (erreurs.length) throw new Error(erreurs.join(" "));

    await ctx.db.patch(ticketId, {
      avis, avisPar: me.nom ?? me.email, avisLe: maintenant(), avisMotif: motif?.trim() || undefined,
    });
    await journaliser(ctx, {
      auteurId: me._id, auteurNom: me.nom ?? me.email, action: "ticket_arbitrage",
      cible: t.titre, detail: `${LIBELLE_AVIS[avis]}${motif?.trim() ? ` — ${motif.trim()}` : ""}`,
    });
  },
});

/** Le développeur fait avancer l'état. Un abandon exige une note. */
export const avancer = mutation({
  args: {
    ticketId: v.id("tickets"),
    etat: v.union(v.literal("nouveau"), v.literal("en_cours"), v.literal("resolu"), v.literal("abandonne")),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { ticketId, etat, note }) => {
    const me = await requireDroit(ctx, "/tickets/traitement", "faire");
    const t = await ctx.db.get(ticketId);
    if (!t) throw new Error("Ticket introuvable.");
    const erreurs = controlerEtat(etat, note);
    if (erreurs.length) throw new Error(erreurs.join(" "));

    await ctx.db.patch(ticketId, {
      etat, etatPar: me.nom ?? me.email, etatLe: maintenant(), etatNote: note?.trim() || undefined,
    });
    await journaliser(ctx, {
      auteurId: me._id, auteurNom: me.nom ?? me.email, action: "ticket_traitement",
      cible: t.titre, detail: `${LIBELLE_ETAT[etat]}${note?.trim() ? ` — ${note.trim()}` : ""}`,
    });
  },
});

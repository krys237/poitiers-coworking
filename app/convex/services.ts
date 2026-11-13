// Services d'affectation (lot R1). Reprend la colonne SERVICE du planning de congé de la RH et
// y ajoute la couleur qu'elle demandait, pour repérer d'un coup d'œil quel service se vide.

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireDroit, requireUnDesDroits } from "./lib/authz";
import { couleurServiceParDefaut, PALETTE_SERVICES } from "./lib/planningAnnuel";

/**
 * Les services tels qu'ils figurent dans son classeur, dans l'ordre de première apparition —
 * ce qui détermine la couleur attribuée par défaut. Au-delà de 8, la couleur est neutre et
 * la RH en choisit une à la main (la palette n'est validée que sur 8 teintes).
 */
export const SERVICES_INITIAUX = [
  "PARAMETRES",
  "TECHNIQUE",
  "ADMIN",
  "IMAGERIE",
  "HOSPI",
  "CAISSE PHCIE",
  "LABORATOIRE",
  "SECRETARIAT",
  "COMPTABILITE",
  "GREEN ENERGY",
] as const;

const normaliser = (s: string) => s.trim().replace(/\s+/g, " ").toUpperCase();
const HEX = /^#[0-9a-fA-F]{6}$/;

export const liste = query({
  args: {},
  handler: async (ctx) => {
    // Le planning et les fiches employés ont tous deux besoin de la liste.
    await requireUnDesDroits(ctx, ["/paie/planning", "/employes"]);
    const lignes = await ctx.db.query("services").collect();
    lignes.sort((a, b) => a.ordre - b.ordre || a.nom.localeCompare(b.nom));
    return lignes;
  },
});

/** Crée les services du classeur. Idempotent : un nom déjà présent n'est pas touché. */
export const initialiser = mutation({
  args: {},
  handler: async (ctx) => {
    await requireDroit(ctx, "/paie/planning", "faire");
    const existants = await ctx.db.query("services").collect();
    const deja = new Set(existants.map((s) => normaliser(s.nom)));
    let ordre = existants.reduce((m, s) => Math.max(m, s.ordre), -1) + 1;
    let ajoutes = 0;

    for (const nom of SERVICES_INITIAUX) {
      if (deja.has(normaliser(nom))) continue;
      await ctx.db.insert("services", {
        nom,
        couleur: couleurServiceParDefaut(ordre),
        ordre,
        actif: true,
      });
      ordre++;
      ajoutes++;
    }
    return {
      ajoutes,
      conserves: existants.length,
      // Au-delà de la palette validée, la RH doit choisir : on le dit explicitement.
      sansCouleurDistincte: Math.max(0, ajoutes + existants.length - PALETTE_SERVICES.length),
    };
  },
});

export const enregistrer = mutation({
  args: {
    id: v.optional(v.id("services")),
    nom: v.string(),
    couleur: v.optional(v.string()),
    actif: v.optional(v.boolean()),
  },
  handler: async (ctx, { id, nom, couleur, actif }) => {
    await requireDroit(ctx, "/paie/planning", "faire");
    const propre = normaliser(nom);
    if (!propre) throw new Error("Le nom du service est obligatoire.");
    if (couleur && !HEX.test(couleur)) throw new Error("Couleur attendue au format #rrggbb.");

    const homonyme = (await ctx.db.query("services").collect()).find(
      (s) => normaliser(s.nom) === propre && s._id !== id,
    );
    if (homonyme) throw new Error(`Le service « ${homonyme.nom} » existe déjà.`);

    if (id) {
      const s = await ctx.db.get(id);
      if (!s) throw new Error("Service introuvable.");
      await ctx.db.patch(id, {
        nom: propre,
        couleur: couleur ?? s.couleur,
        actif: actif ?? s.actif,
      });
      return { id, cree: false };
    }
    const tous = await ctx.db.query("services").collect();
    const ordre = tous.reduce((m, s) => Math.max(m, s.ordre), -1) + 1;
    const nouveau = await ctx.db.insert("services", {
      nom: propre,
      couleur: couleur ?? couleurServiceParDefaut(ordre),
      ordre,
      actif: actif ?? true,
    });
    return { id: nouveau, cree: true };
  },
});

/**
 * Supprime un service. Refusé s'il reste des employés rattachés : on ne veut pas d'employé
 * orphelin dont le congé n'entre plus dans aucune détection de chevauchement.
 */
export const supprimer = mutation({
  args: { id: v.id("services") },
  handler: async (ctx, { id }) => {
    await requireDroit(ctx, "/paie/planning", "faire");
    const rattaches = await ctx.db
      .query("employes")
      .withIndex("by_service", (q) => q.eq("serviceId", id))
      .collect();
    if (rattaches.length)
      throw new Error(
        `${rattaches.length} employé(s) sont rattachés à ce service : réaffectez-les d'abord.`,
      );
    await ctx.db.delete(id);
  },
});

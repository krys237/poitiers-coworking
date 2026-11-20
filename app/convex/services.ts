// Services d'affectation (lot R1). Reprend la colonne SERVICE du planning de congé de la RH et
// y ajoute la couleur qu'elle demandait, pour repérer d'un coup d'œil quel service se vide.

import { query, mutation, internalMutation, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
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
    await requireUnDesDroits(ctx, ["/paie/planning", "/employes", "/commandes", "/interventions", "/membres", "/parametres"]);
    const lignes = await ctx.db.query("services").collect();
    lignes.sort((a, b) => a.ordre - b.ordre || a.nom.localeCompare(b.nom));
    // Les chefs sont stockés par identifiant ; l'écran a besoin de noms. On les résout ICI plutôt
    // que de laisser la page interroger la liste des membres : la consulter demande un droit que
    // le planning n'exige pas, et un écran de services n'a pas à réclamer l'accès aux membres
    // pour afficher deux noms. Un chef supprimé entre-temps est simplement omis.
    const membres = new Map<string, string>();
    for (const l of lignes) {
      for (const c of l.chefs ?? []) {
        if (membres.has(c)) continue;
        const u = await ctx.db.get(c);
        if (u) membres.set(c, u.nom ?? u.email);
      }
    }
    return lignes.map((l) => ({
      ...l,
      chefsDetail: (l.chefs ?? []).flatMap((c) => {
        const nom = membres.get(c);
        return nom ? [{ _id: c, nom }] : [];
      }),
    }));
  },
});

/**
 * Service d'un membre : le sien d'abord, celui de sa fiche employé à défaut.
 *
 * Deux champs portent la même notion pour deux raisons distinctes — `employes.serviceId` sert au
 * planning des congés, `users.serviceId` au routage des comptes rendus. Les faire cohabiter ici,
 * dans une seule fonction, évite que chaque appelant choisisse lequel fait foi : la réponse est
 * toujours « celui du membre, et sa fiche en repli ».
 */
export async function serviceDuMembre(
  ctx: QueryCtx,
  membre: { serviceId?: Id<"services">; employeId?: Id<"employes"> },
): Promise<Id<"services"> | null> {
  if (membre.serviceId) return membre.serviceId;
  if (!membre.employeId) return null;
  const fiche = await ctx.db.get(membre.employeId);
  return fiche?.serviceId ?? null;
}

/**
 * Chefs à qui adresser le compte rendu d'un membre. Vide si le membre n'a pas de service, si le
 * service n'a pas de chef, ou s'il en est lui-même le chef — un chef ne se rend pas de compte.
 */
export async function chefsDuMembre(
  ctx: QueryCtx,
  membre: { _id: Id<"users">; serviceId?: Id<"services">; employeId?: Id<"employes"> },
): Promise<Id<"users">[]> {
  const serviceId = await serviceDuMembre(ctx, membre);
  if (!serviceId) return [];
  const service = await ctx.db.get(serviceId);
  return (service?.chefs ?? []).filter((c) => c !== membre._id);
}

/**
 * Membres pouvant être désignés chefs d'un service : identifiant, nom, et poste en repère.
 *
 * Volontairement SÉPARÉE de `users.liste`, qui exige le droit « Membres » et rend la fiche
 * entière — rôle, société, exceptions de droits, état du compte. Un responsable du planning n'a
 * pas ce droit, et il n'en a pas besoin : désigner un chef demande de choisir un nom, pas de
 * consulter des dossiers. On expose donc le strict nécessaire, sous le droit du planning.
 *
 * Le poste sert à départager deux homonymes ; il est déjà visible partout où l'on voit un membre.
 */
export const membresAssignables = query({
  args: {},
  handler: async (ctx) => {
    await requireUnDesDroits(ctx, ["/paie/planning", "/employes"]);
    const membres = await ctx.db.query("users").collect();
    return membres
      .filter((m) => m.isActive)
      .map((m) => ({ _id: m._id, nom: m.nom ?? m.email, poste: m.poste ?? "" }))
      .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  },
});

/**
 * Reprend le service des fiches employés sur les membres qui n'en ont pas encore.
 *
 * `internalMutation` et non `mutation` gardée : les deux migrations RH de novembre étaient
 * publiques mais protégées par `requireDroit`, donc sans interface ET hors d'atteinte du CLI
 * (`convex run` n'ouvre pas de session) — inappelables, elles ont bloqué une fusion trois
 * semaines. Celle-ci se lance en une ligne, rend compte de ce qu'elle a fait, et ne touche
 * jamais un membre qui a déjà son propre service : le rattachement explicite prime.
 */
export const reprendreServicesDepuisFiches = internalMutation({
  args: {},
  handler: async (ctx) => {
    const membres = await ctx.db.query("users").collect();
    let repris = 0, dejaRattaches = 0, sansFiche = 0, ficheSansService = 0;
    for (const m of membres) {
      if (m.serviceId) { dejaRattaches++; continue; }
      if (!m.employeId) { sansFiche++; continue; }
      const fiche = await ctx.db.get(m.employeId);
      if (!fiche?.serviceId) { ficheSansService++; continue; }
      await ctx.db.patch(m._id, { serviceId: fiche.serviceId });
      repris++;
    }
    return { membres: membres.length, repris, dejaRattaches, sansFiche, ficheSansService };
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
    chefs: v.optional(v.array(v.id("users"))),
    responsableId: v.optional(v.id("users")),
  },
  handler: async (ctx, { id, nom, couleur, actif, chefs, responsableId }) => {
    await requireDroit(ctx, "/paie/planning", "faire");
    const propre = normaliser(nom);
    if (!propre) throw new Error("Le nom du service est obligatoire.");
    if (couleur && !HEX.test(couleur)) throw new Error("Couleur attendue au format #rrggbb.");

    const homonyme = (await ctx.db.query("services").collect()).find(
      (s) => normaliser(s.nom) === propre && s._id !== id,
    );
    if (homonyme) throw new Error(`Le service « ${homonyme.nom} » existe déjà.`);

    // Un ou deux chefs, pas davantage : au-delà, « le chef du service » ne désigne plus personne
    // et le routage des comptes rendus n'a plus de destinataire unique. Le doublon est refusé
    // plutôt que dédupliqué en silence — deux fois la même personne est une erreur de saisie.
    if (chefs !== undefined) {
      if (chefs.length > 2) throw new Error("Un service compte au plus deux chefs.");
      if (new Set(chefs).size !== chefs.length) throw new Error("Le même membre est désigné deux fois comme chef.");
      for (const c of chefs) {
        const membre = await ctx.db.get(c);
        if (!membre) throw new Error("Membre introuvable parmi les chefs désignés.");
        if (!membre.isActive) throw new Error(`${membre.nom ?? membre.email} est désactivé : il ne peut pas être chef de service.`);
      }
    }

    if (id) {
      const s = await ctx.db.get(id);
      if (!s) throw new Error("Service introuvable.");
      await ctx.db.patch(id, {
        nom: propre,
        couleur: couleur ?? s.couleur,
        actif: actif ?? s.actif,
        chefs: chefs ?? s.chefs,
        ...(responsableId !== undefined ? { responsableId } : {}),
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
      chefs: chefs ?? [],
      ...(responsableId !== undefined ? { responsableId } : {}),
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

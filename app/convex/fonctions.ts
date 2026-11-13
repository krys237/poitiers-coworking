// Référentiel des fonctions (lot R10).
//
// « Je constate aussi que les fonctions soient vides. La RH doit pouvoir en créer depuis la
// plateforme » — constat du 03/11/2026. `employes.fonction` était un champ texte libre : rien ne
// proposait de valeur, donc personne n'en saisissait.
//
// Choix de conception : la fiche employé garde un champ TEXTE et reçoit le libellé choisi, au lieu
// de pointer vers une ligne du référentiel. C'est volontaire — renommer ou supprimer une fonction
// ne doit pas effacer celle inscrite sur une fiche, ni contredire un contrat déjà signé. Le
// référentiel propose, il ne contraint pas.

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireDroit, requireUnDesDroits } from "./lib/authz";

const normaliser = (s: string) => s.trim().replace(/\s+/g, " ");

/** Les fonctions, actives d'abord, par ordre alphabétique. */
export const liste = query({
  args: { inclureInactives: v.optional(v.boolean()) },
  handler: async (ctx, { inclureInactives }) => {
    // Le référentiel sert la fiche employé et le futur générateur d'actes.
    await requireUnDesDroits(ctx, ["/employes", "/paie/saisie"]);
    const toutes = await ctx.db.query("fonctions").collect();
    const lignes = inclureInactives ? toutes : toutes.filter((f) => f.actif);
    lignes.sort((a, b) => a.libelle.localeCompare(b.libelle, "fr"));
    return lignes;
  },
});

export const enregistrer = mutation({
  args: {
    id: v.optional(v.id("fonctions")),
    libelle: v.string(),
    categorie: v.optional(v.string()),
    echelon: v.optional(v.string()),
    actif: v.optional(v.boolean()),
  },
  handler: async (ctx, { id, libelle, categorie, echelon, actif }) => {
    await requireDroit(ctx, "/employes", "faire");
    const propre = normaliser(libelle);
    if (!propre) throw new Error("Le libellé de la fonction est obligatoire.");

    // Comparaison insensible à la casse et aux espaces : « Aide soignant » et « aide  soignant »
    // sont la même fonction, et deux lignes jumelles rendraient la liste inutilisable.
    const homonyme = (await ctx.db.query("fonctions").collect()).find(
      (f) => f.libelle.toLowerCase() === propre.toLowerCase() && f._id !== id,
    );
    if (homonyme) throw new Error(`La fonction « ${homonyme.libelle} » existe déjà.`);

    if (id) {
      const f = await ctx.db.get(id);
      if (!f) throw new Error("Fonction introuvable.");
      await ctx.db.patch(id, {
        libelle: propre,
        categorie: categorie?.trim() || undefined,
        echelon: echelon?.trim() || undefined,
        actif: actif ?? f.actif,
      });
      return { id, cree: false };
    }
    const nouveau = await ctx.db.insert("fonctions", {
      libelle: propre,
      categorie: categorie?.trim() || undefined,
      echelon: echelon?.trim() || undefined,
      actif: actif ?? true,
    });
    return { id: nouveau, cree: true };
  },
});

/**
 * Désactive au lieu de supprimer quand la fonction est portée par des fiches : la supprimer
 * laisserait un libellé orphelin sur les employés concernés, sans trace de son existence.
 */
export const supprimer = mutation({
  args: { id: v.id("fonctions") },
  handler: async (ctx, { id }) => {
    await requireDroit(ctx, "/employes", "faire");
    const f = await ctx.db.get(id);
    if (!f) throw new Error("Fonction introuvable.");
    const porteurs = (await ctx.db.query("employes").collect()).filter(
      (e) => (e.fonction ?? "").toLowerCase() === f.libelle.toLowerCase(),
    );
    if (porteurs.length) {
      await ctx.db.patch(id, { actif: false });
      return { supprimee: false, desactivee: true, porteurs: porteurs.length };
    }
    await ctx.db.delete(id);
    return { supprimee: true, desactivee: false, porteurs: 0 };
  },
});

/**
 * Amorce le référentiel avec les fonctions DÉJÀ saisies en texte libre sur les fiches.
 * Idempotente : un libellé déjà présent n'est pas dupliqué. C'est la première chose à lancer,
 * sinon la RH devrait ressaisir ce qui existe déjà.
 */
export const reprendreDesFiches = mutation({
  args: {},
  handler: async (ctx) => {
    await requireDroit(ctx, "/employes", "faire");
    const existantes = new Set(
      (await ctx.db.query("fonctions").collect()).map((f) => f.libelle.toLowerCase()),
    );
    const employes = await ctx.db.query("employes").collect();

    // Une fonction par libellé distinct, avec la catégorie et l'échelon les plus fréquents —
    // deux fiches peuvent porter la même fonction dans des classements différents.
    const vues = new Map<string, { libelle: string; categories: string[]; echelons: string[] }>();
    for (const e of employes) {
      const propre = normaliser(e.fonction ?? "");
      if (!propre) continue;
      const cle = propre.toLowerCase();
      if (existantes.has(cle)) continue;
      const v = vues.get(cle) ?? { libelle: propre, categories: [], echelons: [] };
      if (e.categorie) v.categories.push(e.categorie);
      if (e.echelon) v.echelons.push(e.echelon);
      vues.set(cle, v);
    }

    const plusFrequent = (xs: string[]) => {
      if (!xs.length) return undefined;
      const n = new Map<string, number>();
      for (const x of xs) n.set(x, (n.get(x) ?? 0) + 1);
      return [...n.entries()].sort((a, b) => b[1] - a[1])[0][0];
    };

    for (const v of vues.values()) {
      await ctx.db.insert("fonctions", {
        libelle: v.libelle,
        categorie: plusFrequent(v.categories),
        echelon: plusFrequent(v.echelons),
        actif: true,
      });
    }
    return {
      ajoutees: vues.size,
      dejaPresentes: existantes.size,
      fichesSansFonction: employes.filter((e) => !normaliser(e.fonction ?? "")).length,
    };
  },
});

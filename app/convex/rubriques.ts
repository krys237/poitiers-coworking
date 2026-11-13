// Catalogue DATÉ des rubriques de paie et de leur appartenance aux assiettes (lot R2).
//
// Pourquoi daté : la responsable RH a demandé que la définition des assiettes figure « au niveau
// du barème ». La conséquence technique est la règle d'or du dépôt — on ne recalcule jamais un
// mois clôturé avec une définition plus récente. Un bulletin résout donc sa version de catalogue
// exactement comme il résout son barème.

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireDroit } from "./lib/authz";
import { journaliser } from "./lib/journal";
import { RUBRIQUES_DEFAUT, rubriquesApplicables, validerRubriques } from "./lib/rubriques";
import type { Rubrique } from "./lib/rubriques";
import type { QueryCtx } from "./_generated/server";

const rubriqueV = v.object({
  code: v.string(),
  libelle: v.string(),
  sens: v.union(v.literal("gain"), v.literal("retenue")),
  ordre: v.number(),
  dansBrut: v.boolean(),
  dansBrutIntermediaire: v.boolean(),
  dansCotisable: v.boolean(),
  dansAllocConge: v.boolean(),
  proratisable: v.boolean(),
  avantageNature: v.optional(
    v.object({ tauxForfait: v.number(), plafonnerAuForfait: v.boolean() }),
  ),
});

/** Les rubriques applicables à une période, pour le moteur. Repli : le catalogue par défaut. */
export async function rubriquesPourPeriode(ctx: QueryCtx, periode: string): Promise<Rubrique[]> {
  const versions = await ctx.db.query("rubriquesPaie").withIndex("by_effective").collect();
  return rubriquesApplicables(
    versions.map((x) => ({ effectiveFrom: x.effectiveFrom, rubriques: x.rubriques as Rubrique[] })),
    periode,
  );
}

/** Toutes les versions, la plus récente d'abord. */
export const liste = query({
  args: {},
  handler: async (ctx) => {
    await requireDroit(ctx, "/bareme");
    const versions = await ctx.db.query("rubriquesPaie").withIndex("by_effective").collect();
    versions.sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
    return {
      versions,
      // Tant qu'aucune version n'est enregistrée, le moteur applique ce catalogue.
      defaut: RUBRIQUES_DEFAUT,
    };
  },
});

/** Le catalogue effectivement appliqué à une période, avec la matrice rubrique × assiette. */
export const pourPeriode = query({
  args: { periode: v.string() },
  handler: async (ctx, { periode }) => {
    await requireDroit(ctx, "/bareme");
    const rubriques = await rubriquesPourPeriode(ctx, periode);
    return {
      periode,
      rubriques,
      // Récapitulatif par assiette, pour que le comptable puisse contrôler d'un coup d'œil.
      resume: {
        brut: rubriques.filter((r) => r.dansBrut).map((r) => r.libelle),
        brutIntermediaire: rubriques.filter((r) => r.dansBrutIntermediaire).map((r) => r.libelle),
        cotisable: rubriques.filter((r) => r.dansCotisable).map((r) => r.libelle),
        allocConge: rubriques.filter((r) => r.dansAllocConge).map((r) => r.libelle),
        avantagesNature: rubriques
          .filter((r) => r.avantageNature)
          .map((r) => `${r.libelle} (${r.avantageNature!.tauxForfait} %)`),
      },
    };
  },
});

/**
 * Nouvelle version datée du catalogue. Même niveau de droit qu'une nouvelle version de barème :
 * changer l'appartenance d'une rubrique à une assiette change l'impôt de tout l'effectif.
 * Sans `rubriques`, la version est amorcée avec `RUBRIQUES_DEFAUT`.
 */
export const upsert = mutation({
  args: {
    effectiveFrom: v.string(),
    source: v.string(),
    rubriques: v.optional(v.array(rubriqueV)),
  },
  handler: async (ctx, { effectiveFrom, source, rubriques }) => {
    const me = await requireDroit(ctx, "/bareme", "faire");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom))
      throw new Error("Date d'effet au format AAAA-MM-JJ.");

    const liste = (rubriques ?? RUBRIQUES_DEFAUT) as Rubrique[];
    const erreurs = validerRubriques(liste);
    if (erreurs.length) throw new Error(erreurs.join(" "));

    const existante = (await ctx.db.query("rubriquesPaie").withIndex("by_effective").collect()).find(
      (x) => x.effectiveFrom === effectiveFrom,
    );
    if (existante) await ctx.db.patch(existante._id, { rubriques: liste, source });
    else await ctx.db.insert("rubriquesPaie", { effectiveFrom, source, rubriques: liste });

    await journaliser(ctx, {
      auteurId: me._id,
      auteurNom: me.name ?? me.email,
      action: "bareme_version",
      cible: `rubriques ${effectiveFrom}`,
      detail: `${liste.length} rubrique(s) — ${source}`,
    });
    return { effectiveFrom, rubriques: liste.length, cree: !existante };
  },
});

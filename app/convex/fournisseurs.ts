import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireDroit } from "./lib/authz";
import { avecIndicatif, erreurTelephone, INDICATIF_DEFAUT } from "./lib/telephone";

export const liste = query({
  args: { inclureInactifs: v.optional(v.boolean()) },
  handler: async (ctx, { inclureInactifs }) => {
    await requireDroit(ctx, "/commandes");
    const q = ctx.db.query("fournisseurs");
    const tous = await q.order("desc").collect();
    const filtres = inclureInactifs ? tous : tous.filter((f) => f.actif !== false);
    return filtres.sort((a, b) => a.nom.localeCompare(b.nom));
  },
});

export const creer = mutation({
  args: {
    nom: v.string(),
    telephone: v.string(),
    ville: v.optional(v.string()),
    email: v.optional(v.string()),
    categories: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const user = await requireDroit(ctx, "/commandes", "faire");
    const nomClean = args.nom.trim();
    if (!nomClean) throw new Error("Le nom du fournisseur est obligatoire.");

    const telAvecIndicatif = avecIndicatif(args.telephone.trim());
    const errTel = erreurTelephone(telAvecIndicatif);
    if (errTel) throw new Error(errTel);

    // Vérifier si un fournisseur du même nom existe déjà
    const existant = await ctx.db
      .query("fournisseurs")
      .withIndex("by_nom", (q) => q.eq("nom", nomClean))
      .first();

    if (existant && existant.actif) {
      throw new Error(`Un fournisseur nommé "${nomClean}" existe déjà.`);
    }

    const id = await ctx.db.insert("fournisseurs", {
      nom: nomClean,
      telephone: telAvecIndicatif,
      ville: args.ville?.trim() || undefined,
      email: args.email?.trim() || undefined,
      categories: args.categories,
      actif: true,
      creePar: user._id,
      creeLe: new Date().toISOString(),
    });

    return id;
  },
});

export const modifier = mutation({
  args: {
    id: v.id("fournisseurs"),
    nom: v.string(),
    telephone: v.string(),
    ville: v.optional(v.string()),
    email: v.optional(v.string()),
    categories: v.optional(v.array(v.string())),
    actif: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireDroit(ctx, "/commandes", "faire");
    const nomClean = args.nom.trim();
    if (!nomClean) throw new Error("Le nom du fournisseur est obligatoire.");

    const telAvecIndicatif = avecIndicatif(args.telephone.trim());
    const errTel = erreurTelephone(telAvecIndicatif);
    if (errTel) throw new Error(errTel);

    await ctx.db.patch(args.id, {
      nom: nomClean,
      telephone: telAvecIndicatif,
      ville: args.ville?.trim() || undefined,
      email: args.email?.trim() || undefined,
      categories: args.categories,
      ...(args.actif !== undefined ? { actif: args.actif } : {}),
    });
  },
});

export const toggleActif = mutation({
  args: { id: v.id("fournisseurs") },
  handler: async (ctx, { id }) => {
    await requireDroit(ctx, "/commandes", "faire");
    const f = await ctx.db.get(id);
    if (!f) throw new Error("Fournisseur introuvable.");
    await ctx.db.patch(id, { actif: !f.actif });
    return !f.actif;
  },
});

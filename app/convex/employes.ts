import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireDroit, requireUnDesDroits } from "./lib/authz";
import { lireReglages } from "./parametres";
import { normaliserTelephone, erreurTelephone } from "./lib/telephone";

const SOCIETE = v.union(v.literal("SESAME"), v.literal("SOFINA"), v.literal("SGC"));

// Numéro WhatsApp : même règle que tout téléphone de l'application (indicatif obligatoire, lib/telephone).
function numeroWhatsapp(brut: string | undefined): string | undefined {
  if (!brut || !brut.trim()) return undefined;
  const err = erreurTelephone(brut);
  if (err) throw new Error(`WhatsApp : ${err}`);
  return normaliserTelephone(brut)!;
}

export const liste = query({
  args: { societe: v.optional(SOCIETE) },
  handler: async (ctx, { societe }) => {
    await requireUnDesDroits(ctx, ["/employes", "/paie/saisie", "/paie/planning", "/paie/primes", "/paie/bulletins"]);
    if (societe) {
      return await ctx.db.query("employes").withIndex("by_societe", (q) => q.eq("societe", societe)).collect();
    }
    return await ctx.db.query("employes").collect();
  },
});

export const creer = mutation({
  args: {
    matricule: v.string(), nom: v.string(), fonction: v.optional(v.string()),
    adresse: v.optional(v.string()), cnps: v.optional(v.string()), niu: v.optional(v.string()),
    email: v.optional(v.string()), whatsapp: v.optional(v.string()), societe: SOCIETE, salaireBrut: v.number(), contrat: v.optional(v.string()),
    dateDebut: v.optional(v.string()), dateFin: v.optional(v.string()), congesInitial: v.optional(v.number()),
    categorie: v.optional(v.string()), echelon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireDroit(ctx, "/employes", "faire");
    return await ctx.db.insert("employes", { ...args, whatsapp: numeroWhatsapp(args.whatsapp), joursBase: (await lireReglages(ctx)).joursBaseDefaut, actif: true });
  },
});

// Mise à jour partielle d'une fiche (e-mail, fonction, société, dates, solde de congés initial…).
export const modifier = mutation({
  args: {
    employeId: v.id("employes"),
    email: v.optional(v.string()), fonction: v.optional(v.string()), adresse: v.optional(v.string()),
    // "" efface le numéro WhatsApp ; absent = inchangé.
    whatsapp: v.optional(v.string()),
    cnps: v.optional(v.string()), niu: v.optional(v.string()), societe: v.optional(SOCIETE),
    salaireBrut: v.optional(v.number()), actif: v.optional(v.boolean()),
    dateDebut: v.optional(v.string()), dateFin: v.optional(v.string()), congesInitial: v.optional(v.number()),
    categorie: v.optional(v.string()), echelon: v.optional(v.string()),
  },
  handler: async (ctx, { employeId, ...patch }) => {
    await requireDroit(ctx, "/employes", "faire");
    const { whatsapp, ...reste } = patch;
    const propre: Record<string, unknown> = Object.fromEntries(Object.entries(reste).filter(([, val]) => val !== undefined));
    if (whatsapp !== undefined) propre.whatsapp = numeroWhatsapp(whatsapp);
    await ctx.db.patch(employeId, propre);
  },
});

// Import Excel/CSV : upsert par matricule (sinon par nom). Recalcul réactif automatique ensuite.
export const importer = mutation({
  args: {
    lignes: v.array(v.object({
      matricule: v.string(), nom: v.string(), fonction: v.optional(v.string()),
      adresse: v.optional(v.string()), cnps: v.optional(v.string()), niu: v.optional(v.string()),
      email: v.optional(v.string()), whatsapp: v.optional(v.string()), societe: SOCIETE, salaireBrut: v.number(),
      dateDebut: v.optional(v.string()),
    })),
  },
  handler: async (ctx, { lignes }) => {
    await requireDroit(ctx, "/employes", "faire");
    const joursBase = (await lireReglages(ctx)).joursBaseDefaut;
    let crees = 0, majs = 0;
    for (const brute of lignes) {
      const l = { ...brute, whatsapp: numeroWhatsapp(brute.whatsapp) };
      if (!l.whatsapp) delete l.whatsapp; // une colonne vide n'efface pas un numéro déjà saisi
      const existant = await ctx.db
        .query("employes")
        .withIndex("by_matricule", (q) => q.eq("matricule", l.matricule))
        .unique();
      if (existant) { await ctx.db.patch(existant._id, l); majs++; }
      else { await ctx.db.insert("employes", { ...l, joursBase, actif: true }); crees++; }
    }
    return { crees, majs };
  },
});

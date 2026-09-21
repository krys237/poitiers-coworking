import { query, mutation, internalQuery, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { requireLevel, DEV_BYPASS } from "./lib/authz";
import { journaliser } from "./lib/journal";
import { reglagesDe, validerReglages, type Reglages } from "./lib/reglages";

// Paramètres entreprise : singleton (première ligne). Apparaissent en en-tête/filigrane des PDF.
export const get = query({
  args: {},
  handler: async (ctx) => (await ctx.db.query("parametresEntreprise").first()) ?? null,
});

export const enregistrer = mutation({
  args: {
    nom: v.string(), adresse: v.string(), logoUrl: v.optional(v.string()),
    filigrane: v.optional(v.string()), couleurEntete: v.optional(v.string()),
    modeleCourrier: v.optional(v.string()), emailExpediteur: v.optional(v.string()),
    congesParMois: v.optional(v.number()),
    niu: v.optional(v.string()), numeroCnps: v.optional(v.string()), responsableRH: v.optional(v.string()), jourPaiement: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const me = await requireLevel(ctx, 7);
    const existant = await ctx.db.query("parametresEntreprise").first();
    if (existant) await ctx.db.patch(existant._id, args);
    else await ctx.db.insert("parametresEntreprise", args);
    await journaliser(ctx, { auteurId: me._id, auteurNom: me.nom ?? me.email, action: "parametres_modification", cible: "entreprise", detail: Object.keys(args).join(", ") });
  },
});

// Modèle de lettre + expéditeur (accessible dès le niveau RH, sans toucher aux autres paramètres).
export const modifierCourrier = mutation({
  args: { modeleCourrier: v.optional(v.string()), emailExpediteur: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireLevel(ctx, 4);
    const existant = await ctx.db.query("parametresEntreprise").first();
    if (!existant) throw new Error("Paramètres entreprise non initialisés.");
    await ctx.db.patch(existant._id, args);
  },
});

// --- Réglages de fonctionnement (lib/reglages.ts) ---------------------------------------

/** Réglages effectifs, pour les fonctions serveur (défauts appliqués). */
export async function lireReglages(ctx: QueryCtx | MutationCtx): Promise<Reglages> {
  const p = await ctx.db.query("parametresEntreprise").first();
  return reglagesDe(p?.reglages);
}

// Version interne pour les actions ("use node"), qui n'ont pas ctx.db.
export const reglagesInternes = internalQuery({
  args: {},
  handler: async (ctx): Promise<Reglages> => await lireReglages(ctx),
});

const reglagesV = v.object({
  crHeureOuverture: v.number(), crHeureFermeture: v.number(), crSamedi: v.boolean(),
  verrouFinancierMin: v.number(),
  envoiReelActive: v.boolean(), iaDocumentsActive: v.boolean(), pdfAutoCloture: v.boolean(),
  joursBaseDefaut: v.number(), plafondSaisie: v.number(),
});

export const enregistrerReglages = mutation({
  args: { reglages: reglagesV },
  handler: async (ctx, { reglages }) => {
    const me = await requireLevel(ctx, 7);
    const erreurs = validerReglages(reglages);
    if (erreurs.length) throw new Error(erreurs.join(" "));
    const existant = await ctx.db.query("parametresEntreprise").first();
    if (!existant) throw new Error("Paramètres entreprise non initialisés.");
    const avant = reglagesDe(existant.reglages);
    const changes = (Object.keys(reglages) as (keyof Reglages)[]).filter((k) => avant[k] !== reglages[k]);
    await ctx.db.patch(existant._id, { reglages });
    if (changes.length) await journaliser(ctx, { auteurId: me._id, auteurNom: me.nom ?? me.email, action: "parametres_modification", cible: "réglages", detail: changes.map((k) => `${k} : ${String(avant[k])} → ${String(reglages[k])}`).join(" · ") });
  },
});

// --- État du déploiement (super administrateur) ----------------------------------------
// Dit QUELLES variables sont définies et ce que leur absence implique — jamais leur valeur.
export const etatDeploiement = query({
  args: {},
  handler: async (ctx) => {
    await requireLevel(ctx, 8);
    const definie = (k: string) => !!process.env[k];
    return {
      deploiement: process.env.CONVEX_CLOUD_URL ?? null,
      site: process.env.CONVEX_SITE_URL ?? null,
      bypassDev: DEV_BYPASS,
      variables: [
        { cle: "AUTH_DEV_BYPASS", definie: DEV_BYPASS, role: "Mode développement : toute personne ayant le lien agit comme le membre « dev ».", absence: "Connexion obligatoire (Convex Auth).", sensible: true },
        { cle: "JWT_PRIVATE_KEY", definie: definie("JWT_PRIVATE_KEY"), role: "Signature des jetons de session (Convex Auth).", absence: "Aucune session ne peut s'ouvrir : application déconnectée en silence." },
        { cle: "JWKS", definie: definie("JWKS"), role: "Clés publiques de vérification des jetons.", absence: "Idem : sessions impossibles." },
        { cle: "SITE_URL", definie: definie("SITE_URL"), role: "URL du frontend, pour les liens des e-mails d'authentification.", absence: "Liens de connexion cassés." },
        { cle: "RESEND_API_KEY", definie: definie("RESEND_API_KEY"), role: "Envoi des e-mails : courrier de paie et codes à usage unique.", absence: "Courrier simulé (journal seul) ; code OTP écrit dans les logs en mode dev, refusé en production." },
        { cle: "FINANCIAL_API_KEY", definie: definie("FINANCIAL_API_KEY"), role: "Clé de l'API d'export financier (re-validée à chaque appel).", absence: "Tout appel de l'API répond 503." },
        { cle: "BAREME_SOURCE_URL", definie: definie("BAREME_SOURCE_URL"), role: "Source officielle du barème, contrôlée chaque jour à 06:00 UTC.", absence: "Le contrôle journalise « source non configurée » et conserve le barème actif." },
        { cle: "ANTHROPIC_API_KEY", definie: definie("ANTHROPIC_API_KEY"), role: "Extraction des métadonnées des documents par IA (claude-opus-5).", absence: "Repli heuristique : titre = nom du fichier, catégorie par mots-clés." },
      ],
    };
  },
});

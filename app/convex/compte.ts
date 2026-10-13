// Comptes de connexion (décisions du 13/10/2026) : création avec mot de passe provisoire, changement par
// le membre, réinitialisation par la Direction. Les identifiants vivent dans Convex Auth (table
// `authAccounts`, fournisseur "password") : ses helpers exigent un contexte d'action, d'où ce fichier.
import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";
import { getAuthUserId, createAccount, modifyAccountCredentials, retrieveAccount, invalidateSessions } from "@convex-dev/auth/server";
import { DataModel, Id } from "./_generated/dataModel";
import { GenericActionCtx } from "convex/server";
import { MOT_DE_PASSE_PROVISOIRE, erreurNouveauMotDePasse } from "./lib/motDePasse";

const PROVIDER = "password";
const ROLE = v.union(
  v.literal("employe"), v.literal("chef_equipe"), v.literal("comptable"), v.literal("gestionnaire_rh"),
  v.literal("da1"), v.literal("dg"), v.literal("super_admin"), v.literal("auditeur_externe")
);
const SOCIETE = v.union(v.literal("SESAME"), v.literal("SOFINA"), v.literal("SGC"));

/** Pose le mot de passe provisoire sur un compte, qu'il existe déjà ou non. */
async function poserProvisoire(ctx: GenericActionCtx<DataModel>, email: string) {
  const existe = await retrieveAccount(ctx, { provider: PROVIDER, account: { id: email } }).catch(() => null);
  if (existe) await modifyAccountCredentials(ctx, { provider: PROVIDER, account: { id: email, secret: MOT_DE_PASSE_PROVISOIRE } });
  else await createAccount(ctx, { provider: PROVIDER, account: { id: email, secret: MOT_DE_PASSE_PROVISOIRE }, profile: { email, role: "employe", isActive: false } }); // profil ignoré : la ligne users existe déjà (auth.createOrUpdateUser la retrouve par e-mail)
}

/**
 * Créer un membre ET son compte de connexion : le membre se connecte aussitôt (téléphone ou e-mail)
 * avec le mot de passe provisoire, qu'il doit changer à sa première connexion.
 */
export const creerMembre = action({
  args: {
    email: v.optional(v.string()), nom: v.optional(v.string()), role: ROLE, poste: v.optional(v.string()), departement: v.optional(v.string()),
    societe: v.optional(SOCIETE), codeAcces: v.optional(v.string()), phone: v.optional(v.string()), employeId: v.optional(v.id("employes")),
  },
  handler: async (ctx, a): Promise<{ id: Id<"users">; email: string }> => {
    const { id, email } = await ctx.runMutation(api.users.creer, a);
    await poserProvisoire(ctx, email);
    return { id, email };
  },
});

/** Ouvrir un compte à une fiche employé (écran Employés) : membre « Employé » créé avec le nom, le téléphone
 *  WhatsApp et l'e-mail de la fiche, relié à elle, mot de passe provisoire. */
export const creerCompteEmploye = action({
  args: { employeId: v.id("employes") },
  handler: async (ctx, { employeId }): Promise<{ id: Id<"users">; email: string }> => {
    const e = await ctx.runQuery(internal.users.pourCompteEmploye, { employeId });
    const { id, email } = await ctx.runMutation(api.users.creer, { nom: e.nom, email: e.email, phone: e.phone, societe: e.societe, poste: e.poste, role: "employe", employeId });
    await poserProvisoire(ctx, email);
    return { id, email };
  },
});

/** Réinitialisation par la Direction (droit « Membres : réinitialiser un mot de passe ») : mot de passe
 *  provisoire remis, sessions ouvertes fermées, changement obligatoire à la prochaine connexion. */
export const reinitialiser = action({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<{ email: string }> => {
    const cible = await ctx.runQuery(internal.users.pourReinitialisation, { userId });
    await poserProvisoire(ctx, cible.email);
    await invalidateSessions(ctx, { userId });
    await ctx.runMutation(internal.users.marquerMotDePasse, { userId, provisoire: true, auteurId: cible.auteurId });
    return { email: cible.email };
  },
});

/** Le membre change son propre mot de passe : l'ancien est vérifié, le nouveau suit les règles. */
export const changerMotDePasse = action({
  args: { ancien: v.string(), nouveau: v.string() },
  handler: async (ctx, { ancien, nouveau }): Promise<void> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Non authentifié.");
    const me = await ctx.runQuery(api.users.me, {});
    if (!me) throw new Error("Non authentifié.");
    const e = erreurNouveauMotDePasse(nouveau, ancien);
    if (e) throw new Error(e);
    try {
      await retrieveAccount(ctx, { provider: PROVIDER, account: { id: me.email, secret: ancien } });
    } catch {
      throw new Error("Mot de passe actuel incorrect.");
    }
    await modifyAccountCredentials(ctx, { provider: PROVIDER, account: { id: me.email, secret: nouveau } });
    await ctx.runMutation(internal.users.marquerMotDePasse, { userId, provisoire: false });
  },
});

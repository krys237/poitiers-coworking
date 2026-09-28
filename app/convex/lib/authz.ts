import { getAuthUserId } from "@convex-dev/auth/server";
import { QueryCtx, MutationCtx } from "../_generated/server";
import { Doc } from "../_generated/dataModel";
import { NIVEAU, Role, droitsEffectifs, type Action, type Droits } from "../rbac";

// Mode développement : si AUTH_DEV_BYPASS=true (variable d'env Convex) et qu'aucune session
// Convex Auth n'est ouverte, on agit comme le membre DG marqué "dev".
// ⚠️ À RETIRER EN PRODUCTION : tant qu'elle est active, toute personne ayant le lien est DG.
// `users.me` expose `modeDev` pour que l'interface puisse l'afficher en évidence.
export const DEV_BYPASS = process.env.AUTH_DEV_BYPASS === "true";
export const DEV_TOKEN = "dev:dg";
// Membres pré-provisionnés par e-mail (Gestion des membres) : le jeton "pending:<email>" est
// retiré à la première connexion, quand `auth.createOrUpdateUser` rattache la ligne au compte.
export const PENDING_PREFIX = "pending:";

type Ctx = QueryCtx | MutationCtx;

async function parToken(ctx: Ctx, token: string) {
  return await ctx.db.query("users").withIndex("by_token", (q) => q.eq("tokenIdentifier", token)).unique();
}

// Récupère le membre courant. Depuis P1, l'identité vient de Convex Auth : l'_id de la session
// EST l'_id de la ligne `users` (la table métier sert de table d'identité — voir schema.ts),
// donc plus aucune résolution par jeton n'est nécessaire pour un compte réel.
// Le rattachement des membres pré-provisionnés a migré dans `auth.ts` (createOrUpdateUser).
export async function getCurrentUser(ctx: Ctx): Promise<Doc<"users"> | null> {
  const userId = await getAuthUserId(ctx);
  if (userId) return await ctx.db.get(userId);
  if (!DEV_BYPASS) return null;
  return await parToken(ctx, DEV_TOKEN);
}

// Messages distincts : l'interface doit pouvoir différencier « pas connecté », « en attente
// de validation » et « désactivé » — trois situations qui appellent trois réponses différentes.
function verifierCompte(user: Doc<"users"> | null) {
  if (!user) throw new Error("Non authentifié.");
  if (user.enAttente) throw new Error("Compte en attente d'autorisation : un Directeur Général doit valider votre accès.");
  if (!user.isActive) throw new Error("Compte désactivé. Contactez le Directeur Général.");
  return user;
}

// Exige un niveau minimum ; lève une erreur sinon.
export async function requireLevel(ctx: Ctx, min: number) {
  const user = verifierCompte(await getCurrentUser(ctx));
  if (NIVEAU[user.role as Role] < min) throw new Error("Accès refusé : niveau insuffisant.");
  return user;
}

// Droits effectifs d'un membre : défaut de son rôle, surcharges du directeur, exceptions personnelles.
export async function droitsDuMembre(ctx: Ctx, user: Doc<"users">): Promise<Droits> {
  const p = await ctx.db.query("parametresEntreprise").first();
  return droitsEffectifs(user.role as Role, p?.droitsRoles ?? [], user.droitsPerso ?? []);
}

// Le membre lit-il les documents confidentiels ? (droit « Documents confidentiels », VOIR)
export async function lireConfidentiel(ctx: Ctx, user: Doc<"users">): Promise<boolean> {
  return (await droitsDuMembre(ctx, user))["/documents/confidentiels"].voir;
}

// Exige le droit VOIR ou FAIRE sur un module (clé de rbac.MODULES) ; lève une erreur sinon.
export async function requireDroit(ctx: Ctx, module: string, action: Action = "voir") {
  return await requireUnDesDroits(ctx, [module], action);
}

// Variante pour une donnée partagée par plusieurs écrans : un seul des modules suffit.
export async function requireUnDesDroits(ctx: Ctx, modules: string[], action: Action = "voir") {
  const user = verifierCompte(await getCurrentUser(ctx));
  const d = await droitsDuMembre(ctx, user);
  if (!modules.some((m) => d[m]?.[action])) throw new Error(action === "voir" ? "Accès refusé : ce module ne vous est pas ouvert." : "Accès refusé : vous pouvez consulter ce module, pas y agir.");
  return user;
}

// Amorçage d'un déploiement neuf : tant qu'AUCUN membre n'existe, la fonction est ouverte
// (c'est elle qui crée le premier DG) ; dès qu'un membre existe, le niveau est exigé normalement.
// Réservé aux fonctions d'initialisation (seed) — ne jamais l'utiliser sur une fonction métier.
export async function requireLevelOuAmorcage(ctx: Ctx, min: number) {
  const premier = await ctx.db.query("users").first();
  if (!premier) return null;
  return await requireLevel(ctx, min);
}

// Module Audit : cloisonné par défaut (auditeur externe, DG), ajustable comme tout module.
export async function requireAudit(ctx: Ctx, action: Action = "voir") {
  return await requireDroit(ctx, "/audit", action);
}

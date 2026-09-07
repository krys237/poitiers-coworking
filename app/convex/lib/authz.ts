import { QueryCtx, MutationCtx } from "../_generated/server";
import { Doc } from "../_generated/dataModel";
import { NIVEAU, Role } from "../rbac";

// Mode développement : si AUTH_DEV_BYPASS=true (variable d'env Convex) et qu'aucune identité
// OIDC n'est présente, on agit comme le membre DG marqué "dev". À DÉSACTIVER en production.
const DEV_BYPASS = process.env.AUTH_DEV_BYPASS === "true";
export const DEV_TOKEN = "dev:dg";
// Membres pré-provisionnés par e-mail (Gestion des membres) : rattachés à leur identité OIDC à la première connexion.
export const PENDING_PREFIX = "pending:";

type Ctx = QueryCtx | MutationCtx;

async function parToken(ctx: Ctx, token: string) {
  return await ctx.db.query("users").withIndex("by_token", (q) => q.eq("tokenIdentifier", token)).unique();
}

// Récupère le membre courant depuis l'identité OIDC (ou le membre dev en mode bypass).
// Rattachement : une identité sans ligne `users` mais dont l'e-mail correspond à un membre `pending:*`
// est rattachée (patch du token) — uniquement dans une mutation ; en query on renvoie la ligne telle quelle.
export async function getCurrentUser(ctx: Ctx): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (identity) {
    const u = await parToken(ctx, identity.subject);
    if (u) return u;
    if (identity.email) {
      const p = await ctx.db.query("users").withIndex("by_email", (q) => q.eq("email", identity.email!)).first();
      if (p && p.tokenIdentifier.startsWith(PENDING_PREFIX)) {
        const db = ctx.db as MutationCtx["db"];
        if (typeof db.patch === "function") {
          await db.patch(p._id, { tokenIdentifier: identity.subject });
          return { ...p, tokenIdentifier: identity.subject };
        }
        return p;
      }
    }
    return null;
  }
  if (!DEV_BYPASS) return null;
  return await parToken(ctx, DEV_TOKEN);
}

// Exige un niveau minimum ; lève une erreur sinon.
export async function requireLevel(ctx: Ctx, min: number) {
  const user = await getCurrentUser(ctx);
  if (!user || !user.isActive) throw new Error("Non authentifié ou compte inactif.");
  if (NIVEAU[user.role as Role] < min) throw new Error("Accès refusé : niveau insuffisant.");
  return user;
}

// Module Audit : cloisonné — auditeur externe ou Directeur Général uniquement (un niveau 6 est refusé).
export async function requireAudit(ctx: Ctx) {
  const user = await getCurrentUser(ctx);
  if (!user || !user.isActive) throw new Error("Non authentifié ou compte inactif.");
  if (user.role !== "auditeur_externe" && user.role !== "dg") throw new Error("Accès refusé : module réservé à l'auditeur externe et au Directeur Général.");
  return user;
}

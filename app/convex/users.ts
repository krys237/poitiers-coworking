import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUser, requireLevel, PENDING_PREFIX } from "./lib/authz";
import { journaliser } from "./lib/journal";
import { LIBELLE, NIVEAU, Role } from "./rbac";

const ROLE = v.union(
  v.literal("employe"), v.literal("chef_equipe"), v.literal("comptable"), v.literal("gestionnaire_rh"),
  v.literal("da1"), v.literal("da2"), v.literal("dg"), v.literal("auditeur_externe")
);
const SOCIETE = v.union(v.literal("SESAME"), v.literal("SOFINA"), v.literal("SGC"));

// Le membre courant, enrichi de son libellé de rôle et de son niveau.
export const me = query({
  args: {},
  handler: async (ctx) => {
    const u = await getCurrentUser(ctx);
    if (!u) return null;
    return { ...u, roleLibelle: LIBELLE[u.role as Role], niveau: NIVEAU[u.role as Role] };
  },
});

// Liste (DG) : rôle lisible, niveau, origine du compte (dev / démo / en attente de rattachement / OIDC).
export const liste = query({
  args: {},
  handler: async (ctx) => {
    await requireLevel(ctx, 7);
    const rows = await ctx.db.query("users").collect();
    return rows.map((u) => ({
      ...u, roleLibelle: LIBELLE[u.role as Role], niveau: NIVEAU[u.role as Role],
      origine: u.tokenIdentifier.startsWith(PENDING_PREFIX) ? "pending" : u.tokenIdentifier.startsWith("demo:") ? "demo" : u.tokenIdentifier.startsWith("dev:") ? "dev" : "oidc",
    })).sort((a, b) => (a.nom ?? a.email).localeCompare(b.nom ?? b.email));
  },
});

// Garde-fou : on ne peut ni désactiver ni rétrograder le dernier DG actif.
async function verifierDernierDg(ctx: Parameters<typeof requireLevel>[0], cible: { _id: any; role: string; isActive: boolean }, patch: { role?: string; isActive?: boolean }) {
  const perdDg = cible.role === "dg" && cible.isActive && ((patch.role !== undefined && patch.role !== "dg") || patch.isActive === false);
  if (!perdDg) return;
  const autres = (await ctx.db.query("users").collect()).filter((u) => u.role === "dg" && u.isActive && u._id !== cible._id);
  if (autres.length === 0) throw new Error("Impossible : ce membre est le dernier Directeur Général actif.");
}

export const modifier = mutation({
  args: {
    userId: v.id("users"), role: v.optional(ROLE), poste: v.optional(v.string()), departement: v.optional(v.string()),
    societe: v.optional(SOCIETE), codeAcces: v.optional(v.string()), nom: v.optional(v.string()), isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, { userId, ...patch }) => {
    const me = await requireLevel(ctx, 7);
    const cible = await ctx.db.get(userId);
    if (!cible) throw new Error("Membre introuvable.");
    await verifierDernierDg(ctx, cible, patch);
    const propre = Object.fromEntries(Object.entries(patch).filter(([, val]) => val !== undefined));
    await ctx.db.patch(userId, propre);
    const qui = cible.nom ?? cible.email;
    if (patch.role !== undefined && patch.role !== cible.role)
      await journaliser(ctx, { auteurId: me._id, auteurNom: me.nom ?? me.email, action: "membre_role", cible: qui, detail: `${LIBELLE[cible.role as Role]} → ${LIBELLE[patch.role as Role]}` });
    if (patch.isActive !== undefined && patch.isActive !== cible.isActive)
      await journaliser(ctx, { auteurId: me._id, auteurNom: me.nom ?? me.email, action: "membre_activation", cible: qui, detail: patch.isActive ? "activé" : "désactivé" });
    const autres = Object.keys(propre).filter((k) => k !== "role" && k !== "isActive");
    if (autres.length) await journaliser(ctx, { auteurId: me._id, auteurNom: me.nom ?? me.email, action: "membre_modification", cible: qui, detail: autres.join(", ") });
  },
});

// Pré-provisionnement par e-mail : le membre sera rattaché à son identité OIDC à sa première connexion (lib/authz).
export const creer = mutation({
  args: { email: v.string(), nom: v.optional(v.string()), role: ROLE, poste: v.optional(v.string()), departement: v.optional(v.string()), societe: v.optional(SOCIETE), codeAcces: v.optional(v.string()) },
  handler: async (ctx, a) => {
    const me = await requireLevel(ctx, 7);
    const email = a.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Adresse e-mail invalide.");
    if (await ctx.db.query("users").withIndex("by_email", (q) => q.eq("email", email)).first()) throw new Error("Un membre existe déjà avec cet e-mail.");
    const id = await ctx.db.insert("users", { tokenIdentifier: `${PENDING_PREFIX}${email}`, email, nom: a.nom?.trim() || undefined, role: a.role, poste: a.poste || undefined, departement: a.departement || undefined, societe: a.societe, codeAcces: a.codeAcces || undefined, isActive: true });
    await journaliser(ctx, { auteurId: me._id, auteurNom: me.nom ?? me.email, action: "membre_creation", cible: a.nom?.trim() || email, detail: `${LIBELLE[a.role as Role]} · en attente de rattachement` });
    return id;
  },
});

// Porte de secours (interne, CLI admin uniquement : `npx convex run users:restaurerRole '{"tokenIdentifier":"dev:dg","role":"dg"}'`).
// Sert si plus aucun DG actif ne peut se connecter (rétrogradation par erreur, compte désactivé…).
export const restaurerRole = internalMutation({
  args: { tokenIdentifier: v.string(), role: ROLE, isActive: v.optional(v.boolean()) },
  handler: async (ctx, { tokenIdentifier, role, isActive }) => {
    const u = await ctx.db.query("users").withIndex("by_token", (q) => q.eq("tokenIdentifier", tokenIdentifier)).unique();
    if (!u) throw new Error("Membre introuvable.");
    await ctx.db.patch(u._id, { role, isActive: isActive ?? true });
    await journaliser(ctx, { action: "membre_role", cible: u.nom ?? u.email, detail: `${LIBELLE[u.role as Role]} → ${LIBELLE[role as Role]} (restauration CLI)` });
    return { nom: u.nom ?? u.email, role };
  },
});

import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUser, requireLevel, PENDING_PREFIX, DEV_BYPASS, requireDroit, droitsDuMembre } from "./lib/authz";
import { journaliser } from "./lib/journal";
import { LIBELLE, NIVEAU, Role, peutAttribuer, peutModifierMembre, MODULE_PAR_CLE, estVerrouille, normaliser, type Action } from "./rbac";
import { normaliserTelephone, erreurTelephone } from "./lib/telephone";

const ROLE = v.union(
  v.literal("employe"), v.literal("chef_equipe"), v.literal("comptable"), v.literal("gestionnaire_rh"),
  v.literal("da1"), v.literal("dg"), v.literal("super_admin"), v.literal("auditeur_externe")
);
const SOCIETE = v.union(v.literal("SESAME"), v.literal("SOFINA"), v.literal("SGC"));

// Le membre courant, enrichi de son libellé de rôle et de son niveau.
// `enAttente` distingue un compte créé mais pas encore autorisé (l'interface doit afficher
// un écran d'attente, pas le menu) ; `modeDev` signale que le bypass de développement est
// actif sur ce déploiement — à faire remonter visuellement, c'est un mode non sécurisé.
export const me = query({
  args: {},
  handler: async (ctx) => {
    const u = await getCurrentUser(ctx);
    if (!u) return null;
    return {
      ...u,
      roleLibelle: LIBELLE[u.role as Role],
      niveau: NIVEAU[u.role as Role],
      enAttente: u.enAttente === true,
      modeDev: DEV_BYPASS && u.tokenIdentifier === "dev:dg",
      // Droits effectifs VOIR / FAIRE par module : l'interface masque ce que le serveur refuserait.
      droits: await droitsDuMembre(ctx, u),
    };
  },
});

// Liste (DG) : rôle lisible, niveau, origine du compte (dev / démo / en attente de rattachement / OIDC).
export const liste = query({
  args: {},
  handler: async (ctx) => {
    await requireDroit(ctx, "/membres");
    const rows = await ctx.db.query("users").collect();
    return rows.map((u) => ({
      ...u, roleLibelle: LIBELLE[u.role as Role], niveau: NIVEAU[u.role as Role],
      enAttente: u.enAttente === true,
      // Un compte sans `tokenIdentifier` a été créé par Convex Auth : c'est le cas nominal.
      // Les jetons restants sont hérités (pré-provisionnement, jeux de démo, bypass dev).
      origine: u.enAttente ? "attente"
        : !u.tokenIdentifier ? "compte"
        : u.tokenIdentifier.startsWith(PENDING_PREFIX) ? "pending"
        : u.tokenIdentifier.startsWith("demo:") ? "demo"
        : u.tokenIdentifier.startsWith("dev:") ? "dev"
        : "autre",
    })).sort((a, b) => (a.nom ?? a.email).localeCompare(b.nom ?? b.email));
  },
});

// Téléphone : indicatif obligatoire (journal des décisions, 21/09/2026), format compact, unique.
async function telephoneValide(ctx: Parameters<typeof requireLevel>[0], brut: string | undefined, saufId?: any): Promise<string | undefined> {
  if (!brut || !brut.trim()) return undefined;
  const err = erreurTelephone(brut);
  if (err) throw new Error(err);
  const phone = normaliserTelephone(brut)!;
  const autre = await ctx.db.query("users").withIndex("phone", (q) => q.eq("phone", phone)).first();
  if (autre && String(autre._id) !== String(saufId)) throw new Error(`Ce numéro est déjà attribué à ${autre.nom ?? autre.email}.`);
  return phone;
}

// Connexion par téléphone : le compte Convex Auth est indexé par e-mail, l'écran de connexion
// traduit donc le numéro saisi en e-mail avant d'appeler `signIn`. Requête publique : elle ne
// renvoie l'e-mail que pour un numéro EXACT d'un compte actif — compromis accepté pour un outil
// interne aux comptes pré-provisionnés (journal des décisions, 21/09/2026).
export const emailPourIdentifiant = query({
  args: { identifiant: v.string() },
  handler: async (ctx, { identifiant }) => {
    const s = identifiant.trim().toLowerCase();
    if (s.includes("@")) return s;
    const phone = normaliserTelephone(s);
    if (!phone) return null;
    const u = await ctx.db.query("users").withIndex("phone", (q) => q.eq("phone", phone)).first();
    return u && u.isActive ? u.email : null;
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
    phone: v.optional(v.string()),
    // Fiche employé liée (« Mes bulletins ») ; null = retirer le lien.
    employeId: v.optional(v.union(v.id("employes"), v.null())),
  },
  handler: async (ctx, { userId, employeId, ...patch }) => {
    const me = await requireDroit(ctx, "/membres", "faire");
    const cible = await ctx.db.get(userId);
    if (!cible) throw new Error("Membre introuvable.");
    if (patch.phone !== undefined) patch.phone = await telephoneValide(ctx, patch.phone, userId);
    // Nul ne touche à un membre placé au-dessus de lui, ni n'attribue un rôle au-dessus du sien :
    // un Directeur Général ne fabrique pas de super administrateur.
    if (!peutModifierMembre(me.role as Role, cible.role as Role)) throw new Error(`Accès refusé : ${LIBELLE[cible.role as Role]} est au-dessus de votre niveau.`);
    if (patch.role !== undefined && !peutAttribuer(me.role as Role, patch.role as Role)) throw new Error(`Accès refusé : vous ne pouvez pas attribuer le rôle ${LIBELLE[patch.role as Role]}.`);
    await verifierDernierDg(ctx, cible, patch);
    const propre = Object.fromEntries(Object.entries(patch).filter(([, val]) => val !== undefined));
    await ctx.db.patch(userId, propre);
    if (employeId !== undefined && String(employeId ?? "") !== String(cible.employeId ?? "")) {
      if (employeId && !(await ctx.db.get(employeId))) throw new Error("Fiche employé introuvable.");
      await ctx.db.patch(userId, { employeId: employeId ?? undefined });
      const emp = employeId ? await ctx.db.get(employeId) : null;
      await journaliser(ctx, { auteurId: me._id, auteurNom: me.nom ?? me.email, action: "membre_modification", cible: cible.nom ?? cible.email, detail: emp ? `fiche employé liée : ${emp.nom} (${emp.matricule})` : "fiche employé déliée" });
    }
    const qui = cible.nom ?? cible.email;
    // Autorisation d'une inscription spontanée : l'activation lève le drapeau d'attente et
    // donne réellement accès (jusque-là, le compte avait une session mais aucun droit).
    if (patch.isActive === true && cible.enAttente) {
      await ctx.db.patch(userId, { enAttente: undefined });
      await journaliser(ctx, { auteurId: me._id, auteurNom: me.nom ?? me.email, action: "membre_autorisation", cible: qui, detail: `accès accordé · ${LIBELLE[(patch.role ?? cible.role) as Role]}` });
    }
    if (patch.role !== undefined && patch.role !== cible.role)
      await journaliser(ctx, { auteurId: me._id, auteurNom: me.nom ?? me.email, action: "membre_role", cible: qui, detail: `${LIBELLE[cible.role as Role]} → ${LIBELLE[patch.role as Role]}` });
    if (patch.isActive !== undefined && patch.isActive !== cible.isActive)
      await journaliser(ctx, { auteurId: me._id, auteurNom: me.nom ?? me.email, action: "membre_activation", cible: qui, detail: patch.isActive ? "activé" : "désactivé" });
    const autres = Object.keys(propre).filter((k) => k !== "role" && k !== "isActive");
    if (autres.length) await journaliser(ctx, { auteurId: me._id, auteurNom: me.nom ?? me.email, action: "membre_modification", cible: qui, detail: autres.join(", ") });
  },
});

// Pré-provisionnement par e-mail : le membre est créé avec son rôle AVANT toute connexion.
// Sa ligne porte le jeton "pending:<email>" jusqu'à ce qu'il s'inscrive avec cette adresse ;
// `auth.createOrUpdateUser` la rattache alors à son compte (voir auth.ts). C'est le chemin
// nominal — une inscription non pré-provisionnée n'obtient aucun droit.
export const creer = mutation({
  args: { email: v.string(), nom: v.optional(v.string()), role: ROLE, poste: v.optional(v.string()), departement: v.optional(v.string()), societe: v.optional(SOCIETE), codeAcces: v.optional(v.string()), phone: v.optional(v.string()), employeId: v.optional(v.id("employes")) },
  handler: async (ctx, a) => {
    const me = await requireDroit(ctx, "/membres", "faire");
    if (!peutAttribuer(me.role as Role, a.role as Role)) throw new Error(`Accès refusé : vous ne pouvez pas attribuer le rôle ${LIBELLE[a.role as Role]}.`);
    const phone = await telephoneValide(ctx, a.phone);
    const email = a.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Adresse e-mail invalide.");
    if (await ctx.db.query("users").withIndex("email", (q) => q.eq("email", email)).first()) throw new Error("Un membre existe déjà avec cet e-mail.");
    const id = await ctx.db.insert("users", { tokenIdentifier: `${PENDING_PREFIX}${email}`, email, nom: a.nom?.trim() || undefined, role: a.role, poste: a.poste || undefined, departement: a.departement || undefined, societe: a.societe, codeAcces: a.codeAcces || undefined, phone, employeId: a.employeId, isActive: true });
    await journaliser(ctx, { auteurId: me._id, auteurNom: me.nom ?? me.email, action: "membre_creation", cible: a.nom?.trim() || email, detail: `${LIBELLE[a.role as Role]} · en attente de rattachement` });
    return id;
  },
});

// Contrôle d'accès pour les ACTIONS (qui n'ont pas `ctx.db`) : l'identité est propagée
// par `ctx.runQuery`, donc `requireLevel` s'applique normalement ici.
// Usage : `await ctx.runQuery(internal.users.verifierNiveau, { min: 7 })`.
export const verifierNiveau = internalQuery({
  args: { min: v.number() },
  handler: async (ctx, { min }) => {
    const u = await requireLevel(ctx, min);
    return { userId: u._id, nom: u.nom ?? u.email, role: u.role };
  },
});

// Même chose, par droit de module (rbac.MODULES) plutôt que par niveau.
export const verifierDroit = internalQuery({
  args: { module: v.string(), action: v.union(v.literal("voir"), v.literal("faire")) },
  handler: async (ctx, { module, action }) => {
    const u = await requireDroit(ctx, module, action as Action);
    return { userId: u._id, nom: u.nom ?? u.email, role: u.role };
  },
});

// Exceptions individuelles aux droits du rôle (Paramètres → Rôles & accès). `droits` remplace
// toutes les exceptions du membre ; une liste vide le ramène aux droits de son rôle.
export const modifierDroitsPerso = mutation({
  args: { userId: v.id("users"), droits: v.array(v.object({ module: v.string(), voir: v.boolean(), faire: v.boolean() })) },
  handler: async (ctx, { userId, droits }) => {
    const me = await requireDroit(ctx, "/parametres", "faire");
    const cible = await ctx.db.get(userId);
    if (!cible) throw new Error("Membre introuvable.");
    if (!peutModifierMembre(me.role as Role, cible.role as Role)) throw new Error(`Accès refusé : ${LIBELLE[cible.role as Role]} est au-dessus de votre niveau.`);
    const propres = droits.flatMap((d) => {
      const m = MODULE_PAR_CLE[d.module];
      if (!m) throw new Error(`Module inconnu : ${d.module}`);
      return estVerrouille(cible.role as Role, d.module) ? [] : [{ module: d.module, ...normaliser(m, d) }];
    });
    await ctx.db.patch(userId, { droitsPerso: propres.length ? propres : undefined });
    await journaliser(ctx, { auteurId: me._id, auteurNom: me.nom ?? me.email, action: "membre_droits", cible: cible.nom ?? cible.email,
      detail: propres.length ? propres.map((d) => `${MODULE_PAR_CLE[d.module].libelle} : ${d.faire ? "voir + faire" : d.voir ? "voir" : "aucun"}`).join(" · ") : "retour aux droits du rôle" });
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

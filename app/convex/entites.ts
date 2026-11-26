// Entités (personnes morales) et accès par entité — lot M1 du chantier multi-société.
//
// Une ENTITÉ est l'espace de travail : POLYCLINIQUE DE POITIERS, EDR-TIM, LES LILAS. Elle n'est
// PAS le déclarant de paie (`SESAME | SOFINA | SGC`, champ `societe`), qui reste transversal.
// Modèle complet : `docs/multi-societe/MODELE.md`.
//
// ⚠️ Ce module est volontairement **additif** : il crée les entités et les accès, et ne change
// encore le périmètre d'AUCUNE requête existante. Le scoping de `requireDroit` et le passage
// d'`entiteId` aux requêtes métier viennent ensuite, écran par écran, pour qu'un push de schéma ne
// modifie jamais le comportement de la paie le même jour.

import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { getCurrentUser, requireLevel, requireDroit } from "./lib/authz";
import { journaliser } from "./lib/journal";
import { NIVEAU, type Role } from "./rbac";
import {
  entitesAccessibles, roleDansEntite, peutAccorderRole,
  type AccesEntite, type EntiteBrute, type MembrePerimetre,
} from "./lib/perimetre";

/** Niveau requis pour administrer les entités et distribuer les accès. */
const NIVEAU_ADMIN_ENTITES = 7;

const brute = (e: Doc<"entites">): EntiteBrute => ({
  entiteId: String(e._id), nom: e.nom, actif: e.actif, ordre: e.ordre,
});
const accesBrut = (a: Doc<"accesEntites">): AccesEntite => ({
  entiteId: String(a.entiteId), role: a.role, droitsPerso: a.droitsPerso, actif: a.actif,
});
const membreBrut = (u: Doc<"users">): MembrePerimetre => ({
  role: u.role as Role,
  entitePrincipaleId: u.entitePrincipaleId ? String(u.entitePrincipaleId) : undefined,
});

/** Les entités d'un membre, résolues côté serveur — la seule source du périmètre. */
async function perimetreDe(ctx: Parameters<typeof getCurrentUser>[0], u: Doc<"users">) {
  const entites = await ctx.db.query("entites").collect();
  const acces = await ctx.db.query("accesEntites").withIndex("by_membre", (q) => q.eq("membreId", u._id)).collect();
  return {
    entites, acces,
    accessibles: entitesAccessibles(membreBrut(u), acces.map(accesBrut), entites.map(brute)),
  };
}

/**
 * Les entités que le membre courant atteint, dans l'ordre d'affichage du sélecteur.
 *
 * C'est la seule porte du frontend vers son périmètre : il PROPOSE ensuite une entité à chaque
 * requête, et le serveur la revérifie. Un sélecteur n'est qu'une préférence d'affichage.
 */
export const mesEntites = query({
  args: {},
  handler: async (ctx) => {
    const me = await getCurrentUser(ctx);
    if (!me || !me.isActive || me.enAttente) return [];
    const { entites, acces, accessibles } = await perimetreDe(ctx, me);
    const parId = new Map(entites.map((e) => [String(e._id), e]));
    return accessibles.map((e) => {
      const doc = parId.get(e.entiteId)!;
      return {
        entiteId: e.entiteId, nom: doc.nom, code: doc.code,
        principale: String(me.entitePrincipaleId ?? "") === e.entiteId,
        role: roleDansEntite(membreBrut(me), acces.map(accesBrut), entites.map(brute), e.entiteId) ?? me.role,
      };
    });
  },
});

/** Toutes les entités, pour l'administration. */
export const liste = query({
  args: {},
  handler: async (ctx) => {
    await requireLevel(ctx, NIVEAU_ADMIN_ENTITES);
    const rows = await ctx.db.query("entites").collect();
    return rows
      .sort((a, b) => a.ordre - b.ordre || a.nom.localeCompare(b.nom))
      .map((e) => ({
        entiteId: String(e._id), nom: e.nom, code: e.code, actif: e.actif, ordre: e.ordre,
        raisonSociale: e.raisonSociale, adresse: e.adresse, telephone: e.telephone,
        niu: e.niu, numeroCnps: e.numeroCnps, registreCommerce: e.registreCommerce,
        dirigeant: e.dirigeant, emailExpediteur: e.emailExpediteur,
      }));
  },
});

const CODE = /^[a-z0-9][a-z0-9-]{1,30}$/;

export const creer = mutation({
  args: {
    nom: v.string(), code: v.string(),
    raisonSociale: v.optional(v.string()), adresse: v.optional(v.string()), telephone: v.optional(v.string()),
    niu: v.optional(v.string()), numeroCnps: v.optional(v.string()),
    registreCommerce: v.optional(v.string()), dirigeant: v.optional(v.string()),
    emailExpediteur: v.optional(v.string()),
  },
  handler: async (ctx, a) => {
    const me = await requireLevel(ctx, NIVEAU_ADMIN_ENTITES);
    const nom = a.nom.trim();
    const code = a.code.trim().toLowerCase();
    if (!nom) throw new Error("Le nom de la société est requis.");
    if (!CODE.test(code)) throw new Error("Code : minuscules, chiffres et tirets, de 2 à 31 caractères.");
    const existe = await ctx.db.query("entites").withIndex("by_code", (q) => q.eq("code", code)).unique();
    if (existe) throw new Error(`Le code « ${code} » est déjà pris par « ${existe.nom} ».`);
    const toutes = await ctx.db.query("entites").collect();
    const id = await ctx.db.insert("entites", {
      ...a, nom, code, actif: true,
      ordre: toutes.reduce((m, e) => Math.max(m, e.ordre), 0) + 1,
    });
    await journaliser(ctx, {
      auteurId: me._id, auteurNom: me.nom ?? me.email, action: "parametres_modification",
      cible: `entite ${code}`, detail: `société « ${nom} » créée`,
    });
    return id;
  },
});

export const modifier = mutation({
  args: {
    entiteId: v.id("entites"), nom: v.optional(v.string()), actif: v.optional(v.boolean()),
    ordre: v.optional(v.number()),
    raisonSociale: v.optional(v.string()), adresse: v.optional(v.string()), telephone: v.optional(v.string()),
    niu: v.optional(v.string()), numeroCnps: v.optional(v.string()),
    registreCommerce: v.optional(v.string()), dirigeant: v.optional(v.string()),
    emailExpediteur: v.optional(v.string()),
  },
  handler: async (ctx, { entiteId, ...patch }) => {
    const me = await requireLevel(ctx, NIVEAU_ADMIN_ENTITES);
    const e = await ctx.db.get(entiteId);
    if (!e) throw new Error("Société introuvable.");
    if (patch.nom !== undefined && !patch.nom.trim()) throw new Error("Le nom de la société est requis.");
    // Le `code` n'est PAS modifiable : il sert de clé stable dans les exports et les journaux.
    // Le changer rendrait illisible tout ce qui le cite déjà.
    const propre = Object.fromEntries(Object.entries(patch).filter(([, x]) => x !== undefined));
    await ctx.db.patch(entiteId, propre);
    await journaliser(ctx, {
      auteurId: me._id, auteurNom: me.nom ?? me.email, action: "parametres_modification",
      cible: `entite ${e.code}`, detail: `société modifiée : ${Object.keys(propre).join(", ") || "rien"}`,
    });
  },
});

/** Les accès d'un membre, noms déjà résolus pour l'affichage. */
export const accesDuMembre = query({
  args: { membreId: v.id("users") },
  handler: async (ctx, { membreId }) => {
    await requireDroit(ctx, "/membres");
    const membre = await ctx.db.get(membreId);
    if (!membre) return [];
    const rows = await ctx.db.query("accesEntites").withIndex("by_membre", (q) => q.eq("membreId", membreId)).collect();
    const out: {
      accesId: string; entiteId: string; entiteNom: string; role?: string;
      principale: boolean; actif: boolean; accordeParNom?: string; accordeLe?: string;
    }[] = [];
    for (const a of rows) {
      const e = await ctx.db.get(a.entiteId);
      const par = a.accordePar ? await ctx.db.get(a.accordePar) : null;
      out.push({
        accesId: String(a._id), entiteId: String(a.entiteId), entiteNom: e?.nom ?? "(société supprimée)",
        role: a.role, principale: String(membre.entitePrincipaleId ?? "") === String(a.entiteId),
        actif: a.actif, accordeParNom: par?.nom ?? par?.email ?? undefined, accordeLe: a.accordeLe,
      });
    }
    // L'entité principale figure en tête, même sans ligne d'accès : elle fait partie du périmètre.
    if (membre.entitePrincipaleId && !rows.some((a) => String(a.entiteId) === String(membre.entitePrincipaleId))) {
      const e = await ctx.db.get(membre.entitePrincipaleId);
      if (e) out.unshift({
        accesId: "", entiteId: String(e._id), entiteNom: e.nom, role: membre.role,
        principale: true, actif: true,
      });
    }
    return out.sort((a, b) => Number(b.principale) - Number(a.principale) || a.entiteNom.localeCompare(b.entiteNom));
  },
});

export const accorderAcces = mutation({
  args: { membreId: v.id("users"), entiteId: v.id("entites"), role: v.optional(v.string()) },
  handler: async (ctx, { membreId, entiteId, role }) => {
    const me = await requireLevel(ctx, NIVEAU_ADMIN_ENTITES);
    const membre = await ctx.db.get(membreId);
    if (!membre) throw new Error("Membre introuvable.");
    const entite = await ctx.db.get(entiteId);
    if (!entite) throw new Error("Société introuvable.");
    if (!entite.actif) throw new Error(`« ${entite.nom} » est désactivée : réactivez-la d'abord.`);
    // Nul n'accorde un rôle au-dessus du sien — même règle que `users.modifier`.
    if (role !== undefined) {
      if (NIVEAU[role as Role] === undefined) throw new Error("Rôle inconnu.");
      if (!peutAccorderRole(me.role as Role, role as Role)) {
        throw new Error("Vous ne pouvez pas accorder un rôle supérieur au vôtre.");
      }
    }
    const deja = await ctx.db.query("accesEntites")
      .withIndex("by_membre_entite", (q) => q.eq("membreId", membreId).eq("entiteId", entiteId)).unique();
    if (deja) throw new Error(`${membre.nom ?? "Ce membre"} a déjà un accès à « ${entite.nom} » : modifiez-le.`);
    await ctx.db.insert("accesEntites", {
      membreId, entiteId, role, actif: true,
      accordePar: me._id, accordeLe: new Date().toISOString(),
    });
    await journaliser(ctx, {
      auteurId: me._id, auteurNom: me.nom ?? me.email, action: "membre_droits",
      cible: membre.nom ?? membre.email, detail: `accès accordé à « ${entite.nom} »${role ? ` au rôle ${role}` : ""}`,
    });
  },
});

export const modifierAcces = mutation({
  args: { accesId: v.id("accesEntites"), role: v.optional(v.string()), actif: v.optional(v.boolean()) },
  handler: async (ctx, { accesId, role, actif }) => {
    const me = await requireLevel(ctx, NIVEAU_ADMIN_ENTITES);
    const a = await ctx.db.get(accesId);
    if (!a) throw new Error("Accès introuvable.");
    if (role !== undefined) {
      if (NIVEAU[role as Role] === undefined) throw new Error("Rôle inconnu.");
      if (!peutAccorderRole(me.role as Role, role as Role)) {
        throw new Error("Vous ne pouvez pas accorder un rôle supérieur au vôtre.");
      }
    }
    const propre = Object.fromEntries(Object.entries({ role, actif }).filter(([, x]) => x !== undefined));
    await ctx.db.patch(accesId, propre);
    const membre = await ctx.db.get(a.membreId);
    const entite = await ctx.db.get(a.entiteId);
    await journaliser(ctx, {
      auteurId: me._id, auteurNom: me.nom ?? me.email, action: "membre_droits",
      cible: membre?.nom ?? membre?.email,
      detail: `accès à « ${entite?.nom ?? "?"} » modifié : ${Object.keys(propre).join(", ")}`,
    });
  },
});

/**
 * Révoquer un accès : on le passe à `actif: false`, on ne le supprime pas.
 * La trace de qui l'avait accordé et quand doit rester lisible — c'est ce qui permet de répondre
 * à « qui a ouvert cette société à cette personne ».
 */
export const revoquerAcces = mutation({
  args: { accesId: v.id("accesEntites") },
  handler: async (ctx, { accesId }) => {
    const me = await requireLevel(ctx, NIVEAU_ADMIN_ENTITES);
    const a = await ctx.db.get(accesId);
    if (!a) return;
    await ctx.db.patch(accesId, { actif: false });
    const membre = await ctx.db.get(a.membreId);
    const entite = await ctx.db.get(a.entiteId);
    await journaliser(ctx, {
      auteurId: me._id, auteurNom: me.nom ?? me.email, action: "membre_droits",
      cible: membre?.nom ?? membre?.email, detail: `accès à « ${entite?.nom ?? "?"} » révoqué`,
    });
  },
});

// ---------------------------------------------------------------------------
// La migration.
//
// Réponse du propriétaire à la question de cadrage n° 6 : « les éléments des journées et du grand
// livre actuels ne concernent que la société existante (POLYCLINIQUE DE POITIERS), les autres n'en
// ont pas besoin. » Toute donnée existante est donc estampillée POITIERS.
//
// Déroulé, et l'ordre n'est pas une préférence :
//   1. pousser le schéma avec `entiteId` OPTIONNEL partout — fait, et sans changement de
//      comportement : chaque lecture ignore encore le champ ;
//   2. lancer `migrerEntites` — crée l'entité POITIERS si elle manque, puis estampille ;
//   3. scoper les requêtes, écran par écran ;
//   4. SEULEMENT ensuite, rendre `entiteId` obligatoire.
// Inverser 1 et 4 fait rejeter par Convex toutes les lignes déjà en base — c'est exactement le
// déroulé en trois temps du renommage `salaireBrut` → `salaireBase`, et il a déjà été payé.
//
// Idempotente, et prudente : elle n'écrit que sur les lignes SANS `entiteId`, refuse d'agir s'il
// existe plus d'une entité (l'ambiguïté se tranche à la main), et rend le compte rendu de ce
// qu'elle a touché table par table.
// ---------------------------------------------------------------------------
const TABLES_SCOPEES = [
  "employes", "rattachements", "saisiesMensuelles", "primesCharges", "bulletins", "envois",
  "cloturesPaie", "absences", "rubriquesPaie", "journeesFinancieres", "cloturesFinancieres",
  "verrousFinanciers", "documents", "commandes", "fournisseurs", "interventions", "comptesRendus",
  "statsCaisse", "primesMedecins", "rapportsAudit", "tickets", "actes", "retenuesMedecins",
  "services", "fonctions", "journalActivite", "notifications", "envoisNotifications",
  "rappelsEmis", "penseBetes",
] as const;

export const migrerEntites = internalMutation({
  args: { nom: v.optional(v.string()), code: v.optional(v.string()) },
  handler: async (ctx, { nom, code }) => {
    const entites = await ctx.db.query("entites").collect();
    if (entites.length > 1) {
      return {
        refus: `${entites.length} sociétés existent déjà (${entites.map((e) => e.code).join(", ")}) : ` +
          `l'estampillage automatique serait arbitraire. À faire société par société, à la main.`,
      };
    }

    let cible = entites[0];
    if (!cible) {
      const params = await ctx.db.query("parametresEntreprise").first();
      const id = await ctx.db.insert("entites", {
        nom: nom ?? params?.nom ?? "POLYCLINIQUE DE POITIERS",
        code: code ?? "poitiers",
        actif: true, ordre: 1,
        // L'identité juridique est reprise de `parametresEntreprise`, qui la portait pour
        // l'entreprise unique. Elle y reste : rien n'est retiré par cette migration.
        raisonSociale: params?.nom, adresse: params?.adresse,
        niu: params?.niu, numeroCnps: params?.numeroCnps,
        registreCommerce: params?.registreCommerce, dirigeant: params?.dirigeant,
        emailExpediteur: params?.emailExpediteur,
      });
      cible = (await ctx.db.get(id))!;
    }

    const estampillees: Record<string, number> = {};
    const dejaFaites: Record<string, number> = {};
    for (const table of TABLES_SCOPEES) {
      const rows = await ctx.db.query(table).collect();
      let n = 0, deja = 0;
      for (const r of rows) {
        if ((r as { entiteId?: Id<"entites"> }).entiteId) { deja++; continue; }
        await ctx.db.patch(r._id, { entiteId: cible._id } as never);
        n++;
      }
      if (n) estampillees[table] = n;
      if (deja) dejaFaites[table] = deja;
    }

    // Les membres aussi : leur entité d'appartenance est celle-là, faute de mieux.
    const membres = await ctx.db.query("users").collect();
    let membresEstampilles = 0;
    for (const u of membres) {
      if (u.entitePrincipaleId) continue;
      await ctx.db.patch(u._id, { entitePrincipaleId: cible._id });
      membresEstampilles++;
    }

    await journaliser(ctx, {
      action: "parametres_modification", cible: `entite ${cible.code}`,
      detail: `migration multi-société : ${Object.values(estampillees).reduce((t, n) => t + n, 0)} ligne(s) ` +
        `et ${membresEstampilles} membre(s) rattachés à « ${cible.nom} »`,
    });

    // Une seconde passe sur le JOURNAL, et seulement sur lui : la ligne que `journaliser` vient
    // d'écrire n'a pas d'entité, et sans ce rattrapage chaque exécution estampillerait la ligne de
    // la précédente. Le compte rendu annoncerait alors « 1 ligne » sur une migration qui n'a rien
    // fait — un rapport qui ne dit pas vrai est pire qu'un rapport absent.
    for (const r of await ctx.db.query("journalActivite").collect()) {
      if (r.entiteId) continue;
      await ctx.db.patch(r._id, { entiteId: cible._id });
      estampillees.journalActivite = (estampillees.journalActivite ?? 0) + 1;
    }

    return {
      entite: { nom: cible.nom, code: cible.code },
      estampillees, dejaFaites, membresEstampilles,
      total: Object.values(estampillees).reduce((t, n) => t + n, 0),
    };
  },
});

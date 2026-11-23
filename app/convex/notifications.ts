// Noyau de notifications (lot S1) + préférences (lot S2) + déclenchement des transports (S3/S4)
// + résolution du responsable de service (lot S6).
import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { type Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { getCurrentUser } from "./lib/authz";
import {
  TYPE_PAR_CLE,
  destinataires,
  filtrerNonLuesParPreferences,
  importanceDominante,
  rendre,
  validerPreferencesSilencieuses,
  type ContexteRendu,
  type Importance,
  type MembreAdressable,
} from "./lib/notifications";
import { serviceDeLObjet, chefsDuService } from "./lib/servicesNotifs";
import { droitsEffectifs, type Role } from "./rbac";

const OBJET_V = v.object({
  table: v.string(),
  id: v.string(),
  reference: v.optional(v.string()),
});

const RENDU_V = v.object({
  reference: v.optional(v.string()),
  acteurNom: v.optional(v.string()),
  libelle: v.optional(v.string()),
  motif: v.optional(v.string()),
  extrait: v.optional(v.string()),
});

export type ArgsEmission = {
  type: string;
  acteurId?: Id<"users">;
  acteurNom?: string;
  proprietaireId?: Id<"users">;
  destinatairesExplicites?: Id<"users">[];
  /** Ignore `type.cible` (ex. ticket jugé non pertinent : seul l'auteur est prévenu, C1.1). */
  ignorerCible?: boolean;
  /** Service rattaché à l'objet (lot S6) : `serviceId` prioritaire, sinon texte libre normalisé. */
  serviceId?: Id<"services">;
  serviceNom?: string;
  /** Surcharge du module RBAC pour un type polymorphe (lot S5). */
  moduleSurcharge?: string;
  /** Surcharge d'importance (ex. clôture de paie urgente le dernier jour, S5). */
  importanceSurcharge?: Importance;
  /** Date du jour ("YYYY-MM-DD") pour la clé d'idempotence d'un rappel répété (S5). */
  dateJour?: string;
  objet: { table: string; id: string; reference?: string };
  lien: string;
  rendu?: ContexteRendu;
  /** Réservé au futur raccordement au journal d'activité (hors périmètre S1, voir spec §9). */
  journal?: string;
};

// Appelé en DERNIÈRE ligne d'une mutation métier. Ne fait qu'une chose : planifier.
export async function notifier(ctx: MutationCtx, e: ArgsEmission) {
  const { journal: _journal, ...args } = e;
  await ctx.scheduler.runAfter(0, internal.notifications.emettre, args);
}

/**
 * Émet les lignes de notification (fan-out à l'écriture) pour un événement métier,
 * puis déclenche les transports sortants (S3 WhatsApp, S4 Push).
 * Ne lève jamais : journalise ses propres échecs.
 */
export const emettre = internalMutation({
  args: {
    type: v.string(),
    acteurId: v.optional(v.id("users")),
    acteurNom: v.optional(v.string()),
    proprietaireId: v.optional(v.id("users")),
    destinatairesExplicites: v.optional(v.array(v.id("users"))),
    ignorerCible: v.optional(v.boolean()),
    serviceId: v.optional(v.id("services")),
    serviceNom: v.optional(v.string()),
    moduleSurcharge: v.optional(v.string()),
    importanceSurcharge: v.optional(v.union(v.literal("info"), v.literal("a_traiter"), v.literal("urgent"))),
    dateJour: v.optional(v.string()),
    objet: OBJET_V,
    lien: v.string(),
    rendu: v.optional(RENDU_V),
  },
  handler: async (ctx, a) => {
    try {
      const type = TYPE_PAR_CLE[a.type];
      if (!type) {
        console.error(`[notifications.emettre] Type d'événement inconnu : "${a.type}".`);
        return;
      }

      // Lectures UNIQUES (jamais de requête dans une boucle).
      const parametres = await ctx.db.query("parametresEntreprise").first();
      const surcharges = parametres?.droitsRoles ?? [];
      const utilisateurs = await ctx.db.query("users").collect();

      // Lot S6 / correctif C1.3 : résolution des chefs du service en une seule lecture de `services`.
      let serviceChefsIds: string[] = [];
      if (type.previentLeServiceConcerne && (a.serviceId || a.serviceNom)) {
        const services = await ctx.db.query("services").collect();
        const service = serviceDeLObjet(
          { serviceId: a.serviceId ? String(a.serviceId) : undefined, service: a.serviceNom },
          services.map((s) => ({
            id: String(s._id),
            nom: s.nom,
            chefs: (s.chefs ?? []).map((c) => String(c)),
          })),
        );
        serviceChefsIds = chefsDuService(service);
      }

      const membres: MembreAdressable[] = utilisateurs.map((u) => ({
        id: String(u._id),
        actif: u.isActive,
        enAttente: Boolean(u.enAttente),
        droits: droitsEffectifs(u.role as Role, surcharges, u.droitsPerso ?? []),
      }));

      const cibles = destinataires(
        type,
        {
          type: a.type,
          acteurId: a.acteurId ? String(a.acteurId) : undefined,
          acteurNom: a.acteurNom,
          proprietaireId: a.proprietaireId ? String(a.proprietaireId) : undefined,
          serviceChefsIds,
          ignorerCible: a.ignorerCible,
          destinatairesExplicites: a.destinatairesExplicites?.map((id) => String(id)),
          moduleSurcharge: a.moduleSurcharge,
          rendu: a.rendu,
        },
        membres,
      );

      if (!cibles.length) return;

      const { titre, corps } = rendre(type, a.rendu);
      const importance = a.importanceSurcharge ?? type.importance;
      const creeLe = new Date().toISOString();
      const creees: { destinataireId: Id<"users">; notificationId: Id<"notifications"> }[] = [];

      for (const destinataireId of cibles) {
        const notificationId = await ctx.db.insert("notifications", {
          destinataireId: destinataireId as Id<"users">,
          type: type.cle,
          titre,
          corps,
          importance,
          lien: a.lien,
          objet: a.objet,
          acteurId: a.acteurId,
          acteurNom: a.acteurNom,
          lu: false,
          creeLe,
        });
        creees.push({ destinataireId: destinataireId as Id<"users">, notificationId });
      }

      // Déclenchement asynchrone des canaux sortants (S3 WhatsApp / S4 Push).
      if (type.canaux?.length && creees.length) {
        await ctx.scheduler.runAfter(0, internal.envois.preparer, {
          type: type.cle,
          titre,
          corps,
          lien: a.lien,
          objet: a.objet,
          rendu: a.rendu,
          dateJour: a.dateJour,
          cibles: creees,
        });
      }
    } catch (err) {
      console.error(`[notifications.emettre] Échec lors de l'émission de "${a.type}" :`, err);
    }
  },
});

const LIMITE_NON_LUES = 100;

/**
 * Notifications non lues du membre courant (hors types mis en silence, lot S2),
 * les plus récentes d'abord, bornées à 100 (`99+` si tronqué).
 */
export const nonLues = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user || !user.isActive || user.enAttente) {
      return { lignes: [], total: 0, tronque: false, importanceDominante: null as Importance | null };
    }

    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_destinataire_lu", (q) => q.eq("destinataireId", user._id).eq("lu", false))
      .order("desc")
      .take(LIMITE_NON_LUES + 1);

    const filtrees = filtrerNonLuesParPreferences(rows, user.notifsSilencieuses ?? []);
    const tronque = filtrees.length > LIMITE_NON_LUES;
    const lignes = tronque ? filtrees.slice(0, LIMITE_NON_LUES) : filtrees;
    return {
      lignes,
      total: lignes.length,
      tronque,
      importanceDominante: importanceDominante(lignes),
    };
  },
});

/**
 * Historique paginé par curseur (`avant` = date ISO `creeLe`) des notifications du membre courant.
 * Affiche TOUS les types, y compris ceux mis en silence (lot S2 §6).
 */
export const historique = query({
  args: {
    limite: v.optional(v.number()),
    avant: v.optional(v.string()),
  },
  handler: async (ctx, { limite, avant }) => {
    const user = await getCurrentUser(ctx);
    if (!user || !user.isActive || user.enAttente) {
      return { lignes: [], suivant: null, silencieuses: [] as string[] };
    }

    const max = Math.min(Math.max(Math.floor(limite ?? 30), 1), 100);
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_destinataire_date", (q) =>
        avant ? q.eq("destinataireId", user._id).lt("creeLe", avant) : q.eq("destinataireId", user._id),
      )
      .order("desc")
      .take(max + 1);

    const aSuite = rows.length > max;
    const lignes = aSuite ? rows.slice(0, max) : rows;
    const suivant = aSuite ? lignes[lignes.length - 1]?.creeLe ?? null : null;
    return { lignes, suivant, silencieuses: user.notifsSilencieuses ?? [] };
  },
});

/** Préférences de mise en silence du membre courant (lot S2). */
export const mesPreferences = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user || !user.isActive || user.enAttente) return { silencieuses: [] as string[] };
    return { silencieuses: user.notifsSilencieuses ?? [] };
  },
});

/** Met à jour les préférences de notification du membre courant uniquement (lot S2 §6). */
export const reglerPreferences = mutation({
  args: { silencieux: v.array(v.string()) },
  handler: async (ctx, { silencieux }) => {
    const user = await getCurrentUser(ctx);
    if (!user || !user.isActive || user.enAttente) throw new Error("Non authentifié.");

    const verif = validerPreferencesSilencieuses(silencieux);
    if (!verif.ok) {
      throw new Error(`Type(s) de notification inconnu(s) : ${verif.inconnues.join(", ")}.`);
    }

    await ctx.db.patch(user._id, {
      notifsSilencieuses: verif.normalisees.length ? verif.normalisees : undefined,
    });
    return { silencieuses: verif.normalisees };
  },
});

/** Marque une notification comme lue. Vérifie l'appartenance au membre courant. Idempotente. */
export const marquerLue = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, { notificationId }) => {
    const user = await getCurrentUser(ctx);
    if (!user || !user.isActive || user.enAttente) throw new Error("Non authentifié.");

    const notif = await ctx.db.get(notificationId);
    if (!notif || String(notif.destinataireId) !== String(user._id)) {
      throw new Error("Accès refusé : cette notification ne vous appartient pas.");
    }
    if (notif.lu) return;

    await ctx.db.patch(notificationId, { lu: true, luLe: new Date().toISOString() });
  },
});

/** Marque les non-lues du membre courant par lots de 100 maximum et renvoie le nombre traité. */
export const marquerToutesLues = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user || !user.isActive || user.enAttente) throw new Error("Non authentifié.");

    const nonLuesBatch = await ctx.db
      .query("notifications")
      .withIndex("by_destinataire_lu", (q) => q.eq("destinataireId", user._id).eq("lu", false))
      .take(100);

    const luLe = new Date().toISOString();
    for (const n of nonLuesBatch) {
      await ctx.db.patch(n._id, { lu: true, luLe });
    }
    return nonLuesBatch.length;
  },
});

const RETENTION_LUES_MS = 90 * 24 * 60 * 60 * 1000;
const LIMITE_PURGE = 1000;

/**
 * Purge hebdomadaire : supprime les notifications LUES dont `creeLe` a plus de 90 jours
 * (et les traces `rappelsEmis` de plus de 90 jours). Bornée à 1 000 suppressions par table.
 */
export const purger = internalMutation({
  args: {},
  handler: async (ctx) => {
    const seuil = new Date(Date.now() - RETENTION_LUES_MS).toISOString();
    const anciennes = await ctx.db
      .query("notifications")
      .withIndex("by_lu_date", (q) => q.eq("lu", true).lt("creeLe", seuil))
      .take(LIMITE_PURGE);

    for (const n of anciennes) {
      await ctx.db.delete(n._id);
    }

    const anciensRappels = await ctx.db
      .query("rappelsEmis")
      .withIndex("by_date", (q) => q.lt("emisLe", seuil))
      .take(LIMITE_PURGE);
    for (const r of anciensRappels) {
      await ctx.db.delete(r._id);
    }

    return { notifications: anciennes.length, rappels: anciensRappels.length };
  },
});

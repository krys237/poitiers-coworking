// Expédition sortante unifiée (lot S3 : Hub WhatsApp ; lot S4 : Push Firebase).
// L'ordre est non négociable : la ligne `envoisNotifications` et sa clé d'idempotence sont
// écrites EN BASE AVANT tout appel réseau (exigence du hub WhatsApp).
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { TYPE_PAR_CLE, canauxPour, type ContexteRendu } from "./lib/notifications";
import {
  REPRISES_MS,
  avancerStatut,
  classerErreurHub,
  cleIdempotence,
  delaiEtalementMs,
  modeCanal,
  statutDepuisHub,
  type StatutEnvoi,
} from "./lib/transport";
import { lireReglages } from "./parametres";

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

/**
 * Prépare les envois sortants (WhatsApp S3 + Push Firebase S4) pour un lot de notifications
 * déjà persistées par `notifications.emettre`. Écrit chaque ligne en `a_envoyer` AVANT de
 * planifier l'action réseau.
 */
export const preparer = internalMutation({
  args: {
    type: v.string(),
    titre: v.string(),
    corps: v.optional(v.string()),
    lien: v.string(),
    objet: OBJET_V,
    rendu: v.optional(RENDU_V),
    dateJour: v.optional(v.string()),
    cibles: v.array(
      v.object({
        destinataireId: v.id("users"),
        notificationId: v.id("notifications"),
      }),
    ),
  },
  handler: async (ctx, a) => {
    const type = TYPE_PAR_CLE[a.type];
    if (!type || !type.canaux?.length) return;

    const maintenant = new Date().toISOString();
    let indexWhatsapp = 0;

    for (const { destinataireId, notificationId } of a.cibles) {
      const user = await ctx.db.get(destinataireId);
      if (!user || !user.isActive || user.enAttente) continue;

      // Les préférences ne retirent pas la ligne d'historique, mais coupent les canaux sortants (S2 §6).
      if ((user.notifsSilencieuses ?? []).includes(type.cle)) continue;

      // Couture C1.4 : résolution des canaux sortants par type et par membre.
      const canaux = canauxPour(type, { id: String(destinataireId) });

      // 1. Canal WhatsApp (lot S3)
      if (canaux.includes("whatsapp") && type.whatsapp) {
        let telephone = user.phone?.trim();
        if (!telephone && user.employeId) {
          const fiche = await ctx.db.get(user.employeId);
          telephone = fiche?.whatsapp?.trim();
        }
        if (telephone) {
          const cle = cleIdempotence(
            "whatsapp",
            type.cle,
            a.objet.table,
            a.objet.id,
            String(destinataireId),
            a.dateJour,
          );
          const existant = await ctx.db
            .query("envoisNotifications")
            .withIndex("by_cle", (q) => q.eq("cleIdempotence", cle))
            .first();
          if (!existant) {
            const parametres = type.whatsapp.parametres((a.rendu ?? {}) as ContexteRendu);
            const envoiId = await ctx.db.insert("envoisNotifications", {
              notificationId,
              destinataireId,
              canal: "whatsapp",
              adresse: telephone,
              cleIdempotence: cle,
              modele: type.whatsapp.modele,
              parametres,
              statut: "a_envoyer",
              essais: 0,
              creeLe: maintenant,
              majLe: maintenant,
            });
            // Étalement à 1 200 ms par destinataire : 50 envois/min < plafond 60/min du hub.
            const delai = delaiEtalementMs(indexWhatsapp++);
            await ctx.scheduler.runAfter(delai, internal.envois.expedierWhatsapp, { envoiId });
          }
        }
      }

      // 2. Canal Push système Firebase (lot S4)
      if (canaux.includes("push")) {
        const appareils = await ctx.db
          .query("appareils")
          .withIndex("by_membre", (q) => q.eq("membreId", destinataireId))
          .collect();
        for (const app of appareils) {
          const cle = cleIdempotence(
            "push",
            type.cle,
            a.objet.table,
            `${a.objet.id}_${app._id}`,
            String(destinataireId),
            a.dateJour,
          );
          const existant = await ctx.db
            .query("envoisNotifications")
            .withIndex("by_cle", (q) => q.eq("cleIdempotence", cle))
            .first();
          if (!existant) {
            const envoiId = await ctx.db.insert("envoisNotifications", {
              notificationId,
              destinataireId,
              canal: "push",
              adresse: app.jeton,
              cleIdempotence: cle,
              statut: "a_envoyer",
              essais: 0,
              creeLe: maintenant,
              majLe: maintenant,
            });
            await ctx.scheduler.runAfter(0, internal.pushFirebase.expedierPush, {
              envoiId,
              titre: a.titre,
              corps: a.corps,
              lien: a.lien,
              notificationId: String(notificationId),
              type: type.cle,
            });
          }
        }
      }
    }
  },
});

export const lireEnvoi = internalQuery({
  args: { envoiId: v.id("envoisNotifications") },
  handler: async (ctx, { envoiId }) => {
    const envoi = await ctx.db.get(envoiId);
    const reglages = await lireReglages(ctx);
    return { envoi, reglages };
  },
});

export const marquerStatut = internalMutation({
  args: {
    envoiId: v.id("envoisNotifications"),
    statut: v.union(
      v.literal("a_envoyer"),
      v.literal("accepte"),
      v.literal("envoye"),
      v.literal("delivre"),
      v.literal("lu"),
      v.literal("echec"),
      v.literal("simule"),
    ),
    messageId: v.optional(v.string()),
    codeEchec: v.optional(v.string()),
    erreur: v.optional(v.string()),
    incrementerEssais: v.optional(v.boolean()),
  },
  handler: async (ctx, a) => {
    const e = await ctx.db.get(a.envoiId);
    if (!e) return;
    await ctx.db.patch(a.envoiId, {
      statut: a.statut,
      ...(a.messageId !== undefined ? { messageId: a.messageId } : {}),
      ...(a.codeEchec !== undefined ? { codeEchec: a.codeEchec } : {}),
      ...(a.erreur !== undefined ? { erreur: a.erreur } : {}),
      essais: a.incrementerEssais ? e.essais + 1 : e.essais,
      majLe: new Date().toISOString(),
    });
  },
});

/**
 * Expédie un message WhatsApp via le hub interne (`POST {hub}/messages/`).
 * Respecte strictement le mode simulation et la politique de reprise (jamais de reprise sur 401/4xx).
 */
export const expedierWhatsapp = internalAction({
  args: { envoiId: v.id("envoisNotifications") },
  handler: async (ctx, { envoiId }): Promise<void> => {
    const { envoi, reglages } = await ctx.runQuery(internal.envois.lireEnvoi, { envoiId });
    if (!envoi || envoi.statut !== "a_envoyer") return;

    const apiKey = process.env.NOTIFICATION_HUB_API_KEY ?? "";
    const hubUrl = (process.env.NOTIFICATION_HUB_URL ?? "https://notifications.edoctor-tim.com/api/v1").replace(/\/+$/, "");

    // Mode simulation : aucun appel réseau, aucun échec.
    if (modeCanal(Boolean(apiKey), reglages.whatsappNotifsActive) === "simulation") {
      await ctx.runMutation(internal.envois.marquerStatut, {
        envoiId,
        statut: "simule",
        incrementerEssais: true,
      });
      return;
    }

    const params = envoi.parametres ?? [];
    const components = params.length
      ? [{ type: "body", parameters: params.map((p: string) => ({ type: "text", text: p })) }]
      : [];

    let httpStatus = 0;
    let bodyJson: any = null;
    let erreurReseau: string | undefined;

    try {
      const resp = await fetch(`${hubUrl}/messages/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Idempotency-Key": envoi.cleIdempotence,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipient: envoi.adresse,
          template: envoi.modele,
          language: "fr",
          components,
          metadata: {
            envoi_id: String(envoi._id),
            ...(envoi.notificationId ? { notification_id: String(envoi.notificationId) } : {}),
          },
        }),
        signal: AbortSignal.timeout(10_000),
      });
      httpStatus = resp.status;
      try {
        bodyJson = await resp.json();
      } catch {
        bodyJson = null;
      }
    } catch (err) {
      httpStatus = 0;
      erreurReseau = err instanceof Error ? err.message : "Erreur réseau ou timeout (10 s)";
    }

    if (httpStatus === 200 || httpStatus === 202) {
      await ctx.runMutation(internal.envois.marquerStatut, {
        envoiId,
        statut: "accepte",
        messageId: typeof bodyJson?.id === "string" ? bodyJson.id : undefined,
        incrementerEssais: true,
      });
      return;
    }

    const errorCode: string = bodyJson?.error?.code ?? (httpStatus === 0 ? "network_error" : `http_${httpStatus}`);
    const requestId: string | undefined = bodyJson?.error?.request_id;
    const detail = [
      bodyJson?.error?.message ?? erreurReseau ?? `HTTP ${httpStatus}`,
      requestId ? `request_id=${requestId}` : undefined,
    ]
      .filter(Boolean)
      .join(" · ");

    const classement = classerErreurHub(httpStatus, errorCode);
    const essaiCourant = envoi.essais; // 0-indexé avant incrément

    if (classement.rejouable && essaiCourant < REPRISES_MS.length) {
      await ctx.runMutation(internal.envois.marquerStatut, {
        envoiId,
        statut: "a_envoyer",
        codeEchec: errorCode,
        erreur: detail,
        incrementerEssais: true,
      });
      // Reprise asynchrone avec la MÊME clé d'idempotence (jamais de boucle dans l'action).
      await ctx.scheduler.runAfter(REPRISES_MS[essaiCourant], internal.envois.expedierWhatsapp, { envoiId });
      return;
    }

    const codeFinal = classement.rejouable ? "max_essais_locaux" : errorCode;
    if (classement.alerteProprietaire) {
      console.error(`[envois.expedierWhatsapp] Alerte configuration hub (${codeFinal}) : ${detail}`);
    }
    await ctx.runMutation(internal.envois.marquerStatut, {
      envoiId,
      statut: "echec",
      codeEchec: codeFinal,
      erreur: classement.numeroDouteux ? `Numéro sans WhatsApp (131026) · ${detail}` : detail,
      incrementerEssais: true,
    });
  },
});

/**
 * Applique un retour de statut webhook du hub WhatsApp de façon monotone et idempotente.
 */
export const appliquerWebhookStatut = internalMutation({
  args: {
    messageId: v.optional(v.string()),
    cleIdempotence: v.optional(v.string()),
    hubStatus: v.string(),
    codeEchec: v.optional(v.string()),
    erreur: v.optional(v.string()),
  },
  handler: async (ctx, a) => {
    const nouveau = statutDepuisHub(a.hubStatus);
    if (!nouveau) return { applique: false };

    let envoi = a.messageId
      ? await ctx.db
          .query("envoisNotifications")
          .withIndex("by_message", (q) => q.eq("messageId", a.messageId))
          .first()
      : null;
    if (!envoi && a.cleIdempotence) {
      envoi = await ctx.db
        .query("envoisNotifications")
        .withIndex("by_cle", (q) => q.eq("cleIdempotence", a.cleIdempotence!))
        .first();
    }
    if (!envoi) return { applique: false };

    const statutFinal = avancerStatut(envoi.statut as StatutEnvoi, nouveau);
    await ctx.db.patch(envoi._id, {
      statut: statutFinal,
      ...(a.codeEchec ? { codeEchec: a.codeEchec } : {}),
      ...(a.erreur ? { erreur: a.erreur } : {}),
      majLe: new Date().toISOString(),
    });
    return { applique: true, statut: statutFinal };
  },
});

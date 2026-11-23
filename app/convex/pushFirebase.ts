"use node";
// Envoi de notifications push système via Firebase Cloud Messaging HTTP v1 (lot S4).
// Utilise `jose` (déjà présent dans node_modules) pour signer le JWT RS256 du compte
// de service — aucun SDK Admin Firebase à ajouter.
//
// Rappel Convex : un fichier `"use node"` ne contient QUE des actions.

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { importPKCS8, SignJWT } from "jose";
import {
  classerReponseFcm,
  construireChargeFcm,
  jetonOAuthCacheValide,
  type CacheJetonOAuth,
} from "./lib/pushFirebase";
import { REPRISES_MS, modeCanal } from "./lib/transport";

type CompteServiceFirebase = {
  project_id: string;
  client_email: string;
  private_key: string;
};

let cacheOAuth: CacheJetonOAuth | null = null;

async function obtenirJetonAcces(sa: CompteServiceFirebase, forcerRenouvellement = false): Promise<string> {
  const maintenant = Date.now();
  if (!forcerRenouvellement && jetonOAuthCacheValide(cacheOAuth, maintenant)) {
    return cacheOAuth!.accessToken;
  }

  const clePrivee = await importPKCS8(sa.private_key, "RS256");
  const jwt = await new SignJWT({
    scope: "https://www.googleapis.com/auth/firebase.messaging",
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(sa.client_email)
    .setSubject(sa.client_email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(clePrivee);

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!resp.ok) {
    throw new Error(`Échec échange OAuth2 Firebase (HTTP ${resp.status}).`);
  }
  const data = (await resp.json()) as { access_token: string; expires_in?: number };
  const ttlMs = (data.expires_in ?? 3600) * 1000;
  cacheOAuth = { accessToken: data.access_token, expireA: Date.now() + ttlMs };
  return data.access_token;
}

async function envoyerVersFcm(
  projectId: string,
  accessToken: string,
  charge: ReturnType<typeof construireChargeFcm>,
): Promise<{ status: number; body: any; erreurReseau?: string }> {
  try {
    const resp = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(charge),
        signal: AbortSignal.timeout(10_000),
      },
    );
    let body: any = null;
    try {
      body = await resp.json();
    } catch {
      body = null;
    }
    return { status: resp.status, body };
  } catch (err) {
    return {
      status: 0,
      body: null,
      erreurReseau: err instanceof Error ? err.message : "Erreur réseau ou timeout FCM",
    };
  }
}

export const expedierPush = internalAction({
  args: {
    envoiId: v.id("envoisNotifications"),
    titre: v.string(),
    corps: v.optional(v.string()),
    lien: v.string(),
    notificationId: v.string(),
    type: v.string(),
  },
  handler: async (ctx, a): Promise<void> => {
    const { envoi, reglages } = await ctx.runQuery(internal.envois.lireEnvoi, {
      envoiId: a.envoiId,
    });
    if (!envoi || envoi.statut !== "a_envoyer") return;

    const saBrut = process.env.FIREBASE_SERVICE_ACCOUNT ?? "";
    if (modeCanal(Boolean(saBrut), reglages.pushReelActive) === "simulation") {
      await ctx.runMutation(internal.envois.marquerStatut, {
        envoiId: a.envoiId,
        statut: "simule",
        incrementerEssais: true,
      });
      return;
    }

    let sa: CompteServiceFirebase;
    try {
      sa = JSON.parse(saBrut) as CompteServiceFirebase;
      if (!sa.project_id || !sa.client_email || !sa.private_key) {
        throw new Error("Champs project_id / client_email / private_key manquants.");
      }
    } catch (err) {
      await ctx.runMutation(internal.envois.marquerStatut, {
        envoiId: a.envoiId,
        statut: "echec",
        codeEchec: "config_invalide",
        erreur: err instanceof Error ? err.message : "FIREBASE_SERVICE_ACCOUNT invalide",
        incrementerEssais: true,
      });
      return;
    }

    const siteUrl = process.env.SITE_URL ?? "https://poitiers-coworking.vercel.app";
    const charge = construireChargeFcm({
      jeton: envoi.adresse,
      titre: a.titre,
      corps: a.corps,
      lien: a.lien,
      siteUrl,
      notificationId: a.notificationId,
      type: a.type,
    });

    let accessToken: string;
    try {
      accessToken = await obtenirJetonAcces(sa);
    } catch (err) {
      await ctx.runMutation(internal.envois.marquerStatut, {
        envoiId: a.envoiId,
        statut: "echec",
        codeEchec: "oauth_echec",
        erreur: err instanceof Error ? err.message : "Échec OAuth2",
        incrementerEssais: true,
      });
      return;
    }

    let resultat = await envoyerVersFcm(sa.project_id, accessToken, charge);

    // 401 : vider le cache OAuth et faire UN SEUL nouvel essai (spec S4 §6).
    if (resultat.status === 401) {
      cacheOAuth = null;
      try {
        accessToken = await obtenirJetonAcces(sa, true);
        resultat = await envoyerVersFcm(sa.project_id, accessToken, charge);
      } catch {
        // tombe dans le classement ci-dessous
      }
    }

    if (resultat.status === 200) {
      await ctx.runMutation(internal.envois.marquerStatut, {
        envoiId: a.envoiId,
        statut: "accepte",
        messageId: typeof resultat.body?.name === "string" ? resultat.body.name : undefined,
        incrementerEssais: true,
      });
      return;
    }

    const details = resultat.body?.error?.details;
    const fcmCode: string | undefined =
      (Array.isArray(details) ? details.find((d: any) => d?.errorCode)?.errorCode : undefined) ??
      resultat.body?.error?.status;
    const classement = classerReponseFcm(resultat.status, fcmCode);
    const detail = resultat.body?.error?.message ?? resultat.erreurReseau ?? `HTTP ${resultat.status}`;

    if (classement.retirerJeton) {
      await ctx.runMutation(internal.appareils.retirerJetonInvalide, { jeton: envoi.adresse });
    }

    const essaiCourant = envoi.essais;
    if (classement.rejouable && essaiCourant < REPRISES_MS.length) {
      await ctx.runMutation(internal.envois.marquerStatut, {
        envoiId: a.envoiId,
        statut: "a_envoyer",
        codeEchec: fcmCode ?? `http_${resultat.status}`,
        erreur: detail,
        incrementerEssais: true,
      });
      await ctx.scheduler.runAfter(REPRISES_MS[essaiCourant], internal.pushFirebase.expedierPush, a);
      return;
    }

    if (classement.alerteProprietaire) {
      console.error(`[pushFirebase.expedierPush] Alerte configuration Firebase (${fcmCode}) : ${detail}`);
    }
    await ctx.runMutation(internal.envois.marquerStatut, {
      envoiId: a.envoiId,
      statut: "echec",
      codeEchec: classement.rejouable ? "max_essais_locaux" : (fcmCode ?? `http_${resultat.status}`),
      erreur: detail,
      incrementerEssais: true,
    });
  },
});

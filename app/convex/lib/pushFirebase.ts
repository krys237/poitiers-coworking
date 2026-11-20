// Logique pure du push système Firebase Cloud Messaging HTTP v1 (lot S4).
// PUR : aucun appel réseau, aucun import serveur — 100 % testable isolément.

/** Tronque un texte sans couper un mot en deux, avec ellipse si dépassé. */
export function tronquerSansCouperMot(texte: string, max: number): string {
  const propre = texte.trim().replace(/\s+/g, " ");
  if (propre.length <= max) return propre;
  const coupe = propre.slice(0, Math.max(1, max - 1));
  const dernierEspace = coupe.lastIndexOf(" ");
  const base = dernierEspace > Math.floor(max * 0.4) ? coupe.slice(0, dernierEspace) : coupe;
  return `${base.trimEnd()}…`;
}

/** Construit une URL absolue depuis `SITE_URL` et un lien relatif, sans double barre oblique. */
export function construireUrlAbsolue(siteUrl: string, lien: string): string {
  if (/^https?:\/\//i.test(lien)) return lien;
  const base = siteUrl.replace(/\/+$/, "");
  const chemin = lien.startsWith("/") ? lien : `/${lien}`;
  return `${base}${chemin}`;
}

export type ChargeFcm = {
  message: {
    token: string;
    notification: { title: string; body?: string };
    webpush: {
      fcm_options: { link: string };
      notification: { icon: string; badge: string };
    };
    data: { notificationId: string; type: string; lien: string };
  };
};

/** Construit la charge utile FCM HTTP v1 pour une PWA (spec S4 §6). */
export function construireChargeFcm(args: {
  jeton: string;
  titre: string;
  corps?: string;
  lien: string;
  siteUrl: string;
  notificationId: string;
  type: string;
}): ChargeFcm {
  const title = tronquerSansCouperMot(args.titre, 65);
  const body = args.corps ? tronquerSansCouperMot(args.corps, 240) : undefined;
  const link = construireUrlAbsolue(args.siteUrl, args.lien);
  return {
    message: {
      token: args.jeton,
      notification: body ? { title, body } : { title },
      webpush: {
        fcm_options: { link },
        notification: { icon: "/pwa-192x192.png", badge: "/pwa-64x64.png" },
      },
      data: {
        notificationId: args.notificationId,
        type: args.type,
        lien: args.lien,
      },
    },
  };
}

export type ClassementReponseFcm = {
  ok: boolean;
  rejouable: boolean;
  retirerJeton: boolean;
  alerteProprietaire: boolean;
  viderCacheOAuth: boolean;
};

/** Classement des réponses FCM HTTP v1 (spec S4 §6). */
export function classerReponseFcm(
  httpStatus: number,
  errorCode?: string,
): ClassementReponseFcm {
  if (httpStatus === 200) {
    return { ok: true, rejouable: false, retirerJeton: false, alerteProprietaire: false, viderCacheOAuth: false };
  }
  if (
    httpStatus === 404 ||
    errorCode === "UNREGISTERED" ||
    httpStatus === 400 ||
    errorCode === "INVALID_ARGUMENT"
  ) {
    return { ok: false, rejouable: false, retirerJeton: true, alerteProprietaire: false, viderCacheOAuth: false };
  }
  if (httpStatus === 403 || errorCode === "SENDER_ID_MISMATCH") {
    return { ok: false, rejouable: false, retirerJeton: false, alerteProprietaire: true, viderCacheOAuth: false };
  }
  if (httpStatus === 401) {
    return { ok: false, rejouable: false, retirerJeton: false, alerteProprietaire: false, viderCacheOAuth: true };
  }
  if (
    httpStatus === 0 ||
    httpStatus === 429 ||
    errorCode === "QUOTA_EXCEEDED" ||
    httpStatus === 503 ||
    errorCode === "UNAVAILABLE" ||
    httpStatus >= 500
  ) {
    return { ok: false, rejouable: true, retirerJeton: false, alerteProprietaire: false, viderCacheOAuth: false };
  }
  return { ok: false, rejouable: false, retirerJeton: false, alerteProprietaire: false, viderCacheOAuth: false };
}

export const MARGE_CACHE_OAUTH_MS = 5 * 60 * 1000;

export type CacheJetonOAuth = {
  accessToken: string;
  expireA: number; // timestamp ms
};

/** Un jeton OAuth2 en cache reste utilisable jusqu'à expiration moins 5 minutes. */
export function jetonOAuthCacheValide(
  cache: CacheJetonOAuth | null,
  maintenantMs: number,
): boolean {
  if (!cache || !cache.accessToken) return false;
  return maintenantMs < cache.expireA - MARGE_CACHE_OAUTH_MS;
}

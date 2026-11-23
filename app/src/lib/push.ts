// Client Push Firebase Cloud Messaging pour la PWA (lot S4).
// - N'initialise jamais Firebase si une variable `VITE_FIREBASE_*` manque.
// - Ne demande JAMAIS la permission au chargement : uniquement sur clic explicite.
// - Détecte iOS hors mode standalone (installation PWA obligatoire sur iPhone).
// - Application au premier plan : toast discret (`sonner`), jamais de notification système.

import { toast } from "sonner";

export type EtatPermissionPush = "non_supporte" | "non_configure" | "default" | "granted" | "denied";

const CONFIG_FIREBASE = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

export function firebaseEstConfigure(): boolean {
  return Boolean(
    CONFIG_FIREBASE.apiKey &&
      CONFIG_FIREBASE.authDomain &&
      CONFIG_FIREBASE.projectId &&
      CONFIG_FIREBASE.messagingSenderId &&
      CONFIG_FIREBASE.appId &&
      VAPID_KEY,
  );
}

export function estInstalleEnPwa(): boolean {
  if (typeof window === "undefined") return false;
  const standaloneMedia = window.matchMedia?.("(display-mode: standalone)")?.matches ?? false;
  const iosStandalone = Boolean((window.navigator as { standalone?: boolean }).standalone);
  return standaloneMedia || iosStandalone;
}

export function estIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/** Sur iOS, le push web n'existe que si la PWA est installée sur l'écran d'accueil (iOS 16.4+). */
export function estIosSansPwa(): boolean {
  return estIos() && !estInstalleEnPwa();
}

export function lireEtatPermissionPush(): EtatPermissionPush {
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) {
    return "non_supporte";
  }
  if (!firebaseEstConfigure()) return "non_configure";
  return Notification.permission as EtatPermissionPush;
}

export function decrireAppareil(): { libelle: string; plateforme: string; installeEnPwa: boolean } {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const plateforme = estIos()
    ? "iOS"
    : /Android/i.test(ua)
      ? "Android"
      : /Windows/i.test(ua)
        ? "Windows"
        : /Mac/i.test(ua)
          ? "macOS"
          : "Web";
  const navigateur = /Edg\//i.test(ua)
    ? "Edge"
    : /Chrome\//i.test(ua)
      ? "Chrome"
      : /Firefox\//i.test(ua)
        ? "Firefox"
        : /Safari\//i.test(ua)
          ? "Safari"
          : "Navigateur";
  return {
    libelle: `${navigateur} sur ${plateforme}`,
    plateforme,
    installeEnPwa: estInstalleEnPwa(),
  };
}

/**
 * Obtient le jeton FCM via le service worker unique de la PWA (jamais `firebase-messaging-sw.js`).
 * Ne demande la permission que si `demanderPermission` est vrai (clic utilisateur explicite).
 */
export async function obtenirJetonPush(demanderPermission: boolean): Promise<{
  ok: boolean;
  jeton?: string;
  permission: EtatPermissionPush;
  erreur?: string;
}> {
  const etat = lireEtatPermissionPush();
  if (etat === "non_supporte" || etat === "non_configure") {
    return { ok: false, permission: etat };
  }

  let permission: NotificationPermission = Notification.permission;
  if (permission === "default") {
    if (!demanderPermission) {
      return { ok: false, permission: "default" };
    }
    permission = await Notification.requestPermission();
  }
  if (permission !== "granted") {
    return { ok: false, permission: permission as EtatPermissionPush };
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const { initializeApp, getApps } = await import("firebase/app");
    const { getMessaging, getToken, onMessage } = await import("firebase/messaging");
    const app = getApps().length ? getApps()[0] : initializeApp(CONFIG_FIREBASE);
    const messaging = getMessaging(app);

    const jeton = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    if (!jeton) {
      return { ok: false, permission: "granted", erreur: "Impossible d'obtenir un jeton FCM." };
    }

    // Premier plan : toast discret uniquement, jamais de notification système (pas de doublon avec la cloche).
    onMessage(messaging, (payload) => {
      const titre = payload.notification?.title;
      const corps = payload.notification?.body;
      if (titre) toast(titre, corps ? { description: corps } : undefined);
    });

    return { ok: true, jeton, permission: "granted" };
  } catch (err) {
    return {
      ok: false,
      permission: "granted",
      erreur: err instanceof Error ? err.message : "Erreur d'initialisation Firebase.",
    };
  }
}

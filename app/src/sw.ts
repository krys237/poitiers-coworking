/// <reference lib="webworker" />
// Service Worker unique de la PWA (lot S4 : bascule `generateSW` → `injectManifest`).
// Conserve à l'identique le pré-cache hors ligne Workbox (polices IBM Plex comprises)
// et reçoit les notifications push Firebase en arrière-plan sans `firebase-messaging-sw.js`.

import { clientsClaim } from "workbox-core";
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<string | { url: string; revision: string | null }>;
};

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload: any = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { notification: { title: "POITIERS COWORKING", body: event.data.text() } };
  }

  const notif = payload.notification ?? {};
  const data = payload.data ?? {};
  const lien = payload.fcmOptions?.link ?? data.lien ?? "/notifications";
  const titre = notif.title ?? "POITIERS COWORKING";
  const options: NotificationOptions = {
    body: notif.body ?? "",
    icon: notif.icon ?? "/pwa-192x192.png",
    badge: notif.badge ?? "/pwa-64x64.png",
    data: { lien, notificationId: data.notificationId, type: data.type },
  };

  event.waitUntil(self.registration.showNotification(titre, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const lien: string = event.notification.data?.lien ?? "/notifications";
  const cibleUrl = new URL(lien, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((fenetres) => {
      for (const client of fenetres) {
        if ("focus" in client && client.url.startsWith(self.location.origin)) {
          if ("navigate" in client) {
            void (client as WindowClient).navigate(cibleUrl);
          }
          return client.focus();
        }
      }
      return self.clients.openWindow(cibleUrl);
    }),
  );
});

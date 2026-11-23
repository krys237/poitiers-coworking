// Tests du push système Firebase Cloud Messaging (lot S4) — 100 % pur, sans réseau.
// Lancer : npm run test:push
import {
  classerReponseFcm,
  construireChargeFcm,
  construireUrlAbsolue,
  jetonOAuthCacheValide,
  tronquerSansCouperMot,
} from "../convex/lib/pushFirebase.ts";
import { cleIdempotence, modeCanal } from "../convex/lib/transport.ts";

let ok = 0, ko = 0;
function verifie(nom: string, cond: boolean) {
  if (cond) ok++; else { ko++; console.log("ÉCHEC", nom); }
}

// 1. Construction de la charge FCM : token, notification, webpush.fcm_options.link corrects.
const charge = construireChargeFcm({
  jeton: "fcm_token_abc",
  titre: "Bon CMD-2026-012 à valider",
  corps: "Achat réactifs — soumis par AMEFFO Lucie",
  lien: "/commandes?ref=CMD-2026-012",
  siteUrl: "https://poitiers-coworking.vercel.app",
  notificationId: "notif_1",
  type: "commande_soumise",
});
verifie("1. token présent", charge.message.token === "fcm_token_abc");
verifie("1. titre et corps présents", charge.message.notification.title === "Bon CMD-2026-012 à valider" && Boolean(charge.message.notification.body));
verifie("1. fcm_options.link absolu", charge.message.webpush.fcm_options.link === "https://poitiers-coworking.vercel.app/commandes?ref=CMD-2026-012");
verifie("1. data porte notificationId et type", charge.message.data.notificationId === "notif_1" && charge.message.data.type === "commande_soumise");

// 2. lien relatif → URL absolue préfixée par SITE_URL, sans double barre oblique.
verifie(
  "2. pas de double barre oblique avec slash final sur SITE_URL",
  construireUrlAbsolue("https://poitiers.app///", "/commandes?ref=1") === "https://poitiers.app/commandes?ref=1",
);
verifie(
  "2. lien sans slash initial normalisé",
  construireUrlAbsolue("https://poitiers.app", "interventions?ref=2") === "https://poitiers.app/interventions?ref=2",
);

// 3. Classement des réponses FCM : UNREGISTERED → retrait jeton non rejouable ; 503 → rejouable.
const unreg = classerReponseFcm(404, "UNREGISTERED");
verifie("3. UNREGISTERED → retrait jeton, non rejouable", unreg.retirerJeton && !unreg.rejouable);
const inval = classerReponseFcm(400, "INVALID_ARGUMENT");
verifie("3. INVALID_ARGUMENT → retrait jeton, non rejouable", inval.retirerJeton && !inval.rejouable);
const srv = classerReponseFcm(503, "UNAVAILABLE");
verifie("3. 503 UNAVAILABLE → rejouable, pas de retrait", srv.rejouable && !srv.retirerJeton);
const quota = classerReponseFcm(429, "QUOTA_EXCEEDED");
verifie("3. 429 QUOTA_EXCEEDED → rejouable", quota.rejouable);
const mismatch = classerReponseFcm(403, "SENDER_ID_MISMATCH");
verifie("3. 403 SENDER_ID_MISMATCH → alerte propriétaire, non rejouable", mismatch.alerteProprietaire && !mismatch.rejouable);
const auth401 = classerReponseFcm(401);
verifie("3. 401 → vide le cache OAuth", auth401.viderCacheOAuth && !auth401.rejouable);

// 4. Mode du canal : les trois combinaisons clé / interrupteur.
verifie("4. compte de service absent → simulation", modeCanal(false, true) === "simulation");
verifie("4. interrupteur fermé → simulation", modeCanal(true, false) === "simulation");
verifie("4. compte de service + interrupteur ouvert → réel", modeCanal(true, true) === "reel");

// 5. Cache du jeton d'accès : valide avant expiration - 5 min, expiré après.
const expireA = 1_700_000_000_000;
const cache = { accessToken: "ya29.xxx", expireA };
verifie("5. cache valide à expiration - 6 min", jetonOAuthCacheValide(cache, expireA - 6 * 60_000));
verifie("5. cache invalide à expiration - 4 min", !jetonOAuthCacheValide(cache, expireA - 4 * 60_000));
verifie("5. cache null invalide", !jetonOAuthCacheValide(null, expireA - 10 * 60_000));

// 6. Un membre à plusieurs appareils → une clé (ligne de journal) distincte par appareil.
const cApp1 = cleIdempotence("push", "commande_soumise", "commandes", "cmd1_app1", "user1");
const cApp2 = cleIdempotence("push", "commande_soumise", "commandes", "cmd1_app2", "user1");
verifie("6. deux appareils produisent deux lignes distinctes", cApp1 !== cApp2);

// 7. Troncature des titres ≤ 65 car. et corps ≤ 240 car., sans couper un mot en deux.
const longTitre = "Demande d'intervention urgente sur le climatiseur principal du laboratoire d'analyses médicales";
const tCoupe = tronquerSansCouperMot(longTitre, 65);
verifie("7. titre tronqué <= 65 car.", tCoupe.length <= 65 && tCoupe.endsWith("…"));
verifie("7. titre ne coupe pas un mot en deux", !tCoupe.endsWith("laboratoir…"));

const longCorps = "Mot ".repeat(80).trim();
const cCoupe = tronquerSansCouperMot(longCorps, 240);
verifie("7. corps tronqué <= 240 car.", cCoupe.length <= 240 && cCoupe.endsWith("…"));

console.log(`pushFirebase : ${ok} contrôles OK, ${ko} échec(s)`);
if (ko) process.exit(1);

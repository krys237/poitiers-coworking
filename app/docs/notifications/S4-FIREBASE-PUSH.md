# S4 · Push système par Firebase

> **Dépend de** : S1 et S3 livrés (ce lot est une implémentation de l'interface `Transport`
> et réutilise le journal `envoisNotifications`).
> **Modifie le schéma** : oui, une table ajoutée (`appareils`).
> **Dépendance externe** : **oui** — projet Firebase à fournir par le propriétaire.
> **Touche la chaîne de build** : oui. C'est le **seul** lot du programme dans ce cas.

---

## 1. Objectif

Réveiller le téléphone d'un membre **application fermée**, par Firebase Cloud Messaging.

C'est le lot le plus risqué techniquement du programme, et il est isolé pour cette raison :
il change la stratégie de service worker de la PWA.

### Dans le périmètre

- Le passage de `vite-plugin-pwa` de `generateSW` à **`injectManifest`** avec un service
  worker maison.
- L'enregistrement des **jetons d'appareil** Firebase, un par appareil et par membre.
- L'**envoi** par FCM HTTP v1 depuis une action Convex.
- Le **cycle de vie** : demande de permission, renouvellement, expiration, révocation.
- Le **parcours d'installation de la PWA**, obligatoire sur iPhone.
- Le mode **simulation** sans aucune valeur Firebase.

### Hors périmètre

- Les notifications dans l'application (S1, S2) et WhatsApp (S3).
- Les notifications sur poste de travail hors PWA : ça marchera sans travail
  supplémentaire sur Chrome et Edge, ce n'est pas une cible à soigner.

---

## 2. À obtenir du propriétaire avant de coder

L'agent **ne crée aucun compte Firebase.** Il construit le lot pour qu'il fonctionne en
simulation, et le propriétaire pose les valeurs.

| Valeur | Nature | Où elle va |
|---|---|---|
| `apiKey`, `authDomain`, `projectId`, `messagingSenderId`, `appId` | **publiques** | frontend, en `VITE_FIREBASE_*` |
| Clé **VAPID publique** (Console → Cloud Messaging → Web Push certificates) | publique | frontend, `VITE_FIREBASE_VAPID_KEY` |
| **Compte de service** JSON, rôle d'envoi FCM | **SECRET** | `npx convex env set FIREBASE_SERVICE_ACCOUNT` |

> Les cinq premières valeurs sont publiques **par conception** chez Firebase : elles partent
> dans le bundle du navigateur. Le compte de service, lui, ne doit **jamais** approcher le
> frontend ni le dépôt.

---

## 3. Le service worker — le point délicat

### Le problème

Aujourd'hui `app/vite.config.ts` utilise `VitePWA` en stratégie par défaut, **`generateSW`** :
Workbox génère le service worker, et **on ne peut pas y mettre de code à soi**. Or recevoir un
push exige un gestionnaire d'événement `push` dans le service worker.

Par ailleurs Firebase documente un fichier `firebase-messaging-sw.js` à la racine. Si on le
pose à côté du service worker de Workbox, **deux service workers se disputent la portée
racine** — et l'un désinstalle l'autre de façon imprévisible.

### La solution retenue : un seul service worker

1. Passer `VitePWA` en **`strategies: "injectManifest"`** avec `srcDir: "src"` et
   `filename: "sw.ts"`.
2. Écrire `app/src/sw.ts` : il appelle `precacheAndRoute(self.__WB_MANIFEST)` pour conserver
   **exactement** le comportement hors ligne actuel, **puis** installe le gestionnaire de
   messages Firebase en arrière-plan.
3. Côté application, passer **explicitement** cette inscription à Firebase :
   `getToken(messaging, { vapidKey, serviceWorkerRegistration })`. C'est l'API officielle
   pour ne pas dépendre du nom `firebase-messaging-sw.js`.

**Ne crée pas `firebase-messaging-sw.js`.** Un seul service worker, à la racine.

### Ce qu'il ne faut surtout pas perdre

La configuration actuelle de `vite.config.ts` porte deux réglages durement acquis, à
**reporter à l'identique** :

```ts
globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],   // woff2 : sinon la mise en page des tableaux se décale hors ligne
globIgnores: ["**/*-{cyrillic,cyrillic-ext,greek,greek-ext,vietnamese,thai}-*.woff2"], // ~100 Ko inutiles sur connexion lente
```

Le commentaire du fichier explique pourquoi. **Lis-le avant de toucher à ce bloc.**

Et le `manifest` existant (nom, couleurs, `display: "standalone"`, `start_url`) reste tel
quel.

### Vérification avant de passer à la suite

Après le changement de stratégie et **avant** d'ajouter quoi que ce soit de Firebase :
`npm run build`, servir `dist/`, et vérifier que l'application fonctionne **hors ligne**
comme avant, polices comprises. Si ce n'est pas le cas, arrête-toi là et corrige : tu casserais
la PWA pour tout le monde.

---

## 4. Le schéma — les appareils

Un membre peut avoir plusieurs appareils ; un jeton appartient à un appareil, pas à une
personne.

```ts
  // ---- Appareils enregistrés pour le push (lot S4) ----
  // Un jeton Firebase par appareil et par membre. Un jeton refusé par FCM
  // (UNREGISTERED / INVALID_ARGUMENT) est supprimé : il ne sert plus à rien et
  // le garder ferait échouer chaque envoi.
  appareils: defineTable({
    membreId: v.id("users"),
    jeton: v.string(),                // jeton d'inscription FCM
    libelle: v.optional(v.string()),  // "Chrome sur Android", pour que le membre s'y retrouve
    plateforme: v.optional(v.string()),
    installeEnPwa: v.optional(v.boolean()),
    creeLe: v.string(),
    vuLe: v.string(),                 // dernière confirmation du jeton par l'application
  })
    .index("by_membre", ["membreId"])
    .index("by_jeton", ["jeton"]),
```

Mutations, toutes **sur le membre courant uniquement** :

| Fonction | Rôle |
|---|---|
| `appareils.enregistrer({ jeton, libelle, plateforme, installeEnPwa })` | crée ou met à jour (`by_jeton`), rafraîchit `vuLe`. **Idempotente** : appelée à chaque démarrage. |
| `appareils.oublier({ jeton })` | retire un appareil (bouton « ne plus recevoir sur cet appareil ») |
| `appareils.mesAppareils` | query, pour l'écran de préférences de S2 |
| `appareils.retirerJetonInvalide` | `internalMutation`, appelée par l'expéditeur quand FCM refuse un jeton |

---

## 5. Côté application

Nouveau fichier `app/src/lib/push.ts`, et un bloc dans l'écran de préférences de S2.

### Les règles de comportement

- **Ne demande JAMAIS la permission au chargement de la page.** Un navigateur refusé une fois
  ne redemande plus, et la permission est perdue définitivement pour cet appareil. La demande
  part **d'un clic explicite** sur « Activer les notifications sur cet appareil », dans les
  préférences.
- Avant le clic, affiche l'état réel : permission `default` / `granted` / `denied`, et si
  `denied`, explique que ça se débloque dans les réglages du navigateur — l'application n'y
  peut rien.
- Après `granted` : `getToken(...)`, puis `appareils.enregistrer`. **Rappelle
  `enregistrer` à chaque démarrage** : un jeton FCM tourne sans prévenir.
- `onMessage` (application au premier plan) : **n'affiche pas de notification système.** La
  cloche de S2 est déjà réactive, ce serait un doublon. Contente-toi d'un toast discret
  (`sonner` est déjà installé) ou de rien du tout.
- Si une variable `VITE_FIREBASE_*` manque : la section affiche « Notifications système non
  configurées » et **n'initialise pas Firebase**. Pas d'erreur en console, pas d'écran cassé.

### Le cas iPhone — à dire clairement à l'utilisateur

Sur iOS, le push web **n'existe que si la PWA est installée sur l'écran d'accueil**
(iOS 16.4 et plus). Dans Safari en onglet, `Notification.requestPermission` n'aboutit pas, et
aucun push n'arrivera jamais.

L'écran doit donc **détecter le cas** (iOS + pas en mode `standalone`) et afficher la marche à
suivre : *Partager → Sur l'écran d'accueil*, puis rouvrir l'application depuis l'icône. Avec
une capture ou un pictogramme, c'est un parcours que les gens ne connaissent pas.

Détection : `window.matchMedia("(display-mode: standalone)").matches`, ou
`navigator.standalone` sur iOS.

> **Dis-le au propriétaire sans l'enjoliver** : sur les iPhone de l'effectif, le push
> n'arrivera qu'après installation manuelle de la PWA, appareil par appareil. C'est une
> limite d'Apple, pas un défaut d'implémentation. Sur Android et Chrome, ça fonctionne sans
> cette contrainte. C'est aussi ce qui rend le canal WhatsApp de S3 précieux.

---

## 6. Côté serveur — l'envoi par FCM HTTP v1

Nouveau fichier `app/convex/pushFirebase.ts`, annoté **`"use node"`** (il faut du chiffrement
pour signer le jeton d'accès). Rappel : un fichier `"use node"` ne contient **que des
actions** ; tout accès à la base passe par `ctx.runQuery` / `ctx.runMutation`.

### Le jeton d'accès

FCM HTTP v1 exige un jeton OAuth2 obtenu depuis le compte de service. **N'installe pas le SDK
Admin de Firebase** : `jose` est déjà dans `node_modules` et suffit.

1. Lire `FIREBASE_SERVICE_ACCOUNT` (le JSON) depuis `process.env`.
2. Signer un JWT `RS256` avec `client_email`, l'audience
   `https://oauth2.googleapis.com/token`, le scope
   `https://www.googleapis.com/auth/firebase.messaging`, et une durée de vie d'une heure.
3. L'échanger contre un jeton d'accès sur `https://oauth2.googleapis.com/token`
   (`grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer`).
4. **Le mettre en cache** pour la durée de sa validité, moins une marge de 5 minutes. Un
   échange par envoi serait du gaspillage et finirait limité en débit.

### L'envoi

```
POST https://fcm.googleapis.com/v1/projects/<projectId>/messages:send
Authorization: Bearer <jeton d'accès>
```

Charge utile, pour une PWA :

```json
{ "message": {
    "token": "<jeton d'appareil>",
    "notification": { "title": "Bon CMD-2026-012 à valider", "body": "…" },
    "webpush": {
      "fcm_options": { "link": "https://poitiers-coworking.vercel.app/commandes?ref=CMD-2026-012" },
      "notification": { "icon": "/pwa-192x192.png", "badge": "/pwa-64x64.png" }
    },
    "data": { "notificationId": "…", "type": "commande_soumise" }
} }
```

`fcm_options.link` est ce qui ouvre la bonne page au clic — c'est le `lien` de la
notification de S1, préfixé par l'URL du site (`SITE_URL`, déjà défini sur le déploiement).

### Les réponses à traiter

| Réponse | Conduite |
|---|---|
| `200` | statut `accepte` dans `envoisNotifications`, `messageId` conservé |
| `404` / `UNREGISTERED` | l'appareil a désinstallé ou le jeton a tourné → `appareils.retirerJetonInvalide`, puis `echec` non rejouable |
| `400` / `INVALID_ARGUMENT` | jeton malformé → même traitement |
| `403` / `SENDER_ID_MISMATCH` | mauvaise configuration → échec définitif, **alerter le propriétaire** |
| `429` / `QUOTA_EXCEEDED`, `503` / `UNAVAILABLE` | rejouable, attente croissante (2 s, 5 s, 15 s, 60 s) |
| `401` | jeton d'accès invalide : vide le cache, **un seul** nouvel essai, puis échec |

Les retraits de jetons invalides sont la **principale** source de propreté de ce lot : un
jeton mort non supprimé fait échouer un envoi à chaque notification, pour toujours.

### Mode et interrupteur

Ajoute dans `convex/lib/reglages.ts` (défaut **`false`**) :

```ts
  /** Notifications push : sans cet interrupteur, l'envoi reste simulé même si le compte de service est défini. */
  pushReelActive: boolean;
```

Réel **si et seulement si** `FIREBASE_SERVICE_ACCOUNT` est présent **et** `pushReelActive` est
vrai. Sinon : ligne `simule` dans le journal, aucun appel réseau, **rien n'échoue**.

### Politique de canal

Mêmes types que WhatsApp (S3 §7), avec `"push"` ajouté dans leur champ `canaux`. Le push étant
gratuit et silencieux, on peut y ajouter les types `info` — **mais pas dans ce lot.** Livre
d'abord la parité avec WhatsApp, et laisse le propriétaire décider ensuite.

Pas d'étalement nécessaire : FCM encaisse largement nos volumes.

---

## 7. Tests

Suite `app/tests/pushFirebase.test.ts`, script `test:push`. Testable sans réseau :

| # | Cas | Attendu |
|---|---|---|
| 1 | Construction de la charge FCM | `token`, `notification`, `webpush.fcm_options.link` corrects |
| 2 | `lien` relatif → URL absolue | préfixé par `SITE_URL`, sans double barre oblique |
| 3 | Classement des réponses FCM | `UNREGISTERED` → retrait du jeton, non rejouable ; `503` → rejouable |
| 4 | Mode du canal | les trois combinaisons clé / interrupteur |
| 5 | Cache du jeton d'accès | pas de réémission avant expiration moins 5 min ; réémission après |
| 6 | Un membre à plusieurs appareils | une ligne de journal **par appareil** |
| 7 | Troncature des titres | titre ≤ 65 caractères, corps ≤ 240, sans couper un mot en deux |

## 8. Recette manuelle

Elle exige un **vrai téléphone**. Pas de raccourci possible.

1. Android ou Chrome, PWA installée, permission accordée → déclencher une notification, et la
   recevoir **application fermée**.
2. Clic sur la notification → la bonne page s'ouvre, au bon dossier.
3. Désinstaller la PWA, déclencher à nouveau → le jeton est retiré de `appareils`, et le
   journal porte un `echec` non rejouable. **C'est ce test qui prouve le nettoyage.**
4. iPhone **sans** PWA installée → l'écran explique la marche à suivre, et ne laisse pas
   croire que c'est activé.
5. iPhone **avec** PWA installée → le push arrive.
6. Interrupteur `pushReelActive` fermé → les lignes passent en `simule`, et **rien n'échoue**.

## 9. Risques

| Risque | Parade |
|---|---|
| Le changement de service worker casse le mode hors ligne | Vérification obligatoire du §3 **avant** d'ajouter Firebase. `globPatterns` et `globIgnores` reportés à l'identique. |
| Deux service workers se disputent la portée racine | Un seul SW. `getToken({ serviceWorkerRegistration })`. **Pas de `firebase-messaging-sw.js`.** |
| La permission demandée au chargement, donc refusée pour toujours | Demande **sur clic**, jamais automatique. |
| Le compte de service qui fuite | Jamais dans le frontend, jamais dans le dépôt. `npx convex env set` seulement. |
| Des jetons morts qui font échouer chaque envoi | Retrait sur `UNREGISTERED` / `INVALID_ARGUMENT`, testé (cas 3) et recetté (étape 3). |
| Le propriétaire croit que les iPhone sont couverts | Écrit dans le §5, à redire de vive voix. |
| Un doublon : push **et** cloche en même temps, application ouverte | `onMessage` n'affiche **aucune** notification système. |

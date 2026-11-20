# Programme « Notifications & rappels » — les sept lots

> Arrêté le 6 novembre 2026, avec le propriétaire du projet.
> Branche de travail : **`notif`**, partie de `dev`.
> À lire après `LISEZMOI.md`.

---

## 1. Le besoin

La plateforme fait travailler une quarantaine de personnes sur des processus qui **passent de
main en main** : un bon de commande préparé par le comptable attend l'arbitrage de la
Direction, une demande d'intervention attend sa validation, un compte rendu attend la remarque
de son superviseur. Aujourd'hui, **rien ne prévient personne**. Le dossier avance quand
quelqu'un pense à aller voir.

Le programme corrige cela sur trois plans :

1. **Prévenir** — les personnes concernées par un événement l'apprennent, dans l'application
   et hors de l'application.
2. **Relancer** — un dossier qui dort est remonté tout seul, puis escaladé.
3. **Rappeler** — les échéances du quotidien (compte rendu, saisie financière, clôture de
   paie) sont rappelées à l'heure dite.

### Les trois canaux retenus

| Canal | Portée | Lot |
|---|---|---|
| **Cloche dans l'application** | instantané, pour qui a la plateforme ouverte. Gratuit : Convex est réactif | S1 + S2 |
| **WhatsApp** | atteint tout le monde, même sans la PWA installée. Via le **hub de notifications interne** de l'entreprise | S3 |
| **Push système (Firebase)** | réveille le téléphone application fermée | S4 |

### Les deux décisions d'architecture qui gouvernent tout

**L'adressage se déduit des droits, jamais d'une liste de rôles.** Un événement déclare
*le droit* qui le concerne (`/commandes/validation` → Faire) ; les destinataires sont les
membres qui ont ce droit, calculé par `droitsEffectifs()`. Le jour où le DG retire ce droit à
quelqu'un dans Paramètres → Rôles & accès, cette personne cesse d'être notifiée **sans que
personne ne reconfigure quoi que ce soit**. Pas de seconde liste à tenir, donc pas de dérive
silencieuse.

**Les canaux sont des transports interchangeables.** Le moteur ne connaît aucun fournisseur.
Il connaît une interface `Transport`. Le hub WhatsApp et Firebase en sont deux
implémentations, remplaçables sans toucher au moteur. C'est une exigence explicite du
propriétaire : le projet a déjà changé de fournisseur WhatsApp une fois (UltraMsg → hub
interne), et `convex/paiePdf.ts` paie aujourd'hui le prix d'avoir appelé UltraMsg en dur.

---

## 2. Les sept lots

```
                        ┌──────────────────────────────┐
                        │  S1 · Noyau                  │
                        │  événements, adressage, table │
                        └───┬───────┬───────┬──────┬───┘
                            │       │       │      │
              ┌─────────────┘       │       │      └──────────────┐
              ▼                     ▼       ▼                     ▼
    ┌──────────────────┐  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
    │ S2 · Centre      │  │ S3 · Hub     │ │ S5 · Rappels │ │ S6 · Services│
    │ cloche, écran    │  │ WhatsApp     │ │ relances,    │ │ routage par  │
    │ préférences      │  │ (transport)  │ │ échéances    │ │ service      │
    └──────────────────┘  └──────┬───────┘ └──────┬───────┘ └──────────────┘
                                 ▼                ▼
                        ┌──────────────┐  ┌──────────────┐
                        │ S4 · Firebase│  │ S7 · Pense-  │
                        │ push système │  │ bête         │
                        └──────────────┘  └──────────────┘
```

| Lot | Titre | Dépend de | Ce qu'il ajoute au schéma | Dépendance externe |
|---|---|---|---|---|
| **S1** | Noyau de notifications | — | table `notifications` | non |
| **S2** | Centre de notifications | S1 | champ `users.notifsSilencieuses` | non |
| **S3** | Transport et hub WhatsApp | S1 | table `envoisNotifications` | **oui — modèles Meta** |
| **S4** | Push système par Firebase | S1, S3 | table `appareils` | **oui — projet Firebase** |
| **S5** | Moteur de rappels | S1 | table `rappelsEmis` | non |
| **S6** | Routage par service | S1 | 4 champs (`users`, `services`, `commandes`, `interventions`) | non, mais assainissement de données |
| **S7** | Pense-bête personnel | S1, S5 | table `penseBetes` | non |

> **Les sept lots touchent `convex/schema.ts`.** Tous les ajouts sont **additifs** — nouvelles
> tables, nouveaux champs optionnels — donc sans migration et sans risque sur les données
> existantes. Mais chacun exige une **fenêtre de poussée Convex** convenue : voir §4.

**Ordre d'exécution : S1 → S2 → S3 → S4 → S5 → S6 → S7.**

Après S2, la plateforme notifie. Après S4, elle pousse vraiment. Après S5, elle relance toute
seule.

### Ce que chaque lot livre, en une phrase

- **S1** — le vocabulaire des événements, la table, et la fonction qui dit *qui* doit être
  prévenu. Aucune interface, aucun canal. C'est la spec qui fixe tout le reste : si elle est
  bancale, tout l'est.
- **S2** — ce que l'utilisateur voit : la cloche et son badge dans l'en-tête (**le bouton
  existe déjà, mort, à la ligne 129 de `src/components/Header.tsx`**), le panneau, l'écran
  d'historique, lu/non-lu, et les préférences par type.
- **S3** — l'interface `Transport`, le journal unifié des envois, et l'adaptateur du hub
  WhatsApp interne. Reprend au passage le courrier de paie, qui appelle UltraMsg en dur.
- **S4** — le vrai push : service worker maison, jetons d'appareil Firebase, envoi par FCM
  HTTP v1, et le parcours d'installation de la PWA.
- **S5** — un moteur, deux familles de déclencheurs : *délai dépassé* (dossier qui dort,
  verrou qui expire) et *calendrier* (16 h et 20 h pour les comptes rendus, journée financière
  non saisie, mois de paie non clôturé).
- **S6** — rattacher chaque membre à un service, désigner un responsable par service, et
  étendre l'adressage. Porte un chantier de données, pas seulement du code.
- **S7** — un membre se crée un rappel daté sur un dossier.

---

## 3. Les délais externes — à lancer MAINTENANT, en parallèle du développement

Deux lots dépendent de démarches qui ne sont pas du code et qui prennent du temps. **Elles
doivent partir avant que le développement du lot concerné commence**, sinon le lot attend.

> **Le mode opératoire complet est dans `DEMARCHES-EXTERNES.md`** : le message à envoyer à
> l'administrateur du hub, les commandes `convex env set`, le parcours Firebase écran par
> écran, et l'outil `outils/deposer-modeles.mjs` qui dépose les huit modèles et suit leur
> approbation. **Ces deux démarches sont à la charge du propriétaire, pas de l'agent** :
> elles exigent des identifiants et la création de comptes externes.

### Pour S3 — les modèles WhatsApp (jusqu'à 24 h de revue Meta, par modèle)

Le hub **n'envoie que des modèles approuvés par Meta. Le texte libre n'est pas supporté.**
Chaque type de notification qui doit partir sur WhatsApp exige donc son modèle, déposé via
`POST /template-requests/` puis validé par l'administrateur du hub, puis par Meta.

À demander à l'administrateur du hub **dès maintenant** :

- la création de l'application sur le hub, son identifiant (ex. `poitiers`) et son **préfixe
  de modèles** (ex. `poitiers_`) ;
- la **clé API** (`nhk_…`) et, si on veut les statuts en retour, le **secret de signature**
  (`whsec_…`) avec l'URL de rappel ;
- l'approbation des modèles listés dans `S3-HUB-WHATSAPP.md` §4.

> **Le choix des textes de modèles est une décision du propriétaire, pas de l'agent.** La spec
> S3 propose une rédaction pour chacun ; elle doit être relue et validée avant dépôt, car un
> modèle approuvé n'est pas modifiable — il faut en déposer un nouveau.

### Pour S4 — le projet Firebase

À fournir par le propriétaire :

- un projet Firebase avec **Cloud Messaging** activé ;
- la **configuration web** (`apiKey`, `authDomain`, `projectId`, `messagingSenderId`,
  `appId`) — ces valeurs sont publiques, elles vont dans le frontend ;
- la **clé VAPID publique** du Web Push, dans la console Firebase
  (Cloud Messaging → Web configuration → Web Push certificates) ;
- un **compte de service** (JSON) avec le rôle d'envoi FCM, qui sera posé en variable
  d'environnement Convex — **secret, jamais dans le dépôt**.

L'agent construit S4 de sorte qu'il fonctionne **en simulation** sans aucune de ces valeurs.
Le jour où elles arrivent, il n'y a qu'à les poser.

---

## 4. Les préalables techniques

- **La fenêtre de poussée Convex.** Les sept lots modifient `convex/schema.ts`. Un seul
  `convex deploy` part à la fois, et le chantier `rh` travaille en parallèle sur le même
  projet Convex — un push depuis deux branches écrase mutuellement le schéma. Chaque
  changement doit être annoncé et séquencé. Tous sont **additifs** (nouvelles tables,
  nouveaux champs optionnels) : aucune migration de données, aucun champ renommé ni supprimé.
- **Le service worker.** S4 fait sortir la PWA de la stratégie `generateSW` de Workbox vers
  `injectManifest` avec un service worker maison. C'est le **seul** changement du programme
  qui touche la chaîne de build. Il est isolé dans son lot pour cette raison.
- **Aucune dépendance npm nouvelle avant S4.** S1, S2, S3 et S5 se font avec ce qui est déjà
  installé. S4 ajoute `firebase` (frontend) et, côté serveur, signe son jeton avec `jose`
  (déjà présent dans `node_modules`) plutôt que d'ajouter le SDK Admin.

---

## 5. Ce que le programme ne fait pas

Dit explicitement, pour qu'aucun lot ne dérive :

- **Pas de messagerie interne.** Aucun fil de discussion, aucune réponse à une notification.
  Les commentaires de commandes, d'interventions et de comptes rendus existent déjà et
  restent où ils sont. Le hub WhatsApp ne lit d'ailleurs **aucune** réponse des utilisateurs.
- **Pas de notification par e-mail.** Resend est déjà câblé pour le courrier de paie et le
  code à usage unique ; l'étendre aux notifications n'a pas été demandé. L'interface
  `Transport` de S3 le rendra possible en un adaptateur, le jour où le besoin viendra.
- **Pas de refonte du journal d'audit.** On constatera en câblant S1 que `journalActivite` ne
  trace aujourd'hui **aucune** transition de commande, d'intervention ni de compte rendu. Le
  trou est réel pour un ERP qui manipule de l'argent, mais le journal et les notifications
  sont deux objets différents — l'un immuable et destiné à l'audit, l'autre adressé,
  périssable et marquable comme lu. S1 dimensionne l'objet événement pour qu'une entrée de
  journal soit ensuite triviale à ajouter, et s'arrête là. **Noté au backlog, hors
  programme.**
- **Pas de notification des clôtures de paie ni du financier** dans S1. Ce sont des
  informations, pas de la collaboration, et elles ajouteraient des points d'émission dans les
  modules les plus sensibles du code. Une ligne au catalogue les fera entrer plus tard.
- **Pas de consentement marketing.** Toutes les notifications de ce programme sont
  transactionnelles (catégorie `UTILITY` chez Meta) : elles informent sur un dossier existant.
  Le hub exige un consentement enregistré pour la catégorie `MARKETING` uniquement — on n'y
  touche pas.

---

## 6. Suivi

| Lot | État | Livré le | Remarques |
|---|---|---|---|
| S1 · Noyau | livré | 2026-11-20 | 13 types, 10 points d'émission (dont auth.ts), index by_lu_date ajouté pour la purge |
| S2 · Centre | livré | 2026-11-20 | Cloche réactive, panneau 15 récentes, écran /notifications et préférences |
| S3 · Hub WhatsApp | livré (simulation) | 2026-11-20 | Mode simulation actif ; en attente des modèles Meta et clés hub. Migration paiePdf.ts (UltraMsg/PDF) laissée ouverte (§10) |
| S4 · Firebase | livré (simulation) | 2026-11-20 | SW unique injectManifest (src/sw.ts), FCM HTTP v1 via jose, guide iOS PWA ; en attente du projet Firebase |
| S5 · Rappels | livré | 2026-11-20 | Crons Douala UTC+1, relance/escalade 24/48/72 h, rappels verrous financier & caisse |
| S6 · Services | livré | 2026-11-20 | Routage responsable de service (repli sur services.chefs[0]) ; assainissement données Membres/Services à finaliser en prod |
| S7 · Pense-bête | livré | 2026-11-20 | Table penseBetes, cron 15 min, onglet Mes rappels et composant BoutonPenseBete |

L'agent met cette table à jour à chaque livraison, et consigne dans la colonne « Remarques »
tout écart entre la spec et ce qui a été fait.

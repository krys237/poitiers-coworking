# Programme « Notifications & rappels » — brief de l'agent exécutant

> **Lis ce fichier en entier avant toute chose.** Tu arrives sans contexte sur un projet qui
> en a beaucoup. Ce document te donne ce qu'il faut pour travailler sans casser l'existant ;
> `PROGRAMME.md` te donne l'ordre des lots ; les fichiers `S1-*.md` à `S7-*.md` sont les
> spécifications, une par lot.

---

## 1. Ta mission

Mettre en place un système de **notifications** et de **rappels** dans une plateforme de
gestion administrative et de paie déjà en production. Objectif métier, dans les mots du
propriétaire :

> « Lorsqu'un membre demande un service, effectue une opération ou initie un processus qui
> demande validation, les services concernés doivent être au courant. »

Le programme est découpé en **sept lots indépendants et ordonnés** (S1 → S7). Chaque lot a sa
spec, son périmètre fermé et sa propre recette. **Tu implémentes un lot à la fois, dans
l'ordre.** Ne commence jamais un lot dont les dépendances ne sont pas livrées.

---

## 2. Ce qu'est cette application

**POITIERS COWORKING** — plateforme de gestion de la Polyclinique de Poitiers (Cameroun,
devise FCFA) : approvisionnement, trésorerie, interventions techniques, comptes rendus
quotidiens du personnel, et un moteur de paie complet. Une vingtaine d'écrans, une
quarantaine de membres.

### Pile technique

| | |
|---|---|
| Frontend | React 18 + TypeScript + Vite, en PWA installable (`vite-plugin-pwa`) |
| Backend et base | **Convex** — base réactive : toute query est un abonnement live |
| Authentification | Convex Auth (mot de passe, et code à usage unique par e-mail) |
| Hébergement | Vercel (frontend) + Convex (backend) |
| Styles | Tailwind CSS 4 + composants locaux inspirés de shadcn (`src/components/ui/`) |
| Tests | `node --experimental-strip-types` sur la logique **pure** (aucun framework de test) |

Le dossier de travail est **`app/`**. Tout chemin cité dans les specs part de là, sauf mention
contraire.

### Ce que « Convex est réactif » change pour toi

Une `query` Convex n'est pas un appel ponctuel : c'est un **abonnement**. Quand une mutation
écrit une ligne, toutes les queries qui en dépendent se recalculent et les écrans abonnés se
rafraîchissent — sans code de rafraîchissement, sans WebSocket à écrire, sans `refetch`.

Conséquence directe pour ce programme : **une notification affichée dans l'application n'a
besoin d'aucun transport.** Il suffit d'écrire une ligne dans une table ; le badge de la
cloche se met à jour tout seul chez le destinataire. Le « push » au sens réseau ne sert qu'à
atteindre quelqu'un **qui n'a pas la plateforme ouverte** — c'est l'objet des lots S3 et S4,
pas du lot S1.

Corollaire à ne jamais oublier : une query coûteuse coûte cher **en permanence**, pas une
fois. Le projet porte déjà une cicatrice sur ce point, documentée au §6.

---

## 3. Le modèle de droits — la pièce la plus importante à comprendre

**Ne code jamais un contrôle d'accès toi-même. Tout passe par le modèle existant.**

`convex/rbac.ts` est la **source unique** des droits. Il déclare :

- **8 rôles** avec un *niveau* : `employe` 1, `chef_equipe` 2, `comptable` 3,
  `gestionnaire_rh` 4, `da1` (Directeur Administratif / DAF) 5, `dg` 7, `super_admin` 8
  (technique), et `auditeur_externe` 0 (hors hiérarchie).
- **une trentaine de modules** (`MODULES`), chacun identifié par une clé qui ressemble à une
  route (`/commandes`, `/commandes/validation`, `/interventions`, `/paie/bulletins`…), avec
  deux droits : **Voir** (consulter) et **Faire** (saisir, valider, envoyer).
  *Faire implique Voir.*

### Le point crucial

**Le niveau du rôle ne donne que les droits *par défaut*.** Le Directeur Général remanie la
matrice quand il veut, dans Paramètres → Rôles & accès :

```
défaut du rôle   →   surcharge du rôle   →   exception par personne   →   garde-fous
celluleParDefaut     parametresEntreprise     users.droitsPerso           estVerrouille
                     .droitsRoles
```

`droitsEffectifs(role, surcharges, exceptions)` calcule le résultat. Cette fonction est
**pure** et partagée par le serveur et l'écran — c'est elle qui fait autorité.

### Les règles absolues

1. **Côté serveur**, toute query et toute mutation métier commence par
   `requireDroit(ctx, "/module", "voir" | "faire")` (ou `requireUnDesDroits`).
   **Jamais `requireLevel` sur une fonction métier** — c'est l'ancien modèle, il ne subsiste
   que pour les fonctions techniques.
2. **Côté écran**, on lit `me.droits` : `usePeut(module, action)`, `<SiDroit module=…>`,
   `<Guard perm=…>`. Masquer un bouton n'est **pas** une sécurité ; le contrôle réel est au
   serveur. Le masquage évite seulement de proposer une action qui échouerait.
3. **Tout nouvel écran exige une entrée dans `rbac.MODULES`.** Une route absente de la matrice
   est refusée à **tout le monde**, Directeur Général compris.
4. **Ce programme n'invente aucun droit nouveau**, sauf là où une spec le dit explicitement.

### Pourquoi ça gouverne les notifications

L'adressage d'une notification se **déduit des droits**, jamais d'une liste de rôles écrite en
dur. Le jour où le DG retire `/commandes/validation` au comptable, le comptable doit cesser
d'être notifié **sans que personne ne reconfigure quoi que ce soit**. C'est l'esprit de tout
le programme : une seule source de vérité.

---

## 4. Les règles de travail — à respecter sans exception

### Branche et arbre de travail

Le dépôt utilise des **worktrees Git** : plusieurs dossiers, plusieurs branches sorties en
même temps, un seul historique.

| Branche | Rôle |
|---|---|
| `clean` | **production** — on n'y code JAMAIS directement |
| `dev` | **recette** — branche d'intégration, où sont déroulés les tests terrain |
| `rh` | chantier paie en cours, mené par quelqu'un d'autre — **n'y touche pas** |
| `notif` | **ta branche**, partie de `dev` |

**Tu travailles exclusivement sur `notif`.** Ne fais jamais `git checkout` d'une autre branche
dans ton dossier : tu arracherais les fichiers sous les pieds d'un autre. `git worktree list`
dit qui occupe quoi.

Cycle de remontée, impératif : **`notif` → `dev` → validation en recette → `clean`**. Tu
n'effectues pas la remontée toi-même ; tu livres sur `notif` et tu le signales.

### Le déploiement Convex, à ne jamais déclencher à l'aveugle

Il n'existe **qu'un projet Convex** partagé (déploiement de dev : `wonderful-shark-673`). Un
`npx convex deploy` pousse **tout** le dossier `convex/`, **schéma compris** : deux personnes
qui poussent depuis deux branches écrasent mutuellement leur schéma.

- **Ne lance jamais `npx convex deploy` de ta propre initiative.**
- `npx convex dev` ne doit tourner que dans **un seul dossier à la fois** (deux instances se
  poussent en boucle l'une sur l'autre).
- **Les sept lots modifient `convex/schema.ts`** (nouvelle table ou nouveau champ optionnel).
- Ajouter une table est **additif** : aucune migration, aucun risque sur l'existant. C'est le
  cas de tous les changements de schéma de ce programme. Ne renomme ni ne supprime **jamais**
  un champ existant sans consigne écrite.

### La procédure de poussée du schéma, à suivre à la lettre

Le danger n'est pas le contenu du changement, c'est la **concurrence** : un `deploy` parti de
`notif` écrase le schéma de `rh`, et inversement. D'où ces quatre étapes, à chaque lot qui
touche `schema.ts` :

1. **Vérifie que personne n'a de travail en cours** :
   ```bash
   git worktree list                              # qui occupe quoi
   git -C ../poitiers-coworking-rh status --short  # doit être VIDE
   ```
2. **Reporte `dev` sur `notif`** (`git merge dev`) pour partir du schéma le plus à jour.
   Si `rh` a été fusionné dans `dev` entre-temps, c'est ainsi que tu récupères ses tables.
3. **Annonce la poussée** au propriétaire et attends son accord. C'est lui qui sait si un
   autre chantier est en vol.
4. **Après la poussée**, dis-le : l'autre chantier doit reporter `dev` avant son prochain
   `deploy`.

> **État au 6 novembre 2026** : l'arbre `rh` est **propre** (commit `cf5b265`, rien en cours).
> La fenêtre est donc ouverte — c'est le bon moment pour pousser le schéma de S1. Revérifie
> quand même avec les commandes de l'étape 1 : cette note vieillira.

### Secrets

- Une clé posée dans `app/.env.local` **n'est PAS vue par les fonctions Convex**. Les
  variables serveur se posent avec `npx convex env set`.
- Ne fais jamais transiter une valeur de clé par la conversation, par un commit ou par la
  ligne de commande en clair.
- **Piège Convex vérifié** : `convex/auth.config.ts` est analysé statiquement au push, et
  toute référence à une variable d'environnement **non définie** fait échouer le déploiement —
  plus aucune fonction, page blanche côté client. Dans une *fonction* en revanche,
  `process.env.MACHIN` est permis même si la variable est absente : c'est ce qui rend les
  modes « simulation » possibles.

### Mode simulation — le patron de la maison

Tout canal sortant du projet fonctionne déjà ainsi, et tes lots S3 et S4 doivent s'y plier :

> Un canal est **réel** si sa clé d'environnement est présente **et** si son interrupteur est
> ouvert dans Paramètres → Fonctionnement. Sinon il est **simulé** : le journal des envois est
> alimenté avec le statut `simule`, aucun appel réseau ne part, et **rien n'échoue**.

C'est ce qui permet de développer et de recetter sans compte externe. Modèles à lire :
`convex/paiePdf.ts` (`envoyerCourrier`) et `convex/lib/reglages.ts`.

---

## 5. Conventions de code — observe puis imite

Le dépôt a des habitudes fortes. Les suivre n'est pas cosmétique : c'est ce qui rend le code
relisable par le propriétaire.

### Langue

**Tout est en français** : noms de fonctions, de variables, de champs de base, commentaires,
messages d'erreur, libellés d'écran — `enregistrer`, `destinataires`, `verrouSaisie`,
`moisCloture`. Les seules exceptions sont les mots imposés par une bibliothèque.

Les commentaires expliquent **pourquoi**, avec la date de la décision quand il y en a une :

```ts
// Décision du 13/10/2026 : sans cette case, « Voir » se limite aux demandes
// déposées par la personne. Retour terrain : un employé voyait toutes les
// interventions de la plateforme.
```

### Organisation

```
app/convex/
  schema.ts             # LE modèle de données — source de vérité des entités
  rbac.ts               # rôles, niveaux, modules, droits — source unique des accès
  crons.ts              # tâches planifiées — exporte par défaut cronJobs()
  http.ts               # routes HTTP publiques (API, webhooks)
  lib/                  # logique PURE, sans import serveur, testable isolément
    authz.ts            # requireDroit, getCurrentUser, droitsDuMembre
    journal.ts          # journaliser() — le journal d'audit
    reglages.ts         # réglages de fonctionnement (Paramètres → Fonctionnement)
    telephone.ts        # numéros : indicatif pays TOUJOURS présent
    fenetre.ts          # dateDouala(), fenêtre horaire des comptes rendus
  <module>.ts           # queries, mutations, actions d'un domaine
app/src/
  App.tsx               # table des routes, chacune gardée par <Guard perm>
  components/Layout.tsx # menu latéral filtré par me.droits
  components/Header.tsx # en-tête
  components/ui/        # primitives (button, card, table, dialog, flag…)
  components/app/       # composants métier transverses
  pages/                # un fichier par écran
  auth/useMe.tsx        # useMe, usePeut, SiDroit — le contrat d'accès côté écran
app/tests/              # suites de logique pure
```

**La règle d'or : la logique métier calculable va dans `convex/lib/`, pure, et elle est
testée.** Les fichiers `convex/<module>.ts` ne font que lire la base, appeler la logique pure,
et écrire. C'est ce qui rend ce projet testable sans base de données.

### Règles Convex à connaître

- Un fichier annoté `"use node"` ne contient **que des actions**. Les queries et mutations
  restent dans les fichiers V8 et sont appelées via `ctx.runQuery` / `ctx.runMutation`.
  **Annote le type de retour des actions** : les types deviennent circulaires sinon.
- Ne mets **jamais** de fichier de test dans `convex/` : tout ce dossier est bundlé comme
  fonctions.
- `httpAction` n'a **pas** de `ctx.db` → passe par `internal.*`.
- `convex/crons.ts` doit exporter par défaut `cronJobs()`.
- Un ré-export `export { x } from "./autre"` enregistre bien la fonction sous le module qui
  ré-exporte.
- `ctx.scheduler.runAfter` / `runAt` depuis une mutation est **transactionnel** : la tâche
  n'est planifiée que si la mutation commet. C'est un atout, utilisé par tout ce programme.

### Tests

Pas de Vitest, pas de Jest. Un fichier par domaine dans `app/tests/`, lancé par un script :

```json
"test:notifications": "node --experimental-strip-types tests/notifications.test.ts"
```

Les libs pures importées par un test doivent importer leurs dépendances **avec l'extension
`.ts`**, et utiliser `import type` pour les types (`convex/tsconfig.json` a
`allowImportingTsExtensions`). N'installe **pas** de hook de résolution : `module.register`
plante à la sortie sous Windows.

Ajoute chaque script à `package.json` **et** à la liste des suites de `.gitlab-ci.yml`.

### Interface et charte

La charte visuelle « Ocean Breeze » est décrite dans
`.agents/skills/poitiers-ui-ux-system/SKILL.md` **à la racine du dépôt**. Lis-la avant de
toucher à un écran (lot S2 surtout). L'essentiel :

- Palette : `--ocean-nuit #03045e`, `--ocean-profond #0077b6`, `--ocean-ceruleen #00b4d8`,
  `--ocean-ciel #90e0ef`, `--ocean-brume #caf0f8`, `--papier #f6f9fb`, `--filet #e2e8f0`.
- Les chiffres sont toujours en `font-mono tabular-nums`, milliers séparés par une espace
  **insécable**, via les helpers de `src/lib/format.ts` (`num`, `fcfa`, `pct`, `jours`).
  **Jamais `toLocaleString`** : son espace fine U+202F est illisible en colonne et non
  encodable en PDF.
- Les pastilles de statut passent par `components/ui/flag.tsx`. **Aucune puce ronde de
  couleur** (`●`) : interdiction formelle de la charte.
- C'est un ERP : **un tableau ne fait jamais défiler la page**, il défile seul
  (`<Table hauteurMax={…}>`), et l'utilisateur choisit son nombre de lignes visibles.
- Un zéro réel s'affiche `0` en gris pâle ; une valeur non applicable, par un tiret cadratin
  `—`. Un champ numérique est **vide** avec un `0` en placeholder, jamais un `0` en dur.

### Montants

Toujours des **entiers FCFA**. Aucune décimale, jamais.

---

## 6. Les pièges de ce dépôt, payés comptant

Ces points sont tirés de l'historique du projet. Les ignorer refait les mêmes dégâts.

1. **La requête dans la boucle.** `comptesRendus.vueSuperviseur` fait une requête par membre
   actif et collecte tout l'historique de chacun à chaque affichage. L'écran reste fluide
   aujourd'hui, mais le coût croît comme *nombre de membres × nombre de comptes rendus*, sans
   borne. **Ne reproduis jamais ce schéma.** Lis une fois, calcule en mémoire. Le même défaut
   existe en plus discret dans `convex/commandes.ts` (`derniersAchats`).
2. **`.collect()` non borné.** Collecter une table entière à chaque chargement passe en
   recette et tombe en production. Indexe, borne, ou agrège.
3. **Le repli silencieux.** Il n'existe **plus aucune URL Convex codée en dur** dans
   `src/main.tsx` : variable absente → écran « Erreur de configuration ». C'est voulu. Un
   repli silencieux avait fait tourner toute une campagne de recette sur la mauvaise base sans
   que rien ne le signale. **Ne réintroduis jamais de valeur de repli sur une URL ou une
   clé.** Échoue bruyamment.
4. **L'erreur de rendu qui efface l'écran.** Une query qui lève pendant le rendu faisait une
   page blanche sans un mot. Chaque route est maintenant enveloppée d'un `<ErrorBoundary>`.
   Garde ce filet.
5. **Les polices PDF n'encodent que Latin-1.** Si tu touches à un PDF, passe par le `clean()`
   de `convex/paiePdf.ts` (tirets longs, points de suspension, espaces fines).
6. **`/tmp` n'existe pas** sous Git Bash + Node Windows. Utilise des variables shell.

---

## 7. Définition de « terminé », pour chaque lot

Un lot n'est livré que si **tout** ceci est vrai :

- [ ] `npm run typecheck` passe, sans erreur ajoutée.
- [ ] `npm run build` passe.
- [ ] La suite de tests du lot passe, et **toutes** les suites existantes passent encore.
- [ ] Aucun `requireLevel` ajouté sur une fonction métier ; tout accès passe par
      `requireDroit`.
- [ ] Aucun contrôle d'accès dupliqué dans un composant.
- [ ] Tout nouveau module d'accès est déclaré dans `rbac.MODULES`, et toute nouvelle route
      dans `App.tsx` **et** dans `MODULES`.
- [ ] Tout canal sortant fonctionne en **mode simulation** sans sa clé, et n'échoue pas.
- [ ] Aucune clé, aucun secret, aucune donnée réelle dans le code ou dans un commit.
- [ ] Les commentaires disent *pourquoi*, en français.
- [ ] Un commit par lot cohérent, message en français, à l'impératif, forme
      `feat(notifications): …` / `fix(notifications): …`.
- [ ] Ce que tu n'as pas pu faire est **écrit** et signalé, pas passé sous silence.

---

## 8. Ce que tu ne fais pas

- Tu ne remontes pas sur `dev` ni sur `clean`.
- Tu ne lances pas `npx convex deploy`.
- Tu ne touches ni à la branche `rh`, ni au moteur de paie (`convex/lib/paie.ts`,
  `calculBulletins.ts`, `payroll.ts`, `bareme.ts`), ni au grand livre financier
  (`convex/financier.ts`) — sauf la ligne d'émission exacte que S1 et S5 te demandent
  d'ajouter.
- Tu ne refactores rien qui ne serve pas le lot en cours.
- Tu ne crées aucun compte externe (Meta, Firebase, hub de notifications). Tu prépares
  l'architecture ; la connexion est faite par le propriétaire.
- Tu n'inventes aucune règle métier. Si une spec est ambiguë, **tu poses la question et tu
  avances sur le reste** — tu ne tranches pas à la place du propriétaire.

---

## 9. Où trouver quoi

| Sujet | Fichier |
|---|---|
| Ordre des lots, dépendances, délais externes | `PROGRAMME.md` |
| Spécifications | `S1-NOYAU.md` … `S7-PENSE-BETE.md` |
| Démarches du propriétaire (hub, Firebase) — **pas de ton ressort** | `DEMARCHES-EXTERNES.md` |
| Dépôt et suivi des modèles WhatsApp | `outils/deposer-modeles.mjs` |
| Contrat d'API du hub WhatsApp | `reference/HUB-WHATSAPP-API.md` |
| Guide technique du dépôt | `app/CLAUDE.md` |
| Journal des décisions du propriétaire (daté) | `app/DECISIONS.md` |
| État du projet, reste à faire | `ETAT-DU-PROJET.md` (racine) |
| Règles de travail à plusieurs | `app/CONSIGNES-MULTI-AGENTS.md` |
| Charte visuelle et règles d'écran | `.agents/skills/poitiers-ui-ux-system/SKILL.md` |
| Failles et risques déjà recensés | `app/REVIEW-SECURITE-PROCESSUS.md` |

Lis `app/CLAUDE.md` et `app/DECISIONS.md` avant de commencer S1. Le reste au besoin.

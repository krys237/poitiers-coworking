# Passation — agent DÉPLOIEMENT

> Rédigé le 09/11/2026 par l'agent déploiement sortant. Ce document doit suffire : il décrit
> l'architecture réelle (celle des dashboards, invisible dans le dépôt), le chantier en cours, les
> pièges déjà payés et ce qui reste ouvert. Lire **en entier** avant de toucher à un déploiement.
>
> Compléments : `CLAUDE.md` § « Déploiement du frontend (Vercel) », `DECISIONS.md`,
> `../ETAT-DU-PROJET.md`, `CONSIGNES-MULTI-AGENTS.md`.

---

## 1. L'état en une page

| | |
|---|---|
| **Production** | `poitiers-clean.vercel.app` ← branche `clean` ← Convex `focused-chipmunk-580` |
| **Recette** | `poitiers-coworking.vercel.app` ← branche `dev` ← **backend mort**, voir § 4 |
| **Chantier RH** | branche `rh`, jamais exercée contre des données |
| `clean` | `03c2662` — à jour, saine |
| `dev` | `bdc66f8` + **un merge de `clean` préparé en local, non poussé** (§ 5) |
| `rh` | `origin/rh` = `47433f3`, mais le worktree porte `77876d1` **non poussé** |

**La production contient de vraies données** : employés, bulletins, grand livre financier. Toute
écriture y est une opération comptable, pas un test.

---

## 2. L'architecture réelle

### Vercel — un seul projet

`poitiers-coworking` · `prj_TtexxveKWhx1c8iOuAeOO7aP4ha2` · équipe `team_1n3FgfshLEq0LzpOVXuBXoN9`
Dépôt GitHub `krys237/poitiers-coworking` · **Root Directory `app`** · Production Branch **`clean`**

Domaines : `poitiers-clean.vercel.app` suit la production ; `poitiers-coworking.vercel.app` est
attaché à la branche `dev` (champ *Git Branch* du domaine).

### Convex — deux projets, équipe `krystobalflynn` (id 532704)

| Projet | Production | Développement |
|---|---|---|
| `coworking_app` | **`focused-chipmunk-580`** — vraies données | `wonderful-shark-673` |
| `coworking_recette` | `coordinated-clam-865` — **jamais déployé** | `animated-quail-203` |

### Le build déploie le backend avec le frontend

`app/vercel.json` :

```
npx convex deploy --cmd 'npm run build' --preview-run 'seed:initialiser'
```

`convex deploy --cmd` **injecte lui-même `VITE_CONVEX_URL`** dans le build : le frontend parle
toujours au backend qu'il vient de déployer. **Ne jamais remettre de `VITE_CONVEX_URL` à la main**
dans Vercel — deux sources de vérité, et la divergence revient.

`--preview-run` ne s'exécute que sur un déploiement de preview ; il est ignoré en production.

### `CONVEX_DEPLOY_KEY` — trois entrées, même nom, portées différentes

| Portée | Valeur |
|---|---|
| Production | clé **production** de `coworking_app` |
| Preview, toutes branches | clé **preview** de `coworking_recette` |

Une entrée attachée à la branche `dev` a existé puis été supprimée : voir le piège n° 3.

### Prérequis sur chaque déploiement Convex visé

`JWT_PRIVATE_KEY`, `JWKS`, `SITE_URL`. Absentes, l'application se charge et reste
**silencieusement déconnectée**. Pour les déploiements créés à la demande, elles viennent des
**Default Environment Variables** du *projet* Convex (Project Settings, pas les réglages d'un
déploiement) et ne s'appliquent qu'aux déploiements **nouvellement créés**.

---

## 3. Le cycle, impératif

```
rh  →  dev  →  validation en recette  →  clean
```

Qualifié d'impératif par le propriétaire. **Jamais directement sur `clean`.**

L'agent sortant l'a enfreint six fois (§ 5) pour des correctifs comptables urgents. C'est
défendable au cas par cas et c'est exactement ce qui a fait diverger la recette de la production.

---

## 4. CHANTIER EN COURS — donner un backend durable à la recette

**Décision du propriétaire du 09/11 : on abandonne le backend de recette éphémère.**

### Le problème

Les déploiements Convex de **preview** sont ramassés après une période d'inactivité. C'est arrivé
**deux fois** :

- `chatty-gull-360` — créé le 22/10, mort après 11 jours
- `vivid-okapi-830` — créé le 02/11, mort après 7 jours (constaté le 09/11, HTTP 404 sur tout)

Le frontend ayant son URL **gravée au build**, il interroge une adresse morte : l'application reste
sur son écran de chargement, indéfiniment. Les données de recette disparaissent avec le
déploiement, et son nom change à la recréation.

### La solution retenue

Un **second projet Vercel** où `dev` est la branche de production. La recette devient alors un
build *production*, une clé Convex de **production** y est acceptée, et elle déploie sur
`coordinated-clam-865` — un déploiement de production, jamais ramassé.

### Les étapes, à faire dans le dashboard

1. Vercel → *Add New* → *Project* → importer `krys237/poitiers-coworking`, nom `poitiers-recette`,
   **Root Directory `app`**
2. Sur l'écran d'import, ajouter **`CONVEX_DEPLOY_KEY`** = clé **production** de
   `coworking_recette`
3. Déployer — ce premier build part de `main`, c'est un jetable
4. **Settings → Git → Production Branch = `dev`** *(réglable uniquement là : ni l'API ni la CLI ne
   l'exposent)*
5. Déplacer le domaine `poitiers-coworking.vercel.app` du projet actuel vers celui-ci
6. Sur l'ancien projet, supprimer l'entrée Preview de `CONVEX_DEPLOY_KEY` devenue inutile

Puis pousser `dev` (§ 5) : le build déploiera sur `coordinated-clam-865`.

### Après le premier déploiement

La base sera vierge. Dans cet ordre :

1. **Créer le compte administrateur** :
   `npx convex run --prod seed:initialiserAdmin '{"email":"…","motDePasse":"…"}'`
   *(cibler le bon déploiement ; la garde se referme dès qu'un compte existe — voir piège n° 6)*
2. Écran **Planning annuel** → bandeau → « Initialiser 2026 » (jours fériés), puis
   « Créer les services ». Le planning refuse un congé sans eux.

---

## 5. Le report des 6 commits sur `dev` — préparé, NON poussé

`dev` était en retard de six commits sur `clean`, tous poussés directement en production :

```
03c2662  feat(pwa)        icônes PWA et logo Cowork en façade
eec27b6  chore(assets)    les trois formes du logo
03e5da9  feat(financier)  ligne Carte Visa retirée du bloc POITIERS
81f9413  fix(financier)   imputation Visa du 15/10
b6801e1  fix(financier)   imputation Visa des cinq journées d'octobre
b9c9a8e  fix(financier)   date invalide refusée à l'écriture, purge des séquelles
```

Le merge `clean` → `dev` est **fait dans le worktree `C:\test\Js\poitiers-coworking-dev`**, avec le
seul conflit résolu (`app/DECISIONS.md`, deux entrées ajoutées en parallèle — les deux conservées,
dans l'ordre chronologique). **Il reste à commiter, valider et pousser.**

> Ce worktree n'a **pas** de `node_modules`. Pour y valider : créer une jonction Windows vers celui
> du worktree principal, comme le worktree `rh` en possède une
> (`app/node_modules` → `C:\test\Js\poitiers-coworking\app\node_modules`).

**Ne pas pousser `dev` avant que le projet Vercel du § 4 existe** : sinon le build recrée un
déploiement de preview éphémère qui mourra encore.

### Et surtout : ne pas fusionner `dev` → `clean` tout de suite

Le propriétaire l'a demandé le 09/11, l'agent sortant s'y est opposé pour trois raisons concrètes :

1. **`dev` n'est pas « clean + RH testé », c'est « clean + RH jamais exercé ».** Aucun écran RH n'a
   tourné contre des données réelles — l'agent RH l'a écrit lui-même. Ce qui est garanti : le
   typecheck, le build, et la logique pure.
2. **Les migrations sont inappelables.** `employes:migrerRattachements` et
   `employes:migrerSalaireBase` sont des `mutation` **publiques** gardées par `requireDroit`, sans
   interface et inaccessibles au CLI (`convex run` n'a pas de session). La production recevrait le
   nouveau modèle **sans moyen de convertir les fiches existantes**. À corriger avant toute
   fusion : leur donner un bouton dans l'écran Employés, ou les passer en `internalMutation` comme
   `users:restaurerRole`.
3. **Le renommage `salaireBrut` → `salaireBase`** exige trois temps sur une base peuplée : pousser
   le schéma avec les **deux** champs optionnels, lancer `employes:migrerSalaireBase`, puis
   seulement retirer l'ancien champ. L'ordre inverse fait rejeter les fiches par Convex.

---

## 6. Les onze pièges, tous payés et vérifiés

1. **Les déploiements Convex de preview sont éphémères.** § 4. Symptôme : chargement perpétuel.
   Diagnostic : `curl` sur le backend → 404 sur tout, corps vide.

2. **Une clé Convex de *développement* en portée Production** déploie sur le déploiement de dev et
   l'annonce `[Development]` dans les logs de build. **Le build réussit** et le frontend se branche
   au mauvais backend. Toujours vérifier la bannière du log : `[Production]` / `[Preview]` /
   `[Development]`, puis la ligne « Deployed Convex functions to … ».

3. **Convex refuse une clé de *production* dans un build non-production** :
   « Detected a non-production build environment ». La branche de production étant `clean`, tout
   build de `dev` est un *preview* — d'où l'obligation d'une clé preview, d'où le ramassage. Un
   drapeau caché `--check-build-environment` existe ; l'agent sortant a refusé de l'utiliser, il
   affaiblirait le garde-fou pour **tous** les builds, production comprise, et c'est lui qui a
   rattrapé le piège n° 2.

4. **`convex env set` et les valeurs commençant par `--`.** `JWT_PRIVATE_KEY` débute par
   `-----BEGIN PRIVATE KEY-----` : la CLI la prend pour une option et échoue. Il faut le séparateur
   de fin d'options : `convex env set --prod -- NOM "valeur"`.

5. **Pas de rotation en recouvrement des clés JWT.** `@convex-dev/auth` signe sans `kid`
   (`.setProtectedHeader({ alg: "RS256" })`), donc publier deux clés publiques rend la sélection
   ambiguë. Il faut remplacer la paire, et dans cet ordre : **`JWT_PRIVATE_KEY` d'abord, `JWKS`
   ensuite**, dans une seule invocation. Ainsi l'ancienne clé publique reste publiée pendant la
   fenêtre et les sessions ouvertes continuent de vérifier. L'ordre inverse coupe tout le monde.
   Les clients se réauthentifient ensuite seuls via leur jeton de rafraîchissement, validé en base
   et non cryptographiquement.

6. **`requireLevelOuAmorcage` teste `authAccounts`, pas `users`.** `seed:initialiser` crée un membre
   « dev » identifié par un jeton, **sans identifiant de connexion** : tester l'existence d'un
   membre concluait que l'amorçage était fini sur un déploiement où personne ne pouvait entrer. Ne
   pas revenir en arrière sur ce test.

7. **Les écritures sur l'API Vercel sont refusées** par le classificateur de sécurité du harnais.
   Et de toute façon la Production Branch et les domaines ne sont réglables que dans le dashboard.
   Les **lectures** passent (`/v9/projects`, `/v6/deployments`, `/v2/deployments/<id>/events`).

8. **Le jeton de la CLI Vercel expire souvent** (`invalidToken`). Le symptôme trompeur : un guetteur
   qui boucle et conclut à tort au TIMEOUT. **Toujours faire remonter l'erreur HTTP**, ne pas
   l'avaler dans un `|| echo "?"`. Relance : `npx vercel login`.
   Le jeton se lit dans `%APPDATA%/com.vercel.cli/Data/auth.json`.

9. **Le rewrite SPA avale les 404.** `vercel.json` renvoie `index.html` pour tout chemin inconnu :
   un asset manquant répond **200 avec `text/html`**, le navigateur se plaint du type MIME et
   personne ne comprend. Correctif proposé, **non appliqué** :
   `"source": "/((?!api/|assets/).*)"`.

10. **Le service worker pré-cache `manifest.webmanifest`** et les icônes. Après un déploiement, un
    client installé sert l'ancien `index.html` et l'ancien manifeste — d'où des 404 d'assets et un
    manifeste « sans icônes » dans DevTools. **`Ctrl+Shift+R` ne suffit pas** : le rechargement
    forcé contourne le cache HTTP mais pas le service worker. Il faut
    *Application → Service Workers → Unregister* puis *Clear site data*. Et Chrome sous Windows
    grave l'icône du raccourci au moment de l'installation : désinstaller et réinstaller.

11. **Windows.** `/tmp` de Git Bash n'est pas celui de Node (`C:\tmp`) : passer des chemins absolus
    ou piper dans `node` via stdin. Le `cwd` du shell **revient au répertoire principal entre deux
    appels** : préfixer chaque commande d'un `cd`. Les scripts qui ont besoin d'une dépendance du
    projet doivent être déposés sous `app/node_modules/` pour que la résolution fonctionne.

---

## 7. Les trois incidents causés par l'agent sortant

Consignés pour que le suivant ne les refasse pas, et parce qu'une passation qui ne dit que les
réussites ne sert à rien.

**22/10 — coupure d'authentification en production, ~1 minute.** Rotation des clés JWT : la pose de
`JWT_PRIVATE_KEY` a échoué silencieusement (piège n° 4) tandis que `JWKS` est passé. La production
s'est retrouvée avec la nouvelle clé publique et l'ancienne privée : plus rien ne vérifiait.
Correction par le séparateur `--`. **Leçon : tester la syntaxe sur une variable sans conséquence
avant de toucher la production.**

**22/10 — recette verrouillée.** En fermant `seed:initialiserAdmin` (faille critique réelle), la
garde d'amorçage est devenue infranchissable sur un déploiement neuf (piège n° 6). Corrigé par
`a35e3b9`.

**06/11 — clé privée de production exposée.** Un masquage défectueux (`sed 's/=.*/…/'` sur une
valeur **multi-ligne**) a affiché `JWT_PRIVATE_KEY` en clair. La clé a été rotée le 22/10 puis à
nouveau ; celle en service n'a jamais transité par une conversation. **Leçon : ne jamais faire
passer une valeur de clé par la ligne de commande ni par un affichage — la lire d'un fichier dans
une variable shell, et filtrer les sorties en remplaçant la valeur connue, pas en espérant qu'un
motif la couvre.**

---

## 8. Ce qui reste ouvert

### Bloquant pour une fusion vers `clean`

- **Les deux migrations RH inappelables** (§ 5, raison 2)
- **Le chantier RH jamais exercé** : à valider en recette sur quatre points — la détection de
  chevauchement et son seuil de 2 absents par service ; les **deux anciennetés** du récapitulatif
  qui ne doivent pas se compter en double ; un employé rattaché à **deux sociétés** qui doit
  produire deux bulletins indépendants ; le **DIPE par société** et non une déclaration unique

### Dette identifiée, non urgente

- `comptesRendus.vueSuperviseur` fait **une requête par membre actif** pour recalculer son score, et
  collecte tout l'historique à chaque affichage. Consigné dans `../ETAT-DU-PROJET.md` § 4.
  Même remarque pour les `.collect()` non bornés de `commandes.derniersAchats`.
- Le correctif du rewrite SPA (piège n° 9), proposé et non appliqué.
- `Financier.tsx` classe encore `"visa"` parmi les flux « banque » : code mort depuis que la ligne a
  quitté le bloc POITIERS.
- Le worktree `role` est mort (`origin/role: gone`) — à retirer.
- Les constats MEDIUM/LOW de la revue du 20/10 (antécédents de commande ignorant la date du bon,
  brouillons comptés comme historique, bouton « Hier » près de minuit…).

### En attente de réponses humaines

- **Lots R4 et R6** du chantier RH, bloqués sur quatre questions posées dans
  `docs/rh/QUESTIONS-A-TRANCHER.md` — deux pour la RH, deux pour le comptable.
- **Grand livre financier**, à poser à la DAF : un écart de **7 716** sur le solde MOMO du 15/10
  (son total `3 123 941 + 426 600 = 3 542 825` est faux, la somme vaut `3 550 541` — reste à savoir
  si l'erreur est dans le total ou dans l'un des deux chiffres, le second cas obligeant à rectifier
  un J0) ; le **retrait Carte Visa de 67 400 du 17/10**, réel ou doublon d'écriture ; le **solde
  réel de la carte au 14/10**, pour poser son ouverture.

---

## 9. Comment vérifier un déploiement, sans deviner

```bash
# Quel backend un build a-t-il réellement visé ? (la seule source fiable)
curl -s -H "Authorization: Bearer $TOK" \
  "https://api.vercel.com/v2/deployments/<dpl_id>/events?teamId=$TEAM&builds=1" \
  | grep -oE '"text":"[^"]*"' | grep -iE "Production|Preview|Development|Deployed Convex"

# Ce que servent réellement les domaines (ne demande aucune authentification)
curl -s https://poitiers-clean.vercel.app/ | grep -oE 'src="/assets/index-[^"]+\.js"'
# puis chercher l'URL Convex inlinée dans ce bundle

# L'état du backend de production
npx convex function-spec --prod        # liste et visibilité des fonctions
npx convex data <table> --prod --limit 20
npx convex run --prod --inline-query 'await ctx.db.query("…").take(5)'   # LECTURE SEULE
```

`--inline-query` est **en lecture seule** : il ne peut rien modifier. Pour une correction de
données, écrire une `internalMutation` qui **vérifie les valeurs attendues avant d'écrire** et rend
un compte rendu de ce qu'elle a fait et de ce qu'elle a refusé. Deux exemples en service :
`financier.purgerJourneesInvalides` et `financier.corrigerImputationVisa`.

---

## 10. La règle que l'agent sortant retient

Ne jamais annoncer un chiffre ou un état sans l'avoir relu **juste avant**. Trois fois dans cette
mission une projection correcte est devenue fausse parce que la base avait bougé entre la lecture
et l'annonce — le propriétaire saisissant pendant le déploiement. Lire, puis dire, dans cet ordre
et sans délai.

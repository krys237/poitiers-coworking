# Passation — agent DÉPLOIEMENT

> Rédigé le 09/11/2026 par l'agent déploiement sortant, **révisé le 10/11/2026** par son
> successeur après exécution du chantier du § 4. Ce document doit suffire : il décrit
> l'architecture réelle (celle des dashboards, invisible dans le dépôt), le chantier mené, les
> pièges déjà payés et ce qui reste ouvert. Lire **en entier** avant de toucher à un déploiement.
>
> Compléments : `CLAUDE.md` § « Déploiement du frontend (Vercel) », `DECISIONS.md`,
> `../ETAT-DU-PROJET.md`, `CONSIGNES-MULTI-AGENTS.md`.

---

## 1. L'état en une page

| | |
|---|---|
| **Production** | `poitiers-clean.vercel.app` ← projet Vercel `poitiers-coworking` ← branche `clean` ← Convex `focused-chipmunk-580` |
| **Recette** | `poitiers-coworking.vercel.app` ← projet Vercel **`poitiers-recette`** ← branche `dev` ← Convex **`coordinated-clam-865`** — déploiement de **production**, donc durable |
| **Chantier RH** | **intégralement fusionné dans `dev`** le 10/11 (`eb8b1ad`), toujours jamais exercé contre des données |
| `clean` | `0d12ae7` — poussée le 10/11, saine |
| `dev` | `eb8b1ad` — poussée le 10/11, en service sur la recette, **contient tout `rh`** |
| `rh` | `77876d1` — poussée le 10/11, désormais entièrement contenue dans `dev` |

Les branches mortes ont été retirées le 10/11 : `role` (contenue dans `clean`, `dev` et `rh`) et
`features`, qui portait **un commit absent partout ailleurs** — archivé sous l'étiquette
`archive/features`, poussée, plutôt que perdu.

**Ce que contient réellement la production** (relevé le 10/11 sur `focused-chipmunk-580`,
cible confirmée par `SITE_URL = poitiers-clean.vercel.app`) :

| Table | Lignes |
|---|---|
| `journeesFinancieres` | **25** — le grand livre est réel, toute écriture y est une opération comptable |
| `users` / `commandes` / `documents` / `journalActivite` | 53 / 22 / 20 / 257 |
| **`employes`** / **`bulletins`** / `saisiesMensuelles` / `rattachements` | **0** / **0** / 0 / 0 |

> La première rédaction affirmait « employés, bulletins, grand livre financier ». **Le grand livre,
> oui ; les employés et les bulletins, non.** La différence n'est pas cosmétique : elle retire deux
> des trois blocages opposés à la fusion `dev` → `clean` (§ 5). À **re-vérifier juste avant toute
> fusion** — il suffit que quelqu'un saisisse une fiche pour que le déroulé en trois temps
> redevienne obligatoire.

**État de la recette** au 10/11, après amorçage : 1 compte réel (super administrateur), le membre
technique `dev:dg`, 4 membres `demo:*` — aucun des cinq derniers n'a d'identifiant de connexion.
Données : 8 employés, 8 jours fériés, 10 services, 3 journées financières, 3 documents,
3 commandes, 3 interventions, 15 comptes rendus, 4 lignes de caisse, 26 lignes de primes/audit,
2 rapports. `AUTH_DEV_BYPASS` **n'existe pas** sur `coordinated-clam-865`, et vaut **`false`** en production.
Ne jamais le créer sur la recette : tant qu'il vaut `true`, toute personne ayant le lien est
Directeur Général — et la recette est sur un domaine public.

---

## 2. L'architecture réelle

### Vercel — deux projets, un seul dépôt

| Projet | Sert | Branche de production | Root |
|---|---|---|---|
| `poitiers-coworking` · `prj_TtexxveKWhx1c8iOuAeOO7aP4ha2` | `poitiers-clean.vercel.app` | `clean` | `app` |
| **`poitiers-recette`** · `prj_hS0FyPoDHQUV57wuokPPccJDlVXl` | `poitiers-coworking.vercel.app` + `poitiers-coworking-hv94.vercel.app` | **`dev`** | `app` |

Équipe `team_1n3FgfshLEq0LzpOVXuBXoN9`, dépôt GitHub `krys237/poitiers-coworking` pour les deux.

Les deux domaines sont des domaines de **production** de leur projet : plus aucun n'est épinglé à
une branche par le champ *Git Branch*. C'était nécessaire tant que `dev` était une branche de
preview ; ça ne l'est plus et ce serait désormais un piège (un domaine épinglé ne suivrait pas un
changement de branche de production).

**Les deux projets écoutent le dépôt entier.** Un push sur `dev` les réveille tous les deux. D'où,
sur `poitiers-coworking`, un *Ignored Build Step* (Settings → Build and Deployment) :

```
if [ "$VERCEL_GIT_COMMIT_REF" = "clean" ]; then exit 1; else exit 0; fi
```

`exit 1` construit, `exit 0` saute — la logique est inversée. Sans lui, chaque push sur `dev`
laisse un build en échec sur l'ancien projet. Vérifié le 10/11 : le build de `dev` y est passé
`CANCELED`.

### Le build déploie le backend avec le frontend

`app/vercel.json` :

```
npx convex deploy --cmd 'npm run build' --preview-run 'seed:initialiser'
```

`convex deploy --cmd` **injecte lui-même `VITE_CONVEX_URL`** dans le build : le frontend parle
toujours au backend qu'il vient de déployer. **Ne jamais remettre de `VITE_CONVEX_URL` à la main**
dans Vercel — deux sources de vérité, et la divergence revient.

`--preview-run` ne s'exécute que sur un déploiement de preview ; il est ignoré en production.

### `CONVEX_DEPLOY_KEY` — une entrée par projet

| Projet | Portée | Valeur |
|---|---|---|
| `poitiers-coworking` | Production | clé **production** de `coworking_app` |
| `poitiers-recette` | Production | clé **production** de `coworking_recette` |

Il n'y a **plus d'entrée Preview** : celle de `poitiers-coworking` a été supprimée le 10/11, c'est
elle qui recréait les déploiements de preview éphémères. Les deux projets ayant désormais une
branche de production dédiée, aucun build de recette n'est un preview, et le piège n° 3 ne peut
plus se déclencher.

### Prérequis sur chaque déploiement Convex visé

`JWT_PRIVATE_KEY`, `JWKS`, `SITE_URL`. Absentes, l'application se charge et reste
**silencieusement déconnectée**.

**On n'a pas besoin du dashboard pour les poser**, contrairement à ce que supposait la première
rédaction : `convex env` et `convex run` acceptent `--deployment`, qui vise n'importe quel
déploiement de n'importe quel projet de l'équipe avec la seule session CLI —
`--deployment <équipe>:<projet>:<référence>`, par exemple `coworking-recette:prod`.

⚠️ **Le slug n'est pas le nom affiché.** Le dashboard montre `coworking_recette` ; le slug est
**`coworking-recette`**, avec un tiret. L'underscore rend un `ProjectNotFound` qui ressemble à un
problème de droits.

Les **Default Environment Variables** du projet Convex restent utiles, mais elles ne s'appliquent
qu'aux déploiements **nouvellement créés** : elles ne couvrent pas un déploiement qui existe déjà.
C'est pour ça que les trois variables de `coordinated-clam-865` ont été posées directement dessus.

Pour regarder sans risque : **`convex env list --names-only`**. C'est la vraie réponse à l'incident
du 06/11 — on n'a presque jamais besoin de la valeur, donc on ne la demande pas, et il n'y a plus
rien à masquer.

---

## 3. Le cycle, impératif

```
rh  →  dev  →  validation en recette  →  clean
```

Qualifié d'impératif par le propriétaire. **Jamais directement sur `clean`.**

L'agent sortant l'a enfreint six fois (§ 5) pour des correctifs comptables urgents. C'est
défendable au cas par cas et c'est exactement ce qui a fait diverger la recette de la production.

---

## 4. Le backend durable de la recette — FAIT le 10/11/2026

**Décision du propriétaire du 09/11 : abandon du backend de recette éphémère.** Exécuté le 10/11.

### Le problème qu'on a supprimé

Les déploiements Convex de **preview** sont ramassés après une période d'inactivité. C'est arrivé
deux fois : `chatty-gull-360` (créé le 22/10, mort après 11 jours) et `vivid-okapi-830` (créé le
02/11, mort après 7 jours). Le frontend ayant son URL **gravée au build**, il interrogeait une
adresse morte et restait sur son écran de chargement, indéfiniment.

### Ce qui a été fait

1. Trois variables d'auth posées sur `coordinated-clam-865` — nouvelle paire RS256 générée avec
   `jose`, **jamais celle de la production**, et `SITE_URL = https://poitiers-coworking.vercel.app`
2. Projet Vercel `poitiers-recette` créé (Root `app`, `CONVEX_DEPLOY_KEY` = clé **production** de
   `coworking_recette`, portée Production seule)
3. Branche de production réglée sur `dev` — **Settings → Environments → Production → Branch
   Tracking**, et non « Settings → Git » comme l'indiquait la première rédaction : le dashboard a
   déménagé ce réglage
4. Sur l'ancien projet : entrée Preview de `CONVEX_DEPLOY_KEY` supprimée, *Ignored Build Step* posé
5. `dev` poussée — build vérifié : bannière `[Production] krystobalflynn:coworking-recette:production`,
   puis `Deployed Convex functions to https://coordinated-clam-865.eu-west-1.convex.cloud`
6. Domaine `poitiers-coworking.vercel.app` déplacé vers `poitiers-recette`, sans *Git Branch*
7. Base amorcée : `seed:initialiserAdmin`, puis les quatre seeds de démo, puis Planning annuel

`dev` étant maintenant une branche de **production**, `--preview-run 'seed:initialiser'` du
`vercel.json` **ne s'exécute plus** sur la recette. L'amorçage d'une base neuve est donc manuel, et
dans cet ordre : `seed:initialiserAdmin` → « Initialiser les données de démo » → Phase 2 → Phase 3
→ Phase 4 → Planning annuel (« Initialiser 2026 » puis « Créer les services »). Les phases 2 et 3
cherchent le membre `dev:dg` que crée l'étape de démo : lancées avant, elles ne font rien.

**Aucun seed de démo ne crée de compte de connexion** — le seul `createAccount` du code de seed est
dans `initialiserAdmin`. Les membres `dev:*` et `demo:*` n'ont ni identifiant ni mot de passe : ils
peuplent les écrans sans ouvrir de porte. C'est ce qui rend les données de démo acceptables sur un
domaine public.

---

## 5. Le report des 6 commits sur `dev` — FAIT

`dev` était en retard de six commits sur `clean`, tous poussés directement en production
(`03c2662`, `eec27b6`, `03e5da9`, `81f9413`, `b6801e1`, `b9c9a8e`). Le merge `clean` → `dev`
(`efcfae4`, conflit `DECISIONS.md` résolu en conservant les deux entrées) a été validé le 10/11 —
typecheck, build et les **17 suites de tests** au vert — puis poussé. `clean` et `rh` ont été
poussées le même jour ; plus aucun commit ne vit uniquement sur le poste.

### Fusionner `dev` → `clean` : ce qui bloque encore, et ce qui ne bloque plus

L'agent sortant opposait trois raisons. **Deux tombent** au vu de l'état réel de la production
(§ 1 : 0 employé, 0 bulletin, 0 rattachement) :

1. ~~« Les migrations sont inappelables, la production recevrait le nouveau modèle sans moyen de
   convertir les fiches existantes »~~ — il n'y a **aucune fiche** à convertir.
   `employes:migrerRattachements` et `employes:migrerSalaireBase` restent des `mutation`
   **publiques** gardées par `requireDroit`, donc sans interface et hors d'atteinte du CLI
   (`convex run` n'a pas de session). C'est une anomalie à corriger — leur donner un bouton, ou les
   passer en `internalMutation` comme `users:restaurerRole` — mais ce n'est plus un bloquant.
2. ~~« Le renommage `salaireBrut` → `salaireBase` exige trois temps sur une base peuplée »~~ — la
   base n'est pas peuplée. Sur la recette, les 8 employés portent déjà `salaireBase` et
   `salaireBrut` n'existe nulle part. **Si des fiches apparaissent en production d'ici la fusion**,
   reprendre les trois temps : schéma avec les deux champs optionnels, `migrerSalaireBase`, puis
   retrait de l'ancien champ. L'ordre inverse fait rejeter les fiches par Convex.
3. **Le seul vrai blocage subsiste : le chantier RH n'a jamais tourné contre des données.**
   Il est en revanche **entièrement dans `dev` et déployé en recette** depuis le 10/11 (merge
   `eb8b1ad` : R4, R6, R7 → R11, N1, N2, N4, N5 — 22 commits, sans conflit, 27 suites de tests au
   vert, « Schema validation complete » sur `clam`). Avant cette date `dev` n'avait que R0 → R3 et
   R5, et le récapitulatif de l'agent RH qui le signalait était exact. Ce qui
   est garanti, c'est le typecheck, le build et la logique pure. Quatre points à exercer en recette
   — c'est désormais possible, elle est vivante et peuplée :
   - la détection de chevauchement et son seuil de 2 absents par service
   - les **deux anciennetés** du récapitulatif, qui ne doivent pas se compter en double
   - un employé rattaché à **deux sociétés**, qui doit produire deux bulletins indépendants
   - le **DIPE par société**, et non une déclaration unique

   Note : la table `rattachements` est **vide** sur les deux déploiements et aucun seed ne la
   remplit ; `employes.serviceId` n'est renseigné sur aucune fiche. Les deux se posent **à la main
   dans l'interface** — la fiche employé a un bloc de rattachements
   (`src/components/app/rattachements-employe.tsx`). La migration `migrerRattachements` n'est donc
   qu'un confort de masse, pas un préalable aux essais.

---

## 6. Les pièges, tous payés et vérifiés

1. **Les déploiements Convex de preview sont éphémères.** *Désamorcé le 10/11 (§ 4), gardé pour le
   diagnostic.* Symptôme : chargement perpétuel. Diagnostic : `POST` sur
   `<backend>/api/query` → **404**, corps vide. Un `GET` rend 400 même sur un déploiement sain : il
   faut un POST pour distinguer les deux.

2. **Une clé Convex de *développement* en portée Production** déploie sur le déploiement de dev et
   l'annonce `[Development]` dans les logs de build. **Le build réussit** et le frontend se branche
   au mauvais backend. Toujours vérifier la bannière du log : `[Production]` / `[Preview]` /
   `[Development]`, puis la ligne « Deployed Convex functions to … ».

3. **Convex refuse une clé de *production* dans un build non-production** *(ne peut plus se
   déclencher depuis le § 4 : les deux projets ont une branche de production)* :
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

12. **La branche `main` est un piège à elle seule.** Son `vercel.json` porte
    `"buildCommand": "npm run build"` — **sans `convex deploy`** — et son `src/main.tsx:10-11`
    garde un **repli codé en dur** vers `https://wonderful-shark-673.eu-west-1.convex.cloud`, le
    déploiement de *développement* partagé. Un build parti de `main` ne touche donc pas Convex, ne
    consomme même pas la clé de déploiement, et sert un frontend branché sur le backend de dev —
    où les anciens comptes fonctionnent. **Symptôme trompeur : « je me connecte avec mes anciens
    identifiants, donc la base n'est pas la bonne ».** Constaté le 10/11 sur le build jetable du
    nouveau projet. `dev` et `clean` n'ont ni l'un ni l'autre défaut : sans `VITE_CONVEX_URL`
    elles affichent une erreur de configuration au lieu de se rabattre quelque part.

13. **Le seul contrôle qui vaut, c'est l'URL inlinée dans le bundle servi** :

    ```bash
    A=$(curl -s https://<domaine>/ | grep -oE '/assets/index-[^"]+\.js' | head -1)
    curl -s "https://<domaine>$A" | grep -oE '"https://[a-z0-9.-]+\.convex\.cloud"' | sort -u
    ```

    Il ne demande aucune authentification et ne dépend d'aucun dashboard. C'est lui qui a montré que
    la recette interrogeait encore `vivid-okapi-830`, puis que le nouveau build visait bien `clam`.

14. **`convex run` a besoin d'un worktree lié.** Dans `poitiers-coworking-dev`, il n'y a pas de
    `.env.local` : même avec `--deployment`, la commande échoue sur « No CONVEX_DEPLOYMENT set ».
    Lancer les requêtes depuis le worktree principal (`C:\test\Js\poitiers-coworking\app`), qui
    en a un — la branche sortie n'a aucune importance pour une lecture.

15. **`--inline-query` ne supporte pas les sauts de ligne** passés par un heredoc : la CLI rend
    « `--inline-query` must not be empty ». Écrire la requête sur **une seule ligne**, dans une
    variable shell.

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

- **Le chantier RH jamais exercé** — détaillé au § 5. Les quatre points sont désormais **écrits
  comme scénarios exerçables** dans le cahier de recette : **RH-34** (seuil de 2 absents par
  service), **RH-35** (double ancienneté), **RH-36** (deux sociétés, deux bulletins) et **RH-37**
  (DIPE par société), dans `design/recette/scenarios-rh.json`. Trois sont marqués *bloquant*.
  ⚠️ **Ils n'ont pas été déroulés avant la fusion vers `clean` du 13/11**, faite sur décision du
  propriétaire. Le risque est contenu — la production ne porte aucune fiche employé ni bulletin,
  le module RH y arrive donc sur une base vide — mais il n'est pas nul : ces quatre règles n'ont
  toujours jamais tourné contre des données.
- À **re-vérifier juste avant la fusion** : que la production ne porte toujours ni fiche employé ni
  bulletin (§ 1). Si elle en porte, le renommage `salaireBase` redevient un déroulé en trois temps.

### À corriger, sans bloquer

- **Les deux migrations RH restent inappelables** : publiques mais gardées par `requireDroit`, donc
  sans interface et hors d'atteinte du CLI. Bouton dans l'écran Employés, ou `internalMutation`.
  Ce n'est pas urgent : `migrerSalaireBase` n'a rien à faire (aucune fiche ne porte `salaireBrut`,
  ni en recette ni en production) et `migrerRattachements` se remplace par la saisie manuelle.
- La table `rattachements` est vide partout et aucun seed ne la remplit : le scénario « employé
  rattaché à deux sociétés » demande de les créer à la main.

### Dette identifiée, non urgente

- `comptesRendus.vueSuperviseur` fait **une requête par membre actif** pour recalculer son score, et
  collecte tout l'historique à chaque affichage. Consigné dans `../ETAT-DU-PROJET.md` § 4.
  Même remarque pour les `.collect()` non bornés de `commandes.derniersAchats`.
- Le correctif du rewrite SPA (piège n° 9), proposé et non appliqué.
- `Financier.tsx` classe encore `"visa"` parmi les flux « banque » : code mort depuis que la ligne a
  quitté le bloc POITIERS.
- ~~Les worktrees `role` et la branche `features`~~ — retirés le 10/11.
- Les constats MEDIUM/LOW de la revue du 20/10 (antécédents de commande ignorant la date du bon,
  brouillons comptés comme historique, bouton « Hier » près de minuit…).

### En attente de réponses humaines

*(état au 12/11)*

- **Lots R4 et R6** du chantier RH, bloqués sur quatre questions posées dans
  `docs/rh/QUESTIONS-A-TRANCHER.md` — deux pour la RH, deux pour le comptable. Aucune n'a bougé.
- **Grand livre, question ouverte le 12/11 et bloquante** : l'entrée **biodiagnostic de 3 700 000
  du 29/10**. Les trois autres entrées biodiagnostic (97 600 le 16/10, 38 850 le 23/10, 57 000 le
  30/10) figurent bien dans le F3 du relevé DAF ; celle-là, non. Elle décide du signe du solde :
  incluse, le F3 du 12/11 passe de **−1 916 936 à +2 073 014**. Sont aussi demandés les chiffres
  F3 du DAF pour **novembre**, la feuille s'arrêtant au 31/10.
- **Grand livre, questions plus anciennes** : l'écart de **7 716** sur le solde MOMO du 15/10 (le
  total `3 123 941 + 426 600 = 3 542 825` est faux, la somme vaut `3 550 541`) ; le **retrait Carte
  Visa de 67 400 du 17/10**, réel ou doublon ; le **solde réel de la carte au 14/10**.

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

# N'importe quel déploiement de l'équipe, sans clé : --deployment <projet>:<référence>
npx convex env list --names-only --deployment coworking-recette:prod
npx convex run --deployment coworking-recette:prod --inline-query "$Q"   # depuis le worktree lié
```

### Localiser un écart dans le grand livre, sans ressaisir

Comparer **jour par jour** la clôture d'un solde avec le relevé papier, et regarder non pas
l'écart mais **sa variation**. Un écart qui reste constant plusieurs jours puis saute désigne la
journée exacte où un montant manque, et le saut en donne le montant. Le 12/11, trois décrochages
ont été localisés en une passe sur le F3 — 97 600 au 16/10, 38 850 au 23/10, 57 000 au 30/10 — et
se sont révélés être, au franc près, les entrées biodiagnostic de ces journées : une divergence de
**modèle**, pas une saisie manquante. Aucune journée n'a eu à être reprise.

Corollaire : avant de conclure qu'un chiffre manque, vérifier si un **bloc entier** n'est pas
rangé du mauvais côté de la formule. C'est la deuxième fois — la première était la Carte Visa.

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

---
name: lot-agent-externe
description: Méthode de travail du projet POITIERS COWORKING avec un exécutant qui n'a pas accès au dépôt. Use when preparing or integrating work from an external/cloud agent, assembling a lot (ZIP), reviewing a returned patch, or deciding what an agent without the repository can and cannot prove.
---

# Travailler avec un exécutant qui n'a pas le dépôt

Le propriétaire fait exécuter des chantiers par un agent **cloud**, dans une conversation séparée,
sans accès au dépôt ni aux fichiers locaux. Les échanges passent par une **archive** déposée dans
la conversation. Ce document est le contrat de cette collaboration.

Complément détaillé : `app/docs/METHODE-LOT-AGENT-EXTERNE.md`.
Format de fiche : `app/docs/rh/epics/00-LISEZ-MOI.md`.

## Le principe

**Git reste du côté du dépôt ; l'exécutant ne voit qu'un instantané.** De son point de vue il
n'existe qu'un seul état, celui de l'archive — pas de branche, pas d'historique. Du côté du dépôt
rien ne change : son patch s'applique sur `dev` comme n'importe quelle contribution.

Le partage des rôles ne se négocie pas :

| | Qui |
|---|---|
| Logique pure, écrans, tests, UI | l'**exécutant** |
| Modèle de données, schéma, requêtes serveur, chaîne de déploiement, séquencement des migrations | l'**agent de déploiement** |
| Validation contre des données réelles | le **propriétaire**, en recette |

## Aller — fabriquer le lot

Un lot est un ZIP contenant **une `FICHE.md` à la racine** et le strict périmètre du chantier.

**Il se fabrique par liste blanche, jamais par liste d'exclusion.** Le dépôt contient des choses
qu'une archive déposée dans une conversation ne doit pas emporter :

| Jamais dans un lot | Pourquoi |
|---|---|
| `.env*` | clés de déploiement, matériel JWT |
| `modele/` | noms, salaires et situations de famille réels de l'effectif |
| `archives/`, `/docs/` | grand livre, classeurs de paie, relevés, captures |

Relire la liste des fichiers du ZIP **une par une** avant d'envoyer. Un lot se fabrique en trois
secondes et ne se rattrape jamais.

**Corollaire assumé** : un chantier qui a besoin de `modele/` ou d'`archives/` n'est **pas
délégable**. Il se traite dans le dépôt.

Les modules de `convex/lib/` et `src/lib/` sont **purs et sans dépendance** : leurs tests tournent
avec Node nu, sans `npm install`. Un lot de logique pure pèse une dizaine de kilo-octets et se
vérifie intégralement. C'est le format à privilégier, et le bon choix pour un premier lot.

### Ce que la fiche doit contenir

Tout ce que l'exécutant **ne peut pas découvrir** :

- l'intention et le critère d'acceptation, en une phrase ;
- les **points d'entrée exacts** (`convex/planning.ts:208`), pas des descriptions — il lit les
  fichiers joints ;
- les **décisions métier opposables** : multi-société non consolidé, barème daté, FCFA en entiers,
  heure de Douala en UTC+1 fixe, « masquer un bouton n'est pas une sécurité » ;
- les **pièges du projet** qui touchent sa zone ;
- la **liste des fichiers interdits**, nommément ;
- **ce qu'il ne pourra pas prouver**, avec la consigne de l'écrire plutôt que de le contourner.

Cette dernière ligne n'est pas une politesse. Elle évite le défaut le plus coûteux observé :
**fabriquer un harnais jetable pour faire semblant d'avoir testé.**

### Ce que la fiche doit exiger de lui

Avant toute modification :

```bash
git init && git add -A && git commit -m base && git tag base
```

Le **tag** est obligatoire : `git diff base` ne sait pas référencer un message de commit.

En fin de course, trois livrables :

1. `git diff base > lot-X.patch` — **le patch, pas les fichiers** ;
2. la **sortie brute** de ses tests, pas un résumé ;
3. un `COMPTE-RENDU.md` disant ce qu'il a fait, **ce qu'il n'a pas pu vérifier**, et ce qu'il a
   remarqué sans y toucher.

## Retour — un patch, jamais des fichiers

**C'est la règle non négociable du dispositif.** Des fichiers entiers renvoyés écrasent
silencieusement ce qui a bougé entre-temps ; un patch, lui, échoue bruyamment. On transforme une
perte invisible en erreur visible.

## Intégration

```bash
# 1. L'empreinte de SA base doit égaler la nôtre, fichier par fichier
git show base:<fichier> | git hash-object --stdin                     # chez lui
git show <sha-de-la-fiche>:app/<fichier> | git hash-object --stdin    # chez nous

# 2. Lire AVANT d'appliquer, et noter le préfixe de chemin
git apply --3way --directory=app --stat  livraisons/lot-X/lot-X.patch
git apply --3way --directory=app         livraisons/lot-X/lot-X.patch
git status --porcelain                                                # et vérifier APRÈS
```

Puis, dans cet ordre :

1. **relire le diff**, pas le compte rendu ;
2. **typecheck, build et TOUTES les suites de tests**, dans le dépôt ;
3. fusion dans `dev`, déploiement en recette, validation contre des données ;
4. puis seulement `clean`.

**On ne fusionne jamais sur la parole d'un agent.**

## Les pièges, tous payés

| Piège | Symptôme | Parade |
|---|---|---|
| Préfixe de chemin absent | `git apply` rend un **succès en n'appliquant rien** — zéro fichier, aucun message | `--directory=app`, lire le `--stat` avant et `git status` après. Un patch qui ne change aucun fichier est un **échec** |
| Base reconstruite à la main | son commit `base` ne correspond pas à l'envoi | comparer les empreintes, systématiquement |
| Chemins d'import inventés | le typecheck casse sur un module introuvable (`@/hooks/use-peut` au lieu de `@/auth/useMe`) | **nommer le chemin dans la fiche**, pas seulement la fonction |
| Validateur Convex désynchronisé | la mutation est rejetée, l'écran affiche un dump illisible | l'exécutant ne voit ni `schema.ts` ni les validateurs : **c'est à l'intégrateur de les resynchroniser** |
| Composant partagé contredisant l'écran | deux messages opposés s'affichent | fichier interdit : il **signale**, l'intégrateur arbitre |
| Dépendance déclarée, non installée | typecheck et build impossibles | les worktrees partagent un `node_modules` par jonction : installer **depuis le worktree qui déclare** la dépendance |
| Environnement divergent | vert chez lui, rouge ici | plusieurs pièges du projet ne se manifestent que sous Windows — **rejouer tous les contrôles dans le dépôt** |

## Ce qu'un exécutant sans dépôt ne peut PAS prouver

À écrire dans chaque fiche, et à vérifier soi-même :

- les **signatures** du reste du projet — composants partagés, validateurs Convex, chemins d'import ;
- le **typecheck complet** et le **build**, faute des dépendances ;
- tout comportement **contre des données réelles** : il n'a ni base, ni session.

C'est précisément là que se trouvent les défauts. Sur les quatre premiers lots, **tous** les
problèmes réels ont été découverts à la relecture du diff et au typecheck — aucun n'était une faute
de l'exécutant, et tous auraient atteint la production.

## Signaux d'alerte

- un compte rendu qui annonce « typecheck OK » sans sortie à l'appui ;
- un compte rendu qui ne dit **rien** sous « ce que je n'ai pas pu vérifier » ;
- un patch qui touche un fichier déclaré interdit ;
- des fichiers entiers renvoyés au lieu d'un patch ;
- « tout est committé » sans `git log` pour le montrer.

**Chacun de ces signaux veut dire : vérifier soi-même avant d'intégrer.**

## Faire évoluer la méthode

Chaque piège nouvellement payé s'ajoute au tableau ci-dessus **et** à
`app/docs/METHODE-LOT-AGENT-EXTERNE.md`, avec sa date et son symptôme. Une méthode qui ne consigne
que ses réussites ne sert à rien : c'est la liste des échecs qui fait gagner du temps au suivant.

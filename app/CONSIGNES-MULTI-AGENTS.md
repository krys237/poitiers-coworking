# Consignes de travail à deux agents

Deux agents travaillent en parallèle sur ce projet. Ce fichier est le contrat entre eux.
**À lire avant toute modification.** En cas de doute sur qui possède un fichier : ne pas le toucher, laisser une note ici.

## Qui est où

| Dossier | Branche | Agent | Périmètre |
|---|---|---|---|
| `C:\test\Js\poitiers-coworking` | `features` | **agent FRONT** | écrans, composants, styles |
| `C:\test\Js\poitiers-coworking-role` | `role` | **agent AUTH/RBAC** | authentification, rôles, backend Convex |

Ce sont deux *worktrees* du même dépôt : deux dossiers, deux branches sorties en même temps, un seul historique Git.

**Règle n°1 : chaque agent reste dans son dossier.** Ne jamais faire `git checkout` d'une autre branche
dans son propre dossier — cela arracherait les fichiers sous les pieds de l'autre.
La commande `git worktree list` rappelle qui occupe quoi.

## Partage des fichiers

| Fichier / dossier | Propriétaire | Remarque |
|---|---|---|
| `convex/**` | AUTH | tout le backend, y compris `rbac.ts` et `schema.ts` |
| `src/main.tsx` | AUTH | accueille le provider d'authentification (P1) |
| `src/App.tsx` | AUTH | table des routes + gardes d'accès (P2) |
| `src/components/Layout.tsx` | AUTH | menu filtré par rôle, bloc utilisateur, déconnexion |
| `src/auth/**` *(à créer)* | AUTH | `Login.tsx`, `Guard.tsx`, `useMe.ts` |
| `src/pages/**` | **FRONT** | tous les écrans |
| `src/components/**` *(sauf Layout)* | **FRONT** | |
| `src/styles.css`, `src/styles/**` | **FRONT** | |
| `src/lib/**` | **FRONT** | helpers de présentation (`csv.ts`, `format.ts`) |
| `CLAUDE.md` | partagé | insertions courtes uniquement, jamais de réécriture |

## Contrat d'interface (disponible après P2)

L'agent FRONT ne doit **jamais** écrire de logique d'accès lui-même. Il consomme :

```tsx
import { useMe, SiNiveau } from "../auth/useMe";

const me = useMe();              // { role, niveau, nom, email } | null (non connecté) | undefined (en cours)

<SiNiveau min={5}>               // masque le bouton sous le niveau 5
  <button onClick={cloturer}>Clôturer le mois</button>
</SiNiveau>
```

Masquer un bouton n'est **pas** une sécurité : le contrôle réel est côté Convex (`requireLevel`).
Le masquage sert seulement à ne pas proposer une action qui échouera.

### Ajouter un écran

L'agent FRONT crée sa page dans `src/pages/`, puis **laisse une ligne dans la section « Demandes » en bas
de ce fichier** (chemin de route souhaité + niveau minimum requis). L'agent AUTH enregistre la route dans
`App.tsx`, l'entrée de menu dans `Layout.tsx` et le niveau dans `convex/rbac.ts` (`NIVEAU_MODULE`).

⚠️ Toute route doit avoir une entrée dans `NIVEAU_MODULE`. Une route absente de la matrice est
refusée à **tout le monde**, DG compris (`canAccess` renvoie `false` si le niveau requis est `undefined`).

## Pièges partagés

- **Un seul déploiement Convex** (`wonderful-shark-673`) pour les deux agents. Une modification de
  `convex/schema.ts` poussée par l'un s'applique immédiatement à l'autre. L'agent AUTH prévient ici
  avant tout changement de schéma.
- **`npx convex dev` ne doit tourner que dans un seul dossier à la fois** — deux instances poussent
  en boucle l'une sur l'autre.
- **`AUTH_DEV_BYPASS=true`** : tant que cette variable est active sur le déploiement, *toute personne
  ayant le lien est Directeur Général*. C'est le mode de démo actuel, pas un état cible.
- Le port Vite (5173) est occupé par le premier `npm run dev` lancé ; le second prendra 5174.

## Journal des coordinations

Chaque agent ajoute une ligne quand il touche à une zone frontière ou termine un lot.

- **2026-09-16 — AUTH** : P0 terminé sur `role` (commit `d6678ce`). Fermeture de 8 fonctions Convex
  publiques (seeds, `documentsIa.extraireMetadonnees`, `courrier.mode`, `journal.actions`), ajout de
  l'index `documents.by_fichier` et de `/paie/saisie` dans `NIVEAU_MODULE`. **Aucun fichier de `src/`
  touché.** Prochain lot : P1 (Convex Auth — mot de passe + OTP e-mail), qui réécrira `src/main.tsx`.
- **2026-09-16 — AUTH** : `src/main.tsx` et `src/pages/Courrier.tsx` sont modifiés et **non commités**
  dans le dossier `features`. À commiter par leur auteur **avant** le début de P1, sinon ils seront
  écrasés lors de la pose du provider d'authentification.
  ⚠️ Ce n'est pas qu'une question de sauvegarde : **en l'état, `npm run typecheck` échoue sur le
  dernier commit** (`Courrier.tsx:141` passe une prop `periode` que `BulletinCard` n'accepte pas).
  Le correctif est précisément dans ces changements non commités. Tant qu'ils ne sont pas commités,
  tout nouveau worktree part d'un code qui ne compile pas.

- **2026-09-17 — AUTH** : P1 **backend** terminé sur `role` (commit `7e19767`). Authentification réelle
  (Convex Auth : mot de passe + code à usage unique par e-mail). **Toujours aucun fichier de `src/` touché.**
  Trois points qui concernent l'agent front :
  1. **Le schéma Convex change** (`...authTables` + redéfinition de `users`). Rien n'est encore poussé :
     le déploiement partagé est intact. Le premier `npx convex dev` lancé appliquera ces changements
     **pour les deux agents** — à ne pas lancer sans se concerter.
  2. `convex/_generated/api.d.ts` ne connaît pas encore `api.auth.*` : la régénération (`npx convex codegen`)
     exige un déploiement lié, et aucun `.env.local` ici n'a de `CONVEX_DEPLOYMENT`. À faire avant le
     câblage du front.
  3. `users.me` renvoie deux champs de plus : `enAttente` (compte créé mais pas encore autorisé par un DG →
     afficher un écran d'attente, pas le menu) et `modeDev` (bypass de développement actif → bandeau
     d'avertissement). Ils sont utilisables dès que le schéma est déployé.

- **2026-09-17 — AUTH** : P2 terminé sur `role` (commit `c74af15`). **J'ai touché à `src/` pour la
  première fois**, uniquement sur les fichiers dont je suis propriétaire : `main.tsx`, `App.tsx`,
  `components/Layout.tsx` et le nouveau dossier `src/auth/`. Aucune page n'a été modifiée.
  - ⚠️ **`src/main.tsx` est réécrit** (`ConvexAuthProvider` à la place de `ConvexProvider`). J'y ai
    repris à l'identique ton repli d'URL et ton écran d'erreur Convex, donc ta version non commitée
    et la mienne disent la même chose — la fusion devrait être triviale. **Commite-la quand même**
    avant que je fusionne `role` dans `features`, sinon elle sera perdue.
  - `Courrier.tsx` : ton correctif (retrait de la prop `periode`) est **toujours non commité**, et le
    typecheck échoue donc toujours sur le dernier commit. Je n'y touche pas, c'est ton fichier.
  - **Le contrat d'interface est disponible** : `import { useMe, SiNiveau, useNiveau, usePeut } from "../auth/useMe"`.
    Utilise `<SiNiveau min={5}>…</SiNiveau>` pour masquer un bouton d'action plutôt que de tester un
    rôle à la main. Rappel : masquer n'est pas sécuriser, le contrôle réel est côté Convex.
  - **Les routes sont désormais gardées** : chaque entrée de la table `ROUTES` d'`App.tsx` est
    enveloppée d'un `<Guard perm>`. Une nouvelle page ne s'affichera pas tant que sa clé n'est pas
    dans `NIVEAU_MODULE` — passe par la section « Demandes » ci-dessous.
  - `styles.css` n'a pas été touché : mes styles vivent dans `src/auth/auth.css`, préfixés `auth-`.

- **2026-09-17 — AUTH** : chantier authentification & rôles **clos et poussé** :
  `https://github.com/krys237/poitiers-coworking/tree/role` (commit `aff89e3`).
  - **Le document de reprise est `app/PASSATION-AUTH-RBAC.md`, sur la branche `role`.** Il contient
    l'état réel, la raison de chaque décision, ce qui est vérifié et ce qui ne l'est pas, la
    procédure de mise en service en 6 étapes et les pièges. À lire avant de toucher à quoi que ce soit.
  - ⚠️ **Le code se construit mais aucune connexion n'a jamais abouti** : il n'y a pas de déploiement
    Convex lié à ce poste, donc `auth:signIn` n'existe pas encore côté serveur. La mise en service
    (clés JWT, variables, push, essai réel) est la première tâche, pas l'écriture de nouveau code.
  - La poussée de `role` a embarqué au passage tes deux commits `7ec9250` et `6e40f38` (refonte
    Financier) : **ton travail commité est désormais sauvegardé sur GitHub**. La branche `features`
    elle-même n'est toujours pas poussée, et tes modifications non commitées de `main.tsx` et
    `Courrier.tsx` restent, elles, uniquement sur ce poste.

## Demandes

*(FRONT → AUTH : nouvelles routes à enregistrer. Format : `chemin` — libellé de menu — niveau min.)*

- _(vide)_

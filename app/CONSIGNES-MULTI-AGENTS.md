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

## Demandes

*(FRONT → AUTH : nouvelles routes à enregistrer. Format : `chemin` — libellé de menu — niveau min.)*

- _(vide)_

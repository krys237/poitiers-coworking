# Épic 2 — Trois bugs déjà diagnostiqués, à corriger

## Contexte

Tu travailles sur une plateforme RH/paie pour une clinique au Cameroun (POLYCLINIQUE DE POITIERS),
dans le worktree `C:\test\Js\poitiers-coworking-rh`, branche `rh` (déjà active, ne pas en changer).
Backend Convex (`app/convex/`), frontend React/Vite (`app/src/`), conventions et noms en français
partout — à respecter dans tes modifications.

Une recette fonctionnelle a révélé trois bugs. Pour chacun, la cause a déjà été localisée
précisément — ta tâche est de vérifier le diagnostic en lisant le code, corriger, et prouver que
la correction fonctionne. Les trois sont indépendants : traite-les dans l'ordre ci-dessous, chacun
avec son propre commit.

---

## Bug 1 — Le PDF des actes RH sort illisible, sans retour à la ligne

**Fichier** : `app/convex/actesPdf.ts`, autour de la ligne 95 :

```ts
for (const paragraphe of clean(args.corps).split("\n")) {
```

**Cause** : `clean()` (définie plus haut dans le même fichier, vers la ligne 21) sanitise le texte
pour du Latin-1 avec, en dernier remplacement, un catch-all `.replace(/[^\x20-\x7E\xA0-\xFF]/g,
"?")`. Le caractère de retour à la ligne (`\n`, code 0x0A) est hors des deux plages conservées, donc
ce remplacement le transforme en `"?"` littéral **avant** que `.split("\n")` ne s'exécute : il ne
reste alors plus aucun `\n` à trouver, et tout le texte devient un seul paragraphe.

**Correctif attendu** : inverser l'ordre des opérations — découper `args.corps` **brut** (non
nettoyé) en paragraphes d'abord (`args.corps.split("\n")`), puis appliquer `clean()` à **chaque
paragraphe** individuellement, juste avant de l'écrire dans le PDF. Vérifier que la détection de
titre (probablement une fonction du nom `estTitre` ou similaire, cherchée dans le même fichier, qui
repère les paragraphes en gras/centrés) continue de fonctionner une fois les paragraphes correctement
séparés — elle en dépend.

**Comment vérifier** : il existe un test `npm run test:actes` (`tests/actes.test.ts`) — le faire
passer. Si le test ne couvre pas ce cas précis (texte multi-paragraphe), ajoute un cas qui le
couvre : un corps avec au moins deux paragraphes séparés par `\n`, et vérifie que la sortie produit
bien des blocs de texte distincts (pas un seul run-on avec des "?" à la place des coupures).

---

## Bug 2 — La colonne « Allocation » reste vide pour un congé posé dans le futur

**Fichiers** : `app/convex/planning.ts` (le calcul du « premier départ » de l'année, autour de la
ligne 326) et `app/convex/lib/planningAnnuel.ts` (définition de `OBSERVATION_CONSOMME` et de
`observationDeduite`).

**Cause** : le choix du congé qui porte l'allocation de l'année filtre les événements par
`OBSERVATION_CONSOMME[ev.observation]`. Cette table sert normalement à décider si un congé compte
dans le **quota de jours déjà consommés** — `OBSERVATION_CONSOMME.planifie` y vaut `false`, à
raison, puisqu'un congé futur n'a pas encore été consommé. Le problème : ce même filtre est
réutilisé pour sélectionner le congé qui doit **afficher l'allocation**, et comme
`observationDeduite()` renvoie `"planifie"` pour tout congé dont la date de départ n'est pas encore
passée, un congé posé pour le futur (ex. départ le 07/12/2026, testé le 12/11/2026) est exclu à
tort de ce second usage, alors que son montant d'allocation est pourtant bien calculé en arrière-plan.

**Correctif attendu** : séparer les deux usages. Le filtre qui alimente le compteur de jours
consommés (`joursPris` et compagnie) doit garder son comportement actuel. Le choix du congé qui
porte l'allocation (le « premier départ » de l'année) doit retenir **tout congé payé qui n'a pas
été annulé** — exclure seulement `"annule"` (et probablement `"reporte"`, à vérifier dans le
contexte : un congé reporté n'a plus de date de départ valide pour cette année), indépendamment de
son statut de consommation. Concrètement : ne pas réutiliser `OBSERVATION_CONSOMME` tel quel pour
cette sélection précise — écrire un filtre dédié, ou l'adapter localement à cet endroit du code.

**Comment vérifier** : il existe un test `npm run test:planning` (`tests/planningAnnuel.test.ts`)
— le faire passer, et ajouter un cas : un congé payé posé pour une date future (statut déduit
`"planifie"`) doit tout de même apparaître avec son montant d'allocation calculé, pas une case
vide.

---

## Bug 3 — Un rattachement à une société secondaire perd son salaire si aucun montant n'est saisi

**Fichier** : `app/convex/lib/societes.ts`, ligne 141 :

```ts
salaireBase: l.salaireBase ?? (l.societe === fiche.societe ? salaireDeBase(fiche) : 0),
```

**Cause** : le repli sur le salaire de la fiche ne s'applique que si la ligne de rattachement porte
la **société principale** de la fiche (`fiche.societe`). Pour une société secondaire (ex. un
employé principalement rattaché à SESAME, avec un second rattachement à SOFINA sans montant propre
saisi), le repli vaut **0** au lieu du salaire principal — alors que l'écran de saisie
(`app/src/components/app/fiche-employe.tsx`, le texte d'aide près du champ salaire du rattachement)
annonce explicitement : « Sans montant, c'est le salaire de base ci-dessus qui s'applique ». Un
employé multi-société peut donc se retrouver sans salaire réel chez une société secondaire.

**Correctif attendu** : le repli doit valoir `salaireDeBase(fiche)` **quelle que soit** la société
portée par la ligne de rattachement, pas seulement celle de la fiche. Avant de modifier, lire les
autres occurrences de `salaireBase` dans le même fichier (lignes 42, 57, 74, 88, 100, 194, 201, 210,
211 au moment du diagnostic — les numéros peuvent avoir légèrement bougé) pour s'assurer qu'aucune
autre d'entre elles ne reproduit le même défaut, et pour comprendre comment cette fonction est
utilisée ailleurs (`rattachementsEffectifs`, `pourSociete`) avant de changer son comportement.
Vérifier aussi si l'écran d'édition des rattachements d'une fiche déjà créée
(`app/src/components/app/rattachements-employe.tsx`) affiche ou dépend de ce même calcul côté
frontend, pour rester cohérent.

**Comment vérifier** : il existe un test `npm run test:societes` (`tests/societes.test.ts`) — le
faire passer, et ajouter un cas : un employé avec sa société principale et un second rattachement à
une autre société SANS salaire propre doit recevoir, pour ce second rattachement, le salaire de
base de la fiche — pas zéro.

---

## Ce qui est attendu en sortie

- Les trois bugs corrigés, chacun avec son propre commit sur la branche `rh` (message en français
  qui dit CE QUI était faux et CE QUI a été changé, pas juste « fix bug »).
- `npm run typecheck` vert.
- `npm run test:actes`, `npm run test:planning`, `npm run test:societes` tous verts.

## Avant de rendre

Écris un compte rendu dans `app/docs/rh/epics/comptes-rendus/epic-2.md`, avec pour chacun des trois
bugs : confirmation ou infirmation du diagnostic initial, le correctif exact (fichier + ligne), et
le résultat du test correspondant. Si l'un des trois diagnostics s'avère faux à la lecture du code
réel, dis-le clairement et explique ce que tu as trouvé à la place plutôt que de forcer une
correction qui ne correspond plus au problème.

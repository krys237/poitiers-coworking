# Épic 6 — Saisie assistée : matricule auto-incrémenté, champs employé en autocomplétion, date de naissance en sélecteur

## Contexte

Tu travailles sur une plateforme RH/paie pour une clinique au Cameroun (POLYCLINIQUE DE POITIERS),
dans le worktree `C:\test\Js\poitiers-coworking-rh`, branche `rh` (déjà active, ne pas en changer).
Backend Convex (`app/convex/`), frontend React/Vite (`app/src/`), conventions et noms en français
partout — à respecter dans tes modifications.

Trois demandes d'ergonomie distinctes, mais toutes autour de la saisie assistée. **Bonne
nouvelle : le composant générique pour les deux premières existe déjà** —
`app/src/components/app/champ-autocomplete.tsx` (`ChampAutocomplete`), construit au lot R10
précisément pour généraliser l'autocomplétion déjà utilisée sur le catalogue d'articles de
Commandes. Son commentaire d'en-tête dit littéralement : « celui-ci prend ses options en
paramètre : il sert la fonction d'un employé, le choix d'un employé, et **demain les champs du
générateur d'actes** » — c'est exactement cette tâche. Lis ce fichier en entier avant de commencer :
il expose deux modes, `strict` (saisie libre conservée, suggestions seulement) et `strict: true`
(seule une option de la liste est acceptée) — à choisir selon chaque cas ci-dessous.

## Les trois demandes

### 1. Matricule auto-incrémenté à la création d'un employé

Fichier : `app/src/components/app/fiche-employe.tsx`, champ texte libre autour de la ligne 173
(`texte("matricule", "Matricule", "E009", true)`). Aujourd'hui, le matricule se saisit entièrement
à la main à la création d'un employé — risque de doublon ou d'erreur de frappe. Demande : proposer
automatiquement le prochain matricule disponible (pré-rempli, mais modifiable si la RH veut
l'ajuster — ne pas verrouiller le champ, juste le pré-remplir intelligemment).

Il faut une requête côté Convex qui détermine le prochain matricule logique à partir des matricules
existants (`app/convex/employes.ts` — chercher comment les employés sont listés/triés, et quel est
le format actuel des matricules dans les données réelles pour comprendre le motif à suivre : préfixe
fixe + numéro incrémental, ou autre). Si le format n'est pas strictement numérique partout, propose
simplement le numéro suivant le plus haut trouvé, en gardant le même format que le dernier matricule
connu.

### 2. Champ employé en autocomplétion sur l'écran Actes

Fichier : `app/src/pages/Actes.tsx`. La sélection du salarié pour lequel générer un acte utilise
aujourd'hui un menu déroulant classique (`<Select>` de `@/components/ui/select`, importé ligne 32).
Remplace-le par `ChampAutocomplete` en mode `strict: true` (un acte ne peut viser qu'un employé réel
de la base) — même type de champ que celui déjà utilisé pour la fonction d'un employé ou dans
Commandes pour un article.

### 3. Champ « Remplaçant » du congé (Planning)

Fichier : `app/src/pages/planning/FriseAnnuelle.tsx` — le champ s'appelle `remplacantTexte` dans
l'état du formulaire (lignes 52, 306, 359, 625-626, 676) et c'est aujourd'hui un simple champ texte
libre. Remplace-le par `ChampAutocomplete` préchargé avec la liste des employés. Choix du mode à
trancher : un remplaçant est presque toujours un employé existant, mais le champ s'appelle
`remplacantTexte` et est stocké comme texte libre (`ev.remplacant`) — donc le mode `strict: false`
(suggestions sans contraindre) est probablement le bon choix ici, pour ne pas bloquer un cas rare
où le remplaçant ne serait pas encore dans la base. Si tu changes cette décision, explique pourquoi
dans le compte rendu.

### 4. Date de naissance en sélecteur de date (écran Actes)

Fichier : `app/src/pages/Actes.tsx`. Le champ de date de naissance (utilisé dans la génération de
certains actes) se saisit aujourd'hui en texte libre, « en toutes lettres » selon le retour de la
RH — remplace-le par un sélecteur de date, cohérent avec les autres champs date de l'application
(chercher le composant de date déjà utilisé ailleurs dans le projet, par exemple sur les écrans de
planning ou de fiche employé, et réutiliser le même plutôt que d'en introduire un nouveau).

## Ce qui est attendu en sortie

- Les quatre points livrés, chacun avec son propre commit (ils touchent des écrans différents, pas
  de raison de les grouper).
- `npm run typecheck` vert.
- Test manuel : créer un nouvel employé (le matricule proposé est cohérent et modifiable), générer
  un acte en choisissant l'employé par autocomplétion, poser un congé avec un remplaçant suggéré par
  autocomplétion, saisir une date de naissance via le sélecteur.

## Avant de rendre

Écris un compte rendu dans `app/docs/rh/epics/comptes-rendus/epic-6.md` : pour chacun des quatre
points, ce qui a été fait, les choix tranchés (notamment le mode `strict` retenu pour le champ
remplaçant, et le format de matricule retenu), et tout cas limite rencontré (ex. un matricule déjà
non-numérique dans les données de test).

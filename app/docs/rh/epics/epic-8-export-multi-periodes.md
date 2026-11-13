# Épic 8 — Export sur plusieurs périodes (bulletins d'un employé, liste des salaires)

## Contexte

Tu travailles sur une plateforme RH/paie pour une clinique au Cameroun (POLYCLINIQUE DE POITIERS),
dans le worktree `C:\test\Js\poitiers-coworking-rh`, branche `rh` (déjà active, ne pas en changer).
Backend Convex (`app/convex/`), frontend React/Vite (`app/src/`), conventions et noms en français
partout — à respecter dans tes modifications.

Deux écrans d'export existent déjà mais ne couvrent qu'un seul axe de filtrage chacun ; la RH
demande à pouvoir filtrer sur l'autre axe aussi.

## Les deux demandes

### 1. Téléchargement groupé des bulletins d'UN employé sur PLUSIEURS mois

Fichiers probables : `app/src/pages/Bulletins.tsx`, `app/src/pages/MesBulletins.tsx`,
`app/convex/paiePdf.ts` (génération/archivage des PDF), `app/convex/archives.ts`. Aujourd'hui, le
téléchargement groupé existe pour *tous les employés d'un seul mois donné*, mais pas pour *un seul
employé sur un intervalle de plusieurs mois* (exemple donné par la RH : 6 mois d'affilée pour le
même employé). Lis d'abord comment le téléchargement groupé actuel assemble ses PDF (probablement
une fonction qui boucle sur les employés d'une période et concatène/zippe les PDF) pour réutiliser
le même mécanisme en inversant l'axe de boucle : un employé fixé, une liste de périodes en
paramètre plutôt qu'une période fixée et une liste d'employés.

### 2. Export de la liste des salaires sur un intervalle de périodes

Fichier : `app/src/pages/ListeSalaires.tsx`. Même limitation : l'export ne filtre aujourd'hui que
sur un mois. Ajouter la possibility de choisir un intervalle de périodes (mois de début, mois de
fin) plutôt qu'un mois unique, et faire en sorte que l'export (PDF ou autre format déjà utilisé
par cet écran) couvre bien l'ensemble de l'intervalle choisi — à voir si cela signifie un document
par mois (regroupés) ou un document consolidé ; si ce n'est pas précisé par la RH, pars sur un
document par mois regroupé dans un seul téléchargement (cohérent avec ce que fait déjà le
téléchargement groupé mensuel existant), et note ton choix dans le compte rendu.

## Démarche conseillée

1. Lire en entier le mécanisme d'export actuel pour chacun des deux écrans avant de toucher au
   code — comprendre comment la période unique est actuellement utilisée côté Convex (requête
   acceptant un seul `periode: v.string()`) et côté frontend (sélecteur de période unique,
   probablement `app/src/components/app/selecteur-periode.tsx`, à vérifier s'il existe déjà une
   variante « intervalle » réutilisable ou s'il faut l'ajouter).
2. Étendre la requête/mutation Convex concernée pour accepter soit une liste de périodes, soit une
   période de début et de fin (choisis la forme la plus simple pour l'appelant, cohérente avec le
   reste du code — regarde comment d'autres endroits du projet gèrent déjà un intervalle de dates
   si un motif existe).
3. Adapter l'interface : remplacer ou compléter le sélecteur de période unique par un sélecteur
   d'intervalle, sur les deux écrans.

## Ce qui est attendu en sortie

- Les deux exports fonctionnels sur un intervalle de plusieurs mois.
- `npm run typecheck` vert.
- Test manuel : télécharger les bulletins d'un employé sur au moins 3 mois consécutifs ; exporter
  la liste des salaires sur un intervalle de 2-3 mois.
- Un commit par écran (deux commits).

## Avant de rendre

Écris un compte rendu dans `app/docs/rh/epics/comptes-rendus/epic-8.md` : la forme retenue pour
l'intervalle de périodes côté Convex et côté interface, le choix fait pour le format de sortie
(document par mois regroupé, ou consolidé), et tout écran additionnel qui pourrait bénéficier du
même traitement mais n'a pas été touché.

# Épic 4 — Modales qui ne défilent pas (Services, Nouveau membre, aperçu Documents)

## Contexte

Tu travailles sur une plateforme RH/paie pour une clinique au Cameroun (POLYCLINIQUE DE POITIERS),
dans le worktree `C:\test\Js\poitiers-coworking-rh`, branche `rh` (déjà active, ne pas en changer).
Backend Convex (`app/convex/`), frontend React/Vite (`app/src/`), conventions et noms en français
partout — à respecter dans tes modifications.

La recette signale trois modales qui ne défilent pas quand leur contenu dépasse la hauteur
visible, sur des écrans différents. C'est probablement le même défaut structurel répété (un
conteneur de modale sans `overflow-y` correct, ou une hauteur fixe au lieu d'une hauteur maximale),
à corriger une bonne fois dans le composant partagé si les trois en utilisent un, plutôt que trois
fois séparément.

## Les trois modales concernées

### 1. Gestion des Services

Fichier : `app/src/pages/planning/GestionServices.tsx`. La modale ne devient pas scrollable quand
le nombre de services augmente, et sa hauteur croît jusqu'à **cacher le bouton de fermeture** —
c'est le symptôme le plus grave des trois : l'utilisateur se retrouve bloqué sans moyen visible de
fermer la modale (il faut connaître le raccourci Échap ou cliquer en dehors, si ça fonctionne).

### 2. Nouveau membre

Fichier : `app/src/pages/Membres.tsx`. Même défaut : la modale de création d'un nouveau membre ne
scrolle pas et bloque la page.

### 3. Aperçu d'un document (page Documents)

Fichier : `app/src/pages/Documents.tsx`. La modale d'aperçu se fige — l'utilisateur doit cliquer à
côté pour en sortir, ce qui suggère qu'au-delà du défilement, l'interaction de fermeture elle-même
est dégradée (pas seulement un problème visuel).

## Démarche conseillée

1. Reproduire les trois cas dans l'app (`npm run dev`), en forçant un contenu assez long pour
   dépasser la hauteur de l'écran (ex. ajouter temporairement plusieurs services de test pour le
   cas 1).
2. Identifier si les trois modales partagent un même composant de base (chercher dans
   `app/src/components/ui/` un composant `Dialog`/`Modal`/`Sheet` commun). Si oui, vérifier
   comment chacune de ces trois pages l'utilise : est-ce que l'une d'elles passe une hauteur fixe,
   ou omet une classe `overflow-y-auto`/`max-h-*` que les autres (qui fonctionnent bien ailleurs
   dans l'app) ont ?
3. Corriger la cause commune si elle existe, sinon corriger chaque modale individuellement en
   s'inspirant d'une modale de l'application qui, elle, défile déjà correctement (la modale de
   détail de la fiche employé a été citée comme exemple qui fonctionne).

## Ce qui est attendu en sortie

- Les trois modales scrollables, avec leur bouton de fermeture toujours visible/accessible même
  si le contenu dépasse la hauteur de l'écran.
- Pour la modale d'aperçu de document, vérifier aussi que la fermeture standard (bouton de
  fermeture ou Échap) fonctionne, pas seulement le clic en dehors.
- `npm run typecheck` vert.
- Un commit (ou plusieurs si les causes se révèlent indépendantes), message en français précisant
  si la cause était commune ou propre à chaque écran.

## Avant de rendre

Écris un compte rendu dans `app/docs/rh/epics/comptes-rendus/epic-4.md` : la cause trouvée (commune
ou par écran), le correctif, et confirmation que le bouton de fermeture reste accessible dans les
trois cas après correction.

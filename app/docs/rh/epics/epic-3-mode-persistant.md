# Épic 3 — Bugs d'affichage du mode « champs persistants » (saisie mensuelle)

## Contexte

Tu travailles sur une plateforme RH/paie pour une clinique au Cameroun (POLYCLINIQUE DE POITIERS),
dans le worktree `C:\test\Js\poitiers-coworking-rh`, branche `rh` (déjà active, ne pas en changer).
Backend Convex (`app/convex/`), frontend React/Vite (`app/src/`), conventions et noms en français
partout — à respecter dans tes modifications.

L'écran de saisie mensuelle de la paie (`app/src/pages/SaisieMensuelle.tsx`) propose un mode dit
« champs persistants » — un composant partagé, `app/src/components/app/saisie-persistante.tsx`,
qui garde certaines colonnes de saisie visibles/éditables en permanence plutôt que de les masquer
derrière un clic. La recette signale plusieurs défauts d'affichage dans ce mode précis (le mode
« champs masqués », normal, fonctionne correctement pour les mêmes données). Commence par lire les
deux fichiers en entier pour comprendre comment les colonnes sont définies et rendues, puis
reproduis chaque point ci-dessous dans l'app (`npm run dev`) avant de corriger.

## Les quatre défauts signalés

### 1. Acompte et Dette de soins apparaissent fusionnés dans un seul champ

En mode persistant, la colonne qui devrait distinguer **Acompte** et **Dette de soins** (deux
montants distincts, qui existent séparément en mode masqué) ne montre qu'un seul champ — la RH a dû
repasser en mode masqué pour les saisir séparément, avec le risque qu'une saisie faite en mode
persistant perde l'un des deux montants. Cherche dans `saisie-persistante.tsx` comment les colonnes
sont déclarées (probablement une liste ou un objet associant un identifiant de rubrique à un
rendu de cellule) et vérifie si Acompte et Dette de soins partagent par erreur la même clé, le même
état React, ou le même composant de saisie.

### 2. Prime et Retenue ne sont pas visibles dans la grille

Dans la grille de saisie en série, les colonnes Prime et Retenue n'apparaissent pas — que ce soit
en mode persistant ou dans l'un des deux modes (confirme lequel exactement en testant les deux).
La RH doit ressaisir ces montants « à l'aveugle », sans pouvoir vérifier la valeur déjà enregistrée.
Vérifie si ces deux colonnes sont simplement absentes de la définition des colonnes du mode
persistant, ou si elles sont présentes mais rendues avec une valeur toujours vide/undefined (bug
de lecture de la donnée plutôt que d'affichage de la colonne).

### 3. Une valeur se propage par erreur d'un champ à un autre (exemple observé : Sanctions)

En mode persistant, un champ (Sanctions, dans l'exemple remonté) a affiché une valeur que la RH
venait de saisir dans un AUTRE champ ou dans l'autre mode (8 000 F, apparu à tort dans Sanctions).
C'est le signe d'un état partagé par erreur entre deux champs — à chercher côté React : une clé de
`useState`/`Map` mal distinguée entre rubriques (deux champs qui liraient ou écriraient la même clé
dans l'état local ou dans l'objet de saisie envoyé au serveur).

### 4. Le montant calculé affiché à côté du champ mutuelle se colle visuellement au chiffre saisi

Mode persistant, colonne mutuelle : un chiffre saisi (ex. 150) et le montant calculé affiché juste à
côté manquent d'un espace ou d'un séparateur — purement visuel (CSS/mise en page), pas une erreur de
calcul. Corrige l'espacement/la mise en page de cette cellule précise.

### 5. L'en-tête de la colonne « Noms et prénoms » scrolle au-dessus du titre figé

Toujours en mode persistant : pendant le défilement vertical du tableau, l'en-tête de la colonne
« Noms et prénoms » défile AU-DESSUS de son titre de colonne (donc son en-tête se désolidarise ou se
superpose mal), alors que les autres colonnes restent correctement figées (`sticky`) pendant le même
défilement. À chercher côté CSS : un `position: sticky`/`z-index` manquant ou mal ordonné
spécifiquement sur cette colonne, probablement parce qu'elle sert aussi de colonne figée
horizontalement (double sticky, ligne + colonne) et que l'empilement des deux entre en conflit.

### 6. La modale « Primes fixes / congé » du mode persistant ne scrolle pas

Une fois ouverte, cette modale ne permet pas de défiler son contenu — contrairement à la modale de
détail de la fiche employé, qui scrolle normalement. Compare les deux implémentations (la modale
« Primes fixes / congé » est probablement déclenchée depuis `saisie-persistante.tsx` ou
`SaisieMensuelle.tsx` ; cherche le composant de modale réutilisé dans `app/src/components/ui/`)
pour voir ce qui diffère dans la structure (hauteur fixe sans `overflow-y: auto`/`overflow-y:
scroll` sur le bon conteneur, probablement).

## Ce qui est attendu en sortie

- Les six points reproduits dans l'app avant correction (confirme ou précise le symptôme réel —
  les descriptions ci-dessus viennent d'un retour oral de la RH, pas d'une inspection du code).
- Chaque point corrigé. Regroupe les commits par cause commune plutôt que par numéro — probable que
  1-4 partagent une cause (même composant de grille) et que 5-6 soient plus proches l'un de l'autre
  (sticky/scroll) ; à toi de juger une fois le code lu.
- `npm run typecheck` vert.
- Test manuel dans l'app, mode persistant ET mode masqué, sur Acompte, Dette de soins, Prime,
  Retenue, Sanctions, Mutuelle : chaque champ affiche et conserve sa propre valeur, sans
  interférence avec un autre champ ni avec le changement de mode. Puis vérifie le défilement de la
  colonne Noms et prénoms et de la modale Primes fixes / congé.

## Avant de rendre

Écris un compte rendu dans `app/docs/rh/epics/comptes-rendus/epic-3.md` : pour chacun des 6 points,
ce que tu as observé en reproduisant, la cause trouvée, le correctif. Si un des points ne se
reproduit pas du tout (comportement déjà correct), dis-le — ne force pas une correction sur un
symptôme que tu ne peux pas constater.

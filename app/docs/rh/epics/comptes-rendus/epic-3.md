# Épic 3 — Bugs d'affichage du mode « champs persistants » — compte rendu

## Note méthodologique : le déploiement Convex partagé est injoignable

`app/.env.local` pointe vers `vivid-okapi-830`, déjà signalé obsolète dans
`PASSATION-DEPLOIEMENT.md` (06/11/2026, six lots de retard) et déjà contourné par les deux agents
précédents (épics 1 et 2, voir leurs comptes rendus). J'ai vérifié l'état exact avant de commencer :
le WebSocket Convex s'ouvre puis se ferme immédiatement (`code 1000`, fermeture propre, sans
rouvrir), reproduit avec un WebSocket brut ouvert directement depuis la page (hors client Convex) —
le déploiement ne répond plus du tout, ce n'est pas un problème d'authentification ni de requête.

Cet épic porte spécifiquement sur de l'affichage React/CSS, donc un test réel dans un navigateur
était non négociable. J'ai construit un **harnais de test temporaire** (`app/test-epic3.html` +
`app/src/dev/testEpic3Harness.tsx`, supprimés avant ce commit, jamais committés) qui monte les
**vrais composants de production** (`RecapToutVisible`, `RecapSynthese`, `useFiltreRecap` importés
tels quels depuis `src/pages/recap/`) avec des données factices (14 employés fictifs, aucune donnée
de `modele/`) et une implémentation du brouillon reprenant exactement la logique de `useBrouillon`
(commun.tsx), mais persistant dans une variable locale au lieu d'un `saisir` Convex. Tous les
constats ci-dessous viennent d'interactions réelles (clic, frappe, défilement) dans Chrome sur ce
harnais, avec mesure DOM précise (`getBoundingClientRect`, styles calculés) quand l'œil ne suffisait
pas à trancher — pas d'une relecture du code seule.

## Les six points

### 1. Acompte et Dette de soins fusionnés — NE SE REPRODUIT PAS

Dans le code actuel, ce sont deux colonnes et deux `Champ` bien distincts (`dettesSoins`,
`acompte`), chacun avec sa propre `CelluleInline`. Testé en direct : j'ai saisi **12 000** dans
« Dettes de soins » et **8 000** dans « Acompte / dette » sur la même ligne — les deux valeurs sont
restées strictement indépendantes, affichées et enregistrées séparément, sans interférence. Le
commentaire de `commun.tsx` (`totaux()`, ligne ~311) date cette séparation du 21/10/2026 : le défaut
remonté par la RH correspond probablement à une version antérieure à cette date. Aucun correctif
nécessaire.

### 2. Prime et Retenue invisibles dans la grille — NE SE REPRODUIT PAS comme régression du mode persistant

Vérifié colonne par colonne dans les deux modes : toutes les rubriques `Champ` (y compris
`primesVariables`, libellée « Primes fixes ») sont représentées dans les deux écrans. La seule
différence entre modes est que `primesVariables` (et 13 autres rubriques) sont groupées derrière un
clic dans la cellule composée « Primes fixes / congé » en mode persistant (`CellulePopover`), alors
qu'elles sont des champs directement visibles en mode masqué (`FicheSaisie`, groupe « Gains ») — un
clic de plus, mais rien n'est « invisible » ni vide par défaut (zéro bug de lecture de donnée
constaté).

En revanche, j'ai identifié une **vraie absence**, mais commune aux deux modes, donc hors du
périmètre « régression du mode persistant » de cet épic : les lignes libres du registre
« Primes / Retenues » (`app/src/pages/Primes.tsx`, table `primesCharges`, codes `prime`/`charge`)
ne sont itemisées **nulle part** dans l'écran Saisie Mensuelle — ni en mode persistant, ni en mode
masqué. `commun.tsx` (`apercuBulletin`, lignes 281-283) les relit uniquement pour les replier dans
l'aperçu Total 1/Total 2 de la fiche de saisie (masqué) ; aucun des deux tableaux n'affiche leur
libellé/montant individuel. Si c'est ce que la RH appelle « Prime et Retenue », la correction est une
fonctionnalité nouvelle (itemiser ces lignes quelque part dans la grille), pas un correctif d'un
bug de régression propre au mode persistant — je ne l'ai pas forcée, à signaler séparément au
porteur produit.

### 3. Une valeur « se propage » d'un champ à un autre (ex. Sanctions) — REPRODUIT, cause trouvée et corrigée

Pas de fuite de **valeur** : en tapant 12 000 dans Dettes de soins puis 8 000 dans Acompte sur la
même ligne, le champ Sanctions restait bien vide au focus (vérifié à l'écran). La fuite est une fuite
d'**état visuel**. `useBrouillon` (`commun.tsx`) exposait `modifie(id)`, qui répond pour **toute la
ligne** dès qu'UNE seule rubrique a une saisie en attente (`!!brouillon[id]`). `RecapToutVisible`
utilisait ce même booléen comme prop `modifie` de **chaque** `CelluleInline` de la ligne. Résultat
constaté à l'écran : saisir 5 dans Mut. % surlignait en ocre (style « saisie en attente ») **toutes**
les autres cases de la ligne — Jours trav., Sanctions, Absence, Dettes de soins, Acompte/dette,
Heures sup, Ancienneté — y compris celles jamais touchées, pendant toute la fenêtre
d'enregistrement automatique (~800 ms). C'est exactement le genre de signal qui fait dire « une
valeur vient d'apparaître dans Sanctions » quand on observe vite un œil sur la ligne.

**Correctif** : nouvelle fonction `modifieChamp(id, champs)` dans `commun.tsx` (`useBrouillon`), qui
ne regarde que la ou les rubriques demandées (`brouillon[id]?.[c] !== undefined`) au lieu de la ligne
entière ; accepte un tableau pour les cellules composées. `RecapToutVisible.tsx` : chaque
`CelluleInline` (fonction `cel`) utilise désormais `brouillon.modifieChamp(id, c)` au lieu de
`brouillon.modifie(id)` ; la cellule composée « Primes fixes / congé » (`CellulePopover`) utilise
`brouillon.modifieChamp(id, champs)` sur la liste de ses 14 sous-rubriques. Revérifié à l'écran :
saisir Mut. % ne surligne plus désormais QUE Mut. % ; le badge de ligne « Modifié… » (qui, lui,
reste volontairement par ligne) n'a pas changé de comportement.

### 4. Mutuelle collée au champ voisin — REPRODUIT, cause trouvée et corrigée

Mesure DOM précise sur la colonne « Mut. % » (46 px déclarés, la plus étroite de la grille) : son
`<input>` (classe par défaut de `CelluleInline`, `min-w-[3.25rem]` = 52 px) débordait physiquement du
`<td>` qui le contient (52 px d'entrée contre ~32 px de place utile une fois la marge `px-2` du
`<td>` retirée), empiétant d'environ 12 px sur la colonne « Mutuelle » voisine — d'où l'absence
d'espace visible entre le pourcentage saisi et le montant calculé juste à côté, observé à l'écran
avec « 25 » et « 7 500 » collés.

**Correctif** (ciblé sur cette seule cellule, sans toucher aux largeurs calibrées des 18 colonnes ni
au composant partagé `CelluleInline`) : `RecapToutVisible.tsx`, la cellule Mut. % passe désormais
`className="min-w-[1.75rem]"`, qui l'emporte sur le `min-w-[3.25rem]` par défaut via `tailwind-merge`
(`cn()`, `src/lib/utils.ts`). Revérifié par mesure : l'entrée tient dans les ~32 px disponibles, plus
aucun chevauchement ; un espace net sépare visuellement le pourcentage du montant, au focus comme au
repos.

### 5. L'en-tête « Noms et prénoms » scrolle au-dessus de son titre — REPRODUIT, cause trouvée et corrigée

Reproduit à l'écran en faisant défiler le tableau verticalement : les autres en-têtes restaient
fixes, mais au bon endroit où devait apparaître « Noms et prénoms », on voyait la ligne de données
qui défilait en dessous (ex. « AGENT TEST 06 ») — exactement comme si la ligne de corps recouvrait
l'en-tête de cette seule colonne. Confirmé en masquant temporairement la cellule de corps
correspondante (`visibility: hidden`) : « Noms et prénoms » réapparaissait alors dessous — c'est donc
bien un problème de superposition (ordre de peinture), pas de perte de la stickiness.

**Cause exacte**, trouvée par inspection des styles calculés : `<thead>` est lui-même
`position: sticky` (`z-10`), ce qui lui fait former **sa propre pile d'empilement** — le `z-20`
déclaré sur le `<th>` « Noms et prénoms » n'est comparé qu'à ses frères **à l'intérieur de ce
thead**, jamais à des éléments extérieurs. Vu du corps du tableau, tout le `<thead>` ne vaut que son
propre `z-index` (10). Or la première cellule de chaque ligne du corps (`<td>` figé horizontalement)
est elle aussi `position: sticky; z-10` — exactement À ÉGALITÉ avec le `<thead>` de l'extérieur. Une
égalité de `z-index` se départage par l'ordre du DOM, et `<tbody>` vient après `<thead>` : la ligne
qui défilait sous l'en-tête le recouvrait donc, plutôt que de disparaître dessous comme attendu.

**Correctif** : `RecapToutVisible.tsx`, le `<thead>` passe de `z-10` à `z-20` (commentaire ajouté
expliquant pourquoi). Testé en isolant la variable (changement de `z-index` seul, sans toucher à
`border-collapse` ni au `<th>`) : le défilement n'affiche plus jamais de ligne de corps par-dessus
l'en-tête, sur toute la hauteur du tableau.

### 6. La modale « Primes fixes / congé » ne scrolle pas — REPRODUIT, cause trouvée et corrigée

Reproduit à l'écran : avec les 14 rubriques du popover (Primes fixes, Transport, Prime assiduité,
Indemnité logement, Ancienneté, Prime caisse, Prime rendement, Gratification, Prime salissure, Prime
panier, Prime lait, Ind. représentation, Ind. véhicule, Ind. outillage), le contenu débordait du
haut de la fenêtre sans aucune possibilité de défilement — les premières rubriques étaient
totalement inaccessibles. Comparé au code : `PopoverContent` (`components/ui/popover.tsx`, base
partagée) ne pose ni `max-height` ni `overflow-y-auto` par défaut — exactement comme `DialogContent`
(`components/ui/dialog.tsx`) ne le fait pas non plus par défaut. La modale « Fiche employé », qui
scrolle correctement, le doit à un ajout **local** dans `fiche-employe.tsx`
(`className="max-h-[92vh] overflow-y-auto sm:max-w-2xl"`) — jamais fait pour le popover « Primes
fixes / congé ».

**Correctif** : `RecapToutVisible.tsx`, `CellulePopover` → `PopoverContent` passe de
`className="w-72 p-3"` à `className="w-72 max-h-[70vh] overflow-y-auto p-3"`, même logique que la
fiche employé. Revérifié : le contenu scrolle réellement (`scrollHeight` 1035 px contre
`clientHeight` ~491 px après correctif, `overflow-y: auto` appliqué), et le pied (Total, Annuler,
Enregistrer) reste atteignable. Limite constatée dans mon harnais de test (fenêtre de ~700 px de
haut) : le popover, positionné par Radix au-dessus de la ligne cliquée faute de place suffisante,
peut encore déborder du HAUT de la fenêtre du navigateur selon la hauteur d'écran réelle et la
position de la ligne cliquée — c'est un comportement de positionnement (collision Radix), orthogonal
au défilement interne que demandait ce point, et qui touche potentiellement aussi la modale Fiche
employé dans une fenêtre très basse. Pas creusé plus loin : hors du symptôme précis décrit par le
point 6.

## Regroupement des commits

- **Points 3 et 4** (même fichier, même mécanisme de cellule de saisie) : un commit —
  `commun.tsx` (nouvelle fonction `modifieChamp`) + `RecapToutVisible.tsx` (usage de
  `modifieChamp` et largeur de la cellule Mut. %).
- **Points 5 et 6** (sticky / scroll, tous deux dans `RecapToutVisible.tsx`) : un commit.
- Points 1 et 2 : aucun correctif (ne se reproduisent pas comme décrit), documentés ci-dessus.

## Vérifications

- `npm run typecheck` : vert.
- Harnais de test supprimé avant ce commit (`app/test-epic3.html`,
  `app/src/dev/testEpic3Harness.tsx`) — jamais committé, aucune trace dans l'arbre de travail final.
- Aucune lecture ni copie du dossier `modele/` ; données 100 % factices (14 « AGENT TEST NN »).
- Mode masqué (`RecapSynthese`) revérifié après les deux commits : fonctionne toujours normalement
  (fiche de saisie, groupes Temps de travail / Gains / Retenues, badge « Enregistré »), aucune
  régression — cohérent avec le fait que les deux correctifs ne touchent que du code propre au mode
  persistant (`RecapToutVisible.tsx`) et une fonction additive dans le socle commun (`modifieChamp`,
  qui n'a remplacé aucun appel existant côté mode masqué).

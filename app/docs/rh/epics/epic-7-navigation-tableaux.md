# Épic 7 — Navigation et tableaux : ligne cliquable, colonne figée, défilement automatique, sidebar, pagination

## Contexte

Tu travailles sur une plateforme RH/paie pour une clinique au Cameroun (POLYCLINIQUE DE POITIERS),
dans le worktree `C:\test\Js\poitiers-coworking-rh`, branche `rh` (déjà active, ne pas en changer).
Backend Convex (`app/convex/`), frontend React/Vite (`app/src/`), conventions et noms en français
partout — à respecter dans tes modifications.

Cinq demandes d'ergonomie transverses, remontées par la RH pendant la recette. Elles touchent des
écrans différents et sont indépendantes — traite-les une par une, avec un commit par point. C'est
le plus gros des épics de ce lot : si tu manques de temps, livre les points dans l'ordre ci-dessous
(du plus simple au plus structurant) et dis clairement dans le compte rendu lesquels restent à
faire plutôt que de les bâcler.

## Les cinq demandes

### 1. Ligne d'employé entièrement cliquable (le plus simple)

Fichier : `app/src/pages/Employes.tsx`. Aujourd'hui, cliquer n'importe où sur une ligne du tableau
n'ouvre rien — seul le crayon (icône d'édition) à droite de la ligne ouvre la fiche. La RH demande
à rendre toute la ligne cliquable, **si cela ne nuit pas à l'ergonomie** (elle pose elle-même la
question) : vérifie qu'aucune autre interaction utile n'existe déjà sur la ligne (case à cocher
pour une sélection multiple, bouton secondaire…) avant d'ajouter un `onClick` sur toute la `<tr>` ;
si un tel conflit existe, dis-le dans le compte rendu plutôt que de l'ignorer.

### 2. Défilement automatique vers le contenu ouvert

Plusieurs écrans : cliquer sur un salarié pour ouvrir son bulletin (ou une ligne pour ouvrir une
intervention, un récapitulatif de salaire, une commande) affiche le contenu plus bas sur la page
sans faire défiler automatiquement la vue vers lui — la RH doit chercher où le contenu est apparu.
Écrans concernés, au moins : Bulletins, Interventions, Récapitulatif salaires
(`app/src/pages/recap/`), Commandes/Approvisionnement (`app/src/pages/Commandes.tsx`). Cherche si
ces écrans partagent un schéma commun (ouverture d'un panneau de détail sous la ligne cliquée) —
si oui, un seul `ref.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })` déclenché à
l'ouverture, factorisé une fois, peut couvrir plusieurs écrans. Sinon, traite chaque écran
séparément.

### 3. Colonne figée sur les tableaux en lecture seule (exemple cité : DIPE)

Fichier : `app/src/pages/Dipe.tsx`, et probablement d'autres tableaux larges en lecture seule du
même type. Sur un tableau large avec défilement horizontal, impossible de savoir à quelle ligne
(quel employé) correspond une cellule une fois le scroll horizontal engagé — même sur ordinateur.
Demande : une colonne « nom » (ou équivalent identifiant la ligne) figée horizontalement
(`position: sticky; left: 0`) pendant le défilement du reste du tableau. Vérifie si
`app/src/components/ui/table.tsx` offre déjà un support pour une colonne figée (un prop, une classe
utilitaire) — sinon, ajoute-le proprement à ce niveau pour que d'autres tableaux larges du projet
puissent le réutiliser plus tard, sans aller au-delà de ce qui est demandé ici.

### 4. Repli de la barre latérale qui bloque le défilement de la page

Fichier : `app/src/components/Layout.tsx` (le composant `SidebarContent`, autour de la ligne 115,
et la zone de rendu desktop/mobile autour des lignes 389-410). Replier la barre latérale (par
exemple en ouvrant un récapitulatif qui la replie automatiquement) empêche ensuite de faire défiler
la page. La RH demande un système d'affichage à bascule — ouverte ou repliée, au choix de
l'utilisateur, en rail persistant — plutôt qu'un repli automatique qui bloque le scroll. Diagnostique
d'abord : est-ce le repli automatique en lui-même qui casse le scroll (une classe `overflow: hidden`
posée sur le body/le conteneur principal pendant la transition et jamais retirée), ou est-ce
l'affichage repliée elle-même qui est buggée indépendamment de l'automatisme ? Corrige la cause
réelle — pas seulement l'automatisme si le bug de scroll existe aussi en repli manuel.

### 5. Pagination généralisée sur les tableaux de l'application

Il n'existe aujourd'hui aucun composant de pagination partagé : seuls `app/src/pages/Courrier.tsx`
et `app/src/pages/PrimesMedecins.tsx` ont un mécanisme de limitation du nombre de lignes affichées,
chacun à sa façon, ad hoc. Sur une base de plusieurs centaines d'employés, le sélecteur actuel
(nombre de lignes affichées, sans découpage en pages) ne suffira plus. Demande : un composant de
pagination réutilisable (page suivante/précédente, numéro de page, nombre de lignes par page),
posé au moins sur les tableaux les plus volumineux de l'application — à toi d'identifier lesquels
en regardant les écrans de liste (Employés, DIPE, Bulletins, Liste des salaires, Archives…). Ne
vise pas l'exhaustivité si le temps manque : livre le composant partagé, pose-le sur 2-3 tableaux
clés, et liste dans le compte rendu les écrans restants qui pourraient en bénéficier.

## Ce qui est attendu en sortie

- Les cinq points traités (ou, à défaut de temps, clairement priorisés et documentés dans le
  compte rendu — voir ci-dessus).
- Un commit par point.
- `npm run typecheck` vert.

## Avant de rendre

Écris un compte rendu dans `app/docs/rh/epics/comptes-rendus/epic-7.md` : pour chacun des cinq
points, ce qui a été livré, les écrans couverts (en particulier pour les points 2, 3 et 5 qui
touchent potentiellement plusieurs écrans), et ce qui reste à étendre à d'autres écrans si tu n'as
pas tout couvert.

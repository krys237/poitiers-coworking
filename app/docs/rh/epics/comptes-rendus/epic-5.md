# Épic 5 — Pages cassées en version mobile — compte rendu

## Note méthodologique

`app/.env.local` pointe toujours vers `vivid-okapi-830` (déploiement de preview signalé mort dans
les comptes rendus des épics précédents) : chargée en émulation mobile, l'application reste bloquée
sur « Vérification de votre session… » (`useMe()` / `useQuery(api.users.me)` qui ne répond jamais),
avant même d'atteindre Connexion, Commandes ou Planning. Je n'ai ni tenté de relancer ni de
redéployer ce backend — hors de mon périmètre.

J'ai donc construit, pour les trois pages, un **harnais de test temporaire** (deux fichiers,
`app/src/pages/__harnais_epic5_planning.tsx` et `app/src/pages/__harnais_epic5_tmp.tsx`, plus les
routes correspondantes ajoutées temporairement dans `App.tsx`) — **supprimés avant ce commit, jamais
committés**, `git status` revérifié après coup. Le harnais :

- monte les **vrais composants partagés de production** (`Tabs`/`TabsList`/`TabsTrigger`,
  `PageEnTete`, `SelecteurPeriode`, `Table`/`TableCell`, `Card`, `CircuitApprovisionnement`, et pour
  Connexion le composant `Login` lui-même, importés tels quels depuis `src/`) ;
- reproduit la structure et les classes CSS exactes des zones visées, avec des données factices,
  sans dépendre des hooks Convex qui bloquent (`useQuery`, `useMe`) ;
- est chargé dans un `<iframe>` de 390×844 px (gabarit mobile courant) embarqué dans une page de
  l'app elle-même — nécessaire car le redimensionnement réel de la fenêtre du navigateur
  (`resize_window`) n'a eu aucun effet mesurable dans cet environnement (`window.innerWidth` restait
  à 1536 après la commande) ; l'iframe, lui, impose une vraie largeur de viewport indépendante de la
  fenêtre hôte.

Pour chaque page, la vérification « pas de défilement horizontal de la page » a été mesurée en DOM
(`document.documentElement.scrollWidth === clientWidth` à l'intérieur de l'iframe), en plus de la
capture d'écran. Aucune lecture ni copie du dossier `modele/`.

## 1. Page Connexion (`app/src/auth/Login.tsx`, `app/src/auth/auth.css`)

**Observé avant correctif (attendu d'après le code, confirmé par lecture et par le harnais à
390 px)** : les deux `<input>` (e-mail, mot de passe) n'avaient pas de classe partagée et héritaient
de `font-size: 14px` posé sur `.auth-modale .auth-form input` — en dessous du seuil de 16px à partir
duquel Safari iOS n'applique plus son zoom automatique au focus (la mise en page reste ensuite
déformée, le navigateur ne dézoomant pas tout seul à la saisie suivante). `.auth-scene` n'avait que
`min-height: 100vh` (hauteur de la fenêtre de mise en page, qui ignore la réduction de hauteur
visible quand le clavier virtuel s'ouvre) : la modale, ancrée en bas (`align-items: flex-end`),
pouvait se retrouver partiellement masquée par le clavier sur certains appareils.

**Correctif** : `className="auth-champ"` ajouté sur les deux `<input>` ; taille de police des champs
passée de `14px` à `16px` ; `min-height: 100dvh` ajouté après `min-height: 100vh` (le second l'emporte
sur les navigateurs qui le supportent ; repli automatique sur `vh` sinon).

**Revérifié après correctif** (harnais, `Login` monté directement dans l'iframe 390×844) :
- `getComputedStyle(input).fontSize` → `"16px"` sur le champ e-mail (classe `.auth-champ` bien
  appliquée).
- `getComputedStyle(scene).minHeight` → résolu à la hauteur réelle du viewport de l'iframe
  (`840.8px`, égale à `window.innerHeight`), confirmant que `100dvh` est pris en compte et non
  ignoré — je n'ai pas pu simuler l'ouverture réelle du clavier virtuel mobile dans cet
  environnement (Chrome desktop piloté, pas d'émulateur de clavier), donc ceci confirme que la
  propriété s'applique correctement, pas le comportement visuel exact pendant la frappe.
- Aucun défilement horizontal de la page (`scrollWidth === clientWidth`, 387 px).
- Capture d'écran : la modale de connexion s'affiche entièrement dans le cadre 390 px, logo, titre,
  bascule e-mail/téléphone, champ e-mail (bordure active bleue au focus visible), champ mot de passe
  — rien ne déborde.

## 2. Page Commandes (`app/src/pages/Commandes.tsx`)

Trois défauts distincts repérés par lecture du code (même minimisation de page, trois causes
indépendantes, comme attendu par l'épic) et chacun reproduit/revérifié dans le harnais :

**a) Onglets de type de commande** (« Médicaments (DCI) », « Fournitures générales », « Réactifs
Labo ») : le conteneur n'avait qu'un `inline-flex` sans contrainte de largeur ni défilement propre —
sur 390 px, les trois onglets dépassaient la largeur de l'écran, poussant toute la page en
défilement horizontal. *Correctif* : `max-w-full overflow-x-auto` ajoutés au conteneur.
**Revérifié** : capture à 390 px — « Médicaments (DCI) » et « Fournitures générales » visibles,
« Réactifs Labo » coupé avec une barre de défilement visible *sous les onglets eux-mêmes*, page sans
défilement horizontal propre (`scrollWidth === clientWidth`, 377 px).

**b) Barres d'actions (création et édition du bon)** : `flex items-center justify-end gap-2` sans
possibilité de rétrécir ni de passer à la ligne — sur mobile, « Valider et soumettre le bon de
commande » poussait « Annuler » hors du cadre visible de la `Card` (`overflow-hidden`), bouton
inatteignable. *Correctif* : `flex flex-col-reverse ... sm:flex-row sm:items-center sm:justify-end`
(les deux barres, création et édition). **Revérifié** : capture à 390 px — les deux boutons
s'empilent verticalement, le bouton principal (« Valider et soumettre… ») en haut, « Annuler »
en dessous, tous deux entièrement visibles dans le cadre de la carte.

**c) Cellule de la fiche dépliée** (`<td colSpan={8}>` sous la ligne sélectionnée, qui contient
elle-même une `Card` avec un stepper à 4 étapes en ligne non-wrappant,
`CircuitApprovisionnement`) : sans contrainte de largeur sur le `<td>`, la largeur naturelle de ce
contenu remontait à la cellule puis à la table entière, qui s'élargissait au-delà de l'écran.
*Correctif* : `w-px min-w-full` ajoutés au `<td>` (technique standard : `width: 1px` retire la
contribution de cette cellule au calcul de largeur des colonnes, `min-width: 100%` la force ensuite à
occuper toute la largeur de la ligne une fois la table posée). **Revérifié** : harnais avec le même
stepper monté dans la fiche dépliée — `scrollWidth === clientWidth` (377 px) conservé même déplié,
boutons de la fiche (« Modifier ce bon », « Bon Proforma », « Exporter CSV ») visibles ou atteignables
par défilement interne, jamais par défilement de toute la page.

## 3. Page Planning des absences (`app/src/pages/Planning.tsx`)

C'est bien ce fichier (pas `FriseAnnuelle.tsx`, hypothèse de l'épic écartée après lecture — le
sous-composant n'est que le contenu de l'onglet « Planning annuel », les onglets eux-mêmes sont
posés dans `Planning.tsx`).

**Observé** : les trois libellés de la `TabsList` (« Planning annuel », « Absences du mois »,
« Soldes & jours travaillés ») existent à **deux** endroits distincts (dans les actions de
`PageEnTete` pour la vue annuelle, et dans la barre d'outils flexible pour les vues mensuelles) et
causent le même symptôme dans les deux cas, pour une raison différente de Commandes : ici le
`<Tabs>` est un simple `flex` **sans** contrainte de rétrécissement (`min-width: auto` par défaut
sur un enfant flex) — poser `max-w-full overflow-x-auto` sur la seule `TabsList` ne sert à rien tant
que son parent (`Tabs`) refuse lui-même de rétrécir sous la largeur de son contenu : c'est tout le
conteneur parent (l'en-tête de page, ou la barre d'outils) qui héritait de cette largeur minimale et
partait en défilement horizontal.

**Correctif** : `className="min-w-0"` ajouté sur les deux `<Tabs>` (vue annuelle et vue mensuelle),
en plus du `max-w-full overflow-x-auto` déjà prévu sur leurs `TabsList` respectives.

**Revérifié** (harnais : les deux emplacements de `Tabs` reconstitués avec `PageEnTete`,
`SelecteurPeriode` et la barre de recherche réels, dans l'iframe 390×844, bascule testée sur les
trois onglets) :
- Vue mensuelle (« Absences du mois » actif par défaut) : `scrollWidth === clientWidth` (387 px).
  Capture : la ligne d'outils (sélecteur de période, « novembre 2026 », texte d'acquisition) passe à
  la ligne par `flex-wrap`, puis la `TabsList` affiche son propre défilement interne — page sans
  défilement horizontal.
- Bascule sur « Planning annuel » (clic réel dans le harnais) : même mesure (`scrollWidth ===
  clientWidth`), les trois onglets restent accessibles par défilement interne de la `TabsList`
  (« Planning annuel » partiellement coupé à gauche, « Absences du mois » actif visible, « Soldes &
  jours travaillés » coupé à droite, barre de défilement visible sous les trois).
- Bascule sur « Soldes & jours travaillés » (clic réel) : même résultat, page toujours sans
  défilement horizontal.

## Fichiers modifiés

- `app/src/auth/Login.tsx` — `className="auth-champ"` sur les deux `<input>`.
- `app/src/auth/auth.css` — `.auth-scene` : `min-height: 100dvh` ajouté ; `.auth-modale .auth-form
  input` : `font-size` 14px → 16px.
- `app/src/pages/Commandes.tsx` — onglets de type en `overflow-x-auto` ; deux barres d'actions en
  `flex-col-reverse sm:flex-row` ; cellule de la fiche dépliée en `w-px min-w-full`.
- `app/src/pages/Planning.tsx` — les deux `<Tabs>` en `min-w-0`, leurs `TabsList` en `max-w-full
  overflow-x-auto`.

Trois commits distincts (un par page), comme demandé par l'épic — les causes sont indépendantes
malgré un symptôme partagé (défilement horizontal).

## Vérifications

- `npm run typecheck` : vert.
- Harnais de test supprimés avant ce commit (`app/src/pages/__harnais_epic5_planning.tsx`,
  `app/src/pages/__harnais_epic5_tmp.tsx`, et les routes temporaires dans `App.tsx`) — jamais
  committés, aucune trace dans l'arbre de travail final (`git status` revérifié après suppression :
  seuls les quatre fichiers de code listés ci-dessus sont modifiés).
- Les trois pages vérifiées sans défilement horizontal à 390 px (gabarit mobile courant), par mesure
  DOM et par capture d'écran, dans un harnais utilisant les vrais composants partagés de
  production — le backend Convex de recette étant injoignable, aucun test avec des données réelles
  n'a été possible dans cet environnement.

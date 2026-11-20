# S2 · Centre de notifications

> **Dépend de** : S1 livré.
> **Modifie le schéma** : non (sauf un champ optionnel sur `users`, voir §5).
> **Dépendance externe** : aucune. Aucune dépendance npm nouvelle.

---

## 1. Objectif

Rendre visible ce que S1 écrit. C'est le lot que l'utilisateur voit, et le premier qui apporte
de la valeur sur le terrain.

**Lis `.agents/skills/poitiers-ui-ux-system/SKILL.md` (racine du dépôt) avant d'écrire une
ligne de JSX.** La charte « Ocean Breeze » n'est pas une suggestion dans ce projet.

### Dans le périmètre

- La **cloche et son badge** dans l'en-tête.
- Le **panneau déroulant** des notifications récentes.
- L'**écran d'historique** complet, avec filtres.
- Lu / non-lu, et le clic qui emmène sur l'objet concerné.
- Les **préférences par membre et par type**.

### Hors périmètre

- Aucun canal sortant (S3, S4).
- Aucun nouvel événement au catalogue de S1.
- Aucun groupement intelligent par objet : affichage chronologique. Le regroupement est une
  amélioration possible plus tard, pas un besoin exprimé.

---

## 2. Le point de départ : la cloche existe déjà, morte

Dans `app/src/components/Header.tsx`, `Bell` est importé de `lucide-react` (ligne 9) et rendu
à la ligne 129, dans un bouton **sans badge, sans compteur et sans action**. C'est un décor.

Ton travail est de le rendre vivant, pas d'en ajouter un second.

---

## 3. La cloche et son badge

Nouveau composant `app/src/components/app/cloche-notifications.tsx`, monté dans `Header.tsx`
en remplacement du bouton inerte.

- Lit `api.notifications.nonLues`. Convex est réactif : **aucun polling, aucun
  `setInterval`.** Le compteur se met à jour tout seul quand une ligne est écrite.
- Le badge affiche le nombre, et **`99+`** si `tronque` est vrai (S1 borne la lecture à 100).
- Pas de badge quand le compteur est à zéro — pas un « 0 » affiché.
- Teinte du badge selon l'importance la plus élevée parmi les non-lues :
  `info` → `--ocean-profond`, `a_traiter` → ambre, `urgent` → carmin. Une seule pastille,
  pas trois compteurs.
- **Aucune puce ronde de couleur** : la charte l'interdit formellement. Le nombre dans une
  capsule suffit.
- État de chargement : la cloche s'affiche **sans badge** pendant que la query revient.
  Ne mets pas de squelette qui saute.

## 4. Le panneau

Ouvert au clic sur la cloche. Utilise `components/ui/popover.tsx`, qui existe déjà — ne
réinvente pas de menu flottant.

- Les **15 plus récentes**, non lues en tête, puis les lues du jour.
- Une ligne porte : la pastille d'importance (`components/ui/flag.tsx`, variante existante),
  le titre, le corps en une ligne tronquée, l'heure relative (« il y a 12 min »), et le nom
  de l'acteur s'il y en a un.
- **Clic sur une ligne** : marque la notification lue (`marquerLue`) **et** navigue vers
  `lien`. Dans cet ordre, et la navigation ne doit pas attendre la mutation.
- Pied du panneau : « Tout marquer comme lu » (`marquerToutesLues`) et « Voir tout »
  (vers l'écran d'historique).
- Panneau vide : un état vide sobre, via `components/app/etat-vide.tsx` qui existe déjà —
  « Aucune notification ». Pas d'illustration, pas de phrase d'encouragement.
- Largeur fixe confortable (≈ 380 px), hauteur maximale avec **défilement interne**. Le
  panneau ne fait jamais défiler la page.

## 5. L'écran d'historique

Nouvelle page `app/src/pages/Notifications.tsx`, route **`/notifications`**.

### Enregistrement de la route — ne saute pas cette étape

1. Entrée dans la table `ROUTES` d'`app/src/App.tsx`, avec `perm: "/notifications"`.
2. Entrée dans `rbac.MODULES` :

```ts
{ cle: "/notifications", libelle: "Mes notifications", categorie: "Exploitation",
  voir: "Consulter ses notifications et régler ses préférences", faire: null,
  niveauVoir: 1, niveauFaire: 1 },
```

   `faire: null` : l'écran est en lecture, il n'y a rien à « faire » dessus.
   `niveauVoir: 1` : **tout membre** a ses propres notifications. Y compris l'auditeur
   externe — ne l'ajoute pas à `AUDITEUR_EXCLUS`.

3. Entrée de menu dans `app/src/components/Layout.tsx`, dans le groupe où vivent les écrans
   personnels (à côté de « Mes bulletins »).

> **Rappel** : une route absente de `MODULES` est refusée à tout le monde, DG compris. Si
> l'écran s'affiche blanc, c'est presque toujours ça.

### Contenu

- Liste paginée via `api.notifications.historique` (pagination par curseur, 30 par page,
  bouton « Charger plus »).
- Filtres : **non lues seulement**, par importance, par type (libellés tirés de
  `TYPES` de S1 — n'écris pas une seconde liste de libellés).
- Tableau selon la charte : il **défile seul** (`<Table hauteurMax={…}>`), en-tête collant,
  et le sélecteur de lignes visibles (`components/app/lignes-visibles.tsx`) dans la barre de
  filtres, à droite. Mémorisé par écran, comme partout ailleurs.
- Une ligne lue est **estompée**, pas masquée.
- Première colonne figée : le titre identifie la ligne.

## 6. Les préférences

Onglet dans l'écran d'historique (contrôle segmenté, comme dans `Parametres.tsx` — pas des
onglets d'un autre style).

Chaque membre règle, **par type d'événement** : *recevoir* / *ne pas être dérangé*.

### La frontière à ne pas franchir

> **Les préférences ne décident pas si un membre est concerné, seulement s'il est dérangé.**

Un membre concerné reçoit **toujours** sa ligne en base : son historique reste complet et il
retrouve son dossier. Ce que la préférence règle :

- en S2 : la ligne compte-t-elle dans le **badge** et apparaît-elle dans le **panneau** ;
- en S3 et S4 : part-elle sur **WhatsApp** et en **push système**.

Mélanger les deux produirait des notifications manquantes qu'on passerait des semaines à
expliquer. L'adressage de S1 reste la seule autorité sur « qui est concerné ».

### Stockage

Un champ optionnel sur `users` — additif, aucune migration :

```ts
    // Préférences de notification du membre (lot S2) : types qu'il ne veut pas voir
    // remonter. L'absence de la clé vaut « tout recevoir ».
    notifsSilencieuses: v.optional(v.array(v.string())),
```

Mutation `notifications.reglerPreferences({ silencieux: string[] })`, qui n'agit **que sur le
membre courant** et valide que chaque clé existe dans `TYPE_PAR_CLE`.

`nonLues` exclut les types silencieux du compteur et du panneau ; `historique` les montre
tous, avec une mention « type mis en silence ». Mets cette logique de filtrage dans
`lib/notifications.ts` (pure, testable), pas dans la query.

## 7. Tests

Pas de tests de rendu dans ce projet (aucun framework de composants). Ce qui se teste, et
qui s'ajoute à `tests/notifications.test.ts` :

- le filtrage par préférences : un type silencieux est exclu du compteur, présent dans
  l'historique ;
- la validation des clés de préférences : une clé inconnue est refusée ;
- le calcul de l'importance dominante d'un lot de non-lues.

## 8. Recette manuelle

1. Déclenche une notification (la recette de S1 §10 donne le mode opératoire). → Le badge
   apparaît **sans rafraîchir la page**. C'est la preuve que la réactivité fonctionne.
2. Clic sur la ligne → la notification passe en lue, le badge décrémente, et l'écran du
   dossier s'ouvre au bon endroit.
3. « Tout marquer comme lu » → le badge disparaît.
4. Mets un type en silence, déclenche-le → aucun badge, mais la ligne **est** dans
   l'historique.
5. À **390 px de large** : la cloche, le panneau et le tableau ne débordent pas. Le projet
   garantit qu'aucun écran ne déborde à cette largeur — ne casse pas cette garantie.
6. Connecte-toi en `employe.test` : l'écran `/notifications` est accessible et ne montre que
   **ses** notifications.

## 9. Risques

| Risque | Parade |
|---|---|
| Un `setInterval` ou un `refetch` ajouté par réflexe | Convex est réactif. Si tu écris du code de rafraîchissement, c'est que tu as mal lu `LISEZMOI.md` §2. |
| Le badge qui collecte toutes les non-lues | S1 borne à 100 et renvoie `tronque`. Affiche `99+`. |
| Une seconde liste de libellés de types côté écran | Importe `TYPES` de `convex/lib/notifications.ts`. C'est un fichier pur, les pages l'importent directement — le projet le fait déjà pour `rbac` et `journalFamilles`. |
| L'écran blanc | Route absente de `rbac.MODULES`. |
| Marquer lu au survol ou à l'ouverture du panneau | Non : on marque au **clic sur la ligne**, ou par le bouton explicite. Sinon l'utilisateur perd ses non-lues sans les avoir lues. |

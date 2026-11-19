# Travailler avec un agent externe, sans accès au dépôt

> Adopté le 13/11/2026. Complète `docs/rh/epics/00-LISEZ-MOI.md`, qui couvre le cas d'un agent
> travaillant **dans** un worktree. Ici l'agent n'a ni le dépôt, ni les fichiers : il reçoit une
> archive dans une conversation et rend un patch.

## Le principe

**Git reste de ce côté-ci ; l'agent ne voit qu'un instantané.** De son point de vue il n'existe
qu'un seul état, celui du ZIP — pas de branche, pas d'historique. De notre côté rien ne change :
son patch s'applique sur `dev` comme n'importe quelle contribution.

## Aller : le lot

Un lot est un ZIP contenant **une `FICHE.md` à la racine** et le strict périmètre de l'épic.

Il se fabrique par **liste blanche**, jamais par liste d'exclusion. Le dépôt contient des choses
qu'une archive déposée dans une conversation ne doit pas emporter :

| Jamais dans un lot | Pourquoi |
|---|---|
| `.env*` | clés de déploiement, matériel JWT |
| `modele/` | noms, salaires et situations de famille réels de l'effectif |
| `archives/` | le grand livre, journées comptables réelles |
| `docs/`, PDF, captures | relevés, photos de soldes, pièces |

Avant d'envoyer, relire la liste des fichiers du ZIP **une par une**. Une archive se fabrique en
trois secondes et se rattrape jamais.

**Conséquence** : tout épic qui a besoin de `modele/` ou d'`archives/` n'est pas délégable. Il se
traite ici.

Les modules de `convex/lib/` sont **purs et sans dépendance** : leurs tests tournent avec Node nu,
sans `npm install`. Un lot de logique pure pèse donc une dizaine de kilo-octets et se vérifie
intégralement. C'est le format à privilégier.

## Retour : un patch, jamais des fichiers

La fiche impose à l'agent, **avant toute modification** :

```bash
git init && git add -A && git commit -m base
```

et, en fin de course :

```bash
git diff base > lot-X.patch
```

**C'est la règle non négociable du dispositif.** Des fichiers entiers renvoyés écrasent
silencieusement ce qui a bougé entre-temps ; un patch, lui, échoue bruyamment —
`git apply --3way` refuse ce qui ne correspond pas. On transforme une perte invisible en erreur
visible.

L'agent renvoie aussi **la sortie brute de ses tests**, pas un résumé, et un compte rendu qui dit
explicitement **ce qu'il n'a pas pu vérifier**.

## Intégration

### Appliquer le patch — deux pièges payés au premier lot

Le lot est monté depuis `app/`, mais le dépôt a ce préfixe. Les chemins du patch disent donc
`convex/lib/…` là où le dépôt dit `app/convex/lib/…`. Il faut **`--directory=app`** :

```bash
git apply --3way --directory=app --stat  livraisons/lot-X/lot-X.patch   # d'abord lire
git apply --3way --directory=app         livraisons/lot-X/lot-X.patch   # puis appliquer
```

⚠️ **Sans le bon préfixe, `git apply` rend un succès en n'appliquant RIEN.** Pas d'erreur, pas de
message : zéro fichier touché. Toujours lire le `--stat` **avant**, et vérifier `git status`
**après**. Un patch qui ne change aucun fichier est un échec, pas une réussite.

### Vérifier que la base de l'agent est bien celle qu'on a envoyée

Son dépôt est isolé et reconstruit à la main ; rien ne garantit a priori que son commit `base`
corresponde à ce qu'on lui a transmis. Le contrôle coûte dix secondes et doit être systématique :

```bash
git show base:<fichier> | git hash-object --stdin     # chez lui
git show <sha-de-la-fiche>:app/<fichier> | git hash-object --stdin   # chez nous
```

Les empreintes doivent être identiques, fichier par fichier.

### Puis

1. le patch appliqué sur une branche locale, depuis le commit de base noté dans la fiche ;
2. relecture du **diff**, pas du compte rendu — c'est là que se voient les effets de bord
   qu'un agent sans le reste du projet ne peut pas anticiper. Au lot C1, trois ont été trouvés à
   la relecture : un validateur Convex désynchronisé, un tableau partagé avec le défaut du module,
   et une comparaison par référence qui polluait le journal d'audit. Aucun n'était une faute de
   l'agent ; tous auraient cassé la production ;
3. typecheck, build et **toutes** les suites de tests, **ici** — l'environnement de l'agent diverge
   du nôtre, plusieurs pièges de ce projet ne se manifestent que sous Windows ;
4. fusion dans `dev`, déploiement en recette, validation contre des données ;
5. puis seulement `clean`.

On ne fusionne jamais sur la parole d'un agent. En novembre 2026, un rapport annonçait « tous
committés » alors que dix fichiers ne l'étaient pas, et trois agents ont rendu des harnais jetables
plutôt que de dire qu'ils ne pouvaient pas tester.

## Ce que la fiche doit contenir, et que l'agent ne peut pas deviner

- l'intention et le critère d'acceptation, en une phrase ;
- les **décisions métier opposables** (multi-société non consolidé, barème daté, FCFA entiers,
  heure de Douala en UTC+1 fixe) ;
- les **pièges déjà payés** de sa zone ;
- la **liste des fichiers interdits** ;
- **ce qu'il ne pourra pas prouver**, avec consigne de l'écrire plutôt que de le contourner.

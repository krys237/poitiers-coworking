# Passation — Authentification & gestion des rôles

Branche : **`role`** · Destiné à l'agent qui reprend ce chantier.
À lire avec `CONSIGNES-MULTI-AGENTS.md` (partage des fichiers entre agents) et la section
« Phase 1 bis » de `CLAUDE.md` (documentation technique durable).

---

## 1. L'état en une phrase

Le code est complet et se construit, **mais personne ne s'est jamais connecté avec**.
Il n'existe aucun déploiement Convex lié à ce poste, donc les fonctions `auth:signIn` n'existent
pas encore côté serveur. **Votre première tâche est la mise en service (§4), pas l'écriture de
nouveau code.** Tant qu'elle n'est pas faite, considérez tout ce qui suit comme non éprouvé.

## 2. Le point de départ, pour comprendre les choix

Le modèle RBAC (7 niveaux cumulatifs + `auditeur_externe` orthogonal, matrice `NIVEAU_MODULE`,
`requireLevel` dans presque toutes les fonctions Convex, écran `/membres`, journal d'activité)
**existait déjà et était solide**. Ce qui manquait n'était pas le modèle mais la serrure :
`auth.config.ts` n'avait aucun fournisseur, et `AUTH_DEV_BYPASS=true` résolvait *tout* visiteur
vers le membre `dev:dg`, niveau 7. Un seul compte, un seul niveau, pour quiconque avait l'URL.

Trois lots ont été livrés dans cet ordre.

### P0 — `d6678ce` · Fermeture de 8 fonctions publiques
Huit fonctions Convex étaient appelables par un anonyme connaissant l'URL du déploiement :
les quatre seeds, `documentsIa.extraireMetadonnees`, `courrier.mode`, `journal.actions`.

Deux points qui méritaient mieux qu'un contrôle de niveau :
- `seed.initialiser` crée le **premier** DG : la fermer au niveau 7 aurait rendu tout déploiement
  neuf impossible à amorcer. D'où `requireLevelOuAmorcage` — ouverte tant qu'aucun membre
  n'existe, réservée au DG ensuite. **Réservée aux seeds, jamais à une fonction métier.**
- `documentsIa.extraireMetadonnees` acceptait un `_storage` id en argument et renvoyait le texte
  du fichier : un niveau 1 pouvait lire une pièce confidentielle. Le contrôle de niveau ne suffisait
  pas, il fallait un contrôle **par objet** → `documents.controleAccesFichier` (+ index `by_fichier`).

Corrigé au passage : `/paie/saisie` manquait dans `NIVEAU_MODULE`. Une route absente de la matrice
est refusée à **tout le monde**, DG compris — le garde de route de P2 l'aurait bloquée pour tous.

### P1 — `7e19767` · Authentification réelle (Convex Auth)
Mot de passe (8 caractères, lettres + chiffres — **seuil provisoire, à relever**) et code à usage
unique par e-mail. Le code OTP fait 6 chiffres, tiré de `crypto.getRandomValues` avec rejet du
biais modulo, valable 10 min, envoyé via Resend (même clé que le courrier de paie).

**Décision structurante : la table `users` EST la table d'identité de Convex Auth.** `schema.ts`
fait `...authTables` puis redéfinit `users` avec ses champs métier. Conséquence : l'`_id` de session
*est* l'`_id` du membre, donc `getCurrentUser` se réduit à `ctx.db.get(await getAuthUserId(ctx))`.
Rôles, comptes de démo et pré-provisionnement sont préservés intacts.

**Une inscription ne donne aucun droit.** `auth.createOrUpdateUser` est l'unique porte d'entrée :
e-mail pré-provisionné par le DG → le compte reprend son rôle et le jeton `pending:` disparaît ;
sinon → `role: "employe"`, `isActive: false`, `enAttente: true`.

`enAttente` existe parce qu'un seul booléen ne suffisait pas : « jamais encore autorisé » et
« compte révoqué » appellent deux réponses opposées. Le premier **obtient une session** — ce qui
permet d'afficher un écran d'attente au lieu d'une erreur opaque — mais `requireLevel` le refuse
partout. Le second est bloqué dès `beforeSessionCreation`.

### P2 — `c74af15` · Connexion, écran d'attente et gardes de route
Nouveau dossier `src/auth/` : `useMe.tsx` (contrat d'interface), `Login.tsx`, `Guard.tsx`,
`auth.css`. `main.tsx` passe à `ConvexAuthProvider`, `App.tsx` devient une table de routes
déclarative dont chaque entrée est enveloppée d'un `<Guard>`, `Layout.tsx` gagne le bloc
utilisateur, la déconnexion et le bandeau d'avertissement du mode développement.

**Le portail se fonde sur `users.me`, pas sur l'état de session de Convex Auth.** En mode
`AUTH_DEV_BYPASS`, le serveur renvoie un membre DG alors qu'aucune session n'est ouverte côté
client : se fier à `<Unauthenticated>` aurait affiché l'écran de connexion et cassé la démo.
C'est le serveur qui tranche, dans les deux modes. **Ne pas « corriger » cela sans comprendre.**

## 3. Ce qui a été vérifié — et ce qui ne l'a pas été

| Vérifié | Non vérifié |
|---|---|
| `npm run build` passe (l'app se bundle avec Convex Auth) | **Aucune connexion réelle** |
| `npx tsc -p convex/tsconfig.json` vert | Aucun envoi d'OTP réel |
| Les 8 suites de tests passent | Aucun rattachement `pending:` éprouvé |
| — | Le schéma n'a **jamais été poussé** |

⚠️ `npm run typecheck` (src) **échoue** sur `src/pages/Courrier.tsx:141` : une prop `periode` est
passée à `BulletinCard` qui ne l'accepte pas. **Erreur préexistante, antérieure à ce chantier**, dans
un fichier appartenant à l'agent front ; son correctif était non commité chez lui. `npm run build` ne
lance pas `tsc`, donc le déploiement Vercel ne tombe pas dessus — seul le typecheck manuel le révèle.

## 4. Mise en service — à faire dans cet ordre

1. **Générer les clés de signature JWT, sans l'assistant interactif** (`npx @convex-dev/auth` bloque
   en environnement non interactif — c'est le piège n°1). Voir `.agents/skills/convex-auth/SKILL.md`
   pour la commande `jose` exacte.
2. **Poser les variables sur le déploiement AVANT tout push** : `JWT_PRIVATE_KEY`, `JWKS`, `SITE_URL`
   (URL du front). Utiliser la forme `npx convex env set "NOM=valeur"` : la clé commence par
   `-----BEGIN` et la forme `env set NOM "$VAL"` fait interpréter le tiret comme un drapeau.
   **Si ces variables manquent, l'application est silencieusement toujours déconnectée, sans erreur.**
3. **Pousser** (`npx convex dev`). ⚠️ Le déploiement est **partagé avec l'agent front** : cela applique
   aussi le nouveau schéma pour lui. À faire de concert, jamais unilatéralement.
4. **Régénérer les types** (`npx convex codegen`) : `_generated/api.d.ts` ne connaît pas encore les
   modules `auth` et `authResendOtp`. Le front n'en a pas besoin (`useAuthActions` passe par des
   références de fonction textuelles), mais tout appel typé à `api.auth.*` échouerait.
5. **Éprouver un aller-retour de connexion complet.** C'est l'étape qui manque :
   - créer un membre depuis `/membres` avec un rôle donné ;
   - s'inscrire avec ce même e-mail → vérifier que le compte reprend bien le rôle prévu ;
   - s'inscrire avec un e-mail inconnu → vérifier l'écran « compte en attente » ;
   - l'autoriser depuis `/membres` → vérifier que l'accès s'ouvre sans reconnexion ;
   - vérifier qu'un niveau 3 tombe bien sur « Accès refusé » en tapant `/journal` à la main.
6. **Retirer `AUTH_DEV_BYPASS`** quand les rôles doivent compter. Tant qu'il est là, toute personne
   ayant le lien est Directeur Général — le bandeau rouge du `Layout` le rappelle à l'écran.

## 5. Pièges à connaître avant de toucher au code

- **`auth.config.ts` est analysé statiquement au push** : toute référence à une variable d'environnement
  non définie fait échouer le déploiement entier (aucune fonction, page blanche côté client).
  `CONVEX_SITE_URL` est une variable système, donc sûre. `process.env` dans une *fonction* est libre.
- **Les index `email` et `phone` de `users` portent des noms imposés** par Convex Auth
  (`server/implementation/users.js` les interroge tels quels). Les renommer casse l'authentification
  sans erreur de compilation.
- **Toute route doit avoir une entrée dans `NIVEAU_MODULE`.** Une clé absente est refusée à tout le
  monde. C'est volontaire : mieux vaut fermer une route oubliée que l'ouvrir.
- **Une action (`ctx` sans `db`) ne peut pas appeler `requireLevel` directement.** Passer par
  `internal.users.verifierNiveau` : l'identité est propagée par `ctx.runQuery`.
- **Masquer un bouton n'est pas une sécurité.** `<SiNiveau>` sert le confort ; le contrôle réel est
  `requireLevel` côté Convex. Ne jamais l'un sans l'autre.
- **`npx convex dev` ne doit tourner que dans un seul dossier à la fois** (deux worktrees ici).

## 6. Suites possibles (aucune n'est engagée)

- **Réinitialisation de mot de passe** : non branchée. L'OTP par e-mail sert de contournement.
  Pour la vraie chose, passer un fournisseur e-mail à l'option `reset` de `Password`.
- **Le niveau 1 ne voit rien de sa propre paie** : `/paie` est au niveau 4. Question de fond non
  tranchée — un employé devrait-il consulter son propre bulletin ?
- **Expiration de session** : valeurs par défaut de Convex Auth (30 jours). Non discuté.
- **`codeAcces`** (code personnel sur les documents) existe en base et dans `/membres` mais n'est
  pas relié à l'authentification.
- **Relever le mot de passe au-delà de 8 caractères** avant d'ouvrir les comptes à tout le personnel.

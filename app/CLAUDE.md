# Plateforme unifiée POITIERS COWORKING — guide du dépôt

Plateforme de gestion administrative **+ moteur de paie automatisé** (contexte Cameroun, FCFA).
Reconstruction unifiée dérivée de deux plateformes analysées — voir `../COMPREHENSION-PROJET.md`
(compréhension métier complète) et l'esquisse d'architecture publiée (`../architecture-cible.html`).

## Stack
- **Frontend** : React + TypeScript + Vite, en PWA installable.
- **Backend + base** : **Convex** (réactif). Les requêtes sont des abonnements live → les calculs
  dérivés (bulletins, soldes financiers, totaux) se recomposent automatiquement à chaque écriture.
- **Auth** : OIDC (OTP e-mail + Google). Le jeton porte le rôle/niveau du membre.

## Principe directeur
Combiner la **profondeur d'automatisation de la paie** (barème officiel lu/daté, recalcul temps réel,
génération et envoi de masse) avec l'**étendue d'exploitation + le contrôle d'accès fin**
(grand livre financier journalier, audit confidentiel, RBAC 7 niveaux, API d'export sécurisée).

## Organisation
```
app/
  convex/            # backend Convex (schéma, requêtes, mutations, jobs planifiés)
    schema.ts        # LE modèle de données — source de vérité des entités
    rbac.ts          # rôles, niveaux, matrice de permissions, helpers d'autorisation
    lib/paie.ts      # moteur de paie PUR (brut → cotisations → net) — testable isolément
    bareme.ts        # barèmes datés (CNPS/CGI) + job de lecture officielle
    payroll.ts       # requêtes/mutations paie (s'appuient sur lib/paie.ts + bareme)
    employes.ts      # fiches employés + import Excel/CSV (upsert)
    auth.config.ts   # configuration du fournisseur OIDC
  src/               # frontend React (coquille + écrans)
```

## Concepts clés à respecter
1. **Niveaux cumulatifs** : le niveau N hérite des accès de 1…N. Voir `rbac.ts` (`ROLES`, `canAccess`).
   Le rôle `auditeur_externe` est *orthogonal* (voit `/audit` seul).
2. **Barème daté (effective-dated)** : un bulletin référence la version du barème *applicable à sa période*.
   Ne jamais recalculer un mois clôturé avec un barème plus récent.
3. **Recalcul réactif** : les bulletins d'un mois ouvert sont dérivés (query) de `employes` + `saisiesMensuelles`
   + `baremes` + `primesCharges`. Un mois **clôturé** fige ses bulletins (snapshot), comme le verrou du grand livre.
4. **Accès par objet** : documents et lignes financières portent leur propre niveau de visibilité /
   téléchargement / drapeau confidentiel / code — au-delà du rôle.
5. **Multi-société** : chaque employé/membre a une `societe` (SESAME / SOFINA / SGC) qui segmente paie et exports.

## Démarrer
```bash
npm install
npx convex dev      # démarre le backend Convex (crée le déploiement au 1er lancement)
npm run dev         # démarre le front Vite
```
Puis, dans le dashboard Convex, définir la variable d'environnement **`AUTH_DEV_BYPASS=true`**
(mode développement : agit comme le membre DG « dev » sans IdP) et cliquer **« Initialiser les données de démo »**
sur le tableau de bord (barème, entreprise, 8 employés). Retirer `AUTH_DEV_BYPASS` en production et
brancher le fournisseur OIDC (`convex/auth.config.ts`).

> **Piège Convex** : `auth.config.ts` est analysé statiquement au push et toute référence à une variable
> d'environnement **non définie** fait échouer le déploiement (→ aucune fonction, page blanche côté client).
> Créer les variables `npx convex env set …` AVANT de les référencer. Ne jamais mettre de fichier de test
> (avec `process.exit` ou effets de bord) dans `convex/` : tout ce dossier est bundlé comme fonctions.

## Feuille de route (voir l'esquisse d'architecture)
- **P0 Fondations** : auth, RBAC, membres, paramètres entreprise. *(en cours)*
- **P1 Paie automatisée** : employés+import, barème, saisie mensuelle, recalcul, bulletins de masse, envoi. *(cœur)*
- **P2** grand livre financier journalier + documents (IA + accès fin).
- **P3** commandes / interventions / comptes rendus / statistiques.
- **P4** audit confidentiel + API d'export sécurisée + observabilité.

## Courrier de paie & e-mail
- `convex/lib/calculBulletins.ts` : **calcul partagé** des bulletins d'une période (forme unifiée `BulletinPeriode`,
  mois ouvert = calcul réactif, mois clôturé = snapshots). Utilisé par `payroll.ts` et `courrier.ts`.
- `convex/courrier.ts` : `apercu` (lettre rendue + bulletin + dernier envoi par employé), `envoyer` (action) via
  l'API HTTP **Resend**, journal dans la table `envois`.
- **Mode simulation automatique** tant que `RESEND_API_KEY` n'est pas défini sur le déploiement : le journal est
  alimenté (statut `simule`) sans envoi réel. Activer l'envoi : `npx convex env set RESEND_API_KEY re_…` et un
  expéditeur sur un domaine vérifié (Paramètres → e-mail expéditeur). `process.env` dans une *fonction* est
  autorisé même si la variable est absente (contrairement à `auth.config.ts`).

> Devise : FCFA (entiers, pas de décimales). Toujours stocker les montants en **entiers FCFA**.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

## Planning des absences → paie
- `convex/lib/absences.ts` : logique PURE (jours calendaires, ventilation par mois, mois de service, acquisition et
  solde de congés). `convex/planning.ts` : `vueMensuelle`, `ajouterAbsence`, `supprimerAbsence`, `synchroniserPaie`.
- **Règles** : un événement est `paye` (congé payé, maladie justifiée) ou non (`absence`, `autre`). Seules les absences
  **non payées** entament `joursTravailles` (= `joursBase` − absences non payées) et remplissent `absencesJours`.
- **Acquisition** : `congesAcquisCumul = congesInitial + congesParMois × moisDeService` (taux par défaut 1,5 j/mois,
  réglable dans les paramètres ; mois de service depuis `dateDebut`, sinon depuis janvier de l'année de la période).
  `soldeConges = acquis − congés payés pris (cumul)`.
- **Alimentation de la paie** : chaque ajout/suppression d'absence recale la saisie mensuelle des mois touchés
  (`joursTravailles`, `absencesJours`), **sauf mois clôturés**. Les autres champs de saisie sont préservés.
  Bouton « Synchroniser la paie du mois » pour recaler tout l'effectif.

## Primes & charges → bulletins
- Table `primesCharges` (index `by_employe_periode`, `by_periode`) : lignes datées par employé/mois, `type` prime|charge.
- `lib/calculBulletins.ts` lit le registre du mois et le passe au moteur (`computeBulletin(..., extras)`) :
  chaque **prime** = ligne de gain nommée (code `PRIME`, soumise aux cotisations, incluse dans le brut) ;
  chaque **charge** = ligne de retenue nommée (code `RETENUE`, déduite du net). Sanctions / dettes de soins / acompte
  de la saisie sont aussi listés (codes `SANCTION`, `DETTE`, `42121`) : `totalRetenues` = somme des lignes listées.
- `convex/primes.ts` : `liste` (lignes + totaux + récap par employé), `ajouter`, `supprimer` — refusés sur mois clôturé.

## PDF, archives & finitions
- `convex/paiePdf.ts` (**"use node"**, pdf-lib) : `buildPdf` (lettre optionnelle en page 1 + bulletin A4),
  `envoyerCourrier` (e-mail HTML + **PDF en pièce jointe** via Resend, ou simulation — le PDF est généré dans les deux cas),
  `archiverPdfs` (stocke le PDF de chaque bulletin figé d'un mois clôturé dans `_storage`, idempotent → `bulletins.pdfId`).
  Les polices standard PDF n'encodent que Latin-1 : `clean()` remplace tirets longs, points de suspension et espaces fines
  (ne jamais passer `toLocaleString("fr-FR")` tel quel : espace insécable fine U+202F non encodable).
- `convex/archives.ts` : `liste` (mois clôturés + agrégats), `bulletinsDuMois` (snapshots + URL du PDF), `snapshotsPourPdf`.
- Règle Convex : un fichier `"use node"` ne contient que des actions ; les queries/mutations restent dans les fichiers V8
  et sont appelées via `ctx.runQuery/runMutation`. Annoter le type de retour des actions (types circulaires).
- Employés : `dateDebut` (embauche) et `congesInitial` éditables (formulaire, inline, import CSV `date_debut`) ;
  le seed complète la date des employés de démo qui n'en ont pas.

## Phase 2 — grand livre financier & documents
- `convex/lib/tresorerie.ts` (PUR) : `BLOCS` (8 entités, clés stables `poitiers|lilas|carte_visa|edrtim_finance|medicaments|biodiagnostic|med_esthetic|autres`),
  `SOLDES` (9 principaux = cartes J0 + 3 secondaires), `calculerSoldes(ouverture, mouvements)` = **J-1 + entrées − retraits** par canal,
  `recetteTotale` = somme de toutes les ENTRÉES (retraits exclus). Test : `npm run test:tresorerie`.
- `convex/financier.ts` : `journee(date)` (journée réelle ou virtuelle, ouverture = J0 saisis sinon soldes de la **dernière journée
  enregistrée avant la date**), `enregistrer` (recalcule en chaîne les journées suivantes), `prendreVerrou`/`libererVerrou`
  (verrou par membre, **expire après 15 min**), `cloturerMois` (journées immuables, table `cloturesFinancieres`), `historique` (14 j),
  justificatifs (`genererUploadUrl` + `attacherPiece`, clé `bloc.ligne` → `_storage`), `kpi`. Niveau 5+.
- `convex/documents.ts` : accès **par objet** via `canView`/`canDownload` (rbac) — `liste` ne renvoie jamais d'URL ;
  `obtenirUrl` (mutation) vérifie niveau de téléchargement **et** code d'accès. Confidentiel = DA1/DA2/DG (dépôt réservé niv. 5+).
- `convex/documentsIa.ts` (`"use node"`, SDK `@anthropic-ai/sdk`, modèle `claude-opus-5`) : `extraireMetadonnees` — IA si
  `ANTHROPIC_API_KEY` est définie (JSON titre/description/catégorie, gestion `stop_reason: "refusal"`), sinon **repli heuristique**
  (titre = nom de fichier, catégorie par mots-clés). Le formulaire affiche le mode utilisé.
- Démo : `npx convex run seed:phase2 '{}'` (action, idempotente) — 3 journées (J-2 avec soldes J0 saisis, J-1, J) et 3 documents
  (procédure niv. 1, contrat niv. 3 avec code `1234`, rapport confidentiel niv. 5).
- Piège : `v.record` pour les mouvements ; index `by_date` interrogé avec `q.lt/gt` + `order("desc")` pour trouver J-1 / recalculer.

## Phase 3 — Activité & suivi
- **Commandes** (`convex/commandes.ts`, `lib/commandes.ts`) : référence `CMD-AAAA-NNN` (séquence par année), lignes {produit, DCI, qté, PU},
  workflow `en_attente → validee | rejetee (niv. 5+, motif requis) → livree` (transitions refusées côté serveur), fil de commentaires,
  **comparaison automatique** avec la commande précédente du même type (clé = produit normalisé : ajoutés / retirés / modifiés / variation).
  CSV : `parseCsvLignes` / `exportCsvLignes` (client). Tests `test:commandes`.
- **Interventions** (`convex/interventions.ts`) : référence `INT-AAAA-NNN`, priorité, photos (`_storage`), lignes chiffrées,
  workflow `ouverte → en_cours (validation) | rejetee ; en_cours → cloturee | rejetee` — niveau 5+ pour toute transition.
- **Comptes rendus** (`convex/comptesRendus.ts`, `lib/fenetre.ts`) : un par membre et par jour (`by_auteur_date`), fenêtre lun–ven
  16h–20h **heure de Douala (UTC+1 fixe)** ; hors fenêtre accepté mais marqué, `points` = 1 dans la fenêtre / 0 sinon (score = cumul) ;
  un compte rendu validé n'est plus modifiable ; vue superviseur (niv. 2+) = taux de soumission sur les membres actifs. Tests `test:fenetre`.
- **Statistiques** (`convex/stats.ts`, `lib/stats.ts`) : table `statsCaisse` ; `totalEspeces` = 8 postes espèces, `chiffreAffaires` =
  espèces + assurance + TEP (les sorties ne sont pas des recettes) ; primes médecins = `primesMedecins` avec `contexte: "stats"`,
  `montant = actes × montantUnitaire` (6 catégories, index `by_contexte_periode_categorie`). Graphes SVG sans librairie (`Barres.tsx`). Tests `test:stats`.
- Démo : `seed:phase3` (code dans `seedPhase3.ts`, ré-exporté) — 3 membres `demo:*`, 3 commandes, 3 interventions, 15 comptes rendus, 4 lignes de caisse, 6 primes.
- Pièges : un ré-export `export { x } from "./autre"` enregistre bien la fonction sous le module qui ré-exporte ; les pages importent la
  logique pure de `convex/lib/*` (pas de code serveur) ; `/tmp` n'existe pas sous Git Bash + Node Windows (utiliser des variables shell).

## Phase 4 — Contrôle & intégration
- **Audit** (`convex/audit.ts`, `lib/audit.ts`) : 14 catégories, lignes = `primesMedecins` avec `contexte: "audit"`, rapport par
  catégorie/mois (`rapportsAudit`), « Total salaires reçus » = `bulletinsPourPeriode` sur 6 mois (figés ou calculés), graphes.
  **Cloisonnement** : `lib/authz.requireAudit` — `auditeur_externe` ou `dg` uniquement (un niveau 6 est refusé) ; `rbac.canAccess`
  masque le module aux autres. Tests `test:audit`.
- **Membres** (`convex/users.ts`) : `liste` (origine dev / demo / pending / oidc), `modifier` (garde-fou : jamais le **dernier DG actif**
  désactivé ou rétrogradé), `creer` = pré-provisionnement `tokenIdentifier: "pending:<email>"` ; `lib/authz.getCurrentUser` **rattache**
  une identité OIDC à la ligne `pending:*` de même e-mail (patch dans une mutation, lecture seule en query).
- **Journal** (`journalActivite`, `lib/journal.ts` `journaliser`) : rôles/activations, clôtures paie & financière, appels API, barème.
  Écran `/journal` (niv. 7). Les HTTP actions écrivent via `internal.journal.ecrire`.
- **API** (`convex/http.ts` + `lib/apiSecurite.ts`) : `GET /api/financial?date&entity` — clé **re-validée en temps constant**
  (`FINANCIAL_API_KEY`), 503 si non configurée, 401/400/404, en-têtes `no-store`/`nosniff`, journalisation avec statut + IP.
  Proxy autonome `api-proxy/` (`server.mjs`, `lib.mjs`, ESM sans dépendance) : allowlist IP, clé, rate-limit glissant 60 s, logs JSON.
  Tests `test:api`, `test:proxy`. Écran `/api-readme` (niv. 7) — la clé n'est jamais affichée.
- **Barème** (`/bareme`, niv. 4 ; nouvelle version = niv. 7) : versions datées, `verifierMaintenant` planifie
  `controlerBaremeOfficiel` (lit `BAREME_SOURCE_URL` si définie, sinon journalise « source non configurée », met à jour `controleLe`).
  `convex/crons.ts` : contrôle quotidien 06:00 UTC, purge hebdomadaire des verrous financiers (`financier.purgerVerrousExpires`).
- Démo : `seed:phase4` — membre `demo:auditeur` (auditeur externe), lignes d'audit sur 4 catégories × 2 mois, 2 rapports.
- Pièges : dans un remplacement `perl`, `${x}` d'un template literal est interprété comme variable perl (échapper `\$`) ;
  `httpAction` n'a pas de `ctx.db` → passer par `internal.*` ; `crons.ts` doit exporter par défaut `cronJobs()`.
- **Porte de secours** : `npx convex run users:restaurerRole '{"tokenIdentifier":"dev:dg","role":"dg"}'` (mutation interne, CLI admin)
  si plus aucun DG actif ne peut agir — un membre rétrogradé ne peut pas se re-promouvoir (`users:modifier` exige le niveau 7).
- Tests Node (`--experimental-strip-types`) : les libs pures importées par les tests doivent importer leurs dépendances avec
  l'extension `.ts` et `import type` pour les types (`convex/tsconfig.json` a `allowImportingTsExtensions`) ; pas de hook de
  résolution (`module.register` plante à la sortie sous Windows).

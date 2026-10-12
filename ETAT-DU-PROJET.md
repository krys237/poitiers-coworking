# État du projet — POITIERS COWORKING

**Arrêté le lundi 12 octobre 2026.** Dernier commit : `e0f0dfe` (09/10). `main` est **à jour avec `origin/main`**
(tout est poussé), arbre de travail propre. Backend déployé sur le déploiement de dev `wonderful-shark-673`.

Ce document est **le point d'entrée pour reprendre le travail**. Il se lit avec `app/CLAUDE.md` (guide technique du
dépôt) et `app/DECISIONS.md` (journal des décisions du propriétaire, à compléter à chaque arbitrage).

---

## 1. Où en est le projet

**Achèvement estimé : 87 %.** Les fonctions demandées sont livrées ; ce qui reste est de la mise en conformité,
de la recette et la bascule en production.

| Chantier | Avancement | Reste à faire |
|---|---|---|
| Socle & modèle de données | 90 % | Comparaison réelle du barème officiel, agrégats d'audit longue période |
| Paie automatisée | 95 % | Incohérences relevées par l'inventaire (§5) |
| Exploitation & activité | 95 % | Unifier les tuiles de 5 écrans, retirer `legacy.css` |
| Finances & grand livre | 95 % | Incohérences du report de soldes (§5) |
| Accès, rôles & sécurité | 95 % | **Masquage des actions selon les droits** (§4), politique de mot de passe |
| Documents imprimables | 90 % | Validation papier du bulletin par le directeur |
| Paramètres & réglages | 100 % | — |
| Recette & qualité | 50 % | Résultats de la campagne à consolider, mise en conformité des écrans |
| Mise en production | 40 % | Domaine propre, production Convex, sauvegardes, passation |
| Pilotage & documentation | 90 % | Rapport d'octobre |

> ⚠️ **La date de mise en service du 10 octobre est dépassée.** Elle n'a pas été tenue : la séance à la Polyclinique
> (vérification des formules et des espaces administratifs) a ouvert une série de mises à jour qui passent avant la
> bascule. **Une nouvelle date est à arbitrer avec le propriétaire** — c'est la première question à lui poser.

---

## 2. Ce qui est fait

### Avant le 28/09
Voir `rapport-du-mois-de-septembre-2026.md` (le mois entier, semaine par semaine) et les rapports hebdomadaires.
En résumé : socle Convex + React, 22 écrans sur la charte « Ocean Breeze », moteur de paie aligné au franc près sur
le modèle du directeur, connexion réelle (e-mail ou téléphone), grand livre, documents, commandes, interventions,
comptes rendus, caisse, audit, API d'export.

### 28/09 — droits configurables et demandes de M. GAMBOU
- **Les droits ne suivent plus la hiérarchie des niveaux.** Le directeur choisit, module par module, qui **voit** et
  qui **fait**, dans Paramètres → Rôles & accès, plus des **exceptions par personne**. Le niveau ne donne que les
  droits *par défaut*. Contrôle côté serveur (`requireDroit`). Garde-fous : super admin garde tout, le DG garde
  Paramètres et Membres.
- **Les 8 demandes de M. GAMBOU sont livrées** : « Mes bulletins » pour l'employé · destinataires nominatifs d'un
  document · verrou d'1 h sur la caisse et les primes · PDF dans Bulletins du mois · courrier par WhatsApp ·
  connexion hors de la Polyclinique (déjà le cas) · auditeur sans les droits du directeur · usage sur téléphone.
- **E-mail réel en service** (Resend, domaine `edoctor-tim.com`, expéditeur `noreply@edoctor-tim.com`).
- **Cahier de recette n°3** et **adaptation au téléphone** (aucun écran ne déborde à 390 px).
- **Tableau de bord composé selon les droits** de chaque membre.

### 02/10 → 05/10 — préparation de la séance et pilotage
- **`mode-intervention-droits.pdf`** (11 pages) : méthode pour définir les droits avec chaque métier, définitions des
  modules, **une grille par rôle** pré-remplie depuis le code.
- **`rapport-du-mois-de-septembre-2026.md`**.
- **`design/bareme/inventaire-calculs.md`** : **110 règles de calcul** en 11 familles — formule, source de chaque
  paramètre, fichier qui la calcule, écrans qui l'affichent. Sections 13 et 14 : valeurs codées en dur à rendre
  réglables, et **24 incohérences** relevées.

### 09/10 — après la séance à la Polyclinique
- **« Caisse & primes médecins » scindé en deux écrans** : *Caisse du mois* (`/caisse`) et *Primes médecins*
  (`/primes-medecins`). Deux entrées de menu, deux modules de droits, chacun avec son droit « modifier après le
  délai ». `/statistiques` redirige vers la caisse.
- **Récapitulatif financier : prendre la main change l'écran.** La saisie devient une **matrice caisses × flux** en
  pleine largeur ; la consultation (encaissements du jour, carte Visa, graphique, notes) et les 8 soldes par canal
  s'effacent au profit de 4 chiffres utiles. Saisie dans la cellule : Tab suit la caisse, ↑ ↓ changent de caisse,
  Ctrl+S enregistre. Maquette des deux options retenues : `design/financier-saisie/propositions.html`.
- **Comptes rendus** : le droit « Faire » (superviser et valider) a été retiré au comptable par le propriétaire,
  directement dans la matrice.

---

## 3. Ce que le propriétaire doit fournir

Rien n'avance sans ces trois éléments. **À demander dès la reprise.**

| Attendu | Pourquoi | Où ça va |
|---|---|---|
| **Les autres mises à jour relevées à la clinique** sur les *interactions entre membres* | Le propriétaire en a annoncé plusieurs ; une seule a été traitée (la scission caisse / primes). Les suivantes n'ont pas encore été données | selon le sujet |
| **Résultats de la campagne de recette** (export CSV du cahier) et **droits arrêtés par rôle** avec le directeur | Le rapport de septembre les attend (`[À COMPLÉTER]`, section 3.7) ; les droits arbitrés doivent devenir les **défauts dans le code**, sinon la production repartira des anciens | `rbac.celluleParDefaut`, `rapport-du-mois-de-septembre-2026.md` |
| **Nouvelle date de mise en service** | Le 10/10 est dépassé | tout le planning |

Autres décisions en attente, moins bloquantes : validation papier du bulletin par le directeur · données réelles
(effectif, soldes J0) · choix sur l'écran Barème (§4) · arbitrage des incohérences de calcul (§5).

---

## 4. Ce qui reste à faire, par ordre de priorité

1. **Masquage des actions selon les droits** — *la règle du propriétaire* : retirer un droit à un rôle ou à une
   personne doit faire **disparaître** les actions qui en dépendent (boutons, liens, saisies). Le menu et l'accès aux
   écrans la respectent déjà, et le serveur refuse toute action non autorisée, mais **plusieurs écrans affichent
   encore des boutons** à qui n'a que « Voir » (Employés pour le comptable, Membres pour l'auditeur, Paramètres,
   Commandes, Financier, Caisse…). Les **18 scénarios marqués `conformite-droits`** du cahier de recette listent les
   cas et échoueront tant que ce n'est pas fait. Outils : `usePeut(module, "faire")`, `<SiDroit module=…>`.
2. **Suite des mises à jour « interactions entre membres »**, dès que le propriétaire les donne.
3. **Refonte de l'écran Barème** — proposition faite, **en attente de validation** : trois onglets (*Taux en
   vigueur* · *Règles de calcul*, le catalogue des 110 règles avec « utilisé dans » · *Par écran*), plus en option un
   **calcul pas à pas** d'un bulletin. Détail dans `design/bareme/inventaire-calculs.md`. À rendre réglables au
   minimum : les paliers **TDL** et **RAV**, aujourd'hui codés en dur et invisibles.
4. **Corriger les incohérences de calcul** arbitrées (§5).
5. **Campagne de recette** avec les huit comptes, puis correction.
6. **Mise en production** : domaine propre et HTTPS, déploiement Convex de production, sauvegardes + exercice de
   restauration, données réelles, guide utilisateur par rôle, procédure de secours, répétition.
7. **Finitions** : unifier les tuiles des cinq écrans refondus en parallèle, retirer `legacy.css`, politique de mot
   de passe (10 caractères), passe accessibilité.

### Backlog non planifié
Comparaison réelle du barème avec la source officielle · agrégats mensuels stockés pour l'audit au-delà de 24 mois ·
réinitialisation de mot de passe (« mot de passe oublié »).

---

## 5. Incohérences de calcul à arbitrer

Relevées par l'inventaire (`design/bareme/inventaire-calculs.md` §14, 24 points). Les plus importantes, parce
qu'elles touchent l'argent :

- **Une absence peut être retenue deux fois** : jours en moins via le planning **et** montant saisi à part.
- **Le report des soldes du grand livre réécrit des journées de mois déjà clôturés.**
- **La recette du jour peut compter la Carte Visa deux fois** — à confirmer avec la DAF.
- Le bulletin et le PDF affichent toujours **« / 30 jours »**, même pour un salarié sur une autre base.
- La tuile « Effectif payé » affiche toujours un **paiement le 5**, quel que soit le réglage.
- **Les trois sociétés ont les mêmes cotisations**, alors que la légende dit « SESAME non déclarés CNPS ».
- Les contrôles du barème (taux, tranches, date d'effet) ne sont faits que **dans le navigateur**.

---

## 6. Où se trouve quoi

| Sujet | Fichier |
|---|---|
| Guide technique du dépôt (stack, pièges, conventions) | `app/CLAUDE.md` |
| **Journal des décisions du propriétaire** (datées, avec l'endroit du code qui les applique) | `app/DECISIONS.md` |
| **Cahier de recette n°3** — 153 scénarios, par compte de test, export CSV des résultats | `cahier-de-recette.html` (sources : `design/recette/`, régénérer avec `node design/recette/build.mjs`) |
| **Inventaire des 110 règles de calcul** + incohérences | `design/bareme/inventaire-calculs.md` |
| Mode d'intervention (définir les droits avec chaque métier, grilles par rôle) | `mode-intervention-droits.pdf` (générateur `design/mode-intervention.mjs`) |
| Maquette des deux options de saisie du financier | `design/financier-saisie/propositions.html` |
| Rapports | `rapport-semaine-36.*`, `rapport-de-la-semaine-du-7.md`, `rapport-de-la-semaine-du-14.*`, `rapport-du-21.*`, `rapport-du-mois-de-septembre-2026.md` |
| Backlog Jira (10 epics, 101 tickets) | `jira-backlog-coworking.csv` + `-LISEZMOI.md` |
| Jeu d'impression pour la validation papier | `jeu-impression-directeur-2026-09.pdf` (générateur `design/jeu-impression.mjs`) |
| Accès de test pour les testeurs | `acces-test.pdf` |
| Charte visuelle et règles d'écran | `.agents/skills/poitiers-ui-ux-system/SKILL.md` |

**Générateurs** (dans `design/`) : `recette/build.mjs` (cahier de recette) · `mode-intervention.mjs` ·
`jeu-impression.mjs` · `rapport-pdf.py` (rapport md → PDF) · `rapport-21.pptx.cjs` (PowerPoint) · `jira-backlog.py` ·
`acces-test.html` + `print-file.mjs` · `verif-comptes.mjs` (les 8 comptes un par un) · `verif-droits.mjs` (menu et
accès par compte) · `etat-mobile.mjs` (les écrans à 390 px) · `shot.mjs` / `shot-role.mjs` / `print-png.mjs`.

---

## 7. À savoir avant de reprendre

- **Droits** : jamais de `requireLevel` sur une fonction métier — toujours `requireDroit(ctx, module, "voir"|"faire")`,
  et une entrée dans `rbac.MODULES` pour tout nouvel écran. Contrôles : `npm run test:droits`,
  `node design/verif-droits.mjs`.
- **Le mode développement est coupé** (`AUTH_DEV_BYPASS=false`). Conséquence : `npx convex run` sur une fonction
  métier échoue (« Non authentifié »). Pour une opération en console : mutation *interne*, ou bypass remis
  temporairement à `true`.
- **Comptes de test** : `<role>.test@poitiers.local`, mot de passe commun `Poitiers2026`. Les téléphones ne suivent
  **pas** l'ordre des rôles (voir la table des comptes dans `cahier-de-recette.html`). `employe.test` est relié à la
  fiche employé E001 ; le mot de passe du super administrateur reste inchangé tant qu'on est en mode test.
- **Déploiement dev** : `wonderful-shark-673`. Définies : `JWT_PRIVATE_KEY`, `JWKS`, `SITE_URL`, `FINANCIAL_API_KEY`,
  `RESEND_API_KEY`, `AUTH_EMAIL_FROM`, `ULTRAMSG_INSTANCE_ID`, `ULTRAMSG_TOKEN`. Manquantes : `BAREME_SOURCE_URL`,
  `ANTHROPIC_API_KEY`. ⚠️ **Une clé posée dans `app/.env.local` n'est PAS vue par les fonctions Convex** : il faut
  `npx convex env set`.
- **WhatsApp** : tout est prêt (UltraMsg, clés posées, interrupteur ouvert) mais **l'instance est en veille
  (« standby »)** : les envois restent simulés. Dès qu'elle est reliée au téléphone, faire un premier envoi réel vers
  le numéro du propriétaire (fiche E009).
- **Frontend en ligne** : <https://poitiers-coworking.vercel.app/connexion> (déploiement automatique sur `main`).
- **Serveur de développement** : `npm run dev -- --port 5199` depuis `app/` ; il tombe entre les sessions, le
  relancer avant toute capture Playwright.
- **Travail à deux agents** : ne commiter que ses propres fichiers (`app/CONSIGNES-MULTI-AGENTS.md`).

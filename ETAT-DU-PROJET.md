# État du projet — POITIERS COWORKING

**Arrêté le lundi 28 septembre 2026.** Dernier commit : `c226d2b` (23/09). `main` est en avance de 4 commits
sur `origin/main` — **à pousser**. Arbre de travail propre.

Ce document est le point d'entrée pour reprendre le travail : ce qui est fait, ce qui reste, où se trouve
chaque chose. Il se lit avec `app/CLAUDE.md` (guide technique du dépôt) et `app/DECISIONS.md` (journal des
décisions du propriétaire).

---

## 1. Où en est le projet

**Achèvement estimé : 78 %.** Le socle métier, les écrans et la sécurité d'accès sont en place ; ce qui reste
conditionne la mise en service : recette avec les utilisateurs, arbitrage des niveaux de rôles, bascule en
production.

| Chantier | Avancement | Reste à faire |
|---|---|---|
| Socle & modèle de données | 90 % | Comparaison réelle du barème officiel, agrégats d'audit longue période |
| Paie automatisée | 95 % | Rien de bloquant |
| Exploitation & activité | 95 % | Unifier les tuiles de 5 écrans, retirer `legacy.css` |
| Finances & grand livre | 90 % | Rien de bloquant |
| Accès, rôles & sécurité | 90 % | Mot de passe super admin, niveaux exacts des rôles, politique de mot de passe |
| Documents imprimables | 85 % | Validation papier du bulletin, recette d'impression |
| Paramètres & réglages | 100 % | — |
| Recette & qualité | 25 % | Cahier final, campagne par rôle, accessibilité, mobile |
| Mise en production | 30 % | Production Convex, domaine, e-mail réel, sauvegardes, passation |
| Pilotage & documentation | 80 % | Rapports hebdomadaires restants, guide utilisateur par rôle |

**Mise en service visée : vendredi 10 octobre 2026.**

---

## 2. Ce qui est fait

### Socle (semaines 36–37)
Analyse des deux plateformes existantes, modèle de données Convex (20 tables), moteur de paie pur aligné au
franc près sur le format du directeur, barème daté avec contrôle quotidien, 8 suites de tests automatisés,
API d'export financier + proxy Node, mise en ligne GitHub / Convex / Vercel.

### Authentification et rôles (semaines 38–39)
Convex Auth (mot de passe, code e-mail), RBAC fermé côté serveur **et** côté routes, membres & accès, journal
d'activité, fiche API. Puis, le 21/09 : niveau 6 (DA2) retiré, rôle **super administrateur** (niveau 8) créé
pour le technique, attribution de rôle bornée au niveau de l'auteur, matrice « Rôles & accès » dérivée du code.
Le 21–23/09 : écran de connexion refait (image de fond, modale, **e-mail ou téléphone** avec indicatif
pré-rempli), `AUTH_DEV_BYPASS` **coupé**, huit comptes de test créés, page « introuvable » et alias `/login`.

### Refonte des écrans (semaines 38–39)
**21 écrans sur 22** sur la charte « Ocean Breeze ». Trois règles transverses adoptées en cours de route :
formalisme des chiffres, saisie en série avec champs persistants, tableaux à défilement intégré avec nombre de
lignes visibles au choix (skill `poitiers-ui-ux-system` §3, §7, §8).

### Bulletin de paie (21–23/09)
Maquette validée par le propriétaire, puis livré : écran, impression (récapitulatif puis un bulletin par page)
et **PDF pdf-lib** alignés trait pour trait. Formules et liste codée des rubriques inchangées.

### Paramètres (21/09)
Six sections, un seul enregistrement journalisé ; les réglages de fonctionnement jusque-là enfouis dans le code
(fenêtre des comptes rendus, verrou financier, envoi réel, IA documents, PDF à la clôture, jours de base,
plafond de saisie) sont sortis dans `convex/lib/reglages.ts`.

### Anomalies corrigées
Solde de trésorerie visible par tout membre connecté · `archiverPdfs` action publique sans garde · `JWKS`
invalide (aucune session réelle possible) · PDF archivés recevant un bulletin appauvri · page blanche sur
adresse inconnue · aperçu manquant dans Documents et Comptes rendus (ajouté le 23/09, lecture seule).

---

## 3. Ce qui reste — par semaine

### S1 (21 → 26 septembre) — soldes
| Reste | Qui | Butoir |
|---|---|---|
| Changer le mot de passe du super administrateur | propriétaire | **échu le 23/09** |
| Remettre au directeur le jeu d'impression (3 bulletins, liste, courrier) | dev | **échu le 24/09** |
| Validation papier du bulletin | directeur | **échu le 25/09** |
| Corrections issues de la validation papier | dev | après validation |
| Fournir les attendus de la recette, écran par écran | propriétaire | **échu le 26/09** |
| Constituer les données de recette réelles (effectif, soldes J0) | propriétaire | **échu le 26/09** |
| Vérifier chaque compte de test un par un | dev | — |
| Rapport de la semaine du 21 | dev | — |

> Ces huit points n'ont pas été traités dans la conversation du 23/09 : **à faire le point avec le propriétaire
> avant de démarrer S2**, car la recette (S2) en dépend.

### S2 (29 septembre → 3 octobre) — « la clinique teste »
Cahier de recette final (un scénario par écran et par rôle) · campagne de tests avec les huit comptes ·
deux lots de correction (mercredi, vendredi) · arbitrage des niveaux exacts de chaque rôle avec le comptable,
le DAF et la RH (**butoir 2/10**) · unification des tuiles des cinq écrans refondus en parallèle ·
politique de mot de passe à 10 caractères · rapport de la semaine du 28.

### S3 (6 → 10 octobre) — « prêt à mettre en service »
Déploiement Convex de production · domaine, HTTPS et proxy API (**butoir 3/10**) · e-mail réel Resend
(**butoir 3/10**) · sauvegardes + exercice de restauration · passe accessibilité et passe mobile ·
suppression de `legacy.css` · recette d'impression comparée · passation (guide par rôle, procédure de secours) ·
répétition de mise en service le 9 · **mise en service le 10** · rapport final.

### À intégrer au cahier de recette (noté le 28/09)
- **Un écran ne montre que ce à quoi le membre a droit.** Depuis les droits Voir / Faire par module
  (Paramètres → Rôles & accès), un membre qui n'a que « Voir » voit encore, sur plusieurs écrans, des boutons
  de saisie ou de validation (ex. Employés pour le comptable). Le serveur refuse l'action et un bandeau
  « Vos droits ici » prévient, mais **à terme chaque bouton d'action est masqué sans le droit « Faire »**.
  Scénario de recette par écran et par rôle : aucun bouton qui mène à un refus. Outil : `usePeut(module, "faire")`
  / `<SiDroit module=… >` (`src/auth/useMe.tsx`) ; contrôle rapide : `node design/verif-droits.mjs`.

### Backlog non planifié
Comparaison réelle du barème avec la source officielle · agrégats mensuels stockés pour l'audit au-delà de
24 mois · réinitialisation de mot de passe (« mot de passe oublié », dépend du compte Resend).

---

## 4. Où se trouve quoi

| Sujet | Fichier |
|---|---|
| Guide technique du dépôt (stack, pièges, conventions) | `app/CLAUDE.md` |
| **Journal des décisions du propriétaire** (14 entrées datées) | `app/DECISIONS.md` |
| Feuille de route de la refonte, « à faire plus tard » | `app/REFONTE-UX.md` |
| Plan d'avancement 3 semaines (tâches, décisions, risques) | `plan-avancement-3-semaines.pdf` · [version en ligne](https://claude.ai/code/artifact/52dce462-0d0d-475c-a93c-8f9cf9d91d4c) |
| **Backlog Jira** (10 epics, 101 tickets, sprints datés) | `jira-backlog-coworking.csv` + `-LISEZMOI.md` |
| Rapports hebdomadaires | `rapport-semaine-36.pptx`, `rapport-de-la-semaine-du-7.md`, `rapport-de-la-semaine-du-14.{md,pdf,pptx}` |
| Accès de test pour les testeurs | `acces-test.pdf` |
| Maquette validée du bulletin | [artefact](https://claude.ai/artifact/KKmP8LY6us94N9M9ANuA8R) |
| Charte visuelle et règles d'écran | `.agents/skills/poitiers-ui-ux-system/SKILL.md`, `flag-design-system` |

**Générateurs** (dans `design/`) : `rapport-pdf.py` (rapport md → PDF), `rapport-14.pptx.cjs` (PowerPoint),
`jira-backlog.py` (backlog CSV), `acces-test.html` + `print-file.mjs` (fiche des accès), `shot.mjs` /
`shot-role.mjs` / `print-png.mjs` (captures Playwright, dont connexion par compte de test).

---

## 5. À savoir avant de reprendre

- **Le mode développement est coupé** (`AUTH_DEV_BYPASS=false`). Conséquence : `npx convex run` sur une fonction
  métier échoue (« Non authentifié »). Pour une opération en console, passer par une mutation *interne* ou
  remettre temporairement le bypass à `true`.
- **Comptes de test** : `<role>.test@poitiers.local`, mot de passe commun `Poitiers2026`, téléphones
  `+237 6 90 00 00 0N` (voir `acces-test.pdf`). Le compte technique est `superadmin.test@…` — **son mot de passe
  doit être changé**.
- **Déploiement dev** : `wonderful-shark-673`. Variables définies : `JWT_PRIVATE_KEY`, `JWKS`, `SITE_URL`,
  `FINANCIAL_API_KEY`. Manquantes : `RESEND_API_KEY`, `BAREME_SOURCE_URL`, `ANTHROPIC_API_KEY`.
- **Serveur de développement** : `npm run dev -- --port 5199` depuis `app/` ; il tombe entre les sessions,
  penser à le relancer avant toute capture Playwright.
- **Travail à deux agents** : ne commiter que ses propres fichiers (voir `app/CONSIGNES-MULTI-AGENTS.md`).
  Le tableau de bord, le financier, les commandes, les documents et les comptes rendus ont été refondus en
  parallèle — leurs tuiles restent à unifier.
- **Décisions en attente du propriétaire** : sept, listées en section 7 du plan d'avancement ; les plus urgentes
  sont le mot de passe du super administrateur, les attendus de la recette et les données réelles.

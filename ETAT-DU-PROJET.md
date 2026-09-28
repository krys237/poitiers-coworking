# État du projet — POITIERS COWORKING

**Arrêté le lundi 28 septembre 2026, mis à jour en fin de journée.** Les 5 commits du matin sont poussés ;
ceux de l'après-midi (jeu d'impression, droits Voir/Faire, demandes de M. GAMBOU) sont **locaux, en attente
du feu vert du propriétaire pour pousser**. Backend déployé sur le déploiement de dev.

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

### Journée du 28/09 — droits configurables et demandes de M. GAMBOU
- **Jeu d'impression** du directeur (`jeu-impression-directeur-2026-09.pdf`, générateur `design/jeu-impression.mjs`) ;
  le bulletin imprimé tient désormais sur une feuille ; titre « BULLETIN DU MOIS » (écran, impression, PDF).
- **Droits Voir / Faire par module, choisis par le directeur** (Paramètres → Rôles & accès : matrice d'un clic +
  exceptions par personne). Les niveaux ne donnent plus que les défauts. Auditeur : consulte tout sans agir, sauf
  Paramètres, Journal, Archives, documents, comptes rendus. Comptable : + récapitulatif financier / grand livre.
- **Demandes de M. GAMBOU, toutes livrées** : PDF dans Bulletins du mois (mois ou salarié) · « Mes bulletins » pour
  l'employé (mois clôturés, téléphone) · verrou 1 h sur Caisse & primes médecins (au-delà : administrateur) ·
  destinataires nominatifs d'un document · courrier de paie par WhatsApp (UltraMsg, simulé sans clés) · connexion
  hors de la Polyclinique (aucune restriction d'adresse : rien à faire).
- **Responsive (28/09)** : les 21 écrans passent à 390 px sans débordement horizontal (relevé `design/etat-mobile.mjs`) ;
  tuiles deux par ligne sur téléphone ; fiches employé / membre / caisse en une colonne ; parcours de l'employé vérifié
  (connexion, tableau de bord, comptes rendus, interventions, documents, mes bulletins). Les grands tableaux défilent
  dans leur cadre (lisibles, pas confortables) — acceptable selon la consigne « au moins lisible ».
- **E-mail réel EN SERVICE (28/09)** : compte Resend du propriétaire, domaine vérifié `edoctor-tim.com`, expéditeur
  `noreply@edoctor-tim.com` (Paramètres), `RESEND_API_KEY` et `AUTH_EMAIL_FROM` posées ; premier courrier réel envoyé
  et reçu. À trancher pour la production : garder ce domaine ou en vérifier un au nom de la clinique.
- **WhatsApp — test d'envoi réel EN ATTENTE (28/09).** Les clés UltraMsg sont posées sur le déploiement de dev
  (`ULTRAMSG_INSTANCE_ID`, `ULTRAMSG_TOKEN`) et l'interrupteur « Envoi réel par WhatsApp » est ouvert, mais
  l'instance UltraMsg est en **standby** (et non « authenticated ») : rien ne part tant qu'elle n'est pas reliée
  au téléphone. Dès qu'elle l'est : Courrier → « Par WhatsApp » → un seul destinataire (le numéro du propriétaire,
  fiche E009) → le bouton doit dire « Envoyer » (pas « Simuler l'envoi ») ; en cas d'échec, la réponse d'UltraMsg
  est dans la colonne Résultat du journal. Contrôle de l'instance (lecture seule) : `GET /instance/status`.
  À noter : les clés placées dans `app/.env.local` ne sont PAS vues par les fonctions Convex (`npx convex env set`).

### Anomalies corrigées
Solde de trésorerie visible par tout membre connecté · `archiverPdfs` action publique sans garde · `JWKS`
invalide (aucune session réelle possible) · PDF archivés recevant un bulletin appauvri · page blanche sur
adresse inconnue · aperçu manquant dans Documents et Comptes rendus (ajouté le 23/09, lecture seule).

---

## 3. Ce qui reste — par semaine

### S1 (21 → 26 septembre) — soldes
| Reste | Qui | Butoir |
|---|---|---|
| ~~Changer le mot de passe du super administrateur~~ | propriétaire | reporté à la mise en production (mode test) |
| ~~Remettre au directeur le jeu d'impression~~ | dev | **prêt le 28/09** — à imprimer et remettre |
| Validation papier du bulletin | directeur | **échu le 25/09** |
| Corrections issues de la validation papier | dev | après validation |
| Fournir les attendus de la recette, écran par écran | propriétaire | **échu le 26/09** |
| Constituer les données de recette réelles (effectif, soldes J0) | propriétaire | **échu le 26/09** |
| ~~Vérifier chaque compte de test un par un~~ | dev | **fait le 28/09** (`design/verif-comptes.mjs`, 8/8) |
| ~~Rapport de la semaine du 21~~ | dev | **fait le 28/09** : `rapport-du-21.{md,pdf,pptx}` |

> Point fait le 28/09 avec le propriétaire. Le rapport « du 21 » couvrira tout le travail jusqu'au jour de sa
> rédaction, calé sur le Jira. Les cahiers de recette (07/09 et 14/09) sont antérieurs à la refonte : à réécrire.

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

### Cahier de recette n°3 (28/09) — prêt
`cahier-de-recette.html` à la racine : **152 scénarios** (8 « droits par compte » générés depuis `rbac.ts`, 42+3 accès &
administration dont mobile, 49 paie, 50 exploitation & finances), chacun avec le compte de test à utiliser, les étapes,
le résultat attendu, une colonne « Attendu du propriétaire », le statut OK / KO / bloqué et une remarque ; progression
gardée dans le navigateur, **export CSV** des résultats, impression. 18 scénarios `conformite-droits` échoueront tant
que le masquage des actions n'est pas fait (attendu). Régénérer : `node design/recette/build.mjs` (sources :
`design/recette/scenarios-*.json`, `modele.html`). Les cahiers n°1 et n°2 sont archivés dans `design/recette/anciens/`.

### À intégrer au cahier de recette (noté le 28/09)
- **Règle du propriétaire : retirer un droit, c'est faire disparaître les actions qui en dépendent.** Quand le
  directeur retire un droit (Paramètres → Rôles & accès), que ce soit **à un rôle** (donc à tout ce niveau d'accès)
  ou **à une personne** (exception individuelle), toutes les actions liées à ce droit **ne doivent plus être
  visibles** pour ce rôle ou cette personne : boutons, liens, champs de saisie, cases à cocher, menus d'action.
  Retirer « Faire » masque les actions d'un module (il reste consultable) ; retirer « Voir » retire le module du
  menu et de l'écran. Aujourd'hui le menu et l'accès aux écrans suivent déjà cette règle et le serveur refuse
  toute action non autorisée, mais **plusieurs écrans affichent encore des boutons d'action** à qui n'a que « Voir »
  (ex. Employés pour le comptable) : à corriger écran par écran.
  Scénario de recette, par écran : pour chaque rôle, et pour une exception posée sur une personne, retirer le droit
  puis vérifier qu'aucune action liée n'apparaît. Outil : `usePeut(module, "faire")` / `<SiDroit module=…>`
  (`src/auth/useMe.tsx`) ; contrôle rapide : `node design/verif-droits.mjs`.

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
| Rapports hebdomadaires | `rapport-semaine-36.pptx`, `rapport-de-la-semaine-du-7.md`, `rapport-de-la-semaine-du-14.{md,pdf,pptx}`, `rapport-du-21.{md,pdf,pptx}` |
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
  `+237 6 90 00 00 0N` (voir `acces-test.pdf`). Le compte technique est `superadmin.test@…` (mot de passe à changer
  à la mise en production). `employe.test` est relié à la fiche E001 (« Mes bulletins »).
- **Déploiement dev** : `wonderful-shark-673`. Variables définies : `JWT_PRIVATE_KEY`, `JWKS`, `SITE_URL`,
  `FINANCIAL_API_KEY`. Manquantes : `BAREME_SOURCE_URL`,
  `ANTHROPIC_API_KEY`. Définies depuis le 28/09 : `RESEND_API_KEY`, `AUTH_EMAIL_FROM`, `ULTRAMSG_INSTANCE_ID`, `ULTRAMSG_TOKEN`.
- **Serveur de développement** : `npm run dev -- --port 5199` depuis `app/` ; il tombe entre les sessions,
  penser à le relancer avant toute capture Playwright.
- **Droits** : jamais de `requireLevel` sur une fonction métier ; `requireDroit(ctx, module, "voir"|"faire")` et une
  entrée dans `rbac.MODULES` pour tout nouvel écran. Contrôle rapide : `node design/verif-droits.mjs`, `npm run test:droits`.
- **Travail à deux agents** : ne commiter que ses propres fichiers (voir `app/CONSIGNES-MULTI-AGENTS.md`).
  Le tableau de bord, le financier, les commandes, les documents et les comptes rendus ont été refondus en
  parallèle — leurs tuiles restent à unifier.
- **Décisions en attente du propriétaire** : sept, listées en section 7 du plan d'avancement ; les plus urgentes
  sont le mot de passe du super administrateur, les attendus de la recette et les données réelles.

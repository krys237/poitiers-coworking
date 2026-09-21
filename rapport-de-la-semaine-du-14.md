# Rapport de la semaine du 14 septembre 2026

**Projet** : POITIERS COWORKING — plateforme unifiée d'administration et de paie
**Période couverte** : lundi 14 au dimanche 20 septembre 2026, prolongée au lundi 21 (point arrêté le lundi 21 au soir)
**Rédigé par** : krys237

---

## 1. En bref

La semaine la plus dense du projet : **56 livraisons versionnées**, contre 5 la semaine précédente.
Trois chantiers ont été menés de front et sont aujourd'hui fermés ou presque :

1. **L'authentification réelle et les rôles** : fin du mode « toute personne ayant le lien est directeur ».
   Chaque utilisateur se connecte avec son e-mail ou son numéro de téléphone et voit uniquement ses écrans.
2. **La refonte du front-end**, annoncée comme le chantier de la semaine : **21 écrans sur 22 sont passés sur
   la nouvelle charte** (le tableau de bord servait de modèle). Le bulletin de paie, dernier document, a été
   redessiné, validé sur maquette par le propriétaire du projet et livré à l'écran, à l'impression et en PDF.
3. **Le pilotage** : un plan d'avancement sur trois semaines fixe la mise en service au **vendredi 10 octobre 2026**,
   avec huit comptes de test pour la recette et un journal des décisions.

Le projet est estimé à **75 % d'achèvement**. Ce qui reste est court mais conditionne la mise en service :
la recette avec les utilisateurs, l'arbitrage des niveaux de rôles, la bascule en production.

---

## 2. Ce qui a été fait

### 2.1 Authentification réelle et rôles (14 → 17 septembre, puis 21)

Jusqu'ici, le déploiement fonctionnait en « mode développement » : le lien donnait à quiconque les droits
de direction. C'est fini.

**Connexion** (Convex Auth)

- Chaque compte a un mot de passe ; la session est signée par le déploiement lui-même, sans fournisseur externe.
- Écran de connexion refait le 21 : une image en arrière-plan, une fenêtre de connexion, **deux modes au choix —
  adresse e-mail ou numéro de téléphone** — et l'indicatif du pays pré-rempli (+237) comme sur WhatsApp.
- Pas d'inscription ni de code par e-mail sur l'écran : les comptes sont créés par la Direction (écran Membres)
  et le rôle est repris à la première connexion. Une inscription spontanée n'ouvre aucun droit.
- Le mode développement est **coupé** sur le déploiement : connexion obligatoire partout, y compris sur le lien Vercel.

**Rôles**

- Toutes les fonctions du serveur exigent désormais un niveau ; toutes les routes du front sont gardées
  (taper une adresse à la main n'affiche plus un écran interdit).
- Le niveau 6 (Directeur Administratif 2) est **retiré** : aucun droit ne le distinguait du niveau 5, qui devient
  « Directeur Administratif (DAF) ».
- Un rôle **super administrateur** (niveau 8) isole le technique — données de démonstration, fiche API, état du
  déploiement — hors de portée du Directeur Général. Nul ne peut attribuer un rôle au-dessus du sien.
- Le Directeur Général change un rôle directement dans la liste des membres, et la liste dit ce que chaque rôle
  ouvre ; la matrice complète est lisible dans **Paramètres → Rôles & accès**, générée depuis le code.
- **Huit comptes de test**, un par rôle, avec e-mail, téléphone et mot de passe commun (fiche PDF `acces-test.pdf`).
- Trouvé en testant le compte « employé » : le solde de trésorerie s'affichait sur le tableau de bord de tout le monde.
  Corrigé : réservé au niveau 5.

### 2.2 Refonte du front-end (17 → 21 septembre)

La charte « Ocean Breeze » et ses composants ont été fixés dans deux skills de projet, puis déclinés écran par écran.
Trois règles transverses ont été adoptées en cours de route, sur retour du propriétaire :

- **Formalisme des chiffres** : milliers séparés, décimales à la virgule, unité séparée, zéro = champ vide.
- **Saisie en série** : « l'utilisateur qui a n éléments à saisir ne clique pas n fois » — une ligne de saisie
  permanente et un bouton « Rendre les champs persistants » sur chaque écran de saisie.
- **Tableaux** : défilement intégré et nombre de lignes visibles au choix, partout ; c'est un ERP, pas une page web.

| Lot | Écrans livrés sur la charte |
|---|---|
| Paie | Récapitulatif salaires (deux présentations : synthèse + volet par défaut, grille en mode persistant), Liste des salaires (écran + impression A4), **Bulletins du mois**, Courrier de paie (aperçu lettre + bulletin, envoi confirmé, journal), Planning des absences, Primes & retenues, Archives (PDF à générer sur confirmation) |
| Exploitation | Interventions (file de traitement + volet), Commandes, Documents, Comptes rendus, Caisse & primes médecins (deux onglets au lieu de huit), Récapitulatif financier (cockpit bicolonne) |
| Administration | Employés (fiche partagée avec le récapitulatif), Membres & accès, Barème (versions, écarts avec la version précédente, nouvelle version confirmée), Journal d'activité (fenêtre de temps, familles, export CSV), Fiche API, **Paramètres** |
| Contrôle | Audit confidentiel (horizon 6 / 12 / 24 mois, comparaison N / N−1, graphe par catégorie) |
| Coquille | Tableau de bord, barre latérale repliable en rail, bannière d'accueil |

**Bulletin de paie** — présenté au propriétaire sous forme de maquette interactive (sept zones expliquées, état
validé / provisoire, rendu actuel en regard), validé le 21, puis livré : écran, impression (page récapitulative
puis un bulletin par page) et PDF alignés trait pour trait. Formules et liste codée des rubriques inchangées.
Au passage, les PDF archivés recevaient une version appauvrie du bulletin (sans période ni validation) : corrigé.

**Paramètres** — six sections : entreprise & documents (avec aperçu de l'en-tête imprimé), paie & congés, courrier &
e-mail, fonctionnement (fenêtre des comptes rendus, verrou financier, IA documents, PDF à la clôture, jours de base,
plafond de saisie — jusqu'ici des constantes enfouies dans le code), rôles & accès, et un onglet « déploiement »
réservé au super administrateur qui dit quelles clés sont configurées, sans jamais montrer leur valeur.

### 2.3 Pilotage et documentation (21 septembre)

- **Plan d'avancement sur trois semaines** (en ligne et en PDF) : S1 « le bulletin fait foi », S2 « la clinique
  teste », S3 « prêt à mettre en service » — tâches, responsables, critères de fait, sept décisions attendues avec
  date butoir, risques, indicateurs, suivi hebdomadaire.
- **Journal des décisions** (`app/DECISIONS.md`) : chaque consigne transverse avec sa date et l'endroit du code qui
  l'applique. Dernière en date : **tout numéro de téléphone porte l'indicatif du pays**.
- **Guide interactif** de la plateforme accessible depuis l'en-tête, fiche des accès de test, guide du dépôt à jour.

**Volume de la semaine** : 124 fichiers modifiés, environ 20 800 lignes ajoutées et 2 600 remplacées ;
18 composants partagés dans la bibliothèque applicative.

---

## 3. État d'avancement

| Chantier | Avancement | Commentaire |
|---|---|---|
| Architecture et modèle de données | 90 % | Stable ; réglages de fonctionnement ajoutés aux paramètres |
| Backend (fonctions métier) | 90 % | Toutes les fonctions contrôlées par niveau ; reste la comparaison réelle du barème officiel |
| Moteur de paie | 95 % | Inchangé, tests chiffrés au vert |
| Authentification et rôles | 85 % | En service ; niveaux exacts à arbitrer avec chaque spécialiste |
| **Front-end (présentation)** | **90 %** | **21 écrans sur 22 ; cinq écrans à unifier sur les mêmes tuiles** |
| Documents imprimés | 80 % | Bulletin, liste des salaires, courrier livrés ; validation papier à faire |
| Tests automatisés | 85 % | 8 suites, toutes au vert |
| Documentation, recette, pilotage | 70 % | Plan, journal des décisions, comptes de test ; cahier de recette final à écrire |
| Sécurité et mise en production | 45 % | Mode développement coupé ; production Convex, domaine, e-mail réel restent à faire |

**Lecture d'ensemble** : le passage de 40 % à 90 % sur le front-end est le fait marquant. La plateforme est
maintenant utilisable de bout en bout par un utilisateur connecté avec son propre rôle.

---

## 4. Points de vigilance

| Sujet | Situation | Action attendue |
|---|---|---|
| Niveaux des rôles | Matrice actuelle en service ; comptable, DAF et RH n'ont pas encore été entendus | Entretiens avec chaque spécialiste avant le 2 octobre, report dans le code |
| Mot de passe du super administrateur | Compte de test avec le mot de passe commun | À changer par le propriétaire avant toute diffusion du lien |
| Validation papier du bulletin | Maquette validée, papier pas encore signé | Impression et relecture par le directeur (semaine du 22) |
| Envoi d'e-mails | Simulation ; clé et domaine absents | Compte Resend et domaine vérifié (butoir 3 octobre) |
| Barème officiel | Contrôle quotidien sans source branchée | Choisir la source à surveiller |
| Données réelles | Recette sur données de démonstration | Fichier de l'effectif et soldes J0 (butoir 26 septembre) |

---

## 5. Chiffres de la semaine

| Indicateur | Valeur |
|---|---|
| Livraisons versionnées | 56 |
| Fichiers modifiés | 124 (≈ 20 800 lignes ajoutées) |
| Écrans sur la nouvelle charte | 21 sur 22 |
| Composants partagés | 18 |
| Comptes de test | 8 (un par rôle) |
| Décisions consignées | 14 |
| Suites de tests automatisés | 8, toutes au vert |
| Achèvement estimé | 75 % |

---

## 6. Programme de la semaine du 21 septembre (S1 du plan)

1. Faire valider le bulletin de paie sur papier par le directeur ; corriger les écarts.
2. Changer le mot de passe du super administrateur ; vérifier chaque compte de test un par un.
3. Écrire le cahier de recette final, un scénario par écran et par rôle, à partir des attendus du propriétaire.
4. Recueillir le fichier de l'effectif réel et les soldes d'ouverture du grand livre.
5. Unifier les tuiles des cinq écrans refondus en parallèle (tableau de bord, financier, commandes, documents, comptes rendus).

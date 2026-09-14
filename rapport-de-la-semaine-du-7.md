# Rapport de la semaine du 7 septembre 2026

**Projet** : POITIERS COWORKING — plateforme unifiée d'administration et de paie
**Période couverte** : lundi 7 au dimanche 13 septembre 2026 (point arrêté le lundi 14 au matin)
**Rédigé par** : krys237

---

## 1. En bref

Semaine volontairement plus légère que les précédentes sur ce projet : l'essentiel du temps
est allé à trois livraisons ciblées plutôt qu'à de nouveaux modules.

1. **Mise en ligne** du projet : dépôt GitHub et déploiement du frontend sur Vercel.
2. **Alignement complet de la paie** sur le format de référence transmis par le directeur
   (récapitulatif de salaire, bulletin de paie, liste des salaires).
3. **Mise à jour du cahier de recette n°1**, pour que les tests métier collent aux nouveaux écrans.

Le socle technique — backend, modèle de données, architecture — est aujourd'hui **quasiment terminé
(80 à 90 %)**. Le chantier qui s'ouvre est la **refonte du front-end**, écran par écran.

---

## 2. Ce qui a été fait

### 2.1 Mise en ligne et diffusion (7 septembre)

| Élément | Détail |
|---|---|
| Dépôt GitHub | `krys237/poitiers-coworking`, branche `main`, premier push du projet complet |
| Déploiement | Frontend sur Vercel (`poitiers-coworking.vercel.app`), backend sur Convex |
| Configuration | `vercel.json` : framework Vite, racine `app`, réécriture des liens profonds vers `index.html`, en-têtes de sécurité |
| Variable | `VITE_CONVEX_URL` pointant vers le déploiement Convex |
| Support de présentation | Rapport de la semaine précédente livré aussi en PowerPoint (14 diapositives) |

Conséquence pratique : la plateforme est consultable depuis un simple lien, sans installation,
pour les démonstrations et les retours du directeur.

### 2.2 Alignement de la paie sur le modèle du directeur (10 septembre)

C'est le gros morceau de la semaine. Le directeur a transmis un jeu de consignes de mise en forme
accompagné d'une application de référence. Nous avons repris **calculs, écrans et documents** pour
que nos montants et notre présentation correspondent aux siens, au franc près.

**Moteur de calcul** (`convex/lib/paie.ts`, réécrit)

- Salaire journalier = brut mensuel ÷ 30 ; salaire de base = journalier × jours travaillés.
- Indemnité de congés = journalier × congés pris ; les congés payés sortent désormais des jours travaillés.
- **Total 1** = salaire de base + primes (fixes, transport, assiduité, logement, registre) + indemnité de congés + heures supplémentaires + ancienneté.
- **Prime de transport exonérée** : elle entre dans le Total 1 mais sort de la base taxable.
- IRPP recalculé **en annuel** : (base taxable × 0,7 − CNPS − abattement annuel ÷ 12) × 12, puis tranches et division par 12. CAC = 10 % de l'IRPP.
- Ajout de la **TDL** (barème sur le salaire de base) et de la **RAV** (barème sur la base taxable), activables ou non depuis le barème.
- **Total 2** (salaire net) = Total 1 moins les charges salariales, sanctions, absences, dettes de soins, acompte, mutuelle et charges du registre.

**Écrans**

- **Récapitulatif salaires** (`/paie/saisie`) : colonnes reprises de la liste papier, panneau « Taux du mois » lu dans le barème applicable, totaux en pied de tableau, légende explicative (Total 1, Total 2, définitions SESAME / SOFINA / SGC).
- **Liste des salaires** (`/paie/liste`) — écran nouveau : « Récapitulatif général salaire et primes perçus », net placé dans la colonne de la société de l'employé, colonne primes, totaux et impression.
- **Bulletins du mois** : page récapitulative avant les bulletins, filtre par employé dans l'adresse, nom de fichier PDF « Entreprise - Nom - période ».

**Bulletin de paie** (écran et PDF)

- Bandeau « Période du … au … · Paiement le 05 du mois suivant par banque ».
- Bloc employeur avec NIU et numéro CNPS, grille d'identité avec matricule, catégorie, échelon, emploi, date d'embauche.
- Bande jours et congés : jours travaillés, congés acquis, congés pris, reste à prendre, indemnité de congés, salaire journalier.
- **Liste de lignes codées fixes, toujours imprimées même à zéro** (66111 à 66125 pour les gains, 43131 à 44725 pour les retenues), puis les primes et charges libres.
- Synthèse avec NET À PAYER, mention « Payé par : SALAIRE + société », visa du responsable RH, et mention de validation qui passe de « NON VALIDÉ – document provisoire » à « BULLETIN VALIDÉ le … » à la clôture du mois.

**Paramétrage**

- Paramètres entreprise : NIU, numéro CNPS employeur, responsable RH, jour de paiement.
- Barème : abattement IRPP annuel, interrupteurs TDL et RAV.
- Base de données : nouveaux champs de saisie (prime d'assiduité, indemnité de logement, absences en FCFA), catégorie et échelon sur la fiche employé, instantané du détail de calcul figé à la clôture.

**Volume** : 23 fichiers source modifiés, environ 920 lignes ajoutées et 290 remplacées.

**Contrôle** : les tests de paie vérifient maintenant l'égalité stricte avec deux cas fournis par le
directeur — un salarié à 106 950 FCFA de brut donne 11 420 de charges salariales et 95 530 de net.

### 2.3 Cahier de recette n°1 — révision 2 (14 septembre au matin)

Le cahier de tests métier a été repris pour suivre les nouveaux écrans : 13 scénarios au lieu de 12,
avec le scénario « Liste des salaires » ajouté, le récapitulatif et le bulletin réécrits colonne par
colonne, le barème passé d'une manipulation en ligne de commande à un vrai écran, et huit invariants
reformulés. Les montants de référence du directeur y servent de repère de contrôle.

---

## 3. État d'avancement

| Chantier | Avancement | Commentaire |
|---|---|---|
| Architecture et modèle de données | 90 % | 20 tables, index et règles d'accès posés ; stable depuis deux semaines |
| Backend (fonctions métier) | 85 % | 27 modules et 13 bibliothèques de calcul pur ; reste l'authentification réelle et quelques branchements externes |
| Moteur de paie | 95 % | Aligné sur la référence du directeur et couvert par des tests chiffrés |
| Tests automatisés | 85 % | 8 suites, 107 contrôles, toutes au vert |
| Documentation et recette | 90 % | Document de compréhension, deux cahiers de recette, guide du dépôt |
| **Front-end (présentation)** | **40 %** | **Chantier de la semaine qui vient** |
| Sécurité et mise en production | 45 % | Contrôle d'accès en place ; authentification réelle et clés de service à brancher |

**Lecture d'ensemble** : la partie invisible du produit — structure, calculs, règles, données — est
pratiquement finie. Ce qui reste est majoritairement du travail de présentation et de finition.

---

## 4. Le chantier qui s'ouvre : la refonte du front-end

Le travail mené sur le **tableau de bord** sert de modèle de référence : mise en page, grille,
composants, typographie, codes couleur, comportement à l'impression. La consigne pour les semaines
à venir est simple : **décliner ce même traitement sur l'ensemble des écrans et de la documentation**,
pour que la plateforme ait une seule et même identité visuelle de bout en bout.

Périmètre à reprendre — 22 écrans, par lots :

1. **Paie** — récapitulatif, liste des salaires, bulletins, planning, primes et charges, courrier, archives *(partiellement fait avec l'alignement du 10 septembre)*.
2. **Administration** — employés, membres, paramètres, barème, journal d'activité.
3. **Exploitation** — grand livre financier, documents, commandes, interventions, comptes rendus, statistiques.
4. **Contrôle** — audit, guide d'API.
5. **Documents imprimés** — bulletin, récapitulatif, liste des salaires, courrier, exports : même charte que les écrans.

---

## 5. Points de vigilance

| Sujet | Situation | Action attendue |
|---|---|---|
| Authentification | Mode développement actif : toute personne disposant du lien a les droits de direction | Brancher le fournisseur d'identité avant toute diffusion large ; le lien reste réservé aux démonstrations |
| Envoi d'e-mails | Mode simulation, aucun message réel n'est expédié | Fournir la clé du service d'envoi et un domaine expéditeur vérifié |
| Extraction automatique des documents | Repli manuel actif | Fournir la clé du service d'intelligence artificielle |
| Barème officiel | Contrôle quotidien en place mais sans source branchée | Choisir la source officielle à surveiller |
| Congés acquis | Cumulés depuis la date d'embauche, sans remise à zéro annuelle | Trancher avec le directeur : report intégral ou réinitialisation chaque année |

---

## 6. Chiffres de la semaine

| Indicateur | Valeur |
|---|---|
| Livraisons versionnées | 5 |
| Fichiers source modifiés (alignement paie) | 23 |
| Écrans de l'application | 22 |
| Tables de la base | 20 |
| Suites de tests automatisés | 8, soit 107 contrôles, toutes au vert |
| Scénarios de recette métier | 13 (cahier n°1) + 32 (cahier n°2) |

---

## 7. Programme de la semaine du 14 septembre

1. Lancer la refonte front-end sur le lot **Paie**, en reprenant la grille du tableau de bord.
2. Faire valider la maquette d'un écran type par le directeur avant de dérouler les lots suivants.
3. Aligner les documents imprimés sur la même charte.
4. Préparer le branchement de l'authentification réelle, préalable à toute ouverture du lien.

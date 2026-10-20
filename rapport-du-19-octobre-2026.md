# Rapport d'activité bimensuel — POITIERS COWORKING

**Projet** : POITIERS COWORKING — Plateforme unifiée de gestion, approvisionnement, trésorerie et paie  
**Établissement** : Polyclinique de Poitiers  
**Période couverte** : Bilan consolidé sur 2 semaines  
**Rédigé par** : krys237  

---

## 1. MISES À JOUR DU SYSTÈME

Au cours de ces deux semaines d'activité, des évolutions structurelles et fonctionnelles majeures ont été apportées au code source et à l'architecture applicative afin d'adapter fidèlement la solution aux exigences opérationnelles de la Polyclinique.

### 1.1 Module Commandes & Approvisionnements (Refonte intégrale en 4 étapes)

* **Intégration du flux « Réactifs Laboratoire »** :
  * Extension du périmètre des commandes pour gérer trois familles de flux distinctes : *Médicaments (DCI)*, *Fournitures générales* et *Réactifs Laboratoire*.
  * Attribution d'une identité visuelle propre et codifiée pour chaque flux (vert émeraude pour la pharmacie, bleu marine pour les fournitures, violet pour le laboratoire).

* **Répertoire Fournisseurs dédié** :
  * Création d'une structure de données indépendante pour les fournisseurs partenaires.
  * Modal d'enregistrement et d'édition rapide avec contrôle des coordonnées : numéro de téléphone au standard international (+237), ville, adresse électronique et catégories de produits fournies.
  * Sélection intuitive du fournisseur lors de la saisie d'un bon de commande avec filtrage automatique.

* **Grille de Registre Manuscrit (Conformité modèle Polyclinique)** :
  * Remplacement de l'ancien tableau générique par la grille manuscrite officielle de l'établissement.
  * Intégration des colonnes de gestion des consommations : date de commande précédente, quantité précédente, quantité consommée/utilisée, quantité restante en stock, quantité commandée, prix unitaire indicatif et montant total de la ligne.
  * Calculs temps réel des totaux et report automatisé des historiques de commande.

* **Circuit d'Approvisionnement formalisé en 4 jalons** :
  1. *Étape 1 — Préparation* : saisie interne des besoins par le demandeur ou le gestionnaire, vérification des stocks restants et chiffrage indicatif.
  2. *Étape 2 — Validation DG* : transmission hiérarchique à la Direction Générale pour arbitrage, validation ou rejet motivé avec visa nominatif.
  3. *Étape 3 — En réception* : notification de la passation de commande auprès du fournisseur retenu et suivi de l'attente de livraison.
  4. *Étape 4 — Clôturée* : clôture officielle du dossier d'approvisionnement après réception physique conforme ou résolution des anomalies.

* **Édition du Bon de Commande Proforma Officiel A4** :
  * Module d'impression et d'exportation d'un bon de commande Proforma conforme aux standards hospitaliers.
  * Mise en page soignée comprenant : logotype officiel de la Polyclinique de Poitiers, cartouche d'identification de l'établissement et du fournisseur, tableau épuré des articles commandés, et double zone de signatures (Visa Comptabilité / Magasin et Visa Direction Générale).

* **Catalogue officiel de 921 articles & Autocomplétion intelligente (DataForm)** :
  * Extraction et centralisation des catalogues officiels de l'établissement (pharmacie, magasin général, réactifs/oxygène).
  * Système d'autocomplétion prédictive tolérant aux variations de frappe et aux accents, proposant par ordre alphabétique les désignations exactes et pré-remplissant automatiquement les prix unitaires de référence.

* **Pointage physique de réception & Contrôle qualité** :
  * Interface dédiée de pointage lors de la livraison effective par le fournisseur.
  * Contrôle ligne par ligne des quantités réceptionnées par rapport aux quantités commandées, avec calcul instantané des écarts éventuels (manquants ou surplus).
  * Bouton d'action directe pour validation 100 % conforme en cas de livraison complète.

* **Gestion complète et traçabilité des litiges** :
  * Formulaire de déclaration immédiate d'anomalie articulé autour des 4 motifs réglementaires de l'établissement :
    1. *Péremption* (produit périmé ou date limite d'utilisation trop courte).
    2. *Quantité manquante ou insuffisante* (colis incomplet ou écart d'unités).
    3. *Avarie / Casse* (flacon brisé, emballage détérioré, rupture de conditionnement).
    4. *Autre litige* (erreur de dosage, mauvaise référence, litige tarifaire).
  * Bascule automatique de la commande en statut « En litige » avec affichage d'un bandeau d'alerte spécifique, création d'un onglet de filtrage dédié et consignation dans le journal d'échanges.
  * Dispositif de résolution de litige permettant d'enregistrer la solution convenue avec le fournisseur (avoir, remplacement, livraison complémentaire) avant clôture définitive.

---

### 1.2 Tableau de Bord & Pilotage Financier

* **Uniformisation des cards de KPI** :
  * Refonte de la grille d'indicateurs du tableau de bord selon le standard unifié de l'application (disposition en grille responsive pleine largeur).
  * Alignement graphique strict des 4 indicateurs majeurs : *Chiffre d'affaires du mois* (Caisse live), *Solde de Trésorerie F3 Poitiers* (Grand livre), *Net à payer des salaires* (Masse des bulletins), et *Masse brute & Charges sociales*.
  * Standardisation des marqueurs visuels par l'adoption des composants officiels de statut (Flags de conformité financière).

* **Intégration du volet « Mon Espace »** :
  * Consolidation d'un espace personnel centralisant pour chaque collaborateur connecté ses actions quotidiennes : rédaction des comptes rendus, suivi des demandes d'intervention, consultation des documents partagés et accès direct aux bulletins de paie.

---

### 1.3 Ressources Humaines & Gestion des Employés

* **Enrôlement simplifié des utilisateurs** :
  * Ajout de l'action de création de compte utilisateur directement depuis la fiche de l'employé sans passer par des écrans intermédiaires.
  * Mise en place d'un protocole de mot de passe provisoire sécurisé avec obligation de mise à jour sur l'espace personnel lors de la première connexion.
  * Normalisation automatique des numéros de téléphone avec indicatif pays (+237) en cours de saisie.

* **Contrôle d'intégrité et unicité des matricules** :
  * Verrouillage anti-doublon garantissant l'impossibilité d'enregistrer deux salariés avec le même matricule, que ce soit par saisie manuelle ou lors des imports groupés CSV/Excel.

* **Continuité de la consultation des bulletins** :
  * Correction et stabilisation de l'affichage chronologique sur l'espace « Mes bulletins » afin d'assurer une visibilité continue et sans omission sur l'ensemble des mois clôturés.

---

### 1.4 Trésorerie & Opérations Financières

* **Matrice de saisie de trésorerie en pleine largeur** :
  * Transformation de la feuille journalière en une matrice globale *Caisses × Flux*, offrant une vue panoramique sur l'ensemble des entités de la Polyclinique (F3 Poitiers, pharmacie, etc.).
  * Conservation des mécanismes d'équilibrage automatique, de report des soldes de la veille (J-1) et de verrouillage exclusif pendant la frappe.

* **Scission des modules Caisse et Primes Médecins** :
  * Séparation claire des écrans de gestion en deux espaces distincts afin d'éviter toute confusion lors des imputations comptables : un écran réservé au suivi de la caisse mensuelle et un écran dédié au calcul et à la distribution des primes médicales.

---

### 1.5 Gestion des Interventions Techniques

* **Cloisonnement et confidentialité des demandes** :
  * Restriction des accès garantissant que chaque collaborateur n'accède qu'aux demandes d'intervention dont il est l'auteur.
  * Attribution d'une vue de supervision globale réservée exclusivement au Chef d'équipe pour la priorisation et le traitement.
  * Figeage automatique et infalsifiable de la date de création au jour effectif du dépôt de la demande.

---

## 2. DÉPLOIEMENT DANS LES SERVICES DE LA POLYCLINIQUE

Durant la semaine écoulée, une phase opérationnelle de déploiement terrain a été menée avec succès au sein des différents services administratifs et médico-techniques de la Polyclinique de Poitiers. Cette étape a permis d'installer les postes de travail, de configurer les profils d'accès et de vérifier l'adéquation des outils avec la réalité quotidienne de chaque métier.

### 2.1 Service Comptabilité
* **Mise en service du cockpit de trésorerie** : installation et prise en main de la nouvelle matrice journalière de saisie, assurant le pointage des entrées/sorties par mode de règlement (espèces, Mobile Money, Orange Money, chèques, virements).
* **Exploitation du Grand Livre réactif** : vérification des reports de soldes automatiques et de la gestion des verrous exclusifs pour éviter les conflits d'enregistrement simultanés.
* **Supervision du chiffre d'affaires** : raccordement du tableau de bord de la comptabilité avec visualisation instantanée des encaissements de caisse et des engagements budgétaires.

### 2.2 Service Pharmacie (Approvisionnements & Magasin)
* **Déploiement du module Commandes et du catalogue d'articles** : mise à disposition de la base des 921 articles officiels pour les réquisitions de médicaments et consommables médicaux.
* **Adoption de la grille de registre manuscrit** : alignement de l'écran sur le support physique historique de la pharmacie, facilitant le report des consommations et la justification des quantités commandées.
* **Circuit de contrôle des réceptions et gestion des litiges** : formation du personnel du magasin au pointage physique des colis livrés et à l'utilisation immédiate du protocole de litige en cas de non-conformité (avarie, péremption, manque).

### 2.3 Service Ressources Humaines (RH)
* **Déploiement du registre unique des salariés** : fiabilisation de l'effectif actif sur le système, vérification de l'intégrité des matricules et paramétrage des taux de cotisation et salaires de base.
* **Activation des accès salariés** : création des comptes d'accès pour le personnel, génération des identifiants provisoires et validation de la consultation dématérialisée des fiches de paie sur l'espace « Mes bulletins ».
* **Paramétrage des droits d'accès granulaires** : définition stricte des périmètres d'action (Voir / Faire) conformément à la grille RH validée.

### 2.4 Direction Administrative et Financière (DAF) & Direction Générale
* **Circuit d'arbitrage hiérarchique** : mise en place de la validation dématérialisée des bons de commande au niveau de la Direction avec production automatisée du bon Proforma officiel à transmettre aux fournisseurs.
* **Console de pilotage stratégique** : mise à disposition du tableau de bord consolidé pour le suivi global des indicateurs clés (recettes globales, masse salariale brute et nette, soldes de trésorerie et état des commandes en cours).
* **Supervision et contrôle d'audit** : vérification de la traçabilité des opérations via le journal d'activité et sécurisation des accès pour l'ensemble des départements de la Polyclinique.

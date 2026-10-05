# Rapport du mois de septembre 2026

**Projet** : POITIERS COWORKING — plateforme unifiée d'administration et de paie
**Période couverte** : du lundi 31 août au mercredi 30 septembre 2026 (cinq semaines)
**Rédigé par** : krys237

---

## 1. En bref

Septembre a fait passer le projet **d'une analyse à une plateforme en recette**. En cinq semaines :

1. **Le besoin a été établi** à partir des deux applications existantes du directeur (Hercules et Lovable), et la cible
   décidée : le moteur de paie automatisé de l'une, greffé sur le socle d'exploitation et de contrôle de l'autre.
2. **La plateforme a été construite et mise en ligne** : 22 écrans, paie alignée au franc près sur le modèle du
   directeur, grand livre, documents, commandes, interventions, comptes rendus, caisse, audit, API d'export.
3. **Elle a été sécurisée et refondue** : connexion réelle par e-mail ou téléphone, droits par rôle, 21 écrans sur 22
   sur la nouvelle charte, bulletin de paie redessiné et validé sur maquette.
4. **Les droits sont désormais choisis par le directeur**, module par module (Voir / Faire), et les huit demandes de
   M. GAMBOU sont livrées.
5. **La recette a commencé** : cahier de recette n°3 (152 scénarios), tests par rôle et séance de vérification à la
   Polyclinique avec le directeur.

Achèvement estimé au 30 septembre : **85 %** (cible définie et construction lancée le 6 septembre).
Mise en service visée : **vendredi 10 octobre 2026**.

---

## 2. Le mois semaine par semaine

| Semaine | Thème | Ce qui a été livré |
|---|---|---|
| **31 août → 6 sept.** | Comprendre et décider | Rétro-ingénierie des deux plateformes (13 modules Hercules, paie Lovable) ; document de compréhension ; architecture cible (Convex + React, 3 domaines, RBAC 7 niveaux) ; feuille de route en 5 phases ; **phase 1 (paie) livrée et vérifiée** en fin de semaine |
| **7 → 13 sept.** | Mettre en ligne, aligner la paie | Dépôt GitHub et déploiement Vercel ; **paie réalignée sur le format de référence du directeur** (journalier ÷ 30, Total 1 / Total 2, transport exonéré, IRPP annualisé, CAC, TDL, RAV) ; écran Liste des salaires ; cahier de recette n°1 mis à jour |
| **14 → 20 sept.** | Sécuriser et refondre | **Connexion réelle** (fin du mode « toute personne ayant le lien est directeur ») ; droits par niveau sur tout le serveur et toutes les routes ; **21 écrans sur 22 sur la charte « Ocean Breeze »** ; trois règles transverses (formalisme des chiffres, saisie en série, tableaux d'ERP) ; plan d'avancement sur trois semaines |
| **21 → 27 sept.** | Le bulletin fait foi | Bulletin refondu (écran, impression, PDF) et validé sur maquette ; Paramètres en six sections ; rôle super administrateur ; huit comptes de test ; journal des décisions ; backlog Jira (111 lignes) ; rapport du 14 |
| **28 → 30 sept.** | Droits, demandes, recette | **Droits Voir / Faire choisis par le directeur** ; **demandes de M. GAMBOU livrées** ; e-mail réel en service ; cahier de recette n°3 ; adaptation au téléphone ; **tests des cahiers par rôle** et **séance à la Polyclinique** (formules, espaces administratifs) |

---

## 3. Ce qui a été réalisé

### 3.1 Comprendre le besoin (semaine du 31 août)

Aucune spécification écrite n'existait : le besoin a été extrait des applications elles-mêmes, en pilotant un vrai
navigateur sur chaque écran, formulaire et vue de détail. Constat : derrière le nom « coworking », il s'agit d'un
**back-office de gestion d'établissement de santé** (Cameroun, FCFA, CNPS/IRPP) — trésorerie journalière, RH et paie,
approvisionnement, suivi d'activité, audit, gestion documentaire, intégration externe. Hercules couvre large mais
reste superficielle sur la paie ; Lovable va profond sur la paie et simplifie le reste. La cible retenue réunit les deux.

### 3.2 Construire la plateforme

| Domaine | Ce qui existe |
|---|---|
| **Paie** | Employés (fiche, import CSV), barème daté (CNPS, CFC, FNE, IRPP, CAC, TDL, RAV), planning des absences et congés, primes et retenues, récapitulatif des salaires (trois présentations), liste des salaires, bulletins du mois, courrier de paie, archives des mois clôturés, « Mes bulletins » pour l'employé |
| **Finances** | Grand livre journalier multi-entités (soldes reportés, verrou de saisie, clôture mensuelle, justificatifs) |
| **Exploitation** | Documents (accès par niveau, confidentiels, destinataires nominatifs, extraction des métadonnées), commandes (validation, comparaison avec la précédente), interventions, comptes rendus à fenêtre horaire, caisse et primes médecins |
| **Contrôle** | Audit cloisonné (6 / 12 / 24 mois, comparaison N / N−1), membres, journal d'activité, API d'export financier sécurisée + proxy |
| **Pilotage** | Tableau de bord composé selon les modules de chacun |

**Paie alignée sur le directeur** : les formules et les documents reprennent son application de référence au franc
près, et des tests chiffrés le garantissent (10 suites de tests automatisés au 30 septembre).

### 3.3 Sécuriser l'accès

- **Connexion réelle** depuis le 21 septembre : e-mail ou numéro de téléphone (indicatif +237 pré-rempli), comptes
  créés par la Direction, aucune inscription libre.
- **Droits choisis par le directeur** (28 septembre) : dans Paramètres → Rôles & accès, deux cases par module et par
  rôle — **Voir** et **Faire** — modifiables d'un clic, plus des **exceptions par personne**. Le contrôle est fait par le
  serveur : décocher une case bloque réellement l'action. Règle posée : **retirer un droit fait disparaître les actions
  qui en dépendent**.
- Rôle **super administrateur** pour le technique ; le niveau DA2, sans droit propre, a été retiré.

### 3.4 Refondre les écrans et les documents

- **21 écrans sur 22** sur la nouvelle charte, avec trois règles communes : formalisme des chiffres, saisie en série
  (« n éléments à saisir ne demandent pas n clics »), tableaux à défilement intégré.
- **Bulletin du mois** redessiné, validé sur maquette par le propriétaire, aligné à l'écran, à l'impression (une
  feuille A4) et en PDF ; titre « BULLETIN DU MOIS » ; PDF à la demande (mois entier ou un salarié).
- **Utilisable sur téléphone** : aucun écran ne déborde à 390 px ; parcours de l'employé vérifié de bout en bout.

### 3.5 Demandes de M. GAMBOU — livrées

| Demande | Réponse |
|---|---|
| L'employé voit son bulletin | Écran « Mes bulletins » (mois clôturés, PDF, téléphone) |
| Qui peut recevoir un document | Destinataires nominatifs au dépôt |
| Caisse et primes médecins non modifiables après 1 h, sauf l'administrateur | Verrou réglable, correction tardive journalisée |
| Bouton PDF dans « Bulletin du mois » | PDF du mois et PDF par salarié |
| Courrier de paie par WhatsApp | Canal e-mail / WhatsApp / les deux (UltraMsg) — envoi réel en attente de la reconnexion de l'instance |
| Connexion hors de la Polyclinique | Déjà possible (aucune restriction de lieu) |
| Auditeur : accès sauf documents | Consulte tout sans agir, sauf Paramètres, Journal, Archives, documents |
| Utilisation sur téléphone | Écrans lisibles à 390 px, parcours employé adapté |

### 3.6 Mettre en service les envois

- **E-mail réel en service** depuis le 28 septembre (compte Resend du propriétaire, expéditeur
  `noreply@edoctor-tim.com`) : premier courrier de paie reçu avec son bulletin en PDF.
- **WhatsApp** prêt (clés posées, envoi réel activé) : l'instance UltraMsg étant en veille, l'envoi reste simulé en
  attendant sa reconnexion au téléphone.

### 3.7 Recette et vérification sur site (semaine du 28 septembre)

- **Cahier de recette n°3** : 152 scénarios écrits sur les écrans actuels — un par écran et par rôle — avec, pour chacun,
  le compte de test à utiliser, les étapes, le résultat attendu, le statut OK / KO / bloqué et une remarque ; export CSV
  des résultats. Les cahiers n°1 et n°2, antérieurs à la refonte, ont été archivés.
- **Tests des cahiers par rôle** menés par le propriétaire avec les huit comptes de test.
  Résultats : **[À COMPLÉTER — nombre de scénarios joués, OK / KO / bloqués, principaux écarts relevés]**
- **Séance à la Polyclinique avec le directeur** :
  - **vérification des formules de calcul** de la paie ;
  - **adaptation des espaces administratifs** (ce que chaque rôle voit et fait), à l'aide du mode d'intervention et
    des grilles par rôle.
  Conclusions : **[À COMPLÉTER — formules confirmées ou à corriger, droits arrêtés par rôle, exceptions par personne]**
- **Corrections relevées en écrivant le cahier** : import CSV qui effaçait des valeurs existantes, ligne de caisse
  verrouillée qui s'ouvrait au clic, document « nominatif » enregistrable sans destinataire, taux affichés « 4.2 % ».

---

## 4. État d'avancement au 30 septembre

| Chantier | Avancement | Commentaire |
|---|---|---|
| Socle & modèle de données | 90 % | Stable ; barème officiel à brancher, agrégats d'audit longue période au backlog |
| Paie automatisée | 95 % | Alignée sur le directeur ; quelques incohérences relevées à corriger (section 5) |
| Exploitation & activité | 95 % | Verrou de caisse, documents nominatifs |
| Finances & grand livre | 90 % | Ouvert au comptable |
| Accès, rôles & sécurité | 95 % | Droits configurables ; politique de mot de passe à faire |
| Documents imprimables | 90 % | Bulletin sur une feuille, PDF à la demande ; validation papier attendue |
| Paramètres & réglages | 100 % | Délai de la caisse, WhatsApp ajoutés |
| Recette & qualité | 45 % | Cahier n°3 prêt, campagne lancée ; masquage des actions selon les droits à faire |
| Mise en production | 40 % | E-mail réel en service ; domaine propre, production Convex, sauvegardes à faire |
| Pilotage & documentation | 90 % | Rapports hebdomadaires, journal des décisions, état du projet, mode d'intervention |

---

## 5. Points de vigilance pour octobre

| Sujet | Situation | Action attendue |
|---|---|---|
| Résultats de la recette et de la séance | À consolider | Transmettre les résultats (export CSV) et les droits arrêtés ; report en défauts et en droits par défaut |
| Masquage des actions selon les droits | Le serveur refuse déjà ; certains écrans montrent encore les boutons | Mise en conformité écran par écran (18 scénarios du cahier) |
| Incohérences de calcul relevées par l'inventaire | 24 points, dont certains touchent l'argent (absence retenue deux fois, report du grand livre sur un mois clôturé, Carte Visa comptée deux fois) | Arbitrer avec le directeur et la DAF, corriger avant la mise en service |
| Écran Barème | Montre les taux, pas les règles | Refonte proposée : « Barème & règles de calcul » (110 règles, où chacune est utilisée) |
| Validation papier du bulletin | Jeu d'impression prêt | Relecture et signature du directeur |
| Données réelles | Recette sur données de démonstration | Fichier de l'effectif et soldes d'ouverture |
| WhatsApp | Instance UltraMsg en veille | Relier l'instance au téléphone, premier envoi réel |
| Mise en production | À préparer | Domaine, production Convex, sauvegardes, passation |
| Calendrier | Ajouts du mois pris sur la fenêtre de recette | Le 10 octobre reste tendu |

---

## 6. Chiffres du mois

| Indicateur | Valeur |
|---|---|
| Livraisons versionnées (dépôt créé le 7 septembre) | 90 |
| Écrans de l'application | 22 (+ « Mes bulletins ») |
| Écrans sur la nouvelle charte | 21 sur 22 |
| Modules réglables dans la matrice des droits | 23 |
| Suites de tests automatisés | 10, toutes au vert |
| Scénarios de recette (cahier n°3) | 152 |
| Comptes de test | 8, un par rôle, tous vérifiés |
| Demandes de M. GAMBOU livrées | 8 sur 8 (envoi WhatsApp réel à confirmer) |
| Règles de calcul inventoriées | 110 |
| Décisions consignées au journal | 30+ |
| Achèvement estimé | 85 % |

---

## 7. Programme d'octobre

1. **Semaine du 5 octobre** : intégrer les résultats de la recette et de la séance à la Polyclinique (droits par défaut,
   corrections) ; masquage des actions selon les droits ; corriger les incohérences de calcul arbitrées ; refonte de
   l'écran Barème selon la proposition validée.
2. **Préparation de la mise en service** : production Convex, domaine et HTTPS, sauvegardes et exercice de restauration,
   données réelles, guide utilisateur par rôle, procédure de secours.
3. **Mise en service visée le vendredi 10 octobre**, après une répétition la veille.

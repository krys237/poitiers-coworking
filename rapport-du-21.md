# Rapport du 21 septembre 2026

**Projet** : POITIERS COWORKING — plateforme unifiée d'administration et de paie
**Période couverte** : semaine du lundi 21 septembre (sprint S1 du plan), prolongée jusqu'au lundi 28 septembre 2026 au soir
**Rédigé par** : krys237

---

## 1. En bref

Le sprint S1 du plan (« le bulletin fait foi », 21 → 26 septembre) prévoyait **37 tâches** dans le backlog Jira.
**34 sont faites ou dépassées** ; les trois qui restent dépendent d'un geste hors développement (validation papier
par le directeur, données réelles de l'effectif).

La semaine a surtout apporté trois changements de fond :

1. **Les demandes de M. GAMBOU sont toutes réglées** : bulletin consultable par l'employé, PDF des bulletins en un
   clic, verrou d'une heure sur la caisse et les primes médecins, destinataires choisis pour un document, courrier
   de paie par WhatsApp, connexion depuis l'extérieur de la Polyclinique, usage sur téléphone pour l'employé.
2. **Les droits ne suivent plus une hiérarchie rigide.** Le directeur décide lui-même, d'un clic, qui **voit** et
   qui **fait** quoi, module par module, et peut accorder ou retirer un droit à une personne précise.
3. **Le bulletin est prêt pour la validation papier** : il tient sur une seule feuille A4, s'intitule désormais
   « BULLETIN DU MOIS », et le jeu d'impression destiné au directeur est prêt.

Achèvement estimé : **82 %** (78 % le 21 au matin). Mise en service visée : **vendredi 10 octobre 2026**.

---

## 2. Le sprint S1 du Jira : prévu et réalisé

Le backlog Jira (`jira-backlog-coworking.csv`) comptait 37 tâches pour S1. 29 étaient déjà livrées au 23/09 ;
voici le sort des 8 restantes au 28/09.

| Tâche Jira (S1) | Épopée | Statut au 23/09 | Statut au 28/09 |
|---|---|---|---|
| Remettre au directeur le jeu d'impression (3 bulletins, liste, courrier) | Documents imprimables | En cours | **Fait** — `jeu-impression-directeur-2026-09.pdf` (6 pages), à imprimer et remettre |
| Validation papier du bulletin par le directeur | Documents imprimables | À tester | **En attente** du directeur (dépend de la remise du jeu) |
| Corrections issues de la validation papier | Documents imprimables | À faire | **Anticipées** : bulletin ramené sur une feuille, titre « BULLETIN DU MOIS » ; le reste suivra la relecture |
| Vérifier chaque compte de test un par un | Accès, rôles & sécurité | À tester | **Fait** — les 8 comptes se connectent avec le bon rôle et le bon menu (`design/verif-comptes.mjs`) |
| Changer le mot de passe du super administrateur | Accès, rôles & sécurité | À faire | **Reporté** à la mise en production (décision du 28/09 : on reste en mode test) |
| Fournir les attendus de la recette, écran par écran | Recette & qualité | À faire | **Réorienté** : les cahiers existants datent d'avant la refonte ; le développement les réécrit (S2) |
| Constituer les données de recette réelles (effectif, soldes J0) | Recette & qualité | À faire | **En attente** du propriétaire |
| Rapport de la semaine du 21 septembre | Pilotage & documentation | À faire | **Fait** — le présent rapport |

Rappel des 29 tâches S1 déjà livrées (détaillées dans le rapport du 14) : bulletin refondu (écran, impression, PDF),
Paramètres en six sections, réglages de fonctionnement sortis du code, DA2 retiré et super administrateur créé,
écran de connexion par e-mail ou téléphone, téléphone avec indicatif, mode développement coupé, huit comptes de
test, aperçus en lecture seule (documents, comptes rendus), plan d'avancement, journal des décisions, guide
interactif, backlog Jira, et quatre anomalies corrigées (solde de trésorerie visible par tous, action d'archivage
sans contrôle, jeton de session invalide, page blanche sur adresse inconnue).

---

## 3. Demandes de M. GAMBOU — réglées

| Demande | Réponse livrée |
|---|---|
| **Employé** — visualiser son bulletin de paie | Nouvel écran **« Mes bulletins »** : chaque employé voit ses bulletins des mois clôturés et télécharge le PDF. Pensé d'abord pour le téléphone. Le compte est relié à la fiche employé dans Membres. |
| **Comptable** — définir qui peut recevoir un document | Au dépôt d'un document : « Seulement des personnes choisies ». Il n'est alors visible et téléchargeable que par elles et le déposant, quel que soit leur niveau. |
| **Comptable** — plus de modification après 1 h sur « Caisse et primes médecins », sauf l'administrateur | Une ligne se verrouille **1 heure après sa saisie** (délai réglable dans Paramètres). Ensuite, seul le droit « modifier après le délai » (le directeur par défaut) la corrige, et la correction est inscrite au journal. |
| **Administrateur** — bouton pour générer le PDF du salaire dans « Bulletin du mois » | Boutons **« PDF du mois »** (un fichier, un bulletin par page) et **« PDF »** pour un salarié. |
| **Administrateur** — envoi du courrier de paie par WhatsApp | Choix du canal dans le Courrier de paie : **e-mail, WhatsApp ou les deux**, avec le numéro WhatsApp de la personne (fiche employé). Envoi par UltraMsg, PDF joint, lettre en légende ; journal par canal. |
| **Administrateur et auditeur** — se connecter hors de la Polyclinique | Déjà possible : l'application n'impose aucune restriction de lieu ni d'adresse. |
| **Auditeur externe** — mêmes accès que l'administrateur sauf la visualisation des documents | L'auditeur **consulte** tous les modules sans pouvoir y agir, sauf Paramètres, Journal d'activité, Archives et documents de la structure ; il saisit l'audit. Précisé avec le propriétaire : il n'a pas les droits du directeur. |
| **NB** — utilisation sur téléphone | L'écran de l'employé (« Mes bulletins ») est conçu pour le téléphone ; le menu passe en tiroir. L'adaptation du reste de l'ERP, « au moins lisible », est planifiée en S2–S3. |

**Point en attente** : le premier envoi WhatsApp réel. Les clés UltraMsg sont posées et l'envoi réel est activé,
mais l'instance UltraMsg est en veille (« standby ») : rien ne part tant qu'elle n'est pas reliée au téléphone.
D'ici là, l'application **simule** l'envoi et le dit clairement (« Simuler l'envoi », « rien n'est parti »).

---

## 4. Les droits choisis par le directeur

La règle « le niveau N voit et fait tout ce que fait le niveau N−1 » était trop grossière pour l'usage voulu.
Elle est remplacée :

- **Paramètres → Rôles & accès** présente un tableau : une ligne par module (23), une colonne par rôle, et deux
  cases par croisement, **Voir** (consulter) et **Faire** (saisir, valider, envoyer). Un clic suffit ; les
  changements partent avec « Enregistrer » et sont journalisés. Le super administrateur, compte technique,
  n'apparaît pas dans le tableau.
- **Exceptions par personne** : accorder ou retirer un droit à un membre précis, au-delà de son rôle.
- **Garde-fou** : le directeur ne peut pas se retirer Paramètres ni Membres.
- **Droits de départ** = l'ancien fonctionnement (vérifié par 218 contrôles automatiques), plus les décisions de la
  semaine : le comptable accède au récapitulatif financier et au grand livre ; l'auditeur consulte sans agir.
- Le contrôle est fait **par le serveur** : décocher une case bloque réellement l'action, pas seulement le menu.

**Règle posée pour la suite** : retirer un droit fait disparaître les actions qui en dépendent, pour le rôle ou la
personne concernés. Le menu et l'accès aux écrans la respectent déjà ; plusieurs écrans montrent encore des
boutons à qui n'a que « Voir » (le serveur les refuse). La mise en conformité écran par écran est inscrite au
cahier de recette.

---

## 5. Bulletin et documents imprimés

- **Une feuille par bulletin** : à l'impression, le bulletin débordait d'un tiers de page (308 mm pour 273 utiles).
  Il tient désormais sur une feuille, sans changer l'écran.
- **« BULLETIN DU MOIS »** remplace « Bulletin de paie » sur l'écran, l'impression et le PDF.
- **Jeu d'impression du directeur** : 3 bulletins (cas de référence, cadre à IRPP élevé, retenues diverses), la liste
  des salaires et un courrier de paie, produits par l'application elle-même (`design/jeu-impression.mjs`).
- Paramètres : « Raison sociale » devient **« Nom de l'entreprise »**. À corriger dans les données avant la remise :
  le nom saisi (« P POITIERS COWORKING »), le NIU et le N° CNPS employeur, vides.

---

## 6. Autres corrections de la semaine

- **Téléphone** : l'indicatif (+237) est **pré-rempli partout, jamais retapé** ; un numéro importé sans indicatif le
  reçoit automatiquement. Un numéro copié depuis WhatsApp (qui y ajoute des caractères invisibles) était refusé à
  tort : corrigé. Un numéro complet collé dans la partie nationale doublait l'indicatif sans prévenir : corrigé.
- **Courrier** : une simulation ne peut plus passer pour un envoi réel.
- **Cahiers de recette** : audités ; ceux du 7 et du 14 septembre sont antérieurs à la refonte (connexion, rôles,
  écrans) et seront réécrits.

---

## 7. État d'avancement

| Chantier | 21/09 | 28/09 | Commentaire |
|---|---|---|---|
| Socle & modèle de données | 90 % | 90 % | Stable ; barème officiel et agrégats d'audit restent au backlog |
| Paie automatisée | 95 % | 95 % | Tests chiffrés au vert |
| Exploitation & activité | 95 % | 95 % | Verrou caisse, destinataires de documents ajoutés |
| Finances & grand livre | 90 % | 90 % | Ouvert au comptable |
| **Accès, rôles & sécurité** | 90 % | **95 %** | Droits configurables par le directeur ; politique de mot de passe à faire |
| **Documents imprimables** | 85 % | **90 %** | Bulletin sur une feuille, PDF à la demande ; validation papier attendue |
| Paramètres & réglages | 100 % | 100 % | + délai de la caisse, + WhatsApp |
| Recette & qualité | 25 % | 30 % | 10 suites de tests au vert ; cahiers à réécrire |
| Mise en production | 30 % | 35 % | Clés UltraMsg posées ; domaine, Resend, production Convex à faire |
| Pilotage & documentation | 80 % | 85 % | État du projet, journal des décisions (30 entrées), ce rapport |

---

## 8. Points de vigilance

| Sujet | Situation | Action attendue |
|---|---|---|
| Validation papier du bulletin | Jeu d'impression prêt | Le directeur relit et signe ; corriger les écarts (S2) |
| Données de l'entreprise | Nom mal saisi, NIU et N° CNPS vides | À corriger dans Paramètres avant la remise du jeu |
| WhatsApp | Instance UltraMsg en veille | Relier l'instance au téléphone, puis faire le premier envoi réel |
| E-mail réel | Simulation (pas de domaine) | Acheter le domaine, le vérifier chez Resend (butoir 3/10) |
| Données réelles | Recette sur données de démonstration | Fichier de l'effectif et soldes J0 |
| Calendrier | Ajouts de la semaine pris sur la fenêtre de recette | Recette ramenée à 3 jours (5 → 7/10) ; la date du 10/10 est tendue |

---

## 9. Chiffres de la période

| Indicateur | Valeur |
|---|---|
| Livraisons versionnées (21/09 au soir → 28/09) | 18 |
| Fichiers modifiés | 73 (≈ 3 450 lignes ajoutées, dont 1 660 dans l'application) |
| Tâches S1 du Jira faites ou dépassées | 34 sur 37 |
| Demandes de M. GAMBOU réglées | 8 sur 8 (envoi WhatsApp réel à confirmer) |
| Modules réglables dans la matrice des droits | 23 |
| Suites de tests automatisés | 10, toutes au vert (dont 218 contrôles des droits et 15 du téléphone) |
| Comptes de test vérifiés | 8 sur 8 |
| Décisions consignées | 30 |
| Achèvement estimé | 82 % |

---

## 10. Programme de la semaine du 29 septembre (S2 : « la clinique teste »)

1. Réécrire les cahiers de recette : un scénario par écran et par rôle, y compris la règle « un droit retiré, ses
   actions disparaissent ».
2. Mettre les écrans en conformité avec cette règle (boutons d'action masqués sans « Faire »).
3. Campagne de tests avec les huit comptes, deux lots de corrections.
4. Adapter l'ERP au téléphone, au moins lisible (priorité aux écrans de l'employé).
5. Premier envoi WhatsApp réel dès que l'instance UltraMsg est reliée ; domaine et Resend pour l'e-mail.
6. Politique de mot de passe (10 caractères), unification des tuiles des cinq écrans refondus en parallèle.

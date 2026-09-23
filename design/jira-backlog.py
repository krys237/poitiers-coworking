# -*- coding: utf-8 -*-
"""Backlog Jira du projet POITIERS COWORKING, au format CSV d'import.

Couvre tout le travail : ce qui est livré (avec sa semaine réelle), ce qui est en cours,
ce qui est à tester et ce qui reste à développer, calé sur le plan d'avancement du 21/09/2026
(S1 22-26 sept., S2 29 sept.-3 oct., S3 6-10 oct., mise en service le 10 octobre).

Usage : python design/jira-backlog.py  ->  jira-backlog-coworking.csv à la racine.
"""
import csv, os

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# --- Chronologie : sprint -> (début, fin) ------------------------------------------------
SPRINTS = {
    "Semaine 36 (31/08-06/09)": ("2026-08-31", "2026-09-06"),
    "Semaine 37 (07/09-13/09)": ("2026-09-07", "2026-09-13"),
    "Semaine 38 (14/09-20/09)": ("2026-09-14", "2026-09-20"),
    "S1 (21/09-26/09)": ("2026-09-21", "2026-09-26"),
    "S2 (29/09-03/10)": ("2026-09-29", "2026-10-03"),
    "S3 (06/10-10/10)": ("2026-10-06", "2026-10-10"),
    "": ("", ""),  # backlog non planifié
}
S36, S37, S38 = "Semaine 36 (31/08-06/09)", "Semaine 37 (07/09-13/09)", "Semaine 38 (14/09-20/09)"
S1, S2, S3, BL = "S1 (21/09-26/09)", "S2 (29/09-03/10)", "S3 (06/10-10/10)", ""

FAIT, COURS, TEST, AFAIRE = "Terminé", "En cours", "À tester", "À faire"

# --- Epics -------------------------------------------------------------------------------
EPICS = [
    ("Socle & données", "Socle", FAIT, "Modèle de données, moteur de paie, barème daté, tests automatisés, API d'export. La partie invisible du produit.", S37),
    ("Paie automatisée", "Paie", COURS, "Saisie mensuelle, bulletins, liste des salaires, courrier, planning, primes & retenues, archives, barème.", S38),
    ("Exploitation & activité", "Exploitation", FAIT, "Interventions, commandes, documents, comptes rendus, caisse & primes médecins, tableau de bord.", S38),
    ("Finances & grand livre", "Finances", COURS, "Grand livre journalier, soldes par canal, verrou de saisie, clôture mensuelle.", S38),
    ("Accès, rôles & sécurité", "Accès", COURS, "Authentification, matrice des rôles, membres, journal d'activité, API sécurisée.", S1),
    ("Documents imprimables", "Documents", COURS, "Bulletin de paie, liste des salaires, courrier : écran, impression A4 et PDF.", S1),
    ("Paramètres & réglages", "Paramètres", FAIT, "Identité de l'entreprise, règles de paie, réglages de fonctionnement, matrice des rôles, déploiement.", S1),
    ("Recette & qualité", "Recette", AFAIRE, "Cahier de recette final, campagne par rôle, accessibilité, mobile, corrections.", S2),
    ("Mise en production", "Production", AFAIRE, "Déploiement de production, domaine, e-mail réel, sauvegardes, répétition et mise en service.", S3),
    ("Pilotage & documentation", "Pilotage", COURS, "Plan d'avancement, journal des décisions, rapports hebdomadaires, guides, passation.", S1),
]

# --- Tickets : (type, résumé, description, statut, priorité, epic, sprint, points, labels, due) --
# `due` vide = fin du sprint. Une date explicite marque une butoir du plan d'avancement.
T = []
def t(typ, resume, desc, statut, prio, epic, sprint, pts, labels, due=""):
    T.append((typ, resume, desc, statut, prio, epic, sprint, pts, labels, due))

O = "Objectif"
C = "Critère de « fait »"

# ---------------------------------------------------------------- Socle & données
t("Story", "Analyse par reverse engineering des deux plateformes existantes",
  f"{O} : comprendre Hercules (en production) et la version Lovable du directeur pour définir la cible.\n{C} : document de compréhension métier, esquisse d'architecture et rapport de semaine publiés.",
  FAIT, "High", "Socle & données", S36, 8, ["analyse", "dev"])
t("Story", "Modèle de données Convex : 20 tables, index et règles d'accès",
  f"{O} : une seule source de vérité pour les entités (employés, saisies, bulletins, journées financières, documents, membres).\n{C} : schema.ts stable, index interrogés par les fonctions métier.",
  FAIT, "High", "Socle & données", S37, 8, ["backend", "dev"])
t("Story", "Moteur de paie pur : brut, cotisations, impôts, net",
  f"{O} : calcul testable isolément (lib/paie.ts), indépendant de la base.\n{C} : suite test:paie au vert, égalité stricte avec les cas chiffrés du directeur.",
  FAIT, "Highest", "Socle & données", S37, 8, ["backend", "paie", "dev"])
t("Story", "Barème CNPS / CGI daté et contrôle quotidien de la source",
  f"{O} : un bulletin utilise la version du barème applicable à sa période ; un mois clôturé n'est jamais recalculé.\n{C} : versions datées, cron de contrôle à 06:00 UTC, résultat journalisé.",
  FAIT, "High", "Socle & données", S37, 5, ["backend", "paie", "dev"])
t("Story", "Huit suites de tests automatisés sur la logique pure",
  f"{O} : paie, trésorerie, fenêtre des comptes rendus, commandes, statistiques, audit, API, proxy.\n{C} : les huit suites passent (npm run test:*).",
  FAIT, "High", "Socle & données", S37, 5, ["qualite", "dev"])
t("Story", "Alignement de la paie sur le format de référence du directeur",
  f"{O} : montants et présentation identiques au franc près (Total 1, Total 2, TDL, RAV, IRPP annuel).\n{C} : deux cas de référence fournis par le directeur vérifiés par les tests.",
  FAIT, "Highest", "Socle & données", S37, 8, ["paie", "dev"])
t("Story", "Mise en ligne : dépôt GitHub, backend Convex, frontend Vercel",
  f"{O} : la plateforme est consultable depuis un lien, sans installation.\n{C} : déploiement accessible, liens profonds réécrits, variable VITE_CONVEX_URL en place.",
  FAIT, "High", "Socle & données", S37, 3, ["infra", "dev"])
t("Story", "API d'export financier et proxy Node (IP, clé, quota)",
  f"{O} : exposer le grand livre journalier aux systèmes tiers sans exposer le backend.\n{C} : GET /api/financial contrôlé des deux côtés, tests test:api et test:proxy au vert.",
  FAIT, "Medium", "Socle & données", S37, 5, ["backend", "api", "dev"])
t("Story", "Comparer réellement le barème avec la source officielle",
  f"{O} : aujourd'hui le contrôle vérifie seulement que la source répond.\n{C} : écart détecté et signalé dans le journal ; proposition de nouvelle version au DG.\nDépend de : choix de la source officielle à surveiller.",
  AFAIRE, "Low", "Socle & données", BL, 5, ["backend", "paie", "dev"])
t("Story", "Agrégats mensuels stockés pour l'audit au-delà de 24 mois",
  f"{O} : l'horizon des séries d'audit est plafonné à 24 mois car chaque mois est recalculé à l'appel.\n{C} : table d'agrégats alimentée à la clôture, séries pluriannuelles et agrégation par trimestre dans les graphes.",
  AFAIRE, "Low", "Socle & données", BL, 8, ["backend", "audit", "dev"])

# ---------------------------------------------------------------- Paie
t("Story", "Récapitulatif salaires : synthèse et volet, grille en mode persistant",
  f"{O} : saisir 18 colonnes sans perdre le fil ; option C par défaut, « Rendre les champs persistants » bascule sur la grille.\n{C} : écran livré, formalisme des chiffres appliqué, actions fiche employé disponibles.",
  FAIT, "High", "Paie automatisée", S38, 5, ["front", "paie", "dev"])
t("Story", "Liste des salaires : écran et impression A4",
  f"{O} : « Récapitulatif général salaire et primes perçus », net dans la colonne de la société.\n{C} : écran sur la charte, feuille A4 imprimable, coquille masquée à l'impression.",
  FAIT, "High", "Paie automatisée", S38, 3, ["front", "paie", "document", "dev"])
t("Story", "Courrier de paie : destinataires, modèle, aperçu, envoi confirmé",
  f"{O} : une lettre et un bulletin par salarié, imprimables ou envoyés en PDF.\n{C} : table des destinataires, modèle de lettre, aperçu par employé, journal des envois.",
  FAIT, "High", "Paie automatisée", S38, 5, ["front", "paie", "dev"])
t("Story", "Planning des absences : saisie en série, soldes et jours travaillés",
  f"{O} : les absences non payées alimentent la paie du mois sans double saisie.\n{C} : ajout et modification d'absence, synchronisation de la paie, onglet soldes de congés.",
  FAIT, "High", "Paie automatisée", S38, 5, ["front", "paie", "dev"])
t("Story", "Primes & retenues (paie) : saisie en série et libellés explicites",
  f"{O} : distinguer les primes de paie des primes médecins (hors paie).\n{C} : écran renommé, ligne de saisie permanente, modification et suppression confirmées.",
  FAIT, "Medium", "Paie automatisée", S38, 3, ["front", "paie", "dev"])
t("Story", "Archives de paie : mois clôturés, bulletins figés, PDF",
  f"{O} : retrouver, prévisualiser, télécharger ou ré-imprimer un bulletin passé.\n{C} : tableau des mois, volet des bulletins du mois, aperçu et téléchargement PDF.",
  FAIT, "Medium", "Paie automatisée", S38, 5, ["front", "paie", "dev"])
t("Story", "Barème : versions en tableau, écarts, nouvelle version confirmée",
  f"{O} : lire les taux applicables et créer une version datée sans se tromper.\n{C} : détail par famille de taux, ancienne valeur barrée quand elle change, validation avant enregistrement.",
  FAIT, "Medium", "Paie automatisée", S38, 5, ["front", "paie", "dev"])
t("Story", "Employés : saisie en série et fiche partagée avec le récapitulatif",
  f"{O} : créer et modifier un effectif sans quitter l'écran.\n{C} : ligne de saisie permanente, fiche employé commune aux deux écrans, import CSV conservé.",
  FAIT, "Medium", "Paie automatisée", S38, 3, ["front", "paie", "dev"])
t("Story", "Bulletins du mois : récapitulatif-sommaire, aperçu A4, clôture confirmée",
  f"{O} : voir tous les bulletins d'un mois et imprimer soit tout, soit un seul.\n{C} : tableau récapitulatif cliquable, aperçu A4 du salarié choisi, impression = récapitulatif puis un bulletin par page, clôture par mot-clé.",
  FAIT, "High", "Paie automatisée", S1, 5, ["front", "paie", "dev"])
t("Task", "Génération des PDF d'archives explicite et confirmée",
  f"{O} : le compteur « PDF (n) » ressemblait à un badge et lançait la génération au clic.\n{C} : action « Générer les PDF manquants (n) » avec confirmation ; mutation interne de remise à zéro pour rejouer.",
  FAIT, "Medium", "Paie automatisée", S38, 2, ["front", "paie", "dev"])

# ---------------------------------------------------------------- Exploitation
t("Story", "Interventions : file de traitement et volet de détail",
  f"{O} : traiter les demandes sans perdre le contexte.\n{C} : liste à gauche, détail ancré à droite, workflow et photos conservés.",
  FAIT, "Medium", "Exploitation & activité", S38, 5, ["front", "dev"])
t("Story", "Commandes : tableau sur la charte et comparaison automatique",
  f"{O} : comparer une commande à la précédente du même type.\n{C} : tableau à défilement intégré, lignes ajoutées / retirées / modifiées, workflow de validation.",
  FAIT, "Medium", "Exploitation & activité", S38, 3, ["front", "dev"])
t("Story", "Documents : tableau et cartes, dépôt avec extraction des métadonnées",
  f"{O} : archiver et retrouver une pièce, avec un accès par objet (niveau, code, confidentiel).\n{C} : deux vues, dépôt avec extraction IA ou repli heuristique, téléchargement contrôlé.",
  FAIT, "Medium", "Exploitation & activité", S38, 3, ["front", "dev"])
t("Story", "Comptes rendus : fenêtre de soumission, score, vue superviseur",
  f"{O} : un compte rendu par membre et par jour, 1 point dans la fenêtre.\n{C} : espace du membre, taux de soumission de l'équipe, validation éditoriale.",
  FAIT, "Medium", "Exploitation & activité", S38, 3, ["front", "dev"])
t("Story", "Caisse & primes médecins : deux onglets au lieu de huit",
  f"{O} : saisir la caisse du jour et les primes sans huit clics.\n{C} : deux onglets, saisie en série, graphes à côté des chiffres, barre latérale repliée pendant la saisie.",
  FAIT, "Medium", "Exploitation & activité", S38, 5, ["front", "dev"])
t("Story", "Tableau de bord : bannière d'accueil, tuiles et raccourcis par rôle",
  f"{O} : la vitrine de la plateforme, adaptée au niveau du membre.\n{C} : bannière, tuiles KPI, à-faire du jour, graphes ; chaque bloc conditionné au niveau.",
  FAIT, "High", "Exploitation & activité", S1, 5, ["front", "dev"])
t("Story", "Aperçu en lecture seule d'un compte rendu (superviseur)",
  f"{O} : le responsable doit pouvoir lire un compte rendu depuis les actions de la ligne.\n{C} : bouton Aperçu, contenu non modifiable, Valider / Rouvrir à portée.",
  FAIT, "Medium", "Exploitation & activité", S1, 2, ["front", "dev"])
t("Story", "Aperçu en lecture seule d'un document",
  f"{O} : lire un document sans droit de téléchargement.\n{C} : bouton Aperçu dès le droit de voir ; PDF, images et fichiers texte affichés ; code d'accès appliqué ; mutation apercuUrl côté serveur.",
  FAIT, "Medium", "Exploitation & activité", S1, 3, ["front", "backend", "dev"])
t("Task", "Unifier les tuiles KPI des cinq écrans refondus en parallèle",
  f"{O} : tableau de bord, financier, commandes, documents et comptes rendus utilisent des tuiles faites main.\n{C} : une seule tuile (GrilleTuiles / Tuile) dans toute la plateforme.",
  AFAIRE, "Medium", "Exploitation & activité", S2, 3, ["front", "dette", "dev"])
t("Task", "Retirer le CSS hérité (legacy.css)",
  f"{O} : 529 lignes de styles d'avant la refonte encore chargées.\n{C} : fichier vide puis supprimé, import retiré, aucune régression visuelle.",
  AFAIRE, "Low", "Exploitation & activité", S3, 2, ["front", "dette", "dev"])

# ---------------------------------------------------------------- Finances
t("Story", "Récapitulatif financier : cockpit bicolonne et huit cartes de solde",
  f"{O} : saisir la journée sans faire défiler la page.\n{C} : synthèse à gauche, saisie à droite, 8 cartes KPI sur deux lignes, sélecteur de caisses en grille.",
  FAIT, "High", "Finances & grand livre", S38, 8, ["front", "finances", "dev"])
t("Story", "Clôture financière mensuelle et verrou de journée",
  f"{O} : figer un mois et empêcher deux saisies simultanées.\n{C} : journées immuables après clôture, verrou par membre avec expiration, purge hebdomadaire.",
  FAIT, "High", "Finances & grand livre", S37, 3, ["backend", "finances", "dev"])
t("Task", "Durée d'expiration du verrou réglable depuis Paramètres",
  f"{O} : la durée était une constante de code (15 min).\n{C} : réglage « Fonctionnement », valeur par défaut inchangée.",
  FAIT, "Low", "Finances & grand livre", S1, 2, ["backend", "dev"])
t("Bug", "Le solde de trésorerie s'affichait à tout membre connecté",
  "Constaté en testant le compte « employé » : la requête financier.kpi ne contrôlait aucun niveau, et la tuile du tableau de bord n'était pas conditionnée.\nCorrigé : réservé au niveau du module /financier (5), côté serveur et à l'écran.",
  FAIT, "High", "Finances & grand livre", S1, 2, ["securite", "dev"])

# ---------------------------------------------------------------- Accès & rôles
t("Story", "Authentification réelle (Convex Auth) : mot de passe et code e-mail",
  f"{O} : la table users est à la fois l'identité et le registre des rôles.\n{C} : session signée par le déploiement, inscription sans droits, compte pré-provisionné rattaché à la première connexion.",
  FAIT, "Highest", "Accès, rôles & sécurité", S38, 8, ["backend", "securite", "dev"])
t("Story", "RBAC : fermeture des fonctions Convex publiques non contrôlées",
  f"{O} : aucune requête ni mutation accessible sans niveau.\n{C} : requireLevel sur chaque fonction métier, audit cloisonné.",
  FAIT, "Highest", "Accès, rôles & sécurité", S38, 5, ["backend", "securite", "dev"])
t("Story", "RBAC : gardes de route côté front et écran d'attente",
  f"{O} : taper une adresse à la main n'affiche plus un écran interdit.\n{C} : chaque route enveloppée d'un Guard, écran « compte en attente d'autorisation », menu filtré.",
  FAIT, "Highest", "Accès, rôles & sécurité", S38, 5, ["front", "securite", "dev"])
t("Story", "Membres & accès : file d'autorisation et pré-provisionnement en série",
  f"{O} : le DG crée les comptes et accorde les accès depuis un seul écran.\n{C} : fiche membre en dialogue, autorisation d'une inscription spontanée, saisie en série, garde-fou du dernier DG.",
  FAIT, "High", "Accès, rôles & sécurité", S38, 5, ["front", "dev"])
t("Story", "Journal d'activité : fenêtre de temps, familles d'actions, export CSV",
  f"{O} : qui a fait quoi, quand — consultable et exportable pour l'auditeur.\n{C} : filtres cumulés, détail d'un événement, export de la sélection.",
  FAIT, "Medium", "Accès, rôles & sécurité", S38, 5, ["front", "dev"])
t("Story", "Fiche API : état, codes de réponse, proxy, derniers appels",
  f"{O} : documentation vivante pour l'intégrateur, surveillance pour le DG.\n{C} : requêtes copiables, codes expliqués, 20 derniers appels, clé jamais affichée.",
  FAIT, "Low", "Accès, rôles & sécurité", S38, 3, ["front", "api", "dev"])
t("Story", "Retirer le niveau 6 (DA2) et créer le super administrateur (niveau 8)",
  f"{O} : aucun droit ne distinguait DA2 de DA1 ; le technique doit sortir de la portée du DG.\n{C} : rbac.ts à jour, seeds et fiche API au niveau 8, compte « dev » passé super administrateur.\nDécision du propriétaire du 21/09/2026.",
  FAIT, "High", "Accès, rôles & sécurité", S1, 5, ["backend", "securite", "dev"])
t("Story", "Attribution de rôle bornée au niveau de l'auteur",
  f"{O} : nul ne peut attribuer un rôle au-dessus du sien ni modifier un membre au-dessus de lui.\n{C} : contrôle serveur, rôles hors de portée verrouillés à l'écran, changement de rôle directement dans la liste.",
  FAIT, "High", "Accès, rôles & sécurité", S1, 3, ["backend", "front", "securite", "dev"])
t("Story", "Écran de connexion : image de fond, modale, e-mail ou téléphone",
  f"{O} : une entrée claire, deux modes au choix, indicatif du pays pré-rempli comme sur WhatsApp.\n{C} : /connexion (alias /login), formulaire adapté au mode choisi, erreur unique, pas d'inscription ni d'OTP à l'écran.",
  FAIT, "Highest", "Accès, rôles & sécurité", S1, 5, ["front", "securite", "dev"])
t("Story", "Téléphone avec indicatif obligatoire partout",
  "Consigne transverse du propriétaire (21/09/2026) consignée dans DECISIONS.md.\n"
  f"{O} : le numéro sert d'identifiant de connexion et ne doit pas être ambigu.\n{C} : lib/telephone.ts (validation, normalisation +237…), composant ChampTelephone réutilisé dans Membres et à la connexion, unicité vérifiée.",
  FAIT, "High", "Accès, rôles & sécurité", S1, 3, ["front", "backend", "dev"])
t("Task", "Couper AUTH_DEV_BYPASS sur le déploiement",
  f"{O} : le lien public donnait les droits de direction à quiconque.\n{C} : variable à false, connexion obligatoire partout, vérifié avec un navigateur sans session.",
  FAIT, "Highest", "Accès, rôles & sécurité", S1, 1, ["securite", "infra", "dev"])
t("Task", "Créer huit comptes de test, un par rôle",
  f"{O} : permettre la recette par rôle.\n{C} : comptes <role>.test@poitiers.local avec mot de passe et numéro, fiche PDF acces-test.pdf pour les testeurs.",
  FAIT, "High", "Accès, rôles & sécurité", S1, 2, ["recette", "dev"])
t("Bug", "archiverPdfs était une action publique sans contrôle de niveau",
  "N'importe quel appelant authentifié pouvait déclencher la génération des PDF d'un mois.\nCorrigé : niveau 4 exigé, variante interne pour la génération planifiée à la clôture.",
  FAIT, "High", "Accès, rôles & sécurité", S1, 1, ["securite", "dev"])
t("Bug", "JWKS invalide : aucune session réelle ne pouvait s'ouvrir",
  "La variable JWKS du déploiement avait perdu ses guillemets (JSON invalide) : toute connexion réelle échouait sur « Auth provider discovery failed », masqué jusqu'ici par le mode développement.\nCorrigé : variable redéfinie, connexions vérifiées par e-mail et par téléphone.",
  FAIT, "Highest", "Accès, rôles & sécurité", S1, 2, ["securite", "infra", "dev"])
t("Bug", "Une adresse inconnue affichait une page blanche",
  "Le routeur n'avait pas de page « introuvable » : /login et toute adresse erronée donnaient un écran vide.\nCorrigé : alias /login vers /connexion et page « Cette page n'existe pas » avec retour au tableau de bord.",
  FAIT, "Medium", "Accès, rôles & sécurité", S1, 1, ["front", "dev"])
t("Task", "Changer le mot de passe du super administrateur",
  f"{O} : le compte technique partage aujourd'hui le mot de passe commun des comptes de test.\n{C} : mot de passe fort, connu du seul propriétaire, vérifié par une connexion.\nButoir : 23/09/2026 (décision D-1 du plan).",
  AFAIRE, "Highest", "Accès, rôles & sécurité", S1, 1, ["securite", "proprietaire"], "2026-09-23")
t("Task", "Vérifier chaque compte de test un par un",
  f"{O} : s'assurer que chaque rôle voit exactement ses écrans.\n{C} : les huit comptes ouverts successivement, menu et gardes conformes à la matrice, aucune anomalie ouverte.",
  TEST, "High", "Accès, rôles & sécurité", S1, 1, ["recette", "dev"])
t("Story", "Arbitrer les niveaux exacts de chaque rôle avec les spécialistes",
  f"{O} : comptable, DAF et RH n'ont pas encore été entendus ; la matrice actuelle est provisoire.\n{C} : un niveau validé par son titulaire pour chaque rôle, reporté dans convex/rbac.ts, matrice et documentation à jour.\nButoir : 02/10/2026 (décision D-5 du plan).",
  AFAIRE, "High", "Accès, rôles & sécurité", S2, 5, ["securite", "proprietaire"], "2026-10-02")
t("Task", "Relever la politique de mot de passe à 10 caractères",
  f"{O} : seuil provisoire de 8 caractères retenu pour la mise en service.\n{C} : refus d'un mot de passe faible avec un message clair, messages de connexion relus.",
  AFAIRE, "Medium", "Accès, rôles & sécurité", S2, 2, ["securite", "dev"])
t("Story", "Réinitialisation de mot de passe (« mot de passe oublié »)",
  f"{O} : aujourd'hui un mot de passe perdu se règle par le DG ou en console.\n{C} : parcours de réinitialisation par code e-mail, journalisé.\nDépend de : compte Resend et domaine vérifié.",
  AFAIRE, "Medium", "Accès, rôles & sécurité", BL, 5, ["securite", "dev"])

# ---------------------------------------------------------------- Documents imprimables
t("Story", "Maquette du bulletin refondu, pour validation",
  f"{O} : faire valider la mise en page avant de développer.\n{C} : maquette interactive (sept zones expliquées, état validé / provisoire, rendu actuel en regard) validée par le propriétaire le 21/09.",
  FAIT, "High", "Documents imprimables", S1, 3, ["document", "design", "dev"])
t("Story", "Bulletin de paie : écran et impression sur les briques de document",
  f"{O} : même charte que la liste des salaires et le courrier, sans changer une formule.\n{C} : sept zones, liste codée des rubriques inchangée, net en bleu sceau, filigrane PROVISOIRE tant que le mois est ouvert ; tient sur une A4.",
  FAIT, "Highest", "Documents imprimables", S1, 8, ["document", "paie", "dev"])
t("Story", "PDF du bulletin (pdf-lib) aligné sur la refonte",
  f"{O} : le PDF archivé et envoyé doit être identique au bulletin à l'écran.\n{C} : rendu trait pour trait, vérifié sur un PDF réellement généré depuis les archives.",
  FAIT, "High", "Documents imprimables", S1, 5, ["document", "paie", "dev"])
t("Bug", "Les PDF archivés recevaient un bulletin appauvri",
  "Les snapshots envoyés au générateur de PDF ne portaient ni période, ni date de paiement, ni validation, ni détails de calcul, ni NIU/CNPS employeur.\nCorrigé : la forme unifiée du bulletin (celle de l'écran et du courrier) est passée au générateur ; PDF de juillet régénérés.",
  FAIT, "High", "Documents imprimables", S1, 2, ["document", "paie", "dev"])
t("Task", "Remettre au directeur le jeu d'impression (3 bulletins, liste, courrier)",
  f"{O} : permettre la relecture papier.\n{C} : documents imprimés remis avec une fiche de relecture en cinq points.",
  COURS, "Highest", "Documents imprimables", S1, 1, ["document", "dev"], "2026-09-24")
t("Task", "Validation papier du bulletin par le directeur",
  f"{O} : arrêter la forme du document qui fait foi.\n{C} : bulletin signé, ou liste d'écarts renvoyée.\nButoir : 25/09/2026 (décision D-2 du plan).",
  TEST, "Highest", "Documents imprimables", S1, 2, ["document", "directeur"], "2026-09-25")
t("Task", "Corrections issues de la validation papier",
  f"{O} : traiter les écarts relevés par le directeur.\n{C} : écarts corrigés, nouvelle impression validée.\nDépend de : validation papier du bulletin.",
  AFAIRE, "High", "Documents imprimables", S1, 2, ["document", "dev"])
t("Task", "Recette d'impression comparée avant / après sur les trois documents",
  f"{O} : vérifier qu'aucune régression ne s'est glissée dans les documents papier.\n{C} : impressions avant / après archivées pour bulletin, liste des salaires et courrier.",
  TEST, "Medium", "Documents imprimables", S3, 2, ["document", "recette", "dev"])

# ---------------------------------------------------------------- Paramètres
t("Story", "Paramètres : six sections et un seul enregistrement",
  f"{O} : rassembler tout ce qui se règle une fois.\n{C} : entreprise & documents (avec aperçu de l'en-tête imprimé), paie & congés, courrier & e-mail, fonctionnement, rôles & accès, déploiement ; compteur de modifications, validation partagée, enregistrement journalisé.",
  FAIT, "High", "Paramètres & réglages", S1, 8, ["front", "dev"])
t("Story", "Sortir du code les réglages de fonctionnement de l'ERP",
  f"{O} : fenêtre des comptes rendus, verrou financier, envoi réel, IA documents, PDF à la clôture, jours de base, plafond de saisie étaient des constantes enfouies.\n{C} : lib/reglages.ts, valeurs par défaut = anciennes constantes, câblage vérifié module par module.",
  FAIT, "High", "Paramètres & réglages", S1, 5, ["backend", "dev"])
t("Story", "Matrice « Rôles & accès » dérivée du code",
  f"{O} : le DG doit voir ce que chaque rôle ouvre, sans lire le code.\n{C} : matrice droits × rôles générée depuis rbac.ts, fiches de rôles, règles transverses ; lecture seule.",
  FAIT, "High", "Paramètres & réglages", S1, 3, ["front", "securite", "dev"])
t("Story", "Onglet Déploiement réservé au super administrateur",
  f"{O} : savoir quelles clés sont configurées sans jamais montrer leur valeur.\n{C} : liste des variables avec leur rôle et la conséquence de leur absence ; niveau 8 exigé côté serveur.",
  FAIT, "Medium", "Paramètres & réglages", S1, 3, ["front", "securite", "dev"])

# ---------------------------------------------------------------- Recette
t("Story", "Écrire le cahier de recette final",
  f"{O} : un scénario par écran et par rôle, avec les attendus du propriétaire.\n{C} : cahier publié (page en ligne + PDF), colonnes attendu / constaté / verdict, un scénario par ligne de la matrice des rôles.\nDépend de : attendus de la recette (décision D-3).",
  AFAIRE, "Highest", "Recette & qualité", S2, 8, ["recette", "dev", "proprietaire"])
t("Task", "Fournir les attendus de la recette, écran par écran",
  f"{O} : ce que chaque rôle doit pouvoir faire et ne pas faire, du point de vue métier.\n{C} : attendus transmis au développeur.\nButoir : 26/09/2026 (décision D-3 du plan).",
  AFAIRE, "Highest", "Recette & qualité", S1, 3, ["recette", "proprietaire"], "2026-09-26")
t("Task", "Constituer les données de recette réelles",
  f"{O} : tester sur des chiffres que les utilisateurs reconnaissent.\n{C} : effectif réel importé (CSV), barème daté, un mois de paie complet, soldes J0 du grand livre.\nButoir : 26/09/2026 (décision D-4 du plan).",
  AFAIRE, "High", "Recette & qualité", S1, 5, ["recette", "proprietaire", "dev"], "2026-09-26")
for role, cible, niveau in [
    ("Employé", "employe.test@poitiers.local", "1"),
    ("Chef d'équipe", "chef.test@poitiers.local", "2"),
    ("Comptable", "comptable.test@poitiers.local", "3"),
    ("Gestionnaire RH", "rh.test@poitiers.local", "4"),
    ("Directeur Administratif (DAF)", "daf.test@poitiers.local", "5"),
    ("Directeur Général", "dg.test@poitiers.local", "7"),
    ("Super administrateur", "superadmin.test@poitiers.local", "8"),
    ("Auditeur externe", "auditeur.test@poitiers.local", "hors hiérarchie"),
]:
    t("Story", f"Recette — rôle {role}",
      f"{O} : parcourir tous les écrans ouverts à ce rôle avec son compte de test.\nCompte : {cible} (niveau {niveau}).\n{C} : chaque scénario du cahier a un verdict ; le menu ne montre que les écrans du rôle ; une adresse interdite tapée à la main est refusée ; anomalies consignées avec capture.",
      TEST, "High", "Recette & qualité", S2, 2, ["recette", "testeur"])
t("Task", "Corriger les anomalies de recette — lot 1 (mercredi)",
  f"{O} : traiter au fil de l'eau ce que la campagne remonte.\n{C} : anomalies bloquantes fermées le jour même.",
  AFAIRE, "High", "Recette & qualité", S2, 5, ["recette", "dev"], "2026-10-01")
t("Task", "Corriger les anomalies de recette — lot 2 (vendredi)",
  f"{O} : second lot de correction avant la semaine de mise en service.\n{C} : aucune anomalie bloquante ouverte à la fin de S2.",
  AFAIRE, "High", "Recette & qualité", S2, 5, ["recette", "dev"], "2026-10-03")
t("Task", "Passe accessibilité : navigation clavier et contrastes",
  f"{O} : l'application doit s'utiliser au clavier de bout en bout.\n{C} : parcours clavier complet sur les écrans de saisie, contrastes vérifiés, attributs aria corrigés.",
  TEST, "Medium", "Recette & qualité", S3, 5, ["qualite", "front", "dev"])
t("Task", "Passe mobile réelle (PWA installée sur téléphone)",
  f"{O} : la saisie doit rester possible sur téléphone.\n{C} : saisie mensuelle, comptes rendus et grand livre utilisables sur un téléphone réel, application installée.",
  TEST, "Medium", "Recette & qualité", S3, 5, ["qualite", "front", "dev"])

# ---------------------------------------------------------------- Mise en production
t("Story", "Déploiement Convex de production, distinct du développement",
  f"{O} : le lien public ne doit plus pointer sur le déploiement de travail.\n{C} : variables posées (JWT, JWKS, SITE_URL, clés), npx convex deploy, Vercel branché dessus, mode développement absent.",
  AFAIRE, "Highest", "Mise en production", S3, 3, ["infra", "dev"])
t("Story", "Domaine, HTTPS et proxy de l'API financière",
  f"{O} : une adresse définitive et une API exposée derrière le proxy.\n{C} : application servie sur le domaine, appel API de test passant par le proxy avec liste blanche d'IP.\nButoir de la décision : 03/10/2026 (D-6).",
  AFAIRE, "High", "Mise en production", S3, 3, ["infra", "proprietaire", "dev"], "2026-10-07")
t("Story", "Envoi d'e-mails réel (Resend, domaine vérifié)",
  f"{O} : le courrier de paie part réellement, avec le PDF en pièce jointe.\n{C} : clé posée, expéditeur sur un domaine vérifié, interrupteur « envoi réel » activé, courrier de test reçu dans une boîte réelle.\nButoir de la décision : 03/10/2026 (D-7).",
  AFAIRE, "High", "Mise en production", S3, 3, ["infra", "paie", "proprietaire", "dev"], "2026-10-07")
t("Task", "Sauvegardes planifiées et exercice de restauration",
  f"{O} : pouvoir revenir en arrière après une erreur de saisie ou une panne.\n{C} : sauvegardes planifiées, restauration réalisée et vérifiée sur un déploiement jetable, procédure écrite.",
  AFAIRE, "High", "Mise en production", S3, 3, ["infra", "dev"])
t("Task", "Activer l'extraction des documents par IA",
  f"{O} : aujourd'hui repli heuristique (titre = nom du fichier).\n{C} : clé ANTHROPIC_API_KEY posée, extraction vérifiée sur un document de test.",
  AFAIRE, "Low", "Mise en production", S3, 1, ["infra", "dev"])
t("Task", "Répétition de mise en service (jeudi)",
  f"{O} : dérouler la bascule à blanc avant le jour J.\n{C} : import réel, premier mois ouvert, comptes nominatifs créés, comptes de test désactivés, liste de contrôle signée.",
  AFAIRE, "Highest", "Mise en production", S3, 3, ["infra", "dev", "proprietaire"], "2026-10-09")
t("Task", "Mise en service",
  f"{O} : ouvrir la plateforme aux utilisateurs de la clinique.\n{C} : application ouverte, comptes nominatifs actifs, rapport final publié.",
  AFAIRE, "Highest", "Mise en production", S3, 2, ["infra", "dev", "directeur"], "2026-10-10")

# ---------------------------------------------------------------- Pilotage & documentation
t("Story", "Charte visuelle et skills de projet",
  f"{O} : une seule identité visuelle sur tous les écrans.\n{C} : palette Ocean Breeze, composants partagés, skills poitiers-ui-ux-system et flag-design-system (formalisme des chiffres, saisie en série, tableaux).",
  FAIT, "High", "Pilotage & documentation", S38, 3, ["design", "dev"])
t("Story", "Plan d'avancement sur trois semaines",
  f"{O} : fixer la mise en service et ce qui y mène.\n{C} : plan en ligne et PDF — objectifs par semaine, tâches, responsables, critères de fait, sept décisions avec butoir, risques, indicateurs.",
  FAIT, "High", "Pilotage & documentation", S1, 3, ["pilotage", "dev"])
t("Story", "Journal des décisions (DECISIONS.md)",
  f"{O} : garder la trace de chaque consigne transverse et de l'endroit du code qui l'applique.\n{C} : 14 décisions datées depuis le 17/09, à compléter à chaque nouvelle décision.",
  FAIT, "Medium", "Pilotage & documentation", S1, 2, ["pilotage", "dev"])
t("Story", "Rapport de la semaine 36 (analyse) et version PowerPoint",
  f"{C} : rapport publié et présenté au directeur.",
  FAIT, "Medium", "Pilotage & documentation", S36, 3, ["pilotage", "dev"])
t("Story", "Rapport de la semaine du 7 septembre",
  f"{C} : rapport publié (mise en ligne, alignement de la paie, cahier de recette révisé).",
  FAIT, "Medium", "Pilotage & documentation", S37, 2, ["pilotage", "dev"])
t("Story", "Rapport de la semaine du 14 septembre (md, PDF, PowerPoint)",
  f"{C} : rapport publié dans les trois formats, générateurs réutilisables pour les semaines suivantes.",
  FAIT, "Medium", "Pilotage & documentation", S1, 3, ["pilotage", "dev"])
t("Story", "Fiche des accès de test (PDF)",
  f"{O} : donner aux testeurs de quoi se connecter et quoi vérifier.\n{C} : acces-test.pdf — huit comptes, e-mail et téléphone, ce que chaque rôle doit voir, six points de contrôle.",
  FAIT, "Medium", "Pilotage & documentation", S1, 1, ["recette", "pilotage", "dev"])
t("Story", "Guide interactif de la plateforme",
  f"{O} : expliquer rôles et calculs aux utilisateurs depuis l'application.\n{C} : guide accessible depuis l'en-tête.",
  FAIT, "Low", "Pilotage & documentation", S1, 3, ["pilotage", "dev"])
t("Task", "Backlog Jira du projet au format CSV",
  f"{O} : donner à l'administrateur Jira un fichier importable couvrant tout le travail.\n{C} : jira-backlog-coworking.csv — epics, stories, tâches et bugs, statuts, sprints datés, points et butoirs.",
  FAIT, "Medium", "Pilotage & documentation", S1, 2, ["pilotage", "dev"])
t("Task", "Rapport de la semaine du 21 septembre",
  f"{C} : rapport publié le vendredi, section « suivi hebdomadaire » du plan mise à jour.",
  AFAIRE, "Medium", "Pilotage & documentation", S1, 2, ["pilotage", "dev"], "2026-09-26")
t("Task", "Rapport de la semaine du 28 septembre et bilan de recette",
  f"{C} : rapport publié, scénarios passés / échoués comptés.",
  AFAIRE, "Medium", "Pilotage & documentation", S2, 2, ["pilotage", "dev"], "2026-10-03")
t("Story", "Passation : guide utilisateur par rôle et procédure de secours",
  f"{O} : la clinique doit pouvoir créer un compte et attribuer un rôle sans aide.\n{C} : une page par rôle, procédure de secours (rôle restauré en console), journal des décisions et documentation du dépôt à jour.",
  AFAIRE, "High", "Pilotage & documentation", S3, 5, ["pilotage", "dev"])
t("Task", "Rapport final de mise en service",
  f"{C} : rapport publié le jour de la mise en service, avec l'état des indicateurs.",
  AFAIRE, "Medium", "Pilotage & documentation", S3, 2, ["pilotage", "dev"], "2026-10-10")

# --- Écriture du CSV ---------------------------------------------------------------------
ENTETES = ["Issue Type", "Summary", "Description", "Status", "Priority", "Component",
           "Epic Name", "Epic Link", "Sprint", "Story Points", "Start Date", "Due Date",
           "Labels", "Labels", "Labels", "Labels"]
MAX_LABELS = 4

chemin = os.path.join(RACINE, "jira-backlog-coworking.csv")
with open(chemin, "w", encoding="utf-8-sig", newline="") as f:
    w = csv.writer(f, quoting=csv.QUOTE_ALL)
    w.writerow(ENTETES)
    # Epics d'abord : Jira les crée avant de résoudre les « Epic Link ».
    for nom, composant, statut, desc, sprint in EPICS:
        debut, fin = SPRINTS[sprint]
        w.writerow(["Epic", nom, desc, statut, "High", composant, nom, "", sprint, "", debut, fin] + ["epic"] + [""] * (MAX_LABELS - 1))
    for typ, resume, desc, statut, prio, epic, sprint, pts, labels, due in T:
        composant = next(c for n, c, *_ in EPICS if n == epic)
        debut, fin = SPRINTS[sprint]
        etiquettes = (labels + [""] * MAX_LABELS)[:MAX_LABELS]
        w.writerow([typ, resume, desc, statut, prio, composant, "", epic, sprint, pts, debut, due or fin] + etiquettes)

print(chemin)
print(f"{len(EPICS)} epics + {len(T)} tickets = {len(EPICS) + len(T)} lignes")
compte = {}
for x in T:
    compte[x[3]] = compte.get(x[3], 0) + 1
print("par statut :", compte)

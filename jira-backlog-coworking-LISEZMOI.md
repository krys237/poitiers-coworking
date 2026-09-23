# Backlog Jira — POITIERS COWORKING

Fichier à importer : **`jira-backlog-coworking.csv`** (111 lignes : 10 epics + 101 tickets).
Généré le 23/09/2026 par `python design/jira-backlog.py` — relancer le script après toute mise à jour.

## Import dans Jira

1. **Paramètres du projet → Importer des données externes → CSV**, choisir le fichier.
2. **Encodage** : UTF-8. **Séparateur** : virgule.
3. **Format de date** : `yyyy-MM-dd` (toutes les dates du fichier sont au format `2026-09-22`).
4. Associer les colonnes ci-dessous, puis lancer l'import. Les **epics sont en tête du fichier** : Jira les crée
   avant de résoudre les liens.

| Colonne du fichier | Champ Jira | Remarque |
|---|---|---|
| `Issue Type` | Type de ticket | `Epic`, `Story`, `Task`, `Bug` |
| `Summary` | Résumé | — |
| `Description` | Description | Objectif, critère de « fait », dépendance ou butoir |
| `Status` | Statut | `Terminé`, `En cours`, `À tester`, `À faire` — à remapper sur votre workflow |
| `Priority` | Priorité | `Highest`, `High`, `Medium`, `Low` |
| `Component` | Composant | Socle, Paie, Exploitation, Finances, Accès, Documents, Paramètres, Recette, Production, Pilotage |
| `Epic Name` | Nom de l'epic | Rempli sur les 10 lignes `Epic` uniquement |
| `Epic Link` | Epic Link | Porte le **nom** de l'epic parent (projet *company-managed*) |
| `Sprint` | Sprint | Voir la chronologie ci-dessous |
| `Story Points` | Points | **1 point = une demi-journée** de travail |
| `Start Date` | Date de début | Début du sprint |
| `Due Date` | Date d'échéance | Fin du sprint, ou la date butoir quand le plan en fixe une |
| `Labels` ×4 | Étiquettes | Colonne répétée : `dev`, `proprietaire`, `directeur`, `testeur`, `securite`, `paie`, `front`, `backend`, `document`, `recette`, `infra`, `pilotage`, `dette`… |

> **Projet *team-managed*** (next-gen) : ce type de projet n'a pas de champ `Epic Link`. Dites-le-moi et je
> régénère le fichier avec une colonne `Parent` à la place.
>
> **Assignation** : volontairement vide. Le responsable prévu est porté par l'étiquette
> (`dev` = développement, `proprietaire` = propriétaire du projet, `directeur`, `testeur`).

## Chronologie

| Sprint | Période | Contenu |
|---|---|---|
| `Semaine 36 (31/08-06/09)` | 31/08 → 06/09 | Analyse des plateformes existantes, architecture cible |
| `Semaine 37 (07/09-13/09)` | 07/09 → 13/09 | Socle, moteur de paie, mise en ligne, API |
| `Semaine 38 (14/09-20/09)` | 14/09 → 20/09 | Authentification, rôles, refonte des écrans |
| `S1 (21/09-26/09)` | 21/09 → 26/09 | **Le bulletin fait foi** : bulletin refondu et validé, accès sécurisés |
| `S2 (29/09-03/10)` | 29/09 → 03/10 | **La clinique teste** : cahier de recette, campagne par rôle, niveaux de rôles |
| `S3 (06/10-10/10)` | 06/10 → 10/10 | **Prêt à mettre en service** : production, e-mail réel, sauvegardes, passation |
| *(vide)* | — | Backlog non planifié (3 tickets) |

**Mise en service visée : vendredi 10 octobre 2026.**

## Répartition

| Statut | Tickets |
|---|---|
| Terminé | 62 |
| En cours | 1 |
| À tester | 13 |
| À faire | 25 |

| Type | Tickets |
|---|---|
| Epic | 10 |
| Story | 69 |
| Task | 27 |
| Bug | 5 |

Les cinq `Bug` sont des anomalies **déjà corrigées**, conservées pour la traçabilité (solde de trésorerie visible
par tout membre, action de génération des PDF sans contrôle de niveau, JWKS invalide, PDF archivés appauvris,
page blanche sur adresse inconnue).

## Dates butoirs portées par les tickets

| Échéance | Ticket | Qui |
|---|---|---|
| 23/09 | Changer le mot de passe du super administrateur | propriétaire |
| 24/09 | Remettre au directeur le jeu d'impression | développement |
| 25/09 | Validation papier du bulletin | directeur |
| 26/09 | Fournir les attendus de la recette | propriétaire |
| 26/09 | Constituer les données de recette réelles | propriétaire |
| 02/10 | Arbitrer les niveaux exacts de chaque rôle | propriétaire |
| 07/10 | Domaine et proxy API · envoi d'e-mails réel | propriétaire |
| 09/10 | Répétition de mise en service | tous |
| 10/10 | Mise en service | tous |

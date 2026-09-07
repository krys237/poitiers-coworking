# Compréhension du projet — Plateforme collaborative « Polyclinique de Poitiers »

> Document de référence reconstitué par reverse engineering de la plateforme en production
> (`https://poitiers-coworking-366166.onhercules.app`), exploré avec un compte **Directeur Général (Admin)**.
> Objectif : permettre à quiconque le lit — humain ou assistant — de comprendre **ce qu'est le projet**,
> **à quoi il sert**, et **comment fonctionne chaque fonctionnalité**, afin de concevoir une plateforme équivalente.
>
> Dernière mise à jour : 2026-09-06 (ajout §11 changements plateforme Hercules, §12 comparaison avec la version Lovable).

---

## 1. Vue d'ensemble

### 1.1 Ce que c'est
Une **plateforme web interne de gestion administrative** pour un établissement de santé privé, la **Polyclinique de Poitiers**. Malgré l'URL et le nom de code interne « **Poitiers Coworking** », il ne s'agit **pas** d'un logiciel de coworking : c'est un **back-office hospitalier** qui centralise la gestion documentaire, financière, RH, la paie, les commandes et le suivi d'activité médicale.

L'application est une **PWA** (Progressive Web App) : installable sur ordinateur et mobile, elle fonctionne comme une application native et se met à jour automatiquement.

### 1.2 À qui elle sert
Au personnel administratif et de direction de la clinique, avec un accès **strictement gradué par rôle** (voir §4). Un rôle spécial existe pour des **auditeurs externes** qui ne voient qu'une partie confidentielle.

### 1.3 À quoi elle sert — les besoins couverts
1. **Suivi d'activité quotidien** — chaque membre soumet un compte rendu journalier ; la direction supervise le taux de participation.
2. **Trésorerie journalière** — un grand livre de caisse multi-comptes, alimenté chaque jour, avec soldes reportés automatiquement.
3. **RH & paie** — dossiers du personnel, récapitulatif des salaires et bulletins de paie au format légal camerounais.
4. **Approvisionnement** — commandes de médicaments/consommables et demandes de matériel des techniciens (avec validation hiérarchique).
5. **Primes des médecins & statistiques de caisse** — calcul des primes par catégorie d'acte et suivi mensuel du chiffre d'affaires.
6. **Audit confidentiel** — suivi cloisonné des primes et de la masse salariale pour contrôle externe.
7. **Gestion documentaire** — dépôt de documents avec catégorisation automatique par IA et contrôle d'accès fin.
8. **Intégration externe** — une API expose les données financières consolidées à des systèmes tiers (comptabilité, BI).

### 1.4 Contexte géographique et monétaire
- **Devise : FCFA** (franc CFA).
- **Contexte : Cameroun** — présence de références légales locales : **CNPS** (sécurité sociale), **IRPP** (impôt sur le revenu), siège mentionné à **Douala**, opérateurs de *mobile money* (**OM** = Orange Money, **MOMO** = MTN Mobile Money).

---

## 2. Architecture technique

| Couche | Technologie | Détail |
|---|---|---|
| Construction | **Hercules App Builder** | Plateforme *no-code/low-code* qui héberge et sert l'app (`*.onhercules.app`). |
| Backend / données | **Convex** | Base temps réel + *HTTP Actions*. Déploiement observé : `warmhearted-rook-684.convex.site`. Secrets gérés dans Hercules → *Advanced → Secrets*. |
| Frontend | **SPA** (single-page app) | Navigation par routes côté client ; PWA installable. |
| Authentification | **OAuth2 / OpenID Connect** | Fournisseur **Hercules Auth** (`*.hercules-auth.com`), flux **PKCE (S256)**, scopes `openid profile email offline_access`. |
| Anti-bot | **Cloudflare Turnstile** | Sur l'écran de connexion. |

### 2.1 Authentification — fonctionnement
1. L'utilisateur non connecté arrive sur `/readme` qui sert d'**écran de connexion** (bouton « Sign In »).
2. Redirection vers Hercules Auth : choix entre **Google, Apple, Microsoft**, ou **code à usage unique par e-mail (OTP)**.
3. Après validation (captcha Turnstile compris), redirection vers `/auth/callback?code=...` puis vers le tableau de bord.
4. La session ouvre l'app avec le rôle attribué au membre.

### 2.2 API Financière — architecture de sécurité
Une API permet à des systèmes externes de lire les données financières. **Deux couches** empilées, jamais contournables :

```
Client tiers ──X-Api-Key──▶ Proxy Node.js ──▶ Convex HTTP Action ──▶ Convex DB
                            (couche 1)          (couche 2)
```

- **Couche 1 — Proxy Node.js** (`api-proxy-server.js`, sans dépendance npm) : restriction par **IP**, validation de la **clé API**, **rate-limiting** (req/min). Configuré par un fichier `.env`.
- **Couche 2 — Convex HTTP Action** : **re-valide** la clé API côté backend (secret `FINANCIAL_API_KEY`).
- **Règle d'or** : ne jamais exposer le backend Convex directement sur Internet — toujours passer par le proxy.

**Endpoint :**
```
GET /api/financial?date=YYYY-MM-DD&entity=<entité>
Header: X-Api-Key: <clé ≥ 32 caractères>
```
- `date` — **requis**, format `YYYY-MM-DD`.
- `entity` — **optionnel** : `poitiers`, `lilas`, `edrtim`, `carte_visa`, `edrtim_finance`.
- Santé du proxy : `GET /health`.

**Configuration proxy (`.env`) :** `PROXY_PORT` (3100), `CONVEX_SITE_URL`, `FINANCIAL_API_KEY`, `ALLOWED_IPS` (vide = pas de restriction), `RATE_LIMIT_RPM`.

**Codes de réponse :** `200` succès · `401` clé manquante/invalide · `403` IP non autorisée · `429` quota dépassé · `502` erreur backend Convex.

**Durcissement recommandé :** TLS via Nginx/Caddy, rotation de la clé tous les 6 mois, proxy en réseau privé avec le port 3100 fermé côté Internet, logs JSON vers un monitoring.

---

## 3. Cartographie des routes

| Route | Module | Accès minimum |
|---|---|---|
| `/` | Tableau de bord | Tous |
| `/reports` | Comptes Rendus | Tous |
| `/documents` | Documents | Tous |
| `/tech-orders` | Commandes Techniciens | Tous |
| `/readme` | Lisez-moi (+ écran de connexion) | Tous / public |
| `/hr` | Registre RH | Niveau 3+ |
| `/orders` | Commande Médicale | Niveau 3+ |
| `/stats` | Statistiques & Primes | Niveau 3+ |
| `/payroll` | Récapitulatif Salaire | RH / Paie |
| `/payroll/bulletins` | Bulletins de Paie | RH / Paie |
| `/financial` | Récapitulatif Financier | Niveau 5+ |
| `/audit` | Auditeurs Externes | Auditeur externe + DG |
| `/admin/users` | Gestion Membres | DG (niveau 7) |

---

## 4. Modèle d'accès (RBAC)

Chaque membre porte **un rôle** qui détermine les modules visibles. Les niveaux sont **cumulatifs** : un niveau donné hérite des accès des niveaux inférieurs. Le **Directeur Général** attribue les rôles depuis `/admin/users`. Un membre est **Actif** ou **Inactif**.

| Niveau | Rôle | Accès |
|---|---|---|
| 1 | **Employé** | Base : tableau de bord, comptes rendus, documents, commandes techniciens. |
| 2 | **Chef d'équipe** | Idem employé + supervision d'équipe. |
| 3 | **Comptable** | + registre RH, commandes médicales, statistiques & primes. |
| 4 | **Directeur RH** | Accès RH complet + gestion des primes et statistiques. |
| 5 | **Directeur Administratif 1** | + récapitulatif financier, validation des commandes techniciens. |
| 6 | **Directeur Administratif 2** | Mêmes droits que DA1 (direction élargie). |
| 7 | **Directeur Général (Admin)** | Accès total : gestion des membres, tous les modules, auditeurs externes. |
| Spécial | **Auditeur Externe** | Tableau de bord + section Auditeurs Externes **uniquement** (cloisonné). |

> Le rôle **Auditeur Externe** est *orthogonal* à la hiérarchie : il ouvre un module (`/audit`) que même les niveaux 3–6 ne voient pas, tout en masquant tout le reste.

---

## 5. Les modules en détail

Pour chaque module : à quoi il sert, comment il fonctionne, ses champs et ses règles métier.

### 5.1 Tableau de bord — `/` — *Tous*
**Rôle :** point d'entrée, vue d'ensemble et raccourcis.
**Fonctionnement :** affiche des cartes de synthèse — **points de présence** (score cumulé de comptes rendus), **statut du compte rendu du jour** (ex. « En attente »), **rapports du mois**, **niveau d'accès**. Bloc « Accès rapide » vers Compte rendu, Documents, Fiche API (.doc). Salutation contextualisée par rôle.

### 5.2 Comptes Rendus — `/reports` — *Tous*
**Rôle :** rapport d'activité **journalier** de chaque membre + supervision.
**Fonctionnement :**
- Le membre rédige son compte rendu du jour (zone de texte + date) et le soumet.
- **Fenêtre de soumission** : chaque **jour ouvrable de 16h00 à 20h00**. Un compte à rebours indique la prochaine ouverture.
- Une soumission **hors fenêtre** reste possible mais est **signalée aux superviseurs** (marquée « hors fenêtre »).
- Un score **« points de présence »** récompense la régularité ; historique personnel consultable.
- **Vue Superviseur** : taux de soumission (ex. « 1/6 membres — 17 % »), **statut par membre** pour la journée, et **contenu** de chaque compte rendu soumis.

**Règle métier :** la ponctualité est un signal de gestion — le système distingue explicitement « soumis dans les temps » et « hors fenêtre ».

### 5.3 Documents — `/documents` — *Tous*
**Rôle :** espace documentaire sécurisé et centralisé.
**Fonctionnement :**
- Upload de fichiers (PDF, Word, Excel, image). **L'IA extrait automatiquement** titre, description et catégorie à l'upload (l'utilisateur peut corriger).
- Recherche plein texte + filtre par catégorie.
- **Contrôle d'accès par document** : niveau minimum pour **voir**, niveau minimum pour **télécharger**, case **« confidentiel (DAF/DG uniquement) »**, et un **code d'accès** optionnel exigé à la consultation.
- Génération d'une « Fiche API (.doc) ».

**Champs (dépôt) :** `fichier*`, `titre*` (pré-rempli IA), `description` (IA), `catégorie` (IA), `code_accès` (optionnel), `niveau_visible`, `niveau_téléchargement`, `adminOnly` (booléen confidentiel).

### 5.4 Commandes Techniciens — `/tech-orders` — *Tous (validation admin)*
**Rôle :** demandes de matériel des techniciens, soumises à validation.
**Fonctionnement :** un technicien crée une commande ; l'administration la **valide** ou la **rejette**. C'est un **objet collaboratif** avec fil de commentaires, pas un simple formulaire.
**Champs (création) :** `date`, `libellé` (optionnel), `demandeur*`, `service*`, `chef_service*`, `méthode*` (email/téléphone/en personne…), `photos[]` (upload ou appareil photo), puis un **tableau de lignes** `{ produit, DCI, quantité, prix_unitaire, prix_total }` avec total général, et un `commentaire`.
**Vue détail :** rappelle demandeur/service/chef/méthode, **statut** (En attente → Validé/Rejeté), créateur, commentaire initial, photos, lignes produit avec total, boutons **Valider / Rejeter**, et un **fil de commentaires**.

### 5.5 Registre RH — `/hr` — *Niveau 3+*
**Rôle :** gestion des dossiers du personnel.
**Fonctionnement :** compteurs en tête (effectif total, nombre de départements, **alertes contrats**, contrats expirés). Liste des employés avec poste, département, type de contrat (CDI…). Recherche + filtres par département et par contrat. Onglet « Récap Salaires ».
**Champs (nouvel employé) :** `nom_complet*`, `poste*`, `département*`, `niveau_études`, `diplômes`, `type_contrat` (CDI…), `salaire_mensuel` (FCFA), `date_début`, `date_fin` (si applicable), `congés` (historique + solde, texte), `avancements` (texte), `cv_notes` (texte).
**Règle métier :** les **alertes contrats** sont dérivées des dates de fin (contrats proches de l'échéance ou expirés).

### 5.6 Commande Médicale — `/orders` — *Niveau 3+*
**Rôle :** commandes de **médicaments** (avec DCI) et **consommables** médicaux.
**Fonctionnement :** deux onglets (Médicaments / Consommables). Tableau éditable de lignes `{ produit, DCI, quantité, prix_unitaire, prix_total }` avec total général. **Import / export CSV** (colonnes attendues : Nom du produit, DCI, Quantité, Prix unitaire). **Comparaison automatique** entre commandes successives. Historique horodaté ; chaque commande consultable en détail (avec téléchargement CSV).

### 5.7 Récapitulatif Financier — `/financial` — *Niveau 5+*
**Rôle :** **grand livre de caisse journalier** multi-comptes, cœur financier de la clinique.
**Fonctionnement :**
- On saisit les mouvements du jour ; les **soldes se reportent automatiquement** du jour précédent (J-1).
- **Verrou d'édition concurrent** : « Vous éditez ce tableau. Verrou actif / Libérer » — empêche deux personnes d'écrire en même temps. **Clôture (verrouillage) mensuelle** des données.
- **9 soldes d'ouverture (J0)** consolidés : F3 Poitiers, OM Poitiers, MOMO Poitiers, F3 Les Lilas, E DR TIM, OM Les Lilas, MOMO Les Lilas, Carte Visa, E DR TIM Finance.
- **8 blocs de recettes** (entités), chacun avec ses entrées, retraits et **soldes calculés par formule** :

| Bloc | Lignes saisies | Soldes calculés |
|---|---|---|
| **Recettes Poitiers** | Espèces, Dépôt chèque, Carte Visa, Retrait, OM du jour, Retrait OM, MOMO du jour, Retrait MOMO | Solde F3 = `J-1 + Espèces + Chèque + Visa − Retrait` ; Solde OM = `J-1 + OM − Retrait OM` ; Solde MOMO = `J-1 + MOMO − Retrait MOMO` |
| **Pharmacie Les Lilas** | Espèces, Dépôt chèque, Retrait, OM, Retrait OM, MOMO, Retrait MOMO | Solde F3 = `J-1 + Espèces + Chèque − Retrait` ; Solde OM ; Solde MOMO |
| **Carte Visa** | Dépôt, Retrait | Solde = `J-1 + Dépôt − Retrait` |
| **E DR TIM Finance** | Espèces, Dépôt chèque, Retrait | Solde = `J-1 + Espèces + Chèque − Retrait` |
| **Médicaments** | Espèces, Dépôt chèque, Retrait | Solde = `J-1 + Espèces + Chèque − Retrait` |
| **Biodiagnostic** | Espèces, Dépôt chèque, Retrait | idem |
| **MED-Esthetic** | Espèces, Dépôt chèque, Retrait | idem |
| **Autres Lignes** | TDM, Partage, Quantiferon, TEPSCAN (montants simples) | — |

- Chaque ligne d'entrée peut porter un **justificatif** (« Justif. »).
- **Récapitulatif du jour** : « Recette Totale du Jour » (calculée automatiquement), zone **Notes & Observations**, et **historique des 14 derniers jours**.

**Règle métier :** c'est un modèle de trésorerie à **report de solde** (comptabilité de caisse jour par jour), segmenté par entité juridique/canal d'encaissement (espèces, chèque, Visa, Orange Money, MTN MoMo).

### 5.8 Récapitulatif Salaire — `/payroll` — *RH / Paie*
**Rôle :** tableau de paie **mensuel** agrégé, par employé.
**Fonctionnement :** un sélecteur de mois ; une ligne par employé ; totaux en bas.
**Colonnes :** salaire journalier, nombre de jours travaillés, salaire de base, primes fixes/congé, heures sup/ancienneté, **Total 1**, sanctions, absence, dettes de soins, acompte/dette/impôts & CNPS, mutuelle, **Total 2**, salaire SESAME, salaire SOFINA, salaire SGC.
**Formules :**
- `Total 1 = Base + Prime + Congés + Heures sup + Ancienneté`
- `Total 2 = Total 1 − Sanction − Absence − Dette de soins − Acompte − Mutuelle`
- `Salaire net = Base + Prime + Congés + Heures sup + Ancienneté − Sanction − Absence − Dette de soins − Acompte − Mutuelle`
**Trois régimes de versement** (répartition du salaire) :
- **SESAME** : salaires d'employés/techniciens externes **non déclarés à la CNPS** et primes non déclarées.
- **SOFINA** : salaires des **nouveaux** employés.
- **SGC** : salaires des employés **déclarés à la CNPS**.
**Règle métier :** le bouton « Nouveau bulletin » est **désactivé** tant qu'un employé n'est pas sélectionné — la création de bulletin **dérive** du récapitulatif, elle n'est pas indépendante.

### 5.9 Bulletins de Paie — `/payroll/bulletins` — *RH / Paie*
**Rôle :** bulletin de paie **individuel** détaillé, au format légal camerounais.
**Fonctionnement :** navigation employé par employé (1/N), export **PDF**.
**Contenu :** en-tête employeur (siège Douala, NIU, N° CNPS), période, matricule/échelon/statut/département, congés (acquis / pris / reste), puis :
- **Lignes de gains codées** (`66111` salaire du mois, `66121` prime de transport, `6631` indemnité de logement, `6632` indemnité de représentation, primes diverses, heures sup…).
- **Cotisations codées** : Retenue CNPS, **PF**, **PVID** (patronale/salariale), **ATMP**, **IRPP**, **CAC**, **TDL**, **CFC** (salarial/patronal), **FNE**, RAV…
- Cumuls : salaire brut, charges salariales, charges patronales.
- **Net à payer** = `Brut − cotisations salariales`, avec régime de versement (SGC…).

### 5.10 Statistiques & Primes — `/stats` — *Niveau 3+*
**Rôle :** **tableau de caisse mensuel** + **calcul des primes des médecins** par catégorie.
**Fonctionnement :** sélecteur de mois. Plusieurs onglets. **Import IA/OCR** disponible : accepte Excel, CSV, PDF, Word et **photos** — l'IA extrait les données et remplit le tableau (à vérifier avant enregistrement). Export/Import **CSV**. Onglet « Graphes Primes ».
- **Onglet « Tableau Statistique »** (caisse mensuelle) — colonnes : `intervalle de dates`, `horaires`, `caisse PP`, `scanner`, `quantiferon`, `tenofovir`, `green energy`, `esthétique`, `thérapie vie`, `thérapie sommeil`, **`total espèces` (auto)**, `assurance`, **`chiffre d'affaires` (auto)**, `TEP scan`, `sorties du jour`.
- **Onglets « Primes médecins »** (Externes labo & radiologie, Interprètes Scanner, Interprètes IRM, Internes examens, Prescripteurs Scanner, Prescripteurs IRM) — tous le **même schéma** : `médecin`, `date début`, `date fin`, `actes`, `montant unitaire (FCFA)`, **`montant total (FCFA)`** (= actes × unitaire), `notes`.

### 5.11 Auditeurs Externes — `/audit` — *Auditeur externe + DG uniquement*
**Rôle :** suivi **confidentiel** des primes des médecins externes, de la masse salariale et d'éléments administratifs sensibles, en vue d'un contrôle externe.
**Fonctionnement :** sélecteur de mois ; **~14 catégories** en onglets, toutes sur le **même schéma** : `nom / désignation`, `date début`, `date fin`, `montant (FCFA)`, `notes` — avec **import / export Excel** et un **rapport d'audit rédigé (texte) par catégorie**.
**Catégories :** Externes, Internes prescripteurs labo & radiologie, Externes prescripteurs labo & radiologie, Prescripteurs de scanner, Prescripteurs d'IRM, Interprètes scanner, Interprètes IRM, Interprètes Petscan, Prescripteurs Petscan, **Masse salariale**, **Prime administrative**, **Heures supplémentaires**, **Sanctions**, **Congés**, **Total salaires reçus** (vue de comparaison mensuelle), **Graphes comparatifs**.
**Règle métier :** cloisonnement strict — seuls l'auditeur externe et le DG y accèdent, indépendamment des niveaux 1–6.

### 5.12 Gestion Membres — `/admin/users` — *DG (niveau 7)*
**Rôle :** administration des comptes et des accès.
**Fonctionnement :** liste des membres avec rôle et état (Actif/Inactif), recherche. Chaque membre a une action **éditer** (crayon) et **supprimer** (personne-x).
**Éditeur de membre :** `rôle / niveau d'accès` (sélecteur parmi les 8 rôles), `poste`, `département`, `code d'accès personnel` (secret optionnel), `compte actif` (booléen `isActive`).

### 5.13 Lisez-moi — `/readme` — *Tous / public*
**Rôle :** guide intégré **et** écran de connexion public.
**Fonctionnement :** pour un visiteur non connecté, affiche le bouton « Sign In ». Pour un membre connecté : présentation de l'app, guide d'**installation PWA** (Chrome/Edge, Android, iOS/Safari), **tableau des rôles & niveaux**, et fiche descriptive cliquable de chaque module.

---

## 6. Modèle de données (entités principales)

| Entité | Source | Champs clés |
|---|---|---|
| **Membre** | `/admin/users` | email, rôle/niveau, poste, département, code_accès_perso, isActive, libellé |
| **Employé (dossier RH)** | `/hr` | nom_complet, poste, département, niveau_études, diplômes, type_contrat, salaire_mensuel, date_début/fin, congés, avancements, cv_notes |
| **Compte rendu** | `/reports` | auteur, date, contenu, soumis_à (horodatage), hors_fenêtre (bool), points_présence |
| **Document** | `/documents` | fichier, titre, description, catégorie *(3 pré-remplis IA)*, code_accès, niveau_visible, niveau_téléchargement, adminOnly |
| **Commande technicien** | `/tech-orders` | date, libellé, demandeur, service, chef_service, méthode, photos[], lignes[{produit,DCI,qté,PU,total}], statut, commentaires[] |
| **Commande médicale** | `/orders` | date, libellé, type (médicaments/consommables), lignes[{produit,DCI,qté,PU,total}], total_général |
| **Journée financière** | `/financial` | date, soldes_J0[9], blocs[8] × lignes {entrées, retraits, justificatif}, soldes calculés, recette_totale, notes, verrou |
| **Ligne de paie (récap)** | `/payroll` | employé, mois, salaire_journalier, jours_travaillés, base, primes, heures_sup, total_1, sanctions, absence, dettes, acompte/CNPS, mutuelle, total_2, SESAME/SOFINA/SGC |
| **Bulletin de paie** | `/payroll/bulletins` | employé, période, lignes_gain[] (codées), cotisations[] (codées), congés, net_à_payer, régime |
| **Statistique de caisse** | `/stats` | intervalle_dates, horaires, postes_caisse[], total_espèces (auto), assurance, chiffre_affaires (auto), TEP, sorties |
| **Prime médecin** | `/stats` & `/audit` | catégorie, médecin/désignation, date_début/fin, actes, montant_unit, montant_total, notes, rapport_audit |

---

## 7. Capacités transversales (à retrouver dans plusieurs modules)

- **Authentification déléguée** OAuth2/OIDC (PKCE), multi-fournisseurs + OTP e-mail.
- **PWA installable** desktop & mobile, mise à jour automatique.
- **Extraction IA & OCR** : métadonnées de documents à l'upload ; import de photos/PDF/Excel/Word vers des tableaux (stats), avec relecture humaine avant enregistrement.
- **Import / export tabulaire** : CSV (commandes, stats) et Excel (audit) ; comparaison automatique entre jeux successifs (commandes médicales).
- **Édition concurrente verrouillée** + **clôture mensuelle** (financier).
- **Fenêtres temporelles & notifications** : créneau de soumission des comptes rendus, alerte aux superviseurs hors fenêtre.
- **Confidentialité par rôle** : cloisonnement de l'audit, contrôle d'accès par document.
- **API de sortie** financière à clé, avec proxy de sécurité (IP, rate-limit).
- **Calculs dérivés** omniprésents : soldes financiers, totaux de paie, montants de primes, totaux de caisse.

---

## 8. Règles métier & observations notables

1. **Cumul des niveaux** : l'accès est hiérarchique et additif (niveau N voit tout ce que voient 1…N), sauf l'auditeur externe qui est orthogonal.
2. **Report de solde financier** : le grand livre est en comptabilité de caisse ; chaque solde du jour dépend du solde J-1 — l'ordre chronologique de saisie compte.
3. **Ponctualité mesurée** : les comptes rendus distinguent explicitement « dans les temps » vs « hors fenêtre », avec notification hiérarchique.
4. **Paie dérivée** : un bulletin individuel se génère depuis le récapitulatif salaire (pas de création isolée).
5. **Régimes de paie multiples** (SESAME/SOFINA/SGC) : reflètent des statuts déclaratifs différents vis-à-vis de la CNPS — implication réglementaire à conserver dans toute reconstruction.
6. **Validation hiérarchique** des commandes techniciens : workflow avec statut et fil de commentaires.
7. **Nom interne ≠ identité publique** : « Poitiers Coworking » (technique) vs « Polyclinique de Poitiers » (affichage).
8. **Backend réel = Convex**, servi par Hercules — à ne pas confondre avec une éventuelle base Supabase connectée à l'outillage de développement (qui n'est pas le backend de cette app).
9. **Données de démonstration présentes** : certains comptes rendus et membres sont des données de test — à ignorer lors de l'analyse du contenu métier réel.

---

## 9. Glossaire des termes du domaine

| Terme | Signification |
|---|---|
| **FCFA** | Franc CFA, devise. |
| **F3** | Compte / caisse « fonds » (espèces + chèque + Visa) d'une entité. |
| **OM** | **Orange Money** (mobile money). |
| **MOMO** | **MTN Mobile Money**. |
| **DCI** | Dénomination Commune Internationale d'un médicament (nom de la molécule). |
| **CNPS** | Caisse Nationale de Prévoyance Sociale (sécurité sociale, Cameroun). |
| **IRPP** | Impôt sur le Revenu des Personnes Physiques. |
| **CAC** | Centimes Additionnels Communaux (sur l'IRPP). |
| **TDL** | Taxe de Développement Local. |
| **CFC** | Crédit Foncier du Cameroun (cotisation salariale + patronale). |
| **FNE** | Fonds National de l'Emploi (cotisation patronale). |
| **PVID** | Pension Vieillesse, Invalidité, Décès (branche CNPS). |
| **ATMP** | Accidents du Travail / Maladies Professionnelles (branche CNPS). |
| **PF** | Prestations Familiales (branche CNPS). |
| **RAV** | Redevance Audiovisuelle. |
| **NIU** | Numéro d'Identifiant Unique (fiscal). |
| **SESAME / SOFINA / SGC** | Trois régimes de versement des salaires selon le statut déclaratif CNPS (voir §5.8). |
| **PP** (Caisse PP) | Caisse « Poitiers Principale » (ligne du tableau statistique). |
| **TEP scan / PETSCAN** | Tomographie par émission de positons (imagerie). |
| **TDM** | Tomodensitométrie (scanner). |
| **E DR TIM** | Entité/compte partenaire (« Dr Tim ») — plusieurs déclinaisons (E DR TIM, E DR TIM Finance). |
| **PWA** | Progressive Web App — application web installable. |
| **PKCE** | Proof Key for Code Exchange — sécurisation du flux OAuth2. |
| **Convex** | Backend temps réel (base de données + fonctions serveur) hébergeant les données. |
| **Hercules** | Plateforme *app builder* sur laquelle la plateforme est construite et hébergée. |

---

## 10. Pour reconstruire une plateforme équivalente — priorités

1. **RBAC à 7 niveaux cumulatifs + rôle spécial cloisonné** (matrice route × niveau + rôle orthogonal audit).
2. **Workflow de compte rendu quotidien** avec fenêtre horaire, scoring de présence et vue superviseur agrégée.
3. **Grand livre financier journalier multi-entités** avec report de solde J-1, calculs par formule, justificatifs, verrou d'édition concurrent et clôture mensuelle.
4. **Moteur de paie localisé (Cameroun)** : récap mensuel + bulletins individuels (CNPS, IRPP, CAC, CFC, FNE, congés, régimes SESAME/SOFINA/SGC).
5. **Saisie tabulaire assistée par IA/OCR** (photos & documents → tableaux, avec relecture).
6. **Gestion documentaire à catégorisation IA** + contrôle d'accès par document.
7. **API de sortie sécurisée** : proxy (clé API, IP, rate-limit) découplé du backend, jamais d'exposition directe de la base.
8. **PWA + authentification déléguée** (OIDC/PKCE, multi-fournisseurs + OTP).

---

## 11. Changements détectés sur la plateforme Hercules (relevé du 2026-09-06)

Revérification avec cache navigateur désactivé. La structure des 13 modules d'origine est **inchangée**. Un seul écart notable :

**Nouveau module `/api-readme` (« Fiche API (.doc) »)** — auparavant un simple lien de téléchargement, c'est désormais une **page dédiée** de distribution de l'API Financier, et l'**API est passée en version 2.0** :

| Aspect | v1.0 (notre relevé initial) | v2.0 (actuel) |
|---|---|---|
| Entités `entity` | 5 (`poitiers, lilas, edrtim, carte_visa, edrtim_finance`) | **8** — ajout de **Médicaments, Biodiagnostic, MED-Esthetic** (aligne l'API sur les 8 blocs du tableau financier) |
| Couches de sécurité | 2 (proxy + Convex) | **4** : restriction IP · clé API (comparaison temporellement sûre) · rate-limit (30 req/min) · backend Convex |
| Sécurité additionnelle | — | En-têtes `X-Content-Type-Options` / `no-store`, logs JSON structurés (intégration SIEM), TLS via Nginx/Caddy/**Traefik** |
| Livraison | Document `.doc` seul | **ZIP complet** : `README-API.doc`, `README-API.html`, `api-docs.html`, `api-proxy-server.js`, `.env.example`, `DEMARRAGE-RAPIDE.txt` |
| Exemples d'appel | cURL | cURL / **Python / JS / PHP** |

> À part ce module, aucun changement fonctionnel détecté sur les autres modules (seules les dates courantes ont avancé au 2026-09-06).

---

## 12. Comparaison avec la version « Lovable » (salary-automator-pro)

Une **seconde implémentation du même besoin**, construite par l'employeur sur **Lovable** (`https://salary-automator-pro.lovable.app`). Malgré le nom d'URL, ce n'est **pas** qu'un automate de paie : c'est une **application de gestion d'espace de coworking + paie** portant la même marque « POITIERS COWORKING ».

### 12.1 L'idée derrière
Deux philosophies de produit pour un besoin identique :
- **Hercules** = *hub d'exploitation* large de la clinique (grand livre financier journalier, commandes médicales, audit, comptes rendus, documents, stats médicales) où la **paie n'est que 2 pages**.
- **Lovable** = *moteur de paie automatisé* poussé, entouré de modules satellites plus légers (dashboard coworking, comptes rendus, finance, commandes, documents).

Point de cadrage : Lovable **assume le coworking** (taux d'occupation, réservations de salles, badges, interventions sur les espaces) — mais le personnel du jeu de données reste **médical** (infirmier, sage-femme, pharmacien, aide-soignant, technicien de labo). C'est donc un **reskin coworking** de la même organisation.

### 12.2 Ce que Lovable fait de plus (absent ou léger sur Hercules)
- **Paie éclatée en ~12 modules** : Récapitulatif salaires, Liste des salaires, Bulletins du mois, Employés, Saisie mensuelle, Planning des absences, Primes & charges, Documents paie, Bulletins archivés, Historique, Courrier de paie, Bulletins envoyés.
- **Barème officiel lu automatiquement** chaque mois (CNPS / CGI applicable), avec **surveillance en direct** de la source (« Dernier contrôle le 2026-09-06 — source injoignable code 500 · Vérifier maintenant »). Paramètres : plafond CNPS, PVID %, CFC %, abattement IRPP, CAC… → **c'est le cœur d'automatisation (« le génie »)**.
- **Recalcul temps réel** : toute saisie (absence, prime, heure sup) recalcule aussitôt tous les bulletins et alimente l'historique/archive.
- **Import Excel/CSV de tout l'effectif** avec *upsert* (par matricule ou nom) puis recalcul automatique ; modèle CSV fourni.
- **Génération de masse** : « Générer les bulletins du mois » → 92 bulletins A4 (un par page), total net calculé, PDF.
- **Planning des absences** (congés acquis / pris / solde, jours travaillés) — module dédié.
- **Primes & charges** : registre de lignes datées par employé alimentant les bulletins.
- **Courrier de paie** : lettre d'accompagnement + bulletin par personne, **envoi par e-mail**, plus archives / historique / bulletins envoyés.
- **Paramètres entreprise** : nom, adresse, logo, **filigrane PDF**, couleur d'en-tête — appliqués à tous les documents générés.
- **« Société »** comme attribut d'employé (affectation SESAME / SOFINA / SGC), pour un fractionnement multi-sociétés à l'export.
- **Jeu de données réaliste** : 92 employés (vs ~5 en démo sur Hercules).

### 12.3 Ce que Hercules a et que Lovable n'a pas
- **Grand livre financier journalier multi-entités** (report de solde J-1, 8 blocs, espèces/chèque/Visa/OM/MOMO + justificatifs) → sur Lovable, la finance est une **simple liste mensuelle** recettes/dépenses (libellé, nature, mois, montant).
- **Commandes médicales avec DCI** → sur Lovable, ce sont des **fournitures de bureau** génériques (ramettes, café, chaises).
- **Module Audit confidentiel** (auditeurs externes, ~14 catégories) → **absent** de Lovable.
- **API d'export financier** (proxy + Convex, clé/IP/rate-limit) → **absente** de Lovable.
- **RBAC fin à 7 niveaux + auditeur**, contrôle d'accès **par document**, codes d'accès → Lovable = **3 rôles** (Administrateur, Gestionnaire RH, Employé), sans contrôle documentaire fin.
- **Comptes rendus à fenêtre horaire + score de présence + vue superviseur** → sur Lovable, comptes rendus = **comptes rendus de réunion** avec statut (Validé / En relecture / Brouillon), sans fenêtre ni scoring.
- **Statistiques médicales / primes des médecins par acte** → sur Lovable, stats = **KPI coworking** (occupation %, réservations, nouveaux membres, primes globales).

### 12.4 Synthèse des écarts (vs notre analyse du 1er projet)

| Axe | Hercules (analysé) | Lovable (nouveau) |
|---|---|---|
| Domaine affiché | Polyclinique (médical) | Espace de coworking (mais staff médical) |
| Force principale | Exploitation clinique large | **Automatisation de la paie** |
| Paie | 2 pages, saisie manuelle | ~12 modules, barème auto, recalcul temps réel, envoi e-mail |
| Finance | Grand livre journalier multi-comptes | Liste mensuelle recettes/dépenses |
| Commandes | Médicales (DCI) + techniciens | Fournitures bureau + interventions espaces |
| Audit | Module confidentiel dédié | Absent |
| API externe | Oui (proxy + Convex, v2.0) | Absente |
| Rôles | 7 niveaux + auditeur + accès/doc | 3 rôles |
| Comptes rendus | Fenêtre horaire + scoring présence | Réunions avec statut de relecture |
| Backend | Convex (via Hercules) | Lovable (stack propre) |
| Données | ~5 employés démo | 92 employés réalistes |

**Conclusion :** les deux répondent au même besoin d'origine mais avec des priorités opposées. Hercules couvre **large et peu profond** côté paie ; Lovable va **profond et automatisé** sur la paie en simplifiant tout le reste. Une plateforme cible idéale combinerait le **moteur de paie automatisé de Lovable** (barème officiel, recalcul, génération/envoi de masse, planning absences) avec les **atouts d'exploitation de Hercules** (grand livre financier journalier, audit confidentiel, RBAC fin, API d'export sécurisée).

---

## 13. État de la reconstruction (plateforme unifiée, 2026-09-07)

La plateforme cible a été construite dans `app/` (Convex + React PWA) en quatre phases, toutes livrées et vérifiées :

| Phase | Contenu | Écrans |
|---|---|---|
| 1 — Paie automatisée | employés + import CSV, barème daté, planning des absences → paie, saisie mensuelle réactive, primes & charges, bulletins A4 / PDF, courrier de paie + e-mail (PDF joint, mode simulation), archives | `/employes`, `/paie/*` |
| 2 — Exploitation financière | grand livre journalier à 8 blocs (report J-1, recalcul en chaîne, verrou, clôture mensuelle, justificatifs, historique 14 j) ; documents (accès par objet, code, extraction IA / repli) | `/financier`, `/documents` |
| 3 — Activité & suivi | commandes (DCI / fournitures, CSV, comparaison automatique, workflow), interventions techniciens, comptes rendus (fenêtre 16h–20h Douala, points, vue superviseur), statistiques & primes | `/commandes`, `/interventions`, `/comptes-rendus`, `/statistiques` |
| 4 — Contrôle & intégration | audit cloisonné (14 catégories, rapports, total salaires), membres (pré-provisionnement, garde-fou DG), journal d'activité, API d'export `/api/financial` (clé en temps constant) + proxy Node, fiche API, barème + tâches planifiées | `/audit`, `/membres`, `/journal`, `/api-readme`, `/bareme` |

- Guide du dépôt : `app/CLAUDE.md` (règles métier par phase, pièges Convex). Tests : 8 suites, 93 contrôles (`npm run test:*`).
- Cahiers de recette : n°1 (paie) et n°2 (global, avec le « pourquoi » de chaque fonctionnalité) — publiés en artifacts, fichiers `recette-phase1.html` et `recette-globale.html` à la racine.
- Reste à brancher pour la production : fournisseur OIDC (remplace `AUTH_DEV_BYPASS`), `RESEND_API_KEY` (e-mails réels), `ANTHROPIC_API_KEY` (extraction IA), `BAREME_SOURCE_URL` (contrôle du barème officiel).

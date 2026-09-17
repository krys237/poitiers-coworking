# Synthèse de Refonte UX/UI — Charte « Ocean Breeze » & Dashboard

> Ce document fige les décisions de design prises avec le propriétaire du projet pour la refonte visuelle du tableau de bord et de la coquille applicative. Il sert de spécification de référence avant tout développement.

---

## 1. Direction Artistique : Charte « Ocean Breeze »

### 1.1 Principe directeur
* **Ambiance générale** : Hybride professionnel et statutaire. Sidebar sombre dense et élégante combinée à un espace de travail principal clair, lumineux et reposant.
* **Garde-fous esthétiques** : Rejet des effets "dark mode" agressifs ou des dégradés néon artificiels. Privilégier la clarté financière, le contraste accessible (WCAG AA) et la netteté typographique.

### 1.2 Palette de couleurs retenue

| Teinte | Code HEX | Rôle dans l'interface |
| :--- | :--- | :--- |
| **Bleu Nuit Profond** | `#03045e` | **Fond de la Sidebar** (`--sidebar`), titres majeurs, ancrage fort. |
| **Bleu Océan** | `#0077b6` | **Couleur primaire** (`--primary`) : boutons d'action clés, item actif de navigation, barres de graphiques principales. |
| **Bleu Céruléen** | `#00b4d8` | **Accent interactif** (`--accent`) : puces d'état informatives, liens actifs, surbrillance d'éléments sélectionnés. |
| **Bleu Ciel Doux** | `#90e0ef` | **Surfaces d'accent légères** : fonds d'icônes dans les tuiles, séparateurs doux, contours d'éléments actifs. |
| **Brume Givrée** | `#caf0f8` | **Badges légers**, survols délicats de lignes, fonds de mise en valeur contextuels. |
| **Fond Canvas Principal** | `#f6f9fb` | Fond général de l'application (blanc cassé bleuté feutré évitant l'éblouissement). |
| **Surfaces Cartes** | `#ffffff` | Blanc pur avec bordure fine discrète (`#e1e9ee`) et rayon doux (`rounded-xl` / 12px). |

### 1.3 Couleurs sémantiques métier (Gestion & Paie)
Les indicateurs de statut métier conservent leur code conventionnel sans interférence avec la palette bleue :
* **Succès / Live / En règle** : Vert forêt (`#15803d` / fond `#dcfce7`)
* **Alerte / Verrou / Clôture** : Carmin bordeaux (`#9e2b20` / fond `#fee2e2`)
* **Attente / Vigilance** : Ambre doré (`#b45309` / fond `#fef3c7`)

### 1.4 Typographie & Nombres
* Police principale : **IBM Plex Sans** (auto-hébergée, déjà configurée).
* Chiffres financiers : **`tabular-nums`** systématique pour tous les montants en FCFA, garantissant l'alignement parfait des colonnes et des totaux.

---

## 2. Architecture de la Coquille (Layout)

### 2.1 Sidebar (Navigation Latérale)
* **Largeur** : Fixe à 260px sur grand écran, escamotable en tiroir (`Sheet` shadcn) sous 768px.
* **Haut** : Monogramme moderne « PC » + Titre **POITIERS COWORKING**.
* **Navigation structurée par groupes avec icônes Lucide** :
  * **Exploitation** :
    * Tableau de bord (`LayoutDashboard`)
    * Récapitulatif financier (`Wallet`)
    * Documents (`FolderOpen`)
    * Comptes rendus (`ClipboardCheck` — *avec pastille d'alerte ambre si compte rendu du jour manquant*)
    * Commandes (`ShoppingBag`)
    * Interventions (`Wrench`)
    * Statistiques & primes (`TrendingUp`)
  * **Paie** :
    * Employés (`Users`)
    * Récapitulatif salaires (`TableProperties`)
    * Liste des salaires (`ListOrdered`)
    * Bulletins du mois (`FileCheck2`)
    * Courrier de paie (`Mail`)
    * Planning des absences (`CalendarDays`)
    * Primes & charges (`Receipt`)
    * Archives (`Archive`)
  * **Contrôle** :
    * Audit confidentiel (`ShieldAlert`)
    * Barème (`SlidersHorizontal`)
    * Membres (`UserCog`)
    * Journal d'activité (`History`)
    * Fiche API (`Code2`)
    * Paramètres (`Settings`)
* **Contrôle d'accès inviolable** : Maintien strict du filtrage `canAccess(role, item.perm)`.
* **État actif** : Fond arrondi `#0077b6`, texte blanc pur, icône lumineuse `#00b4d8`.
* **Bas de Sidebar** : Carte de profil utilisateur (nom, rôle libellé, niveau d'accès, puce de statut connecté).

### 2.2 Header Bar (Barre Supérieure Horizontale)
* **Hauteur** : 64px, fixe, fond blanc `#ffffff`, bordure inférieure subtile `#e1e9ee`.
* **Gauche** :
  * Déclencheur du menu mobile (`Menu` visible sous 768px).
  * Contexte de page : Titre net « Tableau de bord » + sous-titre « Vue d'ensemble opérationnelle ».
* **Centre** :
  * **Sélecteur de période globale** : Pilule cliquable `Septembre 2026 ▾` avec icône calendrier.
  * **Indicateur Live Convex** : Micro-pastille verte `En direct`.
* **Droite** :
  * Barre de recherche rapide (`Ctrl + K`).
  * Cloche d'alertes (`Bell`) avec pastille numérique des tâches du jour à traiter.
  * Avatar utilisateur compact avec menu déroulant rapide.

---

## 3. Découpage & Agencement du Dashboard

Le Dashboard passe d'une liste de 16 boîtes plates à un **Cockpit Hiérarchisé en 3 zones d'action** :

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ HEADER : [Tableau de bord]             [🗓️ Septembre 2026 ▾]  [🟢 Live]   [🔍 Chercher] [🔔 2]   │
├────────────────────────────────────────────────────────────────┬─────────────────────────────────┤
│ ZONE CENTRALE (70%)                                            │ RAIL ACTIONS DU JOUR (30%)      │
│                                                                │                                 │
│ 1. BANNIÈRE D'ÉTAT DU MOIS                                     │ 📍 MON ESPACE OPÉRATIONNEL      │
│    Septembre 2026 · Live (Ouvert)                              │ ┌─────────────────────────────┐ │
│                                                                │ │ 📝 Compte rendu du jour     │ │
│ 2. COCKPIT DES FLUX (Inspiré agencement général)               │ │ Statut : 🟡 En attente      │ │
│    ┌───────────────────────────┬─────────────────────────────┐ │ │ [ Action : Rédiger ]        │ │
│    │ GRILLE 2x2 DES 4 KPI      │ GRAPHIQUE DES FLUX DU MOIS  │ │ └─────────────────────────────┘ │
│    │ • CA du mois (14.2M F) ↗  │ • Barres comparatives       │ │ ┌─────────────────────────────┐ │
│    │ • Solde F3 (2.65M F) ↗    │   (Recettes vs Masse Brute  │ │ │ 💰 Recette du jour          │ │
│    │ • Net à payer (2.95M F) ↗ │    vs Net vs Primes)        │ │ │ Statut : 🔴 Non saisie      │ │
│    │ • Masse brute (3.78M F) ↗ │ • Composant Barres.tsx      │ │ │ [ Action : Saisir ]         │ │
│    └───────────────────────────┴─────────────────────────────┘ │ └─────────────────────────────┘ │
│                                                                │ ┌─────────────────────────────┐ │
│ 3. ASSAINISSEMENT DES CARTES DE CONTRÔLE                       │ │ 🎯 Points de présence : 0 pt│ │
│    (Sortie des métadonnées API passives vers Paramètres)       │ └─────────────────────────────┘ │
│    (Maintien de l'encadré Audit compact si Auditeur ou DG)     │                                 │
└────────────────────────────────────────────────────────────────┴─────────────────────────────────┘
```

### 3.1 Grille 2x2 des 4 Tuiles Majeures
Chaque tuile intègre un **bouton circulaire de redirection (`↗`)** en haut à droite :
1. **Chiffre d'Affaires du Mois** : Tuile vedette avec badge d'accentuation Bleu Océan, montant en grand format, flèche `↗` redirigeant vers `/statistiques`.
2. **Solde Trésorerie F3 Poitiers** : Montant du solde, date et montant de la dernière recette en sous-texte, flèche `↗` vers `/financier`.
3. **Net à Payer (Mois)** : Montant net cumulé des salaires, badge indiquant le nombre de bulletins prêts (`10 bulletins`), flèche `↗` vers `/paie/bulletins`.
4. **Masse Brute & Primes** : Montant brut total, rappel des primes médecins, effectif actif, flèche `↗` vers `/paie/primes`.

### 3.2 Carte Large : Graphique de Répartition des Flux
* Reprend le composant [Barres.tsx](file:///d:/Test/Js/coworking/app/src/components/app/barres.tsx) (SVG ultra-léger et accessible).
* Affiche la répartition financière du mois :
  * **Recettes encaissées** (Bleu Océan `#0077b6`)
  * **Masse salariale brute** (Bleu Céruléen `#00b4d8`)
  * **Net à décaisser** (Bleu Nuit `#03045e`)
  * **Primes versées** (Bleu Ciel `#90e0ef`)
* Permet au dirigeant de valider d'un coup d'œil que le chiffre d'affaires couvre sainement les engagements salariaux du mois.

### 3.3 Rail Droit : « À faire aujourd'hui »
Dédié aux actions opérationnelles quotidiennes :
* **Compte rendu du jour** : Affiche l'état réel (`En attente`, `Soumis à HH:mm`, ou `Hors fenêtre`) avec un bouton d'action directe pour rédiger sans chercher dans le menu.
* **Recette du jour** : Affiche si la caisse journalière a été saisie ou non, avec bouton d'accès rapide.
* **Points de présence** : Affichage du score individuel du membre connecté.
* **Bloc Audit Confidentiel** (réservé rôle `auditeur_externe` et `dg`) : Montant total audité et jauge de progression des rapports rédigés (`2 / 14`).

---

## 4. Plan de mise en œuvre opérationnelle

Dès validation de cette synthèse par le propriétaire du projet, les étapes de développement suivront la feuille de route suivante :

1. **Étape 1 — Jetons de la Charte** : Mettre à jour `src/styles/theme.css` pour y déclarer la palette Ocean Breeze dans les variables de thème Tailwind v4 / shadcn.
2. **Étape 2 — Coquille Applicative** : Mettre à niveau `src/components/Layout.tsx` pour intégrer la nouvelle Sidebar Bleu Nuit avec icônes Lucide et la Header Bar de 64px avec sélecteur de période et profil.
3. **Étape 3 — Composants du Cockpit** : Ajuster la tuile KPI avec le bouton d'action `↗` et adapter le graphique des flux.
4. **Étape 4 — Tableau de bord** : Réécrire `src/pages/Dashboard.tsx` pour mettre en place la disposition (Zone 2x2 + Graphique + Rail d'actions).
5. **Étape 5 — Contrôle qualité & Zéro régression** : `npm run typecheck` (0 erreur), 0 styles en ligne, validation responsive et vérification des suites de tests unitaires.

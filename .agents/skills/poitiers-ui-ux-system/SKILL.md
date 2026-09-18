---
name: poitiers-ui-ux-system
description: Master UI-UX Design System and Ergonomic Rules for the Poitiers Coworking / Polyclinique platform. Use when designing, creating, or refactoring any user interface, page layout, card, navigation element, or financial/RH dashboard.
---

# Poitiers Coworking — Master UI-UX Design System & Ergonomie

Document de référence officiel pour la refonte visuelle et ergonomique de l'application Poitiers Coworking (Polyclinique de Poitiers).

> **Statut** : Document vivant en cours d'enrichissement progressif au fil des refontes d'écrans. Il garantit la cohérence globale de l'interface entre toutes les pages (Dashboard, Financier, RH, Paie, Commandes, Rapports).

---

## 1. Direction Artistique & Palette « Ocean Breeze »

L'interface allie l'exigence de rigueur comptable/hospitalière à une esthétique moderne, épurée et vivante (style fintech : Linear, Stripe, Apple).

### Palette des couleurs officielles
* **`--ocean-nuit: #03045e`** : Bleu nuit impérial. Ancrage statutaire, bas de sidebar (profil utilisateur), cartes bancaires unies (Visa Trésorerie).
* **`--ocean-profond: #0077b6`** : Bleu océan primaire. Boutons d'action principaux, onglets actifs, en-têtes d'accent, bordures actives.
* **`--ocean-ceruleen: #00b4d8`** : Bleu céruléen dynamique. Anneaux de focus (`ring`), barres de progression, indicateurs lumineux.
* **`--ocean-ciel: #90e0ef`** & **`--ocean-brume: #caf0f8`** : Teintes pastel douces. Fonds de surbrillance, micro-cartes d'accentuation.
* **`--papier: #f6f9fb`** : Fond d'application reposant, feutré, anti-éblouissement.
* **`--surface: #ffffff`** : Fond pur des cartes et conteneurs de contenu.
* **`--filet: #e2e8f0`** : Bordure fine discrète (1px) de délimitation des cartes.

### 🚫 Interdictions formelles
* **Pas de dégradés hasardeux** sur les cartes de données : la carte Visa et les cartes d'ancrage doivent être en **couleur unie** (`bg-[#03045e]`).
* **Pas de néo-banking vert/fluo criard** : seules les couleurs de la charte *Ocean Breeze* et les teintes pastel sémantiques sont admises.

---

## 2. Règles Ergonomiques & Densité Spatiale (Anti-Scroll)

La plus grande frustration utilisateur est de devoir faire défiler la page (*scroller*) pour atteindre son espace de travail ou ses champs de saisie.

### A. Règle du premier regard (« Above the Fold »)
* Les zones de contrôle supérieures (sélecteur de date, filtres, indicateurs du verrou) doivent être **ultra-compactes** :
  * Éviter le composant `<Card>` brut avec son padding vertical excessif (`py-6`).
  * Privilégier un conteneur dédié slim : `px-3.5 py-2 sm:py-2.5 rounded-2xl border border-filet bg-surface shadow-xs`.
  * Hauteur maximale de l'en-tête de commande : ~48 à 55 px.

### B. Disposition des métriques clés (Grille 4/4)
* **Les 8 cartes KPI** doivent être disposées en **4/4** (`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3`) :
  * Cela permet de leur donner plus de **280 à 320 px de largeur** unitaire afin d'accueillir confortablement de **grands montants en FCFA** (`125 000 000 FCFA`) sans retour à la ligne forcé ni troncature.
  * La hauteur de chaque carte reste très fine (`p-3`), sans textes descriptifs secondaires superflus.
  * Les 2 rangées combinées n'occupent que ~115 px de hauteur.

### C. Architecture bi-colonne
* **Colonne gauche (4/12)** : Synthèse, carte de trésorerie unie, ventilation par canal, tendances rapides.
* **Colonne droite (8/12)** : Poste opérationnel interactif (sélection de caisse, formulaires de saisie, validation).

---

## 3. Typographie & Formats Numériques

* **Interface & Textes** : `font-sans` (`IBM Plex Sans`), typographie moderne et lisible.
* **Chiffres, Devises, Soldes, Tableaux** : Toujours `font-mono tabular-nums font-bold` (`IBM Plex Mono`).
  * Les chiffres ont une largeur uniforme pour que les colonnes s'alignent parfaitement.
  * Formatage obligatoire : `fcfa(valeur)` avec séparateur de milliers officiel (`8 303 410 FCFA`).
  * Nombres négatifs : afficher immédiatement en rouge carmin (`text-carmin`).

### Formalisme des chiffres (adopté le 17/09/2026)

Une seule façon d'écrire et de saisir un nombre, partout. Helpers : `num`, `fcfa`, `pct`, `jours` (`src/lib/format.ts`) ; composants : `<Montant>`, `<Nombre>`, `<CelluleNombre>`, `<ChampNombre>`.

**Affichage (lecture)**
| Cas | Règle | Exemple |
|---|---|---|
| Montant | entier FCFA, milliers séparés par une espace **insécable** (U+00A0), `font-mono tabular-nums`, aligné à droite | `1 250 000` |
| Devise | suffixe « FCFA » petit et en retrait **hors tableau seulement** (tuiles, totaux, aperçus) ; dans un tableau, l'en-tête de colonne porte l'unité, jamais la cellule | `2 956 909 FCFA` |
| Zéro réel | `0` en gris pâle (`text-encre-pale`) — c'est une valeur | `0` |
| Non applicable / absent | tiret cadratin `—` gris pâle (ex. colonne SOFINA d'un salarié SGC) | `—` |
| Négatif | signe moins typographique `−` (U+2212) + `text-carmin` ; jamais entre parenthèses | `−823 661` |
| Pourcentage | virgule décimale, pas de zéro décimal inutile, espace insécable avant `%` | `2,5 %` · `4 %` |
| Jours | nombre + espace insécable + `j` | `28 j` |
| Total arrêté | filet double sous la ligne (`<TableFooter>`), chiffres en gras | |

**Saisie (champs numériques)**
* La valeur **0 n'est jamais tapée « par-dessus »** : le champ est vide et montre un `0` estompé (`placeholder="0"`, `placeholder:text-encre-pale/70`). Taper `5` donne `5`, jamais `05`.
* **Sélection automatique au focus** (`onFocus={(e) => e.currentTarget.select()}`) : clic ou Tab surligne la valeur existante, le premier chiffre l'écrase.
* **Effacer tout = 0** : Retour arrière jusqu'au vide remet la valeur sous-jacente à 0 sans bloquer le curseur (`onChange : "" → 0`).
* Milliers affichés au repos quand le champ est textuel (`CelluleInline`), saisie brute au focus ; virgule et point acceptés comme séparateur décimal.
* Chaque champ porte un **nom accessible** qui nomme ligne **et** colonne (`« Acompte — AMEFFO Lucie C. »`).
* Aucune décimale sur un montant FCFA ; `step` = 1 000 sur les montants, 1 sur les jours, 0,5 sur les pourcentages.

**Interdits** : `toLocaleString` brut (espace fine U+202F illisible en colonne et non encodable en PDF), montants en `font-sans`, `0` en dur affiché dans un champ, « — » pour un vrai zéro, parenthèses comptables pour les négatifs.

---

## 4. Système des Flags & Pastilles de Statut

Tous les drapeaux d'information (*flags*, *chips*, *badges*) utilisent le composant unifié `@/components/ui/flag` ([flag.tsx](file:///d:/Test/Js/coworking/app/src/components/ui/flag.tsx)) :

* **Forme Capsule (« Smooth Pill »)** : `rounded-full` pour une silhouette douce, distincte des boutons cliquables.
* **Fond Pastel & Filet Coordonné** : `bg-*-50/70 border border-*-200/80`.
* **Élégance Typographique (ZÉRO point de couleur)** :
  * ❌ **Interdiction formelle des puces / points ronds de couleur (`●`)** : ils créent un effet « widget générique » et alourdissent la lecture.
  * Le libellé typographique (`font-semibold text-[10px] tracking-wide`) combiné à la teinte pastel du fond suffit amplement à identifier le canal.
* **Variantes officielles** :
  * `variant="om"` : Orange Money (fond pêche doux, texte orange)
  * `variant="momo"` : MTN MOMO (fond ambre doux, texte ambré chaud)
  * `variant="especes"` : Espèces (fond émeraude doux, texte émeraude)
  * `variant="finance"` : Finance / Virement (fond bleu azur doux, texte bleu)
  * `variant="saisie-active"` : Saisie active (fond bleu océan contrasté, texte blanc)
  * `variant="a-renseigner"` : Non encore saisi (fond ambré doux avec bordure pointillée)
  * `variant="renseigne"` : Saisie validée (fond vert doux avec montant)
  * `variant="verrou"` : Lecture seule / Données figées (fond ardoise doux)
* **Icônes contextuelles** : Seules les icônes réelles et utiles sont autorisées (`Lock`, `PenLine`, `Check`), passées via la prop `icon`.

---

## 5. Pédagogie & Guidage de l'Utilisateur

L'utilisateur ne doit jamais avoir à deviner ce qu'il doit faire :

1. **Numérotation des étapes opérationnelles** :
   * `Étape 1 : Sélectionnez la caisse à renseigner`
   * `Étape 2 : Feuille de saisie journalière — [Nom de la caisse]`
2. **Statut explicite sur chaque option** :
   * Chaque caisse indique clairement son état : `✍️ Saisie active`, `✓ [Montant déjà saisi]`, ou `⚠️ À renseigner`.
3. **Bannières d'alerte de verrou** :
   * Si la journée est en lecture seule, afficher un ruban d'information invitant à cliquer sur « Prendre la main pour saisir ».
4. **Sécurisation des actions critiques** :
   * Clôture mensuelle, suppression ou actions irréversibles protégées par le modal `<BoutonConfirmation>`.

---

## 6. Structure de la Navigation & Sidebar

* Dégradé bleu progressif et fluide partant du haut de la barre latérale, traversant doucement l'onglet Dashboard avant de rejoindre le blanc.
* Profil utilisateur et poste de travail ancrés en bas dans un bloc bleu nuit plein (`bg-[#03045e] text-white`).

---

## 7. Saisie en série & champs persistants (adopté le 18/09/2026)

Principe hérité de la plateforme d'origine : **l'utilisateur qui a n éléments à saisir ne clique pas n fois sur un bouton d'ajout**. Il entre directement, valide, la ligne apparaît, il enchaîne.

### La question qui décide du pattern
« Combien d'éléments l'utilisateur saisit-il d'affilée dans une session normale ? »

| Usage | Pattern | Exemples |
|---|---|---|
| **Série** — n lignes semblables | **ligne de saisie permanente** dans le tableau (en tête), Entrée ajoute, le focus revient au premier champ | primes médecins, audit (14 catégories), registre primes & charges, planning des absences, employés |
| **Grille** — lignes = personnes, colonnes = champs | saisie **dans la cellule**, Tab de case en case | récapitulatif salaires (option A), caisse du mois, financier |
| **Unitaire riche** — un objet, beaucoup de champs, pièces jointes | dialogue ou carte dépliable **+ « Enregistrer et en saisir un autre »** | intervention, commande, document |
| **Quotidien unique** | formulaire en place | compte rendu |

### Le bouton « Rendre les champs persistants »
* Composant `<BoutonPersistance>` + hook `useSaisiePersistante(cle)` (`app/saisie-persistante.tsx`). Préférence **par écran**, mémorisée sur l'appareil : c'est l'utilisateur qui configure son workflow.
* Placement : **à côté de la croix** qui ferme les champs de saisie (ou dans la barre d'outils de l'écran s'il n'y a pas de croix). Actif, il devient **« Masquer les champs »**.
* Effet : les champs de saisie restent affichés (ligne de saisie permanente, ou grille en saisie directe) ; le bouton d'ajout disparaît puisqu'il n'a plus d'objet.
* Un écran en usage « série » ou « grille » **doit** le proposer. Un écran « unitaire riche » peut s'en passer.
* Sur le récapitulatif salaires : consultation (option C, volet latéral) par défaut ; « champs persistants » = grille de saisie directe (option A).

### Ce que la ligne de saisie permanente doit faire
* Une seule ligne, à la hauteur du tableau, **jamais** un formulaire de 14 champs au-dessus.
* Entrée valide ; le focus revient au premier champ ; la ligne apparaît immédiatement dans le tableau (réactivité Convex) ; toast discret.
* Les champs pré-remplis par le contexte (catégorie filtrée, période, date du jour) ne se retapent pas.
* Modifier une ligne existante se fait **sur la ligne** (clic → dialogue ou édition en place), jamais en re-remplissant la ligne de saisie du haut.

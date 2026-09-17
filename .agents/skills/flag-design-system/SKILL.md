---
name: flag-design-system
description: Standardized Flag, Chip and Badge styling system for financial and operational indicators in the Poitiers Coworking platform. Use when creating or modifying status tags, payment channel flags (OM, MOMO, Espèces, Finance), progression chips, and operational banners.
---

# Flag & Chip Design System (Poitiers Coworking)

Système officiel de conception des **Flags**, **Chips** et **Pastilles de statut** de l'application Poitiers Coworking, inspiré des interfaces fintech modernes (style Linear, Stripe, Apple).

## 1. Philosophie et Principes Visuels

Les drapeaux d'information (« Flags ») privilégient l'élégance typographique et la finesse visuelle :

1. **Forme Capsule Épurée (« Smooth Pill »)** : Silhouette intégrale `rounded-full` pour un rendu doux et moderne.
2. **Fond Pastel & Filet Délicat** : Fond teinté subtil (`bg-*-50/70` ou `bg-*-50/80`) associé à une bordure fine 1px coordonnée (`border border-*-200/80`).
3. **Typographie PURE (Sans point générique)** : **Aucun point / puce de couleur superflue**. Le libellé et la teinte pastel suffisent à identifier le canal avec élégance.
4. **Micro-Icônes Contextuelles (Uniquement si nécessaire)** : Lorsque le statut l'exige, utiliser une icône SVG signifiante (`Lock`, `Check`, `PenLine`), jamais un rond coloré générique.
5. **État Actif / Sélectionné** : Variante pleine contrastée (`bg-ocean-profond text-white shadow-xs`).

---

## 2. Matrice des Variantes Officielles

| Variante | Canal / Statut | Fond & Bordure | Texte | Rendu Visuel |
| :--- | :--- | :--- | :--- | :--- |
| **`om`** | Orange Money | `bg-orange-50/70 border-orange-200/80` | `text-orange-800` | Pastille pêche douce épurée |
| **`momo`** | MTN Mobile Money | `bg-amber-50/70 border-amber-200/80` | `text-amber-900` | Pastille ambre chaude épurée |
| **`especes`** | Espèces / Caisse F3 | `bg-emerald-50/70 border-emerald-200/80` | `text-emerald-800` | Pastille sauge/émeraude douce |
| **`finance`** | Virement / Banque / Chèque | `bg-blue-50/70 border-blue-200/80` | `text-[#0077b6]` | Pastille bleu azur douce |
| **`saisie-active`**| Saisie en cours sur la caisse | `bg-ocean-profond border-ocean-ceruleen/40` | `text-white font-bold` | Pastille bleu nuit contrastée |
| **`a-renseigner`**| Caisse ou champ non saisi | `bg-amber-50/80 border-amber-300/80 border-dashed`| `text-amber-900` | Pastille pointillée attentive |
| **`renseigne`** | Mouvements déjà validés | `bg-emerald-50/70 border-emerald-200/80` | `text-emerald-800` | Pastille validation douce |
| **`direct`** | Statut live / mois ouvert | `bg-sky-50/80 border-sky-300/80` | `text-sky-800` | Pastille ciel institutionnelle |
| **`verrou`** | Mois clos / verrouillé | `bg-slate-100/80 border-slate-200/90` | `text-slate-600` | Pastille ardoise sobre |

---

## 3. Composant React : `<Flag />`

```tsx
import { Flag } from "@/components/ui/flag";

// Canaux de paiement (élégants et sans point de couleur)
<Flag variant="om">Orange Money</Flag>
<Flag variant="momo">MTN MOMO</Flag>
<Flag variant="especes">Espèces</Flag>
<Flag variant="finance">Finance</Flag>

// Statuts d'action
<Flag variant="saisie-active" size="xs">Saisie active</Flag>
<Flag variant="a-renseigner" size="xs">À renseigner</Flag>
<Flag variant="renseigne" size="xs">✓ 150 000 FCFA</Flag>
```

# S7 · Pense-bête personnel

> **Dépend de** : S1 et S5 livrés (il réutilise le catalogue d'événements et le planificateur).
> **Modifie le schéma** : oui, une table ajoutée.
> **Dépendance externe** : aucune.
> **Le plus petit lot du programme.** Si le temps manque, c'est celui qu'on repousse.

---

## 1. Objectif

Qu'un membre puisse se créer **son propre rappel daté**, sur un dossier ou sur rien :
« relancer ce fournisseur mardi », « vérifier la livraison du bon CMD-2026-012 jeudi ».

C'est le seul endroit du programme où la notification n'est pas déclenchée par un événement
métier, mais **par l'utilisateur lui-même**.

### Hors périmètre, explicitement

- **Aucun rappel assigné à quelqu'un d'autre.** Un pense-bête est strictement personnel. Un
  rappel que l'on pose à un collègue, c'est une tâche assignée — c'est un autre produit, et
  ce n'est pas ce qui a été demandé.
- Aucune récurrence (« tous les lundis »). Un rappel, une date, une fois.
- Aucun agenda, aucune vue calendaire.

> Si le propriétaire demande l'assignation ou la récurrence, **c'est une nouvelle spec** :
> cela change le modèle (qui peut poser quoi à qui, selon quel droit) et ouvre la question de
> l'adressage, que ce lot n'a pas.

---

## 2. Le schéma

```ts
  // ---- Pense-bêtes personnels (lot S7) ----
  // Un rappel que le membre se pose à lui-même. Strictement personnel : aucun membre
  // ne peut en créer ni en lire pour un autre.
  penseBetes: defineTable({
    membreId: v.id("users"),
    texte: v.string(),
    echeance: v.string(),             // ISO, horodatage de déclenchement
    // Dossier rattaché, facultatif : permet au rappel d'ouvrir le bon écran.
    objet: v.optional(v.object({
      table: v.string(),
      id: v.string(),
      reference: v.optional(v.string()),
    })),
    lien: v.optional(v.string()),
    etat: v.union(v.literal("en_attente"), v.literal("declenche"), v.literal("annule")),
    creeLe: v.string(),
  })
    .index("by_membre_etat", ["membreId", "etat"])
    .index("by_echeance", ["etat", "echeance"]),
```

---

## 3. Le déclenchement

Deux voies possibles. **Prends la seconde.**

**La planification directe** (`ctx.scheduler.runAt(echeance, …)` à la création) paraît
élégante, mais une tâche planifiée Convex n'est pas annulable proprement une fois posée : un
pense-bête modifié ou supprimé laisserait une tâche fantôme à gérer. Ce n'est pas le bon
outil pour un objet que l'utilisateur peut éditer.

**Le cron de balayage**, donc : un passage par quart d'heure qui prend les pense-bêtes
`en_attente` dont l'échéance est passée, émet la notification par S1, et les bascule en
`declenche`.

```ts
// Pense-bêtes arrivés à échéance — toutes les 15 minutes. Un quart d'heure de
// latence est sans conséquence pour un rappel que l'utilisateur s'est posé lui-même,
// et le balayage rend la modification et la suppression triviales.
crons.interval("pense-betes a echeance", { minutes: 15 }, internal.penseBetes.declencher, {});
```

L'index `by_echeance` rend ce passage quasi gratuit : `etat = "en_attente"` et
`echeance <= maintenant`, borné à **100 par passage**.

Type d'événement à ajouter au catalogue de S1 :

```ts
{ cle: "pense_bete", libelle: "Pense-bête",
  module: "/notifications",           // module de S2 : tout membre l'a
  importance: "a_traiter",
  cible: null,
  previentLeProprietaire: true,        // le membre est propriétaire de son propre rappel
  titre: (c) => `Rappel : ${c.libelle ?? ""}`.trim(),
  corps: (c) => c.extrait },
```

Le `module` est `/notifications` (créé par S2) et non celui du dossier rattaché : le
pense-bête appartient au membre, pas au dossier. Il doit arriver même si le membre a perdu
entre-temps l'accès au module du dossier. En revanche le **lien** mènera à un écran qui le
refusera — c'est correct, et c'est ce qu'il faut : le rappel est à lui, la donnée ne l'est
plus.

---

## 4. Les fonctions

Toutes **strictement limitées au membre courant**. Pas de `requireDroit` : un pense-bête ne
relève d'aucun module. `getCurrentUser(ctx)`, et filtre sur son `_id`.

| Fonction | Nature | Règles |
|---|---|---|
| `penseBetes.creer` | mutation | texte non vide, 500 caractères maximum ; échéance **dans le futur** ; 50 pense-bêtes `en_attente` maximum par membre |
| `penseBetes.modifier` | mutation | vérifie l'appartenance ; refusé si `etat !== "en_attente"` |
| `penseBetes.annuler` | mutation | vérifie l'appartenance ; passe en `annule` (ne supprime pas, l'historique reste lisible) |
| `penseBetes.miens` | query | ses pense-bêtes, `en_attente` d'abord puis par échéance |
| `penseBetes.declencher` | `internalMutation` | le balayage du cron |

La vérification d'appartenance n'est pas négociable : un `_id` se devine, et une mutation qui
ne vérifie pas laisserait lire et modifier le pense-bête d'un collègue.

---

## 5. L'interface

Volontairement minimale. Deux endroits, pas trois.

**Un onglet « Mes rappels »** dans l'écran `/notifications` de S2 : la liste, et une **ligne
de saisie permanente** (texte + date + heure), conformément à la charte — *« l'utilisateur qui
a n éléments à saisir ne clique pas n fois »* (§7 du skill UI/UX). Entrée valide, le focus
revient au premier champ.

**Un bouton « Me le rappeler »** sur le détail d'une commande et d'une intervention, qui
ouvre un petit dialogue pré-rempli avec la référence du dossier et son lien. Raccourcis de
date : *demain*, *dans 3 jours*, *lundi prochain* — et un champ libre.

Pas d'écran dédié, pas de vue calendaire, pas de widget sur le tableau de bord.

---

## 6. Tests

À ajouter à `app/tests/rappels.test.ts` :

| # | Cas | Attendu |
|---|---|---|
| 1 | Échéance dans le passé à la création | refusée |
| 2 | Texte vide, ou plus de 500 caractères | refusé |
| 3 | 51e pense-bête `en_attente` | refusé, avec un message clair |
| 4 | Sélection du balayage | seuls `en_attente` et `echeance <= maintenant` |
| 5 | Déclenché deux fois | une seule notification (l'état passe à `declenche`) |
| 6 | Annulé avant l'échéance | jamais déclenché |
| 7 | Modifier un pense-bête déjà déclenché | refusé |
| 8 | Borne de 100 par passage | respectée, sans erreur |

Le cas 5 est l'équivalent ici de l'idempotence de S5.

## 7. Recette manuelle

1. Créer un pense-bête à échéance passée → refusé avec un message compréhensible.
2. Créer un pense-bête à 2 minutes, lancer `penseBetes:declencher` à la main → notification
   reçue, état `declenche`.
3. Relancer → aucune seconde notification.
4. Depuis le détail d'un bon, « Me le rappeler » → le pense-bête porte la référence, et son
   lien ouvre le bon dossier.
5. Depuis un autre compte, tenter `penseBetes:annuler` sur l'identifiant du pense-bête d'un
   collègue → **refusé**.

## 8. Risques

| Risque | Parade |
|---|---|
| Lire ou modifier le pense-bête d'un autre | Vérification d'appartenance dans **chaque** mutation. Recetté (étape 5). |
| Une tâche planifiée fantôme après modification | Pas de `runAt` à la création. Cron de balayage. |
| Un déclenchement répété | L'état bascule à `declenche`. Testé (cas 5). |
| La dérive vers un gestionnaire de tâches | Le §1 ferme la porte : pas d'assignation, pas de récurrence. Toute demande dans ce sens est une nouvelle spec. |

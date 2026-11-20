# S1 · Noyau de notifications

> **Dépend de** : rien. C'est le premier lot.
> **Modifie le schéma** : oui, une table ajoutée (additif, aucune migration).
> **Dépendance externe** : aucune. Aucune dépendance npm nouvelle.
> **Design validé par le propriétaire le 6 novembre 2026.**

---

## 1. Objectif

Transformer un **événement métier** (« ce bon de commande vient d'être soumis ») en une
**liste de notifications adressées** aux bonnes personnes, et les stocker.

C'est le lot qui fixe le vocabulaire de tout le programme. Les six autres lots en dépendent :
S2 affiche ce que S1 écrit, S3 et S4 transportent ce que S1 décide, S5 et S7 émettent par S1,
S6 étend son adressage.

### Dans le périmètre

- Le **catalogue typé** des événements métier, déclaratif et pur.
- La fonction d'**adressage** : un événement → une liste de destinataires, déduite de
  `droitsEffectifs()`.
- La table `notifications` et ses index.
- L'**émetteur** interne, les deux queries de lecture, les deux mutations de marquage, la
  purge.
- Les **lignes d'émission** dans les mutations métier existantes.
- La suite de tests de logique pure.

### Hors périmètre — ne le fais pas dans ce lot

- **Aucune interface.** Pas de cloche, pas d'écran, pas de composant. C'est S2.
- **Aucun canal sortant.** Pas de WhatsApp, pas de push, pas d'e-mail. C'est S3 et S4.
- **Aucune préférence utilisateur.** C'est S2.
- **Aucun rappel ni relance.** C'est S5.
- **Aucune écriture dans `journalActivite`.** Voir §9.
- **Aucun nouveau module dans `rbac.MODULES`.** S1 n'ouvre aucun écran, donc n'a pas de
  module. Il *lit* les droits existants, il n'en crée pas.

---

## 2. Fichiers livrés

| Fichier | Nature |
|---|---|
| `app/convex/lib/notifications.ts` | **nouveau** — catalogue + adressage + rendu, **pur** |
| `app/convex/notifications.ts` | **nouveau** — émetteur interne, queries, mutations, purge |
| `app/convex/schema.ts` | modifié — table `notifications` ajoutée |
| `app/convex/crons.ts` | modifié — une ligne de purge hebdomadaire |
| `app/convex/commandes.ts` | modifié — 4 lignes d'émission |
| `app/convex/interventions.ts` | modifié — 3 lignes d'émission |
| `app/convex/comptesRendus.ts` | modifié — 2 lignes d'émission |
| `app/convex/tickets.ts` | modifié — 3 lignes d'émission |
| `app/convex/documents.ts` | modifié — 1 ligne d'émission |
| `app/convex/auth.ts` | modifié — 1 ligne d'émission |
| `app/tests/notifications.test.ts` | **nouveau** — suite de tests |
| `app/package.json` | modifié — script `test:notifications` |
| `.gitlab-ci.yml` | modifié — la suite ajoutée au pipeline |

---

## 3. Le catalogue d'événements

Dans `app/convex/lib/notifications.ts`. **Logique pure : aucun import de `_generated`, aucun
import serveur.** Bâti sur le même modèle que `rbac.MODULES` — une déclaration par type, et
rien ailleurs.

```ts
// Catalogue des événements notifiables, et calcul des destinataires.
//
// Ce fichier est la SOURCE UNIQUE : l'émetteur (convex/notifications.ts), les tests et
// l'onglet de préférences (lot S2) en dérivent. Ajouter un événement ici, jamais ailleurs.
//
// PUR : importable par un test et par une page, sans contexte Convex.

import type { Droits } from "../rbac";

export type Importance = "info" | "a_traiter" | "urgent";

/** Ce qu'un événement sait de lui-même au moment du rendu de son libellé. */
export type ContexteRendu = {
  reference?: string;   // "CMD-2026-012"
  acteurNom?: string;   // "AMEFFO Lucie"
  libelle?: string;     // objet du dossier, titre de l'intervention…
  motif?: string;       // motif de rejet, description d'un litige
  extrait?: string;     // début d'un commentaire
};

export type TypeEvenement = {
  /** Clé stable, stockée en base. Ne la renomme JAMAIS : l'historique la porte. */
  cle: string;
  /** Libellé du type, pour les préférences et les tests. */
  libelle: string;
  /** Module rbac auquel l'objet appartient. Sert au filtre de visibilité (invariant 2). */
  module: string;
  importance: Importance;
  /**
   * Qui doit être prévenu, exprimé EN DROIT — jamais en rôle.
   * `null` : personne par ce biais (seuls le propriétaire ou les destinataires explicites).
   */
  cible: { module: string; action: "voir" | "faire" } | null;
  /** Le propriétaire du dossier (son créateur) est-il prévenu de cet événement ? */
  previentLeProprietaire: boolean;
  /**
   * Portée par objet : sans AU MOINS UN de ces droits, l'objet n'est visible que de son
   * propriétaire. Encode la décision du 13/10/2026 sur les interventions, et le périmètre
   * « ses propres tickets » de `/tickets`. Absent = objet visible de tous ceux qui ont
   * `module` en Voir.
   *
   * C'est une LISTE parce que deux droits distincts peuvent ouvrir la vue d'ensemble :
   * un ticket est visible en entier par l'arbitrage OU par le traitement technique.
   */
  portee?: string[];
  /** Rendu du titre affiché. Figé à l'émission (voir §5). */
  titre: (c: ContexteRendu) => string;
  /** Rendu du corps, optionnel. */
  corps?: (c: ContexteRendu) => string | undefined;
};
```

### Les seize types de S1

```ts
export const TYPES: TypeEvenement[] = [
  // ---------------- Commandes ----------------
  {
    cle: "commande_soumise",
    libelle: "Bon de commande soumis à validation",
    module: "/commandes",
    importance: "a_traiter",
    cible: { module: "/commandes/validation", action: "faire" },
    previentLeProprietaire: false,
    titre: (c) => `Bon ${c.reference} à valider`,
    corps: (c) => [c.libelle, c.acteurNom && `soumis par ${c.acteurNom}`].filter(Boolean).join(" — ") || undefined,
  },
  {
    cle: "commande_validee",
    libelle: "Bon de commande validé",
    module: "/commandes",
    importance: "info",
    cible: { module: "/commandes", action: "faire" },
    previentLeProprietaire: true,
    titre: (c) => `Bon ${c.reference} validé`,
    corps: (c) => (c.acteurNom ? `Validé par ${c.acteurNom}` : undefined),
  },
  {
    cle: "commande_rejetee",
    libelle: "Bon de commande rejeté",
    module: "/commandes",
    importance: "a_traiter",
    cible: { module: "/commandes", action: "faire" },
    previentLeProprietaire: true,
    titre: (c) => `Bon ${c.reference} rejeté`,
    corps: (c) => c.motif,            // le motif est obligatoire côté serveur sur un rejet
  },
  {
    cle: "commande_litige",
    libelle: "Litige signalé sur une commande",
    module: "/commandes",
    importance: "urgent",
    cible: { module: "/commandes", action: "faire" },
    previentLeProprietaire: true,
    titre: (c) => `Litige sur le bon ${c.reference}`,
    corps: (c) => c.motif,
  },
  {
    cle: "commande_commentaire",
    libelle: "Commentaire sur une commande",
    module: "/commandes",
    importance: "info",
    cible: { module: "/commandes", action: "faire" },
    previentLeProprietaire: true,
    titre: (c) => `Commentaire sur le bon ${c.reference}`,
    corps: (c) => (c.acteurNom ? `${c.acteurNom} : ${c.extrait ?? ""}`.trim() : c.extrait),
  },

  // ---------------- Interventions ----------------
  {
    cle: "intervention_creee",
    libelle: "Demande d'intervention déposée",
    module: "/interventions",
    importance: "a_traiter",
    cible: { module: "/interventions", action: "faire" },
    previentLeProprietaire: false,
    portee: ["/interventions/toutes"],
    titre: (c) => `Intervention ${c.reference} à arbitrer`,
    corps: (c) => [c.libelle, c.acteurNom && `déposée par ${c.acteurNom}`].filter(Boolean).join(" — ") || undefined,
  },
  {
    cle: "intervention_arbitree",
    libelle: "Intervention validée ou rejetée",
    module: "/interventions",
    importance: "info",
    cible: null,                      // seul le demandeur est concerné
    previentLeProprietaire: true,
    portee: ["/interventions/toutes"],
    titre: (c) => `Intervention ${c.reference} : suite donnée`,
    corps: (c) => c.motif,
  },
  {
    cle: "intervention_cloturee",
    libelle: "Intervention clôturée",
    module: "/interventions",
    importance: "info",
    cible: null,
    previentLeProprietaire: true,
    portee: ["/interventions/toutes"],
    titre: (c) => `Intervention ${c.reference} clôturée`,
  },
  {
    cle: "intervention_commentaire",
    libelle: "Commentaire sur une intervention",
    module: "/interventions",
    importance: "info",
    cible: null,
    previentLeProprietaire: true,
    portee: ["/interventions/toutes"],
    titre: (c) => `Commentaire sur l'intervention ${c.reference}`,
    corps: (c) => (c.acteurNom ? `${c.acteurNom} : ${c.extrait ?? ""}`.trim() : c.extrait),
  },

  // ---------------- Comptes rendus ----------------
  {
    cle: "cr_remarque",
    libelle: "Remarque du superviseur sur un compte rendu",
    module: "/comptes-rendus",
    importance: "a_traiter",
    cible: null,                      // seul l'auteur du compte rendu
    previentLeProprietaire: true,
    titre: (c) => `Remarque sur votre compte rendu`,
    corps: (c) => (c.acteurNom ? `${c.acteurNom} : ${c.extrait ?? ""}`.trim() : c.extrait),
  },
  {
    cle: "cr_valide",
    libelle: "Compte rendu validé",
    module: "/comptes-rendus",
    importance: "info",
    cible: null,
    previentLeProprietaire: true,
    titre: () => `Votre compte rendu est validé`,
  },

  // ---------------- Documents ----------------
  {
    cle: "document_adresse",
    libelle: "Document partagé nominativement",
    module: "/documents",
    importance: "a_traiter",
    cible: null,                      // destinataires explicites uniquement
    previentLeProprietaire: false,
    titre: (c) => `Document partagé : ${c.libelle ?? "sans titre"}`,
    corps: (c) => (c.acteurNom ? `Déposé par ${c.acteurNom}` : undefined),
  },

  // ---------------- Tickets (retours d'usage de la plateforme) ----------------
  {
    cle: "ticket_ouvert",
    libelle: "Ticket ouvert",
    module: "/tickets",
    importance: "a_traiter",
    cible: { module: "/tickets/arbitrage", action: "faire" },
    previentLeProprietaire: false,
    // Deux droits distincts ouvrent la vue d'ensemble : l'arbitrage et le traitement technique.
    portee: ["/tickets/arbitrage", "/tickets/traitement"],
    titre: (c) => `Nouveau ticket : ${c.libelle ?? ""}`.trim(),
    corps: (c) => (c.acteurNom ? `Ouvert par ${c.acteurNom}` : undefined),
  },
  {
    cle: "ticket_arbitre",
    libelle: "Pertinence d'un ticket jugée",
    module: "/tickets",
    importance: "info",
    // Jugé pertinent : le traitement technique doit le savoir. Jugé non pertinent : seul
    // l'auteur est concerné, et c'est l'emetteur qui omet la cible dans ce cas (voir §7).
    cible: { module: "/tickets/traitement", action: "faire" },
    previentLeProprietaire: true,
    portee: ["/tickets/arbitrage", "/tickets/traitement"],
    titre: (c) => `Ticket ${c.libelle ?? ""} : ${c.motif ? "refusé" : "jugé pertinent"}`.trim(),
    corps: (c) => c.motif,          // motif obligatoire côté serveur sur un refus
  },
  {
    cle: "ticket_avance",
    libelle: "État d'un ticket modifié",
    module: "/tickets",
    importance: "info",
    cible: null,                    // seul l'auteur du ticket
    previentLeProprietaire: true,
    portee: ["/tickets/arbitrage", "/tickets/traitement"],
    titre: (c) => `Ticket ${c.libelle ?? ""} : ${c.extrait ?? "état modifié"}`.trim(),
    corps: (c) => c.motif,
  },

  // ---------------- Membres ----------------
  {
    cle: "compte_en_attente",
    libelle: "Nouveau compte en attente d'autorisation",
    module: "/membres",
    importance: "a_traiter",
    cible: { module: "/membres", action: "faire" },
    previentLeProprietaire: false,
    titre: (c) => `Compte à autoriser : ${c.libelle ?? ""}`.trim(),
  },
];

export const TYPE_PAR_CLE: Record<string, TypeEvenement> =
  Object.fromEntries(TYPES.map((t) => [t.cle, t]));
```

### Notes de rédaction

- Les titres sont **courts** : ils s'afficheront dans un panneau étroit (S2) et, plus tard,
  dans une notification système (S4). Référence en tête, verbe à la fin.
- `cible: null` **n'est pas une erreur** : certains événements ne concernent que le
  propriétaire du dossier. Une intervention arbitrée n'intéresse que son demandeur ; les
  arbitres savent ce qu'ils viennent de décider.
- `commande_commentaire` prévient `/commandes:faire` **et** le propriétaire. C'est volontaire :
  un commentaire sur un bon en préparation concerne l'équipe qui le prépare.
- `cr_remarque` applique la décision du 20/10/2026 : seuls les superviseurs écrivent des
  remarques, le collaborateur les lit. La notification va donc **du superviseur vers
  l'auteur**, jamais l'inverse.

---

## 4. L'adressage — la pièce centrale

Fonction **pure**, dans le même fichier :

```ts
/** Ce que l'émetteur sait de l'événement en cours. */
export type Evenement = {
  type: string;                       // clé du catalogue
  acteurId: string;                   // qui a agi
  acteurNom?: string;
  proprietaireId?: string;            // créateur du dossier (commandes.creePar, …)
  destinatairesExplicites?: string[]; // documents : destinataires nominatifs
  rendu?: ContexteRendu;
};

/** Un membre, vu par l'adressage. */
export type MembreAdressable = {
  id: string;
  actif: boolean;
  enAttente: boolean;
  droits: Droits;
};

/**
 * Qui doit être prévenu de cet événement. PUR.
 *
 * Ordre : candidats par droit + propriétaire + destinataires explicites,
 * puis retrait de l'acteur, puis filtre de visibilité, puis dédoublonnage.
 */
export function destinataires(
  type: TypeEvenement,
  e: Evenement,
  membres: MembreAdressable[],
): string[] {
  const parId = new Map(membres.map((m) => [m.id, m]));
  const retenus = new Set<string>();

  // 1. Par droit — l'adressage normal, déduit de la matrice du DG.
  if (type.cible) {
    for (const m of membres) {
      if (m.droits[type.cible.module]?.[type.cible.action]) retenus.add(m.id);
    }
  }
  // 2. Le propriétaire du dossier, s'il suit cet événement.
  if (type.previentLeProprietaire && e.proprietaireId) retenus.add(e.proprietaireId);
  // 3. Les destinataires nominatifs (documents).
  for (const id of e.destinatairesExplicites ?? []) retenus.add(id);

  // 4. Jamais l'auteur de son propre geste (invariant 1).
  retenus.delete(e.acteurId);

  // 5. Filtre final : compte utilisable, et droit de VOIR l'objet (invariants 2 et 3).
  return [...retenus].filter((id) => {
    const m = parId.get(id);
    if (!m || !m.actif || m.enAttente) return false;
    if (!m.droits[type.module]?.voir) return false;
    // Portée par objet : sans AUCUN des droits d'ensemble, on ne voit que son propre dossier.
    if (type.portee?.length && id !== e.proprietaireId
        && !type.portee.some((d) => m.droits[d]?.voir)) return false;
    return true;
  });
}

/** Titre et corps figés à l'émission. */
export function rendre(type: TypeEvenement, c: ContexteRendu = {}) {
  return { titre: type.titre(c), corps: type.corps?.(c) };
}
```

### Les quatre invariants — ce sont eux que les tests vérifient

1. **On ne notifie jamais l'auteur de son propre geste.** Celui qui valide le bon ne reçoit
   pas « bon validé ». Il recevra en revanche le commentaire que le demandeur postera ensuite.
2. **On ne notifie jamais quelqu'un qui ne pourrait pas ouvrir l'objet.** Un titre porte une
   référence, un nom, parfois un montant : c'est de la donnée, et elle respecte la matrice du
   DG. Le filtre `droits[type.module].voir` est **non négociable**.
3. **La portée par objet est respectée.** Pour les interventions, un membre sans
   `/interventions/toutes` ne voit que ses propres demandes — il n'est donc notifié que de
   *son* dossier. C'est le champ `portee`, et c'est exactement la décision du 13/10/2026.
4. **Retirer un droit coupe la notification, sans rien reconfigurer.** L'adressage se déduit
   de `droitsEffectifs()`. Aucune liste parallèle n'existe, donc aucune dérive silencieuse
   n'est possible.

---

## 5. Le schéma

Ajoute dans `app/convex/schema.ts`, à la suite des tables existantes :

```ts
  // ---- Notifications (lot S1) ----
  // Une ligne PAR DESTINATAIRE, écrite à l'émission (fan-out à l'écriture — voir la spec).
  // La ligne est la trace de qui a été prévenu, et quand : elle ne se réécrit pas si le
  // directeur change la matrice des droits ensuite.
  notifications: defineTable({
    destinataireId: v.id("users"),
    type: v.string(),                 // clé du catalogue (lib/notifications.TYPES)
    titre: v.string(),                // figé à l'émission
    corps: v.optional(v.string()),
    importance: v.union(v.literal("info"), v.literal("a_traiter"), v.literal("urgent")),
    lien: v.string(),                 // route applicative, ex. "/commandes?ref=CMD-2026-012"
    // L'objet concerné : permet de regrouper à l'écran (S2) et de ne pas relancer
    // deux fois la même chose (S5).
    objet: v.object({
      table: v.string(),
      id: v.string(),
      reference: v.optional(v.string()),
    }),
    acteurId: v.optional(v.id("users")),
    acteurNom: v.optional(v.string()),
    lu: v.boolean(),
    luLe: v.optional(v.string()),
    creeLe: v.string(),               // ISO
  })
    .index("by_destinataire_lu", ["destinataireId", "lu"])
    .index("by_destinataire_date", ["destinataireId", "creeLe"])
    .index("by_objet", ["objet.table", "objet.id"]),
```

### Pourquoi le fan-out à l'écriture, et pas à la lecture

C'est le choix important de ce lot, et il mérite d'être compris plutôt que subi.

L'alternative serait de stocker **un** événement et de recalculer à la lecture qui a le droit
de le voir. Mais dans Convex le badge est un **abonnement live** : il faudrait rejouer
`droitsEffectifs()` sur tous les membres, à chaque affichage, pour chaque membre connecté, en
permanence. C'est exactement le piège de `comptesRendus.vueSuperviseur` en pire (voir
`LISEZMOI.md` §6). Avec le fan-out à l'écriture, le badge devient une lecture indexée sur une
seule clé.

Le second bénéfice est métier : la ligne écrite est la **trace** de qui a été prévenu. Dans un
ERP qui tient un journal d'audit, c'est la bonne sémantique.

**Le coût, chiffré** : une quarantaine de membres, quelques dizaines de transitions par jour,
3 à 6 destinataires en moyenne — de l'ordre de **200 lignes par jour**, 6 000 par mois. Avec
la purge hebdomadaire, la table reste petite. Négligeable.

**Titre figé à l'émission** : un libellé stocké reste vrai même si le catalogue change de
formulation plus tard, et l'écran n'a aucun calcul à faire.

---

## 6. L'émetteur et l'API de lecture

Dans `app/convex/notifications.ts`.

### 6.1 Le helper appelé par les mutations métier

```ts
// Appelé en DERNIÈRE ligne d'une mutation métier. Ne fait qu'une chose : planifier.
//
// Pourquoi planifier plutôt qu'écrire ici :
//  - le métier ne peut pas échouer à cause d'une notification : l'émission tourne dans sa
//    propre transaction, un bug du catalogue n'annule pas un bon de commande validé ;
//  - la sémantique est exactement la bonne : une planification depuis une mutation Convex
//    n'est retenue que si la mutation COMMET. Une action annulée ne notifie personne,
//    gratuitement, sans code de compensation ;
//  - la mutation métier reste courte : elle ne lit pas `users` au complet.
//
// Contrepartie assumée : l'échec d'une fonction planifiée est silencieux, d'où la
// journalisation dans `emettre`. La notification arrive quelques millisecondes après
// l'action — invisible à l'usage, mais ce n'est pas synchrone.
export async function notifier(ctx: MutationCtx, e: ArgsEmission) {
  await ctx.scheduler.runAfter(0, internal.notifications.emettre, e);
}
```

`notifier` est une fonction TypeScript exportée (pas une mutation Convex). Place-la dans
`convex/notifications.ts` et importe-la là où tu en as besoin.

### 6.2 `emettre` — mutation interne

```ts
export const emettre = internalMutation({
  args: {
    type: v.string(),
    acteurId: v.optional(v.id("users")),
    acteurNom: v.optional(v.string()),
    proprietaireId: v.optional(v.id("users")),
    destinatairesExplicites: v.optional(v.array(v.id("users"))),
    objet: v.object({ table: v.string(), id: v.string(), reference: v.optional(v.string()) }),
    lien: v.string(),
    rendu: v.optional(v.object({ /* ContexteRendu, tous optionnels */ })),
  },
  handler: async (ctx, a) => { /* … */ },
});
```

Déroulé, et **l'ordre compte** :

1. `TYPE_PAR_CLE[a.type]` — si le type est inconnu : **journaliser et sortir sans lever**.
   Un catalogue incomplet ne doit pas remplir les logs d'erreurs d'une base de production.
2. Lire **une seule fois** `parametresEntreprise` (`.first()`) et **une seule fois** la table
   `users` (`.collect()`).
3. Construire les `MembreAdressable` : `droitsEffectifs(role, p?.droitsRoles ?? [], u.droitsPerso ?? [])`
   pour chacun. **En mémoire, hors de toute requête.** Une quarantaine de membres × une
   trentaine de modules : trivial.
4. Appeler `destinataires(type, evenement, membres)`.
5. Appeler `rendre(type, a.rendu)`.
6. Insérer **une ligne par destinataire**, `lu: false`, `creeLe: new Date().toISOString()`.
7. Si la liste est vide : ne rien insérer, et **ne pas lever**. C'est un cas normal — par
   exemple un bon validé par le seul membre qui avait le droit d'en être informé.

> **Important** : `droitsDuMembre` de `lib/authz.ts` fait une requête par appel. **Ne
> l'utilise pas dans la boucle** — appelle `droitsEffectifs` directement, avec les paramètres
> lus une fois. C'est précisément le piège documenté dans `LISEZMOI.md` §6.

### 6.3 Lecture et marquage

Toutes gardées par l'identité du destinataire : **on ne lit jamais les notifications d'un
autre.** Utilise `getCurrentUser(ctx)` de `lib/authz.ts` et filtre sur son `_id`. Pas de
`requireDroit` ici : ses propres notifications ne relèvent d'aucun module.

| Fonction | Nature | Comportement |
|---|---|---|
| `nonLues` | `query` | Les non-lues du membre courant, les plus récentes d'abord, **`.take(100)`**. Renvoie `{ lignes, total, tronque }` — l'écran affichera `99+`. Jamais de `.collect()` : un membre peut accumuler des centaines de non-lues. |
| `historique` | `query` | Args `{ limite?: number, avant?: string }`. Pagination par curseur sur `by_destinataire_date`, `.take(limite ?? 30)`. |
| `marquerLue` | `mutation` | Arg `{ notificationId }`. **Vérifie que la ligne appartient au membre courant**, sinon lève. Pose `lu: true`, `luLe`. Idempotente. |
| `marquerToutesLues` | `mutation` | Marque les non-lues du membre courant, par lots de 100 maximum par appel, et renvoie le nombre traité. |
| `purger` | `internalMutation` | Supprime les notifications **lues** dont `creeLe` a plus de 90 jours. Bornée à 1 000 suppressions par exécution. |

### 6.4 La purge

Dans `app/convex/crons.ts`, sur le modèle de la purge de verrous existante :

```ts
// Purge hebdomadaire des notifications lues de plus de 90 jours : la table grossit d'environ
// 6 000 lignes par mois, et l'historique au-delà d'un trimestre n'a plus d'usage.
crons.weekly("purge des notifications", { dayOfWeek: "sunday", hourUTC: 4, minuteUTC: 0 },
  internal.notifications.purger, {});
```

---

## 7. Les points d'émission

**Une ligne ajoutée par endroit. Aucune logique métier déplacée. Toujours en dernière ligne du
handler**, après le `patch` ou l'`insert`.

### `convex/commandes.ts`

**`changerStatut`** — trois cas. Après le `ctx.db.patch` :

```ts
const typeNotif =
  statut === "en_attente" ? "commande_soumise" :
  statut === "validee"    ? "commande_validee" :
  statut === "rejetee"    ? "commande_rejetee" : null;
if (typeNotif) {
  await notifier(ctx, {
    type: typeNotif,
    acteurId: user._id, acteurNom: auteur,
    proprietaireId: c.creePar,
    objet: { table: "commandes", id: commandeId, reference: c.reference },
    lien: `/commandes?ref=${c.reference}`,
    rendu: { reference: c.reference, acteurNom: auteur, libelle: c.libelle, motif: commentaire?.trim() },
  });
}
```

> Les autres transitions (`en_reception`, `livree`, `cloturee`) ne notifient pas dans S1 :
> elles suivent une validation déjà annoncée. Ne les ajoute pas de ta propre initiative.

**`commenter`** — `type: "commande_commentaire"`, `rendu.extrait` = les 120 premiers
caractères du texte.

**`signalerLitige`** — `type: "commande_litige"`, `rendu.motif` = la description du litige.

**`resoudreLitigeEtCloturer`** et **`confirmerReceptionConforme`** : pas d'émission dans S1.

### `convex/interventions.ts`

- **`creer`** — `type: "intervention_creee"`, `proprietaireId: user._id`,
  `objet: { table: "interventions", id, reference: ref }`, `lien: "/interventions?ref=…"`,
  `rendu.libelle` = le titre.
- **`changerStatut`** — `intervention_cloturee` si `statut === "cloturee"`, sinon
  `intervention_arbitree`. `proprietaireId: i.creePar`, `rendu.motif` = le commentaire.
- **`commenter`** — `type: "intervention_commentaire"`, `proprietaireId: i.creePar`.

### `convex/comptesRendus.ts`

- **`ajouterCommentaire`** — `type: "cr_remarque"`, `proprietaireId: c.auteurId`,
  `objet: { table: "comptesRendus", id: compteRenduId }`, `lien: "/comptes-rendus"`,
  `rendu.extrait` = les 120 premiers caractères.
- **`changerStatut`** — seulement si `statut === "valide"` : `type: "cr_valide"`,
  `proprietaireId: c.auteurId`.

### `convex/tickets.ts`

Module ajouté au projet depuis la première rédaction de cette spec : les **tickets** sont les
retours d'usage que les membres déposent sur la plateforme elle-même. Deux pistes parallèles
sur le même objet — la Direction juge la **pertinence** (`avis`), le développeur fait avancer
l'**état** (`etat`) — d'où trois émissions.

- **`ouvrir`** — `type: "ticket_ouvert"`, `proprietaireId: user._id`,
  `objet: { table: "tickets", id }`, `lien: "/tickets"`, `rendu.libelle` = le titre.
- **`arbitrer`** — `type: "ticket_arbitre"`, `proprietaireId: t.auteurId`,
  `rendu.motif` = le motif, **renseigné seulement sur un refus** : c'est lui qui distingue les
  deux titres rendus.
  ⚠️ **Sur `non_pertinent`, n'informe que l'auteur.** Le traitement technique n'a rien à faire
  d'un ticket écarté. La forme est à toi (ne pas passer la cible, ou un drapeau à l'émetteur),
  le comportement est imposé.
- **`avancer`** — `type: "ticket_avance"`, `proprietaireId: t.auteurId`,
  `rendu.extrait` = le libellé d'état (`LIBELLE_ETAT[etat]`, déjà présent dans le fichier),
  `rendu.motif` = la note.

> `tickets.ts` **journalise déjà** ses deux transitions (`journaliser`, avec `cible: t.titre`).
> Ne touche pas à ces appels et n'en ajoute pas : la notification s'ajoute à côté, elle ne
> remplace rien.

### `convex/documents.ts`

- **`deposer`** — **seulement si la liste `destinataires` est non vide** :
  `type: "document_adresse"`, `destinatairesExplicites: destinataires`,
  `objet: { table: "documents", id }`, `lien: "/documents"`, `rendu.libelle` = le titre.

### `convex/auth.ts`

- **`callbacks.createOrUpdateUser`** — à l'endroit exact où un membre est créé avec
  `enAttente: true` : `type: "compte_en_attente"`, `rendu.libelle` = l'e-mail,
  `objet: { table: "users", id }`, `lien: "/membres"`, **pas d'`acteurId`** (personne n'a
  « agi » : c'est une inscription spontanée).

> ⚠️ `auth.ts` est un fichier sensible : c'est l'unique porte d'entrée des comptes. Lis-le en
> entier avant d'y toucher, n'ajoute que l'appel, et vérifie que le `MutationCtx` y est bien
> disponible. **Si ce n'est pas le cas, ne force pas : signale-le et laisse ce seul point
> d'émission de côté.** Les douze autres suffisent à valider le lot.

---

## 8. Tests

`app/tests/notifications.test.ts`, lancé par `npm run test:notifications`. Convention de la
maison : imports en `.ts`, `import type` pour les types, `node:assert` et `node:test` ou un
simple compteur d'assertions comme les suites existantes — **regarde `tests/droits.test.ts` et
imite-le.**

Construis deux jeux de droits (`droitsEffectifs` est pur, tu peux l'appeler directement) :
une matrice **par défaut**, et une matrice **modifiée** où `/commandes/validation:faire` a été
retiré au comptable.

### Les cas à couvrir

| # | Cas | Attendu |
|---|---|---|
| 1 | `commande_soumise`, matrice par défaut | tous les détenteurs de `/commandes/validation:faire` ; **pas** l'acteur |
| 2 | `commande_soumise`, matrice modifiée | le comptable **absent** — invariant 4 |
| 3 | `commande_validee` par le DG | le propriétaire présent, le DG absent — invariant 1 |
| 4 | `intervention_creee`, employé sans `/interventions/toutes` | cet employé **absent** — invariant 3 |
| 5 | `intervention_arbitree` sur le dossier de cet employé | cet employé **présent** (il est propriétaire) |
| 6 | `cr_remarque` | **uniquement** l'auteur du compte rendu |
| 7 | `document_adresse` | uniquement les destinataires nominatifs, moins le déposant |
| 8 | Membre `isActive: false` ou `enAttente: true` | **jamais** destinataire |
| 9 | Membre sans `voir` sur le module de l'événement | **jamais** destinataire — invariant 2 |
| 10 | Même personne ciblée par droit **et** propriétaire | **une seule** entrée (dédoublonnage) |
| 11 | `cible: null` et pas de propriétaire | liste vide, aucune erreur levée |
| 12 | `rendre` sur les 16 types | titre non vide, pas de `undefined` dans la chaîne |
| 13 | `ticket_ouvert`, membre n'ayant que `/tickets` | **absent** : il ne voit que ses propres tickets |
| 14 | `ticket_ouvert`, membre ayant `/tickets/traitement` | **présent** : la portée accepte l'un **ou** l'autre droit |
| 15 | `ticket_arbitre` jugé `non_pertinent` | **seul l'auteur** ; pas le traitement technique |
| 16 | Toutes les clés de `TYPES` | uniques, et tous les `module` / `cible.module` / **chaque entrée de `portee`** existent dans `rbac.MODULE_PAR_CLE` |

Le cas 16 est un **garde-fou** : il empêche qu'une faute de frappe dans une clé de module
rende un événement silencieusement inadressable.

---

## 9. Un trou constaté, volontairement laissé ouvert

En câblant les points d'émission, tu constateras une **asymétrie** : `tickets.ts` journalise
ses transitions, mais `commandes.ts`, `interventions.ts` et `comptesRendus.ts` **non**. Un bon
de commande validé, une intervention clôturée, un litige ouvert n'apparaissent **pas** dans le
journal d'audit du niveau 7. C'est un trou réel pour un ERP qui manipule de l'argent — et le
module le plus récent prouve que la maison sait le combler.

**Ne le comble pas dans S1.** Le journal et les notifications sont deux objets différents —
l'un immuable et destiné à l'audit, l'autre adressé, périssable et marquable comme lu. Les
confondre serait une erreur de conception.

Ce que S1 fait à la place : l'objet événement porte déjà tout ce qu'une entrée de journal
exigerait (acteur, objet, référence), et `notifier` accepte un paramètre `journal?: string`
**inutilisé dans S1**. Combler le trou devient alors une ligne par point d'émission, dans une
spec à part. C'est noté au backlog, hors programme.

---

## 10. Recette

### Automatique

`npm run test:notifications`, puis **toutes** les suites existantes, puis
`npm run typecheck` et `npm run build`.

### Manuelle, sur le déploiement de dev

Il n'y a pas d'écran dans ce lot : la recette se fait en lisant la table (tableau de bord
Convex, onglet Data).

1. Connecte-toi en `comptable.test@poitiers.local`, prépare un bon de commande et soumets-le.
   → Des lignes `commande_soumise` apparaissent, **une par détenteur** de
   `/commandes/validation:faire`, **aucune** pour le comptable lui-même.
2. Connecte-toi en `dg.test@poitiers.local` et valide ce bon.
   → Une ligne `commande_validee` pour le comptable. **Aucune** pour le DG.
3. Dans Paramètres → Rôles & accès, retire `/commandes/validation` Faire au comptable, puis
   refais l'étape 1 depuis un autre compte.
   → Le comptable n'est plus destinataire. **C'est le test qui prouve l'invariant 4.**
   Remets le droit ensuite.
4. En `employe.test@poitiers.local`, dépose une demande d'intervention. Depuis un autre compte
   employé, vérifie qu'**aucune** ligne n'a été créée pour ce second employé.

5. En `employe.test`, ouvre un ticket → les détenteurs de `/tickets/arbitrage:faire` sont
   notifiés. Depuis un autre compte employé, vérifie qu'**aucune** ligne n'a été créée pour
   lui : un membre ne voit que ses propres tickets.

> Comptes de test : `<role>.test@poitiers.local`, mot de passe commun `Poitiers2026`. La table
> complète des comptes est dans `cahier-de-recette.html` à la racine du dépôt.

---

## 11. Risques

| Risque | Parade |
|---|---|
| Un titre divulgue une donnée à qui ne devrait pas la voir | Invariant 2, testé explicitement (cas 9). Ne contourne jamais le filtre de visibilité, même « juste pour le nom ». |
| La requête dans la boucle, encore | `droitsEffectifs` appelé en mémoire, jamais `droitsDuMembre`. Lecture unique de `users` et de `parametresEntreprise`. |
| Un volume qui dérive si un événement très fréquent entre au catalogue | Purge hebdomadaire, et `.take(100)` sur le compteur. Avant d'ajouter un type, estime sa fréquence. |
| Une faute de frappe dans une clé de module rend un événement inadressable | Test 13. |
| Un échec d'émission passe inaperçu | `emettre` journalise ses propres échecs et ne lève pas. |
| Le point d'émission d'`auth.ts` casse l'authentification | Il est explicitement **abandonnable** (§7). Les douze autres valident le lot. |

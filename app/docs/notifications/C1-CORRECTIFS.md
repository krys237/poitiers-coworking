# C1 · Correctifs sur les lots S1 → S7

> **Dépend de** : les lots S1 à S7, livrés et vérifiés (commit `5fafd7c`).
> **Modifie le schéma** : oui, mais en **retirant** un champ jamais déployé (voir C1.3).
> **Dépendance externe** : aucune. Aucune dépendance npm nouvelle.
> **Lot étroit** : presque tout se passe dans trois fichiers purs, testables avec Node nu.

---

## Pourquoi ce lot existe

Les lots S1 à S7 ont été implémentés depuis le commit `bd3ad43`, c'est-à-dire **avant** trois
corrections apportées aux specs. Le travail livré est fidèle à ce qu'il a reçu : les écarts
ci-dessous ne sont **pas** des fautes de l'exécutant.

Un quatrième correctif rattrape une **erreur de la spec S6 elle-même**.

| | Correctif | Priorité | Origine |
|---|---|---|---|
| **C1.1** | Les tickets entrent au catalogue | **haute** | spec corrigée après la livraison |
| **C1.2** | `portee` passe de chaîne à liste | **haute** — prérequis de C1.1 | idem |
| **C1.3** | Un seul référentiel pour les chefs de service | **moyenne** | **la spec S6 avait tort** |
| **C1.4** | La couture `canauxPour` | **basse**, optionnelle | refinement, pas un défaut |

**Fais-les dans cet ordre.** C1.2 avant C1.1 : sans la liste, les tickets ne peuvent pas
exprimer leur portée.

---

## C1.1 · Les tickets ne sont pas notifiés

### Le problème

`convex/tickets.ts` est le module des **retours d'usage** : un membre signale un
dysfonctionnement, un besoin ou une question sur la plateforme. Deux pistes parallèles sur le
même objet :

- la **Direction juge la pertinence** — champ `avis` : `en_attente` → `pertinent` |
  `non_pertinent` (motif obligatoire sur un refus), par `tickets.arbitrer` ;
- le **développeur fait avancer l'état** — champ `etat` : `nouveau` → `en_cours` → `resolu` |
  `abandonne`, par `tickets.avancer`.

C'est exactement un flux où **quelqu'un attend une réponse**, et aujourd'hui rien ne prévient
personne. Le catalogue compte 13 types ; il doit en compter **16**.

### Les trois droits en jeu

Déjà déclarés dans `rbac.MODULES`, **n'en crée aucun** :

| Clé | Ce que « Voir » ouvre | Niveau par défaut |
|---|---|---|
| `/tickets` | **ses propres** tickets | 1 — tout membre |
| `/tickets/arbitrage` | **tous** les tickets ; juger la pertinence | 7 |
| `/tickets/traitement` | **tous** les tickets ; faire avancer l'état | 8 |

Noter : **deux droits distincts** ouvrent la vue d'ensemble. C'est la raison d'être de C1.2.

### Les trois types à ajouter

Dans `convex/lib/notifications.ts`, et dans `CLES_S1` (qui passe à 16 entrées) :

```ts
  // ---------------- Tickets (retours d'usage de la plateforme) ----------------
  {
    cle: "ticket_ouvert",
    libelle: "Ticket ouvert",
    module: "/tickets",
    importance: "a_traiter",
    cible: { module: "/tickets/arbitrage", action: "faire" },
    previentLeProprietaire: false,
    // Deux droits ouvrent la vue d'ensemble : l'arbitrage et le traitement technique.
    portee: ["/tickets/arbitrage", "/tickets/traitement"],
    titre: (c) => `Nouveau ticket : ${c.libelle ?? ""}`.trim(),
    corps: (c) => (c.acteurNom ? `Ouvert par ${c.acteurNom}` : undefined),
  },
  {
    cle: "ticket_arbitre",
    libelle: "Pertinence d'un ticket jugée",
    module: "/tickets",
    importance: "info",
    // Jugé pertinent : le traitement technique doit le savoir. Jugé NON pertinent :
    // seul l'auteur est concerné — c'est l'émetteur qui omet la cible (voir ci-dessous).
    cible: { module: "/tickets/traitement", action: "faire" },
    previentLeProprietaire: true,
    portee: ["/tickets/arbitrage", "/tickets/traitement"],
    titre: (c) => `Ticket ${c.libelle ?? ""} : ${c.motif ? "refusé" : "jugé pertinent"}`.trim(),
    corps: (c) => c.motif,
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
```

**Canaux** : laisse `canaux` **absent** sur les trois. Un ticket n'est pas une urgence
opérationnelle, et WhatsApp est facturé au message. La cloche suffit.

### Les trois émissions

Dans `convex/tickets.ts`, **en dernière ligne de chaque handler**, après le `patch` ou
l'`insert`. Le module journalise déjà ses transitions (`journaliser`, avec `cible: t.titre`) :
**ne touche pas à ces appels et n'en ajoute pas.** La notification s'ajoute à côté.

**`ouvrir`** :

```ts
await notifier(ctx, {
  type: "ticket_ouvert",
  acteurId: me._id, acteurNom: me.nom ?? me.email,
  proprietaireId: me._id,
  objet: { table: "tickets", id: ticketId, reference: undefined },
  lien: "/tickets",
  rendu: { libelle: titre, acteurNom: me.nom ?? me.email },
});
```

**`arbitrer`** — le seul cas qui demande une attention :

```ts
await notifier(ctx, {
  type: "ticket_arbitre",
  acteurId: me._id, acteurNom: me.nom ?? me.email,
  proprietaireId: t.auteurId,
  objet: { table: "tickets", id: ticketId },
  lien: "/tickets",
  rendu: { libelle: t.titre, motif: avis === "non_pertinent" ? (motif?.trim() || "Refusé") : undefined },
  // Un ticket écarté ne concerne QUE son auteur : le traitement technique n'a rien à en faire.
  ignorerCible: avis === "non_pertinent",
});
```

Le drapeau `ignorerCible` est **à ajouter** au type `Evenement` et aux arguments de
`notifications.emettre` (`v.optional(v.boolean())`), puis honoré dans `destinataires()` :

```ts
  // 1. Par droit — l'adressage normal, déduit de la matrice du DG.
  if (type.cible && !e.ignorerCible) {
```

**`avancer`** :

```ts
await notifier(ctx, {
  type: "ticket_avance",
  acteurId: me._id, acteurNom: me.nom ?? me.email,
  proprietaireId: t.auteurId,
  objet: { table: "tickets", id: ticketId },
  lien: "/tickets",
  rendu: { libelle: t.titre, extrait: LIBELLE_ETAT[etat], motif: note?.trim() || undefined },
});
```

`LIBELLE_ETAT` existe déjà dans le fichier — réutilise-le, n'écris pas une seconde table de
libellés.

---

## C1.2 · `portee` doit être une liste

### Le problème

Aujourd'hui, dans `convex/lib/notifications.ts` :

```ts
  portee?: string;
```

et dans le filtre de `destinataires()` :

```ts
    if (type.portee && !m.droits[type.portee]?.voir && id !== e.proprietaireId) return false;
```

Une seule chaîne ne peut pas exprimer **« l'un OU l'autre de ces deux droits »**. Les
interventions n'ont qu'un droit d'ensemble (`/interventions/toutes`), les tickets en ont deux.

### Le correctif

Le type :

```ts
  /**
   * Portée par objet : sans AU MOINS UN de ces droits, l'objet n'est visible que de son
   * propriétaire. Encode la décision du 13/10/2026 sur les interventions, et le périmètre
   * « ses propres tickets » de `/tickets`.
   *
   * C'est une LISTE parce que deux droits distincts peuvent ouvrir la vue d'ensemble :
   * un ticket est visible en entier par l'arbitrage OU par le traitement technique.
   */
  portee?: string[];
```

Le filtre :

```ts
    // Portée par objet : sans AUCUN des droits d'ensemble, on ne voit que son propre dossier.
    if (type.portee?.length && id !== e.proprietaireId
        && !type.portee.some((d) => m.droits[d]?.voir)) return false;
```

Les quatre entrées d'interventions passent de `portee: "/interventions/toutes"` à
`portee: ["/interventions/toutes"]`.

**Et le test de cohérence du catalogue** (il vérifie que chaque clé de module existe dans
`MODULE_PAR_CLE`) doit boucler sur **chaque entrée** de la liste, pas sur la chaîne. Il est
aujourd'hui dans `tests/notifications.test.ts`, autour du contrôle n° 13.

---

## C1.3 · Deux référentiels pour les chefs de service — la spec S6 avait tort

### Ce que la spec disait, et pourquoi c'était faux

`S6-SERVICES.md` §2 affirme que « le responsable d'un service n'existe pas » et demande
d'ajouter un champ `responsableId`. **C'est inexact** : la table `services` porte déjà, sur
`dev`, un champ `chefs` dont le commentaire décrit exactement ce besoin :

> « Chefs du service — **un ou deux**, référencés et non saisis au clavier. C'est le socle du
> circuit voulu par le propriétaire : l'employé rend son compte rendu à son chef de service,
> qui en tient compte dans le sien, lequel remonte à la direction. Router exige de connaître
> le chef comme une IDENTITÉ. »

L'exécutant a correctement utilisé `chefs[0]` en repli, mais il a aussi ajouté `responsableId`
comme la spec le demandait. **Résultat : deux champs pour « qui dirige ce service ».** Une
source de vérité de trop, et la question « lequel fait foi ? » se posera au premier écart.

### Le correctif : `chefs` fait foi, `responsableId` disparaît

`responsableId` **n'a jamais été déployé** sur Convex — son retrait est donc sans risque et
sans migration. C'est maintenant ou jamais.

1. **`convex/schema.ts`** : retirer `responsableId` de la table `services`.
   *(C'est le seul retrait de champ de tout le programme. Il est permis précisément parce que
   rien en base ne le porte.)*
2. **`convex/services.ts`** : retirer `responsableId` des arguments et du handler de
   `enregistrer`.
3. **`convex/lib/servicesNotifs.ts`** : `responsableDuService` renvoie aujourd'hui **un** id.
   Elle devient :

```ts
/**
 * Chefs du service à notifier (correctif C1.3).
 *
 * `services.chefs` est la source unique : un ou deux chefs, référencés comme identités.
 * On notifie TOUS les chefs — le schéma en prévoit deux, et n'en prévenir qu'un ferait
 * dépendre le routage de l'ordre d'un tableau.
 */
export function chefsDuService(service: ServiceRef | undefined): string[] {
  return service?.chefs?.filter(Boolean) ?? [];
}
```

   Retirer `responsableId` du type `ServiceRef`, et supprimer `responsableDuService`.

4. **`convex/lib/notifications.ts`** : dans `Evenement`, `serviceResponsableId?: string`
   devient `serviceChefsIds?: string[]`, et l'étape 2 bis de `destinataires()` :

```ts
  // 2 bis. Les chefs du service concerné par le dossier (lot S6, correctif C1.3).
  if (type.previentLeServiceConcerne) {
    for (const id of e.serviceChefsIds ?? []) retenus.add(id);
  }
```

5. **`convex/notifications.ts`** : `emettre` résout déjà le service (il lit `services` une
   fois). Remplacer l'appel à `responsableDuService` par `chefsDuService`, et passer le
   tableau. **Ne rajoute aucune requête** : la lecture unique de `services` reste la règle.

6. **Paramètres** : si un écran expose `responsableId`, bascule-le sur `chefs`. Le réglage des
   chefs existe déjà.

**Les invariants ne changent pas** : un chef de service est filtré comme tout le monde s'il
n'a pas le droit de voir l'objet. Ne contourne pas ce filtre — un chef de service n'a pas
automatiquement accès à tout.

---

## C1.4 · La couture `canauxPour` — optionnelle, à faire en dernier

### Ce qui va déjà bien

`envois.ts` lit `type.canaux`, une **liste statique par type d'événement**. Il n'y a donc
**aucun repli conditionnel** : WhatsApp ne dépend pas de la disponibilité du push. La règle
voulue — *« le push ne remplace jamais WhatsApp »* — est **déjà respectée en pratique**.

C'est important à dire : il n'y a **pas de défaut à corriger** ici.

### Ce qui manque, et ce que ça vaut

Une **couture nommée**, pour que le propriétaire puisse un jour décider d'économiser des
messages WhatsApp vers les membres réellement joignables en push — sans qu'on réécrive
`envois.ts` :

```ts
/**
 * Canaux sortants retenus pour ce type et ce membre.
 *
 * Aujourd'hui : les canaux déclarés par le type, sans condition. Les canaux ne se
 * substituent PAS l'un à l'autre — un membre sans appareil capable de recevoir un push
 * (iPhone sans PWA installée, permission refusée, jeton périmé sans qu'on le sache) n'aurait
 * plus AUCUN canal hors application si WhatsApp dépendait de l'absence de push.
 *
 * Le paramètre `membre` n'est pas encore utilisé : il est là pour qu'un réglage futur
 * n'exige pas de rouvrir `envois.ts`.
 */
export function canauxPour(type: TypeEvenement, _membre?: { id: string }): Canal[] {
  return type.canaux ?? [];
}
```

`envois.ts` appelle `canauxPour(type, { id: destinataireId })` au lieu de lire `type.canaux`
directement. **C'est tout.** Aucun changement de comportement.

> **Si le temps manque, saute C1.4 et dis-le.** C'est le seul point de ce lot qui ne corrige
> rien.

---

## Tests

Trois suites existantes à compléter. Elles tournent **avec Node nu**, sans `npm install` :

```bash
node --experimental-strip-types tests/notifications.test.ts
node --experimental-strip-types tests/transportWhatsapp.test.ts
node --experimental-strip-types tests/services.test.ts
```

### À ajouter à `tests/notifications.test.ts`

| # | Cas | Attendu |
|---|---|---|
| 1 | `ticket_ouvert`, membre n'ayant que `/tickets` | **absent** : il ne voit que ses propres tickets |
| 2 | `ticket_ouvert`, membre ayant `/tickets/arbitrage` | **présent** |
| 3 | `ticket_ouvert`, membre ayant `/tickets/traitement` | **présent** — la portée accepte l'un **ou** l'autre |
| 4 | `ticket_ouvert`, l'auteur du ticket | **absent** (invariant 1) |
| 5 | `ticket_arbitre` avec `ignorerCible: true` | **seul l'auteur** ; pas le traitement technique |
| 6 | `ticket_arbitre` sans `ignorerCible` | l'auteur **et** le traitement technique |
| 7 | `ticket_avance` | **seul l'auteur** du ticket |
| 8 | `intervention_creee` avec `portee` en liste | comportement **inchangé** par rapport à avant C1.2 |
| 9 | `CLES_S1` | **16** entrées, toutes uniques |
| 10 | Cohérence du catalogue | tous les `module`, `cible.module` et **chaque entrée de chaque `portee`** existent dans `MODULE_PAR_CLE` |
| 11 | `rendre` sur les 16 types | titre non vide, aucun `undefined` dans la chaîne |

Le cas 8 est le **test de non-régression** de C1.2 : la bascule en liste ne doit rien changer
aux interventions.

### À ajouter à `tests/services.test.ts`

| # | Cas | Attendu |
|---|---|---|
| 12 | `chefsDuService` avec deux chefs | **les deux** ids |
| 13 | `chefsDuService` sans chef, ou service absent | `[]`, aucune erreur |
| 14 | Chef de service **sans** droit de voir le module | **absent** des destinataires |
| 15 | Chef de service qui est aussi l'acteur | **absent** (invariant 1) |
| 16 | Chef de service qui est aussi propriétaire | **une seule** entrée |

Le cas 14 est le plus important : il garantit que C1.3 n'ouvre pas de brèche dans le modèle
de droits.

### À ajouter à `tests/transportWhatsapp.test.ts` — seulement si C1.4 est fait

| # | Cas | Attendu |
|---|---|---|
| 17 | `canauxPour` sur un type sans `canaux` | `[]` |
| 18 | `canauxPour` sur un type à deux canaux | les deux, **quel que soit** le membre passé |

---

## Définition de « terminé »

- [ ] `node --experimental-strip-types` passe sur les **trois** suites, et aucun contrôle
      existant ne régresse (les compteurs ne doivent que monter : 118 / 44 / 12 aujourd'hui)
- [ ] `CLES_S1` compte 16 entrées
- [ ] `responsableId` n'apparaît **plus nulle part** (`grep -rn responsableId convex/ src/`)
- [ ] aucun `requireLevel` ajouté ; aucun droit nouveau dans `rbac.MODULES`
- [ ] les appels `journaliser` de `tickets.ts` sont **intacts**
- [ ] commentaires en français, qui disent *pourquoi*
- [ ] le patch produit, les sorties de tests **brutes** jointes, et ce qui n'a pas pu être
      vérifié **écrit**

## Ce que tu ne pourras pas vérifier

Dis-le, ne le contourne pas.

| Tu ne peux pas | Donc |
|---|---|
| Lancer `npm run typecheck` ni `npm run build` | Le lot est **étroit** : il ne contient pas `node_modules` ni tout l'arbre. Nous relançons les deux ici. **Signale-le**, ne fabrique pas de harnais. |
| Lancer Convex, ni les écrans | La logique touchée est pure et testée. La recette se fait ici. |
| Voir `rbac.ts` autrement qu'en lecture | Il est fourni **pour référence**. Ne le modifie pas : aucun droit nouveau n'est requis. |

## Risques

| Risque | Parade |
|---|---|
| `ignorerCible` oublié sur `non_pertinent` | Cas de test 5. Sans lui, le développeur reçoit les tickets écartés. |
| Le retrait de `responsableId` casse un écran | `grep -rn responsableId` avant de conclure. Le champ est récent et jamais déployé. |
| La bascule de `portee` change le comportement des interventions | Cas de test 8, explicitement de non-régression. |
| Les tickets partent sur WhatsApp | Laisse `canaux` **absent** sur les trois types. |
| Un chef de service reçoit ce qu'il n'a pas le droit de voir | Cas de test 14. Le filtre de visibilité s'applique à lui comme à tout le monde. |

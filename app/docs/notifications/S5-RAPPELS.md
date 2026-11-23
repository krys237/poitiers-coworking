# S5 · Moteur de rappels

> **Dépend de** : S1 livré. Tire profit de S3 et S4 s'ils sont livrés (un rappel sort par les
> canaux comme toute notification), mais **fonctionne sans eux**.
> **Modifie le schéma** : oui, une table ajoutée (`rappelsEmis`).
> **Dépendance externe** : les deux modèles WhatsApp `poitiers_rappel_compte_rendu` et
> `poitiers_dossier_en_attente` doivent être approuvés — voir `S3-HUB-WHATSAPP.md` §4.

---

## 1. Objectif

Faire en sorte que **rien ne reste bloqué parce que personne n'a regardé**.

Un seul moteur, **deux familles de déclencheurs** :

- **Délai dépassé** — un dossier attend depuis trop longtemps, un verrou va expirer.
- **Calendrier** — une échéance récurrente arrive (compte rendu du jour, journée financière,
  clôture de paie).

Les deux familles partagent exactement les mêmes besoins : savoir **qui n'a pas fait quoi**,
et **ne jamais rappeler deux fois la même chose**. C'est pourquoi elles sont un seul lot.

> À l'implémentation, découpe-le en deux étapes : d'abord le socle d'idempotence et la famille
> « calendrier » (la plus simple, et la plus attendue sur le terrain), ensuite la famille
> « délai dépassé » avec son escalade.

### Hors périmètre

- Le pense-bête personnel : c'est S7, qui réutilisera le planificateur de ce lot.
- Tout nouveau canal.
- Toute relance sur les modules de paie et de financier **autres que** celles listées au §4.

---

## 2. Le socle : ne jamais rappeler deux fois

Un rappel qui se répète à chaque passage du cron est pire que pas de rappel : il apprend aux
gens à l'ignorer. L'idempotence n'est donc pas un détail, c'est le cœur du lot.

```ts
  // ---- Rappels déjà émis (lot S5) ----
  // Garde-fou d'idempotence : une clé par rappel métier. Tant que la clé existe,
  // le rappel ne repart pas. Purgée avec les notifications.
  rappelsEmis: defineTable({
    cle: v.string(),                  // voir la composition ci-dessous
    destinataireId: v.optional(v.id("users")),
    emisLe: v.string(),
  }).index("by_cle", ["cle"]),
```

### Composition de la clé

```
<famille>-<objet ou échéance>-<palier ou date>[-<destinataire>]

dort-commandes-j57abc…-palier1            un dossier, un palier : une seule fois
cr-2026-11-12-ouverture-j91def…           une personne, un jour, un créneau
financier-2026-11-12                      une journée, une fois
paie-2026-11-cloture                      un mois, une fois
verrou-financier-j44xyz…-2026-11-12T09:05 un verrou précis
```

**La règle** : tout rappel récurrent porte **sa date** dans la clé. Un rappel de dossier
porte **son palier**. Sans la date, le rappel du lendemain serait pris pour un doublon de
celui de la veille et ne partirait jamais — c'est l'erreur à ne pas faire.

Fonction pure `cleRappel(...)` dans `convex/lib/rappels.ts`, et une
`internalMutation siPasDejaEmis(cle)` qui pose la clé et renvoie `true` seulement la première
fois. **Toute émission de rappel passe par elle.**

---

## 3. Famille « calendrier » — les crons

Toute la logique métier existe déjà. Il s'agit de la lire à l'heure dite.

> **Attention à l'heure.** Douala est à **UTC+1 fixe** (pas d'heure d'été). Les crons Convex
> se déclarent en UTC. 16 h à Douala = **15 h UTC**. La fonction `dateDouala()` de
> `convex/lib/fenetre.ts` donne la date du jour à Douala — utilise-la, ne recalcule pas.

### 3.1 Compte rendu non déposé — deux passages

| Passage | Heure | Destinataires |
|---|---|---|
| Ouverture du créneau | 16 h Douala (**15 h UTC**) | membres actifs **sans** compte rendu du jour |
| Avant fermeture | 19 h 30 Douala (**18 h 30 UTC**) | les mêmes, s'ils n'ont toujours rien déposé |

Règles à respecter, elles existent déjà dans le code :

- Les heures du créneau sont **réglables** (`crHeureOuverture`, `crHeureFermeture`,
  `crSamedi` dans `lib/reglages.ts`). **Lis les réglages**, ne code pas 16 et 20 en dur.
  Le second passage se calcule à `fermeture − 30 min`.
- **Pas de rappel hors jours ouvrés** : lundi à vendredi, plus le samedi si `crSamedi`.
- **Pas de rappel aux dispensés** : décision du 19/10/2026, les postes de niveau ≥ 5 (DAF, DG,
  super admin) déposent librement, sans pénalité. `dispenseDeFenetre()` existe dans
  `lib/fenetre.ts` — appelle-la.
- Un membre qui a déposé **au moins un** compte rendu pour la journée n'est pas rappelé.

**Attention à la performance.** `comptesRendus.vueSuperviseur` fait une requête par membre :
**ne l'appelle pas.** Lis `comptesRendus` par l'index `by_date` pour le jour, lis `users` une
fois, et fais la différence en mémoire.

Type d'événement à ajouter au catalogue de S1 :

```ts
{ cle: "rappel_compte_rendu", libelle: "Rappel : compte rendu du jour",
  module: "/comptes-rendus", importance: "a_traiter",
  cible: null, previentLeProprietaire: true,   // adressé nominativement, pas par droit
  titre: (c) => `Compte rendu du ${c.libelle} non déposé`,
  corps: (c) => `Le créneau se ferme à ${c.extrait}.` },
```

### 3.2 Journée financière non saisie

Cron à **18 h Douala (17 h UTC)**, du lundi au samedi. S'il n'existe aucune ligne
`journeesFinancieres` pour `dateDouala()`, rappeler aux détenteurs de `/financier:faire`.

Un seul passage. Pas d'escalade : ce n'est pas un blocage, c'est un oubli.

### 3.3 Mois de paie non clôturé

Le paiement est le **5 du mois suivant** (`parametres.jourPaiement`). Cron **quotidien** qui
ne fait quelque chose que les **3 derniers jours avant** cette date : si le mois précédent n'a
pas de ligne dans `cloturesPaie`, rappeler aux détenteurs de `/paie/bulletins:faire`.

Un rappel par jour, d'où la date dans la clé. Importance `urgent` le dernier jour.

---

## 4. Famille « délai dépassé » — relance et escalade

Un cron **horaire** balaie les dossiers en attente et rappelle par paliers.

### Le tableau des paliers

| Dossier | Condition | Palier 1 | Palier 2 (escalade) |
|---|---|---|---|
| Bon de commande `en_attente` | depuis > 24 h | `/commandes/validation:faire` | niveau ≥ 7 |
| Intervention `ouverte` | depuis > 48 h | `/interventions:faire` | niveau ≥ 7 |
| Intervention `en_cours` priorité `haute` | depuis > 72 h | `/interventions:faire` | niveau ≥ 7 |
| Litige non résolu | depuis > 48 h | `/commandes:faire` | niveau ≥ 7 |
| Compte rendu `en_relecture` | depuis > 72 h | `/comptes-rendus:faire` | — |

Palier 2 part **24 h après** le palier 1, et seulement si le dossier n'a pas bougé.

Les durées vont dans `lib/reglages.ts` (`relanceCommandeH: 24`, `relanceInterventionH: 48`,
`escaladeH: 24`…), avec ces valeurs par défaut. **Rien en dur.**

### L'escalade par niveau — pourquoi ici et pas ailleurs

Le projet a une règle forte : *on n'adresse pas par rôle, on adresse par droit*. L'escalade
est la **seule** exception assumée, et pour une raison précise : « remonter plus haut » est
par nature une notion **hiérarchique**, que les droits par module ne savent pas exprimer. Le
niveau sert déjà à cela ailleurs dans le projet (`peutAttribuer`, visibilité des documents).

Implémentation : les membres dont `NIVEAU[role] >= 7` **et** qui ont `droits[module].voir`.
Le second filtre n'est pas optionnel : c'est l'invariant 2 de S1, et il tient même pour une
escalade.

### Performance — le piège à éviter

Un cron horaire qui collecte toutes les commandes et toutes les interventions à chaque
passage, c'est exactement le défaut documenté dans `LISEZMOI.md` §6, mais **24 fois par
jour**.

- Interroge par **index de statut** (`commandes.by_statut`, `interventions.by_statut`) : seuls
  les dossiers en attente nous intéressent, et ils sont peu nombreux.
- **Jamais** de `.collect()` sur la table entière.
- Borne chaque passage à **50 dossiers** par type. Un retard de quelques heures sur le 51e
  est sans conséquence ; une requête qui explose, non.
- Lis `users` et `parametresEntreprise` **une fois par passage**, pas une fois par dossier.

Type d'événement à ajouter :

```ts
{ cle: "rappel_dossier_en_attente", libelle: "Rappel : dossier en attente",
  module: "/commandes",              // surchargé à l'émission selon le dossier
  importance: "a_traiter",
  cible: null,                       // les destinataires sont calculés par le moteur
  previentLeProprietaire: false,
  titre: (c) => `${c.reference} attend une décision`,
  corps: (c) => `En attente depuis ${c.extrait}.` },
```

> Ce type est **adressé explicitement** par le moteur (via `destinatairesExplicites`), parce
> que le palier change la cible. Le filtre de visibilité de S1 s'applique quand même : passe
> le bon `module` à l'émission, et les invariants tiennent.

---

## 5. Les rappels de verrou et de délai

La partie la moins critique du lot. **Fais-la en dernier**, et simplement.

### Verrou du grand livre

`financier.prendreVerrou` pose un verrou qui expire après `verrouFinancierMin` (15 min par
défaut). À la prise du verrou, planifie un contrôle à `durée − 3 min` :

```ts
await ctx.scheduler.runAfter((reglages.verrouFinancierMin - 3) * 60_000,
  internal.rappels.verrouBientotExpire, { date, membreId: user._id });
```

Le contrôle vérifie que le verrou **existe toujours**, qu'il appartient **toujours** au même
membre, et que la journée **n'a pas été enregistrée**. Si oui, une notification `urgent` au
seul porteur du verrou. Sinon, rien.

Pas de cron : la planification à la prise du verrou est plus simple, plus juste, et ne coûte
rien quand personne ne saisit.

### Délai de correction d'une ligne de caisse

Même principe, à l'enregistrement d'une ligne : rappel au seul auteur à
`verrouCaisseMin − 10 min`, et seulement si la ligne existe encore et n'a pas été modifiée.

Importance `info`. **Et c'est tout** : ne construis pas d'écran, ne fais pas d'escalade, ne
rappelle personne d'autre que l'auteur.

---

## 6. Déclaration des crons

Dans `app/convex/crons.ts`, à la suite de l'existant. Commente chaque ligne avec l'heure de
Douala en clair — c'est ce que le propriétaire lira.

```ts
// Rappels des comptes rendus : à l'ouverture du créneau puis 30 min avant sa fermeture
// (heures de Douala, UTC+1 fixe ; les heures réelles viennent des réglages, ces crons
// passent chaque heure et ne font quelque chose qu'au bon moment).
crons.hourly("rappels des comptes rendus", { minuteUTC: 0 }, internal.rappels.comptesRendus, {});

// Journée financière non saisie — 18:00 Douala.
crons.daily("rappel journee financiere", { hourUTC: 17, minuteUTC: 0 }, internal.rappels.journeeFinanciere, {});

// Mois de paie non cloture — contrôle quotidien, n'agit que dans les 3 jours avant le paiement.
crons.daily("rappel cloture de paie", { hourUTC: 7, minuteUTC: 0 }, internal.rappels.cloturePaie, {});

// Dossiers qui dorment : relance puis escalade.
crons.hourly("relance des dossiers en attente", { minuteUTC: 30 }, internal.rappels.dossiersEnAttente, {});
```

> **Pourquoi `hourly` pour les comptes rendus** plutôt que deux crons à heure fixe : les
> heures du créneau sont **réglables** dans Paramètres. Un cron horaire qui lit les réglages
> et ne fait quelque chose qu'à l'heure voulue respecte le réglage ; deux crons en dur le
> trahiraient dès que le DG change le créneau. Le coût est nul.

---

## 7. Tests

Suite `app/tests/rappels.test.ts`, script `test:rappels`. **Toute** la logique de décision
doit être pure et recevoir l'heure en paramètre — jamais `new Date()` dans la logique
testée. C'est ce qui rend ce lot testable.

| # | Cas | Attendu |
|---|---|---|
| 1 | Composition des clés | déterministe, et **la date change d'un jour à l'autre** |
| 2 | Un rappel déjà émis | ne repart pas |
| 3 | Le même rappel le lendemain | repart |
| 4 | Samedi, `crSamedi: false` | aucun rappel de compte rendu |
| 5 | Dimanche | aucun rappel, quel que soit le réglage |
| 6 | Membre de niveau ≥ 5 | **jamais** rappelé pour son compte rendu (dispense du 19/10/2026) |
| 7 | Membre ayant déposé | non rappelé |
| 8 | Créneau réglé à 14 h–18 h | les deux passages tombent à 14 h et 17 h 30 |
| 9 | Bon `en_attente` depuis 23 h / 25 h | pas de rappel / palier 1 |
| 10 | Palier 1 émis depuis 23 h / 25 h | pas d'escalade / palier 2 |
| 11 | Dossier qui a changé de statut entre-temps | aucune escalade |
| 12 | Escalade | niveau ≥ 7 **et** droit de voir le module ; un niveau 7 sans le droit est exclu |
| 13 | Clôture de paie, jour de paiement = 5 | rappels les 2, 3 et 4 ; rien le 1er |
| 14 | Verrou libéré avant l'échéance | aucun rappel |
| 15 | Borne de 50 dossiers | le 51e est ignoré sans erreur |

## 8. Recette manuelle

Les crons sont difficiles à recetter en situation. **Expose chaque fonction de rappel en
`internalMutation` appelable à la main** (`npx convex run rappels:comptesRendus '{}'`) et
recette ainsi :

1. Sans compte rendu du jour, lancer `rappels:comptesRendus` → une notification pour chaque
   membre non dispensé qui n'a rien déposé, et **aucune** pour les autres.
2. Relancer immédiatement → **aucune** nouvelle notification. C'est le test de l'idempotence,
   le plus important du lot.
3. Déposer un compte rendu, relancer → ce membre n'est plus rappelé.
4. Soumettre un bon de commande, forcer sa date de soumission à plus de 24 h en base, lancer
   `rappels:dossiersEnAttente` → palier 1 chez les validateurs.
5. Relancer → rien. Avancer encore de 24 h → palier 2 chez le DG.

> ⚠️ **`AUTH_DEV_BYPASS` est coupé** sur le déploiement : `npx convex run` sur une fonction
> *métier* échoue (« Non authentifié »). C'est pourquoi ces points d'entrée de recette doivent
> être des **mutations internes**, qui ne passent pas par `requireDroit`.

## 9. Risques

| Risque | Parade |
|---|---|
| Le rappel qui se répète toutes les heures | `rappelsEmis` et sa clé datée. Testé (cas 2 et 3), recetté (étape 2). |
| Le rappel qui ne repart jamais le lendemain | La date **dans** la clé. Testé (cas 1 et 3). |
| Un cron horaire qui collecte tout, 24 fois par jour | Index de statut, borne à 50, lectures uniques. |
| Rappeler un dispensé, ou un samedi | `dispenseDeFenetre()` et les réglages. Testés (cas 4, 5, 6). |
| Un créneau réglé dans Paramètres et ignoré par le cron | Cron horaire qui lit les réglages. Testé (cas 8). |
| Le décalage UTC / Douala (UTC+1 fixe) | `dateDouala()`, et l'heure de Douala écrite en commentaire de chaque cron. |
| Le canal WhatsApp saturé par un rappel de masse | L'étalement de S3 §7 s'applique. Une quarantaine de rappels à 1 200 ms tient sous le plafond. |
| Trop de rappels, donc plus aucun lu | Les durées sont réglables. Si le propriétaire trouve que ça sonne trop, **c'est un réglage, pas un correctif**. |

# S6 · Routage par service

> **Dépend de** : S1 livré.
> **Modifie le schéma** : oui, des champs optionnels ajoutés (additif).
> **Dépendance externe** : aucune, mais **porte un chantier de données** qui demande des
> décisions du propriétaire.
> **Placé tard dans le programme pour cette raison.** Les lots S1 à S5 fonctionnent sans lui.

---

## 1. Objectif

Faire qu'une demande qui concerne le **laboratoire** remonte aussi au responsable du
laboratoire — et pas seulement aux détenteurs du droit d'arbitrage.

Le propriétaire a demandé que « les services concernés » soient prévenus. S1 a traité la
lecture *« service = le droit »*, qui couvre l'essentiel. Ce lot traite la seconde lecture :
*« service = l'unité métier »* — laboratoire, secrétariat, pharmacie, hospitalisation.

---

## 2. L'état réel du référentiel — lis ceci avant de promettre quoi que ce soit

J'ai vérifié dans le code. Voici ce qui existe et ce qui manque.

### Ce qui existe

- La table **`services`** est en place (venue du chantier `rh`) : `nom`, `couleur`, `ordre`,
  `actif`, index `by_nom`. Avec **dix services réels** déjà définis dans
  `convex/services.ts` (`SERVICES_INITIAUX`) : `PARAMETRES`, `TECHNIQUE`, `ADMIN`, `IMAGERIE`,
  `HOSPI`, `CAISSE PHCIE`, `LABORATOIRE`, `SECRETARIAT`, `COMPTABILITE`, `GREEN ENERGY`.
- **`employes.serviceId`** relie une fiche employé à son service. C'est la colonne SERVICE du
  planning.

### Ce qui manque

| Manque | Détail |
|---|---|
| Le **membre** n'a pas de service | `users` porte seulement `poste` et `departement`, **en texte libre**. Aucun lien vers `services`. |
| Le **responsable** d'un service n'existe pas | `interventions.chefService` est un **nom tapé à la main** dans le formulaire. Ce n'est pas une donnée, c'est une chaîne. |
| Les objets ne référencent pas le service | `commandes.service` et `interventions.service` sont des `v.optional(v.string())` — du **texte libre**, pas des références. |

### Le chemin déjà exploitable

Il existe une liaison dérivable **aujourd'hui** :

```
users.employeId  →  employes.serviceId  →  services
```

Donc pour tout membre **relié à sa fiche employé**, le service est **déjà connu**. Le lien est
posé à la main par le propriétaire dans l'écran Membres (décision du 13/10/2026), et il ne
l'est pas pour tout le monde.

> **Conséquence à assumer, et à dire au propriétaire** : le routage par service ne sera fiable
> que pour les membres rattachés. C'est une question de **données**, pas de code. L'étape 1
> ci-dessous existe pour la régler.

---

## 3. Étape 1 — assainir les données

C'est la part la plus longue du lot, et elle n'est pas du développement.

### 3.1 Le service du membre

Champ additif sur `users` :

```ts
    // Service d'affectation du membre (lot S6). À défaut, il est dérivé de sa fiche
    // employé (users.employeId → employes.serviceId). Renseigné ici quand le membre
    // n'a pas de fiche, ou quand son service de rattachement diffère.
    serviceId: v.optional(v.id("services")),
```

Fonction pure `serviceDuMembre(membre, fiche)` : `membre.serviceId` d'abord,
`fiche?.serviceId` ensuite, `undefined` sinon. **Un seul endroit décide**, et il est testé.

Dans l'écran Membres : un sélecteur de service sur la fiche, et une **colonne « Service »**
qui affiche d'où vient la valeur (« propre » ou « via la fiche employé »). Le propriétaire
doit pouvoir voir d'un coup d'œil qui n'est rattaché à rien — c'est ce qui rend
l'assainissement faisable.

### 3.2 Le responsable d'un service

Champ additif sur `services` :

```ts
    // Responsable du service (lot S6) : destinataire des notifications qui concernent
    // ce service. Remplace le champ texte `interventions.chefService`, qui n'était
    // qu'un nom saisi à la main.
    responsableId: v.optional(v.id("users")),
```

Réglage dans Paramètres, à côté de la gestion des services qui existe déjà
(`services.enregistrer`). Un seul responsable par service — **ne construis pas une liste**,
le besoin exprimé n'en demande pas, et une liste se gère mal.

### 3.3 Les objets référencent leur service

**Ajoute** un champ, **ne touche pas** à l'existant :

```ts
// commandes et interventions
    serviceId: v.optional(v.id("services")),   // remplace progressivement `service` (texte libre)
```

Le champ `service: v.optional(v.string())` **reste en place**. Deux raisons : les lignes déjà
en base le portent, et le supprimer exigerait une migration — précisément ce que ce programme
s'interdit.

Dans les formulaires de commande et d'intervention : le champ texte devient un **sélecteur**
alimenté par `services.liste`. À l'enregistrement, pose `serviceId`, et pose aussi `service`
avec le **nom** du service choisi, pour que les anciens écrans et les exports continuent de
fonctionner.

Fonction `serviceDeLObjet(objet, services)` : `serviceId` d'abord ; à défaut, rapprochement du
texte par nom **normalisé** (`trim`, espaces réduits, majuscules — la fonction `normaliser` de
`convex/services.ts` fait déjà exactement ça, réutilise-la) ; `undefined` sinon.

> **Ne lance aucune reprise automatique des anciennes lignes.** Le rapprochement par nom est
> fait à la lecture, pas par une écriture de masse. Si le propriétaire veut nettoyer
> l'historique, ce sera une mutation à part, lancée sciemment.

---

## 4. Étape 2 — étendre l'adressage

Un champ de plus au catalogue de S1 :

```ts
  /** Le responsable du service concerné par l'objet est-il prévenu ? */
  previentLeServiceConcerne?: boolean;
```

Et une entrée de plus dans l'événement :

```ts
  serviceResponsableId?: string;   // résolu par l'émetteur avant l'appel
```

Dans `destinataires()` de S1, après l'étape 2 (le propriétaire) :

```ts
  // 2 bis. Le responsable du service concerné par le dossier (lot S6).
  if (type.previentLeServiceConcerne && e.serviceResponsableId) {
    retenus.add(e.serviceResponsableId);
  }
```

**Et c'est tout.** Les quatre invariants de S1 s'appliquent ensuite sans changement : le
responsable est retiré s'il est l'acteur, et il est filtré s'il n'a pas le droit de voir
l'objet. **Ne contourne pas ce filtre** — un responsable de service n'a pas automatiquement
accès à tout.

### Quels types activent le routage par service

| Type | Service concerné |
|---|---|
| `commande_soumise` | oui — le service demandeur suit son approvisionnement |
| `commande_validee`, `commande_rejetee`, `commande_litige` | oui |
| `intervention_creee`, `intervention_arbitree`, `intervention_cloturee` | oui |
| tous les autres | non |

### La résolution, côté émetteur

`notifications.emettre` lit déjà `users` et `parametresEntreprise` une fois. Ajoute **une**
lecture de `services` (dix lignes, c'est gratuit) et résous le responsable avant d'appeler
`destinataires()`. **Pas de requête supplémentaire par destinataire.**

---

## 5. Tests

À ajouter à `app/tests/notifications.test.ts`, plus un nouveau
`app/tests/services.test.ts` (script `test:servicesNotifs`) :

| # | Cas | Attendu |
|---|---|---|
| 1 | `serviceDuMembre` | champ propre prioritaire sur la fiche employé |
| 2 | Membre sans champ ni fiche | `undefined`, aucune erreur |
| 3 | `serviceDeLObjet` avec `serviceId` | le service référencé |
| 4 | `serviceDeLObjet` avec texte `« laboratoire »` | rapproché de `LABORATOIRE` (normalisation) |
| 5 | Texte ne correspondant à aucun service | `undefined`, aucune erreur |
| 6 | Responsable prévenu | présent dans les destinataires |
| 7 | Responsable **sans** droit de voir le module | **absent** — l'invariant 2 tient |
| 8 | Responsable = acteur | **absent** — l'invariant 1 tient |
| 9 | Responsable = propriétaire du dossier | une seule entrée |
| 10 | Service sans responsable | aucun ajout, aucune erreur |

Le cas 7 est le plus important : c'est lui qui garantit que ce lot n'ouvre pas une brèche dans
le modèle de droits.

## 6. Recette manuelle

1. Dans Paramètres, désigner un responsable pour `LABORATOIRE`.
2. Rattacher un membre à ce service dans l'écran Membres.
3. Déposer un bon de commande en choisissant `LABORATOIRE` → le responsable est notifié,
   **en plus** des validateurs.
4. Retirer au responsable le droit `/commandes` Voir, recommencer → il n'est **plus**
   notifié. C'est le test qui compte.
5. Ouvrir une commande ancienne (sans `serviceId`, avec seulement le texte) → l'écran affiche
   toujours son service, et rien n'a planté.

## 7. Risques

| Risque | Parade |
|---|---|
| Le routage promis mais les données absentes | L'étape 1 est un préalable, pas une option. La colonne « Service » de l'écran Membres rend visible ce qui manque. |
| Le responsable reçoit ce qu'il n'a pas le droit de voir | Le filtre de visibilité de S1 s'applique. Testé (cas 7). |
| Une migration de masse qui abîme l'historique | Aucune. Le texte reste, la référence s'ajoute, le rapprochement se fait à la lecture. |
| `interventions.chefService` qui traîne | Laisse-le. Il n'est plus la source de vérité, mais le supprimer est une migration. À signaler au backlog. |
| Deux sources de vérité pour le service d'un membre | `serviceDuMembre()` est le **seul** endroit qui décide, et il est testé. |

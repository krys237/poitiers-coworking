# Multi-société — décisions de conception

> Arrêté le **25/11/2026** avec le propriétaire, d'après ses réponses aux six questions de
> cadrage. Ce document fixe le **modèle de données, les index et le contrat des requêtes**. Il est
> la source des fiches de lot confiées à l'exécutant cloud : ce qu'il contient ne se renégocie pas
> dans un lot.
>
> Écrit par l'agent de déploiement, à qui la méthode du projet réserve le modèle, le schéma et le
> séquencement des migrations (`.agents/skills/lot-agent-externe/SKILL.md`).

---

## 1. Le vocabulaire, fixé une fois pour toutes

Le mot « société » désignait **deux choses différentes** dans ce dépôt, et c'est la première
source de confusion à supprimer. Désormais :

| Terme | Ce que c'est | Où il vit |
|---|---|---|
| **entité** | Une **personne morale** : POLYCLINIQUE DE POITIERS, EDR-TIM, LES LILAS. Son propre RC, son NIU, ses employés, ses comptes. C'est l'**espace de travail** entre lesquels le directeur bascule. **Affichée « Société » à l'écran** — voir § 1 bis. | table **`entites`** *(nouvelle)* |
| **déclarant** | SESAME, SOFINA, SGC — employeurs au sens de la **déclaration de paie**, chacun avec son NIU et son numéro CNPS. Un bulletin par déclarant, un DIPE par déclarant. **Transversal aux entités** : décision du 25/11, « c'est le même employeur, les autres sociétés doivent avoir ces trois déclarants ». | champ `societe` **existant, INCHANGÉ** |
| **bloc** | Une colonne de la feuille de caisse du DAF : POITIERS, Les Lilas, Carte Visa, E DR TIM Finance… | constante `BLOCS` de `lib/tresorerie.ts`, **inchangée en étape A** |

⚠️ **Ces trois notions ne se recouvrent pas et aucune n'est dérivable d'une autre.** Le bloc
« Les Lilas » du grand livre n'est **pas** la société LES LILAS : c'est une colonne de la caisse de
POITIERS, qui n'a jamais rien encaissé. Le propriétaire le laisse en place pour l'instant et le
retirera lui-même.

Le propriétaire a tranché le 25/11 : **on ne touche pas aux déclarants.** Ils restent le type figé
`"SESAME" | "SOFINA" | "SGC"` du champ `societe`, et ils sont **disponibles pour toute entité** —
c'est le même employeur. Aucune migration de renommage, donc, et aucun risque sur la chaîne de paie
qui fonctionne.

---

## 1 bis. Pourquoi le nouveau champ s'appelle `entiteId` et non `societeId`

Conséquence directe de la décision ci-dessus : le champ `societe` **reste en base avec son sens de
déclarant**. Si le nouveau champ s'appelait `societeId`, la même ligne porterait
`employes.societe = "SOFINA"` **et** `employes.entiteId = <POLYCLINIQUE>` — deux données
différentes sous un nom quasi identique, sur la même ligne.

Ce n'est pas une coquetterie de nommage. C'est **exactement** la classe de bug que ce projet paie en
boucle, nommée dans `PASSATION-DEPLOIEMENT.md` : « chaque fois que deux endroits décrivent la même
donnée, ils finissent par diverger ». Et l'erreur ici n'est pas bénigne : quelqu'un — humain ou
exécutant cloud — lira `e.societe` en croyant tenir la personne morale, filtrera sur `"SOFINA"` au
lieu de filtrer sur POITIERS, et **affichera les données d'une autre entité**. C'est une fuite
inter-sociétés née d'un nom mal choisi.

D'où la règle, et elle n'a pas d'exception :

| | En base / dans le code | À l'écran |
|---|---|---|
| Personne morale | **`entiteId`**, table `entites` | « **Société** » |
| Déclarant de paie | `societe` *(inchangé)* | « Société » dans le bulletin et le DIPE, comme aujourd'hui |

Le libellé affiché n'a pas à suivre le nom du champ. L'utilisateur parle de sociétés ; le schéma,
lui, doit être impossible à confondre. Bénéfice secondaire : « entité » se généralise au white
label, où les clients ne seront pas tous des cliniques.

---

## 2. Deux niveaux — et pourquoi un seul entre dans le schéma

Le propriétaire a annoncé un **white label** : d'autres exploitants auront leur propre instance et
géreront leur propre liste de sociétés. Il y a donc deux niveaux d'isolation, et ils ne se traitent
pas du tout de la même façon.

| Niveau | Qui doit être isolé de qui | Comment |
|---|---|---|
| **Client** (white label) | deux exploitants qui ne doivent **jamais** se voir | **par le déploiement** : un projet Convex + un projet Vercel par client |
| **Société** (personne morale) | des entités d'un même groupe, que les mêmes personnes administrent | **par une colonne** : `entiteId` sur chaque ligne |

> **Décision du 25/11 : le niveau client est différé.** Le propriétaire veut d'abord accumuler ses
> besoins white label dans un document dédié — **`WHITE-LABEL.md`, à la racine du dépôt** — avant
> d'arbitrer. L'étape A ci-dessous est conçue pour fonctionner **sous les deux hypothèses** : la
> dimension entité est nécessaire dans tous les cas. Ce qui suit est donc une recommandation
> consignée, pas une décision prise.

**Recommandation : ne jamais mettre le niveau client dans le schéma.** Un `clientId` sur chaque
ligne fait reposer l'étanchéité entre deux cliniques concurrentes sur le fait qu'aucune requête,
jamais, n'oublie son filtre. Il y a plus de cent fonctions serveur dans ce dépôt ; un seul oubli
expose la paie d'un autre exploitant. Le déploiement, lui, est une frontière que le code ne peut
pas franchir par erreur : il n'y a pas de requête capable d'atteindre un autre déploiement Convex.

Le coût est réel et assumé : un déploiement par client, donc une migration à rejouer par client, et
un `convex deploy` par client. La chaîne existe déjà — ce dépôt pilote deux déploiements
(`focused-chipmunk-580` et `coordinated-clam-865`) avec deux projets Vercel sur un seul dépôt. En
ajouter un troisième est une opération connue, documentée dans `PASSATION-DEPLOIEMENT.md`.

Les *components* Convex ont été étudiés : chaque instance a ses propres tables, dans la même
transaction, et ne peut pas appeler vers l'extérieur — l'isolation est réelle. Mais elles se
**déclarent au build** dans `convex.config.ts` : ajouter une société demanderait une modification
de code et un déploiement, ce qui contredit frontalement l'exigence « chaque responsable rallonge
sa liste lui-même ». Écartées pour cette raison, pas pour une autre.

---

## 3. Les tables nouvelles

### `entites`

```ts
entites: defineTable({
  nom: v.string(),                        // "POLYCLINIQUE DE POITIERS" — affiché partout
  code: v.string(),                       // "poitiers" — slug stable, jamais affiché, sert aux clés
  actif: v.boolean(),
  ordre: v.number(),                      // ordre du sélecteur
  // Identité juridique : ce que `parametresEntreprise` portait pour l'entreprise unique.
  raisonSociale: v.optional(v.string()),
  adresse: v.optional(v.string()),
  telephone: v.optional(v.string()),
  niu: v.optional(v.string()),
  numeroCnps: v.optional(v.string()),
  registreCommerce: v.optional(v.string()),
  dirigeant: v.optional(v.string()),
  emailExpediteur: v.optional(v.string()), // l'expéditeur du courrier de paie est propre à la société
  logoId: v.optional(v.id("_storage")),
})
  .index("by_code", ["code"])
  .index("by_actif_ordre", ["actif", "ordre"]),
```

`code` est immuable après création : il sert de clé stable dans les exports et les journaux, là où
un `_id` serait illisible et un `nom` instable.

### `accesEntites`

```ts
accesEntites: defineTable({
  membreId: v.id("users"),
  entiteId: v.id("entites"),
  // Le rôle du membre DANS cette société. Absent = il y porte son rôle global (`users.role`).
  // C'est ce champ qui réalise la demande du propriétaire : « donner au DAF de Poitiers un accès
  // à un niveau ou à un autre sur une autre société ».
  role: v.optional(v.string()),
  // Exceptions par module, bornées à cette société — même forme que `users.droitsPerso`.
  droitsPerso: v.optional(v.array(v.object({
    module: v.string(), voir: v.boolean(), faire: v.boolean(),
  }))),
  actif: v.boolean(),
  accordePar: v.optional(v.id("users")),   // traçabilité : qui a ouvert cet accès
  accordeLe: v.optional(v.string()),
})
  .index("by_membre", ["membreId"])
  .index("by_entite", ["entiteId"])
  .index("by_membre_entite", ["membreId", "entiteId"]),
```

### Sur `users`

```ts
entitePrincipaleId: v.optional(v.id("entites")),   // société d'appartenance, sélectionnée à l'arrivée
```

Un membre **existe une seule fois**, quelles que soient les sociétés où il travaille. On ne duplique
pas une personne : c'est `accesEntites` qui porte ses périmètres. Sans quoi un même employé aurait
deux comptes, deux mots de passe et deux historiques.

---

## 4. Ce qui est scopé, ce qui reste partagé

**Scopées** — chacune reçoit `entiteId: v.optional(v.id("entites"))` :

```
employes · rattachements · saisiesMensuelles · primesCharges · bulletins · envois
cloturesPaie · absences · rubriquesPaie
journeesFinancieres · cloturesFinancieres · verrousFinanciers
documents · commandes · fournisseurs · interventions · comptesRendus
statsCaisse · primesMedecins · rapportsAudit · tickets · actes · retenueMedecins
services · fonctions
journalActivite · notifications · envoisNotifications · rappelsEmis · penseBetes
```

**Partagées, volontairement** :

| Table | Pourquoi |
|---|---|
| `baremes` | le barème CNPS/CGI est **national**. Le dupliquer par société, c'est accepter qu'elles divergent, donc qu'un bulletin soit faux quelque part. |
| `users` et les tables d'authentification | une personne, un compte, un mot de passe. Le périmètre vit dans `accesEntites`. |
| `joursFeries` | calendrier national. À scoper seulement si une société relève d'un autre pays. |
| `modelesActes` | les 13 modèles servent de socle commun ; une surcharge par société viendra si le besoin apparaît. |
| `parametresEntreprise` | garde les **réglages de fonctionnement** et la matrice `droitsRoles`, qui restent globaux en étape A. L'identité juridique, elle, **déménage** dans `entites`. |

---

## 5. Les index — `entiteId` **en première position**

C'est une contrainte Convex structurelle, pas une optimisation : un index ne sert au filtrage que
si la colonne filtrée est en tête. Chaque table scopée gagne un index préfixé, **l'ancien étant
conservé** le temps de la transition :

```
employes            by_entite_matricule   ["entiteId", "matricule"]
                    by_entite_service     ["entiteId", "serviceId"]
rattachements       by_entite_employe     ["entiteId", "employeId"]
saisiesMensuelles   by_entite_periode     ["entiteId", "periode"]
bulletins           by_entite_periode     ["entiteId", "periode"]
journeesFinancieres by_entite_date        ["entiteId", "date"]
cloturesFinancieres by_entite_periode     ["entiteId", "periode"]
commandes           by_entite_reference   ["entiteId", "reference"]
interventions       by_entite_reference   ["entiteId", "reference"]
comptesRendus       by_entite_auteur_date ["entiteId", "auteurId", "date"]
documents           by_entite_fichier     ["entiteId", "fichier"]
services            by_entite_ordre       ["entiteId", "ordre"]
…
```

Règle à appliquer sans exception : **toute requête d'une table scopée passe par un index qui
commence par `entiteId`.** Un `.filter()` sur `entiteId` après un `withIndex` sur autre chose lit
les lignes des autres sociétés avant de les jeter — c'est à la fois un coût permanent et une fuite
en attente d'un bug d'affichage.

---

## 6. La société active : argument explicite, validé côté serveur

**Décision : la société active est un argument de chaque requête et mutation scopée, pas un champ
mutable sur le membre.**

```ts
export const liste = query({
  args: { entiteId: v.id("entites"), /* … */ },
  handler: async (ctx, { entiteId }) => {
    const me = await requireDroit(ctx, "/employes", "voir", entiteId);
    // … withIndex("by_entite_…", q => q.eq("entiteId", entiteId))
  },
});
```

Deux raisons, et la seconde est la plus importante.

**Côté Convex** : une query est un abonnement mis en cache par couple (fonction, arguments). Si la
société active vivait sur la ligne du membre, basculer de société exigerait une **écriture**, et
cette écriture invaliderait toutes les queries qui lisent le membre — c'est-à-dire presque toutes.
En argument, la bascule est une simple relecture, et les deux sociétés restent en cache.

**Côté sécurité** : c'est la seule règle universelle que la recherche sur le multi-tenant donne
sans exception — *le périmètre ne se déduit jamais de ce que le client envoie, il se vérifie contre
l'identité authentifiée.* Le client **propose** une `entiteId`, le serveur la **vérifie** contre
`accesEntites`. Ce contrôle vit à **un seul endroit**, dans `requireDroit` :

```ts
requireDroit(ctx, module, action, entiteId)
  → 1. le membre est-il actif et autorisé ?
    2. a-t-il un accès ACTIF à cette entiteId (ou en est-il membre principal) ?
    3. quel est son rôle DANS cette société (accesEntites.role ?? users.role) ?
    4. droitsEffectifs(rôle, surcharges globales, droitsPerso de la société) autorise-t-il
       (module, action) ?
```

Côté écran, la société active vit dans un contexte React (`useEntite()`) persisté en
`localStorage`, et n'est **rien d'autre qu'une préférence d'affichage** : la refuser est le travail
du serveur.

---

## 7. Les quatre pièges que le scope crée

Ils sont tous dans le code aujourd'hui et aucun ne se signale tout seul.

**1. Le matricule n'est unique que par société.** `employes.by_matricule` est interrogé sans
société par `employes.importer` (upsert) et par `prochainMatricule`. En l'état, importer l'effectif
d'EDR-TIM **mettrait à jour les fiches de POITIERS** portant les mêmes matricules, silencieusement
— « le matricule est la clé de l'upsert », c'est déjà écrit dans la passation. C'est le piège qui
mordra **le premier**, puisque le besoin immédiat est d'ajouter les employés d'EDR-TIM.

**2. Les séquences de référence sont globales.** `CMD-AAAA-NNN` et `INT-AAAA-NNN` se calculent sur
toutes les commandes de l'année. La première commande d'EDR-TIM porterait le n° 005 parce que
POITIERS en a quatre. Les séquences deviennent **par société et par année**.

**3. Les clôtures sont indexées par période seule.** `cloturesFinancieres` et `cloturesPaie` sont
cherchées par `periode`. Clôturer novembre chez POITIERS **gèlerait novembre chez EDR-TIM**, et le
message d'erreur parlerait d'un mois clôturé que personne n'a clôturé.

**4. Le grand livre reste mono-société en étape A.** Les neuf blocs sont une constante de code
calquée sur la feuille du DAF de POITIERS. Une société nouvelle n'a **pas** cette feuille : lui
servir les blocs de POITIERS afficherait neuf colonnes qui ne veulent rien dire chez elle.
→ En étape A, le module financier n'est ouvert **qu'à la société dont `code === "poitiers"`** ;
ailleurs, l'écran affiche « grand livre non configuré pour cette société ». Rendre les blocs
paramétrables est un chantier à part (étape C). **Ne pas improviser là-dessus.**

---

## 8. La migration

Toute donnée existante appartient à **POLYCLINIQUE DE POITIERS** — réponse du propriétaire, question 6 :
« les autres n'en ont pas besoin ».

Déroulé, dans cet ordre :

1. pousser le schéma avec `entiteId` **optionnel** partout, et les nouveaux index. Additif : aucune
   ligne existante n'est invalidée, chaque lecture retombe sur l'ancien comportement ;
2. créer la ligne `entites` de POITIERS (`code: "poitiers"`), en y recopiant l'identité portée
   aujourd'hui par `parametresEntreprise` ;
3. lancer **`migrerEntites`** — une `internalMutation` qui estampille toutes les lignes des tables
   scopées, **vérifie avant d'écrire** qu'il existe exactement une société et qu'aucune ligne ne
   porte déjà un `entiteId` étranger, et rend le compte rendu de ce qu'elle a écrit et refusé ;
4. créer les sociétés EDR-TIM et LES LILAS depuis l'écran Paramètres ;
5. **seulement ensuite**, rendre `entiteId` obligatoire dans le schéma.

Inverser 1 et 5 fait **rejeter par Convex toutes les lignes déjà en base** — c'est exactement le
déroulé en trois temps du renommage `salaireBrut` → `salaireBase`, et il est non négociable.

La migration et son séquencement **ne sont pas délégables** : ils touchent les données de
production. Elles restent à l'agent de déploiement.

---

## 9. Le découpage en lots

| Lot | Contenu | Qui |
|---|---|---|
| **M1** | schéma (`entites`, `accesEntites`, `entiteId`, index), `migrerEntites`, séquencement du déploiement | **agent de déploiement**, dans le dépôt |
| **A** | `convex/lib/perimetre.ts` — **logique pure** : périmètre d'un membre, rôle effectif par société, fusion avec `droitsEffectifs`. Avec ses tests. ~10 Ko, zéro dépendance | **exécutant cloud** — *premier lot* |
| **B** | sélecteur de société : contexte `useEntite()`, bandeau, persistance, et le passage de `entiteId` dans les écrans | **exécutant cloud** |
| **C** | édition des accès par société sur la fiche du membre | **exécutant cloud** |
| **D** | les trois correctifs d'unicité du § 7 (matricule, séquences, clôtures) | **exécutant cloud**, sur spécification d'ici |
| **E** | vue « Groupe » consolidée, **en lecture seule** — différée (question 3 : on part sur du séparé) | plus tard |

Le lot **A** est le bon premier lot : logique pure, testable avec Node nu, sans accès au dépôt ni
aux données. C'est le format que le skill recommande.

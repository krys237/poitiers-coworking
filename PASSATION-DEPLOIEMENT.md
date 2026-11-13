# Passation à l'agent de déploiement — branche `rh`

> Écrit le **06/11/2026**, après le dernier lot. Destinataire : l'agent chargé du déploiement.
>
> **Ce document se lit en entier avant de pousser quoi que ce soit.** Il contient trois choses qui
> cassent si elles sont faites dans le mauvais ordre, et deux changements de comportement qui
> surprendront si personne ne les a annoncés.

---

## 1. Où en est la branche

| | |
|---|---|
| Branche | `rh` |
| Arbre de travail | `C:\test\Js\poitiers-coworking-rh` |
| Commits depuis `main` | **47** |
| Dernier commit | `4e97118` — N2, alertes d'échéance de contrat |
| Tests | **27 suites, 1 041 vérifications, toutes au vert** |
| Typecheck | front **et** `convex/` propres |
| Build | `npm run build` passe |

**Rien n'a jamais tourné sur des données réelles.** C'est le fait central de cette passation : tout
ce qui suit est vérifié par des tests sur de la logique pure, et par rien d'autre.

### Ce qui est livré

Les lots **R0 à R11** et les demandes **N1, N2, N4, N5**. Seule **N3** (signature électronique)
reste à faire, volontairement bloquée — voir `app/docs/rh/A-VERIFIER.md`, point **N3-a**.

---

## 2. ⚠️ Le backend Convex a six lots de retard

C'est le blocage le plus immédiat, et il se constate déjà à l'écran.

Le frontend local pointe sur `vivid-okapi-830` (voir `app/.env.local`). J'ai **sondé** ce
déploiement fonction par fonction le 05/11 :

| Lot | Sonde | Présent&nbsp;? |
|---|---|---|
| R0 | `joursFeries:liste` | ✅ |
| R1 | `services:liste`, `planning:vueAnnuelle` | ✅ |
| R2 | `rubriques:liste` | ✅ |
| R2 bis | `employes:rattachements` | ✅ |
| R3 | `dipe:etat` | ✅ |
| R5 | `planning:catalogueAbsences` | ✅ |
| **R9** | `bareme:vueRH` | ❌ |
| **R10** | `fonctions:liste` | ❌ |
| **R11** | `actes:modeles` | ❌ |

**Le déploiement s'arrête à R5.** Son push est antérieur au 4 novembre, donc à R7. Conséquence
visible : `Could not find public function for 'fonctions:liste'` — et la Vue RH, les Actes, la
Retenue médecins et les Tickets échoueront de la même façon.

⚠️ **Je n'ai pas poussé**, conformément à la règle n°2 de `app/CONSIGNES-MULTI-AGENTS.md` : un
`convex deploy` pousse **tout** le dossier `convex/` du worktree d'où il part, schéma compris. La
décision vous appartient.

---

## 3. L'ordre à respecter

### 3.1 Le push du schéma

Tout est **additif et optionnel**. Aucune donnée existante n'est invalidée, et chaque lecture
retombe sur l'ancien comportement quand un champ est absent. Un push peut donc se faire d'un bloc.

**Neuf tables créées :** `joursFeries`, `services`, `rubriquesPaie`, `rattachements`, `fonctions`,
`modelesActes`, `actes`, `retenuesMedecins`, `tickets`.

**Champs ajoutés, par lot :**

| Lot | Champs |
|---|---|
| R1 | `employes` : serviceId, sexe, enfants[], groupeRisqueAt · `absences` : anneeReference, joursOuvrables, dateRetour, observation, commentaire, remplaçant, congeSupp* |
| R2 | `baremes` : transportTaxable, atmpPlafonne, cfcPatronalEtFneSurBrut, seuilExoneration, groupeRisqueAtmp · `saisiesMensuelles` : 9 primes du DIPE + ancienneteSeparee |
| R2 bis | `parametresEntreprise.societes` · `societe` devenue optionnelle sur saisiesMensuelles, primesCharges, envois |
| R5 | `absences` : 7 nouveaux types, justificatifFourni, evenementFamilial, rangMois |
| R7 | `employes` : **salaireBase**, immatriculeImpots, dateEntreeCnps |
| R9 | `baremes` : tdlBareme, ravBareme |
| R10 | `employes` : methodeEnvoi |
| R11 | `parametresEntreprise` : dirigeant, registreCommerce · `parametresEntreprise.societes[]` : dirigeant, registreCommerce |
| R4 | `baremes` : allocationPlafondMois, allocationMoisAvantPremierConge, allocationConventionFraction |
| N1 | `joursFeries` : origine **`decrete`**, champ **motif** |
| N2 | `employes` : **contratRenouvele** · `parametresEntreprise.reglages` : les 3 seuils de rappel |

### 3.2 Les deux migrations, dans CET ordre

```
1.  employes:migrerSalaireBase
2.  employes:migrerRattachements
```

**L'ordre n'est pas une préférence.** Le renommage `salaireBrut` → `salaireBase` se déroule en
trois temps :

1. pousser le schéma avec les **deux** champs en optionnel — état actuel de `rh` ;
2. lancer `employes:migrerSalaireBase`, qui recopie l'un dans l'autre et rend un compte rendu ;
3. **seulement ensuite**, retirer `salaireBrut` du schéma.

Inverser 1 et 3 fait **rejeter par Convex les fiches déjà en base**. Tout le code lit via
`lib/paie.salaireDeBase()`, donc les deux états fonctionnent pendant la transition.

`employes:migrerRattachements` crée une ligne de rattachement par fiche. Sans elle, rien ne casse —
`employes.societe` continue de faire foi — mais le multi-société reste inactif.

### 3.3 Les deux initialisations, APRÈS les migrations

Depuis les bandeaux de l'écran **Planning annuel** :

1. le **calendrier des jours fériés** de l'année ;
2. les **services**.

⚠️ Sans le calendrier, **la pose d'un congé est refusée**, et c'est voulu : un décompte sans jours
fériés serait faux. C'est un défaut de paramétrage, pas un bug à contourner.

### 3.4 Le cycle de branches

```
rh  →  dev  →  validation en recette  →  clean
```

**Jamais directement sur `clean`.** Et avant tout déploiement de `rh` : reporter `clean` sur `rh`,
sans quoi la branche arrive sans `convex deploy` dans son build, avec le repli Convex codé en dur
et sans l'`ErrorBoundary`.

---

## 4. Deux changements de comportement à annoncer

Ils sont corrects et voulus. Mais si personne ne les annonce, ils passeront pour des régressions.

### 4.1 Les en-têtes de DIPE vont changer

`parametresEntreprise.societes` existait depuis R2 bis et `dipe.declarantPourSociete` **le lisait
déjà** — mais aucune mutation ne l'écrivait, et aucun écran ne l'éditait. Le bloc restait donc vide,
et **chaque DIPE retombait sur l'identité de l'entreprise** au lieu de celle de la société
déclarante.

C'est corrigé (R11). Conséquence : **dès que la RH renseignera une identité propre à SESAME, SOFINA
ou SGC, les en-têtes de leurs DIPE changeront.** C'est le comportement attendu depuis R2 bis ; il ne
l'était simplement plus.

### 4.2 Les congés se comptent désormais en jours OUVRABLES

Annoncé en commentaire depuis R0, effectif depuis R4. Le planning comptait en ouvrables, la paie en
**calendaires** : un congé de 18 jours ouvrables s'étale sur 21 à 23 jours calendaires, donc la paie
retirait trop de jours travaillés.

La bascule est **conditionnée au calendrier des fériés** : présent → ouvrables ; absent → calendaire,
comme avant. C'est délibéré, pour qu'un mois déjà **clos** ne soit pas rejoué avec une règle
postérieure.

---

## 5. Trois correctifs qui changent des montants

À connaître, parce qu'ils produiront des écarts avec les chiffres d'avant.

| | Avant | Après |
|---|---|---|
| **Plancher de 62 000** | un salarié à 62 000 pile était **taxé** (`<`) | il est **exonéré** (`<=`). Précision de la RH : « 62 000 n'est pas taxable, ça commence à 62 001 » |
| **Augmentation d'ancienneté** | `ancienneteSeparee` entrait dans les **quatre** assiettes, donc l'augmentation comptait **deux fois** | elle est purement **indicative** et ne compte nulle part. Sur l'exemple de la RH, le brut valait 4 000 au lieu de 3 000 |
| **Congé principal** | aucun plafond : 70 mois de service donnaient **105 jours** | écrêté à 16 mois, soit **24 jours** |

⚠️ **Un écart assumé, et figé par un test.** Nos allocations de congé différeront de son DIPE d'août
2026 de **248, 349 et 263 FCFA** sur trois lignes. Le facteur de 0,1636 % n'a jamais été expliqué ;
la Direction a tranché le 05/11 d'appliquer la règle énoncée sans l'attendre. **Ce n'est pas une
régression** — un test l'écrit en dur précisément pour que personne ne le prenne pour telle. Voir
`A-VERIFIER` **R-3a** et **R-5**.

---

## 6. À renseigner avant le premier usage

| Où | Quoi | Pourquoi |
|---|---|---|
| Paramètres → Entreprise | **N° registre du commerce** : `RC/DLA/2008/B/2361` | Ses modèles Word en portaient **deux** contradictoires. Sans cette valeur, les contrats impriment des pointillés — visible, donc jamais faux en silence |
| Paramètres → Entreprise | **Dirigeant** | Signe les contrats et le certificat de fin de stage |
| Paramètres → Entreprise | **Identité par société** (facultatif) | Chaque société a son dirigeant et son RC. Vide = on reprend l'entreprise, et le repli est signalé |
| Planning annuel | **Calendrier des fériés** + **services** | Bloquant pour la pose d'un congé |
| Écran Actes | bouton **« Charger les modèles »** | Copie les 13 modèles en base pour que la RH puisse les corriger seule |

---

## 7. ⚠️ Dix suites de tests échappent au CI

`.gitlab-ci.yml` vit sur `dev` et sa liste s'arrête aux suites qui existaient lors du passage à 17.
Elle ignore :

```
test:actes      test:allocation   test:anciennete   test:echeances   test:identite
test:immat      test:recalcul     test:retenue      test:tickets     test:vuerh
```

Soit **539 vérifications non gardées**, sur 1 041. **À ajouter au pipeline lors du report de `rh`
vers `dev`.** Je n'ai pas touché à `.gitlab-ci.yml` : il n'est pas sur cette branche.

---

## 8. Autres points techniques

**`convex/_generated/api.d.ts` a été complété à la main** sur `rh`, comme le prévoit la règle n°2.
`npx convex dev` le régénérera, et **c'est la régénération qui fait foi** — si une entrée écrite à
la main diverge, elle disparaît sans conséquence.

**`vite.config.ts` déclare `server.fs.allow`** depuis le 05/11. Dans un `git worktree`,
`node_modules` est souvent un **lien** vers celui du dépôt principal ; le serveur de dev résolvait le
lien puis refusait le chemin réel, hors racine. Les polices répondaient 404 et les colonnes de
chiffres se décalaient. Inoffensif sur les branches où `node_modules` est réel.

**Un système de notification est en cours d'implémentation ailleurs.** Décision du 06/11 : aucun
courriel ne partira du module de tickets — « le courriel c'est trop formel ». Le point de jonction
est `tickets.ouvrir`, qui connaît déjà ses destinataires par leurs **droits**
(`/tickets/arbitrage`, `/tickets/traitement`) et non par une liste de noms. Voir **N5-a**.

---

## 9. Données nominatives — règle absolue

Le dossier `modele/` contient les **noms, salaires et situations de famille de 78 personnes**. Il est
exclu par `.git/info/exclude` et **ne doit jamais être versionné, ni copié dans un déploiement, ni
joint à un rapport.** Toute la documentation du chantier désigne les personnes par leur numéro de
ligne de DIPE ou par service + date — jamais par leur nom.

---

## 10. Où lire la suite

| Fichier | Contenu |
|---|---|
| `ETAT-DU-PROJET.md` | feuille de route R0 → R11 et note de déploiement d'origine |
| `app/docs/rh/A-VERIFIER.md` | **le registre** : toutes les décisions avec leur date, et les points encore ouverts |
| `app/docs/rh/PROPOSITION-INTEGRATION-NOV.md` | les 32 demandes de novembre et leur traitement |
| `app/ANALYSE-RH-CONGES-IMPOT.md` | le décodage des deux classeurs de la RH, les quatre assiettes |
| `app/CONSIGNES-MULTI-AGENTS.md` | les règles de travail à deux agents — **la règle n°2 vous concerne** |

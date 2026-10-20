# Calibration du décompte des congés sur le planning réel de la RH

> Lot R0, 20/10/2026. Compte rendu de la confrontation entre l'algorithme de
> `convex/lib/congesOuvrables.ts` et les 78 lignes du classeur
> `MODELE PLANNING CONGE ANNUEL.xlsx` (exercice 2026).
>
> Les données nominatives ne sont **pas** reproduites ici : seuls les numéros de ligne du classeur
> et les triplets (date de départ, total de congé, date de retour) sont utilisés. Le classeur
> lui-même n'est pas versionné (`.gitignore`).

## Méthode

Le planning ne contient **aucune formule** : la colonne `DATE DE RETOUR` est tapée à la main. Il
s'agissait donc de retrouver, par rétro-ingénierie, la règle que la responsable RH applique de
tête, puis de mesurer sur combien de lignes elle se vérifie.

Règle testée :

> décompte en jours ouvrables, du lundi au samedi, dimanches exclus ; les jours fériés chômés ne
> sont pas décomptés ; la date de retour est le premier jour ouvrable suivant le dernier jour de
> congé.

Sur 78 lignes, **61 sont exploitables** (départ, total et retour tous renseignés).

## Résultat principal : la forme de la règle est confirmée, la liste des fériés ne l'est pas

Trois jeux de jours fériés ont été testés sur les 56 lignes matériellement cohérentes :

| Jeu de fériés testé | Lignes reproduites au jour près |
|---|---|
| **Les 6 fériés à date fixe seulement** | **48 / 56 — 86 %** |
| Aucun férié (dimanches seuls) | 42 / 56 — 75 % |
| Tous les fériés, y compris pascaux et musulmans | 39 / 56 — 70 % |

**Conclusion : elle décompte les fériés à date fixe, mais pas les fériés mobiles**
(Vendredi Saint, Ascension, Aïd el-Fitr, Aïd el-Adha). Quatre lignes indépendantes (13, 15, 18, 22)
le montrent sur le seul Vendredi Saint 2026, dont la date — 3 avril — est mathématiquement
certaine.

> ### ✅ Tranché le 20/10/2026
> Décision du propriétaire : « considère ces différents jours comme tels, mais ce sera
> configurable au niveau du barème. » **Tous les fériés listés sont donc chômés par défaut**,
> chaque date restant décochable. L'écart constaté dans le classeur 2026 était donc une erreur de
> pratique, et non une règle d'entreprise.
>
> Conséquence assumée : **10 lignes du planning 2026 voient leur date de retour décalée d'un
> jour** (lignes 13, 15, 16, 18, 22, 26, 27, 28, 29, 30), et le taux de reproduction du classeur
> passe de 48/56 à **43/56**. Ce n'est pas une régression de l'algorithme : c'est le classeur qui
> s'écarte de la règle désormais confirmée. À noter que la **ligne 29 devient juste**.
>
> Les deux Aïd restent **à saisir à la main** : ils ne sont pas calculables.

D'où la décision d'architecture : **la liste des jours fériés est une donnée d'entreprise
(table `joursFeries`), jamais une constante du moteur.** Chaque férié porte un drapeau `chome`
qui permet de l'inscrire au calendrier sans le décompter.

## La ligne qui prouve que les fériés entrent bien dans le décompte

Ligne 9 — départ le jeudi 05/02/2026, 24 jours de congé, retour saisi le **06/03/2026**.

- Sans exclure aucun férié, l'algorithme tombe sur le **05/03**.
- En excluant le **11 février (Fête de la Jeunesse)**, il tombe sur le **06/03**. ✅

C'est le test d'acceptation le plus parlant du lot, et il est dans la suite
(`tests/congesOuvrables.test.ts`).

## Les 5 lignes matériellement impossibles

Ces lignes sont **fausses dans le classeur** et aucun algorithme ne peut les reproduire. Elles sont
détectées par `controlerLigne()`.

| Ligne | Départ | Total | Retour saisi | Problème |
|---|---|---|---|---|
| 10 | 2026-02-10 | 22 j | **2025**-03-09 | retour antérieur au départ — année erronée |
| 58 | 2026-08-10 | 24 j | 2026-**07**-08 | retour antérieur au départ — mois erroné |
| 59 | 2026-08-06 | 24 j | 2026-**07**-04 | retour antérieur au départ — mois erroné |
| 14 | 2026-03-09 | 24 j | 2026-06-06 | 89 jours calendaires pour 24 jours de congé |
| 34 | 2026-06-08 | 18 j | 2026-**09**-29 | 113 jours calendaires pour 18 jours de congé |

Les lignes 14 et 34 peuvent aussi relever d'un fractionnement ou d'un report non tracé — la colonne
« observation » qu'elle réclame servirait précisément à les expliquer.

## Les 8 lignes qui résistent encore

Mesuré avec les fériés fixes seuls — c'est-à-dire **la configuration qui épouse le mieux son
classeur**, et non la règle finalement retenue. Sous la règle retenue (fériés pascaux chômés), la
ligne 29 devient juste et les lignes 13, 15, 16, 18, 22, 26, 27, 28, 30 s'écartent d'un jour de
plus : c'est le prix assumé de l'alignement sur la loi.

| Ligne | Départ | Total | Elle | Calculé | Écart | Férié fixe dans la période |
|---|---|---|---|---|---|---|
| 7 | 2026-01-14 | 18 | 2026-02-05 | 2026-02-04 | −1 | aucun |
| 37 | 2026-06-22 | 22 | 2026-07-18 | 2026-07-17 | −1 | aucun |
| 21 | 2026-04-13 | 24 | 2026-05-11 | 2026-05-12 | +1 | 1ᵉʳ mai |
| 23 | 2026-04-10 | 20 | 2026-05-06 | 2026-05-05 | −1 | 1ᵉʳ mai |
| 26 | 2026-05-11 | 18 | 2026-06-01 | 2026-06-02 | +1 | 20 mai |
| 27 | 2026-05-04 | 18 | 2026-05-25 | 2026-05-26 | +1 | 20 mai |
| 28 | 2026-05-04 | 20 | 2026-05-27 | 2026-05-28 | +1 | 20 mai |
| 29 | 2026-05-04 | 18 | 2026-05-27 | 2026-05-26 | −1 | 20 mai |

### Ces écarts ne cachent aucune règle : ils sont contradictoires

Deux constats suffisent à le démontrer :

1. **Les lignes 27 et 29 ont exactement les mêmes entrées** — départ 2026-05-04, total 18 jours —
   et **deux dates de retour différentes** dans le classeur : 25/05 et 27/05. **Aucune fonction
   déterministe ne peut satisfaire les deux.**
2. Les lignes 21 et 23 encadrent toutes les deux le 1ᵉʳ mai, et pourtant l'une suppose que le férié
   est décompté et l'autre qu'il ne l'est pas (écarts +1 et −1).

Les lignes 7 et 37 n'ont **aucun férié** dans leur période et présentent tout de même un écart d'un
jour : il s'agit d'un jour accordé en plus, ou d'une erreur de comptage.

### Une hypothèse écartée

La légende de son planning contient le fragment ambigu « … pour chaque enfant âgé au plus de 6 ans
**1 jour le jour du départ en congé** ». J'ai testé l'hypothèse d'un **jour supplémentaire offert le
jour du départ** :

| Jeu de fériés | sans jour offert | avec 1 jour offert |
|---|---|---|
| fériés fixes | **48 / 56** | 4 / 56 |
| tous les fériés | 39 / 56 | 3 / 56 |
| aucun férié | 42 / 56 | 12 / 56 |

L'hypothèse est **clairement fausse**. La lecture juridique initiale est donc la bonne : l'art. 90
du Code du travail apprécie l'âge des enfants **au jour du départ en congé** — c'est une date
d'appréciation, pas un jour de congé en plus. Implémenté comme tel dans `droitConge()`.

## Vérification de la règle du congé supplémentaire

Les quatre totaux observés dans son planning — **18, 20, 22, 24** — sont exactement ceux que produit
la règle de l'art. 90 appliquée à un congé principal de 18 jours :

| Ancienneté | Tranches de 5 ans | Majoration | Total |
|---|---|---|---|
| < 5 ans | 0 | 0 | **18** |
| 5 à 9 ans | 1 | +2 | **20** |
| 10 à 14 ans | 2 | +4 | **22** |
| 15 à 19 ans | 3 | +6 | **24** |

Et les totaux de **26 jours** (lignes 43 et 45) s'obtiennent par le cumul ancienneté + majoration
mère de famille (18 + 6 + 2), ce que le Code autorise explicitement. La règle qu'elle applique est
donc bien celle de la loi — elle la calcule simplement à la main.

## Ce qu'il faut lui demander

La question des fériés est **tranchée** (voir l'encadré plus haut) : tous les fériés listés sont
chômés, configurables au barème. Restent, formulées avec des repères identifiables dans le
classeur plutôt qu'avec des numéros de ligne :

| Repère (service + départ + total) | Question |
|---|---|
| PARAMETRES, 09/03/2026, 24 j, retour 06/06/2026 | 89 jours calendaires pour 24 j de congé : fractionnement, report, ou faute de frappe ? |
| PARAMETRES, 08/06/2026, 18 j, retour 29/09/2026 | 113 jours calendaires pour 18 j : le mois 09 au lieu de 06 ? |
| LABORATOIRE, 10/02/2026, 22 j, retour 09/03/**2025** | année 2025 au lieu de 2026 ? |
| PARAMETRES, 10/08/2026, 24 j, retour 08/07/2026 | retour **avant** le départ |
| SECRETARIAT, 06/08/2026, 24 j, retour 04/07/2026 | retour **avant** le départ |
| HOSPI, 04/05/2026, 18 j, retour 25/05 **et** GREEN ENERGY, 04/05/2026, 18 j, retour 27/05 | mêmes entrées, deux retours : lequel est le bon ? |
| CAISSE PHCIE, 14/01/2026, 18 j, retour 05/02/2026 | aucun férié dans la période et un jour d'écart : un jour accordé en plus ? |
| HOSPI, 22/06/2026, 22 j, retour 18/07/2026 | même cas que le précédent |

Les cinq premières lignes sont **matériellement impossibles** : à corriger à la source, aucun
calcul ne peut les reproduire. Les trois dernières diront s'il reste une règle à comprendre.

## État du lot R0

| Livrable | État |
|---|---|
| `convex/lib/joursFeriesCameroun.ts` — fériés fixes, comput de Pâques, fériés à saisir | ✅ |
| `convex/lib/congesOuvrables.ts` — décompte, date de retour, ventilation par mois, droit annuel, contrôle de ligne | ✅ |
| `convex/schema.ts` — table `joursFeries` (indexée par date et par année) | ✅ |
| `convex/joursFeries.ts` — liste, initialisation d'année, enregistrement, suppression, jours ouvrables du mois | ✅ |
| `tests/congesOuvrables.test.ts` — **79 vérifications** : les 48 lignes réelles en configuration « fériés fixes », les 10 décalages de la règle retenue, le comput de Pâques | ✅ `npm run test:conges` |
| `npm run typecheck` et `tsc -p convex/tsconfig.json` | ✅ |
| Aucune régression sur `test:paie`, `test:droits`, `test:tresorerie`, `test:fenetre` | ✅ |

**Rien n'est encore branché sur la paie** : `lib/absences.ts` continue de compter en jours
calendaires et reste la source des bulletins. La bascule est le lot R4, qui attend l'arbitrage sur
l'allocation de congé.

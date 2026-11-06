# Registre des points à vérifier — module RH

> Branche `rh`. Tenu à jour au fil des réponses de la RH, du comptable et de la Direction.
> **Règle : rien de ce qui est listé ici n'est codé en dur avant réponse.** Chaque point indique
> ce qu'il bloque, pour qu'on sache ce qui peut avancer en attendant.
>
>
> Dernière mise à jour : **05/11/2026**, après la séance de questions avec la responsable RH.
> Les réponses recueillies sont consignées en tête, section **R**.
>
> **Plus aucun point ne bloque.** Les quatre dernières questions de la séance ont été arbitrées
> par la Direction le 05/11/2026 — voir **R-5**. Le lot **R4** est ouvert, le lot **R6** aussi.
>
> **Correctifs appliqués :** **R-2a** (l'augmentation d'ancienneté ne compte plus deux fois),
> **R-2b** (le plancher de 62 000 est inclusif). **R-2c est abandonné** : les assiettes des
> indemnités restent celles de son fichier.
>
>
>
> **Reste à construire, sans attendre personne :** **N2** (alertes d'échéance CDD), **N3**
> (signature électronique) et **N5** (module de tickets), plus l'en-tête PDF de R11. **N1 et N4
> sont livrés le 06/11/2026** ; R10 est complet. **R-6a est tranché** (les deux textes divergent volontairement) ; **R-6b** (la
> 1re ligne de D1 se corrige au 07/04) est à appliquer lors de la reprise du planning.

## R. Réponses de la RH et de la Direction — séance du 05/11/2026

> Recueillies en direct avec la responsable RH, à partir du questionnaire publié le 05/11/2026.
> Verbatim conservé dans ce registre ; les décisions sont reportées dans les points A/B/D/M/T
> correspondants.

### R-1 🟢 Ce qui est tranché et ne demande plus rien

| Point | Décision | Conséquence pour le code |
|---|---|---|
| **A3** | La base de l'allocation reste **salaire de base + ancienneté**, comme aujourd'hui | aucune — pratique confirmée contre la lecture plus large de l'art. 73 |
| **A5** | Le « −1 » des totaux **ne sera pas reproduit** | aucune — il ne l'était pas |
| **B5** | La clinique relève du **groupe A**, risque faible, **1,75 %** | aucune — valeur déjà appliquée |
| **B6** | Assiette AT/MP **non plafonnée** | aucune — la loi était déjà suivie, l'interrupteur `atmpPlafonne` reste pour mémoire |
| **B7** | Base du CFC : **on garde l'existant** (salarial sur le taxable, patronal sur le brut) | aucune |
| **B9** | La TDL est assise sur le **salaire de base** | aucune — `baremeInf(tableTdl, salaireBase)` le fait déjà |
| **B10** | L'allocation de congé **est** soumise à l'IRPP et à la CNPS | aucune |
| **D1** | Les cinq corrections proposées **sont justes** : ce sont des erreurs de frappe sur le mois | l'import du planning 2026 est débloqué |
| **M1** | Le taux des médecins est **le taux + les centimes additionnels** → **5,5 %** et **11 %** | ouvre R6 |
| **M2** | Les 30 % sur la part espèces sont une **règle figée** | ouvre R6 — une constante, pas un paramètre daté |
| **T1** | Le bon numéro est **`RC/DLA/2008/B/2361`**. Le NIU est celui de la clinique | à saisir dans *Paramètres* ; celui de l'engagement à l'essai était faux |
| **X1** | « Clôturer et générer bulletin du mois » : **RAS, consigne supprimée** | retirer la demande du registre |
| **B11** | Exonération « jeunes de moins de 35 ans » : **à vérifier plus tard**, mise de côté | aucune |

### R-2 🟢 Trois défauts de code révélés par les réponses — deux corrigés, un abandonné

Ces trois points n'étaient pas des questions : ce sont des écarts que les réponses mettent au jour.

#### R-2a 🟢 `ancienneteSeparee` comptait DEUX FOIS l'augmentation — **corrigé le 05/11/2026**

**Sa réponse (A6), verbatim :** « *Il n'y a qu'une prime d'ancienneté. […] Il y a une prime
d'ancienneté de base (disons 2 000 F), la nouvelle année son montant peut être de 3 000 F, cela
veut dire que 1 000 F s'ajoutent à la prime existante, donc dans la case nouvelle ancienneté on va
mettre 1 000 F et ce sera juste à titre indicatif ; c'est le 3 000 global qui sera finalement
considéré. C'est donc juste pour une visibilité de la somme ajoutée.* »

La seconde colonne n'est donc **pas** une seconde prime : c'est **l'incrément de l'année**, affiché
pour mémoire. Le montant qui compte est le global.

Or la rubrique 66117 est aujourd'hui déclarée dans **toutes** les assiettes :

```ts
r("66117", "Ancienneté (colonne distincte)", 35, true, true, true, true, false),
//                                      dansBrut ↑  brutInter ↑  cotisable ↑  allocConge ↑
```

Sur son exemple, le brut compterait **3 000 + 1 000 = 4 000** au lieu de 3 000. L'incrément est
compté deux fois, et il se propage au taxable, au cotisable et à l'allocation.

**Corrigé.** La rubrique 66117 porte désormais un drapeau explicite `indicatif: true` et sort des
quatre assiettes ; elle est aussi retirée du `total1` de `computeBulletin`, qui était une somme
écrite à la main et ne passait pas par le catalogue. Elle **reste visible** sur le bulletin et dans
le détail des assiettes — c'est bien son rôle.

Le drapeau est explicite plutôt que quatre `false` silencieux : sans lui, une rubrique hors de
toutes les assiettes ressemble à un oubli, et le prochain lecteur la « corrige » en la remettant
dans le brut — recréant exactement le double comptage.

Deux libellés corrigés, parce qu'ils portaient l'erreur d'interprétation :

| Où | Avant | Après |
|---|---|---|
| catalogue + bulletin | « Ancienneté (colonne distincte) » | « Augmentation d'ancienneté (indicatif) » |
| écran de saisie (`recap/commun.tsx`) | `anciennete` = « Ancienneté (primes fixes) » · `ancienneteSeparee` = « **Ancienneté** » | `anciennete` = « Ancienneté (montant total) » · `ancienneteSeparee` = « Dont augmentation (indicatif) » |

⚠️ Ce second changement n'est pas cosmétique. Avant la correction, les deux cases étaient sommées :
une saisie dans la mauvaise case restait dans le brut. Désormais, **saisir le montant global dans
la case indicative le ferait disparaître du brut**. Le libellé devait donc lever tout doute.

Le test décisif ajouté : renseigner la case indicative ou non **ne change pas un seul chiffre** du
bulletin — ni brut, ni net, ni IRPP, ni CNPS, ni charges patronales.

A6 est tranché, et le dernier point de R10 est débloqué.

#### R-2b 🟢 Le plancher de 62 000 taxait un salaire qui ne doit pas l'être — **corrigé le 05/11/2026**

**Sa réponse (B8) :** « *on reste sur ce qui est et ça commence à 62 001 F. **62 000 n'est pas
taxable**.* »

Le moteur écrit :

```ts
const exonereSalarial = brutTaxable < seuil;   // seuil = 62 000
```

À **exactement 62 000**, `62000 < 62000` est faux : le salarié est **taxé**. Il faut `<=`.

**Corrigé.** La comparaison est passée à `brutTaxable <= seuil`, et la borne est testée **des deux
côtés** : à 62 000 pile le salarié est exonéré et ses retenues fiscales sont nulles ; à 62 001 il
est taxé et la TDL de 250 est due. C'est le seul endroit où un `<` au lieu d'un `<=` se voit.

#### R-2c ⬜ Les primes « hors assiette » — **abandonné le 05/11/2026**

**Sa réponse (B3 · B4) :** « *toutes ces indemnités sont taxables.* »

Cela renverse ce que faisait son propre fichier, et donc ce que nous avions reproduit :

| Élément | Traitement actuel (son fichier) | Décision du 05/11 |
|---|---|---|
| Indemnité de logement | taxée sur `min(15 % du brut ; versé)` | **taxable en entier** |
| Panier, salissure, lait, outillage, représentation, usage de véhicule | dans le brut, dans **aucune** autre assiette | **taxables** |

C'est le changement d'assiette le plus large de la séance. Il augmente le taxable, donc l'IRPP, le
CAC, le CFC salarial, la TDL et la RAV de tous les salariés qui perçoivent ces primes.

**Décision du 05/11/2026 : on ne change rien.** « *Reste sur ce qui est dans le fichier concernant
cet aspect-ci.* » Les assiettes du logement et des primes de panier, salissure, lait, outillage,
représentation et usage de véhicule restent **exactement** celles de son classeur.

La clé est une précision de la Direction : « **taxable, ce n'est pas imposable** ». Son
« toutes ces indemnités sont taxables » ne voulait pas dire « à mettre dans l'assiette de l'IRPP ».
Ces éléments entrent dans le **brut** — ils sont bien de la rémunération — mais dans aucune assiette
de retenue, ce qui est précisément le comportement déjà codé.

Le changement d'assiette le plus large de la séance **n'a donc pas lieu**, et aucune nouvelle
version de barème n'est nécessaire.

### R-3 🟢 Quatre réponses qui ne concordaient pas avec les données — **toutes arbitrées** (voir R-5)

Rien ici n'est un reproche : ce sont des endroits où la réponse et le classeur se contredisent, et
où coder l'une ou l'autre donne des montants différents.

#### R-3a 🟢 L'arrondi n'explique pas l'écart de l'allocation (A1 · A2)

**Sa réponse :** « *C'est un arrondi au franc inférieur pour les nombres < 5 et supérieur pour les
nombres > 5.* » — soit l'arrondi au franc le plus proche, la règle habituelle.

Cet arrondi ne peut pas produire les écarts observés&nbsp;:

| Ligne | Écart constaté | Rapport à l'erreur maximale d'un arrondi (0,5 FCFA) |
|---|---|---|
| 8 | 248 FCFA | **× 496** |
| 17 | 349 FCFA | **× 698** |
| 18 | 263 FCFA | **× 526** |

L'arrondi explique bien une chose : pourquoi les trois rapports ne sont pas identiques à la
huitième décimale (0,9983638 / 0,9983666 / 0,9983593). Mais le facteur lui-même — 0,1636 % — vient
d'ailleurs.

**Arbitré le 05/11/2026 : on n'attend plus ces dates.** Le calcul suit la règle énoncée, et l'écart
de 0,1636 % avec son DIPE d'août reste inexpliqué — c'est une conséquence acceptée, pas un défaut.
Voir **R-5**. **R4 n'est plus bloqué.**

#### R-3b 🟢 Le plafond est-il de 15 ou de 16 mois ? → **16** (R4)

**Sa réponse :** « *Le congé principal vaut 1,5 j/mois sans dépasser 15 mois, c'est-à-dire qu'au
bout du 15e mois le système n'additionne plus, donc ça limite à 22,5 j, donc 23 jours.* »

Les données disent 16, pas 15 :

| | N | Allocation calculée | Droit en jours |
|---|---|---|---|
| plafond à 15 mois | 15,00 | 142 151 | 22,5 → 23 j |
| **plafond à 16 mois** | **16,00** | **151 628** | **24 j** |
| N observé, ligne 8 | 15,9738 | 151 380 | 24 j |

Deux faits s'y opposent :

1. **La ligne 16 du DIPE a un rapport de 1,0000 exactement**, donc N = 16,00 pile. Un plafond à
   15 mois donnerait 15/16 = 0,9375, jamais 1,0000.
2. **Son planning comporte des lignes à 24 jours** (PARAMETRES, SECRETARIAT) et **aucune à 23**.
   Or 1,5 × 16 = 24, et 1,5 × 15 = 22,5.

**À trancher :** 15 ou 16 mois. L'écart est d'un jour et demi de congé, et de 9 477 FCFA
d'allocation sur la ligne 8.

#### R-3c 🟢 Le premier congé s'ouvre à 12 ou à 24 mois ? → **24** (R4)

**Sa réponse, verbatim :** « *un employé n'a droit aux congés qu'après **2 ans**. C'est à partir de
ce délai que la formule commence à s'appliquer. donc le congé commence à être calculé après sa
**première année**.* »

Les deux moitiés de la phrase ne disent pas la même chose, et la différence est d'une année entière
de droits.

**Notre lecture — à confirmer :** l'acquisition commence après la première année, et le premier
congé se prend à deux ans. Soit 12 mois d'acquisition × 1,5 = **18 jours au premier congé**. Cela
expliquerait élégamment d'où vient le 18 de sa formule.

⚠️ Mais cela contredit **son propre modèle de contrat**, que nous avons transcrit mot pour mot :
« *L'employé(e) a droit à un congé de 1,5 jour ouvrable par mois de service effectif. Il/elle ne
pourra bénéficier du congé qu'au terme de **12 mois** consécutifs de service effectif.* » — et
l'art. 89 du Code du travail dit la même chose.

**À trancher :** si le premier congé s'ouvre réellement à 24 mois, les trois contrats de travail
doivent être corrigés, car ils promettent 12.

#### R-3d 🟢 Le Vendredi Saint → **il est férié et ne se décompte pas** (E1 bis · D1)

**Sa réponse :** « *les fêtes pascales, Vendredi Saint, jeudi de l'Ascension, l'Aïd et le mouton
sont considérés comme des jours fériés. Sur le plan légal ces journées le sont également.* »

Si le Vendredi Saint ne se décompte pas, la première ligne de D1 doit revenir le **07/04/2026**.
Or elle a validé notre correction au **06/04/2026** — qui n'est juste que si le Vendredi Saint
**est** décompté.

| Hypothèse | Retour calculé | Correspond à son jour inscrit (06) |
|---|---|---|
| fériés fixes seuls | 06/04/2026 | **oui** |
| fériés fixes + fêtes pascales | 07/04/2026 | non |

**À trancher :** un jour, sur une ligne — mais la règle s'applique à tous les congés qui enjambent
Pâques ou l'Ascension, chaque année.

### R-7 🟢 Un férié décrété recule le retour de PLUS d'un jour — constaté le 06/11/2026

Découvert en écrivant N1, et contre-intuitif : **ajouter un seul jour férié au milieu d'un congé
peut reculer la date de retour de deux ou trois jours calendaires.**

Sur un congé de 18 jours ouvrables partant le lundi 9 mars 2026 :

| Calendrier | Dernier jour | Retour | Décalage |
|---|---|---|---|
| sans décret | samedi 28 mars | lundi 30 mars | — |
| + 1 férié le 18/03 | lundi 30 mars | mardi 31 mars | **+2 jours** |
| + 2 fériés (18 et 24/03) | mardi 31 mars | mercredi 1er avril | **+3 jours** |

La raison : le congé devait finir un samedi. Il lui faut un jour ouvrable de plus, mais le dimanche
n'en est pas un — la fin saute donc au lundi. Et le rapport n'est pas constant : le second férié
n'ajoute qu'un jour calendaire au premier.

**Conséquence pour l'écran :** afficher le seul écart (« +2 j ») serait trompeur. L'écran montre
donc **l'avant et l'après de chaque date**, et le droit en jours ouvrables à côté — qui, lui, ne
bouge jamais. C'est la combinaison des deux qui dit la vérité.

---

### R-5 🟢 Arbitrages de la Direction — 05/11/2026, après confrontation aux données

Les quatre points de **R-3** ont été tranchés par la Direction, en connaissance des contradictions
relevées. Consigne explicite : « *pour les 2 dates, il ne faut pas s'y fier désormais, utilise les
valeurs que je t'ai données pour trancher* ».

| Point | Arbitrage | Conséquence assumée |
|---|---|---|
| **R-3a** | On **n'attend plus** les deux dates du DIPE d'août. Le calcul suit la règle énoncée : arrondi au franc le plus proche, et le modèle ci-dessous | Nos montants **différeront de son DIPE d'août de 248, 349 et 263 FCFA** sur les lignes 8, 17 et 18. Ce n'est pas un défaut : c'est la conséquence de la décision. Le facteur de 0,1636 % restera inexpliqué, et c'est accepté |
| **R-3b** | Le plafond est de **16 mois**, pas 15 | Confirme les données : la ligne 16 a un rapport de 1,0000 (N = 16,00 pile), et son planning porte des lignes à 24 jours (1,5 × 16), aucune à 23 |
| **R-3c** | Le premier congé s'ouvre **après 24 mois** | ⚠️ Les **trois contrats de travail** promettent « 12 mois consécutifs » : leur article des congés devra être corrigé, sinon les actes délivrés contrediront la règle appliquée. Voir **R-6** |
| **R-3d** | Les fêtes pascales, le Vendredi Saint, l'Ascension, l'Aïd et le mouton **sont des jours fériés** et ne se décomptent pas | ⚠️ La première ligne de **D1** se corrige donc au **07/04/2026**, et non au 06/04 validé en séance — l'écart d'un jour venait précisément du Vendredi Saint. Voir **R-6** |

#### Le modèle de calcul retenu

```
droit en jours     = 1,5 × min(N ; 16)              →  plafonné à 24 jours
allocation         = arrondi( N × (salaire de base + ancienneté) ÷ 16 )
premier congé      = à l'issue de 24 mois de service
```

où **N** est le nombre de mois et fractions de mois de la période de référence, qui court du retour
du congé précédent à la veille du nouveau départ (décret n°75/28).

#### La fraction de mois : convention retenue par défaut, et réversible

Aucune réponse n'a fixé la façon de convertir des jours en fraction de mois. Quatre conventions
donnent quatre montants (voir **R-3a**), et il faut bien en choisir une pour écrire le code.

**Retenu : mois entiers + (jours restants ÷ nombre de jours du mois entamé).** C'est la lecture
littérale de « fractions de mois » du décret, et la seule qui n'introduit aucun diviseur arbitraire.

Le choix est porté par un **paramètre du barème daté**, à trois valeurs — `jours_du_mois` (défaut),
`trente`, `trente_virgule_44` — pour qu'un changement d'avis ne demande ni intervention technique
ni recalcul des mois déjà clos. **À confirmer** quand l'occasion se présentera ; rien n'attend.

### R-6 🟡 Deux conséquences nées des arbitrages — une tranchée, une à appliquer

Ces deux points ne sont pas des questions : ce sont des travaux que les arbitrages rendent
nécessaires.

#### R-6a 🟢 Les trois contrats promettent 12 mois, la règle en applique 24 — **laissé tel quel le 05/11/2026**

L'article des congés, transcrit mot pour mot de ses modèles Word et partagé par le CDD, le CDI et
l'engagement à l'essai, dit :

> *L'employé(e) a droit à un congé de 1,5 jour ouvrable par mois de service effectif. Il/elle ne
> pourra bénéficier du congé qu'au terme de **12 mois** consécutifs de service effectif.*

L'arbitrage **R-3c** fixe le premier congé à **24 mois**. Un contrat délivré aujourd'hui
contredirait donc la règle appliquée en paie — et c'est le contrat qui engage la clinique.

**Décision de la Direction, après avoir été informée de l'écart : on ne change rien.**
« *Il n'y a pas de souci à ce niveau, laisse tel quel. Ne modifie ni le contrat ni la règle.* »

Les deux textes coexistent donc volontairement : le **contrat** continue d'annoncer 12 mois
consécutifs — ce qui est la lettre de l'art. 89 — et la **règle de paie** ouvre le premier congé à
24 mois. `ART_CONGES` dans `lib/actes.ts` et `REGLES_DROIT_DEFAUT.moisAvantJouissance` restent
inchangés.

⚠️ Ce point est consigné ici **pour qu'il ne soit pas « corrigé » par inadvertance** : un futur
lecteur qui remarquerait la divergence pourrait croire à un oubli et aligner l'un sur l'autre. Ce
n'en est pas un, c'est un arbitrage.

#### R-6b — la première ligne de D1 se corrige au 07/04, non au 06/04

| | Retour calculé | |
|---|---|---|
| fériés fixes seuls | 06/04/2026 | la valeur validée en séance |
| **fériés fixes + fêtes pascales** | **07/04/2026** | **la valeur conforme à l'arbitrage R-3d** |

Les quatre autres corrections de **D1** ne sont pas touchées : aucune fête pascale ne tombe dans
leur période. **À faire :** retenir le 07/04/2026 à l'import, et le signaler lors de la reprise du
planning.

---

### R-4 🟡 Cinq fonctionnalités nouvelles demandées pendant la séance

Aucune n'était au programme. Elles sont consignées ici et non chiffrées.

| # | Demande | Ce qu'elle implique |
|---|---|---|
| **N1** ✅ | **Fériés décrétés en cours d'année.** « *les jours fériés décrétés au cours de l'année pour une raison ou une autre augmentent ou décalent la date initialement prévue […] il faut donc que la RH puisse ajouter des fériés justifiés en cas de besoin* » | La table `joursFeries` existe déjà et est datée. Il manque l'écran d'ajout et le motif obligatoire. **Tranché le 05/11/2026 : un congé déjà posé se décale AUTOMATIQUEMENT.** Le recalcul doit donc remonter sur les congés en cours et à venir, et laisser une trace de ce qu'il a déplacé — un retour qui bouge sans explication serait pire que pas de recalcul. Résout **D2** |
| **N2** | **Alertes d'échéance de CDD.** Durée max **6 mois renouvelable une fois**. Rappels configurables, par défaut : 1 rappel à 1 mois, 1 par semaine le dernier mois, 1 par jour la dernière semaine | Tâches planifiées + préférences de rappel. Complète **T3** |
| **N3** | **Signature électronique.** « *nous aimerions que la signature se fasse via la plateforme […] permettre aux utilisateurs d'enregistrer cela sur la plateforme et de pouvoir l'apposer au besoin* » | Chaque utilisateur enregistre sa signature (image), qui s'apposerait sur les actes. Touche la valeur probante des documents : à cadrer avant de coder. Répond à **T6** |
| **N4** ✅ | **Le certificat de fin de stage doit pouvoir être signé par la RH** | ✅ Livré le 06/11/2026. Signataire au choix, et la QUALITÉ inscrite sur l'acte suit : un acte signé par la RH ne peut pas annoncer « Directeur Général » |
| **N5** | **Module de tickets.** Un membre ouvre un ticket décrivant un dysfonctionnement ou un besoin, avec **images ou captures**. Il part à **deux destinataires** : le Directeur (qui valide la pertinence) et le développeur | Nouveau module : table, écran, pièces jointes, deux destinataires, états. Répond à **X2** |

---

## Légende

| Statut | Sens |
|---|---|
| 🔴 | bloque un lot — à obtenir avant de coder |
| 🟠 | n'empêche pas d'avancer, mais la valeur retenue devra être confirmée avant mise en production |
| 🟢 | tranché — conservé ici pour mémoire et pour la traçabilité de la décision |

---

## A. Facteurs numériques inexpliqués (issus de la rétro-ingénierie des fichiers)

### A1 🔴 Le facteur 0,9984 de l'allocation de congé
Trois lignes du DIPE d'août 2026 donnent `allocation ÷ (salaire + ancienneté)` = **0,9984**, de
façon **identique** alors qu'il s'agit de trois salariés différents (lignes 8, 17, 18). Une
quatrième ligne (16) donne exactement **1,0000**.

| Ligne | Base pleine | Ancienneté | S + A | Allocation | Rapport |
|---|---|---|---|---|---|
| 16 | 131 250 | 47 067 | 178 317 | 178 317 | 1,0000 |
| 8 | 110 000 | 41 628 | 151 628 | 151 380 | 0,9984 |
| 17 | 158 000 | 55 521 | 213 521 | 213 172 | 0,9984 |
| 18 | 118 750 | 41 524 | 160 274 | 160 011 | 0,9984 |

Trois salariés donnant le même rapport, ce n'est pas trois périodes de référence distinctes : c'est
un **facteur systématique**. Écart en valeur : 248, 349 et 263 FCFA, soit ≈ 0,22 % du salaire de
base dans les trois cas. Hypothèses non vérifiées : un salaire de référence antérieur à une
augmentation, un arrondi, une retenue forfaitaire.
**Bloque :** le calcul exact de l'allocation (lot R4). **Qui tranche :** la RH.

> ### 🔎 Piste forte trouvée le 04/11/2026 — ce n'est probablement PAS un facteur
> Le décret n°75/28 dit que pour une période de référence excédant douze mois, l'allocation
> s'obtient en appliquant la fraction au salaire mensuel moyen des douze derniers mois multiplié
> par le **« nombre de mois ET FRACTIONS DE MOIS »** de la période de référence.
>
> Les N non entiers sont donc **normaux** : 15,974 n'est pas un facteur de 0,9984 appliqué à 16,
> c'est une période de référence de 15 mois et 29 jours environ. Trois salariés partageant
> exactement 15,974 ont simplement la même date de retour du congé précédent et la même date de
> départ — courant dans un service où l'on part groupé.
>
> **A1 et A2 se réduisent donc à UNE seule question** : comment la fraction de mois est-elle
> comptée — jours ÷ 30, ÷ 30,44, ou autrement ? Un exemple chiffré sur une ligne suffit.
> Voir `PROPOSITION-INTEGRATION-NOV.md` §3.

### A2 🔴 Comment est déterminé N, le nombre de mois de la période de référence
`allocation = N × (salaire + ancienneté) ÷ 16`. N impliqué : 16,00 / 15,97 / 15,97 / 15,97 / 13,22 /
12,17 selon les lignes. La loi dit que la période court du retour du congé précédent à la veille du
nouveau départ — est-ce ainsi qu'elle le compte, et avec quel arrondi ?
**Bloque :** lot R4. **Qui tranche :** la RH.

### A3 🟠 L'assiette de l'allocation est plus étroite que celle de la loi
Elle retient **salaire de base + ancienneté**. L'art. 73 du Code du travail exclut le transport, le
logement, la représentation, le panier et la salissure, mais **pas** la prime d'assiduité, la prime
de caisse ni la prime de rendement, qui sont des accessoires du salaire. Sa pratique sous-évalue
donc légèrement l'allocation légale.
**Bloque :** rien dans l'immédiat, mais détermine l'assiette `dansAllocConge` du lot R2.
**Qui tranche :** Direction + comptable.

### A4 🟢 L'indemnité de transport à « 15 % du salaire brut » — **c'est un PLAFOND**
**Précisé le 20/10/2026 : « ça peut aller jusqu'à 15 %, mais c'est clairement elle qui décide de
ces montants actuellement. »**

Donc 15 % n'est **pas** une valeur par défaut à appliquer, c'est un **maximum**. Le montant reste
**saisi par la RH**, employé par employé, comme aujourd'hui (d'où les 2,3 % constatés sur la
ligne 9 du DIPE — cohérent, et non contradictoire).

→ Implémentation : garder le transport en **saisie libre**, et afficher un **avertissement non
bloquant** quand le montant dépasse 15 % du salaire brut. Ne jamais pré-remplir à 15 %.

### A5 🟠 Le « −1 » en dur dans les totaux du DIPE
`SUM(AA86:AA91)-1` et `SUM(AH86:AH89)-1` dans le récapitulatif. Quelqu'un a retranché 1 FCFA pour
faire tomber un arrondi. À ne jamais reproduire, mais il faut comprendre quel arrondi posait
problème pour ne pas recréer l'écart.
**Bloque :** rien. **Qui tranche :** la RH.

---

### A8 🟠 Les bornes de l'IRPP sont décalées de 4 FCFA
Les tranches sont stockées en base **mensuelle** : 2 000 000 ÷ 12 = 166 666,67, arrondi à
**166 667**. Le moteur les remultiplie par 12 (`jusqua * 12`), donc la borne réelle de la première
tranche est **2 000 004** et non 2 000 000 — idem pour la troisième (5 000 004).

Conséquence en argent : 4 FCFA d'assiette imposés à 10 % au lieu de 15 %, soit **0,20 FCFA**.
Négligeable, mais réel, et il se verrait dans la Vue RH si on n'y faisait rien — c'est pourquoi
l'affichage arrondit au millier pour restituer les bornes de l'art. 69.

**Correctif propre** : stocker les tranches en base **annuelle** dans le barème, puisque c'est
ainsi que la loi les énonce, et laisser le moteur diviser. Cela demande une migration des versions
déjà enregistrées, donc à faire au prochain changement de barème plutôt qu'isolément.
**Bloque :** rien. **Qui tranche :** personne — c'est une décision technique, à planifier.

## B. Arbitrages fiscaux et sociaux

### B1 🟢 La prime de transport est-elle taxable à l'IRPP ? — **OUI**
**Tranché le 20/10/2026 par le propriétaire : « oui le transport est taxable ».**
Confirme son DIPE, la loi (arrêtés n°003/MTPS/DPS et n°94/MINFI du 01/03/1974 : le transport sort
de l'assiette **CNPS**, pas de l'assiette **IRPP**) et ses notes.

→ **`lib/paie.ts` est donc à corriger** : la ligne `brutTaxable = total1 − transport` est fausse.
Le transport reste exclu de la seule assiette **cotisable**. C'est la correction **C1** du lot R2,
qui change l'IRPP de **tout** l'effectif. **Le lot R2 n'est plus bloqué par ce point.**

### B2 🟢 SESAME dépose-t-elle sa propre déclaration ? — **OUI**
**Tranché le 20/10/2026 : « SESAME déclare de son côté. »**

Il n'y a donc **aucune sous-déclaration** : c'est un cas de **pluri-emploi régulier**, chaque
société étant un employeur distinct qui dépose son propre DIPE et ses propres cotisations CNPS.

→ Modélisation : un employé peut être rattaché à plusieurs sociétés ; **un bulletin par société** ;
chaque DIPE ne reprend que les rémunérations versées par la société déclarante. Le bulletin remis
au salarié par SGC ne porte que la part SGC — ce qui est normal et non un oubli.
**Le multi-société n'est plus bloqué.**

### B3 🟠 L'indemnité de logement : plafonnée au forfait de 15 %, ou taxée en entier ?
Son fichier retient `min(15 % × salaire brut intermédiaire ; indemnité versée)`. Défendable pour un
avantage en nature évalué au forfait, plus discutable pour une indemnité versée en espèces, qui est
en principe taxable intégralement.
**Bloque :** rien. **Qui tranche :** comptable.

### B4 🟠 Les primes de panier, salissure, lait, outillage, représentation, usage de véhicule
Son fichier les met dans le salaire brut mais dans **aucune** autre assiette : ni taxables, ni
cotisables. Cela suppose de les qualifier de **remboursements de frais professionnels**. Lecture
défendable, mais risque de redressement si les montants sont jugés forfaitaires et déguisés.
**Bloque :** rien. **Qui tranche :** comptable.

### B5 🟠 Groupe de risque AT/MP de la clinique
A = 1,75 %, B = 2,50 %, C = 5,00 %. Son fichier **et** notre moteur appliquent 1,75 %. Pour un
établissement de santé, le groupe B ou C est plausible.

→ **Ne bloque plus le lot R2** : le groupe est devenu un champ du barème (`groupeRisqueAtmp`),
à trois valeurs, et le taux en découle. Il reste à dire **lequel** s'applique.
**Bloque :** l'exactitude des charges patronales. **Qui tranche :** RH + CNPS.

### B6 🟠 L'assiette AT/MP est-elle plafonnée ?
Sa note dit « le salaire cotisable ne doit jamais dépasser le plafond ». La loi dit que l'assiette
AT/MP n'est **pas** plafonnée (seuls PVID et prestations familiales le sont, à 750 000). Un seul
salarié dépasse le plafond aujourd'hui, mais c'est une irrégularité structurelle.

→ **Codé en suivant la LOI** (`BAREME_DEFAUT.atmpPlafonne = false`), avec un interrupteur
`atmpPlafonne` dans le barème pour rejouer sa pratique si le comptable le demande. Le choix est
donc réversible sans toucher au code. **Bloque :** rien. **Qui tranche :** comptable.

### B7 🟠 La base exacte du CFC
Les sources disent « montant brut des salaires » sans préciser si les avantages en nature et le
transport y entrent. Son fichier applique le CFC **salarial** au taxable et le CFC **patronal** au
brut — deux bases différentes pour une même taxe.
**Bloque :** rien, le paramètre `baseCfc` reste configurable. **Qui tranche :** comptable.

### B8 🟠 Base et seuil de la RAV
Son fichier applique le barème au **salaire taxable** avec un seuil de première tranche à
**62 000**. Les sources documentent le **salaire brut** et un seuil à **50 000**. Sa note « plancher
à modifier qui commence à 62 000 » tranche le seuil en faveur de 62 000 ; la base reste à confirmer.
**Bloque :** rien. **Qui tranche :** comptable.

### B9 🟠 Barème TDL entre 300 000 et 500 000 de salaire de base
Les tranches intermédiaires n'ont pas pu être confirmées sur le PDF officiel de la DGI. Le
**plafond de 2 500 FCFA/mois** est en revanche certain.
**Bloque :** rien. **Qui tranche :** comptable, sur le PDF impots.cm.

### B10 🟠 L'allocation de congé est-elle soumise à l'IRPP et à la CNPS ?
Forte présomption positive (substitut de salaire), mais aucune source primaire dédiée trouvée. Son
fichier l'intègre dans **toutes** ses assiettes (colonne U du DIPE).
**Bloque :** rien, sa pratique est suivie. **Qui tranche :** comptable / CNPS / DGI.

### B11 🟠 Éligibilité à l'exonération « jeunes de moins de 35 ans » (LF 2026)
Les entreprises recrutant de jeunes diplômés camerounais de moins de 35 ans sont exonérées des
charges fiscales et patronales sur ces salaires — les charges **sociales CNPS restant dues**.
**Bloque :** rien. **Qui tranche :** comptable.

---

## M. Retenue à la source sur les honoraires des médecins (lot R6)

> ⚠️ Ces points s'appelaient C1 et C2 jusqu'au 21/10/2026 : le préfixe entrait en collision avec
> les corrections **C1 à C10** du moteur de paie (lot R2). Renommés **M1/M2** pour lever l'ambiguïté.

### M1 🔴 Le taux de 5 % ou 10 % est-il « tout compris » ?
Faut-il y ajouter les centimes additionnels communaux de 10 %, comme pour l'IRPP des salariés, ou
le taux annoncé est-il définitif ?
**Bloque :** le lot R6. **Qui tranche :** comptable.

### M2 🔴 Les 30 % sur la part espèces : abattement ou base réduite ?
Spécification reçue : la retenue porte sur 100 % du CA généré sur les patients assurés et sur 30 %
du CA généré sur les patients payant en espèces. S'agit-il d'un abattement pour frais
professionnels (donc paramétrable et susceptible d'évoluer) ou d'une règle figée ?
**Bloque :** le lot R6. **Qui tranche :** comptable.

---

## D. Données du planning à corriger à la source

### D1 🔴 Cinq lignes matériellement impossibles
Aucun calcul ne peut les reproduire : il faut les corriger dans le classeur avant l'import.

| Repère (service + départ + total) | Anomalie |
|---|---|
| PARAMETRES, 09/03/2026, 24 j, retour 06/06/2026 | 89 jours calendaires pour 24 jours de congé |
| PARAMETRES, 08/06/2026, 18 j, retour 29/09/2026 | 113 jours pour 18 jours (mois 09 au lieu de 06 ?) |
| LABORATOIRE, 10/02/2026, 22 j, retour 09/03/**2025** | année 2025 au lieu de 2026 |
| PARAMETRES, 10/08/2026, 24 j, retour 08/07/2026 | retour antérieur au départ |
| SECRETARIAT, 06/08/2026, 24 j, retour 04/07/2026 | retour antérieur au départ |

**Bloque :** l'import du planning existant. **Qui tranche :** la RH.

### D2 🟠 Trois lignes qui pourraient cacher une règle
| Repère | Question |
|---|---|
| HOSPI, 04/05/2026, 18 j, retour 25/05 **et** GREEN ENERGY, 04/05/2026, 18 j, retour 27/05 | mêmes entrées, deux retours différents : lequel est le bon ? |
| CAISSE PHCIE, 14/01/2026, 18 j, retour 05/02/2026 | aucun férié dans la période, un jour d'écart : jour accordé en plus ? |
| HOSPI, 22/06/2026, 22 j, retour 18/07/2026 | même cas |

**Bloque :** rien — `controlerLigne()` les signale. **Qui tranche :** la RH.

---

### A6 🟠 Les DEUX anciennetés : quelle est la différence métier ?
Précisé le 21/10/2026 : « il y a une distinction entre l'ancienneté qui se trouve dans les primes
fixes et la nouvelle ancienneté qui a sa colonne bien à part ».

**Implémenté comme deux montants DISTINCTS**, donc sans aucun double comptage :

| Champ | Où | Code de rubrique |
|---|---|---|
| `anciennete` | dans le groupe « Primes fixes / congé » | 66116 « Prime d'ancienneté » |
| `ancienneteSeparee` | sa propre colonne « Ancienneté » | 66117 « Ancienneté (colonne distincte) » |

Les deux sont taxables et cotisables, et chacune compte **une seule fois** dans le Total 1
(vérifié par `npm run test:assiettes`). Le DIPE de la RH ne comporte qu'une seule colonne
d'ancienneté (sa colonne G) : la seconde est donc une notion propre à l'entreprise.
**Ce qui reste à savoir : ce que la seconde représente**, pour lui donner son vrai libellé et
vérifier son régime fiscal. Pour l'instant elle est alignée sur la prime d'ancienneté.
**Bloque :** rien. **Qui tranche :** la RH.

---

### A7 🟢 Le champ « salaire » de la fiche employé — **c'est le salaire de BASE**
Confirmé par la RH, et conforme au moteur : `journalier = salaire ÷ joursBase`, puis
`salaire du mois = journalier × jours travaillés`, et **toutes les primes s'ajoutent par-dessus**.
Y saisir un brut complet compterait chaque prime deux fois, avec une erreur **silencieuse** (les
deux valeurs sont plausibles, aucun contrôle ne peut les distinguer).

→ Renommé partout le 21/10/2026 : champ `salaireBase`, libellés « Salaire de base mensuel »,
« Masse des salaires de base », colonne d'import `salaire_base` (l'ancien `salaire_brut` reste
accepté). `salaireBrut` est conservé en lecture seule le temps de la migration
`employes:migrerSalaireBase`, à retirer du schéma ensuite.

⚠️ **Ne pas confondre** avec le `salaireBrut` de `lib/dipe.ts`, qui désigne l'assiette V (le vrai
salaire brut, primes incluses) et garde son nom à juste titre.

---

## T. Actes RH — libellés et contenu juridique (lot R11)

Points relevés **en transcrivant ses 13 modèles Word**. Aucun ne bloque la génération : les actes
sortent déjà. Mais chacun porte sur le texte d'un document qui engage la Polyclinique, donc aucun
n'a été tranché tout seul.

### T1 🟠 Deux numéros de registre du commerce pour la même société

Ses trois contrats portent le **même NIU** — `M110800026452Z` — mais **deux numéros de registre du
commerce différents** :

| Modèle | N° RC |
|---|---|
| `MODEL ENGAGEMENT A LESSAI.docx` | `RC/DOUALA/2008/B/2014` |
| `MODELE DE CONTRAT DE TRAVAIL CDD.xlsx.docx` | `RC/DLA/2008/B/2361` |
| `MODELE DE CONTRAT DE TRAVAIL CDI.xlsx.docx` | `RC/DLA/2008/B/2361` |

Une société n'a qu'un numéro d'immatriculation : **l'un des deux est faux**, et il figure
aujourd'hui sur des contrats signés. Ce n'est pas qu'une coquille de forme — c'est l'identification
légale de l'employeur dans l'acte.

**Traitement retenu (05/11/2026) : paramétrable par société, et non figé.**

Aucun des deux numéros n'est écrit dans le code. L'identité juridique se saisit dans *Paramètres →
Entreprise & documents*, à deux niveaux :

- un bloc **entreprise** (dirigeant, n° RC), qui sert de valeur par défaut ;
- un bloc **par société** — SESAME, SOFINA, SGC — où chacune porte sa raison sociale, son adresse,
  son NIU, son N° CNPS, son dirigeant et son n° RC.

Un contrat prend l'identité de la **société émettrice** (la société principale du salarié, ou celle
choisie à l'écran pour une embauche), champ par champ, avec repli sur l'entreprise pour ce qui n'est
pas renseigné — et le repli est **signalé**, jamais silencieux. Tant qu'un champ manque partout,
l'acte sort avec des pointillés et l'écran l'annonce **avant** la délivrance.

Ce bloc par société n'était pas seulement absent pour les contrats : `parametresEntreprise.societes`
existait en schéma depuis R2 bis et **le DIPE le lisait déjà**, mais aucune mutation ne l'écrivait.
Toutes les déclarations retombaient donc sur l'identité de l'entreprise. C'est corrigé du même coup.

**Reste à faire :** confirmer le bon numéro auprès du greffe ou sur le dernier extrait RCCM, puis le
saisir — une fois par société concernée. Le code n'attend plus rien.

### T2 🟢 Le CDI a perdu deux articles que le CDD porte — **tranché le 05/11/2026**

Son `CDD` comptait huit articles ; son `CDI` six, et il lui manquait :

- **Des congés** (1,5 jour ouvrable par mois de service effectif, exigible au terme de 12 mois) ;
- **De la protection sociale** (affiliation CNPS — vieillesse, invalidité, décès, allocations
  familiales, AT/MP).

L'omission était accidentelle : le reste du texte est identique mot pour mot, et un CDI ouvre
exactement les mêmes droits qu'un CDD sur ces deux points.

**Décision : les deux articles sont ajoutés au CDI**, qui compte désormais huit articles comme le
CDD, dans le même ordre. Ils ne sont pas recopiés mais **partagés** par les deux modèles — une
correction appliquée d'un seul côté est devenue impossible, et c'est exactement ainsi que son CDI
avait dérivé. Deux tests comparent les deux textes article par article.

*(Sa numérotation est corrigée du même coup : son CDI portait **deux** articles « 5 » — résiliation,
puis dispositions finales.)*

Le « 1,5 jour » reste écrit en clair, et non tiré de `parametresEntreprise.congesParMois` : c'est le
minimum du décret n°75/28, un contrat l'énonce littéralement, et un paramètre vide imprimerait des
pointillés là où un droit doit figurer.

### T3 🟠 La durée du CDD et le plafond légal

Son article 1 écrit « conclu pour une période de **………  an**, renouvelable une fois sous accord des
parties ». Deux questions :

1. **L'unité.** « an » au singulier suggère une durée en années, mais la ligne de pointillés
   accueille aussi bien « 6 mois ». Le champ est donc libre (`Durée du contrat`), avec une aide de
   saisie qui demande de préciser l'unité.
2. **Le plafond.** Le Code du travail (loi n°92/007) encadre la durée du CDD et son
   renouvellement. Si le plafond est de 2 ans renouvelable une fois, une saisie à « 3 ans »
   produirait un contrat irrégulier. **Faut-il que l'application refuse une durée hors plafond ?**

**À faire :** faire préciser le plafond applicable par le comptable ou le conseil, et dire si le
contrôle doit bloquer ou seulement avertir.

### T4 🟡 Le certificat de fin de stage est signé par le Directeur Général

Tous les autres actes portent le visa de la RH (`parametresEntreprise.responsableRH`). Celui-ci
écrit « Je soussigné, ……, **Directeur Général** de la Polyclinique de Poitiers ». Son signataire est
donc tiré de `parametresEntreprise.dirigeant`.

À noter : il **double** l'`ATTESTATION DE FIN DE STAGE`, qui dit la même chose mais est signée par
la RH. Les deux sont livrés — ce sont deux documents distincts dans son classeur.

**À faire :** confirmer que les deux coexistent bien, et que le certificat relève bien de la DG.

### T5 🟡 Deux coquilles non reprises

| Son texte | Repris comme | Pourquoi |
|---|---|---|
| « durant la période du …… **au 30** …………… » | « du {{dateDebutStage}} au {{dateFinStage}} » | le « 30 » est un reste de saisie : la date de fin est un champ comme l'autre |
| « Fait à **douala**, le …… » | « Fait à Douala, le …… » | majuscule, comme partout ailleurs dans son classeur |

**À faire :** rien, sauf si elle tient au libellé d'origine.

### T6 🟡 L'autorisation de stage n'est pas une lettre

C'est la seule **fiche de circuit interne** du lot : des champs en colonne, puis deux cases de visa
manuscrit côte à côte — *Accord du Service des Ressources Humaines* / *Accord de la Direction
Générale*. Elle ne porte donc ni « Fait le » ni signataire unique, et tous ses champs se saisissent
à la main : le stagiaire n'existe pas encore comme employé.

**À faire :** confirmer que cette fiche circule bien sur papier pour recueillir les deux visas (et
non par voie électronique, qui demanderait une autre conception).

---

## E. Points tranchés (mémoire)

| # | Point | Décision | Date |
|---|---|---|---|
| E1 🟢 | Jours fériés décomptés | **Tous** les fériés listés sont chômés par défaut, configurables au niveau du barème. Les deux Aïd restent à saisir (non calculables). Conséquence : 10 retours du planning 2026 décalés d'un jour. | 20/10/2026 |
| E2 🟢 | Plancher d'exonération | **62 000 FCFA**, et non 50 000. S'applique aux retenues **salariales** uniquement (IRPP, CAC, CFC salarial, TDL, RAV) — les charges patronales n'ont **aucun** plancher. | 20/10/2026 |
| E3 🟢 | « Salaire brut intermédiaire » | Nom retenu par la RH pour l'assiette des éléments **entièrement taxables** (ex-« salaire de référence »). | 20/10/2026 |
| E4 🟢 | Définition des assiettes | Appartient au **barème daté** (table `rubriquesPaie` effective-dated, onglet de l'écran `/bareme`), pas à une table figée. | 20/10/2026 |
| E5 🟢 | Congé supplémentaire | **Calculé et proposé** (ancienneté + enfants) mais **surchargeable à la main** avec motif obligatoire. | 20/10/2026 |
| E6 🟢 | Colonne « observation » | Énumération, pas du texte libre : `planifie / en_cours / pris / non_pris / reporte / retraite / solde_au_depart / annule`. **« RAS » = `non_pris`.** | 20/10/2026 |
| E7 🟢 | Bulletin présenté aux impôts | **Deux documents distincts** : le bulletin de paie interne (toutes retenues) et le bulletin / état fiscal (retenues fiscales et sociales seulement). | 20/10/2026 |
| E8 🟢 | Âge des enfants (majoration mère) | Apprécié **au jour du départ en congé** (art. 90). L'hypothèse d'un jour de congé offert le jour du départ est **écartée** par la calibration (4/56 contre 48/56). | 20/10/2026 |
| E9 🟢 | Multi-société | Un employé peut relever de plusieurs sociétés ; **un bulletin par société** ; chaque DIPE ne reprend que les rémunérations de la société déclarante. SESAME déclare de son côté : pluri-emploi régulier. | 20/10/2026 |
| E10 🟢 | Retenue médecins | Hors moteur de paie → module Primes médecins, lot **R6**. Taux 5 % ou 10 % **par médecin**, base = 100 % du CA assurance + 30 % du CA espèces. *(restent M1 et M2)* | 20/10/2026 |
| E11 🟢 | Modèle de planning | Pas d'autre document à venir : le classeur `MODELE PLANNING CONGE ANNUEL.xlsx` est la seule source. | 20/10/2026 |
| E12 🟢 | Données nominatives | Le dossier `modele/` n'est **jamais** versionné (noms, salaires et situations de famille de 78 personnes). | 20/10/2026 |
| E14 🟢 | Identité juridique des contrats | **Paramétrable par société**, pas figée dans le code : chaque société porte son dirigeant et son n° de registre du commerce, avec repli signalé sur l'entreprise. Débloque aussi l'identité déclarante du DIPE, en schéma mort depuis R2 bis. Voir **T1**. | 05/11/2026 |
| E13 🟢 | Articles manquants du CDI | Les articles **« Des congés »** et **« De la protection sociale »** sont **ajoutés** au CDI, qui s'aligne sur le CDD (huit articles). Les deux modèles les **partagent** : plus de divergence possible. Voir **T2**. | 05/11/2026 |

---

## Ce que chaque lot attend

| Lot | Contenu | Bloqué par |
|---|---|---|
| **R0** ✅ | jours fériés + décompte en jours ouvrables | — *(livré)* |
| **R1** | refonte du planning : services, sexe/enfants, statuts, droit calculé, frise, chevauchements | — *(rien ; D1 ne gêne que l'import)* |
| **R2 bis** | multi-société : un bulletin par société, un DIPE par déclarant | — *(B2 tranché)* |
| **R2** ✅ | table `rubriquesPaie` datée + les quatre assiettes + corrections C1→C10 | — *(livré ; reste à renseigner B5, qui n'est plus bloquant)* |
| **R3** ✅ | écran DIPE + export CSV + récapitulatif par destinataire + rapport d'écart typé | — *(livré)* |
| **R4** ✅ | allocation de congé (1/16) + liaison planning → paie en jours ouvrables | — *(livré le 05/11/2026)* |
| **R5** ✅ | absences élargies (maternité, AT/MP, chômage technique, permissions, sans solde, mise à pied, formation syndicale) | — *(livré)* |
| **R6** ✅ | retenue à la source médecins : 5,5 % et 11 %, les 30 % en règle figée | — *(livré le 05/11/2026)* |
| **R7** ✅ | droit à congé proratisé sur l'année (correction du décompte depuis l'embauche) | — *(livré)* |
| **R8** ✅ | immatriculation de l'employé aux impôts : bulletin ou récapitulatif | — *(livré)* |
| **R9** ✅ | vue RH du barème : le calcul expliqué en clair, sur un exemple réel | — *(livré ; A8 reste ouvert, 4 FCFA)* |
| **R10** 🟡 | 32 demandes de novembre : autocomplétion, fonctions, rattachements, dépôt répété | rattachements à la création, « du … au … », routage par ligne, incrément d'ancienneté (**A6**) |
| **R11** 🟡 | générateur d'actes RH : 13 modèles, pré-remplissage depuis le bulletin, référence numérotée, archivage, identité juridique par société | T3 (plafond du CDD), T4, T6 — *(T1 et T2 tranchés ; T1 ne demande plus que la saisie du bon n° RC)* |

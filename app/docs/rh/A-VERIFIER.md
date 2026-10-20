# Registre des points à vérifier — module RH

> Branche `rh`. Tenu à jour au fil des réponses de la RH, du comptable et de la Direction.
> **Règle : rien de ce qui est listé ici n'est codé en dur avant réponse.** Chaque point indique
> ce qu'il bloque, pour qu'on sache ce qui peut avancer en attendant.
>
> Dernière mise à jour : 20/10/2026.

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

## C. Retenue à la source sur les honoraires des médecins (lot R6)

### C1 🔴 Le taux de 5 % ou 10 % est-il « tout compris » ?
Faut-il y ajouter les centimes additionnels communaux de 10 %, comme pour l'IRPP des salariés, ou
le taux annoncé est-il définitif ?
**Bloque :** le lot R6. **Qui tranche :** comptable.

### C2 🔴 Les 30 % sur la part espèces : abattement ou base réduite ?
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
| E10 🟢 | Retenue médecins | Hors moteur de paie → module Primes médecins, lot **R6**. Taux 5 % ou 10 % **par médecin**, base = 100 % du CA assurance + 30 % du CA espèces. *(restent C1 et C2)* | 20/10/2026 |
| E11 🟢 | Modèle de planning | Pas d'autre document à venir : le classeur `MODELE PLANNING CONGE ANNUEL.xlsx` est la seule source. | 20/10/2026 |
| E12 🟢 | Données nominatives | Le dossier `modele/` n'est **jamais** versionné (noms, salaires et situations de famille de 78 personnes). | 20/10/2026 |

---

## Ce que chaque lot attend

| Lot | Contenu | Bloqué par |
|---|---|---|
| **R0** ✅ | jours fériés + décompte en jours ouvrables | — *(livré)* |
| **R1** | refonte du planning : services, sexe/enfants, statuts, droit calculé, frise, chevauchements | — *(rien ; D1 ne gêne que l'import)* |
| **R2 bis** | multi-société : un bulletin par société, un DIPE par déclarant | — *(B2 tranché)* |
| **R2** ✅ | table `rubriquesPaie` datée + les quatre assiettes + corrections C1→C10 | — *(livré ; reste à renseigner B5, qui n'est plus bloquant)* |
| **R3** ✅ | écran DIPE + export CSV + récapitulatif par destinataire + rapport d'écart typé | — *(livré)* |
| **R4** | allocation de congé (1/16) + liaison planning → paie | **A1**, **A2**, A3 |
| **R5** | absences élargies (maternité, AT/MP, chômage technique, permissions) | — |
| **R6** | retenue à la source médecins | **C1**, **C2** |

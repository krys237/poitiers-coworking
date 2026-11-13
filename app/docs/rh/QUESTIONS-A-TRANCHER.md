# Questions à trancher — module RH

> Rédigé le 22/10/2026. Extrait de `A-VERIFIER.md`, reformulé pour être posé tel quel en réunion.
> Chaque question dit **qui répond**, **ce qui est bloqué** tant qu'elle ne l'est pas, et **la forme
> de réponse attendue**. Une réponse vague ne débloque rien : c'est pour ça que la forme attendue
> est précisée à chaque fois.

---

## Pour la RH

### 1. Le facteur 0,9984 de l'allocation de congé — *bloque le lot R4*

Dans le DIPE d'août 2026, trois salariés **différents** donnent exactement le même rapport
`allocation ÷ (salaire de base + ancienneté)` = **0,9984**. Un quatrième donne exactement 1,0000.

| Ligne | Salaire de base | Ancienneté | Somme | Allocation versée | Rapport |
|---|---|---|---|---|---|
| 16 | 131 250 | 47 067 | 178 317 | 178 317 | **1,0000** |
| 8 | 110 000 | 41 628 | 151 628 | 151 380 | **0,9984** |
| 17 | 158 000 | 55 521 | 213 521 | 213 172 | **0,9984** |
| 18 | 118 750 | 41 524 | 160 274 | 160 011 | **0,9984** |

L'écart vaut 248, 349 et 263 FCFA — soit ≈ 0,22 % du salaire de base dans les trois cas. Trois
salariés donnant le même rapport, ce n'est pas trois périodes de référence distinctes : c'est un
**facteur systématique**, dont nous ne connaissons pas l'origine.

**Ce que nous aimerions savoir :** d'où vient cet écart ? Trois pistes à confirmer ou écarter —
un salaire de référence antérieur à une augmentation, un arrondi appliqué à une étape du calcul,
ou une retenue forfaitaire.

**Forme de réponse utile :** reprendre **une** des trois lignes et nous dire, étape par étape,
comment le montant versé a été obtenu. Un exemple chiffré vaut mieux qu'une règle générale.

### 2. Comment est déterminé N, le nombre de mois de la période de référence — *bloque le lot R4*

La formule observée est `allocation = N × (salaire + ancienneté) ÷ 16`. Les lignes du DIPE
impliquent N = 16,00 · 15,97 · 15,97 · 15,97 · 13,22 · 12,17.

Le Code du travail fait courir la période de référence du retour du congé précédent à la veille du
nouveau départ.

**Ce que nous aimerions savoir :** est-ce bien ainsi que la période est comptée en pratique ? Et
avec quel arrondi — au mois entier, au demi-mois, en jours convertis en mois ?

**Forme de réponse utile :** pour un salarié, les deux dates qui bornent sa période de référence,
et le N qui en a été tiré.

### 3. Cinq lignes du planning sont matériellement impossibles — *bloque l'import du planning*

Aucun calcul ne peut les reproduire. Elles doivent être corrigées dans le classeur **avant**
l'import, sinon elles entreront fausses dans l'application.

| Service · départ · total | Anomalie constatée |
|---|---|
| PARAMETRES · 09/03/2026 · 24 j · retour 06/06/2026 | 89 jours calendaires pour 24 jours de congé |
| PARAMETRES · 08/06/2026 · 18 j · retour 29/09/2026 | 113 jours pour 18 jours — mois 09 saisi au lieu de 06 ? |
| LABORATOIRE · 10/02/2026 · 22 j · retour 09/03/**2025** | année 2025 au lieu de 2026 |
| PARAMETRES · 10/08/2026 · 24 j · retour 08/07/2026 | retour antérieur au départ |
| SECRETARIAT · 06/08/2026 · 24 j · retour 04/07/2026 | retour antérieur au départ |

**Forme de réponse utile :** la date corrigée pour chacune des cinq lignes.

### 4. Trois lignes qui pourraient cacher une règle — *ne bloque rien, mais éclaire le calcul*

| Repère | Question |
|---|---|
| HOSPI · 04/05/2026 · 18 j · retour 25/05 **et** GREEN ENERGY · 04/05/2026 · 18 j · retour 27/05 | mêmes entrées, deux retours différents : lequel est juste ? |
| CAISSE PHCIE · 14/01/2026 · 18 j · retour 05/02/2026 | aucun férié dans la période, et pourtant un jour d'écart — un jour accordé en plus ? |
| HOSPI · 22/06/2026 · 22 j · retour 18/07/2026 | même cas |

Si un jour est accordé en plus dans certaines situations, c'est une règle d'entreprise que
l'application doit connaître plutôt que de la traiter comme une anomalie.

---

## Pour le comptable

### 5. Le taux de retenue des médecins est-il « tout compris » ? — *bloque le lot R6*

La retenue à la source sur les honoraires est annoncée à 5 % ou 10 % selon le cas.

**Ce que nous aimerions savoir :** faut-il y ajouter les centimes additionnels communaux de 10 %,
comme pour l'IRPP des salariés, ou le taux annoncé est-il définitif ?

**Forme de réponse utile :** sur un honoraire de 100 000 FCFA, le montant exact à retenir.

### 6. Les 30 % sur la part espèces : abattement ou base figée ? — *bloque le lot R6*

La spécification reçue est : la retenue porte sur 100 % du chiffre d'affaires généré sur les
patients assurés, et sur 30 % de celui généré sur les patients payant en espèces.

**Ce que nous aimerions savoir :** ces 30 % sont-ils un abattement pour frais professionnels — donc
un paramètre susceptible d'évoluer, qu'il faut rendre réglable — ou une règle figée que l'on peut
écrire en dur ?

**Forme de réponse utile :** « paramétrable » ou « figée », et la source si elle est connue.

### 7. L'assiette de l'allocation de congé — *détermine l'assiette `dansAllocConge` du lot R2*

Le fichier de référence retient **salaire de base + ancienneté**. L'article 73 du Code du travail
exclut le transport, le logement, la représentation, le panier et la salissure, mais **pas** la
prime d'assiduité, la prime de caisse ni la prime de rendement, qui sont des accessoires du salaire.

La pratique actuelle sous-évalue donc légèrement l'allocation légale.

**Ce que nous aimerions savoir :** garde-t-on l'assiette actuelle, ou l'élargit-on aux accessoires
du salaire ? C'est un arbitrage Direction + comptable, pas une question technique.

### 8. Groupe de risque AT/MP de la clinique — *à renseigner, ne bloque plus*

Le taux de cotisation accidents du travail / maladies professionnelles dépend du groupe de risque
attribué à l'établissement par la CNPS.

**Forme de réponse utile :** le groupe notifié par la CNPS, ou à défaut le taux appliqué sur les
derniers bordereaux.

---

## Déjà tranché — pour mémoire, à ne pas reposer

| Point | Décision | Date |
|---|---|---|
| Chaque société dépose sa propre déclaration | « SESAME déclare de son côté ». Pluri-emploi régulier : un bulletin par société, un DIPE par déclarant, plafonds et tranches par employeur | 20/10/2026 |
| La prime de transport est taxable à l'IRPP | oui | — |
| L'indemnité de transport à 15 % du salaire brut | c'est un **plafond**, pas un forfait | — |
| Le champ « salaire » de la fiche employé | c'est le salaire de **base** | — |
| Les deux anciennetés | deux montants distincts, aucun double comptage | 21/10/2026 |

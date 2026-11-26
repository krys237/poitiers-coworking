# Cohérence des chiffres dérivés — relevé des écarts

> Audit du **25/11/2026**, demandé par le propriétaire : *« un montant saisi une fois doit afficher
> la même valeur partout. J'audite chaque chaîne et je liste les écarts avant de corriger. »*
>
> **Rien n'est corrigé dans ce document.** Il relève, il chiffre, il classe. Les corrections se
> décident ensuite, une par une.

---

## Le principe de l'audit

Un chiffre est fiable quand **tous les écrans lisent le même calcul**. Chaque endroit qui le
**re-dérive** est un écart en attente — pas forcément un écart aujourd'hui, mais un écart dès que
les deux implémentations cessent d'être identiques.

J'ai donc cherché les re-dérivations, et non les mauvais chiffres. Résultat : **deux** écrans
recalculent de la paie ou de la trésorerie côté client (`recap/commun.tsx`, `Financier.tsx`), et
neuf somment des montants eux-mêmes. Les sommes sont sans risque quand elles portent sur le
résultat du serveur — c'est le cas du tableau de bord, qui additionne `paie.bulletins`. Les
re-dérivations, elles, sont toutes listées ci-dessous.

**Statut** : *actif* = produit un écart visible aujourd'hui · *armé* = le code est en place pour
produire l'écart, il attend une donnée qui n'existe pas encore en production.

---

## É1 · L'allocation de congé — **armé**, deux montants pour le même bulletin

**Où** : `src/pages/recap/commun.tsx:288` (`apercuBulletin`) contre
`convex/lib/calculBulletins.ts:251-266`.

Le serveur calcule l'**allocation légale de congé** et la passe dans `extras.allocationConge`.
`computeBulletin` l'utilise alors **à la place** de la proratisation
(`paie.ts:272` : `extras.allocationConge !== undefined ? … : journalier × congesPris`).

`apercuBulletin`, qui recalcule le bulletin pendant la frappe dans le Récapitulatif, ne passe
**que** `primes` et `charges`. Donc dès qu'un employé a un congé payé dans le mois :

| Onglet | Indemnité de congés affichée |
|---|---|
| **Récapitulatif salaires** (aperçu de saisie) | `journalier × congésPris` |
| **Bulletins du mois**, **Liste des salaires**, **DIPE**, **Archives** | l'allocation légale |

Et les deux **diffèrent réellement** : la passation documente un écart assumé avec le DIPE d'août
2026 de **248, 349 et 263 FCFA** sur trois lignes. La RH verra donc un net pendant qu'elle saisit,
et un autre net sur le bulletin.

**Armé, pas actif** : la production porte **0 absence**. L'écart apparaît au premier congé payé
saisi.

**Correctif** : `apercuBulletin` doit recevoir l'allocation du serveur — elle est déjà dans
`BulletinPeriode.details`. À passer en `extras`, pas à recalculer côté écran : le calcul
d'allocation dépend des mois de service et du calendrier des fériés, qui n'ont rien à faire dans un
aperçu de saisie.

---

## É2 · Le catalogue de rubriques — **armé**, l'aperçu utilise toujours les valeurs par défaut

**Où** : `convex/bareme.ts:15` (`pourPeriode`) contre `convex/lib/calculBulletins.ts:194`.

Le serveur construit son barème ainsi :

```ts
{ ...baremeFromDoc(doc), rubriques: await rubriquesPourPeriode(ctx, periode) }
```

La requête `bareme.pourPeriode`, que l'écran consomme, renvoie le **document brut** — donc **sans
`rubriques`**. Et `computeBulletin` fait `b.rubriques ?? RUBRIQUES_DEFAUT` (`paie.ts:266`).

Conséquence : l'aperçu de saisie calcule **toujours** avec les rubriques par défaut, le bulletin
avec le catalogue de la période. Dès que la RH personnalise une assiette ou un code, les deux
divergent — et c'est une divergence silencieuse, qui ne se voit qu'en comparant deux onglets.

**Armé, pas actif** : `rubriquesPaie` est **vide** en production, donc les deux chemins utilisent
les mêmes valeurs par défaut.

**Correctif** : faire porter les rubriques de la période par `bareme.pourPeriode`, ou faire lire
l'aperçu depuis la même source que le bulletin. La seconde option est la bonne : une seule
description du barème servi à l'écran.

---

## É3 · « Primes & charges » est aveugle au déclarant — **actif**

**Où** : `convex/primes.ts` — **aucune mention de `societe`**, dans les trois directions.

| | Ce qui se passe |
|---|---|
| `ajouter` | n'accepte pas de société → la ligne est écrite sans société → `toutesPourSociete` la rattache au **déclarant principal uniquement** |
| `liste` | regroupe par `employeId` → un multi-déclarant apparaît en **une seule ligne agrégée** |
| le sélecteur (`employesActifs`) | une entrée par employé → **impossible de choisir le déclarant** |

Pourtant `primesCharges.societe` **existe** au schéma (ligne 401) et `calculBulletins` le lit par
couple. Trois endroits décrivent la même donnée, un seul est aveugle.

**Actif** : une prime destinée au second déclarant est impossible à saisir, et toute prime d'un
multi-déclarant part chez le principal sans un mot. C'est une seconde explication possible à
« les chiffres du second déclarant ne sont pas visibles » : ils le sont, mais sur l'autre
déclarant.

**En production** : **1 seule ligne**, sans société. Décision du propriétaire du 25/11 : **la RH la
reprend à la main**, elle seule sait à quel déclarant elle appartient.

**Correctif** : la mutation prend la société, la liste regroupe par couple, le sélecteur propose
« PP1 — SESAME » et « PP1 — SGC ». Une ligne sans société continue d'appartenir au principal : la
règle de compatibilité reste celle de `toutesPourSociete`, inchangée.

---

## É4 · Le grand livre dépend d'un rejeu **manuel** — armé par construction

**Où** : `convex/financier.ts` — `recalculerToutesLesJournees` est une `internalMutation` qu'il
faut lancer **à la main** après tout changement de `lib/tresorerie.ts`.

Le tableau de bord lit les soldes **stockés** (`financier.kpi`). L'écran Financier, lui, les
**recalcule** avec la formule courante (`Financier.tsx:90`). Les deux concordent aujourd'hui — j'ai
vérifié le 24/11 les 40 journées une par une : **0 écart entre le stocké et le rejoué**. Mais ils
ne concordent que parce que le rejeu a été lancé après le changement de modèle du 13/11.

**Rien ne le force.** Le prochain changement de formule réarme l'écart, et le symptôme sera un
tableau de bord qui ne dit pas la même chose que l'écran du grand livre.

**Correctif possible** : faire porter au modèle de soldes un **numéro de version**, stocké sur la
journée. Une journée dont la version diffère de celle du code est signalée à l'écran plutôt que
servie en silence. C'est le même principe que le barème daté — et c'est le seul mécanisme qui
transforme un oubli en avertissement.

---

## É7 · Deux registres de primes, et une prime payée deux fois — **RÉSOLU le 26/11/2026**

Trouvé après la première rédaction de ce document, en répondant à une question du propriétaire :
« l'onglet Primes & retenues sert à quoi ? »

**Le constat.** Il existait DEUX registres de primes et aucun écran ne montrait celui de l'autre :
les **colonnes nommées** de `saisiesMensuelles`, saisies dans le Récapitulatif salaires, et les
**lignes libres** de `primesCharges`, saisies dans l'onglet. Les deux arrivent sur le même
bulletin, par deux chemins — code de rubrique officiel pour les colonnes, code générique `PRIME`
ou `RETENUE` pour les lignes libres.

**Ce que ça a coûté.** PP1 portait 2 500 dans la colonne « prime assiduité » **et** une ligne libre
« Prime d'assiduité » de 2 500. Son bulletin de novembre 2026 sortait deux lignes d'assiduité —
66122 et PRIME — pour un brut de 142 222 au lieu de 139 722 et un net de 128 159 au lieu de
125 969 : **2 190 FCFA de net versés en trop**. Ni l'un ni l'autre écran ne pouvait le montrer.
Ligne retirée le 25/11 par `primes.retirerDoublonsRegistre`, trace au journal sous
`paie_correction`.

**La cause, et c'est elle qui compte.** Le bandeau de l'onglet disait pourtant la bonne règle :
« les primes fixes, le transport, l'assiduité et le logement se saisissent dans le récapitulatif
salaires ». Mais deux lignes plus bas, son autocomplétion proposait **huit libellés dont six
recouvraient une colonne nommée** : Prime de rendement, Prime d'assiduité, Prime de caisse,
Indemnité de logement, Indemnité de représentation, Gratification. **L'écran invitait l'erreur
contre laquelle il prévenait.**

**Une première tentative de correctif, et son échec.** Le 25/11 un avertissement a été posé dans
le formulaire, comparant le libellé tapé aux libellés des colonnes après normalisation. Mesuré
ensuite : il reconnaissait **1 suggestion sur 8**. La colonne s'appelle « Prime assiduité » et la
suggestion « Prime **d'**assiduité » — ce « d » suffisait à les rendre différentes. Il n'aurait pas
attrapé le cas de PP1. **Leçon : une ressemblance de chaînes n'est pas une identité de concept.**

**La résolution.** Décision du propriétaire du 26/11 : **le module est retiré.** « Il cause plus de
problèmes qu'il ne propose de solutions, le récapitulatif salaire nous permet déjà de gérer tout ce
qui est prime et retenue. » Un seul endroit pour saisir ce qui touche un bulletin — ce qui supprime
la classe de bug au lieu de la garder sous surveillance.

Retiré : l'écran, sa route, son entrée de menu, l'entrée `/paie/primes` de `rbac.MODULES`, et les
quatre fonctions publiques du module. Conservé volontairement : la table `primesCharges` et son
chemin dans le moteur, inerte puisque la table est vide, pour qu'une éventuelle ligne ancienne
reste lisible sur son bulletin plutôt que de disparaître en silence.

---

## É5 · Deux notions de « recette » portent le même nom — actif, mais par conception

- `financier.recetteTotale` = **toutes les entrées** de tous les blocs du grand livre ;
- `caisse.chiffreAffaires` = espèces + assurance + TEP, sur les 8 postes du module Caisse.

Les deux sont justes, les deux s'appellent « recette » ou « chiffre d'affaires » à l'écran, et
**elles ne seront jamais égales**. À cela s'ajoute le fait connu que le bloc « Autres prestations »
(**63 237 100** sur la période) compte dans la recette du grand livre et **n'alimente aucun solde**.

**Ce n'est pas un bug** : c'est une ambiguïté de vocabulaire qui a déjà coûté une séance d'analyse
le 12/11. **Correctif : nommer.** « Recette du grand livre » et « Chiffre d'affaires Caisse », avec
une note disant ce que chacune inclut.

---

## É6 · Les compteurs d'« employés » ne comptent pas la même chose — actif

- **Tableau de bord** : `employes.filter(e => e.actif).length` → **88** « employé(s) actif(s) » ;
- **Liste des salaires** : `bulletins.filter(b => b.societe === s).length` par société → **97** au
  total, parce qu'un multi-déclarant produit deux bulletins.

Les deux sont exacts. Mais ils portent le même mot, et un lecteur qui additionne les colonnes de la
Liste des salaires trouve 97 là où le tableau de bord annonce 88.

**Correctif** : nommer ce qui est compté — « 88 fiches », « 97 bulletins ». Aucun calcul à changer.

---

## Ce qui est sain, et vérifié

À ne pas re-auditer :

- **Le tableau de bord additionne le résultat du serveur** (`paie.bulletins`), il ne re-dérive
  rien : masse salariale, net et brut concordent avec Bulletins, Liste des salaires, DIPE et
  Archives **par construction**.
- **Cinq modules traitent correctement le couple (employé, déclarant)** : `payroll`, `dipe`,
  `archives`, `mesBulletins`, `courrier` — tous passent par `bulletinsPourPeriode` ou par
  `cleCouple`.
- **Trois n'en ont pas besoin, volontairement** : `planning` (une absence est un fait de la
  personne, pas de l'employeur), `rubriques` (catalogue daté), `paiePdf` (reçoit des données déjà
  préparées).
- **L'aperçu de trésorerie de `Financier.tsx`** recalcule, mais sur l'ouverture **du serveur** et
  avec la fonction **partagée** `calculerSoldes` : à l'enregistrement, le serveur refait le même
  calcul. Pas d'écart possible sur une journée donnée — voir É4 pour le risque, qui est ailleurs.

---

## Ordre de correction proposé

| | Écart | Statut | Pourquoi ce rang |
|---|---|---|---|
| ✅ | **É3** primes aveugles au déclarant | *corrigé le 25/11* | puis rendu sans objet par le retrait du module (É7) |
| ✅ | **É7** deux registres de primes | *résolu le 26/11* | module retiré — la classe de bug disparaît |
| ✅ | **É1** allocation de congé · **É2** rubriques | *corrigés le 25/11* | l'aperçu reçoit les mêmes ingrédients que le serveur |
| 2 | **É1** allocation de congé | armé | se déclenche au premier congé payé, et touche un net |
| 3 | **É2** catalogue de rubriques | armé | même famille que É1, même correctif de fond : une seule source |
| 4 | **É6** compteurs | actif | trompeur, mais aucun calcul en jeu — du vocabulaire |
| 5 | **É5** deux recettes | actif | idem, du vocabulaire, et une décision de nommage à prendre |
| 6 | **É4** version du modèle de soldes | armé | le plus structurant, le moins urgent |

**É1, É2 et É3 ont le même remède de fond** : l'écran ne doit jamais recalculer ce que le serveur
sait déjà. C'est la troisième fois que ce projet paie cette règle — après les validateurs
désynchronisés et la fiche employé partielle.

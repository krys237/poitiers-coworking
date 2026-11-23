# Rapport de la semaine du 20 au 25 octobre 2026

**Projet** : POITIERS COWORKING — plateforme unifiée d'administration et de paie
**Période couverte** : mardi 20 au dimanche 25 octobre 2026
**Rédigé par** : Christian Gambou

---

## 1. En bref

**29 livraisons versionnées** (22 travaux et 7 fusions), concentrées sur trois jours — du mardi 20
au jeudi 22 au soir.

La semaine a ouvert et presque refermé un chantier qui n'existait pas en début de semaine : **la session
RH**. Les deux fichiers de travail de la responsable RH — le planning des congés annuels et le
modèle de calcul d'impôt — ont été décodés formule par formule, confrontés au droit camerounais, et
transformés en six lots dont **cinq sont livrés**.

Trois résultats dominent :

1. **Le moteur de paie a été corrigé sur dix points**, dont trois qui faussaient réellement les
   déclarations. Le test d'acceptation reproduit désormais une ligne du DIPE de la RH **colonne par
   colonne, à la franc près**.
2. **Un écart de rémunération d'environ 1,6× a été mis au jour sur l'allocation de congé** : la
   pratique de la RH paie 1,27 à 1,67 fois ce que paierait l'application. C'est une dette salariale
   latente, et l'indemnité compensatrice de congé est réclamable sur trois ans.
3. **Le multi-société est devenu réel** : les trois sociétés sont des employeurs juridiquement
   distincts, chacune dépose son propre DIPE. Plusieurs salariés relèvent de deux ou trois d'entre
   elles — un pluri-emploi parfaitement régulier, qui n'était pas modélisé.

En parallèle, la **chaîne de déploiement** a été assainie : chaque branche a désormais son propre
backend isolé, amorcé automatiquement, et une impasse d'amorçage découverte en recette a été fermée.

Le chantier RH est entré en recette le jeudi 22 au soir (fusion `rh` → `dev`).

---

## 2. La session RH

### 2.1 Le point de départ : deux classeurs et une question

La responsable RH travaille sur deux fichiers Excel. Elle parlait « d'une donnée appelée
**l'assiette** » sur laquelle reposeraient tous ses calculs, sans que personne sache de quoi il
s'agissait exactement.

Les deux fichiers ont été ouverts **avec leurs formules**, et non seulement leurs valeurs affichées.
Premier constat : ce sont **le même classeur**. `MODELE DE CALCUL IMPOT.xlsx` contient à la fois
l'onglet du DIPE et l'onglet du planning de congé. Ce n'est pas un hasard : ils sont censés se
parler, et c'est précisément la jointure qui est faite à la main chaque mois.

**La réponse à sa question : il n'y a pas une assiette, il y en a quatre.**

| Son intitulé | Ce que c'est | Ce qu'elle sert à calculer |
|---|---|---|
| Salaire brut | la somme de **toutes** les rubriques de gain | CFC patronal, Fonds National de l'Emploi |
| Salaire brut intermédiaire | les éléments **entièrement** taxables | l'évaluation des avantages en nature |
| Salaire taxable | le précédent + les avantages retenus | **IRPP**, CFC salarial, redevance audiovisuelle |
| Salaire cotisable plafonné | les éléments cotisables, plafonnés à 750 000 | **CNPS** : vieillesse, prestations familiales, accidents du travail |

Et les deux lignes qui expliquent tout le reste :

- **la prime de transport est taxable mais non cotisable** ;
- **l'indemnité de logement est cotisable en entier mais taxable seulement à hauteur de 15 %** du
  salaire brut intermédiaire.

Toute l'automatisation consiste à déclarer, pour chacune des 19 rubriques de paie, à laquelle de ces
quatre assiettes elle appartient. Cette matrice a été reconstituée intégralement depuis ses
formules.

### 2.2 Le travail manuel qu'elle fait chaque mois

Une ligne de son DIPE d'août contient littéralement ceci :

```
Salaire de base      = 110000/30*9      → 33 000
Prime de transport   = 2800/30*9        →    840
Prime d'assiduité    = 2500/30*9        →    750
Indemnité logement   = 2800/30*9        →    840
Congés payés         = 151 380          (tapé à la main)
```

Cette personne a travaillé 9 jours dans le mois. La RH a relevé les dates dans le planning, compté
les jours ouvrables de tête, **tapé une division par 30 dans chaque cellule de prime**, puis calculé
l'allocation de congé à part et collé le résultat en dur. Multiplié par 75 salariés, chaque mois.

C'est cela que l'automatisation remplace.

### 2.3 Une règle de décompte retrouvée, et nulle part écrite

Le planning de congé ne contient **aucune formule** : la colonne « date de retour » est tapée à la
main. La règle a été reconstituée par rétro-ingénierie, puis mesurée sur ses 61 lignes exploitables :

> On décompte en jours ouvrables, du lundi au samedi, **dimanches exclus**, et **jours fériés
> exclus**. La date de retour est le premier jour ouvrable suivant le dernier jour de congé.

La ligne qui le prouve : départ le jeudi 5 février, 24 jours, retour saisi le 6 mars. Sans exclure
le **11 février — la Fête de la Jeunesse** — le calcul tombe sur le 5 mars. Elle tient donc compte
des jours fériés, et cela n'est écrit nulle part.

**Mais son classeur ne peut pas être reproduit intégralement, et ce n'est pas un défaut de
l'algorithme.** Cinq lignes sont **matériellement impossibles** : trois ont une date de retour
*antérieure* au départ, deux affichent 89 et 113 jours calendaires pour 24 et 18 jours de congé. Et
deux lignes ont **exactement les mêmes données d'entrée** — même date de départ, même nombre de
jours — pour **deux dates de retour différentes**. Aucun calcul déterministe ne peut satisfaire les
deux.

Taux de reproduction : **48 lignes sur 56** avec les seuls jours fériés fixes. Le propriétaire a
ensuite tranché que tous les jours fériés devaient compter, ce qui décale dix retours d'un jour —
une conséquence assumée, son classeur s'écartant de la règle qu'elle venait de confirmer.

### 2.4 Les six lots

| Lot | Contenu | État |
|---|---|---|
| **R0** | jours fériés administrables + décompte des congés en jours ouvrables | ✅ livré |
| **R1** | planning annuel, services colorés, détection des services dégarnis | ✅ livré |
| **R2** | les quatre assiettes + dix corrections fiscales | ✅ livré |
| **R2 bis** | multi-société : un bulletin par société, un DIPE par déclarant | ✅ livré |
| **R3** | écran DIPE, exports, **rapport d'écart** | ✅ livré |
| **R4** | allocation de congé selon la règle du 1/16 | ⏸ bloqué — deux inconnues chiffrées |
| **R5** | absences légales élargies | ✅ livré |
| **R6** | retenue à la source sur les honoraires des médecins | à faire — deux questions au comptable |

**R4 a été sauté au profit de R5** en toute connaissance de cause : il dépend de deux inconnues
numériques du DIPE d'août que seule la RH peut lever (voir § 5).

### 2.5 Dix corrections du moteur de paie

Trois d'entre elles faussaient réellement les déclarations.

| # | Correction | Effet |
|---|---|---|
| **C1** | la prime de transport entre dans l'assiette **taxable** ; elle ne sort que du cotisable | change l'IRPP de **tout** l'effectif |
| **C2** | assiette taxable et assiette cotisable enfin **distinctes** | elles étaient confondues |
| **C3** | l'assiette accidents du travail n'est **pas plafonnée**, conformément à la loi | sous-déclaration CNPS corrigée |
| **C4** | CFC patronal et FNE assis sur le **salaire brut** | base erronée corrigée |
| **C5** | taxe de développement local **plafonnée à 2 500 FCFA/mois** | notre barème montait à 4 500 |
| **C6** | le plancher d'exonération de 62 000 ne vaut que pour les retenues **salariales** | « l'employeur paie dès le premier franc » |
| **C7** | avantages en nature évalués au forfait, avec option de plafonnement | mécanisme inexistant |
| **C8** | groupe de risque accidents du travail A / B / C | paramétrable |
| **C9** | exonération « jeunes de moins de 35 ans » de la loi de finances 2026 | nouveau |
| **C10** | redevance audiovisuelle à partir de 62 000 | notre seuil était à 50 000 |

Un constat contre-intuitif mérite d'être relevé : **sur les assiettes et les barèmes forfaitaires,
c'est son tableur qui était juste et notre moteur qui se trompait.** L'inverse est vrai sur l'IRPP :
sa formule est une linéarisation mensuelle qui **sur-impose de 4 à 8 % au-delà de 310 000 FCFA** de
salaire taxable, là où l'application applique le barème annuel exact. Deux salariés sur 76 sont
concernés aujourd'hui.

**Précaution tenue sur toute la ligne** : chaque correction est un interrupteur du barème **daté**,
et son absence rejoue le comportement d'avant. Un mois déjà clôturé reste donc rejouable à
l'identique — c'est vérifié, les cas de référence du directeur redonnent exactement ses chiffres sur
un barème d'époque. **Aucun bulletin passé ne bouge.**

### 2.6 Le test qui vaut la démonstration

Le moteur reproduit une ligne complète du DIPE d'août 2026 :

| Sa colonne | Son fichier | L'application |
|---|---|---|
| Salaire brut | 163 405 | **163 405** |
| Salaire brut intermédiaire | 153 705 | **153 705** |
| Évaluation du logement (15 %) | 23 055,75 | **23 056** |
| Logement retenu | 2 200 | **2 200** |
| Salaire taxable | 155 905 | **155 905** |
| Cotisable plafonné | 153 355 | **153 355** |
| IRPP + CAC | 6 712,81 | **6 713** |
| Cotisations salariales | 17 412,77 | **17 413** |
| Net | 145 992,23 | **145 992** |

Les quatre assiettes tombent **exactement**, le reste à la franc près — elle calcule en décimales,
l'application en entiers FCFA.

### 2.7 Ce que les écrans apportent

**Planning annuel des congés.** Une ligne par salarié, **regroupée par service**. La RH avait
demandé une couleur par service « pour savoir qui dans quel service a déjà un congé » ; sa vraie
préoccupation était de **ne pas vider un service**. L'écran détecte donc les **chevauchements au
sein d'un même service**, avec un seuil réglable de 2 à 5 personnes. Le droit à congé est calculé —
18 jours de base, +2 jours par tranche de 5 ans d'ancienneté, +2 jours par enfant de moins de 6 ans
pour les mères — avec sa justification affichée, et reste **surchargeable à la main avec motif**. La
date de retour n'est plus jamais tapée : la RH saisit la date de départ et le nombre de jours.

*Note technique* : une palette de couleurs n'est fiable que sur 8 teintes, et elle a 10 services.
Le service est donc encodé d'abord par le **regroupement des lignes**, la couleur n'étant qu'un
repère secondaire. Cela tient 10 services sans mentir sur la lisibilité.

**Écran DIPE.** Les colonnes de son classeur, formules corrigées, export en un clic, et un
récapitulatif qui **sépare les retenues du salarié des charges de l'employeur** avec les deux totaux
par destinataire — DGI d'un côté, CNPS de l'autre.

**Rapport d'écart.** On dépose son fichier, et **chaque différence est nommée et justifiée** :
méthode IRPP, assiette du transport, plafond de la TDL, seuil de la RAV, base du CFC, arrondi. C'est
le livrable qui fait accepter l'outil : sans lui, elle verrait des chiffres différents des siens et
conclurait que l'application est fausse. La comparaison tourne **entièrement dans le navigateur** —
son fichier, qui contient les salaires nominatifs de 76 personnes, n'est jamais envoyé au serveur.

### 2.8 Trois défauts de son classeur délibérément non reproduits

1. Sa colonne « Total des Retenues Fiscales » **additionnait les retenues du salarié et les charges
   de l'employeur**. Le total n'avait aucune signification comptable.
2. Ses « Charges Patronales » utilisaient la cotisation vieillesse **salariale** et **oubliaient les
   prestations familiales et les accidents du travail** : le coût employeur était fortement
   sous-évalué.
3. Ses totaux retranchaient **« −1 » en dur** pour faire tomber un arrondi, et certaines sommes
   démarraient à la ligne 67 en oubliant un salarié — la prime de salissure et la prime de panier
   déclarées étaient donc fausses.

À quoi s'ajoutait un **plafond CNPS incohérent selon la ligne** : 500 000 au lieu de 750 000 sur une
dizaine de salariés, par recopie de formule de travers.

### 2.9 Absences légales

Onze types d'absence, chacun portant qui paie et à quel taux, s'il compte comme **service effectif**
(donc s'il acquiert du congé), s'il s'impute sur le congé annuel, son plafond et le justificatif
attendu : maternité 14 semaines à 100 % CNPS, accident du travail aux deux tiers et assimilé à du
service effectif **sans limite**, maladie 6 mois, chômage technique dégressif 50/40/35/30/25/20 %,
permissions familiales plafonnées à 10 jours ouvrables **par an**, mise à pied 8 jours, congé sans
solde, congé de formation syndicale.

Les contrôles **avertissent sans bloquer** : plusieurs plafonds légaux sont prorogeables ou
imputables sur le congé annuel *à la demande du salarié*. L'outil signale, la RH décide.

### 2.10 Précisions appliquées en cours de semaine

**Récapitulatif des salaires** — la colonne « H. sup / ancienneté » est séparée en deux, et
« Acompte / dette / impôts & CNPS » également. Les neuf primes du DIPE absentes de l'écran
(salissure, panier, lait, représentation, véhicule, caisse, rendement, outillage, gratification) ont
été ajoutées. Plutôt que onze colonnes de plus — un tableau illisible — elles rejoignent l'infobulle
éditable « Primes fixes / congé », qui est le mécanisme déjà prévu pour cela. Résultat : **20
colonnes au lieu de 18**, cellules plus aérées, colonne des noms collante à gauche.

**Le champ « salaire » de la fiche employé.** La RH a fait remarquer que ce montant devait être le
**salaire de base**. Vérification faite : le moteur l'utilisait déjà ainsi — toutes les primes
s'ajoutent par-dessus. Le calcul était juste, **seul le nom trompait**, et il invitait à saisir le
brut complet, ce qui aurait compté chaque prime deux fois avec une erreur **silencieuse**. Renommé
partout : champ, libellés, colonne d'import, texte d'aide.

---

## 3. Déploiement, sécurité et exploitation

Travaux menés en parallèle du chantier RH.

### 3.1 Un backend par branche

Une clé de déploiement *preview* crée un déploiement Convex nommé d'après la branche Git et le
réutilise aux pushs suivants. **Chaque branche a donc son backend stable et isolé** — le montage
correct pour la recette, qui supprime le risque que deux branches s'écrasent mutuellement.

Un backend neuf étant vide, l'amorçage (barème, entreprise, effectif de démonstration) est désormais
lancé automatiquement à sa création. La mutation est idempotente, elle peut donc tourner à chaque
push sans effet de bord, et l'option est ignorée en production.

### 3.2 Une impasse d'amorçage fermée

En fermant une fonction d'initialisation la veille, une impasse avait été introduite sur tout
déploiement neuf — constatée en recette. La garde considérait l'amorçage terminé dès qu'un membre
existait ; or le premier membre créé est un compte technique **sans identifiant de connexion**. Un
déploiement fraîchement amorcé avait donc un membre et **aucune porte d'entrée** : la garde exigeait
un directeur authentifié que personne ne pouvait être.

Le test porte maintenant sur les **comptes de connexion** : tant que personne ne peut se connecter,
l'initialisation est ouverte ; elle se referme à la première connexion possible. C'est le vrai signal
de fin d'amorçage, et la production — qui a des comptes — reste fermée exactement comme avant.

### 3.3 Une page blanche rendue diagnosticable

La barrière d'erreur n'était montée qu'autour d'un seul écran. Partout ailleurs, une requête qui
levait pendant le rendu faisait **disparaître l'écran sans un mot** : page blanche, aucune piste, et
au rechargement l'onglet revenait à son défaut, ce qui effaçait jusqu'au symptôme. C'est ainsi qu'un
appel à une fonction absente du déploiement est resté indiagnosticable.

La barrière est désormais posée une seule fois, dans la table des routes : elle couvre tous les
écrans, affiche le message d'erreur et **laisse le menu en place**.

### 3.4 Comptes rendus

La DAF doit rendre **deux comptes rendus par jour**. Le bouton « Nouveau compte rendu » se
transformait en « Modifier » dès le premier dépôt, rendant impossible d'en enchaîner un second sans
écraser le précédent.

Le droit est devenu une **case de la matrice** — « Comptes rendus : plusieurs par jour » — et non un
rôle codé en dur : la Direction peut l'ouvrir à quelqu'un d'autre sans passer par du code. Aucun
changement de schéma n'a été nécessaire : la règle « un par jour » n'était imposée que par un appel
de code.

Les **points de présence sont désormais recalculés** à chaque écriture, avec un invariant : pour un
membre et une date, leur somme ne dépasse jamais 1. L'ordre des dépôts n'a plus d'importance, et la
DAF ne progresse pas deux fois plus vite que ses collègues. Au passage, corriger une faute de frappe
le soir ne fait plus **perdre le point déjà acquis**.

### 3.5 Commandes

Trois défauts révélés par la refonte du registre :

- **la numérotation des références** repartait du nombre de bons existants. Depuis l'ajout de la
  suppression, une année peut comporter des trous, et le compteur **réattribuait une référence déjà
  portée** — deux bons partageaient la même identité sans la moindre erreur. La séquence repart
  désormais de la plus haute référence de l'année ;
- le registre en lecture seule affichait des antécédents qu'il n'aurait pas dû ;
- la soumission d'un bon rejeté échouait sans message.

---

## 4. Chiffres de la semaine

| Indicateur | Valeur |
|---|---|
| Livraisons versionnées | **29** (22 travaux, 7 fusions) |
| Volume du chantier RH | **71 fichiers**, 9 652 lignes ajoutées |
| Suites de tests automatisés | **17** (6 créées cette semaine) |
| Vérifications automatisées ajoutées | **346** |
| Lots RH livrés | **6 sur 8** |
| Corrections du moteur de paie | **10** |
| Rubriques de paie modélisées | **19**, contre 7 auparavant |
| Types d'absence légaux | **11**, contre 4 auparavant |
| Anomalies relevées dans les classeurs de la RH | **18** |

---

## 5. Ce qui reste bloqué, et par qui

Rien n'avance plus sur ces points sans une réponse. Les huit questions sont rédigées pour être
posées telles quelles dans `app/docs/rh/QUESTIONS-A-TRANCHER.md`, chacune avec **qui répond**, **ce
qui est bloqué** et **la forme de réponse qui débloque réellement**.

### Pour la responsable RH

**1. Le facteur 0,9984** — *bloque le lot R4*. Trois salariés **différents** donnent exactement le
même rapport entre l'allocation de congé versée et la somme « salaire de base + ancienneté ». Un
quatrième donne exactement 1,0000. L'écart vaut 248, 349 et 263 FCFA, soit ≈ 0,22 % du salaire de
base dans les trois cas. Trois salariés donnant le même rapport, ce n'est pas trois périodes de
référence distinctes : c'est un **facteur systématique** dont l'origine nous échappe.
*Forme utile* : reprendre **une** ligne et dérouler le calcul étape par étape. Un exemple chiffré
vaut mieux qu'une règle générale.

**2. Comment est déterminé N**, le nombre de mois de la période de référence — *bloque le lot R4*.

**3. Ce que représente la seconde ancienneté.** Son DIPE n'en comporte qu'une ; la seconde est une
notion propre à l'entreprise, aujourd'hui alignée par défaut sur le régime de la prime
d'ancienneté.

**4. Huit lignes du planning** à corriger ou à expliquer — les cinq impossibles et les trois
ambiguës.

### Pour le comptable

**5.** Le taux de 5 % ou 10 % de la retenue médecins est-il « tout compris », ou faut-il y ajouter
les centimes additionnels ? — *bloque R6*
**6.** Les 30 % sur la part espèces : abattement paramétrable ou règle figée ? — *bloque R6*
**7.** Le **groupe de risque accidents du travail** de la clinique : A (1,75 %), B (2,50 %) ou C
(5 %) ? Les deux outils appliquent 1,75 %, or pour un établissement de santé B ou C est plausible.
**8.** Le régime fiscal des primes de panier, salissure, lait et outillage, traitées en
remboursement de frais professionnels.

### Pour la Direction

**L'allocation de congé.** La mesure sur six cas réels :

| | Montant |
|---|---|
| Pratique de la RH | 907 599 FCFA |
| Moteur actuel | 576 874 FCFA |
| **Écart** | **+330 725 FCFA pour six congés** |

Soit un facteur de **1,27 à 1,67×**, stable à ~1,6 sur les quatre salariés les plus anciens. Ces six
cas proviennent d'un seul mois et ne constituent pas un échantillon représentatif, mais le sens de
l'écart ne fait aucun doute : **le moteur sous-paie l'allocation de congé**. C'est une dette
salariale qui se constitue silencieusement, et l'indemnité compensatrice de congé est **réclamable
sur trois ans**.

---

## 6. Risques identifiés

| Risque | Nature | État |
|---|---|---|
| Sous-paiement de l'allocation de congé | dette salariale, prescriptible 3 ans | mesuré, arbitrage attendu |
| Sous-déclaration CNPS sur les accidents du travail | assiette plafonnée à tort | **corrigé** |
| Déclarations d'août faussées | totaux partiels, plafond CNPS incohérent | relevé, à corriger à la source |
| Sur-imposition des salaires élevés | linéarisation de l'IRPP, +4 à +8 % | **corrigé** |
| Amende de 100 000 FCFA non remissible | défaut de déclaration IRPP annuelle (LF 2026) | échéance désormais affichée |
| Continuité du savoir RH | règles implicites dans une seule tête | **documenté et versionné** |
| Coût de la vue superviseur | une requête par membre, sans borne | consigné au backlog avant la montée en effectif |

---

## 7. Point d'organisation

Le travail s'est fait **à deux agents en parallèle**, sur des branches et des répertoires séparés —
`clean` pour le déploiement, `rh` pour la paie et les ressources humaines, `role` pour les rôles. La
table de coordination a été remise à jour et une règle ajoutée : **il n'existe qu'un seul projet
Convex**, et un déploiement pousse tout le dossier `convex/` de la branche d'où il part, schéma
compris. Deux agents qui poussent depuis deux branches s'écrasent donc mutuellement.

La séquence en trois temps du renommage `salaireBrut` → `salaireBase` y est consignée, parce
qu'**inverser l'ordre fait rejeter par Convex les fiches déjà en base**.

Les arbitrages du chantier RH ne vivaient que dans un document de travail. Ils ont été remontés dans
`DECISIONS.md` — le journal des consignes transverses — et la feuille de route R0 → R6 dans
`ETAT-DU-PROJET.md`, pour qu'ils restent lisibles par qui reprendrait le chantier.

Enfin, les classeurs de la responsable RH contiennent les noms, salaires et situations de famille
réels de 78 personnes. Sur décision du propriétaire, **ils ne sont pas versionnés**, et les jeux de
test qui en dérivent sont **anonymisés** : seules les dates et les montants, jamais les noms.

---

## 8. La semaine à venir

1. **Obtenir les huit réponses** du § 5 — c'est le chemin critique : deux lots sur huit en dépendent.
2. **Déployer la branche `rh`** et exercer les écrans contre des données réelles. Rien n'a encore
   tourné en conditions réelles : la garantie actuelle porte sur le typage, la compilation et 346
   vérifications de logique pure.
3. **Lot R4** dès que les deux inconnues chiffrées sont levées.
4. **Lot R6** dès que le comptable a tranché.
5. **Corriger à la source** les cinq lignes impossibles du planning et les totaux partiels du DIPE.

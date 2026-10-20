# Session RH — « Planning congé annuel » & « Modèle de calcul impôt »

> Branche `rh`, 20/10/2026. Compréhension du besoin, proposition d'implémentation et impact métier.
> Le référentiel légal sourcé qui sert de base à ce document est dans
> [`docs/rh/REFERENTIEL-LEGAL-CAMEROUN.md`](docs/rh/REFERENTIEL-LEGAL-CAMEROUN.md).

## Ce que j'ai fait

1. Créé la branche `rh` (depuis `clean`).
2. Décodé **entièrement** les deux classeurs de la responsable RH : toutes les formules, pas
   seulement les valeurs affichées. Les deux fichiers sont **le même classeur** : `MODELE DE CALCUL
   IMPOT.xlsx` contient à la fois l'onglet `dipe IMPOT AOUT 2026` **et** l'onglet
   `planning de congé`. Ce n'est pas un hasard : ils sont censés se parler.
3. Fait rechercher par deux agents le droit applicable (fiscalité/paie et congés/absences,
   Cameroun 2025‑2026), avec sources — d'où le référentiel ci‑dessus.
4. Confronté les trois : **son fichier**, **notre moteur actuel** (`convex/lib/paie.ts`,
   `convex/lib/absences.ts`), **la loi**.

**Résultat principal, et il est contre‑intuitif : sur la question des assiettes et des barèmes
forfaitaires, c'est son tableur qui est juste et notre moteur qui se trompe.** Notre moteur est en
revanche plus juste qu'elle sur le calcul de l'IRPP. Il ne s'agit donc pas de « porter Excel dans
l'application », mais de **fusionner le meilleur des deux**.

---

# Partie 1 — Ce que disent réellement les deux fichiers

## 1.1 « MODELE PLANNING CONGE ANNUEL » — 78 salariés, 10 colonnes, **zéro formule**

| Colonne | Signification (d'après sa propre légende, lignes 87‑97) |
|---|---|
| NOMS ET PRENOMS | l'employé |
| SERVICE | service d'affectation (PARAMETRES, TECHNIQUE, ADMIN, IMAGERIE, HOSPI, LABORATOIRE, CAISSE PHCIE, SECRETARIAT…) |
| CONGE PRINCIPAL | « nombre de jours réglementaires de congé, **18 jours** » |
| CONGE SUPPLEMENTAIRE | « **2 jours par tranche de 5 ans d'ancienneté** ; à ces 2 jours s'ajoutent **2 jours pour les employés féminins pour chaque enfant âgé au plus de 6 ans**, 1 jour le jour du départ en congé » |
| TOTAL CONGE | principal + supplémentaire |
| RAPPEL 2025 | période de congé de l'année précédente ; **« RAS »** = première prise de congé |
| PLANIFICATION 2026 | période planifiée pour l'année en cours |
| DATE DE DEPART | 1ᵉʳ jour de congé **effectif** |
| DATE DE RETOUR | **1ᵉʳ jour de service** après le congé |
| REMPLACANT CONGES | collègue qui assure la vacance ; **« CONTINUITE »** = service où les tâches sont interchangeables |
| *(OBSERVATION, à ajouter)* | « les congés non consommés **qui impactent dans le calcul des jours de travail** » |

### Le point capital : j'ai retrouvé sa règle de décompte, et elle n'est pas écrite

Le fichier ne contient **aucune formule** : `DATE DE RETOUR` est tapée à la main. J'ai reconstruit
la règle en la testant sur ses lignes, et elle tombe juste :

| Employé | Départ | Total congé | Retour (son fichier) | Retour (ma règle) |
|---|---|---|---|---|
| DJUEYA RUPHILE | lun 05/01/2026 | 24 j | 02/02/2026 | ✅ 02/02 |
| NJIKAM EMMANUEL | lun 05/01/2026 | 20 j | 28/01/2026 | ✅ 28/01 |
| DEUMAGA J. GABRIEL | lun 12/01/2026 | 22 j | 06/02/2026 | ✅ 06/02 |
| SIGNE YAMDJEU VANESSA | lun 12/01/2026 | 18 j | 02/02/2026 | ✅ 02/02 |
| FEUSSI NZUMO B. A. | lun 12/10/2026 | 18 j | 02/11/2026 | ✅ 02/11 |
| **LOUONJOU SYLVIE** | **jeu 05/02/2026** | **24 j** | **06/03/2026** | ✅ 06/03 **seulement si le 11 février est exclu** |

La règle est donc :

> **On décompte en jours ouvrables : du lundi au samedi, dimanches exclus, et jours fériés exclus.
> La date de retour est le premier jour ouvrable suivant le dernier jour de congé.**

La dernière ligne est la preuve décisive : sans exclure le **11 février (Fête de la Jeunesse)**, on
tombe sur le 05/03 et non le 06/03. **Elle tient compte des jours fériés dans son décompte.** Ce
n'est écrit nulle part, c'est dans sa tête — et c'est exactement ce qui se perd quand elle part en
congé ou quand quelqu'un reprend le fichier.

Et cette règle est **conforme au Code du travail** (art. 89 : jours ouvrables, semaine de 6 jours
ouvrables, fériés non déductibles du congé).

### Ce qui est faux ou incomplet dans son fichier

- L'année est **écrite en dur dans les en‑têtes** (« RAPPEL 2025 », « PLANIFICATION 2026 ») : sa
  légende dit elle‑même « année à mettre à jour au début de chaque année ». Reprise manuelle
  annuelle de 78 lignes.
- Ligne `DJEUKUI MBIDJOU CHRISTIAN PAULIN` : RAPPEL = **2026**‑11‑03 alors que la colonne est
  « RAPPEL 2025 » → faute de frappe non détectable par le tableur.
- Deux salariés ont `TOTAL CONGE = 0` sans explication, et un a `RAS` en planification.
- La colonne OBSERVATION **n'existe pas encore** : elle la réclame dans sa propre légende, pour
  tracer les congés non consommés.
- Rien ne détecte les **collisions** : plusieurs personnes du même service en congé en même temps.
  Je compte par exemple 4 personnes de services différents parties le 05 ou 06/01, mais rien dans
  l'outil ne l'alerte si deux IMAGERIE partent ensemble.
- Le congé supplémentaire est **saisi à la main** alors qu'il est entièrement calculable
  (ancienneté + enfants).

## 1.2 « MODELE DE CALCUL IMPOT » — c'est un **DIPE**, pas un bulletin

L'onglet `dipe IMPOT AOUT 2026` est le **Document d'Information sur le Personnel Employé** destiné
aux impôts et à la CNPS, pour la POLYCLINIQUE DE POITIERS SARL (NIU `M110800026452Z`, CNPS
`356-0000011-S`, centre CSIPLI‑WOURI). 75 salariés, 45 colonnes, échéance légale : **le 15 du mois
suivant**.

C'est une distinction importante : **son « NET A PAYER » n'est pas le net du bulletin de paie.**
Il ne déduit que les retenues fiscales et sociales — ni acompte, ni sanction, ni dette de soins, ni
mutuelle. Les deux chiffres sont légitimement différents et ne doivent pas être confondus.

### Les 20 rubriques de gain qu'elle utilise

Salaire de base · Prime d'ancienneté · Prime de transport · Prime d'assiduité · Indemnités de
logement · Prime de salissure · Prime de panier · Prime de lait · Indemnités de représentation ·
Indemnité d'usage de motocyclette/véhicule · Prime de caisse · Prime de rendement · Indemnité
d'outillage (×2) · Gratification annuelle · **Congés payés**.

Notre moteur n'en connaît que 7 (base, transport, assiduité, logement, primes fixes, heures sup,
ancienneté) + des lignes libres. **Il manque 9 rubriques nommées**, et surtout il manque la raison
pour laquelle elles sont nommées séparément : *elles n'entrent pas dans les mêmes assiettes*.

## 1.3 **« L'assiette » — la réponse à sa question**

Tu m'as dit qu'elle parlait « d'une donnée appelée l'assiette sur laquelle reposent ces différents
calculs ». Voici la réponse exacte, extraite de ses formules :

> **Il n'y a pas une assiette. Il y en a quatre**, et toute l'automatisation consiste à déclarer,
> pour chaque rubrique de paie, à laquelle de ces quatre elle appartient.

| Assiette (sa colonne) | Formule exacte dans son fichier | Sert à |
|---|---|---|
| **V — Salaire brut** | somme de **toutes** les rubriques de gain | CFC patronal (1,5 %), FNE (1 %) |
| **W — Salaire de référence** | base + ancienneté + transport + assiduité + caisse + rendement + gratification + congés payés | uniquement à évaluer l'avantage logement |
| **Z — Salaire taxable** | `W + Y` où `Y = min(15 % × W ; indemnité de logement)` | **IRPP**, CFC salarial, RAV |
| **AA — Salaire cotisable plafonné** | `min(base + ancienneté + assiduité + logement + caisse + rendement + gratification + congés payés ; 750 000)` | **CNPS** : PVID salarié et patronal, prestations familiales, AT/MP |

### La matrice rubrique × assiette (reconstituée intégralement)

| Rubrique | Brut (V) | Référence (W) | **Taxable (Z)** | **Cotisable (AA)** |
|---|:--:|:--:|:--:|:--:|
| Salaire de base | ✅ | ✅ | ✅ | ✅ |
| Prime d'ancienneté | ✅ | ✅ | ✅ | ✅ |
| **Prime de transport** | ✅ | ✅ | **✅** | **❌** |
| Prime d'assiduité | ✅ | ✅ | ✅ | ✅ |
| **Indemnité de logement** | ✅ | ❌ | **plafonnée à 15 % de W** | **✅ intégrale** |
| Prime de salissure | ✅ | ❌ | ❌ | ❌ |
| Prime de panier | ✅ | ❌ | ❌ | ❌ |
| Prime de lait | ✅ | ❌ | ❌ | ❌ |
| Indemnité de représentation | ✅ | ❌ | ❌ | ❌ |
| Indemnité moto / véhicule | ✅ | ❌ | ❌ | ❌ |
| Prime de caisse | ✅ | ✅ | ✅ | ✅ |
| Prime de rendement | ✅ | ✅ | ✅ | ✅ |
| Indemnité d'outillage | ✅ | ❌ | ❌ | ❌ |
| Gratification annuelle | ✅ | ✅ | ✅ | ✅ |
| **Congés payés (allocation)** | ✅ | ✅ | ✅ | ✅ |

Les deux lignes qui expliquent tout :

- **Le transport est taxable mais non cotisable.** C'est la règle légale (arrêtés n°003/MTPS/DPS et
  n°94/MINFI du 01/03/1974 : le transport sort de l'assiette CNPS ; il reste dans le brut taxable
  IRPP). **Elle l'applique correctement.**
- **Le logement est cotisable en entier mais taxable seulement à hauteur de 15 % du salaire de
  référence.** C'est la mécanique de l'avantage en nature (évaluation forfaitaire à 15 %), qu'elle
  applique en retenant le **minimum** entre le forfait et l'indemnité versée.

Les primes de salissure, panier, lait, représentation, outillage et usage de véhicule sont dans le
brut mais dans **aucune** autre assiette : elles sont traitées en **remboursement de frais
professionnels**, donc ni taxables ni cotisables. Le Code du travail (art. 73) les exclut aussi
explicitement de l'assiette de l'allocation de congé — sa lecture est cohérente, mais c'est le
point n°5 à faire valider par le comptable.

## 1.4 **Le lien entre les deux tableaux — c'est là qu'est le vrai besoin**

La ligne 8 de son DIPE est la pièce à conviction. Elle contient littéralement :

```
Salaire de base      = 110000/30*9      → 33 000
Prime de transport   = 2800/30*9        →    840
Prime d'assiduité    = 2500/30*9        →    750
Indemnité logement   = 2800/30*9        →    840
Prime de salissure   = 5000/30*9        →  1 500
Prime de panier      = 2500/30*9        →    750
Congés payés         = 151 380          (tapé à la main)
```

Autrement dit : cette personne a travaillé **9 jours** dans le mois, elle était en congé le reste
du temps, et la RH a :

1. relevé dans le planning de congé les dates de départ/retour,
2. calculé de tête combien de jours ouvrables tombaient dans le mois d'août,
3. **tapé à la main une division par 30 fois 9 dans chaque cellule de prime**,
4. **calculé à part l'allocation de congé (151 380) et l'a collée en dur.**

Et le tout se répercute en cascade : comme le salaire de base proratisé tombe à 33 000 FCFA (sous
le seuil de 62 000), **la TDL de cette personne passe mécaniquement à 0** pour le mois.

> **C'est ça, « l'automatisation » qu'elle demande** : que le planning de congé alimente
> automatiquement le nombre de jours travaillés et l'allocation de congé du mois, et que toutes les
> assiettes et tous les prélèvements se recalculent en cascade. Aujourd'hui c'est 75 lignes × 20
> rubriques de recopie manuelle, chaque mois, avec un risque d'erreur à chaque cellule.

Au passage : `151 380 = 8 410 × 18` exactement (18 = son congé principal). Son taux journalier de
congé est donc 8 410 FCFA, mais **je ne peux pas reconstituer d'où sort ce 8 410** avec un seul mois
de données — il faudra le lui demander (voir arbitrage n°3).

---

# Partie 2 — Confrontation : son fichier / notre moteur / la loi

C'est la partie à lire en premier. ✅ = conforme à la loi, ⚠️ = à arbitrer, ❌ = erreur à corriger.

| Point | Son fichier Excel | Notre moteur `lib/paie.ts` | La loi | Verdict |
|---|---|---|---|---|
| **Transport dans l'assiette IRPP** | **inclus** ✅ | **exclu** (`brutTaxable = total1 − transport`) ❌ | inclus (taxable) | **notre moteur sous‑impose** |
| Transport dans l'assiette CNPS | exclu ✅ | exclu ✅ | exclu | ok |
| **Avantage en nature logement** | 15 % du salaire de référence, retenu au minimum avec l'indemnité ✅ | **inexistant** — l'indemnité est taxée en entier ❌ | évaluation forfaitaire 15 % | **mécanisme à créer** |
| **Assiette CNPS distincte de l'assiette taxable** | oui ✅ | **non** — `baseCnps = min(brutTaxable, plafond)` ❌ | distinctes | **à séparer** |
| **Plafond assiette AT/MP** | plafonné à 750 000 ❌ | plafonné à 750 000 ❌ | **AUCUN plafond** | **les deux se trompent** |
| Taux PF patronal | 7 % ✅ *(l'en‑tête dit « 8,4 % », la formule dit 7 % — l'en‑tête est faux)* | 7 % ✅ | 7 % | ok |
| Taux PVID | 4,2 % + 4,2 % ✅ | 4,2 % + 4,2 % ✅ | 4,2 % + 4,2 % | ok |
| **Base CFC patronal / FNE** | salaire **brut** ✅ | `brutTaxable` ❌ | salaire brut | **à corriger** |
| **Barème TDL au‑delà de 500 000** | plafonné à 2 500 ✅ | monte à 2 750 / 3 000 / 4 000 / 4 500 ❌ | **plafond 2 500** | **notre barème est faux** |
| Base TDL | salaire de base ✅ | salaire de base ✅ | salaire de base | ok |
| Seuil RAV 1ʳᵉ tranche | 62 000 ⚠️ | 50 000 ⚠️ | 50 000 selon sources ⚠️ | **à arbitrer** |
| Base RAV | salaire taxable ⚠️ | salaire taxable ⚠️ | « salaire brut » ⚠️ | **à arbitrer** |
| Seuil d'exonération 62 000 sur le CFC salarial | appliqué ✅ | **non appliqué** ❌ | 62 000 | à ajouter |
| **Calcul de l'IRPP** | linéarisation mensuelle approchée (seuils 310 000 / 429 000 / 667 000, constantes 16 693 / 29 188 / 70 830) ⚠️ | **calcul annuel exact par tranches** ✅ | barème annuel progressif | **notre moteur est le bon** |
| Abattement 30 % non plafonné + 500 000 forfaitaire unique | ✅ | ✅ | ✅ | ok |
| CAC 10 % de l'IRPP | ✅ | ✅ | ✅ | ok |
| **Décompte des congés** | jours **ouvrables**, dimanches et fériés exclus ✅ | jours **calendaires** (`joursCalendaires`) ❌ | jours ouvrables | **à refaire** |
| **Allocation de congé** | taux journalier × jours (origine du taux inconnue) ⚠️ | `brut/30 × jours pris` ❌ | **1/16 de la rémunération de référence**, soit ÷ **24** | **les deux divergent** |
| **Congé supplémentaire (ancienneté, enfants)** | saisi à la main, règle correcte ✅ | **inexistant** ❌ | art. 90 | **à créer** |
| Acquisition 1,5 j/mois | 18 j/an ✅ | 1,5 j/mois ✅ | 1,5 j/mois | ok |
| **Année de référence / report** | rappel N‑1 + planification N ✅ | cumul **depuis l'embauche, sans jamais se réinitialiser** ❌ | report max 2 ans | **faux pour les anciens** |
| Jours fériés | connus de tête, non écrits ⚠️ | **table inexistante** ❌ | 10 fériés, dates mobiles annuelles | **à créer** |

### Chiffrage de deux des écarts

**L'IRPP.** La formule de son tableur est une linéarisation mensuelle qui suppose que la CNPS vaut
4,2 % du salaire taxable et qui oublie l'abattement dans les tranches hautes. Résultat :

| Salaire taxable | IRPP son fichier | IRPP exact | Écart |
|---|---|---|---|
| ≤ 309 999 | identique au franc | — | **0** |
| 350 000 | 20 893 | 20 072 | +821 (+4,1 %) |
| 500 000 | 41 613 | 38 762 | +2 850 (+7,4 %) |
| 800 000 | 103 415 | 95 392 | +8 023 (+8,4 %) |

Bonne nouvelle : sur l'effectif réel de la clinique (médiane du salaire taxable = 140 330 FCFA),
**seuls 2 salariés sur 76 dépassent 310 000**. L'écart est donc marginal aujourd'hui — mais c'est
une **sur‑retenue** sur les salaires élevés, donc un risque de contentieux salarié, et il grandira
avec l'encadrement.

**L'allocation de congé.** La loi fixe l'allocation à **1/16 de la rémunération de la période de
référence**, ce qui équivaut à un taux journalier de rémunération **÷ 24** (et non ÷ 30). Sur les
75 salaires de référence de son DIPE :

| Méthode | Allocation annuelle totale | Écart vs la loi |
|---|---|---|
| **Loi (1/16)** | **7 766 638 FCFA** | — |
| Notre moteur, 18 j ouvrables × brut/30 | 6 213 310 FCFA | **−1 553 328** |
| Notre moteur, ~21 j calendaires × brut/30 | 7 248 862 FCFA | **−517 776** |

*(ordre de grandeur : l'assiette légale exclut le transport, que la colonne « salaire de référence »
inclut, donc le vrai écart est légèrement inférieur)*

> **Notre moteur sous‑paie l'allocation de congé d'environ 0,5 à 1,5 million de FCFA par an sur
> l'effectif actuel.** C'est le chiffre le plus important de cette analyse : c'est une dette
> salariale qui se constitue silencieusement, et l'indemnité compensatrice de congé est
> **prescriptible à 3 ans**, donc réclamable.

---

# Partie 3 — Les anomalies de son classeur à ne surtout pas reproduire

Je les liste parce qu'elles sont la meilleure justification du projet : ce sont des erreurs
qu'**aucun tableur ne peut détecter** et qu'une application rend structurellement impossibles.

1. **Le plafond CNPS n'est pas le même d'une ligne à l'autre.** Lignes 8 à ~70 :
   `IF(assiette < 750000; assiette; 750000)`. Lignes 78 à 82 :
   `IF(assiette < **500000**; assiette; 750000)`. Pour un salarié de ces dernières lignes dont
   l'assiette est entre 500 000 et 750 000, le tableur retient **750 000** au lieu du réel — donc
   **sur‑cotise**. Formule recopiée de travers, invisible à l'œil nu.
2. **Les totaux ne totalisent pas tout.** `K83 = SUM(K67:K82)` (démarre à la ligne 67 au lieu de 8),
   `L83 = SUM(L69:L82)`, et `W83`, `X83`, `Y83`, `AS83` s'arrêtent à la ligne 81 et **oublient le
   salarié de la ligne 82**. La prime de salissure et la prime de panier déclarées sont donc
   fausses.
3. **Un « −1 » en dur dans les totaux du récapitulatif** : `SUM(AA86:AA91)-1` et
   `SUM(AH86:AH89)-1`. Quelqu'un a retranché 1 FCFA pour faire tomber un arrondi. Ce genre de
   bricolage se transmet d'année en année.
4. **Le « Total des Retenues Fiscales (IMPOTS) » mélange salarial et patronal** :
   `SUM(AD:AI)` additionne l'IRPP, le CFC salarial, la TDL et la RAV (retenues du salarié) **avec**
   le CFC patronal et le FNE (charges de l'employeur). Le total n'a pas de signification comptable.
5. **« Charges Patronales » utilise la PVID salariale** (`AF + AH + AL` au lieu de `AF + AH + AO`).
   Le montant est le même par coïncidence (les deux font 4,2 % de la même assiette) ; la formule
   est fausse et le resterait si les taux divergeaient. Et ce total **oublie les prestations
   familiales (7 %) et l'AT/MP (1,75 %)** : les charges patronales annoncées sont très
   sous‑évaluées.
6. **Trois trous de barème** : `IF(Z>667000; …)` sans branche `sinon` → un salaire taxable
   exactement égal à 667 000 renvoie `FAUX` ; idem `IF(Z>62000)` pour le CFC ; et la RAV n'a
   **aucune valeur au‑delà de 700 000** (cellule vide, donc 0 au lieu de 9 750 à 13 000).
7. **L'en‑tête « AF (8,4 %) » alors que la formule applique 7 %** : l'en‑tête imprimé sur la
   déclaration ne correspond pas au chiffre déclaré.
8. **Deux colonnes portent le même nom** (« Indemnité d'outillage » en R et en S).
9. **Les en‑têtes du planning portent l'année en dur** (« RAPPEL 2025 », « PLANIFICATION 2026 »).
10. **Aucune traçabilité** : pas d'horodatage, pas d'auteur, pas d'historique. Or le registre de
    congés est un **moyen de preuve** opposable à l'inspection du travail.

---

# Partie 4 — Proposition d'implémentation

L'architecture existante est la bonne : moteur pur testable (`convex/lib/*`), barème daté,
recalcul réactif, clôture qui fige. Je ne propose pas de la changer, je propose de **compléter le
modèle de données avec la notion d'assiette** et de **refaire le décompte des congés en jours
ouvrables**.

## 4.1 Le pivot : une table de rubriques portant leur appartenance aux assiettes

C'est la traduction directe de la matrice du §1.3, et c'est la pièce qui manque aujourd'hui. Au
lieu de 7 champs figés dans `saisiesMensuelles`, une **table de rubriques paramétrable** :

```ts
rubriquesPaie: defineTable({
  code: v.string(),            // "66121"
  libelle: v.string(),         // "Prime de transport"
  sens: v.union(v.literal("gain"), v.literal("retenue")),
  ordre: v.number(),           // ordre d'affichage bulletin / colonne DIPE

  // ——— L'APPARTENANCE AUX ASSIETTES : le cœur du sujet ———
  dansBrut: v.boolean(),       // assiette V
  dansReference: v.boolean(),  // assiette W (évaluation des avantages en nature)
  dansTaxable: v.boolean(),    // assiette Z → IRPP, CFC salarial
  dansCotisable: v.boolean(),  // assiette AA → CNPS
  dansAllocConge: v.boolean(), // assiette de l'allocation de congé (art. 73)

  // ——— Comportements ———
  proratisable: v.boolean(),           // suit les jours travaillés (÷ joursBase × jours)
  avantageNature: v.optional(v.object({ // logement 15 %, véhicule 10 %, eau 2 %…
    tauxForfait: v.number(),
    plafonnerAuForfait: v.boolean(),   // la règle min(forfait, indemnité) de la RH
  })),
  actif: v.boolean(),
}).index("by_code", ["code"])
```

Les 20 rubriques de son DIPE sont alors des **données**, pas du code. Ajouter une « prime de
lait » ou changer le régime fiscal d'une prime devient un écran de paramétrage, pas une
modification de `lib/paie.ts`. Et la matrice devient **auditable** : on peut imprimer, pour le
comptable, le tableau « rubrique × assiette » tel qu'il est réellement appliqué.

## 4.2 Le moteur : calculer les quatre assiettes explicitement

`lib/paie.ts` garde sa signature mais expose les assiettes comme des valeurs de premier plan :

```ts
export interface Assiettes {
  brut: number;          // Σ rubriques dansBrut
  reference: number;     // Σ rubriques dansReference
  avantagesNature: number;
  taxable: number;       // reference + avantages retenus
  cotisable: number;     // Σ rubriques dansCotisable
  cotisablePlafonne: number;  // min(cotisable, plafondCnps)   → PVID, PF
  cotisableAtmp: number;      // cotisable NON plafonné        → AT/MP (correctif légal)
  netImposableMensuel: number;
}
```

Corrections à apporter en même temps, toutes couvertes par le référentiel légal :

| # | Correction | Fichier |
|---|---|---|
| C1 | Le transport **entre** dans l'assiette taxable (il n'en sort que pour la CNPS) | `lib/paie.ts` |
| C2 | Assiette CNPS **séparée** de l'assiette taxable | `lib/paie.ts` |
| C3 | **AT/MP sur l'assiette non plafonnée** | `lib/paie.ts`, `bareme.ts` |
| C4 | CFC patronal et FNE sur le **salaire brut** | `lib/paie.ts` |
| C5 | Barème TDL **plafonné à 2 500** FCFA/mois | `TDL_BAREME` |
| C6 | Seuil d'exonération 62 000 appliqué au CFC salarial | `lib/paie.ts` |
| C7 | Avantages en nature : évaluation forfaitaire + option « plafonner au forfait » | `lib/paie.ts` |
| C8 | Groupe de risque AT/MP (A 1,75 / B 2,50 / C 5 %) dans le barème | `bareme.ts`, schéma |
| C9 | Exonération LF 2026 « jeunes < 35 ans » : interrupteur par employé | schéma `employes` |

**Le calcul de l'IRPP n'est pas touché** : celui en place est le bon. En revanche j'ajoute un
**rapport d'écart** (§4.5) pour que la RH voie, ligne par ligne, pourquoi notre chiffre diffère
du sien — sinon elle n'aura aucune confiance dans l'outil.

## 4.3 Le planning de congé : refonte du décompte

Nouveau module pur `lib/congesOuvrables.ts`, et une **table de jours fériés administrable** (les
dates mobiles — Vendredi Saint, Ascension, Aïd — changent chaque année par acte administratif, donc
jamais en constante) :

```ts
joursFeries: defineTable({
  date: v.string(),     // "2026-02-11"
  libelle: v.string(),  // "Fête de la Jeunesse"
  chome: v.boolean(),
}).index("by_date", ["date"])
```

Fonctions :

```ts
estOuvrable(date, feries)                      // ni dimanche, ni férié chômé
compterOuvrables(debut, fin, feries)
dateFinConge(depart, nbJoursOuvrables, feries) // dernier jour de congé
dateRetour(depart, nbJoursOuvrables, feries)   // 1er jour ouvrable suivant → sa colonne
ventilerParMois(depart, retour, feries)        // jours ouvrables de congé par mois → la paie
```

Et le droit à congé **calculé** au lieu d'être saisi :

```ts
droitAnnuel({ dateEmbauche, dateDepart, sexe, enfants, moisServiceEffectif, reglages }) => {
  principal: number,        // 1,5 (ou 2,5 si < 18 ans) × mois de service effectif
  majAnciennete: number,    // 2 j par tranche entière de 5 ans
  majEnfants: number,       // mères : 2 j par enfant < 6 ans AU JOUR DU DÉPART
  total: number,            // arrondi au nombre entier SUPÉRIEUR (décret n°75/28)
  detail: string[],         // justification affichable, pour qu'elle puisse vérifier
}
```

> **Une précision que la loi apporte à sa légende.** Sa note dit : « 2 jours pour les employés
> féminins pour chaque enfant âgé au plus de 6 ans **1 jour le jour du départ en congé** ». Cette
> fin de phrase est ambiguë. L'art. 90 la tranche : l'enfant doit avoir **moins de 6 ans *au jour
> du départ en congé*** — c'est la **date d'appréciation de l'âge**, pas un jour de congé
> supplémentaire. (L'art. 90 prévoit par ailleurs « 1 jour seulement » si le congé principal
> n'excède pas 6 jours, ce qui ne concerne personne chez elle puisque le principal est de 18 j.)
> Il faut le lui confirmer de vive voix : c'est le genre de détail qui change le droit de chaque
> mère de famille de l'effectif.

Enrichissements du modèle, tirés directement de ses colonnes :

```ts
// employes : + sexe, + enfants[{ prenom, dateNaissance }], + service, + groupeRisqueAt
// absences : + anneeReference, + statut (planifie | confirme | en_cours | solde | annule)
//            + remplacantId | "CONTINUITE", + joursOuvrables, + dateRetour, + observation
//            + typeAbsence élargi : conge_paye | maternite | paternite | evenement_familial
//              | maladie | accident_travail | chomage_technique | sans_solde | injustifiee
```

Le **statut** est ce qui remplace ses deux colonnes `PLANIFICATION` et `DATE DE DEPART` : une même
ligne porte le prévisionnel puis l'effectif, et l'`anneeReference` remplace les en‑têtes annuels
écrits en dur. Plus de reprise manuelle au 1ᵉʳ janvier.

## 4.4 L'allocation de congé selon la règle légale

Nouveau module pur `lib/allocationConge.ts` :

```
assiette      = Σ rémunérations de la période de référence, rubriques dansAllocConge
                (exclut transport, logement, représentation, panier, salissure,
                 outillage, allocation du congé précédent — art. 73)
allocation    = assiette × (mineur ? 5/48 : 1/16)
tauxJournalier = allocation / joursDroit        // ≈ rémunération mensuelle / 24
```

Avec **méthode configurable** (`"legal_1_16"` | `"journalier_30"` | `"journalier_24"`) et affichage
systématique des deux chiffres côte à côte le temps de la bascule, parce que :

- c'est un changement qui **augmente la paie** de chaque salarié partant en congé,
- la direction doit décider en connaissance de cause, et la décision doit aller dans `DECISIONS.md`.

## 4.5 Les écrans

| Écran | Contenu | Droit |
|---|---|---|
| **Planning des congés** (refonte) | ses 10 colonnes à l'identique + droit calculé avec sa justification + date de retour calculée + statut + observation. Vue **annuelle par service** (frise 12 mois) avec **détection des chevauchements dans un même service**, et vue liste exportable | RH `voir`/`faire` |
| **Fiche congé d'un salarié** | droit acquis et son détail, historique N‑1/N‑2, solde, report, alerte « droit ouvert depuis > 2 ans » (limite légale de report) | RH |
| **Jours fériés** | table annuelle administrable (les dates mobiles changent chaque année) | niv. 7 |
| **Rubriques de paie** | la matrice rubrique × assiette, éditable, avec aperçu de l'impact | niv. 7 |
| **Récapitulatif salaires** (existant, à étendre) | ajout des colonnes d'assiettes (brut / référence / taxable / cotisable) pour qu'elle retrouve ses repères | RH |
| **DIPE** (nouveau) | les 45 colonnes de son onglet, aux formules corrigées, **export Excel et CSV**, + récapitulatif de bas de page (IRPP, CFC sal, CFC pat, FNE, RAV, TDL) avec séparation **nette** salarial / patronal | RH / comptable |
| **Rapport d'écart** (nouveau) | import de son classeur → comparaison ligne à ligne / colonne à colonne avec notre calcul, et **explication typée** de chaque écart (« assiette CNPS : transport exclu », « IRPP : barème exact vs linéarisé »…) | RH / comptable |

Le **rapport d'écart est le livrable qui fait accepter l'outil.** Sans lui, la RH verra des
chiffres différents des siens et conclura que l'application est fausse. Avec lui, chaque écart est
nommé, justifié par un article, et elle arbitre.

## 4.6 Découpage en lots

| Lot | Contenu | Pourquoi dans cet ordre |
|---|---|---|
| **R0** | Table `joursFeries` + `lib/congesOuvrables.ts` + tests sur ses 78 lignes réelles | Aucun impact sur la paie. On valide d'abord qu'on sait reproduire ses dates de retour au jour près — y compris le cas du 11 février. **C'est le test d'acceptation de tout le reste.** |
| **R1** | Refonte du planning : champs employé (sexe, enfants, service), statuts, droit calculé, écran + frise par service + détection de chevauchement, import de son classeur | Livre immédiatement de la valeur à la RH sans toucher aux bulletins |
| **R2** | Table `rubriquesPaie` + les quatre assiettes dans `lib/paie.ts` + corrections C1→C9 + barème daté étendu. **Nouvelle version de barème datée** : les mois déjà clôturés ne sont pas recalculés | Le cœur fiscal. Isolé pour être testé contre son DIPE d'août 2026 ligne par ligne |
| **R3** | Écran DIPE + exports + récapitulatif + rapport d'écart | Ce qui lui fait gagner son temps de déclaration mensuelle |
| **R4** | `lib/allocationConge.ts` (1/16) + bascule contrôlée + liaison planning → `joursTravailles` + allocation du mois | En dernier parce que c'est ce qui change la paie versée : à faire après arbitrage de la direction |
| **R5** | Absences élargies : maternité (14 sem.), AT/MP (2/3 CNPS), chômage technique (50/40/35/30/25/20 %), permissions familiales (plafond 10 j/an), sans solde | Complète la couverture légale du module |

**Règle à tenir sur tout le lot R2/R4 :** toute modification du calcul passe par une **nouvelle
version datée du barème** (`baremes.effectiveFrom`). Les mois clôturés gardent leur snapshot. C'est
déjà le principe de l'application, il devient vital ici : on ne recalcule pas un DIPE déjà déposé
aux impôts.

---

# Partie 5 — Impact métier

## Ce que ça change pour la responsable RH

| Aujourd'hui | Après |
|---|---|
| Elle calcule de tête les jours ouvrables, hors dimanches et fériés, puis tape la date de retour | Le système la calcule et la justifie ; elle contrôle |
| Elle saisit le congé supplémentaire à la main (ancienneté, enfants) | Calculé depuis la date d'embauche et les enfants, avec le détail du calcul affiché |
| Elle tape `=110000/30*9` dans **chaque** cellule de prime du salarié parti en congé | Le planning alimente les jours travaillés ; la proratisation est automatique sur toutes les rubriques marquées « proratisable » |
| Elle calcule l'allocation de congé à part et la colle en dur | Calculée selon la règle retenue, traçable |
| Elle reprend les en‑têtes du planning chaque 1ᵉʳ janvier | `anneeReference`, rien à reprendre |
| Rien ne l'alerte si deux personnes du même service partent ensemble | Détection des chevauchements par service |
| Elle recopie le DIPE à la main chaque mois avant le 15 | Export en un clic, avec les totaux justes |
| Son savoir (la règle des fériés, le choix des assiettes) n'existe que dans sa tête | Écrit, versionné, opposable |

## Risques aujourd'hui portés par l'entreprise

1. **Sous‑paiement de l'allocation de congé : 0,5 à 1,5 M FCFA/an** si on branche la paie sur le
   moteur actuel sans corriger le diviseur. L'indemnité compensatrice est **prescriptible à 3 ans**
   → réclamable rétroactivement par 75 salariés.
2. **Sous‑déclaration de l'AT/MP** : l'assiette n'est pas plafonnée. Un seul salarié dépasse
   750 000 aujourd'hui, mais c'est une irrégularité CNPS structurelle.
3. **Sur‑imposition des salaires élevés** dans son tableur (+4 à +8 % d'IRPP au‑delà de 310 000) →
   sur‑retenue sur 2 salariés, contentieux possible.
4. **Déclarations fausses déjà déposées** : les totaux de prime de salissure et de panier du DIPE
   d'août 2026 sont sous‑évalués (plages `SUM` démarrant à la ligne 67 et 69), un salarié est
   oublié dans 4 colonnes de total, et les charges patronales déclarées omettent les prestations
   familiales et l'AT/MP.
5. **Plafond CNPS incohérent selon la ligne** (500 000 au lieu de 750 000 pour ~5 salariés) → sur‑
   ou sous‑cotisation selon le cas.
6. **Amende de 100 000 FCFA automatique et non remissible** (LF 2026) en cas de défaut de
   déclaration IRPP annuelle. Le DIPE est dû **avant le 15 du mois suivant**.
7. **Continuité** : si elle s'absente, personne ne sait reproduire le fichier. Les règles sont
   implicites.
8. **Registre de congés** : c'est un moyen de preuve devant l'inspection du travail. Un classeur
   Excel sans horodatage ni historique ne vaut rien en contentieux.

## Bénéfice que je mettrais en avant devant la direction

Ce n'est pas « digitaliser un tableur ». C'est :

- **lever une dette salariale de l'ordre du million de FCFA par an** avant qu'elle ne devienne
  réclamable sur 3 ans ;
- **mettre les déclarations CNPS et impôts en conformité**, en remplaçant des formules recopiées de
  travers par un moteur testé et daté ;
- **sortir le savoir métier de la tête d'une seule personne** et le rendre auditable ;
- **rendre à la RH plusieurs jours par mois** de recopie manuelle.

---

# Partie 6 — Ce qu'il me faut de toi

## ⚠️ Les notes de votre échange ne sont pas arrivées

Tu as écrit « Voici quelques notes que j'avais prises au cours de notre échange » en référençant un
texte collé de 24 lignes — **il n'est pas arrivé dans ma session**, je ne vois que la mention de la
pièce jointe. Tout ce qui précède est donc reconstitué **à partir des fichiers seuls**, sans tes
notes. Peux‑tu les recoller ? Elles vont probablement trancher plusieurs des arbitrages ci‑dessous,
en particulier le fameux 8 410 FCFA de taux journalier de congé.

## Les 6 arbitrages à rendre (par ordre d'impact)

| # | Question | Enjeu |
|---|---|---|
| 1 | **La prime de transport est‑elle taxable à l'IRPP ?** Son DIPE dit **oui** (et la loi lui donne raison), notre moteur dit non — et notre moteur a été aligné sur l'application de référence du directeur (`lib/paie.ts`, consigne du 10/09/2026). **Deux références internes se contredisent.** | Change l'IRPP de **tout** l'effectif |
| 2 | **L'allocation de congé : 1/16 légal, ou le diviseur 30 actuel ?** | 0,5 à 1,5 M FCFA/an |
| 3 | **D'où vient son taux journalier de congé de 8 410 FCFA ?** (`151 380 = 8 410 × 18`) Je ne peux pas le reconstituer avec un seul mois. | Cale le calcul sur sa pratique réelle |
| 4 | **L'indemnité de logement : plafonnée au forfait de 15 % comme elle le fait, ou taxée en entier comme nous ?** Sa méthode réduit la base imposable — c'est défendable pour un avantage en nature, moins pour une indemnité versée en espèces. | Risque de redressement |
| 5 | **Les primes de panier / salissure / lait / outillage / représentation sont‑elles bien hors IRPP et hors CNPS ?** Elle les traite en remboursement de frais. À confirmer par le comptable. | Risque de redressement |
| 6 | **Quel est le groupe de risque AT/MP de la clinique** (A 1,75 % / B 2,50 % / C 5 %) ? Les deux outils appliquent 1,75 %. Pour un établissement de santé, le groupe B ou C est plausible. | Sous‑déclaration CNPS |

Les 11 points à faire valider par le comptable sont listés au §8 du
[référentiel légal](docs/rh/REFERENTIEL-LEGAL-CAMEROUN.md).

## Ce que je propose d'attaquer tout de suite

Le **lot R0**, qui ne dépend d'aucun arbitrage : la table des jours fériés et le module de
décompte en jours ouvrables, testés contre les 78 lignes de son planning. Si on reproduit ses dates
de retour au jour près — y compris le piège du 11 février — on a la preuve qu'on a compris sa règle,
et c'est le socle de tout le reste.

# Référentiel légal — paie, impôts et congés au Cameroun (état 2025‑2026)

> Établi le 20/10/2026 par recherche documentaire sourcée, pour servir de base au module RH
> (branche `rh`). **Chaque valeur porte sa source.** Les points marqués ⚠️ n'ont pas pu être
> confirmés par deux sources indépendantes : ils doivent rester **paramétrables** et être validés
> par le comptable / la RH avant mise en production.
>
> Ce fichier est le *référentiel* ; l'analyse du besoin et le plan d'implémentation sont dans
> [`../../ANALYSE-RH-CONGES-IMPOT.md`](../../ANALYSE-RH-CONGES-IMPOT.md).

---

## 1. Les quatre assiettes

C'est le cœur du sujet. Il n'existe **pas une** assiette mais plusieurs, et chaque rubrique de paie
appartient ou non à chacune d'elles.

| Assiette | Définition légale | Sert à calculer |
|---|---|---|
| **Salaire brut** | tous les gains en numéraire | CFC patronal, FNE, (RAV selon lecture) |
| **Salaire brut taxable (SBT)** | brut + avantages en nature évalués au forfait, − remboursements de frais | IRPP, CFC salarial |
| **Salaire cotisable** | brut + avantages en nature, **− indemnité de transport** | CNPS (PVID, PF, AT) |
| **Revenu net imposable** | SBT − 30 % frais pro − CNPS salariale − 500 000 /an | barème IRPP |

### Inclusions / exclusions

| Élément | IRPP (SBT) | CNPS | Allocation de congé (art. 73) |
|---|---|---|---|
| Salaire de base | inclus | inclus | inclus |
| Primes (ancienneté, rendement, assiduité, caisse) | inclus | inclus | inclus |
| Heures supplémentaires majorées | inclus | inclus | inclus |
| **Indemnité de transport** | **inclus (taxable)** | **exclu** (arrêtés n°003/MTPS/DPS et n°94/MINFI du 01/03/1974) | **exclu** |
| Indemnité de logement / représentation | inclus | inclus | **exclu** |
| Primes de panier, salissure, nuit | *remboursement de frais → exclu* ⚠️ | ⚠️ | **exclu** |
| Avantages en nature | inclus au forfait | inclus | — |
| Indemnité de licenciement légale | **exonérée** | hors champ | exclu |
| Gratification / 13ᵉ mois | inclus | inclus | exclu sauf si régulier |
| Allocation du congé précédent | inclus ⚠️ | inclus ⚠️ | **exclu** |

> ⚠️ Le caractère non imposable des primes de panier / salissure / outillage / représentation /
> usage de véhicule repose sur leur qualification de **remboursement de frais professionnels**.
> C'est la lecture retenue par la RH dans son fichier ; elle est défendable mais doit être
> confirmée par le comptable (risque de redressement si les montants sont jugés forfaitaires et
> déguisés en remboursement).

### Évaluation forfaitaire des avantages en nature (% du salaire brut)

| Avantage | Taux |
|---|---|
| Logement | 15 % |
| Électricité | 4 % |
| Eau | 2 % |
| Domestique (par personne) | 5 % |
| Véhicule (par véhicule) | 10 % |
| Nourriture | 10 % |

Source : barème classique du CGI, repris de façon identique par plusieurs cabinets.
⚠️ non confirmé sur un texte officiel en clair → à garder paramétrable.

---

## 2. IRPP sur salaires

### Méthode (retenue mensuelle à la source)

```
SBT                       = base + primes/indemnités taxables + HS + avantages en nature
revenu net imposable      = SBT×12 − 30 %×SBT×12 − CNPS_salariale×12 − 500 000
IRPP annuel               = barème progressif (ci-dessous) appliqué au revenu net imposable
CAC                       = 10 % × IRPP
retenue mensuelle         = (IRPP + CAC) ÷ 12
```

Seuil d'exonération : **SBT mensuel < 62 000 FCFA → aucune retenue**.

### Barème progressif annuel (art. 69 CGI — inchangé en LF 2025 et LF 2026)

| Revenu net imposable annuel | IRPP | avec CAC |
|---|---|---|
| 0 – 2 000 000 | 10 % | 11 % |
| 2 000 001 – 3 000 000 | 15 % | 16,5 % |
| 3 000 001 – 5 000 000 | 25 % | 27,5 % |
| au‑delà de 5 000 000 | 35 % | 38,5 % |

Bornes mensuelles équivalentes : 166 666,67 / 250 000 / 416 666,67.

**Deux points à ne pas coder** (affirmations non corroborées, démenties par impots.cm et lefisk.cm) :
- il n'y a **pas** d'abattement de 500 000 *par enfant* : l'abattement est **forfaitaire unique**, quelle que soit la situation familiale ;
- l'abattement de 30 % n'est **pas plafonné** ;
- le Cameroun n'applique **pas** de quotient familial à l'IRPP sur salaires.

Sources : [impots.cm — Tout savoir sur l'IRPP](https://www.impots.cm/sites/default/files/documents/TOUT%20SAVOIR%20SUR%20L'IRPP_0.pdf),
[lefisk.cm — IRPP](https://lefisk.cm/fiscalite/irpp),
[lefisk.cm — retenues à la source](https://lefisk.cm/blog/calcul-retenues-source-deductions-cameroun-tarif-irpp-cnps-cfc-tsr-aib),
[fiscafinance](https://fiscafinance.com/tout-savoir-sur-les-retenues-salariales-appliquees-au-cameroun/).

---

## 3. Cotisations et taxes sur salaires

| Prélèvement | Salarié | Patronal | Assiette | Plafond |
|---|---|---|---|---|
| CNPS — PVID | 4,2 % | 4,2 % | salaire cotisable | **750 000 /mois** |
| CNPS — Prestations familiales | — | 7 % (régime général) | salaire cotisable | **750 000 /mois** |
| CNPS — Accidents du travail | — | 1,75 % (A) / 2,50 % (B) / 5 % (C) | salaire réel | **AUCUN plafond** |
| CFC (Crédit Foncier) | 1 % | 1,5 % | salaire brut ⚠️ | aucun |
| FNE | — | 1 % | salaire brut | aucun |
| RAV | barème §3.1 | — | salaire brut mensuel ⚠️ | 13 000 /mois |
| TDL | barème §3.2 | — | **salaire de base** mensuel | 2 500 /mois |
| IRPP + CAC | barème §2 | — | revenu net imposable | — |

- Taux PF réduits : régime agricole 5,65 %, enseignement privé 3,70 %.
- Le taux PVID salarié est bien **4,2 %** (et non 2,8 %, qui est l'ancien taux d'avant le
  **décret n°2016/072 du 15/02/2016** — c'est ce même décret qui a porté le plafond de 300 000 à 750 000).
- ⚠️ **L'assiette AT/MP n'est pas plafonnée** : c'est le salaire réel intégral. Beaucoup de
  tableurs (dont celui de la RH) appliquent par erreur l'assiette plafonnée.
- ⚠️ La base exacte du CFC (« montant brut des salaires ») n'est pas désambiguïsée dans les
  sources : inclut-elle les avantages en nature et le transport ? → **paramètre `baseCfc`**.

Sources : [CLEISS — cotisations Cameroun](https://www.cleiss.fr/docs/cotisations/cameroun.html),
[décret n°2016/072](https://journal-ledroit.net/dossiers/portail-entreprises/entreprises-parapubliques/cnps/1407-cnps-decret-n-2016-072-du-15-fevrier-2016.html),
[minfi.gov.cm — autres retenues](https://minfi.gov.cm/les-autres-retenues-sur-les-salaires/).

### 3.1 Barème RAV (forfait mensuel)

| Salaire brut mensuel | RAV |
|---|---|
| 0 – 50 000 | 0 |
| 50 001 – 100 000 | 750 |
| 100 001 – 200 000 | 1 950 |
| 200 001 – 300 000 | 3 250 |
| 300 001 – 400 000 | 4 550 |
| 400 001 – 500 000 | 5 850 |
| 500 001 – 600 000 | 7 150 |
| 600 001 – 700 000 | 8 450 |
| 700 001 – 800 000 | 9 750 |
| 800 001 – 900 000 | 11 050 |
| 900 001 – 1 000 000 | 12 350 |
| > 1 000 000 | 13 000 |

⚠️ Barème repris identiquement par deux sources indépendantes mais non retrouvé sur un texte
officiel en clair. **Le seuil de la première tranche (50 000 ou 62 000) est à arbitrer** : la RH
applique 62 000 dans son fichier, les sources documentent 50 000.

### 3.2 Barème TDL (taxe de développement local — instituée par la LF 2025)

| Salaire **de base** mensuel | TDL annuelle | TDL mensuelle |
|---|---|---|
| < 62 000 | 0 | 0 |
| 62 000 – 75 000 | 3 000 | 250 |
| 75 001 – 100 000 | 6 000 | 500 |
| 100 001 – 125 000 | 9 000 | 750 |
| 125 001 – 150 000 | 12 000 | 1 000 |
| 150 001 – 200 000 | 15 000 | 1 250 |
| 200 001 – 250 000 | 18 000 | 1 500 |
| 250 001 – 300 000 | 24 000 | 2 000 |
| 300 001 – 500 000 | ⚠️ non confirmé | ⚠️ (2 250 chez la RH) |
| > 500 000 | 30 000 (plafond) | **2 500 (plafond)** |

C'est la mesure la plus récente et la moins bien documentée. **Le plafond est 2 500 FCFA/mois** :
tout barème qui monte au‑delà (2 750, 3 000, 4 000…) est erroné.
Sources : [lefisk.cm — barème TDL](https://lefisk.cm/outils/bareme-tdl),
[impots.cm — barème TDL/DSSI (PDF)](https://www.impots.cm/sites/default/files/documents/BAREME%20TDL_DSSI%20final.pdf),
[Investir au Cameroun](https://www.investiraucameroun.com/gestion-publique/2511-21435-fiscalite-locale-le-cameroun-sur-le-point-d-instituer-une-taxe-annuelle-de-3000-a-30-000-fcfa-sur-les-salaires).

### 3.3 Nouveautés LF 2026

- **Exonération pré‑emploi jeunes < 35 ans** : les entreprises recrutant de jeunes diplômés
  camerounais de moins de 35 ans sont exonérées des charges fiscales et patronales sur ces
  salaires (les charges **sociales CNPS restent dues**).
- **Amende automatique de 100 000 FCFA** pour défaut de déclaration IRPP annuelle, générée
  automatiquement et non remissible.

Source : [lefisk.cm — circulaire d'application LF 2026](https://lefisk.cm/blog/circulaire-application-loi-finances-2026-cameroun-mesures-fiscales).

---

## 4. SMIG et heures supplémentaires

### SMIG — décret n°2023/00338/PM du 21/03/2023

| Secteur | SMIG |
|---|---|
| Secteur général (Code du travail) | 41 875 FCFA (→ 43 969 pour les agents de l'État depuis 02/2024) |
| Secteur agricole et assimilés | 45 000 FCFA |
| Autres secteurs d'activité | 60 000 FCFA |

Il y a donc **plusieurs SMIG sectoriels simultanés** → paramètre, pas une constante.
⚠️ Une revalorisation était annoncée en 2026 ; aucun décret retrouvé la fixant → à surveiller.

### Majorations d'heures supplémentaires (Loi n°92/007)

| Type | Majoration |
|---|---|
| HS diurnes 1ʳᵉ tranche (8 premières h/semaine) | +20 % |
| HS diurnes 2ᵉ tranche (8 h suivantes) | +30 % |
| HS diurnes 3ᵉ tranche (4 h, plafond 20 h/semaine) | +40 % |
| Travail de nuit | +50 % |
| Travail le dimanche | +40 % |
| HS d'urgence / force majeure | +50 % |
| Travail un jour férié chômé | **+100 %** ou repos compensateur |

Plafond légal : **20 h supplémentaires par semaine**.
Sources : [wageindicator](https://wageindicator.org/fr-cm/travail-au-cameroun/droit-du-travail/remuneration-et-temps-de-travail/),
[droitsocialenpratique](https://www.droitsocialenpratique.com/les-heures-supplementaires-lessentiel-a-savoir/).

---

## 5. Congés payés

Base : **Loi n°92/007 du 14/08/1992 (Code du travail)**, art. 89 à 94, et
**décret n°75/28 du 10/01/1975** (modalités d'application du régime des congés payés).

### 5.1 Acquisition — art. 89

- **1,5 jour ouvrable par mois de service effectif** → **18 jours ouvrables/an** minimum légal.
- **Équivalence légale : 1 mois de service = 4 semaines = 24 jours ouvrables.**
  C'est cette équivalence qui fonde le diviseur 24 de l'allocation de congé (§5.4).
- Sont **assimilés à du service effectif** (donc acquièrent du congé) :
  accident du travail / maladie professionnelle (sans limite), maladie dûment constatée
  (**plafond 6 mois**), congé de maternité, chômage technique, congé de formation ouvrière
  (art. 91, plafond 18 jours ouvrables).
- N'acquièrent pas : absences injustifiées, mise à pied disciplinaire, congé sans solde
  (déduction *a contrario*, à confirmer selon la convention collective).

### 5.2 Majorations — art. 90

| Motif | Majoration | Condition |
|---|---|---|
| Jeunes travailleurs | taux porté à **2,5 j/mois** (≈ 30 j/an) — *remplace* le 1,5, ne s'y ajoute pas | moins de 18 ans |
| **Ancienneté** | **+2 jours ouvrables par période entière de 5 ans** de service dans l'entreprise (continue ou non) | — |
| **Mères salariées** | **+2 jours ouvrables par enfant** à charge **âgé de moins de 6 ans au jour du départ en congé**, inscrit à l'état civil et vivant au foyer ; **+1 jour seulement** si le congé principal n'excède pas 6 jours | — |

Les majorations ancienneté et « mère » **se cumulent**.

⚠️ **Non trouvées dans la loi** (donc d'origine conventionnelle, à ne pas coder en dur) :
majoration pour délégué du personnel, majoration pour zone à conditions climatiques
particulières.

### 5.3 Décompte, jouissance, fractionnement

- Décompte en **jours ouvrables** : **6 jours ouvrables par semaine (samedi inclus)**, dimanches
  et **jours fériés exclus** du décompte.
- **Arrondi au nombre entier supérieur** lorsque le calcul donne une fraction (décret n°75/28).
- **Droit à la jouissance ouvert après 1 an de service effectif** (art. 92), portable à 2 ans
  maximum par convention plus favorable.
- **Fractionnement** : au‑delà de **12 jours ouvrables**, le congé peut être fractionné par accord
  des parties, à condition qu'une fraction soit d'au moins **12 jours ouvrables consécutifs**.
  ⚠️ une source secondaire cite 14 jours ; la valeur retenue ici est **12**, recoupée deux fois.
- **Report** : possible à la demande du travailleur, sans dépasser **2 années** de service effectif
  sans jouissance → c'est le plafond de cumul de fait.
- **Prescription de l'indemnité compensatrice : 3 ans** à compter de la rupture du contrat.
- Le **préavis** de licenciement/démission **ne peut jamais être imputé sur le congé** (art. 34).
- ⚠️ Délai de prévenance avant départ en congé : souvent cité à 15 jours, non confirmé sur le
  texte → paramètre.

### 5.4 Allocation de congé — décret n°75/28, art. 97.1

```
Allocation de congé = (1/16) × rémunération totale de la période de référence
                      (5/48 pour les travailleurs de moins de 18 ans)
```

- **Période de référence** : du jour de l'embauche (ou du retour du précédent congé) au jour
  précédant le départ en congé.
- Si la période de référence **excède 12 mois** : appliquer la fraction au salaire mensuel moyen
  des 12 derniers mois × le nombre de fractions de mois de la période.
- **Versement au plus tard le dernier jour précédant le départ** (art. 93).
- **Assiette** : salaire de base + accessoires réguliers, **à l'exclusion** du transport, du
  déplacement, de l'entretien de véhicule, du logement, de la représentation, du préavis, de
  l'indemnité de licenciement, des primes de panier / nuit / salissure, de l'allocation du congé
  précédent, des gratifications ponctuelles et des remboursements de frais (art. 73).

**Contrôle de cohérence à utiliser comme test unitaire** : pour un salaire fixe de 300 000 FCFA
sur 12 mois pleins → allocation = 3 600 000 / 16 = **225 000 FCFA**, soit 18 jours × 12 500,
où 12 500 = 300 000 / **24**. Autrement dit :

> **le taux journalier de congé est la rémunération de référence ÷ 24, pas ÷ 30.**

- **Indemnité compensatrice** (rupture avant jouissance) : même fraction appliquée au solde de
  jours acquis non pris. Toute convention substituant une indemnité au congé effectif **en cours
  de contrat** est nulle de plein droit.
- ⚠️ **Assujettissement de l'allocation de congé à l'IRPP et à la CNPS** : forte présomption
  positive (substitut de salaire) mais **aucune source primaire dédiée trouvée** → à faire valider
  par la CNPS / la DGI. La RH l'intègre dans toutes ses assiettes (colonne U de son DIPE).

---

## 6. Autres absences

| Absence | Durée | Rémunération / payeur |
|---|---|---|
| **Permissions pour événements familiaux** (décret n°75/29) : mariage du travailleur 3 j · décès conjoint/père/mère 3 j · accouchement de l'épouse 3 j · mariage d'un enfant 1 j | **plafond 10 jours ouvrables/an** (art. 89 al. 4) | payées par l'employeur ; **non déductibles du congé annuel** dans la limite du plafond |
| **Congé de maternité** | **14 semaines** (4 avant + 10 après l'accouchement), **+6 semaines** si maladie constatée liée à la grossesse ou aux couches ⚠️ *(une source secondaire cite 15 + 3 — à trancher sur l'art. 84)* | indemnité journalière **CNPS = 100 %** du salaire au moment de la suspension, sous condition de 6 mois consécutifs de travail effectif |
| Allocations prénatales / de maternité | — | 9 × 4 500 = **40 500** / 12 × 4 500 = **54 000** FCFA (CNPS) |
| **Congé de paternité** | **aucune disposition légale** — seule la permission « accouchement de l'épouse » de 3 j | employeur |
| **Maladie** (décret n°96/198) | suspension **max 6 mois**, prorogeable jusqu'au remplacement effectif ; certificat médical obligatoire | indemnité = indemnité de préavis si l'absence ≥ préavis, sinon rémunération qui aurait été perçue ; **pas d'indemnités journalières CNPS généralisées** pour la maladie ordinaire |
| **Accident du travail / maladie professionnelle** (loi n°77/11, décret n°78/545) | jusqu'à guérison / consolidation ; **déclaration employeur sous 3 jours ouvrables** | indemnité journalière **CNPS = 2/3** de la rémunération journalière moyenne |
| **Chômage technique** (art. 32‑k, arrêté n°001/CAB/MTPS du 14/02/1995) | **max 6 mois** | employeur, dégressif sur le salaire de base : **50 / 40 / 35 / 30 / 25 / 20 %** par mois |
| **Mise à pied disciplinaire** | **max 8 jours ouvrables**, écrite et motivée, inspection du travail informée sous 48 h | non payée |
| **Congé sans solde** | aucun droit général hors art. 91 ; purement conventionnel (ex. 30 j/an dans certaines CC) | non payé |

**Retenue pour absence injustifiée** : ⚠️ **aucun diviseur n'est imposé par la loi**. Pratiques
courantes : /30 (calendaire), /26 ou /24 (ouvrables). → **paramètre obligatoire**, à ne pas figer.

### Jours fériés légaux

| Jour | Date |
|---|---|
| Jour de l'An | 1ᵉʳ janvier |
| **Fête de la Jeunesse** | **11 février** |
| Vendredi Saint | mobile |
| Fête du Travail | 1ᵉʳ mai |
| Ascension | mobile |
| Fête Nationale | 20 mai |
| Aïd el‑Fitr (Djouldé Soumaé) | mobile |
| Aïd el‑Adha (Tabaski) | mobile |
| Assomption | 15 août |
| Noël | 25 décembre |

- Les dates mobiles sont fixées **chaque année par acte administratif** → table administrable,
  jamais une constante dans le code.
- Un férié tombant un dimanche est usuellement reporté au lundi (⚠️ règle d'usage, dépend de
  l'acte annuel).
- Les jours fériés **ne sont pas déduits** du congé annuel et **s'y ajoutent**.
- ⚠️ Le 8 mars n'est **pas** un férié légal (pratique administrative de demi‑journée).

### Obligations de l'employeur

Registre d'employeur, registre du personnel, registre de paie et bulletins, **tenus constamment
à jour et présentés à l'inspecteur du travail à toute demande**. L'état nominatif des congés
(acquisition, prise, solde) sert de **moyen de preuve** en cas de contentieux sur l'indemnité
compensatrice → horodater et archiver systématiquement (prescription 3 ans).

---

## 7. Obligations déclaratives

| Déclaration | Périodicité | Échéance |
|---|---|---|
| **DIPE** / télédéclaration CNPS | mensuelle | **avant le 15 du mois suivant** |
| Paiement des cotisations CNPS | mensuelle | 15 du mois suivant |
| **DSF** (déclaration statistique et fiscale) | annuelle | **15 mars** N+1 (ou 75 j après clôture) |
| Déclaration IRPP annuelle | annuelle | calendrier DGI/DSF |

États qu'un logiciel de paie doit produire : bulletin individuel, journal de paie mensuel,
**fichier DIPE structuré**, état récapitulatif annuel des salaires et retenues (support DSF /
annexe salaires OHADA), livre de paie annuel, attestations de salaire et certificats de travail.

---

## 8. Récapitulatif des points à faire valider avant mise en production

| # | Point | Qui tranche |
|---|---|---|
| 1 | Assujettissement de l'allocation de congé à l'IRPP et à la CNPS | comptable / CNPS / DGI |
| 2 | Base exacte du CFC (avantages en nature et transport inclus ?) | comptable |
| 3 | Base du RAV (brut ou taxable) et seuil de 1ʳᵉ tranche (50 000 ou 62 000) | comptable |
| 4 | Barème TDL entre 300 000 et 500 000 de salaire de base | comptable, sur le PDF impots.cm |
| 5 | Traitement fiscal des primes de panier / salissure / outillage / représentation | comptable |
| 6 | Groupe de risque AT/MP de la clinique (A 1,75 % / B 2,50 % / C 5 %) | RH / CNPS |
| 7 | Durée exacte du congé de maternité (14+6 ou 15+3 semaines) | lecture de l'art. 84 |
| 8 | Diviseur de la retenue pour absence injustifiée (24 / 26 / 30) | direction + convention |
| 9 | Convention collective sectorielle applicable (santé privée) et ses majorations | RH |
| 10 | Barème étendu des permissions exceptionnelles | RH + convention |
| 11 | Éligibilité à l'exonération pré‑emploi jeunes < 35 ans (LF 2026) | comptable |

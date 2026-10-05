# Inventaire des règles de calcul de la plateforme

*État du code au 02/10/2026 (commit `47cae86`). Relevé en lecture seule : aucun fichier de l'application n'a été modifié.*

Le document répond à une seule question : **quel calcul est utilisé, et où ?** Pour chaque règle, il donne la formule exacte, l'endroit où se trouve chaque paramètre, la fonction qui calcule, les écrans ou documents qui affichent le résultat, et un exemple chiffré quand un test en fournit un.

**Où vivent les paramètres** (abréviations utilisées partout dans le document) :

| Abrév. | Où | Qui le modifie |
|---|---|---|
| **[Barème]** | table `baremes`, une version datée (`effectiveFrom`), écran *Barème CNPS / CGI* | droit Faire sur `/bareme` |
| **[Param.]** | `parametresEntreprise` (singleton), écran *Paramètres → Paie & congés / Entreprise* | droit Faire sur `/parametres` |
| **[Réglage]** | `parametresEntreprise.reglages`, écran *Paramètres → Fonctionnement / Paie* (`lib/reglages.ts`) | idem |
| **[Fiche]** | table `employes` (fiche employé) | `/employes` |
| **[Saisie]** | table `saisiesMensuelles` (une ligne par employé et par mois), écran *Récapitulatif salaires* | `/paie/saisie` |
| **[Planning]** | table `absences`, écran *Planning des absences* | `/paie/planning` |
| **[Registre]** | table `primesCharges`, écran *Primes & charges* | `/paie/primes` |
| **[Code]** | constante écrite dans le code (fichier indiqué) | développeur uniquement |

Tous les montants sont en **FCFA entiers**. Sauf mention contraire, `arrondi(x)` = `Math.round` (0,5 arrondi vers le haut).

---

## Sommaire

1. Paie : du brut au net (P1 à P22)
2. Paie : cotisations et charges patronales (C1 à C9)
3. Impôts : IRPP, CAC, TDL, RAV (I1 à I6)
4. Temps, absences et congés (T1 à T11)
5. Primes et retenues (registre et saisie) (R1 à R6)
6. Trésorerie / grand livre (F1 à F10)
7. Caisse et primes médecins (S1 à S9)
8. Audit (A1 à A8)
9. Commandes et interventions (K1 à K7)
10. Comptes rendus et présence (CR1 à CR8)
11. Dates et périodes, clôtures, verrous et délais (D1 à D14)
12. L'écran Barème actuel
13. Valeurs codées en dur qui devraient être paramétrables
14. Incohérences et points à vérifier

**Total : 110 règles numérotées**, dont 4 simples renvois vers une autre règle (P18, F9, F10, S8).

---

## 1. Paie : du brut au net (ordre du calcul)

Moteur pur : `convex/lib/paie.ts → computeBulletin(salaireBrutRef, saisie, barème, extras)`.
Il est appelé par `convex/lib/calculBulletins.ts → bulletinsPourPeriode(ctx, periode)`, qui assemble fiche, saisie, planning, registre et barème. Le même moteur tourne aussi **côté navigateur** pour l'aperçu instantané du récapitulatif (`src/pages/recap/commun.tsx → apercuBulletin`).

Utilisateurs de `bulletinsPourPeriode` : `payroll.bulletinsDuMois` (Récapitulatif salaires, Liste des salaires, Bulletins, tableau de bord), `payroll.genererEtCloturer` (clôture), le courrier de paie (`courrier.ts`), les archives et les PDF (`paiePdf.ts`), et l'audit (`audit.totalSalaires`, `audit.graphes`).

### P1. Barème applicable à une période
- **Formule** : parmi les versions où `statut = "actif"`, on prend la plus récente dont `effectiveFrom ≤ "AAAA-MM-01"`. Sans version applicable, aucun bulletin n'est calculé (« Aucun barème applicable à cette période »).
- **Paramètres** : `baremes.effectiveFrom`, `baremes.statut` **[Barème]**.
- **Calcul** : `lib/calculBulletins.ts : baremePourPeriode`. Doublon identique dans `convex/bareme.ts : pourPeriode`.
- **Utilisé où** : tous les bulletins des mois ouverts ; la popover « Taux du mois / Barème AAAA-MM » du Récapitulatif (`TauxDuMois`) ; l'écran Barème (tuile « Version applicable », drapeau « Applicable à … »).
- **Note** : une version effective au 15 du mois ne s'applique qu'au mois **suivant**, car la comparaison se fait sur le 1er du mois.

### P2. Jours de base (diviseur du salaire journalier)
- **Formule** : `joursBase = fiche.joursBase ?? 30`.
- **Paramètres** : `employes.joursBase` **[Fiche]**. Il est posé **à la création** de l'employé (création ou import) à partir de `reglages.joursBaseDefaut` **[Réglage]** (30 par défaut, borné de 20 à 31). Il n'est **pas modifiable** dans la fiche employé. Le repli 30 est écrit dans `lib/paie.ts`, `lib/calculBulletins.ts` et `lib/absences.ts` **[Code]**.
- **Calcul** : `lib/calculBulletins.ts` (`joursBase: e.joursBase ?? 30`) puis `computeBulletin` (`s.joursBase || 30`).
- **Utilisé où** : P3 et T9. Affiché « x / N » dans le Planning (colonne Jours travaillés). Sur le bulletin à l'écran (`BulletinCard`) et sur le PDF, le dénominateur est **toujours 30** (voir Incohérences).

### P3. Salaire journalier
- **Formule** : `journalier = salaireBrut ÷ joursBase`. La valeur exacte (non arrondie) sert aux calculs ; la valeur affichée est `arrondi(journalier)`.
- **Paramètres** : `employes.salaireBrut` (brut mensuel de référence) **[Fiche]** ; joursBase (P2).
- **Calcul** : `lib/paie.ts : computeBulletin` (étape 1). Stocké dans `details.salaireJournalier`.
- **Utilisé où** : Récapitulatif, vue « tout visible » (colonne *Sal. journalier*) ; bulletin écran et PDF (case *Salaire journalier*) ; légende du Récapitulatif (« Journalier = brut ÷ 30 »).
- **Exemple** : `tests/paie.test.ts`, brut 150 000 → 5 000.

### P4. Jours travaillés (entrée de la paie)
- **Formule** :
  - s'il existe une saisie du mois : `joursTravailles = saisie.joursTravailles` ;
  - sinon : valeur du planning, `joursBase − absences non payées − congés pris du mois` (T9).
  - Bornes serveur : de 0 à 31.
- **Paramètres** : `saisiesMensuelles.joursTravailles` **[Saisie]**. Ce champ est réécrit automatiquement par le planning à chaque ajout, modification ou suppression d'absence (T10).
- **Calcul** : `lib/calculBulletins.ts` (`saisie?.joursTravailles ?? r.joursTravailles`).
- **Utilisé où** : P5 ; Récapitulatif (colonne *Jours trav.* / *Jours*) ; bulletin (case *Jours travaillés*).

### P5. Salaire de base (« Salaire du mois », code 66111)
- **Formule** : `salaireBase = arrondi(journalier × joursTravailles)`.
- **Calcul** : `lib/paie.ts : computeBulletin`. Stocké dans `details.salaireBase`.
- **Utilisé où** : ligne de gain 66111 ; Récapitulatif (colonne *Salaire de base* et total) ; base de la TDL (I5).
- **Exemple** : `paie.test.ts` cas 3, 200 000 × 25/30 = **166 667**.

### P6. Indemnité de congés payés (code 6613)
- **Formule** : `indemniteConges = arrondi(journalier × congesPris)`, où `congesPris` = jours calendaires de congé payé tombant dans le mois (T5).
- **Paramètres** : événements `conge_paye` **[Planning]**.
- **Calcul** : `lib/paie.ts : computeBulletin`.
- **Utilisé où** : ligne de gain 6613 « Congés payés » ; Récapitulatif (cellule *Primes fixes / congé*, avec « n j congés » en sous-titre) ; bulletin (case *Indemnité de congés*).
- **Exemple** : `paie.test.ts` cas 3, 5 jours → **33 333**.
- **Note** : les jours de congé sont retirés des jours travaillés (T9) puis payés ici. Le total base + indemnité reste donc égal au brut quand il n'y a pas d'autre absence.

### P7. Primes (agrégat « primes »)
- **Formule** : `primes = primesVariables + transport + primeAssiduite + indemniteLogement + Σ primes du registre`.
- **Paramètres** : `saisiesMensuelles.primesVariables` (affiché « Primes fixes »), `transport`, `primeAssiduite`, `indemniteLogement` **[Saisie]** ; lignes `type = "prime"` **[Registre]**.
- **Calcul** : `lib/paie.ts : computeBulletin`. Stocké dans `details.primes`.
- **Utilisé où** :
  - Liste des salaires : colonne *Primes* = `details.primes`, sans l'indemnité de congés ;
  - Récapitulatif : cellule *Primes fixes / congé* = `primes + indemniteConges` ;
  - tuile / total « primes » de `totaux()` = `primes + indemniteConges`.
  - Les deux écrans n'ont donc pas la même définition (voir Incohérences).

### P8. Total 1 = brut (TOTAL BRUT)
- **Formule** : `Total 1 = salaireBase + primes + indemniteConges + heuresSup + anciennete`.
- **Paramètres** : `heuresSup` et `anciennete` sont des montants FCFA **[Saisie]**. Aucun calcul de taux horaire ni de pourcentage d'ancienneté n'existe.
- **Calcul** : `lib/paie.ts : computeBulletin` → `bulletin.brut = details.total1`.
- **Utilisé où** :
  - Récapitulatif : colonne *Total 1*, tuile « Masse brute · Total 1 » ;
  - Bulletins du mois : colonne / tuile « Masse brute » et impression groupée ;
  - bulletin écran et PDF : ligne « TOTAL BRUT (Total 1) », case « Salaire brut » ;
  - e-mail de paie : ligne « Total brut » ;
  - Archives : colonne *Brut* par mois ; Mes bulletins : « brut » ;
  - tableau de bord : tuile « Masse brute & Charges » et barre « Masse brute » ;
  - Audit : *Total salaires reçus*, colonne Brut.
- **Exemple** : `paie.test.ts`, 150 000 + transport 15 000 → **165 000**. Cas 3 : 166 667 + 33 333 + 15 000 → **215 000**.

### P9. Base taxable (brut taxable)
- **Formule** : `brutTaxable = max(0, Total 1 − transport)`. La prime de transport est la seule exonération.
- **Paramètres** : l'exonération du transport est **[Code]**. Aucun plafond d'exonération n'est appliqué.
- **Calcul** : `lib/paie.ts`. Stocké dans `details.brutTaxable`.
- **Utilisé où** : bases de CFC salarié et patronal, FNE, RAV et IRPP (C5, C6, C7, I1, I6) ; base CNPS (P10) ; colonne *Base* des lignes IRPP, CFC, FNE et RAV du bulletin.
- **Exemple** : `paie.test.ts`, 165 000 − 15 000 = **150 000**.

### P10. Base CNPS (plafonnée)
- **Formule** : `baseCnps = min(brutTaxable, plafondCnps)`.
- **Paramètres** : `baremes.plafondCnps` **[Barème]** (750 000 par défaut).
- **Calcul** : `lib/paie.ts`.
- **Utilisé où** : C1 à C4 ; colonne *Base* des lignes 43131, 66411, 66412 et 66413.
- **Exemple** : `paie.test.ts` cas cadre, brut 1 380 000 → base **750 000**.

### P11. Mutuelle
- **Formule** : `mutuelle = arrondi(Total 1 × mutuellePct ÷ 100)`. La base est le **Total 1**, transport et congés compris.
- **Paramètres** : `saisiesMensuelles.mutuellePct` **[Saisie]**, de 0 à 100 %.
- **Calcul** : `lib/paie.ts`. Ligne « Mutuelle (x %) » en retenue, sans code.
- **Utilisé où** : Récapitulatif (colonnes *Mut. %* et *Mutuelle*, total) ; bulletin (« Autres retenues »).
- **Exemple** : `paie.test.ts` cas 3, 2 % de 215 000 = **4 300**.

### P12. Retenues diverses (hors cotisations)
- **Formule** : chaque montant est repris tel quel en retenue : `sanctions`, `absences` (montant FCFA saisi, colonne « ABSENCE »), `dettesSoins`, `acompte`, plus chaque ligne `type = "charge"` du registre (code `RETENUE`).
- **Paramètres** : **[Saisie]** et **[Registre]**.
- **Calcul** : `lib/paie.ts` (liste `cotisations`).
- **Utilisé où** : Récapitulatif (colonnes *Sanctions*, *Absence*, *Dettes de soins*, *Acompte*) ; bulletin (bloc « Autres retenues »).
- **Note** : la retenue « Absences » est un montant **saisi à la main**. Elle ne découle pas du planning, qui agit déjà sur les jours travaillés (voir Incohérences).

### P13. Charges salariales (cotisations et impôts du salarié)
- **Formule** : `chargesSalariales = CNPS salarié + IRPP + CAC + TDL + RAV + CFC salarié`. Mutuelle et retenues diverses n'en font **pas** partie.
- **Calcul** : `lib/paie.ts`. Stocké dans `details.chargesSalariales` et `bulletin.chargesSalariales`.
- **Utilisé où** : bulletin écran et PDF (case « Charges salariales ») ; P14.
- **Exemple** : `paie.test.ts`, 6 300 + 5 703 + 570 + 1 000 + 1 950 + 1 500 = **17 023**. ABAMI (brut 106 950) : **11 420**, identique à la référence du directeur.

### P14. « Acompte / dette / impôts & CNPS » (colonne du récapitulatif)
- **Formule** : `acompteImpotsCnps = acompte + chargesSalariales`.
- **Calcul** : `lib/paie.ts`. Stocké dans `details.acompteImpotsCnps`.
- **Utilisé où** : Récapitulatif, vue « tout visible » (« = … avec impôts » sous l'acompte, et total) ; volet de saisie de la Synthèse (« Impôts & CNPS + acompte »).
- **Exemple** : `paie.test.ts` cas 3, 20 000 + charges salariales.

### P15. Total des retenues
- **Formule** : somme de toutes les retenues salariales = CNPS salarié + IRPP + CAC + TDL + CFC salarié + RAV + sanctions + absences + dettes de soins + acompte + mutuelle + retenues du registre.
- **Calcul** : `lib/paie.ts` (`totalRetenues`). Recalculé à l'identique sur le bulletin écran et le PDF (somme des lignes).
- **Utilisé où** :
  - Bulletins du mois : colonne / tuile « Retenues » ;
  - bulletin : ligne « TOTAL COTISATIONS ET RETENUES » ;
  - e-mail : « Total retenues » ; Mes bulletins : « retenues » ;
  - Audit : *Total salaires reçus*, colonne Retenues ;
  - Récapitulatif : tuile « Retenues du mois », calculée `Σ total1 − Σ total2` (même résultat).
- **Exemple** : `paie.test.ts`, contrôle « total retenues = somme des lignes listées ».

### P16. Total 2
- **Formule** : `Total 2 = Total 1 − totalRetenues`. Il peut être négatif.
- **Calcul** : `lib/paie.ts`. Stocké dans `details.total2`.
- **Utilisé où** : Récapitulatif, colonne *Total 2* et total. La colonne affiche le Total 2 brut, éventuellement négatif, alors que les colonnes par société affichent le net (P17).

### P17. Net à payer
- **Formule** : `net = max(0, Total 2)`.
- **Calcul** : `lib/paie.ts`.
- **Utilisé où** :
  - Récapitulatif : colonnes *Sal. SESAME / SOFINA / SGC*, tuile « Net à payer · Total 2 » avec la répartition par société ;
  - Liste des salaires : net dans la colonne de la société, *Total perçu*, tuiles « Net SESAME / SOFINA / SGC » ;
  - Bulletins du mois : colonne / tuile « Net à payer » ;
  - bulletin écran et PDF : cadre « NET À PAYER (TOTAL 2) » ;
  - Courrier : variable `{net}` de la lettre, bandeau de l'e-mail ;
  - Archives : net par mois et détail ; Mes bulletins ;
  - tableau de bord : tuile « Net à payer du mois », barre « Net payé » ;
  - Audit : *Total salaires reçus* (net et variation), graphe « Net versé par mois ».
- **Exemples** : `paie.test.ts`. ABAMI : **95 530**. Cas de référence : 165 000 − 17 023 = **147 977**.

### P18. Charges patronales (total) : voir C8.

### P19. Aperçu instantané (navigateur)
- **Formule** : `computeBulletin` relancé dans le navigateur avec les valeurs non encore enregistrées. Le nombre de jours de base est **reconstitué** par `arrondi(salaireBrut ÷ details.salaireJournalier)`. Congés pris, acquis et restants ainsi que les lignes du registre sont repris du bulletin serveur.
- **Calcul** : `src/pages/recap/commun.tsx : apercuBulletin`, `baremeClient`.
- **Utilisé où** : Récapitulatif, volet de saisie de la Synthèse (Salaire de base, Total 1, Impôts & CNPS + acompte, Net à payer).

### P20. Totaux du récapitulatif
- **Formule** (`totaux()`) :
  - effectif = nombre de bulletins ;
  - Σ salaireBase ;
  - « primes » = Σ (primes + indemniteConges) ;
  - « heuresSupAnciennete » = Σ (heuresSup + anciennete) ;
  - Σ total1, Σ acompteImpotsCnps, Σ mutuelle, Σ total2 ;
  - net = Σ net ;
  - retenues = Σ total1 − Σ total2 ;
  - net par société = Σ net filtré sur la société.
- **Calcul** : `src/pages/recap/commun.tsx : totaux`.
- **Utilisé où** : Récapitulatif, tuiles (`TuilesRecap`) et pied de tableau des deux vues.

### P21. Agrégats de masse salariale ailleurs
- Bulletins du mois : Σ brut, Σ totalRetenues, Σ net (`pages/Bulletins.tsx : total`).
- Liste des salaires : Σ net par société, Σ primes, Σ net (`pages/ListeSalaires.tsx`).
- Archives : Σ brut et Σ net par mois clôturé (`convex/archives.ts : liste`), nombre de bulletins figés, nombre de PDF manquants.
- Tableau de bord : Σ net et Σ brut du mois (`pages/Dashboard.tsx`).
- Audit : Σ brut, Σ retenues et Σ net sur 6, 12 ou 24 mois, avec variation du net (`convex/audit.ts : totalSalaires, graphes`).
- Employés : masse brute de référence = Σ `salaireBrut` des actifs (`pages/Employes.tsx`). C'est la somme des fiches, pas celle des bulletins.

### P22. Gel à la clôture
- **Formule** : à la clôture (« Générer et clôturer le mois »), chaque bulletin calculé est copié dans `bulletins` (brut, retenues, net, lignes, `details`, `baremeId`). Un mois clôturé n'est **jamais recalculé** : il est relu tel quel. Bornes et date de paiement sont, elles, recalculées à la lecture (D2, D3).
- **Calcul** : `convex/payroll.ts : genererEtCloturer` ; lecture dans `lib/calculBulletins.ts` (branche `cloture`).
- **Utilisé où** : Archives, Mes bulletins, PDF archivés, Courrier d'un mois clôturé, Audit.

---

## 2. Paie : cotisations et charges patronales

Toutes dans `lib/paie.ts : computeBulletin`. Les taux viennent du **[Barème]** (valeurs par défaut `BAREME_DEFAUT`, à valider selon le commentaire du code).

| # | Règle | Formule | Base | Taux par défaut (champ du barème) | Code / libellé |
|---|---|---|---|---|---|
| C1 | CNPS salarié (PVID salarié) | `arrondi(baseCnps × tauxPvidSal %)` | base CNPS plafonnée (P10) | 4,2 % (`tauxPvidSal`) | 43131 « Retenue CNPS » (retenue) |
| C2 | PVID patronal | `arrondi(baseCnps × tauxPvidPat %)` | base CNPS | 4,2 % (`tauxPvidPat`) | 66412 « PVID PAT » (charge patronale) |
| C3 | Prestations familiales | `arrondi(baseCnps × tauxPf %)` | base CNPS | 7 % (`tauxPf`) | 66411 « PF » |
| C4 | Accidents du travail | `arrondi(baseCnps × tauxAtmp %)` | base CNPS | 1,75 % (`tauxAtmp`) | 66413 « ATMP » |
| C5 | CFC salarié | `arrondi(brutTaxable × tauxCfcSal %)` | base taxable, **non plafonnée** | 1 % (`tauxCfcSal`) | 44724 « CFC SAL » (retenue) |
| C6 | CFC patronal | `arrondi(brutTaxable × tauxCfcPat %)` | base taxable | 1,5 % (`tauxCfcPat`) | 64132 « CFC PAT » |
| C7 | FNE | `arrondi(brutTaxable × tauxFne %)` | base taxable | 1 % (`tauxFne`) | 64131 « F.N.E. » |

### C8. Total des charges patronales
- **Formule** : `chargesPatronales = PF + PVID patronal + ATMP + FNE + CFC patronal`.
- **Calcul** : `lib/paie.ts`. Stocké dans `details.chargesPatronales`. Recalculé sur le bulletin écran et le PDF par somme des colonnes « Charge patronale », avec repli si `details` manque.
- **Utilisé où** : bulletin écran (`components/BulletinCard.tsx`) et PDF (`paiePdf.ts`), case « Charges patronales » et total de colonne ; e-mail (colonne « Ch. patron. »). Ce total n'apparaît sur **aucune tuile**. La tuile du tableau de bord « Masse brute & Charges » n'affiche que le brut.
- **Exemple (calcul manuel, aucun test ne le vérifie)** : ABAMI, brut 106 950 → PF 7 487 + PVID 4 492 + ATMP 1 872 + FNE 1 070 + CFC 1 604 = **16 525**.

### C9. Codes et libellés des rubriques
- Gains : 66111 Salaire du mois, 66112 Forfait heures supplémentaires, 66116 Ancienneté, 6613 Congés payés, 66121 Prime de transport, 66122 Prime d'assiduité, 6631 Indemnité de logement, 66125 Primes fixes, `PRIME` pour les lignes du registre.
- Retenues et charges : 43131, 66411, 66412, 66413, 44721 IRPP, 44722 CAC, 44723 TDL, 44724 CFC SAL, 64131 FNE, 64132 CFC PAT, 44725 RAV, puis Sanctions, Absences, Dettes de soins, Acompte et Mutuelle sans code, et `RETENUE` pour le registre.
- **[Code]** `lib/paie.ts`. La colonne *Taux* du PDF affiche « barème » pour les codes 44721, 44723 et 44725 (`paiePdf.ts : tauxDe`).
- **Utilisé où** : bulletin écran, PDF, e-mail. Tout le bulletin est construit sur cette liste, même avec des montants à zéro.

---

## 3. Impôts : IRPP, CAC, TDL, RAV (le CFC est en C5 et C6)

### I1. Base IRPP mensuelle
- **Formule** : `baseIrppMensuelle = max(0, brutTaxable × (1 − abattementIrppPct ÷ 100) − CNPS salarié − abattementIrppAnnuel ÷ 12)`.
- **Paramètres** : `abattementIrppPct` = 30 % ; `abattementIrppAnnuel` = 500 000, soit 41 666,67 par mois **[Barème]**. La valeur de repli 500 000 est écrite à **six endroits** du code (voir §13).
- **Calcul** : `lib/paie.ts`.
- **Exemple** : `paie.test.ts`, 150 000 × 0,7 − 6 300 − 41 667 = 57 033 par mois.

### I2. Tranches IRPP annualisées
- **Formule** : les tranches sont saisies **par mois**. Le moteur multiplie chaque plafond par 12 (`jusqua × 12`) et garde le taux.
- **Paramètres** : `baremes.irppBrackets[] = { jusqua (null = tranche ouverte), taux }` **[Barème]**. Par défaut : 166 667 → 10 % ; 250 000 → 15 % ; 416 667 → 25 % ; au-delà → 35 %, soit 2 000 004 / 3 000 000 / 5 000 004 par an.
- **Calcul** : `lib/paie.ts` (`tranchesAnnuelles`).
- **Utilisé où** : écran Barème, tableau « Tranches IRPP », colonnes « Jusqu'à (par mois) » et « (par an) ».

### I3. IRPP
- **Formule** : `IRPP = arrondi( computeIrpp(baseIrppMensuelle × 12, tranches annuelles) ÷ 12 )`. `computeIrpp` est progressif par tranches : pour chaque tranche, `(min(base, plafond) − plancher) × taux`, puis la somme est arrondie.
- **Calcul** : `lib/paie.ts : computeIrpp`, `computeBulletin`.
- **Utilisé où** : ligne 44721 « IRPP » (base affichée = base taxable, taux affiché « barème ») ; charges salariales ; `details.irpp`.
- **Exemples** :
  - `paie.test.ts` : 684 400 par an × 10 % ÷ 12 = **5 703** ;
  - `computeIrpp(5 000 000, [2 M à 10 %, 3 M à 15 %, reste à 25 %])` = **850 000** ;
  - base nulle → 0.
- **Note** : avec l'abattement annuel, un salaire de 62 000 donne une base négative, donc 0 d'IRPP. Il n'existe aucune règle explicite d'exonération des bas salaires.

### I4. CAC (centimes additionnels communaux)
- **Formule** : `CAC = arrondi(IRPP × tauxCac %)`, calculé sur l'IRPP déjà arrondi.
- **Paramètres** : `tauxCac` = 10 % **[Barème]**.
- **Utilisé où** : ligne 44722 (base = IRPP) ; charges salariales.
- **Exemple** : `paie.test.ts`, 10 % de 5 703 = **570**.

### I5. TDL (taxe de développement local)
- **Formule** : barème forfaitaire par paliers, sur le **salaire de base** (P5, sans les primes) : le premier palier dont le plafond (inclus) est ≥ salaire de base donne le montant. Si `tdlActif = false`, la TDL vaut 0.
- **Paliers [Code]** `lib/paie.ts : TDL_BAREME` :

  | Salaire de base jusqu'à | 62 000 | 75 000 | 100 000 | 125 000 | 150 000 | 200 000 | 250 000 | 300 000 | 500 000 | 750 000 | 1 000 000 | 1 500 000 | 2 000 000 | au-delà |
  |---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
  | TDL | 0 | 250 | 500 | 750 | 1 000 | 1 250 | 1 500 | 2 000 | 2 250 | 2 500 | 2 750 | 3 000 | 4 000 | 4 500 |

- **Paramètres** : seul l'interrupteur `baremes.tdlActif` est dans le **[Barème]** (vrai par défaut). Les **paliers ne sont ni versionnés ni modifiables**.
- **Utilisé où** : ligne 44723 (base = salaire de base) ; charges salariales.
- **Exemples** : `paie.test.ts`, 150 000 → **1 000** ; bornes 62 000 → 0 et 62 001 → 250 ; avec l'interrupteur coupé → 0.

### I6. RAV (redevance audiovisuelle)
- **Formule** : même mécanisme de paliers, sur la **base taxable** (P9). Si `ravActif = false`, la RAV vaut 0.
- **Paliers [Code]** `lib/paie.ts : RAV_BAREME` :

  | Base taxable jusqu'à | 50 000 | 100 000 | 200 000 | 300 000 | 400 000 | 500 000 | 600 000 | 700 000 | 800 000 | 900 000 | 1 000 000 | au-delà |
  |---|---|---|---|---|---|---|---|---|---|---|---|---|
  | RAV | 0 | 750 | 1 950 | 3 250 | 4 550 | 5 850 | 7 150 | 8 450 | 9 750 | 11 050 | 12 350 | 13 000 |

- **Paramètres** : interrupteur `baremes.ravActif` **[Barème]** ; paliers **[Code]**.
- **Utilisé où** : ligne 44725 ; charges salariales.
- **Exemples** : `paie.test.ts`, 150 000 → **1 950** ; 5 000 000 → 13 000.

---

## 4. Temps, absences et congés

Moteur pur : `convex/lib/absences.ts`. Utilisé par `convex/planning.ts` (écran Planning) et `lib/calculBulletins.ts` (paie).

### T1. Jours d'une absence
- **Formule** : `jours = (dateFin − dateDebut) en jours + 1`, en jours **calendaires**, bornes incluses, minimum 0. Les week-ends et jours fériés sont comptés.
- **Calcul** : `lib/absences.ts : joursCalendaires`. La valeur est stockée dans `absences.jours` à l'ajout et à la modification. **Doublon côté navigateur** : `pages/Planning.tsx` (aperçu « n jours » du formulaire).
- **Utilisé où** : Planning (liste des absences, total des jours).

### T2. Ventilation d'une absence par mois
- **Formule** : `joursDansMois = jours calendaires de [max(début, 1er du mois) ; min(fin, dernier jour du mois)]`.
- **Calcul** : `lib/absences.ts : joursDansMois`, `bornesMois`, `periodesTouchees` (au plus 120 mois).
- **Utilisé où** : agrégats mensuels (T4, T5) ; liste des mois à recaler après une modification (T10).

### T3. Absence payée ou non par défaut
- **Formule** : congé payé → payé ; maladie → payé ; absence non justifiée → non payé ; autre → non payé. La valeur reste modifiable à la saisie.
- **Paramètres** : **[Code]** `lib/absences.ts : PAYE_PAR_DEFAUT`.

### T4. Absences non payées et payées du mois
- **Formule** : somme de `joursDansMois` des événements autres que congé payé, séparés selon `paye`.
- **Calcul** : `lib/absences.ts : resumeMois`.
- **Utilisé où** : Planning, tuiles « Absences non payées » (déduites des jours travaillés) et « Absences payées & maladie » ; colonnes de l'onglet Soldes. Les absences non payées alimentent `saisiesMensuelles.absencesJours`, un champ **qui n'entre dans aucun calcul de paie** (voir Incohérences).

### T5. Congés pris (du mois et cumulés)
- **Formule** :
  - `congesPrisMois` = Σ `joursDansMois` des congés payés ;
  - `congesPrisCumul` = Σ des jours de congé payé depuis le début de chaque événement jusqu'à la fin du mois, **tous historiques confondus**, sans remise à zéro annuelle.
- **Calcul** : `lib/absences.ts : resumeMois`.
- **Utilisé où** : P6 (indemnité) ; bulletin (case « Congés pris ») ; Planning (tuile « Congés pris ce mois », colonnes) ; volet de saisie du Récapitulatif (« Congés pris », lecture seule).

### T6. Mois de service
- **Formule** : avec une date d'embauche, `(année − année d'embauche) × 12 + (mois − mois d'embauche) + 1`, minimum 0. Le mois d'embauche compte en entier, quel que soit le jour. **Sans date d'embauche** : numéro du mois dans l'année (janvier = 1), ce qui revient à une acquisition depuis janvier.
- **Calcul** : `lib/absences.ts : moisDeService`.

### T7. Congés acquis (cumul)
- **Formule** : `congesAcquis = arrondi au dixième(congesInitial + congesParMois × moisDeService)`.
- **Paramètres** : `employes.congesInitial` (« Congés initiaux », solde reporté à l'arrivée) **[Fiche]** ; `parametresEntreprise.congesParMois` = 1,5 par défaut, de 0 à 10 **[Param.]**. Le repli 1,5 est dans `lib/absences.ts : CONGES_PAR_MOIS_DEFAUT` **[Code]**.
- **Utilisé où** : bulletin (case « Congés acquis ») ; Planning (colonne « Acquis »).

### T8. Solde de congés (reste à prendre)
- **Formule** : `soldeConges = arrondi au dixième(congesAcquis − congesPrisCumul)`. Il peut être négatif, et s'affiche alors en rouge dans le Planning. Le moteur de paie a un repli `max(0, acquis − pris)`, mais la paie reçoit toujours la valeur du planning.
- **Calcul** : `lib/absences.ts : resumeMois`, `lib/paie.ts` (repli).
- **Utilisé où** : bulletin (case « Reste à prendre ») ; Planning (colonne « Solde »).
- **Exemple** : `paie.test.ts`, acquis 9, pris 0 → 9.

### T9. Jours travaillés selon le planning
- **Formule** : `joursTravailles = max(0, joursBase − absences non payées − congés pris du mois)`. La base est fixe (30 par défaut), quel que soit le nombre réel de jours du mois.
- **Calcul** : `lib/absences.ts : resumeMois`.
- **Utilisé où** : P4 quand il n'y a pas de saisie ; T10 ; Planning (colonne « Jours travaillés x / joursBase »).

### T10. Recalage de la paie sur le planning
- **Formule** :
  - à chaque ajout, modification ou suppression d'absence, pour chaque mois touché **non clôturé**, `saisie.joursTravailles ← T9` et `saisie.absencesJours ← absences non payées` ; la ligne de saisie est créée si besoin ;
  - « Synchroniser la paie » fait la même chose pour tous les actifs d'un mois ;
  - indicateur « à jour » / « à recaler » : `saisie.joursTravailles = T9` et `saisie.absencesJours = T4`. Sans saisie, l'indicateur est vrai si T9 = joursBase et qu'il n'y a aucune absence non payée.
- **Calcul** : `convex/planning.ts : appliquerAuxSaisies`, `synchroniserPaie`, `vueMensuelle.paieSynchronisee`.
- **Utilisé où** : Planning, colonne d'état de la paie et compteur « non synchronisés ».
- **Note** : le recalage **écrase** un nombre de jours travaillés saisi à la main dans le Récapitulatif.

### T11. Tuiles du Planning
- Σ absences non payées, Σ absences payées, Σ congés pris du mois, nombre d'employés ayant au moins un événement dans le mois (`pages/Planning.tsx : tot`).

---

## 5. Primes et retenues

### R1. Primes du registre → gains
- **Formule** : chaque ligne `type = "prime"` de l'employé pour le mois devient un gain `PRIME` (montant arrondi, lignes nulles ignorées). Elle entre dans P7, donc dans le Total 1 et **dans toutes les bases imposables**.
- **Calcul** : `lib/calculBulletins.ts : extrasPour` → `lib/paie.ts`.

### R2. Retenues du registre → retenues
- **Formule** : chaque ligne `type = "charge"` devient une retenue `RETENUE`, après impôts. Elle **ne réduit aucune base**.
- **Calcul** : idem.

### R3. Totaux du registre
- **Formule** : total des primes, total des retenues, nombre d'employés concernés ; par employé : primes, retenues, et un solde `primes − retenues`.
- **Calcul** : `convex/primes.ts : liste` ; `pages/Primes.tsx` (totaux des lignes filtrées).
- **Utilisé où** : Primes & charges, tuiles « Primes du mois », « Retenues du mois », « Effet net sur la paie », « Employés concernés », et récapitulatif par employé.

### R4. « Effet net sur la paie » (tuile)
- **Formule affichée** : `primes − retenues`.
- **Note** : ce n'est pas l'effet réel sur le net. Une prime est soumise à CNPS, IRPP, CAC, CFC et éventuellement RAV, TDL et mutuelle (voir Incohérences).

### R5. Contrôles du registre
- Montant strictement positif, arrondi à l'entier, libellé obligatoire, date au format AAAA-MM-JJ, mois **non clôturé**. La date de la ligne n'est pas contrôlée par rapport à la période.
- `convex/primes.ts : ajouter`, `modifier`, `supprimer`.

### R6. Saisie mensuelle : bornes et garde-fou
- **Formule** :
  - jours travaillés de 0 à 31 ;
  - mutuelle de 0 à 100 % ;
  - tout montant ≥ 0 et fini ;
  - tout montant (sauf jours, mutuelle et absencesJours) ≤ `plafondSaisie`, sinon la saisie est refusée ;
  - mois clôturé → lecture seule.
- **Paramètres** : `reglages.plafondSaisie` = 100 000 000 par défaut, au moins 1 000 000 **[Réglage]**.
- **Calcul** : `convex/payroll.ts : saisirMois`. Bornes reproduites dans le navigateur : `recap/commun.tsx : set`, `validerValeurs`.
- **Valeurs par défaut d'une ligne sans saisie, dans le navigateur** : jours travaillés **30**, tout le reste à 0 (`recap/commun.tsx : DEFAUT`). Le serveur, lui, prend les jours du planning (voir Incohérences).

---

## 6. Trésorerie / grand livre journalier

Moteur pur : `convex/lib/tresorerie.ts`. Serveur : `convex/financier.ts`. Écran : `src/pages/Financier.tsx` (calcul en direct avec les mêmes fonctions).

### F1. Mouvements
- **Formule** : `mouvements[bloc][ligne]` = montant arrondi. La structure est figée **[Code]** (`BLOCS`) en 8 blocs :
  - Recettes POITIERS : Espèces, Dépôt chèque, Carte Visa, Retrait, OM du jour, Retrait OM, MOMO du jour, Retrait MOMO ;
  - Pharmacie Les Lilas : idem sans Carte Visa ;
  - Carte Visa : Dépôt, Retrait ;
  - E DR TIM Finance, Médicaments, Biodiagnostic et MED-Esthetic : Espèces, Dépôt chèque, Retrait ;
  - Autres lignes : TDM, Partage, Quantiferon, TEPSCAN (entrées seulement).

### F2. Solde d'ouverture
- **Formule** : si des soldes J0 ont été saisis à la main pour la journée, on les prend. Sinon, on reprend les soldes de la **dernière journée enregistrée avant** cette date, ce qui saute les jours sans saisie.
- **Calcul** : `financier.ts : ouverturePour`.

### F3. Solde J par canal
- **Formule** : `solde = arrondi(J-1) + Σ entrées du canal − Σ retraits du canal`. La définition des 12 soldes est **[Code]** (`SOLDES`) :

  | Solde | Formule |
  |---|---|
  | F3 POITIERS | J-1 + Espèces + Dépôt chèque + Carte Visa − Retrait |
  | OM POITIERS | J-1 + OM − Retrait OM |
  | MOMO POITIERS | J-1 + MOMO − Retrait MOMO |
  | F3 LES LILAS | J-1 + Espèces + Dépôt chèque − Retrait |
  | OM LES LILAS | J-1 + OM − Retrait OM |
  | MOMO LES LILAS | J-1 + MOMO − Retrait MOMO |
  | E DR TIM | **report simple de J-1**, aucun mouvement ne le fait varier |
  | CARTE VISA | J-1 + Dépôt − Retrait |
  | E DR TIM FINANCE | J-1 + Espèces + Dépôt chèque − Retrait |
  | Médicaments, Biodiagnostic, MED-Esthetic | J-1 + Espèces + Dépôt chèque − Retrait (soldes secondaires) |

  Les 9 premiers sont les « soldes principaux » (cartes J0).
- **Calcul** : `lib/tresorerie.ts : calculerSoldes`. Le libellé de la formule vient de `formule(s)` (info-bulle et ligne « = … » de l'écran).
- **Utilisé où** :
  - Financier : cartes de soldes, saisie J0 ;
  - tableau de bord : tuile « Solde Trésorerie F3 » = F3 POITIERS de la **dernière journée enregistrée** ;
  - API d'export (`journeePourApi`).
- **Exemples** : `tests/tresorerie.test.ts`. F3 Poitiers : 100 000 + 50 000 + 20 000 + 10 000 − 30 000 = **150 000**. OM : 24 000 ; MOMO sans ouverture : 5 000 ; F3 Lilas : 20 000 ; E DR TIM reporté : 500 000 ; Carte Visa : 50 000 ; E DR TIM Finance : 9 000 ; report J → J+1 : 150 500.

### F4. Recette totale du jour
- **Formule** : somme de **toutes les entrées de tous les blocs**, retraits exclus. « Autres lignes » est inclus, et Carte Visa compte deux fois : la ligne Carte Visa de Poitiers **et** le dépôt du bloc Carte Visa.
- **Calcul** : `lib/tresorerie.ts : recetteTotale`. Stockée dans `journeesFinancieres.recetteTotale`.
- **Utilisé où** : Financier (en-tête, historique sur 14 jours, sparkline) ; tableau de bord (badge « Journée saisie / Non saisie », note « Dernière recette ») ; API d'export.
- **Exemple** : `tresorerie.test.ts`, « recette totale = somme des entrées, retraits exclus ».

### F5. Report en chaîne
- **Formule** : après chaque enregistrement, toutes les journées suivantes sont recalculées dans l'ordre (ouverture = soldes de la veille enregistrée, sauf J0 manuel).
- **Calcul** : `financier.ts : recalculerSuivantes`.
- **Note** : les journées suivantes sont réécrites **même si elles appartiennent à un mois clôturé** (voir Incohérences).

### F6. Sous-totaux d'un bloc (écran)
- Σ entrées et Σ retraits de la caisse active, plus un indicateur « a des données » par caisse (`pages/Financier.tsx`).

### F7. KPI financier du tableau de bord
- `recetteDuJour` = recette de la journée d'**aujourd'hui en date UTC** ; `derniere` = date, recette et F3 POITIERS de la dernière journée (`financier.ts : kpi`).

### F8. Historique
- Les 14 dernières journées jusqu'à la date choisie (`financier.ts : historique`). L'échelle de la sparkline est fixée par la recette maximale.

### F9 et F10 : verrou et clôture, voir D8 et D7.

---

## 7. Caisse et primes médecins (module Statistiques)

Moteur pur : `convex/lib/stats.ts`. Serveur : `convex/stats.ts`. Écran : `src/pages/Statistiques.tsx`.

### S1. Total espèces
- **Formule** : `caissePP + scanner + quantiferon + tenofovir + greenEnergy + esthetique + therapieVie + therapieSommeil`. La liste des 8 postes est **[Code]** (`POSTES_ESPECES`).
- **Calcul** : `lib/stats.ts : totalEspeces`.
- **Utilisé où** : Statistiques (colonne et tuile « Total espèces », formulaire, export CSV).
- **Exemple** : `tests/stats.test.ts`, l1 = **474 000**.

### S2. Chiffre d'affaires (caisse)
- **Formule** : `CA = total espèces + assurance + TEP scan`. Les « sorties du jour » ne sont pas déduites.
- **Calcul** : `lib/stats.ts : chiffreAffaires`.
- **Utilisé où** :
  - Statistiques : tuile vedette « Chiffre d'affaires », colonne, formulaire, message d'ajout, export CSV ;
  - graphe « CA 6 mois » ;
  - tableau de bord : tuile « Chiffre d'affaires du mois » et barre « Chiffre d'aff. ».
- **Exemples** : `stats.test.ts`, 474 000 + 90 000 + 250 000 = **814 000** ; les sorties ne sont pas comptées.

### S3. Totaux du mois (caisse)
- **Formule** : Σ par poste, Σ total espèces, Σ CA, Σ sorties du jour. La tuile « Assurance + TEP scan » = Σ assurance + Σ TEP scan.
- **Calcul** : `lib/stats.ts : totauxCaisse`.
- **Exemple** : `stats.test.ts`, espèces **609 000**, CA **959 000**.

### S4. CA par mois (graphe)
- **Formule** : pour les 6 mois jusqu'à la période, Σ CA et Σ espèces des lignes du mois.
- **Calcul** : `stats.ts : graphes` (avec sa propre fonction `moisPrecedents`, doublon de `lib/audit.ts : derniersMois`).

### S5. Montant d'une prime médecin
- **Formule** : `montant = arrondi(actes × montantUnitaire)`. Le montant est stocké.
- **Calcul** : `lib/stats.ts : montantTotalPrime` (serveur à l'enregistrement et à l'import ; navigateur pour l'aperçu).
- **Exemple** : `stats.test.ts`, 12 × 15 000 = **180 000**.

### S6. Totaux des primes médecins
- **Formule** : total du mois, total par catégorie (6 catégories **[Code]** `CATEGORIES_PRIMES`) ; à l'écran, total et nombre d'actes des lignes filtrées.
- **Calcul** : `stats.ts : primes`, `graphes` ; `pages/Statistiques.tsx`.
- **Utilisé où** : Statistiques (tuile « Primes médecins », graphe par catégorie) ; tableau de bord (barre « Primes méd. », note de la tuile « Masse brute & Charges »).

### S7. KPI statistiques
- `stats.ts : kpi` : CA du mois, nombre de lignes, total des primes.

### S8. Délai de modification d'une ligne de caisse ou de prime : voir D9.

### S9. Lecture des nombres en CSV
- Espaces supprimés, virgule décimale acceptée. Montants **non arrondis** pour la caisse et les primes (`lib/stats.ts : nombre`), **arrondis** pour l'audit (`lib/audit.ts : nombre`).

---

## 8. Audit (module cloisonné : auditeur externe et DG)

Moteur pur : `convex/lib/audit.ts`. Serveur : `convex/audit.ts`. Écran : `src/pages/Audit.tsx`.

### A1. Montant d'une ligne
- Saisi directement, arrondi à l'entier (`audit.ts : enregistrerLigne`, `importerLignes`). Il n'y a ni actes ni prix unitaire, contrairement aux primes des Statistiques.

### A2. Total d'une catégorie, du mois et par catégorie
- **Formule** : Σ des montants arrondis. 14 catégories **[Code]** `CATEGORIES_AUDIT`, dont `masse_salariale`, `heures_supplementaires`, `sanctions` et `conges`, toutes **saisies à la main**.
- **Calcul** : `lib/audit.ts : totalLignes` ; `audit.ts : lignes`, `lignesDuMois`, `resume`.
- **Utilisé où** : Audit (tuile « Total audité ce mois », tableau par catégorie) ; tableau de bord (bloc « Audit confidentiel » : total du mois et du mois précédent).

### A3. Variation d'un mois sur l'autre
- **Formule** : `delta = courant − précédent` ; `pct = arrondi au dixième(delta ÷ précédent × 100)`, ou rien si le mois précédent vaut 0.
- **Calcul** : `lib/audit.ts : variation`. Formule **recopiée** dans `pages/Audit.tsx` pour les totaux généraux.
- **Exemples** : `tests/audit.test.ts`, +25 % ; depuis 0, pas de pourcentage.

### A4. Variation sur un an
- Même formule, comparée au même mois de l'année précédente (`audit.ts : resume`, `variationAn`).

### A5. Total des salaires reçus
- **Formule** : pour les 6, 12 ou 24 derniers mois, Σ brut, Σ retenues et Σ net des bulletins (figés si le mois est clôturé, sinon calculés en direct), avec variation du net d'un mois sur l'autre.
- **Calcul** : `audit.ts : totalSalaires` (reprend P1 à P17).
- **Utilisé où** : Audit, onglet Salaires.

### A6. Graphes
- Total par catégorie du mois ; net versé par mois ; total audité par mois. L'horizon est choisi à l'écran (6, 12 ou 24 mois, borné de 1 à 24) et mémorisé dans le navigateur.

### A7. Rapports rédigés
- Nombre de catégories ayant un rapport ce mois sur 14. Sur le tableau de bord, la jauge vaut `arrondi(rédigés ÷ 14 × 100)`.

### A8. Lecture CSV et export
- Les lignes dont la désignation commence par « total » sont ignorées à l'import. L'export ajoute une ligne « TOTAL GÉNÉRAL ».

---

## 9. Commandes et interventions

Moteur pur : `convex/lib/commandes.ts`. Serveur : `convex/commandes.ts`, `convex/interventions.ts`.

### K1. Total d'une ligne
- `arrondi(quantité × prix unitaire)` (`lib/commandes.ts : totalLigne`). Contrôle à la création : quantité > 0 et prix ≥ 0.

### K2. Total d'une commande
- Σ des totaux de lignes (`totalCommande`).
- **Utilisé où** : Commandes (liste, détail, formulaire, KPI) ; export CSV (« Prix total »).
- **Exemple** : `tests/commandes.test.ts`, 5 000 + 18 900 + 25 000 = **48 900**.

### K3. Comparaison avec la commande précédente
- **Précédente** = commande du **même type** (médicale ou fourniture) de date antérieure. À date égale, celle qui a été créée avant.
- Les produits sont comparés sur leur nom normalisé (sans casse, espaces réduits). Le résultat donne les produits ajoutés, retirés, modifiés (quantité ou prix différents) et inchangés ; `variation = total après − total avant` ; `variationPct = arrondi au dixième(variation ÷ total avant × 100)`.
- **Calcul** : `lib/commandes.ts : comparer` ; `commandes.ts : precedente`, `detail`.
- **Utilisé où** : Commandes, bloc de comparaison dans le détail.
- **Exemple** : `commandes.test.ts`, 46 900 − 48 900 = **−2 000** (−4,1 %).

### K4. Référence séquentielle
- `CMD-AAAA-NNN`, où NNN = nombre de commandes de l'année (tous types) + 1. Même principe pour `INT-AAAA-NNN` (interventions).
- **Exemple** : `commandes.test.ts`, `CMD-2026-007`.

### K5. KPI de l'écran Commandes
- Pour le type sélectionné : nombre total, nombre en attente, nombre validées ou livrées, et « Budget engagé » = Σ des totaux de **toutes** les commandes du type, **rejetées comprises** (`pages/Commandes.tsx`).

### K6. Interventions
- Total = Σ `arrondi(quantité × prix unitaire)`. La formule est **réécrite** dans `convex/interventions.ts` et `pages/Interventions.tsx`.
- Montant engagé = Σ des totaux des interventions **ouvertes et en cours** seulement.

### K7. Circuit de validation
- en attente → validée ou rejetée (motif obligatoire pour un rejet) ; validée → livrée.
- La validation et le rejet exigent le droit `/commandes/validation`. Les horodatages `valideLe` et `livreLe` sont posés automatiquement.

---

## 10. Comptes rendus et présence

Moteur pur : `convex/lib/fenetre.ts`. Serveur : `convex/comptesRendus.ts`.

### CR1. Heure de Douala
- **Formule** : heure locale = UTC + 60 minutes, sans heure d'été (`OFFSET_DOUALA_MIN = 60` **[Code]**). La date du jour se calcule à Douala (`dateDouala`).
- **Exemples** : `tests/fenetre.test.ts`, 16 h à Douala = 15 h UTC ; 23 h 30 UTC = le lendemain à Douala.

### CR2. Jour ouvrable
- Du lundi au vendredi, plus le samedi si `crSamedi` est activé **[Réglage]**. Les jours fériés ne sont pas gérés.

### CR3. Dans la fenêtre
- **Formule** : jour ouvrable **et** `ouverture ≤ heure < fermeture`. Seule l'heure compte : 19 h 59 est dans la fenêtre, 20 h 00 n'y est plus.
- **Paramètres** : `crHeureOuverture` = 16 et `crHeureFermeture` = 20 **[Réglage]**.
- **Exemples** : `fenetre.test.ts`, 15 h 30 hors fenêtre ; 16 h 00 dans la fenêtre ; 20 h 00 hors fenêtre ; samedi hors fenêtre.

### CR4. Points d'un compte rendu
- **Formule** : `horsFenetre = NON(date soumise = aujourd'hui à Douala ET maintenant dans la fenêtre)`. Les points valent **1** dans la fenêtre et **0** hors fenêtre. Ils sont **recalculés à chaque nouvelle soumission** du même jour.
- **Paramètres** : `POINTS_DANS_FENETRE = 1` et `POINTS_HORS_FENETRE = 0` **[Code]** `lib/fenetre.ts`.
- **Utilisé où** : Comptes rendus (message « +1 point de présence », badge hors fenêtre, historique) ; vue superviseur.
- **Exemple** : `fenetre.test.ts`, 1 point dans la fenêtre, 0 hors fenêtre.

### CR5. Score de présence
- **Formule** : Σ des points de **tous** les comptes rendus du membre, depuis toujours, sans période.
- **Calcul** : `comptesRendus.ts : monEspace`, `vueSuperviseur`.
- **Utilisé où** : Comptes rendus (« Mon score d'assiduité », colonne Score du superviseur) ; tableau de bord (« Points de présence »).

### CR6. Taux de participation du jour
- **Formule** : `arrondi(membres ayant soumis ÷ membres actifs × 100)`. Le dénominateur compte **tous les utilisateurs actifs**, quel que soit leur rôle et même un jour non ouvrable.
- **Utilisé où** : vue superviseur (« x % de participation »), avec le nombre de comptes rendus hors fenêtre.

### CR7. Fin de fenêtre, prochaine ouverture, compte à rebours
- `finFenetre` = heure de fermeture du jour si l'on est dans la fenêtre. `prochaineOuverture` = heure d'ouverture du prochain jour ouvrable, recherchée sur au plus 7 jours. `dureeLisible` produit le format « 1h 46min ».
- **Exemple** : `fenetre.test.ts`, vendredi 21 h → lundi 16 h.

### CR8. Règles de soumission
- Une date future est refusée ; un contenu vide aussi. Une soumission d'un jour passé est acceptée avec 0 point. Un compte rendu validé n'est plus modifiable.

---

## 11. Dates et périodes, clôtures, verrous et délais

### D1. Période courante
- `AAAA-MM` tiré de `new Date().toISOString()`, donc en **UTC** (`src/lib/format.ts : periodeCourante`). C'est la période proposée par défaut sur tous les écrans à période.

### D2. Bornes du bulletin
- `du = 01/MM/AAAA` ; `au = dernier jour du mois/MM/AAAA` (`lib/periode.ts : bornesPeriode`, `joursDuMois`).
- **Utilisé où** : bulletin écran et PDF (« Période du … au … »).

### D3. Date de paiement
- **Formule** : `jj/MM+1/AAAA`, où `jj = min(max(jourPaiement, 1), 28)`. En décembre, on passe à janvier de l'année suivante.
- **Paramètres** : `parametresEntreprise.jourPaiement` = 5 par défaut, de 1 à 28 **[Param.]**.
- **Calcul** : `lib/periode.ts : bornesPeriode`, appelé par `calculBulletins` avec le paramètre.
- **Utilisé où** : bulletin écran et PDF (« Paiement le … par banque », bandeau du net) ; tuile « Effectif payé » du Récapitulatif. Cette tuile appelle `bornesPeriode(periode)` **sans** le paramètre, donc avec 5 fixe (voir Incohérences).

### D4. Jours calendaires du mois
- `joursDuMois`, affiché dans la note de la tuile « Effectif payé » (« 30 jours calendaires »). Ce nombre n'intervient dans **aucun** calcul de paie, qui reste sur une base de 30.

### D5. Libellé de période
- « Septembre 2026 » (`lib/periode.ts : libellePeriode`), « septembre 2026 » dans le courrier (`lib/courrier.ts`, autre fonction).

### D6. Clôture de la paie et ses verrous
- **Formule** : « Générer et clôturer le mois » est irréversible et demande de taper le mot-clé « CLOTURER ». La clôture fige les bulletins (P22) et retient le barème. Ensuite :
  - la saisie mensuelle est refusée ;
  - le registre Primes & charges est refusé ;
  - le planning ne recale plus ce mois ;
  - le bulletin perd le filigrane « PROVISOIRE » et porte « BULLETIN VALIDÉ le … ».
- **Paramètres** : `reglages.pdfAutoCloture` (désactivé par défaut) **[Réglage]**. S'il est activé, les PDF sont générés et archivés juste après la clôture.
- **Calcul** : `payroll.ts : genererEtCloturer`, `saisirMois` ; `primes.ts : verifierOuvert` ; `planning.ts : appliquerAuxSaisies` ; `paiePdf.ts`.

### D7. Clôture financière
- Toutes les journées du mois deviennent immuables et les verrous sont levés (`financier.ts : cloturerMois`). Rien n'oblige à clôturer les mois dans l'ordre.

### D8. Verrou d'édition du grand livre
- **Formule** : un verrou est actif si `maintenant − verrouAt < verrouFinancierMin minutes`. Un enregistrement d'une autre personne est alors refusé. Une purge hebdomadaire (dimanche, 03:00 UTC) efface les verrous expirés.
- **Paramètres** : `reglages.verrouFinancierMin` = 15, de 1 à 240 **[Réglage]**.
- **Calcul** : `financier.ts : verrouActif`, `purgerVerrousExpires` ; `crons.ts`.

### D9. Délai de modification de la caisse et des primes médecins
- **Formule** : une ligne reste modifiable ou supprimable tant que `maintenant − création ≤ verrouCaisseMin minutes`. Au-delà, seul le droit « Caisse & primes : modifier après le délai » (`/statistiques/deverrouillage`) le permet, et l'action est journalisée (`caisse_modification_tardive`). Le délai part de la **création** : une modification ne le relance pas.
- **Paramètres** : `reglages.verrouCaisseMin` = 60, de 5 à 1 440 **[Réglage]**.
- **Calcul** : `stats.ts : controlerVerrou` ; reproduit à l'écran dans `pages/Statistiques.tsx : verrouillee` (cadenas, rafraîchi chaque minute).

### D10. Contrôle du barème officiel
- Cron quotidien à 06:00 UTC (07:00 à Douala), plus le bouton « Vérifier la source ». Si `BAREME_SOURCE_URL` est définie, le contrôle teste seulement que la source répond (HTTP) ; la **comparaison n'est pas implémentée**. Il met à jour `controleLe` et journalise le résultat (`bareme.ts : controlerBaremeOfficiel`).

### D11. Mois précédent et derniers mois
- `moisPrecedent`, `derniersMois(periode, n)` (`lib/audit.ts`) et `moisPrecedents` (`stats.ts`, doublon).
- **Exemples** : `audit.test.ts`, janvier 2026 → décembre 2025 ; 3 derniers mois.

### D12. Date d'effet d'un barème
- Une nouvelle version s'applique aux périodes dont le **1er du mois** est ≥ sa date d'effet (P1). À l'écran, la date d'effet doit être postérieure à celle de la version de départ ; **le serveur ne contrôle que le format**.

### D13. Nom du fichier PDF
- `ENTREPRISE - Nom employé - période`, caractères interdits remplacés par « - » (`lib/periode.ts : nomFichierPdf`).

### D14. Délais et dates des commandes et comptes rendus
- Horodatages ISO (UTC) : `valideLe`, `livreLe`, commentaires. La date d'un compte rendu est le jour à Douala (CR1).

---

## 12. L'écran Barème actuel (`src/pages/Bareme.tsx`)

**Organisation** : une seule page, sans onglets.

1. **En-tête** « Barème CNPS / CGI ». Il contient un drapeau « Applicable à {mois} : version du … » (ou « Aucune version applicable »), un sélecteur de période, le bouton « Vérifier la source » (planifie D10) et le bouton « Nouvelle version », réservé au droit Faire sur `/bareme`.
2. **Quatre tuiles** :
   - « Version applicable · {mois} » : date d'effet et source ;
   - « Versions » : nombre de versions et date de la plus récente ;
   - « Source officielle » : configurée ou non, selon `BAREME_SOURCE_URL` ;
   - « Dernier contrôle » : date et détail du dernier contrôle journalisé.
3. **Tableau des versions**, des plus récentes aux plus anciennes : effective depuis (avec la mention « applicable à … »), source, plafond CNPS, PVID salarié, CFC salarié, CAC, **nombre** de tranches IRPP, contrôlée le, statut (Active ou Brouillon). Un clic sur une ligne la sélectionne. Le nombre de lignes visibles est réglable.
4. **Détail de la version sélectionnée** (par défaut, celle qui s'applique à la période), en familles :
   - **Cotisations CNPS** : plafond mensuel, PVID salarié, PVID employeur, prestations familiales, ATMP. Description affichée : « Base = brut plafonné ».
   - **CFC & FNE** : CFC salarié, CFC employeur, FNE. « Base = brut taxable (transport exonéré). »
   - **IRPP & CAC** : abattement forfaitaire en %, abattement annuel en FCFA (« appliqué ÷ 12 chaque mois »), CAC en % de l'IRPP. La description rappelle la formule I1 à I3.
   - **Taxes forfaitaires** : TDL et RAV, « appliquée » ou « non appliquée ». Seuls les interrupteurs sont visibles, **pas les paliers**.
   - **Tranches IRPP** : n° de tranche, de … à …, plafond mensuel, plafond annuel (×12), taux.

   Toute valeur qui a changé par rapport à la version précédente est surlignée en ocre, avec l'ancienne valeur barrée. Les tranches modifiées portent un badge « modifiées ».
5. **Dialogue « Nouvelle version »**, pré-rempli avec la version sélectionnée :
   - champs : date d'effet (obligatoire), source ;
   - 11 champs numériques par famille, chaque champ modifié étant surligné ;
   - 2 interrupteurs (TDL, RAV) ;
   - éditeur de tranches : plafond mensuel et taux, ajout d'une tranche avant la tranche ouverte, suppression.

   Contrôles **dans le navigateur uniquement** : date d'effet postérieure à la version de départ, taux ≤ 100 %, au moins une tranche, dernière tranche ouverte et une seule, plafonds croissants. Le serveur ne vérifie que le format de la date et la dernière tranche ouverte. L'enregistrement est confirmé (« les mois ouverts seront recalculés, les mois clôturés ne bougent pas ») puis journalisé (`bareme_version`).

**Ce que l'écran ne permet pas** :
- modifier ou supprimer une version (il faut en créer une nouvelle) ;
- créer un brouillon (le statut « brouillon » existe dans le schéma mais n'est jamais produit) ;
- voir ou modifier les **paliers TDL et RAV**, l'exonération transport, les codes de rubriques, le taux d'acquisition des congés, le jour de paiement ou les jours de base. Ces derniers sont dans Paramètres ou dans le code.

---

## 13. Valeurs codées en dur qui devraient être paramétrables

| Valeur | Où | Pourquoi la déplacer |
|---|---|---|
| **Paliers TDL** (14 paliers, 0 à 4 500) | `lib/paie.ts : TDL_BAREME` | Montants fiscaux non versionnés. Un changement de loi modifierait aussi les mois ouverts antérieurs, et on ne peut pas tracer quelle grille a servi. À placer dans le barème daté. |
| **Paliers RAV** (12 paliers, 0 à 13 000) | `lib/paie.ts : RAV_BAREME` | Même raison. |
| Choix des bases TDL (salaire de base) et RAV (base taxable) | `lib/paie.ts` | Règle fiscale. À documenter, ou à rendre paramétrable dans le barème. |
| Exonération de la **prime de transport** (totale, sans plafond) | `lib/paie.ts` (`brutTaxable = total1 − transport`) | Règle fiscale. Un plafond d'exonération éventuel n'est pas prévu. Les autres indemnités (logement, assiduité) ne sont jamais exonérées. |
| Repli `abattementIrppAnnuel = 500 000` | 6 endroits : `lib/paie.ts` (×2), `lib/calculBulletins.ts`, `bareme.ts`, `pages/Bareme.tsx`, `recap/commun.tsx` (×2) | Une seule source de vérité : rendre le champ obligatoire dans le barème. |
| Replis `tdlActif` et `ravActif` = vrai | mêmes fichiers | idem |
| `BAREME_DEFAUT` (taux CNPS et CGI « depuis 2016-07 », « à valider ») | `lib/paie.ts` | Sert à l'amorçage. À valider puis à enregistrer comme première version datée, avec sa source. |
| Repli jours de base 30 | `lib/paie.ts`, `lib/calculBulletins.ts`, `lib/absences.ts`, `BulletinCard.tsx`, `paiePdf.ts`, `recap/commun.tsx` | Un réglage existe déjà (`joursBaseDefaut`) mais seulement pour les nouveaux employés. La valeur n'est **pas modifiable sur la fiche**. |
| Absence payée par défaut selon le type | `lib/absences.ts : PAYE_PAR_DEFAUT` | Règle RH : maladie payée, absence non payée. |
| Mode d'acquisition des congés : jours **calendaires**, mois d'embauche compté en entier, aucune remise à zéro annuelle, acquisition depuis janvier sans date d'embauche | `lib/absences.ts` | Règles du droit du travail à valider. Aucune option n'existe. |
| Points de présence 1 / 0 | `lib/fenetre.ts : POINTS_DANS_FENETRE / HORS_FENETRE` | La fenêtre est paramétrable, pas le barème de points. |
| Décalage horaire de Douala (+60 min) | `lib/fenetre.ts : OFFSET_DOUALA_MIN` | Acceptable : le Cameroun n'a pas d'heure d'été. |
| Structure du grand livre : 8 blocs, lignes, 12 formules de soldes, « E DR TIM » en simple report | `lib/tresorerie.ts : BLOCS, SOLDES` | Ajouter une caisse ou un canal demande un développeur. |
| Postes de caisse (8 postes espèces, assurance, TEP scan) et formule du CA | `lib/stats.ts` | idem |
| Catégories des primes médecins (6) et de l'audit (14) | `lib/stats.ts`, `lib/audit.ts` | idem |
| Mentions du bulletin « Statut · Horaire : Employé · 40 h », « Paiement … par banque », « Payé par SALAIRE {société} » | `BulletinCard.tsx`, `paiePdf.ts` | Elles devraient venir de la fiche employé (horaire, mode de paiement). |
| Codes et libellés comptables des rubriques (66111, 43131…) | `lib/paie.ts` | Plan de paie figé. |
| Horizon du graphe CA (6 mois) et de l'historique financier (14 jours) | `stats.ts`, `financier.ts` | Mineur. |

---

## 14. Incohérences et points à vérifier

**Paie**

1. **Société et CNPS.** La légende du Récapitulatif dit « SESAME non déclarés CNPS · SGC déclarés CNPS ». Or le moteur applique **les mêmes cotisations CNPS, IRPP, CFC, etc. aux trois sociétés**. Aucune règle ne dépend de `societe`. Si SESAME n'est vraiment pas déclarée, ses bulletins sont faux. Si elle l'est, la légende est trompeuse.
2. **Jours travaillés par défaut, navigateur contre serveur.** Sans ligne de saisie, le serveur prend les jours du planning (T9 : `joursBase − absences − congés`). Le Récapitulatif affiche et **enregistre** `30` (`recap/commun.tsx : DEFAUT`) dès qu'un autre champ de la ligne est modifié. Pour un employé avec `joursBase ≠ 30` (via le réglage `joursBaseDefaut`), on obtient `salaireBase = brut × 30 / joursBase`, donc un salaire supérieur ou inférieur au brut. L'aperçu (P19) diverge de la même façon.
3. **Dénominateur « / 30 » sur le bulletin.** `BulletinCard.tsx` et `paiePdf.ts` lisent `details.joursBase`, qui **n'existe pas** dans `details`. Ils affichent donc toujours « x / 30 », même pour un employé à 26 jours. La légende du Récapitulatif dit aussi « Journalier = brut ÷ 30 ».
4. **Date de paiement de la tuile.** `TuilesRecap` calcule `bornesPeriode(periode)` sans le paramètre `jourPaiement`. La tuile affiche toujours « paiement le 05/… » alors que le bulletin suit le réglage.
5. **Double retenue possible pour absence.** Une absence non payée saisie au planning réduit déjà les jours travaillés. La colonne « Absence » du Récapitulatif est un **montant FCFA libre** retenu en plus. Rien n'empêche de compter la même absence deux fois. À l'inverse, `saisiesMensuelles.absencesJours` est alimenté par le planning mais **n'entre dans aucun calcul**.
6. **Le planning écrase la saisie.** Toute modification d'absence remet `joursTravailles` à la valeur du planning et écrase une correction manuelle faite dans le Récapitulatif.
7. **Entrée et sortie en cours de mois non proratisées.** `dateDebut` et `dateFin` de la fiche ne réduisent pas les jours travaillés. Un employé embauché le 20 touche 30 jours si personne ne corrige. Un employé désactivé disparaît du mois ouvert, même pour les jours effectivement travaillés.
8. **« Primes » n'a pas la même définition selon l'écran.** Dans la Liste des salaires, c'est `details.primes`, sans l'indemnité de congés. Dans le Récapitulatif (cellule et total), c'est `primes + indemniteConges`.
9. **Total 2 contre net.** La colonne « Total 2 » du Récapitulatif peut être négative ; les colonnes par société et le libellé « Net à payer · Total 2 » affichent `max(0, Total 2)`. Les deux totaux de pied peuvent donc différer.
10. **« Effet net sur la paie »** (Primes & charges) = primes − retenues. C'est faux en net : les primes sont imposées et cotisées. Il vaudrait mieux l'appeler « Solde primes − retenues (avant impôts) ».
11. **Tuile du tableau de bord « Masse brute & Charges ».** Elle n'affiche que le brut. Les charges patronales (C8) ne figurent sur **aucune** tuile. La note « n bulletin(s) généré(s) » compte aussi les bulletins non clôturés.
12. **Libellé du barème.** « Cotisations CNPS : Base = brut plafonné ». La base réelle est la **base taxable** (sans transport) plafonnée.
13. **Tranches IRPP stockées par mois puis ×12.** 166 667 × 12 = 2 000 004 et 416 667 × 12 = 5 000 004, au lieu de 2 M et 5 M. L'écart est négligeable mais artificiel. Il vaudrait mieux stocker les tranches annuelles.
14. **Version de barème au milieu du mois.** Une date d'effet au 15 ne s'applique qu'au mois suivant, sans avertissement. Deux versions de même date d'effet sont départagées dans un ordre indéterminé. Les contrôles (taux ≤ 100, tranches croissantes, date postérieure) sont **seulement dans le navigateur**.

**Congés**

15. **Congés acquis contre congés pris.** Sans date d'embauche, les congés acquis repartent de janvier chaque année, alors que les congés pris s'additionnent **depuis toujours**. Le solde dérive d'une année à l'autre. Avec une date d'embauche, aucune remise à zéro ni plafond annuel n'existe.

**Trésorerie**

16. **Le report en chaîne traverse les mois clôturés.** `recalculerSuivantes` réécrit les soldes des journées suivantes sans vérifier leur clôture. Comme on peut clôturer un mois sans clôturer les précédents, modifier une journée d'un mois ouvert change les soldes d'un mois déjà « immuable ».
17. **Recette totale.** La Carte Visa est comptée deux fois si le « Dépôt Carte Visa » (bloc Carte Visa) est le même argent que la ligne « Carte Visa » de Poitiers. La recette inclut « Autres lignes » (TDM, Partage…), qui n'alimentent aucun solde. À valider avec la DAF.
18. **« Aujourd'hui » en UTC.** Le KPI financier (`recetteDuJour`) et `periodeCourante` utilisent la date UTC alors que les comptes rendus utilisent Douala. Entre 00:00 et 01:00 à Douala, « aujourd'hui » et « le mois courant » valent encore la veille.

**Caisse et statistiques**

19. **Période libre.** La `periode` d'une ligne de caisse est choisie à l'écran et n'est pas déduite de `dateDebut`. Une ligne peut être rattachée à un autre mois que ses dates.
20. **Masse salariale de l'audit.** La catégorie `masse_salariale` est **saisie à la main**, tandis que l'onglet « Salaires » calcule la masse depuis les bulletins. Deux chiffres de masse salariale coexistent sans rapprochement.

**Comptes rendus**

21. **Un point perdu à la correction.** Corriger son compte rendu après 20 h (ou le lendemain) recalcule `horsFenetre` et fait passer les points de 1 à 0, même si la première soumission était dans la fenêtre.
22. **Score et taux.** Le score s'additionne depuis toujours, sans période. Le taux de participation compte tous les utilisateurs actifs au dénominateur (DG, auditeur…) et ne tient pas compte des jours non ouvrables.

**Commandes et interventions**

23. **« Budget engagé » n'a pas le même sens partout.** Pour les Commandes, il inclut les commandes **rejetées** (et livrées). Pour les Interventions, « engagé » ne compte que les ouvertes et en cours.
24. **Formules recopiées.** Le total d'une intervention est réécrit au lieu de réutiliser `totalCommande`. La variation en % de l'audit est réécrite dans `Audit.tsx`. `baremePourPeriode` et `bareme.pourPeriode` font la même chose. `moisPrecedents` (stats) duplique `derniersMois` (audit). Aujourd'hui les résultats sont identiques, mais ils divergeront à la première modification d'une seule copie.

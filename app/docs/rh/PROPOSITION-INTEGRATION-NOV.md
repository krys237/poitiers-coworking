# Proposition d'intégration — demandes RH du 22/10, 02/11 et 03/11

> Rédigé le 04/11/2026. Dépouillement des 32 demandes, classées par nature : ce qui existe déjà,
> ce qui est un défaut à corriger, ce qui est à construire, et ce qui doit être tranché avant
> d'être codé. Les lots proposés s'appellent **R7 à R11** pour ne pas empiéter sur R4 et R6, qui
> restent en attente de réponses.

---

## 1. Sept demandes sont déjà satisfaites — voici où

Avant de construire, autant savoir ce qui existe. Ces sept points sont livrés ; s'ils ne se voient
pas à l'écran, c'est un problème de déploiement, pas de code (rien n'a encore tourné contre des
données réelles).

| Demande | Où c'est | Vérifiable par |
|---|---|---|
| « Dans le décompte des congés on ne compte pas les dimanches » | `lib/congesOuvrables.ts` — dimanches **et** jours fériés exclus | `npm run test:conges` |
| « Après 5 ans c'est +2 j, à 10 ans +4 j, donc +2 j tous les 5 ans » | `droitConge()` — `joursAnciennete: 2`, `paliersAnciennete: 5` | idem |
| « Les femmes avec enfants de moins de 6 ans : +2 j par enfant » | `droitConge()` — âge apprécié **au jour du départ** (art. 90) | idem |
| « Congé principal : 18 jours obtenus après 1 an » | `moisAvantJouissance: 12` → drapeau `droitOuvert` | idem |
| « Rubrique pour insérer le nombre de jours supp. manuellement » | `congeSuppManuel` + `congeSuppMotif` (motif obligatoire) | écran Planning annuel |
| « Le bulletin présenté aux impôts ne doit pas porter d'autres retenues » | `lib/dipe.ts` — `netDipe` ne déduit que le fiscal et le social | `npm run test:dipe` |
| « Le planning des absences doit se répercuter sur la paie » | `planning.appliquerAuxSaisies()` — appelé à **chaque** ajout, modification, suppression et par « Synchroniser la paie du mois » ; les mois clôturés sont ignorés | voir §2.4 |

**Une nuance importante sur le dernier point** : la répercussion fonctionne, mais elle passe
aujourd'hui par le décompte en jours **calendaires** de `lib/absences.ts`, pas par les jours
**ouvrables** de `lib/congesOuvrables.ts`. Les deux cohabitent volontairement depuis R0 : la
bascule est le lot R4, pour qu'aucun bulletin ne bouge avant l'arbitrage sur l'allocation. Donc
oui, ses modifications se répercutent — mais avec l'ancien décompte.

---

## 2. Trois défauts confirmés

### 2.1 🔴 « Congé principal : 1,5 j × 70 mois » — le compteur ne se remet jamais à zéro

**Confirmé, et c'est le plus grave des trois.** `planning.ts:228` appelle
`moisDeService(e.dateDebut, "2026-12")`, et cette fonction compte **depuis la date d'embauche**
sans borne :

```ts
return Math.max(0, (y2 - y1) * 12 + (m2 - m1) + 1);
```

Un salarié embauché en mars 2021 donne `(2026−2021)×12 + (12−3) + 1 = 70`. D'où le « 1,5 j × 70
mois » qu'elle a vu au survol — soit un droit de **105 jours** au lieu de 18.

La fonction n'est pas fausse en soi : elle sert aussi à `resumeMois()` pour l'acquisition cumulée
depuis l'entrée dans l'outil, ce qui est son rôle. Le défaut est son **usage** dans le calcul du
droit annuel, qui doit compter les mois de service **de l'année de référence**, plafonnés à 12.

**Correctif** : une fonction distincte `moisDeServiceSurAnnee(dateEmbauche, annee)` qui renvoie
`min(12, mois travaillés dans l'année)` — 12 pour un ancien, et le prorata pour une embauche en
cours d'année. À vérifier au passage : la période de référence légale court du **1ᵉʳ juin au
31 mai** (voir §3), ce qui n'est pas l'année civile.

### 2.2 🟠 Le service n'est pas défini à la création d'un employé

Confirmé : ni le formulaire de fiche (`fiche-employe.tsx`) ni la ligne de création rapide
(`Employes.tsx`) ne proposent le service, alors que le champ `serviceId` existe depuis R1. D'où le
code couleur « aucun service » dans la frise, exactement comme constaté.

### 2.3 🟠 Sofina ajoutée sur un employé, le salaire de base ne s'affiche pas

Comportement **voulu** par la conception de R2 bis, mais mal signalé. Dans `lib/societes.ts` :

```ts
salaireBase: l.salaireBase ?? (l.societe === fiche.societe ? salaireDeBase(fiche) : 0)
```

Le salaire de la fiche employé ne sert de repli **que pour la société porteuse**. Pour une seconde
société, le salaire vaut **0** jusqu'à ce qu'on le saisisse — et c'est juste : SOFINA ne paie pas
le même montant que SGC, le déduire serait inventer un chiffre. Mais un champ vide sans explication
ressemble à un bug.

**Correctif** : afficher un état explicite — « salaire à renseigner pour cette société » — plutôt
qu'un zéro muet, et compter ces rattachements dans un indicateur « à compléter ».

---

## 3. Découverte : R4 est presque débloqué

La vérification en ligne demandée a donné plus que la confirmation du 1/16. Le **décret n°75/28**
précise le cas de la période de référence longue :

> « Lorsque le congé est pris après une période de référence excédant douze mois, le montant de
> l'allocation est obtenu en appliquant la fraction à une rémunération totale qui doit être le
> produit du **salaire mensuel moyen des douze derniers mois** par le **nombre de mois et fractions
> de mois** comprises dans cette période de référence. »

Et deux précisions supplémentaires :
- la période de référence légale court du **1ᵉʳ juin au 31 mai**, sauf disposition conventionnelle ;
- **les allocations du congé précédent ne sont pas prises en compte** dans l'assiette — ce qui
  confirme le `dansAllocConge: false` déjà codé sur la rubrique 6613.

**Ce que ça change.** La formule qu'elle donne — `(salaire de base + ancienneté) ÷ 16` — et celle
que j'avais reconstituée — `N × (salaire + ancienneté) ÷ 16` — sont **la même**, et c'est celle de
la loi. Surtout, « nombre de mois **et fractions de mois** » explique enfin les N non entiers que je
n'arrivais pas à justifier :

| Ligne du DIPE | N impliqué |
|---|---|
| 16 | 16,000 |
| 8, 17, 18 | **15,974** |
| 23 | 13,224 |
| 28 | 12,174 |

→ **Le fameux facteur 0,9984 (point A1) n'est probablement pas un facteur du tout** : c'est la
fraction de mois. Trois salariés partageant exactement 15,974 mois de période de référence ont
simplement la **même date de retour du congé précédent et la même date de départ** — ce qui est
très plausible dans un service où l'on part groupé.

**Et sa formule des congés supplémentaires est nouvelle et codable :**

```
congé principal   = (salaire de base + ancienneté) × N ÷ 16
congés supplément. = (congé principal ÷ 18) × nombre de jours supplémentaires
indemnité totale  = congé principal + congés supplémentaires
```

### ⚠️ Le diviseur 18 n'est juste que dans un seul cas — vérifié le 04/11/2026

Le doute du propriétaire sur le 18 est **fondé**. Voici pourquoi.

**D'où vient le 1/16 :** l'équivalence légale de l'art. 89 dit qu'un mois de service ouvre
1,5 jour de congé, et qu'un mois vaut 24 jours ouvrables. Or **1,5 ÷ 24 = 1/16** : le seizième
*encode déjà* le 1,5 jour par mois. Il en découle que le taux journalier légal est la rémunération
mensuelle **÷ 24**, et qu'il est **invariant** — il ne dépend pas de N.

Deux lectures s'affrontent donc, et elles ne divergent que lorsque la période de référence
dépasse douze mois :

| | Droit en jours | Taux journalier | Sur la ligne 8 (R = 151 628, N = 15,974) |
|---|---|---|---|
| **A — légale** | 1,5 × N = **23,96 j** | allocation ÷ 23,96 = **R ÷ 24** | **6 318 FCFA** |
| **B — sa pratique** | principal fixé à **18 j** | allocation ÷ 18 | **8 410 FCFA** |

Sur 6 jours supplémentaires : **37 907 FCFA** en lecture A contre **50 460** en lecture B, soit
**33 % de plus**. Les deux ne coïncident que si **N = 12** — car 1,5 × 12 = 18.

**Les deux lectures sont cohérentes en elles-mêmes.** Sa pratique fixe le congé principal à
18 jours quel que soit N, et étale l'allocation sur ces 18 jours : le diviseur 18 est alors juste.
La loi, elle, fait accroître le droit de 1,5 jour par mois — une période de 16 mois ouvre donc
24 jours de principal, pas 18, et le taux reste R ÷ 24.

*(Remarque : mon « taux de 8 410 » du 20/10 était la lecture B. Je l'avais rectifié comme une
erreur, alors que c'était une lecture non identifiée. Les deux chiffres se rejoignent ici.)*

**Un confondant à signaler** : son planning attribue 24 jours à « 18 principal + 6 ancienneté ».
Mais 1,5 × 16 mois donne aussi 24. Les deux explications produisent le même total pour les
anciens — impossible de les départager sur les seuls chiffres du classeur.

**Deux questions pour ouvrir R4, et non une :**

1. **Comment compte-t-elle la fraction de mois** — jours ÷ 30, ÷ 30,44, autrement ?
2. **Le congé principal est-il toujours 18 jours**, ou croît-il de 1,5 jour par mois de période de
   référence ? C'est ce qui décide du diviseur : 18 fixe, ou 1,5 × N.

La seconde est la plus lourde : elle change l'indemnité de **33 %** sur les jours supplémentaires
des salariés anciens. Je recommande de poser les deux ensemble, avec le tableau ci-dessus — il
rend l'enjeu visible sans exiger de connaître le droit.

Sources : [décret n°75/28 — modalités des congés payés](https://oiseaudumonde.blogspot.com/2017/12/modalites-dapplication-des-conges-payes.html),
[Code du travail, art. 89](https://www.ilo.org/sites/default/files/wcmsp5/groups/public/@africa/@ro-abidjan/@sro-yaounde/documents/genericdocument/wcms_323616.pdf),
[Comprendre le congé payé au Cameroun](https://www.droitsocialenpratique.com/conges-payes-au-cameroun-ce-que-vous-devez-savoir/).

---

## 4. Le fil conducteur : l'immatriculation

Cinq demandes qui semblaient éparses n'en font qu'une, et c'est la clé de la cohérence :

| Demande | |
|---|---|
| « Changer *Bulletin de paie* en *Récapitulatif de paie* pour ceux qui ne sont pas à SGC » | |
| « Il faut un filtre d'immatriculation des impôts » | |
| « Récap non téléchargeable pour les non immatriculés » | consultable mais pas téléchargeable dans *Mes bulletins* |
| « Les employés non immatriculés n'apparaissent pas sur le DIPE » | |
| « Les bulletins considérés sont ceux de SGC ; SESAME et SOFINA ne sont pas pris en compte » | |

**Une seule notion les explique toutes : l'immatriculation fiscale de la société employeuse.**

| | SGC | SESAME · SOFINA |
|---|---|---|
| Immatriculée aux impôts | **oui** | non |
| Document remis au salarié | **Bulletin de paie** | **Récapitulatif de paie** |
| Téléchargeable dans *Mes bulletins* | **oui** | non — consultation seule |
| Ligne au DIPE | **oui** | non |

**Ce n'est pas en contradiction avec la décision du 20/10** (« SESAME déclare de son côté »), c'est
sa précision : SESAME et SOFINA versent et déclarent **hors de la plateforme**. Le DIPE que nous
produisons est celui de SGC. La conséquence assumée de R2 bis — plafond CNPS et tranches d'IRPP
**par employeur** — reste valable et `tests/societes.test.ts` continue de la verrouiller.

**✅ Tranché le 04/11/2026 : c'est l'immatriculation de l'EMPLOYÉ**, pas celle de la société.
Le drapeau `employes.immatriculeImpots` est donc porté par la fiche et **renseigné par la RH**
(livré au lot R7). Le comportement qui en découle — bulletin ou récapitulatif, téléchargement,
présence au DIPE — reste le lot R8.

---

## 5. Les lots proposés

### Lot R7 — Corrections et cohérence du planning ✅ **LIVRÉ le 04/11/2026**

Le plus rentable, et rien ne le bloque.

1. **Le bug des 70 mois** (§2.1) : `moisDeServiceSurAnnee()`, plafonné à 12, avec des tests sur une
   embauche ancienne, une embauche en cours d'année et une embauche postérieure au départ.
2. **Le service à la création** (§2.2) : sélecteur dans le formulaire de fiche **et** dans la ligne
   de création rapide, avec un repli « Sans service » explicite.
3. **Écran de gestion des services.** `services.enregistrer` et `services.supprimer` existent
   depuis R1 mais **aucun écran ne les appelle** — seul le bandeau d'amorçage « Créer les services »
   est branché. Deux options : un onglet dans Paramètres, ou un panneau dépliable dans le Planning
   annuel. Je recommande **Paramètres → Services**, avec le choix de la couleur, et un raccourci
   depuis le bandeau du planning.
4. **Champs persistants par défaut** dans le planning : le composant `useSaisiePersistante` existe
   déjà (il sert au Planning mensuel) — il suffit de l'activer sur la frise annuelle avec `true`
   par défaut.
5. **Impression du planning + filtre par personne** : un bloc `@media print` et un sélecteur
   d'employé. La frise est déjà en pourcentages, donc elle s'imprime sans retouche.
6. **« Gestionnaire RH » → « Responsable RH »** : `rbac.ts:27`. **Seul le libellé change** ; la clé
   technique `gestionnaire_rh` reste, sous peine d'invalider les rôles déjà attribués en base.

### Lot R8 — Immatriculation et documents remis au salarié ✅ **LIVRÉ le 05/11/2026**

1. Drapeau **`immatriculeImpots`** sur l'identité déclarante de chaque société
   (`parametresEntreprise.societes`), et/ou sur le rattachement selon l'arbitrage.
2. Le titre du document suit : **Bulletin de paie** ou **Récapitulatif de paie**, à l'écran, à
   l'impression et dans le PDF (`BulletinCard.tsx`, `paiePdf.ts`).
3. *Mes bulletins* : le bouton de téléchargement disparaît pour un non immatriculé, remplacé par
   une mention expliquant **pourquoi**. Le contrôle doit être **côté serveur** aussi
   (`paiePdf.pdfMonBulletin` doit refuser), sinon masquer le bouton n'est qu'un décor.
4. Le DIPE ne retient que les sociétés immatriculées, et affiche le nombre de lignes écartées —
   un filtre silencieux est pire qu'un filtre visible.
5. **Filtre d'immatriculation** dans la liste des employés, avec son indicateur.
6. **Champ « date d'entrée à la CNPS »** sur la fiche, distinct de la date d'embauche : les deux
   diffèrent souvent et l'attestation de présence effective réclame le matricule CNPS.

### Lot R9 — Barème : la « Vue RH » ✅ **LIVRÉ le 05/11/2026**

Sa demande est explicite et la solution l'est aussi : **laisser l'écran Barème tel quel et ajouter
un bouton « Vue RH »** qui déplie tout le détail des règles.

Cette vue n'invente rien — elle expose ce que le moteur applique déjà :

- les **quatre assiettes** et la matrice rubrique × assiette (`rubriques.pourPeriode` renvoie déjà
  le récapitulatif) ;
- les **tranches de l'IRPP** avec un exemple chiffré déroulé ;
- les **barèmes TDL et RAV**, tranche par tranche — c'est sa demande « définir les tranches pour la
  TDL et la RAV », et les tables existent (`TDL_BAREME`, `RAV_BAREME`), il faut les **rendre
  éditables** et non plus constantes ;
- le **plancher de 62 000** et sa portée (retenues salariales seulement) ;
- les **taux CNPS** et le groupe de risque AT/MP ;
- la **formule de l'allocation de congé** une fois R4 tranché.

Chaque règle affiche sa **base légale** — le référentiel est déjà rédigé et sourcé dans
`REFERENTIEL-LEGAL-CAMEROUN.md`, il suffit de l'y brancher. C'est ce qui rend le calcul vérifiable
par elle, sans nous.

### Lot R10 — Saisie et référentiels ✅ **LIVRÉ EN PARTIE le 05/11/2026**

1. **Référentiel de fonctions.** Aujourd'hui `employes.fonction` est un champ texte libre, d'où
   les fonctions vides. Nouvelle table `fonctions` (libellé, catégorie, échelon par défaut, actif),
   créable par la RH, avec reprise des valeurs déjà saisies à la migration.
2. **Sélecteur d'employé en saisie**, sur le modèle de l'ajout de produit dans Commandes :
   une liste déroulante filtrante qui propose l'employé à la frappe. À placer partout où un employé
   se choisit (planning, primes, actes).
3. **Les sociétés à la création d'un employé** : pouvoir cocher ses rattachements dès la création,
   au lieu de créer puis rattacher. Le composant `rattachements-employe.tsx` existe — il s'agit de
   l'intégrer au formulaire de création.
4. **Méthode d'envoi pré-remplie et modifiable** : aujourd'hui le système choisit selon ce qui est
   renseigné (e-mail ou WhatsApp). Ajouter un champ `methodeEnvoi` sur la fiche
   (`auto | email | whatsapp`) — `auto` conservant le comportement actuel — et un sélecteur par
   ligne dans l'écran Courrier.
5. **« Ajouter la période de congés au nombre de jours pris »** : afficher « du … au … » partout
   où un nombre de jours apparaît.
6. **Prime d'ancienneté et nouvelle ancienneté qui s'incrémentent ensemble** — dépend de la
   réponse au point A6 (ce que représente la seconde ancienneté). À garder pour la fin.

#### Ce qui reste du lot R10

1. **Les rattachements dès la création d'un employé.** Le composant `rattachements-employe.tsx`
   existe et fonctionne sur une fiche enregistrée ; l'intégrer au formulaire de **création**
   suppose de créer la fiche puis ses rattachements en une seule transaction, ou d'accepter une
   création en deux temps. À cadrer.
2. **« Ajouter la période de congés au nombre de jours pris »** : afficher « du … au … » partout
   où un nombre de jours apparaît (bulletin, récapitulatif, planning).
3. **Le routage d'envoi ligne à ligne.** `courrier.envoyer` reçoit **un seul** jeu de canaux pour
   toute la sélection : chacun par sa propre voie en un seul envoi demande d'étendre la mutation
   pour accepter un canal par ligne. Le pré-remplissage livré couvre le cas où tout le mois part
   par la même voie, ce qui est la situation courante.
4. **Prime d'ancienneté et nouvelle ancienneté qui s'incrémentent ensemble** — attend A6.

### Lot R11 — Générateur d'actes RH ✅ **LIVRÉ le 05/11/2026**

C'est le plus gros morceau, et le plus autonome. Détaillé au §6.

---

## 6. Le générateur d'actes

### Ce que contiennent les 13 modèles

J'ai extrait le texte de chacun. Ils se rangent en quatre familles, et surtout : **ce sont des
formulaires à trous**, pas des documents libres. Les pointillés sont les champs.

| Famille | Modèles | Champs variables |
|---|---|---|
| **Attestations** | Salaire · Présence effective au service · Reprise de service · Non-reprise de service | nom, date d'embauche, qualité, catégorie, échelon, matricule CNPS, date de reprise, mois concerné, **la structure complète du salaire** |
| **Notifications** | Cessation de perception de salaire | nom, date d'effet, motif, ampliations |
| **Stages** | Accord rémunéré · Accord non rémunéré · Autorisation · Attestation de fin · Certificat de fin | nom, référence, durée en mois, dates de début et de fin, service(s), montant de la gratification |
| **Contrats** | Engagement à l'essai · CDD · CDI | état civil complet (date et lieu de naissance, filiation, résidence, statut matrimonial, enfants à charge, profession, diplôme, CNI et sa date), durée, fonction, catégorie, échelon, rémunération |

**Deux observations qui orientent la conception.**

**L'attestation de salaire est déjà un bulletin.** Elle reprend ligne à ligne : salaire de base,
prime d'ancienneté, prime d'assiduité, indemnité transport, logement, prime de salissure, prime de
lait, retenue CNPS, retenue IRPP, CAC, CFC PS, TC/TLD, RAV, salaire taxable, salaire cotisable, net
perçu. **Ce sont exactement nos lignes de bulletin et nos quatre assiettes.** Elle doit donc se
**pré-remplir depuis le bulletin d'une période choisie**, pas être retapée. C'est l'intégration la
plus payante de tout le lot : aujourd'hui elle recopie ces seize montants à la main, pour chaque
salariée en congé de maternité.

**Les références sont numérotées.** `001/PP/MC/DAF/NG/03-2025`, `02/PP/DAF/DRH/08-2025`,
`N°/PP/DAF/DRH/01-2026` — un numéro séquentiel, un sigle de service, le mois et l'année. Le projet
sait déjà faire : `commandes.ts` génère `CMD-AAAA-NNN` par séquence annuelle. Même mécanisme, avec
le format de la RH et une séquence par type d'acte et par année.

### La conception

```
modelesActes   code, libellé, famille, corps (texte à jetons {{champ}}),
               champs[] (nom, libellé, type, obligatoire, source de pré-remplissage),
               formatReference, actif, effectiveFrom
actes          modeleCode, employeId?, reference, periode?, valeurs (record),
               genereLe, genereParId, pdfId (_storage), annuleLe?
```

**Les points de conception qui comptent :**

- **Pas d'en-tête ni de pied de page dans le PDF.** Tu l'as précisé : les actes s'impriment sur du
  papier à en-tête. Le générateur produit donc un corps centré avec des marges hautes et basses
  généreuses, et un réglage de leur hauteur dans les paramètres — pour que le texte ne se glisse
  jamais sous le logo imprimé. C'est l'inverse exact du bulletin de paie, qui porte son en-tête.
- **Pré-remplissage depuis la fiche et depuis le bulletin.** Chaque champ déclare sa source :
  `employe.nom`, `employe.dateDebut`, `bulletin.salaireBase`, `bulletin.assiettes.taxable`… La RH
  ne saisit que ce que le système ne peut pas savoir — le motif, la date d'effet, le diplôme.
- **Modèles stockés en base, pas dans le code.** Elle doit pouvoir corriger une formulation sans
  nous. Les 13 modèles sont chargés une fois par une mutation d'amorçage, puis éditables.
- **Archivage systématique.** Chaque acte généré garde son PDF dans `_storage` avec sa référence,
  sa date et son auteur. Un acte remis au salarié doit pouvoir être retrouvé à l'identique — et
  c'est aussi une pièce opposable à l'inspection du travail.
- **Réutiliser `paiePdf.ts`.** Il est déjà en `"use node"` avec pdf-lib, et surtout il porte le
  piège des polices standard qui n'encodent que le Latin-1 : son `clean()` remplace les tirets
  longs, les points de suspension et les espaces fines insécables. Les modèles en sont pleins —
  « l'employé(e) », « Fait à … le … ». Sans ce nettoyage, la génération échoue.

### Les réponses obtenues le 05/11/2026

- **Les fichiers en double sont une erreur** : un seul modèle par acte, celui à trous.
- **Signataire : la RH**, repris de `parametresEntreprise.responsableRH`.
- **Les en-têtes** : le propriétaire a fourni une facture réelle de la Polyclinique. Le bandeau a
  été mesuré — il occupe **125 pt (44 mm)** en haut d'une page A4, et il n'y a pas de pied de page
  distinct (le filigrane descend jusqu'en bas). C'est la marge haute par défaut du générateur.
- Les deux gabarits de référence trouvés dans ses fichiers sont conservés tels quels :
  `{n}/PP/DAF/DRH/{mm}-{aaaa}` et `{n}/PP/MC/DAF/NG/{mm}-{aaaa}`, séquence repartant chaque année.

### Ce qui reste du lot R11

- **Les contrats CDD et CDI** ne sont pas encore modélisés : leurs fichiers s'appellent
  `.xlsx.docx` et l'extraction du CDI n'a rendu que 35 paragraphes. À relire au calme avant de les
  ajouter — l'engagement à l'essai, qui a la même structure, sert déjà de patron.
- **L'autorisation de stage** et le **certificat de fin de stage** : mêmes familles que ce qui
  existe, à ajouter quand leurs formulations seront confirmées.
- **L'en-tête intégré au PDF** : la facture embarque son bandeau en image de fond. Si elle veut
  envoyer les actes par e-mail plutôt que les imprimer sur papier à en-tête, il suffira de fournir
  l'image et de l'ajouter en fond — la marge est déjà réservée.

---

## 7. Ce que je propose comme ordre

| Lot | Contenu | Bloqué par |
|---|---|---|
| **R7** | corrections du planning, services, impression, libellé du rôle | — **rien** |
| **R8** ✅ | bulletin / récapitulatif, téléchargement conditionnel, DIPE filtré, filtre d'immatriculation | — *(livré)* |
| **R9** ✅ | Vue RH du barème, tranches TDL et RAV portées par le barème daté | — *(livré)* |
| **R10** 🟡 | référentiel de fonctions ✅ · champ à saisie assistée ✅ · méthode d'envoi pré-remplie ✅ · **reste** : sociétés dès la création, période de congés affichée, routage d'envoi ligne à ligne | A6 pour le point ancienneté |
| **R11** ✅ | générateur d'actes : 9 modèles, pré-remplissage depuis le bulletin, références numérotées, PDF sans en-tête, archivage | — *(livré)* |
| R4 | allocation de congé | **une seule question** : comment compter la fraction de mois |
| R6 | retenue médecins | M1, M2 — le comptable |

**Je commencerais par R7** : trois défauts confirmés dont un qui donne un droit à congé de 105 jours
au lieu de 18, et rien ne l'empêche d'avancer. Puis **R9**, qui ne demande aucun arbitrage et qui
donne à la RH le moyen de vérifier nos calculs elle-même — ce qui réduira les allers-retours sur
tout le reste.

**Deux demandes que je n'ai pas su classer**, faute de comprendre l'intention :

- **« CLÔTURER ET GÉNÉRER BULLETIN DU MOIS »** — en majuscules, sans verbe. L'action existe
  (`payroll.genererEtCloturer`, bouton dans *Bulletins du mois*). S'agit-il d'un
  dysfonctionnement, d'un renommage, d'un déplacement du bouton ?
- **« Onglet ticket pour modification »** — un onglet où la RH déposerait ses demandes de
  correction, à la manière d'un suivi d'incidents ? Ou l'historique des modifications d'un
  bulletin ?

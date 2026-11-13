# Épic 2 — Trois bugs déjà diagnostiqués — compte rendu

Les trois diagnostics du fichier épic se sont confirmés à la lecture du code réel, sans écart.
Chacun a été corrigé, testé et commité séparément sur `rh`.

## Bug 1 — PDF des actes RH illisible (aucun retour à la ligne)

**Diagnostic confirmé.** Dans `app/convex/actesPdf.ts`, la boucle de rendu faisait
`clean(args.corps).split("\n")` : `clean()` a pour dernier remplacement un catch-all
`.replace(/[^\x20-\x7E\xA0-\xFF]/g, "?")`, et `\n` (0x0A) est hors des deux plages Latin-1
conservées — il devenait donc `"?"` avant que `.split("\n")` ne s'exécute. Tout le texte sortait
en un seul paragraphe.

**Correctif** (fichier + ligne exacte) :
- `app/convex/lib/actes.ts` : la logique pure est extraite en deux fonctions testables sans
  dépendance Convex — `nettoyerPourPdf()` (ex-`clean()`) et `paragraphesActe(corpsBrut)`, qui
  découpe le corps **brut** sur `"\n"` d'abord, puis nettoie chaque paragraphe individuellement
  et calcule `estTitre` sur le texte nettoyé.
- `app/convex/actesPdf.ts` : la boucle de `construireActePdf` utilise désormais
  `for (const { texte: paragraphe, estTitre } of paragraphesActe(args.corps))` au lieu de
  `clean(args.corps).split("\n")`. L'ancienne fonction locale `clean()` est supprimée ;
  `doc.setTitle()` utilise `nettoyerPourPdf()`.

**Test** : `npm run test:actes` — ✅ tous verts (y compris les cas préexistants).
Le test ne couvrait pas ce cas (il ne testait que `lib/actes.ts`, jamais la génération PDF) : un
bloc « Découpage du corps en paragraphes pour le PDF » a été ajouté à
`app/tests/actes.test.ts`, qui vérifie sur un corps à quatre paragraphes (dont un titre en
capitales et une ligne vide) que `paragraphesActe` produit bien des blocs distincts, sans `"?"`
parasite, et que `nettoyerPourPdf("a\nb")` seul vaut toujours `"a?b"` (pour documenter le piège
d'origine).

Commit : `fae2307` — `fix(actes): le PDF des actes RH nettoyait le corps avant de le découper en
paragraphes`.

## Bug 2 — Colonne « Allocation » vide pour un congé futur

**Diagnostic confirmé.** Dans `app/convex/planning.ts` (ligne ~325-327 avant correctif), la
sélection du « premier départ » qui porte l'allocation de l'année filtrait avec
`OBSERVATION_CONSOMME[ev.observation]` — la même table que celle utilisée pour `joursPris`
(ligne ~313). Or `OBSERVATION_CONSOMME.planifie === false` (correct pour le quota : un congé
futur n'a rien consommé), et `observationDeduite()` renvoie `"planifie"` pour tout congé dont le
départ n'est pas encore passé. Un congé payé posé pour le futur était donc exclu à tort de
l'affichage de l'allocation, alors que son montant est bien calculé en arrière-plan dès que
`premierDepart` existe.

**Correctif** (fichier + ligne) :
- `app/convex/lib/planningAnnuel.ts` : nouvelle fonction exportée
  `compteAllocation(observation)`, qui renvoie `true` pour tout sauf `"annule"` et `"reporte"`
  (un congé reporté n'a plus de date de départ valide pour l'année).
- `app/convex/planning.ts` : la ligne `evenements.filter((ev) =>
  OBSERVATION_CONSOMME[ev.observation])` qui alimentait `premierDepart` devient
  `evenements.filter((ev) => compteAllocation(ev.observation))`. Le filtre de `joursPris`
  (ligne ~313, `OBSERVATION_CONSOMME[ev.observation] ? ev.joursOuvrables : 0`) est resté
  inchangé, comme demandé.

**Test** : `npm run test:planning` — ✅ tous verts. Un bloc « Le congé porteur de l'allocation —
distinct du quota de jours consommés » a été ajouté à `app/tests/planningAnnuel.test.ts` :
vérifie `compteAllocation` sur les huit observations, vérifie explicitement qu'elle diffère de
`OBSERVATION_CONSOMME` sur `"planifie"`, et simule la sélection du premier départ sur un congé
daté du 07/12/2026 pour prouver qu'il est bien retenu.

Commit : `08f8bb8` — `fix(planning): un congé posé pour le futur n'affichait plus son
allocation`.

## Bug 3 — Rattachement secondaire sans montant perd son salaire

**Diagnostic confirmé.** `app/convex/lib/societes.ts`, ligne 141 (avant correctif) :
`salaireBase: l.salaireBase ?? (l.societe === fiche.societe ? salaireDeBase(fiche) : 0)`. Le
repli sur le salaire de la fiche ne s'appliquait que si la ligne portait la société
**principale** de la fiche ; pour une société secondaire sans montant saisi, le repli valait
`0`. L'écran de saisie (`app/src/components/app/fiche-employe.tsx`, lignes 209-211) annonce
pourtant explicitement : « Sans montant, c'est le salaire de base ci-dessus qui s'applique » —
sans distinction de société.

**Correctif** (fichier + ligne) :
- `app/convex/lib/societes.ts`, dans `rattachementsEffectifs()` : `salaireBase: l.salaireBase ??
  salaireDeBase(fiche)`, sans plus conditionner au `l.societe === fiche.societe`.
- Les autres occurrences du même motif (`matriculeEmployeur`, `cnpsEmployeur`, `niuEmployeur`,
  `dateDebut`) ont été relues et **ne sont pas concernées** : ce sont des identifiants
  spécifiques à l'employeur (matricule « chez cette société »), et il est correct qu'ils ne
  retombent sur la fiche que pour la société qu'elle porte — seul le salaire de base devait
  perdre cette restriction, conformément au texte d'aide de l'écran.
- `app/src/components/app/rattachements-employe.tsx` affiche `r.salaireBase` tel que résolu côté
  backend ; aucun calcul dupliqué côté frontend, donc aucun changement nécessaire là.

**Test** : `npm run test:societes` — ✅ tous verts. Le test préexistant « appartenance déclarée
sans montant : salaire de base à 0 » asserait l'ancien comportement (buggé) ; il a été réécrit en
« appartenance déclarée sans montant sur une société secondaire : salaire de base de la fiche »
et vérifie désormais `sansMontant[0].salaireBase === fiche.salaireBase`.

Commit : `22515cf` — `fix(societes): un rattachement secondaire sans montant retombait a 0
FCFA`.

## Vérifications globales

- `npm run typecheck` — ✅ vert (aucune erreur).
- `npm run test:actes`, `npm run test:planning`, `npm run test:societes` — ✅ tous verts.
- Aucune lecture ni copie du dossier `modele/`.
- Branche `rh`, trois commits distincts, aucun push, aucune fusion, aucun changement de branche.

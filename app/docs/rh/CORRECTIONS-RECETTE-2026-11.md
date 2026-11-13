# Corrections issues de la recette — novembre 2026

> Source : `docs/recette-poitiers-2026-11-12.csv` (export du cahier de recette, 186 lignes dont 29
> commentées) + deux messages vocaux de la RH du 10/11/2026 sur le travail dominical et les jours
> fériés. Rédigé le 12/11/2026, **avant toute correction** : ce document sert de base à validation,
> puis sera découpé en tâches (« épics ») pour exécution par un autre agent.
>
> **Règle de lecture : la gravité et la catégorie priment sur l'ordre d'apparition.** Les catégories
> A et B sont du code à corriger ; C est le cahier de recette lui-même ; D est déjà tranché, pour
> mémoire ; E est de l'ergonomie transverse à chiffrer ; F est à clarifier avant tout développement.

---

## A. Bugs diagnostiqués — la ligne de code en cause est identifiée

Ces quatre points n'ont pas besoin d'investigation supplémentaire : la cause est localisée, la
correction peut être écrite directement.

### A1 🔴 Le PDF des actes RH sort illisible, articles collés les uns aux autres

**Scénario** RH-12. **Fichier fourni** : `modele/rendu-actes-rh/Contrat de travail à durée
indéterminée - apercu.pdf` — vérifié : le texte est un seul bloc, sans retour à la ligne, avec des
« ? » parasites à chaque endroit où un saut de ligne existait dans le modèle.

**Cause exacte** : `app/convex/actesPdf.ts` ligne 95 —

```ts
for (const paragraphe of clean(args.corps).split("\n")) {
```

`clean()` nettoie l'ensemble du texte pour le Latin-1 **avant** le découpage en paragraphes. Son
dernier remplacement, `.replace(/[^\x20-\x7E\xA0-\xFF]/g, "?")`, transforme **tout retour à la
ligne** (caractère `\n`, hors de la plage conservée) en `"?"` littéral. Au moment du `.split("\n")`,
il ne reste donc plus aucun saut de ligne à trouver : le texte entier devient un seul paragraphe.

**Correction** : inverser l'ordre — découper `args.corps` brut en paragraphes d'abord, nettoyer
**chaque paragraphe** ensuite, juste avant de l'écrire. La détection de titre (`estTitre`, gras et
centré) recommencera aussi à fonctionner, puisqu'elle dépend des mêmes paragraphes correctement
séparés.

**Gravité** : bloquant — tous les actes PDF sont concernés, pas seulement le CDI testé.

### A2 🔴 La colonne « Allocation » reste vide pour un congé posé dans le futur

**Scénarios** RH-07, RH-09. Elle confirme : « le retour calculé est correct mais la colonne
allocation n'affiche rien, juste un trait ».

**Cause exacte** : `app/convex/planning.ts` ligne 326, le calcul du « premier départ » de l'année
filtre les événements par `OBSERVATION_CONSOMME[ev.observation]`. Or `observationDeduite()`
(`app/convex/lib/planningAnnuel.ts`) renvoie `"planifie"` tant que la date du jour est antérieure au
départ — et `OBSERVATION_CONSOMME.planifie = false`. Un congé posé pour une date future (son cas de
test : départ le 07/12/2026, testé le 12/11/2026) est donc exclu du calcul d'allocation, alors que
rien n'indique que c'était voulu : `OBSERVATION_CONSOMME` sert à compter les jours **déjà
consommés** sur le quota annuel, pas à décider si l'allocation doit être montrée.

**Correction proposée** : le choix du « premier départ » pour l'allocation doit retenir tout congé
payé **non annulé** (exclure seulement `"annule"`, et probablement `"reporte"`), indépendamment de
son statut de consommation. À confirmer : si deux congés sont posés dans l'année, c'est toujours le
premier (par date) qui doit porter l'allocation, ce que le code fait déjà correctement une fois le
filtre corrigé.

**Gravité** : bloquant — la fonctionnalité center du lot R4 est invisible tant qu'un congé n'a pas
commencé.

### A3 🔴 Un rattachement à une société secondaire perd son salaire si aucun montant n'est saisi

**Scénario** RH-04. Elle confirme : « Sofina apparaît bien comme société rattachée, mais c'est sans
salaire de base par défaut ».

**Cause exacte** : `app/convex/lib/societes.ts` ligne 141 —

```ts
salaireBase: l.salaireBase ?? (l.societe === fiche.societe ? salaireDeBase(fiche) : 0),
```

Le repli sur le salaire de la fiche ne joue que si la ligne porte la société **principale** de la
fiche. Pour une société secondaire (ici SOFINA, la fiche étant SESAME) sans salaire propre, le
repli est **0**, et non le salaire principal. C'est exactement l'écart qu'elle signale, et cela
contredit l'intention documentée dans `fiche-employe.tsx` (« Sans montant, c'est le salaire de base
ci-dessus qui s'applique ») et dans le scénario RH-04 lui-même.

**Correction** : le repli doit valoir `salaireDeBase(fiche)` quelle que soit la société de la ligne,
pas seulement pour celle de la fiche. À vérifier au passage : l'écran de saisie des rattachements
d'une fiche déjà créée (`RattachementsEmploye`) a-t-il le même défaut ?

**Gravité** : majeur — un employé multi-société peut se retrouver sans aucun salaire chez une
société secondaire, donc sans bulletin cohérent.

### A4 🔴 Clôture de la paie : « Server Error — called by client »

**Scénarios** PAIE-17, PAIE-33 (bloqué en cascade) et PAIE-49 (cycle complet, bloqué pour la même
raison). Elle décrit une erreur serveur explicite à la tentative de clôturer août 2026.

**Pas encore diagnostiqué** : contrairement aux trois points précédents, je n'ai pas identifié la
ligne en cause — le message « Server Error : called by client » est générique et peut venir de
plusieurs endroits (`payroll.genererEtCloturer`, une validation qui lève avant d'atteindre la
mutation, un dépassement de la limite Convex sur une requête trop large…). **C'est le point le plus
urgent à instrumenter en premier** : toute la chaîne clôture → archives → Mes bulletins (PAIE-33,
PAIE-46, PAIE-49) est bloquée tant que celui-ci ne l'est pas.

**Gravité** : bloquant, prioritaire sur tout le reste.

---

## B. Bugs confirmés, cause encore à investiguer

Ces points sont réels (décrits avec assez de précision pour être reproduits) mais je n'ai pas
remonté jusqu'à la ligne de code. À router vers un épic « investigation + correction ».

| # | Scénario | Description |
|---|---|---|
| B1 | PAIE-22 | En mode « champs persistants », **Acompte et Dette de soins apparaissent fusionnés dans une seule colonne/un seul champ**, alors que ce sont deux champs distincts. Elle a dû repasser en mode « champs masqués » pour les saisir séparément — une saisie faite en mode persistant risque de perdre l'un des deux montants. |
| B2 | PAIE-22 | Dans la grille de saisie en série, Prime et Retenue ne sont **pas visibles** dans les colonnes, en mode persistant comme en mode masqué pour l'un des deux modes — elle doit ressaisir à l'aveugle. |
| B3 | PAIE-22 | Un champ (Sanctions) affichait en mode persistant **une valeur qu'elle venait de saisir dans un autre champ/mode**, 8 000 — une valeur semble s'être mal propagée entre deux champs ou deux modes. |
| B4 | PAIE-20 | Mode persistant : le chiffre saisi pour la mutuelle (ex. 150) **se colle visuellement** au montant calculé affiché juste à côté — manque un séparateur/espace, pas une erreur de calcul. |
| B5 | PAIE-21 | Mode persistant : l'en-tête de la colonne « Noms et prénoms » **scrolle au-dessus** du titre de colonne pendant le défilement du tableau (alors que les autres colonnes restent correctement figées). |
| B6 | PAIE-19 | La modale « Primes fixes / congé » du mode persistant **ne permet pas de scroller** une fois ouverte, contrairement à la modale de détail de la fiche employé, qui elle scrolle normalement. |
| B7 | RH-07 | La modale de gestion des **Services** ne devient pas scrollable quand leur nombre augmente, et sa hauteur croît jusqu'à **cacher le bouton de fermeture**, bloquant toute action. |
| B8 | ADM-44 | Modale « Nouveau membre » : **ne scrolle pas**, bloque la page. Même défaut sur la modale d'aperçu de la page Documents (l'écran se fige, il faut cliquer à côté pour en sortir). |
| B9 | ADM-44 | Page **Connexion** en mobile : au clic dans un champ, le clavier/zoom déforme la mise en page, qui ne se réajuste pas correctement après la saisie. |
| B10 | ADM-44 | Pages **Commandes** et **Planning des absences** décrites comme « cassées » en version mobile (sans plus de détail — à reproduire). |

---

## C. Corrections du cahier de recette lui-même (pas du code)

Ces écarts viennent de MES scénarios, pas de l'application.

- **PAIE-02** : j'ai écrit « salaire brut » dans les instructions au lieu de « salaire de base », et
  annoncé un effectif attendu de 12 après ajout de R01/R02 alors que le bon chiffre est 10.
- **PAIE-48** : l'effectif de référence que j'ai écrit est 10, le vrai est **8** ; le net d'ABAMI que
  j'ai écrit est 95 530, le vrai est **106 950**. Mes scénarios qui citent ces deux valeurs
  (PAIE-01, PAIE-21, PAIE-48…) sont à corriger pour refléter la vraie base de recette.

*(Action : corriger `design/recette/scenarios-paie.json` aux lignes concernées, puis regénérer le
cahier. Pas une tâche pour Sonnet — je la ferai moi-même à la prochaine passe, c'est un simple
alignement de données de test.)*

---

## D. Déjà tranché — rien à faire

- **RH-08** (allocation calculée avant les 24 mois de service) : la Direction confirme que c'est
  acceptable tel quel — « si cela est fait c'est une volonté de la RH, au besoin nous pouvons
  bloquer plus tard ». Aucune action.
- **PAIE-41** (envoi réel par e-mail) : en attente des clés API ; l'infrastructure de simulation est
  déjà validée. Aucune action avant la connexion des clés.
- **Dimanche et congés** (message vocal RH) : confirmation que le dimanche doit bien être exclu des
  jours ouvrables pour le calcul des congés — c'est déjà le comportement actuel
  (`REGLES_OUVRABLES_DEFAUT.joursNonOuvres = [0]`). Aucune action sur ce point précis ; voir **F1**
  pour la suite du message (les astreintes), qui est un sujet distinct.

---

## E. Ergonomie et fonctionnalités à chiffrer

Réelles, mais pas des défauts de conformité au cahier des charges : des améliorations demandées.
Je les groupe par nature pour faciliter un chiffrage par lot plutôt qu'au cas par cas.

### E1 — Navigation et листы (tableaux, modales, menu)

- **Clic sur une ligne employé** : n'ouvre rien ; seul le crayon à droite ouvre la fiche. Elle
  demande à rendre la ligne entière cliquable (si l'ergonomie n'en pâtit pas — elle pose la question
  elle-même).
- **Colonne figée au scroll horizontal** : sur les tableaux de lecture seule (DIPE cité en exemple),
  impossible de savoir quelle ligne (quel employé) on regarde une fois le scroll horizontal engagé —
  y compris sur PC. Demande une colonne « nom » figée.
- **Défilement automatique** : cliquer un salarié pour ouvrir son bulletin l'affiche plus bas sur la
  page, sans scroll automatique vers lui — pareil pour Interventions, Récapitulatif salaires,
  Commandes/Approvisionnement.
- **Repli de la barre latérale** : la replier (ex. en ouvrant le récapitulatif) empêche ensuite de
  scroller la page. Elle demande un système d'affichage double (ouverte/repliée, au choix de
  l'utilisateur) plutôt qu'un repli automatique qui bloque.
- **Pagination des tableaux** : le sélecteur actuel (nombre de lignes affichées) ne suffira pas sur
  une base de plusieurs centaines d'employés. Demande un système de pagination généralisé à
  l'ensemble des tableaux de l'application.

### E2 — Saisie assistée (remplacer des champs texte/liste par de l'autocomplétion)

- **Sélection d'un salarié sur l'écran Actes** : actuellement un menu déroulant classique ; elle
  demande le même type de champ qu'au module Commandes (saisie du nom, proposition au fur et à
  mesure).
- **Champ « Remplaçant » du congé** (Planning) : même demande, préchargé avec la liste des employés.
- **Matricule** : saisi à la main à la création d'un employé, elle demande une **incrémentation
  automatique** pour écarter le risque de doublon.
- **Date de naissance** (Actes) : actuellement un champ texte libre (« se saisit en toutes
  lettres ») — remplacer par un sélecteur de date, comme les autres champs date de l'application.

### E3 — Export et impression sur plusieurs périodes

- **Bulletins** : le téléchargement groupé existe pour *tous les employés d'un mois*, mais pas pour
  *un seul employé sur plusieurs mois* (son exemple : 6 mois d'affilée).
- **Liste des salaires** : même souhait — pouvoir filtrer l'export sur un intervalle de périodes, pas
  seulement un mois.

### E4 — Signature et cachet (rejoint N3, déjà consignée au registre)

- **PAIE-26** : le PDF de la liste des salaires réserve un emplacement « Visa Directeur » et « Visa
  RH », mais rien ne permet encore d'y importer une signature ou un cachet.
- **RH-13** : le champ « Signataire » des actes RH est aujourd'hui un champ de saisie libre ; elle
  demande un véritable système — enregistrement d'une signature sur la plateforme, puis **choix**
  parmi les signatures enregistrées, avec **prévisualisation** avant délivrance.
- Fichiers de référence fournis : `modele/rendu-actes-rh/` (PDF + captures).
- **Rappel** : ce sujet est déjà au registre sous **N3-a** (`A-VERIFIER.md`), volontairement bloqué
  en attendant un cadrage — qui peut apposer la signature de qui, valeur probante, mention
  « signé électroniquement ». Les éléments fournis maintenant (captures, exemples de rendu)
  permettent d'avancer le cadrage, pas de le sauter.

### E5 — Divers, à évaluer au cas par cas

- **DRT-rh** : les modules hors de portée de la RH par défaut (Membres, Barème) lui semblent mal
  choisis — à rediscuter avec la Direction plutôt qu'à corriger techniquement.
- **DRT-rh** : une restriction manuelle posée sur le rôle RH pour le module **Caisse du mois**
  (passage en « consultation seule ») **ne serait pas respectée** — elle peut « toujours tout
  gérer ». Si confirmé, c'est un défaut de conformité aux droits (comparable aux points
  « conformite-droits » déjà au registre) : à vérifier en premier lieu si la surcharge de rôle a
  bien été enregistrée côté Paramètres → Rôles & accès avant de chercher un bug plus profond.
  **Classé B (à investiguer), ajouté ici pour la trace.**
- **PAIE-10** : pas de moyen trouvé, côté administrateur, d'ajouter la source du barème
  (`baremeSourceUrl` ou équivalent) ; souhait de pouvoir en attacher plusieurs.
- **RH-05** : elle interroge le sens réel de « Catégorie » et « Échelon » dans le référentiel des
  fonctions — les remplacer par « Service » ou « Niveau » serait plus parlant pour l'équipe, si
  « Catégorie »/« Échelon » ne sont pas utilisés ailleurs dans le calcul de paie *(à vérifier avant
  de les retirer : ces deux champs alimentent-ils un calcul, ou sont-ils strictement informatifs ?)*.
- **PAIE-14** : question de compréhension (« c'est quoi l'effet concret de la synchronisation de
  paye ? ») — un ajout de texte d'aide à l'écran suffit probablement, pas un code à changer.
- **RH-04** : suggestion d'un filtre par société sur l'écran Récapitulatif salaires — actuellement
  absent. À évaluer : utilité réelle une fois le multi-société plus répandu dans l'effectif.
- **PAIE-40** : remarque isolée et peu claire (« le bulletin de paie à terme sera présent juste dans
  le courrier des employés de SOFINA ») — je ne sais pas si c'est une observation, une inquiétude ou
  une demande. **À faire préciser directement avec elle avant d'en faire quoi que ce soit.**

---

## F. À clarifier avant tout développement

### F1 🟠 Astreintes et « service minimum » les dimanches et jours fériés — sujet nouveau, pas encore spécifié

Les deux messages vocaux du 10/11/2026 introduisent un sujet **entièrement absent du chantier
actuel** : la plateforme ne modélise aujourd'hui que le calcul des congés (jours ouvrables, fériés
exclus) — jamais le **roulement de présence réel** du personnel un dimanche ou un jour férié dans un
établissement qui fonctionne 7j/7.

**Ce que les messages disent, reconstitué** :

- Le dimanche reste bien exclu des jours ouvrables pour le calcul des congés — confirmé, rien à
  changer là-dessus (voir **D**).
- Mais la clinique fonctionnant en continu, quelqu'un travaille quand même ces jours-là : c'est
  « l'astreinte ».
- **Deux jours fériés sont un cas particulier** : le 25 décembre et le 1ᵉʳ janvier. Ces deux jours,
  **seuls deux services sont d'astreinte** — Hospitalisation et Médecine générale ; tous les autres
  services sont au repos.
- **Tous les autres jours fériés** : chaque service est d'astreinte, mais en **« service minimum »**,
  avec une règle de **rotation** explicitement décrite : « si tu travailles le 1ᵉʳ mai, le 20 mai tu
  seras de repos » — qui travaille un férié ne travaille pas le suivant, et ainsi de suite.

**Ce qui manque pour pouvoir chiffrer ce sujet** — à poser à la RH avant toute ligne de code :

1. Le « service minimum » a-t-il un effectif cible par service (ex. 1 personne, 2 personnes), fixe
   ou proportionnel à l'effectif du service ?
2. La rotation « qui travaille un férié ne travaille pas le suivant » est-elle **automatique**
   (le système doit désigner qui est d'astreinte à chaque férié, à tour de rôle) ou
   **enregistrée a posteriori** (la RH note qui a été d'astreinte, sans que le système planifie) ?
3. Travailler un jour férié ouvre-t-il une **majoration de salaire** ou une prime spécifique ? Le
   moteur de paie n'a aujourd'hui aucune rubrique pour ça.
4. Le dimanche « ordinaire » (hors férié) suit-il la même logique d'astreinte, ou est-ce un sujet
   distinct couvert par le planning habituel des services (horaires, repos compensateur) ?
5. Est-ce un sujet pour la **plateforme RH** (planifier qui est d'astreinte, le voir, le payer), ou
   pour un outil de **planning opérationnel** séparé dont la RH n'aurait besoin que du résultat (qui
   a travaillé, pour la paie) ?

**Tant que ces réponses ne sont pas là, ce sujet reste en l'état — aucun épic ne peut en sortir.**

### F2 🟡 Questions mineures soulevées en cours de recette, sans réponse encore

- **E5 / RH-05** : catégorie/échelon du référentiel des fonctions utilisés ailleurs dans le calcul,
  ou purement informatifs ?
- **E5 / PAIE-40** : à faire préciser directement.

---

## Proposition de découpage en épics (après votre validation)

Dans l'ordre où je les livrerais :

1. **Épic 1 — Clôture de paie** (A4 seul) : le plus urgent, débloque trois scénarios en cascade.
   Diagnostic d'abord, correction ensuite.
2. **Épic 2 — Trois bugs diagnostiqués** (A1, A2, A3) : indépendants l'un de l'autre, chacun avec
   sa cause et sa correction déjà écrites ci-dessus — directement exécutables.
3. **Épic 3 — Mode « champs persistants »** (B1 à B6) : tous sur le même écran (Récapitulatif
   salaires), probablement une cause commune ou voisine (affichage des colonnes en mode persistant)
   à investiguer ensemble plutôt qu'un par un.
4. **Épic 4 — Modales non scrollables** (B7, B8) : même symptôme sur trois modales différentes
   (Services, Membres, Documents) — probablement un composant ou un style partagé en cause, à
   corriger une fois pour toutes.
5. **Épic 5 — Responsive mobile** (B9, B10) : Connexion, Commandes, Planning des absences.
6. **Épic 6 — Saisie assistée** (E2) : matricule auto-incrémenté, champ employé en autocomplétion
   (Actes, remplaçant de congé), date de naissance en sélecteur de date.
7. **Épic 7 — Navigation et tableaux** (E1) : ligne cliquable, colonne figée, défilement automatique,
   repli de sidebar, pagination — plus gros, probablement à sous-découper davantage.
8. **Épic 8 — Export multi-périodes** (E3).
9. **Hors épic immédiat** : E4 (signature/cachet) attend le cadrage de N3-a ; F1 (astreintes) attend
   vos réponses ; E5 et F2 sont des clarifications ponctuelles, pas du code.

Dites-moi si ce découpage vous convient, si l'ordre doit changer, ou si certains points doivent
fusionner ou se scinder encore — je rédige ensuite un fichier par épic (contexte, fichiers en
cause, ce qui est attendu en sortie) pour que Sonnet puisse entrer, exécuter, et rendre un compte
rendu que je viendrai vérifier.

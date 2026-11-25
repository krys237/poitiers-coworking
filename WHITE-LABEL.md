# White label — registre des besoins et des contraintes

> Ouvert le **25/11/2026** à la demande du propriétaire : *« crée un fichier à la racine où toutes
> les consignes et spécifications par rapport à elle seront notées, nous permettant d'avoir le récap
> de nos besoins, et par la suite nous allons les implémenter. »*
>
> **Ce document ne décide rien.** Il accumule. Chaque entrée porte sa date et son auteur ; une
> décision prise se marque **DÉCIDÉ** avec sa date. Tant qu'une ligne n'est pas marquée, elle reste
> une question ouverte.
>
> Chantier voisin, déjà cadré : `app/docs/multi-societe/MODELE.md`.

---

## 1. Ce que le propriétaire a énoncé

**25/11/2026** — *« nous allons faire un white label de cette application bientôt et nous devons
laisser à chaque responsable la latitude de rallonger ou non la liste de ses sociétés. »*

Deux exigences en découlent, et elles sont déjà prises en compte dans le chantier multi-société :

1. la liste des **sociétés** (personnes morales) doit être **des lignes en base**, pas du code —
   sinon chaque ajout demande un déploiement ;
2. chaque exploitant les **crée lui-même** depuis les Paramètres, sans intervention technique.

---

## 2. La question centrale, non tranchée : comment isole-t-on deux exploitants ?

**Statut : DIFFÉRÉ au 25/11/2026.** Le propriétaire veut d'abord accumuler les besoins ici.

| | Un déploiement par client | Un déploiement partagé |
|---|---|---|
| Étanchéité | **absolue** — aucune requête ne peut atteindre un autre déploiement Convex | repose sur un `clientId` jamais oublié dans ~100 fonctions serveur |
| Coût d'exploitation | 1 projet Convex + 1 projet Vercel par client ; **N migrations** à rejouer | une base, une migration |
| Ajout d'un client | une procédure de déploiement (connue, cf. `app/PASSATION-DEPLOIEMENT.md`) | une ligne en base |
| Mise à jour | N déploiements à séquencer | un seul |
| Un client qui part | on supprime son déploiement | il faut extraire ses lignes de partout |
| Facturation / quotas | lisible par déploiement | à construire |

**Recommandation de l'agent de déploiement : un déploiement par client.** Il s'agit de paie et de
données de santé ; un filtre oublié expose la rémunération de l'effectif d'un concurrent. Le
déploiement est la seule frontière que le code ne peut pas franchir par erreur. Le surcoût est réel
et il est le prix de cette garantie.

⚠️ **À noter si l'option partagée est retenue** : le chantier multi-société ne la prépare **pas**.
Il livre la dimension *société*, pas la dimension *client*. Ajouter un `clientId` après coup
demanderait de reprendre chaque index une seconde fois.

---

## 3. Ce qui est aujourd'hui spécifique à ce client, et qu'un white label devra desserrer

Relevé dans le code le 25/11/2026. **Rien de tout cela n'est un défaut** : ce sont des choix justes
pour un client unique au Cameroun, qui deviennent des obstacles dès le deuxième client.

### 3.1 Le pays est partout dans le moteur de paie

| Ce qui est en dur | Où | Pourquoi ça bloque |
|---|---|---|
| **CNPS** (plafond 750 000, PVID, prestations familiales, ATMP) | `convex/lib/paie.ts`, `bareme.ts` | organisme camerounais |
| **IRPP, CAC, TDL, RAV, CFC** | `lib/paie.ts` | fiscalité camerounaise |
| **DIPE** | `convex/dipe.ts` | déclaration camerounaise |
| **FCFA, montants entiers sans décimales** | partout, et c'est une règle du projet | un client en euros aurait des centimes |
| **Code du travail camerounais** | les 13 modèles de `lib/actes.ts`, les congés de `lib/absences.ts`, l'art. 90 | durées légales, majoration mère de famille |

→ Un white label **dans le même pays** ne touche à rien de cela. Un white label **hors Cameroun**
est un autre produit. **Question à trancher : le white label reste-t-il camerounais ?** C'est la
question qui coûte le plus cher si on y répond tard.

### 3.2 Le fuseau horaire est figé

`convex/lib/fenetre.ts` calcule la fenêtre des comptes rendus en **heure de Douala, UTC+1 sans
heure d'été** — un décalage constant écrit en dur. Juste pour le Cameroun, faux partout où il y a
un changement d'heure.

### 3.3 Le grand livre est la feuille d'un seul DAF

Les **neuf blocs** de `convex/lib/tresorerie.ts` (POITIERS, Les Lilas, Carte Visa, E DR TIM
Finance, Médicaments, Biodiagnostic 1 et Advens, MED-Esthetic, Autres prestations) et les **treize
soldes** qui en dérivent sont une constante de code, calquée sur la feuille papier de la DAF de
cette clinique. Aucun autre exploitant n'a cette feuille.

→ **Pré-requis white label : rendre les blocs et les soldes paramétrables** (table `blocs`,
`soldes`, avec leurs formules d'apport). C'est l'étape C du chantier multi-société, et c'est le plus
gros morceau technique du white label. C'est aussi ce qui explique, aujourd'hui, les soldes LILAS et
E DR TIM à zéro : des colonnes dont personne n'a jamais eu l'usage.

### 3.4 Les trois déclarants de paie

`SESAME | SOFINA | SGC` est un type figé (`convex/schema.ts:19`). **Décision du 25/11 : on n'y
touche pas** pour le multi-société — c'est le même employeur, et toutes les sociétés peuvent les
porter. Mais pour un autre exploitant, ces trois noms ne veulent rien dire.

→ **Pré-requis white label : les déclarants deviennent des lignes en base**, et le renommage
`societe` → `declarant` du champ devient nécessaire (8 tables, déroulé en trois temps — le même que
`salaireBrut` → `salaireBase`).

### 3.5 La marque

« POITIERS COWORKING » apparaît dans le code et pas seulement dans les écrans : expéditeur des
codes de connexion (`authResendOtp.ts`), en-têtes PDF, nom des fichiers de bulletins, écran de
connexion, charte, seeds. Et la charte visuelle elle-même est un parti pris
(`.agents/skills/poitiers-ui-ux-system/SKILL.md`).

→ **À paramétrer** : nom, logo, palette, domaine, expéditeur e-mail, mentions des PDF.
La table `entites` du chantier multi-société porte déjà `nom`, `logoId`, `emailExpediteur` : une
partie du travail se fait donc gratuitement.

### 3.6 Les référentiels remplis à la main

`services`, `fonctions`, `rubriquesPaie`, `modelesActes`, `joursFeries` sont aujourd'hui amorcés par
les seeds avec des valeurs de cette clinique. Un nouveau client arrive sur du vide, ou sur les
données de quelqu'un d'autre.

→ **À construire : un parcours d'installation** qui crée la première société, le premier
administrateur, le barème de l'année et les référentiels minimaux. C'est `seed:initialiserAdmin`
généralisé.

---

## 4. Ce que le chantier multi-société apporte déjà au white label

À ne pas refaire : c'est acquis, ou le sera.

- les **sociétés sont des lignes** (`entites`), créées depuis l'écran Paramètres ;
- l'**identité juridique par société** : RC, NIU, CNPS, dirigeant, logo, expéditeur ;
- le **sélecteur de société** et la validation du périmètre côté serveur, à un seul endroit
  (`requireDroit`) ;
- les **accès par société** attribuables par la direction (`accesEntites`) ;
- le principe « **un index commence par la dimension de cloisonnement** », déjà appliqué partout.

---

## 5. Questions ouvertes, à répondre quand l'occasion se présente

1. **Le white label reste-t-il camerounais ?** → § 3.1. La plus chère si on y répond tard.
2. Un déploiement par client, ou un partagé ? → § 2.
3. Qui administre un nouveau client : vous, ou lui-même en autonomie ?
4. Chaque client apporte-t-il son **domaine** ? Son propre expéditeur e-mail vérifié ?
5. Les clés d'authentification (`JWT_PRIVATE_KEY`, `JWKS`) sont-elles **propres à chaque client** ?
   *(En déploiement séparé, oui par construction, et c'est un argument de plus pour cette option.)*
6. Le **barème** CNPS/CGI est national : partagé entre clients d'un même pays, ou recopié par
   client ? Partagé, il se met à jour une fois ; recopié, il peut diverger — et un bulletin faux
   quelque part.
7. Combien de clients visés la première année ? Sous dix, l'option « un déploiement par client »
   est confortable ; au-delà de cinquante, elle demande de l'outillage.
8. Modèle de facturation, quotas, et ce qui se passe quand un client dépasse.
9. Que devient le **miroir GitLab** désynchronisé, et faut-il une vraie intégration continue avant
   de livrer à des tiers ? *(Constat du 24/11 : rien ne tourne automatiquement aujourd'hui, le
   typecheck et les 36 suites sont lancés à la main.)*

---

## 6. Journal des décisions

| Date | Décision | Par |
|---|---|---|
| 25/11/2026 | Ouverture de ce registre. Niveau client **différé** ; le chantier multi-société livre la dimension société et fonctionne sous les deux hypothèses d'isolation. | propriétaire |
| 25/11/2026 | Les **déclarants de paie** (SESAME/SOFINA/SGC) restent inchangés et transversaux aux sociétés. Leur passage en base est un pré-requis *white label*, pas *multi-société*. | propriétaire |

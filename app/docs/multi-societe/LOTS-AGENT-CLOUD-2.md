# Multi-société, seconde vague — faire obéir les écrans

> Suite de `LOTS-AGENT-CLOUD.md`, dont les lots 1 à 4 sont livrés et intégrés. Cette fiche se
> suffit à elle-même. Lis-la **en entier** avant d'écrire une ligne.
>
> Base : commit écrit dans `BASE.txt`. **Quatre lots, dans l'ordre — 5, 6, 7, 8.** Chacun est
> livrable seul : si tu n'en finis que deux, livre-les et dis-le.

---

## 0. Avant toute modification

```bash
git init && git add -A && git commit -m base && git tag base
```

---

## 1. Où en est le chantier, et ce qui manque exactement

**Ce qui marche déjà** : les sociétés (table `entites`), les accès par société
(`accesEntites`), le périmètre d'un membre (`lib/perimetre.ts`, 47 contrôles au vert), le
sélecteur dans le bandeau (`SelecteurEntite`), le contexte `useEntite()`, le bandeau de rappel.
Trente tables portent un champ `entiteId`, et toute la donnée existante est estampillée
`poitiers`.

**Ce qui ne marche pas, et c'est tout l'objet de cette fiche** : **aucune requête métier ne
filtre sur la société.** Le propriétaire a basculé sur EDR-TIM et a vu… les employés de
POITIERS. Ses mots : *« comment je suis censé travailler, si j'ai encore exactement toutes les
infos de Poitiers ? »* Le sélecteur change le contexte, pas le contenu.

C'est le défaut le plus dangereux de l'état actuel : **une interface qui a l'air de changer de
société sans changer de données**. Quelqu'un croira saisir dans EDR-TIM et écrira dans POITIERS.

⚠️ En production il n'existe **qu'une** société, donc le sélecteur ne s'affiche pas et personne
n'est trompé. La fenêtre de danger s'ouvrira le jour où une seconde société y sera créée — et
c'est pour cela que ces lots doivent être propres.

---

## 2. LE PATRON — écrit une fois, à répéter sans l'inventer

Tout ce qui suit découle de ces quatre règles. **Ne t'en écarte pas.**

### 2.1 Côté serveur : la société est un argument OPTIONNEL, vérifié

```ts
import { requireDroit, requireEntiteSiFournie } from "./lib/authz";

export const liste = query({
  args: {
    entiteId: v.optional(v.id("entites")),   // TOUJOURS optionnel dans cette vague
    /* …les arguments existants, inchangés… */
  },
  handler: async (ctx, { entiteId /* , … */ }) => {
    await requireDroit(ctx, "/employes");
    await requireEntiteSiFournie(ctx, entiteId);          // ← le contrôle de périmètre

    if (entiteId) {
      return await ctx.db.query("employes")
        .withIndex("by_entite_matricule", (q) => q.eq("entiteId", entiteId))
        .collect();
    }
    // Pas de société fournie : comportement d'AVANT le chantier, à l'identique.
    return await ctx.db.query("employes").collect();
  },
});
```

**Pourquoi optionnel, et pourquoi ce double chemin.** Les écrans se convertissent un par un. Une
société obligatoire casserait tous ceux qui ne la passent pas encore, et un ERP de paie ne se met
pas en panne le temps d'une migration. La branche sans société disparaîtra quand l'agent de
déploiement rendra `entiteId` obligatoire au schéma — **ce n'est pas ton travail, et tu ne dois
pas l'anticiper.**

**`requireEntiteSiFournie` n'est pas optionnelle, elle.** Le client propose une société, le
serveur la vérifie. `localStorage` se modifie à la main dans n'importe quel navigateur : sans ce
contrôle, n'importe qui lirait n'importe quelle société en changeant une chaîne. Ne la recopie
pas, ne la contourne pas, ne lis pas `accesEntites` directement.

### 2.2 Les mutations ESTAMPILLENT

Toute mutation qui **crée** une ligne dans une table scopée doit y poser la société :

```ts
export const creer = mutation({
  args: { entiteId: v.optional(v.id("entites")), /* … */ },
  handler: async (ctx, a) => {
    await requireDroit(ctx, "/employes", "faire");
    await requireEntiteSiFournie(ctx, a.entiteId);
    return await ctx.db.insert("employes", { ...a, /* … */ });   // `entiteId` part avec le reste
  },
});
```

Sans ça, une fiche créée depuis EDR-TIM naît **sans société** : invisible au filtrage, à
ré-estampiller à la main. Le propriétaire a déjà été prévenu de ne pas saisir avant ce lot.

### 2.3 Côté écran : le hook, et `"skip"`

```tsx
const { entiteId } = useEntite();
const donnees = useQuery(api.employes.liste, entiteId ? { entiteId } : "skip");
```

**Jamais** d'appel avec une société vide, **jamais** de valeur par défaut inventée.
`entiteId` vaut `undefined` tant que la liste des sociétés charge : c'est à ça que sert `"skip"`.

### 2.4 Toujours par un index qui COMMENCE par `entiteId`

Les index existent déjà pour les tables de cette vague : `by_entite_matricule`,
`by_entite_periode`, `by_entite_employe`, `by_entite_date`, `by_entite_ordre`,
`by_entite_libelle`. **Si l'index dont tu as besoin n'existe pas, ne le crée pas** — le schéma
n'est pas à toi. Signale-le dans ton compte rendu et utilise la branche sans filtre pour cette
requête-là.

⚠️ **Jamais** `.filter((q) => q.eq(q.field("entiteId"), entiteId))` après un `withIndex` sur
autre chose : ça lit les lignes des autres sociétés avant de les jeter. Coût permanent, et fuite
en attente d'un bug d'affichage.

---

## 3. Interdits absolus

| Jamais | Pourquoi |
|---|---|
| `convex/schema.ts` | le modèle n'est pas à toi. Besoin d'un champ ou d'un index → **signale-le** |
| `convex/lib/paie.ts` | le **moteur de paie**, strictement interdit. Un franc d'écart ici se retrouve sur un bulletin |
| `convex/lib/calculBulletins.ts` | **une seule modification autorisée**, décrite au lot 6 § « sans toucher au moteur » : la signature de `bulletinsPourPeriode` et la ligne qui lit les employés. **Rien d'autre.** Tout autre diff sur ce fichier sera rejeté à l'intégration |
| `convex/lib/perimetre.ts`, `lib/authz.ts` | la sécurité. Un défaut → tu l'écris, tu ne le corriges pas |
| `convex/lib/tresorerie.ts` | les blocs du grand livre — voir le lot 8 |
| `convex/_generated/` | régénéré, toute édition est perdue |
| `.env*`, `modele/`, `archives/`, `docs/` *(racine)* | clés, et données nominatives réelles |

**Ne rends jamais `entiteId` obligatoire** — ni au schéma, ni dans un validateur, ni en retirant
la branche sans filtre.

---

## 4. Lot 5 — l'écran Employés

**Intention** : pouvoir ajouter et consulter l'effectif d'une société sans voir celui des autres.
**Critère d'acceptation** : avec EDR-TIM sélectionnée, l'écran Employés est **vide** ; une fiche
créée y apparaît, et n'apparaît pas sous POITIERS.

C'est le lot qui transforme la charpente en outil. Fais-le d'abord et soigne-le.

### Les fonctions de `convex/employes.ts`

| Fonction | Ce qu'elle devient |
|---|---|
| `liste` | argument optionnel, filtre par `by_entite_matricule` *(voir la note sur `societe` ci-dessous)* |
| `fiche` | **inchangée** : elle prend un `employeId`, qui désigne déjà une ligne d'une seule société |
| `prochainMatricule` | argument optionnel, et le prochain numéro se calcule **dans la société** |
| `creer` | argument optionnel, **estampille** la fiche |
| `modifier` | **inchangée** : agit sur un `employeId` |
| `importer` | argument optionnel, **estampille chaque ligne** importée |
| `rattachements` | argument optionnel, filtre par `by_entite_employe` |
| `effectifSociete`, `echeancesContrats` | argument optionnel, filtrent |
| `ajouterRattachement`, `modifierRattachement`, `supprimerRattachement` | **estampillent** la ligne créée ; les deux autres agissent sur un id |
| `migrerSalaireBase`, `migrerRattachements`, `supprimerFichesImportees` | **ne touche pas** : migrations et maintenance |

⚠️ **`liste` a déjà un argument `societe`** — c'est le **DÉCLARANT de paie**
(`SESAME | SOFINA | SGC`), pas la société au sens de cette fiche. **Les deux coexistent et se
cumulent** : filtrer sur l'entité EDR-TIM *et* sur le déclarant SOFINA est un cas valide. Ne
remplace pas l'un par l'autre, n'en déduis pas l'autre. Si tu te surprends à écrire `e.societe`
pour filtrer un espace de travail, arrête-toi.

### Le piège du matricule — et c'est celui qui mordra le premier

`employes.importer` fait son **upsert par matricule** et `prochainMatricule` cherche le plus haut
numéro, tous deux **sans société**. En l'état, importer l'effectif d'EDR-TIM **mettrait à jour les
fiches de POITIERS** portant les mêmes matricules, silencieusement.

**Le matricule n'est unique que par société.** L'upsert doit chercher dans
`by_entite_matricule` quand une société est fournie, et le prochain numéro se calculer sur cette
société seule. Écris un test pour ce cas précis : deux sociétés, un même matricule, deux fiches
distinctes.

### L'écran `src/pages/Employes.tsx`

Le patron du § 2.3 sur chaque `useQuery`. Le formulaire de création et l'import passent la société
active. Et quand la liste est vide parce que la société est neuve, dis-le : « Aucun employé dans
*EDR-TIM* — ajoutez la première fiche », pas un tableau vide muet.

---

## 5. Lot 6 — la chaîne de paie

**Intention** : un bulletin, un DIPE et une archive par société, sans mélange.
**Critère d'acceptation** : le Récapitulatif d'EDR-TIM ne montre aucun employé de POITIERS, et
clôturer un mois chez l'une **ne clôture pas** chez l'autre.

| Fichier | Fonctions |
|---|---|
| `convex/payroll.ts` | `bulletinsDuMois`, `bulletinsIntervalle`, `saisiesDuMois`, `anciennetePrecedente` → argument optionnel · `saisirMois`, `genererEtCloturer` → argument optionnel **et** estampillage |
| `convex/dipe.ts` | `etat` |
| `convex/archives.ts` | `liste`, `bulletinsDuMois` |
| `convex/courrier.ts` | `apercu`, `journal`, `payloads` · `enregistrerEnvoi` estampille |
| `convex/mesBulletins.ts` | **inchangé** : un membre voit SES bulletins, l'employé est la clé |
| `convex/planning.ts` | `vueMensuelle`, `vueAnnuelle`, `serviceEffectif` → argument optionnel · `ajouterAbsence` estampille |

### Comment scoper `bulletinsPourPeriode` sans toucher au moteur

`lib/calculBulletins.ts` n'autorise **qu'une** modification, et c'est celle-ci. `bulletinsPourPeriode(ctx, periode)` y lit
`ctx.db.query("employes").collect()`. Tu ne peux donc pas filtrer dedans.

**La solution, et c'est la seule acceptable** : ajoute un paramètre à la **signature** de
`bulletinsPourPeriode` — `(ctx, periode, entiteId?)` — et n'en modifie **que** la ligne qui lit
les employés, pour qu'elle utilise `by_entite_matricule` quand une société est fournie. Aucune
ligne de calcul, aucune assiette, aucun montant. Si ton diff sur ce fichier touche autre chose
que cette lecture et la signature, **tu es allé trop loin** : reviens en arrière et signale-le.

### Le piège des clôtures

`cloturesPaie` est cherchée **par période seule**. Clôturer novembre chez POITIERS **gèlerait
novembre chez EDR-TIM**, avec un message parlant d'un mois clôturé que personne n'a clôturé. La
clôture devient **(société, période)**. Même chose pour `cloturesFinancieres`, mais celle-là
relève du lot 8.

---

## 6. Lot 7 — l'exploitation

**Intention** : chaque société voit ses documents, ses commandes, ses interventions, ses comptes
rendus et ses statistiques.
**Critère d'acceptation** : les écrans concernés d'EDR-TIM sont vides tant que rien n'y est saisi.

`documents` (`liste`, `deposer`) · `commandes` (`liste`, `detail`, `derniersAchats`, `creer`) ·
`fournisseurs` (`liste`, `creer`) · `interventions` (`liste`, `creer`) · `comptesRendus`
(`monEspace`, `vueSuperviseur`, `soumettre`) · `caisse` (`liste`, `graphe`, `kpi`,
`enregistrerLigne`, `importer`) · `primesMedecins` (idem) · `audit` (`lignes`, `lignesDuMois`,
`rapport`, `resume`, `graphes`, et les mutations) · `tickets` (`liste`, `enAttente`, `ouvrir`) ·
`actes` (`historique`, `generer`).

⚠️ `audit.totalSalaires` appelle la paie : passe-lui la société, ne recalcule rien.

### Le piège des séquences de référence

`CMD-AAAA-NNN` et `INT-AAAA-NNN` se calculent sur **toutes** les commandes de l'année. La première
commande d'EDR-TIM porterait le n° **035** parce que POITIERS en a 34. Les séquences deviennent
**par société et par année**. Un test, là aussi : deux sociétés, deux premières commandes, deux
fois le n° 001.

---

## 7. Lot 8 — le grand livre, borné

**Intention** : ne jamais servir à une société une feuille de caisse qui n'est pas la sienne.
**Critère d'acceptation** : sous EDR-TIM, l'écran Financier affiche un message clair et **aucun
chiffre** ; sous POITIERS, il est inchangé au franc près.

Les **neuf blocs** et **treize soldes** de `convex/lib/tresorerie.ts` sont une constante de code
calquée sur la feuille papier du DAF de POITIERS — c'est d'ailleurs pour ça que les soldes « Les
Lilas » et « E DR TIM » y sont à zéro depuis la création : des colonnes dont personne n'a eu
l'usage. Une société nouvelle n'a pas cette feuille.

**Donc : pas de scoping du grand livre dans cette vague.** À la place :

- `financier.journee`, `historique`, `kpi` prennent la société en argument optionnel et **refusent
  poliment** toute société dont le `code` n'est pas `poitiers` — un retour vide avec un drapeau
  explicite, pas une exception ;
- `src/pages/Financier.tsx` affiche alors : « Le grand livre n'est pas encore configuré pour
  *EDR-TIM*. Ses blocs de caisse doivent être définis avant toute saisie. »

**N'improvise rien de plus.** Rendre les blocs paramétrables est un chantier à part, qui touche de
la comptabilité réelle.

---

## 8. Ce que tu ne pourras pas prouver — écris-le

- le **typecheck complet** et le **build**, faute des dépendances ;
- les **types Convex générés** : `convex/_generated/api.d.ts` est régénéré par l'intégrateur ;
- tout comportement **contre des données réelles** : ni base, ni session, ni société.

Écris tes tests sur la **logique pure** quand c'est possible — unicité du matricule par société,
séquence par société — et dis franchement ce qui n'a pas pu tourner. **Ne fabrique pas de harnais
jetable pour faire semblant d'avoir testé** : sur les lots précédents de ce projet, tous les
problèmes réels ont été trouvés à la relecture du diff et au typecheck, aucun n'était une faute de
l'exécutant.

---

## 9. Les livrables

1. **`multi-societe-2.patch`** — `git diff base > multi-societe-2.patch`. Le patch, pas les
   fichiers : des fichiers entiers écrasent silencieusement ce qui a bougé, un patch échoue
   bruyamment.
2. **La sortie brute de tes tests**, telle quelle.
3. **`COMPTE-RENDU.md`** : ce que tu as fait lot par lot ; ce que tu n'as pas pu vérifier ; les
   index qui te manquaient ; les endroits où tu as dû t'écarter du patron et pourquoi ; et ce que
   tu as remarqué sans y toucher.

Si tu t'arrêtes après le lot 5, c'est un bon résultat : c'est celui dont le propriétaire a besoin
pour saisir l'effectif d'EDR-TIM. Les trois autres suivront.

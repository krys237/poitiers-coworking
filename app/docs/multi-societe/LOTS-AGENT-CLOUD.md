# Multi-société — dossier de l'exécutant cloud

> Tu reçois un extrait d'un ERP **en production**. Cette fiche se suffit à elle-même : tu n'as ni le
> dépôt, ni la base, ni de session. Lis-la **en entier** avant d'écrire une ligne.
>
> Base : dépôt `poitiers-coworking`, branche `dev`. Le commit exact est écrit dans
> `BASE.txt` à la racine de l'archive.
>
> **Quatre lots, à faire dans l'ordre.** Le lot 1 ne dépend de rien. Les lots 2 à 4 consomment le
> **contrat serveur du § 6**, désormais **écrit et déployé** (`convex/entites.ts`, lot M1 du
> 26/11/2026) : les fonctions existent, mais `convex/_generated/api.d.ts` de ton archive peut ne pas
> encore les typer. Code contre le contrat **tel qu'il est écrit**.
> Si quelque chose t'y paraît faux ou manquant, **écris-le dans ton compte rendu — ne l'improvise
> pas.** Une signature inventée est le défaut le plus coûteux de ce dispositif.

---

## 0. Avant toute modification

```bash
git init && git add -A && git commit -m base && git tag base
```

**Pose bien le tag.** `git diff base` ne sait pas référencer un message de commit, et c'est ce diff
qui est le livrable.

---

## 1. Ce qu'est l'application, en cinq lignes

**POITIERS COWORKING** — plateforme de gestion de la Polyclinique de Poitiers (Cameroun, FCFA) :
approvisionnement, trésorerie, interventions, comptes rendus quotidiens, et un **moteur de paie
complet**. Une vingtaine d'écrans, une centaine de fiches employés, quatre-vingts membres.

Frontend React 18 + TypeScript + Vite. Backend **Convex** : toute `query` est un **abonnement
live** — une mutation écrit, les écrans abonnés se rafraîchissent seuls. Il n'y a ni `refetch`, ni
WebSocket à écrire. Corollaire à ne jamais oublier : **une query coûteuse coûte cher en permanence**,
pas une fois.

---

## 2. Le vocabulaire — à lire deux fois

C'est le piège n° 1 de ce chantier. Le mot « société » désignait **deux choses** dans ce dépôt.

| Terme | Ce que c'est | Dans le code |
|---|---|---|
| **entité** | une **personne morale** : POLYCLINIQUE DE POITIERS, EDR-TIM, LES LILAS. Son RC, son NIU, ses employés, ses comptes. C'est l'**espace de travail** entre lesquels on bascule. | table `entites`, champ **`entiteId`** |
| **déclarant** | `SESAME` \| `SOFINA` \| `SGC` — employeurs au sens de la **déclaration de paie**. Un bulletin par déclarant, un DIPE par déclarant. **Transversal aux entités.** | champ **`societe`**, inchangé |
| **bloc** | une colonne de la feuille de caisse du DAF : POITIERS, Les Lilas, Carte Visa… | constante `BLOCS`, hors de ta zone |

⚠️ **`societe` et `entiteId` coexistent sur la même ligne et ne veulent pas dire la même chose.**
`employes.societe === "SOFINA"` est un **déclarant** ; `employes.entiteId` est la **personne
morale**. Lire l'un en croyant tenir l'autre afficherait les données d'une autre entité. Si tu te
surprends à écrire `e.societe` pour filtrer un espace de travail, arrête-toi : c'est `e.entiteId`.

**À l'écran, l'entité s'appelle « Société ».** Le libellé utilisateur n'a pas à suivre le nom du
champ. Tes textes d'interface disent donc « Société », tes variables disent `entite`.

---

## 3. Les décisions métier opposables

Elles ne se discutent pas dans un lot. Si ton code semble les contredire, c'est ton code.

- **Multi-déclarant non consolidé** : un employé payé par deux déclarants a **deux bulletins
  indépendants**, chacun avec son plafond CNPS et ses tranches d'IRPP. Aucune addition entre
  déclarants. C'est voulu.
- **FCFA en entiers.** Jamais de décimale, jamais de `toFixed`. `Math.round` partout.
- **Heure de Douala = UTC+1 fixe**, sans heure d'été.
- **Masquer un bouton n'est pas une sécurité.** Le contrôle réel est côté serveur. Le masquage sert
  seulement à ne pas proposer une action qui échouera.
- **On avertit, on ne bloque pas.** Un formulaire qui refuse d'enregistrer la réalité pousse à le
  contourner. Quand une saisie est douteuse, affiche un avertissement et laisse passer.
- **Le périmètre ne se déduit jamais de ce que le client envoie.** Le client *propose* une entité,
  le serveur la *vérifie*. Ton sélecteur est une **préférence d'affichage**, rien de plus.

---

## 4. Ce qui t'est fourni, ce qui t'est interdit

**Fourni** (lis-les, ne les modifie pas sauf mention explicite) :

```
convex/rbac.ts                      la matrice de droits — LECTURE SEULE, c'est ton socle
convex/lib/societes.ts              déclarants et rattachements — LECTURE SEULE
src/auth/useMe.tsx                  le contrat d'interface — LECTURE SEULE
src/auth/Guard.tsx                  les gardes de route — LECTURE SEULE
src/components/Layout.tsx           le menu et le bandeau — TU LE MODIFIES (lot 2)
src/pages/Membres.tsx               l'écran des membres — TU LE MODIFIES (lot 3)
src/components/ui/                  les primitives (Button, Select, Dialog, Table…)
src/components/app/champs.tsx       Champ, ChampNombre — les enveloppes de formulaire du projet
.agents/skills/poitiers-ui-ux-system/SKILL.md   la charte visuelle — à respecter
tests/droits.test.ts                le style de test attendu
```

**Interdits, nommément.** Ils ne sont pas dans l'archive et ne doivent pas y être reconstitués :

| Jamais | Pourquoi |
|---|---|
| `.env*` | clés de déploiement, matériel JWT |
| `modele/` | noms, salaires et situations de famille réels de l'effectif |
| `archives/`, `docs/` *(racine)* | grand livre, classeurs de paie, relevés |
| `convex/schema.ts` | le modèle de données appartient à l'agent de déploiement |
| `convex/_generated/` | régénéré, toute édition est perdue |

Si un lot te semble exiger un fichier interdit, **il n'est pas délégable** : écris-le et passe au
suivant.

---

## 5. Les quatre lots

### Lot 1 — éprouver `convex/lib/perimetre.ts` jusqu'au bout

> ⚠️ **Ce lot a changé de nature le 26/11/2026.** La logique pure du périmètre a finalement été
> écrite par l'agent de déploiement, parce que les requêtes serveur du lot M1 en dépendaient et
> l'auraient décrite une seconde fois — or deux descriptions de la même règle finissent toujours par
> diverger sur ce projet. **Le module existe donc dans ton archive, et tu ne le réécris pas.**

**Intention** : porter `tests/perimetre.test.ts` d'un filet de sécurité à une couverture
exhaustive des huit règles.
**Critère d'acceptation** : `npm run test:perimetre` passe, chacune des huit règles a au moins deux
contrôles — un cas qui passe, un cas qui échoue — et aucun contrôle existant n'a été affaibli.

Le fichier `convex/lib/perimetre.ts` est fourni **en lecture seule**. Si tu y trouves un défaut,
**écris-le dans ton compte rendu** et ajoute le test qui le démontre en échec — ne corrige pas le
module. C'est à l'intégrateur d'arbitrer une règle de sécurité.

`tests/perimetre.test.ts` est fourni et **passe déjà** : il couvre les cas les plus coûteux, dont
l'escalade de privilèges. Tu l'étends, tu ne le remplaces pas.

#### Les huit règles à couvrir, et ce qui manque aujourd'hui

1. **Niveau ≥ 7 (DG, super administrateur) atteint toutes les entités actives** sans ligne d'accès.
   *Couvert.* Ajoute : un DG **sans** entité principale ; une liste d'entités vide.
2. **Tout autre rôle n'atteint que sa principale et ses accès `actif: true`.** *Couvert.* Ajoute :
   un membre à cinq accès dont trois révoqués ; un accès désignant une entité inexistante.
3. **Une entité désactivée n'est jamais atteignable**, sauf par le niveau 8. *Couvert.* Ajoute : un
   DG (7) face à une entité désactivée **qui est sa principale** — cas limite non testé.
4. **Un accès révoqué ne compte pas.** *Couvert.*
5. **L'entité principale l'emporte pour le dédoublonnage, et l'accès décide du rôle.** *Couvert.*
   Ajoute : l'ordre d'affichage quand la principale a un `ordre` élevé — elle doit rester en tête.
6. **Un accès ne peut jamais porter un rôle d'un niveau supérieur au rôle global.** *Couvert pour
   un cas.* Ajoute : chaque couple (rôle global, rôle accordé) qui doit être borné, en balayant
   `rbac.ROLES_ORDONNES` ; et le cas de l'`auditeur_externe` (niveau 0), à qui **aucun** rôle ne
   peut être accordé au-dessus du sien — vérifie que c'est bien ce que fait le module, et dis-le si
   ça te paraît discutable.
7. **Composition des droits** : défaut du rôle → surcharges globales → exceptions globales →
   exceptions de l'accès, le plus spécifique gagnant. *Partiellement couvert.* Ajoute : une
   surcharge de rôle **et** une exception d'accès sur le même module ; un module absent de toutes
   les couches.
8. **Déterminisme.** *Couvert.* Ajoute : la même entrée passée dans un ordre de tableau différent
   doit rendre le même résultat.

#### La forme

Même style que `tests/droits.test.ts` et que l'existant : pas de framework, un `check(nom, cond)`,
un compteur d'échecs, `process.exitCode` à la fin. Le script `test:perimetre` existe déjà dans
`package.json`.

⚠️ **Les modules purs importent avec l'extension `.ts`** et les types avec `import type` —
`convex/tsconfig.json` a `allowImportingTsExtensions`. Sans ça, Node refuse de démarrer.

### Lot 2 — le sélecteur de société

**Intention** : permettre de basculer d'une entité à l'autre, et faire porter l'entité active à
chaque écran.
**Critère d'acceptation** : le sélecteur n'apparaît que si le membre atteint **au moins deux**
entités ; le choix survit à un rechargement ; et aucun écran ne lit l'entité active autrement que
par le hook.

#### Ce que tu crées

`src/app/EntiteActive.tsx` — un contexte React :

```ts
export function FournisseurEntite({ children }: { children: ReactNode }): JSX.Element;
/** L'entité active, ou `undefined` tant que la liste n'est pas chargée. */
export function useEntite(): { entiteId: string | undefined; nom: string | undefined; basculer: (id: string) => void; entites: EntiteVue[] };
```

Règles :

- la liste vient de `api.entites.mesEntites` (contrat § 6) ;
- l'entité active est mémorisée en **`localStorage`**, clé `poitiers:entite-active` ;
- **si l'entité mémorisée n'est plus dans la liste** — accès révoqué, entité désactivée — on
  retombe silencieusement sur la première de la liste. Ne jamais afficher une entité hors
  périmètre, et ne jamais rester bloqué sur un écran vide ;
- tant que la liste est en cours de chargement, `entiteId` vaut `undefined` : les écrans doivent
  passer `"skip"` à leurs queries plutôt que d'appeler avec une entité vide ;
- **un seul élément dans la liste = aucun sélecteur affiché.** L'immense majorité des membres ne
  relèvent que d'une entité : ne leur montre pas un choix qui n'en est pas un.

#### Dans `src/components/Layout.tsx`

Place le sélecteur dans le **bandeau supérieur, à gauche du bloc utilisateur**. Un `Select` des
primitives du projet, pas un composant maison. Il affiche le nom de l'entité active ; au changement,
il appelle `basculer`.

⚠️ **Fichier partagé** : `Layout.tsx` porte aussi le menu et le repli de la barre latérale. Touche
**uniquement** le bandeau. Si tu dois modifier autre chose pour que ça tienne, signale-le.

#### Le câblage des écrans

Les écrans dont les données sont propres à une entité doivent passer `entiteId`. Le contrat § 6 dit
lesquelles de leurs queries l'attendent. Patron à appliquer, sans exception :

```tsx
const { entiteId } = useEntite();
const donnees = useQuery(api.module.liste, entiteId ? { entiteId } : "skip");
```

**N'invente pas d'argument sur une query qui n'en déclare pas** dans le contrat. Liste dans ton
compte rendu les écrans que tu as câblés et ceux que tu as laissés, avec la raison.

---

### Lot 3 — accorder un accès par société

**Intention** : donner à la direction le moyen d'ouvrir une société à un membre, à un rôle choisi.
**Critère d'acceptation** : un DG peut accorder, modifier et révoquer un accès ; il ne peut jamais
accorder un rôle supérieur au sien ; et la liste des accès d'un membre est lisible d'un coup d'œil.

Dans `src/pages/Membres.tsx`, sur la fiche d'un membre, un bloc **« Sociétés accessibles »** :

- la liste des accès : nom de l'entité, rôle porté, qui l'a accordé et quand, un interrupteur
  actif/révoqué ;
- un bouton pour accorder un accès : un `Select` d'entité (celles que le membre **n'a pas déjà**) et
  un `Select` de rôle ;
- les rôles proposés sont **bornés au niveau de l'auteur** — `rbac.NIVEAU` et le `me` de `useMe` ;
  nul n'accorde un rôle au-dessus du sien. C'est déjà la règle de `users.modifier`, applique-la ici.
- l'**entité principale** du membre apparaît dans la liste, marquée comme telle, et **n'est pas
  révocable** depuis ce bloc : elle se change en modifiant la fiche.

Mutations à appeler : `api.entites.accorderAcces`, `api.entites.modifierAcces`,
`api.entites.revoquerAcces` (contrat § 6).

⚠️ Masquer le bouton ne suffit pas : le serveur refuse déjà. Le masquage évite seulement de proposer
une action qui échouera.

---

### Lot 4 — le bandeau « vous êtes dans »

**Intention** : qu'on ne se trompe jamais d'entité en saisissant.
**Critère d'acceptation** : sur tout écran de **saisie** d'une entité non principale, un rappel
visible de l'entité active.

Petit lot, grosse valeur. Ce projet a déjà payé deux erreurs de saisie dues à deux champs voisins
mal distingués — une imputation de Carte Visa et une prime versée deux fois. Quand la RH saisit dans
EDR-TIM alors qu'elle travaille d'habitude dans POITIERS, elle doit le voir sans le chercher.

Un `Flag` (`src/components/app/` — regarde le skill de charte pour la variante) affiché en tête des
écrans de saisie **seulement quand l'entité active n'est pas l'entité principale du membre**. Dans
le cas courant, rien ne s'affiche : pas de bruit.

---

## 6. Le contrat serveur — **gelé**

Ces fonctions **n'existent pas encore** dans ton archive : elles sont écrites en parallèle par
l'agent de déploiement. Leurs noms, arguments et formes de retour sont **arrêtés** et ne bougeront
pas. Code contre elles telles quelles.

```ts
// Les entités que le membre courant atteint, déjà filtrées et ordonnées par le serveur.
api.entites.mesEntites: () => Promise<{
  entiteId: string; nom: string; code: string; principale: boolean; role: string;
}[]>

// Toutes les entités, pour l'administration (niveau 7+).
api.entites.liste: () => Promise<{
  entiteId: string; nom: string; code: string; actif: boolean; ordre: number;
  raisonSociale?: string; niu?: string; numeroCnps?: string; registreCommerce?: string; dirigeant?: string;
}[]>

// Les accès d'un membre, noms déjà résolus.
api.entites.accesDuMembre: (a: { membreId: string }) => Promise<{
  accesId: string; entiteId: string; entiteNom: string; role?: string;
  principale: boolean; actif: boolean; accordeParNom?: string; accordeLe?: string;
}[]>

api.entites.accorderAcces:  (a: { membreId: string; entiteId: string; role?: string }) => Promise<void>
api.entites.modifierAcces:  (a: { accesId: string; role?: string; actif?: boolean }) => Promise<void>
api.entites.revoquerAcces:  (a: { accesId: string }) => Promise<void>
```

**Les queries scopées** reçoivent toutes `entiteId: string` en **premier argument nommé**, en plus de
leurs arguments actuels. Exemple : `api.employes.liste` devient
`api.employes.liste({ entiteId, societe? })`. Le contrat détaillé écran par écran est dans
`CONTRAT-ECRANS.md` à la racine de l'archive.

⚠️ **Tu ne pourras pas typer ces appels** : `convex/_generated/api.d.ts` de ton archive ne les
connaît pas. Écris-les comme s'ils existaient, et **n'ajoute pas de `as any` pour faire taire le
compilateur** — l'intégrateur resynchronisera. Si ton éditeur se plaint, c'est normal et c'est
attendu.

---

## 7. Les pièges du projet qui touchent ta zone

1. **Ne jamais mettre un objet reconstruit à chaque rendu dans les dépendances d'un effet qui écrit
   l'état.** Payé le 24/11/2026 : un formulaire dépendait de l'objet `employe`, que le parent
   recréait à chaque rendu ; tout rafraîchissement réactif pendant la saisie réécrasait ce qui venait
   d'être tapé, et l'enregistrement renvoyait les valeurs d'origine **avec un message de succès**.
   Dépends d'un **identifiant**, pas d'un objet.
2. **Ne jamais recalculer côté écran ce que le serveur sait déjà.** Payé trois fois. Si tu as besoin
   d'un chiffre dérivé, demande-le au serveur ou réutilise **la même fonction pure** avec **les
   mêmes entrées**.
3. **Une ressemblance de chaînes n'est pas une identité de concept.** Payé le 26/11 : un garde-fou
   comparait des libellés normalisés et n'en reconnaissait qu'un sur huit. Compare des **clés**.
4. **Un `Select` de Radix refuse `value=""`.** Utilise une valeur sentinelle explicite (`"aucun"`) et
   traduis-la, comme le fait déjà le sélecteur de service de la fiche employé.
5. **`localStorage` peut lever** (mode privé, quota). Enveloppe chaque accès dans un `try/catch`,
   comme le fait `useFiltreRecap`.

---

## 8. Ce que tu ne pourras pas prouver — écris-le, ne le contourne pas

- les **signatures** du reste du projet : composants partagés, validateurs Convex, chemins d'import ;
- le **typecheck complet** et le **build**, faute des dépendances ;
- tout comportement **contre des données réelles** : tu n'as ni base, ni session, ni entité.

**Ne fabrique pas de harnais jetable pour faire semblant d'avoir testé.** C'est le défaut le plus
coûteux observé sur ce dispositif. Sur les quatre premiers lots de ce projet, **tous** les problèmes
réels ont été trouvés à la relecture du diff et au typecheck dans le dépôt — aucun n'était une faute
de l'exécutant, et tous auraient atteint la production. Un compte rendu qui dit honnêtement « je n'ai
pas pu vérifier ceci » vaut plus qu'un vert inventé.

---

## 9. Les livrables

Trois, et dans cette forme :

1. **`multi-societe.patch`** — `git diff base > multi-societe.patch`. **Le patch, pas les fichiers.**
   Des fichiers entiers écrasent silencieusement ce qui a bougé entre-temps ; un patch échoue
   bruyamment, et une perte invisible devient une erreur visible.
2. **La sortie brute de tes tests**, pas un résumé. Copie-la telle quelle.
3. **`COMPTE-RENDU.md`** : ce que tu as fait, lot par lot ; **ce que tu n'as pas pu vérifier** ; ce
   que tu as remarqué sans y toucher ; et les points où le contrat § 6 t'a paru faux ou incomplet.

Si tu ne finis pas les quatre lots, livre ce qui est fini et dis-le. Un lot 1 solide vaut mieux que
quatre lots approximatifs — c'est la clé de voûte, tout s'appuie dessus.

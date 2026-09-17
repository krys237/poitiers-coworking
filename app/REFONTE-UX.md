# Refonte UX/UI — feuille de route

> Document de reprise. L'agent qui developpe lit ce fichier **en entier** avant sa
> premiere modification, puis avance tache par tache dans l'ordre.
>
> Etat : socle technique pose et verifie. La charte visuelle n'est **pas** figee —
> elle est definie par le proprietaire du projet (voir §3).

---

## 1. Etat des lieux

### 1.1 Ce qui a motive la refonte

Mesures relevees sur le code avant travaux :

| Mesure | Valeur | Consequence |
|---|---|---|
| `src/styles.css` | 147 lignes pour 21 pages | aucun systeme de design |
| `style={{ }}` en ligne | **204** | styles disperses, coherence impossible |
| Attributs `aria-*` | **0** | accessibilite inexistante |
| `@media` | 2, toutes deux `print` | **aucun responsive** malgre la PWA installable |
| Librairie de composants | aucune | tout refait a la main, a chaque ecran |

Autres constats structurants :

- **32 tableaux**, 290 `<td>`, 213 `<th>`. Le recapitulatif salaires a **18 colonnes**.
  Le tableau est le composant central de la plateforme, pas un detail.
- **105 champs de saisie** sans un seul nom accessible.
- **70 `useMutation`** et **aucune** confirmation d'action destructive. La cloture
  d'un mois de paie — irreversible — se confirmait par un second clic sur le meme
  bouton, annule par un simple `onBlur`.
- L'etat de chargement Convex (`undefined`) s'affichait `"…"` partout : l'ecran
  saute quand les donnees arrivent.

### 1.2 Ce qui est deja fait (ne pas refaire)

**Socle technique**
- Tailwind v4 via `@tailwindcss/vite` — configuration en CSS, **pas** de `tailwind.config.js`.
- Alias `@/` -> `src/` dans `tsconfig.json` et `vite.config.ts`.
- `components.json` configure pour shadcn/ui (style `new-york`, cible `src/styles/theme.css`).
- Polices **auto-hebergees** (`@fontsource`), pas de CDN : la PWA doit s'ouvrir hors ligne
  et la connexion n'est pas garantie. Seules les variantes latines sont pre-cachees
  (voir `workbox.globIgnores` dans `vite.config.ts`).

**21 primitives shadcn** dans `src/components/ui/` :
`alert-dialog` `badge` `button` `card` `checkbox` `dialog` `dropdown-menu` `input`
`label` `popover` `scroll-area` `select` `separator` `sheet` `skeleton` `sonner`
`switch` `table` `tabs` `textarea` `tooltip`

Deux d'entre elles ont ete **reecrites** et ne doivent pas etre regenerees par la CLI :
- `table.tsx` — lignes alternees, en-tete collant, colonnes numeriques, pied de total,
  plus un composant `TableVide`.
- `badge.tsx` — variantes **metier** (`succes` `attente` `verrou` `info` `neutre` `plein`).

**Composants applicatifs** dans `src/components/app/` — voir §4 pour la table de correspondance.

**Composants de document** dans `src/components/documents/` + `src/styles/documents.css`.

**Page de reference** : route `/charte` (`src/pages/Charte.tsx`). Hors de la coquille
applicative, ne lit aucune donnee. Sert de modele et de support de validation.

**Corrections de fond apportees au passage**
- `src/lib/format.ts` : le separateur de milliers passe de l'espace fine insecable
  (U+202F) a l'espace insecable ordinaire (U+00A0). Deux raisons : U+202F est si
  etroite que « 285 000 » se lisait « 285000 » en colonne, et elle n'est pas encodable
  en Latin-1 — c'est le piege PDF documente dans `CLAUDE.md`.
- `src/pages/Courrier.tsx` : suppression d'une prop `periode` inexistante sur
  `BulletinCard`, qui mettait `npm run typecheck` en echec. **Le typecheck etait rouge
  avant les travaux ; il est vert maintenant.** C'est le garde-fou de toute la migration.

### 1.3 Etat de verification au moment de la remise

| Verification | Resultat |
|---|---|
| `npm run typecheck` | vert, 0 erreur |
| `npm run build` | passe |
| Les 8 suites `npm run test:*` | toutes OK |
| Rendu visuel desktop de `/charte` | verifie au navigateur |
| **Rendu mobile (< 480 px)** | **NON verifie** — a faire |
| **Apercu avant impression des documents A4** | **NON verifie** — a faire |

---

## 2. Les skills preselectionnees

Installees dans `.claude/skills/`. Toutes verifiees : **uniquement du Markdown, aucun
script executable**.

| Skill | Source | Quand l'utiliser |
|---|---|---|
| `frontend-design` | `anthropics/skills` | Avant toute decision esthetique : direction visuelle, typographie, ce qui fait « genere par IA » et qu'il faut eviter. |
| `web-design-guidelines` | `vercel-labs/agent-skills` | **Auditer** un ecran migre. 100+ regles, sortie en `fichier:ligne:colonne`. A lancer apres chaque lot. |
| `fixing-accessibility` | `ibelick/ui-skills` | Corriger libelles, `aria-*`, navigation clavier. Indispensable vu les 105 champs sans nom. |
| `vercel-react-best-practices` | `vercel-labs/agent-skills` | Perf React : rendus inutiles, memoisation, chargement. Pour la phase finition. |
| `vercel-composition-patterns` | `vercel-labs/agent-skills` | Architecture des composants : props booleennes a eviter, composants composes, ou remonter l'etat. |

**En reserve, non installees** — a ajouter seulement si le besoin se presente :
`ui-ux-pro-max` (base de styles et palettes), `baseline-ui` (nettoyage d'espacements),
`refactoring-ui` et `ux-heuristics` (audits de hierarchie visuelle et heuristiques de Nielsen),
`impeccable` (micro-interactions), `tailwind-design-system`.

> **Avertissement de securite.** L'etude Snyk *ToxicSkills* (2026) releve que 36,8 % des
> skills catalogues ont au moins une faille et 13,4 % une faille critique. Une skill est
> du code qui s'execute avec les droits de l'agent. Avant toute nouvelle installation :
> lire le `SKILL.md` et verifier qu'il n'y a pas de script joint.

---

## 3. La charte visuelle — etape prealable, hors developpement

**Cette etape appartient au proprietaire du projet. Le developpement ne commence pas avant
qu'elle soit close.**

### 3.1 Les references visuelles

Dossier : `../model ux-ui inspiration/` (5 images, a la racine du depot)

| Fichier | Ce qu'il apporte |
|---|---|
| `agencement general des elemets.jpg` | Disposition d'ensemble, tuiles de KPI, liste de commandes |
| `all classes.jpg` | Inventaire de composants |
| `magnifique disposition.jpg` | Mise en page |
| `sidebar-header bar.jpg` | Barre laterale et barre d'en-tete |
| `simple mais propre et ergonomique.jpg` | Coquille a trois colonnes, sobriete |

**Limite a connaitre avant de s'en servir.** Ces references sont des maquettes de
presentation : la plus chargee montre 7 colonnes et 5 indicateurs. Le recapitulatif
salaires en a **18**, editables, avec une ligne de totaux. Les references repondent a
« quelle allure a la coquille et le tableau de bord » — elles ne repondent pas a
« comment tenir 18 colonnes lisibles ». Ne pas chercher a en deduire la densite des
ecrans de paie : cette question se tranche sur l'ecran reel.

### 3.2 Ce que la charte doit produire

Une image validee ne suffit pas : **un agent ne sait pas reproduire un JPG de facon
fiable**. La charte n'est close que lorsqu'elle est ecrite sous forme exploitable :

1. **Les jetons de `src/styles/theme.css`** renseignes — couleurs nommees, echelle
   typographique, espacements, rayons, ombres. Le fichier est deja structure pour ca :
   une palette de base, puis le contrat shadcn (`--primary`, `--destructive`, `--sidebar-*`…)
   qui s'y branche. **Changer les valeurs, pas la structure.**
2. **Les polices** choisies et installees en `@fontsource` (pas de CDN).
3. **La coquille** tranchee : largeur de barre laterale, presence d'une barre d'en-tete,
   comportement sous 768 px.
4. **La densite des tableaux** tranchee sur le cas reel des 18 colonnes.

Tant que ces quatre points ne sont pas ecrits, le developpement des ecrans ne demarre pas :
il faudrait tout reprendre.

### 3.3 Fixer la charte dans une skill de projet

Le probleme pose — « comment obliger l'agent a utiliser shadcn/ui **et** mes choix
visuels » — ne se resout pas avec une skill telechargee. Les skills generalistes du §2
donnent des principes, pas **vos** decisions.

La reponse est une **skill propre au projet**, a ecrire une fois la charte close :

```
app/.claude/skills/charte-poitiers/SKILL.md
```

Elle doit contenir, et rien d'autre :

- la palette et l'echelle typographique, en jetons, avec l'interdiction d'introduire
  une couleur hors palette ;
- **l'inventaire des composants existants** et la regle : on reutilise, on n'ecrit pas
  un composant de plus sans justification ;
- la table de correspondance du §4 ;
- les garde-fous du §6 ;
- les contre-exemples : ce qu'on ne fait pas sur ce projet.

C'est ce fichier qui encadre reellement l'agent, parce qu'il est charge a chaque session
et qu'il parle du projet, pas du web en general.

---

## 4. Table de correspondance — ancien vers nouveau

L'agent s'y refere a chaque migration d'ecran.

| Ancien | Nouveau | Fichier |
|---|---|---|
| `<h1>` + `.sub` + `.bar` | `<PageEnTete titre description statut actions>` | `app/en-tete.tsx` |
| `<h3 style={{margin}}>` | `<Section titre description>` | `app/en-tete.tsx` |
| `.bar` | `<BarreOutils>` + `<BarreOutils.Espace />` | `app/en-tete.tsx` |
| `.cards` | `<GrilleTuiles>` | `app/tuile.tsx` |
| `.card` + `.k` + `.v` | `<Tuile libelle valeur note ton>` | `app/tuile.tsx` |
| `.badge` / `.warn` / `.lock` | `<Statut etat="…">` | `app/statut.tsx` |
| `paie.cloture ? … : …` | `<StatutMois cloture>` | `app/statut.tsx` |
| `fcfa(x)` en texte | `<Montant valeur devise signe gras>` | `app/montant.tsx` |
| `num(x)` en texte | `<Nombre valeur unite>` | `app/montant.tsx` |
| matricule, code | `<Reference>` | `app/montant.tsx` |
| `.note` | `<Avis ton titre action>` | `app/avis.tsx` |
| `setMsg("Erreur : …")` | `<AvisErreur erreur>` ou `toast.error` | `app/avis.tsx` |
| `"…"` pendant le chargement | `<SqueletteTableau>` `<SqueletteTuiles>` `<SqueletteTexte>` | `app/chargement.tsx` |
| `<td colSpan>Aucun…</td>` | `<TableVide colonnes>` ou `<EtatVide>` | `ui/table.tsx`, `app/etat-vide.tsx` |
| `confirmGen` (double clic) | `<BoutonConfirmation titre consequence motCle>` | `app/bouton-action.tsx` |
| `try/catch` + `setMsg` | `<BoutonAction onAction succes>` | `app/bouton-action.tsx` |
| `inp(id, champ, largeur)` | `<CelluleNombre libelle valeur onChange modifie lectureSeule>` | `app/champs.tsx` |
| `<label>` + `<input>` | `<Champ libelle aide erreur>` | `app/champs.tsx` |
| `.form` | `<GrilleFormulaire>` | `app/champs.tsx` |
| `<PeriodePicker>` | `<SelecteurPeriode valeur onChange>` | `app/selecteur-periode.tsx` |
| `table.grid` + `tbl-wrap` | `<Table>` `<TableHeader>` `<TableBody>` `<TableFooter>` | `ui/table.tsx` |
| `className="num"` | prop `numerique` sur `TableHead` / `TableCell` | `ui/table.tsx` |
| `{niveau >= 4 && …}` | `<NiveauRequis niveau={4}>` | `app/acces.tsx` |
| `useQuery(api.users.me)` | `useMoi()` | `app/acces.tsx` |
| `document.title` + `window.print()` | `useImpression()` / `<BoutonImprimer>` | `app/imprimer.tsx` |
| `<Barres data …>` | `<Barres donnees titre cleActive>` | `app/barres.tsx` |
| `.bulletin` `.bp` `.lettre` | `<Feuille>` `<EnTeteDocument>` `<TableauDocument>` `<TotalDocument>` `<CasesDocument>` `<MentionDocument>` | `documents/feuille.tsx` |

---

## 5. Les taches

Gabarit : chaque tache est atomique, verifiable, et se termine par un commit.

### Lot 0 — Charte *(proprietaire du projet, avant tout developpement)*

- **T-0.1** Choisir la direction visuelle a partir de `../model ux-ui inspiration/`.
- **T-0.2** Renseigner les jetons de `src/styles/theme.css` (valeurs uniquement).
- **T-0.3** Installer les polices retenues en `@fontsource`, mettre a jour `--font-sans` / `--font-mono`.
- **T-0.4** Trancher la coquille (barre laterale, barre d'en-tete, seuil mobile).
- **T-0.5** Trancher la densite des tableaux sur le cas des 18 colonnes.
- **T-0.6** Ecrire `app/.claude/skills/charte-poitiers/SKILL.md` (voir §3.3).
- **T-0.7** Mettre `/charte` a jour et la faire valider par le directeur.

### Lot 1 — Coquille applicative

- **T-1.1** `Layout.tsx` : barre laterale responsive (`Sheet` sous 768 px, repliable au-dessus).
  **Le filtrage `canAccess(role, i.perm)` doit rester identique** — c'est du controle d'acces.
- **T-1.2** Barre d'en-tete : fil d'Ariane, identite et role du membre connecte.
- **T-1.3** Conteneur de page standard et gestion du focus au changement de route
  (le focus doit repartir en haut du contenu, sinon la navigation clavier est perdue).
- **T-1.4** Etats de la coquille : chargement de l'identite, non connecte, role sans acces.

### Lot 2 — Ecrans structurants

- **T-2.1** `Dashboard.tsx` (11 styles en ligne) — la vitrine, et le plus gros gain visuel.
- **T-2.2** `Financier.tsx` (207 l., 21 styles en ligne, 2 tableaux) — le plus charge.
- **T-2.3** `ListeSalaires.tsx` (2 styles en ligne, imprimable).

### Lot 3 — Paie

- **T-3.1** `SaisieMensuelle.tsx` — **la plus difficile** : 18 colonnes, saisie en ligne,
  totaux en pied. Colonne « Noms et prenoms » figee horizontalement, en-tete collant,
  `CelluleNombre` avec libelle nommant ligne **et** colonne.
- **T-3.2** `Bulletins.tsx` · **T-3.3** `Primes.tsx` · **T-3.4** `Planning.tsx`
- **T-3.5** `Archives.tsx` · **T-3.6** `Bareme.tsx` · **T-3.7** `Employes.tsx`

### Lot 4 — Exploitation

- **T-4.1** `Commandes.tsx` (195 l., 3 tableaux, 12 champs) · **T-4.2** `Interventions.tsx` (177 l., 18 champs)
- **T-4.3** `Documents.tsx` · **T-4.4** `ComptesRendus.tsx` (17 styles en ligne) · **T-4.5** `Statistiques.tsx`

### Lot 5 — Controle

- **T-5.1** `Audit.tsx` (172 l., 3 tableaux) · **T-5.2** `Membres.tsx` · **T-5.3** `Journal.tsx`
- **T-5.4** `Parametres.tsx` · **T-5.5** `ApiReadme.tsx`

### Lot 6 — Documents imprimables

> Perimetre etendu sur decision du proprietaire : les documents sont refondus eux aussi.

- **T-6.1** `BulletinCard.tsx` sur les briques `documents/feuille.tsx`.
  **Les formules et la liste codee des rubriques ne changent pas** — elles sont decrites
  dans `CLAUDE.md` (« Format de paie de reference ») et font foi.
- **T-6.2** `Courrier.tsx` : lettre + bulletin, une page par personne.
- **T-6.3** Recapitulatif imprimable de `SaisieMensuelle`.
- **T-6.4** **Validation par le directeur, sur papier imprime**, avant de passer a la suite.
- **T-6.5** Aligner `convex/paiePdf.ts` (pdf-lib) sur le nouveau rendu.

### Lot 7 — Finition

- **T-7.1** Audit complet avec `web-design-guidelines`, correction des releves.
- **T-7.2** Passe `fixing-accessibility` : navigation clavier de bout en bout, contrastes, `aria-*`.
- **T-7.3** Passe mobile reelle sur telephone, PWA installee.
- **T-7.4** Suppression de `src/styles/legacy.css` (doit etre vide) et de son import.
- **T-7.5** Recette d'impression comparee avant/apres sur les trois documents.

---

## 6. Garde-fous

**A verifier apres chaque tache :**

```bash
npm run typecheck          # 0 erreur — non negociable
grep -c "style={{" <fichier migre>   # 0
npm run build
```

**A verifier apres chaque lot :**

```bash
npm run test:paie && npm run test:tresorerie && npm run test:fenetre \
  && npm run test:commandes && npm run test:stats && npm run test:audit \
  && npm run test:api && npm run test:proxy
```

**Regles qui ne se negocient pas :**

1. **Le RBAC ne bouge pas.** `canAccess`, les seuils de niveau, `EcranProtege` : une
   refonte visuelle ne touche jamais qui voit quoi. Le serveur reste seul juge ; le
   filtrage cote interface n'est qu'une commodite.
2. **Les formules de paie ne bougent pas.** `lib/paie.ts`, `lib/calculBulletins.ts`,
   la liste codee des rubriques. Reference : `CLAUDE.md`.
3. **Un mois cloture reste fige.** Aucun ecran ne doit ouvrir un champ editable sur un
   mois cloture.
4. **Toute action irreversible passe par `BoutonConfirmation`** avec sa consequence
   enoncee. La cloture d'un mois exige en plus le mot a recopier.
5. **Aucun champ sans nom accessible.** Dans un tableau, le libelle nomme la ligne
   **et** la colonne.
6. **Les montants sont des entiers FCFA.** Jamais de decimale.
7. **Une page migree retire ses regles de `legacy.css`.** Ce fichier doit retrecir a
   chaque tache et finir supprime.
8. **Une page = un commit.** Un ecran a moitie migre ne se pousse pas.

---

## 7. Pieges connus

- **Tailwind v4** se configure en CSS (`@theme`), pas en `tailwind.config.js`. Ne pas
  en creer un.
- **La CLI shadcn** ecrit `import { cn } from "cn"` dans ce projet — chemin invalide.
  Apres chaque `npx shadcn add`, corriger en `@/lib/utils` et retirer les `"use client"`
  (inutiles hors Next.js).
- **Ne pas regenerer** `table.tsx` ni `badge.tsx` : ils ont ete reecrits.
- **`sonner.tsx`** a ete degage de `next-themes` (absent du projet). Ne pas le restaurer.
- **Convex** : une query vaut `undefined` pendant le chargement et `null` quand il n'y a
  rien. Ce ne sont pas le meme etat — `undefined` appelle un squelette, `null` un ecran vide.
- **`auth.config.ts`** est analyse statiquement au push : toute variable d'environnement
  non definie fait echouer le deploiement et rend la page blanche.
- **Jamais de fichier de test dans `convex/`** : tout le dossier est bundle comme fonctions.
- **Impression** : verifier a l'apercu du navigateur, pas a l'ecran. Les aplats ont besoin
  de `print-color-adjust: exact`, deja pose dans `documents.css`.
- Un **`git stash` sans issue** subsiste peut-etre dans le depot (doublon exact du
  repertoire de travail, cree lors d'une verification). Il peut etre supprime sans risque :
  `git stash drop`.

---

## 7 bis. À faire plus tard (relevé au fil des refontes)

- **Tuiles KPI « faites main »** dans `Commandes.tsx`, `Documents.tsx`, `ComptesRendus.tsx` (et le
  bandeau de `Financier.tsx`) : les remplacer par `<Tuile>` / `<GrilleTuiles>` (`app/tuile.tsx`) pour
  une seule tuile dans toute la plateforme (celle de `Interventions.tsx` et du récapitulatif salaires).
- **`legacy.css`** : retirer `.comment` et `.thumb`, orphelins depuis la refonte de `Interventions.tsx`
  (règle n°7). À faire une fois le travail parallèle sur ce fichier commité.
- **Récapitulatif salaires** : une fois l'option tranchée en réunion, supprimer les deux onglets non
  retenus (`src/pages/recap/`) sans toucher au socle `commun.tsx`.
- **`Montant` (`app/montant.tsx`)** : passer le `zero` par défaut de « — » à « 0 » gris quand toutes les
  pages seront alignées sur le formalisme des chiffres (skill `poitiers-ui-ux-system` §3).

## 8. Ou regarder

| Quoi | Ou |
|---|---|
| Jetons de la charte | `src/styles/theme.css` |
| Documents imprimables | `src/styles/documents.css` + `src/components/documents/` |
| Ancienne feuille, a vider | `src/styles/legacy.css` |
| Primitives | `src/components/ui/` |
| Composants applicatifs | `src/components/app/` |
| Page de reference | `src/pages/Charte.tsx` -> route `/charte` |
| References visuelles | `../model ux-ui inspiration/` |
| Regles metier | `CLAUDE.md` |
| Skills | `.claude/skills/` |

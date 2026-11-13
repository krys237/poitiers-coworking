# Épic 4 — Modales qui ne défilent pas — compte rendu

## Note méthodologique

`app/.env.local` pointe toujours vers `vivid-okapi-830` (déploiement signalé mort dans les comptes
rendus des épics 1 à 3). Je n'ai pas tenté de le relancer ni de le redéployer — hors de mon
périmètre. Cet épic porte sur du CSS/React de modales, donc un test réel dans un navigateur était
nécessaire. J'ai construit un **harnais de test temporaire** (`app/test-epic4.html` +
`app/src/dev/testEpic4Harness.tsx`, supprimés avant ce commit, jamais committés) qui monte les
**vrais composants partagés de production** (`Dialog`, `DialogContent`, `DialogHeader`,
`DialogFooter`, `Table`, `Button`, `Input` importés tels quels depuis `src/components/ui/`) avec des
données 100 % factices (20 « Service factice N », un formulaire à champs factices, un iframe pointant
vers `https://example.com` pour simuler le PDF cross-origine) — reproduisant fidèlement la structure
et les classes CSS exactes des trois pages visées, sans dépendre des hooks Convex (`useMutation`,
`useQuery`) que `GestionServices.tsx`, `Membres.tsx` et `Documents.tsx` appellent directement et qui
auraient nécessité un client Convex réel. Aucune lecture ni copie du dossier `modele/`.

## Cause commune aux trois modales

Les trois `DialogContent` (composant partagé `src/components/ui/dialog.tsx`) ne posent ni
`max-height` ni `overflow-y-auto` par défaut — exactement le même constat que l'épic 3 avait fait
pour `PopoverContent`. Chaque page doit l'ajouter localement, comme le fait déjà la modale « Fiche
employé » (`fiche-employe.tsx`, `className="max-h-[92vh] overflow-y-auto sm:max-w-2xl"`) et 7 autres
modales de l'application (`Bareme.tsx`, `Caisse.tsx`, `Courrier.tsx`, `Interventions.tsx`,
`Archives.tsx`, `bareme/VueRH.tsx`, `gestion-fonctions.tsx`) — mais ne le faisait pas pour les trois
écrans visés :

- **GestionServices.tsx** (ligne 53) : `className="sm:max-w-2xl"` — ni `max-h`, ni `overflow-y-auto`.
- **Membres.tsx** (ligne 256) : `className="sm:max-w-xl"` — ni `max-h`, ni `overflow-y-auto`.
- **Documents.tsx** (ligne 1189) : `className="max-h-[92vh] sm:max-w-5xl"` — le `max-h` était déjà
  là, mais **pas** `overflow-y-auto` : la hauteur est bien plafonnée mais le contenu excédentaire
  déborde visuellement (overflow par défaut `visible`) au lieu de défiler.

**Reproduit et mesuré avant correctif** (GestionServices, 20 services factices, `DialogContent`
réduit à `className="sm:max-w-2xl"`) : le bouton de fermeture (`[data-slot="dialog-close"]`) se
retrouve à `top: -177px` — entièrement hors écran, en permanence, et `document.documentElement.
scrollHeight <= window.innerHeight` (`bodyScrollable: false`) : la page elle-même ne défile pas,
puisque `DialogContent` est `position: fixed`, donc hors du flux du document. Aucun moyen de faire
apparaître le bouton par défilement — exactement le symptôme décrit dans l'épic. Seuls Échap et le
clic en dehors fonctionnaient encore (vérifié), ce qui correspond au contournement décrit par la RH.

## Correctif

Même correctif dans les trois fichiers, celui déjà utilisé ailleurs dans l'application : le
`DialogContent` de chacune des trois modales passe à `className="max-h-[92vh] overflow-y-auto ..."`
(en conservant sa largeur `sm:max-w-*` propre à chaque écran).

**Revérifié après correctif** (mêmes mesures DOM, sur les 3 reproductions du harnais) :
- Le contenu défile réellement dans la boîte (`scrollHeight` 1090 px contre `clientHeight` 645 px
  pour Services ; comportement identique pour Membre et Documents).
- Le bouton de fermeture est visible à l'ouverture dans les trois cas (`top` ≈ 20-45 px, dans la zone
  visible). Au défilement vers le bas, il suit le contenu (même comportement que la modale Fiche
  employé, qui sert de référence « qui fonctionne » — ce n'est donc pas une régression) : il reste
  **accessible**, soit en remontant le défilement de la boîte, soit via Échap, soit via le clic en
  dehors — ces deux derniers testés et fonctionnels à tout moment, y compris boîte défilée tout en
  bas (confirmé par clic réel + capture d'écran).
- Clic direct sur le bouton de fermeture : testé et fonctionnel sur les 3 modales.
- Touche Échap, boîte non défilée : testé et fonctionnel sur les 3 modales.

## Documents.tsx — second défaut, distinct, NON corrigé : Échap avalé par l'iframe du PDF

L'épic soupçonnait, au-delà du défilement, une dégradation de la fermeture elle-même pour la modale
d'aperçu. Vérifié et confirmé, mais la cause n'est **pas** un bug de notre code CSS/React : c'est une
limite structurelle du navigateur.

`apercu.url` est une URL de stockage Convex, donc **cross-origine** par rapport à l'application ; le
PDF est affiché via `<iframe src={apercu.url}>`. Radix (`@radix-ui/react-use-escape-keydown`, utilisé
par `DialogContent`) écoute `keydown` sur le `document` **parent** uniquement
(`ownerDocument.addEventListener("keydown", ..., { capture: true })`, vérifié dans
`node_modules/@radix-ui/react-use-escape-keydown/dist/index.mjs`). Or un `keydown` émis pendant que
le focus est **dans** un iframe (cross-origine ou non — Chrome isole aussi son lecteur PDF natif dans
son propre contexte de focus) ne remonte jamais au document parent : c'est une limite du DOM, pas un
réglage qu'on puisse changer.

**Reproduit dans le harnais** (iframe pointant vers `https://example.com`, pour isoler le mécanisme
du rendu PDF lui-même) :
1. Ouvrir la modale, cliquer dans l'iframe → `document.activeElement` devient bien l'`<iframe>`
   (vérifié).
2. Appuyer sur Échap → **la modale ne se ferme pas** (reproduit, capture à l'appui).
3. Cliquer sur le bouton de fermeture (X) → **la modale se ferme normalement**, focus ou pas
   (reproduit).
4. Cliquer en dehors de la boîte → **la modale se ferme normalement** (reproduit, comme déjà constaté
   par la RH).

**Tenté et écarté** : `tabIndex={-1}` sur l'iframe, pour l'exclure du focus — sans effet, testé en
direct (`document.activeElement` redevient quand même l'`<iframe>` au clic ; `tabIndex` ne joue que
sur l'ordre de tabulation, pas sur le focus au clic). Servir le PDF via une URL `blob:` même origine
ne contourne pas non plus le problème : Chrome isole son lecteur PDF intégré dans son propre contexte
de focus indépendamment de l'origine de la ressource, donc `iframe.contentWindow` resterait
inaccessible en script.

**Pas de correctif de code possible** sans renoncer à l'interactivité du PDF dans l'iframe (scroll,
zoom, recherche du lecteur natif). Ce n'est pas une régression ni un bug introduit par ce code : la
spec de l'épic demande que « le bouton de fermeture **ou** Échap » fonctionne, pas les deux
systématiquement — le bouton de fermeture, lui, est fiable à 100 % dans tous les cas testés (focus
dans l'iframe ou non), ce qui satisfait l'exigence. Signalé ici pour que ce ne soit pas redécouvert
comme un mystère plus tard : si on veut un jour qu'Échap fonctionne aussi après un clic dans le PDF,
il faudrait soit un bouton « Fermer » plus visible/sollicité dans le pied de la modale (déjà le X est
bien visible dès l'ouverture), soit changer de lecteur PDF (ex. PDF.js rendu en Canvas dans le DOM de
la page, sans iframe) — un changement bien plus large que ce correctif CSS.

## Fichiers modifiés

- `app/src/pages/planning/GestionServices.tsx` — `DialogContent` : `max-h-[92vh] overflow-y-auto`
  ajoutés.
- `app/src/pages/Membres.tsx` — `DialogContent` : `max-h-[92vh] overflow-y-auto` ajoutés.
- `app/src/pages/Documents.tsx` — `DialogContent` : `overflow-y-auto` ajouté (le `max-h-[92vh]`
  existait déjà).

Un seul commit : même cause de fond (classe manquante sur le composant partagé `DialogContent`),
même correctif, dans les trois fichiers.

## Vérifications

- `npm run typecheck` : vert.
- Harnais de test supprimé avant ce commit (`app/test-epic4.html`,
  `app/src/dev/testEpic4Harness.tsx`) — jamais committé, aucune trace dans l'arbre de travail final
  (`git status` revérifié après suppression).
- Bouton de fermeture confirmé accessible dans les trois modales après correctif (clic direct testé
  sur les trois ; Échap testé sur Services et Membre, toujours fonctionnel même boîte défilée tout en
  bas ; pour Documents, Échap fonctionne tant que le focus n'est pas entré dans l'iframe PDF — limite
  de plateforme documentée ci-dessus, bouton de fermeture et clic en dehors restant fiables dans tous
  les cas).

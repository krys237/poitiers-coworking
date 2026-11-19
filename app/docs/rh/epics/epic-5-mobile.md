# Épic 5 — Pages cassées en version mobile (Connexion, Commandes, Planning des absences)

## Contexte

Tu travailles sur une plateforme RH/paie pour une clinique au Cameroun (POLYCLINIQUE DE POITIERS),
dans le worktree `C:\test\Js\poitiers-coworking-rh`, branche `rh` (déjà active, ne pas en changer).
Backend Convex (`app/convex/`), frontend React/Vite (`app/src/`), conventions et noms en français
partout — à respecter dans tes modifications.

La recette a été faite en partie sur mobile, et trois écrans sont signalés comme dégradés dans ce
format. Teste avec les outils de device-emulation du navigateur (largeur ~375-414px, comme un
téléphone courant) — pas seulement en rétrécissant la fenêtre desktop, le comportement tactile et
le clavier virtuel comptent pour le premier cas.

## Les trois points signalés

### 1. Page Connexion — le clavier/zoom déforme la mise en page

Fichier : `app/src/auth/Login.tsx`. Au clic dans un champ de saisie sur mobile, le clavier virtuel
s'ouvre (ou le navigateur zoome sur le champ) et la mise en page ne se réajuste pas correctement
après la saisie — probablement un champ avec une taille de police trop petite (déclenche le zoom
automatique iOS sur les champs `<input>` de moins de 16px) ou un conteneur en hauteur fixe
(`100vh`) qui ne tient pas compte du clavier virtuel qui réduit la hauteur visible réelle.

### 2. Page Commandes — mise en page cassée sur mobile

Fichier : `app/src/pages/Commandes.tsx`. Signalé comme « cassé » sans plus de détail par la RH — à
reproduire pour identifier précisément ce qui ne fonctionne pas (tableau qui déborde sans scroll
horizontal propre, boutons illisibles, formulaire qui se chevauche…).

### 3. Page Planning des absences — mise en page cassée sur mobile

Fichier probable : `app/src/pages/Planning.tsx` (vérifier s'il existe un sous-composant plus
spécifique aux absences, par exemple du côté de `app/src/pages/planning/`). Même consigne :
reproduire d'abord pour identifier le défaut exact avant de corriger.

## Démarche conseillée

1. Ouvrir chaque écran en émulation mobile (largeur téléphone), capturer ce qui casse
   concrètement.
2. Comparer avec un écran de la même famille qui, lui, fonctionne bien en mobile (ex. la page
   Employés ou le tableau de bord) pour voir quelles classes/structures responsives sont utilisées
   ailleurs dans l'app et manquent ici.
3. Corriger chaque page indépendamment (trois pages, trois causes probablement distinctes — pas de
   raison de chercher une cause commune ici, contrairement à l'épic des modales).

## Ce qui est attendu en sortie

- Les trois pages utilisables sur un écran de largeur mobile (375-414px), clavier virtuel inclus
  pour la page Connexion.
- `npm run typecheck` vert.
- Un commit par page (trois commits), message en français décrivant le défaut réel constaté et la
  correction.

## Avant de rendre

Écris un compte rendu dans `app/docs/rh/epics/comptes-rendus/epic-5.md` : pour chacune des trois
pages, ce que tu as observé concrètement en émulation mobile (la description ci-dessus est un
retour oral approximatif, pas un diagnostic), la cause, le correctif, et une confirmation visuelle
(capture d'écran si ton environnement le permet, sinon description précise de l'avant/après).

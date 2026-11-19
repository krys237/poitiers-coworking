# Épics de correction — recette RH, novembre 2026

Ce dossier contient 8 fichiers d'épic, chacun rédigé pour être donné **seul, dans une conversation
neuve**, à un agent Claude (Sonnet 5.5) qui n'a aucun autre contexte que le fichier lui-même. Chaque
fichier est donc complet : objectif, fichiers en cause, diagnostic déjà fait quand il existe,
critères de fin, et où écrire le compte rendu.

## Mode d'emploi

1. Ouvrir une nouvelle conversation Claude Code dans **ce worktree** :
   `C:\test\Js\poitiers-coworking-rh` (branche `rh`, déjà la bonne branche — ne pas en changer).
2. Donner à l'agent le contenu d'**un seul** fichier `epic-N-*.md` à la fois. Ne pas enchaîner
   plusieurs épics dans la même conversation : chacun doit entrer, lire, exécuter, rendre compte et
   sortir.
3. L'agent écrit son compte rendu dans `comptes-rendus/epic-N.md` (le fichier épic le lui redemande
   explicitement) puis s'arrête — il ne pousse rien, ne fusionne rien, ne passe pas à l'épic suivant.
4. Une fois tous les épics voulus traités, l'agent coordinateur (la conversation qui a produit ces
   fichiers) relit chaque `comptes-rendus/epic-N.md`, vérifie les diffs (`git log`, `git diff`) et
   fait un retour global.

## Ordre conseillé

1. `epic-1-cloture-paie.md` — bloquant, débloque trois scénarios en cascade.
2. `epic-2-trois-bugs-diagnostiques.md` — trois bugs déjà localisés ligne par ligne.
3. `epic-3-mode-persistant.md`
4. `epic-4-modales-non-scrollables.md`
5. `epic-5-mobile.md`
6. `epic-6-saisie-assistee.md`
7. `epic-7-navigation-tableaux.md`
8. `epic-8-export-multi-periodes.md`

Les épics 3 à 8 sont indépendants entre eux — ils peuvent être traités dans n'importe quel ordre,
voire en parallèle dans des worktrees différents, SAUF s'il y a conflit évident de fichiers (à
vérifier au cas par cas : les épics 3 et 7 touchent tous les deux des tableaux, par exemple).

## Règles communes à rappeler à chaque agent (déjà incluses dans chaque fichier épic, répétées ici
pour mémoire)

- Projet Convex + React/Vite, conventions et noms en français dans tout le code — à respecter.
- Pas de commentaire sauf si le POURQUOI n'est pas évident à la lecture (pas de commentaire qui
  répète ce que fait le code).
- `npm run typecheck` doit rester vert. Le test unitaire concerné (`npm run test:xxx`, voir chaque
  fichier épic) doit passer.
- Ne jamais lire ni copier le contenu du dossier `modele/` (données réelles de 78 employés,
  protection des données) — aucun des épics listés ici n'en a besoin.
- Commit sur la branche `rh` avec un message clair en français, format
  `type(portee): resume court` — regarder `git log --oneline -15` pour le style exact du dépôt.
  **Ne pas pousser (`git push`), ne pas fusionner, ne pas changer de branche.**
- Si le périmètre réel s'avère différent de ce que décrit le fichier épic (fichier introuvable,
  bug déjà corrigé, cause différente de celle indiquée) : le dire clairement dans le compte rendu
  plutôt que de forcer une correction qui ne correspond plus au problème.

# Journal des décisions

Décisions prises par le propriétaire du projet, dans l'ordre. Chaque entrée dit ce qui a été décidé, pourquoi,
et où c'est appliqué dans le code. Une consigne notée ici s'applique partout, pas seulement à l'écran où elle
a été formulée.

| Date | Décision | Pourquoi | Appliqué dans |
| --- | --- | --- | --- |
| 17/09/2026 | Formalisme des chiffres : milliers séparés, décimales à la virgule, unité séparée, zéro = champ vide avec placeholder « 0 » | Lecture des montants en FCFA sans ambiguïté | skill `poitiers-ui-ux-system` §3, `lib/format.ts`, `champs.tsx` |
| 18/09/2026 | « L'utilisateur qui a n éléments à saisir ne clique pas n fois » : champs persistants activables sur chaque écran de saisie en série | Rythme de saisie des services | skill §7, `saisie-persistante.tsx` |
| 18/09/2026 | Tous les tableaux : défilement intégré et nombre de lignes visibles au choix | C'est un ERP, pas une page web | skill §8, `lignes-visibles.tsx`, `ui/table.tsx` |
| 18/09/2026 | Récapitulatif salaires : option C (synthèse + volet) par défaut, « Rendre les champs persistants » bascule sur l'option A (grille) | Compromis lisibilité / vitesse de saisie | `pages/recap/*` |
| 21/09/2026 | Le niveau 6 (DA2) est retiré ; DA1 devient « Directeur Administratif (DAF) » | Aucun droit ne distinguait DA2 de DA1 | `convex/rbac.ts` |
| 21/09/2026 | Rôle **super administrateur** (niveau 8), technique : données de démo, fiche API, état du déploiement. Un DG ne peut pas l'attribuer | Séparer ce qui touche au code de ce qui touche à la clinique | `rbac.ts`, `users.ts`, `seed*.ts` |
| 21/09/2026 | Les niveaux exacts des autres rôles restent à trancher avec chaque spécialiste (comptable, DAF, RH) | Décision métier, pas technique | en attente (S2-5 du plan) |
| 21/09/2026 | « Rôles & accès » vit dans Paramètres ; Paramètres porte tout réglage non visible par l'utilisateur | Un seul endroit pour ce qui se règle une fois | `Parametres.tsx`, `lib/reglages.ts` |
| 21/09/2026 | Pas d'icône décorative sur pastille colorée ; sélecteur de section = contrôle segmenté, actif en fond océan | Charte | skill §4, `Parametres.tsx` |
| 21/09/2026 | Bulletin de paie refondu selon la maquette validée : lignes à zéro normales (estompées), net en bleu sceau, « Payé par » dans la zone salarié. Formules et rubriques inchangées | Validation du propriétaire sur maquette | `BulletinCard.tsx`, `paiePdf.ts`, `documents.css` |
| 21/09/2026 | **Téléphone : l'indicatif du pays est obligatoire partout** où un numéro est saisi ; stockage `+2376XXXXXXXX`, affichage groupé | Le numéro sert d'identifiant de connexion et doit être sans ambiguïté | `lib/telephone.ts`, `users.ts`, `Membres.tsx`, `Login.tsx` |
| 21/09/2026 | Connexion par e-mail **ou** numéro de téléphone + mot de passe ; pas d'inscription ni de code par e-mail sur l'écran (comptes pré-provisionnés). Compromis accepté : la correspondance numéro exact → e-mail est une requête publique | Comptes existants seulement pour l'instant ; pas de compte Resend | `Login.tsx`, `users.emailPourIdentifiant` |
| 21/09/2026 | `AUTH_DEV_BYPASS` coupé sur le déploiement : connexion obligatoire partout ; le technique passe par `superadmin.test@poitiers.local` (mot de passe à changer) | Le lien Vercel ne doit plus donner tous les droits | déploiement `wonderful-shark-673` |
| 21/09/2026 | Mise en service visée le vendredi 10 octobre 2026 (plan d'avancement 3 semaines) | — | plan d'avancement |

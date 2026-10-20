# Instructions pour les Agents — POITIERS COWORKING

## Contexte des environnements & Cycle de déploiement (RÈGLE MAJEURE)

> **IMPORTANT POUR TOUS LES AGENTS :**  
> Ne jamais déroger à ce cycle de travail entre les branches `dev` et `clean`.

1. **Branche `dev` (Développement & Recette) :**
   - **Rôle :** C'est la branche active de travail quotidien où nous codons et testons.
   - **Local :** `npm run dev` pour les vérifications immédiates.
   - **Recette Vercel :** Déployée sur **`https://poitiers-coworking.vercel.app/`** via le dépôt GitHub.
   - **Usage :** C'est sur cet environnement de recette que sont déroulés et validés les tests du cahier de recettes terrain.

2. **Branche `clean` (Production) :**
   - **Rôle :** Plateforme de production en direct pour les utilisateurs finaux.
   - **Production Vercel :** Déployée sur **`https://poitiers-clean.vercel.app/`**.
   - **RÈGLE STRICTE :** On ne code **jamais** directement sur `clean`. Une fonctionnalité ou un correctif n'est reporté/mergé sur `clean` **QUE** lorsqu'il est 100 % implémenté, propre, stable et validé avec succès sur `poitiers-coworking.vercel.app`.

---

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

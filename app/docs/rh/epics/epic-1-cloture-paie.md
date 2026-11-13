# Épic 1 — Erreur serveur à la clôture de la paie

## Contexte

Tu travailles sur une plateforme RH/paie pour une clinique au Cameroun (POLYCLINIQUE DE POITIERS),
dans le worktree `C:\test\Js\poitiers-coworking-rh`, branche `rh` (déjà active, ne pas en changer).
Backend Convex (`app/convex/`), frontend React/Vite (`app/src/`), conventions et noms en français
partout — à respecter dans tes modifications.

Une recette fonctionnelle a été menée par la responsable RH. Elle rapporte, en tentant de clôturer
la paie du mois d'**août 2026** : une **erreur serveur générique « Server Error : called by
client »**. Cette clôture bloque trois scénarios de recette en cascade (la génération des
bulletins, leur archivage, et leur consultation dans « Mes bulletins ») : c'est le point le plus
urgent du lot de corrections en cours.

## Objectif

Reproduire l'erreur, trouver sa cause réelle, la corriger, et vérifier que la clôture d'un mois
fonctionne de bout en bout.

## Point d'entrée

La mutation est `genererEtCloturer`, définie dans `app/convex/payroll.ts` (ligne ~20) :

```ts
export const genererEtCloturer = mutation({
  args: { periode: v.string() },
  handler: async (ctx, { periode }) => {
    const user = await requireDroit(ctx, "/paie/bulletins", "faire");
    const r = await bulletinsPourPeriode(ctx, periode);
    if (r.cloture) throw new Error("Ce mois est déjà clôturé.");
    if (!r.baremeId) throw new Error(r.erreur ?? "Aucun barème applicable à cette période.");
    // ... insertion des bulletins, de la clôture, journalisation, PDF planifié si réglage actif
  },
});
```

Elle est appelée depuis trois écrans (`app/src/pages/Bulletins.tsx:110`,
`app/src/pages/ListeSalaires.tsx:80`, `app/src/pages/recap/commun.tsx:430`), tous via
`onConfirmer={() => generer({ periode })}` après une boîte de confirmation.

Le calcul préalable, `bulletinsPourPeriode`, vit dans `app/convex/lib/calculBulletins.ts` — c'est
probablement là, ou dans une fonction qu'elle appelle, que l'exception se produit réellement :
« Server Error : called by client » est le message générique que Convex renvoie quand une
exception non prévue remonte depuis une query/mutation, donc le vrai message d'erreur est à
chercher dans les logs du serveur de dev (`npm run convex`, ou le dashboard Convex local), pas dans
le message affiché côté client.

## Comment reproduire

1. Lancer l'environnement de dev (`cd app && npm run dev` et, dans un autre terminal, le process
   Convex habituel du projet — regarder le `package.json` / la doc du dépôt si besoin).
2. Se connecter avec un compte ayant le droit `/paie/bulletins` (gestionnaire RH ou DG).
3. Aller sur l'écran Bulletins, sélectionner la période **2026-08**, lancer la clôture.
4. Observer l'erreur réelle dans les logs serveur (pas seulement le toast client).

Si aucune donnée de saisie n'existe pour août 2026 dans l'environnement de dev actuel, régénérer un
jeu de données minimal plutôt que d'utiliser le dossier `modele/` (interdit — données réelles de 78
employés, voir la règle de protection des données dans `00-LISEZ-MOI.md`). Un ou deux employés
factices avec une saisie mensuelle suffisent à reproduire une clôture.

## Pistes à vérifier, dans cet ordre

1. **`bulletinsPourPeriode`** (`calculBulletins.ts`) : une division par zéro, un accès à un champ
   `undefined` (barème manquant pour une rubrique, assiette non définie pour une société), ou une
   validation Convex (`v.string()` etc.) qui échoue sur une valeur inattendue.
2. **La boucle d'insertion** dans `genererEtCloturer` elle-même : un champ qui ne correspond plus au
   schéma Convex actuel (`app/convex/schema.ts`, table `bulletins`) — un changement de schéma récent
   (ex. le multi-société du lot R2 bis) a pu désynchroniser la forme de `b` renvoyée par
   `bulletinsPourPeriode` et la forme attendue par `ctx.db.insert("bulletins", { ... })`.
3. **Le PDF planifié** (`internal.paiePdf.archiverPdfsPlanifie`, programmé via `ctx.scheduler.
   runAfter`) : ce scheduler ne devrait PAS faire échouer la mutation elle-même (il s'exécute après,
   de façon asynchrone) — à écarter sauf si les logs prouvent le contraire.
4. **Les droits** (`requireDroit`) : écarter l'hypothèse d'un problème de permission si le même
   compte réussit à charger l'écran Bulletins normalement (donc son droit `/paie/bulletins` en
   lecture fonctionne) — le `"faire"` est une variante à vérifier spécifiquement si les pistes 1-2
   ne donnent rien.

## Ce qui est attendu en sortie

- La cause exacte identifiée (fichier + ligne).
- Le correctif appliqué.
- Une clôture réussie d'un mois de test, de bout en bout : génération des bulletins, apparition
  dans les archives, consultation dans « Mes bulletins » si tu peux tester ce chemin aussi.
- `npm run typecheck` vert.
- Un commit sur la branche `rh`, message en français, décrivant la cause réelle (pas juste
  « fix clôture paie » — dis CE QUI clochait).

## Avant de rendre

Écris un compte rendu dans `app/docs/rh/epics/comptes-rendus/epic-1.md` :
- la cause exacte trouvée (avec citation du message d'erreur réel des logs, pas le message
  générique client),
- le correctif, fichier(s) et ligne(s) modifiés,
- comment tu as reproduit et vérifié la correction,
- tout ce qui t'a semblé étrange ou mériterait un second regard (ex. si un autre mois clôturé
  antérieurement s'avère incohérent avec le nouveau comportement).

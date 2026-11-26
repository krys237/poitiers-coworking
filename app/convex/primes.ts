/**
 * Registre « Primes & retenues » — **module RETIRÉ le 26/11/2026**.
 *
 * Il offrait des LIGNES LIBRES (libellé au clavier + montant) qui s'ajoutaient au bulletin sous le
 * code générique `PRIME` ou `RETENUE`. Le Récapitulatif salaires, lui, porte treize colonnes
 * NOMMÉES, chacune avec son code de rubrique officiel, ses assiettes et sa place au DIPE.
 *
 * Décision du propriétaire : « il cause plus de problèmes qu'il ne propose de solutions, le
 * récapitulatif salaire nous permet déjà de gérer tout ce qui est prime et retenue. » Un seul
 * endroit pour saisir ce qui touche un bulletin.
 *
 * Ce qui l'a condamné, concrètement : son autocomplétion proposait huit libellés dont **six
 * recouvraient une colonne du Récapitulatif** — « Prime d'assiduité », « Prime de caisse »,
 * « Indemnité de logement »… — deux lignes sous un bandeau qui disait pourtant que celles-là se
 * saisissent ailleurs. L'écran invitait l'erreur contre laquelle il prévenait. Résultat mesuré en
 * production : PP1 a touché sa prime d'assiduité DEUX FOIS en novembre 2026, une fois par la
 * colonne et une fois par la ligne libre — 2 190 FCFA de net en trop.
 *
 * **Ce qui est retiré** : l'écran (`src/pages/Primes.tsx`), sa route, son entrée de menu, et
 * l'entrée `/paie/primes` de `rbac.MODULES`. Les quatre fonctions publiques `liste`, `ajouter`,
 * `modifier` et `supprimer` sont supprimées avec lui.
 *
 * **Ce qui est CONSERVÉ, volontairement** : la table `primesCharges`, son chemin dans le moteur
 * (`extras.primes` / `extras.charges`, rubrique `PRIME`) et son index. La table est **vide** en
 * production, donc ce chemin est inerte ; mais le garder coûte zéro, laisse une éventuelle ligne
 * ancienne lisible sur son bulletin plutôt que de la faire disparaître en silence, et évite de
 * toucher au moteur de paie et à ses tests pour un nettoyage cosmétique. Si le besoin d'une ligne
 * ponctuelle revient, seule l'interface est à reconstruire.
 */
import { internalMutation } from "./_generated/server";
import { journaliser } from "./lib/journal";

// ---------------------------------------------------------------------------
// Correction ponctuelle du 25/11/2026 — une prime payée DEUX FOIS.
//
// PP1 portait, pour novembre 2026, une prime d'assiduité de 2 500 à la fois dans la COLONNE
// `primeAssiduite` du Récapitulatif salaires et dans une LIGNE LIBRE de ce registre. Les deux
// arrivent sur le bulletin par des chemins différents — code 66122 pour la colonne, code `PRIME`
// pour la ligne libre — donc la prime était versée deux fois : brut 142 222 au lieu de 139 722,
// net 128 159 au lieu de 125 969, soit **2 190 FCFA de net en trop**.
//
// Décision du propriétaire du 25/11 : on garde la COLONNE et on retire la ligne libre. L'assiduité
// a sa rubrique dédiée, c'est sa place canonique, et elle figure ainsi sur le bulletin sous son
// code officiel plutôt que sous un `PRIME` générique.
//
// Les montants attendus sont écrits EN DUR, et la mutation refuse d'écrire si la ligne ne les porte
// pas exactement : sur une correction qui touche de la paie, mieux vaut s'arrêter en annonçant
// l'écart que supprimer sur une base qui aurait bougé. Elle vérifie en plus que la colonne porte
// bien le même montant — sans quoi ce ne serait pas un doublon, et il n'y aurait rien à retirer.
// Même esprit que `financier.corrigerImputationVisa`.
// ---------------------------------------------------------------------------
const DOUBLONS_REGISTRE: {
  matricule: string; periode: string; libelle: string; montant: number;
  type: "prime" | "charge"; champSaisie: string;
}[] = [
  { matricule: "PP1", periode: "2026-11", libelle: "Prime d'assiduité", montant: 2500, type: "prime", champSaisie: "primeAssiduite" },
];

export const retirerDoublonsRegistre = internalMutation({
  args: {},
  handler: async (ctx) => {
    const faites: { matricule: string; periode: string; libelle: string; montant: number }[] = [];
    const refusees: { matricule: string; raison: string }[] = [];

    for (const d of DOUBLONS_REGISTRE) {
      const employe = (await ctx.db.query("employes").withIndex("by_matricule", (q) => q.eq("matricule", d.matricule)).unique());
      if (!employe) { refusees.push({ matricule: d.matricule, raison: "fiche employé introuvable" }); continue; }

      const clos = await ctx.db.query("cloturesPaie").withIndex("by_periode", (q) => q.eq("periode", d.periode)).unique();
      if (clos) { refusees.push({ matricule: d.matricule, raison: `le mois ${d.periode} est clôturé` }); continue; }

      const candidates = (await ctx.db.query("primesCharges").withIndex("by_periode", (q) => q.eq("periode", d.periode)).collect())
        .filter((l) => String(l.employeId) === String(employe._id) && l.type === d.type
          && l.libelle.trim().toLowerCase() === d.libelle.toLowerCase() && l.montant === d.montant);
      if (candidates.length === 0) { refusees.push({ matricule: d.matricule, raison: "aucune ligne libre ne correspond — déjà retirée, ou modifiée depuis" }); continue; }
      if (candidates.length > 1) { refusees.push({ matricule: d.matricule, raison: `${candidates.length} lignes identiques : lever l'ambiguïté à la main` }); continue; }

      // Le doublon doit être démontré : la colonne de la saisie porte-t-elle le même montant ?
      const saisies = await ctx.db.query("saisiesMensuelles")
        .withIndex("by_employe_periode", (q) => q.eq("employeId", employe._id).eq("periode", d.periode)).collect();
      const colonne = saisies.find((x) => (x as unknown as Record<string, unknown>)[d.champSaisie] === d.montant);
      if (!colonne) {
        refusees.push({ matricule: d.matricule, raison: `la colonne « ${d.champSaisie} » ne porte pas ${d.montant} : ce n'est pas un doublon, rien n'est retiré` });
        continue;
      }

      await ctx.db.delete(candidates[0]._id);
      faites.push({ matricule: d.matricule, periode: d.periode, libelle: d.libelle, montant: d.montant });
      await journaliser(ctx, {
        action: "paie_correction",
        cible: `${d.matricule} ${d.periode}`,
        detail: `ligne libre « ${d.libelle} » de ${d.montant} FCFA retirée : la colonne « ${d.champSaisie} » porte déjà ce montant`,
      });
    }

    return { demandes: DOUBLONS_REGISTRE.length, faites, refusees };
  },
});

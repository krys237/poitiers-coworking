// Retenue à la source sur les honoraires des médecins (lot R6).
//
// Le calcul vit dans `lib/retenueMedecins.ts`, pur et testé. Ce module ne fait que lire, écrire et
// journaliser — et FIGER les montants à l'enregistrement, pour qu'une déclaration déposée se
// relise à l'identique même si la règle change ensuite.
//
// Pourquoi un module à part et non un onglet de Primes médecins : ce ne sont pas les mêmes
// chiffres. `primesMedecins` suit les rétrocessions VERSÉES aux médecins ; ici on déclare l'impôt
// prélevé sur leurs honoraires, dont la base est leur chiffre d'affaires scindé assurance /
// espèces — une donnée que l'autre écran ne porte pas.

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireDroit } from "./lib/authz";
import { journaliser } from "./lib/journal";
import {
  EXPLICATIONS, PART_ESPECES_PCT, TAUX_BASE, estTauxBase, exportCsv as csvDe,
  recapitulatif, retenueMedecin,
} from "./lib/retenueMedecins";

const MODULE = "/retenues-medecins";

/** L'état d'une période : les lignes, le récapitulatif, les anomalies, les explications. */
export const etat = query({
  args: { periode: v.string() },
  handler: async (ctx, { periode }) => {
    await requireDroit(ctx, MODULE);
    const rows = await ctx.db
      .query("retenuesMedecins")
      .withIndex("by_periode", (q) => q.eq("periode", periode))
      .collect();
    rows.sort((a, b) => a.medecin.localeCompare(b.medecin, "fr"));

    // Le récapitulatif est RECALCULÉ depuis les saisies, et comparé aux montants figés : un écart
    // signale une règle qui a bougé depuis le dépôt, et c'est une information, pas une erreur.
    const recap = recapitulatif(rows.map((r) => ({
      medecin: r.medecin, tauxBase: r.tauxBase, caAssurance: r.caAssurance,
      caEspeces: r.caEspeces, notes: r.notes,
    })));
    const retenueFigee = rows.reduce((t, r) => t + r.retenue, 0);

    return {
      periode,
      lignes: rows.map((r) => ({
        ...r,
        ...retenueMedecin({
          medecin: r.medecin, tauxBase: r.tauxBase,
          caAssurance: r.caAssurance, caEspeces: r.caEspeces, notes: r.notes,
        }),
        _id: r._id,
        retenueFigee: r.retenue,
        // Vrai si la règle a changé depuis le dépôt de cette ligne.
        recalculeDiffere: retenueMedecin({
          medecin: r.medecin, tauxBase: r.tauxBase,
          caAssurance: r.caAssurance, caEspeces: r.caEspeces,
        }).retenue !== r.retenue,
      })),
      recapitulatif: recap,
      retenueFigee,
      regleABouge: retenueFigee !== recap.retenue,
      tauxPossibles: TAUX_BASE,
      partEspecesPct: PART_ESPECES_PCT,
      explications: EXPLICATIONS,
    };
  },
});

/**
 * Le taux de la dernière déclaration d'un médecin, pour pré-remplir la suivante.
 *
 * Le taux est porté par la LIGNE et non par un référentiel : changer le taux d'un médecin
 * n'altère donc jamais les périodes déjà déclarées. L'historique reste exact, et une déclaration
 * passée se relit telle qu'elle a été déposée.
 */
export const tauxConnus = query({
  args: {},
  handler: async (ctx) => {
    await requireDroit(ctx, MODULE);
    const rows = await ctx.db.query("retenuesMedecins").collect();
    rows.sort((a, b) => b.periode.localeCompare(a.periode));
    const dernier = new Map<string, number>();
    for (const r of rows) if (!dernier.has(r.medecin)) dernier.set(r.medecin, r.tauxBase);
    return [...dernier.entries()]
      .map(([medecin, tauxBase]) => ({ medecin, tauxBase }))
      .sort((a, b) => a.medecin.localeCompare(b.medecin, "fr"));
  },
});

export const enregistrer = mutation({
  args: {
    ligneId: v.optional(v.id("retenuesMedecins")),
    periode: v.string(),
    medecin: v.string(),
    tauxBase: v.number(),
    caAssurance: v.number(),
    caEspeces: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { ligneId, ...p }) => {
    const me = await requireDroit(ctx, MODULE, "faire");
    if (!/^\d{4}-\d{2}$/.test(p.periode)) throw new Error("Période au format AAAA-MM.");
    const medecin = p.medecin.trim();
    if (!medecin) throw new Error("Nom du médecin requis.");
    if (!estTauxBase(p.tauxBase)) throw new Error("Taux attendu : 5 % ou 10 %.");
    if (p.caAssurance < 0 || p.caEspeces < 0) throw new Error("Chiffre d'affaires négatif.");
    if (!Number.isInteger(p.caAssurance) || !Number.isInteger(p.caEspeces))
      throw new Error("Chiffre d'affaires : entier FCFA attendu (pas de décimale).");

    // Un même médecin deux fois dans la même période fausserait la déclaration sans qu'aucun
    // total ne paraisse anormal : on le refuse à l'écriture plutôt que de le signaler après.
    const memePeriode = await ctx.db
      .query("retenuesMedecins")
      .withIndex("by_periode", (q) => q.eq("periode", p.periode))
      .collect();
    const doublon = memePeriode.find(
      (r) => r.medecin.trim().toLowerCase() === medecin.toLowerCase() && r._id !== ligneId,
    );
    if (doublon) throw new Error(`${medecin} figure déjà dans cette période : modifiez sa ligne.`);

    const calc = retenueMedecin({ ...p, medecin });
    const doc = {
      periode: p.periode, medecin, tauxBase: p.tauxBase,
      caAssurance: calc.caAssurance, caEspeces: calc.caEspeces,
      base: calc.base, taux: calc.taux, retenue: calc.retenue,
      notes: p.notes?.trim() || undefined,
    };

    if (ligneId) {
      const avant = await ctx.db.get(ligneId);
      if (!avant) throw new Error("Ligne introuvable.");
      await ctx.db.patch(ligneId, doc);
    } else {
      await ctx.db.insert("retenuesMedecins", doc);
    }
    await journaliser(ctx, {
      auteurId: me._id, auteurNom: me.nom ?? me.email,
      action: ligneId ? "retenue_medecin_modification" : "retenue_medecin_creation",
      cible: `${p.periode} · ${medecin}`,
      detail: `base ${calc.base} × ${calc.taux} % = ${calc.retenue} FCFA`,
    });
    return { retenue: calc.retenue, base: calc.base, taux: calc.taux };
  },
});

export const supprimer = mutation({
  args: { ligneId: v.id("retenuesMedecins"), motif: v.string() },
  handler: async (ctx, { ligneId, motif }) => {
    const me = await requireDroit(ctx, MODULE, "faire");
    const l = await ctx.db.get(ligneId);
    if (!l) throw new Error("Ligne introuvable.");
    // Un motif obligatoire : une ligne retirée d'une déclaration fiscale doit laisser une trace
    // de la raison, pas seulement de la suppression.
    if (!motif.trim()) throw new Error("Motif de la suppression requis.");
    await ctx.db.delete(ligneId);
    await journaliser(ctx, {
      auteurId: me._id, auteurNom: me.nom ?? me.email, action: "retenue_medecin_suppression",
      cible: `${l.periode} · ${l.medecin}`, detail: `${l.retenue} FCFA — ${motif.trim()}`,
    });
  },
});

/** CSV de la déclaration du mois. */
export const exportCsv = query({
  args: { periode: v.string() },
  handler: async (ctx, { periode }) => {
    await requireDroit(ctx, MODULE);
    const rows = await ctx.db
      .query("retenuesMedecins")
      .withIndex("by_periode", (q) => q.eq("periode", periode))
      .collect();
    rows.sort((a, b) => a.medecin.localeCompare(b.medecin, "fr"));
    return {
      nomFichier: `retenue-medecins-${periode}.csv`,
      csv: csvDe(periode, rows.map((r) => ({
        medecin: r.medecin, tauxBase: r.tauxBase,
        caAssurance: r.caAssurance, caEspeces: r.caEspeces,
      }))),
    };
  },
});

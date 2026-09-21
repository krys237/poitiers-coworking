import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireLevel } from "./lib/authz";
import { journaliser } from "./lib/journal";
import { bulletinsPourPeriode } from "./lib/calculBulletins";
import { internal } from "./_generated/api";
import { lireReglages } from "./parametres";

// Requête RÉACTIVE : les bulletins du mois (calcul à la volée, ou snapshots si le mois est clôturé).
export const bulletinsDuMois = query({
  args: { periode: v.string() },
  handler: async (ctx, { periode }) => {
    await requireLevel(ctx, 4);
    return await bulletinsPourPeriode(ctx, periode);
  },
});

// Génère et FIGE les bulletins du mois, puis clôture (verrou), comme le grand livre financier.
export const genererEtCloturer = mutation({
  args: { periode: v.string() },
  handler: async (ctx, { periode }) => {
    const user = await requireLevel(ctx, 4);
    const r = await bulletinsPourPeriode(ctx, periode);
    if (r.cloture) throw new Error("Ce mois est déjà clôturé.");
    if (!r.baremeId) throw new Error(r.erreur ?? "Aucun barème applicable à cette période.");

    const genereLe = new Date().toISOString();
    for (const b of r.bulletins) {
      await ctx.db.insert("bulletins", {
        employeId: b.employeId, periode, baremeId: b.baremeId, societe: b.societe,
        brut: b.brut, totalRetenues: b.totalRetenues, net: b.net,
        lignesGain: b.lignesGain, cotisations: b.cotisations, details: b.details, statut: "genere", genereLe,
      });
    }
    await ctx.db.insert("cloturesPaie", { periode, closedBy: user._id, closedAt: genereLe, baremeId: r.baremeId });
    await journaliser(ctx, { auteurId: user._id, auteurNom: user.nom ?? user.email, action: "cloture_paie", cible: periode, detail: `${r.bulletins.length} bulletin(s) figé(s)` });
    // Réglage « PDF à la clôture » : les bulletins figés sont rendus et archivés dans la foulée.
    const pdfAuto = (await lireReglages(ctx)).pdfAutoCloture;
    if (pdfAuto) await ctx.scheduler.runAfter(0, internal.paiePdf.archiverPdfsPlanifie, { periode });
    return { periode, bulletins: r.bulletins.length, pdfPlanifies: pdfAuto };
  },
});

// Les saisies brutes du mois (pour l'édition), indexées par employé.
export const saisiesDuMois = query({
  args: { periode: v.string() },
  handler: async (ctx, { periode }) => {
    await requireLevel(ctx, 4);
    const rows = await ctx.db.query("saisiesMensuelles").withIndex("by_periode", (q) => q.eq("periode", periode)).collect();
    return Object.fromEntries(rows.map((r) => [r.employeId, r]));
  },
});

const VALEURS = v.object({
  joursTravailles: v.number(), absencesJours: v.number(), sanctions: v.number(),
  primesVariables: v.number(), transport: v.number(), heuresSup: v.number(),
  anciennete: v.number(), mutuellePct: v.number(), dettesSoins: v.number(), acompte: v.number(),
  primeAssiduite: v.optional(v.number()), indemniteLogement: v.optional(v.number()), absences: v.optional(v.number()),
});

// Saisie/màj des éléments variables d'un employé pour un mois (déclenche le recalcul réactif).
export const saisirMois = mutation({
  args: { employeId: v.id("employes"), periode: v.string(), valeurs: VALEURS },
  handler: async (ctx, { employeId, periode, valeurs }) => {
    await requireLevel(ctx, 4);
    const clos = await ctx.db.query("cloturesPaie").withIndex("by_periode", (q) => q.eq("periode", periode)).unique();
    if (clos) throw new Error(`Le mois ${periode} est clôturé : saisie en lecture seule.`);
    // Bornes de saisie : une case de tableau n'a pas de garde-fou, le serveur en a un.
    if (valeurs.joursTravailles < 0 || valeurs.joursTravailles > 31) throw new Error("Jours travaillés : entre 0 et 31.");
    if (valeurs.mutuellePct < 0 || valeurs.mutuellePct > 100) throw new Error("Mutuelle : pourcentage entre 0 et 100.");
    const plafond = (await lireReglages(ctx)).plafondSaisie;
    for (const [k, x] of Object.entries(valeurs)) {
      if (typeof x !== "number" || !Number.isFinite(x)) throw new Error(`Valeur invalide pour ${k}.`);
      if (x < 0) throw new Error(`Montant négatif interdit (${k}).`);
      if (k !== "joursTravailles" && k !== "mutuellePct" && k !== "absencesJours" && x > plafond) throw new Error(`Montant invraisemblable pour ${k} (> ${plafond.toLocaleString("fr-FR")} FCFA — plafond réglable dans Paramètres).`);
    }
    const existant = await ctx.db.query("saisiesMensuelles")
      .withIndex("by_employe_periode", (q) => q.eq("employeId", employeId).eq("periode", periode)).unique();
    const v2 = { ...valeurs, primeAssiduite: valeurs.primeAssiduite ?? 0, indemniteLogement: valeurs.indemniteLogement ?? 0, absences: valeurs.absences ?? 0 };
    if (existant) await ctx.db.patch(existant._id, v2);
    else await ctx.db.insert("saisiesMensuelles", { employeId, periode, ...v2 });
  },
});

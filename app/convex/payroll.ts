import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireDroit, requireUnDesDroits } from "./lib/authz";
import { journaliser } from "./lib/journal";
import { bulletinsPourPeriode } from "./lib/calculBulletins";
import { cleCouple, pourSociete, societePrincipale, SOCIETES } from "./lib/societes";
import { internal } from "./_generated/api";
import { lireReglages } from "./parametres";

// Requête RÉACTIVE : les bulletins du mois (calcul à la volée, ou snapshots si le mois est clôturé).
export const bulletinsDuMois = query({
  args: { periode: v.string() },
  handler: async (ctx, { periode }) => {
    await requireUnDesDroits(ctx, ["/paie/bulletins", "/paie/liste", "/paie/saisie", "/paie/archives", "/paie/courrier"]);
    return await bulletinsPourPeriode(ctx, periode);
  },
});

// Génère et FIGE les bulletins du mois, puis clôture (verrou), comme le grand livre financier.
export const genererEtCloturer = mutation({
  args: { periode: v.string() },
  handler: async (ctx, { periode }) => {
    const user = await requireDroit(ctx, "/paie/bulletins", "faire");
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

/**
 * Les saisies brutes du mois (pour l'édition), indexées par COUPLE `<employeId>:<SOCIETE>` — la
 * même clé que `BulletinPeriode.cle`. Une ligne enregistrée avant le lot R2 bis n'a pas de société
 * et relève de la société porteuse de la fiche : elle garde donc sa clé d'origine et reste
 * modifiable, avant comme après la migration.
 */
export const saisiesDuMois = query({
  args: { periode: v.string() },
  handler: async (ctx, { periode }) => {
    await requireDroit(ctx, "/paie/saisie");
    const rows = await ctx.db.query("saisiesMensuelles").withIndex("by_periode", (q) => q.eq("periode", periode)).collect();
    const principaleDe = new Map<string, "SESAME" | "SOFINA" | "SGC">();
    for (const r of rows) {
      const id = String(r.employeId);
      if (r.societe || principaleDe.has(id)) continue;
      const e = await ctx.db.get(r.employeId);
      if (!e) continue;
      const lignes = await ctx.db.query("rattachements").withIndex("by_employe", (q) => q.eq("employeId", r.employeId)).collect();
      principaleDe.set(id, societePrincipale(e, lignes));
    }
    return Object.fromEntries(rows.map((r) => {
      const societe = r.societe ?? principaleDe.get(String(r.employeId));
      // Fiche employé disparue : la ligne reste exposée sous son identifiant brut plutôt que perdue.
      return [societe ? cleCouple(String(r.employeId), societe) : String(r.employeId), r];
    }));
  },
});

const VALEURS = v.object({
  joursTravailles: v.number(), absencesJours: v.number(), sanctions: v.number(),
  primesVariables: v.number(), transport: v.number(), heuresSup: v.number(),
  anciennete: v.number(), ancienneteSeparee: v.optional(v.number()),
  mutuellePct: v.number(), dettesSoins: v.number(), acompte: v.number(),
  primeAssiduite: v.optional(v.number()), indemniteLogement: v.optional(v.number()), absences: v.optional(v.number()),
  primeSalissure: v.optional(v.number()),
  primePanier: v.optional(v.number()),
  primeLait: v.optional(v.number()),
  indemniteRepresentation: v.optional(v.number()),
  indemniteVehicule: v.optional(v.number()),
  primeCaisse: v.optional(v.number()),
  primeRendement: v.optional(v.number()),
  indemniteOutillage: v.optional(v.number()),
  gratification: v.optional(v.number()),
});

// Saisie/màj des éléments variables d'un COUPLE (employé, société) pour un mois : chaque société
// verse sa part et la saisit à part (décision du 20/10/2026). `societe` absente = société porteuse
// de la fiche, ce qui laisse tous les appels existants fonctionner à l'identique.
export const saisirMois = mutation({
  args: {
    employeId: v.id("employes"), periode: v.string(), valeurs: VALEURS,
    societe: v.optional(v.union(v.literal("SESAME"), v.literal("SOFINA"), v.literal("SGC"))),
  },
  handler: async (ctx, { employeId, periode, valeurs, societe: societeDemandee }) => {
    await requireDroit(ctx, "/paie/saisie", "faire");
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
    const employe = await ctx.db.get(employeId);
    if (!employe) throw new Error("Fiche employé introuvable.");
    const lignes = await ctx.db.query("rattachements").withIndex("by_employe", (q) => q.eq("employeId", employeId)).collect();
    const principale = societePrincipale(employe, lignes);
    const societe = societeDemandee ?? principale;
    if (!SOCIETES.includes(societe)) throw new Error("Société inconnue.");
    // La société doit effectivement rémunérer cet employé : sinon la saisie produirait un bulletin
    // chez un employeur qui ne l'emploie pas.
    const actives = lignes.filter((l) => l.actif).map((l) => l.societe);
    if (actives.length && !actives.includes(societe)) {
      throw new Error(`${employe.nom} n'est pas rattaché à ${societe} : ajoutez le rattachement dans l'écran Employés.`);
    }

    // Toutes les saisies du couple (employé, mois), société comprise ou non : `pourSociete` retrouve
    // la bonne et évite de créer un doublon à côté d'une ligne antérieure sans société.
    const toutes = await ctx.db.query("saisiesMensuelles")
      .withIndex("by_employe_periode", (q) => q.eq("employeId", employeId).eq("periode", periode)).collect();
    const existant = pourSociete(toutes, societe, principale);
    const v2 = { ...valeurs, primeAssiduite: valeurs.primeAssiduite ?? 0, indemniteLogement: valeurs.indemniteLogement ?? 0, absences: valeurs.absences ?? 0 };
    if (existant) await ctx.db.patch(existant._id, { ...v2, societe });
    else await ctx.db.insert("saisiesMensuelles", { employeId, periode, societe, ...v2 });
  },
});

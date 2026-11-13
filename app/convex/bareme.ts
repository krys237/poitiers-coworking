import { query, mutation, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { requireDroit } from "./lib/authz";
import { journaliser } from "./lib/journal";
import { BAREME_DEFAUT, validerTranches } from "./lib/paie";
import { vueRH as vueRHPure } from "./lib/vueRH";
import { baremeFromDoc, baremePourPeriode } from "./lib/calculBulletins";
import { rubriquesPourPeriode } from "./rubriques";

// "YYYY-MM" -> "YYYY-MM-01"
const debutMois = (periode: string) => `${periode}-01`;

// Barème applicable à une période : dernière version active dont effectiveFrom <= début du mois.
export const pourPeriode = query({
  args: { periode: v.string() },
  handler: async (ctx, { periode }) => {
    const debut = debutMois(periode);
    const candidats = await ctx.db.query("baremes").withIndex("by_effective").order("desc").collect();
    return candidats.find((b) => b.statut === "actif" && b.effectiveFrom <= debut) ?? null;
  },
});

export const liste = query({
  args: {},
  handler: async (ctx) => {
    await requireDroit(ctx, "/bareme");
    return await ctx.db.query("baremes").withIndex("by_effective").order("desc").collect();
  },
});

const valeursV = v.object({
  plafondCnps: v.number(), tauxPvidSal: v.number(), tauxPvidPat: v.number(), tauxPf: v.number(), tauxAtmp: v.number(),
  tauxCfcSal: v.number(), tauxCfcPat: v.number(), tauxFne: v.number(), abattementIrppPct: v.number(), tauxCac: v.number(),
  irppBrackets: v.array(v.object({ jusqua: v.union(v.number(), v.null()), taux: v.number() })),
  abattementIrppAnnuel: v.optional(v.number()), tdlActif: v.optional(v.boolean()), ravActif: v.optional(v.boolean()),
  // Corrections du lot R2 : absentes = comportement d'avant la correction.
  transportTaxable: v.optional(v.boolean()), atmpPlafonne: v.optional(v.boolean()),
  cfcPatronalEtFneSurBrut: v.optional(v.boolean()), seuilExoneration: v.optional(v.number()),
  groupeRisqueAtmp: v.optional(v.union(v.literal("A"), v.literal("B"), v.literal("C"))),
  tdlBareme: v.optional(v.array(v.object({ jusqua: v.union(v.number(), v.null()), montant: v.number() }))), ravBareme: v.optional(v.array(v.object({ jusqua: v.union(v.number(), v.null()), montant: v.number() }))),
  // Allocation de congé (lot R4) : absentes = les valeurs arbitrées du 05/11/2026.
  allocationPlafondMois: v.optional(v.number()),
  allocationMoisAvantPremierConge: v.optional(v.number()),
  allocationConventionFraction: v.optional(v.union(
    v.literal("jours_du_mois"), v.literal("trente"), v.literal("trente_virgule_44"),
  )),
});

// Nouvelle version datée (DG). Sans `valeurs` : BAREME_DEFAUT (amorçage).
export const upsert = mutation({
  args: { effectiveFrom: v.string(), valeurs: v.optional(valeursV), source: v.string() },
  handler: async (ctx, { effectiveFrom, valeurs, source }) => {
    const me = await requireDroit(ctx, "/bareme", "faire");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)) throw new Error("Date d'effet au format AAAA-MM-JJ.");
    const b = valeurs ?? BAREME_DEFAUT;
    const tranches = [...b.irppBrackets];
    if (!tranches.length || tranches[tranches.length - 1].jusqua !== null) throw new Error("La dernière tranche IRPP doit être ouverte (plafond vide).");
    // Les forfaits sont lus par `baremeInf`, qui renvoie la PREMIÈRE tranche satisfaite : un
    // seuil mal ordonné masquerait silencieusement les suivantes.
    const erreurs = [
      ...(b.tdlBareme?.length ? validerTranches(b.tdlBareme, "TDL") : []),
      ...(b.ravBareme?.length ? validerTranches(b.ravBareme, "RAV") : []),
    ];
    if (erreurs.length) throw new Error(erreurs.join(" "));
    const id = await ctx.db.insert("baremes", {
      effectiveFrom, plafondCnps: b.plafondCnps, tauxPvidSal: b.tauxPvidSal, tauxPvidPat: b.tauxPvidPat, tauxPf: b.tauxPf, tauxAtmp: b.tauxAtmp,
      tauxCfcSal: b.tauxCfcSal, tauxCfcPat: b.tauxCfcPat, tauxFne: b.tauxFne, abattementIrppPct: b.abattementIrppPct, tauxCac: b.tauxCac,
      irppBrackets: tranches, abattementIrppAnnuel: b.abattementIrppAnnuel ?? 500000, tdlActif: b.tdlActif ?? true, ravActif: b.ravActif ?? true,
      transportTaxable: b.transportTaxable, atmpPlafonne: b.atmpPlafonne,
      cfcPatronalEtFneSurBrut: b.cfcPatronalEtFneSurBrut, seuilExoneration: b.seuilExoneration,
      groupeRisqueAtmp: b.groupeRisqueAtmp,
      tdlBareme: b.tdlBareme, ravBareme: b.ravBareme,
      allocationPlafondMois: b.allocationPlafondMois,
      allocationMoisAvantPremierConge: b.allocationMoisAvantPremierConge,
      allocationConventionFraction: b.allocationConventionFraction,
      source, controleLe: new Date().toISOString(), statut: "actif",
    });
    await journaliser(ctx, { auteurId: me._id, auteurNom: me.nom ?? me.email, action: "bareme_version", cible: effectiveFrom, detail: source });
    return id;
  },
});

// Version active la plus récente (pour le job de contrôle).
export const actifInterne = internalQuery({
  args: {},
  handler: async (ctx) => (await ctx.db.query("baremes").withIndex("by_effective").order("desc").collect()).find((b) => b.statut === "actif") ?? null,
});

// Journalise le résultat d'un contrôle de la source officielle (appelé par le job).
export const marquerControle = internalMutation({
  args: { baremeId: v.id("baremes"), controleLe: v.string(), detail: v.optional(v.string()) },
  handler: async (ctx, { baremeId, controleLe, detail }) => {
    await ctx.db.patch(baremeId, { controleLe });
    await journaliser(ctx, { action: "bareme_controle", cible: "barème actif", detail: detail ?? "contrôle effectué" });
  },
});

// Dernier contrôle (journal) + version active, pour l'écran Barème et le tableau de bord.
export const dernierControle = query({
  args: {},
  handler: async (ctx) => {
    await requireDroit(ctx, "/bareme");
    const ev = await ctx.db.query("journalActivite").withIndex("by_action", (q) => q.eq("action", "bareme_controle")).order("desc").first();
    const actif = (await ctx.db.query("baremes").withIndex("by_effective").order("desc").collect()).find((b) => b.statut === "actif") ?? null;
    return { dernier: ev ? { date: ev.date, detail: ev.detail ?? "" } : null, sourceConfiguree: !!process.env.BAREME_SOURCE_URL, actif: actif ? { effectiveFrom: actif.effectiveFrom, controleLe: actif.controleLe ?? null, source: actif.source } : null };
  },
});

// « Vérifier maintenant » (niveau 4+) : planifie le contrôle ; le résultat arrive dans le journal et sur `controleLe`.
export const verifierMaintenant = mutation({
  args: {},
  handler: async (ctx) => {
    await requireDroit(ctx, "/bareme");
    await ctx.scheduler.runAfter(0, internal.bareme.controlerBaremeOfficiel, {});
    return { planifie: true };
  },
});

// Job planifié (cron quotidien) : lit la source officielle CNPS/CGI si BAREME_SOURCE_URL est configurée ;
// sinon journalise « source non configurée ». En cas d'échec, le barème existant est conservé (repli manuel).
export const controlerBaremeOfficiel = internalAction({
  args: {},
  handler: async (ctx): Promise<{ resultat: string }> => {
    const actif: { _id: any } | null = await ctx.runQuery(internal.bareme.actifInterne, {});
    const source = process.env.BAREME_SOURCE_URL;
    let resultat: string;
    if (!source) resultat = "source officielle non configurée (BAREME_SOURCE_URL) — barème actif conservé";
    else {
      try {
        const res = await fetch(source, { headers: { Accept: "application/json,text/html" } });
        resultat = res.ok ? `source joignable (HTTP ${res.status}) — comparaison à implémenter, barème actif conservé` : `source injoignable (HTTP ${res.status}) — barème actif conservé`;
      } catch (e) { resultat = `source injoignable (${(e as Error).message}) — barème actif conservé`; }
    }
    if (actif) await ctx.runMutation(internal.bareme.marquerControle, { baremeId: actif._id, controleLe: new Date().toISOString(), detail: resultat });
    else await ctx.runMutation(internal.journal.ecrire, { action: "bareme_controle", detail: `aucun barème actif — ${resultat}` });
    return { resultat };
  },
});

/**
 * « Vue RH » du barème (lot R9) — tout le détail des règles de calcul, pour que la responsable RH
 * puisse vérifier nos chiffres SANS nous. Chaque valeur est lue dans le barème applicable à la
 * période et chaque étape de l'exemple est calculée par le moteur réel : la vue ne peut pas
 * dériver du calcul.
 *
 * Visible dès le niveau 4 comme le reste de l'écran Barème — c'est une aide à la lecture, pas une
 * action.
 */
export const vueRH = query({
  args: { periode: v.string(), exemple: v.optional(v.object({
    salaireBase: v.number(), anciennete: v.number(), transport: v.number(),
    primeAssiduite: v.number(), indemniteLogement: v.number(),
  })) },
  handler: async (ctx, { periode, exemple }) => {
    await requireDroit(ctx, "/bareme");
    const doc = await baremePourPeriode(ctx, periode);
    if (!doc) return { periode, trouve: false as const };

    const bareme = baremeFromDoc(doc);
    const rubriques = await rubriquesPourPeriode(ctx, periode);
    return {
      periode,
      trouve: true as const,
      effectiveFrom: doc.effectiveFrom,
      source: doc.source,
      // Un barème antérieur au lot R2 ne porte pas les interrupteurs de correction : la vue le
      // dit, sinon la RH lirait des règles qui ne sont pas celles appliquées à sa période.
      correctionsActives: {
        transportTaxable: doc.transportTaxable ?? false,
        atmpPlafonne: doc.atmpPlafonne ?? true,
        cfcPatronalEtFneSurBrut: doc.cfcPatronalEtFneSurBrut ?? false,
        seuilExoneration: doc.seuilExoneration ?? 0,
      },
      ...vueRHPure(bareme, rubriques, exemple),
    };
  },
});

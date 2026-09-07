import { query, mutation, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { requireLevel } from "./lib/authz";
import { journaliser } from "./lib/journal";
import { BAREME_DEFAUT } from "./lib/paie";

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
    await requireLevel(ctx, 4);
    return await ctx.db.query("baremes").withIndex("by_effective").order("desc").collect();
  },
});

const valeursV = v.object({
  plafondCnps: v.number(), tauxPvidSal: v.number(), tauxPvidPat: v.number(), tauxPf: v.number(), tauxAtmp: v.number(),
  tauxCfcSal: v.number(), tauxCfcPat: v.number(), tauxFne: v.number(), abattementIrppPct: v.number(), tauxCac: v.number(),
  irppBrackets: v.array(v.object({ jusqua: v.union(v.number(), v.null()), taux: v.number() })),
});

// Nouvelle version datée (DG). Sans `valeurs` : BAREME_DEFAUT (amorçage).
export const upsert = mutation({
  args: { effectiveFrom: v.string(), valeurs: v.optional(valeursV), source: v.string() },
  handler: async (ctx, { effectiveFrom, valeurs, source }) => {
    const me = await requireLevel(ctx, 7);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)) throw new Error("Date d'effet au format AAAA-MM-JJ.");
    const b = valeurs ?? BAREME_DEFAUT;
    const tranches = [...b.irppBrackets];
    if (!tranches.length || tranches[tranches.length - 1].jusqua !== null) throw new Error("La dernière tranche IRPP doit être ouverte (plafond vide).");
    const id = await ctx.db.insert("baremes", {
      effectiveFrom, plafondCnps: b.plafondCnps, tauxPvidSal: b.tauxPvidSal, tauxPvidPat: b.tauxPvidPat, tauxPf: b.tauxPf, tauxAtmp: b.tauxAtmp,
      tauxCfcSal: b.tauxCfcSal, tauxCfcPat: b.tauxCfcPat, tauxFne: b.tauxFne, abattementIrppPct: b.abattementIrppPct, tauxCac: b.tauxCac,
      irppBrackets: tranches, source, controleLe: new Date().toISOString(), statut: "actif",
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
    await requireLevel(ctx, 4);
    const ev = await ctx.db.query("journalActivite").withIndex("by_action", (q) => q.eq("action", "bareme_controle")).order("desc").first();
    const actif = (await ctx.db.query("baremes").withIndex("by_effective").order("desc").collect()).find((b) => b.statut === "actif") ?? null;
    return { dernier: ev ? { date: ev.date, detail: ev.detail ?? "" } : null, sourceConfiguree: !!process.env.BAREME_SOURCE_URL, actif: actif ? { effectiveFrom: actif.effectiveFrom, controleLe: actif.controleLe ?? null, source: actif.source } : null };
  },
});

// « Vérifier maintenant » (niveau 4+) : planifie le contrôle ; le résultat arrive dans le journal et sur `controleLe`.
export const verifierMaintenant = mutation({
  args: {},
  handler: async (ctx) => {
    await requireLevel(ctx, 4);
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

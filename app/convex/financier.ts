import { query, mutation, internalMutation, internalQuery, MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc } from "./_generated/dataModel";
import { getCurrentUser, requireLevel } from "./lib/authz";
import { journaliser } from "./lib/journal";
import { calculerSoldes, recetteTotale, periodeDe, Mouvements, Soldes } from "./lib/tresorerie";

const VERROU_MS = 15 * 60 * 1000; // expiration d'un verrou inactif
type Ctx = QueryCtx | MutationCtx;

const mouvementsV = v.record(v.string(), v.record(v.string(), v.number()));
const soldesV = v.record(v.string(), v.number());

async function journeeAvant(ctx: Ctx, date: string) {
  return await ctx.db.query("journeesFinancieres").withIndex("by_date", (q) => q.lt("date", date)).order("desc").first();
}
async function moisCloture(ctx: Ctx, periode: string) {
  return !!(await ctx.db.query("cloturesFinancieres").withIndex("by_periode", (q) => q.eq("periode", periode)).unique());
}
function verrouActif(j: Doc<"journeesFinancieres"> | null) {
  if (!j?.verrouParId || !j.verrouAt) return false;
  return Date.now() - Date.parse(j.verrouAt) < VERROU_MS;
}

// Ouverture effective d'une journée : J0 saisis manuellement, sinon soldes de la dernière journée précédente.
async function ouverturePour(ctx: Ctx, date: string, j: Doc<"journeesFinancieres"> | null): Promise<{ soldes: Soldes; manuels: boolean; source: string | null }> {
  if (j?.soldesOuvertureManuels) return { soldes: j.soldesOuverture, manuels: true, source: null };
  const prev = await journeeAvant(ctx, date);
  return { soldes: prev ? prev.soldes : {}, manuels: false, source: prev?.date ?? null };
}

// La journée d'une date (existante ou virtuelle), avec soldes calculés, verrou, clôture, pièces.
export const journee = query({
  args: { date: v.string() },
  handler: async (ctx, { date }) => {
    const me = await requireLevel(ctx, 5);
    const j = await ctx.db.query("journeesFinancieres").withIndex("by_date", (q) => q.eq("date", date)).unique();
    const ouverture = await ouverturePour(ctx, date, j);
    const mouvements: Mouvements = j?.mouvements ?? {};
    const pieces: Record<string, string | null> = {};
    for (const [cle, id] of Object.entries(j?.pieces ?? {})) pieces[cle] = await ctx.storage.getUrl(id);
    const actif = verrouActif(j);
    return {
      date, periode: periodeDe(date), existe: !!j,
      cloture: (j?.cloture ?? false) || (await moisCloture(ctx, periodeDe(date))),
      mouvements, pieces, notes: j?.notes ?? "",
      soldesOuverture: ouverture.soldes, soldesOuvertureManuels: ouverture.manuels, ouvertureDepuis: ouverture.source,
      soldes: calculerSoldes(ouverture.soldes, mouvements), recetteTotale: recetteTotale(mouvements),
      verrou: { actif, mien: actif && j?.verrouParId === me._id, parNom: actif ? j?.verrouNom ?? "?" : null, at: actif ? j?.verrouAt ?? null : null },
    };
  },
});

// Recalcule en chaîne les journées suivantes (report J-1) après une modification.
async function recalculerSuivantes(ctx: MutationCtx, date: string) {
  const suivantes = await ctx.db.query("journeesFinancieres").withIndex("by_date", (q) => q.gt("date", date)).order("asc").collect();
  let prev = await ctx.db.query("journeesFinancieres").withIndex("by_date", (q) => q.eq("date", date)).unique();
  for (const s of suivantes) {
    const ouverture = s.soldesOuvertureManuels ? s.soldesOuverture : (prev?.soldes ?? {});
    const soldes = calculerSoldes(ouverture, s.mouvements);
    await ctx.db.patch(s._id, { soldesOuverture: ouverture, soldes });
    prev = { ...s, soldesOuverture: ouverture, soldes };
  }
}

// Écriture d'une journée (utilisée par la mutation publique et par le seed).
export async function ecrireJournee(ctx: MutationCtx, args: {
  date: string; mouvements: Mouvements; notes?: string; soldesOuverture?: Soldes;
  userId?: Doc<"users">["_id"]; userNom?: string;
}) {
  const periode = periodeDe(args.date);
  if (await moisCloture(ctx, periode)) throw new Error(`Le mois ${periode} est clôturé : journée immuable.`);
  const j = await ctx.db.query("journeesFinancieres").withIndex("by_date", (q) => q.eq("date", args.date)).unique();
  if (j?.cloture) throw new Error("Journée clôturée : immuable.");
  if (j && verrouActif(j) && args.userId && j.verrouParId !== args.userId) throw new Error(`Tableau verrouillé par ${j.verrouNom ?? "un autre membre"}.`);

  const manuels = args.soldesOuverture !== undefined || (j?.soldesOuvertureManuels ?? false);
  const ouverture = args.soldesOuverture ?? (j?.soldesOuvertureManuels ? j.soldesOuverture : (await ouverturePour(ctx, args.date, null)).soldes);
  const soldes = calculerSoldes(ouverture, args.mouvements);
  const now = new Date().toISOString();
  const doc = {
    date: args.date, periode, mouvements: args.mouvements, soldesOuverture: ouverture, soldesOuvertureManuels: manuels,
    soldes, recetteTotale: recetteTotale(args.mouvements), notes: args.notes ?? j?.notes ?? "", cloture: false,
    verrouParId: args.userId, verrouAt: args.userId ? now : undefined, verrouNom: args.userNom,
    pieces: j?.pieces,
  };
  if (j) await ctx.db.patch(j._id, doc); else await ctx.db.insert("journeesFinancieres", doc);
  await recalculerSuivantes(ctx, args.date);
  return { soldes, recetteTotale: doc.recetteTotale };
}

export const enregistrer = mutation({
  args: { date: v.string(), mouvements: mouvementsV, notes: v.optional(v.string()), soldesOuverture: v.optional(soldesV) },
  handler: async (ctx, a) => {
    const me = await requireLevel(ctx, 5);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(a.date)) throw new Error("Date au format AAAA-MM-JJ.");
    return await ecrireJournee(ctx, { ...a, userId: me._id, userNom: me.nom ?? me.email });
  },
});

// Verrou d'édition concurrent (crée la journée vide si nécessaire).
export const prendreVerrou = mutation({
  args: { date: v.string() },
  handler: async (ctx, { date }) => {
    const me = await requireLevel(ctx, 5);
    const j = await ctx.db.query("journeesFinancieres").withIndex("by_date", (q) => q.eq("date", date)).unique();
    if (j && verrouActif(j) && j.verrouParId !== me._id) throw new Error(`Tableau verrouillé par ${j.verrouNom ?? "un autre membre"}.`);
    const now = new Date().toISOString();
    if (j) { await ctx.db.patch(j._id, { verrouParId: me._id, verrouAt: now, verrouNom: me.nom ?? me.email }); return { cree: false }; }
    await ecrireJournee(ctx, { date, mouvements: {}, userId: me._id, userNom: me.nom ?? me.email });
    return { cree: true };
  },
});

export const libererVerrou = mutation({
  args: { date: v.string() },
  handler: async (ctx, { date }) => {
    await requireLevel(ctx, 5);
    const j = await ctx.db.query("journeesFinancieres").withIndex("by_date", (q) => q.eq("date", date)).unique();
    if (j) await ctx.db.patch(j._id, { verrouParId: undefined, verrouAt: undefined, verrouNom: undefined });
  },
});

// Clôture mensuelle : toutes les journées du mois deviennent immuables.
export const cloturerMois = mutation({
  args: { periode: v.string() },
  handler: async (ctx, { periode }) => {
    const me = await requireLevel(ctx, 5);
    if (await moisCloture(ctx, periode)) throw new Error("Mois déjà clôturé.");
    const journees = await ctx.db.query("journeesFinancieres").withIndex("by_periode", (q) => q.eq("periode", periode)).collect();
    for (const j of journees) await ctx.db.patch(j._id, { cloture: true, verrouParId: undefined, verrouAt: undefined, verrouNom: undefined });
    await ctx.db.insert("cloturesFinancieres", { periode, closedBy: me._id, closedAt: new Date().toISOString(), journees: journees.length });
    await journaliser(ctx, { auteurId: me._id, auteurNom: me.nom ?? me.email, action: "cloture_financier", cible: periode, detail: `${journees.length} journée(s) figée(s)` });
    return { periode, journees: journees.length };
  },
});

export const clotures = query({
  args: {},
  handler: async (ctx) => { await requireLevel(ctx, 5); return await ctx.db.query("cloturesFinancieres").collect(); },
});

// Historique des 14 dernières journées saisies (≤ date).
export const historique = query({
  args: { date: v.string(), jours: v.optional(v.number()) },
  handler: async (ctx, { date, jours }) => {
    await requireLevel(ctx, 5);
    const rows = await ctx.db.query("journeesFinancieres").withIndex("by_date", (q) => q.lte("date", date)).order("desc").take(jours ?? 14);
    return rows.map((j) => ({ date: j.date, recetteTotale: j.recetteTotale, soldes: j.soldes, cloture: j.cloture, notes: j.notes ?? "" }));
  },
});

// Justificatifs : upload puis rattachement à une ligne ("bloc.ligne").
export const genererUploadUrl = mutation({
  args: {},
  handler: async (ctx) => { await requireLevel(ctx, 5); return await ctx.storage.generateUploadUrl(); },
});

export const attacherPiece = mutation({
  args: { date: v.string(), cle: v.string(), storageId: v.id("_storage") },
  handler: async (ctx, { date, cle, storageId }) => {
    const me = await requireLevel(ctx, 5);
    let j = await ctx.db.query("journeesFinancieres").withIndex("by_date", (q) => q.eq("date", date)).unique();
    if (!j) { await ecrireJournee(ctx, { date, mouvements: {}, userId: me._id, userNom: me.nom ?? me.email }); j = (await ctx.db.query("journeesFinancieres").withIndex("by_date", (q) => q.eq("date", date)).unique())!; }
    if (j.cloture) throw new Error("Journée clôturée : immuable.");
    await ctx.db.patch(j._id, { pieces: { ...(j.pieces ?? {}), [cle]: storageId } });
  },
});

// KPI pour le tableau de bord.
export const kpi = query({
  args: {},
  handler: async (ctx) => {
    const me = await getCurrentUser(ctx);
    if (!me) return null;
    const aujourdHui = new Date().toISOString().slice(0, 10);
    const jour = await ctx.db.query("journeesFinancieres").withIndex("by_date", (q) => q.eq("date", aujourdHui)).unique();
    const derniere = await ctx.db.query("journeesFinancieres").withIndex("by_date").order("desc").first();
    return {
      recetteDuJour: jour?.recetteTotale ?? null,
      derniere: derniere ? { date: derniere.date, recetteTotale: derniere.recetteTotale, f3Poitiers: derniere.soldes.poitiers_f3 ?? 0 } : null,
    };
  },
});

// Utilisé par le seed (pas d'auth : interne).
export const ecrireJourneeInterne = internalMutation({
  args: { date: v.string(), mouvements: mouvementsV, notes: v.optional(v.string()), soldesOuverture: v.optional(soldesV) },
  handler: async (ctx, a) => {
    const existe = await ctx.db.query("journeesFinancieres").withIndex("by_date", (q) => q.eq("date", a.date)).unique();
    if (existe) return { cree: false };
    await ecrireJournee(ctx, a);
    return { cree: true };
  },
});

// ---- Phase 4 ----
// Journée pour l'API d'export (appelée par l'HTTP action, pas d'auth : la clé API est vérifiée en amont).
export const journeePourApi = internalQuery({
  args: { date: v.string() },
  handler: async (ctx, { date }) => {
    const j = await ctx.db.query("journeesFinancieres").withIndex("by_date", (q) => q.eq("date", date)).unique();
    if (!j) return null;
    return { date: j.date, periode: j.periode, cloture: j.cloture, mouvements: j.mouvements, soldesOuverture: j.soldesOuverture, soldes: j.soldes, recetteTotale: j.recetteTotale };
  },
});

// Purge des verrous expirés (cron hebdomadaire) : nettoie les traces de verrous de plus de 15 min.
export const purgerVerrousExpires = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("journeesFinancieres").collect();
    let n = 0;
    for (const j of rows) {
      if (j.verrouParId && !verrouActif(j)) { await ctx.db.patch(j._id, { verrouParId: undefined, verrouAt: undefined, verrouNom: undefined }); n++; }
    }
    if (n) await journaliser(ctx, { action: "verrous_purge", detail: `${n} verrou(s) expiré(s) purgé(s)` });
    return { purges: n };
  },
});

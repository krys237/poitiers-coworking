import { query, mutation, internalMutation, internalQuery, MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc } from "./_generated/dataModel";
import { getCurrentUser, requireDroit, droitsDuMembre } from "./lib/authz";
import { journaliser } from "./lib/journal";

import { calculerSoldes, recetteTotale, periodeDe, Mouvements, Soldes } from "./lib/tresorerie";
import { lireReglages } from "./parametres";

type Ctx = QueryCtx | MutationCtx;

const mouvementsV = v.record(v.string(), v.record(v.string(), v.number()));
const soldesV = v.record(v.string(), v.number());

async function journeeAvant(ctx: Ctx, date: string) {
  return await ctx.db.query("journeesFinancieres").withIndex("by_date", (q) => q.lt("date", date)).order("desc").first();
}
async function moisCloture(ctx: Ctx, periode: string) {
  return !!(await ctx.db.query("cloturesFinancieres").withIndex("by_periode", (q) => q.eq("periode", periode)).unique());
}
// Un verrou inactif expire après `verrouFinancierMin` minutes (Paramètres → Fonctionnement, déf. 15).
// Le verrou vit dans `verrousFinanciers`, pas sur la journée : poser un verrou ne doit rien
// écrire dans le grand livre. Les champs `verrou*` de `journeesFinancieres` sont des vestiges,
// encore acceptés par le schéma mais plus jamais écrits ; `purgerVerrousExpires` les efface.
async function lireVerrou(ctx: Ctx, date: string) {
  const v = await ctx.db.query("verrousFinanciers").withIndex("by_date", (q) => q.eq("date", date)).unique();
  if (!v) return null;
  const minutes = (await lireReglages(ctx)).verrouFinancierMin;
  return Date.now() - Date.parse(v.at) < minutes * 60 * 1000 ? v : null;
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
    const me = await requireDroit(ctx, "/financier");
    const j = await ctx.db.query("journeesFinancieres").withIndex("by_date", (q) => q.eq("date", date)).unique();
    const ouverture = await ouverturePour(ctx, date, j);
    const mouvements: Mouvements = j?.mouvements ?? {};
    const pieces: Record<string, string | null> = {};
    for (const [cle, id] of Object.entries(j?.pieces ?? {})) pieces[cle] = await ctx.storage.getUrl(id);
    const verrou = await lireVerrou(ctx, date);
    return {
      date, periode: periodeDe(date), existe: !!j,
      cloture: (j?.cloture ?? false) || (await moisCloture(ctx, periodeDe(date))),
      mouvements, pieces, notes: j?.notes ?? "",
      soldesOuverture: ouverture.soldes, soldesOuvertureManuels: ouverture.manuels, ouvertureDepuis: ouverture.source,
      soldes: calculerSoldes(ouverture.soldes, mouvements), recetteTotale: recetteTotale(mouvements),
      verrou: { actif: !!verrou, mien: verrou?.parId === me._id, parNom: verrou?.parNom ?? null, at: verrou?.at ?? null },
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
  // Garde-fou au point de passage UNIQUE de toute écriture de journée. `enregistrer` validait
  // déjà le format, mais pas `prendreVerrou` — qui crée la journée vide quand elle n'existe pas.
  // Résultat constaté en production le 04/11/2026 : une journée de date "" a été créée, et comme
  // `journeeAvant` compare les dates lexicographiquement, "" précède toute date réelle — cette
  // ligne fantôme s'était donc installée à l'origine de la chaîne des soldes reportés.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date)) throw new Error("Date au format AAAA-MM-JJ.");
  const periode = periodeDe(args.date);
  if (await moisCloture(ctx, periode)) throw new Error(`Le mois ${periode} est clôturé : journée immuable.`);
  const j = await ctx.db.query("journeesFinancieres").withIndex("by_date", (q) => q.eq("date", args.date)).unique();
  if (j?.cloture) throw new Error("Journée clôturée : immuable.");
  const verrou = await lireVerrou(ctx, args.date);
  if (verrou && args.userId && verrou.parId !== args.userId) throw new Error(`Tableau verrouillé par ${verrou.parNom}.`);

  const manuels = args.soldesOuverture !== undefined || (j?.soldesOuvertureManuels ?? false);
  const ouverture = args.soldesOuverture ?? (j?.soldesOuvertureManuels ? j.soldesOuverture : (await ouverturePour(ctx, args.date, null)).soldes);
  const soldes = calculerSoldes(ouverture, args.mouvements);
  const now = new Date().toISOString();
  const doc = {
    date: args.date, periode, mouvements: args.mouvements, soldesOuverture: ouverture, soldesOuvertureManuels: manuels,
    soldes, recetteTotale: recetteTotale(args.mouvements), notes: args.notes ?? j?.notes ?? "",
    cloture: false, pieces: j?.pieces,
  };
  if (j) await ctx.db.patch(j._id, doc); else await ctx.db.insert("journeesFinancieres", doc);
  // Celui qui enregistre garde la main : le verrou est posé ou prolongé dans sa propre table.
  if (args.userId) await poserVerrou(ctx, args.date, args.userId, args.userNom ?? "?", now);
  await recalculerSuivantes(ctx, args.date);
  return { soldes, recetteTotale: doc.recetteTotale };
}

export const enregistrer = mutation({
  args: { date: v.string(), mouvements: mouvementsV, notes: v.optional(v.string()), soldesOuverture: v.optional(soldesV) },
  handler: async (ctx, a) => {
    const me = await requireDroit(ctx, "/financier", "faire");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(a.date)) throw new Error("Date au format AAAA-MM-JJ.");
    return await ecrireJournee(ctx, { ...a, userId: me._id, userNom: me.nom ?? me.email });
  },
});

async function poserVerrou(ctx: MutationCtx, date: string, parId: Doc<"users">["_id"], parNom: string, at: string) {
  const v = await ctx.db.query("verrousFinanciers").withIndex("by_date", (q) => q.eq("date", date)).unique();
  if (v) await ctx.db.patch(v._id, { parId, parNom, at });
  else await ctx.db.insert("verrousFinanciers", { date, parId, parNom, at });
}

// Verrou d'édition concurrent. **N'écrit rien dans le grand livre** : la journée n'est créée
// qu'à l'enregistrement. Ouvrir un tableau pour le consulter ne doit laisser aucune trace
// comptable — c'est ainsi que des journées à zéro, nées d'une simple navigation, se sont
// retrouvées dans l'historique de production (constaté le 11/11/2026).
export const prendreVerrou = mutation({
  args: { date: v.string() },
  handler: async (ctx, { date }) => {
    const me = await requireDroit(ctx, "/financier", "faire");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Date au format AAAA-MM-JJ.");
    if (await moisCloture(ctx, periodeDe(date))) throw new Error(`Le mois ${periodeDe(date)} est clôturé : journée immuable.`);
    const j = await ctx.db.query("journeesFinancieres").withIndex("by_date", (q) => q.eq("date", date)).unique();
    if (j?.cloture) throw new Error("Journée clôturée : immuable.");
    const verrou = await lireVerrou(ctx, date);
    if (verrou && verrou.parId !== me._id) throw new Error(`Tableau verrouillé par ${verrou.parNom}.`);
    await poserVerrou(ctx, date, me._id, me.nom ?? me.email ?? "?", new Date().toISOString());
    return { cree: false };
  },
});

export const libererVerrou = mutation({
  args: { date: v.string() },
  handler: async (ctx, { date }) => {
    await requireDroit(ctx, "/financier", "faire");
    const v = await ctx.db.query("verrousFinanciers").withIndex("by_date", (q) => q.eq("date", date)).unique();
    if (v) await ctx.db.delete(v._id);
  },
});

// Clôture mensuelle : toutes les journées du mois deviennent immuables.
export const cloturerMois = mutation({
  args: { periode: v.string() },
  handler: async (ctx, { periode }) => {
    const me = await requireDroit(ctx, "/financier", "faire");
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
  handler: async (ctx) => { await requireDroit(ctx, "/financier"); return await ctx.db.query("cloturesFinancieres").collect(); },
});

// Historique des 14 dernières journées saisies (≤ date).
export const historique = query({
  args: { date: v.string(), jours: v.optional(v.number()) },
  handler: async (ctx, { date, jours }) => {
    await requireDroit(ctx, "/financier");
    const rows = await ctx.db.query("journeesFinancieres").withIndex("by_date", (q) => q.lte("date", date)).order("desc").take(jours ?? 14);
    return rows.map((j) => ({ date: j.date, recetteTotale: j.recetteTotale, soldes: j.soldes, cloture: j.cloture, notes: j.notes ?? "" }));
  },
});

// Justificatifs : upload puis rattachement à une ligne ("bloc.ligne").
export const genererUploadUrl = mutation({
  args: {},
  handler: async (ctx) => { await requireDroit(ctx, "/financier", "faire"); return await ctx.storage.generateUploadUrl(); },
});

export const attacherPiece = mutation({
  args: { date: v.string(), cle: v.string(), storageId: v.id("_storage") },
  handler: async (ctx, { date, cle, storageId }) => {
    const me = await requireDroit(ctx, "/financier", "faire");
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
    // Les soldes du grand livre ne s'affichent qu'à qui peut voir le module, même sur le
    // tableau de bord (découvert en testant le compte « employé »).
    const me = await getCurrentUser(ctx);
    if (!me || !me.isActive || me.enAttente || !(await droitsDuMembre(ctx, me))["/financier"].voir) return null;
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
// Correction ponctuelle du 06/11/2026 — imputation de la Carte Visa.
//
// La Visa encaissée avait été portée en caisse POITIERS (`poitiers.visa`), qui alimente le solde
// F3. Or la règle arrêtée par le propriétaire est de la porter sur la carte (`carte_visa.depot`).
// Cinq journées suivaient l'ancienne imputation, et de trois manières différentes — d'où un F3
// gonflé de 410 400 et un solde carte à −15 500, résidu de deux écritures contradictoires.
//
// Les montants attendus sont écrits ici en dur : la mutation REFUSE d'écrire si la journée ne
// porte pas exactement la somme prévue. Sur une correction qui touche de l'argent, mieux vaut
// qu'elle s'arrête en annonçant l'écart que de recalculer sur une base qui aurait bougé.
const CORRECTIONS_VISA: { date: string; visaAttendue: number; depotAAjouter: number; note: string }[] = [
  // Ajoutée le 06/11, après coup : la saisie du 15/10 est retombée dans le même piège. L'écran
  // offre deux champs aux libellés voisins — « Carte Visa » dans le bloc Recettes POITIERS, et
  // « Dépôt Carte Visa » dans le bloc Carte Visa — et c'est le premier qui se trouve là où l'on
  // saisit les recettes du jour. La cause est dans l'écran, pas dans la saisie.
  { date: "2026-10-15", visaAttendue: 73600, depotAAjouter: 73600, note: "" },
  { date: "2026-10-16", visaAttendue: 88600, depotAAjouter: 88600, note: "" },
  // Le retrait carte de 67 400 de cette journée est laissé INTACT : nul ne sait encore s'il
  // correspond à une opération réelle ou à un doublon d'écriture. À trancher avec la DAF.
  { date: "2026-10-17", visaAttendue: 67400, depotAAjouter: 67400, note: "retrait carte de 67 400 conservé, à arbitrer" },
  // Le dépôt de 51 900 EXISTE DÉJÀ sur cette journée : l'argent y était compté deux fois, en
  // caisse et sur la carte. On retire donc la part caisse sans rien ajouter.
  { date: "2026-10-18", visaAttendue: 51900, depotAAjouter: 0, note: "dépôt déjà présent, non doublé" },
  { date: "2026-10-19", visaAttendue: 68400, depotAAjouter: 68400, note: "" },
  { date: "2026-10-21", visaAttendue: 134100, depotAAjouter: 134100, note: "" },
];

export const corrigerImputationVisa = internalMutation({
  args: {},
  handler: async (ctx) => {
    const faites: { date: string; visaRetiree: number; depotApres: number; note: string }[] = [];
    const ignorees: { date: string; raison: string }[] = [];

    // Ordre croissant des dates : chaque écriture recalcule la chaîne en aval, donc remonter le
    // temps dans l'ordre évite de recalculer plusieurs fois sur des bases intermédiaires.
    for (const c of CORRECTIONS_VISA) {
      const j = await ctx.db.query("journeesFinancieres").withIndex("by_date", (q) => q.eq("date", c.date)).unique();
      if (!j) { ignorees.push({ date: c.date, raison: "journée absente" }); continue; }

      const visa = j.mouvements?.poitiers?.visa ?? 0;
      if (visa === 0) { ignorees.push({ date: c.date, raison: "déjà corrigée (aucune Visa en caisse)" }); continue; }
      if (visa !== c.visaAttendue) {
        ignorees.push({ date: c.date, raison: `Visa en caisse de ${visa}, attendue ${c.visaAttendue} — données modifiées depuis, correction refusée` });
        continue;
      }

      const mouvements = JSON.parse(JSON.stringify(j.mouvements ?? {}));
      mouvements.poitiers.visa = 0;
      if (c.depotAAjouter) {
        mouvements.carte_visa = { ...(mouvements.carte_visa ?? {}) };
        mouvements.carte_visa.depot = (mouvements.carte_visa.depot ?? 0) + c.depotAAjouter;
      }
      await ecrireJournee(ctx, { date: c.date, mouvements });
      faites.push({ date: c.date, visaRetiree: visa, depotApres: mouvements.carte_visa?.depot ?? 0, note: c.note });
    }

    const dernier = await ctx.db.query("journeesFinancieres").withIndex("by_date").order("desc").first();
    return {
      faites, ignorees,
      soldesApres: dernier ? { date: dernier.date, poitiers_f3: dernier.soldes.poitiers_f3, carte_visa: dernier.soldes.carte_visa } : null,
    };
  },
});

// Maintenance : supprime les journées dont la DATE est invalide — séquelles du défaut corrigé
// dans `ecrireJournee` (voir son commentaire). Interne et appelée au CLI admin, sur le modèle de
// `users:restaurerRole` documenté dans CLAUDE.md comme porte de secours.
//
// Volontairement prudente : elle refuse de toucher une journée qui porte des mouvements, un solde
// non nul ou une pièce justificative. Une date invalide ne devrait jamais rien contenir ; si c'est
// le cas, c'est un autre problème et il faut regarder avant de supprimer.
export const purgerJourneesInvalides = internalMutation({
  args: {},
  handler: async (ctx) => {
    const toutes = await ctx.db.query("journeesFinancieres").collect();
    const supprimees: string[] = [];
    const conservees: { date: string; raison: string }[] = [];
    for (const j of toutes) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(j.date)) continue;
      const aDesMouvements = Object.values(j.mouvements ?? {}).some((b) => Object.values(b ?? {}).some((v) => v !== 0));
      const aUnSolde = Object.values(j.soldes ?? {}).some((v) => v !== 0);
      const aUnePiece = Object.keys(j.pieces ?? {}).length > 0;
      if (aDesMouvements || aUnSolde || aUnePiece) {
        conservees.push({ date: j.date, raison: aDesMouvements ? "porte des mouvements" : aUnSolde ? "solde non nul" : "pièce jointe" });
        continue;
      }
      await ctx.db.delete(j._id);
      supprimees.push(j.date === "" ? "(date vide)" : j.date);
    }
    return { examinees: toutes.length, supprimees, conservees };
  },
});

// Retire les journées blanches nées d'une simple consultation, du temps où `prendreVerrou`
// créait la journée pour y poser le verrou. On ne supprime QUE ce qui est démontrablement vide,
// et on rend compte de ce qui a été refusé — une journée réellement saisie à zéro par le
// comptable porterait au moins une pièce, une note, ou une ouverture manuelle.
export const supprimerJourneesBlanches = internalMutation({
  args: { dates: v.array(v.string()) },
  handler: async (ctx, { dates }) => {
    const supprimees: string[] = [];
    const refusees: { date: string; raison: string }[] = [];
    for (const date of dates) {
      const j = await ctx.db.query("journeesFinancieres").withIndex("by_date", (q) => q.eq("date", date)).unique();
      if (!j) { refusees.push({ date, raison: "aucune journée à cette date" }); continue; }
      const raison =
        Object.values(j.mouvements ?? {}).some((b) => Object.values(b ?? {}).some((v) => v !== 0)) ? "porte des mouvements"
        : Object.keys(j.pieces ?? {}).length > 0 ? "porte une pièce jointe"
        : (j.notes ?? "").trim() !== "" ? "porte une note"
        : j.soldesOuvertureManuels ? "porte une ouverture saisie à la main"
        : j.cloture ? "journée clôturée"
        : await moisCloture(ctx, j.periode) ? "mois clôturé"
        : null;
      if (raison) { refusees.push({ date, raison }); continue; }
      await ctx.db.delete(j._id);
      supprimees.push(date);
    }
    // La chaîne des reports repart de la plus ancienne date touchée.
    if (supprimees.length) await recalculerSuivantes(ctx, [...supprimees].sort()[0]);
    return { demandees: dates.length, supprimees, refusees };
  },
});

// Rejoue TOUTE la chaîne des journées avec la formule courante. À lancer après un changement du
// modèle de soldes (`lib/tresorerie.ts`), sans quoi chaque journée recalculerait avec la nouvelle
// formule sur une ouverture héritée de l'ancienne — une chaîne bâtarde, et des chiffres que
// personne ne peut rapprocher d'un relevé. Ne touche à aucun mouvement : elle ne fait que
// recalculer ouvertures, soldes et recette, et rend le détail de ce qui a bougé.
export const recalculerToutesLesJournees = internalMutation({
  args: {},
  handler: async (ctx) => {
    const journees = await ctx.db.query("journeesFinancieres").withIndex("by_date").collect();
    const changements: { date: string; avant: number; apres: number }[] = [];
    let precedent: Soldes | null = null;
    for (const j of journees) {
      const ouverture = j.soldesOuvertureManuels ? j.soldesOuverture : (precedent ?? {});
      const soldes = calculerSoldes(ouverture, j.mouvements);
      const recette = recetteTotale(j.mouvements);
      const avant = Math.round(j.soldes?.poitiers_f3 ?? 0);
      const apres = Math.round(soldes.poitiers_f3 ?? 0);
      if (avant !== apres) changements.push({ date: j.date, avant, apres });
      await ctx.db.patch(j._id, { soldesOuverture: ouverture, soldes, recetteTotale: recette });
      precedent = soldes;
    }
    return { journees: journees.length, f3Modifies: changements.length, changements };
  },
});

export const purgerVerrousExpires = internalMutation({
  args: {},
  handler: async (ctx) => {
    const minutes = (await lireReglages(ctx)).verrouFinancierMin;
    let n = 0;
    for (const v of await ctx.db.query("verrousFinanciers").collect()) {
      if (Date.now() - Date.parse(v.at) >= minutes * 60 * 1000) { await ctx.db.delete(v._id); n++; }
    }
    // Vestiges de l'époque où le verrou vivait sur la journée : on les efface au passage.
    let vestiges = 0;
    for (const j of await ctx.db.query("journeesFinancieres").collect()) {
      if (j.verrouParId || j.verrouAt || j.verrouNom) {
        await ctx.db.patch(j._id, { verrouParId: undefined, verrouAt: undefined, verrouNom: undefined });
        vestiges++;
      }
    }
    if (n || vestiges) await journaliser(ctx, { action: "verrous_purge", detail: `${n} verrou(s) expiré(s) purgé(s), ${vestiges} vestige(s) effacé(s)` });
    return { purges: n, vestiges };
  },
});

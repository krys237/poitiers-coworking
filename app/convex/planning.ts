import { query, mutation, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { requireLevel } from "./lib/authz";
import { resumeMois, joursCalendaires, joursDansMois, periodesTouchees, PAYE_PAR_DEFAUT, CONGES_PAR_MOIS_DEFAUT, TypeAbsence } from "./lib/absences";

const TYPE = v.union(v.literal("conge_paye"), v.literal("absence"), v.literal("maladie"), v.literal("autre"));

async function tauxConges(ctx: QueryCtx | MutationCtx) {
  const p = await ctx.db.query("parametresEntreprise").first();
  return p?.congesParMois ?? CONGES_PAR_MOIS_DEFAUT;
}

// Vue mensuelle : une ligne par employé actif (agrégats + solde + événements du mois + état de la saisie de paie).
export const vueMensuelle = query({
  args: { periode: v.string() },
  handler: async (ctx, { periode }) => {
    await requireLevel(ctx, 4);
    const congesParMois = await tauxConges(ctx);
    const cloture = await ctx.db.query("cloturesPaie").withIndex("by_periode", (q) => q.eq("periode", periode)).unique();
    const saisies = await ctx.db.query("saisiesMensuelles").withIndex("by_periode", (q) => q.eq("periode", periode)).collect();
    const saisieDe = new Map(saisies.map((s) => [String(s.employeId), s]));
    const employes = (await ctx.db.query("employes").collect()).filter((e) => e.actif);

    const lignes = [];
    for (const e of employes) {
      const evs = await ctx.db.query("absences").withIndex("by_employe", (q) => q.eq("employeId", e._id)).collect();
      const r = resumeMois({ employe: e, evenements: evs, periode, congesParMois });
      const s = saisieDe.get(String(e._id));
      lignes.push({
        employeId: e._id, nom: e.nom, societe: e.societe, fonction: e.fonction, dateDebut: e.dateDebut, ...r,
        evenements: evs.filter((ev) => joursDansMois(ev, periode) > 0).sort((a, b) => a.dateDebut.localeCompare(b.dateDebut)),
        paie: s ? { joursTravailles: s.joursTravailles, absencesJours: s.absencesJours } : null,
        // Sans saisie, la paie utilise les défauts (joursBase, 0 absence) : synchronisée si le planning y correspond.
        paieSynchronisee: s
          ? s.joursTravailles === r.joursTravailles && s.absencesJours === r.absencesNonPayees
          : r.joursTravailles === r.joursBase && r.absencesNonPayees === 0,
      });
    }
    return { periode, congesParMois, cloture: !!cloture, lignes };
  },
});

// Répercute le planning d'un employé sur sa saisie de paie pour les mois donnés (mois clôturés ignorés).
async function appliquerAuxSaisies(ctx: MutationCtx, employeId: Id<"employes">, periodes: string[]) {
  const e = await ctx.db.get(employeId);
  if (!e) return [];
  const congesParMois = await tauxConges(ctx);
  const evs = await ctx.db.query("absences").withIndex("by_employe", (q) => q.eq("employeId", employeId)).collect();
  const faites: string[] = [];
  for (const periode of periodes) {
    const clos = await ctx.db.query("cloturesPaie").withIndex("by_periode", (q) => q.eq("periode", periode)).unique();
    if (clos) continue;
    const r = resumeMois({ employe: e, evenements: evs, periode, congesParMois });
    const existant = await ctx.db.query("saisiesMensuelles")
      .withIndex("by_employe_periode", (q) => q.eq("employeId", employeId).eq("periode", periode)).unique();
    if (existant) await ctx.db.patch(existant._id, { joursTravailles: r.joursTravailles, absencesJours: r.absencesNonPayees });
    else await ctx.db.insert("saisiesMensuelles", {
      employeId, periode, joursTravailles: r.joursTravailles, absencesJours: r.absencesNonPayees,
      sanctions: 0, primesVariables: 0, transport: 0, heuresSup: 0, anciennete: 0, mutuellePct: 0, dettesSoins: 0, acompte: 0,
    });
    faites.push(periode);
  }
  return faites;
}

export const ajouterAbsence = mutation({
  args: {
    employeId: v.id("employes"), type: TYPE, dateDebut: v.string(), dateFin: v.string(),
    paye: v.optional(v.boolean()), motif: v.optional(v.string()),
  },
  handler: async (ctx, a) => {
    await requireLevel(ctx, 4);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(a.dateDebut) || !/^\d{4}-\d{2}-\d{2}$/.test(a.dateFin)) throw new Error("Dates au format AAAA-MM-JJ.");
    if (a.dateFin < a.dateDebut) throw new Error("La date de fin précède la date de début.");
    const jours = joursCalendaires(a.dateDebut, a.dateFin);
    const paye = a.paye ?? PAYE_PAR_DEFAUT[a.type as TypeAbsence];
    const id = await ctx.db.insert("absences", { employeId: a.employeId, type: a.type, dateDebut: a.dateDebut, dateFin: a.dateFin, jours, paye, motif: a.motif });
    const periodes = await appliquerAuxSaisies(ctx, a.employeId, periodesTouchees(a));
    return { id, jours, periodes };
  },
});

export const supprimerAbsence = mutation({
  args: { absenceId: v.id("absences") },
  handler: async (ctx, { absenceId }) => {
    await requireLevel(ctx, 4);
    const ev = await ctx.db.get(absenceId);
    if (!ev) return { periodes: [] as string[] };
    await ctx.db.delete(absenceId);
    const periodes = await appliquerAuxSaisies(ctx, ev.employeId, periodesTouchees(ev));
    return { periodes };
  },
});

// Recale la saisie de paie de tous les employés sur le planning pour un mois.
export const synchroniserPaie = mutation({
  args: { periode: v.string() },
  handler: async (ctx, { periode }) => {
    await requireLevel(ctx, 4);
    const employes = (await ctx.db.query("employes").collect()).filter((e) => e.actif);
    let n = 0;
    for (const e of employes) { n += (await appliquerAuxSaisies(ctx, e._id, [periode])).length; }
    return { employes: n, periode };
  },
});

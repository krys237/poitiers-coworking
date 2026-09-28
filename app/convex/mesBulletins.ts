import { query, internalQuery, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc } from "./_generated/dataModel";
import { requireDroit } from "./lib/authz";
import { bulletinsPourPeriode } from "./lib/calculBulletins";

// « Mes bulletins » (demande de M. GAMBOU, 28/09/2026) : un membre consulte et télécharge SES bulletins.
// Seuls les mois clôturés sont montrés : un bulletin provisoire peut encore changer.
// Le membre est relié à sa fiche employé par `users.employeId` (écran Membres) ; à défaut, par l'e-mail
// de la fiche employé identique à celui du compte.

async function employeDuMembre(ctx: QueryCtx, user: Doc<"users">): Promise<Doc<"employes"> | null> {
  if (user.employeId) return await ctx.db.get(user.employeId);
  const email = user.email.trim().toLowerCase();
  const tous = await ctx.db.query("employes").collect();
  return tous.find((e) => (e.email ?? "").trim().toLowerCase() === email) ?? null;
}

async function entrepriseDocument(ctx: QueryCtx) {
  const p = await ctx.db.query("parametresEntreprise").first();
  return {
    nom: p?.nom ?? "", adresse: p?.adresse, couleurEntete: p?.couleurEntete, filigrane: p?.filigrane,
    niu: p?.niu, numeroCnps: p?.numeroCnps, responsableRH: p?.responsableRH,
  };
}

// Le bulletin figé d'un mois clôturé, au format unifié (celui de l'écran, du courrier et du PDF).
async function monBulletin(ctx: QueryCtx, periode: string) {
  const me = await requireDroit(ctx, "/mes-bulletins");
  const emp = await employeDuMembre(ctx, me);
  if (!emp) throw new Error("Votre compte n'est relié à aucune fiche employé. Demandez à la Direction de faire le lien (écran Membres).");
  const fige = await ctx.db.query("bulletins").withIndex("by_employe_periode", (q) => q.eq("employeId", emp._id).eq("periode", periode)).unique();
  if (!fige) throw new Error("Aucun bulletin validé pour ce mois.");
  const r = await bulletinsPourPeriode(ctx, periode);
  const bulletin = r.bulletins.find((b) => String(b.employeId) === String(emp._id));
  if (!bulletin) throw new Error("Aucun bulletin validé pour ce mois.");
  return { bulletin, entreprise: await entrepriseDocument(ctx), nom: emp.nom };
}

/** Mes mois clôturés, du plus récent au plus ancien. */
export const liste = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireDroit(ctx, "/mes-bulletins");
    const emp = await employeDuMembre(ctx, me);
    if (!emp) return { employe: null, bulletins: [] };
    const figes = await ctx.db.query("bulletins").withIndex("by_employe_periode", (q) => q.eq("employeId", emp._id)).collect();
    return {
      employe: { nom: emp.nom, matricule: emp.matricule, societe: emp.societe },
      bulletins: figes
        .map((b) => ({ periode: b.periode, brut: b.brut, retenues: b.totalRetenues, net: b.net, genereLe: b.genereLe }))
        .sort((a, b) => b.periode.localeCompare(a.periode)),
    };
  },
});

/** Un de mes bulletins, pour l'afficher. */
export const detail = query({
  args: { periode: v.string() },
  handler: async (ctx, { periode }) => await monBulletin(ctx, periode),
});

/** Même chose pour l'action PDF (l'identité est propagée par ctx.runQuery). */
export const pourPdf = internalQuery({
  args: { periode: v.string() },
  handler: async (ctx, { periode }) => await monBulletin(ctx, periode),
});

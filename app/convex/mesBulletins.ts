import { query, internalQuery, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc } from "./_generated/dataModel";
import { requireDroit } from "./lib/authz";
import { bulletinsPourPeriode } from "./lib/calculBulletins";
import { rattachementsEffectifs, type Societe } from "./lib/societes";

// Société demandée quand le salarié relève de plusieurs employeurs (lot R2 bis).
const SOCIETE_OPT = v.optional(v.union(v.literal("SESAME"), v.literal("SOFINA"), v.literal("SGC")));

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
// Depuis le lot R2 bis, un pluri-employé a UN bulletin PAR SOCIÉTÉ pour le même mois : chacune ne
// porte que la part qu'elle verse (c'est normal, et non un oubli). Sans société demandée, on rend
// le premier — celui de la société porteuse de sa fiche.
async function monBulletin(ctx: QueryCtx, periode: string, societe?: Societe) {
  const me = await requireDroit(ctx, "/mes-bulletins");
  const emp = await employeDuMembre(ctx, me);
  if (!emp) throw new Error("Votre compte n'est relié à aucune fiche employé. Demandez à la Direction de faire le lien (écran Membres).");
  const figes = await ctx.db.query("bulletins").withIndex("by_employe_periode", (q) => q.eq("employeId", emp._id).eq("periode", periode)).collect();
  if (!figes.length) throw new Error("Aucun bulletin validé pour ce mois.");
  const r = await bulletinsPourPeriode(ctx, periode);
  const miens = r.bulletins.filter((b) => String(b.employeId) === String(emp._id));
  const bulletin = (societe ? miens.find((b) => b.societe === societe) : undefined) ?? miens[0];
  if (!bulletin) throw new Error("Aucun bulletin validé pour ce mois.");
  return { bulletin, entreprise: await entrepriseDocument(ctx), nom: emp.nom, societes: miens.map((b) => b.societe) };
}

/** Mes mois clôturés, du plus récent au plus ancien. */
export const liste = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireDroit(ctx, "/mes-bulletins");
    const emp = await employeDuMembre(ctx, me);
    if (!emp) return { employe: null, bulletins: [] };
    const figes = await ctx.db.query("bulletins").withIndex("by_employe_periode", (q) => q.eq("employeId", emp._id)).collect();
    const lignes = await ctx.db.query("rattachements").withIndex("by_employe", (q) => q.eq("employeId", emp._id)).collect();
    const societes = rattachementsEffectifs(emp, lignes).map((r) => r.societe);
    return {
      employe: { nom: emp.nom, matricule: emp.matricule, societe: emp.societe, societes },
      // Un bulletin par mois ET PAR SOCIÉTÉ : la clé de la liste est le couple, pas la période.
      bulletins: figes
        .map((b) => ({ cle: `${b.periode}:${b.societe}`, periode: b.periode, societe: b.societe, brut: b.brut, retenues: b.totalRetenues, net: b.net, genereLe: b.genereLe }))
        .sort((a, b) => b.periode.localeCompare(a.periode) || a.societe.localeCompare(b.societe)),
    };
  },
});

/** Un de mes bulletins, pour l'afficher. `societe` désigne l'employeur quand il y en a plusieurs. */
export const detail = query({
  args: { periode: v.string(), societe: SOCIETE_OPT },
  handler: async (ctx, { periode, societe }) => await monBulletin(ctx, periode, societe),
});

/** Même chose pour l'action PDF (l'identité est propagée par ctx.runQuery). */
export const pourPdf = internalQuery({
  args: { periode: v.string(), societe: SOCIETE_OPT },
  handler: async (ctx, { periode, societe }) => await monBulletin(ctx, periode, societe),
});

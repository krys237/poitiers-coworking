import { query, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { requireLevel } from "./lib/authz";
import { bulletinsPourPeriode } from "./lib/calculBulletins";
import { MODELE_DEFAUT, rendreLettre, htmlEmail, libellePeriode } from "./lib/courrier";

// L'envoi (avec PDF en pièce jointe) est une action Node : voir `paiePdf.envoyerCourrier`.

// Mode d'envoi : réel si RESEND_API_KEY est défini sur le déploiement, sinon simulation (journal seul).
export const mode = query({
  args: {},
  handler: async () => ({ reel: !!process.env.RESEND_API_KEY }),
});

// Aperçu du courrier du mois : une ligne par employé (lettre rendue + bulletin + dernier envoi).
export const apercu = query({
  args: { periode: v.string() },
  handler: async (ctx, { periode }) => {
    await requireLevel(ctx, 4);
    const entreprise = await ctx.db.query("parametresEntreprise").first();
    const modele = entreprise?.modeleCourrier ?? MODELE_DEFAUT;
    const r = await bulletinsPourPeriode(ctx, periode);
    const envois = await ctx.db.query("envois").withIndex("by_periode", (q) => q.eq("periode", periode)).collect();
    const dernier = new Map<string, typeof envois[number]>();
    for (const e of envois) {
      const prev = dernier.get(e.employeId);
      if (!prev || e.envoyeLe > prev.envoyeLe) dernier.set(e.employeId, e);
    }
    const lignes = r.bulletins.map((b) => ({
      bulletin: b,
      lettre: rendreLettre(modele, { nom: b.nom, periode, net: b.net, entreprise: entreprise?.nom ?? "" }),
      dernierEnvoi: dernier.get(b.employeId) ?? null,
    }));
    return { cloture: r.cloture, erreur: r.erreur, modele, entreprise, lignes };
  },
});

// Journal complet des envois d'une période.
export const journal = query({
  args: { periode: v.string() },
  handler: async (ctx, { periode }) => {
    await requireLevel(ctx, 4);
    return await ctx.db.query("envois").withIndex("by_periode", (q) => q.eq("periode", periode)).order("desc").collect();
  },
});

// Charges utiles prêtes à envoyer (appelé par l'action Node). L'auth est propagée depuis l'action.
export const payloads = internalQuery({
  args: { periode: v.string(), employeIds: v.optional(v.array(v.id("employes"))) },
  handler: async (ctx, { periode, employeIds }) => {
    await requireLevel(ctx, 4);
    const entreprise = await ctx.db.query("parametresEntreprise").first();
    const modele = entreprise?.modeleCourrier ?? MODELE_DEFAUT;
    const r = await bulletinsPourPeriode(ctx, periode);
    const filtre = employeIds ? new Set(employeIds.map(String)) : null;
    const ent = { nom: entreprise?.nom ?? "", adresse: entreprise?.adresse, couleurEntete: entreprise?.couleurEntete, filigrane: entreprise?.filigrane };
    return r.bulletins
      .filter((b) => !filtre || filtre.has(String(b.employeId)))
      .map((b) => {
        const lettre = rendreLettre(modele, { nom: b.nom, periode, net: b.net, entreprise: ent.nom });
        return {
          employeId: b.employeId, nom: b.nom, email: b.email ?? "",
          sujet: `Bulletin de paie — ${libellePeriode(periode)} — ${ent.nom}`,
          html: htmlEmail({ lettre, bulletin: b, periode, entreprise: ent }),
          from: entreprise?.emailExpediteur ?? "onboarding@resend.dev",
          lettre, bulletin: b, entreprise: ent,
        };
      });
  },
});

export const enregistrerEnvoi = internalMutation({
  args: {
    employeId: v.id("employes"), periode: v.string(), email: v.string(),
    statut: v.union(v.literal("envoye"), v.literal("simule"), v.literal("echec")),
    mode: v.union(v.literal("reel"), v.literal("simulation")),
    messageId: v.optional(v.string()), erreur: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const envoyeLe = new Date().toISOString();
    await ctx.db.insert("envois", { ...args, envoyeLe });
    if (args.statut === "envoye") {
      const b = await ctx.db.query("bulletins")
        .withIndex("by_employe_periode", (q) => q.eq("employeId", args.employeId).eq("periode", args.periode)).unique();
      if (b) await ctx.db.patch(b._id, { statut: "envoye", envoyeLe });
    }
  },
});

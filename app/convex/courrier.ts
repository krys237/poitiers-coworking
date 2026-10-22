import { query, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { requireDroit, requireUnDesDroits } from "./lib/authz";
import { lireReglages } from "./parametres";
import { bulletinsPourPeriode } from "./lib/calculBulletins";
import { MODELE_DEFAUT, rendreLettre, htmlEmail, libellePeriode } from "./lib/courrier";

// L'envoi (avec PDF en pièce jointe) est une action Node : voir `paiePdf.envoyerCourrier`.

// Mode d'envoi, par canal : réel si la clé est définie ET que l'interrupteur des paramètres est
// activé ; sinon simulation (journal seul). Les conditions sont renvoyées séparément pour que l'écran
// dise laquelle manque. E-mail : RESEND_API_KEY ; WhatsApp : ULTRAMSG_INSTANCE_ID + ULTRAMSG_TOKEN.
export const mode = query({
  args: {},
  handler: async (ctx) => {
    await requireUnDesDroits(ctx, ["/paie/courrier", "/parametres"]);
    const r = await lireReglages(ctx);
    const cle = !!process.env.RESEND_API_KEY;
    const cleWa = !!process.env.ULTRAMSG_INSTANCE_ID && !!process.env.ULTRAMSG_TOKEN;
    return {
      reel: cle && r.envoiReelActive, cleConfiguree: cle, envoiActive: r.envoiReelActive,
      whatsapp: { reel: cleWa && r.whatsappReelActive, cleConfiguree: cleWa, envoiActive: r.whatsappReelActive },
    };
  },
});

// Aperçu du courrier du mois : une ligne par employé (lettre rendue + bulletin + dernier envoi).
export const apercu = query({
  args: { periode: v.string() },
  handler: async (ctx, { periode }) => {
    await requireDroit(ctx, "/paie/courrier");
    const entreprise = await ctx.db.query("parametresEntreprise").first();
    const modele = entreprise?.modeleCourrier ?? MODELE_DEFAUT;
    const r = await bulletinsPourPeriode(ctx, periode);
    const envois = await ctx.db.query("envois").withIndex("by_periode", (q) => q.eq("periode", periode)).collect();
    // Un courrier par bulletin, donc PAR SOCIÉTÉ (lot R2 bis) : le dernier envoi se suit par
    // couple. Les envois antérieurs n'ont pas de société et restent indexés sur l'employé seul.
    const dernier = new Map<string, typeof envois[number]>();
    for (const e of envois) {
      const cle = e.societe ? `${e.employeId}:${e.societe}` : String(e.employeId);
      const prev = dernier.get(cle);
      if (!prev || e.envoyeLe > prev.envoyeLe) dernier.set(cle, e);
    }
    const lignes = r.bulletins.map((b) => ({
      bulletin: b,
      lettre: rendreLettre(modele, { nom: b.nom, periode, net: b.net, entreprise: entreprise?.nom ?? "" }),
      dernierEnvoi: dernier.get(b.cle) ?? dernier.get(String(b.employeId)) ?? null,
    }));
    return { cloture: r.cloture, erreur: r.erreur, modele, entreprise, lignes };
  },
});

// Journal complet des envois d'une période.
export const journal = query({
  args: { periode: v.string() },
  handler: async (ctx, { periode }) => {
    await requireDroit(ctx, "/paie/courrier");
    return await ctx.db.query("envois").withIndex("by_periode", (q) => q.eq("periode", periode)).order("desc").collect();
  },
});

// Charges utiles prêtes à envoyer (appelé par l'action Node). L'auth est propagée depuis l'action.
export const payloads = internalQuery({
  // `envoi` : l'appelant envoie le courrier (droit FAIRE) ; sinon simple aperçu PDF (droit VOIR).
  // `cles` désigne des COUPLES (employé, société) : un pluri-employé reçoit un courrier par
  // société, et la RH doit pouvoir n'en envoyer qu'un. `employeIds` reste accepté — il vise alors
  // toutes les sociétés du salarié.
  args: { periode: v.string(), employeIds: v.optional(v.array(v.id("employes"))), cles: v.optional(v.array(v.string())), envoi: v.optional(v.boolean()) },
  handler: async (ctx, { periode, employeIds, cles, envoi }) => {
    await (envoi ? requireDroit(ctx, "/paie/courrier", "faire") : requireUnDesDroits(ctx, ["/paie/bulletins", "/paie/courrier"]));
    const entreprise = await ctx.db.query("parametresEntreprise").first();
    const modele = entreprise?.modeleCourrier ?? MODELE_DEFAUT;
    const r = await bulletinsPourPeriode(ctx, periode);
    const filtre = employeIds ? new Set(employeIds.map(String)) : null;
    const filtreCles = cles ? new Set(cles) : null;
    const ent = { nom: entreprise?.nom ?? "", adresse: entreprise?.adresse, couleurEntete: entreprise?.couleurEntete, filigrane: entreprise?.filigrane };
    return r.bulletins
      .filter((b) => (!filtre || filtre.has(String(b.employeId))) && (!filtreCles || filtreCles.has(b.cle)))
      .map((b) => {
        const lettre = rendreLettre(modele, { nom: b.nom, periode, net: b.net, entreprise: ent.nom });
        return {
          employeId: b.employeId, societe: b.societe, cle: b.cle, nom: b.nom, email: b.email ?? "", whatsapp: b.whatsapp ?? "",
          // Un pluri-employé reçoit un courrier par société : sans la société dans l'objet, les
          // deux messages du mois sont indiscernables dans sa boîte.
          sujet: b.nbSocietes > 1
            ? `Bulletin de paie — ${libellePeriode(periode)} — ${b.societe}`
            : `Bulletin de paie — ${libellePeriode(periode)} — ${ent.nom}`,
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
    societe: v.optional(v.union(v.literal("SESAME"), v.literal("SOFINA"), v.literal("SGC"))),
    canal: v.optional(v.union(v.literal("email"), v.literal("whatsapp"))),
    statut: v.union(v.literal("envoye"), v.literal("simule"), v.literal("echec")),
    mode: v.union(v.literal("reel"), v.literal("simulation")),
    messageId: v.optional(v.string()), erreur: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const envoyeLe = new Date().toISOString();
    await ctx.db.insert("envois", { ...args, envoyeLe });
    if (args.statut === "envoye") {
      // Un pluri-employé a un bulletin PAR SOCIÉTÉ pour le même mois (lot R2 bis) : `unique()`
      // lèverait une erreur. Sans société précisée, on marque tous ses bulletins du mois — c'est
      // bien l'ensemble de son courrier du mois qui vient de partir.
      const tous = await ctx.db.query("bulletins")
        .withIndex("by_employe_periode", (q) => q.eq("employeId", args.employeId).eq("periode", args.periode)).collect();
      const vises = args.societe ? tous.filter((b) => b.societe === args.societe) : tous;
      for (const b of vises) await ctx.db.patch(b._id, { statut: "envoye", envoyeLe });
    }
  },
});

// Moteur de rappels automatiques (lot S5) :
//   1. Famille « calendrier » : comptes rendus, journée financière, clôture de paie.
//   2. Famille « délai dépassé » : relance palier 1 + escalade hiérarchique palier 2 (niveau ≥ 7).
//   3. Verrous & délais : verrou grand livre et délai de correction caisse.
//
// Toutes les fonctions sont des `internalMutation` appelables à la main pour la recette
// (`npx convex run rappels:comptesRendus '{}'`). Toute émission passe par `siPasDejaEmis`.

import { internalMutation, type MutationCtx } from "./_generated/server";
import { type Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { dateDouala, estJourOuvrable } from "./lib/fenetre";
import {
  bornerDossiers,
  cleRappel,
  destinatairesEscalade,
  evaluerPalierDossier,
  evaluerRappelCloturePaie,
  membresARappelerCr,
  passageRappelCr,
} from "./lib/rappels";
import { notifier } from "./notifications";
import { lireReglages } from "./parametres";
import { droitsEffectifs, type Role } from "./rbac";

/** Pose la clé dans `rappelsEmis` et renvoie `true` uniquement la première fois (idempotence). */
async function siPasDejaEmis(
  ctx: MutationCtx,
  cle: string,
  destinataireId?: Id<"users">,
): Promise<boolean> {
  const existant = await ctx.db
    .query("rappelsEmis")
    .withIndex("by_cle", (q) => q.eq("cle", cle))
    .first();
  if (existant) return false;
  await ctx.db.insert("rappelsEmis", {
    cle,
    destinataireId,
    emisLe: new Date().toISOString(),
  });
  return true;
}

/** 3.1 Compte rendu non déposé : à l'ouverture du créneau et 30 min avant fermeture (Douala). */
export const comptesRendus = internalMutation({
  args: { forcerPassage: v.optional(v.union(v.literal("ouverture"), v.literal("fermeture"))) },
  handler: async (ctx, a) => {
    const now = new Date();
    const reglages = await lireReglages(ctx);
    const fenetre = {
      ouverture: reglages.crHeureOuverture,
      fermeture: reglages.crHeureFermeture,
      samedi: reglages.crSamedi,
    };

    const passage = a.forcerPassage ?? passageRappelCr(now, fenetre);
    if (!passage) return { passage: null, rappeles: 0 };

    const jour = dateDouala(now);
    const heureFermeture = `${String(fenetre.fermeture).padStart(2, "0")}h00`;

    // Lectures uniques : jamais `vueSuperviseur` ni requête dans une boucle.
    const [duJour, utilisateurs] = await Promise.all([
      ctx.db.query("comptesRendus").withIndex("by_date", (q) => q.eq("date", jour)).collect(),
      ctx.db.query("users").collect(),
    ]);
    const dejaDeposes = new Set(duJour.map((c) => String(c.auteurId)));

    const cibles = membresARappelerCr(
      utilisateurs.map((u) => ({
        id: String(u._id),
        role: u.role as Role,
        actif: u.isActive,
        enAttente: Boolean(u.enAttente),
      })),
      dejaDeposes,
    );

    let rappeles = 0;
    for (const id of cibles) {
      const membreId = id as Id<"users">;
      const cle = cleRappel("cr", jour, passage, id);
      if (!(await siPasDejaEmis(ctx, cle, membreId))) continue;
      await notifier(ctx, {
        type: "rappel_compte_rendu",
        proprietaireId: membreId,
        dateJour: jour,
        objet: { table: "comptesRendus", id: `${jour}_${id}` },
        lien: "/comptes-rendus",
        rendu: { libelle: jour, extrait: heureFermeture },
      });
      rappeles++;
    }
    return { passage, jour, rappeles };
  },
});

/** 3.2 Journée financière non saisie — 18 h Douala (17 h UTC), lundi au samedi. */
export const journeeFinanciere = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = new Date();
    if (!estJourOuvrable(now, { ouverture: 0, fermeture: 24, samedi: true })) {
      return { emis: false, raison: "dimanche" };
    }
    const jour = dateDouala(now);
    const existante = await ctx.db
      .query("journeesFinancieres")
      .withIndex("by_date", (q) => q.eq("date", jour))
      .first();
    if (existante) return { emis: false, raison: "deja_saisie" };

    const cle = cleRappel("financier", jour, "unique");
    if (!(await siPasDejaEmis(ctx, cle))) return { emis: false, raison: "deja_emis" };

    await notifier(ctx, {
      type: "rappel_journee_financiere",
      dateJour: jour,
      objet: { table: "journeesFinancieres", id: jour },
      lien: "/financier",
      rendu: { libelle: jour },
    });
    return { emis: true, jour };
  },
});

/** 3.3 Mois de paie non clôturé — 3 derniers jours avant `jourPaiement` (déf. 5). */
export const cloturePaie = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = new Date();
    const params = await ctx.db.query("parametresEntreprise").first();
    const jourPaiement = params?.jourPaiement ?? 5;
    const evalPaie = evaluerRappelCloturePaie(now, jourPaiement);
    if (!evalPaie.aRappeler) return { emis: false, raison: "hors_fenetre" };

    const cloture = await ctx.db
      .query("cloturesPaie")
      .withIndex("by_periode", (q) => q.eq("periode", evalPaie.periodePrecedente))
      .first();
    if (cloture) return { emis: false, raison: "deja_cloturee" };

    const cle = cleRappel("paie", evalPaie.periodePrecedente, evalPaie.dateJour);
    if (!(await siPasDejaEmis(ctx, cle))) return { emis: false, raison: "deja_emis" };

    await notifier(ctx, {
      type: "rappel_cloture_paie",
      dateJour: evalPaie.dateJour,
      importanceSurcharge: evalPaie.urgent ? "urgent" : "a_traiter",
      objet: { table: "cloturesPaie", id: evalPaie.periodePrecedente },
      lien: "/paie/bulletins",
      rendu: {
        libelle: evalPaie.periodePrecedente,
        extrait: evalPaie.urgent
          ? `Dernier jour avant le paiement du ${jourPaiement}.`
          : `Paiement prévu le ${jourPaiement} du mois.`,
      },
    });
    return { emis: true, periode: evalPaie.periodePrecedente, urgent: evalPaie.urgent };
  },
});

/** 4. Dossiers qui dorment : relance palier 1 + escalade palier 2 (niveau ≥ 7). */
export const dossiersEnAttente = internalMutation({
  args: {},
  handler: async (ctx) => {
    const nowMs = Date.now();
    const jour = dateDouala(new Date(nowMs));
    const reglages = await lireReglages(ctx);

    // Lectures uniques des droits (jamais dans la boucle des dossiers).
    const parametres = await ctx.db.query("parametresEntreprise").first();
    const surcharges = parametres?.droitsRoles ?? [];
    const utilisateurs = await ctx.db.query("users").collect();
    const membres = utilisateurs.map((u) => ({
      id: String(u._id),
      role: u.role as Role,
      actif: u.isActive,
      enAttente: Boolean(u.enAttente),
      droits: droitsEffectifs(u.role as Role, surcharges, u.droitsPerso ?? []),
    }));

    const detenteurs = (module: string, action: "voir" | "faire") =>
      membres
        .filter((m) => m.actif && !m.enAttente && Boolean(m.droits[module]?.[action]))
        .map((m) => m.id as Id<"users">);

    let emis = 0;

    async function traiterDossier(d: {
      table: string;
      id: string;
      reference: string;
      module: string;
      lien: string;
      ageHeures: number;
      seuilPalier1H: number;
      aEscalade: boolean;
      ciblesPalier1: Id<"users">[];
    }) {
      const cleP1 = cleRappel("dort", `${d.table}-${d.id}`, "palier1");
      const traceP1 = await ctx.db
        .query("rappelsEmis")
        .withIndex("by_cle", (q) => q.eq("cle", cleP1))
        .first();

      const palier = evaluerPalierDossier({
        ageHeures: d.ageHeures,
        seuilPalier1H: d.seuilPalier1H,
        escaladeH: reglages.escaladeH,
        aEscalade: d.aEscalade,
        palier1EmisLeMs: traceP1 ? Date.parse(traceP1.emisLe) : null,
        maintenantMs: nowMs,
      });
      if (!palier) return;

      const cle = cleRappel("dort", `${d.table}-${d.id}`, `palier${palier}`);
      if (!(await siPasDejaEmis(ctx, cle))) return;

      const cibles =
        palier === 1
          ? d.ciblesPalier1
          : destinatairesEscalade(membres, d.module).map((id) => id as Id<"users">);
      if (!cibles.length) return;

      const dureeTxt = `${Math.floor(d.ageHeures)} h`;
      await notifier(ctx, {
        type: "rappel_dossier_en_attente",
        destinatairesExplicites: cibles,
        moduleSurcharge: d.module,
        importanceSurcharge: palier === 2 ? "urgent" : "a_traiter",
        dateJour: `${jour}-p${palier}`,
        objet: { table: d.table, id: d.id, reference: d.reference },
        lien: d.lien,
        rendu: { reference: d.reference, extrait: dureeTxt },
      });
      emis++;
    }

    // 1. Bons de commande en attente (> relanceCommandeH)
    const cmdAttente = bornerDossiers(
      await ctx.db.query("commandes").withIndex("by_statut", (q) => q.eq("statut", "en_attente")).take(50),
    );
    const valideursCmd = detenteurs("/commandes/validation", "faire");
    for (const c of cmdAttente) {
      await traiterDossier({
        table: "commandes",
        id: String(c._id),
        reference: c.reference,
        module: "/commandes",
        lien: `/commandes?ref=${c.reference}`,
        ageHeures: (nowMs - c._creationTime) / 3_600_000,
        seuilPalier1H: reglages.relanceCommandeH,
        aEscalade: true,
        ciblesPalier1: valideursCmd,
      });
    }

    // 2. Litiges non résolus (> relanceLitigeH)
    const cmdLitige = bornerDossiers(
      await ctx.db.query("commandes").withIndex("by_statut", (q) => q.eq("statut", "en_litige")).take(50),
    );
    const gestCmd = detenteurs("/commandes", "faire");
    for (const c of cmdLitige) {
      const debutMs = c.litige?.dateSignalement ? Date.parse(c.litige.dateSignalement) : c._creationTime;
      await traiterDossier({
        table: "commandes",
        id: String(c._id),
        reference: c.reference,
        module: "/commandes",
        lien: `/commandes?ref=${c.reference}`,
        ageHeures: (nowMs - debutMs) / 3_600_000,
        seuilPalier1H: reglages.relanceLitigeH,
        aEscalade: true,
        ciblesPalier1: gestCmd,
      });
    }

    // 3. Interventions ouvertes (> relanceInterventionH)
    const intOuvertes = bornerDossiers(
      await ctx.db.query("interventions").withIndex("by_statut", (q) => q.eq("statut", "ouverte")).take(50),
    );
    const arbitresInt = detenteurs("/interventions", "faire");
    for (const i of intOuvertes) {
      await traiterDossier({
        table: "interventions",
        id: String(i._id),
        reference: i.reference,
        module: "/interventions",
        lien: `/interventions?ref=${i.reference}`,
        ageHeures: (nowMs - i._creationTime) / 3_600_000,
        seuilPalier1H: reglages.relanceInterventionH,
        aEscalade: true,
        ciblesPalier1: arbitresInt,
      });
    }

    // 4. Interventions en cours priorité haute (> relanceInterventionHauteH)
    const intEnCours = bornerDossiers(
      await ctx.db.query("interventions").withIndex("by_statut", (q) => q.eq("statut", "en_cours")).take(50),
    );
    for (const i of intEnCours) {
      if (i.priorite !== "haute") continue;
      const debutMs = i.valideLe ? Date.parse(i.valideLe) : i._creationTime;
      await traiterDossier({
        table: "interventions",
        id: String(i._id),
        reference: i.reference,
        module: "/interventions",
        lien: `/interventions?ref=${i.reference}`,
        ageHeures: (nowMs - debutMs) / 3_600_000,
        seuilPalier1H: reglages.relanceInterventionHauteH,
        aEscalade: true,
        ciblesPalier1: arbitresInt,
      });
    }

    // 5. Comptes rendus en relecture (> relanceCrH, sans escalade)
    const crRecents = await ctx.db.query("comptesRendus").withIndex("by_date").order("desc").take(150);
    const crRelecture = bornerDossiers(crRecents.filter((c) => c.statut === "en_relecture"));
    const superviseursCr = detenteurs("/comptes-rendus", "faire");
    for (const cr of crRelecture) {
      const debutMs = Date.parse(cr.soumisA) || cr._creationTime;
      await traiterDossier({
        table: "comptesRendus",
        id: String(cr._id),
        reference: `CR ${cr.date}`,
        module: "/comptes-rendus",
        lien: "/comptes-rendus",
        ageHeures: (nowMs - debutMs) / 3_600_000,
        seuilPalier1H: reglages.relanceCrH,
        aEscalade: false,
        ciblesPalier1: superviseursCr,
      });
    }

    return { emis };
  },
});

/** 5.1 Rappel 3 min avant expiration du verrou du grand livre (planifié à `prendreVerrou`). */
export const verrouBientotExpire = internalMutation({
  args: { date: v.string(), membreId: v.id("users"), at: v.string() },
  handler: async (ctx, { date, membreId, at }) => {
    const verrou = await ctx.db
      .query("verrousFinanciers")
      .withIndex("by_date", (q) => q.eq("date", date))
      .unique();
    if (!verrou || String(verrou.parId) !== String(membreId) || verrou.at !== at) return;

    const cle = cleRappel("verrou", `financier-${date}`, at, String(membreId));
    if (!(await siPasDejaEmis(ctx, cle, membreId))) return;

    await notifier(ctx, {
      type: "rappel_verrou_financier",
      proprietaireId: membreId,
      objet: { table: "verrousFinanciers", id: String(verrou._id), reference: date },
      lien: "/financier",
      rendu: { libelle: date },
    });
  },
});

/** 5.2 Rappel 10 min avant expiration du délai de correction d'une ligne de caisse. */
export const delaiCaisseBientotExpire = internalMutation({
  args: { ligneId: v.id("statsCaisse"), membreId: v.id("users"), creationTime: v.number() },
  handler: async (ctx, { ligneId, membreId, creationTime }) => {
    const ligne = await ctx.db.get(ligneId);
    if (!ligne || ligne._creationTime !== creationTime) return;

    const cle = cleRappel("verrou", `caisse-${String(ligneId)}`, String(creationTime), String(membreId));
    if (!(await siPasDejaEmis(ctx, cle, membreId))) return;

    await notifier(ctx, {
      type: "rappel_delai_caisse",
      proprietaireId: membreId,
      objet: { table: "statsCaisse", id: String(ligneId) },
      lien: "/caisse",
      rendu: { libelle: `${ligne.dateDebut} → ${ligne.dateFin}` },
    });
  },
});

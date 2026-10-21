import { query, mutation, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { requireDroit } from "./lib/authz";
import { salaireDeBase } from "./lib/paie";
import { resumeMois, joursCalendaires, joursDansMois, periodesTouchees, moisDeService, PAYE_PAR_DEFAUT, CONGES_PAR_MOIS_DEFAUT, TypeAbsence } from "./lib/absences";
// Planning annuel (lot R1) : decompte en jours OUVRABLES et droit a conge.
import {
  compterOuvrables, controlerLigne, dateRetour, dernierJourConge, droitConge, indexFeries,
} from "./lib/congesOuvrables";
import {
  EVENEMENTS_FAMILIAUX, PLAFOND_EVENEMENTS_FAMILIAUX_AN, TYPES_ABSENCE,
  controlerAbsence, joursServiceEffectif, remunererAbsence,
} from "./lib/absencesLegales";
import {
  COULEUR_NEUTRE, LIBELLE_OBSERVATION, OBSERVATION_CONSOMME, detecterChevauchements,
  doublonsEmploye, graduationsMois, joursDeLAnnee, observationDeduite, segmentFrise,
  type CongePose, type Observation,
} from "./lib/planningAnnuel";

// Doit rester aligné sur `schema.ts` et sur le catalogue de `lib/absencesLegales.ts`.
const TYPE = v.union(
  v.literal("conge_paye"), v.literal("absence"), v.literal("maladie"), v.literal("autre"),
  v.literal("maternite"), v.literal("accident_travail"), v.literal("evenement_familial"),
  v.literal("chomage_technique"), v.literal("mise_a_pied"), v.literal("sans_solde"),
  v.literal("formation_syndicale"),
);

async function tauxConges(ctx: QueryCtx | MutationCtx) {
  const p = await ctx.db.query("parametresEntreprise").first();
  return p?.congesParMois ?? CONGES_PAR_MOIS_DEFAUT;
}

// Vue mensuelle : une ligne par employé actif (agrégats + solde + événements du mois + état de la saisie de paie).
export const vueMensuelle = query({
  args: { periode: v.string() },
  handler: async (ctx, { periode }) => {
    await requireDroit(ctx, "/paie/planning");
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
    await requireDroit(ctx, "/paie/planning", "faire");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(a.dateDebut) || !/^\d{4}-\d{2}-\d{2}$/.test(a.dateFin)) throw new Error("Dates au format AAAA-MM-JJ.");
    if (a.dateFin < a.dateDebut) throw new Error("La date de fin précède la date de début.");
    const jours = joursCalendaires(a.dateDebut, a.dateFin);
    const paye = a.paye ?? PAYE_PAR_DEFAUT[a.type as TypeAbsence];
    const id = await ctx.db.insert("absences", { employeId: a.employeId, type: a.type, dateDebut: a.dateDebut, dateFin: a.dateFin, jours, paye, motif: a.motif });
    const periodes = await appliquerAuxSaisies(ctx, a.employeId, periodesTouchees(a));
    return { id, jours, periodes };
  },
});

// Modification d'une absence : mêmes contrôles qu'à l'ajout ; la paie est recalée
// pour les mois touchés AVANT et APRÈS (une absence déplacée d'un mois à l'autre).
export const modifierAbsence = mutation({
  args: {
    absenceId: v.id("absences"), type: v.optional(TYPE), dateDebut: v.optional(v.string()), dateFin: v.optional(v.string()),
    paye: v.optional(v.boolean()), motif: v.optional(v.string()),
  },
  handler: async (ctx, { absenceId, ...patch }) => {
    await requireDroit(ctx, "/paie/planning", "faire");
    const ev = await ctx.db.get(absenceId);
    if (!ev) throw new Error("Absence introuvable.");
    const dateDebut = patch.dateDebut ?? ev.dateDebut, dateFin = patch.dateFin ?? ev.dateFin;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateDebut) || !/^\d{4}-\d{2}-\d{2}$/.test(dateFin)) throw new Error("Dates au format AAAA-MM-JJ.");
    if (dateFin < dateDebut) throw new Error("La date de fin précède la date de début.");
    const type = patch.type ?? ev.type;
    await ctx.db.patch(absenceId, {
      type, dateDebut, dateFin, jours: joursCalendaires(dateDebut, dateFin),
      paye: patch.paye ?? (patch.type ? PAYE_PAR_DEFAUT[type as TypeAbsence] : ev.paye),
      motif: patch.motif === undefined ? ev.motif : patch.motif || undefined,
    });
    const periodes = [...new Set([...periodesTouchees(ev), ...periodesTouchees({ dateDebut, dateFin })])];
    return { periodes: await appliquerAuxSaisies(ctx, ev.employeId, periodes) };
  },
});

export const supprimerAbsence = mutation({
  args: { absenceId: v.id("absences") },
  handler: async (ctx, { absenceId }) => {
    await requireDroit(ctx, "/paie/planning", "faire");
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
    await requireDroit(ctx, "/paie/planning", "faire");
    const employes = (await ctx.db.query("employes").collect()).filter((e) => e.actif);
    let n = 0;
    for (const e of employes) { n += (await appliquerAuxSaisies(ctx, e._id, [periode])).length; }
    return { employes: n, periode };
  },
});

// =====================================================================================
// Planning ANNUEL (lot R1) — la vue qui reprend le classeur de la RH.
//
// Ne touche ni à la vue mensuelle ni à `appliquerAuxSaisies` : la paie continue d'être
// alimentée en jours CALENDAIRES par `lib/absences.ts` jusqu'à la bascule du lot R4.
// Ici le décompte est en jours OUVRABLES (`lib/congesOuvrables`) — les deux cohabitent.
// =====================================================================================

export const vueAnnuelle = query({
  args: { annee: v.number(), seuilChevauchement: v.optional(v.number()) },
  handler: async (ctx, { annee, seuilChevauchement }) => {
    await requireDroit(ctx, "/paie/planning");
    const seuil = seuilChevauchement ?? 2;
    const congesParMois = await tauxConges(ctx);

    const feriesLignes = await ctx.db
      .query("joursFeries")
      .withIndex("by_annee", (q) => q.eq("annee", annee))
      .collect();
    const feries = indexFeries(feriesLignes.map((f) => ({ date: f.date, chome: f.chome })));

    const services = await ctx.db.query("services").collect();
    services.sort((a, b) => a.ordre - b.ordre);
    const serviceDe = new Map(services.map((s) => [String(s._id), s]));

    const employes = (await ctx.db.query("employes").collect()).filter((e) => e.actif);
    const nomEmploye = new Map(employes.map((e) => [String(e._id), e.nom]));
    const aujourdHui = new Date().toISOString().slice(0, 10);

    const lignes = [];
    const poses: CongePose[] = [];

    for (const e of employes) {
      const toutes = await ctx.db
        .query("absences")
        .withIndex("by_employe", (q) => q.eq("employeId", e._id))
        .collect();
      const conges = toutes.filter((a) => a.type === "conge_paye");
      const anneeDe = (a: { anneeReference?: number; dateDebut: string }) =>
        a.anneeReference ?? +a.dateDebut.slice(0, 4);

      // Congés de l'année, et rappel de l'année précédente : les deux colonnes de son classeur.
      const delAnnee = conges
        .filter((a) => anneeDe(a) === annee)
        .sort((x, y) => x.dateDebut.localeCompare(y.dateDebut));
      const rappel = conges
        .filter((a) => anneeDe(a) === annee - 1)
        .sort((x, y) => y.dateDebut.localeCompare(x.dateDebut))[0];

      const service = e.serviceId ? serviceDe.get(String(e.serviceId)) : undefined;
      const principal = delAnnee[0];

      // Droit à congé : calculé, puis surchargé si la RH l'a forcé (décision E5 du 20/10/2026).
      const droit = droitConge({
        moisDeService: moisDeService(e.dateDebut, `${annee}-12`),
        dateDepart: principal?.dateDebut ?? `${annee}-01-01`,
        dateEmbauche: e.dateDebut,
        sexe: e.sexe,
        enfants: e.enfants,
        regles: { joursParMois: congesParMois },
      });
      const suppCalcule = droit.majAnciennete + droit.majEnfants;
      const suppManuel = principal?.congeSuppManuel;
      const congeSupp = suppManuel ?? suppCalcule;
      const principalArrondi = Math.ceil(droit.principal);

      const evenements = delAnnee.map((a) => {
        const jOuvrables = a.joursOuvrables ?? compterOuvrables(a.dateDebut, a.dateFin, feries);
        return {
          id: String(a._id),
          dateDebut: a.dateDebut,
          dateFin: a.dateFin,
          joursOuvrables: jOuvrables,
          dateRetour: a.dateRetour ?? dateRetour(a.dateDebut, jOuvrables, feries),
          observation:
            (a.observation as Observation | undefined) ??
            observationDeduite({ depart: a.dateDebut, dernierJour: a.dateFin }, aujourdHui),
          commentaire: a.commentaire ?? null,
          remplacant: a.remplacantId
            ? nomEmploye.get(String(a.remplacantId)) ?? "—"
            : a.remplacantTexte ?? null,
          anomalies: controlerLigne(
            { depart: a.dateDebut, totalConge: jOuvrables, retourSaisi: a.dateRetour },
            feries,
          ),
          segment: segmentFrise(
            {
              id: String(a._id),
              employeId: String(e._id),
              employeNom: e.nom,
              serviceId: e.serviceId ? String(e.serviceId) : undefined,
              serviceNom: service?.nom,
              depart: a.dateDebut,
              dernierJour: a.dateFin,
            },
            annee,
            feries,
          ),
        };
      });

      for (const a of delAnnee)
        poses.push({
          id: String(a._id),
          employeId: String(e._id),
          employeNom: e.nom,
          serviceId: e.serviceId ? String(e.serviceId) : undefined,
          serviceNom: service?.nom,
          depart: a.dateDebut,
          dernierJour: a.dateFin,
        });

      const joursPris = evenements.reduce(
        (t, ev) => t + (OBSERVATION_CONSOMME[ev.observation] ? ev.joursOuvrables : 0),
        0,
      );
      const totalConge = principalArrondi + congeSupp;

      lignes.push({
        employeId: e._id,
        nom: e.nom,
        matricule: e.matricule,
        societe: e.societe,
        serviceId: e.serviceId ?? null,
        serviceNom: service?.nom ?? null,
        couleur: service?.couleur ?? COULEUR_NEUTRE,
        dateEmbauche: e.dateDebut ?? null,
        sexe: e.sexe ?? null,
        enfantsRetenus: droit.enfantsRetenus,
        anneesAnciennete: droit.anneesAnciennete,
        congePrincipal: principalArrondi,
        congeSupplementaire: congeSupp,
        congeSuppCalcule: suppCalcule,
        congeSuppForce: suppManuel !== undefined,
        congeSuppMotif: principal?.congeSuppMotif ?? null,
        totalConge,
        joursPris,
        soldeConge: totalConge - joursPris,
        droitOuvert: droit.droitOuvert,
        detailDroit: droit.detail,
        rappelAnneePrecedente: rappel ? { debut: rappel.dateDebut, fin: rappel.dateFin } : null,
        evenements,
      });
    }

    lignes.sort(
      (a, b) =>
        (a.serviceNom ?? "zzz").localeCompare(b.serviceNom ?? "zzz") || a.nom.localeCompare(b.nom),
    );

    return {
      annee,
      seuil,
      services,
      lignes,
      graduations: graduationsMois(annee),
      joursAnnee: joursDeLAnnee(annee),
      chevauchements: detecterChevauchements(poses, seuil),
      doublons: doublonsEmploye(poses).map(([x, y]) => ({
        employeNom: x.employeNom,
        premier: { debut: x.depart, fin: x.dernierJour },
        second: { debut: y.depart, fin: y.dernierJour },
      })),
      feriesChomes: feriesLignes.filter((f) => f.chome).length,
      // Sans calendrier de fériés, tout le décompte est faux : l'écran doit le dire fort.
      calendrierAbsent: feriesLignes.length === 0,
    };
  },
});

/**
 * Pose ou met à jour un congé annuel. La date de fin et la date de retour sont **calculées** :
 * la RH saisit la date de départ et le nombre de jours ouvrables, et ne retape plus jamais la
 * date de retour de tête. Recale la saisie de paie des mois touchés, mois clôturés exclus.
 */
export const enregistrerCongeAnnuel = mutation({
  args: {
    absenceId: v.optional(v.id("absences")),
    employeId: v.id("employes"),
    anneeReference: v.number(),
    dateDebut: v.string(),
    joursOuvrables: v.number(),
    observation: v.optional(v.string()),
    commentaire: v.optional(v.string()),
    remplacantId: v.optional(v.id("employes")),
    remplacantTexte: v.optional(v.string()),
    congeSuppManuel: v.optional(v.number()),
    congeSuppMotif: v.optional(v.string()),
  },
  handler: async (ctx, a) => {
    await requireDroit(ctx, "/paie/planning", "faire");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(a.dateDebut)) throw new Error("Date de départ au format AAAA-MM-JJ.");
    if (!Number.isInteger(a.joursOuvrables) || a.joursOuvrables <= 0 || a.joursOuvrables > 120)
      throw new Error("Le nombre de jours de congé doit être un entier compris entre 1 et 120.");
    if (a.congeSuppManuel !== undefined && !a.congeSuppMotif?.trim())
      throw new Error("Une surcharge du congé supplémentaire exige un motif (décision du 20/10/2026).");
    if (a.remplacantId && a.remplacantId === a.employeId)
      throw new Error("Un employé ne peut pas être son propre remplaçant.");
    if (a.observation && !(a.observation in LIBELLE_OBSERVATION))
      throw new Error(`Observation inconnue : ${a.observation}`);

    const feriesLignes = await ctx.db
      .query("joursFeries")
      .withIndex("by_annee", (q) => q.eq("annee", +a.dateDebut.slice(0, 4)))
      .collect();
    if (!feriesLignes.length)
      throw new Error(
        `Aucun jour férié enregistré pour ${a.dateDebut.slice(0, 4)} : initialisez le calendrier avant de poser un congé.`,
      );
    const feries = indexFeries(feriesLignes.map((f) => ({ date: f.date, chome: f.chome })));

    const dateFin = dernierJourConge(a.dateDebut, a.joursOuvrables, feries);
    const retour = dateRetour(a.dateDebut, a.joursOuvrables, feries);

    const commun = {
      employeId: a.employeId,
      type: "conge_paye" as const,
      dateDebut: a.dateDebut,
      dateFin,
      // `jours` reste le décompte CALENDAIRE : c'est encore lui qui alimente la paie (lot R4).
      jours: joursCalendaires(a.dateDebut, dateFin),
      paye: true,
      anneeReference: a.anneeReference,
      joursOuvrables: a.joursOuvrables,
      dateRetour: retour,
      observation: a.observation,
      commentaire: a.commentaire?.trim() || undefined,
      remplacantId: a.remplacantId,
      remplacantTexte: a.remplacantId ? undefined : a.remplacantTexte?.trim() || undefined,
      congeSuppManuel: a.congeSuppManuel,
      congeSuppMotif: a.congeSuppManuel !== undefined ? a.congeSuppMotif?.trim() : undefined,
    };

    let periodesAvant: string[] = [];
    if (a.absenceId) {
      const ev = await ctx.db.get(a.absenceId);
      if (!ev) throw new Error("Congé introuvable.");
      periodesAvant = periodesTouchees(ev);
      await ctx.db.patch(a.absenceId, commun);
    } else {
      await ctx.db.insert("absences", commun);
    }

    const periodes = [
      ...new Set([...periodesAvant, ...periodesTouchees({ dateDebut: a.dateDebut, dateFin })]),
    ];
    return { dateFin, dateRetour: retour, periodes: await appliquerAuxSaisies(ctx, a.employeId, periodes) };
  },
});

// =====================================================================================
// Absences légales (lot R5) — catalogue, contrôles et rémunération.
// Les contrôles AVERTISSENT sans bloquer : la RH est la professionnelle, et plusieurs plafonds
// légaux sont prorogeables ou imputables sur le congé annuel à la demande du salarié. L'outil
// signale, il ne décide pas. Même principe que la fenêtre des comptes rendus.
// =====================================================================================

/** Le catalogue légal, pour l'écran : libellés, textes fondateurs, qui paie, plafonds. */
export const catalogueAbsences = query({
  args: {},
  handler: async (ctx) => {
    await requireDroit(ctx, "/paie/planning");
    return {
      types: TYPES_ABSENCE,
      evenementsFamiliaux: EVENEMENTS_FAMILIAUX,
      plafondEvenementsFamiliaux: PLAFOND_EVENEMENTS_FAMILIAUX_AN,
    };
  },
});

/**
 * Contrôle légal d'une absence envisagée, avant saisie : plafonds et justificatif.
 * Le cumul annuel est calculé pour le même employé, le même type et la même année.
 */
export const controlerAvantSaisie = query({
  args: {
    employeId: v.id("employes"),
    type: TYPE,
    dateDebut: v.string(),
    jours: v.number(),
    justificatifFourni: v.optional(v.boolean()),
    absenceIdExclue: v.optional(v.id("absences")),
  },
  handler: async (ctx, a) => {
    await requireDroit(ctx, "/paie/planning");
    const annee = a.dateDebut.slice(0, 4);
    const toutes = await ctx.db
      .query("absences")
      .withIndex("by_employe", (q) => q.eq("employeId", a.employeId))
      .collect();
    const cumulAnneeJours = toutes
      .filter((x) => x.type === a.type && x.dateDebut.slice(0, 4) === annee && x._id !== a.absenceIdExclue)
      .reduce((t, x) => t + x.jours, 0);

    return {
      cumulAnneeJours,
      avertissements: controlerAbsence({
        cle: a.type,
        jours: a.jours,
        cumulAnneeJours,
        justificatifFourni: a.justificatifFourni,
      }),
    };
  },
});

/**
 * Service effectif d'un employé sur une année (art. 89 al. 3) : ce qui ouvre réellement
 * droit à congé. La maladie compte dans la limite de 6 mois, l'accident du travail sans
 * limite, l'absence injustifiée et le sans-solde pas du tout.
 */
export const serviceEffectif = query({
  args: { employeId: v.id("employes"), annee: v.number() },
  handler: async (ctx, { employeId, annee }) => {
    await requireDroit(ctx, "/paie/planning");
    const toutes = await ctx.db
      .query("absences")
      .withIndex("by_employe", (q) => q.eq("employeId", employeId))
      .collect();
    const delAnnee = toutes.filter((x) => +x.dateDebut.slice(0, 4) === annee);
    // Jours calendaires de l'année moins les absences : approximation volontaire, le détail
    // par jour ouvrable relève du lot R4 (liaison planning → paie).
    const joursAnnee = new Date(Date.UTC(annee, 11, 31)).getUTCDate() === 31 ? 365 : 365;
    const absents = delAnnee.reduce((t, x) => t + x.jours, 0);
    const r = joursServiceEffectif(
      delAnnee.map((x) => ({ cle: x.type, jours: x.jours })),
      Math.max(0, joursAnnee - absents),
    );
    return { annee, ...r, joursAbsence: absents };
  },
});

/**
 * Rémunération d'une absence : part employeur, part CNPS et retenue.
 * Le diviseur journalier n'est imposé par aucun texte (voir A-VERIFIER) : il vient des réglages.
 */
export const remuneration = query({
  args: { employeId: v.id("employes"), type: TYPE, jours: v.number(), rangMois: v.optional(v.number()) },
  handler: async (ctx, a) => {
    await requireDroit(ctx, "/paie/planning");
    const e = await ctx.db.get(a.employeId);
    if (!e) throw new Error("Employé introuvable.");
    return remunererAbsence(a.type, a.jours, salaireDeBase(e), {
      diviseurJournalier: e.joursBase ?? 30,
      rangMois: a.rangMois,
    });
  },
});

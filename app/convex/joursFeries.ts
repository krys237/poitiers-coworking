// Jours fériés : table administrable par année (lot R0 de la session RH).
//
// Pourquoi une table et pas une constante : les fêtes musulmanes dépendent de l'observation
// lunaire et les dates pascales se déplacent ; les deux sont arrêtées chaque année par acte
// administratif. Et surtout, la calibration sur le planning réel de la responsable RH a montré
// que l'ensemble des fériés effectivement décomptés est une PRATIQUE D'ENTREPRISE (48/56 lignes
// reproduites avec les seuls fériés fixes, 39/56 avec tous) — donc une donnée, pas une règle.
// Voir `docs/rh/CALIBRATION-PLANNING.md`.
//
// Droits : lecture et écriture sur `/paie/planning` (niveau 4 = RH). La RH est la seule à
// connaître les dates retenues dans l'établissement et doit pouvoir les tenir à jour chaque
// janvier sans dépendre de la Direction. Toute modification est journalisée.

import { query, mutation, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { requireDroit } from "./lib/authz";
import { journaliser } from "./lib/journal";
import { feriesParDefaut, FERIES_A_SAISIR } from "./lib/joursFeriesCameroun";
import { compterOuvrables, indexFeries, type JourFerie } from "./lib/congesOuvrables";
import { congesAReprendre, libelleRecalcul, recalculerRetours, resumerRecalcul } from "./lib/recalculFeries";
import type { Id } from "./_generated/dataModel";

const ORIGINE = v.union(v.literal("fixe"), v.literal("pascal"), v.literal("saisi"), v.literal("decrete"));

/** Les fériés d'une année, triés par date. */
export const liste = query({
  args: { annee: v.number() },
  handler: async (ctx, { annee }) => {
    await requireDroit(ctx, "/paie/planning");
    const lignes = await ctx.db
      .query("joursFeries")
      .withIndex("by_annee", (q) => q.eq("annee", annee))
      .collect();
    lignes.sort((a, b) => a.date.localeCompare(b.date));
    return {
      annee,
      lignes,
      chomes: lignes.filter((l) => l.chome).length,
      aSaisir: FERIES_A_SAISIR.filter(
        (nom) => !lignes.some((l) => l.libelle.toLowerCase().startsWith(nom.slice(0, 5).toLowerCase())),
      ),
    };
  },
});

/**
 * Fériés chômés sur une plage d'années, sous la forme attendue par `lib/congesOuvrables`.
 * C'est le point d'entrée des calculs de congé.
 */
export const pourCalcul = query({
  args: { anneeDebut: v.number(), anneeFin: v.number() },
  handler: async (ctx, { anneeDebut, anneeFin }): Promise<JourFerie[]> => {
    await requireDroit(ctx, "/paie/planning");
    const out: JourFerie[] = [];
    for (let a = anneeDebut; a <= anneeFin; a++) {
      const lignes = await ctx.db
        .query("joursFeries")
        .withIndex("by_annee", (q) => q.eq("annee", a))
        .collect();
      for (const l of lignes) out.push({ date: l.date, libelle: l.libelle, chome: l.chome });
    }
    return out;
  },
});

/**
 * Pré-remplit une année : les 6 fériés fixes (chômés) et les 2 fériés pascaux (NON chômés par
 * défaut, conformément à la pratique observée — à confirmer avec la RH). Idempotent : une date
 * déjà présente n'est jamais écrasée, pour ne pas effacer un réglage manuel.
 */
export const initialiserAnnee = mutation({
  args: { annee: v.number() },
  handler: async (ctx, { annee }) => {
    const user = await requireDroit(ctx, "/paie/planning", "faire");
    const existantes = await ctx.db
      .query("joursFeries")
      .withIndex("by_annee", (q) => q.eq("annee", annee))
      .collect();
    const deja = new Set(existantes.map((l) => l.date));

    let ajoutes = 0;
    for (const f of feriesParDefaut(annee)) {
      if (deja.has(f.date)) continue;
      await ctx.db.insert("joursFeries", {
        date: f.date,
        libelle: f.libelle ?? "Férié",
        chome: f.chome !== false,
        annee,
        origine: f.libelle === "Vendredi Saint" || f.libelle === "Ascension" ? "pascal" : "fixe",
      });
      ajoutes++;
    }
    await journaliser(ctx, {
      auteurId: user._id,
      auteurNom: user.name,
      action: "feries_modification",
      cible: String(annee),
      detail: `Initialisation : ${ajoutes} férié(s) ajouté(s), ${existantes.length} conservé(s). Restent à saisir : ${FERIES_A_SAISIR.join(", ")}`,
    });
    return { ajoutes, conserves: existantes.length, aSaisir: [...FERIES_A_SAISIR] };
  },
});

/** Ajoute ou met à jour un férié (une seule ligne par date). */
/**
 * Décrète un jour férié en cours d'année, et DÉCALE les congés déjà posés (demande N1).
 *
 * « Les jours fériés décrétés au cours de l'année pour une raison ou une autre augmentent ou
 *   décalent la date initialement prévue. » Puis, le 05/11/2026 : « un congé déjà posé se décale
 *   automatiquement ».
 *
 * Ce que la mutation garantit :
 *
 *  • le **motif est obligatoire** — un jour qui décale les congés de tout le monde doit dire d'où
 *    il vient ;
 *  • seuls les congés qui **enjambent** la date sont relus. Un congé qui commence après le férié
 *    ne le rencontre jamais : le recalculer serait du bruit ;
 *  • un mois **clôturé** n'est jamais réécrit. Le décalage est calculé et RENDU À L'APPELANT, qui
 *    doit en décider — une paie arrêtée ne se rejoue pas tout seule ;
 *  • le détail de chaque décalage est journalisé et rendu. Un retour de congé qui bouge sans trace
 *    serait pire que pas de recalcul du tout.
 */
export const decreter = mutation({
  args: {
    date: v.string(),
    libelle: v.string(),
    motif: v.string(),
    /** Faux = jour férié travaillé dans l'entreprise, donc décompté comme un jour ouvrable. */
    chome: v.optional(v.boolean()),
  },
  handler: async (ctx, { date, libelle, motif, chome }) => {
    const user = await requireDroit(ctx, "/paie/planning", "faire");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Date attendue au format AAAA-MM-JJ.");
    if (!libelle.trim()) throw new Error("Libellé du jour férié requis.");
    if (!motif.trim()) throw new Error("Motif requis : ce jour décale les congés déjà posés.");
    const annee = +date.slice(0, 4);
    const chomeEffectif = chome ?? true;

    const existant = await ctx.db.query("joursFeries").withIndex("by_date", (q) => q.eq("date", date)).unique();
    if (existant) {
      await ctx.db.patch(existant._id, {
        libelle: libelle.trim(), chome: chomeEffectif, origine: "decrete", motif: motif.trim(),
      });
    } else {
      await ctx.db.insert("joursFeries", {
        date, libelle: libelle.trim(), chome: chomeEffectif, annee,
        origine: "decrete", motif: motif.trim(),
      });
    }

    const rapport = await appliquerDecalages(ctx, date, annee);
    await journaliser(ctx, {
      auteurId: user._id, auteurNom: user.name, action: "feries_modification", cible: date,
      detail: `Décrété : ${libelle.trim()} — ${motif.trim()}. ${libelleRecalcul(resumerRecalcul(rapport.decalages))}`,
    });
    return rapport;
  },
});

/**
 * Relit les congés qui enjambent une date et applique les décalages.
 *
 * Extrait de `decreter` parce que la SUPPRESSION d'un férié doit faire exactement la même chose,
 * en sens inverse : retirer un jour décrété raccourcit les congés qu'il avait prolongés.
 */
async function appliquerDecalages(ctx: MutationCtx, date: string, annee: number) {
  const feriesLignes = await ctx.db
    .query("joursFeries")
    .withIndex("by_annee", (q) => q.eq("annee", annee))
    .collect();
  const feries = indexFeries(feriesLignes.map((f) => ({ date: f.date, chome: f.chome })));

  // Seuls les congés qui ENJAMBENT la date, et seulement ceux de l'année : on ne relit pas
  // 78 plannings pour deux lignes utiles.
  const absences = await ctx.db.query("absences").collect();
  const candidats = congesAReprendre(
    absences.filter((a) => a.dateDebut.slice(0, 4) === String(annee) || a.dateFin.slice(0, 4) === String(annee)),
    date,
  );

  const nomDe = new Map<string, string>();
  const closDe = new Map<string, boolean>();
  const aRecalculer = [];
  for (const a of candidats) {
    const idEmp = String(a.employeId);
    if (!nomDe.has(idEmp)) {
      const e = await ctx.db.get(a.employeId);
      nomDe.set(idEmp, e?.nom ?? "—");
    }
    // Le mois du DÉPART fait foi pour la clôture : c'est lui qui porte l'allocation et les jours.
    const periode = a.dateDebut.slice(0, 7);
    if (!closDe.has(periode)) {
      const c = await ctx.db.query("cloturesPaie").withIndex("by_periode", (q) => q.eq("periode", periode)).unique();
      closDe.set(periode, !!c);
    }
    aRecalculer.push({
      id: String(a._id), employeNom: nomDe.get(idEmp), type: a.type,
      dateDebut: a.dateDebut, dateFin: a.dateFin, jours: a.jours,
      joursOuvrables: a.joursOuvrables, dateRetour: a.dateRetour,
      moisClos: closDe.get(periode),
    });
  }

  const decalages = recalculerRetours(aRecalculer, feries);
  for (const d of decalages) {
    if (d.bloque) continue; // mois clos : signalé, jamais réécrit
    await ctx.db.patch(d.id as Id<"absences">, {
      dateFin: d.finApres,
      dateRetour: d.retourApres,
      jours: d.joursCalendairesApres,
    });
  }
  return { decalages, resume: resumerRecalcul(decalages), libelle: libelleRecalcul(resumerRecalcul(decalages)) };
}

export const enregistrer = mutation({
  args: {
    date: v.string(),
    libelle: v.string(),
    chome: v.boolean(),
    origine: v.optional(ORIGINE),
  },
  handler: async (ctx, { date, libelle, chome, origine }) => {
    const user = await requireDroit(ctx, "/paie/planning", "faire");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Date attendue au format AAAA-MM-JJ.");
    const annee = +date.slice(0, 4);
    const existant = await ctx.db
      .query("joursFeries")
      .withIndex("by_date", (q) => q.eq("date", date))
      .unique();

    if (existant) {
      await ctx.db.patch(existant._id, { libelle, chome, origine: origine ?? existant.origine });
    } else {
      await ctx.db.insert("joursFeries", { date, libelle, chome, annee, origine: origine ?? "saisi" });
    }
    await journaliser(ctx, {
      auteurId: user._id,
      auteurNom: user.name,
      action: "feries_modification",
      cible: date,
      detail: `${existant ? "Modifié" : "Ajouté"} : ${libelle}, ${chome ? "chômé" : "travaillé"}`,
    });
    return { date, cree: !existant };
  },
});

export const supprimer = mutation({
  args: { id: v.id("joursFeries") },
  handler: async (ctx, { id }) => {
    const user = await requireDroit(ctx, "/paie/planning", "faire");
    const f = await ctx.db.get(id);
    if (!f) throw new Error("Jour férié introuvable.");
    await ctx.db.delete(id);

    // Retirer un férié RACCOURCIT les congés qu'il avait prolongés : le décalage joue dans les
    // deux sens, et il doit être appliqué ici aussi — sans quoi un férié supprimé par erreur
    // laisserait des retours de congé définitivement faux.
    const rapport = await appliquerDecalages(ctx, f.date, f.annee);

    await journaliser(ctx, {
      auteurId: user._id,
      auteurNom: user.name,
      action: "feries_modification",
      cible: f.date,
      detail: `Supprimé : ${f.libelle}. ${rapport.libelle}`,
    });
    return rapport;
  },
});

/**
 * Combien de jours ouvrables dans une période donnée, selon les fériés enregistrés.
 * Petit utilitaire de contrôle pour l'écran, et brique du lot R4 (jours travaillés du mois).
 */
export const joursOuvrablesDuMois = query({
  args: { periode: v.string() }, // "YYYY-MM"
  handler: async (ctx, { periode }) => {
    await requireDroit(ctx, "/paie/planning");
    const annee = +periode.slice(0, 4);
    const lignes = await ctx.db
      .query("joursFeries")
      .withIndex("by_annee", (q) => q.eq("annee", annee))
      .collect();
    const feries = indexFeries(lignes.map((l) => ({ date: l.date, chome: l.chome })));
    const debut = `${periode}-01`;
    const dernier = new Date(Date.UTC(annee, +periode.slice(5, 7), 0)).toISOString().slice(0, 10);
    return {
      periode,
      joursOuvrables: compterOuvrables(debut, dernier, feries),
      feriesDuMois: lignes.filter((l) => l.date.startsWith(periode)),
    };
  },
});

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

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireDroit } from "./lib/authz";
import { journaliser } from "./lib/journal";
import { feriesParDefaut, FERIES_A_SAISIR } from "./lib/joursFeriesCameroun";
import { compterOuvrables, indexFeries, type JourFerie } from "./lib/congesOuvrables";

const ORIGINE = v.union(v.literal("fixe"), v.literal("pascal"), v.literal("saisi"));

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
    await journaliser(ctx, {
      auteurId: user._id,
      auteurNom: user.name,
      action: "feries_modification",
      cible: f.date,
      detail: `Supprimé : ${f.libelle}`,
    });
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

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireDroit, requireUnDesDroits } from "./lib/authz";
import { lireReglages } from "./parametres";
import { normaliserTelephone, erreurTelephone, avecIndicatif } from "./lib/telephone";
import { erreurRattachement, rattachementsEffectifs } from "./lib/societes";

const SOCIETE = v.union(v.literal("SESAME"), v.literal("SOFINA"), v.literal("SGC"));

// Numéro WhatsApp : même règle que tout téléphone de l'application (indicatif obligatoire, lib/telephone).
// Sans indicatif (import d'un fichier, par exemple), on complète avec +237 (lib/telephone.avecIndicatif).
function numeroWhatsapp(brut: string | undefined): string | undefined {
  if (!brut || !brut.trim()) return undefined;
  const complet = avecIndicatif(brut);
  const err = erreurTelephone(complet);
  if (err) throw new Error(`WhatsApp : ${err}`);
  return normaliserTelephone(complet)!;
}

export const liste = query({
  args: { societe: v.optional(SOCIETE) },
  handler: async (ctx, { societe }) => {
    await requireUnDesDroits(ctx, ["/employes", "/paie/saisie", "/paie/planning", "/paie/primes", "/paie/bulletins"]);
    if (societe) {
      return await ctx.db.query("employes").withIndex("by_societe", (q) => q.eq("societe", societe)).collect();
    }
    return await ctx.db.query("employes").collect();
  },
});

export const creer = mutation({
  args: {
    matricule: v.string(), nom: v.string(), fonction: v.optional(v.string()),
    adresse: v.optional(v.string()), cnps: v.optional(v.string()), niu: v.optional(v.string()),
    email: v.optional(v.string()), whatsapp: v.optional(v.string()), societe: SOCIETE, salaireBase: v.number(), contrat: v.optional(v.string()),
    dateDebut: v.optional(v.string()), dateFin: v.optional(v.string()), congesInitial: v.optional(v.number()),
    categorie: v.optional(v.string()), echelon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireDroit(ctx, "/employes", "faire");
    // Le matricule identifie la fiche (import, bulletins, « Mes bulletins ») : jamais deux fois le même (retour terrain du 13/10/2026).
    const matricule = args.matricule.trim().toUpperCase();
    if (!matricule) throw new Error("Matricule requis.");
    const doublon = await ctx.db.query("employes").withIndex("by_matricule", (q) => q.eq("matricule", matricule)).first();
    if (doublon) throw new Error(`Le matricule ${matricule} existe déjà : ${doublon.nom}${doublon.actif ? "" : " (fiche désactivée)"}.`);
    return await ctx.db.insert("employes", { ...args, matricule, whatsapp: numeroWhatsapp(args.whatsapp), joursBase: (await lireReglages(ctx)).joursBaseDefaut, actif: true });
  },
});

// Mise à jour partielle d'une fiche (e-mail, fonction, société, dates, solde de congés initial…).
export const modifier = mutation({
  args: {
    employeId: v.id("employes"),
    email: v.optional(v.string()), fonction: v.optional(v.string()), adresse: v.optional(v.string()),
    // "" efface le numéro WhatsApp ; absent = inchangé.
    whatsapp: v.optional(v.string()),
    cnps: v.optional(v.string()), niu: v.optional(v.string()), societe: v.optional(SOCIETE),
    salaireBase: v.optional(v.number()), actif: v.optional(v.boolean()),
    dateDebut: v.optional(v.string()), dateFin: v.optional(v.string()), congesInitial: v.optional(v.number()),
    categorie: v.optional(v.string()), echelon: v.optional(v.string()),
  },
  handler: async (ctx, { employeId, ...patch }) => {
    await requireDroit(ctx, "/employes", "faire");
    const { whatsapp, ...reste } = patch;
    const propre: Record<string, unknown> = Object.fromEntries(Object.entries(reste).filter(([, val]) => val !== undefined));
    if (whatsapp !== undefined) propre.whatsapp = numeroWhatsapp(whatsapp);
    await ctx.db.patch(employeId, propre);

    // La fiche et son rattachement PRINCIPAL désignent le même employeur : changer la société sur
    // la fiche sans déplacer le rattachement laisserait deux vérités, et les saisies antérieures
    // (sans société) basculeraient silencieusement d'un déclarant à l'autre.
    const lignes = await ctx.db.query("rattachements").withIndex("by_employe", (q) => q.eq("employeId", employeId)).collect();
    const principal = lignes.find((l) => l.principal);
    if (principal) {
      if (patch.societe !== undefined && patch.societe !== principal.societe) {
        if (lignes.some((l) => l.societe === patch.societe && l._id !== principal._id)) {
          throw new Error(`${patch.societe} est déjà rattachée à cet employé : retirez d'abord ce rattachement.`);
        }
        await ctx.db.patch(principal._id, { societe: patch.societe });
      }
      // Le salaire de base de la fiche est celui de la société porteuse : les deux restent alignés.
      if (patch.salaireBase !== undefined) await ctx.db.patch(principal._id, { salaireBase: patch.salaireBase });
      for (const [cleFiche, cleRat] of [["cnps", "cnpsEmployeur"], ["niu", "niuEmployeur"], ["categorie", "categorie"], ["echelon", "echelon"], ["dateDebut", "dateDebut"]] as const) {
        const val = (patch as Record<string, unknown>)[cleFiche];
        if (val !== undefined) await ctx.db.patch(principal._id, { [cleRat]: val || undefined });
      }
    }
  },
});

// Import Excel/CSV : upsert par matricule (sinon par nom). Recalcul réactif automatique ensuite.
export const importer = mutation({
  args: {
    lignes: v.array(v.object({
      matricule: v.string(), nom: v.string(), fonction: v.optional(v.string()),
      adresse: v.optional(v.string()), cnps: v.optional(v.string()), niu: v.optional(v.string()),
      email: v.optional(v.string()), whatsapp: v.optional(v.string()), societe: SOCIETE, salaireBase: v.number(),
      dateDebut: v.optional(v.string()),
    })),
  },
  handler: async (ctx, { lignes }) => {
    await requireDroit(ctx, "/employes", "faire");
    const joursBase = (await lireReglages(ctx)).joursBaseDefaut;
    let crees = 0, majs = 0;
    for (const brute of lignes) {
      // Une colonne vide ne doit RIEN effacer : dans un patch Convex, un champ `undefined` supprime la
      // valeur existante (e-mail, CNPS, NIU… perdus à la réimportation d'un fichier partiel).
      const l = Object.fromEntries(Object.entries({ ...brute, whatsapp: numeroWhatsapp(brute.whatsapp) }).filter(([, v]) => v !== undefined && v !== "")) as typeof brute;
      const existant = await ctx.db
        .query("employes")
        .withIndex("by_matricule", (q) => q.eq("matricule", l.matricule))
        .unique();
      if (existant) { await ctx.db.patch(existant._id, l); majs++; }
      else { await ctx.db.insert("employes", { ...l, joursBase, actif: true }); crees++; }
    }
    return { crees, majs };
  },
});

/**
 * Migration du 21/10/2026 : `salaireBrut` → `salaireBase`.
 *
 * Le champ n'a jamais désigné un brut — toutes les primes s'ajoutent par-dessus — et son nom
 * invitait à saisir le brut complet, ce qui aurait compté chaque prime deux fois. L'erreur
 * aurait été silencieuse : les deux valeurs sont plausibles, aucun contrôle ne peut les distinguer.
 *
 * Séquence de déploiement en trois temps, pour qu'aucun push n'échoue :
 *   1. le schéma déclare les DEUX champs en optionnel (état actuel) → le push passe ;
 *   2. on lance cette mutation → `salaireBase` est renseigné partout ;
 *   3. on retire `salaireBrut` du schéma et ce bloc devient inutile.
 *
 * Idempotente : une fiche déjà migrée n'est pas touchée.
 */
export const migrerSalaireBase = mutation({
  args: {},
  handler: async (ctx) => {
    await requireDroit(ctx, "/employes", "faire");
    const employes = await ctx.db.query("employes").collect();
    let migres = 0;
    let dejaFaits = 0;
    let sansMontant = 0;

    for (const e of employes) {
      if (e.salaireBase !== undefined) { dejaFaits++; continue; }
      if (e.salaireBrut === undefined) { sansMontant++; continue; }
      await ctx.db.patch(e._id, { salaireBase: e.salaireBrut });
      migres++;
    }
    return { total: employes.length, migres, dejaFaits, sansMontant };
  },
});

// ---------------------------------------------------------------------------
// Rattachements multi-société (lot R2 bis)
//
// « SESAME déclare de son côté » (20/10/2026) : SESAME, SOFINA et SGC sont trois employeurs
// juridiquement distincts. Un employé peut relever de deux ou trois d'entre elles — pluri-emploi
// régulier — chacune ne versant, ne déclarant et ne cotisant que sur SA part.
//
// La lecture passe TOUJOURS par `lib/societes.rattachementsEffectifs`, qui fonctionne dans les
// deux états de la base : sans aucune ligne, c'est `employes.societe` qui fait foi, exactement
// comme avant. Rien n'est donc à migrer pour que l'application continue de fonctionner.
// ---------------------------------------------------------------------------

/**
 * Les rattachements de tout l'effectif, indexés par employé, sous leur forme RÉSOLUE (la fiche
 * servant de repli champ par champ). L'écran Employés n'a ainsi qu'une requête à faire, et il
 * affiche la même vérité que la paie.
 */
export const rattachements = query({
  args: { employeId: v.optional(v.id("employes")) },
  handler: async (ctx, { employeId }) => {
    await requireUnDesDroits(ctx, ["/employes", "/paie/saisie", "/paie/bulletins", "/paie/dipe"]);
    const employes = employeId
      ? [await ctx.db.get(employeId)].filter((e): e is NonNullable<typeof e> => !!e)
      : await ctx.db.query("employes").collect();

    const parEmploye: Record<string, ReturnType<typeof rattachementsEffectifs>> = {};
    for (const e of employes) {
      const lignes = await ctx.db.query("rattachements").withIndex("by_employe", (q) => q.eq("employeId", e._id)).collect();
      parEmploye[String(e._id)] = rattachementsEffectifs(e, lignes);
    }
    return parEmploye;
  },
});

const CHAMPS_RATTACHEMENT = {
  matriculeEmployeur: v.optional(v.string()),
  cnpsEmployeur: v.optional(v.string()),
  niuEmployeur: v.optional(v.string()),
  salaireBase: v.optional(v.number()),
  joursBase: v.optional(v.number()),
  categorie: v.optional(v.string()),
  echelon: v.optional(v.string()),
  contrat: v.optional(v.string()),
  dateDebut: v.optional(v.string()),
  dateFin: v.optional(v.string()),
};

// Une chaîne vide EFFACE le champ ; `undefined` le laisse inchangé. Sans cette distinction, un
// formulaire qui ne charge pas un champ l'effacerait au premier enregistrement.
const nettoyer = (patch: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(patch)
      .filter(([, val]) => val !== undefined)
      .map(([cle, val]) => [cle, typeof val === "string" && val.trim() === "" ? undefined : val]),
  );

/**
 * Rattache un employé à une société de plus. La première société rattachée reprend celle de la
 * fiche et devient le rattachement PRINCIPAL : c'est elle qui porte les saisies et les primes
 * enregistrées avant ce lot, lesquelles n'ont pas de société.
 */
export const ajouterRattachement = mutation({
  args: {
    employeId: v.id("employes"),
    societe: SOCIETE,
    ...CHAMPS_RATTACHEMENT,
  },
  handler: async (ctx, { employeId, societe, ...champs }) => {
    await requireDroit(ctx, "/employes", "faire");
    const employe = await ctx.db.get(employeId);
    if (!employe) throw new Error("Fiche employé introuvable.");

    const lignes = await ctx.db.query("rattachements").withIndex("by_employe", (q) => q.eq("employeId", employeId)).collect();
    const erreur = erreurRattachement(
      { societe, ...champs },
      lignes.map((l) => ({ societe: l.societe, rattachementId: String(l._id) })),
    );
    if (erreur) throw new Error(erreur);

    // Rattacher une société à un employé qui n'en a aucune d'enregistrée : on matérialise d'abord
    // celle de la fiche, sinon elle disparaîtrait de la paie dès la première ligne explicite.
    const creeLe = new Date().toISOString();
    if (!lignes.length && societe !== employe.societe) {
      await ctx.db.insert("rattachements", {
        employeId, societe: employe.societe, principal: true, actif: true, creeLe,
        salaireBase: employe.salaireBase ?? employe.salaireBrut, joursBase: employe.joursBase,
        matriculeEmployeur: employe.matricule, cnpsEmployeur: employe.cnps, niuEmployeur: employe.niu,
        categorie: employe.categorie, echelon: employe.echelon, contrat: employe.contrat, dateDebut: employe.dateDebut,
      });
    }
    const principal = !lignes.length && societe === employe.societe;
    return await ctx.db.insert("rattachements", {
      employeId, societe, principal, actif: true, creeLe, ...nettoyer(champs),
    });
  },
});

/** Modifie un rattachement (salaire versé par cette société, matricule chez elle, dates, activité). */
export const modifierRattachement = mutation({
  args: {
    rattachementId: v.id("rattachements"),
    societe: v.optional(SOCIETE),
    actif: v.optional(v.boolean()),
    ...CHAMPS_RATTACHEMENT,
  },
  handler: async (ctx, { rattachementId, ...patch }) => {
    await requireDroit(ctx, "/employes", "faire");
    const ligne = await ctx.db.get(rattachementId);
    if (!ligne) throw new Error("Rattachement introuvable.");
    const lignes = await ctx.db.query("rattachements").withIndex("by_employe", (q) => q.eq("employeId", ligne.employeId)).collect();
    const erreur = erreurRattachement(
      { societe: patch.societe ?? ligne.societe, salaireBase: patch.salaireBase, joursBase: patch.joursBase, dateDebut: patch.dateDebut, dateFin: patch.dateFin },
      lignes.map((l) => ({ societe: l.societe, rattachementId: String(l._id) })),
      String(rattachementId),
    );
    if (erreur) throw new Error(erreur);
    // Le rattachement principal ne se désactive pas : il porte l'identité de la fiche. Pour sortir
    // un salarié de l'effectif, on retire la FICHE (« Retirer de l'effectif »), ce qui retire tout.
    if (ligne.principal && patch.actif === false) {
      throw new Error("La société porteuse de la fiche ne se désactive pas ici : retirez l'employé de l'effectif, ou changez sa société sur la fiche.");
    }
    await ctx.db.patch(rattachementId, nettoyer(patch));

    // Le principal et la fiche désignent le même employeur : on les garde alignés dans les deux sens.
    if (ligne.principal) {
      const majFiche: Record<string, unknown> = {};
      if (patch.societe !== undefined) majFiche.societe = patch.societe;
      if (patch.salaireBase !== undefined) majFiche.salaireBase = patch.salaireBase;
      if (Object.keys(majFiche).length) await ctx.db.patch(ligne.employeId, majFiche);
    }
  },
});

/**
 * Retire un rattachement. Refusé s'il a déjà produit un bulletin FIGÉ : un mois clôturé doit
 * rester relisible, et l'historique de paie d'un employeur ne s'efface pas. Dans ce cas, on
 * désactive le rattachement — il cesse de produire des bulletins et conserve son passé.
 */
export const supprimerRattachement = mutation({
  args: { rattachementId: v.id("rattachements") },
  handler: async (ctx, { rattachementId }) => {
    await requireDroit(ctx, "/employes", "faire");
    const ligne = await ctx.db.get(rattachementId);
    if (!ligne) return { supprime: false, desactive: false };
    if (ligne.principal) throw new Error("La société porteuse de la fiche ne se retire pas : changez-la sur la fiche de l'employé.");
    const figes = await ctx.db.query("bulletins").withIndex("by_employe_periode", (q) => q.eq("employeId", ligne.employeId)).collect();
    if (figes.some((b) => b.societe === ligne.societe)) {
      await ctx.db.patch(rattachementId, { actif: false, dateFin: ligne.dateFin ?? new Date().toISOString().slice(0, 10) });
      return { supprime: false, desactive: true };
    }
    await ctx.db.delete(rattachementId);
    return { supprime: true, desactive: false };
  },
});

/**
 * Migration du lot R2 bis : matérialise le rattachement que chaque fiche porte déjà.
 *
 * Elle n'est PAS un prérequis — `lib/societes.rattachementsEffectifs` lit la fiche tant qu'aucune
 * ligne n'existe, et la paie donne exactement les mêmes bulletins qu'avant. Elle sert à rendre le
 * modèle explicite, pour que l'écran Employés montre partout la même chose et que la RH n'ait plus
 * qu'à AJOUTER les secondes et troisièmes sociétés.
 *
 * Idempotente, sur le modèle de `migrerSalaireBase` : un employé qui a déjà un rattachement
 * principal n'est pas touché. Rejouable autant de fois qu'on veut.
 */
export const migrerRattachements = mutation({
  args: {},
  handler: async (ctx) => {
    await requireDroit(ctx, "/employes", "faire");
    const employes = await ctx.db.query("employes").collect();
    const creeLe = new Date().toISOString();
    let crees = 0;
    let dejaFaits = 0;
    let principauxPoses = 0;

    for (const e of employes) {
      const lignes = await ctx.db.query("rattachements").withIndex("by_employe", (q) => q.eq("employeId", e._id)).collect();
      if (lignes.some((l) => l.principal)) { dejaFaits++; continue; }
      // Rattachements ajoutés à la main avant la migration : on promeut celui de la société de la
      // fiche au rang de principal plutôt que d'en créer un second, qui serait un doublon.
      const deLaFiche = lignes.find((l) => l.societe === e.societe);
      if (deLaFiche) {
        await ctx.db.patch(deLaFiche._id, { principal: true });
        principauxPoses++;
        continue;
      }
      await ctx.db.insert("rattachements", {
        employeId: e._id, societe: e.societe, principal: true, actif: true, creeLe,
        salaireBase: e.salaireBase ?? e.salaireBrut, joursBase: e.joursBase,
        matriculeEmployeur: e.matricule, cnpsEmployeur: e.cnps, niuEmployeur: e.niu,
        categorie: e.categorie, echelon: e.echelon, contrat: e.contrat, dateDebut: e.dateDebut,
      });
      crees++;
    }
    return { total: employes.length, crees, dejaFaits, principauxPoses };
  },
});

/** Effectif d'UNE société déclarante : ce qu'elle paie et déclare, et rien d'autre. */
export const effectifSociete = query({
  args: { societe: SOCIETE },
  handler: async (ctx, { societe }) => {
    await requireUnDesDroits(ctx, ["/employes", "/paie/bulletins", "/paie/dipe"]);
    const employes = (await ctx.db.query("employes").collect()).filter((e) => e.actif);
    const lignes: { employeId: string; matricule: string; nom: string; salaireBase: number; seulEmployeur: boolean }[] = [];
    for (const e of employes) {
      const rats = await ctx.db.query("rattachements").withIndex("by_employe", (q) => q.eq("employeId", e._id)).collect();
      const effectifs = rattachementsEffectifs(e, rats);
      const r = effectifs.find((x) => x.societe === societe);
      if (!r) continue;
      lignes.push({
        employeId: String(e._id), matricule: r.matriculeEmployeur ?? e.matricule, nom: e.nom,
        salaireBase: r.salaireBase,
        // Faux pour un pluri-employé : utile pour repérer d'un coup d'œil qui est payé ailleurs.
        seulEmployeur: effectifs.length === 1,
      });
    }
    return {
      societe,
      lignes: lignes.sort((a, b) => a.nom.localeCompare(b.nom)),
      // Masse des salaires de base de CETTE société seulement : jamais la somme des trois.
      masseBase: lignes.reduce((t, l) => t + l.salaireBase, 0),
    };
  },
});

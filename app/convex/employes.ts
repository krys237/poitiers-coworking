import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { requireDroit, requireUnDesDroits } from "./lib/authz";
import { lireReglages } from "./parametres";
import { normaliserTelephone, erreurTelephone, avecIndicatif } from "./lib/telephone";
import { erreurRattachement, rattachementsEffectifs, type Societe } from "./lib/societes";
import { LIBELLE_CADENCE, aSuivre, echeances, resumerEcheances } from "./lib/echeancesContrat";
import { prochainMatricule as calculerProchainMatricule } from "./lib/matricule";
import { couleurServiceParDefaut } from "./lib/planningAnnuel";

const SOCIETE = v.union(v.literal("SESAME"), v.literal("SOFINA"), v.literal("SGC"));

// Déclaré ICI et non plus bas : `creer` s'en sert dans ses arguments, et les validateurs sont
// évalués au chargement du module — une référence en avant lèverait une erreur de zone morte.
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
    await requireUnDesDroits(ctx, ["/employes", "/paie/saisie", "/paie/planning", "/paie/bulletins"]);
    if (societe) {
      return await ctx.db.query("employes").withIndex("by_societe", (q) => q.eq("societe", societe)).collect();
    }
    return await ctx.db.query("employes").collect();
  },
});

/**
 * La fiche complète d'un employé, telle que le formulaire d'édition l'édite.
 *
 * Les trois écrans qui ouvrent la fiche (Employés, Récapitulatif synthèse, Récapitulatif tout
 * visible) construisaient cet objet à la main, et **aucun ne le remplissait en entier** : les
 * champs oubliés s'affichaient vides alors qu'ils étaient renseignés en base, et trois d'entre
 * eux (`immatriculeImpots`, `methodeEnvoi`, `contratRenouvele`) étaient réécrits à la valeur par
 * défaut du formulaire à chaque enregistrement. Panne constatée en recette ET en production le
 * 24/11/2026 : « type de contrat, service, date d'entrée CNPS, immatriculé aux impôts ne se
 * modifient pas ». Le formulaire lit désormais la fiche lui-même — un appelant ne peut plus en
 * passer une version partielle. Même garde que `liste` : le récapitulatif de paie ouvre la fiche
 * sans porter le droit `/employes`.
 */
export const fiche = query({
  args: { employeId: v.id("employes") },
  handler: async (ctx, { employeId }) => {
    await requireUnDesDroits(ctx, ["/employes", "/paie/saisie", "/paie/planning", "/paie/bulletins"]);
    const e = await ctx.db.get(employeId);
    if (!e) return null;
    return {
      employeId: String(e._id), matricule: e.matricule, nom: e.nom,
      fonction: e.fonction, adresse: e.adresse, cnps: e.cnps, niu: e.niu,
      email: e.email, whatsapp: e.whatsapp, societe: e.societe,
      // `salaireBrut` est l'ancien nom, encore porté par les fiches non migrées.
      salaireBase: e.salaireBase ?? e.salaireBrut ?? 0,
      dateDebut: e.dateDebut, congesInitial: e.congesInitial, actif: e.actif,
      serviceId: e.serviceId, immatriculeImpots: e.immatriculeImpots,
      dateEntreeCnps: e.dateEntreeCnps, methodeEnvoi: e.methodeEnvoi,
      contrat: e.contrat, dateFin: e.dateFin, contratRenouvele: e.contratRenouvele,
    };
  },
});

/**
 * Suggestion de matricule pour une nouvelle fiche (lot 6) : le numéro suivant le plus haut trouvé,
 * dans le même format que le dernier matricule connu. La fiche la pré-remplit mais le champ reste
 * modifiable — ce n'est qu'une proposition.
 */
export const prochainMatricule = query({
  args: {},
  handler: async (ctx) => {
    await requireDroit(ctx, "/employes");
    const employes = await ctx.db.query("employes").collect();
    return calculerProchainMatricule(employes.map((e) => e.matricule));
  },
});

export const creer = mutation({
  args: {
    matricule: v.string(), nom: v.string(), fonction: v.optional(v.string()),
    adresse: v.optional(v.string()), cnps: v.optional(v.string()), niu: v.optional(v.string()),
    email: v.optional(v.string()), whatsapp: v.optional(v.string()), societe: SOCIETE, salaireBase: v.number(), contrat: v.optional(v.string()),
    serviceId: v.optional(v.id("services")), immatriculeImpots: v.optional(v.boolean()), dateEntreeCnps: v.optional(v.string()),
    matriculeCnps: v.optional(v.string()),
    methodeEnvoi: v.optional(v.union(v.literal("auto"), v.literal("email"), v.literal("whatsapp"))),
    dateDebut: v.optional(v.string()), dateFin: v.optional(v.string()), congesInitial: v.optional(v.number()),
    categorie: v.optional(v.string()), echelon: v.optional(v.string()),
    contratRenouvele: v.optional(v.boolean()),
    /**
     * Sociétés à rattacher DÈS la création (lot R10). Facultatif : sans elles, la société de la
     * fiche fait foi, comme avant. Une mutation Convex étant transactionnelle, un rattachement
     * refusé annule aussi la création de la fiche — d'où la possibilité de tout saisir d'un coup,
     * ce que le lot R10 avait laissé « à cadrer ».
     */
    rattachements: v.optional(v.array(v.object({ societe: SOCIETE, ...CHAMPS_RATTACHEMENT }))),
  },
  handler: async (ctx, { rattachements, ...args }) => {
    await requireDroit(ctx, "/employes", "faire");
    // Le matricule identifie la fiche (import, bulletins, « Mes bulletins ») : jamais deux fois le même (retour terrain du 13/10/2026).
    const matricule = args.matricule.trim().toUpperCase();
    if (!matricule) throw new Error("Matricule requis.");
    const doublon = await ctx.db.query("employes").withIndex("by_matricule", (q) => q.eq("matricule", matricule)).first();
    if (doublon) throw new Error(`Le matricule ${matricule} existe déjà : ${doublon.nom}${doublon.actif ? "" : " (fiche désactivée)"}.`);
    const reglages = await lireReglages(ctx);

    // Les rattachements sont contrôlés AVANT l'insertion de la fiche : la mutation étant
    // transactionnelle, un rattachement refusé annule aussi la création de l'employé. Rien ne
    // reste à moitié fait.
    const aCreer = rattachements ?? [];
    const dejaVues: { societe: Societe; rattachementId?: string }[] = [];
    for (const r of aCreer) {
      const erreur = erreurRattachement(r, dejaVues);
      if (erreur) throw new Error(erreur);
      dejaVues.push({ societe: r.societe });
    }

    const employeId = await ctx.db.insert("employes", {
      ...args, matricule, whatsapp: numeroWhatsapp(args.whatsapp),
      joursBase: reglages.joursBaseDefaut, actif: true,
    });

    if (aCreer.length) {
      const creeLe = new Date().toISOString();
      // La société de la FICHE reste la principale : c'est elle qui fait foi partout où aucune
      // société n'est précisée. Si elle ne figure pas dans la liste saisie, on la matérialise —
      // sinon elle disparaîtrait de la paie dès la première ligne explicite, exactement comme
      // dans `ajouterRattachement`.
      if (!aCreer.some((r) => r.societe === args.societe)) {
        await ctx.db.insert("rattachements", {
          employeId, societe: args.societe, principal: true, actif: true, creeLe,
          salaireBase: args.salaireBase, categorie: args.categorie, echelon: args.echelon,
          contrat: args.contrat, dateDebut: args.dateDebut, matriculeEmployeur: matricule,
          cnpsEmployeur: args.cnps, niuEmployeur: args.niu,
        });
      }
      for (const { societe, ...champs } of aCreer) {
        await ctx.db.insert("rattachements", {
          employeId, societe, principal: societe === args.societe, actif: true, creeLe,
          ...nettoyer(champs),
        });
      }
    }
    return employeId;
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
    serviceId: v.optional(v.id("services")), immatriculeImpots: v.optional(v.boolean()), dateEntreeCnps: v.optional(v.string()),
    matriculeCnps: v.optional(v.string()),
    methodeEnvoi: v.optional(v.union(v.literal("auto"), v.literal("email"), v.literal("whatsapp"))),
    dateDebut: v.optional(v.string()), dateFin: v.optional(v.string()), congesInitial: v.optional(v.number()),
    categorie: v.optional(v.string()), echelon: v.optional(v.string()),
    // `contrat` était accepté à la CRÉATION mais absent ici : toute modification d'une fiche
    // portant un type de contrat était donc rejetée par Convex, avec pour seul message un dump de
    // validateur. Panne constatée en production le 20/11/2026 — création possible, modification
    // impossible. Les deux mutations décrivent la même fiche : leurs champs ne doivent pas diverger.
    contrat: v.optional(v.string()),
    contratRenouvele: v.optional(v.boolean()),
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

// Import CSV : upsert par matricule (sinon par nom). Recalcul réactif automatique ensuite.
// L'écran ne lit pas les classeurs Excel — aucune bibliothèque de tableur n'est embarquée.
export const importer = mutation({
  args: {
    lignes: v.array(v.object({
      matricule: v.string(), nom: v.string(), fonction: v.optional(v.string()),
      adresse: v.optional(v.string()), cnps: v.optional(v.string()), niu: v.optional(v.string()),
      email: v.optional(v.string()), whatsapp: v.optional(v.string()), societe: SOCIETE, salaireBase: v.number(),
      dateDebut: v.optional(v.string()),
      /** Date d'entrée à la CNPS (colonne « DATE D'AFFILIATION » du fichier de l'effectif). */
      dateEntreeCnps: v.optional(v.string()),
      /** Matricule CNPS — distinct du numéro CNPS, voir le schéma. */
      matriculeCnps: v.optional(v.string()),
      /** Nom du service d'affectation, tel qu'écrit dans le fichier. Créé s'il n'existe pas. */
      service: v.optional(v.string()),
      /**
       * Montant versé PAR société (colonnes `salaire_sesame`, `salaire_sofina`, `salaire_sgc`).
       *
       * « Chaque société fait son paiement, donc un montant par société » — arbitrage du
       * propriétaire du 19/11/2026. Le montant est donc OBLIGATOIRE pour rattacher : un
       * rattachement sans lui retombe sur le salaire entier de la fiche
       * (`lib/societes.rattachementsEffectifs`), ce qui produirait un second bulletin à plein
       * salaire. L'écran refuse de rattacher une société dont le fichier ne chiffre pas la part.
       */
      rattachements: v.optional(v.array(v.object({ societe: SOCIETE, salaireBase: v.number() }))),
    })),
  },
  handler: async (ctx, { lignes }) => {
    await requireDroit(ctx, "/employes", "faire");
    const joursBase = (await lireReglages(ctx)).joursBaseDefaut;

    // --- Services : rapprochement par nom, création des manquants -----------------------------
    // Le classeur de l'effectif porte une colonne SERVICE que l'import ignorait, si bien que les
    // 87 fiches arrivaient sans affectation — et le planning des congés comme la détection de
    // chevauchement reposent dessus. Les noms sont saisis à la main : on rapproche sur une forme
    // normalisée (casse, accents, espaces), sinon « IMAGERIE RADIO » et « Imagerie Radio »
    // créeraient deux services pour le même.
    const cleService = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
    const services = await ctx.db.query("services").collect();
    const parNom = new Map(services.map((s) => [cleService(s.nom), s._id]));
    let ordre = services.reduce((m, s) => Math.max(m, s.ordre), -1) + 1;
    const servicesCrees: string[] = [];
    for (const l of lignes) {
      const nom = (l.service ?? "").trim();
      if (!nom || parNom.has(cleService(nom))) continue;
      // Créé plutôt qu'ignoré : un service absent ferait silencieusement perdre l'affectation,
      // et c'est exactement le genre de perte invisible qu'on ne veut plus. Le compte rendu les
      // nomme, pour qu'une faute de frappe dans le fichier se voie tout de suite.
      const id = await ctx.db.insert("services", { nom, couleur: couleurServiceParDefaut(ordre), ordre, actif: true, chefs: [] });
      parNom.set(cleService(nom), id);
      servicesCrees.push(nom);
      ordre++;
    }

    let crees = 0, majs = 0, avecService = 0, sansService = 0, rattachementsPoses = 0, rattachementsMajs = 0;
    for (const brute of lignes) {
      const { service, rattachements: parts, ...champs } = brute;
      // Une colonne vide ne doit RIEN effacer : dans un patch Convex, un champ `undefined` supprime la
      // valeur existante (e-mail, CNPS, NIU… perdus à la réimportation d'un fichier partiel).
      const l = Object.fromEntries(Object.entries({ ...champs, whatsapp: numeroWhatsapp(champs.whatsapp) }).filter(([, v]) => v !== undefined && v !== "")) as typeof champs;
      const serviceId = service?.trim() ? parNom.get(cleService(service)) : undefined;
      if (serviceId) avecService++; else sansService++;
      const avecAffectation = serviceId ? { ...l, serviceId } : l;
      const existant = await ctx.db
        .query("employes")
        .withIndex("by_matricule", (q) => q.eq("matricule", l.matricule))
        .unique();
      let employeId;
      if (existant) { await ctx.db.patch(existant._id, avecAffectation); employeId = existant._id; majs++; }
      else { employeId = await ctx.db.insert("employes", { ...avecAffectation, joursBase, actif: true }); crees++; }

      // --- Rattachements multi-société -------------------------------------------------------
      // Un import ne SUPPRIME jamais un employeur : il pose ceux que le fichier chiffre et
      // met à jour leur montant. Retirer un rattachement reste un geste délibéré, fait dans la
      // fiche — un fichier partiel ne doit pas faire disparaître une société qui paie.
      if (parts?.length) {
        const creeLe = new Date().toISOString();
        const existants = await ctx.db.query("rattachements").withIndex("by_employe", (q) => q.eq("employeId", employeId)).collect();
        const parSociete = new Map(existants.map((r) => [r.societe, r]));
        // La société de la FICHE est la principale, et doit exister dès qu'une autre apparaît :
        // sans elle, elle disparaîtrait de la paie à la première ligne explicite.
        const aPoser = parts.some((p) => p.societe === l.societe)
          ? parts
          : [...parts, { societe: l.societe, salaireBase: l.salaireBase }];
        for (const p of aPoser) {
          const deja = parSociete.get(p.societe);
          if (deja) {
            if (deja.salaireBase !== p.salaireBase) { await ctx.db.patch(deja._id, { salaireBase: p.salaireBase }); rattachementsMajs++; }
            continue;
          }
          await ctx.db.insert("rattachements", {
            employeId, societe: p.societe, principal: p.societe === l.societe, actif: true, creeLe,
            salaireBase: p.salaireBase, joursBase,
            matriculeEmployeur: l.matricule, cnpsEmployeur: l.cnps, niuEmployeur: l.niu,
            dateDebut: l.dateDebut,
          });
          rattachementsPoses++;
        }
      }
    }
    return { crees, majs, servicesCrees, avecService, sansService, rattachementsPoses, rattachementsMajs };
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

/**
 * Les échéances de contrat à surveiller, et les rappels du jour (demande N2).
 *
 * « Nous voulons un système d'alerte et de rappel qui signale avant échéance. »
 *
 * La cadence est réglable dans *Paramètres → Fonctionnement* ; par défaut un avis à un mois, puis
 * chaque semaine, puis chaque jour la dernière semaine. Un contrat ÉCHU alerte tous les jours et
 * reste en tête : c'est le seul cas où l'inaction crée un engagement, un CDD arrivé à terme sans
 * décision se requalifiant en CDI.
 */
export const echeancesContrats = query({
  args: { aujourdhui: v.optional(v.string()) },
  handler: async (ctx, { aujourdhui }) => {
    await requireDroit(ctx, "/employes");
    const r = await lireReglages(ctx);
    const regles = {
      premierAvisJours: r.rappelPremierAvisJours,
      hebdoDepuisJours: r.rappelHebdoDepuisJours,
      quotidienDepuisJours: r.rappelQuotidienDepuisJours,
    };
    const jour = aujourdhui ?? new Date().toISOString().slice(0, 10);

    const employes = await ctx.db.query("employes").collect();
    const services = await ctx.db.query("services").collect();
    const nomService = new Map(services.map((x) => [String(x._id), x.nom]));

    const suivis = employes.filter((e) => aSuivre({ contrat: e.contrat, dateFin: e.dateFin, actif: e.actif }));
    const liste = echeances(
      suivis.map((e) => ({
        id: String(e._id),
        nom: e.nom,
        matricule: e.matricule,
        contrat: e.contrat,
        dateDebut: e.dateDebut,
        dateFin: e.dateFin!,
        renouvele: e.contratRenouvele,
        serviceNom: e.serviceId ? nomService.get(String(e.serviceId)) ?? null : null,
      })),
      jour,
      regles,
    );

    return {
      aujourdhui: jour,
      regles,
      echeances: liste,
      resume: resumerEcheances(liste),
      libelles: LIBELLE_CADENCE,
    };
  },
});

/**
 * Retire des fiches employés importées par erreur, désignées par leur matricule.
 *
 * `internalMutation` : elle s'appelle depuis le CLI, sous le regard de l'agent de déploiement.
 * Supprimer quatre-vingts fiches ne doit pas être à portée de clic.
 *
 * Elle REFUSE toute fiche qui a déjà servi — saisie mensuelle, bulletin, ou compte de connexion
 * rattaché — plutôt que d'emporter un historique de paie, et rend compte de chaque refus avec sa
 * raison. Les rattachements de société, eux, n'existent que par la fiche : ils partent avec elle,
 * sinon ils resteraient orphelins et `rattachementsEffectifs` lirait une référence morte.
 *
 * Posée le 23/11/2026. Un import de production portait des matricules numériques (« 1 », « 2 »…)
 * que le fichier définitif remplace par « PP1 », « PP2 »… Le matricule étant la clé de
 * reconnaissance, un second import aurait créé des doublons au lieu de mettre à jour.
 */
export const supprimerFichesImportees = internalMutation({
  args: { matricules: v.array(v.string()) },
  handler: async (ctx, { matricules }) => {
    const supprimees: string[] = [];
    const refusees: { matricule: string; raison: string }[] = [];
    let rattachementsSupprimes = 0;
    const membres = await ctx.db.query("users").collect();

    for (const brut of matricules) {
      const matricule = brut.trim();
      const fiche = await ctx.db.query("employes").withIndex("by_matricule", (q) => q.eq("matricule", matricule)).unique();
      if (!fiche) { refusees.push({ matricule, raison: "aucune fiche à ce matricule" }); continue; }

      const saisie = await ctx.db.query("saisiesMensuelles").withIndex("by_employe_periode", (q) => q.eq("employeId", fiche._id)).first();
      if (saisie) { refusees.push({ matricule, raison: `porte une saisie mensuelle (${saisie.periode})` }); continue; }
      const bulletin = await ctx.db.query("bulletins").withIndex("by_employe_periode", (q) => q.eq("employeId", fiche._id)).first();
      if (bulletin) { refusees.push({ matricule, raison: `porte un bulletin (${bulletin.periode})` }); continue; }
      const membre = membres.find((u) => String(u.employeId ?? "") === String(fiche._id));
      if (membre) { refusees.push({ matricule, raison: `compte de connexion rattaché (${membre.nom ?? membre.email})` }); continue; }

      for (const r of await ctx.db.query("rattachements").withIndex("by_employe", (q) => q.eq("employeId", fiche._id)).collect()) {
        await ctx.db.delete(r._id);
        rattachementsSupprimes++;
      }
      await ctx.db.delete(fiche._id);
      supprimees.push(matricule);
    }
    return { demandees: matricules.length, supprimees: supprimees.length, rattachementsSupprimes, refusees };
  },
});

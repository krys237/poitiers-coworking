// Actes RH (lot R11) — attestations, notifications, stages et contrats.
//
// Ce que ça remplace : aujourd'hui la RH ouvre un fichier Word, remplace les pointillés à la
// main, et pour une attestation de salaire recopie SEIZE montants depuis le bulletin. Ici elle
// choisit le salarié, la période, et tout ce que le système sait est déjà en place.
//
// Les modèles vivent en BASE et non dans le code : elle doit pouvoir corriger une formulation
// sans nous. `lib/actes.MODELES_DEFAUT` ne sert qu'à l'amorçage.

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireDroit } from "./lib/authz";
import { bulletinsPourPeriode } from "./lib/calculBulletins";
import { salaireDeBase } from "./lib/paie";
import {
  MODELES_DEFAUT, champsManquants, construireReference, prochaineSequence,
  rendreActe, validerModele, type ChampActe, type ModeleActe,
} from "./lib/actes";

const aujourdHui = () => new Date().toISOString().slice(0, 10);
const fmtDate = (iso?: string) =>
  iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(8, 10) + "/" + iso.slice(5, 7) + "/" + iso.slice(0, 4) : "";
const fmtMontant = (n: unknown) =>
  typeof n === "number" ? Math.round(n).toLocaleString("fr-FR").replace(/ /g, " ") : "";

/** Les modèles disponibles, amorcés par défaut tant que la table est vide. */
export const modeles = query({
  args: {},
  handler: async (ctx) => {
    await requireDroit(ctx, "/employes");
    const enBase = (await ctx.db.query("modelesActes").collect()).filter((m) => m.actif);
    if (enBase.length) {
      enBase.sort((a, b) => a.ordre - b.ordre);
      return { source: "base" as const, modeles: enBase as unknown as ModeleActe[] };
    }
    // Tant qu'elle n'a rien personnalisé, le catalogue du code fait foi — l'écran marche
    // immédiatement, sans attendre un amorçage.
    return { source: "defaut" as const, modeles: MODELES_DEFAUT };
  },
});

/** Charge les modèles par défaut en base, pour qu'ils deviennent modifiables. Idempotent. */
export const initialiserModeles = mutation({
  args: {},
  handler: async (ctx) => {
    await requireDroit(ctx, "/employes", "faire");
    const deja = new Set((await ctx.db.query("modelesActes").collect()).map((m) => m.code));
    let ajoutes = 0;
    for (const m of MODELES_DEFAUT) {
      if (deja.has(m.code)) continue;
      const erreurs = validerModele(m);
      if (erreurs.length) throw new Error(`Modèle ${m.code} incohérent : ${erreurs.join(" ")}`);
      await ctx.db.insert("modelesActes", {
        code: m.code, libelle: m.libelle, famille: m.famille, corps: m.corps,
        champs: m.champs.map((c) => ({
          nom: c.nom, libelle: c.libelle, type: c.type, obligatoire: c.obligatoire,
          source: { de: c.source.de, cle: (c.source as any).cle },
          aide: c.aide,
        })),
        formatReference: m.formatReference, ordre: m.ordre, actif: true,
      });
      ajoutes++;
    }
    return { ajoutes, dejaPresents: deja.size };
  },
});

async function modeleDe(ctx: any, code: string): Promise<ModeleActe> {
  const enBase = await ctx.db.query("modelesActes").withIndex("by_code", (q: any) => q.eq("code", code)).unique();
  if (enBase) return enBase as ModeleActe;
  const defaut = MODELES_DEFAUT.find((m) => m.code === code);
  if (!defaut) throw new Error(`Modèle d'acte inconnu : ${code}`);
  return defaut;
}

/**
 * Valeurs proposées pour un acte : tout ce que le système sait déjà.
 * C'est le cœur du lot — pour une attestation de salaire, les seize montants viennent du
 * bulletin de la période et la RH n'a plus qu'à préciser la situation.
 */
export const preparer = query({
  args: { code: v.string(), employeId: v.optional(v.id("employes")), periode: v.optional(v.string()) },
  handler: async (ctx, { code, employeId, periode }) => {
    await requireDroit(ctx, "/employes");
    const modele = await modeleDe(ctx, code);
    const parametres = await ctx.db.query("parametresEntreprise").first();
    const employe = employeId ? await ctx.db.get(employeId) : null;

    // Le bulletin n'est chargé que si un champ en dépend : inutile de calculer tout un mois
    // pour une attestation de reprise de service.
    const besoinBulletin = modele.champs.some((c) => c.source.de === "bulletin");
    let bulletin: any = null;
    let avertissement: string | null = null;
    if (besoinBulletin && employe && periode) {
      const r = await bulletinsPourPeriode(ctx, periode);
      bulletin = r.bulletins.find((b) => String(b.employeId) === String(employeId)) ?? null;
      if (!bulletin) avertissement = `Aucun bulletin pour ${periode} : les montants restent à saisir.`;
    } else if (besoinBulletin && !periode) {
      avertissement = "Choisissez une période pour que les montants du bulletin se pré-remplissent.";
    }

    const d = bulletin?.details;
    const a = d?.assiettes;
    const duBulletin: Record<string, unknown> = bulletin
      ? {
          salaireBase: d?.salaireBase, anciennete: d?.anciennete, primeAssiduite: undefined,
          transport: undefined, indemniteLogement: undefined, primeSalissure: undefined, primeLait: undefined,
          cnpsSalarie: d?.cnpsSalarie, irpp: d?.irpp, cac: d?.cac, tdl: d?.tdl, rav: d?.rav,
          cfcSalarie: bulletin.cotisations?.find((c: any) => c.code === "44724")?.retenue,
          salaireTaxable: a?.taxable, salaireCotisable: a?.cotisablePlafonne, net: bulletin.net,
          ...Object.fromEntries(
            (bulletin.lignesGain ?? []).map((g: any) => [g.code, g.gain]),
          ),
        }
      : {};
    // Les primes nommées se lisent par leur code de rubrique.
    if (bulletin) {
      duBulletin.transport = duBulletin["66121"];
      duBulletin.primeAssiduite = duBulletin["66122"];
      duBulletin.indemniteLogement = duBulletin["6631"];
      duBulletin.primeSalissure = duBulletin["6632"];
      duBulletin.primeLait = duBulletin["6634"];
    }

    const valeurs: Record<string, string> = {};
    for (const c of modele.champs as ChampActe[]) {
      const s: any = c.source;
      let brut: unknown;
      if (s.de === "aujourdhui") brut = aujourdHui();
      else if (s.de === "entreprise") brut = (parametres as any)?.[s.cle];
      else if (s.de === "employe") {
        brut = s.cle === "salaireBase" && employe ? salaireDeBase(employe) : (employe as any)?.[s.cle];
      } else if (s.de === "bulletin") brut = duBulletin[s.cle];
      if (brut === undefined || brut === null || brut === "") continue;
      valeurs[c.nom] =
        c.type === "montant" ? fmtMontant(brut)
        : c.type === "date" ? fmtDate(String(brut))
        : String(brut);
    }

    return {
      modele,
      valeurs,
      avertissement,
      aSaisir: (modele.champs as ChampActe[]).filter((c) => !valeurs[c.nom]).map((c) => c.nom),
      apercu: rendreActe(modele.corps, valeurs),
    };
  },
});

/**
 * Délivre l'acte : fige son texte, lui attribue sa référence et l'archive.
 * Le corps rendu est STOCKÉ et non recalculé — un acte remis au salarié doit pouvoir être
 * retrouvé à l'identique, même si le modèle est corrigé ensuite.
 */
export const generer = mutation({
  args: {
    code: v.string(),
    employeId: v.optional(v.id("employes")),
    periode: v.optional(v.string()),
    valeurs: v.record(v.string(), v.string()),
  },
  handler: async (ctx, { code, employeId, periode, valeurs }) => {
    const me = await requireDroit(ctx, "/employes", "faire");
    const modele = await modeleDe(ctx, code);

    const date = valeurs.date && /^\d{2}\/\d{2}\/\d{4}$/.test(valeurs.date)
      ? `${valeurs.date.slice(6)}-${valeurs.date.slice(3, 5)}-${valeurs.date.slice(0, 2)}`
      : aujourdHui();

    // Référence AVANT le rendu : le corps peut porter {{reference}}.
    let reference: string | undefined;
    if (modele.formatReference) {
      const annee = +date.slice(0, 4);
      const existantes = (await ctx.db.query("actes").withIndex("by_modele", (q) => q.eq("modeleCode", code)).collect())
        .map((a) => a.reference ?? "")
        .filter(Boolean);
      reference = construireReference(modele.formatReference, prochaineSequence(existantes, annee), date);
    }
    const completes = reference ? { ...valeurs, reference } : valeurs;

    const manquants = champsManquants(modele, completes);
    if (manquants.length)
      throw new Error(`Champs obligatoires non renseignés : ${manquants.map((c) => c.libelle).join(", ")}.`);

    const employe = employeId ? await ctx.db.get(employeId) : null;
    const id = await ctx.db.insert("actes", {
      modeleCode: code,
      employeId: employeId ?? undefined,
      nomBeneficiaire: completes.nom || employe?.nom || "—",
      reference,
      periode,
      valeurs: completes,
      corpsRendu: rendreActe(modele.corps, completes),
      genereLe: new Date().toISOString(),
      genereParId: me._id,
      genereParNom: me.name ?? me.email,
    });
    return { id, reference };
  },
});

/** Les actes délivrés, du plus récent au plus ancien. */
export const historique = query({
  args: { employeId: v.optional(v.id("employes")), limite: v.optional(v.number()) },
  handler: async (ctx, { employeId, limite }) => {
    await requireDroit(ctx, "/employes");
    const lignes = employeId
      ? await ctx.db.query("actes").withIndex("by_employe", (q) => q.eq("employeId", employeId)).collect()
      : await ctx.db.query("actes").withIndex("by_date").order("desc").take(limite ?? 100);
    lignes.sort((a, b) => b.genereLe.localeCompare(a.genereLe));
    const libelles = new Map(MODELES_DEFAUT.map((m) => [m.code, m.libelle]));
    for (const m of await ctx.db.query("modelesActes").collect()) libelles.set(m.code, m.libelle);
    return lignes.map((a) => ({
      _id: a._id, modeleCode: a.modeleCode, modeleLibelle: libelles.get(a.modeleCode) ?? a.modeleCode,
      nomBeneficiaire: a.nomBeneficiaire, reference: a.reference ?? null, periode: a.periode ?? null,
      genereLe: a.genereLe, genereParNom: a.genereParNom ?? null,
      annuleLe: a.annuleLe ?? null, corpsRendu: a.corpsRendu,
    }));
  },
});

/**
 * Annule un acte délivré sans l'effacer : il reste lisible, barré, avec son motif.
 * Supprimer un acte remis au salarié effacerait la trace d'un document qui circule.
 */
export const annuler = mutation({
  args: { id: v.id("actes"), motif: v.string() },
  handler: async (ctx, { id, motif }) => {
    await requireDroit(ctx, "/employes", "faire");
    if (!motif.trim()) throw new Error("Un motif d'annulation est obligatoire.");
    const a = await ctx.db.get(id);
    if (!a) throw new Error("Acte introuvable.");
    if (a.annuleLe) throw new Error("Cet acte est déjà annulé.");
    await ctx.db.patch(id, { annuleLe: new Date().toISOString(), annuleMotif: motif.trim() });
  },
});

/** Un acte délivré, pour la génération de son PDF. Son texte est figé : jamais recalculé. */
export const pourPdf = query({
  args: { id: v.id("actes") },
  handler: async (ctx, { id }) => {
    await requireDroit(ctx, "/employes");
    const a = await ctx.db.get(id);
    if (!a) throw new Error("Acte introuvable.");
    const enBase = await ctx.db.query("modelesActes").withIndex("by_code", (q) => q.eq("code", a.modeleCode)).unique();
    const libelle =
      enBase?.libelle ?? MODELES_DEFAUT.find((m) => m.code === a.modeleCode)?.libelle ?? a.modeleCode;
    return {
      corpsRendu: a.corpsRendu,
      modeleLibelle: libelle,
      nomBeneficiaire: a.nomBeneficiaire,
      reference: a.reference ?? null,
      annuleLe: a.annuleLe ?? null,
    };
  },
});

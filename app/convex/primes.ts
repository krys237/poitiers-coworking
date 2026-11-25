import { query, mutation, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { requireDroit } from "./lib/authz";
import { cleCouple, societePrincipale, type Societe } from "./lib/societes";

const TYPE = v.union(v.literal("prime"), v.literal("charge"));
const SOCIETE = v.union(v.literal("SESAME"), v.literal("SOFINA"), v.literal("SGC"));

/**
 * La société d'une ligne de registre, résolue exactement comme `payroll.saisirMois` le fait pour
 * une saisie mensuelle : absente = société PORTEUSE de la fiche, et une société demandée doit
 * correspondre à un rattachement ACTIF.
 *
 * Sans ce contrôle, le registre était aveugle au déclarant (écart É3 de
 * `docs/coherence/ECARTS-CHIFFRES-DERIVES.md`) : la mutation n'acceptait pas de société, écrivait
 * donc une ligne sans société, et `toutesPourSociete` la rattachait au déclarant PRINCIPAL. Une
 * prime destinée au second déclarant partait chez le premier, sans un mot — alors que la colonne
 * `societe` existait au schéma et que `calculBulletins` la lisait déjà par couple.
 */
async function societePour(
  ctx: MutationCtx,
  employeId: Id<"employes">,
  societeDemandee: Societe | undefined,
): Promise<Societe> {
  const employe = await ctx.db.get(employeId);
  if (!employe) throw new Error("Employé introuvable.");
  const lignes = await ctx.db.query("rattachements").withIndex("by_employe", (q) => q.eq("employeId", employeId)).collect();
  const societe = societeDemandee ?? societePrincipale(employe, lignes);
  const actives = lignes.filter((l) => l.actif).map((l) => l.societe);
  if (actives.length && !actives.includes(societe)) {
    throw new Error(`${employe.nom} n'est pas rattaché à ${societe} : ajoutez le rattachement dans l'écran Employés.`);
  }
  return societe;
}

async function verifierOuvert(ctx: MutationCtx, periode: string) {
  const clos = await ctx.db.query("cloturesPaie").withIndex("by_periode", (q) => q.eq("periode", periode)).unique();
  if (clos) throw new Error(`Le mois ${periode} est clôturé : registre en lecture seule.`);
}

// Registre du mois : lignes (avec nom d'employé), totaux et récapitulatif par employé.
export const liste = query({
  args: { periode: v.string() },
  handler: async (ctx, { periode }) => {
    await requireDroit(ctx, "/paie/primes");
    const cloture = await ctx.db.query("cloturesPaie").withIndex("by_periode", (q) => q.eq("periode", periode)).unique();
    const employes = await ctx.db.query("employes").collect();
    const nomDe = new Map(employes.map((e) => [String(e._id), e.nom]));

    // TOUS les rattachements en une passe, groupés en mémoire. Une requête par employé coûterait
    // un aller-retour par fiche à chaque affichage, et cet écran se recharge à chaque saisie —
    // c'est la dette déjà consignée pour `comptesRendus.vueSuperviseur`, qu'on ne recrée pas ici.
    const ratsParEmploye = new Map<string, { societe: Societe; actif: boolean; principal?: boolean }[]>();
    for (const r of await ctx.db.query("rattachements").collect()) {
      const k = String(r.employeId);
      (ratsParEmploye.get(k) ?? ratsParEmploye.set(k, []).get(k)!).push(r);
    }
    /** Société porteuse de la fiche — à qui appartient une ligne enregistrée sans société. */
    const principaleDe = (e: { _id: unknown; societe: Societe }): Societe =>
      societePrincipale(e as any, (ratsParEmploye.get(String(e._id)) ?? []) as any);
    /** Les sociétés qui rémunèrent réellement un employé : ses rattachements actifs, ou sa fiche. */
    const societesDe = (e: { _id: unknown; societe: Societe }): Societe[] => {
      const actives = (ratsParEmploye.get(String(e._id)) ?? []).filter((r) => r.actif).map((r) => r.societe);
      return actives.length ? [...new Set(actives)] : [e.societe];
    };
    const employeParId = new Map(employes.map((e) => [String(e._id), e]));

    const lignes = (await ctx.db.query("primesCharges").withIndex("by_periode", (q) => q.eq("periode", periode)).collect())
      .sort((a, b) => b.date.localeCompare(a.date) || b._creationTime - a._creationTime)
      .map((l) => {
        const e = employeParId.get(String(l.employeId));
        // Une ligne sans société appartient à la porteuse de la fiche, exactement comme
        // `toutesPourSociete` la lit côté bulletin. La règle de compatibilité est inchangée :
        // c'est l'écran qui cessait de la voir, pas le calcul.
        const societe = (l.societe ?? (e ? principaleDe(e) : undefined)) as Societe | undefined;
        return {
          ...l, nom: nomDe.get(String(l.employeId)) ?? "?", societe,
          cle: societe ? cleCouple(String(l.employeId), societe) : String(l.employeId),
          /** Vrai quand la société n'est pas écrite sur la ligne mais déduite de la fiche. */
          societeDeduite: l.societe === undefined,
        };
      });

    const parCouple = new Map<string, { cle: string; employeId: string; nom: string; societe: Societe | undefined; primes: number; charges: number }>();
    let totalPrimes = 0, totalCharges = 0;
    for (const l of lignes) {
      const r = parCouple.get(l.cle) ?? { cle: l.cle, employeId: String(l.employeId), nom: l.nom, societe: l.societe, primes: 0, charges: 0 };
      if (l.type === "prime") { r.primes += l.montant; totalPrimes += l.montant; } else { r.charges += l.montant; totalCharges += l.montant; }
      parCouple.set(l.cle, r);
    }

    return {
      periode, cloture: !!cloture, lignes,
      totaux: { primes: totalPrimes, charges: totalCharges, couples: parCouple.size },
      parCouple: [...parCouple.values()].sort((a, b) => a.nom.localeCompare(b.nom) || String(a.societe).localeCompare(String(b.societe))),
      // Un couple (employé, déclarant) par entrée : un pluri-employé apparaît autant de fois qu'il
      // a d'employeurs, et c'est le seul moyen de désigner celui qu'on vise.
      couplesActifs: employes.filter((e) => e.actif).flatMap((e) =>
        societesDe(e).map((societe) => ({
          cle: cleCouple(String(e._id), societe), employeId: e._id, societe, nom: e.nom,
          libelle: societesDe(e).length > 1 ? `${e.nom} — ${societe}` : e.nom,
        })),
      ).sort((a, b) => a.nom.localeCompare(b.nom) || a.societe.localeCompare(b.societe)),
    };
  },
});

export const ajouter = mutation({
  args: { employeId: v.id("employes"), periode: v.string(), libelle: v.string(), montant: v.number(), type: TYPE, date: v.string(), societe: v.optional(SOCIETE) },
  handler: async (ctx, a) => {
    await requireDroit(ctx, "/paie/primes", "faire");
    await verifierOuvert(ctx, a.periode);
    const libelle = a.libelle.trim();
    if (!libelle) throw new Error("Libellé requis.");
    if (!(a.montant > 0)) throw new Error("Le montant doit être strictement positif.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(a.date)) throw new Error("Date au format AAAA-MM-JJ.");
    const societe = await societePour(ctx, a.employeId, a.societe);
    return await ctx.db.insert("primesCharges", { ...a, societe, libelle, montant: Math.round(a.montant) });
  },
});

// Modification d'une ligne existante (même contrôles qu'à l'ajout ; le mois doit être ouvert).
export const modifier = mutation({
  args: { ligneId: v.id("primesCharges"), employeId: v.optional(v.id("employes")), libelle: v.optional(v.string()), montant: v.optional(v.number()), type: v.optional(TYPE), date: v.optional(v.string()), societe: v.optional(SOCIETE) },
  handler: async (ctx, { ligneId, ...patch }) => {
    await requireDroit(ctx, "/paie/primes", "faire");
    const l = await ctx.db.get(ligneId);
    if (!l) throw new Error("Ligne introuvable.");
    await verifierOuvert(ctx, l.periode);
    const libelle = patch.libelle?.trim();
    if (patch.libelle !== undefined && !libelle) throw new Error("Libellé requis.");
    if (patch.montant !== undefined && !(patch.montant > 0)) throw new Error("Le montant doit être strictement positif.");
    if (patch.date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(patch.date)) throw new Error("Date au format AAAA-MM-JJ.");
    // Déplacer une ligne d'un déclarant à l'autre est permis, mais la société doit être contrôlée
    // contre les rattachements de l'employé FINAL — celui du patch s'il change, sinon l'actuel.
    const societe = patch.societe === undefined
      ? undefined
      : await societePour(ctx, patch.employeId ?? l.employeId, patch.societe);
    const propre = Object.fromEntries(Object.entries({ ...patch, societe, libelle, montant: patch.montant === undefined ? undefined : Math.round(patch.montant) }).filter(([, x]) => x !== undefined));
    await ctx.db.patch(ligneId, propre);
  },
});

export const supprimer = mutation({
  args: { ligneId: v.id("primesCharges") },
  handler: async (ctx, { ligneId }) => {
    await requireDroit(ctx, "/paie/primes", "faire");
    const l = await ctx.db.get(ligneId);
    if (!l) return;
    await verifierOuvert(ctx, l.periode);
    await ctx.db.delete(ligneId);
  },
});

// Calcul partagé des bulletins d'une période (utilisé par payroll et courrier).
// Mois ouvert → calcul réactif à la volée ; mois clôturé → snapshots figés. Forme de sortie unifiée.
import { QueryCtx, MutationCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { computeBulletin, SaisieMois, Bareme, LigneGain, LigneCotisation, Extras } from "./paie";

type Ctx = QueryCtx | MutationCtx;

export interface BulletinPeriode {
  employeId: Id<"employes">;
  matricule: string;
  nom: string;
  fonction?: string;
  cnps?: string;
  niu?: string;
  email?: string;
  societe: "SESAME" | "SOFINA" | "SGC";
  baremeId: Id<"baremes">;
  brut: number;
  totalRetenues: number;
  net: number;
  lignesGain: LigneGain[];
  cotisations: LigneCotisation[];
  statut?: "genere" | "envoye";
  envoyeLe?: string;
}

const SAISIE_VIDE = {
  joursTravailles: 30, absencesJours: 0, sanctions: 0, primesVariables: 0,
  transport: 0, heuresSup: 0, anciennete: 0, mutuellePct: 0, dettesSoins: 0, acompte: 0,
};

export function baremeFromDoc(b: Doc<"baremes">): Bareme {
  return {
    plafondCnps: b.plafondCnps, tauxPvidSal: b.tauxPvidSal, tauxPvidPat: b.tauxPvidPat,
    tauxPf: b.tauxPf, tauxAtmp: b.tauxAtmp, tauxCfcSal: b.tauxCfcSal, tauxCfcPat: b.tauxCfcPat,
    tauxFne: b.tauxFne, abattementIrppPct: b.abattementIrppPct, tauxCac: b.tauxCac,
    irppBrackets: b.irppBrackets,
  };
}

export async function baremePourPeriode(ctx: Ctx, periode: string) {
  const debut = `${periode}-01`;
  const baremes = await ctx.db.query("baremes").withIndex("by_effective").order("desc").collect();
  return baremes.find((b) => b.statut === "actif" && b.effectiveFrom <= debut) ?? null;
}

function identite(e: Doc<"employes">) {
  return { employeId: e._id, matricule: e.matricule, nom: e.nom, fonction: e.fonction, cnps: e.cnps, niu: e.niu, email: e.email, societe: e.societe };
}

// Lignes du registre "Primes & charges" d'un employé pour un mois, prêtes pour le moteur.
async function extrasPour(ctx: Ctx, employeId: Id<"employes">, periode: string): Promise<Extras> {
  const lignes = await ctx.db.query("primesCharges")
    .withIndex("by_employe_periode", (q) => q.eq("employeId", employeId).eq("periode", periode)).collect();
  return {
    primes: lignes.filter((l) => l.type === "prime").map((l) => ({ libelle: l.libelle, montant: l.montant })),
    charges: lignes.filter((l) => l.type === "charge").map((l) => ({ libelle: l.libelle, montant: l.montant })),
  };
}

export async function bulletinsPourPeriode(ctx: Ctx, periode: string): Promise<{
  cloture: boolean; baremeId: Id<"baremes"> | null; bulletins: BulletinPeriode[]; erreur?: string;
}> {
  const cloture = await ctx.db.query("cloturesPaie").withIndex("by_periode", (q) => q.eq("periode", periode)).unique();

  if (cloture) {
    const figes = await ctx.db.query("bulletins").withIndex("by_periode", (q) => q.eq("periode", periode)).collect();
    const bulletins: BulletinPeriode[] = [];
    for (const b of figes) {
      const e = await ctx.db.get(b.employeId);
      if (!e) continue;
      bulletins.push({
        ...identite(e), baremeId: b.baremeId, brut: b.brut, totalRetenues: b.totalRetenues, net: b.net,
        lignesGain: b.lignesGain, cotisations: b.cotisations, statut: b.statut, envoyeLe: b.envoyeLe,
      });
    }
    return { cloture: true, baremeId: cloture.baremeId, bulletins };
  }

  const baremeDoc = await baremePourPeriode(ctx, periode);
  if (!baremeDoc) return { cloture: false, baremeId: null, bulletins: [], erreur: "Aucun barème applicable à cette période." };
  const bareme = baremeFromDoc(baremeDoc);

  const employes = (await ctx.db.query("employes").collect()).filter((e) => e.actif);
  const bulletins: BulletinPeriode[] = [];
  for (const e of employes) {
    const saisie = await ctx.db.query("saisiesMensuelles")
      .withIndex("by_employe_periode", (q) => q.eq("employeId", e._id).eq("periode", periode)).unique();
    const s: SaisieMois = { ...SAISIE_VIDE, ...(saisie ?? {}), joursBase: e.joursBase ?? 30 };
    const extras = await extrasPour(ctx, e._id, periode);
    const calc = computeBulletin(e.salaireBrut, s, bareme, extras);
    bulletins.push({ ...identite(e), baremeId: baremeDoc._id, brut: calc.brut, totalRetenues: calc.totalRetenues, net: calc.net, lignesGain: calc.lignesGain, cotisations: calc.cotisations });
  }
  return { cloture: false, baremeId: baremeDoc._id, bulletins };
}

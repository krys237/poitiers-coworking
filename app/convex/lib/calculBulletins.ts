// Calcul partagé des bulletins d'une période (utilisé par payroll, courrier, archives, audit).
// Mois ouvert → calcul réactif à la volée ; mois clôturé → snapshots figés. Forme de sortie unifiée.
import { QueryCtx, MutationCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { computeBulletin, SaisieMois, Bareme, LigneGain, LigneCotisation, Extras, DetailsBulletin } from "./paie";
import { resumeMois, CONGES_PAR_MOIS_DEFAUT } from "./absences";
import { bornesPeriode } from "./periode";

type Ctx = QueryCtx | MutationCtx;

export interface BulletinPeriode {
  employeId: Id<"employes">;
  matricule: string;
  nom: string;
  fonction?: string;
  adresse?: string;
  cnps?: string;
  niu?: string;
  email?: string;
  categorie?: string;
  echelon?: string;
  departement?: string;
  dateDebut?: string;
  societe: "SESAME" | "SOFINA" | "SGC";
  salaireBrut: number;    // brut mensuel de référence (fiche employé)
  baremeId: Id<"baremes">;
  brut: number;
  totalRetenues: number;
  net: number;
  lignesGain: LigneGain[];
  cotisations: LigneCotisation[];
  details?: DetailsBulletin;
  periodeDu: string;
  periodeAu: string;
  datePaiement: string;
  statut?: "genere" | "envoye";
  envoyeLe?: string;
  valide: boolean;        // mois clôturé = bulletin validé
  valideLe?: string;
}

const SAISIE_VIDE = {
  joursTravailles: 30, absencesJours: 0, sanctions: 0, primesVariables: 0, transport: 0, primeAssiduite: 0, indemniteLogement: 0,
  heuresSup: 0, anciennete: 0, mutuellePct: 0, dettesSoins: 0, acompte: 0, absences: 0,
};

export function baremeFromDoc(b: Doc<"baremes">): Bareme {
  return {
    plafondCnps: b.plafondCnps, tauxPvidSal: b.tauxPvidSal, tauxPvidPat: b.tauxPvidPat,
    tauxPf: b.tauxPf, tauxAtmp: b.tauxAtmp, tauxCfcSal: b.tauxCfcSal, tauxCfcPat: b.tauxCfcPat,
    tauxFne: b.tauxFne, abattementIrppPct: b.abattementIrppPct, tauxCac: b.tauxCac,
    irppBrackets: b.irppBrackets,
    abattementIrppAnnuel: b.abattementIrppAnnuel ?? 500000, tdlActif: b.tdlActif ?? true, ravActif: b.ravActif ?? true,
  };
}

export async function baremePourPeriode(ctx: Ctx, periode: string) {
  const debut = `${periode}-01`;
  const baremes = await ctx.db.query("baremes").withIndex("by_effective").order("desc").collect();
  return baremes.find((b) => b.statut === "actif" && b.effectiveFrom <= debut) ?? null;
}

function identite(e: Doc<"employes">) {
  return {
    employeId: e._id, matricule: e.matricule, nom: e.nom, fonction: e.fonction, adresse: e.adresse, cnps: e.cnps, niu: e.niu,
    email: e.email, categorie: e.categorie, echelon: e.echelon, departement: undefined as string | undefined, dateDebut: e.dateDebut, societe: e.societe,
    salaireBrut: e.salaireBrut,
  };
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
  periodeDu: string; periodeAu: string; datePaiement: string;
}> {
  const params = await ctx.db.query("parametresEntreprise").first();
  const bornes = bornesPeriode(periode, params?.jourPaiement ?? 5);
  const cloture = await ctx.db.query("cloturesPaie").withIndex("by_periode", (q) => q.eq("periode", periode)).unique();

  if (cloture) {
    const figes = await ctx.db.query("bulletins").withIndex("by_periode", (q) => q.eq("periode", periode)).collect();
    const bulletins: BulletinPeriode[] = [];
    for (const b of figes) {
      const e = await ctx.db.get(b.employeId);
      if (!e) continue;
      bulletins.push({
        ...identite(e), baremeId: b.baremeId, brut: b.brut, totalRetenues: b.totalRetenues, net: b.net,
        lignesGain: b.lignesGain, cotisations: b.cotisations, details: b.details, statut: b.statut, envoyeLe: b.envoyeLe,
        periodeDu: bornes.du, periodeAu: bornes.au, datePaiement: bornes.paiement, valide: true, valideLe: cloture.closedAt,
      });
    }
    bulletins.sort((a, b) => a.nom.localeCompare(b.nom));
    return { cloture: true, baremeId: cloture.baremeId, bulletins, ...bornesTriplet(bornes) };
  }

  const baremeDoc = await baremePourPeriode(ctx, periode);
  if (!baremeDoc) return { cloture: false, baremeId: null, bulletins: [], erreur: "Aucun barème applicable à cette période.", ...bornesTriplet(bornes) };
  const bareme = baremeFromDoc(baremeDoc);
  const congesParMois = params?.congesParMois ?? CONGES_PAR_MOIS_DEFAUT;

  const employes = (await ctx.db.query("employes").collect()).filter((e) => e.actif).sort((a, b) => a.nom.localeCompare(b.nom));
  const bulletins: BulletinPeriode[] = [];
  for (const e of employes) {
    const saisie = await ctx.db.query("saisiesMensuelles")
      .withIndex("by_employe_periode", (q) => q.eq("employeId", e._id).eq("periode", periode)).unique();
    const evs = await ctx.db.query("absences").withIndex("by_employe", (q) => q.eq("employeId", e._id)).collect();
    const r = resumeMois({ employe: e, evenements: evs, periode, congesParMois });
    const s: SaisieMois = {
      ...SAISIE_VIDE, ...(saisie ?? {}),
      primeAssiduite: saisie?.primeAssiduite ?? 0, indemniteLogement: saisie?.indemniteLogement ?? 0, absences: saisie?.absences ?? 0,
      joursTravailles: saisie?.joursTravailles ?? r.joursTravailles, joursBase: e.joursBase ?? 30,
      congesPris: r.congesPrisMois, congesAcquis: r.congesAcquisCumul, congesRestants: r.soldeConges,
    };
    const extras = await extrasPour(ctx, e._id, periode);
    const calc = computeBulletin(e.salaireBrut, s, bareme, extras);
    bulletins.push({
      ...identite(e), baremeId: baremeDoc._id, brut: calc.brut, totalRetenues: calc.totalRetenues, net: calc.net,
      lignesGain: calc.lignesGain, cotisations: calc.cotisations, details: calc.details,
      periodeDu: bornes.du, periodeAu: bornes.au, datePaiement: bornes.paiement, valide: false,
    });
  }
  return { cloture: false, baremeId: baremeDoc._id, bulletins, ...bornesTriplet(bornes) };
}

const bornesTriplet = (b: { du: string; au: string; paiement: string }) => ({ periodeDu: b.du, periodeAu: b.au, datePaiement: b.paiement });

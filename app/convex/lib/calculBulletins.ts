// Calcul partagé des bulletins d'une période (utilisé par payroll, courrier, archives, audit, DIPE).
// Mois ouvert → calcul réactif à la volée ; mois clôturé → snapshots figés. Forme de sortie unifiée.
//
// Depuis le lot R2 bis, l'unité n'est plus l'employé mais le COUPLE (employé, société) : chaque
// société est un employeur distinct qui verse, déclare et cotise pour son propre compte (décision
// du 20/10/2026, « SESAME déclare de son côté »). Un employé rattaché à deux sociétés produit donc
// DEUX bulletins indépendants, chacun avec son propre plafond CNPS et ses propres tranches d'IRPP.
// Aucune consolidation : c'est la conséquence assumée de la déclaration séparée.
//
// Un employé rattaché à une seule société — le cas de tout l'effectif avant la migration — donne
// exactement le même bulletin qu'avant : même société, même salaire de base, même saisie.
import { QueryCtx, MutationCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { rubriquesPourPeriode } from "../rubriques";
import { CHAMP_SAISIE_VERS_RUBRIQUE } from "./rubriques";
import { computeBulletin, SaisieMois, Bareme, LigneGain, LigneCotisation, Extras, DetailsBulletin } from "./paie";
import {
  cleCouple, pourSociete, rattachementsEffectifs, societePrincipale, toutesPourSociete,
  type Rattachement, type Societe,
} from "./societes";
import { resumeMois, CONGES_PAR_MOIS_DEFAUT } from "./absences";
import { bornesPeriode } from "./periode";

type Ctx = QueryCtx | MutationCtx;

export interface BulletinPeriode {
  /**
   * Clé stable du couple (employé, société) : `<employeId>:<SOCIETE>`. C'est elle qui identifie une
   * ligne d'écran, un brouillon de saisie ou une sélection — `employeId` seul ne suffit plus, un
   * pluri-employé ayant plusieurs bulletins dans le même mois.
   */
  cle: string;
  employeId: Id<"employes">;
  matricule: string;
  /** Matricule du salarié chez CETTE société, quand elle le numérote autrement. */
  matriculeEmployeur?: string;
  nom: string;
  fonction?: string;
  adresse?: string;
  cnps?: string;
  niu?: string;
  email?: string;
  whatsapp?: string;
  categorie?: string;
  echelon?: string;
  departement?: string;
  dateDebut?: string;
  societe: Societe;
  /** Nombre de sociétés qui rémunèrent cet employé ce mois-là (1 = cas courant). */
  nbSocietes: number;
  salaireBase: number;    // salaire de base mensuel VERSÉ PAR CETTE SOCIÉTÉ
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
    // Corrections du lot R2 : laissées telles quelles, y compris absentes — une version de
    // barème antérieure rejoue ainsi exactement le calcul de son époque.
    transportTaxable: b.transportTaxable, atmpPlafonne: b.atmpPlafonne,
    cfcPatronalEtFneSurBrut: b.cfcPatronalEtFneSurBrut, seuilExoneration: b.seuilExoneration,
    groupeRisqueAtmp: b.groupeRisqueAtmp,
  };
}

export async function baremePourPeriode(ctx: Ctx, periode: string) {
  const debut = `${periode}-01`;
  const baremes = await ctx.db.query("baremes").withIndex("by_effective").order("desc").collect();
  return baremes.find((b) => b.statut === "actif" && b.effectiveFrom <= debut) ?? null;
}

/** Les rattachements effectifs d'un employé : lignes explicites, ou repli sur `employes.societe`. */
export async function rattachementsDe(ctx: Ctx, e: Doc<"employes">): Promise<Rattachement[]> {
  const lignes = await ctx.db.query("rattachements").withIndex("by_employe", (q) => q.eq("employeId", e._id)).collect();
  return rattachementsEffectifs(e, lignes);
}

/** La société porteuse de la fiche — clé de compatibilité des saisies et primes sans société. */
export async function societePrincipaleDe(ctx: Ctx, e: Doc<"employes">): Promise<Societe> {
  const lignes = await ctx.db.query("rattachements").withIndex("by_employe", (q) => q.eq("employeId", e._id)).collect();
  return societePrincipale(e, lignes);
}

/**
 * Identité d'une ligne de bulletin : la fiche pour ce qui est personnel (nom, adresse, WhatsApp),
 * le RATTACHEMENT pour ce qui appartient à l'employeur (matricule interne, CNPS, catégorie,
 * salaire de base). Deux employeurs n'immatriculent pas forcément le même salarié pareil.
 */
function identite(e: Doc<"employes">, r: Rattachement, nbSocietes: number) {
  return {
    cle: cleCouple(String(e._id), r.societe),
    employeId: e._id,
    matricule: e.matricule,
    matriculeEmployeur: r.matriculeEmployeur ?? e.matricule,
    nom: e.nom, fonction: e.fonction, adresse: e.adresse,
    cnps: r.cnpsEmployeur ?? e.cnps,
    niu: r.niuEmployeur ?? e.niu,
    email: e.email, whatsapp: e.whatsapp,
    categorie: r.categorie ?? e.categorie,
    echelon: r.echelon ?? e.echelon,
    departement: undefined as string | undefined,
    dateDebut: r.dateDebut ?? e.dateDebut,
    societe: r.societe,
    nbSocietes,
    salaireBase: r.salaireBase,
  };
}

/**
 * Lignes du registre « Primes & charges » d'un COUPLE (employé, société) pour un mois.
 * Une prime versée par SOFINA n'a rien à faire dans le bulletin de SGC : c'est un autre employeur.
 */
async function extrasPour(
  ctx: Ctx, employeId: Id<"employes">, periode: string, societe: Societe, principale: Societe,
): Promise<Extras> {
  const toutes = await ctx.db.query("primesCharges")
    .withIndex("by_employe_periode", (q) => q.eq("employeId", employeId).eq("periode", periode)).collect();
  const lignes = toutesPourSociete(toutes, societe, principale);
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
      // Le bulletin figé porte SA société : on retrouve le rattachement correspondant pour
      // restituer l'identité employeur de l'époque. Si le rattachement a disparu depuis, la fiche
      // sert de repli — un mois clôturé reste lisible quoi qu'il arrive à l'organisation.
      const rattachements = await rattachementsDe(ctx, e);
      const r = rattachements.find((x) => x.societe === b.societe) ?? { ...rattachements[0], societe: b.societe };
      bulletins.push({
        ...identite(e, r, rattachements.length),
        baremeId: b.baremeId, brut: b.brut, totalRetenues: b.totalRetenues, net: b.net,
        lignesGain: b.lignesGain, cotisations: b.cotisations, details: b.details, statut: b.statut, envoyeLe: b.envoyeLe,
        periodeDu: bornes.du, periodeAu: bornes.au, datePaiement: bornes.paiement, valide: true, valideLe: cloture.closedAt,
      });
    }
    bulletins.sort((a, b) => a.nom.localeCompare(b.nom) || a.societe.localeCompare(b.societe));
    return { cloture: true, baremeId: cloture.baremeId, bulletins, ...bornesTriplet(bornes) };
  }

  const baremeDoc = await baremePourPeriode(ctx, periode);
  if (!baremeDoc) return { cloture: false, baremeId: null, bulletins: [], erreur: "Aucun barème applicable à cette période.", ...bornesTriplet(bornes) };
  // Le catalogue de rubriques est résolu pour LA période, comme le barème : un mois clôturé ne
  // sera jamais recalculé avec une définition d'assiette plus récente.
  const bareme = { ...baremeFromDoc(baremeDoc), rubriques: await rubriquesPourPeriode(ctx, periode) };
  const congesParMois = params?.congesParMois ?? CONGES_PAR_MOIS_DEFAUT;

  const employes = (await ctx.db.query("employes").collect()).filter((e) => e.actif).sort((a, b) => a.nom.localeCompare(b.nom));
  const bulletins: BulletinPeriode[] = [];
  for (const e of employes) {
    const lignesRattachement = await ctx.db.query("rattachements").withIndex("by_employe", (q) => q.eq("employeId", e._id)).collect();
    const rattachements = rattachementsEffectifs(e, lignesRattachement);
    const principale = societePrincipale(e, lignesRattachement);
    // Les jours travaillés et les congés sont des faits de la PERSONNE, pas de l'employeur : le
    // même résumé mensuel sert aux deux bulletins. Ce que chaque société saisit à part, c'est ses
    // propres montants (salaire de base, primes, acompte…).
    const evs = await ctx.db.query("absences").withIndex("by_employe", (q) => q.eq("employeId", e._id)).collect();
    const r = resumeMois({ employe: e, evenements: evs, periode, congesParMois });
    const saisies = await ctx.db.query("saisiesMensuelles")
      .withIndex("by_employe_periode", (q) => q.eq("employeId", e._id).eq("periode", periode)).collect();

    for (const rat of rattachements) {
      const saisie = pourSociete(saisies, rat.societe, principale);
      const s: SaisieMois = {
        ...SAISIE_VIDE, ...(saisie ?? {}),
        primeAssiduite: saisie?.primeAssiduite ?? 0, indemniteLogement: saisie?.indemniteLogement ?? 0, absences: saisie?.absences ?? 0,
        joursTravailles: saisie?.joursTravailles ?? r.joursTravailles, joursBase: rat.joursBase,
        congesPris: r.congesPrisMois, congesAcquis: r.congesAcquisCumul, congesRestants: r.soldeConges,
      };
      // Les primes nommées du DIPE sont saisies dans des colonnes dédiées de `saisiesMensuelles`
      // et traduites en montants par code de rubrique, seule forme comprise par les assiettes.
      const rubriquesSaisies: Record<string, number> = {};
      for (const [champ, code] of Object.entries(CHAMP_SAISIE_VERS_RUBRIQUE)) {
        // Les quatre champs historiques sont déjà portés par `SaisieMois` : ne pas les compter deux fois.
        if (champ in SAISIE_VIDE || champ === "primeAssiduite" || champ === "indemniteLogement") continue;
        const montant = (saisie as Record<string, unknown> | null | undefined)?.[champ];
        if (typeof montant === "number" && montant) rubriquesSaisies[code] = montant;
      }
      const extras = { ...(await extrasPour(ctx, e._id, periode, rat.societe, principale)), rubriques: rubriquesSaisies };
      // Chaque couple appelle le moteur SÉPARÉMENT : plafond CNPS et tranches d'IRPP par employeur.
      const calc = computeBulletin(rat.salaireBase, s, bareme, extras);
      bulletins.push({
        ...identite(e, rat, rattachements.length),
        baremeId: baremeDoc._id, brut: calc.brut, totalRetenues: calc.totalRetenues, net: calc.net,
        lignesGain: calc.lignesGain, cotisations: calc.cotisations, details: calc.details,
        periodeDu: bornes.du, periodeAu: bornes.au, datePaiement: bornes.paiement, valide: false,
      });
    }
  }
  return { cloture: false, baremeId: baremeDoc._id, bulletins, ...bornesTriplet(bornes) };
}

const bornesTriplet = (b: { du: string; au: string; paiement: string }) => ({ periodeDu: b.du, periodeAu: b.au, datePaiement: b.paiement });

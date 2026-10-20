// DIPE : mise en forme, récapitulatif, export et rapport d'écart. `npm run test:dipe`
import { computeBulletin, BAREME_DEFAUT } from "../convex/lib/paie.ts";
import type { SaisieMois } from "../convex/lib/paie.ts";
import { RUBRIQUES_DEFAUT } from "../convex/lib/rubriques.ts";
import {
  COLONNES_CALCULEES,
  ENTETES_RECONNUES,
  EXPLICATIONS,
  comparerDipe,
  exportCsvDipe,
  ligneDipe,
  recapitulatifDipe,
  type LigneDipe,
  type SourceBulletin,
} from "../convex/lib/dipe.ts";

let echecs = 0;
const check = (nom: string, cond: boolean, d?: unknown) => {
  if (cond) console.log("  ok  " + nom);
  else { console.error("  KO  " + nom, d ?? ""); echecs++; }
};
const titre = (s: string) => console.log(`\n— ${s}`);

const vide: SaisieMois = {
  joursTravailles: 30, joursBase: 30, sanctions: 0, primesVariables: 0, transport: 0,
  primeAssiduite: 0, indemniteLogement: 0, heuresSup: 0, anciennete: 0, mutuellePct: 0,
  dettesSoins: 0, acompte: 0, absences: 0, congesPris: 0, congesAcquis: 0,
};

const ret = (b: ReturnType<typeof computeBulletin>, c: string) =>
  b.cotisations.find((x) => x.code === c)?.retenue ?? 0;
const pat = (b: ReturnType<typeof computeBulletin>, c: string) =>
  b.cotisations.find((x) => x.code === c)?.chargePatronale ?? 0;

/** Construit une ligne de DIPE depuis un bulletin calculé, comme le fait `convex/dipe.ts`. */
function faireLigne(
  no: number,
  matricule: string,
  brutRef: number,
  s: Partial<SaisieMois>,
  extras: Parameters<typeof computeBulletin>[3] = {},
): LigneDipe {
  const b = computeBulletin(brutRef, { ...vide, ...s }, BAREME_DEFAUT, extras);
  const gains: Record<string, number> = {};
  for (const g of b.lignesGain) if (g.gain) gains[g.code] = (gains[g.code] ?? 0) + g.gain;
  const src: SourceBulletin = {
    matricule, nom: `Employé ${matricule}`, societe: "SGC",
    joursTravailles: b.details.joursTravailles, gains, assiettes: b.details.assiettes!,
    irpp: b.details.irpp, cac: b.details.cac,
    cfcSalarie: ret(b, "44724"), tdl: b.details.tdl, rav: b.details.rav,
    pvidSalarie: b.details.cnpsSalarie,
    cfcPatronal: pat(b, "64132"), fne: pat(b, "64131"),
    pvidPatronal: pat(b, "66412"), prestationsFamiliales: pat(b, "66411"), atmp: pat(b, "66413"),
  };
  return ligneDipe(src, no);
}

// ===========================================================================
titre("Ligne de DIPE : la ligne 9 de son classeur, reprise de bout en bout");
const L = faireLigne(1, "E001", 110000,
  { anciennete: 38655, transport: 2550, primeAssiduite: 2500, indemniteLogement: 2200 },
  { rubriques: { "6632": 5000, "6633": 2500 } });

check("salaire brut = 163 405", L.salaireBrut === 163405, L.salaireBrut);
check("salaire taxable = 155 905", L.salaireTaxable === 155905, L.salaireTaxable);
check("cotisable plafonné = 153 355", L.salaireCotisablePlafonne === 153355, L.salaireCotisablePlafonne);
check("total IRPP = IRPP + CAC", L.totalIrpp === L.irpp + L.cac, { irpp: L.irpp, cac: L.cac });
check("total fiscal SALARIAL = IRPP + CAC + CFC sal + TDL + RAV",
  L.totalFiscalSalarial === L.irpp + L.cac + L.cfcSalarie + L.tdl + L.rav, L.totalFiscalSalarial);
check("total fiscal PATRONAL = CFC pat + FNE", L.totalFiscalPatronal === L.cfcPatronal + L.fne);
check("total social patronal = PVID pat + PF + AT/MP",
  L.totalSocialPatronal === L.pvidPatronal + L.prestationsFamiliales + L.atmp);

titre("Le défaut de son classeur qui n'est PAS reproduit");
// Sa colonne AJ valait SUM(AD:AI) = salarial + patronal mélangés. Vérifions qu'AUCUN champ de
// notre ligne ne porte cette somme : le total sans signification comptable n'existe plus.
const melange = L.totalFiscalSalarial + L.totalFiscalPatronal;
check("aucun champ ne porte la somme salarial + patronal de sa colonne AJ",
  !Object.values(L).some((v) => typeof v === "number" && v === melange), { melange });
check("les charges patronales incluent bien les prestations familiales et l'AT/MP",
  L.totalSocialPatronal > L.pvidPatronal, L.totalSocialPatronal);

titre("Net du DIPE ≠ net du bulletin de paie (décision E7)");
const avecRetenues = computeBulletin(
  110000,
  { ...vide, anciennete: 38655, transport: 2550, primeAssiduite: 2500, indemniteLogement: 2200, acompte: 20000, sanctions: 5000 },
  BAREME_DEFAUT,
  { rubriques: { "6632": 5000, "6633": 2500 } },
);
check("le net du DIPE ne déduit que le fiscal et le social",
  L.netDipe === L.salaireBrut - L.totalRetenuSalarie, { net: L.netDipe });
check("le net du bulletin déduit en plus acompte et sanctions",
  avecRetenues.net === L.netDipe - 25000, { bulletin: avecRetenues.net, dipe: L.netDipe });
check("l'écart vaut exactement les retenues non fiscales", L.netDipe - avecRetenues.net === 25000);

// ===========================================================================
titre("Récapitulatif : deux destinataires, jamais additionnés");
const lignes = [
  L,
  faireLigne(2, "E002", 300000, { transport: 20000 }),
  faireLigne(3, "E003", 55000, {}),               // sous le plancher de 62 000
  faireLigne(4, "E004", 1_200_000, { indemniteLogement: 200000 }), // au-delà du plafond CNPS
];
const R = recapitulatifDipe(lignes);
check("effectif = 4", R.effectif === 4);
check("masse brute = somme des bruts", R.masseBrute === lignes.reduce((t, l) => t + l.salaireBrut, 0));
check("6 lignes de retenues salariales", R.retenuesSalariales.length === 6);
check("5 lignes de charges patronales", R.chargesPatronales.length === 5);
check("total retenues salariales = somme de ses lignes",
  R.totalRetenuesSalariales === R.retenuesSalariales.reduce((t, x) => t + x.montant, 0));
check("total impôts = IRPP + CAC + CFC (sal + pat) + TDL + RAV + FNE",
  R.totalImpots === lignes.reduce((t, l) => t + l.irpp + l.cac + l.cfcSalarie + l.tdl + l.rav + l.cfcPatronal + l.fne, 0),
  R.totalImpots);
check("total CNPS = PVID (sal + pat) + PF + AT/MP",
  R.totalCnps === lignes.reduce((t, l) => t + l.pvidSalarie + l.pvidPatronal + l.prestationsFamiliales + l.atmp, 0));
check("impôts et CNPS ne sont pas confondus", R.totalImpots !== R.totalCnps && R.totalImpots > 0 && R.totalCnps > 0);
check("coût employeur = brut + charges patronales",
  R.coutEmployeur === R.masseBrute + R.totalChargesPatronales, { cout: R.coutEmployeur });
check("aucun « −1 » parasite : les totaux sont des sommes exactes",
  R.netAPayer === lignes.reduce((t, l) => t + l.netDipe, 0));

titre("Le salarié exonéré reste dans le DIPE, avec ses charges patronales");
const exo = lignes[2];
check("retenues fiscales salariales nulles", exo.totalFiscalSalarial === 0, exo.totalFiscalSalarial);
check("mais charges patronales dues", exo.totalSocialPatronal > 0, exo.totalSocialPatronal);
check("et PVID salariale retenue", exo.pvidSalarie > 0);

// ===========================================================================
titre("Export CSV");
const csv = exportCsvDipe(lignes, RUBRIQUES_DEFAUT);
const rangees = csv.split("\n");
check("une ligne d'en-tête, 4 lignes de données, une ligne de totaux", rangees.length === 6, rangees.length);
check("séparateur point-virgule", rangees[0].includes(";"));
check("les colonnes de gain suivent le catalogue de rubriques",
  rangees[0].includes("Prime de transport") && rangees[0].includes("Prime de salissure"));
check("les colonnes calculées sont présentes",
  COLONNES_CALCULEES.every((c) => rangees[0].includes(c.entete)));
check("la ligne de totaux porte l'effectif", rangees[5].includes("4 salarié(s)"));
check("le total du brut couvre TOUTES les lignes (sa somme en oubliait)",
  rangees[5].split(";").includes(String(R.masseBrute)), R.masseBrute);
// Un libellé contenant le séparateur doit être mis entre guillemets, sinon le CSV se décale.
const piege = exportCsvDipe(lignes, RUBRIQUES_DEFAUT.map((r) =>
  r.code === "66121" ? { ...r, libelle: 'Transport; "domicile"' } : r));
const piegeRangees = piege.split("\n");
check("un libellé contenant le séparateur est entre guillemets",
  piegeRangees[0].includes('"Transport; ""domicile"""'), piegeRangees[0].slice(0, 160));
check("le CSV piégé garde le même nombre de colonnes que l'original",
  piegeRangees[1].split(";").length === rangees[1].split(";").length);

// ===========================================================================
titre("Rapport d'écart : chaque écart est TYPÉ");
check("chaque code d'écart a une explication", Object.keys(EXPLICATIONS).length === 12);
check("l'explication de la méthode IRPP cite les seuils de son tableur",
  EXPLICATIONS.irpp_methode.includes("310 000"));
check("l'explication du transport cite la décision", EXPLICATIONS.assiette_transport.includes("20/10/2026"));

// Son fichier pour E001 : transport détaxé (donc taxable 153 705) et IRPP linéarisé.
const comp = comparerDipe(lignes, {
  E001: { salaireBrut: 163405, salaireTaxable: 153705, salaireCotisablePlafonne: 153355, irpp: 6103 },
  E002: { salaireTaxable: 320000, tdl: 2000, rav: 4550 },
});
check("2 lignes comparées, 2 absentes", comp.compares === 2 && comp.absents.length === 2, comp);
check("l'écart d'assiette taxable est typé « assiette_transport »",
  comp.ecarts.some((e) => e.matricule === "E001" && e.colonne === "Salaire taxable" && e.code === "assiette_transport"),
  comp.ecarts);
check("le brut identique ne produit aucun écart",
  !comp.ecarts.some((e) => e.matricule === "E001" && e.colonne === "SALAIRE BRUT"));
check("le cotisable identique ne produit aucun écart",
  !comp.ecarts.some((e) => e.matricule === "E001" && e.colonne === "Salaire cotisable plafonné"));
check("les écarts sont triés par montant décroissant",
  comp.ecarts.every((e, i) => i === 0 || Math.abs(comp.ecarts[i - 1].difference) >= Math.abs(e.difference)));
check("le décompte par code est fourni", Object.values(comp.parCode).reduce((t, n) => t + n, 0) === comp.ecarts.length);

titre("Tolérance d'arrondi");
const tol = comparerDipe([L], { E001: { irpp: L.irpp - 1, tdl: L.tdl } });
check("un écart d'un franc est absorbé", !tol.ecarts.some((e) => e.colonne === "IRPP principal"), tol.ecarts);
const tol2 = comparerDipe([L], { E001: { irpp: L.irpp - 2 } });
check("un écart de deux francs est classé en arrondi",
  tol2.ecarts[0]?.code === "arrondi", tol2.ecarts);
const tol3 = comparerDipe([L], { E001: { irpp: L.irpp - 5000 } });
check("un écart important est classé selon la règle de la colonne",
  tol3.ecarts[0]?.code === "irpp_methode", tol3.ecarts);
check("une valeur absente n'est pas comparée",
  comparerDipe([L], { E001: {} }).ecarts.length === 0);
check("une valeur NaN n'est pas comparée",
  comparerDipe([L], { E001: { irpp: NaN } }).ecarts.length === 0);

titre("Correspondance des en-têtes de son classeur");
check("« SALAIRE BRUTE » (sa faute de frappe) est reconnue", ENTETES_RECONNUES["salaire_brute"] === "salaireBrut");
check("« Salaire de Référence » renvoie au brut intermédiaire",
  ENTETES_RECONNUES["salaire_de_reference"] === "salaireBrutIntermediaire");
check("« Logement à CONSIDERER » renvoie aux avantages retenus",
  ENTETES_RECONNUES["logement_a_considerer"] === "avantagesRetenus");
check("toutes les cibles existent dans la ligne de DIPE",
  Object.values(ENTETES_RECONNUES).every((k) => k in L), Object.values(ENTETES_RECONNUES).filter((k) => !(k in L)));

if (echecs) { console.error(`\n${echecs} test(s) en échec`); process.exit(1); }
else console.log("\nTous les tests passent.");

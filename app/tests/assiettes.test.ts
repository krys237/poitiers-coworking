// Les QUATRE ASSIETTES et les corrections fiscales du lot R2 : `npm run test:assiettes`.
//
// Le test d'acceptation est la **ligne 9 du DIPE d'août 2026** de la responsable RH, reproduite
// colonne par colonne. Aucune donnée nominative n'est utilisée : seulement les montants.
import { computeBulletin, BAREME_DEFAUT, TAUX_ATMP, baremeInf, TDL_BAREME } from "../convex/lib/paie.ts";
import type { Bareme, SaisieMois } from "../convex/lib/paie.ts";
import {
  RUBRIQUES_DEFAUT,
  calculerAssiettes,
  rubriquesApplicables,
  validerRubriques,
  type Rubrique,
} from "../convex/lib/rubriques.ts";

let echecs = 0;
const check = (nom: string, cond: boolean, d?: unknown) => {
  if (cond) console.log("  ok  " + nom);
  else { console.error("  KO  " + nom, d ?? ""); echecs++; }
};
const titre = (s: string) => console.log(`\n— ${s}`);
/** Tolérance d'un franc : son tableur calcule en flottants, le moteur arrondit à l'entier. */
const presque = (a: number, b: number) => Math.abs(a - b) <= 1;

const vide: SaisieMois = {
  joursTravailles: 30, joursBase: 30, sanctions: 0, primesVariables: 0, transport: 0,
  primeAssiduite: 0, indemniteLogement: 0, heuresSup: 0, anciennete: 0, mutuellePct: 0,
  dettesSoins: 0, acompte: 0, absences: 0, congesPris: 0, congesAcquis: 0,
};

// ===========================================================================
titre("Jeu d'acceptation : ligne 9 du DIPE d'août 2026, colonne par colonne");
// Salaire de base 110 000 · ancienneté 38 655 · transport 2 550 · assiduité 2 500
// · logement 2 200 · salissure 5 000 · panier 2 500
const d = computeBulletin(
  110000,
  { ...vide, anciennete: 38655, transport: 2550, primeAssiduite: 2500, indemniteLogement: 2200 },
  BAREME_DEFAUT,
  { rubriques: { "6632": 5000, "6633": 2500 } }, // salissure, panier
);
const A = d.details.assiettes!;

// --- Les quatre assiettes : attendues EXACTES ---
check("V — salaire brut = 163 405", A.brut === 163405, A.brut);
check("W — salaire brut intermédiaire = 153 705", A.brutIntermediaire === 153705, A.brutIntermediaire);
check("X — évaluation de l'avantage logement = 15 % × W = 23 056", A.avantagesEvalues === 23056, A.avantagesEvalues);
check("Y — logement retenu = min(forfait ; indemnité) = 2 200", A.avantagesRetenus === 2200, A.avantagesRetenus);
check("Z — salaire taxable = W + Y = 155 905", A.taxable === 155905, A.taxable);
check("AA — salaire cotisable plafonné = 153 355", A.cotisablePlafonne === 153355, A.cotisablePlafonne);

// --- Ce que les assiettes impliquent, et qui est tout l'enjeu ---
check("le transport (2 550) est DANS le taxable", A.taxable === A.brutIntermediaire + A.avantagesRetenus && A.brutIntermediaire === 110000 + 38655 + 2550 + 2500);
check("… et HORS du cotisable", A.cotisable === 110000 + 38655 + 2500 + 2200, A.cotisable);
check("le logement (2 200) est cotisable EN ENTIER", A.cotisable - (110000 + 38655 + 2500) === 2200);
check("salissure et panier sont dans le brut mais dans aucune autre assiette", A.brut - A.brutIntermediaire - 2200 === 7500);

// --- Les retenues et charges, à la franc près ---
check("AB — IRPP principal ≈ 6 103 (elle : 6 102,56)", presque(d.details.irpp, 6103), d.details.irpp);
check("AC — CAC ≈ 610", presque(d.details.cac, 610), d.details.cac);
check("AD — total IRPP ≈ 6 713", presque(d.details.irpp + d.details.cac, 6713));
check("AE — CFC salarial 1 % de Z ≈ 1 559", presque(cot(d, "44724"), 1559), cot(d, "44724"));
check("AF — CFC patronal 1,5 % du BRUT ≈ 2 451", presque(pat(d, "64132"), 2451), pat(d, "64132"));
check("AG — TDL sur le salaire de base = 750", d.details.tdl === 750, d.details.tdl);
check("AH — FNE 1 % du BRUT ≈ 1 634", presque(pat(d, "64131"), 1634), pat(d, "64131"));
check("AI — RAV sur Z = 1 950", d.details.rav === 1950, d.details.rav);
check("AL — PVID salarié 4,2 % de AA ≈ 6 441", presque(d.details.cnpsSalarie, 6441), d.details.cnpsSalarie);
check("AO — PVID patronal 4,2 % de AA ≈ 6 441", presque(pat(d, "66412"), 6441), pat(d, "66412"));
check("AP — prestations familiales 7 % de AA ≈ 10 735", presque(pat(d, "66411"), 10735), pat(d, "66411"));
check("AQ — AT/MP 1,75 % ≈ 2 684", presque(pat(d, "66413"), 2684), pat(d, "66413"));
check("AN — cotisations salariales ≈ 17 413 (elle : 17 412,77)", presque(d.chargesSalariales, 17413), d.chargesSalariales);
check("AM — net à payer ≈ 145 992 (elle : 145 992,23)", presque(d.net, 145992), d.net);

// ===========================================================================
titre("C1 — le transport entre dans l'assiette taxable (tranché le 20/10/2026)");
const avec = computeBulletin(150000, { ...vide, transport: 15000 }, BAREME_DEFAUT);
// Barème d'AVANT le lot R2 : aucun interrupteur de correction (cf. tests/paie.test.ts).
const LEGACY: Bareme = {
  ...BAREME_DEFAUT,
  transportTaxable: undefined,
  atmpPlafonne: undefined,
  cfcPatronalEtFneSurBrut: undefined,
  seuilExoneration: undefined,
};
const sans = computeBulletin(150000, { ...vide, transport: 15000 }, LEGACY);
check("taxable avec correction = 165 000", avec.details.brutTaxable === 165000, avec.details.brutTaxable);
check("taxable au barème d'époque = 150 000", sans.details.brutTaxable === 150000, sans.details.brutTaxable);
check("le transport reste hors du cotisable dans les deux cas", avec.details.baseCnps === 150000 && sans.details.baseCnps === 150000);
check("l'IRPP augmente avec la correction", avec.details.irpp > sans.details.irpp, { avec: avec.details.irpp, sans: sans.details.irpp });
check("IRPP corrigé = 6 753", avec.details.irpp === 6753, avec.details.irpp);

titre("C2 — assiette taxable et assiette cotisable sont distinctes");
check("Z ≠ AA dès qu'il y a du transport ou du logement", avec.details.brutTaxable !== avec.details.baseCnps);

titre("C3 — l'assiette AT/MP n'est pas plafonnée (la loi), interrupteur pour la pratique");
const cadre = computeBulletin(1_200_000, vide, BAREME_DEFAUT);
const cadrePlaf = computeBulletin(1_200_000, vide, { ...BAREME_DEFAUT, atmpPlafonne: true });
check("PVID reste plafonnée à 750 000", cadre.details.baseCnps === 750000);
check("AT/MP porte sur l'assiette réelle (1 200 000)", pat(cadre, "66413") === Math.round(1_200_000 * 0.0175), pat(cadre, "66413"));
check("avec l'interrupteur, AT/MP retombe sur 750 000", pat(cadrePlaf, "66413") === Math.round(750_000 * 0.0175));
check("l'écart de cotisation AT/MP est réel", pat(cadre, "66413") > pat(cadrePlaf, "66413"));

titre("C4 — CFC patronal et FNE sur le salaire brut");
check("CFC patronal 1,5 % du brut (165 000)", pat(avec, "64132") === Math.round(165000 * 0.015), pat(avec, "64132"));
check("FNE 1 % du brut (165 000)", pat(avec, "64131") === Math.round(165000 * 0.01), pat(avec, "64131"));
check("au barème d'époque, ils portaient sur le taxable (150 000)", pat(sans, "64132") === Math.round(150000 * 0.015));

titre("C5 — la TDL est plafonnée à 2 500 FCFA par mois");
check("500 001 → 2 500", baremeInf(TDL_BAREME, 500001) === 2500);
check("un salaire de base de 3 000 000 reste à 2 500", baremeInf(TDL_BAREME, 3_000_000) === 2500);
check("l'ancien barème montait à 4 500 : plus aucune valeur au-dessus de 2 500", TDL_BAREME.every(([, m]) => m <= 2500));

titre("C6 — le plancher de 62 000 ne vaut QUE pour les retenues salariales");
const petit = computeBulletin(55000, vide, BAREME_DEFAUT);
check("taxable 55 000 < 62 000 → exonéré", petit.details.exonereSalarial === true);
check("IRPP, CAC, TDL, RAV et CFC salarial à zéro", petit.details.irpp === 0 && petit.details.cac === 0 && petit.details.tdl === 0 && petit.details.rav === 0 && cot(petit, "44724") === 0);
check("la CNPS salariale reste due (ce n'est pas une retenue fiscale)", petit.details.cnpsSalarie === Math.round(55000 * 0.042), petit.details.cnpsSalarie);
check("« l'employeur a toujours un montant à payer » : charges patronales > 0", petit.chargesPatronales > 0, petit.chargesPatronales);
check("prestations familiales dues malgré l'exonération", pat(petit, "66411") === Math.round(55000 * 0.07));
const juste = computeBulletin(62000, vide, BAREME_DEFAUT);
check("à 62 000 pile, le salarié n'est plus exonéré", juste.details.exonereSalarial === false && juste.details.tdl === 250, juste.details);

titre("C7 — avantages en nature évalués au forfait");
// Logement 200 000 déclaré, forfait 15 % de 1 000 000 = 150 000 → on retient le forfait.
const avn = computeBulletin(1_000_000, { ...vide, indemniteLogement: 200000 }, BAREME_DEFAUT);
check("le forfait (150 000) l'emporte quand l'indemnité le dépasse", avn.details.assiettes!.avantagesRetenus === 150000, avn.details.assiettes!.avantagesRetenus);
check("le logement reste cotisable pour son montant versé", avn.details.assiettes!.cotisable === 1_200_000, avn.details.assiettes!.cotisable);
const avnLibre = computeBulletin(
  1_000_000,
  { ...vide, indemniteLogement: 200000 },
  { ...BAREME_DEFAUT, rubriques: RUBRIQUES_DEFAUT.map((r) => r.code === "6631" ? { ...r, avantageNature: { tauxForfait: 15, plafonnerAuForfait: false } } : r) },
);
check("sans plafonnement au forfait, l'indemnité est taxée en entier", avnLibre.details.assiettes!.avantagesRetenus === 200000);

titre("C8 — groupe de risque AT/MP");
check("les trois taux légaux", TAUX_ATMP.A === 1.75 && TAUX_ATMP.B === 2.5 && TAUX_ATMP.C === 5);
const groupeB = computeBulletin(300000, vide, { ...BAREME_DEFAUT, groupeRisqueAtmp: "B" });
check("groupe B → 2,5 %", pat(groupeB, "66413") === Math.round(300000 * 0.025), pat(groupeB, "66413"));
const groupeC = computeBulletin(300000, vide, { ...BAREME_DEFAUT, groupeRisqueAtmp: "C" });
check("groupe C → 5 %", pat(groupeC, "66413") === Math.round(300000 * 0.05));
check("sans groupe renseigné, on garde tauxAtmp du barème", pat(computeBulletin(300000, vide, BAREME_DEFAUT), "66413") === Math.round(300000 * 0.0175));

titre("C9 — exonération « jeunes de moins de 35 ans » (LF 2026)");
const jeune = computeBulletin(300000, vide, BAREME_DEFAUT, { exonereJeune: true });
check("les charges fiscales tombent à zéro", jeune.details.irpp === 0 && jeune.details.tdl === 0 && jeune.details.rav === 0 && cot(jeune, "44724") === 0);
check("CFC patronal et FNE tombent à zéro", pat(jeune, "64132") === 0 && pat(jeune, "64131") === 0);
check("mais les cotisations SOCIALES CNPS restent dues", jeune.details.cnpsSalarie > 0 && pat(jeune, "66411") > 0 && pat(jeune, "66412") > 0 && pat(jeune, "66413") > 0);

// ===========================================================================
titre("Catalogue de rubriques");
check("17 rubriques nommées + la ligne libre", RUBRIQUES_DEFAUT.length === 18, RUBRIQUES_DEFAUT.length);
check("toutes les rubriques sont dans le brut", RUBRIQUES_DEFAUT.every((r) => r.dansBrut));
check("le transport est taxable mais non cotisable", rub("66121").dansBrutIntermediaire && !rub("66121").dansCotisable);
check("le logement est cotisable mais hors du brut intermédiaire", rub("6631").dansCotisable && !rub("6631").dansBrutIntermediaire);
check("le logement porte le forfait de 15 %", rub("6631").avantageNature?.tauxForfait === 15);
check("panier, salissure, lait, représentation, véhicule, outillage : ni taxables ni cotisables",
  ["6632", "6633", "6634", "6635", "6636", "6637"].every((c) => !rub(c).dansBrutIntermediaire && !rub(c).dansCotisable));
check("l'allocation du congé précédent sort de l'assiette de l'allocation (art. 73)", !rub("6613").dansAllocConge);
check("le transport sort aussi de l'assiette de l'allocation (art. 73)", !rub("66121").dansAllocConge);
check("le catalogue par défaut est valide", validerRubriques(RUBRIQUES_DEFAUT).length === 0, validerRubriques(RUBRIQUES_DEFAUT));

titre("Garde-fous du paramétrage");
check("un code en double est refusé",
  validerRubriques([rub("66111"), { ...rub("66122"), code: "66111" }]).some((e) => e.includes("double")));
check("taxable hors du brut est refusé",
  validerRubriques([{ ...rub("66111"), dansBrut: false }]).some((e) => e.includes("incohérent")));
check("un taux forfaitaire hors bornes est refusé",
  validerRubriques([{ ...rub("6631"), avantageNature: { tauxForfait: 150, plafonnerAuForfait: true } }]).some((e) => e.includes("0–100")));
check("un avantage en nature dans le brut intermédiaire est refusé",
  validerRubriques([{ ...rub("6631"), dansBrutIntermediaire: true }]).some((e) => e.includes("forfait")));

titre("Rubriques DATÉES comme le barème (décision E4)");
const v1: Rubrique[] = RUBRIQUES_DEFAUT;
const v2: Rubrique[] = RUBRIQUES_DEFAUT.map((r) => (r.code === "66121" ? { ...r, dansCotisable: true } : r));
const versions = [
  { effectiveFrom: "2024-01-01", rubriques: v1 },
  { effectiveFrom: "2026-11-01", rubriques: v2 },
];
check("un mois antérieur utilise la version d'époque", rubriquesApplicables(versions, "2026-10") === v1);
check("un mois postérieur utilise la nouvelle version", rubriquesApplicables(versions, "2026-11") === v2);
check("sans aucune version, on retombe sur le catalogue par défaut", rubriquesApplicables([], "2026-10") === RUBRIQUES_DEFAUT);

titre("Rubrique inconnue : signalée, jamais versée en silence dans le brut");
const inc = calculerAssiettes({ "66111": 100000, "ZZZ": 50000 }, RUBRIQUES_DEFAUT, { plafondCnps: 750000 });
check("le montant inconnu n'entre dans aucune assiette", inc.brut === 100000, inc.brut);
check("et le code est remonté", inc.inconnues.join() === "ZZZ", inc.inconnues);

titre("Plafond CNPS");
const haut = calculerAssiettes({ "66111": 900000 }, RUBRIQUES_DEFAUT, { plafondCnps: 750000 });
check("cotisable plafonné à 750 000", haut.cotisablePlafonne === 750000);
check("cotisable réel conservé pour l'AT/MP", haut.cotisable === 900000 && haut.cotisableAtmp === 900000);

// ---------------------------------------------------------------------------
function rub(code: string): Rubrique {
  const r = RUBRIQUES_DEFAUT.find((x) => x.code === code);
  if (!r) throw new Error(`rubrique ${code} absente du catalogue`);
  return r;
}
function cot(b: ReturnType<typeof computeBulletin>, code: string) {
  return b.cotisations.find((c) => c.code === code)?.retenue ?? -1;
}
function pat(b: ReturnType<typeof computeBulletin>, code: string) {
  return b.cotisations.find((c) => c.code === code)?.chargePatronale ?? -1;
}

if (echecs) { console.error(`\n${echecs} test(s) en échec`); process.exit(1); }
else console.log("\nTous les tests passent.");

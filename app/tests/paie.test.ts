// Test de sanité du moteur de paie (sans framework) : `npm run test:paie`.
// Hors du dossier convex/ : Convex bundle tout ce dossier comme fonctions serveur.
import { computeBulletin, computeIrpp, BAREME_DEFAUT, TDL_BAREME, RAV_BAREME, bareme } from "../convex/lib/paie.ts";
import type { SaisieMois } from "../convex/lib/paie.ts";

let echecs = 0;
function check(nom: string, cond: boolean, detail?: unknown) {
  if (cond) console.log(`  ok  ${nom}`);
  else { console.error(`  KO  ${nom}`, detail ?? ""); echecs++; }
}
const vide: SaisieMois = {
  joursTravailles: 30, joursBase: 30, sanctions: 0, primesVariables: 0, transport: 0, primeAssiduite: 0, indemniteLogement: 0,
  heuresSup: 0, anciennete: 0, mutuellePct: 0, dettesSoins: 0, acompte: 0, absences: 0, congesPris: 0, congesAcquis: 0,
};

// 1. Cas de référence (application PAIE du directeur) : TARGNE, brut 150 000, transport 15 000, 30 jours, TDL+RAV.
const t = computeBulletin(150000, { ...vide, transport: 15000, congesAcquis: 9 }, BAREME_DEFAUT);
console.log("Référence 150 000 + transport 15 000 :", { brut: t.brut, chargesSal: t.chargesSalariales, retenues: t.totalRetenues, net: t.net });
check("journalier = brut ÷ 30", t.details.salaireJournalier === 5000);
check("Total brut = base + transport", t.brut === 165000, t.brut);
check("base taxable = brut − transport (exonéré)", t.details.brutTaxable === 150000, t.details.brutTaxable);
check("CNPS salarié 4,2 % de la base plafonnée", t.details.cnpsSalarie === 6300, t.details.cnpsSalarie);
check("IRPP annuel : (150 000×0,7 − 6 300 − 41 667)×12 = 684 400 → 10 % ÷ 12 = 5 703", t.details.irpp === 5703 && t.details.cac === 570, t.details);
check("TDL barème sur salaire de base 150 000 → 1 000", t.details.tdl === 1000, t.details.tdl);
check("RAV barème sur base taxable 150 000 → 1 950", t.details.rav === 1950, t.details.rav);
check("charges salariales = CNPS + IRPP + CAC + TDL + RAV + CFC = 17 023", t.chargesSalariales === 6300 + 5703 + 570 + 1000 + 1950 + 1500, t.chargesSalariales);

// 1 bis. Cas réel de la liste des salaires du directeur : ABAMI, brut 106 950 → retenues 11 420, net 95 530.
const a = computeBulletin(106950, vide, BAREME_DEFAUT);
check("ABAMI 106 950 : charges salariales 11 420 (identique à la référence)", a.chargesSalariales === 11420, a.details);
check("ABAMI 106 950 : net 95 530 (identique à la référence)", a.net === 95530, a.net);
check("net = brut − retenues", t.net === t.brut - t.totalRetenues);
check("reste à prendre = acquis − pris", t.details.congesRestants === 9);

// 2. Cadre : brut 1 300 000, transport 30 000, logement 50 000 → IRPP positif, plafond CNPS.
const c = computeBulletin(1300000, { ...vide, transport: 30000, indemniteLogement: 50000 }, BAREME_DEFAUT);
console.log("Cadre 1 300 000 :", { brut: c.brut, irpp: c.details.irpp, cac: c.details.cac, net: c.net });
check("CNPS plafonnée à 750 000", c.details.baseCnps === 750000 && c.details.cnpsSalarie === 31500);
check("IRPP annuel : base ((1 350 000×0,7 − 31 500 − 41 667)×12) → ~2 054 …", c.details.irpp > 0 && c.details.cac === Math.round(c.details.irpp * 0.1), c.details);
check("IRPP progressif croissant", computeIrpp(5_000_000, [{ jusqua: 2_000_000, taux: 10 }, { jusqua: 3_000_000, taux: 15 }, { jusqua: null, taux: 25 }]) === 200000 + 150000 + 500000);
check("IRPP nul si base nulle", computeIrpp(0, BAREME_DEFAUT.irppBrackets) === 0);

// 3. Congés, jours travaillés, retenues diverses et registre.
const s3: SaisieMois = { ...vide, joursTravailles: 25, congesPris: 5, congesAcquis: 12, sanctions: 5000, absences: 3000, acompte: 20000, mutuellePct: 2 };
const b3 = computeBulletin(200000, s3, BAREME_DEFAUT, { primes: [{ libelle: "Prime de rendement", montant: 15000 }], charges: [{ libelle: "Retenue sur avance", montant: 8000 }] });
check("salaire de base proratisé : 200 000 × 25/30", b3.details.salaireBase === 166667, b3.details.salaireBase);
check("indemnité de congés = journalier × congés pris (5)", b3.details.indemniteConges === 33333, b3.details.indemniteConges);
check("Total 1 = base + indemnité + primes registre", b3.brut === 166667 + 33333 + 15000, b3.brut);
check("mutuelle 2 % du Total 1", b3.details.mutuelle === Math.round(b3.brut * 0.02));
check("lignes fixes présentes (66111, 6613, 43131, 44725) + registre", ["66111", "6613"].every((k) => b3.lignesGain.some((l) => l.code === k)) && ["43131", "44725"].every((k) => b3.cotisations.some((l) => l.code === k)) && b3.lignesGain.some((l) => l.code === "PRIME") && b3.cotisations.some((l) => l.code === "RETENUE"));
check("acompte / impôts & CNPS = acompte + charges salariales", b3.details.acompteImpotsCnps === 20000 + b3.chargesSalariales);
const somme = b3.cotisations.reduce((x, l) => x + l.retenue, 0);
check("total retenues = somme des lignes listées (dont sanctions, absences, acompte, mutuelle, registre)", b3.totalRetenues === somme, { total: b3.totalRetenues, somme });
check("Total 2 = Total 1 − retenues ; net = max(0, Total 2)", b3.details.total2 === b3.brut - b3.totalRetenues && b3.net === Math.max(0, b3.details.total2));

// 4. Interrupteurs TDL / RAV.
const sans = computeBulletin(150000, { ...vide, transport: 15000 }, { ...BAREME_DEFAUT, tdlActif: false, ravActif: false });
check("TDL/RAV désactivées → 0", sans.details.tdl === 0 && sans.details.rav === 0);
check("barème forfaitaire : bornes", bareme(TDL_BAREME, 62000) === 0 && bareme(TDL_BAREME, 62001) === 250 && bareme(RAV_BAREME, 5_000_000) === 13000);

if (echecs) { console.error(`\n${echecs} test(s) en échec`); process.exit(1); }
else console.log("\nTous les tests passent.");

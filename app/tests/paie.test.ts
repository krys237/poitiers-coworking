// Test de sanité du moteur de paie (sans framework) : `npm run test:paie`.
// Hors du dossier convex/ : Convex bundle tout ce dossier comme fonctions serveur.
import { computeBulletin, computeIrpp, BAREME_DEFAUT } from "../convex/lib/paie.ts";
import type { SaisieMois } from "../convex/lib/paie.ts";

let echecs = 0;
function check(nom: string, cond: boolean, detail?: unknown) {
  if (cond) console.log(`  ok  ${nom}`);
  else { console.error(`  KO  ${nom}`, detail ?? ""); echecs++; }
}

const saisie: SaisieMois = {
  joursTravailles: 30, joursBase: 30, sanctions: 0, primesVariables: 114000,
  transport: 56000, heuresSup: 0, anciennete: 0, mutuellePct: 1, dettesSoins: 0, acompte: 0,
};

const b = computeBulletin(2_500_000, saisie, BAREME_DEFAUT);
console.log("Bulletin exemple:", { brut: b.brut, retenues: b.totalRetenues, net: b.net, patronal: b.chargesPatronales });

check("brut = base + primes + transport", b.brut === 2_500_000 + 114_000 + 56_000, b.brut);
check("net < brut", b.net < b.brut && b.net > 0, b.net);
check("net = brut - retenues", b.net === b.brut - b.totalRetenues, { net: b.net, brut: b.brut, ret: b.totalRetenues });
check("CNPS plafonné", b.cotisations.find((c) => c.code === "43131")!.base === BAREME_DEFAUT.plafondCnps);
check("IRPP progressif croissant", computeIrpp(500_000, BAREME_DEFAUT.irppBrackets) > computeIrpp(100_000, BAREME_DEFAUT.irppBrackets));
check("IRPP nul si base nulle", computeIrpp(0, BAREME_DEFAUT.irppBrackets) === 0);

// Registre primes & charges + retenues de saisie listées sur le bulletin.
const s2: SaisieMois = { ...saisie, primesVariables: 0, transport: 0, sanctions: 5000, acompte: 20000 };
const b2 = computeBulletin(200_000, s2, BAREME_DEFAUT, {
  primes: [{ libelle: "Prime de rendement", montant: 15000 }, { libelle: "Gratification", montant: 10000 }],
  charges: [{ libelle: "Retenue sur avance", montant: 8000 }],
});
check("primes du registre ajoutées au brut", b2.brut === 200_000 + 25_000, b2.brut);
check("chaque prime = une ligne de gain nommée", b2.lignesGain.filter((l) => l.code === "PRIME").length === 2);
check("charge du registre = ligne de retenue nommée", b2.cotisations.some((c) => c.code === "RETENUE" && c.retenue === 8000));
check("sanctions et acompte listés", b2.cotisations.some((c) => c.code === "SANCTION" && c.retenue === 5000) && b2.cotisations.some((c) => c.code === "42121" && c.retenue === 20000));
const sommeRetenuesListees = b2.cotisations.reduce((t, c) => t + c.retenue, 0);
check("total retenues = somme des lignes listées", b2.totalRetenues === sommeRetenuesListees, { total: b2.totalRetenues, somme: sommeRetenuesListees });
check("net = brut - retenues (avec registre)", b2.net === b2.brut - b2.totalRetenues);

if (echecs) { console.error(`\n${echecs} test(s) en échec`); process.exit(1); }
else console.log("\nTous les tests passent.");

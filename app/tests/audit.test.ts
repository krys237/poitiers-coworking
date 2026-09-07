// Tests de la logique pure de l'audit : `npm run test:audit`.
import { CATEGORIES_AUDIT, parseCsvAudit, exportCsvAudit, totalLignes, variation, derniersMois, moisPrecedent, estCategorieAudit } from "../convex/lib/audit.ts";

let echecs = 0;
const check = (nom: string, cond: boolean, d?: unknown) => { if (cond) console.log(`  ok  ${nom}`); else { console.error(`  KO  ${nom}`, d ?? ""); echecs++; } };

check("14 catégories", CATEGORIES_AUDIT.length === 14);
check("estCategorieAudit", estCategorieAudit("masse_salariale") && !estCategorieAudit("inconnue"));

const csv = "Nom / Désignation;Date début;Date fin;Montant (FCFA);Notes\nDr NGONO;2026-09-01;2026-09-30;1 250 000;scanner\n\"KAMDEM, Éric\";;;300000,50;\n";
const l = parseCsvAudit(csv);
check("CSV : 2 lignes, en-tête ignoré", l.length === 2, l);
check("CSV : montant FR « 1 250 000 » → 1250000", l[0].montant === 1250000, l[0]);
check("CSV : décimale virgule arrondie", l[1].montant === 300001 || l[1].montant === 300000, l[1]);
check("CSV : guillemets retirés", l[1].designation === "KAMDEM, Éric" || l[1].designation.startsWith("KAMDEM"), l[1]);
const rt = parseCsvAudit(exportCsvAudit(l));
check("CSV : aller-retour conserve les montants", rt.length === 2 && rt[0].montant === 1250000, rt);
check("total", totalLignes(l) === l[0].montant + l[1].montant);

const v1 = variation(1000, 1250);
check("variation +25 %", v1.delta === 250 && v1.pct === 25, v1);
check("variation depuis 0 → pct null", variation(0, 500).pct === null);
check("moisPrecedent janvier", moisPrecedent("2026-01") === "2025-12");
check("derniersMois 3", JSON.stringify(derniersMois("2026-09", 3)) === JSON.stringify(["2026-07", "2026-08", "2026-09"]));

if (echecs) { console.error(`\n${echecs} test(s) en échec`); process.exit(1); } else console.log("\nTous les tests passent.");

// Test de sanité du grand livre financier : `npm run test:tresorerie`.
import { calculerSoldes, recetteTotale, SOLDES, SOLDES_PRINCIPAUX, BLOCS, formule } from "../convex/lib/tresorerie.ts";

let echecs = 0;
const check = (nom: string, cond: boolean, d?: unknown) => { if (cond) console.log("  ok  " + nom); else { console.error("  KO  " + nom, d ?? ""); echecs++; } };

check("8 blocs, 9 soldes principaux", BLOCS.length === 8 && SOLDES_PRINCIPAUX.length === 9, { b: BLOCS.length, s: SOLDES_PRINCIPAUX.length });

const ouverture = { poitiers_f3: 100_000, poitiers_om: 20_000, edrtim: 500_000, carte_visa: 40_000, lilas_f3: 10_000 };
const m = {
  poitiers: { especes: 50_000, cheque: 20_000, visa: 10_000, retrait: 30_000, om: 5_000, retrait_om: 1_000, momo: 7_000, retrait_momo: 2_000 },
  lilas: { especes: 15_000, cheque: 0, retrait: 5_000, om: 3_000, momo: 1_000 },
  carte_visa: { depot: 12_000, retrait: 2_000 },
  edrtim_finance: { especes: 8_000, cheque: 2_000, retrait: 1_000 },
  medicaments: { especes: 4_000 },
  autres: { tdm: 30_000, quantiferon: 6_000 },
};
const s = calculerSoldes(ouverture, m);
check("F3 Poitiers = 100000 + 50000 + 20000 + 10000 − 30000 = 150000", s.poitiers_f3 === 150_000, s.poitiers_f3);
check("OM Poitiers = 20000 + 5000 − 1000 = 24000", s.poitiers_om === 24_000, s.poitiers_om);
check("MOMO Poitiers (ouverture absente = 0) = 7000 − 2000 = 5000", s.poitiers_momo === 5_000, s.poitiers_momo);
check("F3 Lilas = 10000 + 15000 − 5000 = 20000 (pas de visa côté Lilas)", s.lilas_f3 === 20_000, s.lilas_f3);
check("E DR TIM reporté tel quel = 500000", s.edrtim === 500_000, s.edrtim);
check("Carte Visa = 40000 + 12000 − 2000 = 50000", s.carte_visa === 50_000, s.carte_visa);
check("E DR TIM Finance = 8000 + 2000 − 1000 = 9000", s.edrtim_finance === 9_000, s.edrtim_finance);
check("Solde Médicaments = 4000", s.medicaments === 4_000, s.medicaments);
check("tous les soldes définis", SOLDES.every((x) => typeof s[x.cle] === "number"));

const r = recetteTotale(m);
const attendu = 50_000 + 20_000 + 10_000 + 5_000 + 7_000 + 15_000 + 3_000 + 1_000 + 12_000 + 8_000 + 2_000 + 4_000 + 30_000 + 6_000;
check(`recette totale = somme des entrées (${attendu}), retraits exclus`, r === attendu, r);

const enchaine = calculerSoldes(s, { poitiers: { especes: 1_000, retrait: 500 } });
check("report J → J+1 : F3 Poitiers = 150000 + 1000 − 500 = 150500", enchaine.poitiers_f3 === 150_500, enchaine.poitiers_f3);
check("formule lisible", formule(SOLDES[0]) === "J-1 + Espèces + Dépôt chèque + Carte Visa − Retrait", formule(SOLDES[0]));

if (echecs) { console.error(`\n${echecs} test(s) en échec`); process.exit(1); } else console.log("\nTous les tests passent.");

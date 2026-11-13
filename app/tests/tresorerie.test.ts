// Test de sanité du grand livre financier : `npm run test:tresorerie`.
import { calculerSoldes, recetteTotale, SOLDES, SOLDES_PRINCIPAUX, BLOCS, formule } from "../convex/lib/tresorerie.ts";

let echecs = 0;
const check = (nom: string, cond: boolean, d?: unknown) => { if (cond) console.log("  ok  " + nom); else { console.error("  KO  " + nom, d ?? ""); echecs++; } };

check("9 blocs, 10 soldes principaux", BLOCS.length === 9 && SOLDES_PRINCIPAUX.length === 10, { b: BLOCS.length, s: SOLDES_PRINCIPAUX.length });
check("la colonne « Autres » est sur TOUTES les lignes", BLOCS.every((b) => b.lignes.some((l) => l.cle === "autres" && l.sens === "entree")),
  BLOCS.filter((b) => !b.lignes.some((l) => l.cle === "autres")).map((b) => b.cle));
check("« Partage » s'appelle désormais « Invest »",
  BLOCS.find((b) => b.cle === "autres")!.lignes.find((l) => l.cle === "partage")!.libelle === "Invest");

const ouverture = { poitiers_f3: 100_000, poitiers_om: 20_000, edrtim: 500_000, carte_visa: 40_000, lilas_f3: 10_000 };
const m = {
  poitiers: { especes: 50_000, cheque: 20_000, retrait: 30_000, om: 5_000, retrait_om: 1_000, momo: 7_000, retrait_momo: 2_000 },
  lilas: { especes: 15_000, cheque: 0, retrait: 5_000, om: 3_000, momo: 1_000 },
  carte_visa: { depot: 12_000, retrait: 2_000 },
  edrtim_finance: { especes: 8_000, cheque: 2_000, retrait: 1_000 },
  medicaments: { especes: 4_000 },
  autres: { tdm: 30_000, quantiferon: 6_000 },
};
const s = calculerSoldes(ouverture, m);
// Le dépôt chèque est SORTI du F3 le 13/11/2026 : il n'est pas de la liquidité de caisse.
check("F3 Poitiers = 100000 + 50000 − 30000 = 120000 (ni carte, ni chèque)", s.poitiers_f3 === 120_000, s.poitiers_f3);
check("Chèques Poitiers = 20000, dans sa propre tuile", s.poitiers_cheque === 20_000, s.poitiers_cheque);
check("OM Poitiers = 20000 + 5000 − 1000 = 24000", s.poitiers_om === 24_000, s.poitiers_om);
check("MOMO Poitiers (ouverture absente = 0) = 7000 − 2000 = 5000", s.poitiers_momo === 5_000, s.poitiers_momo);
check("F3 Lilas = 10000 + 15000 − 5000 = 20000 (pas de visa côté Lilas)", s.lilas_f3 === 20_000, s.lilas_f3);
check("E DR TIM reporté tel quel = 500000", s.edrtim === 500_000, s.edrtim);
check("Carte Visa = 40000 + 12000 − 2000 = 50000", s.carte_visa === 50_000, s.carte_visa);
check("E DR TIM Finance = 8000 + 2000 − 1000 = 9000", s.edrtim_finance === 9_000, s.edrtim_finance);
check("Solde Médicaments = 4000", s.medicaments === 4_000, s.medicaments);

// --- Les deux biodiagnostics (13/11/2026) ---
// Biodiagnostic 1 va dans la caisse POITIERS, Advens non. Confondre les deux a produit l'écart
// relevé le 12/11 sur le relevé de la DAF.
const sBio = calculerSoldes({ poitiers_f3: 1_000_000 }, {
  poitiers: { especes: 100_000 },
  biodiagnostic: { especes: 97_600 },
  biodiagnostic_advens: { especes: 3_700_000 },
});
check("Biodiagnostic 1 entre dans le F3 : 1000000 + 100000 + 97600 = 1197600", sBio.poitiers_f3 === 1_197_600, sBio.poitiers_f3);
check("Biodiagnostic Advens n'entre PAS dans le F3", sBio.biodiagnostic_advens === 3_700_000, sBio.biodiagnostic_advens);
check("Biodiagnostic 1 n'a pas de solde propre (son argent est déjà dans le F3)",
  !SOLDES.some((x) => x.cle === "biodiagnostic"), SOLDES.map((x) => x.cle));

// --- La colonne « Autres » (13/11/2026) ---
// Elle alimente le solde de la ligne où elle se trouve, et compte dans la recette.
const sAutres = calculerSoldes({ poitiers_f3: 50_000, carte_visa: 10_000, medicaments: 0 }, {
  poitiers: { autres: 7_000 }, carte_visa: { autres: 3_000 }, medicaments: { autres: 500 },
});
check("« Autres » alimente le F3 de sa ligne : 50000 + 7000 = 57000", sAutres.poitiers_f3 === 57_000, sAutres.poitiers_f3);
check("« Autres » alimente la Carte Visa : 10000 + 3000 = 13000", sAutres.carte_visa === 13_000, sAutres.carte_visa);
check("« Autres » alimente Médicaments : 500", sAutres.medicaments === 500, sAutres.medicaments);
check("« Autres » compte dans la recette totale",
  recetteTotale({ poitiers: { autres: 7_000 }, autres: { autres: 1_000 } }) === 8_000);

// Décision du 06/11/2026 : la carte ne transite plus par la caisse. Une donnée héritée sur
// `poitiers.visa` ne doit donc plus peser sur le F3 — sans quoi la correction des journées
// d'octobre serait silencieusement défaite par un prochain recalcul.
const sHerite = calculerSoldes({ poitiers_f3: 100_000 }, { poitiers: { especes: 50_000, visa: 999_999 } as any });
check("une Visa héritée en caisse est ignorée par le F3", sHerite.poitiers_f3 === 150_000, sHerite.poitiers_f3);
check("la ligne Carte Visa a disparu du bloc POITIERS", !BLOCS.find((b) => b.cle === "poitiers")!.lignes.some((l) => l.cle === "visa"));

check("tous les soldes définis", SOLDES.every((x) => typeof s[x.cle] === "number"));

const r = recetteTotale(m);
const attendu = 50_000 + 20_000 + 5_000 + 7_000 + 15_000 + 3_000 + 1_000 + 12_000 + 8_000 + 2_000 + 4_000 + 30_000 + 6_000;
check(`recette totale = somme des entrées (${attendu}), retraits exclus`, r === attendu, r);

const enchaine = calculerSoldes(s, { poitiers: { especes: 1_000, retrait: 500 } });
check("report J → J+1 : F3 Poitiers = 120000 + 1000 − 500 = 120500", enchaine.poitiers_f3 === 120_500, enchaine.poitiers_f3);
check("formule lisible, avec l'apport du laboratoire",
  formule(SOLDES[0]) === "J-1 + Espèces + Autres + Biodiagnostic 1 − Retrait", formule(SOLDES[0]));

// --- Non-régression sur les chiffres réels de la DAF (octobre 2026) ---
// Le relevé papier de la DAF annonçait un F3 supérieur à celui de la plateforme d'un montant qui
// restait constant puis sautait : 97 600 à partir du 16/10, 136 450 à partir du 23/10, 193 450 à
// partir du 30/10. Ces trois sauts sont, au franc près, les recettes Biodiagnostic 1 de ces
// journées. Rejouer la chaîne doit retrouver les chiffres du relevé.
const chaineReelle: { date: string; f3Avant: number; bio: number; dafAttendu: number }[] = [
  { date: "16/10", f3Avant: 31_857_420, bio: 97_600, dafAttendu: 33_318_064 },
  { date: "18/10", f3Avant: 34_178_560, bio: 0, dafAttendu: 34_462_560 },
  { date: "19/10", f3Avant: 34_364_960, bio: 0, dafAttendu: 24_096_060 },
  { date: "20/10", f3Avant: 23_998_460, bio: 0, dafAttendu: 22_679_060 },
];
// Mouvements POITIERS réels de ces journées (espèces / retrait), relus en production le 12/11.
const reels: Record<string, { especes: number; retrait: number }> = {
  "16/10": { especes: 1_363_044, retrait: 0 },
  "18/10": { especes: 186_400, retrait: 0 },
  "19/10": { especes: 1_623_500, retrait: 11_990_000 },
  "20/10": { especes: 3_113_000, retrait: 4_530_000 },
};
// Cumul des recettes Biodiagnostic 1 déjà dans la caisse à l'ouverture de chaque journée.
const cumulBio: Record<string, number> = { "16/10": 0, "18/10": 97_600, "19/10": 97_600, "20/10": 97_600 };
for (const l of chaineReelle) {
  const mvt = reels[l.date];
  const calc = calculerSoldes(
    { poitiers_f3: l.f3Avant + cumulBio[l.date] },
    { poitiers: { especes: mvt.especes, retrait: mvt.retrait }, biodiagnostic: { especes: l.bio } },
  );
  check(`${l.date} : le F3 calculé retrouve le relevé de la DAF (${l.dafAttendu})`, calc.poitiers_f3 === l.dafAttendu, calc.poitiers_f3);
}

if (echecs) { console.error(`\n${echecs} test(s) en échec`); process.exit(1); } else console.log("\nTous les tests passent.");

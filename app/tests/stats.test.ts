// `npm run test:stats` — tableau de caisse (total espèces, chiffre d'affaires) et primes médecins.
import { totalEspeces, chiffreAffaires, totauxCaisse, montantTotalPrime, parseCsvCaisse, exportCsvCaisse, parseCsvPrimes, exportCsvPrimes, LIGNE_VIDE } from "../convex/lib/stats.ts";

let echecs = 0;
const check = (nom: string, cond: boolean, detail?: unknown) => { if (cond) console.log(`  ok  ${nom}`); else { console.error(`  KO  ${nom}`, detail ?? ""); echecs++; } };

const l1 = { ...LIGNE_VIDE, dateDebut: "2026-09-01", dateFin: "2026-09-07", horaires: "8h-18h", caissePP: 120000, scanner: 300000, quantiferon: 24000, esthetique: 30000, assurance: 90000, tepScan: 250000, sortiesDuJour: 45000 };
const l2 = { ...LIGNE_VIDE, dateDebut: "2026-09-08", dateFin: "2026-09-14", caissePP: 100000, tenofovir: 15000, therapieVie: 20000, assurance: 10000 };

check("total espèces l1 = 474000", totalEspeces(l1) === 474000, totalEspeces(l1));
check("CA l1 = 474000 + 90000 + 250000", chiffreAffaires(l1) === 814000, chiffreAffaires(l1));
check("sorties non comptées dans le CA", chiffreAffaires({ ...l1, sortiesDuJour: 999999 }) === 814000);
const t = totauxCaisse([l1, l2]);
check("totaux : espèces 609000, CA 959000", t.totalEspeces === 609000 && t.chiffreAffaires === 959000, t);
check("montant total prime = actes × unitaire", montantTotalPrime(12, 15000) === 180000);

const csv = exportCsvCaisse([l1]);
const back = parseCsvCaisse(csv);
check("CSV caisse : aller-retour", back.length === 1 && back[0].scanner === 300000 && back[0].dateFin === "2026-09-07", back[0]);
const primes = parseCsvPrimes("Médecin;Date début;Date fin;Actes;Montant unitaire;Notes\nDr. Nkeng;2026-09-01;2026-09-30;12;15 000;RAS\nDr. Fouda;;;3;20000;");
check("CSV primes : 2 lignes, nombres FR", primes.length === 2 && primes[0].montantUnitaire === 15000 && primes[1].actes === 3, primes);
check("export primes : total calculé", exportCsvPrimes(primes).includes("Dr. Nkeng;2026-09-01;2026-09-30;12;15000;180000;RAS"));

if (echecs) { console.error(`\n${echecs} test(s) en échec`); process.exit(1); } else console.log("\nTous les tests passent.");

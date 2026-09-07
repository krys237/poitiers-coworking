// `npm run test:fenetre` — fenêtre de soumission des comptes rendus (Douala UTC+1, lun–ven 16h–20h).
import { estJourOuvrable, estDansFenetre, finFenetre, prochaineOuverture, instantDouala, dateDouala, pointsPour, heureDouala } from "../convex/lib/fenetre.ts";

let echecs = 0;
const check = (nom: string, cond: boolean, detail?: unknown) => { if (cond) console.log(`  ok  ${nom}`); else { console.error(`  KO  ${nom}`, detail ?? ""); echecs++; } };

// Lundi 7 septembre 2026.
const lun15 = instantDouala(2026, 9, 7, 15, 30);
const lun16 = instantDouala(2026, 9, 7, 16, 0);
const lun19 = instantDouala(2026, 9, 7, 19, 59);
const lun20 = instantDouala(2026, 9, 7, 20, 0);
const sam17 = instantDouala(2026, 9, 12, 17, 0);
const ven21 = instantDouala(2026, 9, 11, 21, 0);

check("instantDouala 16h = 15h UTC", lun16.toISOString() === "2026-09-07T15:00:00.000Z", lun16.toISOString());
check("heureDouala rend 16h", heureDouala(lun16).h === 16 && heureDouala(lun16).dow === 1);
check("lundi = ouvrable, samedi non", estJourOuvrable(lun16) && !estJourOuvrable(sam17));
check("15h30 hors fenêtre", !estDansFenetre(lun15));
check("16h00 dans la fenêtre", estDansFenetre(lun16));
check("19h59 dans la fenêtre", estDansFenetre(lun19));
check("20h00 hors fenêtre", !estDansFenetre(lun20));
check("samedi 17h hors fenêtre", !estDansFenetre(sam17));
check("finFenetre = 20h00 le même jour", finFenetre(lun16)?.toISOString() === instantDouala(2026, 9, 7, 20).toISOString());
check("finFenetre null hors fenêtre", finFenetre(lun15) === null);
check("prochaine ouverture avant 16h = 16h même jour", prochaineOuverture(lun15).toISOString() === lun16.toISOString());
check("prochaine ouverture après 20h = lendemain 16h", prochaineOuverture(lun20).toISOString() === instantDouala(2026, 9, 8, 16).toISOString());
check("vendredi 21h → lundi 16h", prochaineOuverture(ven21).toISOString() === instantDouala(2026, 9, 14, 16).toISOString(), prochaineOuverture(ven21).toISOString());
check("dateDouala à 23h30 UTC = lendemain", dateDouala(new Date("2026-09-07T23:30:00Z")) === "2026-09-08");
check("points : 1 dans la fenêtre, 0 hors", pointsPour(false) === 1 && pointsPour(true) === 0);

if (echecs) { console.error(`\n${echecs} test(s) en échec`); process.exit(1); } else console.log("\nTous les tests passent.");

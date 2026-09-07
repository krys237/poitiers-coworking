// Tests de la sécurité et de la forme de l'API d'export : `npm run test:api`.
import { comparaisonConstante, dateValide, parseEntites, reponseApi, ENTITES } from "../convex/lib/apiSecurite.ts";

let echecs = 0;
const check = (nom: string, cond: boolean, d?: unknown) => { if (cond) console.log(`  ok  ${nom}`); else { console.error(`  KO  ${nom}`, d ?? ""); echecs++; } };

check("comparaison : égal", comparaisonConstante("abc123", "abc123"));
check("comparaison : différent même longueur", !comparaisonConstante("abc123", "abc124"));
check("comparaison : longueurs différentes", !comparaisonConstante("abc", "abc1"));
check("comparaison : vide vs non vide", !comparaisonConstante("", "x") && comparaisonConstante("", ""));
check("dateValide", dateValide("2026-09-07") && !dateValide("2026-13-01") && !dateValide("2026-02-30") && !dateValide("hier"));
check("8 entités", ENTITES.length === 8 && ENTITES.includes("poitiers"));
const p1 = parseEntites(null); check("entités absentes = toutes", p1.ok && p1.entites.length === 8);
const p2 = parseEntites("poitiers,LILAS"); check("entités : liste, casse ignorée", p2.ok && p2.entites.join() === "poitiers,lilas", p2);
const p3 = parseEntites("poitiers,foo"); check("entité inconnue → erreur", !p3.ok && /foo/.test((p3 as any).erreur));

const j = { date: "2026-09-07", periode: "2026-09", cloture: false, recetteTotale: 999,
  mouvements: { poitiers: { especes: 100000, cheque: 50000, visa: 10000, retrait: 20000 }, lilas: { especes: 30000 } },
  soldesOuverture: { poitiers_f3: 1000000, lilas_f3: 500000, edrtim: 7 }, soldes: { poitiers_f3: 1140000, lilas_f3: 530000, edrtim: 7 } };
const r = reponseApi(j, ["poitiers"]);
check("réponse : entrées/retraits/net Poitiers", (r.entites as any).poitiers.entrees === 160000 && (r.entites as any).poitiers.retraits === 20000 && (r.entites as any).poitiers.net === 140000, r.entites);
check("réponse : soldes filtrés sur l'entité", "poitiers_f3" in r.soldes && !("lilas_f3" in r.soldes), r.soldes);
check("réponse : recette recalculée pour un sous-ensemble", r.recetteTotale === 160000, r.recetteTotale);
const rt = reponseApi(j, [...ENTITES]);
check("réponse : toutes entités → recette totale d'origine + soldes complets", rt.recetteTotale === 999 && "edrtim" in rt.soldes);

if (echecs) { console.error(`\n${echecs} test(s) en échec`); process.exit(1); } else console.log("\nTous les tests passent.");

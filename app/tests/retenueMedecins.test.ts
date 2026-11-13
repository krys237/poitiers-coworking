// Retenue à la source sur les honoraires des médecins (lot R6) : `npm run test:retenue`
//
// Les deux points que ces tests verrouillent sont exactement ceux qui bloquaient le lot :
// M1 — le taux n'est pas « tout compris », il faut les centimes additionnels ;
// M2 — les 30 % sur les espèces sont une règle figée.
import {
  CENTIMES_ADDITIONNELS_PCT, EXPLICATIONS, PART_ESPECES_PCT, TAUX_BASE,
  baseRetenue, estTauxBase, exportCsv, recapitulatif, retenueMedecin, tauxEffectif,
} from "../convex/lib/retenueMedecins.ts";

let echecs = 0;
const check = (nom: string, cond: boolean, d?: unknown) => {
  if (cond) console.log("  ok  " + nom);
  else { console.error("  KO  " + nom, d ?? ""); echecs++; }
};
const titre = (s: string) => console.log(`\n— ${s}`);

// ===========================================================================
titre("M1 — le taux n'est PAS « tout compris »");
check("deux taux de base seulement : 5 % et 10 %", TAUX_BASE.join() === "5,10");
check("les centimes additionnels valent 10 %", CENTIMES_ADDITIONNELS_PCT === 10);
check("un médecin « à 5 % » est prélevé à 5,5 %", tauxEffectif(5) === 5.5, tauxEffectif(5));
check("un médecin « à 10 % » est prélevé à 11 %", tauxEffectif(10) === 11, tauxEffectif(10));
// C'est 10 % de recette en plus : exactement l'enjeu de la question M1.
check("l'écart avec un taux « tout compris » est de 10 %",
  tauxEffectif(5) / 5 === 1.1 && tauxEffectif(10) / 10 === 1.1);
check("le taux n'est jamais arrondi à l'entier", tauxEffectif(5) !== 5 && tauxEffectif(5) !== 6);

titre("Contrôle du taux");
check("5 est un taux connu", estTauxBase(5));
check("10 aussi", estTauxBase(10));
check("7 ne l'est pas", !estTauxBase(7));
check("5,5 n'est pas un taux DE BASE — c'est le taux appliqué", !estTauxBase(5.5));
check("une chaîne n'est pas un taux", !estTauxBase("5"));

// ===========================================================================
titre("M2 — la base : tout l'assurance, 30 % des espèces");
check("la part des espèces est de 30 %", PART_ESPECES_PCT === 30);
check("1 000 000 d'assurance seul donne 1 000 000 de base",
  baseRetenue(1000000, 0) === 1000000);
check("500 000 d'espèces seul donne 150 000 de base",
  baseRetenue(0, 500000) === 150000);
check("les deux s'additionnent",
  baseRetenue(1000000, 500000) === 1150000, baseRetenue(1000000, 500000));
// La dissymétrie est le cœur de la règle : un franc d'assurance ne vaut pas un franc d'espèces.
check("un franc d'assurance pèse plus qu'un franc d'espèces dans la base",
  baseRetenue(1000000, 0) > baseRetenue(0, 1000000));
check("une base nulle reste nulle", baseRetenue(0, 0) === 0);

// ===========================================================================
titre("Le calcul complet, et son explication ligne à ligne");
const l = retenueMedecin({ medecin: "Dr A", tauxBase: 5, caAssurance: 1000000, caEspeces: 500000 });
check("la part des espèces est isolée", l.partEspeces === 150000, l.partEspeces);
check("la base vaut 1 150 000", l.base === 1150000, l.base);
check("le taux appliqué est 5,5 %", l.taux === 5.5);
check("la retenue vaut 63 250 FCFA", l.retenue === 63250, l.retenue);
check("le net part du CA DÉCLARÉ, pas de la base",
  l.netDeRetenue === 1500000 - 63250, l.netDeRetenue);
check("cinq lignes d'explication, une par étape", l.detail.length === 5, l.detail);
check("l'explication nomme les centimes additionnels",
  l.detail.some((x) => x.includes("centimes additionnels")), l.detail);
check("et affiche le taux à la française", l.detail.some((x) => x.includes("5,5 %")), l.detail);

titre("Un médecin à 10 % sur de l'assurance seule");
const dix = retenueMedecin({ medecin: "Dr B", tauxBase: 10, caAssurance: 2000000, caEspeces: 0 });
check("base = CA assurance", dix.base === 2000000);
check("retenue = 11 % de la base", dix.retenue === 220000, dix.retenue);
// Le test qui chiffre l'enjeu de M1 : 20 000 FCFA d'écart sur ce seul médecin.
check("un taux « tout compris » aurait donné 200 000, soit 20 000 de moins",
  dix.retenue - Math.round(2000000 * 0.1) === 20000);

titre("Arrondis");
check("la retenue est entière", Number.isInteger(retenueMedecin({ medecin: "x", tauxBase: 5, caAssurance: 333333, caEspeces: 77777 }).retenue));
check("la base est entière", Number.isInteger(retenueMedecin({ medecin: "x", tauxBase: 5, caAssurance: 333333, caEspeces: 77777 }).base));
check("un CA de 1 franc en espèces ne casse rien",
  retenueMedecin({ medecin: "x", tauxBase: 5, caAssurance: 0, caEspeces: 1 }).base === 0);
check("un CA nul donne une retenue nulle",
  retenueMedecin({ medecin: "x", tauxBase: 10, caAssurance: 0, caEspeces: 0 }).retenue === 0);

// ===========================================================================
titre("Récapitulatif de la déclaration");
const lignes = [
  { medecin: "Dr A", tauxBase: 5, caAssurance: 1000000, caEspeces: 500000 },
  { medecin: "Dr B", tauxBase: 10, caAssurance: 2000000, caEspeces: 0 },
  { medecin: "Dr C", tauxBase: 5, caAssurance: 0, caEspeces: 300000 },
];
const r = recapitulatif(lignes);
check("trois médecins", r.medecins === 3);
check("le CA assurance est totalisé", r.caAssurance === 3000000, r.caAssurance);
check("le CA espèces aussi", r.caEspeces === 800000, r.caEspeces);
check("la base totale vaut la somme des bases",
  r.base === 1150000 + 2000000 + 90000, r.base);
check("la retenue totale vaut la somme des retenues",
  r.retenue === 63250 + 220000 + 4950, r.retenue);
// La ventilation par taux est ce que porte la déclaration : deux taux, deux lignes.
check("la ventilation sépare les deux taux", r.parTaux.length === 2, r.parTaux);
check("et les trie par taux croissant", r.parTaux[0].tauxBase === 5 && r.parTaux[1].tauxBase === 10);
check("chaque ligne de ventilation porte le taux APPLIQUÉ",
  r.parTaux[0].taux === 5.5 && r.parTaux[1].taux === 11);
check("deux médecins à 5 %, un à 10 %",
  r.parTaux[0].medecins === 2 && r.parTaux[1].medecins === 1);
check("la somme des ventilations retombe sur le total",
  r.parTaux.reduce((t, x) => t + x.retenue, 0) === r.retenue);
check("une déclaration vide ne casse rien", recapitulatif([]).retenue === 0);

titre("Les anomalies sont signalées, pas corrigées en silence");
check("une déclaration saine n'en lève aucune", r.anomalies.length === 0, r.anomalies);
check("un médecin en double est signalé — sinon aucun total ne paraîtrait anormal",
  recapitulatif([...lignes, { medecin: "dr a", tauxBase: 5, caAssurance: 10, caEspeces: 0 }])
    .anomalies.some((a) => a.motif.includes("même médecin")));
check("le doublon est détecté sans égard à la casse ni aux espaces",
  recapitulatif([{ medecin: "Dr A", tauxBase: 5, caAssurance: 1, caEspeces: 0 },
    { medecin: "  dr a  ", tauxBase: 5, caAssurance: 1, caEspeces: 0 }])
    .anomalies.some((a) => a.motif.includes("même médecin")));
check("un nom vide est signalé",
  recapitulatif([{ medecin: "  ", tauxBase: 5, caAssurance: 1, caEspeces: 0 }])
    .anomalies.some((a) => a.motif.includes("Nom du médecin")));
check("un taux inattendu est signalé",
  recapitulatif([{ medecin: "Dr X", tauxBase: 7, caAssurance: 1, caEspeces: 0 }])
    .anomalies.some((a) => a.motif.includes("7 %")));
check("un CA négatif est signalé",
  recapitulatif([{ medecin: "Dr X", tauxBase: 5, caAssurance: -1, caEspeces: 0 }])
    .anomalies.some((a) => a.motif.includes("négatif")));
check("un CA entièrement nul est signalé — la retenue serait nulle sans raison",
  recapitulatif([{ medecin: "Dr X", tauxBase: 5, caAssurance: 0, caEspeces: 0 }])
    .anomalies.some((a) => a.motif.includes("Aucun chiffre")));
// Un taux hors liste ne doit pas EMPÊCHER le calcul : la déclaration se produit, avec l'alerte.
check("mais un taux inattendu n'empêche pas de calculer",
  retenueMedecin({ medecin: "Dr X", tauxBase: 7, caAssurance: 1000000, caEspeces: 0 }).retenue === 77000);

// ===========================================================================
titre("Export CSV");
const csv = exportCsv("2026-11", lignes);
const rangs = csv.split("\n");
check("un en-tête, trois lignes, un total", rangs.length === 5, rangs.length);
check("l'en-tête nomme la part des espèces avec son taux",
  rangs[0].includes("Part especes (30%)"), rangs[0]);
check("le séparateur est le point-virgule", rangs[0].split(";").length === 10, rangs[0]);
check("la dernière ligne est le TOTAL", rangs[4].includes("TOTAL"));
check("le total du CSV est celui du récapitulatif",
  rangs[4].split(";")[8] === String(r.retenue), rangs[4]);
// Un nom contenant le séparateur couperait la ligne en deux sans ce traitement.
const piege = exportCsv("2026-11", [{ medecin: "Dr; Piège", tauxBase: 10, caAssurance: 100, caEspeces: 100 }]);
check("un nom contenant un point-virgule est protégé par des guillemets",
  piege.split("\n")[1].startsWith('2026-11;"Dr; Piège"'), piege.split("\n")[1]);
check("et la ligne garde ses dix colonnes",
  piege.split("\n")[1].replace(/"[^"]*"/g, "X").split(";").length === 10);

titre("Les explications affichées à la RH");
check("quatre explications", EXPLICATIONS.length === 4);
check("chacune a un titre et un texte substantiel",
  EXPLICATIONS.every((e) => e.titre.length > 10 && e.texte.length > 80));
check("aucune clé en double", new Set(EXPLICATIONS.map((e) => e.cle)).size === EXPLICATIONS.length);
check("l'une explique pourquoi 5,5 et non 5",
  EXPLICATIONS.some((e) => e.texte.includes("5,5")));
check("une autre dit que les 30 % sont figés",
  EXPLICATIONS.some((e) => e.texte.includes("figée")));

if (echecs) { console.error(`\n${echecs} test(s) en échec`); process.exit(1); }
else console.log("\nTous les tests passent.");

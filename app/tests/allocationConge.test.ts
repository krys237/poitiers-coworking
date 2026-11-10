// Allocation de congé payé (lot R4) : `npm run test:allocation`
//
// Ce que ces tests verrouillent : les quatre arbitrages du 05/11/2026 (A-VERIFIER R-5) et le
// diviseur 16, qui est le point où la pratique du classeur et la loi divergeaient de 33 %.
import {
  REGLES_ALLOCATION_DEFAUT, ajouterMois, allocationConge, allocationLectureClasseur,
  congePayeDuMois, ecartSurJoursSupplementaires, joursInclus, jourSuivant, moisEntre,
  moisEtFractions, periodeDeReference,
} from "../convex/lib/allocationConge.ts";

let echecs = 0;
const check = (nom: string, cond: boolean, d?: unknown) => {
  if (cond) console.log("  ok  " + nom);
  else { console.error("  KO  " + nom, d ?? ""); echecs++; }
};
const titre = (s: string) => console.log(`\n— ${s}`);
const pres = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;

// ===========================================================================
titre("Arithmétique des dates");
check("un mois plus tard", ajouterMois("2026-03-03", 1) === "2026-04-03");
check("le 31 janvier + 1 mois donne le 28 février, pas le 3 mars",
  ajouterMois("2026-01-31", 1) === "2026-02-28", ajouterMois("2026-01-31", 1));
check("et le 29 en année bissextile", ajouterMois("2024-01-31", 1) === "2024-02-29");
check("le passage d'année", ajouterMois("2025-11-20", 3) === "2026-02-20");
check("douze mois font un an", ajouterMois("2025-06-15", 12) === "2026-06-15");
check("un mois en arrière", ajouterMois("2026-03-31", -1) === "2026-02-28");
check("bornes incluses", joursInclus("2026-03-01", "2026-03-31") === 31);
check("un seul jour vaut 1", joursInclus("2026-03-01", "2026-03-01") === 1);
check("une fin antérieure au début vaut 0", joursInclus("2026-03-05", "2026-03-01") === 0);

titre("Mois ENTIERS révolus — le seuil du premier congé");
check("deux ans pile font 24 mois", moisEntre("2024-11-05", "2026-11-05") === 24);
check("la veille, il n'en manque qu'un", moisEntre("2024-11-05", "2026-11-04") === 23);
check("un mois moins un jour ne compte pas", moisEntre("2026-01-10", "2026-02-09") === 0);
check("le jour anniversaire compte", moisEntre("2026-01-10", "2026-02-10") === 1);

// ===========================================================================
titre("N — le nombre de mois ET FRACTIONS de mois");
// Bornes incluses : du 3 mars au 2 avril, c'est un mois PLEIN, pas un mois moins un jour.
const unMoisPlein = moisEtFractions("2026-03-03", "2026-04-02");
check("un mois plein donne exactement 1", pres(unMoisPlein.n, 1), unMoisPlein);
check("et aucun jour de reste", unMoisPlein.joursRestants === 0, unMoisPlein);

const quinzeEt29 = moisEtFractions("2025-03-03", "2026-07-01");
check("15 mois entiers détectés", quinzeEt29.moisEntiers === 15, quinzeEt29);
check("29 jours de reste", quinzeEt29.joursRestants === 29, quinzeEt29);
check("le dénominateur est la longueur du mois entamé (juin : 30)",
  quinzeEt29.denominateur === 30, quinzeEt29);
check("N = 15 + 29/30", pres(quinzeEt29.n, 15 + 29 / 30), quinzeEt29.n);

titre("Les trois conventions de fraction donnent trois N — d'où le paramètre de barème");
const n30 = moisEtFractions("2025-03-03", "2026-07-01", "trente").n;
const n3044 = moisEtFractions("2025-03-03", "2026-07-01", "trente_virgule_44").n;
const nMois = moisEtFractions("2025-03-03", "2026-07-01", "jours_du_mois").n;
check("÷ 30 donne 15,9667", pres(n30, 15 + 29 / 30), n30);
check("÷ 30,44 donne 15,9526", pres(n3044, 15 + 29 / 30.44), n3044);
check("les trois ne coïncident pas — le choix a donc un effet",
  new Set([n30.toFixed(6), n3044.toFixed(6)]).size === 2, { n30, n3044, nMois });
check("sur ce mois de 30 jours, « jours du mois » rejoint « ÷ 30 »", pres(nMois, n30));
// Un mois de 31 jours sépare les deux conventions : c'est là que le choix se voit.
const juillet = moisEtFractions("2025-04-05", "2026-08-02", "jours_du_mois");
check("sur un mois de 31 jours, le dénominateur suit le mois", juillet.denominateur === 31, juillet);

titre("Période de référence : du retour précédent à la VEILLE du départ");
const per = periodeDeReference({ dateDepart: "2026-08-03", dateRetourPrecedent: "2025-04-05" });
check("elle commence au retour du congé précédent", per?.debut === "2025-04-05");
check("elle finit la veille du départ", per?.fin === "2026-08-02", per);
check("faute de congé précédent, elle part de l'embauche",
  periodeDeReference({ dateDepart: "2026-08-03", dateEmbauche: "2024-01-15" })?.debut === "2024-01-15");
check("le retour précédent prime sur l'embauche",
  periodeDeReference({ dateDepart: "2026-08-03", dateRetourPrecedent: "2025-04-05", dateEmbauche: "2020-01-01" })?.debut === "2025-04-05");
check("sans aucune des deux, pas de période", periodeDeReference({ dateDepart: "2026-08-03" }) === null);

// ===========================================================================
titre("L'allocation — la formule N × assiette ÷ 16");
const douzeMois = allocationConge({
  assiette: 160000, dateDepart: "2026-04-03", dateRetourPrecedent: "2025-04-03", dateEmbauche: "2020-01-01",
});
check("une période de 12 mois pile donne N = 12", pres(douzeMois.n, 12), douzeMois.n);
check("soit 18 jours de droit — le fameux 18", douzeMois.droitJours === 18, douzeMois.droitJours);
check("et une allocation de 12/16 de l'assiette",
  douzeMois.montant === Math.round((12 * 160000) / 16), douzeMois.montant);
check("le taux journalier vaut l'assiette ÷ 24",
  douzeMois.tauxJournalier === Math.round(160000 / 24), douzeMois.tauxJournalier);

titre("Le plafond de 16 mois (arbitrage R-3b : 16, et non 15)");
check("le plafond par défaut est bien 16", REGLES_ALLOCATION_DEFAUT.plafondMois === 16);
const longue = allocationConge({ assiette: 151628, dateDepart: "2026-08-03", dateRetourPrecedent: "2023-01-01" });
check("une période de plus de 16 mois est ramenée à 16", longue.n === 16, longue.n);
check("le plafonnement est SIGNALÉ, pas silencieux", longue.plafonne === true);
check("N brut reste visible pour qu'on sache ce qui a été écrêté", longue.nBrut > 40, longue.nBrut);
check("au plafond, le droit vaut 24 jours — 1,5 × 16", longue.droitJours === 24, longue.droitJours);
check("et l'allocation vaut l'assiette entière — 16/16", longue.montant === 151628, longue.montant);
check("le détail dit que le plafond a joué",
  longue.detail.some((l) => l.includes("Plafond atteint")), longue.detail);
// Un plafond à 15 mois donnerait 22,5 j → 23, et 93,75 % de l'assiette. Les données disaient 16.
const quinze = allocationConge({ assiette: 151628, dateDepart: "2026-08-03", dateRetourPrecedent: "2023-01-01", regles: { plafondMois: 15 } });
check("avec un plafond à 15, on obtiendrait 23 j et non 24", quinze.droitJours === 23, quinze.droitJours);
check("et une allocation plus faible de 9 477 FCFA",
  longue.montant - quinze.montant === 9477, longue.montant - quinze.montant);

titre("Le premier congé s'ouvre à 24 mois (arbitrage R-3c)");
check("le seuil par défaut est 24 mois", REGLES_ALLOCATION_DEFAUT.moisAvantPremierConge === 24);
const jeune = allocationConge({ assiette: 100000, dateDepart: "2026-06-01", dateEmbauche: "2025-01-01" });
check("à 17 mois de service, le droit n'est pas ouvert", jeune.droitOuvert === false, jeune.moisDepuisEmbauche);
check("le détail l'explique", jeune.detail.some((l) => l.includes("non encore ouvert")));
check("mais le montant est tout de même calculé — l'écran décide quoi en faire",
  jeune.montant > 0, jeune.montant);
const ancien = allocationConge({ assiette: 100000, dateDepart: "2026-06-01", dateEmbauche: "2024-06-01" });
check("à 24 mois pile, le droit est ouvert", ancien.droitOuvert === true, ancien.moisDepuisEmbauche);
check("sans date d'embauche, on ne bloque pas — on ne sait pas",
  allocationConge({ assiette: 100000, dateDepart: "2026-06-01" }).droitOuvert === true);

titre("N saisi à la main — quand les dates manquent");
const force = allocationConge({ assiette: 151628, dateDepart: "2026-08-03", nForce: 15.9738 });
check("N forcé est repris tel quel", pres(force.n, 15.9738), force.n);
check("l'allocation suit", force.montant === Math.round((15.9738 * 151628) / 16), force.montant);
check("le détail dit que N a été saisi", force.detail.some((l) => l.includes("saisi à la main")));
check("un N forcé reste soumis au plafond",
  allocationConge({ assiette: 100000, dateDepart: "2026-08-03", nForce: 30 }).n === 16);
check("un N négatif est ramené à zéro",
  allocationConge({ assiette: 100000, dateDepart: "2026-08-03", nForce: -5 }).n === 0);

titre("Sans date ni N, on le dit plutôt que de rendre un chiffre faux");
const muet = allocationConge({ assiette: 100000, dateDepart: "2026-08-03" });
check("N vaut zéro", muet.n === 0);
check("l'allocation vaut zéro", muet.montant === 0);
check("et le détail porte un avertissement", muet.detail.some((l) => l.includes("⚠️")), muet.detail);

// ===========================================================================
titre("Le diviseur 18 du classeur : l'écart chiffré");
// C'est la pièce qui a permis de chiffrer l'enjeu devant la RH. Le taux légal est invariant
// (assiette ÷ 24) ; celui du classeur varie avec N, puisqu'il étale sur 18 jours fixes.
const ec = ecartSurJoursSupplementaires(151628, 15.9738, 6);
check("la lecture légale donne 37 908 FCFA pour 6 jours", ec.montantLegal === 37908, ec);
check("celle du classeur, 50 460", ec.montantClasseur === 50460, ec);
check("soit 33 % de plus", Math.abs(ec.pourcentage - 33.1) < 0.1, ec.pourcentage);
// Le point qui rend les deux lectures indiscernables sur son classeur : à N = 12 elles coïncident.
const a12 = ecartSurJoursSupplementaires(151628, 12, 6);
check("à N = 12, les deux lectures coïncident EXACTEMENT — d'où la confusion",
  a12.ecart === 0, a12);
check("le taux légal ne dépend pas de N",
  allocationConge({ assiette: 151628, dateDepart: "2026-01-01", nForce: 12 }).tauxJournalier ===
    allocationConge({ assiette: 151628, dateDepart: "2026-01-01", nForce: 16 }).tauxJournalier);
check("celui du classeur, lui, varie avec N",
  allocationLectureClasseur(151628, 12).tauxJournalier !== allocationLectureClasseur(151628, 16).tauxJournalier);

// ===========================================================================
titre("L'écart assumé avec son DIPE d'août 2026");
// Décision du 05/11 : on applique la règle énoncée, et l'écart de 0,1636 % reste inexpliqué.
// Ce test ne vérifie pas une égalité — il FIGE l'écart, pour que personne ne le prenne un jour
// pour une régression.
// Les écarts sont écrits en dur : si l'un d'eux bouge, c'est que le modèle a changé, et
// quelqu'un doit décider si c'est voulu. `nous - sien === assiette - sien` aurait été une
// tautologie, `nous` valant déjà l'assiette.
for (const [ligne, assiette, sien, ecartAttendu] of [
  [8, 151628, 151380, 248], [17, 213521, 213172, 349], [18, 160274, 160011, 263],
] as const) {
  const nous = allocationConge({ assiette, dateDepart: "2026-08-03", nForce: 16 }).montant;
  check(`ligne ${ligne} : notre montant est l'assiette entière (N plafonné à 16)`, nous === assiette, nous);
  check(`ligne ${ligne} : l'écart avec son DIPE vaut ${ecartAttendu} FCFA, et c'est accepté`,
    nous - sien === ecartAttendu, { nous, sien, ecart: nous - sien });
}
// Le facteur est commun aux trois lignes à QUATRE décimales — 0,9984. C'est ce qui prouvait
// qu'il s'agissait d'une règle et non de trois périodes de référence différentes.
//
// Il ne l'est PAS à cinq décimales (0,99836 / 0,99837 / 0,99836), et c'est cohérent : l'arrondi
// au franc du montant final disperse les rapports dans la cinquième décimale. C'est précisément
// la seule chose que la réponse « c'est un arrondi » explique — pas le facteur lui-même.
const rapports = [[151628, 151380], [213521, 213172], [160274, 160011]].map(([a, s]) => s / a);
check("les trois lignes partagent le même facteur à quatre décimales : 0,9984",
  new Set(rapports.map((x) => x.toFixed(4))).size === 1 && rapports[0].toFixed(4) === "0.9984",
  rapports.map((x) => x.toFixed(6)));
check("mais pas à cinq — la dispersion est l'effet de l'arrondi au franc",
  new Set(rapports.map((x) => x.toFixed(5))).size > 1, rapports.map((x) => x.toFixed(5)));

titre("Arrondis");
check("l'allocation est arrondie au franc", Number.isInteger(allocationConge({ assiette: 151628, dateDepart: "2026-01-01", nForce: 15.9738 }).montant));
check("le droit en jours est arrondi au jour",
  Number.isInteger(allocationConge({ assiette: 100000, dateDepart: "2026-01-01", nForce: 15.9738 }).droitJours));
// 1,5 × 15 = 22,5 → 23 : l'arrondi est au plus proche, à la hausse sur la demie.
check("22,5 jours deviennent 23, comme elle l'a dit",
  allocationConge({ assiette: 100000, dateDepart: "2026-01-01", nForce: 15 }).droitJours === 23);
check("une assiette nulle ne casse rien",
  allocationConge({ assiette: 0, dateDepart: "2026-01-01", nForce: 16 }).montant === 0);

// ===========================================================================
titre("Repérage du congé du mois");
const evs = [
  { type: "conge_paye", dateDebut: "2025-04-01", dateFin: "2025-04-22" },
  { type: "maladie", dateDebut: "2025-09-01", dateFin: "2025-09-03" },
  { type: "conge_paye", dateDebut: "2026-08-03", dateFin: "2026-08-28" },
];
const c = congePayeDuMois(evs, "2026-08");
check("le congé du mois est trouvé par sa date de DÉPART", c?.depart === "2026-08-03", c);
check("le retour du congé précédent est le LENDEMAIN de sa fin",
  c?.retourPrecedent === "2025-04-23", c);
check("une maladie n'est pas un congé payé", congePayeDuMois(evs, "2025-09") === null);
check("un mois sans départ ne rend rien", congePayeDuMois(evs, "2026-07") === null);
// Un congé à cheval ne doit pas produire DEUX allocations : seul le mois du départ compte.
check("le mois TRAVERSÉ par un congé parti le mois d'avant ne rend rien",
  congePayeDuMois([{ type: "conge_paye", dateDebut: "2026-06-25", dateFin: "2026-07-20" }], "2026-07") === null);
check("mais le mois du départ, oui",
  congePayeDuMois([{ type: "conge_paye", dateDebut: "2026-06-25", dateFin: "2026-07-20" }], "2026-06")?.depart === "2026-06-25");
check("au premier congé, il n'y a pas de retour précédent",
  congePayeDuMois([evs[0]], "2025-04")?.retourPrecedent === undefined);
check("le lendemain d'un 31 décembre est le 1er janvier", jourSuivant("2025-12-31") === "2026-01-01");
check("et celui d'un 28 février bissextile, le 29", jourSuivant("2024-02-28") === "2024-02-29");

if (echecs) { console.error(`\n${echecs} test(s) en échec`); process.exit(1); }
else console.log("\nTous les tests passent.");

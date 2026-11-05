// « Vue RH » du barème et tranches forfaitaires éditables : `npm run test:vuerh`
//
// L'enjeu de ces tests : la vue ne doit JAMAIS redéclarer une règle. Chaque chiffre affiché doit
// venir du barème ou du moteur, sinon la vue finira par mentir dès la première divergence — et
// c'est précisément ce qu'elle sert à éviter.
import {
  BAREME_DEFAUT, TDL_BAREME, RAV_BAREME, baremeInf, computeBulletin,
  tableVersTranches, trancheVersTable, validerTranches,
} from "../convex/lib/paie.ts";
import type { Bareme, SaisieMois, TrancheForfait } from "../convex/lib/paie.ts";
import { RUBRIQUES_DEFAUT } from "../convex/lib/rubriques.ts";
import {
  EXEMPLE_DEFAUT, assiettesExpliquees, cnpsExplique, exempleDeroule,
  irppExplique, plancherExplique, vueRH,
} from "../convex/lib/vueRH.ts";

let echecs = 0;
const check = (nom: string, cond: boolean, d?: unknown) => {
  if (cond) console.log("  ok  " + nom);
  else { console.error("  KO  " + nom, d ?? ""); echecs++; }
};
const titre = (s: string) => console.log(`\n— ${s}`);

/** Normalise les espaces insécables : la comparaison ne doit pas dépendre du caractère exact. */
const norm = (s: string) => s.replace(/[  ]/g, " ");

const vide: SaisieMois = {
  joursTravailles: 30, joursBase: 30, sanctions: 0, primesVariables: 0, transport: 0,
  primeAssiduite: 0, indemniteLogement: 0, heuresSup: 0, anciennete: 0, mutuellePct: 0,
  dettesSoins: 0, acompte: 0, absences: 0, congesPris: 0, congesAcquis: 0,
};

// ===========================================================================
titre("Aller-retour entre la table interne et les tranches stockées");
check("TDL : conversion puis retour à l'identique",
  JSON.stringify(trancheVersTable(tableVersTranches(TDL_BAREME))) === JSON.stringify(TDL_BAREME));
check("RAV : conversion puis retour à l'identique",
  JSON.stringify(trancheVersTable(tableVersTranches(RAV_BAREME))) === JSON.stringify(RAV_BAREME));
check("la tranche ouverte est stockée avec un seuil null",
  tableVersTranches(TDL_BAREME).at(-1)!.jusqua === null);
check("et redevient Infinity au retour", trancheVersTable(tableVersTranches(TDL_BAREME)).at(-1)![0] === Infinity);

titre("Contrôle des tranches saisies");
const ok: TrancheForfait[] = [{ jusqua: 62000, montant: 0 }, { jusqua: 100000, montant: 750 }, { jusqua: null, montant: 2500 }];
check("un barème bien formé ne lève rien", validerTranches(ok, "TDL").length === 0, validerTranches(ok, "TDL"));
check("une liste vide est refusée", validerTranches([], "TDL").length === 1);
check("la dernière tranche doit être ouverte",
  validerTranches([{ jusqua: 62000, montant: 0 }], "TDL").some((e) => e.includes("ouverte")));
check("un seuil non croissant est refusé — sinon il masque les suivants",
  validerTranches([{ jusqua: 100000, montant: 0 }, { jusqua: 62000, montant: 750 }, { jusqua: null, montant: 1 }], "TDL")
    .some((e) => e.includes("dépasser")));
check("une tranche ouverte au milieu est refusée",
  validerTranches([{ jusqua: null, montant: 0 }, { jusqua: null, montant: 750 }], "RAV")
    .some((e) => e.includes("dernière tranche peut être ouverte")));
check("un montant négatif est refusé",
  validerTranches([{ jusqua: 62000, montant: -1 }, { jusqua: null, montant: 0 }], "TDL")
    .some((e) => e.includes("négatif")));
check("le nom du barème apparaît dans le message", validerTranches([], "RAV")[0].includes("RAV"));

titre("Le moteur applique les tranches du BARÈME quand elles existent");
const perso: Bareme = {
  ...BAREME_DEFAUT,
  // Barème fictif : 9 999 FCFA de TDL dès 62 000, pour que l'effet soit indiscutable.
  tdlBareme: [{ jusqua: 62000, montant: 0 }, { jusqua: null, montant: 9999 }],
};
check("sans tranches, la table par défaut s'applique",
  computeBulletin(150000, vide, BAREME_DEFAUT).details.tdl === baremeInf(TDL_BAREME, 150000));
check("avec des tranches, ce sont elles qui gagnent",
  computeBulletin(150000, vide, perso).details.tdl === 9999,
  computeBulletin(150000, vide, perso).details.tdl);
check("le plancher continue de s'appliquer par-dessus",
  computeBulletin(55000, vide, perso).details.tdl === 0);
check("une liste vide retombe sur la table par défaut",
  computeBulletin(150000, vide, { ...BAREME_DEFAUT, tdlBareme: [] }).details.tdl === baremeInf(TDL_BAREME, 150000));

// ===========================================================================
titre("Les quatre assiettes expliquées depuis le catalogue réel");
const A = assiettesExpliquees(RUBRIQUES_DEFAUT);
check("quatre assiettes", A.length === 4);
check("chacune dit à quoi elle sert", A.every((x) => x.sertA.length > 10));
check("le brut contient toutes les rubriques de gain, hormis les indicatives",
  A[0].rubriques.length === RUBRIQUES_DEFAUT.filter((r) => r.sens === "gain" && !r.indicatif).length,
  { brut: A[0].rubriques.length, gains: RUBRIQUES_DEFAUT.filter((r) => r.sens === "gain").length });
check("le transport est dans le brut intermédiaire",
  A[1].rubriques.some((x) => x.includes("transport")));
check("le logement en est exclu", !A[1].rubriques.some((x) => x.includes("logement")));
check("mais il figure dans le cotisable", A[3].rubriques.some((x) => x.includes("logement")));
check("et le transport en est exclu", !A[3].rubriques.some((x) => x.includes("transport")));
check("le taxable mentionne l'avantage au forfait", A[2].rubriques.some((x) => x.includes("au forfait")));
check("le taux du forfait est repris du catalogue, pas réécrit", A[1].definition.includes("15 %"));

titre("IRPP : les tranches viennent du barème, converties en annuel");
const I = irppExplique(BAREME_DEFAUT);
check("l'abattement de 30 % est annoncé", I.some((r) => r.valeur === "30 %"));
check("l'abattement annuel est celui du barème", I.some((r) => norm(r.valeur).startsWith("500 000")));
check("il est signalé comme forfait UNIQUE, sans quotient familial",
  I.some((r) => r.fondement?.includes("quotient familial")));
check("la première tranche annuelle démarre à 0 et finit à 2 000 000",
  I.some((r) => norm(r.libelle).includes("De 0 FCFA à 2 000 000 FCFA")), I.map((r) => norm(r.libelle)));
check("la dernière tranche est ouverte", I.some((r) => r.libelle.startsWith("Au-delà de")));
check("le CAC est présent", I.some((r) => r.libelle.includes("Centimes")));

titre("CNPS : l'AT/MP dit sur quelle assiette il porte");
const C = cnpsExplique(BAREME_DEFAUT);
check("le plafond est celui du barème", norm(C[0].valeur) === "750 000 FCFA", C[0].valeur);
check("l'AT/MP annonce une assiette NON plafonnée (BAREME_DEFAUT)",
  C.at(-1)!.base?.includes("NON plafonné") === true, C.at(-1));
check("avec l'interrupteur, il annonce l'assiette plafonnée",
  cnpsExplique({ ...BAREME_DEFAUT, atmpPlafonne: true }).at(-1)!.base?.includes("PLAFONNÉ") === true);
check("sans groupe de risque, une réserve est affichée",
  C.at(-1)!.reserve?.includes("B5") === true, C.at(-1)!.reserve);
check("avec un groupe, la réserve disparaît et le taux suit",
  (() => { const x = cnpsExplique({ ...BAREME_DEFAUT, groupeRisqueAtmp: "B" }).at(-1)!;
           return x.reserve === undefined && x.valeur.includes("2.5"); })());

titre("Le plancher : sa portée est dite, car c'est la règle la plus mal comprise");
const P = plancherExplique(BAREME_DEFAUT);
check("le plancher du barème est repris", norm(P[0].valeur) === "62 000 FCFA", P[0].valeur);
check("la CNPS salariale est due dès le premier franc",
  P.some((r) => r.libelle.includes("CNPS") && r.valeur.includes("premier franc")));
check("les charges patronales aussi",
  P.some((r) => r.libelle.includes("patronales") && r.valeur.includes("premier franc")));
check("un barème sans plancher le dit, au lieu de laisser croire qu'il y en a un",
  plancherExplique({ ...BAREME_DEFAUT, seuilExoneration: undefined })[0].valeur === "aucun");

// ===========================================================================
titre("L'exemple déroulé est calculé par le MOTEUR, pas recopié");
const E = exempleDeroule(BAREME_DEFAUT);
const bul = computeBulletin(EXEMPLE_DEFAUT.salaireBase, {
  ...vide, anciennete: EXEMPLE_DEFAUT.anciennete, transport: EXEMPLE_DEFAUT.transport,
  primeAssiduite: EXEMPLE_DEFAUT.primeAssiduite, indemniteLogement: EXEMPLE_DEFAUT.indemniteLogement,
}, BAREME_DEFAUT);
const etape = (l: string) => E.etapes.find((x) => x.libelle === l)?.valeur;

check("6 entrées + les jours travaillés", E.entrees.length === 6);
check("salaire brut = celui du moteur", etape("Salaire brut") === bul.details.assiettes!.brut);
check("salaire taxable = celui du moteur", etape("Salaire taxable") === bul.details.assiettes!.taxable);
check("cotisable plafonné = celui du moteur",
  etape("Salaire cotisable plafonné") === bul.details.assiettes!.cotisablePlafonne);
check("IRPP = celui du moteur", etape("IRPP mensuel") === bul.details.irpp);
check("net = celui du moteur", etape("Net à payer") === bul.net);
check("le coût employeur = brut + charges patronales",
  etape("Coût pour l'employeur") === bul.details.assiettes!.brut + bul.details.chargesPatronales);
check("les étapes de total sont marquées", E.etapes.filter((x) => x.total).length >= 5);
check("chaque étape porte sa formule", E.etapes.every((x) => x.formule.length > 5));

titre("L'exemple suit le barème : changer le barème change l'exemple");
const sansCorrection: Bareme = { ...BAREME_DEFAUT, transportTaxable: undefined };
const E2 = exempleDeroule(sansCorrection);
const taxable1 = E.etapes.find((x) => x.libelle === "Salaire taxable")!.valeur;
const taxable2 = E2.etapes.find((x) => x.libelle === "Salaire taxable")!.valeur;
check("sans la correction du transport, le taxable baisse de 2 550",
  taxable1 - taxable2 === EXEMPLE_DEFAUT.transport, { taxable1, taxable2 });
check("la formule du cotisable reprend le plafond du barème",
  norm(E.etapes.find((x) => x.libelle === "Salaire cotisable plafonné")!.formule).includes("750 000"));

titre("Vue complète");
const V = vueRH(BAREME_DEFAUT, RUBRIQUES_DEFAUT);
check("les six sections sont présentes",
  V.assiettes.length > 0 && V.irpp.length > 0 && V.cnps.length > 0 &&
    V.autresRetenues.length > 0 && V.plancher.length > 0 && V.exemple.etapes.length > 0);
check("les forfaits reprennent les tables par défaut quand le barème n'en porte pas",
  V.forfaits.tdl.length === TDL_BAREME.length && V.forfaits.rav.length === RAV_BAREME.length);
check("et ceux du barème sinon", vueRH(perso, RUBRIQUES_DEFAUT).forfaits.tdl.length === 2);
check("les interrupteurs TDL/RAV sont repris", V.forfaits.tdlActif === true && V.forfaits.ravActif === true);
check("un barème qui désactive la TDL le montre",
  vueRH({ ...BAREME_DEFAUT, tdlActif: false }, RUBRIQUES_DEFAUT).autresRetenues
    .some((r) => r.libelle.includes("TDL") && r.valeur === "désactivée"));
check("la base de la TDL est bien le salaire de BASE, et c'est dit",
  V.autresRetenues.some((r) => r.libelle.includes("TDL") && r.base?.includes("de BASE")));
check("la base du CFC patronal suit l'interrupteur du barème",
  V.autresRetenues.some((r) => r.libelle.includes("patronale") && r.base === "Salaire brut") &&
    vueRH({ ...BAREME_DEFAUT, cfcPatronalEtFneSurBrut: undefined }, RUBRIQUES_DEFAUT).autresRetenues
      .some((r) => r.libelle.includes("patronale") && r.base === "Salaire taxable"));

if (echecs) { console.error(`\n${echecs} test(s) en échec`); process.exit(1); }
else console.log("\nTous les tests passent.");

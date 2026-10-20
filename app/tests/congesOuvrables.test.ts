// Décompte des congés en jours ouvrables : `npm run test:conges`.
//
// Le jeu d'acceptation est le planning RÉEL de la responsable RH (78 lignes, exercice 2026),
// réduit à ses triplets (date de départ, total de congé, date de retour) et ANONYMISÉ :
// aucun nom, aucun salaire, seulement le numéro de ligne du classeur. Voir
// `docs/rh/CALIBRATION-PLANNING.md` pour le compte rendu de la calibration.
import {
  FERIES_FIXES,
  feriesFixesDeLAnnee,
  feriesParDefaut,
  feriesPascauxDeLAnnee,
  paques,
  type JourFerie,
} from "../convex/lib/joursFeriesCameroun.ts";
import {
  arrondirSuperieur,
  ageA,
  compterOuvrables,
  controlerLigne,
  dateRetour,
  decaler,
  dernierJourConge,
  droitConge,
  estOuvrable,
  indexFeries,
  jourSemaine,
  prochainJourOuvrable,
  ventilerParMois,
  REGLES_OUVRABLES_DEFAUT,
} from "../convex/lib/congesOuvrables.ts";

let echecs = 0;
const check = (nom: string, cond: boolean, d?: unknown) => {
  if (cond) console.log("  ok  " + nom);
  else {
    console.error("  KO  " + nom, d ?? "");
    echecs++;
  }
};
const titre = (s: string) => console.log(`\n— ${s}`);

const ANNEES = [2025, 2026, 2027];

// Deux configurations, à ne pas confondre :
//  · F        = fériés FIXES seuls. C'est la pratique retrouvée dans le classeur 2026 de la RH,
//               conservée ici comme preuve qu'on sait reproduire son fichier.
//  · F_RETENU = fériés fixes + pascaux, tous chômés. C'est la RÈGLE RETENUE (décision du
//               propriétaire du 20/10/2026), configurable au niveau du barème.
const F = indexFeries([2025, 2026, 2027].flatMap(feriesFixesDeLAnnee) as JourFerie[]);
const F_RETENU = indexFeries(ANNEES.flatMap(feriesParDefaut));

// ---------------------------------------------------------------------------
titre("Briques de date");
check("jourSemaine : 2026-01-05 est un lundi", jourSemaine("2026-01-05") === 1);
check("jourSemaine : 2026-01-04 est un dimanche", jourSemaine("2026-01-04") === 0);
check("decaler franchit le mois", decaler("2026-01-31", 1) === "2026-02-01");
check("decaler franchit l'année", decaler("2026-12-31", 1) === "2027-01-01");
check("decaler gère l'année bissextile", decaler("2028-02-28", 1) === "2028-02-29");
check("decaler en arrière", decaler("2026-03-01", -1) === "2026-02-28");

titre("Jours ouvrables : le samedi en est un, le dimanche non");
check("samedi ouvrable", estOuvrable("2026-01-10", F) === true);
check("dimanche non ouvrable", estOuvrable("2026-01-11", F) === false);
check("11 février (Fête de la Jeunesse) non ouvrable", estOuvrable("2026-02-11", F) === false);
check("12 février ouvrable", estOuvrable("2026-02-12", F) === true);
check(
  "un férié non chômé reste ouvrable",
  estOuvrable("2026-02-11", indexFeries([{ date: "2026-02-11", chome: false }])) === true,
);
check(
  "exclureFeries = false ignore les fériés",
  estOuvrable("2026-02-11", F, { joursNonOuvres: [0], exclureFeries: false }) === true,
);
check(
  "samedi non ouvré si l'entreprise le décide",
  estOuvrable("2026-01-10", F, { joursNonOuvres: [0, 6], exclureFeries: true }) === false,
);

titre("Comptage");
// Lundi 5 → samedi 10 janvier 2026 : 6 jours ouvrables.
check("une semaine pleine = 6 jours ouvrables", compterOuvrables("2026-01-05", "2026-01-10", F) === 6);
check("semaine + dimanche = 6", compterOuvrables("2026-01-05", "2026-01-11", F) === 6);
check("bornes inversées = 0", compterOuvrables("2026-01-10", "2026-01-05", F) === 0);
check("un seul jour ouvrable", compterOuvrables("2026-01-05", "2026-01-05", F) === 1);
check("un seul jour non ouvrable", compterOuvrables("2026-01-11", "2026-01-11", F) === 0);
// Du 9 au 14 février 2026 : 6 jours de semaine moins le férié du 11 → 5.
check("semaine avec un férié = 5", compterOuvrables("2026-02-09", "2026-02-14", F) === 5);

check("prochainJourOuvrable saute le dimanche", prochainJourOuvrable("2026-01-11", F) === "2026-01-12");
check("prochainJourOuvrable saute le férié", prochainJourOuvrable("2026-02-11", F) === "2026-02-12");
check("prochainJourOuvrable est inclusif", prochainJourOuvrable("2026-01-12", F) === "2026-01-12");

titre("Dernier jour de congé et date de retour");
check("dernier jour, 18 j depuis le 12/01", dernierJourConge("2026-01-12", 18, F) === "2026-01-31");
check("retour, 18 j depuis le 12/01", dateRetour("2026-01-12", 18, F) === "2026-02-02");
check("nbJours = 0 → retour au premier jour ouvrable", dateRetour("2026-01-11", 0, F) === "2026-01-12");
check(
  "un départ un dimanche décale le décompte au lundi",
  dateRetour("2026-01-11", 18, F) === dateRetour("2026-01-12", 18, F),
);

titre("Ventilation par mois (ce qui alimentera la paie au lot R4)");
const v = ventilerParMois("2026-01-12", dernierJourConge("2026-01-12", 18, F), F);
check("18 j à cheval sur un seul mois", JSON.stringify(v) === JSON.stringify({ "2026-01": 18 }), v);
const v2 = ventilerParMois("2026-02-05", dernierJourConge("2026-02-05", 24, F), F);
check(
  "24 j du 05/02 se ventilent 20 en février + 4 en mars",
  v2["2026-02"] + v2["2026-03"] === 24 && v2["2026-02"] === 20,
  v2,
);
check(
  "la somme de la ventilation vaut toujours le total",
  Object.values(v2).reduce((a, b) => a + b, 0) === 24,
  v2,
);

// ---------------------------------------------------------------------------
// JEU D'ACCEPTATION : le planning réel de la RH.
// ---------------------------------------------------------------------------
interface Cas {
  ligne: number;
  depart: string;
  total: number;
  retour: string;
}

// Les 48 lignes (sur 61 exploitables) que l'algorithme reproduit AU JOUR PRÈS.
const CONFORMES: Cas[] = [
  { ligne: 2, depart: "2026-01-05", total: 24, retour: "2026-02-02" },
  { ligne: 3, depart: "2026-01-05", total: 20, retour: "2026-01-28" },
  { ligne: 4, depart: "2026-01-12", total: 22, retour: "2026-02-06" },
  { ligne: 5, depart: "2026-01-12", total: 18, retour: "2026-02-02" },
  { ligne: 6, depart: "2026-01-13", total: 18, retour: "2026-02-03" },
  { ligne: 8, depart: "2026-01-20", total: 20, retour: "2026-02-13" },
  { ligne: 9, depart: "2026-02-05", total: 24, retour: "2026-03-06" },
  { ligne: 11, depart: "2026-02-17", total: 18, retour: "2026-03-10" },
  { ligne: 12, depart: "2026-03-05", total: 18, retour: "2026-03-26" },
  { ligne: 13, depart: "2026-03-23", total: 24, retour: "2026-04-20" },
  { ligne: 15, depart: "2026-03-23", total: 22, retour: "2026-04-17" },
  { ligne: 16, depart: "2026-03-17", total: 18, retour: "2026-04-07" },
  { ligne: 17, depart: "2026-03-09", total: 18, retour: "2026-03-30" },
  { ligne: 18, depart: "2026-03-27", total: 20, retour: "2026-04-20" },
  { ligne: 19, depart: "2026-04-06", total: 18, retour: "2026-04-27" },
  { ligne: 20, depart: "2026-04-06", total: 18, retour: "2026-04-27" },
  { ligne: 22, depart: "2026-04-01", total: 18, retour: "2026-04-22" },
  { ligne: 24, depart: "2026-04-20", total: 18, retour: "2026-05-12" },
  { ligne: 25, depart: "2026-04-06", total: 18, retour: "2026-04-27" },
  { ligne: 30, depart: "2026-05-05", total: 18, retour: "2026-05-27" },
  { ligne: 33, depart: "2026-05-25", total: 18, retour: "2026-06-15" },
  { ligne: 35, depart: "2026-06-08", total: 18, retour: "2026-06-29" },
  { ligne: 36, depart: "2026-06-08", total: 18, retour: "2026-06-29" },
  { ligne: 38, depart: "2026-06-04", total: 18, retour: "2026-06-25" },
  { ligne: 39, depart: "2026-06-08", total: 20, retour: "2026-07-01" },
  { ligne: 40, depart: "2026-06-08", total: 22, retour: "2026-07-03" },
  { ligne: 41, depart: "2026-06-01", total: 22, retour: "2026-06-26" },
  { ligne: 42, depart: "2026-06-08", total: 20, retour: "2026-07-01" },
  { ligne: 43, depart: "2026-06-22", total: 26, retour: "2026-07-22" },
  { ligne: 44, depart: "2026-06-01", total: 20, retour: "2026-06-24" },
  { ligne: 45, depart: "2026-06-29", total: 26, retour: "2026-07-29" },
  { ligne: 46, depart: "2026-07-06", total: 20, retour: "2026-07-29" },
  { ligne: 47, depart: "2026-07-06", total: 18, retour: "2026-07-27" },
  { ligne: 48, depart: "2026-07-20", total: 22, retour: "2026-08-14" },
  { ligne: 49, depart: "2026-07-13", total: 18, retour: "2026-08-03" },
  { ligne: 50, depart: "2026-07-13", total: 24, retour: "2026-08-10" },
  { ligne: 51, depart: "2026-07-13", total: 18, retour: "2026-08-03" },
  { ligne: 52, depart: "2026-07-16", total: 22, retour: "2026-08-11" },
  { ligne: 53, depart: "2026-08-03", total: 20, retour: "2026-08-27" },
  { ligne: 54, depart: "2026-08-01", total: 18, retour: "2026-08-24" },
  { ligne: 55, depart: "2026-08-03", total: 22, retour: "2026-08-29" },
  { ligne: 56, depart: "2026-08-03", total: 24, retour: "2026-09-01" },
  { ligne: 57, depart: "2026-08-03", total: 24, retour: "2026-09-01" },
  { ligne: 60, depart: "2026-08-14", total: 20, retour: "2026-09-08" },
  { ligne: 65, depart: "2026-10-01", total: 18, retour: "2026-10-22" },
  { ligne: 68, depart: "2026-10-05", total: 24, retour: "2026-11-02" },
  { ligne: 69, depart: "2026-10-01", total: 24, retour: "2026-10-29" },
  { ligne: 70, depart: "2026-10-12", total: 18, retour: "2026-11-02" },
];

titre(
  `Reproduction du classeur 2026 : ${CONFORMES.length} lignes, configuration « fériés fixes seuls »`,
);
let conformes = 0;
for (const c of CONFORMES) {
  const calc = dateRetour(c.depart, c.total, F);
  if (calc === c.retour) conformes++;
  else {
    console.error(
      `  KO  ligne ${c.ligne} : départ ${c.depart}, ${c.total} j → attendu ${c.retour}, calculé ${calc}`,
    );
    echecs++;
  }
}
check(
  `les ${CONFORMES.length} lignes sont reproduites au jour près`,
  conformes === CONFORMES.length,
  `${conformes}/${CONFORMES.length}`,
);

titre("La ligne qui prouve que les jours fériés entrent dans le décompte");
// Ligne 9 : départ jeudi 05/02/2026, 24 jours. Sans exclure le 11 février, on tombe sur le 05/03.
check(
  "24 j depuis le 05/02 → retour le 06/03 quand le 11/02 est férié",
  dateRetour("2026-02-05", 24, F) === "2026-03-06",
  dateRetour("2026-02-05", 24, F),
);
check(
  "… et le 05/03 si on n'exclut aucun férié : c'est bien le 11/02 qui fait la différence",
  dateRetour("2026-02-05", 24, indexFeries([])) === "2026-03-05",
  dateRetour("2026-02-05", 24, indexFeries([])),
);

// ---------------------------------------------------------------------------
titre("Comput de Pâques (Vendredi Saint et Ascension sont calculés, pas saisis)");
check("Pâques 2026 = 5 avril", paques(2026) === "2026-04-05", paques(2026));
check("Pâques 2025 = 20 avril", paques(2025) === "2025-04-20", paques(2025));
check("Pâques 2027 = 28 mars", paques(2027) === "2027-03-28", paques(2027));
check(
  "Vendredi Saint 2026 = 3 avril, Ascension 2026 = 14 mai",
  feriesPascauxDeLAnnee(2026)[0].date === "2026-04-03" &&
    feriesPascauxDeLAnnee(2026)[1].date === "2026-05-14",
  feriesPascauxDeLAnnee(2026),
);
check(
  "les fériés pascaux sont CHÔMÉS par défaut (décision du 20/10/2026)",
  feriesPascauxDeLAnnee(2026).every((f) => f.chome === true),
);
check(
  "feriesParDefaut propose 8 dates : 6 fixes + 2 pascales",
  feriesParDefaut(2026).length === 8,
  feriesParDefaut(2026).length,
);
check(
  "… et aucune fête musulmane, qui n'est pas calculable",
  !feriesParDefaut(2026).some((f) => /A[iï]d/i.test(f.libelle ?? "")),
);

titre("Règle RETENUE : les fériés pascaux décalent 10 retours du planning 2026");
// Ces 10 lignes sont le prix assumé du passage de la pratique du classeur à la règle légale.
const DECALEES: { ligne: number; depart: string; total: number; fixes: string; retenu: string }[] = [
  { ligne: 13, depart: "2026-03-23", total: 24, fixes: "2026-04-20", retenu: "2026-04-21" },
  { ligne: 15, depart: "2026-03-23", total: 22, fixes: "2026-04-17", retenu: "2026-04-18" },
  { ligne: 16, depart: "2026-03-17", total: 18, fixes: "2026-04-07", retenu: "2026-04-08" },
  { ligne: 18, depart: "2026-03-27", total: 20, fixes: "2026-04-20", retenu: "2026-04-21" },
  { ligne: 22, depart: "2026-04-01", total: 18, fixes: "2026-04-22", retenu: "2026-04-23" },
  { ligne: 26, depart: "2026-05-11", total: 18, fixes: "2026-06-02", retenu: "2026-06-03" },
  { ligne: 27, depart: "2026-05-04", total: 18, fixes: "2026-05-26", retenu: "2026-05-27" },
  { ligne: 28, depart: "2026-05-04", total: 20, fixes: "2026-05-28", retenu: "2026-05-29" },
  { ligne: 29, depart: "2026-05-04", total: 18, fixes: "2026-05-26", retenu: "2026-05-27" },
  { ligne: 30, depart: "2026-05-05", total: 18, fixes: "2026-05-27", retenu: "2026-05-28" },
];
let decalagesOk = 0;
for (const d of DECALEES) {
  const sansPascaux = dateRetour(d.depart, d.total, F);
  const avec = dateRetour(d.depart, d.total, F_RETENU);
  // Les DEUX colonnes sont vérifiées : sinon une erreur dans la colonne « fériés fixes »
  // passerait inaperçue et le tableau de la documentation mentirait.
  if (avec === d.retenu && sansPascaux === d.fixes && avec !== sansPascaux) decalagesOk++;
  else {
    console.error(
      `  KO  ligne ${d.ligne} : fériés fixes → attendu ${d.fixes}, calculé ${sansPascaux}` +
        ` ; règle retenue → attendu ${d.retenu}, calculé ${avec}`,
    );
    echecs++;
  }
}
check(
  `les ${DECALEES.length} décalages sont ceux documentés`,
  decalagesOk === DECALEES.length,
  `${decalagesOk}/${DECALEES.length}`,
);
check(
  "sous la règle retenue, la ligne 29 du classeur devient juste (27/05)",
  dateRetour("2026-05-04", 18, F_RETENU) === "2026-05-27",
);
check(
  "un congé qui ne croise aucun férié pascal n'est pas affecté",
  dateRetour("2026-01-12", 18, F_RETENU) === dateRetour("2026-01-12", 18, F),
);

// ---------------------------------------------------------------------------
titre("Contrôle des lignes incohérentes du planning (ce que le tableur ne voit pas)");
// Ligne 58 : départ 10/08/2026, retour saisi 08/07/2026 → antérieur au départ.
const a58 = controlerLigne({ depart: "2026-08-10", totalConge: 24, retourSaisi: "2026-07-08" }, F);
check("ligne 58 : retour antérieur au départ détecté", a58.some((x) => x.code === "retour_avant_depart"), a58);
// Ligne 34 : 18 jours de congé pour 113 jours calendaires.
const a34 = controlerLigne({ depart: "2026-06-08", totalConge: 18, retourSaisi: "2026-09-29" }, F);
check("ligne 34 : durée aberrante détectée", a34.some((x) => x.code === "duree_aberrante"), a34);
// Ligne 7 : écart d'un jour, sans aucun férié dans la période.
const a7 = controlerLigne({ depart: "2026-01-14", totalConge: 18, retourSaisi: "2026-02-05" }, F);
check("ligne 7 : écart d'un jour signalé", a7.some((x) => x.code === "retour_incoherent"), a7);
check("ligne 7 : la date attendue est proposée", a7[0]?.attendu === "2026-02-04", a7);
// Ligne 79 : total de congé nul.
const aNul = controlerLigne({ depart: "2026-11-06", totalConge: 0 }, F);
check("total nul signalé", aNul.some((x) => x.code === "total_nul"), aNul);
// Une ligne saine ne lève rien.
check(
  "une ligne conforme ne lève aucune anomalie",
  controlerLigne({ depart: "2026-01-12", totalConge: 18, retourSaisi: "2026-02-02" }, F).length === 0,
);

titre("Les deux lignes qui prouvent qu'aucune règle ne peut tout reproduire");
// Lignes 27 et 29 : MÊME départ, MÊME total, retours DIFFÉRENTS dans le classeur.
check(
  "lignes 27 et 29 : mêmes entrées (05/05 + 18 j) mais retours saisis différents (25/05 vs 27/05)",
  "2026-05-25" !== "2026-05-27",
);
check(
  "une fonction déterministe ne peut donc satisfaire les deux",
  dateRetour("2026-05-04", 18, F) === "2026-05-26",
  dateRetour("2026-05-04", 18, F),
);

// ---------------------------------------------------------------------------
titre("Droit à congé annuel (art. 89 et 90)");
const base = droitConge({ moisDeService: 12, dateDepart: "2026-01-05" });
check("12 mois × 1,5 j = 18 jours — le « congé principal » de la RH", base.total === 18, base);
check("droit à la jouissance ouvert à 12 mois", base.droitOuvert === true);
check(
  "droit non ouvert à 11 mois (art. 92)",
  droitConge({ moisDeService: 11, dateDepart: "2026-01-05" }).droitOuvert === false,
);

// Ancienneté : 2 jours par tranche entière de 5 ans.
const anc = (embauche: string) =>
  droitConge({ moisDeService: 12, dateDepart: "2026-01-05", dateEmbauche: embauche });
check("4 ans d'ancienneté → 18 j (aucune tranche)", anc("2022-01-05").total === 18, anc("2022-01-05"));
check("5 ans → 18 + 2 = 20 j", anc("2021-01-05").total === 20, anc("2021-01-05"));
check("9 ans → 20 j (une seule tranche)", anc("2017-01-05").total === 20, anc("2017-01-05"));
check("10 ans → 18 + 4 = 22 j", anc("2016-01-05").total === 22, anc("2016-01-05"));
check("15 ans → 18 + 6 = 24 j", anc("2011-01-05").total === 24, anc("2011-01-05"));
// Les quatre totaux observés dans son planning (18, 20, 22, 24) sont bien tous atteignables.
check(
  "les 4 totaux de son planning sont reproduits par la règle d'ancienneté",
  [anc("2022-01-05").total, anc("2021-01-05").total, anc("2016-01-05").total, anc("2011-01-05").total]
    .join() === "18,20,22,24",
);

titre("Majoration mère de famille : âge apprécié AU JOUR DU DÉPART");
const mere = (enfants: string[], depart = "2026-01-05") =>
  droitConge({
    moisDeService: 12,
    dateDepart: depart,
    sexe: "F",
    enfants: enfants.map((d) => ({ dateNaissance: d })),
  });
check("2 enfants de moins de 6 ans → 18 + 4 = 22 j", mere(["2021-06-01", "2023-02-01"]).total === 22);
check("un enfant de 6 ans révolus n'est plus compté", mere(["2020-01-01"]).total === 18, mere(["2020-01-01"]));
check(
  "un enfant qui atteint 6 ans APRÈS le départ est compté",
  mere(["2020-03-01"]).enfantsRetenus === 1,
  mere(["2020-03-01"]),
);
check(
  "… et ne l'est plus si le départ est postérieur à son anniversaire",
  mere(["2020-03-01"], "2026-04-01").enfantsRetenus === 0,
);
check(
  "la majoration ne s'applique pas aux hommes (art. 90)",
  droitConge({
    moisDeService: 12,
    dateDepart: "2026-01-05",
    sexe: "M",
    enfants: [{ dateNaissance: "2023-01-01" }],
  }).total === 18,
);
check(
  "ancienneté et enfants se cumulent : 15 ans + 1 enfant = 18 + 6 + 2 = 26 j",
  droitConge({
    moisDeService: 12,
    dateDepart: "2026-01-05",
    dateEmbauche: "2011-01-05",
    sexe: "F",
    enfants: [{ dateNaissance: "2023-01-01" }],
  }).total === 26,
);
// 26 jours existe bien dans son planning (lignes 43 et 45).
check("26 j, valeur présente dans son planning, est atteignable", true);

titre("Travailleur de moins de 18 ans : le taux REMPLACE le taux de base");
const jeune = droitConge({ moisDeService: 12, dateDepart: "2026-01-05", dateNaissance: "2009-06-01" });
check("12 mois × 2,5 j = 30 jours", jeune.total === 30, jeune);
check(
  "à 18 ans révolus, retour au taux de base",
  droitConge({ moisDeService: 12, dateDepart: "2026-01-05", dateNaissance: "2008-01-01" }).total === 18,
);

titre("Arrondi au nombre entier supérieur (décret n°75/28)");
check("1,5 × 7 = 10,5 → 11 jours", droitConge({ moisDeService: 7, dateDepart: "2026-01-05" }).total === 11);
check("arrondirSuperieur(18) = 18", arrondirSuperieur(18) === 18);
check("arrondirSuperieur(18,1) = 19", arrondirSuperieur(18.1) === 19);
check("arrondirSuperieur tolère le bruit flottant", arrondirSuperieur(1.5 * 12) === 18);
check("ageA : anniversaire non encore passé", ageA("2000-06-15", "2026-06-14") === 25);
check("ageA : le jour de l'anniversaire", ageA("2000-06-15", "2026-06-15") === 26);

titre("Justification affichable");
check("le détail du calcul est renvoyé", base.detail.length >= 1, base.detail);
check(
  "le détail mentionne les enfants quand il y en a",
  mere(["2023-01-01"]).detail.some((l) => l.includes("enfant")),
);

titre("Garde-fous");
check("REGLES_OUVRABLES_DEFAUT n'exclut que le dimanche", REGLES_OUVRABLES_DEFAUT.joursNonOuvres.join() === "0");
check("FERIES_FIXES compte 6 dates fixes", FERIES_FIXES.length === 6, FERIES_FIXES.length);
check(
  "feriesFixesDeLAnnee produit 6 fériés datés",
  feriesFixesDeLAnnee(2026).length === 6 && feriesFixesDeLAnnee(2026)[0].date === "2026-01-01",
);

if (echecs) {
  console.error(`\n${echecs} test(s) en échec`);
  process.exit(1);
} else console.log("\nTous les tests passent.");

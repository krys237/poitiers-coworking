// Échéances de contrat et rappels (demande N2) : `npm run test:echeances`
//
// Ce que ces tests verrouillent : la cadence demandée — un avis à un mois, puis chaque semaine,
// puis chaque jour la dernière semaine — et le fait qu'un contrat ÉCHU continue d'alerter. C'est
// le seul cas où l'inaction crée un engagement : un CDD arrivé à terme sans décision se
// requalifie en CDI.
import {
  CDD_MOIS_MAX, CDD_RENOUVELLEMENTS_MAX, LIBELLE_CADENCE, REGLES_RAPPEL_DEFAUT,
  aSuivre, cadence, controlerDureeCdd, doitRappeler, echeances, joursRestants,
  moisEntreDates, resumerEcheances,
} from "../convex/lib/echeancesContrat.ts";

let echecs = 0;
const check = (nom: string, cond: boolean, d?: unknown) => {
  if (cond) console.log("  ok  " + nom);
  else { console.error("  KO  " + nom, d ?? ""); echecs++; }
};
const titre = (s: string) => console.log(`\n— ${s}`);
const AUJ = "2026-11-06";

// ===========================================================================
titre("Jours restants");
check("une échéance dans 30 jours", joursRestants("2026-12-06", AUJ) === 30);
check("le jour même vaut 0", joursRestants(AUJ, AUJ) === 0);
check("une échéance passée est négative", joursRestants("2026-11-01", AUJ) === -5);
check("le passage de mois est correct", joursRestants("2026-12-01", AUJ) === 25);
check("le passage d'année aussi", joursRestants("2027-01-06", AUJ) === 61);

// ===========================================================================
titre("La cadence exacte qu'elle a demandée");
check("les défauts sont 30 / 30 / 7",
  REGLES_RAPPEL_DEFAUT.premierAvisJours === 30
    && REGLES_RAPPEL_DEFAUT.hebdoDepuisJours === 30
    && REGLES_RAPPEL_DEFAUT.quotidienDepuisJours === 7);
check("chaque cadence a son libellé", Object.keys(LIBELLE_CADENCE).length === 5);

// LE test de la demande : quels jours un rappel part-il, du 45e jour au dépassement.
const jours = [45, 31, 30, 29, 28, 22, 21, 15, 14, 8, 7, 4, 1, 0, -1, -10];
const quiRappelle = jours.filter((r) => doitRappeler(r).rappel);
check("les rappels tombent à 30, 28, 21, 14, puis chaque jour de la dernière semaine, puis tous les jours après",
  quiRappelle.join() === "30,28,21,14,7,4,1,0,-1,-10", quiRappelle);
check("rien avant 30 jours", !doitRappeler(45).rappel && !doitRappeler(31).rappel);
check("le premier avis tombe PILE à 30 jours", doitRappeler(30).rappel);
// Sans ce traitement à part, le premier rappel serait tombé à 28 jours : l'avis « un mois avant »
// qu'elle a demandé serait arrivé deux jours en retard.
check("et il s'annonce comme un premier avis, pas comme un rappel hebdomadaire",
  doitRappeler(30).cadence === "ponctuelle" && doitRappeler(30).raison.includes("Premier avis"),
  doitRappeler(30));
check("à 29 jours, pas de rappel, mais le prochain est annoncé",
  !doitRappeler(29).rappel && doitRappeler(29).raison.includes("28 jours"), doitRappeler(29));
check("l'hebdomadaire s'ancre sur l'ÉCHÉANCE : 28, 21, 14",
  [28, 21, 14].every((r) => doitRappeler(r).rappel && doitRappeler(r).cadence === "hebdomadaire"));
check("les jours intermédiaires ne rappellent pas",
  [27, 22, 15, 9].every((r) => !doitRappeler(r).rappel));

titre("La dernière semaine : tous les jours");
check("de 7 à 0, un rappel chaque jour",
  [7, 6, 5, 4, 3, 2, 1, 0].every((r) => doitRappeler(r).rappel && doitRappeler(r).cadence === "quotidienne"));
check("le dernier jour le dit autrement — la décision ne peut plus attendre",
  doitRappeler(0).raison.includes("Dernier jour"), doitRappeler(0).raison);

titre("Une échéance DÉPASSÉE continue d'alerter — c'est l'essentiel");
check("elle alerte le lendemain", doitRappeler(-1).rappel && doitRappeler(-1).cadence === "depassee");
check("et encore dix jours après", doitRappeler(-10).rappel);
check("le message dit le risque : sans décision, le contrat se poursuit de fait",
  doitRappeler(-3).raison.includes("se poursuit de fait"), doitRappeler(-3).raison);
check("et compte les jours de retard", doitRappeler(-3).raison.includes("3 jour"));

titre("La cadence est configurable");
const large = { premierAvisJours: 60, hebdoDepuisJours: 30, quotidienDepuisJours: 10 };
check("un premier avis à 60 jours", doitRappeler(60, large).rappel);
check("entre 60 et 31, aucune alerte au-delà du premier avis",
  cadence(45, large) === "ponctuelle" && !doitRappeler(45, large).rappel);
check("l'hebdomadaire ne commence qu'à 30", cadence(30, large) === "hebdomadaire");
check("le quotidien dès 10 jours", cadence(10, large) === "quotidienne" && doitRappeler(9, large).rappel);
check("avec ces réglages, 8 jours rappelle — alors qu'il ne rappelait pas par défaut",
  doitRappeler(8, large).rappel && !doitRappeler(8).rappel);

// ===========================================================================
titre("Mois entiers entre deux dates");
check("du 15 janvier au 15 juillet : 6 mois", moisEntreDates("2026-01-15", "2026-07-15") === 6);
check("un jour de moins : 5 mois", moisEntreDates("2026-01-15", "2026-07-14") === 5);
check("une année pleine : 12 mois", moisEntreDates("2026-03-01", "2027-03-01") === 12);
check("une fin antérieure vaut 0", moisEntreDates("2026-07-01", "2026-01-01") === 0);

titre("Durée d'un CDD : 6 mois, renouvelable une fois");
check("les plafonds sont 6 et 1", CDD_MOIS_MAX === 6 && CDD_RENOUVELLEMENTS_MAX === 1);
check("6 mois ne lèvent rien",
  controlerDureeCdd({ dateDebut: "2026-01-01", dateFin: "2026-07-01" }).avertissements.length === 0);
// 12 mois : régulier s'il s'agit du renouvellement, irrégulier d'un seul trait. Les dates seules
// ne permettent pas de trancher — d'où les deux messages distincts.
const douzeSansRenouv = controlerDureeCdd({ dateDebut: "2026-01-01", dateFin: "2027-01-01" });
check("12 mois d'un seul trait sont signalés", douzeSansRenouv.avertissements.length === 1, douzeSansRenouv);
check("et le message propose la lecture correcte : cocher le renouvellement",
  douzeSansRenouv.avertissements[0].includes("cochez"), douzeSansRenouv.avertissements[0]);
const douzeRenouv = controlerDureeCdd({ dateDebut: "2026-01-01", dateFin: "2027-01-01", renouvele: true });
check("12 mois marqués renouvelés sont acceptés, avec un avis",
  douzeRenouv.avertissements.length === 1 && douzeRenouv.avertissements[0].includes("plus aucun"),
  douzeRenouv.avertissements);
const trop = controlerDureeCdd({ dateDebut: "2026-01-01", dateFin: "2027-08-01" });
check("au-delà de 12 mois, le risque est nommé",
  trop.avertissements[0].includes("requalification en CDI"), trop.avertissements[0]);
check("une fin avant le début est signalée",
  controlerDureeCdd({ dateDebut: "2026-07-01", dateFin: "2026-01-01" })
    .avertissements.some((a) => a.includes("précède")));
check("un renouvellement court prévient qu'il n'en restera plus",
  controlerDureeCdd({ dateDebut: "2026-01-01", dateFin: "2026-04-01", renouvele: true })
    .avertissements.some((a) => a.includes("plus aucun renouvellement")));
check("les plafonds sont surchargeables",
  controlerDureeCdd({ dateDebut: "2026-01-01", dateFin: "2027-01-01", moisMax: 12 }).avertissements.length === 0);

// ===========================================================================
titre("La liste des échéances : la plus urgente d'abord");
const contrats = [
  { id: "a", nom: "AAA", dateFin: "2026-12-20", contrat: "CDD" },   // 44 j → aucune
  { id: "b", nom: "BBB", dateFin: "2026-11-10", contrat: "CDD" },   // 4 j  → quotidienne
  { id: "c", nom: "CCC", dateFin: "2026-11-01", contrat: "CDD" },   // −5 j → dépassée
  { id: "d", nom: "DDD", dateFin: "2026-11-27", contrat: "CDD" },   // 21 j → hebdomadaire
];
const liste = echeances(contrats, AUJ);
check("l'échue est en tête", liste[0].id === "c", liste.map((e) => e.id));
check("puis la quotidienne", liste[1].id === "b");
check("puis l'hebdomadaire", liste[2].id === "d");
check("la lointaine en dernier", liste[3].id === "a");
check("chaque ligne porte sa raison", liste.every((e) => e.raison.length > 10));
check("et dit si un rappel tombe aujourd'hui",
  liste.filter((e) => e.rappelAujourdhui).map((e) => e.id).join() === "c,b,d",
  liste.filter((e) => e.rappelAujourdhui).map((e) => e.id));
// Un contrat lointain reste dans la liste : la RH veut voir ce qui vient, pas seulement ce qui
// brûle. C'est `rappelAujourdhui` qui distingue les deux.
check("le contrat lointain n'est pas retiré, il est juste sans rappel",
  liste[3].cadence === "aucune" && !liste[3].rappelAujourdhui);

titre("Le résumé");
const r = resumerEcheances(liste);
check("quatre suivis", r.suivis === 4);
check("une dépassée", r.depassees === 1, r);
check("une dans la semaine", r.cetteSemaine === 1, r);
check("trois rappels aujourd'hui", r.rappelsDuJour === 3, r);
check("une liste vide ne casse rien", resumerEcheances([]).suivis === 0);

titre("Ce qui est suivi");
check("un contrat avec une date de fin est suivi", aSuivre({ dateFin: "2026-12-01" }));
check("sans date de fin, rien à rappeler", !aSuivre({ contrat: "CDD" }));
check("une fiche désactivée n'est plus suivie", !aSuivre({ dateFin: "2026-12-01", actif: false }));
// Un CDI avec une date de fin existe — un départ programmé — et mérite le même suivi.
check("un CDI à date de fin est suivi aussi", aSuivre({ contrat: "CDI", dateFin: "2026-12-01" }));

if (echecs) { console.error(`\n${echecs} test(s) en échec`); process.exit(1); }
else console.log("\nTous les tests passent.");

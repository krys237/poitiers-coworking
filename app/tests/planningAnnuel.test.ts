// Planning annuel : chevauchements par service, frise, observations.
// `npm run test:planning`
import {
  COULEUR_NEUTRE,
  LIBELLE_OBSERVATION,
  OBSERVATIONS,
  OBSERVATION_CONSOMME,
  PALETTE_SERVICES,
  couleurServiceParDefaut,
  detecterChevauchements,
  doublonsEmploye,
  graduationsMois,
  joursDeLAnnee,
  observationDeduite,
  segmentFrise,
  type CongePose,
} from "../convex/lib/planningAnnuel.ts";
import { feriesParDefaut } from "../convex/lib/joursFeriesCameroun.ts";
import { indexFeries } from "../convex/lib/congesOuvrables.ts";

let echecs = 0;
const check = (nom: string, cond: boolean, d?: unknown) => {
  if (cond) console.log("  ok  " + nom);
  else {
    console.error("  KO  " + nom, d ?? "");
    echecs++;
  }
};
const titre = (s: string) => console.log(`\n— ${s}`);

const F = indexFeries(feriesParDefaut(2026));

const conge = (
  id: string,
  employeId: string,
  depart: string,
  dernierJour: string,
  serviceId?: string,
): CongePose => ({
  id,
  employeId,
  employeNom: employeId.toUpperCase(),
  serviceId,
  serviceNom: serviceId ? `Service ${serviceId}` : undefined,
  depart,
  dernierJour,
});

// ---------------------------------------------------------------------------
titre("Palette des services");
check("8 teintes, dans un ordre fixe", PALETTE_SERVICES.length === 8);
check("la 1ʳᵉ est le bleu validé", PALETTE_SERVICES[0] === "#2a78d6");
check("couleur du 1er service", couleurServiceParDefaut(0) === "#2a78d6");
check("couleur du 8e service", couleurServiceParDefaut(7) === "#e34948");
check(
  "le 9e service NE génère PAS une teinte : il reçoit le neutre",
  couleurServiceParDefaut(8) === COULEUR_NEUTRE && couleurServiceParDefaut(42) === COULEUR_NEUTRE,
);
check("aucune teinte dupliquée", new Set(PALETTE_SERVICES).size === 8);

// ---------------------------------------------------------------------------
titre("Chevauchements : le besoin réel derrière la couleur par service");
// Deux personnes d'IMAGERIE se recouvrent du 10 au 15.
const c1 = detecterChevauchements([
  conge("a", "e1", "2026-03-02", "2026-03-15", "imagerie"),
  conge("b", "e2", "2026-03-10", "2026-03-20", "imagerie"),
]);
check("un chevauchement détecté", c1.length === 1, c1);
check("intersection du 10 au 15 mars", c1[0]?.debut === "2026-03-10" && c1[0]?.fin === "2026-03-15", c1[0]);
check("effectif simultané = 2", c1[0]?.effectif === 2, c1[0]);
check("les deux employés sont nommés", c1[0]?.employeIds.join() === "e1,e2", c1[0]);

// Deux personnes de services DIFFÉRENTS ne se gênent pas.
check(
  "deux services différents ne produisent aucun chevauchement",
  detecterChevauchements([
    conge("a", "e1", "2026-03-02", "2026-03-15", "imagerie"),
    conge("b", "e2", "2026-03-10", "2026-03-20", "hospi"),
  ]).length === 0,
);
// Congés sans service : on ne sait pas qui ils privent, on ne compare pas.
check(
  "les congés sans service sont ignorés",
  detecterChevauchements([
    conge("a", "e1", "2026-03-02", "2026-03-15"),
    conge("b", "e2", "2026-03-10", "2026-03-20"),
  ]).length === 0,
);
// Congés jointifs mais non recouvrants.
check(
  "deux congés jointifs (fin le 9, début le 10) ne se chevauchent pas",
  detecterChevauchements([
    conge("a", "e1", "2026-03-02", "2026-03-09", "imagerie"),
    conge("b", "e2", "2026-03-10", "2026-03-20", "imagerie"),
  ]).length === 0,
);
// Un seul jour commun suffit.
check(
  "un seul jour commun est détecté",
  detecterChevauchements([
    conge("a", "e1", "2026-03-02", "2026-03-10", "imagerie"),
    conge("b", "e2", "2026-03-10", "2026-03-20", "imagerie"),
  ]).length === 1,
);

titre("Seuil d'alerte configurable");
const trois = [
  conge("a", "e1", "2026-03-01", "2026-03-20", "hospi"),
  conge("b", "e2", "2026-03-05", "2026-03-25", "hospi"),
  conge("c", "e3", "2026-03-10", "2026-03-12", "hospi"),
];
check("à seuil 2, le chevauchement couvre tout l'intervalle commun", detecterChevauchements(trois, 2).length === 1);
const s3 = detecterChevauchements(trois, 3);
check("à seuil 3, seul le cœur du 10 au 12 est signalé", s3.length === 1 && s3[0].debut === "2026-03-10" && s3[0].fin === "2026-03-12", s3);
check("… avec un effectif de 3", s3[0]?.effectif === 3, s3[0]);
check("à seuil 4, plus rien", detecterChevauchements(trois, 4).length === 0);
check(
  "un service où une seule personne part n'est jamais signalé",
  detecterChevauchements([conge("a", "e1", "2026-03-01", "2026-03-20", "labo")]).length === 0,
);

titre("Le cas réel : 4 départs groupés début janvier, services différents");
// Lignes 2 à 6 du planning : 4 personnes parties les 05 et 12/01, toutes de services distincts.
check(
  "aucune alerte, car aucun service n'est vidé",
  detecterChevauchements([
    conge("l2", "e2", "2026-01-05", "2026-01-31", "parametres"),
    conge("l3", "e3", "2026-01-05", "2026-01-27", "technique"),
    conge("l4", "e4", "2026-01-12", "2026-02-05", "admin"),
    conge("l5", "e5", "2026-01-12", "2026-01-31", "imagerie"),
  ]).length === 0,
);
// Mais deux IMAGERIE en même temps, si.
const imagerie = detecterChevauchements([
  conge("l5", "e5", "2026-01-12", "2026-01-31", "imagerie"),
  conge("l70", "e70", "2026-01-20", "2026-02-10", "imagerie"),
]);
check("deux IMAGERIE simultanées déclenchent l'alerte", imagerie.length === 1, imagerie);
check("intersection du 20 au 31 janvier", imagerie[0]?.debut === "2026-01-20" && imagerie[0]?.fin === "2026-01-31", imagerie[0]);

titre("Doublons de saisie sur un même employé");
const d = doublonsEmploye([
  conge("a", "e1", "2026-03-02", "2026-03-15", "hospi"),
  conge("b", "e1", "2026-03-10", "2026-03-20", "hospi"),
]);
check("un même employé en congé deux fois sur la même période est signalé", d.length === 1, d);
check(
  "deux congés disjoints du même employé ne sont pas des doublons",
  doublonsEmploye([
    conge("a", "e1", "2026-03-02", "2026-03-15", "hospi"),
    conge("b", "e1", "2026-06-10", "2026-06-20", "hospi"),
  ]).length === 0,
);

// ---------------------------------------------------------------------------
titre("Frise annuelle");
check("2026 compte 365 jours", joursDeLAnnee(2026) === 365);
check("2028 est bissextile : 366 jours", joursDeLAnnee(2028) === 366);

const seg = segmentFrise(conge("a", "e1", "2026-01-01", "2026-01-31", "hospi"), 2026, F);
check("janvier commence à 0 %", seg?.gauchePct === 0, seg);
check("31 jours sur 365 = 8,49 %", Math.abs((seg?.largeurPct ?? 0) - (31 / 365) * 100) < 1e-9, seg);
check("pas de troncature", seg?.tronqueAvant === false && seg?.tronqueApres === false);
check(
  "les jours ouvrables du segment excluent dimanches et fériés (janvier 2026 : 26)",
  seg?.joursOuvrables === 26,
  seg?.joursOuvrables,
);

const aCheval = segmentFrise(conge("b", "e1", "2025-12-20", "2026-01-10", "hospi"), 2026, F);
check("un congé à cheval est écrêté au 1er janvier", aCheval?.debut === "2026-01-01", aCheval);
check("… et signalé comme tronqué avant", aCheval?.tronqueAvant === true && aCheval?.tronqueApres === false);
const aChevalFin = segmentFrise(conge("c", "e1", "2026-12-20", "2027-01-10", "hospi"), 2026, F);
check("un congé qui dépasse est écrêté au 31 décembre", aChevalFin?.fin === "2026-12-31", aChevalFin);
check("… et signalé comme tronqué après", aChevalFin?.tronqueApres === true);
check(
  "un congé hors de l'année renvoie null",
  segmentFrise(conge("d", "e1", "2025-03-01", "2025-03-20", "hospi"), 2026, F) === null,
);
check(
  "le dernier jour de l'année atteint 100 %",
  Math.abs(
    (segmentFrise(conge("e", "e1", "2026-12-31", "2026-12-31", "hospi"), 2026, F)!.gauchePct +
      segmentFrise(conge("e", "e1", "2026-12-31", "2026-12-31", "hospi"), 2026, F)!.largeurPct) -
      100,
  ) < 1e-9,
);

titre("Graduations de la frise");
const g = graduationsMois(2026);
check("12 mois", g.length === 12);
check("janvier en tête, décembre en queue", g[0].libelle === "janv." && g[11].libelle === "déc.");
check("janvier démarre à 0 %", g[0].gauchePct === 0);
check(
  "les 12 largeurs totalisent 100 %",
  Math.abs(g.reduce((t, m) => t + m.largeurPct, 0) - 100) < 1e-9,
);
check("février 2026 compte 28 jours", Math.abs(g[1].largeurPct - (28 / 365) * 100) < 1e-9);
check("février 2028 compte 29 jours", Math.abs(graduationsMois(2028)[1].largeurPct - (29 / 366) * 100) < 1e-9);

// ---------------------------------------------------------------------------
titre("Observations (la colonne réclamée par la RH)");
check("8 valeurs", OBSERVATIONS.length === 8);
check("« RAS » du classeur = non_pris", LIBELLE_OBSERVATION.non_pris === "Non pris");
check("non_pris ne consomme pas de jours", OBSERVATION_CONSOMME.non_pris === false);
check("reporte ne consomme pas de jours", OBSERVATION_CONSOMME.reporte === false);
check("annule ne consomme pas de jours", OBSERVATION_CONSOMME.annule === false);
check("planifie ne consomme pas encore", OBSERVATION_CONSOMME.planifie === false);
check("pris consomme", OBSERVATION_CONSOMME.pris === true);
check("solde_au_depart consomme", OBSERVATION_CONSOMME.solde_au_depart === true);
check(
  "toutes les valeurs ont un libellé et une règle de consommation",
  OBSERVATIONS.every(([c]) => LIBELLE_OBSERVATION[c] && typeof OBSERVATION_CONSOMME[c] === "boolean"),
);

titre("Observation déduite des dates");
const c = { depart: "2026-03-10", dernierJour: "2026-03-31" };
check("avant le départ → planifié", observationDeduite(c, "2026-03-01") === "planifie");
check("le jour du départ → en cours", observationDeduite(c, "2026-03-10") === "en_cours");
check("pendant → en cours", observationDeduite(c, "2026-03-20") === "en_cours");
check("le dernier jour → en cours", observationDeduite(c, "2026-03-31") === "en_cours");
check("après → pris", observationDeduite(c, "2026-04-01") === "pris");

if (echecs) {
  console.error(`\n${echecs} test(s) en échec`);
  process.exit(1);
} else console.log("\nTous les tests passent.");

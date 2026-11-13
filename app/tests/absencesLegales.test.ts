// Absences légales : catalogue, rémunération, plafonds, service effectif. `npm run test:absences`
import {
  CLES_ABSENCE,
  CLES_HISTORIQUES,
  EVENEMENTS_FAMILIAUX,
  PLAFOND_EVENEMENTS_FAMILIAUX_AN,
  TYPES_ABSENCE,
  TYPE_ABSENCE,
  controlerAbsence,
  joursServiceEffectif,
  remunererAbsence,
} from "../convex/lib/absencesLegales.ts";

let echecs = 0;
const check = (nom: string, cond: boolean, d?: unknown) => {
  if (cond) console.log("  ok  " + nom);
  else { console.error("  KO  " + nom, d ?? ""); echecs++; }
};
const titre = (s: string) => console.log(`\n— ${s}`);

// ===========================================================================
titre("Catalogue");
check("11 types d'absence", TYPES_ABSENCE.length === 11, TYPES_ABSENCE.length);
check("les 4 clés historiques sont conservées : aucune donnée existante n'est invalidée",
  CLES_HISTORIQUES.every((c) => CLES_ABSENCE.includes(c)), CLES_HISTORIQUES);
check("chaque type cite son texte fondateur", TYPES_ABSENCE.every((t) => t.base.length > 10));
check("aucune clé dupliquée", new Set(CLES_ABSENCE).size === CLES_ABSENCE.length);

titre("Qui paie");
check("maternité : la CNPS, à 100 %",
  TYPE_ABSENCE.maternite.quiPaie === "cnps" && TYPE_ABSENCE.maternite.tauxRemuneration === 100);
check("accident du travail : la CNPS, aux 2/3",
  TYPE_ABSENCE.accident_travail.quiPaie === "cnps" &&
    Math.abs(TYPE_ABSENCE.accident_travail.tauxRemuneration - 200 / 3) < 1e-9);
check("chômage technique : l'employeur, dégressif",
  TYPE_ABSENCE.chomage_technique.quiPaie === "employeur" &&
    TYPE_ABSENCE.chomage_technique.tauxDegressifs?.join() === "50,40,35,30,25,20");
check("permission familiale : l'employeur, à 100 %",
  TYPE_ABSENCE.evenement_familial.quiPaie === "employeur" &&
    TYPE_ABSENCE.evenement_familial.tauxRemuneration === 100);
check("absence injustifiée et sans solde : personne ne paie",
  TYPE_ABSENCE.absence.quiPaie === "personne" && TYPE_ABSENCE.sans_solde.quiPaie === "personne");

titre("Service effectif (art. 89 al. 3) — ce qui acquiert du congé");
check("maladie, maternité, accident du travail et chômage technique en sont",
  ["maladie", "maternite", "accident_travail", "chomage_technique"].every((c) => TYPE_ABSENCE[c].serviceEffectif));
check("maladie plafonnée à 6 mois", TYPE_ABSENCE.maladie.plafondServiceEffectifJours === 180);
check("accident du travail NON plafonné", TYPE_ABSENCE.accident_travail.plafondServiceEffectifJours === undefined);
check("formation syndicale : 18 jours assimilés (art. 91)",
  TYPE_ABSENCE.formation_syndicale.serviceEffectif && TYPE_ABSENCE.formation_syndicale.plafondServiceEffectifJours === 18);
check("absence injustifiée, mise à pied et sans solde n'acquièrent rien",
  ["absence", "mise_a_pied", "sans_solde"].every((c) => !TYPE_ABSENCE[c].serviceEffectif));

titre("Imputation sur le congé annuel");
check("seul le congé payé s'impute sur le congé annuel",
  TYPES_ABSENCE.filter((t) => t.deductibleDuCongeAnnuel).map((t) => t.cle).join() === "conge_paye");
check("les permissions familiales ne s'imputent PAS (art. 89 al. 4)",
  !TYPE_ABSENCE.evenement_familial.deductibleDuCongeAnnuel);

// ===========================================================================
titre("Rémunération — salaire de référence 300 000, diviseur 30 (journalier 10 000)");
const o = { diviseurJournalier: 30 };

const mat = remunererAbsence("maternite", 10, 300000, o);
check("maternité : 100 000 à la charge de la CNPS, rien pour l'employeur",
  mat.partCnps === 100000 && mat.partEmployeur === 0, mat);
check("… et aucune retenue pour le salarié", mat.retenue === 0, mat.retenue);

const at = remunererAbsence("accident_travail", 30, 300000, o);
check("accident du travail : 2/3 de 300 000 = 200 000 par la CNPS", at.partCnps === 200000, at);
check("… le tiers restant apparaît en retenue", at.retenue === 100000, at.retenue);

const ct1 = remunererAbsence("chomage_technique", 30, 300000, { ...o, rangMois: 1 });
const ct6 = remunererAbsence("chomage_technique", 30, 300000, { ...o, rangMois: 6 });
check("chômage technique mois 1 : 50 % = 150 000", ct1.partEmployeur === 150000 && ct1.taux === 50, ct1);
check("chômage technique mois 6 : 20 % = 60 000", ct6.partEmployeur === 60000 && ct6.taux === 20, ct6);
check("au-delà du 6e mois, le taux reste à 20 %",
  remunererAbsence("chomage_technique", 30, 300000, { ...o, rangMois: 9 }).taux === 20);
check("le détail est affichable et mentionne le barème dégressif", ct1.detail.includes("dégressif"), ct1.detail);

const inj = remunererAbsence("absence", 3, 300000, o);
check("absence injustifiée : retenue intégrale de 30 000", inj.retenue === 30000 && inj.partEmployeur === 0, inj);

titre("Le diviseur journalier n'est PAS imposé par la loi (A-VERIFIER)");
check("diviseur 30 → 10 000/jour", remunererAbsence("absence", 1, 300000, { diviseurJournalier: 30 }).retenue === 10000);
check("diviseur 26 → 11 538/jour", remunererAbsence("absence", 1, 300000, { diviseurJournalier: 26 }).retenue === 11538);
check("diviseur 24 → 12 500/jour", remunererAbsence("absence", 1, 300000, { diviseurJournalier: 24 }).retenue === 12500);
check("un diviseur absent retombe sur 30", remunererAbsence("absence", 1, 300000, { diviseurJournalier: 0 }).retenue === 10000);
check("un type inconnu lève une erreur", (() => {
  try { remunererAbsence("inexistant", 1, 300000, o); return false; } catch { return true; }
})());

// ===========================================================================
titre("Plafonds légaux");
check("mise à pied : 9 jours refusés, plafond 8",
  controlerAbsence({ cle: "mise_a_pied", jours: 9 }).some((i) => i.code === "plafond_depasse"));
check("mise à pied : 8 jours acceptés", !controlerAbsence({ cle: "mise_a_pied", jours: 8 }).length);
check("maladie : 181 jours dépassent les 6 mois",
  controlerAbsence({ cle: "maladie", jours: 181 }).some((i) => i.code === "plafond_depasse"));
check("maternité : 98 jours acceptés (14 semaines)", !controlerAbsence({ cle: "maternite", jours: 98 }).length);
check("type inconnu signalé", controlerAbsence({ cle: "zzz", jours: 1 })[0]?.code === "type_inconnu");

titre("Plafond ANNUEL des permissions familiales : 10 jours ouvrables");
check("3 jours seuls passent", !controlerAbsence({ cle: "evenement_familial", jours: 3 }).length);
check("3 jours après 8 déjà pris dépassent le plafond annuel",
  controlerAbsence({ cle: "evenement_familial", jours: 3, cumulAnneeJours: 8 })
    .some((i) => i.code === "plafond_annuel_depasse"));
check("le message rappelle que le surplus n'est imputable qu'à la demande du salarié",
  controlerAbsence({ cle: "evenement_familial", jours: 3, cumulAnneeJours: 8 })[0].message.includes("demande du salarié"));
check("exactement 10 jours cumulés passent",
  !controlerAbsence({ cle: "evenement_familial", jours: 2, cumulAnneeJours: 8 }).length);
check("plafond annuel = 10", PLAFOND_EVENEMENTS_FAMILIAUX_AN === 10);

titre("Barème des événements familiaux (plancher du décret n°75/29)");
check("5 événements", EVENEMENTS_FAMILIAUX.length === 5);
check("mariage du travailleur 3 j, mariage d'un enfant 1 j",
  EVENEMENTS_FAMILIAUX.find((e) => e.cle === "mariage_travailleur")?.jours === 3 &&
    EVENEMENTS_FAMILIAUX.find((e) => e.cle === "mariage_enfant")?.jours === 1);
check("le total du barème (13 j) dépasse le plafond annuel (10 j) : le plafond prime",
  EVENEMENTS_FAMILIAUX.reduce((t, e) => t + e.jours, 0) > PLAFOND_EVENEMENTS_FAMILIAUX_AN);

titre("Justificatif");
check("maladie sans certificat est signalée",
  controlerAbsence({ cle: "maladie", jours: 5, justificatifFourni: false })
    .some((i) => i.code === "justificatif_manquant"));
check("le message nomme la pièce attendue",
  controlerAbsence({ cle: "maladie", jours: 5, justificatifFourni: false })[0].message.includes("médecin agréé"));
check("absence injustifiée n'exige aucun justificatif",
  !controlerAbsence({ cle: "absence", jours: 5, justificatifFourni: false }).length);

// ===========================================================================
titre("Jours de service effectif cumulés");
const se = joursServiceEffectif(
  [
    { cle: "maladie", jours: 200 },        // plafonné à 180
    { cle: "accident_travail", jours: 90 },// non plafonné
    { cle: "absence", jours: 5 },          // écarté
    { cle: "sans_solde", jours: 10 },      // écarté
  ],
  100,
);
check("total = 100 travaillés + 180 maladie + 90 AT = 370", se.total === 370, se.total);
check("20 jours de maladie écartés par le plafond",
  se.detail.find((d) => d.cle === "maladie")?.ecartes === 20, se.detail);
check("l'absence injustifiée est intégralement écartée",
  se.detail.find((d) => d.cle === "absence")?.retenus === 0);
check("le sans-solde est intégralement écarté",
  se.detail.find((d) => d.cle === "sans_solde")?.ecartes === 10);

const se2 = joursServiceEffectif(
  [{ cle: "maladie", jours: 100 }, { cle: "maladie", jours: 100 }],
  0,
);
check("le plafond de maladie se cumule sur plusieurs arrêts : 180 au total", se2.total === 180, se2.total);
check("le second arrêt n'en retient que 80", se2.detail[1].retenus === 80, se2.detail);

check("sans aucune absence, le service effectif vaut les jours travaillés",
  joursServiceEffectif([], 240).total === 240);

if (echecs) { console.error(`\n${echecs} test(s) en échec`); process.exit(1); }
else console.log("\nTous les tests passent.");

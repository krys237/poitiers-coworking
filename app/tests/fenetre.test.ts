import { estJourOuvrable, estDansFenetre, finFenetre, prochaineOuverture, instantDouala, dateDouala, pointsPour, pointsDuJour, heureDouala, dispenseDeFenetre, NIVEAU_DISPENSE_FENETRE, normaliserPoste, fenetrePour, evaluerFenetre, FENETRE_DEFAUT, type RegleFenetrePoste } from "../convex/lib/fenetre.ts";

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

// Niveaux >= 5 : dispense de créneau
check("seuil de dispense = niveau 5", NIVEAU_DISPENSE_FENETRE === 5);
check("employé niv. 1 : soumis à la fenêtre", !dispenseDeFenetre(1));
check("chef d'équipe niv. 2 : soumis à la fenêtre", !dispenseDeFenetre(2));
check("comptable niv. 3 : soumis à la fenêtre", !dispenseDeFenetre(3));
check("RH niv. 4 : soumis à la fenêtre", !dispenseDeFenetre(4));
check("DAF niv. 5 : dispensé de fenêtre", dispenseDeFenetre(5));
check("DG niv. 7 : dispensé de fenêtre", dispenseDeFenetre(7));
check("super admin niv. 8 : dispensé de fenêtre", dispenseDeFenetre(8));

// Invariant du 22/10/2026 : plusieurs comptes rendus pour une même journée, un seul point de présence.
// (Le tableau dit, pour chaque dépôt du jour pris dans l'ordre, s'il est tombé hors créneau.)
const total = (l: boolean[]) => pointsDuJour(l).reduce((t, p) => t + p, 0);
check("un dépôt dans le créneau = 1 point", total([false]) === 1);
check("un dépôt hors créneau = 0 point", total([true]) === 0);
check("deux dépôts hors créneau : toujours 0 point", total([true, true]) === 0);
check("deux dépôts dans le créneau : 1 point, pas 2", total([false, false]) === 1, pointsDuJour([false, false]));
check("hors créneau puis dans le créneau : la journée gagne son point", total([true, false]) === 1 && pointsDuJour([true, false])[1] === 1);
check("dans le créneau puis hors créneau : le point reste acquis", total([false, true]) === 1 && pointsDuJour([false, true])[0] === 1);
check("trois dépôts : jamais plus d'un point", total([true, false, false]) === 1);
check("journée sans dépôt : aucun point", pointsDuJour([]).length === 0);

// --- Lot C1 : fenêtre réglable par poste ----------------------------------------------------

// 1. Normalisation (§2.3) : casse, accents, apostrophe typographique, espaces multiples, bords.
check("normalisation : casse", normaliserPoste("Agent d'accueil") === "agent d'accueil");
check("normalisation : accents", normaliserPoste("Técnicien de Garde") === "tecnicien de garde", normaliserPoste("Técnicien de Garde"));
check("normalisation : apostrophe typographique", normaliserPoste("Agent d’accueil") === "agent d'accueil", normaliserPoste("Agent d’accueil"));
check("normalisation : espaces multiples et bords", normaliserPoste("  agent    d'accueil  ") === "agent d'accueil", normaliserPoste("  agent    d'accueil  "));
check("normalisation : poste absent/vide = chaîne vide", normaliserPoste(undefined) === "" && normaliserPoste(null) === "" && normaliserPoste("") === "" && normaliserPoste("   ") === "");

// 2. fenetrePour : règle du poste si elle correspond, sinon la générale ; poste vide/absent -> générale.
const regles: RegleFenetrePoste[] = [{ poste: "Agent d'accueil", ouverture: 8, fermeture: 22, samedi: true }];
check("fenetrePour : poste avec règle reçoit SA fenêtre", JSON.stringify(fenetrePour("agent d’accueil", FENETRE_DEFAUT, regles)) === JSON.stringify({ ouverture: 8, fermeture: 22, samedi: true }));
check("fenetrePour : poste sans règle reçoit la générale", JSON.stringify(fenetrePour("Technicien de garde", FENETRE_DEFAUT, regles)) === JSON.stringify(FENETRE_DEFAUT));
check("fenetrePour : poste vide reçoit la générale", JSON.stringify(fenetrePour("", FENETRE_DEFAUT, regles)) === JSON.stringify(FENETRE_DEFAUT));
check("fenetrePour : poste absent reçoit la générale", JSON.stringify(fenetrePour(undefined, FENETRE_DEFAUT, regles)) === JSON.stringify(FENETRE_DEFAUT));

// 3. La précédence (§2.1) : niveau >= 5 toujours dispensé, quelle que soit la règle de poste —
// même à 3h du matin un dimanche, hors de toute fenêtre imaginable.
const dim3h = instantDouala(2026, 9, 13, 3, 0); // dimanche 13 septembre 2026, 3h Douala
const reglage = { defaut: FENETRE_DEFAUT, regles };
const dafAccueil = evaluerFenetre(dim3h, { niveau: 5, poste: "agent d'accueil" }, reglage);
check("précédence : niveau 5 dispensé même hors de toute fenêtre", dafAccueil.dispense === true && dafAccueil.horsFenetre === false, dafAccueil);

// 4. Le même poste, à la même heure, mais niveau 1 : bien hors fenêtre (ni la règle de poste
// 8h-22h ni la générale ne couvrent 3h du matin un dimanche).
const employeAccueil = evaluerFenetre(dim3h, { niveau: 1, poste: "agent d'accueil" }, reglage);
check("précédence : niveau 1 au même poste/heure est hors fenêtre", employeAccueil.dispense === false && employeAccueil.horsFenetre === true, employeAccueil);

// 5. Le samedi : la règle de poste l'ouvre quand la générale ne l'ouvre pas, et réciproquement.
const sam9h = instantDouala(2026, 9, 12, 9, 0); // samedi 12 septembre 2026, 9h Douala
const posteSamediOui = evaluerFenetre(sam9h, { niveau: 1, poste: "agent d'accueil" }, reglage);
check("samedi : règle de poste (samedi: true) ouvre le samedi", posteSamediOui.horsFenetre === false, posteSamediOui);
const reglesSamediNon: RegleFenetrePoste[] = [{ poste: "Agent d'accueil", ouverture: 8, fermeture: 22, samedi: false }];
const posteSamediNon = evaluerFenetre(sam9h, { niveau: 1, poste: "agent d'accueil" }, { defaut: FENETRE_DEFAUT, regles: reglesSamediNon });
check("samedi : réciproquement, règle de poste (samedi: false) ferme le samedi", posteSamediNon.horsFenetre === true, posteSamediNon);
const genSamediOui = evaluerFenetre(sam9h, { niveau: 1, poste: "poste sans règle" }, { defaut: { ...FENETRE_DEFAUT, ouverture: 8, fermeture: 22, samedi: true }, regles });
check("samedi : la générale peut ouvrir le samedi quand le poste n'a pas de règle", genSamediOui.horsFenetre === false, genSamediOui);

// evaluerFenetre renvoie la fenêtre qui se serait appliquée même quand dispensé (usage indicatif).
check("evaluerFenetre : fenêtre renvoyée même en dispense = celle qui se serait appliquée", JSON.stringify(dafAccueil.fenetre) === JSON.stringify({ ouverture: 8, fermeture: 22, samedi: true }), dafAccueil.fenetre);

if (echecs) { console.error(`\n${echecs} test(s) en échec`); process.exit(1); } else console.log("\nTous les tests passent.");

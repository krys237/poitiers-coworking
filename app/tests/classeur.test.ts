// Lecture des classeurs Excel : `npm run test:classeur`.
//
// Verrouille ce qui a fait échouer l'import de l'effectif le 19/11/2026 : des en-têtes qui ne
// sont pas en première ligne, une forme de retour inattendue de la bibliothèque, et des dates
// qui doivent sortir au format de l'import et non à celui de la langue du navigateur.
import { normaliserGrille, trouverEnTetes, grilleVersLignes } from "../src/lib/classeur.ts";

let echecs = 0;
const check = (nom: string, cond: boolean, d?: unknown) => { if (cond) console.log("  ok  " + nom); else { console.error("  KO  " + nom, d ?? ""); echecs++; } };

// --- Forme du retour de la bibliothèque ---
// Observée en vrai : un tableau d'objets { sheet, data }, et non la grille attendue.
const parFeuille = [{ sheet: "fiche salaire", data: [["a", "b"], ["1", "2"]] }];
check("forme { sheet, data } ramenée à une grille", normaliserGrille(parFeuille).length === 2);
check("grille simple laissée telle quelle", normaliserGrille([["a", "b"], ["1", "2"]]).length === 2);
check("vide toléré", normaliserGrille([]).length === 0 && normaliserGrille(null).length === 0);
check("première feuille retenue quand il y en a plusieurs",
  normaliserGrille([{ sheet: "une", data: [["x"]] }, { sheet: "deux", data: [["y"], ["z"]] }]).length === 1);

// --- En-têtes qui ne sont pas en première ligne ---
// Le classeur de l'effectif porte un total en L1, un titre en L4, ses en-têtes en L5.
const reel = [
  [null, null, null, null, null, null, null, null, null, null, 3797.76],
  [], [],
  [null, null, "RECAPITULATIF SALAIRES"],
  ["MATRICULE INTERNE", "NOMS ET PRENOMS", "SERVICE", "SALAIRE DE BASE"],
  ["1", "AMEFFO LUCIE C.", "IMAGERIE RADIO", "100000"],
  [null, null, null, null],
  ["2", "ATCHEMO GENEVIEVE", "CAISSE PHARMACIE", "113200"],
];
check("ligne d'en-têtes trouvée en L5 malgré un total isolé en L1", trouverEnTetes(reel) === 4, trouverEnTetes(reel));
check("une ligne à cellule unique n'est pas prise pour des en-têtes", trouverEnTetes([["juste un total"], ["a", "b"], ["1", "2"]]) === 1);
check("aucun en-tête trouvable", trouverEnTetes([[""], [null]]) === -1);

const lignes = grilleVersLignes(reel);
check("lignes de données extraites, lignes vides sautées", lignes.length === 2, lignes.length);
check("clés = en-têtes du classeur", lignes[0]["NOMS ET PRENOMS"] === "AMEFFO LUCIE C.", lignes[0]);
check("valeurs numériques rendues en texte", lignes[1]["SALAIRE DE BASE"] === "113200");

// --- Dates ---
// `toLocaleDateString` dépend de la langue du navigateur : l'import n'accepte que AAAA-MM-JJ.
const avecDate = [["NOM", "EMBAUCHE"], ["X", new Date(2014, 0, 27)]];
check("date rendue au format AAAA-MM-JJ", grilleVersLignes(avecDate)[0]["EMBAUCHE"] === "2014-01-27",
  grilleVersLignes(avecDate)[0]["EMBAUCHE"]);
check("date de fin d'année non décalée par le fuseau",
  grilleVersLignes([["N", "D"], ["X", new Date(2023, 11, 31)]])[0]["D"] === "2023-12-31");

// --- Colonnes sans en-tête ---
check("colonne au titre vide ignorée, sans écraser les autres",
  Object.keys(grilleVersLignes([["A", "", "B"], ["1", "2", "3"]])[0]).join(",") === "A,B");

if (echecs) { console.error(`\n${echecs} test(s) en échec`); process.exit(1); } else console.log("\nTous les tests passent.");

// Lecture des fichiers importés : `npm run test:csv`.
//
// Ces fonctions décident si un import aboutit ou échoue en silence. Le 19/11/2026, l'écran
// Employés annonçait « Importer CSV / Excel » alors qu'aucune bibliothèque de tableur n'est
// embarquée, et toute erreur de lecture rejetait une promesse que personne n'écoutait : ni
// import, ni message. Ce qui est verrouillé ici, c'est la tolérance sur les en-têtes et la
// reconnaissance d'un classeur — les deux raisons pour lesquelles un fichier ne « passait pas ».
import { parseCsv, cleEntete, valeurColonne, estClasseurTableur, toFcfa } from "../src/lib/csv.ts";

let echecs = 0;
const check = (nom: string, cond: boolean, d?: unknown) => { if (cond) console.log("  ok  " + nom); else { console.error("  KO  " + nom, d ?? ""); echecs++; } };

// --- Clé d'en-tête ---
check("clé : casse ignorée", cleEntete("Matricule") === "matricule");
check("clé : accents retirés", cleEntete("Noms et prénoms") === "noms_et_prenoms");
check("clé : tirets et espaces multiples", cleEntete("Date  -  Début") === "date_debut", cleEntete("Date  -  Début"));
check("clé : bords rognés", cleEntete("  nom  ") === "nom");

// --- Lecture tolérante d'une colonne ---
const ligne = { "Noms et prénoms": "ABO Jean", "SALAIRE_BASE": "150 000", vide: "   ", societe: "sgc" };
check("colonne trouvée malgré accents et casse", valeurColonne(ligne, "nom", "noms_et_prenoms") === "ABO Jean");
check("première orthographe non vide retenue", valeurColonne(ligne, "salaire_base", "brut") === "150 000");
check("colonne absente = chaîne vide", valeurColonne(ligne, "cnps") === "");
check("colonne blanche traitée comme absente", valeurColonne(ligne, "vide", "societe") === "sgc");
check("valeur rognée", valeurColonne({ nom: "  X  " }, "nom") === "X");

// --- Reconnaissance d'un classeur ---
const PK = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
const OLE = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0]);
const TXT = new Uint8Array([0x6d, 0x61, 0x74, 0x72]); // "matr"
check("classeur reconnu par l'extension", estClasseurTableur("effectif.xlsx", TXT));
check("classeur reconnu malgré une extension .csv trompeuse", estClasseurTableur("effectif.csv", PK));
check("ancien .xls reconnu par sa signature", estClasseurTableur("vieux.csv", OLE));
check("un vrai CSV n'est pas pris pour un classeur", !estClasseurTableur("effectif.csv", TXT));

// --- Bout en bout : le fichier type, séparé par des points-virgules, avec BOM ---
const fichier = "﻿Matricule;Noms et prénoms;Societe;Salaire_base;Date_debut\nE001;ABO Jean;SGC;150 000;2024-03-01\nE002;BIYA Paule;SESAME;200000;2023-01-15\n";
const lignes = parseCsv(fichier);
check("deux lignes lues", lignes.length === 2, lignes.length);
check("BOM absorbé : le matricule est lu", valeurColonne(lignes[0], "matricule") === "E001", lignes[0]);
check("nom accentué lu", valeurColonne(lignes[1], "nom", "noms_et_prenoms") === "BIYA Paule");
check("montant avec espaces converti", toFcfa(valeurColonne(lignes[0], "salaire_base")) === 150000);

// Une seule colonne = séparateur non reconnu : l'écran doit pouvoir le DIRE, pas échouer en
// silence. On vérifie ici que le cas est détectable (une seule clé dans la ligne lue).
const malSepare = parseCsv("matricule|nom\nE001|ABO Jean\n");
check("séparateur inconnu : tout tient dans une colonne, donc détectable",
  Object.keys(malSepare[0] ?? {}).length === 1, Object.keys(malSepare[0] ?? {}));

if (echecs) { console.error(`\n${echecs} test(s) en échec`); process.exit(1); } else console.log("\nTous les tests passent.");

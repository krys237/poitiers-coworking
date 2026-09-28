// Numéros de téléphone / WhatsApp (convex/lib/telephone.ts) : indicatif obligatoire, mais un numéro
// copié depuis WhatsApp (marques de direction invisibles) ou saisi avec espaces insécables est accepté.
// Lancer : npm run test:telephone
import { erreurTelephone, normaliserTelephone, separerTelephone, formaterTelephone, avecIndicatif } from "../convex/lib/telephone.ts";

let ok = 0, ko = 0;
const verifie = (nom: string, cond: boolean) => { if (cond) ok++; else { ko++; console.log("ÉCHEC", nom); } };
const ATTENDU = "+237658207931";

verifie("tapé avec espaces", normaliserTelephone("+237 6 58 20 79 31") === ATTENDU);
verifie("copié depuis WhatsApp (U+202A … U+202C)", normaliserTelephone("\u202A+237 6 58 20 79 31\u202C") === ATTENDU);
verifie("  … sans message d'erreur", erreurTelephone("\u202A+237 6 58 20 79 31\u202C") === null);
verifie("espaces insécables", normaliserTelephone("+237\u00A06\u00A058\u00A020\u00A079\u00A031") === ATTENDU);
verifie("espace de largeur nulle", normaliserTelephone("+237\u200B658207931") === ATTENDU);
verifie("00 international", normaliserTelephone("00237 658 20 79 31") === ATTENDU);
verifie("sans indicatif : refusé", erreurTelephone("6 58 20 79 31") !== null);
verifie("trop court : refusé", erreurTelephone("+237 65") !== null);
verifie("affichage → relu à l'identique", normaliserTelephone(formaterTelephone(ATTENDU)) === ATTENDU);
const s = separerTelephone("\u202A+237 6 58 20 79 31\u202C");
verifie("séparation d'un numéro collé", s.indicatif === "237" && s.national === "658207931");
verifie("séparation 00…", separerTelephone("00237658207931").indicatif === "237");
verifie("numéro national → +237 ajouté", avecIndicatif("6 58 20 79 31") === ATTENDU);
verifie("numéro national avec 0 initial", avecIndicatif("0658207931") === ATTENDU);
verifie("numéro déjà complet gardé", avecIndicatif("+33 6 12 34 56 78") === "+33612345678");
verifie("vide reste vide", avecIndicatif("  ") === "");

console.log(`telephone : ${ok} contrôles OK, ${ko} échec(s)`);
if (ko) process.exit(1);

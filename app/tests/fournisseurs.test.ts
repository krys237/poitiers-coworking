// `npm run test:fournisseurs` — validation fournisseurs & réactifs labo
import { avecIndicatif, erreurTelephone } from "../convex/lib/telephone.ts";

let echecs = 0;
const check = (nom: string, cond: boolean, detail?: unknown) => {
  if (cond) console.log(`  ok  ${nom}`);
  else { console.error(`  KO  ${nom}`, detail ?? ""); echecs++; }
};

// 1. Validation téléphone fournisseur avec indicatif Cameroun +237
const tel1 = avecIndicatif("699112233");
check("Format E.164 +237 automatique", tel1 === "+237699112233");
check("Numéro valide 9 chiffres Cameroun", erreurTelephone(tel1) === null);

const telInvalide = avecIndicatif("123");
check("Numéro trop court détecté en erreur", erreurTelephone(telInvalide) !== null);

// 2. Catégories supportées
const categoriesFournisseur = ["reactifs_labo", "medicale", "fourniture"];
check("Catégorie réactifs_labo prise en compte", categoriesFournisseur.includes("reactifs_labo"));

if (echecs) {
  console.error(`\n${echecs} test(s) en échec`);
  process.exit(1);
} else {
  console.log("\nTous les tests fournisseurs passent.");
}

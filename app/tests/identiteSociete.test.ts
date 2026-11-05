// Identité juridique par société : `npm run test:identite`
//
// Ce que ces tests protègent : un contrat de travail signé par SOFINA ne doit JAMAIS porter le
// numéro de registre du commerce de SESAME. Ce sont des personnes morales distinctes, et une
// fausse identification de l'employeur vicie l'acte.
import { erreurIdentiteSociete, identitePourSociete } from "../convex/lib/societes.ts";

let echecs = 0;
const check = (nom: string, cond: boolean, d?: unknown) => {
  if (cond) console.log("  ok  " + nom);
  else { console.error("  KO  " + nom, d ?? ""); echecs++; }
};
const titre = (s: string) => console.log(`\n— ${s}`);

const ENTREPRISE = {
  nom: "POLYCLINIQUE DE POITIERS",
  adresse: "Douala",
  niu: "M110800026452Z",
  numeroCnps: "123456",
  dirigeant: "M. TCHIDJO KENMEGNIE MAGLOIRE",
  registreCommerce: "RC/DLA/2008/B/2361",
};

// ===========================================================================
titre("Sans rien de propre, tout est repris de l'entreprise");
const nue = identitePourSociete("SOFINA", undefined, ENTREPRISE);
check("la raison sociale retombe sur l'entreprise", nue.raisonSociale === ENTREPRISE.nom);
check("le n° de registre du commerce aussi", nue.registreCommerce === ENTREPRISE.registreCommerce);
check("le dirigeant aussi", nue.dirigeant === ENTREPRISE.dirigeant);
check("les six champs sont signalés comme hérités", nue.heritesDeLEntreprise.length === 6, nue.heritesDeLEntreprise);
check("rien ne manque", nue.manquants.length === 0, nue.manquants);
check("la société est conservée", nue.societe === "SOFINA");

titre("Une identité propre prévaut — c'est tout l'enjeu");
const propre = identitePourSociete("SOFINA", [
  { societe: "SOFINA", raisonSociale: "SOFINA SARL", registreCommerce: "RC/DLA/2012/B/9988", dirigeant: "Mme NGONO" },
  { societe: "SESAME", registreCommerce: "RC/DLA/2008/B/2361" },
], ENTREPRISE);
check("sa raison sociale est la sienne", propre.raisonSociale === "SOFINA SARL");
check("son n° de registre du commerce est le sien", propre.registreCommerce === "RC/DLA/2012/B/9988");
check("son dirigeant est le sien", propre.dirigeant === "Mme NGONO");
check("le RC d'une AUTRE société ne fuit jamais", propre.registreCommerce !== "RC/DLA/2008/B/2361");
check("ce qu'elle ne porte pas est repris, et signalé",
  propre.heritesDeLEntreprise.join() === "adresse,niu,numeroCnps", propre.heritesDeLEntreprise);

titre("Le repli est champ par champ, pas en bloc");
const partielle = identitePourSociete("SGC", [{ societe: "SGC", niu: "M9999" }], ENTREPRISE);
check("le champ renseigné est pris", partielle.niu === "M9999");
check("les autres retombent sur l'entreprise", partielle.registreCommerce === ENTREPRISE.registreCommerce);
check("une ligne existante n'efface donc rien", partielle.dirigeant === ENTREPRISE.dirigeant);

titre("Les blancs ne comptent pas pour des valeurs");
const blancs = identitePourSociete("SGC", [{ societe: "SGC", registreCommerce: "   ", dirigeant: "" }], ENTREPRISE);
check("une suite d'espaces ne remplace pas l'entreprise",
  blancs.registreCommerce === ENTREPRISE.registreCommerce);
check("une chaîne vide non plus", blancs.dirigeant === ENTREPRISE.dirigeant);

titre("Ce qui manque partout est annoncé, pas caché");
const vide = identitePourSociete("SESAME", undefined, { nom: "POLYCLINIQUE" });
check("le n° de registre du commerce est listé manquant",
  vide.manquants.includes("registreCommerce"), vide.manquants);
check("le dirigeant aussi", vide.manquants.includes("dirigeant"));
check("il ressort vide, et non inventé", vide.registreCommerce === "");
check("la raison sociale connue n'est pas listée manquante",
  !vide.manquants.includes("raisonSociale"));

titre("Faute de tout, le code de la société identifie encore l'émetteur");
const rien = identitePourSociete("SGC", undefined, {});
check("la raison sociale vaut le code de la société", rien.raisonSociale === "SGC");
check("et n'est donc pas comptée manquante", !rien.manquants.includes("raisonSociale"));
check("mais le reste reste manquant", rien.manquants.length === 5, rien.manquants);

titre("Une société inconnue des paramètres n'emprunte pas l'identité d'une autre");
const inconnue = identitePourSociete("SESAME", [
  { societe: "SOFINA", registreCommerce: "RC/DLA/2012/B/9988" },
], ENTREPRISE);
check("SESAME ne prend pas le RC de SOFINA", inconnue.registreCommerce === ENTREPRISE.registreCommerce);

// ===========================================================================
titre("Contrôle de saisie");
check("une société hors liste est refusée",
  erreurIdentiteSociete({ societe: "AUTRE" }, []) !== null);
check("un doublon est refusé — l'identité dépendrait de l'ordre du tableau",
  erreurIdentiteSociete({ societe: "SGC" }, [{ societe: "SGC" }]) !== null);
check("une ligne valide passe", erreurIdentiteSociete({ societe: "SGC" }, [{ societe: "SOFINA" }]) === null);
check("tous les champs restent facultatifs",
  erreurIdentiteSociete({ societe: "SESAME" }, []) === null);

if (echecs) { console.error(`\n${echecs} test(s) en échec`); process.exit(1); }
else console.log("\nTous les tests passent.");

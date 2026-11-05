// Générateur d'actes RH : `npm run test:actes`
import {
  LIBELLE_FAMILLE, MARGE_HAUTE_ENTETE, MODELES_DEFAUT,
  champsManquants, construireReference, jetonsDuCorps, prochaineSequence,
  rendreActe, validerModele,
} from "../convex/lib/actes.ts";

let echecs = 0;
const check = (nom: string, cond: boolean, d?: unknown) => {
  if (cond) console.log("  ok  " + nom);
  else { console.error("  KO  " + nom, d ?? ""); echecs++; }
};
const titre = (s: string) => console.log(`\n— ${s}`);
const modele = (code: string) => MODELES_DEFAUT.find((m) => m.code === code)!;

// ===========================================================================
titre("Catalogue des modèles");
check("les 13 modèles de son classeur", MODELES_DEFAUT.length === 13, MODELES_DEFAUT.length);
check("aucun code en double",
  new Set(MODELES_DEFAUT.map((m) => m.code)).size === MODELES_DEFAUT.length);
check("quatre familles nommées", Object.keys(LIBELLE_FAMILLE).length === 4);
check("chaque modèle appartient à une famille connue",
  MODELES_DEFAUT.every((m) => m.famille in LIBELLE_FAMILLE));
check("chaque modèle a un corps non vide", MODELES_DEFAUT.every((m) => m.corps.trim().length > 50));

titre("Cohérence : tout jeton a son champ, tout champ sert");
for (const m of MODELES_DEFAUT) {
  const e = validerModele(m);
  check(`« ${m.libelle} » est cohérent`, e.length === 0, e);
}

titre("Le contrôle de cohérence attrape bien les défauts");
check("un jeton sans champ est signalé",
  validerModele({ ...modele("ATT_REPRISE"), corps: "Bonjour {{inconnu}}" })
    .some((e) => e.includes("{{inconnu}}")));
check("un champ qui ne sert pas est signalé",
  validerModele({ ...modele("ATT_REPRISE"), corps: "{{nom}}" })
    .some((e) => e.includes("n'apparaît pas")));
check("un {{reference}} sans format est signalé",
  validerModele({ ...modele("ATT_REPRISE"), corps: "{{nom}} {{reference}} {{dateReprise}} {{date}} {{signataire}}", formatReference: undefined })
    .some((e) => e.includes("format de référence")));

// ===========================================================================
titre("Rendu : un trou non rempli reste un trou, et non du vide");
const rendu = rendreActe("Je soussigné {{signataire}} atteste que {{nom}} …", { signataire: "La RH" });
check("le jeton rempli est remplacé", rendu.includes("La RH"));
check("le jeton vide devient des pointillés, comme dans ses modèles Word",
  rendu.includes("……………………"), rendu);
check("une chaîne d'espaces compte comme vide",
  rendreActe("{{x}}", { x: "   " }).includes("……………………"));
check("un zéro n'est PAS traité comme vide — c'est un montant légitime",
  rendreActe("{{x}} FCFA", { x: "0" }) === "0 FCFA");
check("les jetons inconnus du modèle sont tout de même traités",
  !rendreActe("{{zzz}}", {}).includes("{{"));
check("un corps sans jeton est rendu tel quel",
  rendreActe("Texte simple.", {}) === "Texte simple.");

titre("Extraction des jetons");
check("sans doublon et dans l'ordre",
  jetonsDuCorps("{{a}} {{b}} {{a}} {{c}}").join() === "a,b,c");
check("aucun jeton sur un texte nu", jetonsDuCorps("rien ici").length === 0);

// ===========================================================================
titre("Champs obligatoires");
const att = modele("ATT_REPRISE");
check("tout vide → les obligatoires sont listés", champsManquants(att, {}).length > 0);
check("un champ facultatif n'est jamais réclamé",
  !champsManquants(modele("ATT_SALAIRE"), {}).some((c) => c.obligatoire === false));
const complet: Record<string, string> = {};
for (const c of att.champs) complet[c.nom] = "x";
check("tout rempli → plus rien ne manque", champsManquants(att, complet).length === 0);
check("un espace ne vaut pas une valeur",
  champsManquants(att, { ...complet, nom: "  " }).some((c) => c.nom === "nom"));

// ===========================================================================
titre("Références numérotées");
check("séquence sur 3 chiffres, mois et année",
  construireReference("{n}/PP/DAF/DRH/{mm}-{aaaa}", 7, "2026-11-05") === "007/PP/DAF/DRH/11-2026");
check("le second gabarit du classeur fonctionne aussi",
  construireReference("{n}/PP/MC/DAF/NG/{mm}-{aaaa}", 1, "2026-03-20") === "001/PP/MC/DAF/NG/03-2026");
check("une séquence à trois chiffres n'est pas tronquée",
  construireReference("{n}/X/{aaaa}", 142, "2026-01-01") === "142/X/2026");

titre("La séquence repart du plus haut, pas du nombre de lignes");
check("première de l'année", prochaineSequence([], 2026) === 1);
check("suit la plus haute", prochaineSequence(["001/PP/2026", "002/PP/2026"], 2026) === 3);
// Le défaut qu'a connu commandes.ts : après une suppression, compter les lignes réattribue
// une référence déjà portée.
check("un trou dans la suite ne réattribue PAS une référence existante",
  prochaineSequence(["001/PP/2026", "005/PP/2026"], 2026) === 6);
check("les autres années sont ignorées",
  prochaineSequence(["009/PP/2025"], 2026) === 1);
check("une référence hors format n'empêche pas de continuer",
  prochaineSequence(["bizarre-2026", "003/PP/2026"], 2026) === 4);

// ===========================================================================
titre("L'attestation de salaire est déjà un bulletin");
const sal = modele("ATT_SALAIRE");
const duBulletin = sal.champs.filter((c) => c.source.de === "bulletin");
check("seize montants viennent du bulletin, et non de la saisie", duBulletin.length === 16, duBulletin.length);
check("les quatre assiettes y figurent",
  ["taxable", "cotisable"].every((n) => sal.champs.some((c) => c.nom === n)));
check("le net perçu vient du bulletin",
  sal.champs.find((c) => c.nom === "net")?.source.de === "bulletin");
check("l'identité vient de la fiche employé",
  sal.champs.filter((c) => c.source.de === "employe").length >= 4);
check("seule la situation est saisie à la main",
  sal.champs.filter((c) => c.source.de === "saisie").length === 1,
  sal.champs.filter((c) => c.source.de === "saisie").map((c) => c.nom));

titre("Les quatre familles sont toutes servies");
for (const f of Object.keys(LIBELLE_FAMILLE)) {
  check(`famille « ${f} » pourvue`, MODELES_DEFAUT.some((m) => m.famille === f));
}
check("aucun ordre en double",
  new Set(MODELES_DEFAUT.map((m) => m.ordre)).size === MODELES_DEFAUT.length);

titre("Les trois contrats partagent le même en-tête d'identité");
const contrats = ["ENGAGEMENT_ESSAI", "CONTRAT_CDD", "CONTRAT_CDI"].map(modele);
check("les trois sont de la famille contrat", contrats.every((m) => m.famille === "contrat"));
for (const m of contrats) {
  check(`« ${m.libelle} » décrit l'employeur`, m.corps.includes("ci-après désigné l'employeur"));
  check(`« ${m.libelle} » décrit l'employé(e)`, m.corps.includes("ci-après dénommé(e) l'employé(e)"));
  check(`« ${m.libelle} » porte les deux signatures`, m.corps.includes("L'Employeur"));
}
// Le n° de registre du commerce n'est PAS figé : ses modèles en portent deux versions
// contradictoires (RC/DOUALA/2008/B/2014 et RC/DLA/2008/B/2361) pour la même société.
check("aucun contrat ne fige un n° de registre du commerce",
  contrats.every((m) => !/RC\//.test(m.corps)),
  contrats.filter((m) => /RC\//.test(m.corps)).map((m) => m.code));
check("aucun contrat ne fige le NIU",
  contrats.every((m) => !/M1108/.test(m.corps)));
check("les trois lisent l'identité juridique depuis les paramètres",
  contrats.every((m) =>
    ["niu", "registreCommerce", "dirigeant"].every((n) =>
      m.champs.find((c) => c.nom === n)?.source.de === "entreprise")));

titre("Le CDD porte les articles que le CDI a perdus");
const cdd = modele("CONTRAT_CDD"), cdi = modele("CONTRAT_CDI");
check("le CDD a un article « Des congés »", cdd.corps.includes("Des congés"));
check("le CDD a un article « De la protection sociale »", cdd.corps.includes("De la protection sociale"));
// Transcription fidèle : l'omission du CDI est conservée telle quelle, et consignée.
check("l'omission du CDI est conservée, non comblée en douce", !cdi.corps.includes("Des congés"));
// Sa numérotation Word est corrigée : son CDI portait DEUX articles « 5 ».
const numeros = [...cdi.corps.matchAll(/^Article (\d+) :/gm)].map((m) => +m[1]);
check("la numérotation du CDI est corrigée et continue",
  numeros.join() === "1,2,3,4,5,6", numeros);
const numCdd = [...cdd.corps.matchAll(/^Article (\d+) :/gm)].map((m) => +m[1]);
check("la numérotation du CDD va de 1 à 8", numCdd.join() === "1,2,3,4,5,6,7,8", numCdd);
check("seul le CDD est à durée déterminée", cdd.corps.includes("durée déterminée"));
check("le CDI est à durée indéterminée", cdi.corps.includes("durée indéterminée"));

titre("L'autorisation de stage est une fiche à deux visas, pas une lettre");
const autor = modele("STAGE_AUTORISATION");
check("elle porte les deux accords", autor.corps.includes("Accord du Service des Ressources Humaines")
  && autor.corps.includes("Accord de la Direction Générale"));
check("elle n'a donc ni « Fait le » ni signataire unique",
  !autor.champs.some((c) => c.nom === "date" || c.nom === "signataire"));
check("tous ses champs sont saisis à la main — aucun employé n'existe encore",
  autor.champs.every((c) => c.source.de === "saisie"));

titre("Le certificat de fin de stage est signé par le Directeur Général");
const certif = modele("STAGE_CERTIFICAT_FIN");
check("son signataire est le dirigeant, pas le visa RH",
  certif.champs.find((c) => c.nom === "signataire")?.source.cle === "dirigeant");
check("le corps le nomme Directeur Général", certif.corps.includes("Directeur Général"));
// Deux coquilles de son Word : « au 30 …… » et « Fait à douala » en minuscule.
check("le « 30 » parasite de son modèle n'est pas repris", !/au 30\s/.test(certif.corps));
check("Douala reprend sa majuscule", certif.corps.includes("Fait à Douala"));
check("c'est le seul acte non signé par la RH",
  MODELES_DEFAUT.filter((m) => m.champs.some((c) => c.nom === "signataire"
    && c.source.de === "entreprise" && c.source.cle !== "responsableRH")).length === 1);

titre("Mise en page");
check("la marge haute dégage le bandeau à en-tête mesuré (125 pt ≈ 44 mm)",
  MARGE_HAUTE_ENTETE === 125);

titre("Sources de pré-remplissage");
check("tous les champs déclarent une source",
  MODELES_DEFAUT.every((m) => m.champs.every((c) => !!c.source?.de)));
check("le signataire vient toujours des paramètres de l'entreprise, jamais de la saisie",
  MODELES_DEFAUT.filter((m) => m.champs.some((c) => c.nom === "signataire"))
    .every((m) => m.champs.find((c) => c.nom === "signataire")!.source.de === "entreprise"));
check("la date du jour est automatique",
  MODELES_DEFAUT.filter((m) => m.champs.some((c) => c.nom === "date"))
    .every((m) => m.champs.find((c) => c.nom === "date")!.source.de === "aujourdhui"));

if (echecs) { console.error(`\n${echecs} test(s) en échec`); process.exit(1); }
else console.log("\nTous les tests passent.");

// Tests du multi-société (lot R2 bis) : `npm run test:societes`.
// Hors du dossier convex/ : Convex bundle tout ce dossier comme fonctions serveur.
//
// Deux choses sont vérifiées ici, et la seconde est la plus importante.
//
// 1. La LECTURE fonctionne avant comme après la migration : sans aucune ligne de rattachement,
//    c'est `employes.societe` qui fait foi, et les saisies déjà enregistrées — qui ne portent pas
//    de société — restent attribuées à la société porteuse de la fiche. Sans cela, la migration
//    ferait disparaître du travail déjà saisi.
//
// 2. Le calcul est bien fait PAR EMPLOYEUR, sans consolidation. C'est l'arbitrage du propriétaire
//    du 20/10/2026 (« SESAME déclare de son côté ») et sa conséquence assumée. Ces tests existent
//    pour qu'un futur passage ne la « corrige » pas en additionnant les rémunérations : cela
//    paraîtrait plus juste, et ce serait contraire à la décision.
import { computeBulletin, BAREME_DEFAUT } from "../convex/lib/paie.ts";
import type { SaisieMois } from "../convex/lib/paie.ts";
import {
  rattachementsEffectifs, societePrincipale, pourSociete, toutesPourSociete, masseParSociete, cleCouple,
} from "../convex/lib/societes.ts";
import type { FicheRattachable, RattachementBrut } from "../convex/lib/societes.ts";

let echecs = 0;
const check = (nom: string, cond: boolean, detail?: unknown) => {
  if (cond) console.log(`  ok  ${nom}`);
  else { console.error(`  KO  ${nom}`, detail ?? ""); echecs++; }
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. Lecture compatible : avant et après la migration
// ─────────────────────────────────────────────────────────────────────────────

const fiche: FicheRattachable = {
  societe: "SGC", salaireBase: 158000, joursBase: 30,
  matricule: "E001", cnps: "0421 7788 1", dateDebut: "2021-03-01",
};

const sansLignes = rattachementsEffectifs(fiche, []);
check("aucune ligne : un seul rattachement, celui de la fiche", sansLignes.length === 1, sansLignes);
check("aucune ligne : la société est celle de la fiche", sansLignes[0].societe === "SGC");
check("aucune ligne : l'origine est marquée « fiche »", sansLignes[0].origine === "fiche");
check("aucune ligne : le salaire de base vient de la fiche", sansLignes[0].salaireBase === 158000);

const lignes: RattachementBrut[] = [
  { _id: "r1", societe: "SGC", salaireBase: 110000, actif: true, principal: true },
  { _id: "r2", societe: "SESAME", salaireBase: 48000, actif: true },
  { _id: "r3", societe: "SOFINA", salaireBase: 90000, actif: false }, // rattachement clos
];

const effectifs = rattachementsEffectifs(fiche, lignes);
check("deux rattachements actifs sur trois lignes", effectifs.length === 2, effectifs.map((r) => r.societe));
check("le rattachement clos est écarté", !effectifs.some((r) => r.societe === "SOFINA"));
check("chaque rattachement porte SON salaire de base, pas celui de la fiche",
  effectifs.find((r) => r.societe === "SGC")?.salaireBase === 110000
  && effectifs.find((r) => r.societe === "SESAME")?.salaireBase === 48000, effectifs);
check("l'origine des lignes explicites est « table »", effectifs.every((r) => r.origine === "table"));

// Un rattachement déclaré sans montant sur une société AUTRE que celle de la fiche vaut 0 : la RH
// peut déclarer l'appartenance avant de chiffrer. Le bulletin correspondant sera donc à zéro —
// c'est voulu, mais il faut le savoir.
const sansMontant = rattachementsEffectifs(fiche, [
  { _id: "r4", societe: "SESAME", salaireBase: undefined, actif: true },
]);
check("appartenance déclarée sans montant : salaire de base à 0", sansMontant[0].salaireBase === 0, sansMontant);

// ─────────────────────────────────────────────────────────────────────────────
// 2. Société porteuse et rattachement des lignes antérieures
// ─────────────────────────────────────────────────────────────────────────────

check("société porteuse : la ligne marquée « principal »", societePrincipale(fiche, lignes) === "SGC");
check("société porteuse : à défaut, celle de la fiche", societePrincipale(fiche, []) === "SGC");
check("société porteuse : la ligne principale l'emporte sur la fiche",
  societePrincipale({ ...fiche, societe: "SOFINA" }, lignes) === "SGC");

// Une saisie mensuelle enregistrée AVANT ce lot ne porte pas de société.
const saisies = [
  { societe: undefined, joursTravailles: 26 },   // antérieure au lot
  { societe: "SESAME", joursTravailles: 12 },
];
check("ligne antérieure (sans société) : attribuée à la société porteuse",
  pourSociete(saisies, "SGC", "SGC")?.joursTravailles === 26);
check("ligne antérieure : JAMAIS attribuée à une autre société",
  pourSociete(saisies, "SOFINA", "SGC") === undefined);
check("ligne explicite : retrouvée par sa société",
  pourSociete(saisies, "SESAME", "SGC")?.joursTravailles === 12);

const primes = [
  { societe: undefined, montant: 5000 },
  { societe: undefined, montant: 3000 },
  { societe: "SESAME", montant: 7000 },
];
check("registre : toutes les lignes antérieures vont à la société porteuse",
  toutesPourSociete(primes, "SGC", "SGC").length === 2);
check("registre : une autre société ne récupère que ses propres lignes",
  toutesPourSociete(primes, "SESAME", "SGC").length === 1);

check("clé de couple stable", cleCouple("emp42", "SESAME") === "emp42:SESAME");
check("masse salariale : par société, jamais la somme de toutes",
  masseParSociete(effectifs, "SGC") === 110000 && masseParSociete(effectifs, "SESAME") === 48000);

// ─────────────────────────────────────────────────────────────────────────────
// 3. Le calcul est fait PAR EMPLOYEUR — l'arbitrage du 20/10/2026
// ─────────────────────────────────────────────────────────────────────────────

const vide: SaisieMois = {
  joursTravailles: 30, joursBase: 30, sanctions: 0, primesVariables: 0, transport: 0, primeAssiduite: 0,
  indemniteLogement: 0, heuresSup: 0, anciennete: 0, mutuellePct: 0, dettesSoins: 0, acompte: 0,
  absences: 0, congesPris: 0, congesAcquis: 0,
};

// Un pluri-employé payé 500 000 par deux sociétés. Chaque part reste SOUS le plafond CNPS de
// 750 000 ; leur somme le dépasse largement.
const partA = computeBulletin(500000, vide, BAREME_DEFAUT);
const partB = computeBulletin(500000, vide, BAREME_DEFAUT);
const consolide = computeBulletin(1000000, vide, BAREME_DEFAUT);

check("deux parts identiques donnent deux bulletins identiques", partA.net === partB.net && partA.brut === partB.brut);
check("chaque bulletin ne porte que SA part, pas le cumul", partA.brut === 500000, partA.brut);

// Le plafond CNPS s'applique à CHAQUE employeur. Comme aucune part ne l'atteint, aucune n'est
// écrêtée — alors qu'un calcul unique sur le cumul l'aurait été. La cotisation totale est donc
// SUPÉRIEURE à ce qu'un calcul consolidé aurait donné.
const cnpsSepare = partA.details.cnpsSalarie + partB.details.cnpsSalarie;
check("plafond CNPS : le calcul unique sur le cumul EST écrêté",
  consolide.details.cnpsSalarie < partA.details.cnpsSalarie * 2,
  { consolide: consolide.details.cnpsSalarie, deuxFoisUnePart: partA.details.cnpsSalarie * 2 });
check("plafond CNPS appliqué PAR EMPLOYEUR : la somme des deux dépasse le calcul consolidé",
  cnpsSepare > consolide.details.cnpsSalarie,
  { separe: cnpsSepare, consolide: consolide.details.cnpsSalarie });

// Les tranches de l'IRPP étant progressives, la séparation joue en sens INVERSE : deux bases
// moyennes sont moins taxées qu'une grosse. C'est l'autre face de la décision, et elle est
// assumée — ce test est là pour qu'on ne la découvre pas à la première déclaration.
const irppSepare = partA.details.irpp + partB.details.irpp;
check("tranches d'IRPP appliquées PAR EMPLOYEUR : la somme des deux est INFÉRIEURE au consolidé",
  irppSepare < consolide.details.irpp,
  { separe: irppSepare, consolide: consolide.details.irpp });

// Et le net total n'est pas celui d'un salaire unique du même montant : c'est la conséquence
// combinée des deux effets ci-dessus.
check("le net cumulé des deux bulletins diffère du net d'un salaire unique équivalent",
  partA.net + partB.net !== consolide.net,
  { cumule: partA.net + partB.net, unique: consolide.net });

if (echecs) { console.error(`\n${echecs} test(s) en échec`); process.exit(1); }
else console.log("\nTous les tests multi-société passent.");

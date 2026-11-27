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
  subitLesRetenues,
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

// Un rattachement déclaré sans montant sur une société AUTRE que celle de la fiche vaut ZÉRO.
//
// La règle précédente y appliquait le salaire de base de la fiche, « pour ne pas produire un
// bulletin à zéro entre-temps ». Elle produisait en réalité un SECOND BULLETIN À TAUX PLEIN : un
// employé à 158 000 chez SGC, déclaré chez SESAME sans montant, sortait deux bulletins de
// 158 000 — la paie doublée. Retournée le 25/11/2026 sur décision du propriétaire, après constat
// en production. Ce test est écrit en dur dans ce sens précisément pour que le repli ne revienne
// pas par mégarde.
const sansMontant = rattachementsEffectifs(fiche, [
  { _id: "r4", societe: "SESAME", salaireBase: undefined, actif: true },
]);
check("appartenance déclarée sans montant sur une société SECONDAIRE : zéro, pas le salaire de la fiche",
  sansMontant[0].salaireBase === 0, sansMontant);

// Le repli vaut en revanche TOUJOURS pour la société portée par la fiche : ce rattachement EST la
// fiche, et laisser diverger les deux montants ferait deux vérités pour le même salaire.
const principalSansMontant = rattachementsEffectifs(fiche, [
  { _id: "r5", societe: "SGC", salaireBase: undefined, actif: true, principal: true },
  { _id: "r6", societe: "SOFINA", salaireBase: undefined, actif: true },
]);
check("société de la fiche sans montant : repli sur le salaire de la fiche",
  principalSansMontant.find((r) => r.societe === "SGC")?.salaireBase === fiche.salaireBase,
  principalSansMontant);
check("société secondaire sans montant, en présence d'un principal : toujours zéro",
  principalSansMontant.find((r) => r.societe === "SOFINA")?.salaireBase === 0,
  principalSansMontant);

// Un montant EXPLICITE est toujours respecté, y compris 1 FCFA — c'est ainsi que la RH neutralise
// un second déclarant dont la part n'est pas encore arrêtée, et ce choix lui appartient.
const unFranc = rattachementsEffectifs(fiche, [
  { _id: "r7", societe: "SGC", salaireBase: 158000, actif: true, principal: true },
  { _id: "r8", societe: "SESAME", salaireBase: 1, actif: true },
]);
check("1 FCFA explicite sur un second déclarant : conservé tel quel",
  unFranc.find((r) => r.societe === "SESAME")?.salaireBase === 1, unFranc);
check("un montant explicite de 0 est conservé lui aussi",
  rattachementsEffectifs(fiche, [{ _id: "r9", societe: "SESAME", salaireBase: 0, actif: true }])[0].salaireBase === 0);

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

// ─────────────────────────────────────────────────────────────────────────────
// Déclarants exonérés de taxes et cotisations — décision du 27/11/2026.
// SESAME et SOFINA déduisent elles-mêmes : leur bulletin ne porte que le net.
// ─────────────────────────────────────────────────────────────────────────────
check("SESAME et SOFINA ne subissent pas les retenues",
  !subitLesRetenues("SESAME") && !subitLesRetenues("SOFINA"));
check("SGC les subit, elle",
  subitLesRetenues("SGC"));

const avecRetenues = computeBulletin(200000, { ...vide, joursTravailles: 30 }, BAREME_DEFAUT, {});
const sansRetenues = computeBulletin(200000, { ...vide, joursTravailles: 30 }, BAREME_DEFAUT, { sansRetenues: true });

check("le BRUT est le même : seules les retenues changent",
  avecRetenues.brut === sansRetenues.brut, { avec: avecRetenues.brut, sans: sansRetenues.brut });
check("exonéré : le net ÉGALE le brut",
  sansRetenues.net === sansRetenues.brut, { net: sansRetenues.net, brut: sansRetenues.brut });
check("et il y avait bien quelque chose à retirer",
  avecRetenues.net < avecRetenues.brut, { net: avecRetenues.net });
check("aucune charge salariale ni patronale",
  sansRetenues.chargesSalariales === 0 && sansRetenues.chargesPatronales === 0,
  { sal: sansRetenues.chargesSalariales, pat: sansRetenues.chargesPatronales });
check("les onze lignes restent PRÉSENTES, à zéro",
  sansRetenues.cotisations.length === avecRetenues.cotisations.length
  && ["43131", "44721", "44722", "44723", "44724", "44725", "66411", "66412", "66413", "64131", "64132"]
    .every((c) => sansRetenues.cotisations.find((l) => l.code === c)?.retenue === 0
      && (sansRetenues.cotisations.find((l) => l.code === c)?.chargePatronale ?? 0) === 0));

// Ce qui n'est NI taxe NI cotisation reste dû.
const avecAutres = computeBulletin(200000, { ...vide, joursTravailles: 30, sanctions: 5000, acompte: 10000 }, BAREME_DEFAUT, { sansRetenues: true });
check("sanctions et acompte restent déduits même exonéré",
  avecAutres.net === avecAutres.brut - 15000, { net: avecAutres.net, brut: avecAutres.brut });

// Le résumé initial se trouvait AVANT ce bloc : sans cette seconde sortie, un échec des
// vérifications d'exonération n'aurait pas fait rougir la suite.
console.log(echecs === 0 ? "\nmulti-société + exonérations : tout passe." : `\nmulti-société : ${echecs} échec(s).`);
process.exitCode = echecs === 0 ? 0 : 1;

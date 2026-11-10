// Les deux colonnes d'ancienneté (lot R10, point A6) : `npm run test:anciennete`
//
// Ce que ces tests protègent : depuis la correction du 05/11/2026, la case indicative ne compte
// NULLE PART. Inverser les deux cases ne double donc plus le montant — elle le fait DISPARAÎTRE
// du brut. Les contrôles ci-dessous sont la seule chose qui rattrape cette inversion.
import { augmentationAnciennete, controlerAnciennete } from "../convex/lib/anciennete.ts";

let echecs = 0;
const check = (nom: string, cond: boolean, d?: unknown) => {
  if (cond) console.log("  ok  " + nom);
  else { console.error("  KO  " + nom, d ?? ""); echecs++; }
};
const titre = (s: string) => console.log(`\n— ${s}`);

// ===========================================================================
titre("L'augmentation, calculée depuis le mois précédent");
// L'exemple exact donné par la RH : 2 000 le mois dernier, 3 000 ce mois, donc 1 000 d'augmentation.
const son = augmentationAnciennete(2000, 3000);
check("2 000 → 3 000 propose 1 000", son.proposee === 1000, son);
check("la variation est signée", son.variation === 1000);
check("ce n'est pas une baisse", son.baisse === false);
check("l'explication donne les deux montants",
  son.explication.includes("2") && son.explication.includes("3") && son.explication.includes("plus"),
  son.explication);

check("une prime inchangée ne propose rien", augmentationAnciennete(3000, 3000).proposee === 0);
check("et le dit", augmentationAnciennete(3000, 3000).explication.includes("inchangée"));

titre("Une baisse est signalée, jamais proposée comme « augmentation »");
const baisse = augmentationAnciennete(3000, 2000);
check("la proposition reste à zéro", baisse.proposee === 0, baisse.proposee);
check("mais la variation réelle est conservée, signée", baisse.variation === -1000);
check("et le drapeau est levé", baisse.baisse === true);
check("l'explication alerte", baisse.explication.includes("⚠️") && baisse.explication.includes("BAISSE"));

titre("Sans mois précédent, on ne propose RIEN");
// Le piège : proposer le montant entier. Une prime existante n'est pas une augmentation.
const premier = augmentationAnciennete(undefined, 3000);
check("aucune proposition", premier.proposee === 0, premier.proposee);
check("la variation est nulle, et non 3 000", premier.variation === 0, premier.variation);
check("le cas est explicitement marqué", premier.sansReference === true);
check("l'explication dit pourquoi",
  premier.explication.includes("Aucun mois précédent"), premier.explication);
check("un précédent à ZÉRO, lui, est une vraie référence",
  augmentationAnciennete(0, 3000).proposee === 3000 && !augmentationAnciennete(0, 3000).sansReference);

titre("Arrondis et valeurs limites");
check("les montants sont arrondis au franc",
  augmentationAnciennete(1999.6, 3000.4).proposee === 1000,
  augmentationAnciennete(1999.6, 3000.4));
check("un total nul avec un précédent non nul donne une baisse",
  augmentationAnciennete(2000, 0).baisse === true);
check("tout à zéro ne casse rien", augmentationAnciennete(0, 0).proposee === 0);

// ===========================================================================
titre("Le contrôle attrape l'inversion des deux cases");
// LE cas qui compte. Avant le 05/11, inverser doublait le montant ; depuis, il DISPARAÎT du brut.
const inverse = controlerAnciennete({ anciennete: 1000, ancienneteSeparee: 3000 });
check("une augmentation supérieure au total est signalée", inverse.length > 0, inverse);
check("et le message parle d'inversion",
  inverse.some((e) => e.includes("inversées")), inverse);
check("il rappelle lequel des deux est payé",
  inverse.some((e) => e.includes("payé")), inverse);

check("une augmentation ÉGALE au total passe — c'est le cas d'une prime créée cette année",
  controlerAnciennete({ anciennete: 3000, ancienneteSeparee: 3000 }).length === 0);
check("une saisie normale ne lève rien",
  controlerAnciennete({ anciennete: 3000, ancienneteSeparee: 1000 }).length === 0);
check("les deux cases vides ne lèvent rien",
  controlerAnciennete({ anciennete: 0 }).length === 0);

titre("Les autres défauts attrapés");
check("une augmentation sans total est signalée",
  controlerAnciennete({ anciennete: 0, ancienneteSeparee: 1000 })
    .some((e) => e.includes("sans montant total")));
check("et le message dit qu'elle ne produit aucun franc",
  controlerAnciennete({ anciennete: 0, ancienneteSeparee: 1000 })
    .some((e) => e.includes("aucun franc")));
check("une augmentation négative est refusée",
  controlerAnciennete({ anciennete: 3000, ancienneteSeparee: -100 })
    .some((e) => e.includes("négative")));

titre("L'écart avec le mois précédent est signalé, mais pas traité en erreur");
const ecart = controlerAnciennete({ anciennete: 3000, ancienneteSeparee: 500, precedente: 2000 });
check("un écart avec le calcul est signalé", ecart.length === 1, ecart);
check("le message dit que ce n'est pas forcément une erreur",
  ecart[0].includes("pas forcément une erreur"), ecart);
check("une augmentation conforme ne lève rien",
  controlerAnciennete({ anciennete: 3000, ancienneteSeparee: 1000, precedente: 2000 }).length === 0);
check("sans précédent fourni, aucune comparaison n'est faite",
  controlerAnciennete({ anciennete: 3000, ancienneteSeparee: 500 }).length === 0);
// Une prime inchangée avec une augmentation saisie : la variation attendue est nulle, donc on ne
// compare pas — la RH a peut-être saisi un rattrapage sur un mois antérieur.
check("une prime inchangée avec une augmentation saisie ne lève pas d'écart",
  controlerAnciennete({ anciennete: 3000, ancienneteSeparee: 500, precedente: 3000 }).length === 0);

if (echecs) { console.error(`\n${echecs} test(s) en échec`); process.exit(1); }
else console.log("\nTous les tests passent.");

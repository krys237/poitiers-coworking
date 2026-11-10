// Décalage des congés après un changement de fériés (demande N1) : `npm run test:recalcul`
//
// Les fixtures sont CALCULÉES par le moteur lui-même avant d'être modifiées, et non écrites à la
// main : une fixture incohérente ferait passer des tests qui ne prouvent rien — le moteur
// signalerait un décalage simplement parce que le stocké n'a jamais correspondu au calculé.
import { dateRetour, dernierJourConge } from "../convex/lib/congesOuvrables.ts";
import {
  congesAReprendre, libelleRecalcul, recalculerRetours, resumerRecalcul,
} from "../convex/lib/recalculFeries.ts";

let echecs = 0;
const check = (nom: string, cond: boolean, d?: unknown) => {
  if (cond) console.log("  ok  " + nom);
  else { console.error("  KO  " + nom, d ?? ""); echecs++; }
};
const titre = (s: string) => console.log(`\n— ${s}`);

// Calendrier de départ : deux fériés, loin du congé d'essai.
const BASE = new Set<string>(["2026-01-01", "2026-12-25"]);

/** Un congé COHÉRENT avec un calendrier donné : fin et retour calculés, jamais inventés. */
const congeCoherent = (
  id: string, dateDebut: string, joursOuvrables: number, feries: Set<string>,
  extra: Record<string, unknown> = {},
) => ({
  id, employeNom: id.toUpperCase(), type: "conge_paye", dateDebut, joursOuvrables,
  dateFin: dernierJourConge(dateDebut, joursOuvrables, feries),
  dateRetour: dateRetour(dateDebut, joursOuvrables, feries),
  ...extra,
});

// ===========================================================================
titre("Un calendrier inchangé ne décale rien");
const stable = [congeCoherent("a", "2026-03-09", 18, BASE), congeCoherent("b", "2026-06-01", 22, BASE)];
check("aucun décalage sur deux congés cohérents",
  recalculerRetours(stable, BASE).length === 0, recalculerRetours(stable, BASE));
check("et le résumé le dit explicitement",
  libelleRecalcul(resumerRecalcul([])) === "Aucun congé déjà posé n'est touché.");

// ===========================================================================
titre("Un férié décrété AU MILIEU d'un congé le prolonge");
const dansLeConge = stable[0];
// Le 18 mars 2026 tombe un mercredi, donc un jour ouvrable, et à l'intérieur du congé.
const avecDecret = new Set<string>([...BASE, "2026-03-18"]);
const d1 = recalculerRetours([dansLeConge], avecDecret);
check("un seul congé touché", d1.length === 1, d1);
check("le droit en jours ouvrables est INVARIANT",
  d1[0].joursOuvrables === dansLeConge.joursOuvrables, d1[0]);
// ⚠️ LE FAIT À RETENIR : UN seul férié décrété recule le retour de DEUX jours calendaires ici.
// Le congé devait finir le samedi 28 mars ; il lui faut un jour ouvrable de plus, mais le
// dimanche 29 n'en est pas un — la fin passe donc au lundi 30. `decaleDe` compte en jours
// CALENDAIRES, c'est-à-dire en ce que le salarié vit, et non en jours ouvrables.
check("la fin recule de DEUX jours calendaires, un dimanche étant franchi",
  d1[0].decaleDe === 2, d1[0]);
check("le retour recule aussi", d1[0].retourApres > (d1[0].retourAvant ?? ""), d1[0]);
check("le décompte calendaire suit le décalage",
  d1[0].joursCalendairesApres === d1[0].joursCalendairesAvant + 2, d1[0]);
// L'autre moitié de l'information : le droit, lui, n'a bougé que d'un jour ouvrable — zéro, même,
// puisqu'il est invariant. C'est la combinaison des deux qui dit la vérité à la RH.
check("alors que le droit en jours ouvrables n'a pas varié d'un iota",
  d1[0].joursOuvrables === 18);
check("l'avant ET l'après sont rendus — jamais une valeur seule",
  !!d1[0].finAvant && !!d1[0].finApres && !!d1[0].retourApres);
check("rien n'est bloqué", d1[0].bloque === undefined);

titre("Deux fériés décrétés prolongent davantage, mais pas proportionnellement");
const deuxDecrets = new Set<string>([...BASE, "2026-03-18", "2026-03-24"]);
const d2 = recalculerRetours([dansLeConge], deuxDecrets);
check("le décalage vaut 3 jours calendaires", d2[0].decaleDe === 3, d2[0]);
check("et le résumé donne l'ampleur",
  libelleRecalcul(resumerRecalcul(d2)).includes("3 jours"), libelleRecalcul(resumerRecalcul(d2)));
// Deux fériés ajoutent deux jours OUVRABLES ; en calendaire cela fait trois, parce qu'un seul
// dimanche est franchi. Le rapport entre les deux n'est donc pas constant — raison de plus pour
// afficher les dates et non le seul écart.
check("le second férié n'ajoute qu'un jour calendaire au premier",
  d2[0].decaleDe - d1[0].decaleDe === 1);

titre("Un férié RETIRÉ raccourcit, et l'écart est signé correctement");
// C'est le défaut qu'avait le calcul : `joursInclus` rend 0 quand la fin précède le début, donc
// tout raccourcissement était annoncé « 1 jour », même de trois.
const congeAvecDeux = congeCoherent("c", "2026-03-09", 18, deuxDecrets);
const retireLesDeux = recalculerRetours([congeAvecDeux], BASE);
check("le congé raccourcit", retireLesDeux[0].decaleDe < 0, retireLesDeux[0]);
check("et de TROIS jours, pas de un — c'est le défaut que le calcul signé corrige",
  retireLesDeux[0].decaleDe === -3, retireLesDeux[0].decaleDe);
check("le droit en jours reste pourtant le même",
  retireLesDeux[0].joursOuvrables === 18);

// ===========================================================================
titre("Un congé qui n'enjambe PAS la date n'est pas touché");
// Contre-intuitif mais exact : un congé qui commence après le férié ne le rencontre jamais.
const apres = congeCoherent("d", "2026-04-06", 18, BASE);
check("un congé postérieur au férié est inchangé",
  recalculerRetours([apres], avecDecret).length === 0);
const avant = congeCoherent("e", "2026-01-12", 18, BASE);
check("un congé antérieur aussi", recalculerRetours([avant], avecDecret).length === 0);
check("le tri des congés à reprendre ne retient que ceux qui enjambent",
  congesAReprendre([dansLeConge, apres, avant], "2026-03-18").map((c) => c.id).join() === "a");
check("un férié le jour même du départ compte",
  congesAReprendre([dansLeConge], dansLeConge.dateDebut).length === 1);
check("un férié le dernier jour du congé compte aussi",
  congesAReprendre([dansLeConge], dansLeConge.dateFin).length === 1);
check("le lendemain du dernier jour ne compte plus",
  congesAReprendre([dansLeConge], dateRetour(dansLeConge.dateDebut, 18, BASE)).length === 0);

// ===========================================================================
titre("Ce qui est volontairement ignoré");
const maladie = { ...congeCoherent("f", "2026-03-09", 18, BASE), type: "maladie" };
check("une maladie n'est jamais recalculée — son décompte est calendaire",
  recalculerRetours([maladie], avecDecret).length === 0);
const miseAPied = { ...congeCoherent("g", "2026-03-09", 18, BASE), type: "mise_a_pied" };
check("une mise à pied non plus", recalculerRetours([miseAPied], avecDecret).length === 0);
// Une ligne d'avant le lot R0 n'a pas de décompte ouvrable : le recalculer inventerait un droit.
const sansOuvrables = { ...dansLeConge, joursOuvrables: undefined };
check("un congé sans jours ouvrables est laissé tel quel",
  recalculerRetours([sansOuvrables as never], avecDecret).length === 0);
check("un congé à zéro jour ouvrable aussi",
  recalculerRetours([{ ...dansLeConge, joursOuvrables: 0 }], avecDecret).length === 0);

// ===========================================================================
titre("Un mois CLÔTURÉ est signalé, jamais réécrit");
const clos = recalculerRetours([{ ...dansLeConge, moisClos: true }], avecDecret);
check("le décalage est tout de même CALCULÉ", clos.length === 1 && clos[0].decaleDe === 2, clos);
check("mais il porte un motif de blocage", !!clos[0].bloque, clos[0]);
check("le motif nomme la clôture", clos[0].bloque!.includes("clôturée"), clos[0].bloque);
const r = resumerRecalcul(clos);
check("le résumé compte 1 touché, 0 appliqué, 1 bloqué",
  r.touches === 1 && r.appliques === 0 && r.bloques === 1, r);
check("et le dit en clair",
  libelleRecalcul(r).includes("NON appliqué"), libelleRecalcul(r));

// ===========================================================================
titre("Résumé d'un lot mêlant appliqués et bloqués");
const lot = recalculerRetours(
  [dansLeConge, { ...congeCoherent("h", "2026-03-10", 22, BASE), moisClos: true }],
  deuxDecrets,
);
const rl = resumerRecalcul(lot);
check("deux congés touchés", rl.touches === 2, rl);
check("un appliqué, un bloqué", rl.appliques === 1 && rl.bloques === 1, rl);
check("le décalage maximal est celui du plus décalé", rl.decalageMax === 3, rl);
check("les décalages sont triés par date de départ",
  lot.map((x) => x.dateDebut).join() === "2026-03-09,2026-03-10", lot.map((x) => x.dateDebut));

titre("Le libellé au singulier et au pluriel");
check("un seul congé", libelleRecalcul({ touches: 1, appliques: 1, bloques: 0, decalageMax: 1 }).startsWith("1 congé décalé"));
check("plusieurs congés", libelleRecalcul({ touches: 3, appliques: 3, bloques: 0, decalageMax: 1 }).startsWith("3 congés décalés"));
check("un décalage d'un jour n'affiche pas l'ampleur — elle est évidente",
  !libelleRecalcul({ touches: 1, appliques: 1, bloques: 0, decalageMax: 1 }).includes("jusqu'à"));

if (echecs) { console.error(`\n${echecs} test(s) en échec`); process.exit(1); }
else console.log("\nTous les tests passent.");

// Immatriculation fiscale du salarié : `npm run test:immat`
//
// Le point sensible de ce lot : un drapeau ABSENT ne doit pas priver un salarié de son bulletin.
// Toutes les fiches antérieures au lot R7 sont dans ce cas, et un déploiement qui les traiterait
// comme « non immatriculées » retirerait d'un coup le PDF à tout l'effectif.
import {
  LIBELLE_IMMATRICULATION,
  TITRE_BULLETIN,
  TITRE_RECAPITULATIF,
  filtrerParImmatriculation,
  repartitionImmatriculation,
  statutDocument,
} from "../convex/lib/immatriculation.ts";

let echecs = 0;
const check = (nom: string, cond: boolean, d?: unknown) => {
  if (cond) console.log("  ok  " + nom);
  else { console.error("  KO  " + nom, d ?? ""); echecs++; }
};
const titre = (s: string) => console.log(`\n— ${s}`);

// ===========================================================================
titre("Trois états, et non deux");
const oui = statutDocument(true);
const non = statutDocument(false);
const vide = statutDocument(undefined);

check("immatriculé", oui.etat === "immatricule");
check("non immatriculé", non.etat === "non_immatricule");
check("non renseigné est un état DISTINCT du non immatriculé", vide.etat === "non_renseigne");
check("les trois états ont un libellé", Object.keys(LIBELLE_IMMATRICULATION).length === 3);

titre("Un drapeau absent ne retire aucun droit — la règle qui protège le déploiement");
check("non renseigné se comporte comme immatriculé", vide.immatricule === true);
check("… donc le document reste un bulletin", vide.titre === TITRE_BULLETIN);
check("… il reste téléchargeable", vide.telechargeable === true);
check("… et il reste dans le DIPE", vide.dansDipe === true);
check("mais le drapeau `renseigne` est faux, pour que l'écran le signale", vide.renseigne === false);
check("un drapeau explicite est marqué renseigné", oui.renseigne === true && non.renseigne === true);

titre("Le titre du document suit l'immatriculation");
check("immatriculé → Bulletin de paie", oui.titre === TITRE_BULLETIN);
check("non immatriculé → Récapitulatif de paie", non.titre === TITRE_RECAPITULATIF);
check("les titres courts suivent", oui.titreCourt === "Bulletin" && non.titreCourt === "Récapitulatif");
check("les deux titres diffèrent", TITRE_BULLETIN !== TITRE_RECAPITULATIF);

titre("Téléchargement et DIPE");
check("non immatriculé : pas de téléchargement", non.telechargeable === false);
check("… avec un motif, jamais un refus muet", (non.motifRefus ?? "").length > 40, non.motifRefus);
check("le motif explique les DEUX conséquences",
  non.motifRefus!.includes("non téléchargeable") && non.motifRefus!.includes("DIPE"), non.motifRefus);
check("immatriculé : aucun motif de refus", oui.motifRefus === undefined);
check("non immatriculé : hors DIPE", non.dansDipe === false);
check("immatriculé : dans le DIPE", oui.dansDipe === true);

titre("Répartition d'un effectif");
const effectif = [
  { immatriculeImpots: true }, { immatriculeImpots: true },
  { immatriculeImpots: false },
  {}, {}, {},
];
const r = repartitionImmatriculation(effectif);
check("2 immatriculés", r.immatricule === 2, r);
check("1 non immatriculé", r.non_immatricule === 1, r);
check("3 à renseigner", r.non_renseigne === 3, r);
check("la somme couvre tout l'effectif",
  r.immatricule + r.non_immatricule + r.non_renseigne === effectif.length);
check("un effectif vide donne trois zéros",
  JSON.stringify(repartitionImmatriculation([])) ===
    JSON.stringify({ immatricule: 0, non_immatricule: 0, non_renseigne: 0 }));

titre("Filtre");
check("« tous » ne filtre rien", filtrerParImmatriculation(effectif, "tous").length === 6);
check("filtrer sur les immatriculés", filtrerParImmatriculation(effectif, "immatricule").length === 2);
check("filtrer sur les non immatriculés", filtrerParImmatriculation(effectif, "non_immatricule").length === 1);
check("filtrer sur ceux à renseigner — ce que la RH doit pouvoir isoler",
  filtrerParImmatriculation(effectif, "non_renseigne").length === 3);
check("le filtre ne confond pas « non renseigné » et « non immatriculé »",
  filtrerParImmatriculation(effectif, "non_immatricule").length !==
    filtrerParImmatriculation(effectif, "non_renseigne").length);
check("le filtre préserve les objets d'origine",
  filtrerParImmatriculation(effectif, "non_immatricule")[0] === effectif[2]);

if (echecs) { console.error(`\n${echecs} test(s) en échec`); process.exit(1); }
else console.log("\nTous les tests passent.");

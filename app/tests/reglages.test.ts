import { REGLAGES_DEFAUT, reglagesDe, validerReglages, type Reglages } from "../convex/lib/reglages.ts";
import type { RegleFenetrePoste } from "../convex/lib/fenetre.ts";

let echecs = 0;
const check = (nom: string, cond: boolean, detail?: unknown) => { if (cond) console.log(`  ok  ${nom}`); else { console.error(`  KO  ${nom}`, detail ?? ""); echecs++; } };

// Les réglages par défaut (donc un déploiement qui n'a jamais touché l'écran Paramètres) doivent
// toujours être valides : c'est la garantie de rétrocompatibilité du Lot C1.
check("réglages par défaut : aucune erreur", validerReglages(REGLAGES_DEFAUT).length === 0, validerReglages(REGLAGES_DEFAUT));

const avecRegle = (regles: RegleFenetrePoste[]): Reglages => ({ ...REGLAGES_DEFAUT, crFenetresParPoste: regles });

// Une règle correcte ne doit produire aucune erreur.
check(
  "une règle correcte : aucune erreur",
  validerReglages(avecRegle([{ poste: "Agent d'accueil", ouverture: 8, fermeture: 22, samedi: true }])).length === 0,
  validerReglages(avecRegle([{ poste: "Agent d'accueil", ouverture: 8, fermeture: 22, samedi: true }])),
);

// Poste vide une fois rogné (y compris blanc pur).
check("poste vide : erreur", validerReglages(avecRegle([{ poste: "", ouverture: 8, fermeture: 22, samedi: false }])).length === 1);
check("poste tout en espaces : erreur", validerReglages(avecRegle([{ poste: "   ", ouverture: 8, fermeture: 22, samedi: false }])).length === 1);

// Ouverture hors bornes [0, 23].
check("ouverture négative : erreur", validerReglages(avecRegle([{ poste: "Technicien", ouverture: -1, fermeture: 22, samedi: false }])).length >= 1);
check("ouverture = 24 : erreur", validerReglages(avecRegle([{ poste: "Technicien", ouverture: 24, fermeture: 22, samedi: false }])).length >= 1);
check("ouverture non entière : erreur", validerReglages(avecRegle([{ poste: "Technicien", ouverture: 8.5, fermeture: 22, samedi: false }])).length >= 1);

// Fermeture hors bornes [1, 24].
check("fermeture = 0 : erreur", validerReglages(avecRegle([{ poste: "Technicien", ouverture: 8, fermeture: 0, samedi: false }])).length >= 1);
check("fermeture = 25 : erreur", validerReglages(avecRegle([{ poste: "Technicien", ouverture: 8, fermeture: 25, samedi: false }])).length >= 1);

// Fermeture <= ouverture.
check("fermeture avant ouverture : erreur", validerReglages(avecRegle([{ poste: "Technicien", ouverture: 20, fermeture: 10, samedi: false }])).length >= 1);
check("fermeture = ouverture : erreur", validerReglages(avecRegle([{ poste: "Technicien", ouverture: 10, fermeture: 10, samedi: false }])).length >= 1);

// Deux règles pour le même poste normalisé : le message doit nommer le poste en double.
const erreursDoublon = validerReglages(
  avecRegle([
    { poste: "Agent d'accueil", ouverture: 8, fermeture: 22, samedi: false },
    { poste: "AGENT D’ACCUEIL", ouverture: 9, fermeture: 18, samedi: true }, // même poste, casse + apostrophe typographique différentes
  ]),
);
check("deux règles pour le même poste normalisé : erreur", erreursDoublon.length >= 1, erreursDoublon);
check("le message du doublon nomme le poste", erreursDoublon.some((m) => m.includes("Agent d'accueil") || m.includes("AGENT D’ACCUEIL")), erreursDoublon);

// Deux règles pour des postes réellement différents : pas d'erreur de doublon.
check(
  "deux règles pour des postes différents : aucune erreur",
  validerReglages(
    avecRegle([
      { poste: "Agent d'accueil", ouverture: 8, fermeture: 22, samedi: false },
      { poste: "Technicien de garde", ouverture: 7, fermeture: 15, samedi: true },
    ]),
  ).length === 0,
);

// Un réglage de type TABLEAU ne doit pas être partagé avec le défaut du module : l'écran
// Paramètres ajoute et retire des règles, et muter le défaut contaminerait tout le processus.
const a = reglagesDe(undefined);
const b = reglagesDe(undefined);
check("reglagesDe : les tableaux ne partagent pas la référence du défaut",
  a.crFenetresParPoste !== REGLAGES_DEFAUT.crFenetresParPoste && a.crFenetresParPoste !== b.crFenetresParPoste);
a.crFenetresParPoste.push({ poste: "test", ouverture: 8, fermeture: 12, samedi: false });
check("reglagesDe : muter le résultat ne touche pas le défaut du module",
  REGLAGES_DEFAUT.crFenetresParPoste.length === 0 && b.crFenetresParPoste.length === 0,
  { defaut: REGLAGES_DEFAUT.crFenetresParPoste.length, autre: b.crFenetresParPoste.length });

if (echecs) { console.error(`\n${echecs} test(s) en échec`); process.exit(1); } else console.log("\nTous les tests passent.");

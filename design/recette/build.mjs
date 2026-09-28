// Assemble le cahier de recette n°3 : droits générés depuis le code + scénarios par famille d'écrans.
// Usage : node design/recette/build.mjs  →  cahier-de-recette.html à la racine.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, "..", "..");

// 1. Droits attendus, régénérés à chaque fois depuis rbac.ts (source unique).
execFileSync(process.execPath, ["--experimental-strip-types", "--no-warnings", path.join(ICI, "droits.mts")], { stdio: "inherit" });
const droits = JSON.parse(readFileSync(path.join(ICI, "droits.json"), "utf-8"));
const COMPTES = new Set(droits.comptes.map((c) => c.id));

// 2. Un scénario « droits par défaut » par compte, écrit à partir de la matrice.
const libelleDe = (cle) => droits.lignes.find((l) => l.cle === cle);
const auto = droits.comptes.map((c) => {
  const menu = droits.lignes.filter((l) => l.menu && c.droits[l.cle].voir).map((l) => l.menu);
  const refuses = droits.lignes.filter((l) => l.menu && !c.droits[l.cle].voir).map((l) => l.cle);
  // Modules en « Voir » seul : ce que « Voir » permet reste (ex. rédiger SES comptes rendus), ce que « Faire »
  // ajoute doit avoir disparu de l'écran (définitions de rbac.MODULES).
  const voirSeulLignes = droits.lignes.filter((l) => l.menu && c.droits[l.cle].voir && !c.droits[l.cle].faire && l.faire);
  const voirSeul = voirSeulLignes.map((l) => libelleDe(l.cle).libelle);
  const detailVoirSeul = voirSeulLignes.map((l) => `${l.libelle} — permis : ${l.voir.toLowerCase()} ; absent de l'écran : ${l.faire.toLowerCase()}`);
  return {
    id: `DRT-${c.id}`, groupe: "Droits par compte", ecran: "Menu et accès", module: "/", compte: c.id,
    titre: `Droits par défaut du compte « ${c.id} » (${c.libelle})`,
    objectif: "Chaque compte ne voit que ses modules, et ne peut agir que là où il a le droit « Faire » : c'est la règle de la Direction.",
    prealable: "Droits par défaut dans Paramètres → Rôles & accès (bouton « Revenir aux droits par défaut » si besoin) et aucune exception posée sur ce compte.",
    etapes: [
      `Se connecter avec ${c.id}.test@poitiers.local / Poitiers2026.`,
      "Relever les entrées du menu de gauche.",
      refuses.length ? `Taper directement dans la barre d'adresse chacune de ces adresses : ${refuses.join(", ")}.` : "Aucune adresse refusée pour ce compte.",
      voirSeul.length ? `Ouvrir les modules en consultation seule : ${voirSeul.join(", ")}.` : "Aucun module en consultation seule pour ce compte.",
    ],
    attendu: [
      `Le menu contient exactement : ${menu.join(" · ")}.`,
      refuses.length ? "Chaque adresse tapée affiche « Accès refusé » (aucune donnée visible)." : "—",
      voirSeul.length ? "Dans ces modules, bannière « Vos droits ici » en haut, et seules les actions permises par « Voir » sont proposées (règle : un droit absent, ses actions disparaissent) :" : "—",
      ...detailVoirSeul,
    ].filter((x) => x !== "—"),
    gravite: "bloquant",
    tags: voirSeul.length ? ["droits", "conformite-droits"] : ["droits"],
  };
});

// 3. Scénarios écrits par famille d'écrans (design/recette/scenarios-*.json).
const ORDRE = ["scenarios-acces-admin.json", "scenarios-paie.json", "scenarios-exploitation.json"];
const rang = (f) => (ORDRE.includes(f) ? ORDRE.indexOf(f) : ORDRE.length); // fichier inconnu : à la fin
const fichiers = readdirSync(ICI).filter((f) => /^scenarios-.*\.json$/.test(f)).sort((a, b) => rang(a) - rang(b) || a.localeCompare(b));
const ecrits = fichiers.flatMap((f) => JSON.parse(readFileSync(path.join(ICI, f), "utf-8")));

// 4. Contrôles : identifiants uniques, champs présents, comptes connus.
const scenarios = [...auto, ...ecrits];
const vus = new Set(), erreurs = [];
for (const s of scenarios) {
  if (vus.has(s.id)) erreurs.push(`identifiant en double : ${s.id}`);
  vus.add(s.id);
  for (const k of ["id", "groupe", "ecran", "compte", "titre", "objectif", "etapes", "attendu", "gravite"]) if (s[k] === undefined) erreurs.push(`${s.id} : champ « ${k} » manquant`);
  if (!COMPTES.has(s.compte)) erreurs.push(`${s.id} : compte inconnu « ${s.compte} »`);
  if (!["bloquant", "majeur", "mineur"].includes(s.gravite)) erreurs.push(`${s.id} : gravité « ${s.gravite} »`);
  if (!Array.isArray(s.etapes) || !s.etapes.length || !Array.isArray(s.attendu) || !s.attendu.length) erreurs.push(`${s.id} : étapes ou attendu vides`);
}
if (erreurs.length) { console.error(erreurs.join("\n")); process.exit(1); }

// 5. Page.
const donnees = JSON.stringify({ genereLe: new Date().toISOString(), droits, scenarios }).replace(/</g, "\\u003c");
const page = readFileSync(path.join(ICI, "modele.html"), "utf-8").replace("__DONNEES__", () => donnees);
const sortie = path.join(RACINE, "cahier-de-recette.html");
writeFileSync(sortie, page);
const parGroupe = scenarios.reduce((m, s) => ((m[s.groupe] = (m[s.groupe] ?? 0) + 1), m), {});
console.log(`cahier-de-recette.html : ${scenarios.length} scénarios`, parGroupe, `(${fichiers.join(", ") || "aucun fichier de scénarios"})`);

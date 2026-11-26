// Tests unitaires — logique pure multi-société, seconde vague (lots 5, 7, 8).
//
// À lancer avec : `node --experimental-strip-types tests/multi-societe.test.ts`
// (aucune dépendance externe, logique pure uniquement).

import assert from "node:assert/strict";
import {
  estGrandLivreConfigure,
  prochaineReference,
  trouverParMatriculeDansEntite,
  type FicheMatricule,
} from "../convex/lib/scopeEntite.ts";

let passes = 0;
function test(nom: string, fn: () => void) {
  fn();
  passes++;
  console.log(`  ok  ${nom}`);
}

console.log("\n— Lot 5 : unicité du matricule par société");

test("deux sociétés peuvent porter le même matricule sans collision", () => {
  const fiches: FicheMatricule[] = [
    { _id: "emp_poitiers_1", matricule: "PP1", entiteId: "ent_poitiers" },
    { _id: "emp_edr_1", matricule: "PP1", entiteId: "ent_edr" },
  ];
  const p = trouverParMatriculeDansEntite(fiches, "PP1", "ent_poitiers");
  const e = trouverParMatriculeDansEntite(fiches, "PP1", "ent_edr");
  assert.equal(p?._id, "emp_poitiers_1");
  assert.equal(e?._id, "emp_edr_1");
  assert.notEqual(p?._id, e?._id);
});

test("importer ou créer un matricule dans EDR-TIM ne touche pas la fiche POITIERS", () => {
  const fiches: FicheMatricule[] = [
    { _id: "emp_poitiers_1", matricule: "PP1", entiteId: "ent_poitiers" },
    { _id: "emp_poitiers_2", matricule: "PP2", entiteId: "ent_poitiers" },
  ];
  assert.equal(trouverParMatriculeDansEntite(fiches, "PP1", "ent_edr"), undefined);
  assert.equal(trouverParMatriculeDansEntite(fiches, " pp1 ", "ent_poitiers")?._id, "emp_poitiers_1");
});

test("sans société fournie (branche de transition), la recherche reste globale", () => {
  const fiches: FicheMatricule[] = [
    { _id: "emp_poitiers_1", matricule: "PP1", entiteId: "ent_poitiers" },
  ];
  assert.equal(trouverParMatriculeDansEntite(fiches, "PP1")?._id, "emp_poitiers_1");
  assert.equal(trouverParMatriculeDansEntite(fiches, "   ", "ent_poitiers"), undefined);
});

console.log("\n— Lot 7 : séquences CMD et INT par société et par année");

test("deux sociétés créant chacune leur première commande obtiennent toutes les deux CMD-2026-001", () => {
  const refsPoitiers: string[] = [];
  const refsEdr: string[] = [];
  assert.equal(prochaineReference(refsPoitiers, "CMD", 2026), "CMD-2026-001");
  assert.equal(prochaineReference(refsEdr, "CMD", 2026), "CMD-2026-001");
});

test("34 commandes chez POITIERS n'empêchent pas EDR-TIM de démarrer à CMD-2026-001", () => {
  const refsPoitiers = Array.from({ length: 34 }, (_, i) => `CMD-2026-${String(i + 1).padStart(3, "0")}`);
  const refsEdr: string[] = [];
  assert.equal(prochaineReference(refsPoitiers, "CMD", 2026), "CMD-2026-035");
  assert.equal(prochaineReference(refsEdr, "CMD", 2026), "CMD-2026-001");
});

test("deux sociétés créant chacune leur première intervention obtiennent INT-2026-001", () => {
  assert.equal(prochaineReference([], "INT", 2026), "INT-2026-001");
  assert.equal(prochaineReference(["INT-2026-001", "INT-2026-004"], "INT", 2026), "INT-2026-005");
});

test("changement d'année et trous après suppression : jamais de collision ni de réutilisation", () => {
  const refs = ["CMD-2025-099", "CMD-2026-001", "CMD-2026-005"];
  assert.equal(prochaineReference(refs, "CMD", 2026), "CMD-2026-006");
  assert.equal(prochaineReference(refs, "CMD", 2027), "CMD-2027-001");
});

console.log("\n— Lot 8 : garde du grand livre financier (POITIERS uniquement)");

test("seul le code poitiers est reconnu comme grand livre configuré", () => {
  assert.equal(estGrandLivreConfigure("poitiers"), true);
  assert.equal(estGrandLivreConfigure("POITIERS"), true);
  assert.equal(estGrandLivreConfigure("edr-tim"), false);
  assert.equal(estGrandLivreConfigure("les-lilas"), false);
  assert.equal(estGrandLivreConfigure(""), false);
  assert.equal(estGrandLivreConfigure(undefined), false);
});

console.log(`\nmulti-société v2 : ${passes} contrôles OK, 0 échec(s)`);

// Périmètre d'un membre sur les entités : `npm run test:perimetre`.
//
// ⚠️ Ce fichier couvre les règles de SÉCURITÉ et les cas limites les plus coûteux. Il est
// volontairement incomplet : son extension exhaustive aux huit règles de `lib/perimetre.ts` est le
// lot 1 du dossier `docs/multi-societe/LOTS-AGENT-CLOUD.md`. Ce qui est ici ne doit pas régresser.
import {
  entitesAccessibles, atteintEntite, roleDansEntite, droitsDansEntite, peutDansEntite,
  peutAccorderRole, NIVEAU_TOUTES_ENTITES,
  type AccesEntite, type EntiteBrute, type MembrePerimetre,
} from "../convex/lib/perimetre.ts";
import { NIVEAU } from "../convex/rbac.ts";

let echecs = 0;
const check = (nom: string, cond: boolean, d?: unknown) => {
  if (cond) console.log("  ok  " + nom);
  else { console.error("  KO  " + nom, d ?? ""); echecs++; }
};
const titre = (s: string) => console.log(`\n— ${s}`);

const POITIERS: EntiteBrute = { entiteId: "e1", nom: "POLYCLINIQUE DE POITIERS", actif: true, ordre: 1 };
const EDRTIM: EntiteBrute = { entiteId: "e2", nom: "EDR-TIM", actif: true, ordre: 2 };
const LILAS: EntiteBrute = { entiteId: "e3", nom: "LES LILAS", actif: true, ordre: 3 };
const FERMEE: EntiteBrute = { entiteId: "e4", nom: "ANCIENNE", actif: false, ordre: 4 };
const TOUTES = [POITIERS, EDRTIM, LILAS, FERMEE];
const cles = (l: EntiteBrute[]) => l.map((e) => e.entiteId);

// ─────────────────────────────────────────────────────────────────────────────
titre("Qui atteint quoi");

const comptable: MembrePerimetre = { role: "comptable", entitePrincipaleId: "e1" };
check("un comptable n'atteint que son entité principale",
  cles(entitesAccessibles(comptable, [], TOUTES)).join() === "e1",
  cles(entitesAccessibles(comptable, [], TOUTES)));

const avecAcces: AccesEntite[] = [{ entiteId: "e3", actif: true }];
check("un accès accordé ouvre une seconde entité",
  cles(entitesAccessibles(comptable, avecAcces, TOUTES)).join() === "e1,e3");

check("un accès RÉVOQUÉ n'ouvre rien",
  cles(entitesAccessibles(comptable, [{ entiteId: "e3", actif: false }], TOUTES)).join() === "e1");

check("une entité DÉSACTIVÉE ne s'ouvre pas, même par un accès explicite",
  cles(entitesAccessibles(comptable, [{ entiteId: "e4", actif: true }], TOUTES)).join() === "e1");

const dg: MembrePerimetre = { role: "dg", entitePrincipaleId: "e2" };
check("le DG atteint TOUTES les entités actives sans aucune ligne d'accès",
  cles(entitesAccessibles(dg, [], TOUTES)).join() === "e2,e1,e3",
  cles(entitesAccessibles(dg, [], TOUTES)));
check("et son entité principale reste en tête du sélecteur",
  entitesAccessibles(dg, [], TOUTES)[0].entiteId === "e2");
check("mais le DG ne voit pas une entité désactivée",
  !cles(entitesAccessibles(dg, [], TOUTES)).includes("e4"));

const superAdmin: MembrePerimetre = { role: "super_admin" };
check("le super administrateur voit AUSSI les désactivées : sans lui, nul ne les rouvre",
  cles(entitesAccessibles(superAdmin, [], TOUTES)).includes("e4"));

check("un membre sans entité principale et sans accès n'atteint rien",
  entitesAccessibles({ role: "employe" }, [], TOUTES).length === 0);

check("l'auditeur externe n'est PAS implicite (niveau 0, hors hiérarchie)",
  NIVEAU.auditeur_externe < NIVEAU_TOUTES_ENTITES
  && entitesAccessibles({ role: "auditeur_externe" }, [], TOUTES).length === 0);

check("une entité n'apparaît qu'une fois même avec un accès redondant sur la principale",
  cles(entitesAccessibles(comptable, [{ entiteId: "e1", actif: true }], TOUTES)).join() === "e1");

check("le tri suit `ordre` puis `nom`",
  cles(entitesAccessibles({ role: "comptable" }, [{ entiteId: "e3", actif: true }, { entiteId: "e2", actif: true }], TOUTES)).join() === "e2,e3");

// ─────────────────────────────────────────────────────────────────────────────
titre("Le rôle porté dans une entité");

check("hors périmètre : null, et non un objet vide",
  roleDansEntite(comptable, [], TOUTES, "e2") === null);

check("sans rôle sur l'accès, le membre porte son rôle global",
  roleDansEntite(comptable, [{ entiteId: "e3", actif: true }], TOUTES, "e3") === "comptable");

check("un rôle INFÉRIEUR sur l'accès est respecté",
  roleDansEntite({ role: "da1", entitePrincipaleId: "e1" }, [{ entiteId: "e3", role: "employe", actif: true }], TOUTES, "e3") === "employe");

// LA règle de sécurité : pas d'escalade par l'écran d'attribution.
check("un rôle SUPÉRIEUR sur l'accès est ramené au rôle global",
  roleDansEntite(comptable, [{ entiteId: "e3", role: "dg", actif: true }], TOUTES, "e3") === "comptable",
  roleDansEntite(comptable, [{ entiteId: "e3", role: "dg", actif: true }], TOUTES, "e3"));

check("un rôle INCONNU sur l'accès ne promeut pas",
  roleDansEntite(comptable, [{ entiteId: "e3", role: "roi", actif: true }], TOUTES, "e3") === "comptable");

check("un accès sur la principale décide du rôle qui y est porté",
  roleDansEntite({ role: "da1", entitePrincipaleId: "e1" }, [{ entiteId: "e1", role: "employe", actif: true }], TOUTES, "e1") === "employe");

// ─────────────────────────────────────────────────────────────────────────────
titre("Les droits dans une entité");

check("hors périmètre : aucun droit, et null plutôt qu'une matrice vide",
  droitsDansEntite(comptable, [], TOUTES, "e2") === null);

const dEntite = droitsDansEntite(comptable, [{ entiteId: "e3", actif: true }], TOUTES, "e3");
check("dans une entité accordée, la matrice du rôle s'applique",
  !!dEntite && dEntite["/financier"] !== undefined, dEntite && Object.keys(dEntite).length);

check("une exception de l'ACCÈS l'emporte sur l'exception globale du membre",
  peutDansEntite(
    comptable,
    [{ entiteId: "e3", actif: true, droitsPerso: [{ module: "/documents", voir: true, faire: true }] }],
    TOUTES, "e3", "/documents", "faire",
    [], [{ module: "/documents", voir: false, faire: false }],
  ));

check("et l'exception globale s'applique là où l'accès n'en porte pas",
  !peutDansEntite(
    comptable, [{ entiteId: "e3", actif: true }], TOUTES, "e3", "/documents", "faire",
    [], [{ module: "/documents", voir: false, faire: false }],
  ));

check("le super administrateur garde tout, même avec des exceptions contraires",
  peutDansEntite(superAdmin, [], TOUTES, "e1", "/parametres", "faire", [], [{ module: "/parametres", voir: false, faire: false }]));

// ─────────────────────────────────────────────────────────────────────────────
titre("Ce qu'un auteur peut accorder");

check("un DG peut accorder un rôle de comptable", peutAccorderRole("dg", "comptable"));
check("un DG ne peut pas accorder le super administrateur", !peutAccorderRole("dg", "super_admin"));
check("un comptable ne peut pas accorder un rôle de DAF", !peutAccorderRole("comptable", "da1"));
check("accorder son propre rôle est permis", peutAccorderRole("da1", "da1"));

// ─────────────────────────────────────────────────────────────────────────────
titre("Déterminisme");
const once = cles(entitesAccessibles(dg, [{ entiteId: "e3", actif: true }], TOUTES));
check("deux appels identiques rendent le même ordre",
  once.join() === cles(entitesAccessibles(dg, [{ entiteId: "e3", actif: true }], TOUTES)).join());
check("atteintEntite et entitesAccessibles ne se contredisent pas",
  TOUTES.every((e) => atteintEntite(dg, [], TOUTES, e.entiteId) === cles(entitesAccessibles(dg, [], TOUTES)).includes(e.entiteId)));

console.log(echecs === 0
  ? `\npérimètre : tous les contrôles passent.`
  : `\npérimètre : ${echecs} échec(s).`);
process.exitCode = echecs === 0 ? 0 : 1;

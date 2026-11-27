// Périmètre d'un membre sur les entités : `npm run test:perimetre`.
//
// Couverture exhaustive des huit règles de `convex/lib/perimetre.ts` (lot 1 multi-société).
// Tous les contrôles d'origine sont conservés tels quels ; les nouveaux complètent chaque règle.
import {
  entitesAccessibles, atteintEntite, roleDansEntite, droitsDansEntite, peutDansEntite,
  peutAccorderRole, NIVEAU_TOUTES_ENTITES,
  type AccesEntite, type EntiteBrute, type MembrePerimetre,
} from "../convex/lib/perimetre.ts";
import { NIVEAU, ROLES_ORDONNES, type Role } from "../convex/rbac.ts";

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

// ─────────────────────────────────────────────────────────────────────────────
// Lot 1 — Extensions exhaustives des huit règles (FICHE.md § 5)
// ─────────────────────────────────────────────────────────────────────────────

titre("Règle 1 — Niveau >= 7 sans principale et liste vide");

const dgSansPrincipale: MembrePerimetre = { role: "dg" };
check("un DG sans entité principale atteint toutes les actives triées par ordre",
  cles(entitesAccessibles(dgSansPrincipale, [], TOUTES)).join() === "e1,e2,e3",
  cles(entitesAccessibles(dgSansPrincipale, [], TOUTES)));
check("un DG face à une liste d'entités vide obtient [] sans erreur",
  entitesAccessibles(dg, [], []).length === 0 && !atteintEntite(dg, [], [], "e1"));
check("un super administrateur face à une liste vide obtient [] sans erreur",
  entitesAccessibles(superAdmin, [], []).length === 0);

titre("Règle 2 & 4 — Multiples accès mixtes, entité inexistante et révocation");

const E5: EntiteBrute = { entiteId: "e5", nom: "CLINIQUE NORD", actif: true, ordre: 5 };
const E6: EntiteBrute = { entiteId: "e6", nom: "CLINIQUE SUD", actif: true, ordre: 6 };
const ETENDUES = [POITIERS, EDRTIM, LILAS, FERMEE, E5, E6];
const cinqAcces: AccesEntite[] = [
  { entiteId: "e2", actif: true },
  { entiteId: "e3", actif: false, role: "employe" },
  { entiteId: "e5", actif: false },
  { entiteId: "e6", actif: true },
  { entiteId: "e4", actif: false },
];
check("membre à 5 accès dont 3 révoqués : seules sa principale et les 2 actifs sortent",
  cles(entitesAccessibles(comptable, cinqAcces, ETENDUES)).join() === "e1,e2,e6",
  cles(entitesAccessibles(comptable, cinqAcces, ETENDUES)));
check("un accès désignant une entité inexistante est ignoré silencieusement",
  cles(entitesAccessibles(comptable, [{ entiteId: "inconnue", actif: true }], TOUTES)).join() === "e1"
  && !atteintEntite(comptable, [{ entiteId: "inconnue", actif: true }], TOUTES, "inconnue"));
check("un accès révoqué sur une entité atteinte autrement ne force pas son rôle ni ses droits",
  roleDansEntite(
    { role: "da1", entitePrincipaleId: "e1" },
    [{ entiteId: "e1", role: "employe", actif: false, droitsPerso: [{ module: "/financier", voir: false, faire: false }] }],
    TOUTES, "e1",
  ) === "da1"
  && peutDansEntite(
    { role: "da1", entitePrincipaleId: "e1" },
    [{ entiteId: "e1", role: "employe", actif: false, droitsPerso: [{ module: "/financier", voir: false, faire: false }] }],
    TOUTES, "e1", "/financier", "faire",
  ));

titre("Règle 3 — Entité désactivée, y compris comme principale du DG");

const dgPrincipaleFermee: MembrePerimetre = { role: "dg", entitePrincipaleId: "e4" };
check("un DG (7) dont l'entité principale est désactivée ne l'atteint PAS",
  !cles(entitesAccessibles(dgPrincipaleFermee, [], TOUTES)).includes("e4")
  && !atteintEntite(dgPrincipaleFermee, [], TOUTES, "e4")
  && roleDansEntite(dgPrincipaleFermee, [], TOUTES, "e4") === null,
  cles(entitesAccessibles(dgPrincipaleFermee, [], TOUTES)));
check("un super admin (8) dont la principale est désactivée la garde en tête",
  cles(entitesAccessibles({ role: "super_admin", entitePrincipaleId: "e4" }, [], TOUTES))[0] === "e4");

titre("Règle 5 — Ordre d'affichage quand la principale a un ordre élevé");

const HAUT_ORDRE: EntiteBrute = { entiteId: "e99", nom: "ZETA", actif: true, ordre: 99 };
const AVEC_HAUT = [POITIERS, EDRTIM, HAUT_ORDRE];
check("pour un non-implicite, la principale d'ordre 99 reste en tête devant ordre 1 et 2",
  cles(entitesAccessibles(
    { role: "comptable", entitePrincipaleId: "e99" },
    [{ entiteId: "e1", actif: true }, { entiteId: "e2", actif: true }],
    AVEC_HAUT,
  )).join() === "e99,e1,e2");
check("pour un DG, la principale d'ordre 99 reste aussi en tête",
  cles(entitesAccessibles({ role: "dg", entitePrincipaleId: "e99" }, [], AVEC_HAUT)).join() === "e99,e1,e2");

titre("Règle 6 — Balayage exhaustif des couples de rôles et cas auditeur_externe");

// Chaque couple (rôle global, rôle accordé) dans ROLES_ORDONNES : jamais d'escalade.
let tousCouplesOk = true;
for (const globalRole of ROLES_ORDONNES) {
  for (const roleAccorde of ROLES_ORDONNES) {
    const m: MembrePerimetre = { role: globalRole, entitePrincipaleId: "e1" };
    const obtenu = roleDansEntite(m, [{ entiteId: "e3", role: roleAccorde, actif: true }], TOUTES, "e3");
    const attendu: Role = NIVEAU[roleAccorde] > NIVEAU[globalRole] ? globalRole : roleAccorde;
    if (obtenu !== attendu) {
      tousCouplesOk = false;
      console.error(`    couple (${globalRole}, ${roleAccorde}) : obtenu=${obtenu}, attendu=${attendu}`);
    }
    const autorise = peutAccorderRole(globalRole, roleAccorde);
    if (autorise !== (NIVEAU[roleAccorde] <= NIVEAU[globalRole])) {
      tousCouplesOk = false;
      console.error(`    peutAccorderRole(${globalRole}, ${roleAccorde}) = ${autorise}`);
    }
  }
}
check(`balayage exhaustif des ${ROLES_ORDONNES.length * ROLES_ORDONNES.length} couples (rôle global × rôle accordé)`, tousCouplesOk);

// Cas explicite de l'auditeur externe (niveau 0) : aucun rôle de niveau > 0 ne peut lui être accordé.
const auditeur: MembrePerimetre = { role: "auditeur_externe" };
const rolesStrictementSuperieurs = ROLES_ORDONNES.filter((r) => NIVEAU[r] > 0);
check("auditeur_externe (niv. 0) : tout rôle de niveau > 0 est ramené à auditeur_externe",
  rolesStrictementSuperieurs.every(
    (r) => roleDansEntite(auditeur, [{ entiteId: "e3", role: r, actif: true }], TOUTES, "e3") === "auditeur_externe",
  ));
check("auditeur_externe (niv. 0) : peutAccorderRole refuse tout rôle de niveau > 0 et accepte auditeur_externe",
  rolesStrictementSuperieurs.every((r) => !peutAccorderRole("auditeur_externe", r))
  && peutAccorderRole("auditeur_externe", "auditeur_externe"));

titre("Règle 7 — Composition des droits (surcharge + exception d'accès + module absent)");

// Surcharge de rôle retire `/commandes` au comptable, mais l'exception d'accès le lui rouvre sur e3.
check("exception d'accès l'emporte sur une surcharge globale de rôle sur le même module",
  peutDansEntite(
    comptable,
    [{ entiteId: "e3", actif: true, droitsPerso: [{ module: "/commandes", voir: true, faire: true }] }],
    TOUTES, "e3", "/commandes", "faire",
    [{ role: "comptable", module: "/commandes", voir: false, faire: false }],
    [],
  ));
// Réciproque : sans exception d'accès, la surcharge globale de rôle retire bien le droit.
check("sans exception d'accès, la surcharge globale de rôle s'applique",
  !peutDansEntite(
    comptable,
    [{ entiteId: "e3", actif: true }],
    TOUTES, "e3", "/commandes", "voir",
    [{ role: "comptable", module: "/commandes", voir: false, faire: false }],
    [],
  ));
check("un module absent de toutes les couches renvoie false (jamais d'exception)",
  !peutDansEntite(comptable, [{ entiteId: "e3", actif: true }], TOUTES, "e3", "/module-inexistant", "voir")
  && !peutDansEntite(superAdmin, [], TOUTES, "e1", "/module-inexistant", "voir"));

titre("Règle 8 — Déterminisme indépendant de l'ordre des tableaux en entrée");

const TOUTES_INVERSE = [...TOUTES].reverse();
const TOUTES_MELANGE = [LILAS, FERMEE, POITIERS, EDRTIM];
const accesA: AccesEntite[] = [{ entiteId: "e3", actif: true }, { entiteId: "e2", actif: true }];
const accesB: AccesEntite[] = [{ entiteId: "e2", actif: true }, { entiteId: "e3", actif: true }];

check("même résultat pour un DG quel que soit l'ordre du tableau `entites`",
  cles(entitesAccessibles(dg, [], TOUTES)).join() === cles(entitesAccessibles(dg, [], TOUTES_INVERSE)).join()
  && cles(entitesAccessibles(dg, [], TOUTES)).join() === cles(entitesAccessibles(dg, [], TOUTES_MELANGE)).join());
check("même résultat pour un membre quel que soit l'ordre de `entites` et `acces`",
  cles(entitesAccessibles(comptable, accesA, TOUTES)).join()
  === cles(entitesAccessibles(comptable, accesB, TOUTES_INVERSE)).join());

console.log(echecs === 0
  ? `\npérimètre : tous les contrôles passent.`
  : `\npérimètre : ${echecs} échec(s).`);
process.exitCode = echecs === 0 ? 0 : 1;

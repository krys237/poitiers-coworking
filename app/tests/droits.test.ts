// Droits VOIR / FAIRE par module (rbac.droitsEffectifs) : les défauts reproduisent l'ancienne
// hiérarchie, plus les décisions du 28/09/2026 (auditeur, comptable) ; surcharges et exceptions
// s'appliquent dans l'ordre ; les garde-fous tiennent.
// Lancer : npm run test:droits
import { MODULES, NIVEAU, ROLES_ORDONNES, droitsEffectifs, type Role } from "../convex/rbac.ts";

let ok = 0, ko = 0;
function verifie(nom: string, cond: boolean) {
  if (cond) ok++; else { ko++; console.log("ÉCHEC", nom); }
}

// Ancienne table « niveau minimum par module » (avant le 28/09/2026), pour comparaison.
const ANCIEN: Record<string, number> = {
  "/comptes-rendus": 1, "/documents": 1, "/interventions": 1, "/employes": 3, "/commandes": 3, "/statistiques": 3,
  "/paie/saisie": 4, "/paie/bulletins": 4, "/paie/liste": 4, "/paie/planning": 4, "/paie/primes": 4, "/paie/courrier": 4,
  "/paie/archives": 4, "/bareme": 4, "/financier": 5, "/parametres": 7, "/membres": 7, "/journal": 7,
};
const HIERARCHIE: Role[] = ["employe", "chef_equipe", "comptable", "gestionnaire_rh", "da1", "dg", "super_admin"];

// 1. Rôles hiérarchiques : VOIR par défaut = ancien accès au module (sauf comptable → financier).
for (const r of HIERARCHIE) {
  const d = droitsEffectifs(r);
  for (const [m, n] of Object.entries(ANCIEN)) {
    const attendu = r === "comptable" && m === "/financier" ? true : NIVEAU[r] >= n;
    verifie(`${r} voit ${m}`, d[m].voir === attendu);
  }
  verifie(`${r} : audit cloisonné`, d["/audit"].voir === (r === "dg" || r === "super_admin"));
  verifie(`${r} : fiche API technique`, d["/api-readme"].voir === (r === "super_admin"));
  verifie(`${r} : tableau de bord`, d["/"].voir);
}

verifie("tout membre voit ses bulletins", HIERARCHIE.every((r) => droitsEffectifs(r)["/mes-bulletins"].voir));

// 2. Anciennes actions à niveau propre, reprises en FAIRE.
verifie("chef d'équipe supervise les comptes rendus", droitsEffectifs("chef_equipe")["/comptes-rendus"].faire);
verifie("employé ne supervise pas", !droitsEffectifs("employe")["/comptes-rendus"].faire);
verifie("comptable crée des commandes", droitsEffectifs("comptable")["/commandes"].faire);
verifie("comptable ne valide pas les commandes", !droitsEffectifs("comptable")["/commandes/validation"].faire);
verifie("DAF valide les commandes", droitsEffectifs("da1")["/commandes/validation"].faire);
verifie("RH ne publie pas de barème", !droitsEffectifs("gestionnaire_rh")["/bareme"].faire);
verifie("DG publie le barème", droitsEffectifs("dg")["/bareme"].faire);
verifie("comptable consulte les employés sans les modifier", droitsEffectifs("comptable")["/employes"].voir && !droitsEffectifs("comptable")["/employes"].faire);
verifie("comptable saisit le grand livre (28/09)", droitsEffectifs("comptable")["/financier"].faire);
verifie("RH ne lit pas le confidentiel", !droitsEffectifs("gestionnaire_rh")["/documents/confidentiels"].voir);
verifie("DAF lit le confidentiel", droitsEffectifs("da1")["/documents/confidentiels"].voir);

// 3. Auditeur externe : consulte tout, n'agit nulle part sauf l'audit ; exclusions du 28/09.
const aud = droitsEffectifs("auditeur_externe");
for (const m of MODULES) {
  const exclu = ["/parametres", "/journal", "/paie/archives", "/documents", "/documents/confidentiels", "/comptes-rendus", "/mes-bulletins"].includes(m.cle);
  if (m.cle === "/audit") { verifie("auditeur : audit voir + faire", aud[m.cle].voir && aud[m.cle].faire); continue; }
  verifie(`auditeur ${exclu ? "ne voit pas" : "voit"} ${m.cle}`, aud[m.cle].voir === (!exclu && m.voir !== null));
  verifie(`auditeur n'agit pas sur ${m.cle}`, !aud[m.cle].faire);
}
verifie("auditeur : pas de fiche API", !aud["/api-readme"].voir);

// 4. Surcharges du rôle, puis exception de la personne (qui l'emporte).
const sur = [{ role: "employe", module: "/employes", voir: true, faire: false }];
verifie("surcharge : employé voit les employés", droitsEffectifs("employe", sur)["/employes"].voir);
verifie("surcharge limitée à son rôle", !droitsEffectifs("chef_equipe", sur)["/employes"].voir);
verifie("exception : retirée à une personne", !droitsEffectifs("employe", sur, [{ module: "/employes", voir: false, faire: false }])["/employes"].voir);
verifie("exception : accordée à une personne", droitsEffectifs("employe", [], [{ module: "/financier", voir: true, faire: true }])["/financier"].faire);

// 5. Normalisation : FAIRE entraîne VOIR ; lecture seule jamais FAIRE ; ligne « faire seul ».
verifie("faire ⇒ voir", droitsEffectifs("employe", [{ role: "employe", module: "/statistiques", voir: false, faire: true }])["/statistiques"].voir);
verifie("journal : jamais faire", !droitsEffectifs("dg", [{ role: "dg", module: "/journal", voir: true, faire: true }])["/journal"].faire);
const val = droitsEffectifs("comptable", [{ role: "comptable", module: "/commandes/validation", voir: false, faire: true }])["/commandes/validation"];
verifie("validation : une seule case", val.voir && val.faire);

// 6. Garde-fous.
const verrouDg = [{ role: "dg", module: "/parametres", voir: false, faire: false }, { role: "dg", module: "/membres", voir: false, faire: false }];
verifie("le DG garde Paramètres", droitsEffectifs("dg", verrouDg)["/parametres"].faire);
verifie("le DG garde Membres", droitsEffectifs("dg", verrouDg)["/membres"].faire);
verifie("le super admin garde tout", MODULES.every((m) => droitsEffectifs("super_admin", [], MODULES.map((x) => ({ module: x.cle, voir: false, faire: false })))[m.cle].voir));
verifie("mais le DG peut perdre la paie", !droitsEffectifs("dg", [{ role: "dg", module: "/paie/primes", voir: false, faire: false }])["/paie/primes"].voir);

// 7. Clé dérivée « /paie » : ouverte si un écran de paie l'est.
verifie("/paie suit ses écrans", droitsEffectifs("employe", [{ role: "employe", module: "/paie/liste", voir: true, faire: false }])["/paie"].voir);
verifie("tous les rôles ont une matrice complète", ROLES_ORDONNES.every((r) => MODULES.every((m) => droitsEffectifs(r)[m.cle] !== undefined)));

console.log(`droits : ${ok} contrôles OK, ${ko} échec(s)`);
if (ko) process.exit(1);

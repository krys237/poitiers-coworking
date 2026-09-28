// Droits attendus par compte de test, tirés du code (app/convex/rbac.ts) : ce que le cahier de recette
// demande de vérifier rôle par rôle. Lancé par build.mjs : node --experimental-strip-types design/recette/droits.mts
import { writeFileSync, readFileSync } from "node:fs";
import { MODULES, LIBELLE, droitsParDefaut, type Role } from "../../app/convex/rbac.ts";

// Téléphones réellement enregistrés sur les comptes de test (déploiement de dev) : ils ne suivent pas l'ordre des rôles.
const TELEPHONES: Record<string, string> = { auditeur: "01", chef: "02", comptable: "03", daf: "04", dg: "05", employe: "06", rh: "07", superadmin: "08" };

const COMPTES: [string, Role][] = [
  ["employe", "employe"], ["chef", "chef_equipe"], ["comptable", "comptable"], ["rh", "gestionnaire_rh"],
  ["daf", "da1"], ["dg", "dg"], ["superadmin", "super_admin"], ["auditeur", "auditeur_externe"],
];

// Libellés du menu, lus dans la coquille (Layout.tsx) : c'est ce que le testeur voit.
const layout = readFileSync(new URL("../../app/src/components/Layout.tsx", import.meta.url), "utf-8");
const MENU: Record<string, string> = {};
for (const m of layout.matchAll(/to: "([^"]+)", label: "([^"]+)", perm: "([^"]+)"/g)) MENU[m[3]] = m[2];

const lignes = [
  { cle: "/", libelle: "Tableau de bord", menu: MENU["/"], voir: "Tableau de bord", faire: null },
  ...MODULES.map((m) => ({ cle: m.cle, libelle: m.libelle, menu: MENU[m.cle] ?? null, voir: m.voir, faire: m.faire })),
  { cle: "/api-readme", libelle: "Fiche API", menu: MENU["/api-readme"], voir: "Technique", faire: null },
];

const comptes = COMPTES.map(([id, role]) => {
  const d = droitsParDefaut(role);
  return {
    id, role, libelle: LIBELLE[role], telephone: `+237 6 90 00 00 ${TELEPHONES[id]}`,
    droits: Object.fromEntries(lignes.map((l) => [l.cle, { voir: !!d[l.cle]?.voir, faire: !!d[l.cle]?.faire }])),
  };
});

const sortie = new URL("./droits.json", import.meta.url);
writeFileSync(sortie, JSON.stringify({ genereLe: new Date().toISOString(), lignes, comptes }, null, 1));
console.log("droits.json :", comptes.length, "comptes ×", lignes.length, "modules");

// Tests du routage par service (lot S6 + correctif C1.3 : services.chefs source unique).
// Lancer : npm run test:servicesNotifs
import { TYPE_PAR_CLE, destinataires, type MembreAdressable } from "../convex/lib/notifications.ts";
import {
  chefsDuService,
  serviceDeLObjet,
  serviceDuMembre,
  type ServiceRef,
} from "../convex/lib/servicesNotifs.ts";
import { droitsEffectifs, type Role, type SurchargeRole } from "../convex/rbac.ts";

let ok = 0, ko = 0;
function verifie(nom: string, cond: boolean) {
  if (cond) ok++; else { ko++; console.log("ÉCHEC", nom); }
}

const SERVICES: ServiceRef[] = [
  { id: "svc_labo", nom: "LABORATOIRE", chefs: ["chef_labo_1", "chef_labo_2"] },
  { id: "svc_tech", nom: "TECHNIQUE", chefs: ["chef_tech"] },
  { id: "svc_vide", nom: "ADMIN" },
];

// 1. serviceDuMembre : champ propre prioritaire sur la fiche employé.
verifie("1. champ propre prioritaire sur fiche employé", serviceDuMembre({ serviceId: "svc_labo" }, { serviceId: "svc_tech" }) === "svc_labo");
verifie("1. repli sur fiche employé si champ propre absent", serviceDuMembre({}, { serviceId: "svc_tech" }) === "svc_tech");

// 2. Membre sans champ ni fiche → undefined, aucune erreur.
verifie("2. membre sans champ ni fiche → undefined", serviceDuMembre({}, null) === undefined);

// 3. serviceDeLObjet avec serviceId → le service référencé.
verifie("3. serviceId résolu", serviceDeLObjet({ serviceId: "svc_labo", service: "TECHNIQUE" }, SERVICES)?.id === "svc_labo");

// 4. serviceDeLObjet avec texte « laboratoire » → rapproché de LABORATOIRE (normalisation).
verifie("4. texte '  laboratoire ' rapproché de LABORATOIRE", serviceDeLObjet({ service: "  laboratoire " }, SERVICES)?.id === "svc_labo");

// 5. Texte ne correspondant à aucun service → undefined, aucune erreur.
verifie("5. texte inconnu → undefined", serviceDeLObjet({ service: "INCONNU" }, SERVICES) === undefined);

// C1-12 & C1-13 : chefsDuService avec deux chefs / sans chef / service absent.
const deuxChefs = chefsDuService(SERVICES[0]);
verifie("C1-12. chefsDuService avec deux chefs renvoie les deux ids", deuxChefs.length === 2 && deuxChefs.includes("chef_labo_1") && deuxChefs.includes("chef_labo_2"));
verifie("C1-13. chefsDuService sans chef renvoie []", chefsDuService(SERVICES[2]).length === 0);
verifie("C1-13. chefsDuService avec service absent renvoie []", chefsDuService(undefined).length === 0);

function construireEquipe(surcharges: SurchargeRole[] = []): MembreAdressable[] {
  const specs: { id: string; role: Role }[] = [
    { id: "comptable", role: "comptable" },
    { id: "chef_labo_1", role: "comptable" }, // a /commandes:voir
    { id: "chef_labo_2", role: "comptable" }, // a /commandes:voir
    { id: "chef_sans_droit", role: "employe" }, // n'a PAS /commandes:voir
    { id: "daf", role: "da1" },
    { id: "dg", role: "dg" },
  ];
  return specs.map((s) => ({
    id: s.id,
    actif: true,
    enAttente: false,
    droits: droitsEffectifs(s.role, surcharges),
  }));
}

const equipe = construireEquipe();

// 6. Tous les chefs du service prévenus → présents dans les destinataires.
const c6 = destinataires(
  TYPE_PAR_CLE["commande_soumise"],
  {
    type: "commande_soumise",
    acteurId: "comptable",
    proprietaireId: "comptable",
    serviceChefsIds: chefsDuService(SERVICES[0]),
  },
  equipe,
);
verifie("6. les deux chefs du service présents en plus des validateurs", c6.includes("chef_labo_1") && c6.includes("chef_labo_2") && c6.includes("daf") && c6.includes("dg"));

// 7 & C1-14. Chef de service SANS droit de voir le module → absent (invariant 2 tient).
const c7 = destinataires(
  TYPE_PAR_CLE["commande_soumise"],
  {
    type: "commande_soumise",
    acteurId: "comptable",
    proprietaireId: "comptable",
    serviceChefsIds: ["chef_sans_droit"],
  },
  equipe,
);
verifie("C1-14. chef de service sans droit voir sur /commandes exclu", !c7.includes("chef_sans_droit"));

// 8 & C1-15. Chef de service = acteur → absent (invariant 1 tient).
const c8 = destinataires(
  TYPE_PAR_CLE["commande_soumise"],
  {
    type: "commande_soumise",
    acteurId: "chef_labo_1",
    proprietaireId: "chef_labo_1",
    serviceChefsIds: chefsDuService(SERVICES[0]),
  },
  equipe,
);
verifie("C1-15. chef de service = acteur exclu, l'autre chef reste présent", !c8.includes("chef_labo_1") && c8.includes("chef_labo_2"));

// 9 & C1-16. Chef de service = propriétaire du dossier → une seule entrée (dédoublonnage).
const c9 = destinataires(
  TYPE_PAR_CLE["commande_validee"],
  {
    type: "commande_validee",
    acteurId: "dg",
    proprietaireId: "chef_labo_1",
    serviceChefsIds: chefsDuService(SERVICES[0]),
  },
  equipe,
);
verifie("C1-16. chef de service = propriétaire dédoublonné", c9.filter((x) => x === "chef_labo_1").length === 1);

// 10. Service sans chef → aucun ajout, aucune erreur.
const c10 = destinataires(
  TYPE_PAR_CLE["commande_soumise"],
  {
    type: "commande_soumise",
    acteurId: "comptable",
    proprietaireId: "comptable",
    serviceChefsIds: chefsDuService(SERVICES[2]),
  },
  equipe,
);
verifie("10. aucun ajout ni erreur si service sans chef", c10.includes("daf") && c10.includes("dg"));

console.log(`servicesNotifs : ${ok} contrôles OK, ${ko} échec(s)`);
if (ko) process.exit(1);

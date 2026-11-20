// Tests du routage par service (lot S6 — 10 cas).
// Lancer : npm run test:servicesNotifs
import { TYPE_PAR_CLE, destinataires, type MembreAdressable } from "../convex/lib/notifications.ts";
import {
  responsableDuService,
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
  { id: "svc_labo", nom: "LABORATOIRE", responsableId: "resp_labo" },
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

function construireEquipe(surcharges: SurchargeRole[] = []): MembreAdressable[] {
  const specs: { id: string; role: Role }[] = [
    { id: "comptable", role: "comptable" },
    { id: "resp_labo", role: "comptable" }, // a /commandes:voir
    { id: "resp_sans_droit", role: "employe" }, // n'a PAS /commandes:voir
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

// 6. Responsable prévenu → présent dans les destinataires.
const c6 = destinataires(
  TYPE_PAR_CLE["commande_soumise"],
  {
    type: "commande_soumise",
    acteurId: "comptable",
    proprietaireId: "comptable",
    serviceResponsableId: responsableDuService(SERVICES[0]),
  },
  equipe,
);
verifie("6. responsable du service présent en plus des validateurs", c6.includes("resp_labo") && c6.includes("daf") && c6.includes("dg"));

// 7. Responsable SANS droit de voir le module → absent (invariant 2 tient).
const c7 = destinataires(
  TYPE_PAR_CLE["commande_soumise"],
  {
    type: "commande_soumise",
    acteurId: "comptable",
    proprietaireId: "comptable",
    serviceResponsableId: "resp_sans_droit",
  },
  equipe,
);
verifie("7. responsable sans droit voir sur /commandes exclu", !c7.includes("resp_sans_droit"));

// 8. Responsable = acteur → absent (invariant 1 tient).
const c8 = destinataires(
  TYPE_PAR_CLE["commande_soumise"],
  {
    type: "commande_soumise",
    acteurId: "resp_labo",
    proprietaireId: "resp_labo",
    serviceResponsableId: "resp_labo",
  },
  equipe,
);
verifie("8. responsable = acteur exclu", !c8.includes("resp_labo"));

// 9. Responsable = propriétaire du dossier → une seule entrée (dédoublonnage).
const c9 = destinataires(
  TYPE_PAR_CLE["commande_validee"],
  {
    type: "commande_validee",
    acteurId: "dg",
    proprietaireId: "resp_labo",
    serviceResponsableId: "resp_labo",
  },
  equipe,
);
verifie("9. responsable = propriétaire dédoublonné", c9.filter((x) => x === "resp_labo").length === 1);

// 10. Service sans responsable → aucun ajout, aucune erreur.
verifie("10. service sans responsable → undefined", responsableDuService(SERVICES[2]) === undefined);
const c10 = destinataires(
  TYPE_PAR_CLE["commande_soumise"],
  {
    type: "commande_soumise",
    acteurId: "comptable",
    proprietaireId: "comptable",
    serviceResponsableId: responsableDuService(SERVICES[2]),
  },
  equipe,
);
verifie("10. aucun ajout ni erreur si service sans responsable", c10.includes("daf") && c10.includes("dg"));

console.log(`servicesNotifs : ${ok} contrôles OK, ${ko} échec(s)`);
if (ko) process.exit(1);

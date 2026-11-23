// Catalogue, adressage, préférences et tickets (lots S1, S2 & correctifs C1.1 / C1.2).
// Lancer : npm run test:notifications
import { MODULE_PAR_CLE, droitsEffectifs, type Role, type SurchargeRole } from "../convex/rbac.ts";
import {
  CLES_S1,
  TYPES,
  TYPE_PAR_CLE,
  destinataires,
  filtrerNonLuesParPreferences,
  importanceDominante,
  rendre,
  validerPreferencesSilencieuses,
  type MembreAdressable,
} from "../convex/lib/notifications.ts";

let ok = 0, ko = 0;
function verifie(nom: string, cond: boolean) {
  if (cond) ok++; else { ko++; console.log("ÉCHEC", nom); }
}

function construireEquipe(surcharges: SurchargeRole[] = []): MembreAdressable[] {
  const specs: { id: string; role: Role; actif?: boolean; enAttente?: boolean }[] = [
    { id: "emp1", role: "employe" },
    { id: "emp2", role: "employe" },
    { id: "chef", role: "chef_equipe" },
    { id: "comptable", role: "comptable" },
    { id: "rh", role: "gestionnaire_rh" },
    { id: "daf", role: "da1" },
    { id: "dg", role: "dg" },
    { id: "dev", role: "super_admin" },
    { id: "inactif", role: "dg", actif: false },
    { id: "attente", role: "da1", actif: false, enAttente: true },
  ];
  return specs.map((s) => ({
    id: s.id,
    actif: s.actif ?? true,
    enAttente: s.enAttente ?? false,
    droits: droitsEffectifs(s.role, surcharges),
  }));
}

const equipeAvecComptableValideur = construireEquipe([
  { role: "comptable", module: "/commandes/validation", voir: true, faire: true },
]);
const equipeParDefaut = construireEquipe();

// S1 — Cas 1 à 13
const c1 = destinataires(
  TYPE_PAR_CLE["commande_soumise"],
  { type: "commande_soumise", acteurId: "daf", proprietaireId: "daf" },
  equipeAvecComptableValideur,
);
verifie("1. commande_soumise : comptable et DG destinataires", c1.includes("comptable") && c1.includes("dg"));
verifie("1. commande_soumise : acteur (DAF) absent", !c1.includes("daf"));
verifie("1. commande_soumise : employé sans droit absent", !c1.includes("emp1"));

const c2 = destinataires(
  TYPE_PAR_CLE["commande_soumise"],
  { type: "commande_soumise", acteurId: "emp1", proprietaireId: "comptable" },
  equipeParDefaut,
);
verifie("2. commande_soumise : comptable absent après retrait du droit", !c2.includes("comptable"));
verifie("2. commande_soumise : DAF et DG toujours présents", c2.includes("daf") && c2.includes("dg"));

const c3 = destinataires(
  TYPE_PAR_CLE["commande_validee"],
  { type: "commande_validee", acteurId: "dg", proprietaireId: "comptable" },
  equipeParDefaut,
);
verifie("3. commande_validee : propriétaire (comptable) présent", c3.includes("comptable"));
verifie("3. commande_validee : acteur (DG) absent", !c3.includes("dg"));

// Cas 4 & C1.2-8 : intervention_creee avec portee en liste → comportement inchangé.
const c4 = destinataires(
  TYPE_PAR_CLE["intervention_creee"],
  { type: "intervention_creee", acteurId: "emp1", proprietaireId: "emp1" },
  equipeParDefaut,
);
verifie("4. intervention_creee : autre employé (emp2) absent", !c4.includes("emp2"));
verifie("4. intervention_creee : demandeur (emp1) absent", !c4.includes("emp1"));
verifie("4. intervention_creee : arbitres (DAF, DG) présents", c4.includes("daf") && c4.includes("dg"));

const c5 = destinataires(
  TYPE_PAR_CLE["intervention_arbitree"],
  { type: "intervention_arbitree", acteurId: "daf", proprietaireId: "emp1" },
  equipeParDefaut,
);
verifie("5. intervention_arbitree : propriétaire (emp1) présent", c5.length === 1 && c5[0] === "emp1");

const c6 = destinataires(
  TYPE_PAR_CLE["cr_remarque"],
  { type: "cr_remarque", acteurId: "chef", proprietaireId: "emp1" },
  equipeParDefaut,
);
verifie("6. cr_remarque : uniquement l'auteur du compte rendu", c6.length === 1 && c6[0] === "emp1");

const c7 = destinataires(
  TYPE_PAR_CLE["document_adresse"],
  { type: "document_adresse", acteurId: "rh", destinatairesExplicites: ["emp1", "rh", "comptable"] },
  equipeParDefaut,
);
verifie("7. document_adresse : destinataires nominatifs moins le déposant", c7.length === 2 && c7.includes("emp1") && c7.includes("comptable") && !c7.includes("rh"));

const c8 = destinataires(
  TYPE_PAR_CLE["commande_soumise"],
  { type: "commande_soumise", acteurId: "comptable", destinatairesExplicites: ["inactif", "attente"] },
  equipeParDefaut,
);
verifie("8. inactif et enAttente jamais destinataires", !c8.includes("inactif") && !c8.includes("attente"));

const equipeSansVoirCommandes = construireEquipe([
  { role: "comptable", module: "/commandes", voir: false, faire: false },
]);
const c9 = destinataires(
  TYPE_PAR_CLE["commande_validee"],
  { type: "commande_validee", acteurId: "dg", proprietaireId: "comptable" },
  equipeSansVoirCommandes,
);
verifie("9. membre sans droit voir sur /commandes exclu même si propriétaire", !c9.includes("comptable"));

const c10 = destinataires(
  TYPE_PAR_CLE["commande_validee"],
  { type: "commande_validee", acteurId: "dg", proprietaireId: "comptable" },
  equipeParDefaut,
);
verifie("10. dédoublonnage droit + propriétaire", c10.filter((id) => id === "comptable").length === 1);

const c11 = destinataires(
  TYPE_PAR_CLE["cr_valide"],
  { type: "cr_valide", acteurId: "chef" },
  equipeParDefaut,
);
verifie("11. cible null sans propriétaire → liste vide", c11.length === 0);

// 12 & C1-11 : catalogue compte 23 types (16 S1 + 6 S5 + 1 S7), rendre sans undefined.
verifie("12. catalogue compte 23 types (16 S1 + 6 S5 + 1 S7)", TYPES.length === 23);
for (const t of TYPES) {
  const { titre, corps } = rendre(t, {
    reference: "CMD-2026-001",
    acteurNom: "AMEFFO Lucie",
    libelle: "Achat réactifs",
    motif: "Quantité à revoir",
    extrait: "Merci de vérifier le devis",
  });
  verifie(`12. rendre(${t.cle}) : titre non vide sans undefined`, titre.length > 0 && !titre.includes("undefined"));
  verifie(`12. rendre(${t.cle}) : corps sans undefined`, corps === undefined || !corps.includes("undefined"));
  const vide = rendre(t, {});
  verifie(`12. rendre(${t.cle}, {}) : titre sans undefined`, vide.titre.length > 0 && !vide.titre.includes("undefined"));
}

// 13 & C1-9 / C1-10 : clés uniques, CLES_S1 à 16 entrées, chaque entrée de portee dans MODULE_PAR_CLE.
const cles = new Set(TYPES.map((t) => t.cle));
verifie("13. toutes les clés de TYPES sont uniques", cles.size === TYPES.length);
verifie("C1-9. CLES_S1 compte 16 entrées uniques", CLES_S1.length === 16 && new Set(CLES_S1).size === 16);
for (const t of TYPES) {
  verifie(`13. module ${t.module} existe dans MODULE_PAR_CLE`, Boolean(MODULE_PAR_CLE[t.module]));
  if (t.cible) {
    verifie(`13. cible.module ${t.cible.module} existe dans MODULE_PAR_CLE`, Boolean(MODULE_PAR_CLE[t.cible.module]));
  }
  for (const d of t.portee ?? []) {
    verifie(`C1-10. portee ${d} de ${t.cle} existe dans MODULE_PAR_CLE`, Boolean(MODULE_PAR_CLE[d]));
  }
}

// S2 — Préférences et importance dominante
const lotNonLues = [
  { type: "commande_commentaire", importance: "info" as const },
  { type: "commande_soumise", importance: "a_traiter" as const },
  { type: "commande_litige", importance: "urgent" as const },
];
const apresSilence = filtrerNonLuesParPreferences(lotNonLues, ["commande_litige"]);
verifie("S2. type silencieux exclu du compteur", apresSilence.length === 2 && !apresSilence.some((x) => x.type === "commande_litige"));
verifie("S2. importance dominante avec urgent", importanceDominante(lotNonLues) === "urgent");
verifie("S2. importance dominante sans urgent → a_traiter", importanceDominante(apresSilence) === "a_traiter");
verifie("S2. importance dominante sur liste vide → null", importanceDominante([]) === null);

const vOk = validerPreferencesSilencieuses(["commande_commentaire", "commande_commentaire"]);
verifie("S2. clés connues acceptées et dédoublonnées", vOk.ok && vOk.normalisees.length === 1);
const vKo = validerPreferencesSilencieuses(["commande_commentaire", "type_inexistant"]);
verifie("S2. clé inconnue refusée", !vKo.ok && vKo.inconnues.includes("type_inexistant"));

// C1.1 & C1.2 — Tickets (cas 1 à 8 de C1-CORRECTIFS.md)
const equipeTickets = construireEquipe([
  // Donne uniquement `/tickets/traitement` (sans `/tickets/arbitrage`) au chef d'équipe pour tester le OU de `portee`.
  { role: "chef_equipe", module: "/tickets/traitement", voir: true, faire: true },
]);

// C1-1, C1-2, C1-3, C1-4 : ticket_ouvert
const tOuvert = destinataires(
  TYPE_PAR_CLE["ticket_ouvert"],
  {
    type: "ticket_ouvert",
    acteurId: "emp1",
    proprietaireId: "emp1",
    destinatairesExplicites: ["emp2", "chef"],
  },
  equipeTickets,
);
verifie("C1-1. ticket_ouvert : membre n'ayant que /tickets (emp2) absent", !tOuvert.includes("emp2"));
verifie("C1-2. ticket_ouvert : membre ayant /tickets/arbitrage (dg) présent", tOuvert.includes("dg"));
verifie("C1-3. ticket_ouvert : membre ayant /tickets/traitement seul (chef) présent (portee OU)", tOuvert.includes("chef"));
verifie("C1-4. ticket_ouvert : auteur (emp1) absent (invariant 1)", !tOuvert.includes("emp1"));

// C1-5 : ticket_arbitre avec ignorerCible: true (non pertinent) → seul l'auteur, pas le traitement technique.
const tRefuse = destinataires(
  TYPE_PAR_CLE["ticket_arbitre"],
  {
    type: "ticket_arbitre",
    acteurId: "dg",
    proprietaireId: "emp1",
    ignorerCible: true,
  },
  equipeTickets,
);
verifie("C1-5. ticket_arbitre (ignorerCible=true) : seul l'auteur, pas le traitement", tRefuse.length === 1 && tRefuse[0] === "emp1");

// C1-6 : ticket_arbitre sans ignorerCible (pertinent) → auteur ET traitement technique.
const tPertinent = destinataires(
  TYPE_PAR_CLE["ticket_arbitre"],
  {
    type: "ticket_arbitre",
    acteurId: "dg",
    proprietaireId: "emp1",
  },
  equipeTickets,
);
verifie("C1-6. ticket_arbitre (pertinent) : auteur et traitement présents", tPertinent.includes("emp1") && tPertinent.includes("dev") && tPertinent.includes("chef") && !tPertinent.includes("dg"));

// C1-7 : ticket_avance → seul l'auteur du ticket.
const tAvance = destinataires(
  TYPE_PAR_CLE["ticket_avance"],
  {
    type: "ticket_avance",
    acteurId: "dev",
    proprietaireId: "emp1",
  },
  equipeTickets,
);
verifie("C1-7. ticket_avance : seul l'auteur du ticket", tAvance.length === 1 && tAvance[0] === "emp1");

// Vérification explicite : aucun canal WhatsApp/push sur les 3 types de tickets.
verifie("C1.1. pas de canaux sortants sur les 3 types de tickets",
  !TYPE_PAR_CLE["ticket_ouvert"].canaux &&
  !TYPE_PAR_CLE["ticket_arbitre"].canaux &&
  !TYPE_PAR_CLE["ticket_avance"].canaux,
);

console.log(`notifications : ${ok} contrôles OK, ${ko} échec(s)`);
if (ko) process.exit(1);

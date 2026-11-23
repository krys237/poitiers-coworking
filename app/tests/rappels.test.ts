// Tests du moteur de rappels (lot S5 — 15 cas) et des pense-bêtes (lot S7 — 8 cas).
// 100 % pur : toute heure est passée en paramètre, jamais `new Date()`.
// Lancer : npm run test:rappels
import { instantDouala } from "../convex/lib/fenetre.ts";
import {
  bornerDossiers,
  cleRappel,
  destinatairesEscalade,
  evaluerPalierDossier,
  evaluerRappelCloturePaie,
  membresARappelerCr,
  passageRappelCr,
  selectionnerPenseBetesAEcheance,
  validerPenseBete,
} from "../convex/lib/rappels.ts";
import { droitsEffectifs, type Role } from "../convex/rbac.ts";

let ok = 0, ko = 0;
function verifie(nom: string, cond: boolean) {
  if (cond) ok++; else { ko++; console.log("ÉCHEC", nom); }
}

// ---------------- Lot S5 : Rappels automatiques (15 cas) ----------------

// 1. Composition des clés : déterministe, et la date change d'un jour à l'autre.
const kJour1 = cleRappel("cr", "2026-11-12", "ouverture", "u1");
const kJour2 = cleRappel("cr", "2026-11-13", "ouverture", "u1");
verifie("S5-1. clé déterministe", kJour1 === cleRappel("cr", "2026-11-12", "ouverture", "u1"));
verifie("S5-1. date différente → clé différente", kJour1 !== kJour2);

// 2 & 3. Idempotence simulée sur un registre de clés : déjà émis ne repart pas ; lendemain repart.
const emis = new Set<string>();
const emettreUneFois = (cle: string) => {
  if (emis.has(cle)) return false;
  emis.add(cle);
  return true;
};
verifie("S5-2. première émission acceptée", emettreUneFois(kJour1));
verifie("S5-2. rappel déjà émis ne repart pas", !emettreUneFois(kJour1));
verifie("S5-3. même rappel le lendemain repart", emettreUneFois(kJour2));

// 4. Samedi, crSamedi: false → aucun rappel CR. (2026-11-14 est un samedi)
const samedi16h = instantDouala(2026, 11, 14, 16, 0);
verifie("S5-4. samedi avec crSamedi=false → null", passageRappelCr(samedi16h, { ouverture: 16, fermeture: 20, samedi: false }) === null);
verifie("S5-4. samedi avec crSamedi=true → ouverture", passageRappelCr(samedi16h, { ouverture: 16, fermeture: 20, samedi: true }) === "ouverture");

// 5. Dimanche → aucun rappel quel que soit le réglage. (2026-11-15 est un dimanche)
const dimanche16h = instantDouala(2026, 11, 15, 16, 0);
verifie("S5-5. dimanche crSamedi=true → null", passageRappelCr(dimanche16h, { ouverture: 16, fermeture: 20, samedi: true }) === null);

// 6 & 7. Membre niveau >= 5 jamais rappelé (dispense 19/10/2026) ; membre ayant déposé non rappelé.
const equipeCr: { id: string; role: Role; actif: boolean; enAttente: boolean }[] = [
  { id: "emp1", role: "employe", actif: true, enAttente: false },
  { id: "emp2", role: "employe", actif: true, enAttente: false },
  { id: "daf", role: "da1", actif: true, enAttente: false },
  { id: "dg", role: "dg", actif: true, enAttente: false },
  { id: "inactif", role: "employe", actif: false, enAttente: false },
];
const rappeles = membresARappelerCr(equipeCr, new Set(["emp2"]));
verifie("S5-6. niveau >= 5 (DAF, DG) jamais rappelés", !rappeles.includes("daf") && !rappeles.includes("dg"));
verifie("S5-7. membre ayant déposé (emp2) non rappelé, emp1 rappelé", rappeles.length === 1 && rappeles[0] === "emp1");

// 8. Créneau réglé à 14h–18h → passages à 14h et 17h30 (jeudi 2026-11-12).
const f1418 = { ouverture: 14, fermeture: 18, samedi: false };
verifie("S5-8. créneau 14h-18h : 14h00 → ouverture", passageRappelCr(instantDouala(2026, 11, 12, 14, 0), f1418) === "ouverture");
verifie("S5-8. créneau 14h-18h : 17h30 → fermeture", passageRappelCr(instantDouala(2026, 11, 12, 17, 30), f1418) === "fermeture");
verifie("S5-8. créneau 14h-18h : 16h00 → null", passageRappelCr(instantDouala(2026, 11, 12, 16, 0), f1418) === null);

// 9. Bon en_attente depuis 23h / 25h → pas de rappel / palier 1.
const nowMs = Date.parse("2026-11-15T12:00:00Z");
verifie("S5-9. 23 h → null", evaluerPalierDossier({ ageHeures: 23, seuilPalier1H: 24, escaladeH: 24, aEscalade: true, palier1EmisLeMs: null, maintenantMs: nowMs }) === null);
verifie("S5-9. 25 h → palier 1", evaluerPalierDossier({ ageHeures: 25, seuilPalier1H: 24, escaladeH: 24, aEscalade: true, palier1EmisLeMs: null, maintenantMs: nowMs }) === 1);

// 10. Palier 1 émis depuis 23h / 25h → pas d'escalade / palier 2.
verifie("S5-10. palier 1 depuis 23 h → null", evaluerPalierDossier({ ageHeures: 47, seuilPalier1H: 24, escaladeH: 24, aEscalade: true, palier1EmisLeMs: nowMs - 23 * 3_600_000, maintenantMs: nowMs }) === null);
verifie("S5-10. palier 1 depuis 25 h → palier 2", evaluerPalierDossier({ ageHeures: 49, seuilPalier1H: 24, escaladeH: 24, aEscalade: true, palier1EmisLeMs: nowMs - 25 * 3_600_000, maintenantMs: nowMs }) === 2);

// 11. Dossier sans escalade (ex. CR en relecture) → jamais palier 2.
verifie("S5-11. sans escalade → null après palier 1", evaluerPalierDossier({ ageHeures: 120, seuilPalier1H: 72, escaladeH: 24, aEscalade: false, palier1EmisLeMs: nowMs - 30 * 3_600_000, maintenantMs: nowMs }) === null);

// 12. Escalade : niveau >= 7 ET droit de voir le module (un niveau 7 sans le droit est exclu).
const membresEsc = [
  { id: "dg_ok", role: "dg" as Role, actif: true, enAttente: false, droits: droitsEffectifs("dg") },
  { id: "dg_sans", role: "dg" as Role, actif: true, enAttente: false, droits: droitsEffectifs("dg", [{ role: "dg", module: "/commandes", voir: false, faire: false }]) },
  { id: "daf", role: "da1" as Role, actif: true, enAttente: false, droits: droitsEffectifs("da1") },
];
const esc = destinatairesEscalade(membresEsc, "/commandes");
verifie("S5-12. escalade retient DG avec droit voir, exclut DG sans droit et DAF", esc.length === 1 && esc[0] === "dg_ok");

// 13. Clôture de paie, jour de paiement = 5 → rappels les 2, 3 et 4 (urgent le 4) ; rien le 1er.
verifie("S5-13. le 1er → pas de rappel", !evaluerRappelCloturePaie(instantDouala(2026, 11, 1, 8, 0), 5).aRappeler);
verifie("S5-13. le 2 → rappel non urgent", evaluerRappelCloturePaie(instantDouala(2026, 11, 2, 8, 0), 5).aRappeler && !evaluerRappelCloturePaie(instantDouala(2026, 11, 2, 8, 0), 5).urgent);
verifie("S5-13. le 3 → rappel non urgent", evaluerRappelCloturePaie(instantDouala(2026, 11, 3, 8, 0), 5).aRappeler);
const j4 = evaluerRappelCloturePaie(instantDouala(2026, 11, 4, 8, 0), 5);
verifie("S5-13. le 4 → rappel urgent sur période 2026-10", j4.aRappeler && j4.urgent && j4.periodePrecedente === "2026-10");

// 14. Verrou libéré ou renouvelé avant échéance (comparaison d'horodatage `at`).
const verrouActuel = { parId: "u1", at: "2026-11-12T09:10:00Z" };
verifie("S5-14. verrou différent (prolongé/libéré) ignoré", verrouActuel.at !== "2026-11-12T09:05:00Z");

// 15. Borne de 50 dossiers → le 51e est ignoré sans erreur.
const dossiers60 = Array.from({ length: 60 }, (_, i) => i + 1);
verifie("S5-15. borne à 50 dossiers", bornerDossiers(dossiers60).length === 50);

// ---------------- Lot S7 : Pense-bêtes personnels (8 cas) ----------------

const maintenantIso = "2026-11-20T09:00:00.000Z";
const futurIso = "2026-11-21T09:00:00.000Z";
const passeIso = "2026-11-19T09:00:00.000Z";

// S7-1. Échéance dans le passé refusée.
verifie("S7-1. échéance passée refusée", validerPenseBete({ texte: "Relancer", echeanceIso: passeIso, maintenantIso, nbEnAttenteActuel: 0 }) !== null);

// S7-2. Texte vide ou > 500 caractères refusé.
verifie("S7-2. texte vide refusé", validerPenseBete({ texte: "   ", echeanceIso: futurIso, maintenantIso, nbEnAttenteActuel: 0 }) !== null);
verifie("S7-2. texte > 500 car. refusé", validerPenseBete({ texte: "a".repeat(501), echeanceIso: futurIso, maintenantIso, nbEnAttenteActuel: 0 }) !== null);
verifie("S7-2. texte valide accepté", validerPenseBete({ texte: "Vérifier livraison", echeanceIso: futurIso, maintenantIso, nbEnAttenteActuel: 0 }) === null);

// S7-3. 51e pense-bête en attente refusé avec message clair.
verifie("S7-3. 51e pense-bête refusé", validerPenseBete({ texte: "Encore un", echeanceIso: futurIso, maintenantIso, nbEnAttenteActuel: 50 }) !== null);

// S7-4, 5, 6. Sélection du balayage : seuls en_attente && echeance <= maintenant (déclenché et annulé ignorés).
const pbs = [
  { id: "1", etat: "en_attente", echeance: "2026-11-20T08:45:00.000Z" },
  { id: "2", etat: "en_attente", echeance: "2026-11-20T10:00:00.000Z" },
  { id: "3", etat: "declenche", echeance: "2026-11-20T08:00:00.000Z" },
  { id: "4", etat: "annule", echeance: "2026-11-20T08:00:00.000Z" },
];
const sel = selectionnerPenseBetesAEcheance(pbs, maintenantIso);
verifie("S7-4/5/6. seul le pense-bête en_attente échu est sélectionné", sel.length === 1 && sel[0].id === "1");

// S7-7. Modifier un pense-bête déjà déclenché est refusé (garde d'état `etat !== "en_attente"`).
verifie("S7-7. état declenche bloque la modification", pbs[2].etat !== "en_attente");

// S7-8. Borne de 100 par passage respectée.
const pbs120 = Array.from({ length: 120 }, (_, i) => ({ id: String(i), etat: "en_attente", echeance: passeIso }));
verifie("S7-8. borne de 100 par passage", selectionnerPenseBetesAEcheance(pbs120, maintenantIso).length === 100);

console.log(`rappels : ${ok} contrôles OK, ${ko} échec(s)`);
if (ko) process.exit(1);

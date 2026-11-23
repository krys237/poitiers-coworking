import type { RegleFenetrePoste } from "./fenetre.ts";
import { normaliserPoste } from "./fenetre.ts";

// Réglages de fonctionnement de l'ERP (logique PURE, importable par les pages).
//
// Tout ce qui, avant, était une constante enfouie dans le code et que l'utilisateur ne voyait
// pas : fenêtre des comptes rendus, durée du verrou financier, délai de modification de la caisse,
// interrupteurs d'envoi réel et
// d'IA, PDF à la clôture, jours de base, plafond de saisie. Stockés dans
// `parametresEntreprise.reglages` (tous optionnels) ; `reglagesDe()` complète avec les défauts,
// qui sont exactement les anciennes constantes — un déploiement existant ne change pas de
// comportement tant que personne ne touche à l'écran Paramètres.

export interface Reglages {
  /** Comptes rendus : heure d'ouverture de la fenêtre (Douala), incluse. */
  crHeureOuverture: number;
  /** Comptes rendus : heure de fermeture (Douala), exclue. */
  crHeureFermeture: number;
  /** Comptes rendus : la fenêtre s'ouvre aussi le samedi. */
  crSamedi: boolean;
  /**
   * Comptes rendus : fenêtres propres à certains postes (Lot C1), en remplacement complet — pas
   * en complément — de la fenêtre générale pour ce poste. Défaut `[]` : aucune, donc un
   * déploiement existant garde exactement le comportement d'aujourd'hui (fenêtre unique). Le
   * niveau ≥ 5 reste dispensé quelle que soit la règle de poste (voir convex/lib/fenetre.ts).
   */
  crFenetresParPoste: RegleFenetrePoste[];
  /** Grand livre : minutes d'inactivité avant qu'un verrou expire. */
  verrouFinancierMin: number;
  /** Caisse & primes médecins : minutes après la saisie pendant lesquelles une ligne reste modifiable ;
   *  au-delà, seul le droit « Caisse & primes : modifier après le délai » peut la corriger ou la supprimer. */
  verrouCaisseMin: number;
  /** Courrier de paie : sans cet interrupteur, l'envoi reste simulé même si RESEND_API_KEY est définie. */
  envoiReelActive: boolean;
  /** Courrier de paie par WhatsApp (UltraMsg) : sans cet interrupteur, simulé même si les clés sont définies. */
  whatsappReelActive: boolean;
  /** Documents : extraction des métadonnées par IA (si ANTHROPIC_API_KEY est définie), sinon heuristique. */
  iaDocumentsActive: boolean;
  /** Paie : générer et archiver les PDF des bulletins dès la clôture du mois. */
  pdfAutoCloture: boolean;
  /** Paie : jours de base d'un nouvel employé (diviseur du salaire journalier). */
  joursBaseDefaut: number;
  /** Paie : montant au-delà duquel une saisie mensuelle est refusée (garde-fou contre les fautes de frappe). */
  plafondSaisie: number;
  /**
   * Rappels d'échéance de contrat (N2). Un avis au jour exact de `rappelPremierAvisJours`, puis
   * un rappel par semaine en deçà de `rappelHebdoDepuisJours`, puis un par jour en deçà de
   * `rappelQuotidienDepuisJours`. Un contrat échu alerte tous les jours, quoi qu'il arrive.
   */
  rappelPremierAvisJours: number;
  rappelHebdoDepuisJours: number;
  rappelQuotidienDepuisJours: number;
  /** Notifications WhatsApp (lot S3) : simulées sans cet interrupteur. */
  whatsappNotifsActive: boolean;
  /** Notifications push Firebase (lot S4) : simulées sans cet interrupteur. */
  pushReelActive: boolean;
  /** Relances dossiers en attente (lot S5, en heures). */
  relanceCommandeH: number;
  relanceInterventionH: number;
  relanceInterventionHauteH: number;
  relanceLitigeH: number;
  relanceCrH: number;
  escaladeH: number;
}

export const REGLAGES_DEFAUT: Reglages = {
  crHeureOuverture: 16,
  crHeureFermeture: 20,
  crSamedi: false,
  crFenetresParPoste: [],
  verrouFinancierMin: 15,
  verrouCaisseMin: 60,
  envoiReelActive: false,
  whatsappReelActive: false,
  iaDocumentsActive: true,
  pdfAutoCloture: false,
  joursBaseDefaut: 30,
  plafondSaisie: 100_000_000,
  // Rappels d'échéance de contrat (N2), configurables comme elle l'a demandé. Par défaut :
  // un avis à un mois, puis chaque semaine, puis chaque jour la dernière semaine.
  rappelPremierAvisJours: 30,
  rappelHebdoDepuisJours: 30,
  rappelQuotidienDepuisJours: 7,
  whatsappNotifsActive: false,
  pushReelActive: false,
  relanceCommandeH: 24,
  relanceInterventionH: 48,
  relanceInterventionHauteH: 72,
  relanceLitigeH: 48,
  relanceCrH: 72,
  escaladeH: 24,
};

/** Réglages effectifs : ce qui est stocké, complété par les défauts. */
export function reglagesDe(partiels: Partial<Reglages> | null | undefined): Reglages {
  const r = { ...REGLAGES_DEFAUT };
  for (const k of Object.keys(REGLAGES_DEFAUT) as (keyof Reglages)[]) {
    const val = partiels?.[k];
    if (val !== undefined && val !== null) (r as any)[k] = val;
  }
  // Depuis que `crFenetresParPoste` existe, un réglage peut être un TABLEAU. Le `{ ...DEFAUT }`
  // ci-dessus n'en copie que la référence : sans cette ligne, tout appelant qui ajoute une règle
  // (l'écran Paramètres le fera) muterait le défaut du module, et la fuite se propagerait à tous
  // les appels suivants du processus. On rend donc une copie par réglage de type tableau.
  for (const k of Object.keys(r) as (keyof Reglages)[]) {
    if (Array.isArray(r[k])) (r as any)[k] = [...(r[k] as unknown[])];
  }
  return r;
}

/** Bornes de validation, partagées entre l'écran et la mutation. Renvoie les erreurs (vide = valide). */
export function validerReglages(r: Reglages): string[] {
  const e: string[] = [];
  const entier = (n: number) => Number.isInteger(n);
  if (!entier(r.crHeureOuverture) || r.crHeureOuverture < 0 || r.crHeureOuverture > 23) e.push("Heure d'ouverture des comptes rendus : entre 0 et 23.");
  if (!entier(r.crHeureFermeture) || r.crHeureFermeture < 1 || r.crHeureFermeture > 24) e.push("Heure de fermeture des comptes rendus : entre 1 et 24.");
  if (r.crHeureFermeture <= r.crHeureOuverture) e.push("La fenêtre des comptes rendus doit se fermer après son ouverture.");
  // Règles de fenêtre par poste (Lot C1) : chacune est bornée comme la fenêtre générale, plus
  // l'unicité du poste — sinon deux règles contradictoires pour le même poste se disputeraient
  // silencieusement la priorité au moment de l'évaluation.
  const postesVus = new Set<string>();
  for (const regle of r.crFenetresParPoste) {
    const poste = (regle.poste ?? "").trim();
    if (!poste) { e.push("Chaque règle de fenêtre par poste doit préciser un poste."); continue; }
    if (!entier(regle.ouverture) || regle.ouverture < 0 || regle.ouverture > 23) e.push(`Poste « ${poste} » : l'heure d'ouverture doit être entre 0 et 23.`);
    if (!entier(regle.fermeture) || regle.fermeture < 1 || regle.fermeture > 24) e.push(`Poste « ${poste} » : l'heure de fermeture doit être entre 1 et 24.`);
    if (regle.fermeture <= regle.ouverture) e.push(`Poste « ${poste} » : la fenêtre doit se fermer après son ouverture.`);
    const cle = normaliserPoste(poste);
    if (postesVus.has(cle)) e.push(`Le poste « ${poste} » a déjà une règle de fenêtre : une seule règle par poste.`);
    postesVus.add(cle);
  }
  if (!entier(r.verrouFinancierMin) || r.verrouFinancierMin < 1 || r.verrouFinancierMin > 240) e.push("Durée du verrou financier : entre 1 et 240 minutes.");
  if (!entier(r.verrouCaisseMin) || r.verrouCaisseMin < 5 || r.verrouCaisseMin > 1440) e.push("Délai de modification de la caisse : entre 5 et 1 440 minutes.");
  if (!entier(r.joursBaseDefaut) || r.joursBaseDefaut < 20 || r.joursBaseDefaut > 31) e.push("Jours de base : entre 20 et 31.");
  if (!entier(r.plafondSaisie) || r.plafondSaisie < 1_000_000) e.push("Plafond de saisie : au moins 1 000 000 FCFA.");
  // Les trois seuils doivent rester ORDONNÉS : un quotidien plus large que l'hebdomadaire rendrait
  // ce dernier inatteignable, et la RH croirait à une panne de rappels.
  const borne = (v: number, libelle: string, min: number, max: number) => {
    if (!entier(v) || v < min || v > max) e.push(`${libelle} : entre ${min} et ${max} jours.`);
  };
  borne(r.rappelPremierAvisJours, "Premier avis", 1, 365);
  borne(r.rappelHebdoDepuisJours, "Rappels hebdomadaires", 1, 365);
  borne(r.rappelQuotidienDepuisJours, "Rappels quotidiens", 1, 90);
  if (r.rappelQuotidienDepuisJours > r.rappelHebdoDepuisJours)
    e.push("Les rappels quotidiens doivent démarrer APRÈS les hebdomadaires, pas avant : sinon l'hebdomadaire ne tombe jamais.");
  if (r.rappelHebdoDepuisJours > r.rappelPremierAvisJours)
    e.push("Le premier avis doit arriver au plus tôt : réglez-le au moins aussi loin que les rappels hebdomadaires.");
  return e;
}

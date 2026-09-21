// Réglages de fonctionnement de l'ERP (logique PURE, importable par les pages).
//
// Tout ce qui, avant, était une constante enfouie dans le code et que l'utilisateur ne voyait
// pas : fenêtre des comptes rendus, durée du verrou financier, interrupteurs d'envoi réel et
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
  /** Grand livre : minutes d'inactivité avant qu'un verrou expire. */
  verrouFinancierMin: number;
  /** Courrier de paie : sans cet interrupteur, l'envoi reste simulé même si RESEND_API_KEY est définie. */
  envoiReelActive: boolean;
  /** Documents : extraction des métadonnées par IA (si ANTHROPIC_API_KEY est définie), sinon heuristique. */
  iaDocumentsActive: boolean;
  /** Paie : générer et archiver les PDF des bulletins dès la clôture du mois. */
  pdfAutoCloture: boolean;
  /** Paie : jours de base d'un nouvel employé (diviseur du salaire journalier). */
  joursBaseDefaut: number;
  /** Paie : montant au-delà duquel une saisie mensuelle est refusée (garde-fou contre les fautes de frappe). */
  plafondSaisie: number;
}

export const REGLAGES_DEFAUT: Reglages = {
  crHeureOuverture: 16,
  crHeureFermeture: 20,
  crSamedi: false,
  verrouFinancierMin: 15,
  envoiReelActive: false,
  iaDocumentsActive: true,
  pdfAutoCloture: false,
  joursBaseDefaut: 30,
  plafondSaisie: 100_000_000,
};

/** Réglages effectifs : ce qui est stocké, complété par les défauts. */
export function reglagesDe(partiels: Partial<Reglages> | null | undefined): Reglages {
  const r = { ...REGLAGES_DEFAUT };
  for (const k of Object.keys(REGLAGES_DEFAUT) as (keyof Reglages)[]) {
    const val = partiels?.[k];
    if (val !== undefined && val !== null) (r as any)[k] = val;
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
  if (!entier(r.verrouFinancierMin) || r.verrouFinancierMin < 1 || r.verrouFinancierMin > 240) e.push("Durée du verrou financier : entre 1 et 240 minutes.");
  if (!entier(r.joursBaseDefaut) || r.joursBaseDefaut < 20 || r.joursBaseDefaut > 31) e.push("Jours de base : entre 20 et 31.");
  if (!entier(r.plafondSaisie) || r.plafondSaisie < 1_000_000) e.push("Plafond de saisie : au moins 1 000 000 FCFA.");
  return e;
}

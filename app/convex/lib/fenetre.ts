// Fenêtre de soumission des comptes rendus (logique PURE).
// Jours ouvrables lundi–vendredi, 16h00–20h00, heure de Douala (UTC+1, pas d'heure d'été).
export const OFFSET_DOUALA_MIN = 60;
export const HEURE_OUVERTURE = 16;
export const HEURE_FERMETURE = 20; // exclu
export const POINTS_DANS_FENETRE = 1; // 1 point de présence par compte rendu soumis dans la fenêtre
export const POINTS_HORS_FENETRE = 0;

// Décision du 19/10/2026 : les postes de niveau 5 et supérieur (DAF, DG, Super Admin)
// ne sont plus encadrés par le créneau horaire ; dépôt libre en permanence.
export const NIVEAU_DISPENSE_FENETRE = 5;
export const dispenseDeFenetre = (niveau: number): boolean => niveau >= NIVEAU_DISPENSE_FENETRE;

export interface HeureLocale { y: number; m: number; d: number; h: number; min: number; dow: number; iso: string; }

// Composantes locales (Douala) d'un instant.
export function heureDouala(d: Date): HeureLocale {
  const t = new Date(d.getTime() + OFFSET_DOUALA_MIN * 60000);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), h: t.getUTCHours(), min: t.getUTCMinutes(), dow: t.getUTCDay(), iso: t.toISOString().slice(0, 10) };
}

// Instant UTC correspondant à une heure locale de Douala.
export function instantDouala(y: number, m: number, d: number, h = 0, min = 0): Date {
  return new Date(Date.UTC(y, m - 1, d, h, min) - OFFSET_DOUALA_MIN * 60000);
}

// Date du jour "YYYY-MM-DD" à Douala.
export const dateDouala = (d: Date = new Date()) => heureDouala(d).iso;

// Fenêtre paramétrable (Paramètres → Fonctionnement) ; les défauts sont les constantes historiques.
export interface Fenetre { ouverture: number; fermeture: number; samedi: boolean }
export const FENETRE_DEFAUT: Fenetre = { ouverture: HEURE_OUVERTURE, fermeture: HEURE_FERMETURE, samedi: false };

export function estJourOuvrable(d: Date, f: Fenetre = FENETRE_DEFAUT): boolean {
  const dow = heureDouala(d).dow;
  return (dow >= 1 && dow <= 5) || (f.samedi && dow === 6);
}

export function estDansFenetre(d: Date, f: Fenetre = FENETRE_DEFAUT): boolean {
  const h = heureDouala(d);
  return estJourOuvrable(d, f) && h.h >= f.ouverture && h.h < f.fermeture;
}

// Fin de la fenêtre en cours (fermeture Douala) si l'instant est dans la fenêtre, sinon null.
export function finFenetre(d: Date, f: Fenetre = FENETRE_DEFAUT): Date | null {
  if (!estDansFenetre(d, f)) return null;
  const h = heureDouala(d);
  return instantDouala(h.y, h.m, h.d, f.fermeture);
}

// Prochaine ouverture (heure d'ouverture Douala d'un jour ouvrable) strictement postérieure à l'instant.
export function prochaineOuverture(d: Date, f: Fenetre = FENETRE_DEFAUT): Date {
  const h = heureDouala(d);
  if (estJourOuvrable(d, f) && h.h < f.ouverture) return instantDouala(h.y, h.m, h.d, f.ouverture);
  let cand = instantDouala(h.y, h.m, h.d + 1, f.ouverture);
  for (let i = 0; i < 7 && !estJourOuvrable(cand, f); i++) cand = new Date(cand.getTime() + 86400000);
  return cand;
}

export const pointsPour = (horsFenetre: boolean) => (horsFenetre ? POINTS_HORS_FENETRE : POINTS_DANS_FENETRE);

// Décision du 22/10/2026 : avec le droit « Comptes rendus : plusieurs par jour », un membre peut
// déposer plusieurs comptes rendus pour la même journée — mais la journée ne vaut qu'UN point de
// présence. Le point revient au premier dépôt réalisé dans le créneau (ordre chronologique) ; si
// aucun ne l'est, la journée vaut 0. Les points sont donc RECALCULÉS à chaque écriture et jamais
// figés au dépôt : l'ordre des dépôts (hors créneau puis dans le créneau, ou l'inverse) ne change
// rien au total de la journée.
export function pointsDuJour(horsFenetre: boolean[]): number[] {
  const credite = horsFenetre.findIndex((h) => !h);
  return horsFenetre.map((_, i) => (i === credite ? POINTS_DANS_FENETRE : POINTS_HORS_FENETRE));
}

// Durée lisible "1h 46min".
export function dureeLisible(ms: number): string {
  const total = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(total / 60), m = total % 60;
  return h ? `${h}h ${String(m).padStart(2, "0")}min` : `${m}min`;
}

// --- Lot C1 : fenêtre réglable par poste ----------------------------------------------------
// Jusqu'ici la fenêtre était unique pour toute l'entreprise. Le propriétaire veut qu'un poste
// puisse avoir son propre créneau (un agent d'accueil et un technicien de garde n'ont pas les
// mêmes horaires) sans perdre la dispense de niveau, qui doit continuer à primer sur tout.

/** Une fenêtre horaire propre à un poste (texte libre, voir normaliserPoste). */
export interface RegleFenetrePoste { poste: string; ouverture: number; fermeture: number; samedi: boolean }

// `users.poste` est un texte libre saisi à la main, sans référentiel : deux saisies comme
// "Agent d'accueil" et "agent d’accueil" (apostrophe typographique) doivent désigner la même
// règle. On normalise donc avant toute comparaison plutôt que d'imposer une liste fermée de postes.
export function normaliserPoste(s: string | undefined | null): string {
  if (!s) return "";
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // accents retirés (décomposés par normalize("NFD") ci-dessus)
    .replace(/’/g, "'") // apostrophe typographique -> apostrophe droite
    .replace(/\s+/g, " ") // espaces multiples réduits à un seul
    .trim();
}

// La fenêtre applicable à un poste : sa règle si elle existe, sinon la fenêtre générale. Un poste
// vide ou absent ne correspond à aucune règle (§2.3 de la fiche) : il retombe toujours sur `defaut`.
export function fenetrePour(poste: string | undefined | null, defaut: Fenetre, regles: RegleFenetrePoste[]): Fenetre {
  const cle = normaliserPoste(poste);
  if (!cle) return defaut;
  const regle = regles.find((r) => normaliserPoste(r.poste) === cle);
  return regle ? { ouverture: regle.ouverture, fermeture: regle.fermeture, samedi: regle.samedi } : defaut;
}

// Point d'entrée UNIQUE de la décision fenêtre + dispense : toute la précédence du §2.1 (le
// niveau prime sur toute règle de poste) vit ICI, pour qu'un futur appelant ne puisse pas, par
// erreur, évaluer la fenêtre de poste avant la dispense de niveau.
export function evaluerFenetre(
  d: Date,
  membre: { niveau: number; poste?: string | null },
  reglage: { defaut: Fenetre; regles: RegleFenetrePoste[] },
): { dispense: boolean; fenetre: Fenetre; horsFenetre: boolean } {
  const fenetre = fenetrePour(membre.poste, reglage.defaut, reglage.regles);
  if (dispenseDeFenetre(membre.niveau)) return { dispense: true, fenetre, horsFenetre: false };
  return { dispense: false, fenetre, horsFenetre: !estDansFenetre(d, fenetre) };
}

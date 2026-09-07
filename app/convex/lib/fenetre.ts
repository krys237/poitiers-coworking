// Fenêtre de soumission des comptes rendus (logique PURE).
// Jours ouvrables lundi–vendredi, 16h00–20h00, heure de Douala (UTC+1, pas d'heure d'été).
export const OFFSET_DOUALA_MIN = 60;
export const HEURE_OUVERTURE = 16;
export const HEURE_FERMETURE = 20; // exclu
export const POINTS_DANS_FENETRE = 1; // 1 point de présence par compte rendu soumis dans la fenêtre
export const POINTS_HORS_FENETRE = 0;

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

export function estJourOuvrable(d: Date): boolean {
  const dow = heureDouala(d).dow;
  return dow >= 1 && dow <= 5;
}

export function estDansFenetre(d: Date): boolean {
  const h = heureDouala(d);
  return estJourOuvrable(d) && h.h >= HEURE_OUVERTURE && h.h < HEURE_FERMETURE;
}

// Fin de la fenêtre en cours (20h00 Douala) si l'instant est dans la fenêtre, sinon null.
export function finFenetre(d: Date): Date | null {
  if (!estDansFenetre(d)) return null;
  const h = heureDouala(d);
  return instantDouala(h.y, h.m, h.d, HEURE_FERMETURE);
}

// Prochaine ouverture (16h00 Douala d'un jour ouvrable) strictement postérieure à l'instant.
export function prochaineOuverture(d: Date): Date {
  const h = heureDouala(d);
  if (estJourOuvrable(d) && h.h < HEURE_OUVERTURE) return instantDouala(h.y, h.m, h.d, HEURE_OUVERTURE);
  let cand = instantDouala(h.y, h.m, h.d + 1, HEURE_OUVERTURE);
  for (let i = 0; i < 7 && !estJourOuvrable(cand); i++) cand = new Date(cand.getTime() + 86400000);
  return cand;
}

export const pointsPour = (horsFenetre: boolean) => (horsFenetre ? POINTS_HORS_FENETRE : POINTS_DANS_FENETRE);

// Durée lisible "1h 46min".
export function dureeLisible(ms: number): string {
  const total = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(total / 60), m = total % 60;
  return h ? `${h}h ${String(m).padStart(2, "0")}min` : `${m}min`;
}

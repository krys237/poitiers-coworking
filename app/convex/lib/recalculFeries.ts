// Décalage des congés après un changement de jours fériés — logique PURE (demande N1).
//
// LA DEMANDE, et pourquoi elle n'est pas anodine
//
// « Les jours fériés décrétés au cours de l'année pour une raison ou une autre augmentent ou
//   décalent la date initialement prévue […] il faut donc que la RH puisse ajouter des fériés
//   justifiés en cas de besoin. » Puis, le 05/11/2026 : « un congé déjà posé se décale
//   automatiquement ».
//
// Un décret de dernière minute — une journée de deuil national, un report de fête — tombe parfois
// au milieu d'un congé en cours. Le salarié conserve alors son nombre de jours : c'est sa DATE DE
// RETOUR qui recule.
//
// CE QUI EST INVARIANT, ET CE QUI BOUGE
//
//   invariant : `joursOuvrables` — le droit acquis, que rien ne doit entamer
//   bougent    : `dateFin`, `dateRetour`, et `jours` (le décompte calendaire)
//
// C'est l'inverse de l'intuition : on ne retire pas un jour au congé, on le prolonge. Prendre
// `dateFin` pour invariant reviendrait à faire travailler le salarié un jour férié.
//
// TROIS GARDE-FOUS
//
//  1. **Un mois CLOS n'est jamais retouché.** Une paie arrêtée ne se rejoue pas : le décalage est
//     calculé, signalé, et laissé en attente d'une décision humaine.
//  2. **Seuls les CONGÉS PAYÉS** sont concernés. Le décompte ouvrable ne vaut que pour eux
//     (décret n°75/28) ; une maladie ou une mise à pied reste en jours calendaires.
//  3. **Rien n'est modifié en silence.** La fonction rend la liste de ce qui bouge, avec l'avant
//     et l'après : un retour qui change sans trace serait pire que pas de recalcul du tout.

// `.ts` explicite : ce module est exécuté directement par les tests, qui n'ont pas de
// résolveur d'extension. Même convention que `absences.ts`.
import { dateRetour, dernierJourConge, type ReglesOuvrables } from "./congesOuvrables.ts";
import { joursInclus } from "./allocationConge.ts";

export interface CongeARecalculer {
  id: string;
  employeNom?: string;
  type: string;
  dateDebut: string;
  dateFin: string;
  jours?: number;
  joursOuvrables?: number;
  dateRetour?: string;
  /** Vrai si la paie du mois concerné est clôturée : on calcule mais on n'écrit pas. */
  moisClos?: boolean;
}

export interface Decalage {
  id: string;
  employeNom?: string;
  dateDebut: string;
  joursOuvrables: number;
  finAvant: string;
  finApres: string;
  retourAvant?: string;
  retourApres: string;
  joursCalendairesAvant: number;
  joursCalendairesApres: number;
  /** Nombre de jours de décalage du retour. Positif = le retour recule. */
  decaleDe: number;
  /** Renseigné quand le décalage NE SERA PAS appliqué, avec la raison. */
  bloque?: string;
}

/**
 * Ce que devient chaque congé avec le nouveau calendrier des fériés.
 *
 * Ne rend QUE les congés dont quelque chose change — un planning de 78 personnes produirait sinon
 * 78 lignes dont deux utiles.
 */
export function recalculerRetours(
  conges: CongeARecalculer[],
  feries: Set<string>,
  regles?: ReglesOuvrables,
): Decalage[] {
  const out: Decalage[] = [];

  for (const c of conges) {
    // Seuls les congés payés suivent le décompte ouvrable.
    if (c.type !== "conge_paye") continue;
    // Sans nombre de jours ouvrables, il n'y a rien à conserver : la ligne est antérieure au lot
    // R0 et son décompte est calendaire. La recalculer inventerait un droit.
    if (!c.joursOuvrables || c.joursOuvrables <= 0) continue;

    const finApres = dernierJourConge(c.dateDebut, c.joursOuvrables, feries, regles);
    const retourApres = dateRetour(c.dateDebut, c.joursOuvrables, feries, regles);
    const retourAvant = c.dateRetour;

    const finChange = finApres !== c.dateFin;
    const retourChange = retourAvant !== undefined && retourApres !== retourAvant;
    if (!finChange && !retourChange) continue;

    const joursCalendairesApres = joursInclus(c.dateDebut, finApres);
    out.push({
      id: c.id,
      employeNom: c.employeNom,
      dateDebut: c.dateDebut,
      joursOuvrables: c.joursOuvrables,
      finAvant: c.dateFin,
      finApres,
      retourAvant,
      retourApres,
      joursCalendairesAvant: c.jours ?? joursInclus(c.dateDebut, c.dateFin),
      joursCalendairesApres,
      decaleDe: ecartJours(c.dateFin, finApres),
      ...(c.moisClos
        ? { bloque: "La paie de ce mois est clôturée : le décalage n'est pas appliqué, il est signalé." }
        : {}),
    });
  }

  return out.sort((a, b) => a.dateDebut.localeCompare(b.dateDebut));
}

/**
 * Écart SIGNÉ entre deux dates, en jours. Positif si `apres` est postérieure.
 *
 * `joursInclus` rend 0 quand la fin précède le début : l'employer tel quel donnait −1 pour tout
 * raccourcissement, quelle que soit son ampleur. Un férié retiré en milieu de congé aurait donc
 * été annoncé comme « 1 jour » même s'il en rendait trois.
 */
function ecartJours(avant: string, apres: string): number {
  return apres >= avant ? joursInclus(avant, apres) - 1 : -(joursInclus(apres, avant) - 1);
}

export interface ResumeRecalcul {
  touches: number;
  appliques: number;
  bloques: number;
  /** Décalage maximal observé, en jours. */
  decalageMax: number;
}

export function resumerRecalcul(decalages: Decalage[]): ResumeRecalcul {
  const bloques = decalages.filter((d) => d.bloque).length;
  return {
    touches: decalages.length,
    appliques: decalages.length - bloques,
    bloques,
    decalageMax: decalages.reduce((m, d) => Math.max(m, Math.abs(d.decaleDe)), 0),
  };
}

/**
 * Phrase récapitulative, à afficher APRÈS l'opération.
 *
 * Elle dit toujours combien de congés ont bougé, même quand c'est zéro : « aucun congé touché »
 * est une information, et son absence laisserait croire que le recalcul n'a pas eu lieu.
 */
export function libelleRecalcul(r: ResumeRecalcul): string {
  if (!r.touches) return "Aucun congé déjà posé n'est touché.";
  const base = r.touches === 1 ? "1 congé décalé" : `${r.touches} congés décalés`;
  const ampleur = r.decalageMax > 1 ? ` (jusqu'à ${r.decalageMax} jours)` : "";
  const reste = r.bloques
    ? ` — dont ${r.bloques} dans un mois clôturé, signalé(s) et NON appliqué(s)`
    : "";
  return base + ampleur + reste + ".";
}

/**
 * Les congés qu'il faut relire après un changement de fériés sur une DATE donnée.
 *
 * **Seuls ceux qui ENJAMBENT la date.** C'est contre-intuitif mais exact : un congé qui commence
 * APRÈS le férié n'est pas touché, puisque son décompte part de sa propre date de départ et ne
 * rencontre jamais cette journée. Et un congé terminé avant l'est encore moins.
 *
 * On ne relit donc pas tout le planning — sur 78 personnes, cela éviterait 76 recalculs inutiles
 * dont aucun ne changerait quoi que ce soit.
 */
export function congesAReprendre<T extends { dateDebut: string; dateFin: string }>(
  conges: T[],
  dateFerie: string,
): T[] {
  return conges.filter((c) => c.dateFin >= dateFerie && c.dateDebut <= dateFerie);
}

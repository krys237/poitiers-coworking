// Fonctions pures de périmètre multi-société (seconde vague, lots 5 à 8).
//
// Centralise la logique pure testable sans runtime Convex :
// - unicité et recherche de matricule par société (Lot 5) ;
// - séquences de références `CMD-AAAA-NNN` / `INT-AAAA-NNN` par société et par année (Lot 7) ;
// - garde du grand livre borné à POITIERS (Lot 8).

export type FicheMatricule = {
  _id: string;
  matricule: string;
  entiteId?: string;
};

/**
 * Recherche un employé par matricule dans le périmètre d'une société.
 *
 * Quand `entiteId` est fourni, seules les fiches de CETTE société sont considérées :
 * deux sociétés peuvent porter le même matricule sans collision.
 * Sans `entiteId` (branche de transition), la recherche reste globale.
 */
export function trouverParMatriculeDansEntite<T extends FicheMatricule>(
  fiches: readonly T[],
  matricule: string,
  entiteId?: string,
): T | undefined {
  const cible = matricule.trim().toUpperCase();
  if (!cible) return undefined;
  return fiches.find((f) => {
    if (entiteId !== undefined && f.entiteId !== entiteId) return false;
    return f.matricule.trim().toUpperCase() === cible;
  });
}

/**
 * Calcule le prochain numéro de séquence (`PREFIXE-AAAA-NNN`) à partir des références
 * déjà présentes dans le périmètre (société + année).
 *
 * Deux sociétés créant chacune leur première commande de l'année obtiennent toutes les
 * deux `CMD-AAAA-001`.
 */
export function prochaineReference(
  references: readonly string[],
  prefixe: string,
  annee: number | string,
): string {
  const debut = `${prefixe}-${annee}-`;
  let max = 0;
  for (const ref of references) {
    if (!ref.startsWith(debut)) continue;
    const n = parseInt(ref.slice(debut.length), 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return `${debut}${String(max + 1).padStart(3, "0")}`;
}

/**
 * Le grand livre (`convex/lib/tresorerie.ts`) est calqué sur les neuf blocs papier de
 * POITIERS. Toute autre société (ex. `edr-tim`, `les-lilas`) doit recevoir un refus poli
 * tant que ses blocs ne sont pas paramétrables.
 */
export function estGrandLivreConfigure(codeEntite: string | undefined): boolean {
  return (codeEntite ?? "").trim().toLowerCase() === "poitiers";
}

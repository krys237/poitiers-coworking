/**
 * Lecture d'un classeur Excel (.xlsx) dans le navigateur, rendue sous la même forme que
 * `parseCsv` : un objet par ligne, clé par en-tête.
 *
 * Posé le 19/11/2026, après l'échec de l'import de l'effectif. Le détour par un export CSV
 * paraissait suffisant ; il ne l'était pas. La feuille déclarait l'étendue `A1:XET1048442` pour
 * 93 lignes réellement remplies — un reste de mise en forme appliquée à des colonnes entières —
 * et Excel exporte l'étendue DÉCLARÉE : le CSV produit pesait 4 Gio de points-virgules, sans une
 * seule donnée dans ses cinq premiers mégaoctets. Lire le classeur évite complètement ce piège,
 * parce qu'on ne parcourt que les cellules qui existent.
 *
 * `read-excel-file` plutôt que SheetJS : la version npm de ce dernier est figée depuis 2022 et
 * porte des vulnérabilités connues. On accepte en échange de ne pas lire les `.xls` d'avant 2007
 * ni les classeurs chiffrés — deux cas que l'on détecte pour les expliquer, voir `ErreurClasseur`.
 */
import lireXlsx from "read-excel-file/browser";

/** Erreur porteuse d'un message déjà rédigé pour l'utilisateur. */
export class ErreurClasseur extends Error {}

/**
 * Trouve la ligne d'en-têtes : la première qui porte au moins deux cellules non vides.
 *
 * Les classeurs de la maison commencent rarement en A1 — celui de l'effectif a un total en
 * ligne 1, un titre « RÉCAPITULATIF SALAIRES » en ligne 4, et ses en-têtes en ligne 5. Exiger
 * A1 reviendrait à demander à la RH de remanier ses fichiers avant chaque import.
 */
export function trouverEnTetes(lignes: unknown[][]): number {
  for (let i = 0; i < Math.min(lignes.length, 50); i++) {
    const remplies = lignes[i].filter((c) => String(c ?? "").trim() !== "").length;
    if (remplies >= 2) return i;
  }
  return -1;
}

/**
 * Ramène ce que rend la bibliothèque à une grille simple.
 *
 * Selon la version et le point d'entrée, `read-excel-file` renvoie soit un tableau de lignes,
 * soit un tableau d'objets `{ sheet, data }` — c'est la seconde forme qu'on a observée ici, et
 * la découvrir à l'exécution coûte un aller-retour. On accepte donc les deux, et on prend la
 * PREMIÈRE feuille : un classeur de paie en a une, et choisir silencieusement parmi plusieurs
 * serait pire que de s'en tenir à une règle énoncée.
 */
export function normaliserGrille(brut: unknown): unknown[][] {
  if (!Array.isArray(brut) || brut.length === 0) return [];
  const premier = brut[0] as { data?: unknown } | unknown[];
  if (!Array.isArray(premier) && premier && Array.isArray(premier.data)) {
    return premier.data as unknown[][];
  }
  return brut.filter(Array.isArray) as unknown[][];
}

/** Transforme une grille en objets clés par en-tête, comme le fait `parseCsv`. */
export function grilleVersLignes(grille: unknown[][]): Record<string, string>[] {
  const iEntetes = trouverEnTetes(grille);
  if (iEntetes < 0) return [];
  const entetes = grille[iEntetes].map((c) => String(c ?? "").trim());
  const out: Record<string, string>[] = [];
  for (const brute of grille.slice(iEntetes + 1)) {
    if (!brute.some((c) => String(c ?? "").trim() !== "")) continue; // ligne vide : ignorée
    const ligne: Record<string, string> = {};
    entetes.forEach((h, i) => {
      if (!h) return;
      const v = brute[i];
      // Une date arrive en objet Date : on la rend au format attendu par l'import (AAAA-MM-JJ),
      // et non via `toLocaleDateString`, qui dépend de la langue du navigateur.
      ligne[h] = v instanceof Date
        ? `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`
        : String(v ?? "").trim();
    });
    out.push(ligne);
  }
  return out;
}

export async function lireClasseur(fichier: File, premiersOctets: Uint8Array): Promise<Record<string, string>[]> {
  // Un `.xlsx` est une archive zip : ses octets commencent par « PK ». Tout autre conteneur est
  // soit un `.xls` d'avant 2007, soit un classeur CHIFFRÉ — Excel range alors le contenu dans un
  // conteneur OLE2, d'où la même signature. Les deux sont illisibles ici, et pour des raisons
  // différentes : autant les distinguer, le geste à faire n'est pas le même.
  const estZip = premiersOctets[0] === 0x50 && premiersOctets[1] === 0x4b;
  if (!estZip) {
    throw new ErreurClasseur(
      "Ce classeur est protégé par un mot de passe, ou enregistré à l'ancien format .xls. " +
      "Ouvrez-le dans Excel, retirez la protection (Fichier → Informations → Protéger le classeur), " +
      "puis enregistrez-le en « Classeur Excel (*.xlsx) ».",
    );
  }
  try {
    return grilleVersLignes(normaliserGrille(await lireXlsx(fichier)));
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    if (/password|encrypt/i.test(m)) {
      throw new ErreurClasseur("Ce classeur est protégé par un mot de passe. Retirez la protection dans Excel, puis réessayez.");
    }
    throw new ErreurClasseur(`Ce classeur n'a pas pu être lu (${m}). Enregistrez-le en CSV et importez le CSV.`);
  }
}

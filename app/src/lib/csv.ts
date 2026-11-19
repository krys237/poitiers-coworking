// Parseur CSV minimal : détecte le séparateur (; ou ,), gère les guillemets simples, retourne des objets clés par en-tête.
export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n").filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const sep = (lines[0].match(/;/g)?.length ?? 0) >= (lines[0].match(/,/g)?.length ?? 0) ? ";" : ",";

  const splitLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { if (inQ && line[i + 1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
      else if (ch === sep && !inQ) { out.push(cur); cur = ""; }
      else cur += ch;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };

  const headers = splitLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  return lines.slice(1).map((l) => {
    const cells = splitLine(l);
    return Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? ""]));
  });
}

/**
 * Clé de comparaison d'un en-tête de colonne : sans accents, en minuscules, espaces et tirets
 * ramenés à « _ ».
 *
 * `parseCsv` ne retire PAS les accents, et on ne peut pas l'y forcer : six écrans dépendent de
 * sa normalisation, dont le DIPE et ses en-têtes reconnus. La tolérance se fait donc ici, à la
 * lecture — « Noms et prénoms », « NOMS ET PRENOMS » et « noms-et-prenoms » désignent la même
 * colonne, ce qui évite l'échec le plus courant d'un fichier produit à la main.
 */
// L'ordre compte : on rogne AVANT de transformer les espaces en « _ », sinon « " nom " » devient
// « "_nom_" » — `trim` ne retire pas des underscores. Le rognage absorbe au passage le BOM que
// pose Excel en tête de fichier, qui sans cela collerait à la première colonne.
export const cleEntete = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/[\s-]+/g, "_");

/** Première valeur non vide parmi plusieurs orthographes possibles d'une colonne. */
export function valeurColonne(ligne: Record<string, string>, ...noms: string[]): string {
  const parCle = new Map(Object.entries(ligne).map(([k, v]) => [cleEntete(k), v]));
  for (const n of noms) {
    const v = parCle.get(cleEntete(n));
    if (v !== undefined && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

/**
 * Un classeur de tableur se reconnaît à ses premiers octets : « PK » pour les formats
 * compressés (.xlsx, .ods), la signature OLE pour l'ancien .xls. Le lire comme du texte ne
 * produit que du binaire, et aucune bibliothèque de tableur n'est embarquée dans ce projet.
 */
export function estClasseurTableur(nom: string, premiersOctets: Uint8Array): boolean {
  if (/\.(xlsx|xlsm|xlsb|xls|ods)$/i.test(nom)) return true;
  if (premiersOctets[0] === 0x50 && premiersOctets[1] === 0x4b) return true; // PK — zip
  if (premiersOctets[0] === 0xd0 && premiersOctets[1] === 0xcf) return true; // OLE — .xls
  return false;
}

// Convertit "1 234 567" / "1.234.567" / "1234567,00" en entier FCFA.
export function toFcfa(s: string): number {
  const n = parseInt(String(s).replace(/[^\d-]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

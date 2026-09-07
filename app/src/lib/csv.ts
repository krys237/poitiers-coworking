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

// Convertit "1 234 567" / "1.234.567" / "1234567,00" en entier FCFA.
export function toFcfa(s: string): number {
  const n = parseInt(String(s).replace(/[^\d-]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

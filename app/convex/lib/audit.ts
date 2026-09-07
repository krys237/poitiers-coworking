// Audit confidentiel (logique PURE) : catégories, lignes, CSV, variations.
export const CATEGORIES_AUDIT = [
  ["externes", "Prime des médecins externes"],
  ["internes_prescripteurs_labo_radio", "Internes prescripteurs labo & radiologie"],
  ["externes_prescripteurs_labo_radio", "Externes prescripteurs labo & radiologie"],
  ["prescripteurs_scanner", "Prescripteurs de scanner"],
  ["prescripteurs_irm", "Prescripteurs d'IRM"],
  ["interpretes_scanner", "Interprètes scanner"],
  ["interpretes_irm", "Interprètes IRM"],
  ["interpretes_petscan", "Interprètes Petscan"],
  ["prescripteurs_petscan", "Prescripteurs Petscan"],
  ["masse_salariale", "Masse salariale"],
  ["prime_administrative", "Prime administrative"],
  ["heures_supplementaires", "Heures supplémentaires"],
  ["sanctions", "Sanctions"],
  ["conges", "Congés"],
] as const;
export type CategorieAudit = typeof CATEGORIES_AUDIT[number][0];
export const LIBELLE_AUDIT: Record<string, string> = Object.fromEntries(CATEGORIES_AUDIT);
export const estCategorieAudit = (c: string): c is CategorieAudit => c in LIBELLE_AUDIT;

export interface LigneAudit { designation: string; dateDebut?: string; dateFin?: string; montant: number; notes?: string; }

export const totalLignes = (lignes: { montant: number }[]) => lignes.reduce((t, l) => t + Math.round(l.montant || 0), 0);

// Variation d'un mois sur l'autre : delta absolu et pourcentage (null si le précédent est nul).
export function variation(precedent: number, courant: number): { delta: number; pct: number | null } {
  const delta = courant - precedent;
  return { delta, pct: precedent ? Math.round((delta / precedent) * 1000) / 10 : null };
}

// Mois "YYYY-MM" précédent, et liste des n derniers mois (du plus ancien au plus récent).
export function moisPrecedent(periode: string): string {
  const y = +periode.slice(0, 4), m = +periode.slice(5, 7);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}
export function derniersMois(periode: string, n: number): string[] {
  const out = [periode];
  while (out.length < n) out.unshift(moisPrecedent(out[0]));
  return out;
}

// ---- CSV : "Nom / Désignation;Date début;Date fin;Montant (FCFA);Notes" (en-tête optionnel, séparateur ; ou ,) ----
const nombre = (s: string) => { const n = parseFloat(String(s ?? "").replace(/[\s  ]/g, "").replace(",", ".")); return Number.isFinite(n) ? Math.round(n) : 0; };
const esc = (s: string) => (/[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

export function parseCsvAudit(texte: string): LigneAudit[] {
  const lignes = texte.replace(/\r\n?/g, "\n").split("\n").map((l) => l.trim()).filter(Boolean);
  if (!lignes.length) return [];
  const sep = (lignes[0].match(/;/g)?.length ?? 0) >= (lignes[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const aEntete = /d[ée]signation|nom|montant/i.test(lignes[0]);
  return lignes.slice(aEntete ? 1 : 0).map((l) => {
    const c = l.split(sep).map((x) => x.trim().replace(/^"|"$/g, ""));
    return { designation: c[0] ?? "", dateDebut: c[1] || undefined, dateFin: c[2] || undefined, montant: nombre(c[3] ?? "0"), notes: c[4] || undefined };
  }).filter((l) => l.designation && !/^total/i.test(l.designation));
}

export function exportCsvAudit(lignes: LigneAudit[]): string {
  return ["Nom / Désignation;Date début;Date fin;Montant (FCFA);Notes",
    ...lignes.map((l) => [esc(l.designation), l.dateDebut ?? "", l.dateFin ?? "", Math.round(l.montant), esc(l.notes ?? "")].join(";")),
    `TOTAL GÉNÉRAL;;;${totalLignes(lignes)};`].join("\n");
}

// Statistiques & primes (logique PURE) : tableau de caisse mensuel et primes des médecins.
export const POSTES_ESPECES = ["caissePP", "scanner", "quantiferon", "tenofovir", "greenEnergy", "esthetique", "therapieVie", "therapieSommeil"] as const;
export type PosteEspeces = typeof POSTES_ESPECES[number];

export const LIBELLES_CAISSE: Record<string, string> = {
  caissePP: "Caisse PP", scanner: "Scanner", quantiferon: "Quantiferon", tenofovir: "Tenofovir", greenEnergy: "Green Energy",
  esthetique: "Esthétique", therapieVie: "Thérapie vie", therapieSommeil: "Thérapie sommeil", assurance: "Assurance", tepScan: "TEP scan", sortiesDuJour: "Sorties du jour",
};

export interface LigneCaisse {
  dateDebut: string; dateFin: string; horaires?: string;
  caissePP: number; scanner: number; quantiferon: number; tenofovir: number; greenEnergy: number;
  esthetique: number; therapieVie: number; therapieSommeil: number;
  assurance: number; tepScan: number; sortiesDuJour: number;
}

export const LIGNE_VIDE: LigneCaisse = { dateDebut: "", dateFin: "", horaires: "", caissePP: 0, scanner: 0, quantiferon: 0, tenofovir: 0, greenEnergy: 0, esthetique: 0, therapieVie: 0, therapieSommeil: 0, assurance: 0, tepScan: 0, sortiesDuJour: 0 };

// Total espèces = somme des postes encaissés en espèces (hors assurance et TEP scan).
export const totalEspeces = (l: LigneCaisse) => POSTES_ESPECES.reduce((t, k) => t + (l[k] || 0), 0);
// Chiffre d'affaires = total espèces + assurance + TEP scan (les sorties ne sont pas des recettes).
export const chiffreAffaires = (l: LigneCaisse) => totalEspeces(l) + (l.assurance || 0) + (l.tepScan || 0);

export function totauxCaisse(lignes: LigneCaisse[]) {
  const t: Record<string, number> = { totalEspeces: 0, chiffreAffaires: 0, sortiesDuJour: 0 };
  for (const k of [...POSTES_ESPECES, "assurance", "tepScan"]) t[k] = 0;
  for (const l of lignes) {
    for (const k of [...POSTES_ESPECES, "assurance", "tepScan", "sortiesDuJour"] as const) t[k] += l[k] || 0;
    t.totalEspeces += totalEspeces(l); t.chiffreAffaires += chiffreAffaires(l);
  }
  return t;
}

// ---- Primes médecins ----
export const CATEGORIES_PRIMES = [
  ["externes_labo_radio", "Externes — Labo & Radiologie"],
  ["interpretes_scanner", "Interprètes Scanner"],
  ["interpretes_irm", "Interprètes IRM"],
  ["internes_examens", "Internes — Examens"],
  ["prescripteurs_scanner", "Prescripteurs Scanner"],
  ["prescripteurs_irm", "Prescripteurs IRM"],
] as const;
export type CategoriePrime = typeof CATEGORIES_PRIMES[number][0];
export const LIBELLE_CATEGORIE: Record<string, string> = Object.fromEntries(CATEGORIES_PRIMES);

export const montantTotalPrime = (actes: number, montantUnitaire: number) => Math.round((actes || 0) * (montantUnitaire || 0));

// ---- CSV ----
const nombre = (s: string) => { const n = parseFloat(String(s ?? "").replace(/\s/g, "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };
const decouper = (texte: string) => {
  const lignes = texte.replace(/\r\n?/g, "\n").split("\n").map((l) => l.trim()).filter(Boolean);
  if (!lignes.length) return { sep: ";", lignes: [] as string[] };
  const sep = (lignes[0].match(/;/g)?.length ?? 0) >= (lignes[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  return { sep, lignes };
};
const esc = (s: string) => (/[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

const COLS_CAISSE: (keyof LigneCaisse)[] = ["dateDebut", "dateFin", "horaires", ...POSTES_ESPECES, "assurance", "tepScan", "sortiesDuJour"];

// CSV caisse : colonnes dans l'ordre de COLS_CAISSE (en-tête optionnel).
export function parseCsvCaisse(texte: string): LigneCaisse[] {
  const { sep, lignes } = decouper(texte);
  const aEntete = lignes.length > 0 && /date/i.test(lignes[0]);
  return lignes.slice(aEntete ? 1 : 0).map((l) => {
    const c = l.split(sep).map((x) => x.trim().replace(/^"|"$/g, ""));
    const o: any = { ...LIGNE_VIDE };
    COLS_CAISSE.forEach((k, i) => { o[k] = k === "dateDebut" || k === "dateFin" || k === "horaires" ? (c[i] ?? "") : nombre(c[i] ?? "0"); });
    return o as LigneCaisse;
  }).filter((l) => l.dateDebut);
}

export function exportCsvCaisse(lignes: LigneCaisse[]): string {
  const tete = [...COLS_CAISSE.map((k) => LIBELLES_CAISSE[k] ?? (k === "dateDebut" ? "Date début" : k === "dateFin" ? "Date fin" : "Horaires")), "Total espèces", "Chiffre d'affaires"];
  return [tete.join(";"), ...lignes.map((l) => [...COLS_CAISSE.map((k) => esc(String(l[k] ?? ""))), totalEspeces(l), chiffreAffaires(l)].join(";"))].join("\n");
}

export interface LignePrime { designation: string; dateDebut?: string; dateFin?: string; actes: number; montantUnitaire: number; notes?: string; }

// CSV primes : "Médecin;Date début;Date fin;Actes;Montant unitaire;Notes" (en-tête optionnel).
export function parseCsvPrimes(texte: string): LignePrime[] {
  const { sep, lignes } = decouper(texte);
  const aEntete = lignes.length > 0 && /m[ée]decin|actes|montant/i.test(lignes[0]);
  return lignes.slice(aEntete ? 1 : 0).map((l) => {
    const c = l.split(sep).map((x) => x.trim().replace(/^"|"$/g, ""));
    return { designation: c[0] ?? "", dateDebut: c[1] || undefined, dateFin: c[2] || undefined, actes: nombre(c[3] ?? "0"), montantUnitaire: nombre(c[4] ?? "0"), notes: c[5] || undefined };
  }).filter((l) => l.designation);
}

export function exportCsvPrimes(lignes: LignePrime[]): string {
  return ["Médecin;Date début;Date fin;Actes;Montant unitaire;Montant total;Notes",
    ...lignes.map((l) => [esc(l.designation), l.dateDebut ?? "", l.dateFin ?? "", l.actes, l.montantUnitaire, montantTotalPrime(l.actes, l.montantUnitaire), esc(l.notes ?? "")].join(";"))].join("\n");
}

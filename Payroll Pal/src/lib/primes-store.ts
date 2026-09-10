/** Primes et charges saisies par employé et par mois (montant, date, mois). */

export type LignePrime = {
  id: string;
  employeId: string;
  employe: string;
  type: "prime" | "charge";
  libelle: string;
  montant: number;
  date: string; // jj/mm/aaaa
  cle: string; // "2026-07"
};

const KEY = "paie-primes-v1";

export function lirePrimes(): LignePrime[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as LignePrime[]) : [];
  } catch {
    return [];
  }
}

export function ecrirePrimes(list: LignePrime[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

/** Totaux primes / charges par employé pour un mois donné. */
export function totauxDuMois(list: LignePrime[], cle: string) {
  const map: Record<string, { primes: number; charges: number }> = {};
  for (const l of list) {
    if (l.cle !== cle) continue;
    const t = (map[l.employeId] ??= { primes: 0, charges: 0 });
    if (l.type === "prime") t.primes += l.montant;
    else t.charges += l.montant;
  }
  return map;
}

// Sécurité et forme de l'API d'export financière (logique PURE, partagée par l'HTTP action et les tests).
import { BLOCS, SOLDES } from "./tresorerie.ts";
import type { Mouvements, Soldes } from "./tresorerie.ts";

// Comparaison en temps constant : le temps ne dépend ni de la position de la première différence ni de la longueur commune.
export function comparaisonConstante(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a), eb = new TextEncoder().encode(b);
  const n = Math.max(ea.length, eb.length);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < n; i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}

export const ENTITES = BLOCS.map((b) => b.cle);

export function dateValide(d: string | null | undefined): d is string {
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const t = Date.parse(`${d}T00:00:00Z`);
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === d;
}

// entity=poitiers ou entity=poitiers,lilas ; absent = toutes.
export function parseEntites(param: string | null | undefined): { ok: true; entites: string[] } | { ok: false; erreur: string } {
  if (!param) return { ok: true, entites: [...ENTITES] };
  const demandees = param.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const inconnues = demandees.filter((e) => !ENTITES.includes(e));
  if (inconnues.length) return { ok: false, erreur: `Entité(s) inconnue(s) : ${inconnues.join(", ")}. Valeurs : ${ENTITES.join("|")}` };
  return { ok: true, entites: [...new Set(demandees)] };
}

export interface JourneeApi {
  date: string; periode: string; cloture: boolean; mouvements: Mouvements;
  soldesOuverture: Soldes; soldes: Soldes; recetteTotale: number;
}

// Corps de réponse : entités demandées avec leurs mouvements, sous-totaux et soldes liés.
export function reponseApi(j: JourneeApi, entites: string[]) {
  const toutes = entites.length === ENTITES.length;
  const out: Record<string, unknown> = {};
  for (const cle of entites) {
    const bloc = BLOCS.find((b) => b.cle === cle)!;
    const m = j.mouvements[cle] ?? {};
    let entrees = 0, retraits = 0;
    const lignes: Record<string, number> = {};
    for (const l of bloc.lignes) { const val = Math.round(m[l.cle] ?? 0); lignes[l.cle] = val; if (l.sens === "entree") entrees += val; else retraits += val; }
    out[cle] = { libelle: bloc.libelle, lignes, entrees, retraits, net: entrees - retraits };
  }
  const soldesFiltre = (s: Soldes) => Object.fromEntries(SOLDES.filter((x) => toutes || (x.bloc && entites.includes(x.bloc))).map((x) => [x.cle, Math.round(s[x.cle] ?? 0)]));
  return {
    date: j.date, periode: j.periode, cloture: j.cloture, entites: out,
    soldesOuverture: soldesFiltre(j.soldesOuverture), soldes: soldesFiltre(j.soldes),
    recetteTotale: toutes ? j.recetteTotale : Object.values(out).reduce((t, e: any) => t + e.entrees, 0),
  };
}

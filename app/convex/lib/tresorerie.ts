// Logique PURE du grand livre financier journalier : blocs (entités), lignes, soldes reportés.
// Réutilisée par l'écran (calcul live), les fonctions Convex et, plus tard, l'API d'export.

export type Sens = "entree" | "retrait";
export interface Ligne { cle: string; libelle: string; sens: Sens; }
export interface Bloc { cle: string; libelle: string; lignes: Ligne[]; }

const E = (cle: string, libelle: string): Ligne => ({ cle, libelle, sens: "entree" });
const R = (cle: string, libelle: string): Ligne => ({ cle, libelle, sens: "retrait" });
const STD = [E("especes", "Espèces"), E("cheque", "Dépôt chèque"), R("retrait", "Retrait")];

// Clés stables (utilisées par l'API d'export : entity=poitiers|lilas|carte_visa|edrtim_finance|medicaments|biodiagnostic|med_esthetic|autres).
export const BLOCS: Bloc[] = [
  { cle: "poitiers", libelle: "Recettes POITIERS", lignes: [
    E("especes", "Espèces"), E("cheque", "Dépôt chèque"), E("visa", "Carte Visa"), R("retrait", "Retrait"),
    E("om", "OM du jour"), R("retrait_om", "Retrait OM"), E("momo", "MOMO du jour"), R("retrait_momo", "Retrait MOMO"),
  ] },
  { cle: "lilas", libelle: "Pharmacie Les Lilas", lignes: [
    E("especes", "Espèces"), E("cheque", "Dépôt chèque"), R("retrait", "Retrait"),
    E("om", "OM"), R("retrait_om", "Retrait OM"), E("momo", "MOMO"), R("retrait_momo", "Retrait MOMO"),
  ] },
  { cle: "carte_visa", libelle: "Carte Visa", lignes: [E("depot", "Dépôt Carte Visa"), R("retrait", "Retrait Carte Visa")] },
  { cle: "edrtim_finance", libelle: "E DR TIM Finance", lignes: STD },
  { cle: "medicaments", libelle: "Médicaments", lignes: STD },
  { cle: "biodiagnostic", libelle: "Biodiagnostic", lignes: STD },
  { cle: "med_esthetic", libelle: "MED-Esthetic", lignes: STD },
  { cle: "autres", libelle: "Autres lignes", lignes: [E("tdm", "TDM"), E("partage", "Partage"), E("quantiferon", "Quantiferon"), E("tepscan", "TEPSCAN")] },
];

export interface Solde {
  cle: string; libelle: string;
  bloc: string | null;      // bloc dont les lignes alimentent le solde (null = simple report)
  plus: string[]; moins: string[];
  principal: boolean;       // fait partie des 9 soldes d'ouverture (cartes J0)
}

export const SOLDES: Solde[] = [
  { cle: "poitiers_f3", libelle: "F3 POITIERS", bloc: "poitiers", plus: ["especes", "cheque", "visa"], moins: ["retrait"], principal: true },
  { cle: "poitiers_om", libelle: "OM POITIERS", bloc: "poitiers", plus: ["om"], moins: ["retrait_om"], principal: true },
  { cle: "poitiers_momo", libelle: "MOMO POITIERS", bloc: "poitiers", plus: ["momo"], moins: ["retrait_momo"], principal: true },
  { cle: "lilas_f3", libelle: "F3 LES LILAS", bloc: "lilas", plus: ["especes", "cheque"], moins: ["retrait"], principal: true },
  { cle: "edrtim", libelle: "E DR TIM", bloc: null, plus: [], moins: [], principal: true },
  { cle: "lilas_om", libelle: "OM LES LILAS", bloc: "lilas", plus: ["om"], moins: ["retrait_om"], principal: true },
  { cle: "lilas_momo", libelle: "MOMO LES LILAS", bloc: "lilas", plus: ["momo"], moins: ["retrait_momo"], principal: true },
  { cle: "carte_visa", libelle: "CARTE VISA", bloc: "carte_visa", plus: ["depot"], moins: ["retrait"], principal: true },
  { cle: "edrtim_finance", libelle: "E DR TIM FINANCE", bloc: "edrtim_finance", plus: ["especes", "cheque"], moins: ["retrait"], principal: true },
  { cle: "medicaments", libelle: "Solde Médicaments", bloc: "medicaments", plus: ["especes", "cheque"], moins: ["retrait"], principal: false },
  { cle: "biodiagnostic", libelle: "Solde Biodiagnostic", bloc: "biodiagnostic", plus: ["especes", "cheque"], moins: ["retrait"], principal: false },
  { cle: "med_esthetic", libelle: "Solde MED-Esthetic", bloc: "med_esthetic", plus: ["especes", "cheque"], moins: ["retrait"], principal: false },
];
export const SOLDES_PRINCIPAUX = SOLDES.filter((s) => s.principal);

// mouvements[bloc][ligne] = montant FCFA (entier)
export type Mouvements = Record<string, Record<string, number>>;
export type Soldes = Record<string, number>;

const val = (m: Mouvements, bloc: string | null, ligne: string) => (bloc ? Math.round(m[bloc]?.[ligne] ?? 0) : 0);

// solde = J-1 + entrées − retraits (par canal). Les soldes sans bloc sont simplement reportés.
export function calculerSoldes(ouverture: Soldes, m: Mouvements): Soldes {
  const out: Soldes = {};
  for (const s of SOLDES) {
    const prev = Math.round(ouverture[s.cle] ?? 0);
    const plus = s.plus.reduce((t, l) => t + val(m, s.bloc, l), 0);
    const moins = s.moins.reduce((t, l) => t + val(m, s.bloc, l), 0);
    out[s.cle] = prev + plus - moins;
  }
  return out;
}

// Recette totale du jour = somme de toutes les ENTRÉES de tous les blocs (les retraits n'en font pas partie).
export function recetteTotale(m: Mouvements): number {
  let t = 0;
  for (const b of BLOCS) for (const l of b.lignes) if (l.sens === "entree") t += val(m, b.cle, l.cle);
  return t;
}

// Libellé de la formule d'un solde, pour l'affichage (ex. "J-1 + Espèces + Dépôt chèque + Carte Visa − Retrait").
export function formule(s: Solde): string {
  if (!s.bloc) return "report J-1";
  const bloc = BLOCS.find((b) => b.cle === s.bloc)!;
  const lib = (cle: string) => bloc.lignes.find((l) => l.cle === cle)?.libelle ?? cle;
  return ["J-1", ...s.plus.map(lib)].join(" + ") + (s.moins.length ? " − " + s.moins.map(lib).join(" − ") : "");
}

export const periodeDe = (date: string) => date.slice(0, 7);
export const CLE_PIECE = (bloc: string, ligne: string) => `${bloc}.${ligne}`;

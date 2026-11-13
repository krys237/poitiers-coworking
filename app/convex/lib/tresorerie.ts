// Logique PURE du grand livre financier journalier : blocs (entités), lignes, soldes reportés.
// Réutilisée par l'écran (calcul live), les fonctions Convex et, plus tard, l'API d'export.

export type Sens = "entree" | "retrait";
export interface Ligne { cle: string; libelle: string; sens: Sens; }
export interface Bloc { cle: string; libelle: string; lignes: Ligne[]; }

const E = (cle: string, libelle: string): Ligne => ({ cle, libelle, sens: "entree" });
const R = (cle: string, libelle: string): Ligne => ({ cle, libelle, sens: "retrait" });

// Colonne « Autres » : présente sur CHAQUE ligne de la matrice depuis le 13/11/2026. Elle sert aux
// sommes injectées dans une caisse pour permettre le traitement des opérations — de l'argent qui
// entrait réellement sans qu'aucune case ne permette de l'enregistrer. Elle alimente le solde de
// la ligne où elle se trouve, et compte dans la recette du jour.
const AUTRES = E("autres", "Autres");
const STD = [E("especes", "Espèces"), E("cheque", "Dépôt chèque"), R("retrait", "Retrait"), AUTRES];

// Clés stables (utilisées par l'API d'export : entity=poitiers|lilas|carte_visa|edrtim_finance|medicaments|biodiagnostic|biodiagnostic_advens|med_esthetic|autres).
export const BLOCS: Bloc[] = [
  // Décision du propriétaire du 06/11/2026 : l'encaissement par carte ne transite plus par la
  // caisse. Il se saisit sous la colonne « Carte Visa » (ligne `carte_visa.depot`), et la ligne
  // « Carte Visa » du bloc POITIERS est donc RETIRÉE. Elle était la cause d'erreurs répétées : la
  // matrice de saisie présente une colonne « Carte Visa » qui, sous POITIERS, visait `poitiers.visa`
  // et sous Carte Visa visait `carte_visa.depot` — deux cellules voisines pour le même argent, dont
  // l'une gonflait le solde F3. Cinq journées d'octobre et celle du 15/10 ont dû être corrigées.
  { cle: "poitiers", libelle: "Recettes POITIERS", lignes: [
    E("especes", "Espèces"), E("cheque", "Dépôt chèque"), R("retrait", "Retrait"),
    E("om", "OM du jour"), R("retrait_om", "Retrait OM"), E("momo", "MOMO du jour"), R("retrait_momo", "Retrait MOMO"),
    AUTRES,
  ] },
  { cle: "lilas", libelle: "Pharmacie Les Lilas", lignes: [
    E("especes", "Espèces"), E("cheque", "Dépôt chèque"), R("retrait", "Retrait"),
    E("om", "OM"), R("retrait_om", "Retrait OM"), E("momo", "MOMO"), R("retrait_momo", "Retrait MOMO"),
    AUTRES,
  ] },
  { cle: "carte_visa", libelle: "Carte Visa", lignes: [E("depot", "Dépôt Carte Visa"), R("retrait", "Retrait Carte Visa"), AUTRES] },
  { cle: "edrtim_finance", libelle: "E DR TIM Finance", lignes: STD },
  { cle: "medicaments", libelle: "Médicaments", lignes: STD },
  // Deux biodiagnostics depuis le 13/11/2026, et la distinction n'est pas cosmétique : le relevé du
  // DAF compte les recettes courantes du laboratoire DANS le F3 (elles vont dans la caisse
  // POITIERS), mais pas les mouvements Advens. Confondre les deux produisait l'écart constaté le
  // 12/11 — 97 600 au 16/10, 38 850 au 23/10, 57 000 au 30/10, au franc près.
  { cle: "biodiagnostic", libelle: "Biodiagnostic 1", lignes: STD },
  { cle: "biodiagnostic_advens", libelle: "Biodiagnostic Advens", lignes: STD },
  { cle: "med_esthetic", libelle: "MED-Esthetic", lignes: STD },
  // Ligne au gabarit particulier : ses champs lui sont propres (prestations), plus la colonne
  // « Autres » commune, au bout. Elle n'a ni espèces ni retrait — d'où ses lignes distinctes.
  { cle: "autres", libelle: "Autres prestations", lignes: [
    E("tdm", "TDM"), E("partage", "Invest"), E("quantiferon", "Quantiferon"), E("tepscan", "TEPSCAN"), AUTRES,
  ] },
];

// Contribution d'un AUTRE bloc à un solde. Introduit le 13/11/2026 pour que les recettes
// Biodiagnostic 1 alimentent le F3 POITIERS : l'argent du laboratoire finit dans la caisse de
// POITIERS, il n'a donc pas de solde propre — lui en laisser un le compterait deux fois.
export interface Apport { bloc: string; plus: string[]; moins?: string[]; }

export interface Solde {
  cle: string; libelle: string;
  bloc: string | null;      // bloc dont les lignes alimentent le solde (null = simple report)
  plus: string[]; moins: string[];
  apports?: Apport[];       // lignes d'autres blocs qui tombent dans ce solde
  principal: boolean;       // fait partie des soldes d'ouverture (cartes J0)
}

export const SOLDES: Solde[] = [
  // `visa` retiré de l'assiette le 06/11/2026 : l'encaissement par carte va sur la carte, pas en
  // caisse. `cheque` retiré le 13/11/2026 : le dépôt chèque n'est pas de la liquidité de caisse, il
  // a désormais sa propre tuile. Et Biodiagnostic 1 y entre, parce que c'est ainsi que la DAF le
  // compte depuis toujours. Le F3 vaut donc espèces + autres + biodiagnostic 1 − retraits.
  { cle: "poitiers_f3", libelle: "F3 POITIERS", bloc: "poitiers", plus: ["especes", "autres"], moins: ["retrait"],
    apports: [{ bloc: "biodiagnostic", plus: ["especes", "cheque", "autres"], moins: ["retrait"] }], principal: true },
  { cle: "poitiers_cheque", libelle: "CHÈQUES POITIERS", bloc: "poitiers", plus: ["cheque"], moins: [], principal: true },
  { cle: "poitiers_om", libelle: "OM POITIERS", bloc: "poitiers", plus: ["om"], moins: ["retrait_om"], principal: true },
  { cle: "poitiers_momo", libelle: "MOMO POITIERS", bloc: "poitiers", plus: ["momo"], moins: ["retrait_momo"], principal: true },
  { cle: "lilas_f3", libelle: "F3 LES LILAS", bloc: "lilas", plus: ["especes", "cheque", "autres"], moins: ["retrait"], principal: true },
  { cle: "edrtim", libelle: "E DR TIM", bloc: null, plus: [], moins: [], principal: true },
  { cle: "lilas_om", libelle: "OM LES LILAS", bloc: "lilas", plus: ["om"], moins: ["retrait_om"], principal: true },
  { cle: "lilas_momo", libelle: "MOMO LES LILAS", bloc: "lilas", plus: ["momo"], moins: ["retrait_momo"], principal: true },
  { cle: "carte_visa", libelle: "CARTE VISA", bloc: "carte_visa", plus: ["depot", "autres"], moins: ["retrait"], principal: true },
  { cle: "edrtim_finance", libelle: "E DR TIM FINANCE", bloc: "edrtim_finance", plus: ["especes", "cheque", "autres"], moins: ["retrait"], principal: true },
  { cle: "medicaments", libelle: "Solde Médicaments", bloc: "medicaments", plus: ["especes", "cheque", "autres"], moins: ["retrait"], principal: false },
  // Pas de solde `biodiagnostic` : ses recettes sont dans le F3 POITIERS (voir ci-dessus).
  { cle: "biodiagnostic_advens", libelle: "Solde Biodiagnostic Advens", bloc: "biodiagnostic_advens", plus: ["especes", "cheque", "autres"], moins: ["retrait"], principal: false },
  { cle: "med_esthetic", libelle: "Solde MED-Esthetic", bloc: "med_esthetic", plus: ["especes", "cheque", "autres"], moins: ["retrait"], principal: false },
];
export const SOLDES_PRINCIPAUX = SOLDES.filter((s) => s.principal);

// mouvements[bloc][ligne] = montant FCFA (entier)
export type Mouvements = Record<string, Record<string, number>>;
export type Soldes = Record<string, number>;

const val = (m: Mouvements, bloc: string | null, ligne: string) => (bloc ? Math.round(m[bloc]?.[ligne] ?? 0) : 0);

// solde = J-1 + entrées − retraits (par canal, apports d'autres blocs compris).
// Les soldes sans bloc ni apport sont simplement reportés.
export function calculerSoldes(ouverture: Soldes, m: Mouvements): Soldes {
  const out: Soldes = {};
  for (const s of SOLDES) {
    const prev = Math.round(ouverture[s.cle] ?? 0);
    let plus = s.plus.reduce((t, l) => t + val(m, s.bloc, l), 0);
    let moins = s.moins.reduce((t, l) => t + val(m, s.bloc, l), 0);
    for (const a of s.apports ?? []) {
      plus += a.plus.reduce((t, l) => t + val(m, a.bloc, l), 0);
      moins += (a.moins ?? []).reduce((t, l) => t + val(m, a.bloc, l), 0);
    }
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

// Libellé de la formule d'un solde, pour l'affichage
// (ex. "J-1 + Espèces + Autres + Biodiagnostic 1 − Retrait").
export function formule(s: Solde): string {
  const libDe = (cleBloc: string, cle: string) => {
    const b = BLOCS.find((x) => x.cle === cleBloc);
    return b?.lignes.find((l) => l.cle === cle)?.libelle ?? cle;
  };
  if (!s.bloc && !(s.apports ?? []).length) return "report J-1";
  const plus = s.bloc ? s.plus.map((c) => libDe(s.bloc!, c)) : [];
  const moins = s.bloc ? s.moins.map((c) => libDe(s.bloc!, c)) : [];
  for (const a of s.apports ?? []) {
    const nom = BLOCS.find((b) => b.cle === a.bloc)?.libelle ?? a.bloc;
    plus.push(nom);
  }
  return ["J-1", ...plus].join(" + ") + (moins.length ? " − " + moins.join(" − ") : "");
}

export const periodeDe = (date: string) => date.slice(0, 7);
export const CLE_PIECE = (bloc: string, ligne: string) => `${bloc}.${ligne}`;

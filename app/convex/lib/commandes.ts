// Commandes (logique PURE) : totaux, comparaison entre commandes successives, import/export CSV des lignes de registre.
export interface LigneCommande {
  produit: string;
  dci?: string;
  ancienneDate?: string;
  ancienneQuantite?: number;
  quantiteUtilisee?: number;
  quantiteRestante?: number;
  quantite: number;
  prixUnitaire: number;
}

export const totalLigne = (l: LigneCommande) => Math.round(l.quantite * l.prixUnitaire);
export const totalCommande = (lignes: LigneCommande[]) => lignes.reduce((t, l) => t + totalLigne(l), 0);

const cle = (p: string) => p.trim().toLowerCase().replace(/\s+/g, " ");

export interface Comparaison {
  ajoutes: LigneCommande[];
  retires: LigneCommande[];
  modifies: { produit: string; avant: { quantite: number; prixUnitaire: number }; apres: { quantite: number; prixUnitaire: number } }[];
  inchanges: number;
  totalAvant: number;
  totalApres: number;
  variation: number;      // totalApres − totalAvant
  variationPct: number | null; // null si totalAvant = 0
}

// Compare une commande à la précédente du même type (clé = produit normalisé).
export function comparer(avant: LigneCommande[], apres: LigneCommande[]): Comparaison {
  const mA = new Map(avant.map((l) => [cle(l.produit), l]));
  const mB = new Map(apres.map((l) => [cle(l.produit), l]));
  const ajoutes: LigneCommande[] = [], retires: LigneCommande[] = [], modifies: Comparaison["modifies"] = [];
  let inchanges = 0;
  for (const [k, l] of mB) {
    const a = mA.get(k);
    if (!a) { ajoutes.push(l); continue; }
    if (a.quantite !== l.quantite || a.prixUnitaire !== l.prixUnitaire) {
      modifies.push({ produit: l.produit, avant: { quantite: a.quantite, prixUnitaire: a.prixUnitaire }, apres: { quantite: l.quantite, prixUnitaire: l.prixUnitaire } });
    } else inchanges++;
  }
  for (const [k, l] of mA) if (!mB.has(k)) retires.push(l);
  const totalAvant = totalCommande(avant), totalApres = totalCommande(apres);
  const variation = totalApres - totalAvant;
  return { ajoutes, retires, modifies, inchanges, totalAvant, totalApres, variation, variationPct: totalAvant ? Math.round((variation / totalAvant) * 1000) / 10 : null };
}

const nombre = (s: string) => { const n = parseFloat(String(s).replace(/\s/g, "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };

// CSV attendu : compatible standard ou registre complet.
export function parseCsvLignes(texte: string): LigneCommande[] {
  const lignes = texte.replace(/\r\n?/g, "\n").split("\n").map((l) => l.trim()).filter(Boolean);
  if (!lignes.length) return [];
  const sep = (lignes[0].match(/;/g)?.length ?? 0) >= (lignes[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const cellules = (l: string) => l.split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
  const tete = cellules(lignes[0]).map((c) => c.toLowerCase());
  const aEntete = tete.some((c) => /produit|dci|designation|quantit|prix/.test(c));
  let iProd = 0, iDci = 1, iQte = 2, iPu = 3;
  let iAncDate = -1, iAncQte = -1, iUtil = -1, iRest = -1;

  if (aEntete) {
    iProd = tete.findIndex((c) => /produit|nom|designation/.test(c));
    iDci = tete.findIndex((c) => /dci/.test(c));
    iQte = tete.findIndex((c) => /nouvelle.*q|quantit$|qt$|quantite/.test(c));
    iPu = tete.findIndex((c) => /prix|pu/.test(c));
    iAncDate = tete.findIndex((c) => /anc.*date/.test(c));
    iAncQte = tete.findIndex((c) => /anc.*q/.test(c));
    iUtil = tete.findIndex((c) => /utilis/.test(c));
    iRest = tete.findIndex((c) => /restan/.test(c));
    if (iQte < 0) iQte = 2;
    if (iPu < 0) iPu = 3;
  }
  return lignes.slice(aEntete ? 1 : 0).map(cellules).map((c) => ({
    produit: c[iProd] ?? "",
    dci: iDci >= 0 && c[iDci] ? c[iDci] : undefined,
    ancienneDate: iAncDate >= 0 ? c[iAncDate] : undefined,
    ancienneQuantite: iAncQte >= 0 ? nombre(c[iAncQte]) : undefined,
    quantiteUtilisee: iUtil >= 0 ? nombre(c[iUtil]) : undefined,
    quantiteRestante: iRest >= 0 ? nombre(c[iRest]) : undefined,
    quantite: nombre(c[iQte] ?? "1") || 1,
    prixUnitaire: nombre(c[iPu] ?? "0"),
  })).filter((l) => l.produit);
}

export function exportCsvLignes(lignes: LigneCommande[]): string {
  const esc = (s: string) => (/[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const aRegistre = lignes.some((l) => l.ancienneQuantite !== undefined || l.quantiteUtilisee !== undefined);

  if (aRegistre) {
    return [
      "Désignation;Ancienne commande date;Ancienne commande qté;Qté utilisée;Qté restante;Nouvelle commande qté;Prix unitaire;Prix total",
      ...lignes.map((l) => [
        esc(l.produit),
        esc(l.ancienneDate ?? ""),
        l.ancienneQuantite ?? "",
        l.quantiteUtilisee ?? "",
        l.quantiteRestante ?? "",
        l.quantite,
        l.prixUnitaire,
        totalLigne(l),
      ].join(";")),
    ].join("\n");
  }

  return [
    "Nom du produit;DCI;Quantité;Prix unitaire;Prix total",
    ...lignes.map((l) => [esc(l.produit), esc(l.dci ?? ""), l.quantite, l.prixUnitaire, totalLigne(l)].join(";")),
  ].join("\n");
}

// Référence séquentielle "CMD-2026-007".
export const reference = (prefixe: string, annee: number, n: number) => `${prefixe}-${annee}-${String(n).padStart(3, "0")}`;

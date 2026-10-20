import { useMemo, useEffect } from "react";
import { Plus, Trash2, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { fcfa } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ChampDesignationAutocomplete } from "./champ-designation-autocomplete";
import { normaliserCleProduit } from "../../../convex/lib/commandes";

export interface LigneRegistre {
  produit: string;
  dci?: string;
  ancienneDate?: string;
  ancienneQuantite?: number;
  quantiteUtilisee?: number;
  quantiteRestante?: number;
  quantite: number; // Nouvelle commande Qté
  prixUnitaire: number;
}

export interface AntecedentAchat {
  cle: string;
  produit: string;
  date: string;
  quantite: number;
  prixUnitaire: number;
  reference: string;
  commandeId: string;
}

interface RegistreCommandeTableProps {
  lignes: LigneRegistre[];
  onChange?: (nouvellesLignes: LigneRegistre[]) => void;
  dateCommande?: string;
  editable?: boolean;
  categorie?: "medicale" | "reactifs_labo" | "fourniture";
  antecedents?: AntecedentAchat[] | Record<string, AntecedentAchat> | Map<string, AntecedentAchat>;
}

export function RegistreCommandeTable({
  lignes,
  onChange,
  dateCommande,
  editable = false,
  categorie,
  antecedents,
}: RegistreCommandeTableProps) {
  // Indexation mémoire des antécédents d'achats par clé produit normalisée (sans accents/minuscules)
  const antecedentsMap = useMemo(() => {
    const map = new Map<string, AntecedentAchat>();
    if (!antecedents) return map;
    if (Array.isArray(antecedents)) {
      for (const a of antecedents) {
        const k = a.cle || normaliserCleProduit(a.produit);
        if (k) map.set(k, a);
      }
    } else if (antecedents instanceof Map) {
      return antecedents;
    } else {
      for (const [k, v] of Object.entries(antecedents)) {
        map.set(normaliserCleProduit(k), v);
      }
    }
    return map;
  }, [antecedents]);

  // Synchronisation automatique des lignes existantes lorsque les antécédents sont chargés depuis la BD
  useEffect(() => {
    if (!editable || !onChange || !antecedentsMap.size || !lignes.length) return;
    let aModifie = false;
    const maj = lignes.map((l) => {
      if (!l.produit.trim()) return l;
      const k = normaliserCleProduit(l.produit);
      const ant = antecedentsMap.get(k);
      if (!ant) return l;

      let modifLigne = false;
      const ancDate = ant.date;
      const ancQte = ant.quantite;
      const item = { ...l };

      if (item.ancienneDate !== ancDate) {
        item.ancienneDate = ancDate;
        modifLigne = true;
      }
      if (item.ancienneQuantite !== ancQte) {
        item.ancienneQuantite = ancQte;
        modifLigne = true;
      }
      if (!item.prixUnitaire || Number(item.prixUnitaire) === 0) {
        item.prixUnitaire = ant.prixUnitaire;
        modifLigne = true;
      }

      // Calcul dynamique de quantiteUtilisee = ancienneQuantite - quantiteRestante
      if (item.quantiteRestante !== undefined && item.quantiteRestante !== null) {
        const nouvUt = Math.max(0, ancQte - Number(item.quantiteRestante));
        if (item.quantiteUtilisee !== nouvUt) {
          item.quantiteUtilisee = nouvUt;
          modifLigne = true;
        }
      }

      if (modifLigne) aModifie = true;
      return item;
    });

    if (aModifie) {
      onChange(maj);
    }
  }, [antecedentsMap, editable]);

  const majProduitEtPrix = (index: number, produit: string, prixSuggere?: number) => {
    if (!onChange) return;
    const copie = [...lignes];
    const item = { ...copie[index], produit };
    const k = normaliserCleProduit(produit);
    const ant = k ? antecedentsMap.get(k) : undefined;

    if (ant) {
      // Option 1 : Antécédent en base trouvé -> verrouillage et pré-remplissage automatique
      item.ancienneDate = ant.date;
      item.ancienneQuantite = ant.quantite;
      if (!item.prixUnitaire || Number(item.prixUnitaire) === 0) {
        item.prixUnitaire = ant.prixUnitaire || prixSuggere || 0;
      }
      if (item.quantiteRestante !== undefined && item.quantiteRestante !== null) {
        item.quantiteUtilisee = Math.max(0, ant.quantite - Number(item.quantiteRestante));
      }
    } else {
      // Option 3 : Aucun antécédent (base vide ou nouveau produit) -> saisie manuelle libre
      if (prixSuggere && (!item.prixUnitaire || Number(item.prixUnitaire) === 0)) {
        item.prixUnitaire = prixSuggere;
      }
    }

    copie[index] = item;
    onChange(copie);
  };

  const majLigne = (index: number, champ: keyof LigneRegistre, valeur: any) => {
    if (!onChange) return;
    const copie = [...lignes];
    const item = { ...copie[index], [champ]: valeur };
    const k = normaliserCleProduit(item.produit);
    const ant = k ? antecedentsMap.get(k) : undefined;
    const anc = Number(ant?.quantite ?? item.ancienneQuantite) || 0;

    // Calcul bidirectionnel automatique : Ancienne Qté = Utilisée + Restante
    if (champ === "quantiteRestante") {
      const rest = Number(valeur) || 0;
      if (anc > 0) {
        item.quantiteUtilisee = Math.max(0, anc - rest);
      }
    } else if (champ === "quantiteUtilisee") {
      const ut = Number(valeur) || 0;
      if (anc > 0) {
        item.quantiteRestante = Math.max(0, anc - ut);
      }
    } else if (champ === "ancienneQuantite") {
      const nouvAnc = Number(valeur) || 0;
      if (item.quantiteRestante !== undefined && item.quantiteRestante > 0) {
        item.quantiteUtilisee = Math.max(0, nouvAnc - item.quantiteRestante);
      } else if (item.quantiteUtilisee !== undefined && item.quantiteUtilisee > 0) {
        item.quantiteRestante = Math.max(0, nouvAnc - item.quantiteUtilisee);
      }
    }

    copie[index] = item;
    onChange(copie);
  };

  const ajouterLigne = () => {
    if (!onChange) return;
    onChange([
      ...lignes,
      {
        produit: "",
        ancienneDate: "",
        ancienneQuantite: 0,
        quantiteUtilisee: 0,
        quantiteRestante: 0,
        quantite: 1,
        prixUnitaire: 0,
      },
    ]);
  };

  const supprimerLigne = (index: number) => {
    if (!onChange || lignes.length <= 1) return;
    onChange(lignes.filter((_, i) => i !== index));
  };

  const totalGeneral = lignes.reduce(
    (acc, l) => acc + (Number(l.quantite) || 0) * (Number(l.prixUnitaire) || 0),
    0
  );

  return (
    <div className="rounded-xl border border-filet overflow-hidden bg-surface shadow-2xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          {/* En-tête multi-niveaux inspiré du registre manuscrit de pharmacie */}
          <thead>
            <tr className="bg-slate-100/80 border-b border-filet text-3xs font-bold uppercase text-slate-700 tracking-wider">
              <th rowSpan={2} className="p-2.5 w-10 text-center border-r border-filet">
                #
              </th>
              <th rowSpan={2} className="p-2.5 min-w-[200px] border-r border-filet">
                Désignation
              </th>
              <th
                colSpan={2}
                className="p-2 text-center border-r border-filet bg-blue-50/60 text-ocean-profond"
                title="Antécédent d'achat : verrouillé automatiquement dès qu'un achat antérieur existe, ou saisie manuelle si 1er achat"
              >
                <div className="flex flex-col items-center justify-center gap-0.5">
                  <span className="font-bold tracking-wider">Ancienne commande</span>
                  <span className="inline-flex items-center gap-1 text-4xs font-medium px-2 py-0.5 rounded-full bg-white/90 border border-blue-200/80 text-ocean-profond shadow-2xs normal-case tracking-normal">
                    <Lock className="h-2.5 w-2.5 shrink-0 text-ocean-profond" />
                    <span>Auto &middot; Libre si vierge</span>
                  </span>
                </div>
              </th>
              <th rowSpan={2} className="p-2.5 text-right w-24 border-r border-filet bg-amber-50/40 text-amber-900" title="Qté consommée = Ancienne Qté − Qté restante">
                <div className="flex flex-col items-end">
                  <span>Qté utilisée</span>
                  <span className="text-4xs font-mono font-normal opacity-70">Anc. − Rest.</span>
                </div>
              </th>
              <th rowSpan={2} className="p-2.5 text-right w-24 border-r border-filet bg-emerald-50/40 text-emerald-900" title="Pointage physique en rayon">
                <div className="flex flex-col items-end">
                  <span>Qté restante</span>
                  <span className="text-4xs font-normal opacity-70">En rayon</span>
                </div>
              </th>
              <th colSpan={2} className="p-2 text-center border-r border-filet bg-purple-50/60 text-purple-900">
                Nouvelle commande
              </th>
              <th rowSpan={2} className="p-2.5 text-right w-28 border-r border-filet">
                P.U. (FCFA)
              </th>
              <th rowSpan={2} className="p-2.5 text-right w-32">
                Total ligne
              </th>
              {editable && <th rowSpan={2} className="p-2.5 w-10 text-center"></th>}
            </tr>
            <tr className="bg-slate-50 border-b border-filet text-3xs font-semibold text-slate-600">
              {/* Sous-colonnes Ancienne commande */}
              <th className="p-1.5 text-center w-28 border-r border-filet font-mono bg-blue-50/30">
                Date
              </th>
              <th className="p-1.5 text-right w-20 border-r border-filet font-mono bg-blue-50/30">
                Qté
              </th>
              {/* Sous-colonnes Nouvelle commande */}
              <th className="p-1.5 text-center w-28 border-r border-filet font-mono bg-purple-50/30">
                Date
              </th>
              <th className="p-1.5 text-right w-20 border-r border-filet font-mono bg-purple-50/30">
                Qté
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-filet bg-white">
            {lignes.map((l, i) => {
              const qte = Number(l.quantite) || 0;
              const pu = Number(l.prixUnitaire) || 0;
              const totalLigne = qte * pu;

              const k = normaliserCleProduit(l.produit);
              const ant = k ? antecedentsMap.get(k) : undefined;
              const aUnAntecedent = Boolean(ant);

              const affichageDateAnc = aUnAntecedent ? ant?.date : l.ancienneDate;
              const affichageQteAnc = aUnAntecedent
                ? ant?.quantite
                : l.ancienneQuantite !== undefined
                ? l.ancienneQuantite
                : undefined;

              if (!editable) {
                // Rendu en mode consultation (Fiche détaillée ou Registre)
                return (
                  <tr key={i} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-2.5 text-center font-mono text-slate-400 text-2xs border-r border-filet">
                      {i + 1}
                    </td>
                    <td className="p-2.5 font-semibold text-ocean-nuit border-r border-filet">
                      <div className="flex items-center gap-1.5">
                        <span>{l.produit || <span className="text-slate-400 italic">Sans libellé</span>}</span>
                        {aUnAntecedent && (
                          <span
                            className="inline-flex items-center gap-0.5 text-4xs font-mono px-1 py-0.2 rounded bg-blue-50 text-ocean-profond border border-blue-200"
                            title={`Historique issu du bon ${ant?.reference}`}
                          >
                            <Lock className="h-2.5 w-2.5" />
                            {ant?.reference}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-2 text-center font-mono text-2xs text-slate-600 border-r border-filet bg-blue-50/10">
                      {affichageDateAnc || "—"}
                    </td>
                    <td className="p-2 text-right font-mono font-medium text-slate-700 border-r border-filet bg-blue-50/10">
                      {affichageQteAnc !== undefined ? affichageQteAnc : "—"}
                    </td>
                    <td className="p-2 text-right font-mono font-medium text-amber-800 border-r border-filet bg-amber-50/10">
                      {l.quantiteUtilisee !== undefined ? l.quantiteUtilisee : "—"}
                    </td>
                    <td className="p-2 text-right font-mono font-medium border-r border-filet bg-emerald-50/10">
                      {l.quantiteRestante !== undefined ? (
                        <span
                          className={cn(
                            "px-1.5 py-0.5 rounded-md text-xs",
                            l.quantiteRestante <= 2
                              ? "bg-rose-100 text-rose-800 font-bold"
                              : "text-emerald-800 font-semibold"
                          )}
                        >
                          {l.quantiteRestante}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-2 text-center font-mono text-2xs text-purple-700 border-r border-filet bg-purple-50/10">
                      {dateCommande || "En cours"}
                    </td>
                    <td className="p-2 text-right font-mono font-bold text-purple-900 border-r border-filet bg-purple-50/10">
                      {l.quantite}
                    </td>
                    <td className="p-2 text-right font-mono text-slate-700 border-r border-filet">
                      {fcfa(pu)}
                    </td>
                    <td className="p-2 text-right font-mono font-bold text-ocean-profond">
                      {fcfa(totalLigne)}
                    </td>
                  </tr>
                );
              }

              // Rendu en mode saisie (Formulaire de commande / Registre éditable)
              return (
                <tr key={i} className="hover:bg-slate-50/50">
                  <td className="p-2 text-center text-slate-400 font-mono text-2xs border-r border-filet">
                    {i + 1}
                  </td>

                  {/* 1. Désignation avec autocomplétion prédictive */}
                  <td className="p-2 border-r border-filet min-w-[220px]">
                    <ChampDesignationAutocomplete
                      valeur={l.produit}
                      onChange={(designation, prixSuggere) => majProduitEtPrix(i, designation, prixSuggere)}
                      categorie={categorie}
                      placeholder={
                        categorie === "reactifs_labo"
                          ? "Bio-Rad, Test Paludisme, Tube…"
                          : categorie === "fourniture"
                          ? "Ramette A4, Stylo, Javel…"
                          : "Amoxicilline, Gants, Sérum…"
                      }
                    />
                  </td>

                  {/* 2. Ancienne commande - Date */}
                  <td className="p-1.5 border-r border-filet bg-blue-50/10">
                    {aUnAntecedent ? (
                      <div
                        className="h-7 px-1.5 flex items-center justify-center gap-1 text-2xs font-mono font-semibold rounded bg-blue-50/80 border border-blue-200 text-blue-900 cursor-help select-none"
                        title={`🔒 Verrouillé (Option 1) : Historique issu automatiquement du bon ${ant?.reference} (${ant?.date})`}
                      >
                        <Lock className="h-2.5 w-2.5 text-blue-700 shrink-0" />
                        <span className="truncate">{affichageDateAnc}</span>
                      </div>
                    ) : (
                      <Input
                        type="date"
                        value={l.ancienneDate ?? ""}
                        onChange={(e) => majLigne(i, "ancienneDate", e.target.value)}
                        className="h-7 text-2xs font-mono bg-white border-filet text-center px-1"
                        placeholder="AAAA-MM-JJ"
                        title="Option 3 : Saisie manuelle libre (aucun antécédent en base pour ce produit)"
                      />
                    )}
                  </td>

                  {/* 2. Ancienne commande - Qté */}
                  <td className="p-1.5 border-r border-filet bg-blue-50/10">
                    {aUnAntecedent ? (
                      <div
                        className="h-7 px-2 flex items-center justify-end gap-1 text-xs font-mono font-bold rounded bg-blue-50/80 border border-blue-200 text-blue-900 cursor-help select-none"
                        title={`🔒 Verrouillé (Option 1) : ${ant?.quantite} unité(s) commandée(s) sur le bon ${ant?.reference}`}
                      >
                        <Lock className="h-2.5 w-2.5 text-blue-700 shrink-0" />
                        <span>{affichageQteAnc}</span>
                      </div>
                    ) : (
                      <Input
                        type="number"
                        min={0}
                        value={l.ancienneQuantite ?? ""}
                        placeholder="0"
                        onFocus={(e) => e.target.select()}
                        onChange={(e) =>
                          majLigne(i, "ancienneQuantite", e.target.value === "" ? 0 : Number(e.target.value))
                        }
                        className="h-7 text-xs text-right font-mono bg-white border-filet"
                        title="Option 3 : Saisie manuelle libre (aucun antécédent en base pour ce produit)"
                      />
                    )}
                  </td>

                  {/* 3. Qté utilisée (calculée automatiquement si restante renseignée, ou saisissable) */}
                  <td className="p-1.5 border-r border-filet bg-amber-50/10">
                    <Input
                      type="number"
                      min={0}
                      value={l.quantiteUtilisee ?? ""}
                      placeholder="0"
                      onFocus={(e) => e.target.select()}
                      onChange={(e) =>
                        majLigne(i, "quantiteUtilisee", e.target.value === "" ? 0 : Number(e.target.value))
                      }
                      className="h-7 text-xs text-right font-mono bg-amber-50/30 border-amber-200 text-amber-900 font-bold"
                      title="Quantité utilisée/consommée = Ancienne Qté − Qté restante (calculée automatiquement)"
                    />
                  </td>

                  {/* 4. Qté restante (Pointage physique en rayon) */}
                  <td className="p-1.5 border-r border-filet bg-emerald-50/10">
                    <Input
                      type="number"
                      min={0}
                      value={l.quantiteRestante ?? ""}
                      placeholder="0"
                      onFocus={(e) => e.target.select()}
                      onChange={(e) =>
                        majLigne(i, "quantiteRestante", e.target.value === "" ? 0 : Number(e.target.value))
                      }
                      className="h-7 text-xs text-right font-mono bg-emerald-50/30 border-emerald-300 text-emerald-900 font-bold"
                      title="Quantité constatée en rayon lors du pointage de stock"
                    />
                  </td>

                  {/* 5. Nouvelle commande - Date (repère visuel) */}
                  <td className="p-1.5 border-r border-filet bg-purple-50/10 text-center font-mono text-2xs text-purple-800">
                    {dateCommande || "Aujourd'hui"}
                  </td>

                  {/* 5. Nouvelle commande - Qté */}
                  <td className="p-1.5 border-r border-filet bg-purple-50/10">
                    <Input
                      type="number"
                      min={1}
                      value={l.quantite ? l.quantite : ""}
                      placeholder="1"
                      onFocus={(e) => e.target.select()}
                      onChange={(e) =>
                        majLigne(i, "quantite", e.target.value === "" ? 0 : Number(e.target.value))
                      }
                      className="h-7 text-xs text-right font-mono bg-white border-filet font-bold text-purple-900"
                    />
                  </td>

                  {/* 6. Prix unitaire */}
                  <td className="p-1.5 border-r border-filet">
                    <Input
                      type="number"
                      min={0}
                      value={l.prixUnitaire ? l.prixUnitaire : ""}
                      placeholder="0"
                      onFocus={(e) => e.target.select()}
                      onChange={(e) =>
                        majLigne(i, "prixUnitaire", e.target.value === "" ? 0 : Number(e.target.value))
                      }
                      className="h-7 text-xs text-right font-mono bg-white border-filet"
                    />
                  </td>

                  {/* 7. Total ligne calculé */}
                  <td className="p-2 text-right font-mono font-bold text-ocean-nuit">
                    {fcfa(totalLigne)}
                  </td>

                  {/* Action supprimer */}
                  <td className="p-1 text-center">
                    {lignes.length > 1 && (
                      <button
                        type="button"
                        onClick={() => supprimerLigne(i)}
                        className="text-slate-400 hover:text-rose-600 p-1 transition-colors cursor-pointer"
                        title="Supprimer cette ligne"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* Pied de tableau avec total arrêté */}
          <tfoot>
            <tr className="bg-slate-100/90 border-t-2 border-filet font-bold">
              <td colSpan={editable ? 9 : 8} className="p-3 text-right text-xs text-slate-700">
                Total général estimé de la commande :
              </td>
              <td className="p-3 text-right font-mono text-sm text-ocean-profond font-extrabold whitespace-nowrap">
                {fcfa(totalGeneral)}
              </td>
              {editable && <td></td>}
            </tr>
          </tfoot>
        </table>
      </div>

      {editable && (
        <div className="p-2.5 bg-slate-50 border-t border-filet flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={ajouterLigne}
            className="h-7 text-xs gap-1 border-filet bg-white hover:bg-purple-50 text-purple-950 font-semibold cursor-pointer"
          >
            <Plus className="h-3 w-3 text-purple-700" />
            Ajouter une ligne au registre
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-3xs text-slate-500 font-mono">
              {lignes.filter((l) => l.produit.trim()).length} article(s) renseigné(s)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

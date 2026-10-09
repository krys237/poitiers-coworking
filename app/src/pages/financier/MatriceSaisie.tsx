/**
 * Récapitulatif financier — feuille de saisie en matrice (adoptée le 09/10/2026).
 *
 * Quand le membre prend la main, la consultation s'efface et la saisie prend toute la largeur :
 * les caisses en lignes, les natures de flux en colonnes. Toute la journée tient sur un écran,
 * avec les totaux dans les deux sens — une erreur de frappe se voit tout de suite.
 *
 * C'est le pattern « grille » du système de conception (§7) : on saisit dans la cellule, au clavier.
 * Tab suit la ligne (une caisse), ↑ ↓ changent de caisse sans quitter la colonne, Ctrl+S enregistre.
 *
 * Les croisements qui n'existent pas sont hachurés. Toute ligne de `BLOCS` qui n'entre pas dans la
 * matrice (« Autres prestations », et toute ligne ajoutée plus tard) est rendue dessous : aucun flux
 * ne peut devenir invisible.
 */
import * as React from "react";
import { Paperclip, Plus, Save } from "lucide-react";
import { BLOCS, CLE_PIECE, type Bloc, type Ligne } from "../../../convex/lib/tresorerie";
import { fcfa, num } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Mouv = Record<string, Record<string, number>>;

/** Champ monétaire d'une cellule : chiffres bruts au focus, séparateur de milliers au repos. */
function ChampMontant({ valeur, retrait, libelle, largeur, onChange, ...reste }: {
  valeur: number;
  retrait: boolean;
  libelle: string;
  largeur?: string;
  onChange: (v: string) => void;
  /** Repères de navigation au clavier, posés par la matrice (colonne et rang de la caisse). */
  "data-col"?: string;
  "data-rang"?: number;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
}) {
  const [actif, setActif] = React.useState(false);
  return (
    <input
      inputMode="numeric"
      aria-label={libelle}
      value={valeur === 0 ? "" : actif ? String(valeur) : num(valeur)}
      placeholder="0"
      onFocus={(e) => { setActif(true); e.currentTarget.select(); }}
      onBlur={() => setActif(false)}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-8 rounded-md border border-transparent bg-white px-2 text-right font-mono text-xs tabular-nums outline-none transition-colors",
        "hover:border-ocean-ciel focus:border-ocean-profond focus:ring-3 focus:ring-ocean-ceruleen/25",
        largeur ?? "w-full",
        retrait && "text-carmin",
        valeur === 0 && "text-encre-pale",
      )}
      {...reste}
    />
  );
}

/** Une case de la matrice : champ si le flux existe pour cette caisse, hachures sinon. */
function CaseMatrice({ bloc, col, rang, valeur, onChange, onKeyDown }: {
  bloc: Bloc;
  col: (typeof COLONNES)[number];
  rang: number;
  valeur: (bloc: string, ligne: string) => number;
  onChange: (bloc: string, ligne: string, v: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  const l = ligneDe(bloc, col);
  if (!l) {
    return (
      <td className="border-b border-slate-100 px-2 py-1">
        <div
          aria-hidden="true"
          title={`${bloc.libelle} n'a pas de flux « ${col.libelle} »`}
          className="h-8 rounded-md bg-[repeating-linear-gradient(135deg,#f8fafc,#f8fafc_5px,#f1f5f9_5px,#f1f5f9_10px)]"
        />
      </td>
    );
  }
  return (
    <td className="border-b border-slate-100 px-2 py-1">
      <ChampMontant
        valeur={valeur(bloc.cle, l.cle)}
        retrait={l.sens === "retrait"}
        libelle={`${bloc.libelle} — ${l.libelle}`}
        data-col={col.cle}
        data-rang={rang}
        onKeyDown={onKeyDown}
        onChange={(v) => onChange(bloc.cle, l.cle, v)}
      />
    </td>
  );
}

/** Colonnes de la matrice. `alias` : la caisse nomme ce flux autrement (Carte Visa → « depot »). */
const COLONNES: { cle: string; libelle: string; retrait?: boolean; alias?: Record<string, string> }[] = [
  { cle: "especes", libelle: "Espèces" },
  { cle: "cheque", libelle: "Chèque" },
  { cle: "visa", libelle: "Carte Visa", alias: { carte_visa: "depot" } },
  { cle: "om", libelle: "OM" },
  { cle: "momo", libelle: "MOMO" },
  { cle: "retrait", libelle: "Retrait", retrait: true },
  { cle: "retrait_om", libelle: "Retrait OM", retrait: true },
  { cle: "retrait_momo", libelle: "Retrait MOMO", retrait: true },
];

const ligneDe = (bloc: Bloc, col: (typeof COLONNES)[number]): Ligne | undefined =>
  bloc.lignes.find((l) => l.cle === (col.alias?.[bloc.cle] ?? col.cle));

/** Caisses qui entrent dans la matrice, et tout ce qui n'y entre pas (rendu à part, jamais masqué). */
const BLOCS_MATRICE = BLOCS.filter((b) => COLONNES.some((c) => ligneDe(b, c)));
const HORS_MATRICE = BLOCS.flatMap((b) =>
  b.lignes.filter((l) => !COLONNES.some((c) => (c.alias?.[b.cle] ?? c.cle) === l.cle)).map((l) => ({ bloc: b, ligne: l })),
);

export function MatriceSaisie({
  draft, setMontant, pieces, onJustificatif, dirty, onSauver, enregistre,
}: {
  draft: Mouv;
  setMontant: (bloc: string, ligne: string, valeur: string) => void;
  pieces: Record<string, string | null>;
  onJustificatif: (cle: string) => void;
  dirty: boolean;
  onSauver: () => void;
  /** Nombre de flux déjà renseignés / nombre total, pour le compteur d'avancement. */
  enregistre: { saisis: number; total: number };
}) {
  // Caisse dont on a déplié les justificatifs (une à la fois, sous sa ligne).
  const [pieceOuverte, setPieceOuverte] = React.useState<string | null>(null);
  const grille = React.useRef<HTMLDivElement>(null);

  // Ctrl+S enregistre, comme dans un tableur.
  React.useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); if (dirty) onSauver(); }
    };
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [dirty, onSauver]);

  /** ↑ ↓ : même colonne, caisse précédente ou suivante. */
  const navigation = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    const col = e.currentTarget.dataset.col;
    const rang = Number(e.currentTarget.dataset.rang);
    if (!col || Number.isNaN(rang)) return;
    const pas = e.key === "ArrowDown" ? 1 : -1;
    for (let r = rang + pas; r >= 0 && r < BLOCS_MATRICE.length; r += pas) {
      const cible = grille.current?.querySelector<HTMLInputElement>(`input[data-col="${col}"][data-rang="${r}"]`);
      if (cible) { e.preventDefault(); cible.focus(); cible.select(); return; }
    }
  };

  const valeur = (bloc: string, ligne: string) => draft[bloc]?.[ligne] ?? 0;
  const totalColonne = (col: (typeof COLONNES)[number]) =>
    BLOCS_MATRICE.reduce((t, b) => { const l = ligneDe(b, col); return t + (l ? valeur(b.cle, l.cle) : 0); }, 0);
  const netCaisse = (b: Bloc) =>
    b.lignes.reduce((t, l) => t + valeur(b.cle, l.cle) * (l.sens === "retrait" ? -1 : 1), 0);
  const piecesCaisse = (b: Bloc) => b.lignes.filter((l) => pieces[CLE_PIECE(b.cle, l.cle)]).length;
  const net = BLOCS.reduce((t, b) => t + netCaisse(b), 0);
  const entrees = BLOCS.reduce((t, b) => t + b.lignes.filter((l) => l.sens !== "retrait").reduce((s, l) => s + valeur(b.cle, l.cle), 0), 0);
  const retraits = BLOCS.reduce((t, b) => t + b.lignes.filter((l) => l.sens === "retrait").reduce((s, l) => s + valeur(b.cle, l.cle), 0), 0);

  return (
    <div ref={grille} className="overflow-hidden rounded-xl border border-filet bg-surface shadow-xs">
      <div className="flex flex-wrap items-center gap-3 border-b border-filet bg-papier/40 px-3.5 py-2.5">
        <h3 className="text-sm font-bold">Feuille de saisie</h3>
        <span className="text-2xs text-encre-pale">
          Tab : case suivante dans la caisse · ↑ ↓ : même flux, caisse suivante · zones hachurées = flux sans objet
        </span>
        <div className="ml-auto flex items-center gap-2">
          <span className="rounded-full border border-filet bg-white px-2.5 py-1 font-mono text-2xs font-semibold text-encre-douce">
            {enregistre.saisis} / {enregistre.total} flux saisis
          </span>
          <Button size="sm" disabled={!dirty} onClick={onSauver} className="bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700">
            <Save className="mr-1.5 h-3.5 w-3.5" /> Enregistrer <span className="ml-1 font-mono text-2xs opacity-80">Ctrl+S</span>
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-20 min-w-[9.5rem] bg-ocean-profond px-3 py-2 text-left text-2xs font-bold uppercase tracking-wide text-white">Caisse</th>
              {COLONNES.map((c) => (
                <th key={c.cle} className="min-w-[5.6rem] whitespace-nowrap bg-ocean-profond px-2 py-2 text-right text-2xs font-bold uppercase tracking-wide text-white">{c.libelle}</th>
              ))}
              <th className="min-w-[6.2rem] whitespace-nowrap bg-ocean-nuit px-2 py-2 text-right text-2xs font-bold uppercase tracking-wide text-white">Net caisse</th>
              <th className="bg-ocean-profond px-2 py-2 text-2xs font-bold uppercase tracking-wide text-white">Pièces</th>
            </tr>
          </thead>
          <tbody>
            {BLOCS_MATRICE.map((b, rang) => {
              const nbPieces = piecesCaisse(b);
              const nb = netCaisse(b);
              return (
                <tr key={b.cle} className="group">
                  <td className="sticky left-0 z-10 border-b border-slate-100 bg-surface px-3 py-1 font-semibold group-hover:bg-papier/60">{b.libelle}</td>
                  {COLONNES.map((c) => (
                    <CaseMatrice key={c.cle} bloc={b} col={c} rang={rang} valeur={valeur} onChange={setMontant} onKeyDown={navigation} />
                  ))}
                  <td className="border-b border-slate-100 bg-ocean-brume/40 px-2 py-1 text-right font-mono text-xs font-bold tabular-nums">
                    {nb ? num(nb) : <span className="text-encre-pale">—</span>}
                  </td>
                  <td className="border-b border-slate-100 px-2 py-1 text-center">
                    <button
                      type="button"
                      aria-expanded={pieceOuverte === b.cle}
                      onClick={() => setPieceOuverte((c) => (c === b.cle ? null : b.cle))}
                      title={`Justificatifs de ${b.libelle}`}
                      aria-label={`Justificatifs de ${b.libelle}`}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-2xs font-bold transition-colors",
                        nbPieces ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "border-filet bg-white text-encre-pale hover:border-ocean-ciel hover:text-ocean-profond",
                      )}
                    >
                      <Paperclip className="h-3 w-3" /> {nbPieces || "+"}
                    </button>
                  </td>
                </tr>
              );
            })}
            {/* Justificatifs de la caisse dépliée : joindre reste possible sans quitter la matrice. */}
            {BLOCS_MATRICE.filter((b) => b.cle === pieceOuverte).map((b) => (
              <tr key={`${b.cle}-pieces`}>
                <td colSpan={COLONNES.length + 3} className="border-b border-slate-100 bg-papier/60 px-3 py-2">
                  <div className="mb-1.5 text-2xs font-bold uppercase tracking-wide text-encre-pale">Justificatifs — {b.libelle}</div>
                  <div className="flex flex-wrap gap-2">
                    {b.lignes.map((l) => {
                      const cle = CLE_PIECE(b.cle, l.cle);
                      const piece = pieces[cle];
                      return piece ? (
                        <Button key={l.cle} asChild size="sm" variant="outline" className="h-7 border-emerald-300 text-2xs text-emerald-700 hover:bg-emerald-50">
                          <a href={piece} target="_blank" rel="noreferrer"><Paperclip className="mr-1 h-3 w-3" /> {l.libelle}</a>
                        </Button>
                      ) : (
                        <Button key={l.cle} type="button" size="sm" variant="outline" className="h-7 text-2xs text-encre-douce" onClick={() => onJustificatif(cle)}>
                          <Plus className="mr-1 h-3 w-3" /> {l.libelle}
                        </Button>
                      );
                    })}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="sticky left-0 z-10 border-t-2 border-ocean-ciel bg-[#eef6fb] px-3 py-2 text-2xs font-bold uppercase tracking-wide">Total · {BLOCS_MATRICE.length} caisses</td>
              {COLONNES.map((c) => {
                const t = totalColonne(c);
                return (
                  <td key={c.cle} className={cn("border-t-2 border-ocean-ciel bg-[#eef6fb] px-2 py-2 text-right font-mono text-xs font-bold tabular-nums", c.retrait && t > 0 && "text-carmin")}>
                    {t ? (c.retrait ? `− ${num(t)}` : num(t)) : <span className="text-encre-pale">—</span>}
                  </td>
                );
              })}
              <td className="border-t-2 border-ocean-ciel bg-[#eef6fb] px-2 py-2 text-right font-mono text-xs font-extrabold tabular-nums text-ocean-nuit">{num(net)}</td>
              <td className="border-t-2 border-ocean-ciel bg-[#eef6fb]" />
            </tr>
          </tfoot>
        </table>
      </div>

      {HORS_MATRICE.length > 0 && (
        <section className="border-t border-filet">
          <div className="bg-papier/40 px-3.5 py-2 text-2xs font-bold uppercase tracking-wide text-encre-pale">
            Autres prestations
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
            {HORS_MATRICE.map(({ bloc, ligne }) => {
              const cle = CLE_PIECE(bloc.cle, ligne.cle);
              const piece = pieces[cle];
              const v = valeur(bloc.cle, ligne.cle);
              return (
                <div key={cle} className="flex items-center gap-2 border-b border-r border-slate-100 px-3 py-1.5">
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold" title={`${bloc.libelle} — ${ligne.libelle}`}>
                    {ligne.libelle}
                    {bloc.cle !== "autres" && <span className="ml-1 text-2xs font-normal text-encre-pale">({bloc.libelle})</span>}
                  </span>
                  <ChampMontant
                    valeur={v}
                    retrait={ligne.sens === "retrait"}
                    libelle={`${bloc.libelle} — ${ligne.libelle}`}
                    largeur="w-28"
                    onChange={(x) => setMontant(bloc.cle, ligne.cle, x)}
                  />
                  {piece ? (
                    <Button asChild size="icon-sm" variant="outline" className="border-emerald-300 text-emerald-700 hover:bg-emerald-50" title="Voir le justificatif">
                      <a href={piece} target="_blank" rel="noreferrer"><Paperclip className="h-3.5 w-3.5" /></a>
                    </Button>
                  ) : (
                    <Button type="button" size="icon-sm" variant="ghost" className="text-encre-pale hover:text-ocean-profond" title="Joindre un justificatif" aria-label={`Joindre un justificatif — ${ligne.libelle}`} onClick={() => onJustificatif(cle)}>
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-filet bg-papier/40 px-3.5 py-2.5 text-xs">
        <span className="text-encre-douce">Entrées <b className="font-mono tabular-nums text-emerald-700">{num(entrees)}</b></span>
        <span className="text-encre-douce">Retraits <b className="font-mono tabular-nums text-carmin">{retraits ? `− ${num(retraits)}` : "0"}</b></span>
        <span className="text-encre-douce">Recette nette <b className="font-mono tabular-nums text-ocean-nuit">{fcfa(net)}</b></span>
        <span className="ml-auto text-2xs text-encre-pale">
          Un justificatif se joint depuis la colonne « Pièces » de chaque caisse.
        </span>
      </div>
    </div>
  );
}

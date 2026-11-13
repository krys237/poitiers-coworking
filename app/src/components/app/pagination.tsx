/**
 * Pagination (skill poitiers-ui-ux-system) : page suivante/précédente, numéro
 * de page, nombre de lignes par page — mémorisé par écran comme
 * `useLignesVisibles`, dont elle complète l'usage. `useLignesVisibles` ne fait
 * que limiter la HAUTEUR visible (défilement interne, tout reste dans le DOM) ;
 * sur une base de plusieurs centaines d'employés, ça ne suffit plus — il faut
 * vraiment DÉCOUPER la liste en pages.
 */
import * as React from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const TAILLES_PAGE = [10, 25, 50, 100] as const;
export type TaillePage = (typeof TAILLES_PAGE)[number];

const PREFIXE = "pagination:";

/** Découpe `items` (déjà filtrée) en pages ; mémorise la taille de page par `cle` (écran). */
export function usePagination<T>(items: T[], cle: string, defaut: TaillePage = 25) {
  const [taille, setTailleBrut] = React.useState<TaillePage>(() => {
    try {
      const v = Number(window.localStorage.getItem(PREFIXE + cle) ?? String(defaut));
      return (TAILLES_PAGE as readonly number[]).includes(v) ? (v as TaillePage) : defaut;
    } catch {
      return defaut;
    }
  });
  const [page, setPage] = React.useState(1);
  const setTaille = React.useCallback(
    (v: TaillePage) => {
      setTailleBrut(v);
      setPage(1);
      try { window.localStorage.setItem(PREFIXE + cle, String(v)); } catch { /* stockage indisponible */ }
    },
    [cle]
  );

  const total = items.length;
  const nbPages = Math.max(1, Math.ceil(total / taille));
  // Une recherche ou un filtre qui réduit la liste peut faire disparaître la page
  // courante (ex. j'étais page 4, il n'y en a plus que 2) : on revient à la 1.
  React.useEffect(() => { if (page > nbPages) setPage(1); }, [nbPages, page]);
  const pageActuelle = Math.min(page, nbPages);
  const debut = (pageActuelle - 1) * taille;
  const visibles = items.slice(debut, debut + taille);

  return { visibles, page: pageActuelle, setPage, nbPages, taille, setTaille, total, debut };
}

export function Pagination({
  page,
  nbPages,
  onPage,
  total,
  debut,
  nbVisibles,
  taille,
  onTaille,
  className,
}: {
  page: number;
  nbPages: number;
  onPage: (p: number) => void;
  total: number;
  debut: number;
  nbVisibles: number;
  taille: TaillePage;
  onTaille: (v: TaillePage) => void;
  className?: string;
}) {
  if (total === 0) return null;
  return (
    <div className={"flex flex-wrap items-center justify-between gap-3 px-1 py-2 text-xs text-encre-douce " + (className ?? "")}>
      <span>
        {debut + 1}–{Math.min(debut + nbVisibles, total)} sur {total}
      </span>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1.5">
          Par page
          <Select value={String(taille)} onValueChange={(v) => onTaille(Number(v) as TaillePage)}>
            <SelectTrigger size="sm" className="w-[5.5rem]" aria-label="Nombre de lignes par page"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TAILLES_PAGE.map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
        </label>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon-sm" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Page précédente" title="Page précédente">
            <ChevronLeftIcon />
          </Button>
          <span className="min-w-[5.5rem] text-center font-mono tabular-nums">Page {page} / {nbPages}</span>
          <Button variant="outline" size="icon-sm" disabled={page >= nbPages} onClick={() => onPage(page + 1)} aria-label="Page suivante" title="Page suivante">
            <ChevronRightIcon />
          </Button>
        </div>
      </div>
    </div>
  );
}

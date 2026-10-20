import { useState, useRef, useEffect, useMemo } from "react";
import { Sparkles, Check, X, Tag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { filtrerCatalogue, type ArticleCatalogue } from "@/data/catalogue-articles";
import { fcfa } from "@/lib/format";
import { cn } from "@/lib/utils";

interface ChampDesignationAutocompleteProps {
  valeur: string;
  onChange: (designation: string, prixSuggere?: number) => void;
  categorie?: "medicale" | "reactifs_labo" | "fourniture";
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function ChampDesignationAutocomplete({
  valeur,
  onChange,
  categorie,
  placeholder = "Ex : Amoxicilline, Gants, Bio-Rad…",
  className,
  disabled = false,
}: ChampDesignationAutocompleteProps) {
  const [ouvert, setOuvert] = useState(false);
  const [indexFocus, setIndexFocus] = useState(-1);
  const conteneurRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Suggestions filtrées en temps réel selon la catégorie et la saisie
  const suggestions = useMemo(() => {
    return filtrerCatalogue(categorie, valeur, 30);
  }, [categorie, valeur]);

  // Fermer le dropdown en cliquant à l'extérieur
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (conteneurRef.current && !conteneurRef.current.contains(e.target as Node)) {
        setOuvert(false);
        setIndexFocus(-1);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (art: ArticleCatalogue) => {
    onChange(art.designation, art.prixUnitaire && art.prixUnitaire > 0 ? art.prixUnitaire : undefined);
    setOuvert(false);
    setIndexFocus(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!ouvert) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setOuvert(true);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndexFocus((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndexFocus((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === "Enter") {
      if (indexFocus >= 0 && indexFocus < suggestions.length) {
        e.preventDefault();
        handleSelect(suggestions[indexFocus]);
      } else {
        setOuvert(false);
      }
    } else if (e.key === "Escape") {
      setOuvert(false);
      setIndexFocus(-1);
    }
  };

  return (
    <div ref={conteneurRef} className="relative w-full">
      <div className="relative flex items-center">
        <Input
          ref={inputRef}
          value={valeur}
          disabled={disabled}
          placeholder={placeholder}
          onFocus={() => setOuvert(true)}
          onClick={() => setOuvert(true)}
          onChange={(e) => {
            onChange(e.target.value);
            setOuvert(true);
            setIndexFocus(-1);
          }}
          onKeyDown={handleKeyDown}
          className={cn(
            "h-7 text-xs bg-white border-filet pr-7 font-medium text-slate-800 focus-visible:ring-ocean-profond",
            className
          )}
        />

        {/* Bouton pour vider ou icône prédictive */}
        {valeur ? (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => {
              onChange("");
              inputRef.current?.focus();
              setOuvert(true);
            }}
            className="absolute right-1.5 p-0.5 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
            title="Effacer"
          >
            <X className="h-3 w-3" />
          </button>
        ) : (
          <Sparkles className="pointer-events-none absolute right-2 h-3 w-3 text-slate-300" />
        )}
      </div>

      {/* Menu déroulant prédictif (DataForm combobox) */}
      {ouvert && !disabled && (
        <div className="absolute top-full left-0 mt-1 w-full min-w-[280px] max-w-[420px] bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* En-tête des suggestions */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 border-b border-slate-200 text-3xs text-slate-500 font-semibold">
            <span className="flex items-center gap-1 text-ocean-profond">
              <Sparkles className="h-3 w-3" />
              {valeur ? "Suggestions correspondantes" : "Catalogue officiel (ordre alphabétique)"}
            </span>
            <span className="font-mono text-slate-400">
              {suggestions.length} article{suggestions.length > 1 ? "s" : ""}
            </span>
          </div>

          {/* Liste déroulante des résultats */}
          <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 p-1">
            {suggestions.length === 0 ? (
              <div className="p-3 text-center text-2xs text-slate-400 italic">
                Aucun article officiel ne correspond à « {valeur} ».
                <div className="mt-0.5 text-3xs text-slate-500 font-medium">
                  (Votre saisie personnalisée est conservée telle quelle)
                </div>
              </div>
            ) : (
              suggestions.map((art, idx) => {
                const estSelectionne = valeur.trim().toLowerCase() === art.designation.toLowerCase();
                const estFocus = idx === indexFocus;

                return (
                  <button
                    key={`${art.designation}-${idx}`}
                    type="button"
                    tabIndex={-1}
                    onClick={() => handleSelect(art)}
                    onMouseEnter={() => setIndexFocus(idx)}
                    className={cn(
                      "w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer",
                      estFocus
                        ? "bg-ocean-ceruleen/10 text-ocean-profond"
                        : estSelectionne
                        ? "bg-emerald-50 text-emerald-950 font-bold"
                        : "hover:bg-slate-50 text-slate-700"
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold truncate leading-tight">
                        {art.designation}
                      </div>
                      {art.classe && (
                        <div className="text-3xs text-slate-400 truncate flex items-center gap-1 mt-0.5">
                          <Tag className="h-2.5 w-2.5 shrink-0 opacity-70" />
                          <span>{art.classe}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {art.prixUnitaire && art.prixUnitaire > 0 ? (
                        <span className="font-mono text-3xs font-bold text-ocean-nuit bg-slate-100 px-1.5 py-0.5 rounded">
                          {fcfa(art.prixUnitaire)}
                        </span>
                      ) : null}
                      {estSelectionne && <Check className="h-3.5 w-3.5 text-emerald-600" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

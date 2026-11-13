/**
 * Champ à saisie assistée, générique (lot R10).
 *
 * « Il nous faut construire le même style de dataform que nous avons fait pour l'onglet commande
 * au niveau d'ajouter un produit, au niveau des employés, pour que l'employé soit proposé à la
 * saisie » — demande du 03/11/2026.
 *
 * `champ-designation-autocomplete.tsx` fait déjà cela, mais pour le seul catalogue d'articles.
 * Celui-ci prend ses options en paramètre : il sert la fonction d'un employé, le choix d'un
 * employé, et demain les champs du générateur d'actes.
 *
 * Deux modes :
 *  · `strict` (défaut faux) — la saisie libre est conservée telle quelle, les options ne sont que
 *    des suggestions. C'est ce qu'il faut pour une fonction : le référentiel propose sans
 *    contraindre, et une fonction renommée n'efface pas celle inscrite sur une fiche.
 *  · `strict` vrai — seule une option de la liste est acceptée. C'est ce qu'il faut pour choisir
 *    un employé : un nom tapé à la main ne désigne personne.
 */
import * as React from "react";
import { CheckIcon, ChevronDownIcon, XIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface OptionAutocomplete {
  /** Valeur retournée. Pour un employé, son identifiant ; pour une fonction, son libellé. */
  valeur: string;
  libelle: string;
  /** Précision affichée en gris : matricule, service, catégorie… */
  note?: string;
  /** Texte supplémentaire pris en compte par la recherche sans être affiché. */
  recherche?: string;
}

const sansAccents = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function ChampAutocomplete({
  valeur,
  options,
  onChange,
  strict = false,
  placeholder,
  ariaLabel,
  disabled,
  className,
  maxSuggestions = 40,
}: {
  /** Valeur courante : un identifiant en mode strict, le texte saisi sinon. */
  valeur: string;
  options: OptionAutocomplete[];
  onChange: (valeur: string, option?: OptionAutocomplete) => void;
  strict?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
  maxSuggestions?: number;
}) {
  const [ouvert, setOuvert] = React.useState(false);
  const [focus, setFocus] = React.useState(-1);
  // En mode strict l'input affiche le libellé de l'option retenue, pas la valeur brute.
  const choisie = strict ? options.find((o) => o.valeur === valeur) : undefined;
  const [saisie, setSaisie] = React.useState(strict ? choisie?.libelle ?? "" : valeur);
  const conteneur = React.useRef<HTMLDivElement>(null);

  // La valeur peut changer en dehors du champ (réinitialisation du formulaire, ligne éditée) :
  // sans cette synchronisation, l'input garderait l'ancien texte.
  React.useEffect(() => {
    setSaisie(strict ? options.find((o) => o.valeur === valeur)?.libelle ?? "" : valeur);
  }, [valeur, strict, options]);

  React.useEffect(() => {
    const dehors = (e: MouseEvent) => {
      if (conteneur.current && !conteneur.current.contains(e.target as Node)) {
        setOuvert(false);
        setFocus(-1);
        // En mode strict, une saisie qui ne désigne rien est effacée : laisser un texte orphelin
        // ferait croire qu'une sélection a eu lieu.
        if (strict) setSaisie(options.find((o) => o.valeur === valeur)?.libelle ?? "");
      }
    };
    document.addEventListener("mousedown", dehors);
    return () => document.removeEventListener("mousedown", dehors);
  }, [strict, options, valeur]);

  const q = sansAccents(saisie.trim());
  const suggestions = React.useMemo(() => {
    const base = options.filter((o) => o.valeur !== valeur || !strict);
    const filtrees = !q
      ? base
      : base.filter((o) => sansAccents(`${o.libelle} ${o.note ?? ""} ${o.recherche ?? ""}`).includes(q));
    return filtrees.slice(0, maxSuggestions);
  }, [options, q, valeur, strict, maxSuggestions]);

  function retenir(o: OptionAutocomplete) {
    setSaisie(o.libelle);
    setOuvert(false);
    setFocus(-1);
    onChange(strict ? o.valeur : o.libelle, o);
  }

  function auClavier(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOuvert(true);
      setFocus((f) => {
        const n = suggestions.length;
        if (!n) return -1;
        return e.key === "ArrowDown" ? (f + 1) % n : (f - 1 + n) % n;
      });
    } else if (e.key === "Enter" && ouvert && focus >= 0 && suggestions[focus]) {
      e.preventDefault();
      retenir(suggestions[focus]);
    } else if (e.key === "Escape") {
      setOuvert(false);
      setFocus(-1);
    }
  }

  return (
    <div ref={conteneur} className={cn("relative", className)}>
      <div className="relative">
        <Input
          value={saisie}
          disabled={disabled}
          placeholder={placeholder}
          aria-label={ariaLabel}
          role="combobox"
          aria-expanded={ouvert}
          aria-autocomplete="list"
          autoComplete="off"
          className="pr-14"
          onFocus={() => setOuvert(true)}
          onKeyDown={auClavier}
          onChange={(e) => {
            setSaisie(e.target.value);
            setOuvert(true);
            setFocus(-1);
            // En mode libre, chaque frappe remonte : le texte EST la valeur.
            if (!strict) onChange(e.target.value);
          }}
        />
        <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center">
          {saisie ? (
            <button
              type="button"
              aria-label="Effacer"
              disabled={disabled}
              className="rounded p-1 text-encre-pale hover:text-encre"
              onClick={() => {
                setSaisie("");
                onChange("");
                setOuvert(false);
              }}
            >
              <XIcon className="h-3.5 w-3.5" />
            </button>
          ) : null}
          <ChevronDownIcon className="h-4 w-4 text-encre-pale" aria-hidden="true" />
        </div>
      </div>

      {ouvert && suggestions.length ? (
        <ul
          role="listbox"
          className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-filet bg-surface py-1 shadow-lg"
        >
          {suggestions.map((o, i) => (
            <li key={o.valeur}>
              <button
                type="button"
                role="option"
                aria-selected={i === focus}
                className={cn(
                  "flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm",
                  i === focus ? "bg-ocean-brume" : "hover:bg-bande",
                )}
                // `mousedown` et non `click` : le `mousedown` du document ferme la liste avant
                // qu'un `click` ait le temps de se déclencher.
                onMouseDown={(e) => {
                  e.preventDefault();
                  retenir(o);
                }}
                onMouseEnter={() => setFocus(i)}
              >
                <span className="truncate">{o.libelle}</span>
                <span className="flex shrink-0 items-center gap-1.5">
                  {o.note ? <span className="text-xs text-encre-pale">{o.note}</span> : null}
                  {(strict ? o.valeur === valeur : o.libelle === saisie) ? (
                    <CheckIcon className="h-3.5 w-3.5 text-sceau" aria-hidden="true" />
                  ) : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {ouvert && !suggestions.length && q ? (
        <p className="absolute z-50 mt-1 w-full rounded-xl border border-filet bg-surface px-3 py-2 text-xs text-encre-pale shadow-lg">
          {strict
            ? "Aucun résultat — seules les valeurs de la liste sont acceptées."
            : "Aucune suggestion : votre saisie sera conservée telle quelle."}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Saisie d'un numéro de téléphone : indicatif du pays PRÉ-REMPLI (Cameroun) dans un
 * sélecteur, partie nationale à côté — comme sur WhatsApp. La valeur échangée est
 * toujours le numéro complet « +2376XXXXXXXX » (journal des décisions, 21/09/2026 :
 * l'indicatif est obligatoire partout).
 */
import * as React from "react";
import { INDICATIFS, INDICATIF_DEFAUT, composerTelephone, separerTelephone } from "../../../convex/lib/telephone";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import * as SelectPrimitive from "@radix-ui/react-select";
import { CheckIcon } from "lucide-react";
import { Select, SelectContent, SelectTrigger, SelectValue } from "@/components/ui/select";

export function ChampTelephone({ valeur, onChange, id, taille = "md", className, autoFocus, ariaLabel, onKeyDown, ...props }: {
  /** Numéro complet (+237…) ou chaîne vide. */
  valeur: string;
  onChange: (numeroComplet: string) => void;
  id?: string;
  taille?: "sm" | "md";
  className?: string;
  autoFocus?: boolean;
  ariaLabel?: string;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
} & Pick<React.ComponentProps<"input">, "aria-describedby" | "aria-invalid" | "autoComplete" | "placeholder">) {
  const initial = separerTelephone(valeur);
  const [indicatif, setIndicatif] = React.useState(initial.indicatif || INDICATIF_DEFAUT.slice(1));
  const [national, setNational] = React.useState(initial.national);
  // La valeur parente change (fiche rouverte, ligne vidée) : on se recale sans perdre l'indicatif choisi.
  React.useEffect(() => {
    const chiffres = national.replace(/\D/g, "");
    const interne = chiffres ? (composerTelephone(indicatif, chiffres) ?? `+${indicatif}${chiffres}`) : "";
    if (valeur === interne) return; // c'est nous qui venons d'émettre : ne pas écraser la frappe
    if (!valeur) { setNational(""); return; }
    const s = separerTelephone(valeur);
    setIndicatif(s.indicatif); setNational(s.national);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valeur]);

  const emettre = (ind: string, nat: string) => {
    const chiffres = nat.replace(/\D/g, "");
    onChange(chiffres ? (composerTelephone(ind, chiffres) ?? `+${ind}${chiffres}`) : "");
  };
  const petit = taille === "sm";
  return (
    <div className={cn("flex items-stretch gap-1.5", className)}>
      <Select value={indicatif} onValueChange={(v) => { setIndicatif(v); emettre(v, national); }}>
        <SelectTrigger size={petit ? "sm" : undefined} className={cn("shrink-0 font-mono", petit ? "h-8 w-[4.75rem] text-xs" : "w-[5.5rem]")} aria-label="Indicatif du pays">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {/* Item « nu » : seul l'indicatif passe dans le déclencheur, le pays reste dans la liste. */}
          {INDICATIFS.map((i) => (
            <SelectPrimitive.Item key={i.code} value={i.indicatif} textValue={`+${i.indicatif} ${i.pays}`}
              className="relative flex w-full cursor-default select-none items-center gap-2 rounded-sm py-1.5 pl-2 pr-8 text-sm outline-hidden focus:bg-accent data-[disabled]:pointer-events-none data-[disabled]:opacity-50">
              <span className="absolute right-2 flex size-3.5 items-center justify-center"><SelectPrimitive.ItemIndicator><CheckIcon className="size-4" /></SelectPrimitive.ItemIndicator></span>
              <SelectPrimitive.ItemText><span className="font-mono">+{i.indicatif}</span></SelectPrimitive.ItemText>
              <span className="text-xs text-encre-douce">{i.pays}</span>
            </SelectPrimitive.Item>
          ))}
          {!INDICATIFS.some((i) => i.indicatif === indicatif) && (
            <SelectPrimitive.Item value={indicatif} className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-hidden focus:bg-accent">
              <SelectPrimitive.ItemText><span className="font-mono">+{indicatif}</span></SelectPrimitive.ItemText>
            </SelectPrimitive.Item>
          )}
        </SelectContent>
      </Select>
      <Input
        id={id}
        type="tel"
        inputMode="tel"
        autoFocus={autoFocus}
        aria-label={ariaLabel ?? "Numéro sans l'indicatif"}
        value={national}
        onChange={(e) => { const nat = e.target.value.replace(/[^\d\s]/g, ""); setNational(nat); emettre(indicatif, nat); }}
        onKeyDown={onKeyDown}
        placeholder={props.placeholder ?? "6 90 00 00 00"}
        className={cn("font-mono", petit && "h-8 text-xs")}
        autoComplete={props.autoComplete ?? "tel-national"}
        aria-describedby={props["aria-describedby"]}
        aria-invalid={props["aria-invalid"]}
      />
    </div>
  );
}

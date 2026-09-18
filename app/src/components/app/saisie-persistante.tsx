/**
 * Saisie en série : l'utilisateur choisit si les champs de saisie restent
 * affichés en permanence (il enchaîne n lignes sans rouvrir quoi que ce soit)
 * ou s'ils se replient derrière un bouton d'ajout.
 *
 * Règle (skill poitiers-ui-ux-system §7) : le choix est PAR ÉCRAN et mémorisé
 * sur l'appareil ; le bouton se place à côté de la croix qui ferme les champs
 * et change de libellé selon l'état.
 */
import * as React from "react";
import { PinIcon, PinOffIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const PREFIXE = "saisie-persistante:";

/** Préférence mémorisée ; `cle` identifie l'écran (ex. « statistiques:primes »). */
export function useSaisiePersistante(cle: string, defaut = false): [boolean, (v: boolean) => void] {
  const [actif, setActif] = React.useState<boolean>(() => {
    try {
      const v = window.localStorage.getItem(PREFIXE + cle);
      return v === null ? defaut : v === "1";
    } catch {
      return defaut;
    }
  });
  const changer = React.useCallback(
    (v: boolean) => {
      setActif(v);
      try { window.localStorage.setItem(PREFIXE + cle, v ? "1" : "0"); } catch { /* stockage indisponible */ }
    },
    [cle]
  );
  return [actif, changer];
}

/**
 * Le bouton-bascule. Placé à côté de la croix de fermeture des champs :
 *  - inactif : « Rendre les champs persistants » ;
 *  - actif   : « Masquer les champs » (les champs se replient, la préférence est oubliée).
 */
export function BoutonPersistance({
  actif,
  onChange,
  libelleActif = "Masquer les champs",
  libelleInactif = "Rendre les champs persistants",
  size = "sm",
  className,
}: {
  actif: boolean;
  onChange: (v: boolean) => void;
  libelleActif?: string;
  libelleInactif?: string;
  size?: "sm" | "xs";
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant={actif ? "secondary" : "outline"}
      size={size === "xs" ? "sm" : size}
      aria-pressed={actif}
      onClick={() => onChange(!actif)}
      className={cn(size === "xs" && "h-7 px-2 text-2xs", className)}
      title={actif ? "Les champs de saisie restent affichés. Cliquer pour les replier." : "Garder les champs de saisie affichés pour enchaîner les lignes."}
    >
      {actif ? <PinOffIcon /> : <PinIcon />}
      {actif ? libelleActif : libelleInactif}
    </Button>
  );
}

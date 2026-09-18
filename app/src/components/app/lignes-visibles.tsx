/**
 * Défilement intégré des tableaux (skill poitiers-ui-ux-system §8).
 *
 * C'est un ERP : les listes deviennent kilométriques. Un tableau ne fait donc
 * jamais défiler la page — il défile SEUL, en-tête et pied collants, et
 * l'utilisateur choisit combien de lignes il veut voir avant de défiler.
 * La préférence est mémorisée par écran.
 */
import * as React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const LIGNES_CHOIX = [5, 10, 15, 20, 30, 50] as const;
/** 0 = toutes les lignes (pas de limite de hauteur). */
export type LignesVisibles = (typeof LIGNES_CHOIX)[number] | 0;

const PREFIXE = "lignes-visibles:";

export function useLignesVisibles(cle: string, defaut: LignesVisibles = 10) {
  const [lignes, setLignesBrut] = React.useState<LignesVisibles>(() => {
    try {
      const v = Number(window.localStorage.getItem(PREFIXE + cle) ?? String(defaut));
      return (LIGNES_CHOIX as readonly number[]).includes(v) || v === 0 ? (v as LignesVisibles) : defaut;
    } catch {
      return defaut;
    }
  });
  const setLignes = React.useCallback(
    (v: LignesVisibles) => {
      setLignesBrut(v);
      try { window.localStorage.setItem(PREFIXE + cle, String(v)); } catch { /* stockage indisponible */ }
    },
    [cle]
  );
  /**
   * Hauteur maximale du conteneur défilant (à passer à `<Table hauteurMax>`),
   * pour `hauteurLigne` px par ligne plus l'en-tête et le pied collants.
   */
  const hauteurMax = React.useCallback(
    (hauteurLigne: number, enTete = 42, pied = 0) => (lignes === 0 ? undefined : `${lignes * hauteurLigne + enTete + pied + 2}px`),
    [lignes]
  );
  return { lignes, setLignes, hauteurMax };
}

export function SelecteurLignes({
  valeur,
  onChange,
  libelle = "Lignes visibles",
  className,
}: {
  valeur: LignesVisibles;
  onChange: (v: LignesVisibles) => void;
  libelle?: string;
  className?: string;
}) {
  return (
    <label className={"flex items-center gap-2 text-xs text-encre-douce " + (className ?? "")}>
      {libelle}
      <Select value={String(valeur)} onValueChange={(v) => onChange(Number(v) as LignesVisibles)}>
        <SelectTrigger size="sm" className="w-[6.5rem]" aria-label="Nombre de lignes visibles avant défilement">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {LIGNES_CHOIX.map((n) => <SelectItem key={n} value={String(n)}>{n} lignes</SelectItem>)}
          <SelectItem value="0">Toutes</SelectItem>
        </SelectContent>
      </Select>
    </label>
  );
}

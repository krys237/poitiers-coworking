import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

/**
 * Champs de formulaire et cellules de saisie.
 *
 * La plateforme compte 105 `<input>` et AUCUN attribut `aria-*` : dans le
 * recapitulatif salaires, chaque champ est une case nue au croisement d'une
 * ligne et d'une colonne. A la souris on comprend par la position ; au lecteur
 * d'ecran, ces 105 champs s'annoncent tous « zone d'edition, 0 ».
 *
 * D'ou la regle appliquee ici : AUCUN champ sans nom accessible. Quand le
 * libelle n'est pas affiche (cellule de tableau), il est obligatoire en prop.
 */

/**
 * Champ de formulaire complet : libelle visible, aide, erreur.
 * L'erreur est reliee au champ par `aria-describedby`, donc annoncee a la prise
 * de focus, et pas seulement visible en rouge.
 */
export function Champ({
  libelle,
  aide,
  erreur,
  requis,
  children,
  className,
}: {
  libelle: React.ReactNode;
  aide?: React.ReactNode;
  erreur?: React.ReactNode;
  requis?: boolean;
  /** Recoit `id`, `aria-describedby` et `aria-invalid` a poser sur le controle. */
  children: (attributs: {
    id: string;
    "aria-describedby": string | undefined;
    "aria-invalid": boolean | undefined;
  }) => React.ReactNode;
  className?: string;
}) {
  const id = React.useId();
  const idAide = aide ? `${id}-aide` : undefined;
  const idErreur = erreur ? `${id}-erreur` : undefined;
  const decrit = [idErreur, idAide].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id} className="text-xs text-encre-douce">
        {libelle}
        {requis ? (
          <span className="text-carmin" aria-hidden="true">
            *
          </span>
        ) : null}
      </Label>
      {children({
        id,
        "aria-describedby": decrit,
        "aria-invalid": erreur ? true : undefined,
      })}
      {erreur ? (
        <p id={idErreur} className="text-xs text-carmin">
          {erreur}
        </p>
      ) : null}
      {aide ? (
        <p id={idAide} className="text-xs text-encre-pale">
          {aide}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Grille de formulaire : les champs se rangent en colonnes et se replient
 * a une colonne sur telephone.
 */
export function GrilleFormulaire({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-4 grid gap-3 border border-filet bg-surface p-3.5",
        "[grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr))]",
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * Cellule de saisie numerique dans un tableau.
 *
 * Remplace le `inp(id, champ, largeur)` du recapitulatif salaires.
 *
 *  - `libelle` est OBLIGATOIRE et devient le nom accessible : il doit nommer la
 *    ligne ET la colonne (« Acompte — MBALLA Jean »), sinon l'information de
 *    position est perdue hors de la vue tabulaire.
 *  - `modifie` marque la cellule non encore enregistree : un liseré ocre, donc
 *    on voit d'un coup d'oeil ce qui reste a sauver dans une ligne de 18 cases.
 *  - en lecture seule (mois cloture), le champ devient du texte : pas de case
 *    grisee sur laquelle on s'acharne.
 */
export function CelluleNombre({
  libelle,
  valeur,
  onChange,
  modifie,
  lectureSeule,
  largeur = 78,
  min,
  max,
  pas,
  className,
}: {
  libelle: string;
  valeur: number;
  onChange: (valeur: number) => void;
  modifie?: boolean;
  lectureSeule?: boolean;
  largeur?: number;
  min?: number;
  max?: number;
  pas?: number;
  className?: string;
}) {
  if (lectureSeule) {
    return (
      <span className="tabular-nums" title={libelle}>
        {valeur === 0 ? <span className="text-encre-pale">0</span> : valeur.toLocaleString("fr-FR")}
      </span>
    );
  }

  // Formalisme de saisie : un zéro n'est jamais tapé « par-dessus ». Le champ est
  // vide et montre un « 0 » estompé ; au focus la valeur existante est
  // sélectionnée (le premier chiffre l'écrase) ; effacer tout revient à 0.
  return (
    <input
      type="number"
      inputMode="numeric"
      aria-label={libelle}
      title={libelle}
      value={valeur === 0 ? "" : valeur}
      placeholder="0"
      min={min}
      max={max}
      step={pas}
      onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value) || 0)}
      onFocus={(e) => e.currentTarget.select()}
      style={{ width: largeur }}
      className={cn(
        "h-7 rounded-sm border bg-surface px-1.5 text-right text-sm tabular-nums",
        "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        modifie ? "border-ocre bg-ocre-clair/50" : "border-filet",
        className
      )}
    />
  );
}

/**
 * Champ numerique de formulaire (hors tableau), avec suffixe d'unite.
 */
export function ChampNombre({
  libelle,
  aide,
  erreur,
  requis,
  unite,
  valeur,
  onChange,
  ...props
}: {
  libelle: React.ReactNode;
  aide?: React.ReactNode;
  erreur?: React.ReactNode;
  requis?: boolean;
  /** Ex. « FCFA », « % », « j » — affiche dans le champ, a droite. */
  unite?: string;
  valeur: number;
  onChange: (valeur: number) => void;
} & Omit<React.ComponentProps<"input">, "value" | "onChange" | "type">) {
  return (
    <Champ libelle={libelle} aide={aide} erreur={erreur} requis={requis}>
      {(attributs) => (
        <div className="relative">
          <Input
            {...attributs}
            {...props}
            type="number"
            inputMode="numeric"
            value={valeur === 0 ? "" : valeur}
            placeholder="0"
            onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value) || 0)}
            onFocus={(e) => e.currentTarget.select()}
            className={cn("text-right font-mono tabular-nums placeholder:text-encre-pale/70", unite && "pr-12")}
          />
          {unite ? (
            <span
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-encre-pale"
              aria-hidden="true"
            >
              {unite}
            </span>
          ) : null}
        </div>
      )}
    </Champ>
  );
}

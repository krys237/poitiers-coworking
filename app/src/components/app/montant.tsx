import { cn } from "@/lib/utils";
import { num } from "@/lib/format";

/**
 * Affichage d'un montant en FCFA.
 *
 * Les montants sont des ENTIERS FCFA (regle du depot). Trois services que la
 * concatenation manuelle ne rendait pas :
 *
 *  - `signe` colore les sorties en carmin, comme un debit au grand livre ;
 *  - `zero` remplace 0 par un tiret cadratin — une colonne pleine de « 0 »
 *    est illisible, un tiret dit « rien a cette ligne » ;
 *  - le nombre est toujours en chiffres tabulaires, donc alignable.
 *
 * `aria-label` porte le montant parle en entier : un lecteur d'ecran annonce
 * « 125 000 francs CFA », pas « 125 000 FCFA » decoupe.
 */
export function Montant({
  valeur,
  devise = true,
  signe = false,
  zero = "—",
  gras,
  className,
}: {
  valeur: number | null | undefined;
  /** Affiche « FCFA ». A desactiver dans une colonne dont l'en-tete le dit deja. */
  devise?: boolean;
  /** Colore les valeurs negatives et prefixe explicitement le signe. */
  signe?: boolean;
  /** Ce qu'on affiche quand la valeur vaut 0 ou n'existe pas. */
  zero?: React.ReactNode;
  gras?: boolean;
  className?: string;
}) {
  if (valeur == null || valeur === 0) {
    return <span className={cn("text-encre-pale", className)}>{zero}</span>;
  }

  const negatif = valeur < 0;

  return (
    <span
      className={cn(
        "whitespace-nowrap tabular-nums",
        gras && "font-semibold",
        signe && negatif && "text-carmin",
        className
      )}
      aria-label={`${negatif ? "moins " : ""}${num(Math.abs(valeur))} francs CFA`}
    >
      {negatif ? "−" : signe ? "+" : ""}
      {num(Math.abs(valeur))}
      {devise ? (
        // La devise est un suffixe, pas un chiffre : plus petite et en retrait,
        // elle ne concurrence pas le montant et ne le pousse pas a la ligne
        // quand il est affiche en grand dans une tuile.
        <span className="ml-1 text-[0.62em] font-normal text-encre-douce">
          FCFA
        </span>
      ) : null}
    </span>
  );
}

/**
 * Nombre simple (effectif, jours, nombre d'actes) — sans devise.
 */
export function Nombre({
  valeur,
  unite,
  zero = "—",
  className,
}: {
  valeur: number | null | undefined;
  /** Ex. « j », « actes ». Reste colle au nombre avec une espace fine. */
  unite?: string;
  zero?: React.ReactNode;
  className?: string;
}) {
  if (valeur == null) {
    return <span className={cn("text-encre-pale", className)}>{zero}</span>;
  }
  return (
    <span className={cn("tabular-nums", className)}>
      {num(valeur)}
      {unite ? <span className="ml-0.5 text-encre-douce">{unite}</span> : null}
    </span>
  );
}

/**
 * Reference technique : matricule, numero de piece, code de ligne de bulletin.
 * En chasse fixe, parce que ces chaines se comparent caractere par caractere.
 */
export function Reference({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("font-mono text-xs text-encre-douce", className)}>
      {children}
    </span>
  );
}

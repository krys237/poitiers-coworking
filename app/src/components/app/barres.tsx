import { cn } from "@/lib/utils";
import { num } from "@/lib/format";

/**
 * Graphique a barres.
 *
 * Reprend le principe de l'original — barres en SVG, libelles en HTML pour
 * qu'ils ne se deforment pas avec `preserveAspectRatio="none"` — et y ajoute ce
 * qui manquait :
 *
 *  - une grille de fond et une graduation maximale, sans lesquelles une barre
 *    ne se lit pas (on voit un rapport, jamais une valeur) ;
 *  - un `<title>` et un tableau equivalent masque : un graphe muet est invisible
 *    pour un lecteur d'ecran, et ici il porte du chiffre d'affaires ;
 *  - la mise en avant d'une barre (`cleActive`), pour designer le mois courant.
 *
 * Deux orientations :
 *  - `verticale` (defaut) pour une serie dans le temps ; au-dela de 8 barres,
 *    les libelles s'espacent et la valeur passe en infobulle plutot que sous
 *    chaque barre, sinon rien n'est lisible ;
 *  - `horizontale` pour des categories a libelles longs (14 categories
 *    d'audit) : libelle a gauche, barre, montant au bout — aucun chevauchement,
 *    quel que soit leur nombre.
 *
 * Pas de librairie : 3 Ko de SVG font le travail, et la PWA reste legere sur
 * une connexion lente.
 */
export function Barres({
  donnees,
  hauteur = 180,
  couleur = "var(--chart-1)",
  cleActive,
  format = num,
  titre,
  orientation = "verticale",
  className,
}: {
  donnees: { cle?: string; libelle: string; valeur: number }[];
  hauteur?: number;
  couleur?: string;
  /** Barre mise en avant (les autres passent en retrait). */
  cleActive?: string;
  format?: (n: number) => string;
  /** Description du graphe, annoncee aux lecteurs d'ecran. */
  titre: string;
  orientation?: "verticale" | "horizontale";
  className?: string;
}) {
  const max = Math.max(1, ...donnees.map((d) => d.valeur));
  const n = Math.max(1, donnees.length);

  const tableau = (
    <figcaption className="sr-only">
      <table>
        <caption>{titre}</caption>
        <tbody>
          {donnees.map((d) => (
            <tr key={d.cle ?? d.libelle}>
              <th scope="row">{d.libelle}</th>
              <td>{format(d.valeur)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figcaption>
  );

  if (orientation === "horizontale") {
    return (
      <figure className={cn("border border-filet bg-surface p-3", className)}>
        <div className="mb-2 text-xs font-semibold text-encre-douce">{titre}</div>
        <ol className="flex flex-col gap-1.5" role="img" aria-label={titre}>
          {donnees.map((d) => {
            const enRetrait = cleActive != null && (d.cle ?? d.libelle) !== cleActive;
            const l = (d.valeur / max) * 100;
            return (
              <li key={d.cle ?? d.libelle} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-2" title={`${d.libelle} : ${format(d.valeur)}`}>
                <span className={cn("truncate text-xs", enRetrait ? "text-encre-pale" : "text-encre")}>{d.libelle}</span>
                <span className="relative h-3.5 overflow-hidden rounded-sm bg-filet-clair">
                  <span className="absolute inset-y-0 left-0 rounded-sm" style={{ width: `${l}%`, background: couleur, opacity: enRetrait ? 0.35 : 1 }} />
                </span>
                <span className={cn("w-20 text-right font-mono text-2xs tabular-nums", d.valeur ? "text-encre-douce" : "text-encre-pale")}>{format(d.valeur)}</span>
              </li>
            );
          })}
          {donnees.length === 0 && <li className="text-xs text-encre-pale">Aucune valeur.</li>}
        </ol>
        {tableau}
      </figure>
    );
  }

  const largeur = 100 / n;
  // Au-dela de 8 barres : un libelle sur k, et plus de valeur ecrite sous la barre.
  const pas = n > 8 ? Math.ceil(n / 8) : 1;
  const dense = n > 6;

  return (
    <figure className={cn("border border-filet bg-surface p-3", className)}>
      <div className="mb-2 text-xs font-semibold text-encre-douce">{titre}</div>
      <div className="relative" style={{ height: hauteur }}>
        {/* Graduations : 0, moitie, maximum */}
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
          {[max, max / 2, 0].map((v, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-right text-2xs tabular-nums text-encre-pale">
                {format(Math.round(v))}
              </span>
              <span className="h-px grow bg-filet-clair" />
            </div>
          ))}
        </div>

        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          role="img"
          aria-label={titre}
          className="absolute inset-y-0 right-0 block"
          style={{ left: "4.5rem", width: "calc(100% - 4.5rem)", height: hauteur }}
        >
          <title>{titre}</title>
          {donnees.map((d, i) => {
            const h = (d.valeur / max) * 100;
            const enRetrait = cleActive != null && (d.cle ?? d.libelle) !== cleActive;
            return (
              <rect
                key={d.cle ?? d.libelle}
                x={i * largeur + largeur * 0.18}
                y={100 - h}
                width={largeur * 0.64}
                height={h}
                fill={couleur}
                opacity={enRetrait ? 0.35 : 1}
              >
                <title>{`${d.libelle} : ${format(d.valeur)}`}</title>
              </rect>
            );
          })}
        </svg>
      </div>

      <div
        className="mt-2 grid gap-1 border-t border-filet-clair pt-2"
        style={{ gridTemplateColumns: `repeat(${n}, 1fr)`, marginLeft: "4.5rem" }}
      >
        {donnees.map((d, i) => {
          const actif = cleActive != null && (d.cle ?? d.libelle) === cleActive;
          const visible = i % pas === 0 || i === n - 1 || actif;
          return (
            <div key={d.cle ?? d.libelle} className="min-w-0 text-center leading-tight" title={`${d.libelle} : ${format(d.valeur)}`}>
              <span className={cn("block truncate text-2xs", actif ? "font-semibold text-encre" : "text-encre-douce", !visible && "invisible")}>{d.libelle}</span>
              {!dense && <span className="block truncate text-2xs tabular-nums text-encre-pale">{format(d.valeur)}</span>}
            </div>
          );
        })}
      </div>

      {tableau}
    </figure>
  );
}

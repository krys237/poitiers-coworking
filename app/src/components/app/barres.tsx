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
  className?: string;
}) {
  const max = Math.max(1, ...donnees.map((d) => d.valeur));
  const n = Math.max(1, donnees.length);
  const largeur = 100 / n;

  return (
    <figure className={cn("border border-filet bg-surface p-3", className)}>
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
              />
            );
          })}
        </svg>
      </div>

      <div
        className="mt-2 grid gap-1 border-t border-filet-clair pt-2"
        style={{
          gridTemplateColumns: `repeat(${n}, 1fr)`,
          marginLeft: "4.5rem",
        }}
      >
        {donnees.map((d) => (
          <div key={d.cle ?? d.libelle} className="text-center leading-tight">
            <span className="block text-xs font-medium">{d.libelle}</span>
            <span className="block text-2xs tabular-nums text-encre-douce">
              {format(d.valeur)}
            </span>
          </div>
        ))}
      </div>

      {/* Equivalent textuel : c'est ce que lit une synthese vocale. */}
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
    </figure>
  );
}

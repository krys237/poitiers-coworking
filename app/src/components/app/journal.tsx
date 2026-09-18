/**
 * Vocabulaire visuel du journal d'activité, partagé par l'écran Journal et la
 * fiche API : famille d'action (couleur), code HTTP (vert / ocre / rouge),
 * auteur (membre ou système), date relative.
 */
import { FAMILLE_ACTION, FAMILLES, type FamilleJournal } from "../../../convex/lib/journalFamilles";
import { Flag, type FlagVariant } from "@/components/ui/flag";
import { cn } from "@/lib/utils";

export const LIBELLE_FAMILLE: Record<FamilleJournal, string> = Object.fromEntries(FAMILLES) as Record<FamilleJournal, string>;
const VARIANT_FAMILLE: Record<FamilleJournal, FlagVariant> = {
  acces: "finance", paie: "especes", finances: "om", api: "direct", bareme: "momo", audit: "verrou",
};
export const familleDe = (action: string): FamilleJournal => (FAMILLE_ACTION as Record<string, FamilleJournal>)[action] ?? "audit";

export function FlagAction({ action, libelle }: { action: string; libelle: string }) {
  return <Flag variant={VARIANT_FAMILLE[familleDe(action)]} size="xs" title={LIBELLE_FAMILLE[familleDe(action)]}>{libelle}</Flag>;
}

/** Code HTTP : 2xx réussi, 4xx refusé (le demandeur), 5xx en panne (nous). */
export function CodeHttp({ code }: { code?: number }) {
  if (code === undefined) return <span className="text-encre-pale">—</span>;
  const variant: FlagVariant = code < 300 ? "renseigne" : code < 500 ? "a-renseigner" : "verrou";
  const sens = code < 300 ? "réussi" : code < 500 ? "refusé" : "erreur serveur";
  return <Flag variant={variant} size="xs" className={cn("font-mono", code >= 500 && "border-carmin/40 text-carmin")} title={sens}>{code}</Flag>;
}

export function Auteur({ nom }: { nom?: string }) {
  return nom ? <span className="font-medium">{nom}</span> : <span className="text-encre-pale">système / API</span>;
}

/** « il y a 3 min », « hier », « il y a 12 j » — la date exacte reste dans le titre. */
export function relatif(iso: string, maintenant = Date.now()): string {
  const s = Math.max(0, Math.round((maintenant - new Date(iso).getTime()) / 1000));
  if (s < 60) return "à l'instant";
  const m = Math.round(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.round(h / 24);
  if (j === 1) return "hier";
  if (j < 31) return `il y a ${j} j`;
  const mois = Math.round(j / 30);
  return mois < 12 ? `il y a ${mois} mois` : `il y a ${Math.round(mois / 12)} an(s)`;
}

export const fmtDateHeure = (iso: string) => new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "medium" });

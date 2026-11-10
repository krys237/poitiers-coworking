// Échéances de contrat : le panneau d'alerte (demande N2).
//
// « Nous voulons un système d'alerte et de rappel qui signale avant échéance. »
//
// Ce que le panneau doit réussir : qu'une échéance ne passe pas inaperçue. Un CDD arrivé à terme
// sans décision se requalifie en CDI par l'écoulement du temps — l'inaction crée un engagement.
// D'où trois partis pris :
//
//  • les contrats ÉCHUS sont en tête et ne disparaissent jamais ;
//  • le panneau s'ouvre de lui-même dès qu'un rappel tombe — se replier serait le rendre
//    oubliable, ce qui est exactement le problème qu'il résout ;
//  • chaque ligne porte SA raison, pas seulement un compte à rebours : « 21 jours » n'indique pas
//    quoi faire, « rappel hebdomadaire, prochain à 14 jours » si.

import * as React from "react";
import { useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { CalendarClockIcon, TriangleAlertIcon } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { cn } from "@/lib/utils";
import { Flag } from "@/components/ui/flag";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const jjmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

const VARIANTE: Record<string, "renseigne" | "a-renseigner" | "verrou"> = {
  depassee: "verrou",
  quotidienne: "verrou",
  hebdomadaire: "a-renseigner",
  ponctuelle: "a-renseigner",
  aucune: "renseigne",
};

// Les libellés viennent du serveur, dont le type est plus strict que la ligne lue (`any`) :
// cet accès affiche la clé brute si une cadence inconnue apparaît, au lieu de la masquer.
const libelle = (m: Record<string, string>, cle: string) => m[cle] ?? cle;

export function EcheancesContrats() {
  const vue = useQuery(api.employes.echeancesContrats, {});
  const [ouvertManuel, setOuvertManuel] = React.useState<boolean | null>(null);

  const r = vue?.resume;
  // Ouverture automatique dès qu'un rappel tombe ou qu'une échéance est dépassée. Le choix
  // manuel, une fois fait, prime — mais le défaut alerte.
  const doitAlerter = !!r && (r.rappelsDuJour > 0 || r.depassees > 0);
  const ouvert = ouvertManuel ?? doitAlerter;

  if (!vue || !r || !r.suivis) return null;

  return (
    <section
      className={cn(
        "rounded-2xl border bg-surface shadow-xs",
        r.depassees ? "border-carmin" : r.rappelsDuJour ? "border-ocre" : "border-filet",
      )}
    >
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
        aria-expanded={ouvert}
        onClick={() => setOuvertManuel(!ouvert)}
      >
        {r.depassees ? (
          <TriangleAlertIcon className="h-4 w-4 shrink-0 text-carmin" aria-hidden="true" />
        ) : (
          <CalendarClockIcon className="h-4 w-4 shrink-0 text-sceau" aria-hidden="true" />
        )}
        <span className="text-sm font-semibold">Échéances de contrat</span>
        <span className="text-xs text-encre-pale">
          {r.depassees ? `${r.depassees} dépassée(s) · ` : ""}
          {r.cetteSemaine ? `${r.cetteSemaine} cette semaine · ` : ""}
          {r.suivis} suivi(s)
          {r.rappelsDuJour ? ` · ${r.rappelsDuJour} rappel(s) aujourd'hui` : ""}
        </span>
        <span className="ml-auto text-xs text-encre-pale">{ouvert ? "Masquer" : "Voir"}</span>
      </button>

      {ouvert ? (
        <div className="border-t border-filet">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employé</TableHead>
                  <TableHead>Contrat</TableHead>
                  <TableHead>Fin</TableHead>
                  <TableHead className="text-right">Reste</TableHead>
                  <TableHead>Rappel</TableHead>
                  <TableHead>Ce qu'il faut savoir</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vue.echeances.map((e: any) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-xs font-medium">
                      {e.nom}
                      {e.serviceNom ? (
                        <span className="block text-2xs text-encre-pale">{e.serviceNom}</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-xs">
                      {e.contrat ?? "—"}
                      {e.renouvele ? (
                        <span className="block text-2xs text-ocre">déjà renouvelé</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{jjmm(e.dateFin)}</TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-mono text-xs tabular-nums",
                        e.restants < 0 ? "font-bold text-carmin" : e.restants <= 7 ? "text-carmin" : "",
                      )}
                    >
                      {e.restants < 0 ? `${-e.restants} j de retard` : `${e.restants} j`}
                    </TableCell>
                    <TableCell>
                      <Flag variant={VARIANTE[e.cadence]} size="xs">
                        {libelle(vue.libelles, e.cadence)}
                      </Flag>
                      {e.rappelAujourdhui ? (
                        <span className="ml-1 text-2xs font-semibold text-carmin">aujourd'hui</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-2xs text-encre-douce">{e.raison}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="border-t border-filet-clair px-3 py-2 text-2xs text-encre-pale">
            Cadence actuelle : premier avis à {vue.regles.premierAvisJours} jours, puis un rappel
            par semaine en deçà de {vue.regles.hebdoDepuisJours} jours, puis un par jour en deçà de{" "}
            {vue.regles.quotidienDepuisJours}. Réglable dans{" "}
            <Link to="/parametres?onglet=fonctionnement" className="underline underline-offset-2">
              Paramètres → Fonctionnement
            </Link>
            . Une date de fin se saisit sur la fiche de l'employé : sans elle, aucun rappel n'est
            possible.
          </p>
        </div>
      ) : null}
    </section>
  );
}

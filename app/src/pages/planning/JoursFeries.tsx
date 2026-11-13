// Jours fériés de l'année, et décret en cours d'année (demande N1).
//
// « Les jours fériés décrétés au cours de l'année pour une raison ou une autre augmentent ou
//   décalent la date initialement prévue […] il faut donc que la RH puisse ajouter des fériés
//   justifiés en cas de besoin. »
//
// Ce que l'écran doit rendre impossible à rater : **décréter un jour décale des congés déjà
// posés**. L'action rend donc la liste de ce qui a bougé, avec l'avant et l'après, et elle reste
// affichée jusqu'à ce que la RH décrète autre chose. Un retour de congé qui change sans qu'on le
// voie serait pire que pas de recalcul du tout.

import * as React from "react";
import { useMutation, useQuery } from "convex/react";
import { CalendarPlusIcon, TriangleAlertIcon } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { messageErreur } from "@/lib/format";
import { cn } from "@/lib/utils";
import { BoutonAction } from "@/components/app/bouton-action";
import { Button } from "@/components/ui/button";
import { Flag } from "@/components/ui/flag";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableVide,
} from "@/components/ui/table";

const jj = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const jjmm = (d?: string) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : "—");

const LIBELLE_ORIGINE: Record<string, string> = {
  fixe: "date fixe",
  pascal: "comput de Pâques",
  saisi: "saisi à la main",
  decrete: "décrété en cours d'année",
};

type Rapport = {
  libelle: string;
  resume: { touches: number; appliques: number; bloques: number; decalageMax: number };
  decalages: {
    id: string; employeNom?: string; dateDebut: string;
    finAvant: string; finApres: string; retourAvant?: string; retourApres: string;
    decaleDe: number; bloque?: string;
  }[];
};

export function JoursFeries({ annee }: { annee: number }) {
  const liste = useQuery(api.joursFeries.liste, { annee });
  const decreter = useMutation(api.joursFeries.decreter);
  const supprimer = useMutation(api.joursFeries.supprimer);

  const [ouvert, setOuvert] = React.useState(false);
  const [date, setDate] = React.useState("");
  const [libelle, setLibelle] = React.useState("");
  const [motif, setMotif] = React.useState("");
  const [enCours, setEnCours] = React.useState(false);
  const [rapport, setRapport] = React.useState<Rapport | null>(null);
  const [erreur, setErreur] = React.useState<string | null>(null);

  const valider = async () => {
    setErreur(null);
    setEnCours(true);
    try {
      const r = (await decreter({ date, libelle, motif })) as Rapport;
      setRapport(r);
      setDate(""); setLibelle(""); setMotif("");
    } catch (e) {
      setErreur(messageErreur(e));
    } finally { setEnCours(false); }
  };

  const lignes = liste?.lignes ?? [];
  const decretes = lignes.filter((l: any) => l.origine === "decrete");

  return (
    <section className="rounded-2xl border border-filet bg-surface shadow-xs">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
        aria-expanded={ouvert}
        onClick={() => setOuvert((x) => !x)}
      >
        <CalendarPlusIcon className="h-4 w-4 shrink-0 text-sceau" aria-hidden="true" />
        <span className="text-sm font-semibold">Jours fériés {annee}</span>
        <span className="text-xs text-encre-pale">
          {lignes.length} enregistré(s){decretes.length ? ` · ${decretes.length} décrété(s) en cours d'année` : ""}
        </span>
        <span className="ml-auto text-xs text-encre-pale">{ouvert ? "Masquer" : "Gérer"}</span>
      </button>

      {ouvert ? (
        <div className="space-y-3 border-t border-filet p-3">
          {/* --- Décréter --- */}
          <div className="rounded-lg border border-filet bg-papier p-3">
            <h3 className="text-xs font-semibold">Décréter un jour férié</h3>
            <p className="mt-0.5 text-2xs text-encre-pale">
              Un deuil national, un report de fête, une journée chômée exceptionnelle. Les congés
              déjà posés qui enjambent cette date <strong>seront décalés</strong> : le salarié garde
              son nombre de jours, c'est sa date de retour qui recule.
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-[10rem_1fr]">
              <label className="grid gap-1 text-2xs">
                Date
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8 text-xs" />
              </label>
              <label className="grid gap-1 text-2xs">
                Libellé
                <Input
                  value={libelle} onChange={(e) => setLibelle(e.target.value)}
                  placeholder="Journée de deuil national" className="h-8 text-xs"
                />
              </label>
              <label className="grid gap-1 text-2xs sm:col-span-2">
                Motif <span className="text-carmin">— obligatoire</span>
                <Input
                  value={motif} onChange={(e) => setMotif(e.target.value)}
                  placeholder="Décret n°… du … / circulaire du …" className="h-8 text-xs"
                />
              </label>
            </div>
            {erreur ? (
              <p className="mt-2 text-2xs text-carmin" role="alert">{erreur}</p>
            ) : null}
            <Button
              size="sm" className="mt-2"
              disabled={enCours || !date || !libelle.trim() || !motif.trim()}
              onClick={() => void valider()}
            >
              {enCours ? "Application…" : "Décréter et décaler les congés"}
            </Button>
          </div>

          {/* --- Ce qui a bougé --- */}
          {rapport ? (
            <div
              className={cn(
                "rounded-lg border p-3",
                rapport.resume.bloques
                  ? "border-ocre bg-ocre-clair/40"
                  : rapport.resume.touches
                    ? "border-ocean-ciel bg-ocean-brume/30"
                    : "border-filet bg-papier",
              )}
            >
              <h3 className="flex items-center gap-1.5 text-xs font-semibold">
                {rapport.resume.bloques ? (
                  <TriangleAlertIcon className="h-3.5 w-3.5 text-ocre" aria-hidden="true" />
                ) : null}
                {rapport.libelle}
              </h3>
              {rapport.decalages.length ? (
                <div className="mt-2 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employé</TableHead>
                        <TableHead>Départ</TableHead>
                        <TableHead>Dernier jour</TableHead>
                        <TableHead>Retour</TableHead>
                        <TableHead className="text-right">Décalage</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rapport.decalages.map((d) => (
                        <TableRow key={d.id}>
                          <TableCell className="text-xs font-medium">
                            {d.employeNom ?? "—"}
                            {d.bloque ? (
                              <Flag variant="a-renseigner" size="xs" className="ml-1.5">non appliqué</Flag>
                            ) : null}
                            {d.bloque ? (
                              <div className="text-2xs text-ocre">{d.bloque}</div>
                            ) : null}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{jj(d.dateDebut)}</TableCell>
                          {/* L'avant ET l'après : un « après » seul ne se vérifie pas. */}
                          <TableCell className="font-mono text-xs">
                            <span className="text-encre-pale line-through">{jj(d.finAvant)}</span>{" "}
                            → <strong>{jj(d.finApres)}</strong>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            <span className="text-encre-pale line-through">{jj(d.retourAvant ?? "")}</span>{" "}
                            → <strong>{jj(d.retourApres)}</strong>
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {d.decaleDe > 0 ? `+${d.decaleDe}` : d.decaleDe} j
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* --- Le calendrier de l'année --- */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Libellé</TableHead>
                  <TableHead>Origine</TableHead>
                  <TableHead>Décompté&nbsp;?</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {!lignes.length ? (
                  <TableVide colonnes={5}>Aucun jour férié enregistré pour {annee}.</TableVide>
                ) : (
                  lignes.map((l: any) => (
                    <TableRow key={String(l._id)}>
                      <TableCell className="font-mono text-xs">{jjmm(l.date)}</TableCell>
                      <TableCell className="text-xs">
                        {l.libelle}
                        {l.motif ? <div className="text-2xs text-encre-pale">{l.motif}</div> : null}
                      </TableCell>
                      <TableCell className="text-xs text-encre-pale">
                        {LIBELLE_ORIGINE[l.origine] ?? l.origine}
                      </TableCell>
                      <TableCell className="text-xs">
                        {l.chome ? (
                          <span className="text-encre-pale">non — chômé</span>
                        ) : (
                          <Flag variant="a-renseigner" size="xs">oui — travaillé</Flag>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {/* Retirer un férié RACCOURCIT les congés qu'il avait prolongés : la même
                            mécanique joue en sens inverse, et le rapport le dit. */}
                        <BoutonAction
                          size="sm"
                          variant="ghost"
                          onAction={async () => {
                            const r = (await supprimer({ id: l._id })) as Rapport | undefined;
                            if (r) setRapport(r);
                            return r;
                          }}
                          succes={(r: any) =>
                            r?.libelle
                              ? `Jour férié retiré. ${r.libelle}`
                              : "Jour férié retiré."
                          }
                        >
                          Retirer
                        </BoutonAction>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : null}
    </section>
  );
}

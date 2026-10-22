/**
 * Frise annuelle des congés (lot R1) — la vue qui remplace le classeur de la RH.
 *
 * Forme retenue : une ligne par employé, **regroupée par service**. Le service est donc encodé
 * d'abord par la POSITION (regroupement), la couleur n'étant qu'un repère secondaire — c'est ce
 * qui permet de tenir 10 services alors qu'une palette catégorielle n'est fiable que sur 8
 * (`lib/planningAnnuel.PALETTE_SERVICES`). La couleur reste paramétrable par service, comme
 * demandé, mais elle ne porte jamais seule une information.
 *
 * Ce que la RH ne pouvait pas voir dans Excel et qui apparaît ici :
 *  · les **chevauchements dans un même service** — sa vraie crainte : vider un service ;
 *  · les **anomalies de saisie** (retour antérieur au départ, durée aberrante) ;
 *  · le **droit à congé calculé** avec sa justification, au lieu d'un nombre tapé à la main.
 */
import * as React from "react";
import { useMutation, useQuery } from "convex/react";
import { AlertTriangleIcon, CalendarPlusIcon, InfoIcon, PencilIcon, UsersIcon } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { LIBELLE_OBSERVATION, OBSERVATIONS } from "../../../convex/lib/planningAnnuel";
import { cn } from "@/lib/utils";
import { GrilleTuiles, Tuile } from "@/components/app/tuile";
import { BoutonAction } from "@/components/app/bouton-action";
import { Button } from "@/components/ui/button";
import { Flag } from "@/components/ui/flag";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableVide,
} from "@/components/ui/table";

const fmt = (s?: string | null) => (s ? new Date(s + "T00:00:00").toLocaleDateString("fr-FR") : "—");
const fmtCourt = (s: string) =>
  new Date(s + "T00:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
const sansAccents = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

type Saisie = {
  absenceId: string | null;
  employeId: string;
  nom: string;
  dateDebut: string;
  joursOuvrables: string;
  observation: string;
  commentaire: string;
  remplacantTexte: string;
  congeSuppManuel: string;
  congeSuppMotif: string;
};

export function FriseAnnuelle() {
  const [annee, setAnnee] = React.useState(new Date().getFullYear());
  const [seuil, setSeuil] = React.useState(2);
  const [recherche, setRecherche] = React.useState("");
  const [edition, setEdition] = React.useState<Saisie | null>(null);
  const [survol, setSurvol] = React.useState<string | null>(null);

  const vue = useQuery(api.planning.vueAnnuelle, { annee, seuilChevauchement: seuil });
  const enregistrer = useMutation(api.planning.enregistrerCongeAnnuel);
  const initFeries = useMutation(api.joursFeries.initialiserAnnee);
  const initServices = useMutation(api.services.initialiser);

  const q = sansAccents(recherche.trim());
  const lignes = (vue?.lignes ?? []).filter(
    (l) => !q || sansAccents(`${l.nom} ${l.serviceNom ?? ""} ${l.matricule}`).includes(q),
  );

  // Regroupement par service : c'est l'encodage principal, la couleur n'est qu'un rappel.
  const groupes = React.useMemo(() => {
    const m = new Map<string, typeof lignes>();
    for (const l of lignes) {
      const cle = l.serviceNom ?? "Sans service";
      const g = m.get(cle);
      if (g) g.push(l);
      else m.set(cle, [l]);
    }
    return [...m.entries()];
  }, [lignes]);

  const chevauchements = vue?.chevauchements ?? [];
  const anomalies = lignes.flatMap((l) =>
    l.evenements.flatMap((ev) => ev.anomalies.map((a) => ({ nom: l.nom, ...a }))),
  );

  return (
    <div className="space-y-4">
      {/* ---- Bandeau d'amorçage : sans calendrier de fériés, tout le décompte est faux ---- */}
      {vue?.calendrierAbsent ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-ocre bg-ocre-clair/50 px-4 py-3">
          <AlertTriangleIcon className="h-5 w-5 shrink-0 text-ocre" aria-hidden="true" />
          <p className="flex-1 text-sm">
            <strong>Aucun jour férié enregistré pour {annee}.</strong> Le décompte des congés exclut
            les dimanches <em>et</em> les jours fériés : sans ce calendrier, toutes les dates de
            retour seraient fausses.
          </p>
          <BoutonAction
            size="sm"
            onAction={() => initFeries({ annee })}
            succes={(r: any) =>
              `${r.ajoutes} jour(s) férié(s) ajouté(s). À saisir à la main : ${r.aSaisir.join(", ")}`
            }
          >
            <CalendarPlusIcon /> Initialiser {annee}
          </BoutonAction>
        </div>
      ) : null}

      {!vue?.services.length ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-filet bg-bande px-4 py-3">
          <InfoIcon className="h-5 w-5 shrink-0 text-ocean-ceruleen" aria-hidden="true" />
          <p className="flex-1 text-sm">
            <strong>Aucun service défini.</strong> Les services portent la couleur de la frise et
            servent à détecter qu'un service se vide.
          </p>
          <BoutonAction
            size="sm"
            variant="outline"
            onAction={() => initServices({})}
            succes={(r: any) =>
              `${r.ajoutes} service(s) créé(s)` +
              (r.sansCouleurDistincte
                ? ` — ${r.sansCouleurDistincte} au-delà de la palette : choisissez-leur une couleur`
                : "")
            }
          >
            Créer les services
          </BoutonAction>
        </div>
      ) : null}

      {/* ---- Synthèse ---- */}
      <GrilleTuiles>
        <Tuile libelle="Employés planifiés" valeur={vue ? lignes.filter((l) => l.evenements.length).length : undefined} note={`sur ${lignes.length} actifs`} />
        <Tuile libelle="Jours de congé pris" valeur={vue ? lignes.reduce((t, l) => t + l.joursPris, 0) : undefined} note="jours ouvrables" />
        <Tuile
          libelle="Services dégarnis"
          valeur={vue ? chevauchements.length : undefined}
          note={`${seuil} personnes ou plus en même temps`}
          ton={chevauchements.length ? "alerte" : "succes"}
        />
        <Tuile
          libelle="Anomalies de saisie"
          valeur={vue ? anomalies.length : undefined}
          note="dates incohérentes"
          ton={anomalies.length ? "attente" : "succes"}
        />
      </GrilleTuiles>

      {/* ---- Filtres, sur une seule ligne au-dessus de la frise ---- */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-filet bg-surface px-3 py-2 shadow-xs print:hidden">
        <Select value={String(annee)} onValueChange={(v) => setAnnee(+v)}>
          <SelectTrigger className="h-8 w-28" aria-label="Année">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[annee - 2, annee - 1, annee, annee + 1].map((a) => (
              <SelectItem key={a} value={String(a)}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-xs text-encre-douce">
          Alerte à partir de
          <Select value={String(seuil)} onValueChange={(v) => setSeuil(+v)}>
            <SelectTrigger className="h-8 w-16" aria-label="Seuil de chevauchement">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2, 3, 4, 5].map((n) => (
                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          personnes par service
        </label>
        <span className="flex-1" />
        <Input
          type="search"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Employé, service…"
          aria-label="Rechercher"
          className="h-8 w-52"
        />
      </div>

      {/* ---- Légende : l'identité n'est jamais portée par la couleur seule ---- */}
      {vue?.services.length ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1 text-xs">
          {vue.services.map((s) => (
            <span key={String(s._id)} className="flex items-center gap-1.5 text-encre-douce">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: s.couleur }}
                aria-hidden="true"
              />
              {s.nom}
            </span>
          ))}
        </div>
      ) : null}

      {/* ---- Alertes de chevauchement : couleur + icône + libellé, jamais la couleur seule ---- */}
      {chevauchements.length ? (
        <div className="space-y-1.5 rounded-2xl border border-carmin/30 bg-carmin-clair/40 p-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-carmin">
            <UsersIcon className="h-4 w-4" aria-hidden="true" />
            {chevauchements.length} période(s) où un service se dégarnit
          </p>
          <ul className="space-y-0.5 text-xs text-encre-douce">
            {chevauchements.slice(0, 8).map((c, i) => (
              <li key={i}>
                <strong>{c.serviceNom}</strong> — {c.effectif} personnes du {fmt(c.debut)} au{" "}
                {fmt(c.fin)} : {c.employeNoms.join(", ")}
              </li>
            ))}
            {chevauchements.length > 8 ? <li>… et {chevauchements.length - 8} autre(s)</li> : null}
          </ul>
        </div>
      ) : null}

      {/* ---- La frise ---- */}
      <div className="rounded-2xl border border-filet bg-surface shadow-xs">
        <div className="overflow-x-auto">
          <div className="min-w-[48rem] p-3">
            {/* Graduations des mois : récessives, elles ne doivent pas concurrencer les marques. */}
            <div className="flex items-end gap-2 pb-1">
              <div className="w-48 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-encre-pale">
                Employé
              </div>
              <div className="relative h-4 flex-1">
                {(vue?.graduations ?? []).map((m) => (
                  <span
                    key={m.mois}
                    className="absolute top-0 text-[10px] text-encre-pale"
                    style={{ left: `${m.gauchePct}%` }}
                  >
                    {m.libelle}
                  </span>
                ))}
              </div>
            </div>

            {vue === undefined ? (
              <p className="py-8 text-center text-sm text-encre-pale">Chargement…</p>
            ) : !groupes.length ? (
              <p className="py-8 text-center text-sm text-encre-pale">Aucun employé.</p>
            ) : (
              groupes.map(([service, membres]) => (
                <div key={service} className="mb-3 last:mb-0">
                  <div className="flex items-center gap-2 border-b border-filet-clair pb-1 pt-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: membres[0].couleur }}
                      aria-hidden="true"
                    />
                    <span className="text-xs font-semibold uppercase tracking-wide">{service}</span>
                    <span className="text-[10px] text-encre-pale">
                      {membres.length} personne(s)
                    </span>
                  </div>

                  {membres.map((l) => (
                    <div key={String(l.employeId)} className="flex items-center gap-2 py-0.5">
                      <button
                        type="button"
                        className="w-48 shrink-0 truncate text-left text-xs hover:underline"
                        title={l.detailDroit.join("\n")}
                        onClick={() =>
                          setEdition({
                            absenceId: null,
                            employeId: String(l.employeId),
                            nom: l.nom,
                            dateDebut: "",
                            joursOuvrables: String(l.totalConge),
                            observation: "planifie",
                            commentaire: "",
                            remplacantTexte: "",
                            congeSuppManuel: "",
                            congeSuppMotif: "",
                          })
                        }
                      >
                        {l.nom}
                        <span className="ml-1 text-encre-pale">
                          {l.joursPris}/{l.totalConge} j
                        </span>
                      </button>

                      {/* Piste de l'employé : fond récessif + graduations mensuelles fines. */}
                      <div className="relative h-6 flex-1 rounded bg-bande/60">
                        {(vue?.graduations ?? []).map((m) =>
                          m.mois === 1 ? null : (
                            <span
                              key={m.mois}
                              className="absolute inset-y-0 w-px bg-filet-clair"
                              style={{ left: `${m.gauchePct}%` }}
                              aria-hidden="true"
                            />
                          ),
                        )}
                        {l.evenements.map((ev) =>
                          ev.segment ? (
                            <button
                              key={ev.id}
                              type="button"
                              // Anneau de 2 px couleur surface : sépare deux marques qui se touchent.
                              className={cn(
                                "absolute inset-y-0.5 rounded ring-2 ring-surface transition-[filter]",
                                "hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-1",
                                survol === ev.id && "brightness-110",
                              )}
                              style={{
                                left: `${ev.segment.gauchePct}%`,
                                width: `max(0.75rem, ${ev.segment.largeurPct}%)`,
                                backgroundColor: l.couleur,
                              }}
                              onMouseEnter={() => setSurvol(ev.id)}
                              onMouseLeave={() => setSurvol(null)}
                              onFocus={() => setSurvol(ev.id)}
                              onBlur={() => setSurvol(null)}
                              onClick={() =>
                                setEdition({
                                  absenceId: ev.id,
                                  employeId: String(l.employeId),
                                  nom: l.nom,
                                  dateDebut: ev.dateDebut,
                                  joursOuvrables: String(ev.joursOuvrables),
                                  observation: ev.observation,
                                  commentaire: ev.commentaire ?? "",
                                  remplacantTexte: ev.remplacant ?? "",
                                  congeSuppManuel: l.congeSuppForce ? String(l.congeSupplementaire) : "",
                                  congeSuppMotif: l.congeSuppMotif ?? "",
                                })
                              }
                              aria-label={`${l.nom} : congé du ${fmt(ev.dateDebut)} au ${fmt(ev.dateFin)}, retour le ${fmt(ev.dateRetour)}`}
                            >
                              {/* Étiquette directe quand la barre est assez large. */}
                              {ev.segment.largeurPct > 7 ? (
                                <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[9px] font-semibold text-white">
                                  {ev.joursOuvrables} j
                                </span>
                              ) : null}
                              {ev.anomalies.length ? (
                                <span
                                  className="pointer-events-none absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border border-surface bg-carmin"
                                  aria-hidden="true"
                                />
                              ) : null}
                            </button>
                          ) : null,
                        )}
                        {/* Infobulle au survol : exigée sur toute marque interactive. */}
                        {l.evenements.map((ev) =>
                          survol === ev.id && ev.segment ? (
                            <div
                              key={`${ev.id}-tip`}
                              role="tooltip"
                              className="absolute z-20 w-60 -translate-x-1/2 translate-y-1 rounded-xl border border-filet bg-surface p-2.5 text-xs shadow-lg"
                              style={{
                                left: `min(max(${ev.segment.gauchePct + ev.segment.largeurPct / 2}%, 7.5rem), calc(100% - 7.5rem))`,
                                top: "100%",
                              }}
                            >
                              <p className="font-semibold">{l.nom}</p>
                              <dl className="mt-1 space-y-0.5 text-encre-douce">
                                <div className="flex justify-between gap-2">
                                  <dt>Départ</dt><dd className="font-medium text-encre">{fmt(ev.dateDebut)}</dd>
                                </div>
                                <div className="flex justify-between gap-2">
                                  <dt>Dernier jour</dt><dd className="font-medium text-encre">{fmt(ev.dateFin)}</dd>
                                </div>
                                <div className="flex justify-between gap-2">
                                  <dt>Retour</dt><dd className="font-medium text-encre">{fmt(ev.dateRetour)}</dd>
                                </div>
                                <div className="flex justify-between gap-2">
                                  <dt>Jours ouvrables</dt><dd className="font-medium text-encre">{ev.joursOuvrables}</dd>
                                </div>
                                <div className="flex justify-between gap-2">
                                  <dt>Remplaçant</dt><dd className="font-medium text-encre">{ev.remplacant ?? "—"}</dd>
                                </div>
                                <div className="flex justify-between gap-2">
                                  <dt>Observation</dt>
                                  <dd className="font-medium text-encre">
                                    {LIBELLE_OBSERVATION[ev.observation] ?? ev.observation}
                                  </dd>
                                </div>
                              </dl>
                              {ev.anomalies.length ? (
                                <p className="mt-1.5 border-t border-filet-clair pt-1.5 text-carmin">
                                  {ev.anomalies.map((a) => a.message).join(" · ")}
                                </p>
                              ) : null}
                            </div>
                          ) : null,
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ---- Vue en tableau : l'équivalent textuel de la frise ---- */}
      <div className="rounded-2xl border border-filet bg-surface shadow-xs">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employé</TableHead>
              <TableHead>Service</TableHead>
              <TableHead className="text-right">Principal</TableHead>
              <TableHead className="text-right">Supplément.</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Rappel {annee - 1}</TableHead>
              <TableHead>Départ</TableHead>
              <TableHead>Retour</TableHead>
              <TableHead>Remplaçant</TableHead>
              <TableHead>Observation</TableHead>
              <TableHead className="text-right">Solde</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {!lignes.length ? (
              <TableVide colonnes={12}>Aucun employé.</TableVide>
            ) : (
              lignes.map((l) => {
                const ev = l.evenements[0];
                return (
                  <TableRow key={String(l.employeId)}>
                    <TableCell className="font-medium">
                      {l.nom}
                      {!l.droitOuvert ? (
                        <Flag variant="a-renseigner" size="xs" className="ml-1.5">droit non ouvert</Flag>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: l.couleur }} aria-hidden="true" />
                        {l.serviceNom ?? "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{l.congePrincipal}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {l.congeSupplementaire}
                      {l.congeSuppForce ? (
                        <span title={l.congeSuppMotif ?? ""} className="ml-1 text-ocre">✱</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{l.totalConge}</TableCell>
                    <TableCell className="text-xs text-encre-pale">
                      {l.rappelAnneePrecedente
                        ? `${fmtCourt(l.rappelAnneePrecedente.debut)} → ${fmtCourt(l.rappelAnneePrecedente.fin)}`
                        : "RAS"}
                    </TableCell>
                    <TableCell>{fmt(ev?.dateDebut)}</TableCell>
                    <TableCell>{fmt(ev?.dateRetour)}</TableCell>
                    <TableCell className="text-xs">{ev?.remplacant ?? "—"}</TableCell>
                    <TableCell>
                      {ev ? (
                        <Flag variant={ev.anomalies.length ? "a-renseigner" : "neutre"} size="xs">
                          {LIBELLE_OBSERVATION[ev.observation] ?? ev.observation}
                        </Flag>
                      ) : (
                        <Flag variant="verrou" size="xs">Non pris</Flag>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{l.soldeConge}</TableCell>
                    <TableCell>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Modifier le congé de ${l.nom}`}
                        onClick={() =>
                          setEdition({
                            absenceId: ev?.id ?? null,
                            employeId: String(l.employeId),
                            nom: l.nom,
                            dateDebut: ev?.dateDebut ?? "",
                            joursOuvrables: String(ev?.joursOuvrables ?? l.totalConge),
                            observation: ev?.observation ?? "planifie",
                            commentaire: ev?.commentaire ?? "",
                            remplacantTexte: ev?.remplacant ?? "",
                            congeSuppManuel: l.congeSuppForce ? String(l.congeSupplementaire) : "",
                            congeSuppMotif: l.congeSuppMotif ?? "",
                          })
                        }
                      >
                        <PencilIcon />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <FormulaireConge
        saisie={edition}
        annee={annee}
        onFermer={() => setEdition(null)}
        onEnregistrer={enregistrer}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------

function FormulaireConge({
  saisie,
  annee,
  onFermer,
  onEnregistrer,
}: {
  saisie: Saisie | null;
  annee: number;
  onFermer: () => void;
  onEnregistrer: ReturnType<typeof useMutation>;
}) {
  const [v, setV] = React.useState<Saisie | null>(saisie);
  React.useEffect(() => setV(saisie), [saisie]);
  if (!v) return null;

  const champ = <K extends keyof Saisie>(k: K, x: Saisie[K]) => setV({ ...v, [k]: x });
  const surcharge = v.congeSuppManuel.trim() !== "";

  return (
    <Dialog open onOpenChange={(o) => !o && onFermer()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{v.absenceId ? "Modifier le congé" : "Poser un congé"} — {v.nom}</DialogTitle>
          <DialogDescription>
            Saisissez la date de départ et le nombre de jours ouvrables. Le dernier jour de congé et
            la <strong>date de retour</strong> sont calculés : dimanches et jours fériés exclus.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs">
            Date de départ
            <Input type="date" value={v.dateDebut} onChange={(e) => champ("dateDebut", e.target.value)} />
          </label>
          <label className="grid gap-1 text-xs">
            Jours ouvrables
            <Input
              type="number"
              min={1}
              max={120}
              value={v.joursOuvrables}
              onChange={(e) => champ("joursOuvrables", e.target.value)}
            />
          </label>
          <label className="grid gap-1 text-xs">
            Observation
            <Select value={v.observation} onValueChange={(x) => champ("observation", x)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {OBSERVATIONS.map(([cle, lib]) => (
                  <SelectItem key={cle} value={cle}>{lib}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="grid gap-1 text-xs">
            Remplaçant
            <Input
              value={v.remplacantTexte}
              onChange={(e) => champ("remplacantTexte", e.target.value)}
              placeholder="Nom, ou CONTINUITE"
            />
          </label>
          <label className="grid gap-1 text-xs sm:col-span-2">
            Commentaire
            <Input value={v.commentaire} onChange={(e) => champ("commentaire", e.target.value)} />
          </label>

          <div className="grid gap-3 rounded-xl border border-dashed border-filet bg-bande/40 p-3 sm:col-span-2 sm:grid-cols-2">
            <label className="grid gap-1 text-xs">
              Congé supplémentaire forcé
              <Input
                type="number"
                min={0}
                max={30}
                value={v.congeSuppManuel}
                onChange={(e) => champ("congeSuppManuel", e.target.value)}
                placeholder="laisser vide = calculé"
              />
            </label>
            <label className="grid gap-1 text-xs">
              Motif de la surcharge {surcharge ? <span className="text-carmin">obligatoire</span> : null}
              <Input
                value={v.congeSuppMotif}
                onChange={(e) => champ("congeSuppMotif", e.target.value)}
                disabled={!surcharge}
              />
            </label>
            <p className="text-[10px] text-encre-pale sm:col-span-2">
              Par défaut le supplément est calculé : 2 jours par tranche de 5 ans d'ancienneté, plus
              2 jours par enfant de moins de 6 ans pour les mères (art. 90). Ne le forcez que pour un
              cas que la règle ne couvre pas.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onFermer}>Annuler</Button>
          <BoutonAction
            disabled={!v.dateDebut || !v.joursOuvrables || (surcharge && !v.congeSuppMotif.trim())}
            onAction={() =>
              onEnregistrer({
                absenceId: v.absenceId ?? undefined,
                employeId: v.employeId,
                anneeReference: annee,
                dateDebut: v.dateDebut,
                joursOuvrables: Number(v.joursOuvrables),
                observation: v.observation,
                commentaire: v.commentaire || undefined,
                remplacantTexte: v.remplacantTexte || undefined,
                congeSuppManuel: surcharge ? Number(v.congeSuppManuel) : undefined,
                congeSuppMotif: surcharge ? v.congeSuppMotif : undefined,
              } as any)
            }
            succes={(r: any) => {
              onFermer();
              return `Congé enregistré — retour le ${fmt(r.dateRetour)}` +
                (r.periodes.length ? `, paie recalée (${r.periodes.join(", ")})` : "");
            }}
          >
            Enregistrer
          </BoutonAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

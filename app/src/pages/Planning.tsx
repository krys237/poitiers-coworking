/**
 * Planning des absences — refonte (charte poitiers-ui-ux-system).
 *
 * Congés, maladies et absences par employé ; chaque saisie recale la paie du
 * mois (jours travaillés, absences non payées), mois clôturés exclus.
 *
 * Deux onglets : « Absences du mois » (saisie en série : ligne permanente en
 * tête du tableau, Entrée ajoute, l'employé reste sélectionné) et « Soldes &
 * jours travaillés » (une ligne par employé, avec l'état de sa saisie de paie).
 */
import * as React from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { PencilIcon, PlusIcon, RefreshCwIcon, SearchIcon, Trash2Icon } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { jours as fmtJours, libellePeriode, messageErreur, periodeCourante } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageEnTete } from "@/components/app/en-tete";
import { GrilleTuiles, Tuile } from "@/components/app/tuile";
import { StatutMois } from "@/components/app/statut";
import { SelecteurPeriode } from "@/components/app/selecteur-periode";
import { BoutonAction, BoutonConfirmation } from "@/components/app/bouton-action";
import { Champ } from "@/components/app/champs";
import { SqueletteTableau } from "@/components/app/chargement";
import { BoutonPersistance, useSaisiePersistante } from "@/components/app/saisie-persistante";
import { SelecteurLignes, useLignesVisibles } from "@/components/app/lignes-visibles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Flag, type FlagVariant } from "@/components/ui/flag";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow, TableVide } from "@/components/ui/table";

// --- Vocabulaire ----------------------------------------------------------------

type TypeAbs = "conge_paye" | "absence" | "maladie" | "autre";
const TYPES: { cle: TypeAbs; label: string; variant: FlagVariant; payeParDefaut: boolean; aide: string }[] = [
  { cle: "conge_paye", label: "Congé payé", variant: "especes", payeParDefaut: true, aide: "décompté du solde de congés, rémunéré" },
  { cle: "maladie", label: "Maladie", variant: "momo", payeParDefaut: true, aide: "justifiée, rémunérée" },
  { cle: "absence", label: "Absence non justifiée", variant: "om", payeParDefaut: false, aide: "déduite des jours travaillés" },
  { cle: "autre", label: "Autre", variant: "neutre", payeParDefaut: false, aide: "à préciser dans le motif" },
];
const TYPE = Object.fromEntries(TYPES.map((t) => [t.cle, t])) as Record<TypeAbs, (typeof TYPES)[number]>;

type Saisie = { absenceId: string | null; employeId: string; type: TypeAbs; dateDebut: string; dateFin: string; paye: boolean; motif: string };
const fmtDate = (s?: string) => (s ? new Date(s + "T00:00:00").toLocaleDateString("fr-FR") : "—");
const sansAccents = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const J = ({ v, negatif }: { v: number; negatif?: boolean }) =>
  v ? <span className={cn(negatif && "font-semibold text-carmin")}>{v.toLocaleString("fr-FR")}</span> : <span className="text-encre-pale">0</span>;
const recale = (periodes: string[]) => (periodes.length ? `paie recalée : ${periodes.map(libellePeriode).join(", ")}` : "aucun mois ouvert à recaler");

// --- Page -------------------------------------------------------------------------

export function Planning() {
  const [periode, setPeriode] = React.useState(periodeCourante());
  const vue = useQuery(api.planning.vueMensuelle, { periode });
  const ajouter = useMutation(api.planning.ajouterAbsence);
  const modifier = useMutation(api.planning.modifierAbsence);
  const supprimer = useMutation(api.planning.supprimerAbsence);
  const synchroniser = useMutation(api.planning.synchroniserPaie);

  const [onglet, setOnglet] = React.useState<"absences" | "soldes">("absences");
  const [persistant, setPersistant] = useSaisiePersistante("planning", true);
  const lignesAbs = useLignesVisibles("planning:absences", 15);
  const lignesSoldes = useLignesVisibles("planning:soldes", 15);
  const [filtreType, setFiltreType] = React.useState<TypeAbs | "tous">("tous");
  const [recherche, setRecherche] = React.useState("");
  const [edition, setEdition] = React.useState<Saisie | null>(null);

  const cloture = vue?.cloture ?? false;
  const lignes = (vue?.lignes ?? []) as any[];
  const employes = lignes.map((l) => ({ employeId: String(l.employeId), nom: l.nom }));
  const tot = (k: string) => lignes.reduce((t, l) => t + (l[k] ?? 0), 0);
  const nonSync = lignes.filter((l) => !l.paieSynchronisee).length;
  const q = sansAccents(recherche.trim());
  const evenements = lignes
    .flatMap((l) => l.evenements.map((ev: any) => ({ ...ev, nom: l.nom })))
    .filter((ev) => (filtreType === "tous" || ev.type === filtreType) && (!q || sansAccents(`${ev.nom} ${ev.motif ?? ""}`).includes(q)))
    .sort((a, b) => a.dateDebut.localeCompare(b.dateDebut));
  const lignesFiltrees = lignes.filter((l) => !q || sansAccents(`${l.nom} ${l.fonction ?? ""}`).includes(q));

  return (
    <div className="space-y-4">
      <PageEnTete
        titre="Planning des absences"
        description="Congés, maladies et absences par employé. Chaque saisie recale la paie du mois : jours travaillés et absences non payées (mois clôturés exclus)."
        statut={<StatutMois cloture={vue === undefined ? undefined : cloture} />}
        actions={
          <>
            {nonSync > 0 && !cloture ? <Flag variant="a-renseigner" size="sm">{nonSync} saisie(s) de paie à recaler</Flag> : null}
            <BoutonAction
              variant="outline"
              size="sm"
              disabled={!lignes.length || cloture}
              onAction={() => synchroniser({ periode })}
              succes={(r: any) => `Paie recalée pour ${r.employes} employé(s) — ${libellePeriode(periode)}`}
            >
              <RefreshCwIcon /> Synchroniser la paie du mois
            </BoutonAction>
            {!cloture && !persistant ? <Button size="sm" onClick={() => setEdition({ absenceId: null, employeId: "", type: "conge_paye", dateDebut: "", dateFin: "", paye: true, motif: "" })}><PlusIcon /> Ajouter une absence</Button> : null}
            {!cloture ? <BoutonPersistance actif={persistant} onChange={setPersistant} /> : null}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-filet bg-surface px-3 py-2 shadow-xs print:hidden">
        <SelecteurPeriode valeur={periode} onChange={setPeriode} />
        <span className="text-sm font-semibold">{libellePeriode(periode)}</span>
        <span className="text-xs text-encre-pale">acquisition {vue ? fmtJours(vue.congesParMois) : "…"} / mois de service</span>
        <span className="flex-1" />
        <SelecteurLignes valeur={onglet === "absences" ? lignesAbs.lignes : lignesSoldes.lignes} onChange={onglet === "absences" ? lignesAbs.setLignes : lignesSoldes.setLignes} />
        <div className="relative w-52">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-encre-pale" aria-hidden="true" />
          <Input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Employé, motif…" aria-label="Rechercher" className="h-8 pl-8" />
        </div>
        <Tabs value={onglet} onValueChange={(v) => setOnglet(v as "absences" | "soldes")}>
          <TabsList>
            <TabsTrigger value="absences">Absences du mois</TabsTrigger>
            <TabsTrigger value="soldes">Soldes & jours travaillés</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <GrilleTuiles>
        <Tuile libelle="Absences non payées" valeur={vue ? fmtJours(tot("absencesNonPayees")) : undefined} note="déduites des jours travaillés" />
        <Tuile libelle="Absences payées & maladie" valeur={vue ? fmtJours(tot("absencesPayees")) : undefined} note="rémunérées, jours travaillés intacts" />
        <Tuile libelle="Congés pris ce mois" valeur={vue ? fmtJours(tot("congesPrisMois")) : undefined} note="indemnité de congés = journalier × jours" />
        <Tuile libelle="Employés absents" valeur={vue ? lignes.filter((l) => l.evenements.length).length : undefined} note={vue ? `sur ${lignes.length} actifs` : undefined} vedette />
      </GrilleTuiles>

      {onglet === "absences" ? (
        <div className="space-y-2.5">
          <div role="tablist" aria-label="Type d'absence" className="flex flex-wrap items-center gap-1">
            {([["tous", "Toutes"], ...TYPES.map((t) => [t.cle, t.label])] as [TypeAbs | "tous", string][]).map(([k, l]) => {
              const actif = filtreType === k;
              const n = k === "tous" ? lignes.reduce((s, x) => s + x.evenements.length, 0) : lignes.reduce((s, x) => s + x.evenements.filter((e: any) => e.type === k).length, 0);
              return (
                <button key={k} role="tab" aria-selected={actif} onClick={() => setFiltreType(k)}
                  className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors", actif ? "border-ocean-profond bg-ocean-profond text-white" : "border-filet bg-surface text-encre-douce hover:text-encre")}>
                  {l}<span className={cn("font-mono text-[10px] tabular-nums", actif ? "text-white/80" : "text-encre-pale")}>{n}</span>
                </button>
              );
            })}
          </div>
          {vue === undefined ? (
            <SqueletteTableau colonnes={7} lignes={6} />
          ) : (
            <Table classNameConteneur="rounded-xl" hauteurMax={lignesAbs.hauteurMax(49, 40, 44)}>
              <TableHeader>
                <TableRow>
                  <TableHead>Employé</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Du → au (inclus)</TableHead>
                  <TableHead numerique>Jours</TableHead>
                  <TableHead>Rémunérée</TableHead>
                  <TableHead>Motif</TableHead>
                  <TableHead aria-label="Actions" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {persistant && !cloture && (
                  <LigneSaisie
                    employes={employes}
                    periode={periode}
                    onEnregistrer={async (a) => {
                      const r = await ajouter({ employeId: a.employeId as any, type: a.type, dateDebut: a.dateDebut, dateFin: a.dateFin, paye: a.paye, motif: a.motif || undefined });
                      const nom = employes.find((e) => e.employeId === a.employeId)?.nom ?? "";
                      toast.success(`${TYPE[a.type].label} enregistrée — ${nom}`, { description: `${fmtJours(r.jours)} · ${recale(r.periodes)}` });
                    }}
                  />
                )}
                {evenements.map((ev) => (
                  <TableRow key={String(ev._id)} className={cn(!cloture && "cursor-pointer")} onClick={() => !cloture && setEdition({ absenceId: String(ev._id), employeId: String(ev.employeId), type: ev.type, dateDebut: ev.dateDebut, dateFin: ev.dateFin, paye: ev.paye, motif: ev.motif ?? "" })}>
                    <TableCell className="whitespace-nowrap text-[13px] font-semibold">{ev.nom}</TableCell>
                    <TableCell><Flag variant={TYPE[ev.type as TypeAbs].variant} size="xs" title={TYPE[ev.type as TypeAbs].aide}>{TYPE[ev.type as TypeAbs].label}</Flag></TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-xs tabular-nums">{fmtDate(ev.dateDebut)} → {fmtDate(ev.dateFin)}</TableCell>
                    <TableCell numerique className="font-mono text-xs font-semibold">{ev.jours}</TableCell>
                    <TableCell>{ev.paye ? <Flag variant="renseigne" size="xs">Oui</Flag> : <Flag variant="verrou" size="xs" title="Déduite des jours travaillés">Non — déduite</Flag>}</TableCell>
                    <TableCell className="max-w-[16rem] truncate text-xs text-encre-douce" title={ev.motif}>{ev.motif || <span className="text-encre-pale">—</span>}</TableCell>
                    <TableCell className="whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      {!cloture && (
                        <div className="flex items-center justify-end gap-0.5">
                          <Button variant="ghost" size="icon-sm" aria-label={`Modifier — ${ev.nom}`} onClick={() => setEdition({ absenceId: String(ev._id), employeId: String(ev.employeId), type: ev.type, dateDebut: ev.dateDebut, dateFin: ev.dateFin, paye: ev.paye, motif: ev.motif ?? "" })}><PencilIcon /></Button>
                          <BoutonConfirmation
                            variant="ghost" size="icon-sm" className="text-encre-pale hover:bg-carmin-clair hover:text-carmin"
                            libelle={<Trash2Icon className="h-3.5 w-3.5" />}
                            titre={`Supprimer cette absence ?`}
                            consequence={`${TYPE[ev.type as TypeAbs].label} de ${ev.nom} du ${fmtDate(ev.dateDebut)} au ${fmtDate(ev.dateFin)} (${fmtJours(ev.jours)}). La paie des mois ouverts concernés sera recalée.`}
                            confirmer="Supprimer"
                            onConfirmer={() => supprimer({ absenceId: ev._id })}
                            succes={(r: any) => `Absence supprimée — ${recale(r.periodes)}`}
                          />
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {evenements.length === 0 && (
                  <TableVide colonnes={7}>{q || filtreType !== "tous" ? "Aucune absence ne correspond aux filtres." : `Aucune absence enregistrée sur ${libellePeriode(periode)}.`}</TableVide>
                )}
              </TableBody>
              {evenements.length > 0 && (
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={3}>TOTAL · {evenements.length} absence(s)</TableCell>
                    <TableCell numerique className="font-mono text-xs">{evenements.reduce((s, e) => s + e.jours, 0)}</TableCell>
                    <TableCell colSpan={3} />
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          )}
        </div>
      ) : vue === undefined ? (
        <SqueletteTableau colonnes={9} lignes={6} />
      ) : (
        <Table classNameConteneur="rounded-xl" hauteurMax={lignesSoldes.hauteurMax(49, 84, 0)}>
          <TableHeader>
            <TableRow>
              <TableHead rowSpan={2} className="align-bottom">Employé</TableHead>
              <TableHead colSpan={3} className="border-l border-white/15 text-center">Ce mois (jours)</TableHead>
              <TableHead colSpan={3} className="border-l border-white/15 text-center">Congés (cumul)</TableHead>
              <TableHead rowSpan={2} numerique className="border-l border-white/15 bg-ocean-nuit align-bottom">Jours travaillés</TableHead>
              <TableHead rowSpan={2} className="border-l border-white/15 align-bottom">Saisie de paie</TableHead>
            </TableRow>
            <TableRow>
              <TableHead numerique className="border-l border-white/15 text-2xs">Non payées</TableHead>
              <TableHead numerique className="text-2xs">Payées</TableHead>
              <TableHead numerique className="text-2xs">Congés pris</TableHead>
              <TableHead numerique className="border-l border-white/15 text-2xs">Acquis</TableHead>
              <TableHead numerique className="text-2xs">Pris</TableHead>
              <TableHead numerique className="text-2xs">Solde</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lignesFiltrees.map((l) => (
              <TableRow key={String(l.employeId)}>
                <TableCell className="leading-tight">
                  <div className="whitespace-nowrap text-[13px] font-semibold">{l.nom}</div>
                  <div className="whitespace-nowrap text-2xs text-encre-pale">{l.societe}{l.dateDebut ? ` · depuis le ${fmtDate(l.dateDebut)}` : " · date d'entrée non renseignée"}</div>
                </TableCell>
                <TableCell numerique className="font-mono text-xs"><J v={l.absencesNonPayees} negatif /></TableCell>
                <TableCell numerique className="font-mono text-xs"><J v={l.absencesPayees} /></TableCell>
                <TableCell numerique className="font-mono text-xs"><J v={l.congesPrisMois} /></TableCell>
                <TableCell numerique className="font-mono text-xs"><J v={l.congesAcquisCumul} /></TableCell>
                <TableCell numerique className="font-mono text-xs"><J v={l.congesPrisCumul} /></TableCell>
                <TableCell numerique className={cn("font-mono text-xs font-semibold", l.soldeConges < 0 && "text-carmin")}>{Number(l.soldeConges).toLocaleString("fr-FR")}</TableCell>
                <TableCell numerique className="bg-ocean-brume font-mono text-xs font-semibold">{l.joursTravailles} <span className="font-normal text-encre-pale">/ {l.joursBase}</span></TableCell>
                <TableCell>
                  {l.paie ? (
                    l.paieSynchronisee
                      ? <Flag variant="renseigne" size="xs">{l.paie.joursTravailles} j · {l.paie.absencesJours} abs · à jour</Flag>
                      : <Flag variant="a-renseigner" size="xs" title="La saisie de paie ne reflète pas le planning">{l.paie.joursTravailles} j · {l.paie.absencesJours} abs · à recaler</Flag>
                  ) : (
                    <span className="text-2xs text-encre-pale">{l.paieSynchronisee ? "défauts (à jour)" : "aucune saisie — à recaler"}</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {lignesFiltrees.length === 0 && <TableVide colonnes={9}>{q ? "Aucun employé ne correspond à la recherche." : "Aucun employé actif."}</TableVide>}
          </TableBody>
        </Table>
      )}

      {/* Dialogue : ajout (mode bouton) ou modification d'une absence */}
      <Dialog open={edition !== null} onOpenChange={(o) => { if (!o) setEdition(null); }}>
        <DialogContent className="sm:max-w-lg">
          {edition && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!edition.employeId) { toast.error("Choisissez l'employé."); return; }
                if (!edition.dateDebut || !edition.dateFin) { toast.error("Les deux dates sont requises."); return; }
                try {
                  const r = edition.absenceId
                    ? await modifier({ absenceId: edition.absenceId as any, type: edition.type, dateDebut: edition.dateDebut, dateFin: edition.dateFin, paye: edition.paye, motif: edition.motif })
                    : await ajouter({ employeId: edition.employeId as any, type: edition.type, dateDebut: edition.dateDebut, dateFin: edition.dateFin, paye: edition.paye, motif: edition.motif || undefined });
                  toast.success(edition.absenceId ? "Absence mise à jour" : "Absence enregistrée", { description: recale(r.periodes) });
                  setEdition(null);
                } catch (err) { toast.error("Enregistrement refusé", { description: messageErreur(err) }); }
              }}
            >
              <DialogHeader>
                <DialogTitle>{edition.absenceId ? "Modifier l'absence" : "Nouvelle absence"}</DialogTitle>
                <DialogDescription>{TYPE[edition.type].label} : {TYPE[edition.type].aide}. La paie des mois ouverts concernés est recalée à l'enregistrement.</DialogDescription>
              </DialogHeader>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Champ libelle="Employé" requis>
                  {(a) => (
                    <Select value={edition.employeId} onValueChange={(v) => setEdition({ ...edition, employeId: v })} disabled={!!edition.absenceId}>
                      <SelectTrigger id={a.id} className="w-full" aria-label="Employé"><SelectValue placeholder="Choisir…" /></SelectTrigger>
                      <SelectContent>{employes.map((e) => <SelectItem key={e.employeId} value={e.employeId}>{e.nom}</SelectItem>)}</SelectContent>
                    </Select>
                  )}
                </Champ>
                <Champ libelle="Type" requis>
                  {(a) => (
                    <Select value={edition.type} onValueChange={(v) => setEdition({ ...edition, type: v as TypeAbs, paye: TYPE[v as TypeAbs].payeParDefaut })}>
                      <SelectTrigger id={a.id} className="w-full" aria-label="Type"><SelectValue /></SelectTrigger>
                      <SelectContent>{TYPES.map((t) => <SelectItem key={t.cle} value={t.cle}>{t.label}</SelectItem>)}</SelectContent>
                    </Select>
                  )}
                </Champ>
                <Champ libelle="Du" requis>{(a) => <Input {...a} type="date" required value={edition.dateDebut} onChange={(e) => setEdition({ ...edition, dateDebut: e.target.value })} />}</Champ>
                <Champ libelle="Au (inclus)" requis>{(a) => <Input {...a} type="date" required value={edition.dateFin} onChange={(e) => setEdition({ ...edition, dateFin: e.target.value })} />}</Champ>
                <Champ libelle="Rémunérée" aide="Non = déduite des jours travaillés du mois">
                  {(a) => (
                    <Select value={edition.paye ? "1" : "0"} onValueChange={(v) => setEdition({ ...edition, paye: v === "1" })}>
                      <SelectTrigger id={a.id} className="w-full" aria-label="Rémunérée"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="1">Oui</SelectItem><SelectItem value="0">Non — déduite</SelectItem></SelectContent>
                    </Select>
                  )}
                </Champ>
                <Champ libelle="Motif">{(a) => <Input {...a} value={edition.motif} onChange={(e) => setEdition({ ...edition, motif: e.target.value })} placeholder="optionnel" />}</Champ>
              </div>
              <DialogFooter className="mt-5">
                <Button type="button" variant="outline" onClick={() => setEdition(null)}>Annuler</Button>
                <Button type="submit">{edition.absenceId ? "Mettre à jour" : "Enregistrer l'absence"}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- Ligne de saisie permanente (skill §7) ---------------------------------------

const CS = "bg-ocean-brume/40 align-middle";

function LigneSaisie({
  employes, periode, onEnregistrer,
}: {
  employes: { employeId: string; nom: string }[];
  periode: string;
  onEnregistrer: (a: Omit<Saisie, "absenceId">) => Promise<void>;
}) {
  const vierge = React.useCallback((): Omit<Saisie, "absenceId"> => ({ employeId: "", type: "conge_paye", dateDebut: "", dateFin: "", paye: true, motif: "" }), []);
  const [a, setA] = React.useState(vierge);
  const [enCours, setEnCours] = React.useState(false);
  const premier = React.useRef<HTMLButtonElement>(null);
  const jours = a.dateDebut && a.dateFin && a.dateFin >= a.dateDebut ? Math.round((new Date(a.dateFin).getTime() - new Date(a.dateDebut).getTime()) / 86400e3) + 1 : 0;

  const vider = () => { setA(vierge()); premier.current?.focus(); };
  const valider = async () => {
    if (!a.employeId) { toast.error("Choisissez l'employé."); premier.current?.focus(); return; }
    if (!a.dateDebut || !a.dateFin) { toast.error("Les deux dates sont requises."); return; }
    if (a.dateFin < a.dateDebut) { toast.error("La date de fin précède la date de début."); return; }
    setEnCours(true);
    try {
      await onEnregistrer({ ...a, motif: a.motif.trim() });
      // L'employé et le type restent : on saisit souvent plusieurs périodes pour la même personne.
      setA({ ...vierge(), employeId: a.employeId, type: a.type, paye: a.paye });
      premier.current?.focus();
    } catch (e) { toast.error("Absence non enregistrée", { description: messageErreur(e) }); }
    finally { setEnCours(false); }
  };
  const k = (e: React.KeyboardEvent) => { if (e.key === "Enter") { e.preventDefault(); void valider(); } if (e.key === "Escape") { e.preventDefault(); vider(); } };
  // Le mois affiché borne le calendrier par défaut (on peut en sortir : une absence à cheval est ventilée).
  const min = `${periode}-01`;

  return (
    <TableRow className={CS} aria-label="Nouvelle absence">
      <TableCell className={CS}>
        <Select value={a.employeId} onValueChange={(v) => setA({ ...a, employeId: v })}>
          <SelectTrigger ref={premier} size="sm" className="h-8 w-44 text-xs" aria-label="Employé (nouvelle absence)"><SelectValue placeholder="Employé…" /></SelectTrigger>
          <SelectContent>{employes.map((e) => <SelectItem key={e.employeId} value={e.employeId}>{e.nom}</SelectItem>)}</SelectContent>
        </Select>
      </TableCell>
      <TableCell className={CS}>
        <Select value={a.type} onValueChange={(v) => setA({ ...a, type: v as TypeAbs, paye: TYPE[v as TypeAbs].payeParDefaut })}>
          <SelectTrigger size="sm" className="h-8 w-40 text-xs" aria-label="Type (nouvelle absence)"><SelectValue /></SelectTrigger>
          <SelectContent>{TYPES.map((t) => <SelectItem key={t.cle} value={t.cle}>{t.label}</SelectItem>)}</SelectContent>
        </Select>
      </TableCell>
      <TableCell className={CS}>
        <div className="flex items-center gap-1">
          <Input type="date" value={a.dateDebut} min={min} onChange={(e) => setA({ ...a, dateDebut: e.target.value, dateFin: a.dateFin && a.dateFin < e.target.value ? e.target.value : a.dateFin })} onKeyDown={k} aria-label="Du (nouvelle absence)" className="h-8 w-[7.6rem] px-1.5 text-2xs" />
          <span className="text-encre-pale">→</span>
          <Input type="date" value={a.dateFin} min={a.dateDebut || min} onChange={(e) => setA({ ...a, dateFin: e.target.value })} onKeyDown={k} aria-label="Au inclus (nouvelle absence)" className="h-8 w-[7.6rem] px-1.5 text-2xs" />
        </div>
      </TableCell>
      <TableCell numerique className={cn(CS, "font-mono text-xs font-semibold")}>{jours || <span className="text-encre-pale">0</span>}</TableCell>
      <TableCell className={CS}>
        <Select value={a.paye ? "1" : "0"} onValueChange={(v) => setA({ ...a, paye: v === "1" })}>
          <SelectTrigger size="sm" className="h-8 w-28 text-xs" aria-label="Rémunérée (nouvelle absence)"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="1">Oui</SelectItem><SelectItem value="0">Non — déduite</SelectItem></SelectContent>
        </Select>
      </TableCell>
      <TableCell className={CS}>
        <Input value={a.motif} onChange={(e) => setA({ ...a, motif: e.target.value })} onKeyDown={k} placeholder="Motif (optionnel)" aria-label="Motif (nouvelle absence)" className="h-8 min-w-[8rem] text-xs" />
      </TableCell>
      <TableCell className={cn(CS, "text-right")}>
        <Button size="icon-sm" onClick={() => void valider()} disabled={enCours} aria-label="Ajouter l'absence" title="Ajouter (Entrée) · vider (Échap)"><PlusIcon /></Button>
      </TableCell>
    </TableRow>
  );
}

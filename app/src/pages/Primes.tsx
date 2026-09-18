/**
 * Primes & retenues (paie) — refonte (charte poitiers-ui-ux-system).
 *
 * Le registre des lignes libres du mois qui entrent dans le bulletin des
 * salariés : une PRIME s'ajoute au brut (soumise aux cotisations), une RETENUE
 * se déduit du net. Rien à voir avec les primes des médecins (« Caisse & primes
 * médecins »), qui ne passent pas par la paie.
 *
 * Saisie en série (skill §7) : ligne de saisie permanente en tête du tableau,
 * activée par défaut — employé, type, libellé (avec suggestions), montant,
 * date ; Entrée ajoute, le focus revient sur l'employé. Modification sur la
 * ligne (dialogue), suppression confirmée, mois clôturé en lecture seule.
 */
import * as React from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { PencilIcon, PlusIcon, SearchIcon, Trash2Icon } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { fcfa, libellePeriode, messageErreur, num, periodeCourante } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageEnTete } from "@/components/app/en-tete";
import { GrilleTuiles, Tuile } from "@/components/app/tuile";
import { Montant } from "@/components/app/montant";
import { StatutMois } from "@/components/app/statut";
import { SelecteurPeriode } from "@/components/app/selecteur-periode";
import { BoutonConfirmation } from "@/components/app/bouton-action";
import { CelluleNombre, Champ, ChampNombre } from "@/components/app/champs";
import { SqueletteTableau } from "@/components/app/chargement";
import { BoutonPersistance, useSaisiePersistante } from "@/components/app/saisie-persistante";
import { SelecteurLignes, useLignesVisibles } from "@/components/app/lignes-visibles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Flag } from "@/components/ui/flag";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow, TableVide } from "@/components/ui/table";

// --- Vocabulaire ----------------------------------------------------------------

type TypeLigne = "prime" | "charge";
const TYPE: Record<TypeLigne, { label: string; explication: string; variant: "especes" | "verrou" }> = {
  prime: { label: "Prime", explication: "ajoutée au brut, soumise aux cotisations", variant: "especes" },
  charge: { label: "Retenue", explication: "déduite du net à payer", variant: "verrou" },
};
const SUGGESTIONS: Record<TypeLigne, string[]> = {
  prime: ["Prime de rendement", "Prime d'assiduité", "Prime de caisse", "Prime de responsabilité", "Indemnité de logement", "Indemnité de représentation", "Indemnité de déplacement", "Gratification"],
  charge: ["Retenue sur avance", "Retenue matériel", "Remboursement prêt", "Cotisation syndicale", "Pénalité de retard"],
};

type Ligne = { ligneId: string | null; employeId: string; type: TypeLigne; libelle: string; montant: number; date: string };
const aujourdHui = () => new Date().toISOString().slice(0, 10);
const fmtDate = (s?: string) => (s ? new Date(s + "T00:00:00").toLocaleDateString("fr-FR") : "—");
const sansAccents = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Date par défaut d'une ligne : aujourd'hui si on est dans le mois affiché, sinon le 1er du mois. */
const dateDefaut = (periode: string) => (aujourdHui().startsWith(periode) ? aujourdHui() : `${periode}-01`);

// --- Page -------------------------------------------------------------------------

export function Primes() {
  const [periode, setPeriode] = React.useState(periodeCourante());
  const reg = useQuery(api.primes.liste, { periode });
  const ajouter = useMutation(api.primes.ajouter);
  const modifier = useMutation(api.primes.modifier);
  const supprimer = useMutation(api.primes.supprimer);

  const [persistant, setPersistant] = useSaisiePersistante("primes-retenues", true);
  const lignesVisibles = useLignesVisibles("primes-retenues", 15);
  const [filtreType, setFiltreType] = React.useState<TypeLigne | "tous">("tous");
  const [recherche, setRecherche] = React.useState("");
  const [edition, setEdition] = React.useState<Ligne | null>(null);

  const cloture = reg?.cloture ?? false;
  const employes = (reg?.employesActifs ?? []) as { employeId: string; nom: string }[];
  const q = sansAccents(recherche.trim());
  const lignes = ((reg?.lignes ?? []) as any[]).filter(
    (l) => (filtreType === "tous" || l.type === filtreType) && (!q || sansAccents(`${l.nom} ${l.libelle}`).includes(q))
  );
  const totalVisible = (t: TypeLigne) => lignes.filter((l) => l.type === t).reduce((s, l) => s + l.montant, 0);

  return (
    <div className="space-y-4">
      <PageEnTete
        titre="Primes & retenues (paie)"
        description="Lignes libres du mois intégrées au bulletin des salariés : une prime s'ajoute au brut, une retenue se déduit du net. Les primes fixes, le transport, l'assiduité et le logement se saisissent dans le récapitulatif salaires."
        statut={<StatutMois cloture={reg === undefined ? undefined : cloture} />}
        actions={
          <>
            {!cloture && !persistant ? <Button size="sm" onClick={() => setEdition({ ligneId: null, employeId: "", type: "prime", libelle: "", montant: 0, date: dateDefaut(periode) })}><PlusIcon /> Ajouter une ligne</Button> : null}
            {!cloture ? <BoutonPersistance actif={persistant} onChange={setPersistant} /> : null}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-filet bg-surface px-3 py-2 shadow-xs print:hidden">
        <SelecteurPeriode valeur={periode} onChange={setPeriode} />
        <span className="text-sm font-semibold">{libellePeriode(periode)}</span>
        <span className="hidden h-6 w-px bg-filet sm:block" aria-hidden="true" />
        <div role="tablist" aria-label="Type de ligne" className="flex items-center gap-1 rounded-xl border border-filet bg-slate-100/80 p-1">
          {([["tous", "Toutes"], ["prime", "Primes"], ["charge", "Retenues"]] as [TypeLigne | "tous", string][]).map(([k, l]) => {
            const actif = filtreType === k;
            const n = k === "tous" ? (reg?.lignes.length ?? 0) : (reg?.lignes ?? []).filter((x: any) => x.type === k).length;
            return (
              <button key={k} role="tab" aria-selected={actif} onClick={() => setFiltreType(k)}
                className={cn("inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors", actif ? "bg-ocean-profond text-white shadow-xs" : "text-encre-douce hover:bg-white hover:text-encre")}>
                {l}<span className={cn("font-mono text-[10px] tabular-nums", actif ? "text-white/80" : "text-encre-pale")}>{n}</span>
              </button>
            );
          })}
        </div>
        <span className="flex-1" />
        <SelecteurLignes valeur={lignesVisibles.lignes} onChange={lignesVisibles.setLignes} />
        <div className="relative w-56">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-encre-pale" aria-hidden="true" />
          <Input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Employé, libellé…" aria-label="Rechercher une ligne" className="h-8 pl-8" />
        </div>
      </div>

      <GrilleTuiles>
        <Tuile libelle="Primes du mois" valeur={reg ? <Montant valeur={reg.totaux.primes} zero="0" /> : undefined} note="ajoutées au brut des bulletins" />
        <Tuile libelle="Retenues du mois" valeur={reg ? <Montant valeur={-reg.totaux.charges} signe zero="0" /> : undefined} note="déduites du net à payer" />
        <Tuile libelle="Effet net sur la paie" valeur={reg ? <Montant valeur={reg.totaux.primes - reg.totaux.charges} signe zero="0" gras /> : undefined} note="primes − retenues" vedette />
        <Tuile libelle="Employés concernés" valeur={reg ? reg.totaux.employes : undefined} note={reg ? `sur ${employes.length} actifs` : undefined} />
      </GrilleTuiles>

      <div className="flex flex-col gap-3.5 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          {reg === undefined ? (
            <SqueletteTableau colonnes={6} lignes={6} />
          ) : (
            <Table classNameConteneur="rounded-xl" hauteurMax={lignesVisibles.hauteurMax(49, 40, 44)}>
              <TableHeader>
                <TableRow>
                  <TableHead>Employé</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Libellé sur le bulletin</TableHead>
                  <TableHead numerique>Montant (FCFA)</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead aria-label="Actions" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {persistant && !cloture && (
                  <LigneSaisie
                    employes={employes}
                    typeParDefaut={filtreType === "charge" ? "charge" : "prime"}
                    dateParDefaut={dateDefaut(periode)}
                    onEnregistrer={async (l) => {
                      await ajouter({ employeId: l.employeId as any, periode, libelle: l.libelle, montant: l.montant, type: l.type, date: l.date });
                      const nom = employes.find((e) => String(e.employeId) === l.employeId)?.nom ?? "";
                      toast.success(`${TYPE[l.type].label} « ${l.libelle} » enregistrée`, { description: `${nom} · ${fcfa(l.montant)} — bulletin recalculé` });
                    }}
                  />
                )}
                {lignes.map((l) => (
                  <TableRow key={String(l._id)} className={cn(!cloture && "cursor-pointer")} onClick={() => !cloture && setEdition({ ligneId: String(l._id), employeId: String(l.employeId), type: l.type, libelle: l.libelle, montant: l.montant, date: l.date })}>
                    <TableCell className="whitespace-nowrap text-[13px] font-semibold">{l.nom}</TableCell>
                    <TableCell><Flag variant={TYPE[l.type as TypeLigne].variant} size="xs" title={TYPE[l.type as TypeLigne].explication}>{TYPE[l.type as TypeLigne].label}</Flag></TableCell>
                    <TableCell className="text-xs">{l.libelle}</TableCell>
                    <TableCell numerique className={cn("font-mono text-xs font-semibold", l.type === "charge" && "text-carmin")}>{l.type === "charge" ? "−" : "+"}{num(l.montant)}</TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-xs tabular-nums">{fmtDate(l.date)}</TableCell>
                    <TableCell className="whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      {!cloture && (
                        <div className="flex items-center justify-end gap-0.5">
                          <Button variant="ghost" size="icon-sm" aria-label={`Modifier — ${l.nom}, ${l.libelle}`} onClick={() => setEdition({ ligneId: String(l._id), employeId: String(l.employeId), type: l.type, libelle: l.libelle, montant: l.montant, date: l.date })}><PencilIcon /></Button>
                          <BoutonConfirmation
                            variant="ghost" size="icon-sm" className="text-encre-pale hover:bg-carmin-clair hover:text-carmin"
                            libelle={<Trash2Icon className="h-3.5 w-3.5" />}
                            titre={`Supprimer « ${l.libelle} » ?`}
                            consequence={`${TYPE[l.type as TypeLigne].label} de ${fcfa(l.montant)} pour ${l.nom} : le bulletin de ${libellePeriode(periode)} sera recalculé sans cette ligne.`}
                            confirmer="Supprimer"
                            onConfirmer={() => supprimer({ ligneId: l._id })}
                            succes="Ligne supprimée — bulletin recalculé"
                          />
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {lignes.length === 0 && (
                  <TableVide colonnes={6}>
                    {q || filtreType !== "tous" ? "Aucune ligne ne correspond aux filtres." : cloture ? `Aucune ligne sur ${libellePeriode(periode)} (mois clôturé).` : `Aucune prime ni retenue sur ${libellePeriode(periode)} — saisissez la première ligne ci-dessus.`}
                  </TableVide>
                )}
              </TableBody>
              {lignes.length > 0 && (
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={3}>TOTAL · {lignes.length} ligne(s)</TableCell>
                    <TableCell numerique className="font-mono text-xs">
                      {filtreType === "charge" ? <span className="text-carmin">−{num(totalVisible("charge"))}</span>
                        : filtreType === "prime" ? <>+{num(totalVisible("prime"))}</>
                        : <><span>+{num(totalVisible("prime"))}</span> <span className="text-carmin">−{num(totalVisible("charge"))}</span></>}
                    </TableCell>
                    <TableCell colSpan={2} />
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          )}
        </div>

        <aside className="w-full rounded-xl border border-filet bg-surface lg:w-72 lg:shrink-0">
          <div className="border-b border-filet px-4 py-3">
            <div className="text-sm font-semibold">Effet par employé</div>
            <div className="text-2xs text-encre-pale">ce que le bulletin de {libellePeriode(periode)} reçoit en plus ou en moins</div>
          </div>
          {reg === undefined ? (
            <div className="p-4"><SqueletteTableau colonnes={3} lignes={4} /></div>
          ) : reg.parEmploye.length === 0 ? (
            <p className="p-4 text-xs text-encre-pale">Aucun employé concerné ce mois.</p>
          ) : (
            <table className="w-full text-xs">
              <tbody>
                {reg.parEmploye.map((r: any) => (
                  <tr key={r.employeId} className="border-b border-filet-clair last:border-0">
                    <td className="px-4 py-2 font-semibold">{r.nom}</td>
                    <td className="px-2 py-2 text-right font-mono tabular-nums text-encre-douce whitespace-nowrap">{r.primes ? `+${num(r.primes)}` : ""}{r.primes && r.charges ? " " : ""}{r.charges ? <span className="text-carmin">−{num(r.charges)}</span> : ""}</td>
                    <td className={cn("px-4 py-2 text-right font-mono tabular-nums font-semibold whitespace-nowrap", r.primes - r.charges < 0 && "text-carmin")}>{r.primes - r.charges < 0 ? "−" : "+"}{num(Math.abs(r.primes - r.charges))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </aside>
      </div>

      {/* Dialogue : ajout (mode bouton) ou modification d'une ligne */}
      <Dialog open={edition !== null} onOpenChange={(o) => { if (!o) setEdition(null); }}>
        <DialogContent className="sm:max-w-lg">
          {edition && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!edition.employeId) { toast.error("Choisissez l'employé."); return; }
                if (!edition.libelle.trim()) { toast.error("Le libellé est requis : c'est lui qui figure sur le bulletin."); return; }
                if (!(edition.montant > 0)) { toast.error("Le montant doit être supérieur à 0."); return; }
                try {
                  if (edition.ligneId) await modifier({ ligneId: edition.ligneId as any, employeId: edition.employeId as any, libelle: edition.libelle, montant: edition.montant, type: edition.type, date: edition.date });
                  else await ajouter({ employeId: edition.employeId as any, periode, libelle: edition.libelle, montant: edition.montant, type: edition.type, date: edition.date });
                  toast.success(edition.ligneId ? "Ligne mise à jour — bulletin recalculé" : "Ligne ajoutée — bulletin recalculé");
                  setEdition(null);
                } catch (err) { toast.error("Enregistrement refusé", { description: messageErreur(err) }); }
              }}
            >
              <DialogHeader>
                <DialogTitle>{edition.ligneId ? "Modifier la ligne" : "Nouvelle prime ou retenue"}</DialogTitle>
                <DialogDescription>{libellePeriode(periode)} · {TYPE[edition.type].label} : {TYPE[edition.type].explication}.</DialogDescription>
              </DialogHeader>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Champ libelle="Employé" requis>
                  {(a) => (
                    <Select value={edition.employeId} onValueChange={(v) => setEdition({ ...edition, employeId: v })}>
                      <SelectTrigger id={a.id} className="w-full" aria-label="Employé"><SelectValue placeholder="Choisir…" /></SelectTrigger>
                      <SelectContent>{employes.map((e) => <SelectItem key={String(e.employeId)} value={String(e.employeId)}>{e.nom}</SelectItem>)}</SelectContent>
                    </Select>
                  )}
                </Champ>
                <Champ libelle="Type" requis>
                  {(a) => (
                    <Select value={edition.type} onValueChange={(v) => setEdition({ ...edition, type: v as TypeLigne })}>
                      <SelectTrigger id={a.id} className="w-full" aria-label="Type"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="prime">Prime — ajoutée au brut</SelectItem>
                        <SelectItem value="charge">Retenue — déduite du net</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </Champ>
                <div className="col-span-2">
                  <Champ libelle="Libellé (sur le bulletin)" requis aide="Suggestions en tapant ; texte libre accepté.">
                    {(a) => <><Input {...a} list="sugg-edition" required value={edition.libelle} onChange={(e) => setEdition({ ...edition, libelle: e.target.value })} placeholder={SUGGESTIONS[edition.type][0]} /><datalist id="sugg-edition">{SUGGESTIONS[edition.type].map((s) => <option key={s} value={s} />)}</datalist></>}
                  </Champ>
                </div>
                <ChampNombre libelle="Montant" unite="FCFA" requis min={0} step={1000} valeur={edition.montant} onChange={(n) => setEdition({ ...edition, montant: n })} />
                <Champ libelle="Date" requis>{(a) => <Input {...a} type="date" required value={edition.date} onChange={(e) => setEdition({ ...edition, date: e.target.value })} />}</Champ>
              </div>
              <DialogFooter className="mt-5">
                <Button type="button" variant="outline" onClick={() => setEdition(null)}>Annuler</Button>
                <Button type="submit">{edition.ligneId ? "Mettre à jour" : "Ajouter la ligne"}</Button>
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
  employes, typeParDefaut, dateParDefaut, onEnregistrer,
}: {
  employes: { employeId: string; nom: string }[];
  typeParDefaut: TypeLigne;
  dateParDefaut: string;
  onEnregistrer: (l: Omit<Ligne, "ligneId">) => Promise<void>;
}) {
  const vierge = React.useCallback((): Omit<Ligne, "ligneId"> => ({ employeId: "", type: typeParDefaut, libelle: "", montant: 0, date: dateParDefaut }), [typeParDefaut, dateParDefaut]);
  const [l, setL] = React.useState(vierge);
  const [enCours, setEnCours] = React.useState(false);
  const premier = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => { setL((x) => (x.libelle || x.montant ? x : vierge())); }, [vierge]);

  const vider = () => { setL(vierge()); premier.current?.focus(); };
  const valider = async () => {
    if (!l.employeId) { toast.error("Choisissez l'employé."); premier.current?.focus(); return; }
    if (!l.libelle.trim()) { toast.error("Le libellé est requis : c'est lui qui figure sur le bulletin."); return; }
    if (!(l.montant > 0)) { toast.error("Le montant doit être supérieur à 0."); return; }
    setEnCours(true);
    try {
      await onEnregistrer({ ...l, libelle: l.libelle.trim() });
      // On garde l'employé et le type : la ligne suivante est souvent pour la même personne.
      setL({ ...vierge(), employeId: l.employeId, type: l.type });
      premier.current?.focus();
    } catch (e) { toast.error("Ligne non ajoutée", { description: messageErreur(e) }); }
    finally { setEnCours(false); }
  };
  const k = (e: React.KeyboardEvent) => { if (e.key === "Enter") { e.preventDefault(); void valider(); } if (e.key === "Escape") { e.preventDefault(); vider(); } };

  return (
    <TableRow className={CS} aria-label="Nouvelle prime ou retenue">
      <TableCell className={CS}>
        <Select value={l.employeId} onValueChange={(v) => setL({ ...l, employeId: v })}>
          <SelectTrigger ref={premier} size="sm" className="h-8 w-40 text-xs" aria-label="Employé (nouvelle ligne)"><SelectValue placeholder="Employé…" /></SelectTrigger>
          <SelectContent>{employes.map((e) => <SelectItem key={String(e.employeId)} value={String(e.employeId)}>{e.nom}</SelectItem>)}</SelectContent>
        </Select>
      </TableCell>
      <TableCell className={CS}>
        <Select value={l.type} onValueChange={(v) => setL({ ...l, type: v as TypeLigne, libelle: "" })}>
          <SelectTrigger size="sm" className="h-8 w-24 text-xs" aria-label="Type (nouvelle ligne)"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="prime">Prime</SelectItem>
            <SelectItem value="charge">Retenue</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className={CS}>
        <Input list={`sugg-${l.type}`} value={l.libelle} onChange={(e) => setL({ ...l, libelle: e.target.value })} onKeyDown={k} placeholder={SUGGESTIONS[l.type][0]} aria-label="Libellé (nouvelle ligne)" className="h-8 min-w-[10rem] text-xs" />
        <datalist id={`sugg-${l.type}`}>{SUGGESTIONS[l.type].map((s) => <option key={s} value={s} />)}</datalist>
      </TableCell>
      <TableCell numerique className={CS}>
        <span onKeyDown={k}><CelluleNombre libelle="Montant (nouvelle ligne)" valeur={l.montant} onChange={(n) => setL({ ...l, montant: n })} largeur={92} min={0} pas={1000} /></span>
      </TableCell>
      <TableCell className={CS}>
        <Input type="date" value={l.date} onChange={(e) => setL({ ...l, date: e.target.value })} onKeyDown={k} aria-label="Date (nouvelle ligne)" className="h-8 w-[7.6rem] px-1.5 text-2xs" />
      </TableCell>
      <TableCell className={cn(CS, "text-right")}>
        <Button size="icon-sm" onClick={() => void valider()} disabled={enCours} aria-label="Ajouter la ligne" title="Ajouter (Entrée) · vider (Échap)"><PlusIcon /></Button>
      </TableCell>
    </TableRow>
  );
}

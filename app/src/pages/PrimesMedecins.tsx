/**
 * Primes médecins — rétrocessions par catégorie (montant = actes × montant unitaire).
 *
 * Écran séparé de la Caisse du mois depuis le 09/10/2026 : les deux ne relèvent pas des mêmes personnes
 * (droits `/primes-medecins` et `/caisse`). Le modèle métier ne change pas.
 *
 * Un seul tableau, filtré par catégorie, avec les totaux dans les puces ; saisie en série activée par
 * défaut (n médecins × 6 catégories chaque mois, skill §7).
 */
import * as React from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { DownloadIcon, PencilIcon, PlusIcon, SearchIcon, Trash2Icon, UploadIcon } from "lucide-react";
import { api } from "../../convex/_generated/api";
import {
  CATEGORIES_PRIMES, LIBELLE_CATEGORIE, exportCsvPrimes, montantTotalPrime, parseCsvPrimes, type CategoriePrime,
} from "../../convex/lib/stats";
import { fcfa, libellePeriode, messageErreur, num, periodeCourante } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageEnTete } from "@/components/app/en-tete";
import { GrilleTuiles, Tuile } from "@/components/app/tuile";
import { Montant } from "@/components/app/montant";
import { Barres } from "@/components/app/barres";
import { BoutonConfirmation } from "@/components/app/bouton-action";
import { CelluleNombre, Champ, ChampNombre } from "@/components/app/champs";
import { BoutonPersistance, useSaisiePersistante } from "@/components/app/saisie-persistante";
import { SelecteurLignes, useLignesVisibles } from "@/components/app/lignes-visibles";
import { SqueletteTableau } from "@/components/app/chargement";
import { SelecteurPeriode } from "@/components/app/selecteur-periode";
import { useVerrouSaisie } from "@/components/app/verrou-saisie";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Flag } from "@/components/ui/flag";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow, TableVide } from "@/components/ui/table";

// --- Vocabulaire ----------------------------------------------------------------

const LIBELLE_COURT: Record<CategoriePrime, string> = {
  externes_labo_radio: "Externes", interpretes_scanner: "Interp. scanner", interpretes_irm: "Interp. IRM",
  internes_examens: "Internes", prescripteurs_scanner: "Presc. scanner", prescripteurs_irm: "Presc. IRM",
};

type FormPrime = { primeId: string | null; categorie: CategoriePrime; designation: string; dateDebut: string; dateFin: string; actes: number; montantUnitaire: number; notes: string };
const PRIME_VIDE = (categorie: CategoriePrime): FormPrime => ({ primeId: null, categorie, designation: "", dateDebut: "", dateFin: "", actes: 0, montantUnitaire: 0, notes: "" });

const fmtDate = (s?: string) => (s ? new Date(s + "T00:00:00").toLocaleDateString("fr-FR") : "—");
const sansAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const N = ({ v }: { v: number | undefined }) => (v ? <>{num(v)}</> : <span className="text-encre-pale">0</span>);

function telecharger(nom: string, contenu: string) {
  const url = URL.createObjectURL(new Blob([contenu], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = nom; a.click();
  URL.revokeObjectURL(url);
}

// --- Page -------------------------------------------------------------------------

export function PrimesMedecins() {
  const [periode, setPeriode] = React.useState(periodeCourante());
  const [categorie, setCategorie] = React.useState<CategoriePrime | "toutes">("toutes");
  const [recherche, setRecherche] = React.useState("");
  const lignesVisibles = useLignesVisibles("primes-medecins", 15);
  const [persistant, setPersistant] = useSaisiePersistante("primes-medecins", true);

  const primes = useQuery(api.primesMedecins.liste, { periode });
  const graphe = useQuery(api.primesMedecins.graphe, { periode });
  const enregistrerPrime = useMutation(api.primesMedecins.enregistrer);
  const supprimerPrime = useMutation(api.primesMedecins.supprimer);
  const importerPrimes = useMutation(api.primesMedecins.importer);
  const { verrouillee, Cadenas } = useVerrouSaisie(primes);

  const [form, setForm] = React.useState<FormPrime | null>(null);
  const [importEnCours, setImportEnCours] = React.useState<{ fichier: File; categorie: CategoriePrime } | null>(null);
  const fichierRef = React.useRef<HTMLInputElement>(null);

  const categorieCourante: CategoriePrime = categorie === "toutes" ? CATEGORIES_PRIMES[0][0] : categorie;
  const q = sansAccents(recherche.trim());
  const visibles = ((primes?.lignes ?? []) as any[]).filter(
    (p) => (categorie === "toutes" || p.categorie === categorie) && (!q || sansAccents(`${p.designation} ${p.notes ?? ""}`).includes(q))
  );
  const totalVisible = visibles.reduce((s, p) => s + p.montant, 0);
  const actesVisibles = visibles.reduce((s, p) => s + (p.actes ?? 0), 0);

  const confirmerImport = async () => {
    if (!importEnCours) return;
    const lignes = parseCsvPrimes(await importEnCours.fichier.text());
    if (!lignes.length) { toast.error("Aucune prime reconnue dans ce fichier."); setImportEnCours(null); return; }
    try {
      const r = await importerPrimes({ periode, categorie: importEnCours.categorie, lignes });
      toast.success(`${r.importees} prime(s) importée(s)`, { description: LIBELLE_CATEGORIE[importEnCours.categorie] });
      setImportEnCours(null);
    } catch (e) { toast.error("Import refusé", { description: messageErreur(e) }); }
  };

  return (
    <div className="space-y-4">
      <PageEnTete
        titre="Primes médecins"
        description="Rétrocessions mensuelles par catégorie : chaque ligne vaut actes × montant unitaire. Six catégories (externes, interprètes, internes, prescripteurs)."
        actions={
          <>
            <input ref={fichierRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) setImportEnCours({ fichier: f, categorie: categorieCourante }); e.target.value = ""; }} />
            <Button variant="outline" size="sm" onClick={() => fichierRef.current?.click()}><UploadIcon /> Importer CSV</Button>
            <Button variant="outline" size="sm" disabled={!visibles.length} onClick={() => telecharger(`primes-${categorie}-${periode}.csv`, exportCsvPrimes(visibles.map((l) => ({ ...l, actes: l.actes ?? 0, montantUnitaire: l.montantUnitaire ?? 0 }))))}><DownloadIcon /> Exporter CSV</Button>
            {!persistant && <Button size="sm" onClick={() => setForm(PRIME_VIDE(categorieCourante))}><PlusIcon /> Ajouter une prime</Button>}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-filet bg-surface px-3 py-2 shadow-xs print:hidden">
        <SelecteurPeriode valeur={periode} onChange={setPeriode} />
        <span className="text-sm font-semibold">{libellePeriode(periode)}</span>
        <span className="flex-1" />
        <SelecteurLignes valeur={lignesVisibles.lignes} onChange={lignesVisibles.setLignes} />
        <BoutonPersistance actif={persistant} onChange={setPersistant} />
        <div className="relative w-56">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-encre-pale" aria-hidden="true" />
          <Input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Médecin, note…" aria-label="Rechercher un médecin" className="h-8 pl-8" />
        </div>
      </div>

      <GrilleTuiles>
        <Tuile libelle="Primes du mois" valeur={primes ? <Montant valeur={primes.total} zero="0" /> : undefined} note={primes ? `${primes.lignes.length} ligne(s) · ${CATEGORIES_PRIMES.length} catégories` : undefined} vedette />
        <Tuile libelle="Catégorie affichée" valeur={primes ? <Montant valeur={totalVisible} zero="0" /> : undefined} note={categorie === "toutes" ? "toutes catégories" : LIBELLE_CATEGORIE[categorie]} />
        <Tuile libelle="Actes" valeur={primes ? actesVisibles : undefined} note="sur les lignes affichées" />
        <Tuile libelle="Lignes affichées" valeur={primes ? visibles.length : undefined} note={primes ? `verrou de modification : ${primes.verrouMin} min` : undefined} />
      </GrilleTuiles>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-filet bg-surface px-3 py-2 shadow-xs print:hidden">
        <div role="tablist" aria-label="Catégorie de prime" className="flex max-w-full flex-wrap items-center gap-1 rounded-xl border border-filet bg-slate-100/80 p-1">
          {([["toutes", "Toutes"], ...CATEGORIES_PRIMES.map(([k]) => [k, LIBELLE_COURT[k]])] as [CategoriePrime | "toutes", string][]).map(([k, libelle]) => {
            const actif = categorie === k;
            const montant = k === "toutes" ? primes?.total ?? 0 : primes?.parCategorie?.[k] ?? 0;
            return (
              <button
                key={k}
                role="tab"
                aria-selected={actif}
                title={k === "toutes" ? "Toutes les catégories" : LIBELLE_CATEGORIE[k]}
                onClick={() => setCategorie(k)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors",
                  actif ? "bg-ocean-profond text-white shadow-xs" : "text-encre-douce hover:bg-white hover:text-encre"
                )}
              >
                {libelle}
                <span className={cn("font-mono text-[10px] tabular-nums", actif ? "text-white/80" : montant ? "text-encre-pale" : "text-encre-pale/50")}>{num(montant)}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className={cn("flex flex-col gap-3.5", !persistant && "lg:flex-row lg:items-start")}>
        <div className="min-w-0 flex-1">
          {primes === undefined ? (
            <SqueletteTableau colonnes={7} lignes={5} />
          ) : (
            <Table classNameConteneur="rounded-xl" hauteurMax={lignesVisibles.hauteurMax(49, 40, 44)}>
              <TableHeader>
                <TableRow>
                  <TableHead>Médecin</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Période</TableHead>
                  <TableHead numerique>Actes</TableHead>
                  <TableHead numerique>Unitaire (FCFA)</TableHead>
                  <TableHead numerique className="bg-ocean-nuit">Montant (FCFA)</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead aria-label="Actions" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {persistant && (
                  <LigneSaisiePrime
                    categorie={categorieCourante}
                    onEnregistrer={async (p) => {
                      await enregistrerPrime({ periode, categorie: p.categorie, designation: p.designation, dateDebut: p.dateDebut || undefined, dateFin: p.dateFin || undefined, actes: p.actes, montantUnitaire: p.montantUnitaire, notes: p.notes || undefined });
                      toast.success(`Prime ajoutée — ${p.designation}`, { description: `${fcfa(montantTotalPrime(p.actes, p.montantUnitaire))} · ${LIBELLE_CATEGORIE[p.categorie]}` });
                      if (categorie !== "toutes" && categorie !== p.categorie) setCategorie(p.categorie);
                    }}
                  />
                )}
                {visibles.map((p) => (
                  <TableRow key={String(p._id)} className={verrouillee(p) ? undefined : "cursor-pointer"} onClick={() => !verrouillee(p) && setForm({ primeId: String(p._id), categorie: p.categorie, designation: p.designation, dateDebut: p.dateDebut ?? "", dateFin: p.dateFin ?? "", actes: p.actes ?? 0, montantUnitaire: p.montantUnitaire ?? 0, notes: p.notes ?? "" })}>
                    <TableCell className="whitespace-nowrap text-[13px] font-semibold">{p.designation}</TableCell>
                    <TableCell><Flag variant="neutre" size="xs" title={LIBELLE_CATEGORIE[p.categorie]}>{LIBELLE_COURT[p.categorie as CategoriePrime]}</Flag></TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-xs tabular-nums">{p.dateDebut || p.dateFin ? `${fmtDate(p.dateDebut)} → ${fmtDate(p.dateFin)}` : <span className="text-encre-pale">—</span>}</TableCell>
                    <TableCell numerique className="font-mono text-xs"><N v={p.actes} /></TableCell>
                    <TableCell numerique className="font-mono text-xs"><N v={p.montantUnitaire} /></TableCell>
                    <TableCell numerique className="bg-ocean-brume font-mono text-xs font-semibold"><N v={p.montant} /></TableCell>
                    <TableCell className="max-w-[16rem] truncate text-xs text-encre-douce" title={p.notes}>{p.notes || <span className="text-encre-pale">—</span>}</TableCell>
                    <TableCell className="whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      {verrouillee(p) ? <div className="flex justify-end"><Cadenas ligne={p} /></div> : <div className="flex items-center justify-end gap-0.5">
                        <Button variant="ghost" size="icon-sm" aria-label={`Modifier la prime de ${p.designation}`} onClick={() => setForm({ primeId: String(p._id), categorie: p.categorie, designation: p.designation, dateDebut: p.dateDebut ?? "", dateFin: p.dateFin ?? "", actes: p.actes ?? 0, montantUnitaire: p.montantUnitaire ?? 0, notes: p.notes ?? "" })}><PencilIcon /></Button>
                        <BoutonConfirmation
                          variant="ghost" size="icon-sm" className="text-encre-pale hover:bg-carmin-clair hover:text-carmin"
                          libelle={<Trash2Icon className="h-3.5 w-3.5" />}
                          titre={`Supprimer la prime de ${p.designation} ?`}
                          consequence={`${fcfa(p.montant)} (${LIBELLE_CATEGORIE[p.categorie]}) seront retirés du total de ${libellePeriode(periode)}.`}
                          confirmer="Supprimer"
                          onConfirmer={() => supprimerPrime({ primeId: p._id })}
                          succes="Prime supprimée"
                        />
                      </div>}
                    </TableCell>
                  </TableRow>
                ))}
                {visibles.length === 0 && (
                  <TableVide colonnes={8}>
                    {q ? "Aucun médecin ne correspond à la recherche." : categorie === "toutes" ? `Aucune prime saisie pour ${libellePeriode(periode)}.` : `Aucune prime « ${LIBELLE_CATEGORIE[categorie]} » ce mois — ajoutez-en une ou importez un CSV.`}
                  </TableVide>
                )}
              </TableBody>
              {visibles.length > 0 && (
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={3}>TOTAL · {visibles.length} ligne(s){categorie !== "toutes" ? ` · ${LIBELLE_COURT[categorie]}` : ""}</TableCell>
                    <TableCell numerique className="font-mono text-xs"><N v={actesVisibles} /></TableCell>
                    <TableCell />
                    <TableCell numerique className="bg-ocean-brume font-mono text-xs"><N v={totalVisible} /></TableCell>
                    <TableCell colSpan={2} />
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          )}
        </div>
        <aside className={cn("w-full rounded-xl border border-filet bg-surface p-4", !persistant && "lg:w-[26rem] lg:shrink-0")}>
          {graphe ? (
            <Barres
              titre={`Primes par catégorie — ${libellePeriode(periode)}`}
              donnees={graphe.primesParCategorie.map((c: any) => ({ cle: c.categorie, libelle: LIBELLE_COURT[c.categorie as CategoriePrime] ?? c.libelle, valeur: c.montant }))}
              cleActive={categorie === "toutes" ? undefined : categorie}
              couleur="var(--chart-2)"
              format={num}
            />
          ) : <SqueletteTableau colonnes={1} lignes={4} />}
        </aside>
      </div>

      {/* ------------------------------------------------- Dialogue : prime médecin */}
      <Dialog open={form !== null} onOpenChange={(o) => { if (!o) setForm(null); }}>
        <DialogContent className="sm:max-w-xl">
          {form && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!form.designation.trim()) { toast.error("Le nom du médecin est requis."); return; }
                const { primeId, ...p } = form;
                try {
                  await enregistrerPrime({ primeId: (primeId ?? undefined) as any, periode, categorie: p.categorie, designation: p.designation, dateDebut: p.dateDebut || undefined, dateFin: p.dateFin || undefined, actes: Number(p.actes) || 0, montantUnitaire: Number(p.montantUnitaire) || 0, notes: p.notes || undefined });
                  toast.success(primeId ? "Prime mise à jour" : "Prime ajoutée", { description: `${p.designation} · ${fcfa(montantTotalPrime(p.actes, p.montantUnitaire))} · ${LIBELLE_CATEGORIE[p.categorie]}` });
                  setForm(null);
                  if (categorie !== "toutes" && categorie !== p.categorie) setCategorie(p.categorie);
                } catch (err) { toast.error("Enregistrement refusé", { description: messageErreur(err) }); }
              }}
            >
              <DialogHeader>
                <DialogTitle>{form.primeId ? "Modifier la prime" : "Nouvelle prime médecin"}</DialogTitle>
                <DialogDescription>{libellePeriode(periode)} · montant = actes × montant unitaire.</DialogDescription>
              </DialogHeader>
              <div className="mt-4 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
                <Champ libelle="Médecin" requis>{(a) => <Input {...a} required placeholder="Dr Nom Prénom" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} />}</Champ>
                <Champ libelle="Catégorie" requis>
                  {(a) => (
                    <Select value={form.categorie} onValueChange={(v) => setForm({ ...form, categorie: v as CategoriePrime })}>
                      <SelectTrigger id={a.id} className="w-full" aria-label="Catégorie"><SelectValue /></SelectTrigger>
                      <SelectContent>{CATEGORIES_PRIMES.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                    </Select>
                  )}
                </Champ>
                <Champ libelle="Date début">{(a) => <Input {...a} type="date" value={form.dateDebut} onChange={(e) => setForm({ ...form, dateDebut: e.target.value })} />}</Champ>
                <Champ libelle="Date fin">{(a) => <Input {...a} type="date" value={form.dateFin} onChange={(e) => setForm({ ...form, dateFin: e.target.value })} />}</Champ>
                <ChampNombre libelle="Actes" unite="actes" min={0} step={1} valeur={form.actes} onChange={(n) => setForm({ ...form, actes: n })} />
                <ChampNombre libelle="Montant unitaire" unite="FCFA" min={0} step={1000} valeur={form.montantUnitaire} onChange={(n) => setForm({ ...form, montantUnitaire: n })} />
                <div className="min-[480px]:col-span-2">
                  <Champ libelle="Notes">{(a) => <Input {...a} placeholder="Remarques…" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />}</Champ>
                </div>
                <div className="flex items-baseline justify-between rounded-lg border border-filet bg-papier px-4 py-3 text-xs min-[480px]:col-span-2">
                  <span className="text-encre-douce">Montant total <span className="text-encre-pale">= {num(form.actes)} × {num(form.montantUnitaire)}</span></span>
                  <span className="font-mono text-lg font-semibold tabular-nums text-ocean-profond">{num(montantTotalPrime(form.actes, form.montantUnitaire))} <span className="text-2xs font-normal text-encre-douce">FCFA</span></span>
                </div>
              </div>
              <DialogFooter className="mt-5">
                <Button type="button" variant="outline" onClick={() => setForm(null)}>Annuler</Button>
                <Button type="submit">{form.primeId ? "Mettre à jour" : "Ajouter la prime"}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------- Dialogue : import CSV */}
      <Dialog open={importEnCours !== null} onOpenChange={(o) => { if (!o) setImportEnCours(null); }}>
        <DialogContent className="sm:max-w-md">
          {importEnCours && (
            <>
              <DialogHeader>
                <DialogTitle>Importer des primes</DialogTitle>
                <DialogDescription>Fichier « {importEnCours.fichier.name} » · toutes les lignes iront dans la catégorie choisie, pour {libellePeriode(periode)}.</DialogDescription>
              </DialogHeader>
              <div className="mt-2">
                <Champ libelle="Catégorie" requis>
                  {(a) => (
                    <Select value={importEnCours.categorie} onValueChange={(v) => setImportEnCours({ ...importEnCours, categorie: v as CategoriePrime })}>
                      <SelectTrigger id={a.id} className="w-full" aria-label="Catégorie"><SelectValue /></SelectTrigger>
                      <SelectContent>{CATEGORIES_PRIMES.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                    </Select>
                  )}
                </Champ>
              </div>
              <DialogFooter className="mt-4">
                <Button variant="outline" onClick={() => setImportEnCours(null)}>Annuler</Button>
                <Button onClick={confirmerImport}><UploadIcon /> Importer</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- Ligne de saisie permanente (skill §7) -----------------------------------

const CELLULE_SAISIE = "bg-ocean-brume/40 align-middle";

function LigneSaisiePrime({ categorie, onEnregistrer }: { categorie: CategoriePrime; onEnregistrer: (p: Omit<FormPrime, "primeId">) => Promise<void> }) {
  const vierge = React.useCallback((): Omit<FormPrime, "primeId"> => ({ categorie, designation: "", dateDebut: "", dateFin: "", actes: 0, montantUnitaire: 0, notes: "" }), [categorie]);
  const [p, setP] = React.useState(vierge);
  const [enCours, setEnCours] = React.useState(false);
  const premier = React.useRef<HTMLInputElement>(null);
  // Le filtre de catégorie change → la ligne suit (sans écraser une saisie en cours).
  React.useEffect(() => { setP((x) => (x.designation ? x : { ...x, categorie })); }, [categorie]);
  const vider = () => { setP(vierge()); premier.current?.focus(); };
  const valider = async () => {
    if (!p.designation.trim()) { toast.error("Le nom du médecin est requis."); premier.current?.focus(); return; }
    setEnCours(true);
    try { await onEnregistrer({ ...p, designation: p.designation.trim() }); vider(); }
    catch (e) { toast.error("Prime non ajoutée", { description: messageErreur(e) }); }
    finally { setEnCours(false); }
  };
  /** Entrée valide, Échap vide ; le focus revient au premier champ après l'ajout. */
  const k = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); void valider(); }
    if (e.key === "Escape") { e.preventDefault(); vider(); }
  };
  return (
    <TableRow className={CELLULE_SAISIE} aria-label="Nouvelle prime">
      <TableCell className={CELLULE_SAISIE}>
        <Input ref={premier} value={p.designation} onChange={(e) => setP({ ...p, designation: e.target.value })} onKeyDown={k} placeholder="Dr Nom Prénom" aria-label="Médecin (nouvelle prime)" className="h-8 w-40 text-xs" />
      </TableCell>
      <TableCell className={CELLULE_SAISIE}>
        <Select value={p.categorie} onValueChange={(v) => setP({ ...p, categorie: v as CategoriePrime })}>
          <SelectTrigger size="sm" className="h-8 w-36 text-xs" aria-label="Catégorie (nouvelle prime)"><SelectValue /></SelectTrigger>
          <SelectContent>{CATEGORIES_PRIMES.map(([c, l]) => <SelectItem key={c} value={c}>{l}</SelectItem>)}</SelectContent>
        </Select>
      </TableCell>
      <TableCell className={CELLULE_SAISIE}>
        <div className="flex items-center gap-1">
          <Input type="date" value={p.dateDebut} onChange={(e) => setP({ ...p, dateDebut: e.target.value })} onKeyDown={k} aria-label="Date début (nouvelle prime)" className="h-8 w-[7.6rem] px-1.5 text-2xs" />
          <span className="text-encre-pale">→</span>
          <Input type="date" value={p.dateFin} onChange={(e) => setP({ ...p, dateFin: e.target.value })} onKeyDown={k} aria-label="Date fin (nouvelle prime)" className="h-8 w-[7.6rem] px-1.5 text-2xs" />
        </div>
      </TableCell>
      <TableCell numerique className={CELLULE_SAISIE}><span onKeyDown={k}><CelluleNombre libelle="Actes (nouvelle prime)" valeur={p.actes} onChange={(n) => setP({ ...p, actes: n })} largeur={64} min={0} pas={1} /></span></TableCell>
      <TableCell numerique className={CELLULE_SAISIE}><span onKeyDown={k}><CelluleNombre libelle="Montant unitaire (nouvelle prime)" valeur={p.montantUnitaire} onChange={(n) => setP({ ...p, montantUnitaire: n })} largeur={92} min={0} pas={1000} /></span></TableCell>
      <TableCell numerique className={cn(CELLULE_SAISIE, "font-mono text-xs font-semibold")}><N v={montantTotalPrime(p.actes, p.montantUnitaire)} /></TableCell>
      <TableCell className={CELLULE_SAISIE}>
        <Input value={p.notes} onChange={(e) => setP({ ...p, notes: e.target.value })} onKeyDown={k} placeholder="Notes" aria-label="Notes (nouvelle prime)" className="h-8 w-32 text-xs" />
      </TableCell>
      <TableCell className={cn(CELLULE_SAISIE, "whitespace-nowrap text-right")}>
        <Button size="icon-sm" onClick={() => void valider()} disabled={enCours} aria-label="Ajouter la ligne" title="Ajouter (Entrée) · vider (Échap)"><PlusIcon /></Button>
      </TableCell>
    </TableRow>
  );
}

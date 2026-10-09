/**
 * Caisse du mois — intervalles de recettes (11 postes), total espèces et chiffre d'affaires calculés.
 *
 * Écran séparé des Primes médecins depuis le 09/10/2026 : les deux ne relèvent pas des mêmes personnes
 * (droits `/caisse` et `/primes-medecins`). Le modèle métier ne change pas.
 *
 * Saisie en série (skill §7) : ligne permanente en tête du tableau, au choix ; elle déplie alors les
 * 8 postes espèces, qui sont repliés par défaut pour qu'on lise d'abord les totaux.
 */
import * as React from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Columns3Icon, DownloadIcon, PencilIcon, PlusIcon, Trash2Icon, UploadIcon } from "lucide-react";
import { api } from "../../convex/_generated/api";
import {
  LIBELLES_CAISSE, POSTES_ESPECES, chiffreAffaires, exportCsvCaisse, parseCsvCaisse, totalEspeces, type LigneCaisse,
} from "../../convex/lib/stats";
import { fcfa, libellePeriode, messageErreur, num, periodeCourante } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageEnTete } from "@/components/app/en-tete";
import { useRailLateral } from "@/components/Layout";
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow, TableVide } from "@/components/ui/table";

// --- Vocabulaire ----------------------------------------------------------------

type Poste = (typeof POSTES_ESPECES)[number];
const AUTRES = ["assurance", "tepScan"] as const;
const COLS = [...POSTES_ESPECES, ...AUTRES, "sortiesDuJour"] as const;
type Col = (typeof COLS)[number];

type FormCaisse = LigneCaisse & { ligneId: string | null };
const CAISSE_VIDE = (): FormCaisse => ({
  ligneId: null, dateDebut: "", dateFin: "", horaires: "",
  caissePP: 0, scanner: 0, quantiferon: 0, tenofovir: 0, greenEnergy: 0, esthetique: 0, therapieVie: 0, therapieSommeil: 0,
  assurance: 0, tepScan: 0, sortiesDuJour: 0,
});

const fmtDate = (s?: string) => (s ? new Date(s + "T00:00:00").toLocaleDateString("fr-FR") : "—");
const N = ({ v }: { v: number | undefined }) => (v ? <>{num(v)}</> : <span className="text-encre-pale">0</span>);

function telecharger(nom: string, contenu: string) {
  const url = URL.createObjectURL(new Blob([contenu], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = nom; a.click();
  URL.revokeObjectURL(url);
}

// --- Page -------------------------------------------------------------------------

export function Caisse() {
  const [periode, setPeriode] = React.useState(periodeCourante());
  // Les 8 postes espèces sont repliés par défaut : on lit d'abord les totaux, le détail est à un clic.
  const [detailPostes, setDetailPostes] = React.useState(false);
  const lignesVisibles = useLignesVisibles("caisse", 10);
  const [persistant, setPersistantBrut] = useSaisiePersistante("caisse", false);
  const setPersistant = (v: boolean) => { setPersistantBrut(v); if (v) setDetailPostes(true); };
  React.useEffect(() => { if (persistant) setDetailPostes(true); }, [persistant]);
  // 14 colonnes + une ligne de saisie : la barre latérale se replie en rail, comme sur le récap salaires.
  useRailLateral(persistant && detailPostes);

  const caisse = useQuery(api.caisse.liste, { periode });
  const graphe = useQuery(api.caisse.graphe, { periode });
  const enregistrerLigne = useMutation(api.caisse.enregistrerLigne);
  const supprimerLigne = useMutation(api.caisse.supprimerLigne);
  const importerCaisse = useMutation(api.caisse.importer);
  const { verrouillee, Cadenas } = useVerrouSaisie(caisse);

  const [form, setForm] = React.useState<FormCaisse | null>(null);
  const fichierRef = React.useRef<HTMLInputElement>(null);

  const t = (caisse?.totaux ?? {}) as Record<string, number>;

  const surFichier = async (file: File) => {
    const lignes = parseCsvCaisse(await file.text());
    if (!lignes.length) { toast.error("Aucune ligne de caisse reconnue dans ce fichier."); return; }
    try {
      const r = await importerCaisse({ periode, lignes: lignes.map((x) => ({ ...x, horaires: x.horaires || undefined })) });
      toast.success(`${r.importees} ligne(s) de caisse importée(s)`, { description: libellePeriode(periode) });
    } catch (e) { toast.error("Import refusé", { description: messageErreur(e) }); }
  };

  return (
    <div className="space-y-4">
      <PageEnTete
        titre="Caisse du mois"
        description="Recettes encaissées par intervalle : 8 postes espèces, assurance et TEP scan, sorties du jour. Le total espèces et le chiffre d'affaires se calculent pendant la saisie."
        actions={
          <>
            <input ref={fichierRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void surFichier(f); e.target.value = ""; }} />
            <Button variant="outline" size="sm" onClick={() => fichierRef.current?.click()}><UploadIcon /> Importer CSV</Button>
            <Button variant="outline" size="sm" disabled={!caisse?.lignes.length} onClick={() => telecharger(`caisse-${periode}.csv`, exportCsvCaisse((caisse?.lignes ?? []) as any))}><DownloadIcon /> Exporter CSV</Button>
            {!persistant && <Button size="sm" onClick={() => setForm(CAISSE_VIDE())}><PlusIcon /> Ajouter un intervalle</Button>}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-filet bg-surface px-3 py-2 shadow-xs print:hidden">
        <SelecteurPeriode valeur={periode} onChange={setPeriode} />
        <span className="text-sm font-semibold">{libellePeriode(periode)}</span>
        <span className="flex-1" />
        <SelecteurLignes valeur={lignesVisibles.lignes} onChange={lignesVisibles.setLignes} />
        <BoutonPersistance actif={persistant} onChange={setPersistant} />
        <button
          type="button"
          aria-pressed={detailPostes}
          onClick={() => setDetailPostes((v) => !v)}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-colors",
            detailPostes ? "border-ocean-profond bg-ocean-profond text-white" : "border-filet bg-surface text-encre-douce hover:text-encre"
          )}
        >
          <Columns3Icon className="h-3.5 w-3.5" />
          {detailPostes ? "Masquer les 8 postes espèces" : "Détail des 8 postes espèces"}
        </button>
      </div>

      <GrilleTuiles>
        <Tuile libelle="Chiffre d'affaires" valeur={caisse ? <Montant valeur={t.chiffreAffaires} zero="0" /> : undefined} note="espèces + assurance + TEP scan" vedette />
        <Tuile libelle="Total espèces" valeur={caisse ? <Montant valeur={t.totalEspeces} zero="0" /> : undefined} note={`${POSTES_ESPECES.length} postes encaissés`} />
        <Tuile libelle="Assurance + TEP scan" valeur={caisse ? <Montant valeur={(t.assurance ?? 0) + (t.tepScan ?? 0)} zero="0" /> : undefined} note={caisse ? `sorties du jour : ${num(t.sortiesDuJour ?? 0)}` : undefined} />
        <Tuile libelle="Intervalles saisis" valeur={caisse ? caisse.lignes.length : undefined} note={caisse ? `verrou de modification : ${caisse.verrouMin} min` : undefined} />
      </GrilleTuiles>

      <div className={cn("flex flex-col gap-3.5", !persistant && "lg:flex-row lg:items-start")}>
        <div className="min-w-0 flex-1">
          {caisse === undefined ? (
            <SqueletteTableau colonnes={8} lignes={4} />
          ) : (
            <Table classNameConteneur="rounded-xl" hauteurMax={lignesVisibles.hauteurMax(49, 84, 44)}>
              <TableHeader>
                <TableRow>
                  <TableHead rowSpan={2} className="align-bottom">Intervalle</TableHead>
                  <TableHead rowSpan={2} className="align-bottom">Horaires</TableHead>
                  {detailPostes && <TableHead colSpan={POSTES_ESPECES.length} className="border-l border-white/15 text-center">Espèces — détail des postes</TableHead>}
                  <TableHead rowSpan={2} numerique className="border-l border-white/15 bg-ocean-nuit align-bottom">Total espèces</TableHead>
                  <TableHead colSpan={2} className="border-l border-white/15 text-center">Autres recettes</TableHead>
                  <TableHead rowSpan={2} numerique className="border-l border-white/15 align-bottom">Sorties du jour</TableHead>
                  <TableHead rowSpan={2} numerique className="border-l border-white/15 bg-ocean-nuit align-bottom">Chiffre d'affaires</TableHead>
                  <TableHead rowSpan={2} aria-label="Actions" />
                </TableRow>
                <TableRow>
                  {detailPostes && POSTES_ESPECES.map((k, i) => <TableHead key={k} numerique className={cn("text-2xs", i === 0 && "border-l border-white/15")}>{LIBELLES_CAISSE[k]}</TableHead>)}
                  {AUTRES.map((k, i) => <TableHead key={k} numerique className={cn("text-2xs", i === 0 && "border-l border-white/15")}>{LIBELLES_CAISSE[k]}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {persistant && (
                  <LigneSaisieCaisse
                    detailPostes={detailPostes}
                    onEnregistrer={async (l) => {
                      await enregistrerLigne({ periode, dateDebut: l.dateDebut, dateFin: l.dateFin, horaires: l.horaires || undefined, ...Object.fromEntries(COLS.map((k) => [k, Number(l[k]) || 0])) } as any);
                      toast.success("Intervalle ajouté", { description: `CA ${fcfa(chiffreAffaires(l))} — totaux du mois recalculés` });
                    }}
                  />
                )}
                {(caisse.lignes as any[]).map((l) => (
                  <TableRow key={String(l._id)} className={verrouillee(l) ? undefined : "cursor-pointer"} onClick={() => !verrouillee(l) && setForm({ ...CAISSE_VIDE(), ...l, horaires: l.horaires ?? "", ligneId: String(l._id) })}>
                    <TableCell className="whitespace-nowrap font-mono text-xs tabular-nums">{fmtDate(l.dateDebut)} → {fmtDate(l.dateFin)}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs">{l.horaires || <span className="text-encre-pale">—</span>}</TableCell>
                    {detailPostes && POSTES_ESPECES.map((k) => <TableCell key={k} numerique className="font-mono text-xs"><N v={l[k]} /></TableCell>)}
                    <TableCell numerique className="bg-ocean-brume font-mono text-xs font-semibold"><N v={l.totalEspeces} /></TableCell>
                    {AUTRES.map((k) => <TableCell key={k} numerique className="font-mono text-xs"><N v={l[k]} /></TableCell>)}
                    <TableCell numerique className="font-mono text-xs text-carmin">{l.sortiesDuJour ? `−${num(l.sortiesDuJour)}` : <span className="text-encre-pale">0</span>}</TableCell>
                    <TableCell numerique className="bg-ocean-brume font-mono text-xs font-semibold"><N v={l.chiffreAffaires} /></TableCell>
                    <TableCell className="whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      {verrouillee(l) ? <div className="flex justify-end"><Cadenas ligne={l} /></div> : <div className="flex items-center justify-end gap-0.5">
                        <Button variant="ghost" size="icon-sm" aria-label="Modifier l'intervalle" onClick={() => setForm({ ...CAISSE_VIDE(), ...l, horaires: l.horaires ?? "", ligneId: String(l._id) })}><PencilIcon /></Button>
                        <BoutonConfirmation
                          variant="ghost" size="icon-sm" className="text-encre-pale hover:bg-carmin-clair hover:text-carmin"
                          libelle={<Trash2Icon className="h-3.5 w-3.5" />}
                          titre="Supprimer cet intervalle ?"
                          consequence={`La ligne du ${fmtDate(l.dateDebut)} au ${fmtDate(l.dateFin)} (CA ${fcfa(l.chiffreAffaires)}) sera retirée et les totaux du mois recalculés.`}
                          confirmer="Supprimer"
                          onConfirmer={() => supprimerLigne({ ligneId: l._id })}
                          succes="Intervalle supprimé"
                        />
                      </div>}
                    </TableCell>
                  </TableRow>
                ))}
                {caisse.lignes.length === 0 && <TableVide colonnes={(detailPostes ? POSTES_ESPECES.length : 0) + 8}>Aucun intervalle saisi pour {libellePeriode(periode)}. Ajoutez le premier ou importez un CSV.</TableVide>}
              </TableBody>
              {caisse.lignes.length > 0 && (
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={2}>TOTAL · {caisse.lignes.length} intervalle(s)</TableCell>
                    {detailPostes && POSTES_ESPECES.map((k) => <TableCell key={k} numerique className="font-mono text-xs"><N v={t[k]} /></TableCell>)}
                    <TableCell numerique className="bg-ocean-brume font-mono text-xs"><N v={t.totalEspeces} /></TableCell>
                    {AUTRES.map((k) => <TableCell key={k} numerique className="font-mono text-xs"><N v={t[k]} /></TableCell>)}
                    <TableCell numerique className="font-mono text-xs text-carmin">{t.sortiesDuJour ? `−${num(t.sortiesDuJour)}` : <span className="text-encre-pale">0</span>}</TableCell>
                    <TableCell numerique className="bg-ocean-brume font-mono text-xs"><N v={t.chiffreAffaires} /></TableCell>
                    <TableCell />
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          )}
        </div>
        <aside className={cn("w-full rounded-xl border border-filet bg-surface p-4", !persistant && "lg:w-80 lg:shrink-0")}>
          {graphe ? (
            <Barres
              titre="Chiffre d'affaires — 6 derniers mois"
              donnees={graphe.caParMois.map((m: any) => ({ cle: m.periode, libelle: `${libellePeriode(m.periode).slice(0, 3)} ${m.periode.slice(2, 4)}`, valeur: m.chiffreAffaires }))}
              cleActive={periode}
              format={num}
            />
          ) : <SqueletteTableau colonnes={1} lignes={4} />}
        </aside>
      </div>

      {/* ------------------------------------------------- Dialogue : intervalle de caisse */}
      <Dialog open={form !== null} onOpenChange={(o) => { if (!o) setForm(null); }}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          {form && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const { ligneId, ...l } = form;
                try {
                  await enregistrerLigne({ ligneId: (ligneId ?? undefined) as any, periode, dateDebut: l.dateDebut, dateFin: l.dateFin, horaires: l.horaires || undefined, ...Object.fromEntries(COLS.map((k) => [k, Number(l[k]) || 0])) } as any);
                  toast.success(ligneId ? "Intervalle mis à jour" : "Intervalle ajouté", { description: `CA ${fcfa(chiffreAffaires(l))} — totaux du mois recalculés` });
                  setForm(null);
                } catch (err) { toast.error("Enregistrement refusé", { description: messageErreur(err) }); }
              }}
            >
              <DialogHeader>
                <DialogTitle>{form.ligneId ? "Modifier l'intervalle" : "Nouvel intervalle de caisse"}</DialogTitle>
                <DialogDescription>{libellePeriode(periode)} · total espèces et chiffre d'affaires se calculent pendant la saisie.</DialogDescription>
              </DialogHeader>
              <div className="mt-4 flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Champ libelle="Du" requis>{(a) => <Input {...a} type="date" required value={form.dateDebut} onChange={(e) => setForm({ ...form, dateDebut: e.target.value })} />}</Champ>
                  <Champ libelle="Au" requis>{(a) => <Input {...a} type="date" required value={form.dateFin} onChange={(e) => setForm({ ...form, dateFin: e.target.value })} />}</Champ>
                  <Champ libelle="Horaires">{(a) => <Input {...a} placeholder="8h–18h" value={form.horaires ?? ""} onChange={(e) => setForm({ ...form, horaires: e.target.value })} />}</Champ>
                </div>
                <section>
                  <h3 className="mb-2 text-2xs font-bold uppercase tracking-[0.08em] text-ocean-profond">Espèces</h3>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {POSTES_ESPECES.map((k) => <ChampNombre key={k} libelle={LIBELLES_CAISSE[k]} unite="FCFA" min={0} step={1000} valeur={form[k as Poste]} onChange={(n) => setForm({ ...form, [k]: n })} />)}
                  </div>
                </section>
                <section>
                  <h3 className="mb-2 text-2xs font-bold uppercase tracking-[0.08em] text-ocean-profond">Autres recettes & sorties</h3>
                  <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-3">
                    {(["assurance", "tepScan", "sortiesDuJour"] as Col[]).map((k) => <ChampNombre key={k} libelle={LIBELLES_CAISSE[k]} unite="FCFA" min={0} step={1000} valeur={form[k]} onChange={(n) => setForm({ ...form, [k]: n })} />)}
                  </div>
                </section>
                <div className="grid grid-cols-2 gap-3 rounded-lg border border-filet bg-papier px-4 py-3 text-xs sm:grid-cols-3">
                  <div><span className="block text-encre-pale">Total espèces</span><span className="font-mono text-base font-semibold tabular-nums">{num(totalEspeces(form))}</span></div>
                  <div><span className="block text-encre-pale">Chiffre d'affaires</span><span className="font-mono text-base font-semibold tabular-nums text-ocean-profond">{num(chiffreAffaires(form))} <span className="text-2xs font-normal text-encre-douce">FCFA</span></span></div>
                  <div><span className="block text-encre-pale">Sorties du jour</span><span className="font-mono text-base font-semibold tabular-nums text-carmin">{form.sortiesDuJour ? `−${num(form.sortiesDuJour)}` : "0"}</span></div>
                </div>
              </div>
              <DialogFooter className="mt-5">
                <Button type="button" variant="outline" onClick={() => setForm(null)}>Annuler</Button>
                <Button type="submit">{form.ligneId ? "Mettre à jour" : "Ajouter l'intervalle"}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- Ligne de saisie permanente (skill §7) -----------------------------------

const CELLULE_SAISIE = "bg-ocean-brume/40 align-middle";

function LigneSaisieCaisse({ detailPostes, onEnregistrer }: { detailPostes: boolean; onEnregistrer: (l: LigneCaisse) => Promise<void> }) {
  const vierge = (): LigneCaisse => { const { ligneId: _ignore, ...l } = CAISSE_VIDE(); return l; };
  const [l, setL] = React.useState<LigneCaisse>(vierge);
  const [enCours, setEnCours] = React.useState(false);
  const premier = React.useRef<HTMLInputElement>(null);
  const vider = () => { setL(vierge()); premier.current?.focus(); };
  const valider = async () => {
    if (!l.dateDebut || !l.dateFin) { toast.error("Les deux dates de l'intervalle sont requises."); premier.current?.focus(); return; }
    setEnCours(true);
    try { await onEnregistrer(l); vider(); }
    catch (e) { toast.error("Intervalle non ajouté", { description: messageErreur(e) }); }
    finally { setEnCours(false); }
  };
  /** Entrée valide, Échap vide ; le focus revient au premier champ après l'ajout. */
  const k = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); void valider(); }
    if (e.key === "Escape") { e.preventDefault(); vider(); }
  };
  const cel = (c: Col, largeur = 72) => (
    <TableCell key={c} numerique className={CELLULE_SAISIE}>
      <span onKeyDown={k}><CelluleNombre libelle={`${LIBELLES_CAISSE[c]} (nouvel intervalle)`} valeur={l[c]} onChange={(n) => setL({ ...l, [c]: n })} largeur={largeur} min={0} pas={1000} /></span>
    </TableCell>
  );
  return (
    <TableRow className={CELLULE_SAISIE} aria-label="Nouvel intervalle de caisse">
      <TableCell className={CELLULE_SAISIE}>
        <div className="flex items-center gap-1">
          <Input ref={premier} type="date" value={l.dateDebut} onChange={(e) => setL({ ...l, dateDebut: e.target.value })} onKeyDown={k} aria-label="Du (nouvel intervalle)" className="h-8 w-[7.6rem] px-1.5 text-2xs" />
          <span className="text-encre-pale">→</span>
          <Input type="date" value={l.dateFin} onChange={(e) => setL({ ...l, dateFin: e.target.value })} onKeyDown={k} aria-label="Au (nouvel intervalle)" className="h-8 w-[7.6rem] px-1.5 text-2xs" />
        </div>
      </TableCell>
      <TableCell className={CELLULE_SAISIE}>
        <Input value={l.horaires ?? ""} onChange={(e) => setL({ ...l, horaires: e.target.value })} onKeyDown={k} placeholder="8h–18h" aria-label="Horaires (nouvel intervalle)" className="h-8 w-20 text-xs" />
      </TableCell>
      {detailPostes && POSTES_ESPECES.map((c) => cel(c, 68))}
      <TableCell numerique className={cn(CELLULE_SAISIE, "font-mono text-xs font-semibold")}><N v={totalEspeces(l)} /></TableCell>
      {AUTRES.map((c) => cel(c))}
      {cel("sortiesDuJour")}
      <TableCell numerique className={cn(CELLULE_SAISIE, "font-mono text-xs font-semibold")}><N v={chiffreAffaires(l)} /></TableCell>
      <TableCell className={cn(CELLULE_SAISIE, "whitespace-nowrap text-right")}>
        <Button size="icon-sm" onClick={() => void valider()} disabled={enCours} aria-label="Ajouter la ligne" title="Ajouter (Entrée) · vider (Échap)"><PlusIcon /></Button>
      </TableCell>
    </TableRow>
  );
}

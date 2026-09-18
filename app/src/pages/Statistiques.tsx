/**
 * Statistiques & primes — refonte (charte poitiers-ui-ux-system).
 *
 * Le modèle métier ne change pas : une caisse mensuelle (intervalles × 11 postes,
 * total espèces et chiffre d'affaires calculés) et des primes médecins en six
 * catégories sur le même schéma (actes × montant unitaire).
 *
 * Ce qui change : deux onglets au lieu de huit (Caisse du mois · Primes
 * médecins), un seul tableau de primes filtré par catégorie avec les totaux
 * dans les puces, la saisie en dialogue (plus de formulaire permanent), les
 * graphes à côté des chiffres, la suppression confirmée.
 */
import * as React from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Columns3Icon, DownloadIcon, PencilIcon, PlusIcon, SearchIcon, Trash2Icon, UploadIcon } from "lucide-react";
import { api } from "../../convex/_generated/api";
import {
  CATEGORIES_PRIMES, LIBELLES_CAISSE, LIBELLE_CATEGORIE, POSTES_ESPECES, chiffreAffaires, exportCsvCaisse, exportCsvPrimes,
  montantTotalPrime, parseCsvCaisse, parseCsvPrimes, totalEspeces, type CategoriePrime, type LigneCaisse,
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Flag } from "@/components/ui/flag";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow, TableVide } from "@/components/ui/table";

// --- Vocabulaire ----------------------------------------------------------------

type Poste = (typeof POSTES_ESPECES)[number];
const AUTRES = ["assurance", "tepScan"] as const;
const COLS = [...POSTES_ESPECES, ...AUTRES, "sortiesDuJour"] as const;
type Col = (typeof COLS)[number];

const LIBELLE_COURT: Record<CategoriePrime, string> = {
  externes_labo_radio: "Externes", interpretes_scanner: "Interp. scanner", interpretes_irm: "Interp. IRM",
  internes_examens: "Internes", prescripteurs_scanner: "Presc. scanner", prescripteurs_irm: "Presc. IRM",
};

type FormCaisse = LigneCaisse & { ligneId: string | null };
const CAISSE_VIDE = (): FormCaisse => ({
  ligneId: null, dateDebut: "", dateFin: "", horaires: "",
  caissePP: 0, scanner: 0, quantiferon: 0, tenofovir: 0, greenEnergy: 0, esthetique: 0, therapieVie: 0, therapieSommeil: 0,
  assurance: 0, tepScan: 0, sortiesDuJour: 0,
});
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

export function Statistiques() {
  const [periode, setPeriode] = React.useState(periodeCourante());
  const [onglet, setOnglet] = React.useState<"caisse" | "primes">("caisse");
  const [categorie, setCategorie] = React.useState<CategoriePrime | "toutes">("toutes");
  const [recherche, setRecherche] = React.useState("");
  // Les 8 postes espèces sont repliés par défaut : on lit d'abord les totaux, le détail est à un clic.
  const [detailPostes, setDetailPostes] = React.useState(false);
  const lignesCaisse = useLignesVisibles("statistiques:caisse", 10);
  const lignesPrimes = useLignesVisibles("statistiques:primes", 15);
  // Saisie en série (skill §7) : ligne de saisie permanente en tête du tableau.
  // Primes : activée par défaut (n médecins × 6 catégories chaque mois).
  // Caisse : au choix, et elle affiche les 8 postes puisqu'on les saisit.
  const [persistPrimes, setPersistPrimes] = useSaisiePersistante("statistiques:primes", true);
  const [persistCaisse, setPersistCaisseBrut] = useSaisiePersistante("statistiques:caisse", false);
  const setPersistCaisse = (v: boolean) => { setPersistCaisseBrut(v); if (v) setDetailPostes(true); };
  React.useEffect(() => { if (persistCaisse) setDetailPostes(true); }, [persistCaisse]);
  // 14 colonnes + une ligne de saisie : la barre latérale se replie en rail, comme sur le récap salaires.
  useRailLateral(onglet === "caisse" && persistCaisse && detailPostes);

  const caisse = useQuery(api.stats.caisse, { periode });
  const primes = useQuery(api.stats.primes, { periode });
  const graphes = useQuery(api.stats.graphes, { periode });
  const enregistrerLigne = useMutation(api.stats.enregistrerLigne);
  const supprimerLigne = useMutation(api.stats.supprimerLigne);
  const importerCaisse = useMutation(api.stats.importerCaisse);
  const enregistrerPrime = useMutation(api.stats.enregistrerPrime);
  const supprimerPrime = useMutation(api.stats.supprimerPrime);
  const importerPrimes = useMutation(api.stats.importerPrimes);

  const [formCaisse, setFormCaisse] = React.useState<FormCaisse | null>(null);
  const [formPrime, setFormPrime] = React.useState<FormPrime | null>(null);
  const [importPrimes, setImportPrimes] = React.useState<{ fichier: File; categorie: CategoriePrime } | null>(null);
  const fichierRef = React.useRef<HTMLInputElement>(null);

  const t = (caisse?.totaux ?? {}) as Record<string, number>;
  const categorieCourante: CategoriePrime = categorie === "toutes" ? CATEGORIES_PRIMES[0][0] : categorie;
  const q = sansAccents(recherche.trim());
  const primesVisibles = ((primes?.lignes ?? []) as any[]).filter(
    (p) => (categorie === "toutes" || p.categorie === categorie) && (!q || sansAccents(`${p.designation} ${p.notes ?? ""}`).includes(q))
  );
  const totalVisible = primesVisibles.reduce((s, p) => s + p.montant, 0);
  const actesVisibles = primesVisibles.reduce((s, p) => s + (p.actes ?? 0), 0);

  // --- Import / export CSV (l'onglet courant décide) ---
  const surFichier = async (file: File) => {
    const texte = await file.text();
    if (onglet === "caisse") {
      const lignes = parseCsvCaisse(texte);
      if (!lignes.length) { toast.error("Aucune ligne de caisse reconnue dans ce fichier."); return; }
      try {
        const r = await importerCaisse({ periode, lignes: lignes.map((x) => ({ ...x, horaires: x.horaires || undefined })) });
        toast.success(`${r.importees} ligne(s) de caisse importée(s)`, { description: libellePeriode(periode) });
      } catch (e) { toast.error("Import refusé", { description: messageErreur(e) }); }
    } else {
      setImportPrimes({ fichier: file, categorie: categorieCourante });
    }
  };
  const confirmerImportPrimes = async () => {
    if (!importPrimes) return;
    const lignes = parseCsvPrimes(await importPrimes.fichier.text());
    if (!lignes.length) { toast.error("Aucune prime reconnue dans ce fichier."); setImportPrimes(null); return; }
    try {
      const r = await importerPrimes({ periode, categorie: importPrimes.categorie, lignes });
      toast.success(`${r.importees} prime(s) importée(s)`, { description: LIBELLE_CATEGORIE[importPrimes.categorie] });
      setImportPrimes(null);
    } catch (e) { toast.error("Import refusé", { description: messageErreur(e) }); }
  };
  const exporter = () => {
    if (onglet === "caisse") telecharger(`caisse-${periode}.csv`, exportCsvCaisse((caisse?.lignes ?? []) as any));
    else telecharger(`primes-${categorie}-${periode}.csv`, exportCsvPrimes(primesVisibles.map((l) => ({ ...l, actes: l.actes ?? 0, montantUnitaire: l.montantUnitaire ?? 0 }))));
  };
  const exportVide = onglet === "caisse" ? !(caisse?.lignes.length) : primesVisibles.length === 0;

  return (
    <div className="space-y-4">
      <PageEnTete
        titre="Statistiques & primes"
        description="Caisse mensuelle (total espèces et chiffre d'affaires calculés) et primes des médecins par catégorie (montant = actes × unitaire)."
        statut={<Flag variant="finance" size="xs">Niveau 3+</Flag>}
        actions={
          <>
            <input ref={fichierRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void surFichier(f); e.target.value = ""; }} />
            <Button variant="outline" size="sm" onClick={() => fichierRef.current?.click()}><UploadIcon /> Importer CSV</Button>
            <Button variant="outline" size="sm" onClick={exporter} disabled={exportVide}><DownloadIcon /> Exporter CSV</Button>
            {onglet === "caisse" && !persistCaisse ? (
              <Button size="sm" onClick={() => setFormCaisse(CAISSE_VIDE())}><PlusIcon /> Ajouter un intervalle</Button>
            ) : null}
            {onglet === "primes" && !persistPrimes ? (
              <Button size="sm" onClick={() => setFormPrime(PRIME_VIDE(categorieCourante))}><PlusIcon /> Ajouter une prime</Button>
            ) : null}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-filet bg-surface px-3 py-2 shadow-xs print:hidden">
        <SelecteurPeriode valeur={periode} onChange={setPeriode} />
        <span className="text-sm font-semibold">{libellePeriode(periode)}</span>
        <span className="flex-1" />
        {onglet === "caisse" && <SelecteurLignes valeur={lignesCaisse.lignes} onChange={lignesCaisse.setLignes} />}
        {onglet === "caisse" && <BoutonPersistance actif={persistCaisse} onChange={setPersistCaisse} />}
        {onglet === "caisse" && (
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
        )}
        <Tabs value={onglet} onValueChange={(v) => setOnglet(v as "caisse" | "primes")}>
          <TabsList>
            <TabsTrigger value="caisse">Caisse du mois</TabsTrigger>
            <TabsTrigger value="primes">Primes médecins</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <GrilleTuiles>
        <Tuile libelle="Chiffre d'affaires" valeur={caisse ? <Montant valeur={t.chiffreAffaires} zero="0" /> : undefined} note="espèces + assurance + TEP scan" vedette />
        <Tuile libelle="Total espèces" valeur={caisse ? <Montant valeur={t.totalEspeces} zero="0" /> : undefined} note={`${POSTES_ESPECES.length} postes encaissés`} />
        <Tuile libelle="Assurance + TEP scan" valeur={caisse ? <Montant valeur={(t.assurance ?? 0) + (t.tepScan ?? 0)} zero="0" /> : undefined} note={caisse ? `sorties du jour : ${num(t.sortiesDuJour ?? 0)}` : undefined} />
        <Tuile libelle="Primes médecins" valeur={primes ? <Montant valeur={primes.total} zero="0" /> : undefined} note={primes ? `${primes.lignes.length} ligne(s) · ${CATEGORIES_PRIMES.length} catégories` : undefined} />
      </GrilleTuiles>

      <Tabs value={onglet} onValueChange={(v) => setOnglet(v as "caisse" | "primes")}>
        {/* ------------------------------------------------------------- Caisse */}
        <TabsContent value="caisse" className={cn("flex flex-col gap-3.5", !persistCaisse && "lg:flex-row lg:items-start")}>
          <div className="min-w-0 flex-1">
            {caisse === undefined ? (
              <SqueletteTableau colonnes={8} lignes={4} />
            ) : (
              <Table classNameConteneur="rounded-xl" hauteurMax={lignesCaisse.hauteurMax(49, 84, 44)}>
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
                  {persistCaisse && (
                    <LigneSaisieCaisse
                      detailPostes={detailPostes}
                      onEnregistrer={async (l) => {
                        await enregistrerLigne({ periode, dateDebut: l.dateDebut, dateFin: l.dateFin, horaires: l.horaires || undefined, ...Object.fromEntries(COLS.map((k) => [k, Number(l[k]) || 0])) } as any);
                        toast.success("Intervalle ajouté", { description: `CA ${fcfa(chiffreAffaires(l))} — totaux du mois recalculés` });
                      }}
                    />
                  )}
                  {(caisse.lignes as any[]).map((l) => (
                    <TableRow key={String(l._id)} className="cursor-pointer" onClick={() => setFormCaisse({ ...CAISSE_VIDE(), ...l, horaires: l.horaires ?? "", ligneId: String(l._id) })}>
                      <TableCell className="whitespace-nowrap font-mono text-xs tabular-nums">{fmtDate(l.dateDebut)} → {fmtDate(l.dateFin)}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs">{l.horaires || <span className="text-encre-pale">—</span>}</TableCell>
                      {detailPostes && POSTES_ESPECES.map((k) => <TableCell key={k} numerique className="font-mono text-xs"><N v={l[k]} /></TableCell>)}
                      <TableCell numerique className="bg-ocean-brume font-mono text-xs font-semibold"><N v={l.totalEspeces} /></TableCell>
                      {AUTRES.map((k) => <TableCell key={k} numerique className="font-mono text-xs"><N v={l[k]} /></TableCell>)}
                      <TableCell numerique className="font-mono text-xs text-carmin">{l.sortiesDuJour ? `−${num(l.sortiesDuJour)}` : <span className="text-encre-pale">0</span>}</TableCell>
                      <TableCell numerique className="bg-ocean-brume font-mono text-xs font-semibold"><N v={l.chiffreAffaires} /></TableCell>
                      <TableCell className="whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-0.5">
                          <Button variant="ghost" size="icon-sm" aria-label="Modifier l'intervalle" onClick={() => setFormCaisse({ ...CAISSE_VIDE(), ...l, horaires: l.horaires ?? "", ligneId: String(l._id) })}><PencilIcon /></Button>
                          <BoutonConfirmation
                            variant="ghost" size="icon-sm" className="text-encre-pale hover:bg-carmin-clair hover:text-carmin"
                            libelle={<Trash2Icon className="h-3.5 w-3.5" />}
                            titre="Supprimer cet intervalle ?"
                            consequence={`La ligne du ${fmtDate(l.dateDebut)} au ${fmtDate(l.dateFin)} (CA ${fcfa(l.chiffreAffaires)}) sera retirée et les totaux du mois recalculés.`}
                            confirmer="Supprimer"
                            onConfirmer={() => supprimerLigne({ ligneId: l._id })}
                            succes="Intervalle supprimé"
                          />
                        </div>
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
          <aside className={cn("w-full rounded-xl border border-filet bg-surface p-4", !persistCaisse && "lg:w-80 lg:shrink-0")}>
            {graphes ? (
              <Barres
                titre="Chiffre d'affaires — 6 derniers mois"
                donnees={graphes.caParMois.map((m: any) => ({ cle: m.periode, libelle: `${libellePeriode(m.periode).slice(0, 3)} ${m.periode.slice(2, 4)}`, valeur: m.chiffreAffaires }))}
                cleActive={periode}
                format={num}
              />
            ) : <SqueletteTableau colonnes={1} lignes={4} />}
          </aside>
        </TabsContent>

        {/* ------------------------------------------------------------- Primes */}
        <TabsContent value="primes" className="flex flex-col gap-3.5">
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-filet bg-surface px-3 py-2 shadow-xs print:hidden">
            <div role="tablist" aria-label="Catégorie de prime" className="flex flex-wrap items-center gap-1 rounded-xl border border-filet bg-slate-100/80 p-1">
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
                      "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors",
                      actif ? "bg-ocean-profond text-white shadow-xs" : "text-encre-douce hover:bg-white hover:text-encre"
                    )}
                  >
                    {libelle}
                    <span className={cn("font-mono text-[10px] tabular-nums", actif ? "text-white/80" : montant ? "text-encre-pale" : "text-encre-pale/50")}>{num(montant)}</span>
                  </button>
                );
              })}
            </div>
            <span className="flex-1" />
            <SelecteurLignes valeur={lignesPrimes.lignes} onChange={lignesPrimes.setLignes} />
            <BoutonPersistance actif={persistPrimes} onChange={setPersistPrimes} />
            <div className="relative w-56">
              <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-encre-pale" aria-hidden="true" />
              <Input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Médecin, note…" aria-label="Rechercher un médecin" className="h-8 pl-8" />
            </div>
          </div>

          <div className={cn("flex flex-col gap-3.5", !persistPrimes && "lg:flex-row lg:items-start")}>
            <div className="min-w-0 flex-1">
              {primes === undefined ? (
                <SqueletteTableau colonnes={7} lignes={5} />
              ) : (
                <Table classNameConteneur="rounded-xl" hauteurMax={lignesPrimes.hauteurMax(49, 40, 44)}>
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
                    {persistPrimes && (
                      <LigneSaisiePrime
                        categorie={categorieCourante}
                        onEnregistrer={async (p) => {
                          await enregistrerPrime({ periode, categorie: p.categorie, designation: p.designation, dateDebut: p.dateDebut || undefined, dateFin: p.dateFin || undefined, actes: p.actes, montantUnitaire: p.montantUnitaire, notes: p.notes || undefined });
                          toast.success(`Prime ajoutée — ${p.designation}`, { description: `${fcfa(montantTotalPrime(p.actes, p.montantUnitaire))} · ${LIBELLE_CATEGORIE[p.categorie]}` });
                          if (categorie !== "toutes" && categorie !== p.categorie) setCategorie(p.categorie);
                        }}
                      />
                    )}
                    {primesVisibles.map((p) => (
                      <TableRow key={String(p._id)} className="cursor-pointer" onClick={() => setFormPrime({ primeId: String(p._id), categorie: p.categorie, designation: p.designation, dateDebut: p.dateDebut ?? "", dateFin: p.dateFin ?? "", actes: p.actes ?? 0, montantUnitaire: p.montantUnitaire ?? 0, notes: p.notes ?? "" })}>
                        <TableCell className="whitespace-nowrap text-[13px] font-semibold">{p.designation}</TableCell>
                        <TableCell><Flag variant="neutre" size="xs" title={LIBELLE_CATEGORIE[p.categorie]}>{LIBELLE_COURT[p.categorie as CategoriePrime]}</Flag></TableCell>
                        <TableCell className="whitespace-nowrap font-mono text-xs tabular-nums">{p.dateDebut || p.dateFin ? `${fmtDate(p.dateDebut)} → ${fmtDate(p.dateFin)}` : <span className="text-encre-pale">—</span>}</TableCell>
                        <TableCell numerique className="font-mono text-xs"><N v={p.actes} /></TableCell>
                        <TableCell numerique className="font-mono text-xs"><N v={p.montantUnitaire} /></TableCell>
                        <TableCell numerique className="bg-ocean-brume font-mono text-xs font-semibold"><N v={p.montant} /></TableCell>
                        <TableCell className="max-w-[16rem] truncate text-xs text-encre-douce" title={p.notes}>{p.notes || <span className="text-encre-pale">—</span>}</TableCell>
                        <TableCell className="whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-0.5">
                            <Button variant="ghost" size="icon-sm" aria-label={`Modifier la prime de ${p.designation}`} onClick={() => setFormPrime({ primeId: String(p._id), categorie: p.categorie, designation: p.designation, dateDebut: p.dateDebut ?? "", dateFin: p.dateFin ?? "", actes: p.actes ?? 0, montantUnitaire: p.montantUnitaire ?? 0, notes: p.notes ?? "" })}><PencilIcon /></Button>
                            <BoutonConfirmation
                              variant="ghost" size="icon-sm" className="text-encre-pale hover:bg-carmin-clair hover:text-carmin"
                              libelle={<Trash2Icon className="h-3.5 w-3.5" />}
                              titre={`Supprimer la prime de ${p.designation} ?`}
                              consequence={`${fcfa(p.montant)} (${LIBELLE_CATEGORIE[p.categorie]}) seront retirés du total de ${libellePeriode(periode)}.`}
                              confirmer="Supprimer"
                              onConfirmer={() => supprimerPrime({ primeId: p._id })}
                              succes="Prime supprimée"
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {primesVisibles.length === 0 && (
                      <TableVide colonnes={8}>
                        {q ? "Aucun médecin ne correspond à la recherche." : categorie === "toutes" ? `Aucune prime saisie pour ${libellePeriode(periode)}.` : `Aucune prime « ${LIBELLE_CATEGORIE[categorie]} » ce mois — ajoutez-en une ou importez un CSV.`}
                      </TableVide>
                    )}
                  </TableBody>
                  {primesVisibles.length > 0 && (
                    <TableFooter>
                      <TableRow>
                        <TableCell colSpan={3}>TOTAL · {primesVisibles.length} ligne(s){categorie !== "toutes" ? ` · ${LIBELLE_COURT[categorie]}` : ""}</TableCell>
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
            <aside className={cn("w-full rounded-xl border border-filet bg-surface p-4", !persistPrimes && "lg:w-[26rem] lg:shrink-0")}>
              {graphes ? (
                <Barres
                  titre={`Primes par catégorie — ${libellePeriode(periode)}`}
                  donnees={graphes.primesParCategorie.map((c: any) => ({ cle: c.categorie, libelle: LIBELLE_COURT[c.categorie as CategoriePrime] ?? c.libelle, valeur: c.montant }))}
                  cleActive={categorie === "toutes" ? undefined : categorie}
                  couleur="var(--chart-2)"
                  format={num}
                />
              ) : <SqueletteTableau colonnes={1} lignes={4} />}
            </aside>
          </div>
        </TabsContent>
      </Tabs>

      {/* ------------------------------------------------- Dialogue : intervalle de caisse */}
      <Dialog open={formCaisse !== null} onOpenChange={(o) => { if (!o) setFormCaisse(null); }}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          {formCaisse && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const { ligneId, ...l } = formCaisse;
                try {
                  await enregistrerLigne({ ligneId: (ligneId ?? undefined) as any, periode, dateDebut: l.dateDebut, dateFin: l.dateFin, horaires: l.horaires || undefined, ...Object.fromEntries(COLS.map((k) => [k, Number(l[k]) || 0])) } as any);
                  toast.success(ligneId ? "Intervalle mis à jour" : "Intervalle ajouté", { description: `CA ${fcfa(chiffreAffaires(l))} — totaux du mois recalculés` });
                  setFormCaisse(null);
                } catch (err) { toast.error("Enregistrement refusé", { description: messageErreur(err) }); }
              }}
            >
              <DialogHeader>
                <DialogTitle>{formCaisse.ligneId ? "Modifier l'intervalle" : "Nouvel intervalle de caisse"}</DialogTitle>
                <DialogDescription>{libellePeriode(periode)} · total espèces et chiffre d'affaires se calculent pendant la saisie.</DialogDescription>
              </DialogHeader>
              <div className="mt-4 flex flex-col gap-4">
                <div className="grid grid-cols-3 gap-3">
                  <Champ libelle="Du" requis>{(a) => <Input {...a} type="date" required value={formCaisse.dateDebut} onChange={(e) => setFormCaisse({ ...formCaisse, dateDebut: e.target.value })} />}</Champ>
                  <Champ libelle="Au" requis>{(a) => <Input {...a} type="date" required value={formCaisse.dateFin} onChange={(e) => setFormCaisse({ ...formCaisse, dateFin: e.target.value })} />}</Champ>
                  <Champ libelle="Horaires">{(a) => <Input {...a} placeholder="8h–18h" value={formCaisse.horaires ?? ""} onChange={(e) => setFormCaisse({ ...formCaisse, horaires: e.target.value })} />}</Champ>
                </div>
                <section>
                  <h3 className="mb-2 text-2xs font-bold uppercase tracking-[0.08em] text-ocean-profond">Espèces</h3>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {POSTES_ESPECES.map((k) => <ChampNombre key={k} libelle={LIBELLES_CAISSE[k]} unite="FCFA" min={0} step={1000} valeur={formCaisse[k as Poste]} onChange={(n) => setFormCaisse({ ...formCaisse, [k]: n })} />)}
                  </div>
                </section>
                <section>
                  <h3 className="mb-2 text-2xs font-bold uppercase tracking-[0.08em] text-ocean-profond">Autres recettes & sorties</h3>
                  <div className="grid grid-cols-3 gap-3">
                    {(["assurance", "tepScan", "sortiesDuJour"] as Col[]).map((k) => <ChampNombre key={k} libelle={LIBELLES_CAISSE[k]} unite="FCFA" min={0} step={1000} valeur={formCaisse[k]} onChange={(n) => setFormCaisse({ ...formCaisse, [k]: n })} />)}
                  </div>
                </section>
                <div className="grid grid-cols-2 gap-3 rounded-lg border border-filet bg-papier px-4 py-3 text-xs sm:grid-cols-3">
                  <div><span className="block text-encre-pale">Total espèces</span><span className="font-mono text-base font-semibold tabular-nums">{num(totalEspeces(formCaisse))}</span></div>
                  <div><span className="block text-encre-pale">Chiffre d'affaires</span><span className="font-mono text-base font-semibold tabular-nums text-ocean-profond">{num(chiffreAffaires(formCaisse))} <span className="text-2xs font-normal text-encre-douce">FCFA</span></span></div>
                  <div><span className="block text-encre-pale">Sorties du jour</span><span className="font-mono text-base font-semibold tabular-nums text-carmin">{formCaisse.sortiesDuJour ? `−${num(formCaisse.sortiesDuJour)}` : "0"}</span></div>
                </div>
              </div>
              <DialogFooter className="mt-5">
                <Button type="button" variant="outline" onClick={() => setFormCaisse(null)}>Annuler</Button>
                <Button type="submit">{formCaisse.ligneId ? "Mettre à jour" : "Ajouter l'intervalle"}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------- Dialogue : prime médecin */}
      <Dialog open={formPrime !== null} onOpenChange={(o) => { if (!o) setFormPrime(null); }}>
        <DialogContent className="sm:max-w-xl">
          {formPrime && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!formPrime.designation.trim()) { toast.error("Le nom du médecin est requis."); return; }
                const { primeId, ...p } = formPrime;
                try {
                  await enregistrerPrime({ primeId: (primeId ?? undefined) as any, periode, categorie: p.categorie, designation: p.designation, dateDebut: p.dateDebut || undefined, dateFin: p.dateFin || undefined, actes: Number(p.actes) || 0, montantUnitaire: Number(p.montantUnitaire) || 0, notes: p.notes || undefined });
                  toast.success(primeId ? "Prime mise à jour" : "Prime ajoutée", { description: `${p.designation} · ${fcfa(montantTotalPrime(p.actes, p.montantUnitaire))} · ${LIBELLE_CATEGORIE[p.categorie]}` });
                  setFormPrime(null);
                  if (categorie !== "toutes" && categorie !== p.categorie) setCategorie(p.categorie);
                } catch (err) { toast.error("Enregistrement refusé", { description: messageErreur(err) }); }
              }}
            >
              <DialogHeader>
                <DialogTitle>{formPrime.primeId ? "Modifier la prime" : "Nouvelle prime médecin"}</DialogTitle>
                <DialogDescription>{libellePeriode(periode)} · montant = actes × montant unitaire.</DialogDescription>
              </DialogHeader>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <Champ libelle="Médecin" requis>{(a) => <Input {...a} required placeholder="Dr Nom Prénom" value={formPrime.designation} onChange={(e) => setFormPrime({ ...formPrime, designation: e.target.value })} />}</Champ>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <Champ libelle="Catégorie" requis>
                    {(a) => (
                      <Select value={formPrime.categorie} onValueChange={(v) => setFormPrime({ ...formPrime, categorie: v as CategoriePrime })}>
                        <SelectTrigger id={a.id} className="w-full" aria-label="Catégorie"><SelectValue /></SelectTrigger>
                        <SelectContent>{CATEGORIES_PRIMES.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                      </Select>
                    )}
                  </Champ>
                </div>
                <Champ libelle="Date début">{(a) => <Input {...a} type="date" value={formPrime.dateDebut} onChange={(e) => setFormPrime({ ...formPrime, dateDebut: e.target.value })} />}</Champ>
                <Champ libelle="Date fin">{(a) => <Input {...a} type="date" value={formPrime.dateFin} onChange={(e) => setFormPrime({ ...formPrime, dateFin: e.target.value })} />}</Champ>
                <ChampNombre libelle="Actes" unite="actes" min={0} step={1} valeur={formPrime.actes} onChange={(n) => setFormPrime({ ...formPrime, actes: n })} />
                <ChampNombre libelle="Montant unitaire" unite="FCFA" min={0} step={1000} valeur={formPrime.montantUnitaire} onChange={(n) => setFormPrime({ ...formPrime, montantUnitaire: n })} />
                <div className="col-span-2">
                  <Champ libelle="Notes">{(a) => <Input {...a} placeholder="Remarques…" value={formPrime.notes} onChange={(e) => setFormPrime({ ...formPrime, notes: e.target.value })} />}</Champ>
                </div>
                <div className="col-span-2 flex items-baseline justify-between rounded-lg border border-filet bg-papier px-4 py-3 text-xs">
                  <span className="text-encre-douce">Montant total <span className="text-encre-pale">= {num(formPrime.actes)} × {num(formPrime.montantUnitaire)}</span></span>
                  <span className="font-mono text-lg font-semibold tabular-nums text-ocean-profond">{num(montantTotalPrime(formPrime.actes, formPrime.montantUnitaire))} <span className="text-2xs font-normal text-encre-douce">FCFA</span></span>
                </div>
              </div>
              <DialogFooter className="mt-5">
                <Button type="button" variant="outline" onClick={() => setFormPrime(null)}>Annuler</Button>
                <Button type="submit">{formPrime.primeId ? "Mettre à jour" : "Ajouter la prime"}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------- Dialogue : import CSV de primes */}
      <Dialog open={importPrimes !== null} onOpenChange={(o) => { if (!o) setImportPrimes(null); }}>
        <DialogContent className="sm:max-w-md">
          {importPrimes && (
            <>
              <DialogHeader>
                <DialogTitle>Importer des primes</DialogTitle>
                <DialogDescription>Fichier « {importPrimes.fichier.name} » · toutes les lignes iront dans la catégorie choisie, pour {libellePeriode(periode)}.</DialogDescription>
              </DialogHeader>
              <div className="mt-2">
                <Champ libelle="Catégorie" requis>
                  {(a) => (
                    <Select value={importPrimes.categorie} onValueChange={(v) => setImportPrimes({ ...importPrimes, categorie: v as CategoriePrime })}>
                      <SelectTrigger id={a.id} className="w-full" aria-label="Catégorie"><SelectValue /></SelectTrigger>
                      <SelectContent>{CATEGORIES_PRIMES.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                    </Select>
                  )}
                </Champ>
              </div>
              <DialogFooter className="mt-4">
                <Button variant="outline" onClick={() => setImportPrimes(null)}>Annuler</Button>
                <Button onClick={confirmerImportPrimes}><UploadIcon /> Importer</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- Lignes de saisie permanentes (skill §7) -----------------------------------

const CELLULE_SAISIE = "bg-ocean-brume/40 align-middle";

/** Entrée valide, Échap vide ; le focus revient au premier champ après l'ajout. */
function surClavier(e: React.KeyboardEvent, valider: () => void, vider: () => void) {
  if (e.key === "Enter") { e.preventDefault(); valider(); }
  if (e.key === "Escape") { e.preventDefault(); vider(); }
}

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
  const k = (e: React.KeyboardEvent) => surClavier(e, () => void valider(), vider);
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
  const k = (e: React.KeyboardEvent) => surClavier(e, () => void valider(), vider);
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

/**
 * Audit confidentiel — refonte (charte poitiers-ui-ux-system).
 *
 * Registre de contrôle indépendant, réservé à l'auditeur externe et au DG.
 * Pour chaque CATÉGORIE (primes médecins par famille, masse salariale, prime
 * administrative, heures sup, sanctions, congés), l'auditeur consigne ce qu'il
 * a constaté sur le mois — désignation, période, montant, notes — puis rédige
 * son rapport. La synthèse compare les montants d'un mois à l'autre ; l'onglet
 * « Salaires versés » met en regard ce que la paie a réellement payé.
 *
 * Interaction : à gauche la liste des catégories (total du mois, rapport
 * rédigé ou non) ; à droite, les lignes de la catégorie choisie avec une ligne
 * de saisie permanente (skill §7), puis le rapport du mois. « Toutes » montre
 * l'ensemble des lignes du mois.
 */
import * as React from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { CheckIcon, DownloadIcon, FileTextIcon, PencilIcon, PlusIcon, SearchIcon, ShieldAlertIcon, Trash2Icon, UploadIcon } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { CATEGORIES_AUDIT, LIBELLE_AUDIT, exportCsvAudit, parseCsvAudit, type CategorieAudit } from "../../convex/lib/audit";
import { fcfa, libellePeriode, messageErreur, num, pct as fmtPct, periodeCourante } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageEnTete } from "@/components/app/en-tete";
import { GrilleTuiles, Tuile } from "@/components/app/tuile";
import { Montant } from "@/components/app/montant";
import { Barres } from "@/components/app/barres";
import { SelecteurPeriode } from "@/components/app/selecteur-periode";
import { BoutonConfirmation } from "@/components/app/bouton-action";
import { CelluleNombre, Champ, ChampNombre } from "@/components/app/champs";
import { SqueletteTableau } from "@/components/app/chargement";
import { BoutonPersistance, useSaisiePersistante } from "@/components/app/saisie-persistante";
import { SelecteurLignes, useLignesVisibles } from "@/components/app/lignes-visibles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Flag } from "@/components/ui/flag";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow, TableVide } from "@/components/ui/table";

// --- Vocabulaire ----------------------------------------------------------------

type Cat = CategorieAudit;
/** Regroupement de lecture des 14 catégories (la clé en base ne change pas). */
const FAMILLE: Record<Cat, "Primes médecins" | "Paie & administratif"> = {
  externes: "Primes médecins", internes_prescripteurs_labo_radio: "Primes médecins", externes_prescripteurs_labo_radio: "Primes médecins",
  prescripteurs_scanner: "Primes médecins", prescripteurs_irm: "Primes médecins", interpretes_scanner: "Primes médecins",
  interpretes_irm: "Primes médecins", interpretes_petscan: "Primes médecins", prescripteurs_petscan: "Primes médecins",
  masse_salariale: "Paie & administratif", prime_administrative: "Paie & administratif", heures_supplementaires: "Paie & administratif",
  sanctions: "Paie & administratif", conges: "Paie & administratif",
};
const LIBELLE_COURT: Record<Cat, string> = {
  externes: "Externes", internes_prescripteurs_labo_radio: "Int. presc. labo/radio", externes_prescripteurs_labo_radio: "Ext. presc. labo/radio",
  prescripteurs_scanner: "Presc. scanner", prescripteurs_irm: "Presc. IRM", interpretes_scanner: "Interp. scanner", interpretes_irm: "Interp. IRM",
  interpretes_petscan: "Interp. Petscan", prescripteurs_petscan: "Presc. Petscan", masse_salariale: "Masse salariale",
  prime_administrative: "Prime admin.", heures_supplementaires: "Heures sup", sanctions: "Sanctions", conges: "Congés",
};

type Ligne = { ligneId: string | null; categorie: Cat; designation: string; dateDebut: string; dateFin: string; montant: number; notes: string };
/** « Sep 26 » : assez court pour 24 barres. */
const libelleMoisCourt = (p: string) => `${libellePeriode(p).slice(0, 3)} ${p.slice(2, 4)}`;
const fmtDate = (s?: string) => (s ? new Date(s + "T00:00:00").toLocaleDateString("fr-FR") : "");
const fmtDateHeure = (s?: string) => (s ? new Date(s).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "—");
const sansAccents = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const N = ({ v }: { v: number | undefined }) => (v ? <>{v < 0 ? "−" : ""}{num(Math.abs(v))}</> : <span className="text-encre-pale">0</span>);
const Delta = ({ v, p }: { v: number; p: number | null }) =>
  v ? <span className={cn("whitespace-nowrap font-mono text-xs tabular-nums", v < 0 ? "text-carmin" : "text-emerald-700")}>{v < 0 ? "−" : "+"}{num(Math.abs(v))}{p !== null ? <span className="ml-1 text-2xs text-encre-pale">({p > 0 ? "+" : ""}{fmtPct(p)})</span> : null}</span> : <span className="text-encre-pale">—</span>;

function telecharger(nom: string, contenu: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([contenu], { type: "text/csv;charset=utf-8" })); a.download = nom; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// --- Page -------------------------------------------------------------------------

export function Audit() {
  const [periode, setPeriode] = React.useState(periodeCourante());
  const [onglet, setOnglet] = React.useState<"synthese" | "lignes" | "salaires">("synthese");
  const [categorie, setCategorie] = React.useState<Cat | "toutes">("toutes");
  const [recherche, setRecherche] = React.useState("");
  const [persistant, setPersistant] = useSaisiePersistante("audit", true);
  const lignesVisibles = useLignesVisibles("audit", 15);
  const [edition, setEdition] = React.useState<Ligne | null>(null);
  const [importCsv, setImportCsv] = React.useState<{ fichier: File; categorie: Cat } | null>(null);
  const fichierRef = React.useRef<HTMLInputElement>(null);

  const resume = useQuery(api.audit.resume, { periode });
  const toutes = useQuery(api.audit.lignesDuMois, { periode });
  const rapport = useQuery(api.audit.rapport, categorie !== "toutes" ? { periode, categorie } : "skip");
  // Un audit court souvent sur l'année : horizon des séries, mémorisé.
  const [horizon, setHorizon] = React.useState<6 | 12 | 24>(() => { try { const h = Number(window.localStorage.getItem("audit:horizon")); return h === 12 || h === 24 ? h : 6; } catch { return 6; } });
  const changerHorizon = (h: 6 | 12 | 24) => { setHorizon(h); try { window.localStorage.setItem("audit:horizon", String(h)); } catch { /* ignoré */ } };
  const salaires = useQuery(api.audit.totalSalaires, onglet === "salaires" ? { periode, mois: horizon } : "skip");
  const graphes = useQuery(api.audit.graphes, { periode, mois: horizon });
  const enregistrer = useMutation(api.audit.enregistrerLigne);
  const supprimer = useMutation(api.audit.supprimerLigne);
  const importer = useMutation(api.audit.importerLignes);
  const enregistrerRapport = useMutation(api.audit.enregistrerRapport);

  const q = sansAccents(recherche.trim());
  const lignes = ((toutes?.lignes ?? []) as any[]).filter(
    (l) => (categorie === "toutes" || l.categorie === categorie) && (!q || sansAccents(`${l.designation} ${l.notes ?? ""} ${l.libelle}`).includes(q))
  );
  const totalVisible = lignes.reduce((s, l) => s + l.montant, 0);
  const cat = (c: Cat) => resume?.categories.find((x: any) => x.cle === c);
  const rapportsRediges = resume?.categories.filter((c: any) => c.rapport).length ?? 0;
  const categorieSaisie: Cat = categorie === "toutes" ? "externes" : categorie;

  const ouvrirCategorie = (c: Cat | "toutes") => { setCategorie(c); setOnglet("lignes"); };
  const surFichier = (file: File) => setImportCsv({ fichier: file, categorie: categorieSaisie });
  const confirmerImport = async () => {
    if (!importCsv) return;
    const l = parseCsvAudit(await importCsv.fichier.text());
    if (!l.length) { toast.error("Aucune ligne valide dans ce fichier", { description: "Colonnes : Nom / Désignation ; Date début ; Date fin ; Montant ; Notes" }); setImportCsv(null); return; }
    try {
      const r = await importer({ periode, categorie: importCsv.categorie, lignes: l });
      toast.success(`${r.importees} ligne(s) importée(s)`, { description: LIBELLE_AUDIT[importCsv.categorie] });
      setImportCsv(null);
    } catch (e) { toast.error("Import refusé", { description: messageErreur(e) }); }
  };

  return (
    <div className="space-y-4">
      <PageEnTete
        titre="Audit confidentiel"
        description="Registre de contrôle indépendant : pour chaque catégorie (primes des médecins par famille, masse salariale, prime administrative, heures supplémentaires, sanctions, congés), l'auditeur consigne ce qu'il constate sur le mois, compare avec le mois précédent et avec les salaires réellement versés, puis rédige son rapport."
        statut={<Flag variant="verrou" size="sm" icon={<ShieldAlertIcon className="h-3 w-3" />}>Confidentiel · auditeur externe & DG</Flag>}
        actions={
          <>
            <input ref={fichierRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) surFichier(f); e.target.value = ""; }} />
            <Button variant="outline" size="sm" onClick={() => fichierRef.current?.click()}><UploadIcon /> Importer CSV</Button>
            <Button variant="outline" size="sm" disabled={!lignes.length} onClick={() => telecharger(`audit-${categorie}-${periode}.csv`, exportCsvAudit(lignes))}><DownloadIcon /> Exporter CSV</Button>
            {!persistant ? <Button size="sm" onClick={() => setEdition({ ligneId: null, categorie: categorieSaisie, designation: "", dateDebut: "", dateFin: "", montant: 0, notes: "" })}><PlusIcon /> Ajouter une ligne</Button> : null}
            <BoutonPersistance actif={persistant} onChange={setPersistant} />
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-filet bg-surface px-3 py-2 shadow-xs print:hidden">
        <SelecteurPeriode valeur={periode} onChange={setPeriode} />
        <span className="text-sm font-semibold">{libellePeriode(periode)}</span>
        <span className="flex-1" />
        {onglet !== "lignes" && (
          <label className="flex items-center gap-2 text-xs text-encre-douce">
            Horizon
            <Select value={String(horizon)} onValueChange={(v) => changerHorizon(Number(v) as 6 | 12 | 24)}>
              <SelectTrigger size="sm" className="w-[6.5rem]" aria-label="Horizon des séries"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="6">6 mois</SelectItem><SelectItem value="12">12 mois</SelectItem><SelectItem value="24">24 mois</SelectItem></SelectContent>
            </Select>
          </label>
        )}
        {onglet === "lignes" && (
          <>
            <SelecteurLignes valeur={lignesVisibles.lignes} onChange={lignesVisibles.setLignes} />
            <div className="relative w-52">
              <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-encre-pale" aria-hidden="true" />
              <Input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Désignation, note…" aria-label="Rechercher une ligne" className="h-8 pl-8" />
            </div>
          </>
        )}
        <Tabs value={onglet} onValueChange={(v) => setOnglet(v as typeof onglet)}>
          <TabsList>
            <TabsTrigger value="synthese">Synthèse</TabsTrigger>
            <TabsTrigger value="lignes">Lignes par catégorie</TabsTrigger>
            <TabsTrigger value="salaires">Salaires versés</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <GrilleTuiles>
        <Tuile libelle="Total audité ce mois" valeur={resume ? <Montant valeur={resume.total} zero="0" /> : undefined} note="somme des 14 catégories" vedette />
        <Tuile libelle={resume ? `Mois précédent · ${libellePeriode(resume.precedent)}` : "Mois précédent"} valeur={resume ? <Montant valeur={resume.totalPrecedent} zero="0" /> : undefined} note="même périmètre" />
        <Tuile libelle="Variation" valeur={resume ? <Montant valeur={resume.total - resume.totalPrecedent} signe zero="0" /> : undefined} note={resume ? <>ce mois − mois précédent · sur un an : <Delta v={resume.total - resume.totalAnPrecedent} p={resume.totalAnPrecedent ? Math.round(((resume.total - resume.totalAnPrecedent) / resume.totalAnPrecedent) * 1000) / 10 : null} /></> : "ce mois − mois précédent"} />
        <Tuile libelle="Rapports rédigés" valeur={resume ? `${rapportsRediges} / ${CATEGORIES_AUDIT.length}` : undefined} note="un rapport par catégorie et par mois" />
      </GrilleTuiles>

      {/* ------------------------------------------------------------ Synthèse */}
      {onglet === "synthese" && (
        <div className="flex flex-col gap-3.5">
          <div className="min-w-0">
            {resume === undefined ? (
              <SqueletteTableau colonnes={5} lignes={8} />
            ) : (
              <Table classNameConteneur="rounded-xl">
                <TableHeader>
                  <TableRow>
                    <TableHead>Catégorie</TableHead>
                    <TableHead numerique>Ce mois (FCFA)</TableHead>
                    <TableHead numerique>Mois précédent</TableHead>
                    <TableHead numerique>Variation</TableHead>
                    <TableHead numerique className="border-l border-white/15" title="Même mois de l'année précédente">Il y a un an{resume ? ` · ${libelleMoisCourt(resume.anPrecedent)}` : ""}</TableHead>
                    <TableHead numerique>Variation / an</TableHead>
                    <TableHead>Rapport</TableHead>
                    <TableHead aria-label="Ouvrir" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(["Primes médecins", "Paie & administratif"] as const).map((fam) => (
                    <React.Fragment key={fam}>
                      <TableRow className="bg-bande hover:bg-bande">
                        <TableCell colSpan={8} className="py-1.5 text-2xs font-bold uppercase tracking-[0.08em] text-ocean-profond">{fam}</TableCell>
                      </TableRow>
                      {resume.categories.filter((c: any) => FAMILLE[c.cle as Cat] === fam).map((c: any) => (
                        <TableRow key={c.cle} className="cursor-pointer" onClick={() => ouvrirCategorie(c.cle)}>
                          <TableCell className="whitespace-nowrap text-[13px] font-semibold">{c.libelle}</TableCell>
                          <TableCell numerique className="bg-ocean-brume font-mono text-xs font-semibold"><N v={c.total} /></TableCell>
                          <TableCell numerique className="font-mono text-xs"><N v={c.precedent} /></TableCell>
                          <TableCell numerique><Delta v={c.delta} p={c.pct} /></TableCell>
                          <TableCell numerique className="border-l border-filet font-mono text-xs"><N v={c.anPrecedent} /></TableCell>
                          <TableCell numerique><Delta v={c.variationAn.delta} p={c.variationAn.pct} /></TableCell>
                          <TableCell>{c.rapport ? <Flag variant="renseigne" size="xs" icon={<CheckIcon className="h-2.5 w-2.5" />}>rédigé</Flag> : <Flag variant="a-renseigner" size="xs">à rédiger</Flag>}</TableCell>
                          <TableCell className="text-right"><Button variant="ghost" size="sm" className="h-7 text-2xs" onClick={(e) => { e.stopPropagation(); ouvrirCategorie(c.cle); }}>Ouvrir</Button></TableCell>
                        </TableRow>
                      ))}
                    </React.Fragment>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell>TOTAL</TableCell>
                    <TableCell numerique className="bg-ocean-brume font-mono text-xs"><N v={resume.total} /></TableCell>
                    <TableCell numerique className="font-mono text-xs"><N v={resume.totalPrecedent} /></TableCell>
                    <TableCell numerique><Delta v={resume.total - resume.totalPrecedent} p={resume.totalPrecedent ? Math.round(((resume.total - resume.totalPrecedent) / resume.totalPrecedent) * 1000) / 10 : null} /></TableCell>
                    <TableCell numerique className="border-l border-filet font-mono text-xs"><N v={resume.totalAnPrecedent} /></TableCell>
                    <TableCell numerique><Delta v={resume.total - resume.totalAnPrecedent} p={resume.totalAnPrecedent ? Math.round(((resume.total - resume.totalAnPrecedent) / resume.totalAnPrecedent) * 1000) / 10 : null} /></TableCell>
                    <TableCell colSpan={2} className="text-xs font-normal text-encre-douce">{rapportsRediges} / {CATEGORIES_AUDIT.length} rapports</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            )}
          </div>
          <aside className="grid w-full gap-3.5 lg:grid-cols-2">
            {graphes ? (
              <>
                <Barres
                  titre={`Total audité par mois — ${graphes.horizon} derniers mois`}
                  donnees={graphes.audit.map((m: any) => ({ cle: m.key, libelle: libelleMoisCourt(m.key), valeur: m.value }))}
                  cleActive={periode}
                  format={num}
                  className="rounded-xl"
                />
                <Barres
                  orientation="horizontale"
                  titre={`Par catégorie — ${libellePeriode(periode)}`}
                  donnees={[...graphes.parCategorie].sort((a: any, b: any) => b.value - a.value).map((c: any) => ({ cle: c.key, libelle: LIBELLE_COURT[c.key as Cat] ?? c.label, valeur: c.value }))}
                  format={num}
                  className="rounded-xl"
                />
              </>
            ) : <SqueletteTableau colonnes={2} lignes={6} />}
          </aside>
        </div>
      )}

      {/* ------------------------------------------------------------ Lignes */}
      {onglet === "lignes" && (
        <div className="flex flex-col gap-3.5 lg:flex-row lg:items-start">
          <nav aria-label="Catégories d'audit" className="w-full overflow-hidden rounded-xl border border-filet bg-surface lg:w-64 lg:shrink-0">
            <button type="button" onClick={() => setCategorie("toutes")} aria-current={categorie === "toutes"}
              className={cn("flex w-full items-center justify-between gap-2 border-b border-filet px-3 py-2 text-left text-xs font-semibold", categorie === "toutes" ? "bg-ocean-profond text-white" : "hover:bg-papier")}>
              <span>Toutes les catégories</span>
              <span className={cn("font-mono tabular-nums", categorie === "toutes" ? "text-white/80" : "text-encre-douce")}>{resume ? num(resume.total) : "…"}</span>
            </button>
            {(["Primes médecins", "Paie & administratif"] as const).map((fam) => (
              <div key={fam}>
                <div className="px-3 pb-1 pt-2.5 text-2xs font-bold uppercase tracking-[0.08em] text-encre-pale">{fam}</div>
                {CATEGORIES_AUDIT.filter(([c]) => FAMILLE[c] === fam).map(([c, libelle]) => {
                  const r = cat(c);
                  const actif = categorie === c;
                  return (
                    <button key={c} type="button" onClick={() => setCategorie(c)} aria-current={actif}
                      className={cn("flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs", actif ? "bg-ocean-profond font-semibold text-white" : "hover:bg-papier")}>
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate">{libelle}</span>
                        {r?.rapport ? <FileTextIcon className={cn("h-3 w-3 shrink-0", actif ? "text-white/80" : "text-emerald-700")} aria-label="Rapport rédigé" /> : null}
                      </span>
                      <span className={cn("shrink-0 font-mono text-2xs tabular-nums", actif ? "text-white/80" : r?.total ? "text-encre-douce" : "text-encre-pale/60")}>{r ? num(r.total) : "…"}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>

          <div className="flex min-w-0 flex-1 flex-col gap-3.5">
            {toutes === undefined ? (
              <SqueletteTableau colonnes={6} lignes={6} />
            ) : (
              <Table classNameConteneur="rounded-xl" hauteurMax={lignesVisibles.hauteurMax(49, 40, 44)}>
                <TableHeader>
                  <TableRow>
                    {categorie === "toutes" && <TableHead>Catégorie</TableHead>}
                    <TableHead>Nom / désignation</TableHead>
                    <TableHead>Période</TableHead>
                    <TableHead numerique>Montant (FCFA)</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead aria-label="Actions" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {persistant && (
                    <LigneSaisie
                      categorie={categorie}
                      onEnregistrer={async (l) => {
                        await enregistrer({ periode, categorie: l.categorie, designation: l.designation, dateDebut: l.dateDebut || undefined, dateFin: l.dateFin || undefined, montant: l.montant, notes: l.notes || undefined });
                        toast.success(`Ligne ajoutée — ${l.designation}`, { description: `${fcfa(l.montant)} · ${LIBELLE_AUDIT[l.categorie]}` });
                      }}
                    />
                  )}
                  {lignes.map((l) => (
                    <TableRow key={String(l.ligneId)} className="cursor-pointer" onClick={() => setEdition({ ligneId: String(l.ligneId), categorie: l.categorie, designation: l.designation, dateDebut: l.dateDebut ?? "", dateFin: l.dateFin ?? "", montant: l.montant, notes: l.notes ?? "" })}>
                      {categorie === "toutes" && <TableCell><Flag variant="neutre" size="xs" title={l.libelle}>{LIBELLE_COURT[l.categorie as Cat] ?? l.libelle}</Flag></TableCell>}
                      <TableCell className="whitespace-nowrap text-[13px] font-semibold">{l.designation}</TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-xs tabular-nums">{l.dateDebut || l.dateFin ? `${fmtDate(l.dateDebut) || "…"} → ${fmtDate(l.dateFin) || "…"}` : <span className="text-encre-pale">—</span>}</TableCell>
                      <TableCell numerique className="bg-ocean-brume font-mono text-xs font-semibold"><N v={l.montant} /></TableCell>
                      <TableCell className="max-w-[10rem] truncate text-xs text-encre-douce" title={l.notes}>{l.notes || <span className="text-encre-pale">—</span>}</TableCell>
                      <TableCell className="whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-0.5">
                          <Button variant="ghost" size="icon-sm" aria-label={`Modifier — ${l.designation}`} onClick={() => setEdition({ ligneId: String(l.ligneId), categorie: l.categorie, designation: l.designation, dateDebut: l.dateDebut ?? "", dateFin: l.dateFin ?? "", montant: l.montant, notes: l.notes ?? "" })}><PencilIcon /></Button>
                          <BoutonConfirmation
                            variant="ghost" size="icon-sm" className="text-encre-pale hover:bg-carmin-clair hover:text-carmin"
                            libelle={<Trash2Icon className="h-3.5 w-3.5" />}
                            titre={`Supprimer « ${l.designation} » ?`}
                            consequence={`${fcfa(l.montant)} (${l.libelle}) seront retirés du total audité de ${libellePeriode(periode)}.`}
                            confirmer="Supprimer"
                            onConfirmer={() => supprimer({ ligneId: l.ligneId })}
                            succes="Ligne supprimée"
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {lignes.length === 0 && (
                    <TableVide colonnes={categorie === "toutes" ? 6 : 5}>
                      {q ? "Aucune ligne ne correspond à la recherche." : categorie === "toutes" ? `Aucune ligne d'audit sur ${libellePeriode(periode)}.` : `Aucune ligne « ${LIBELLE_AUDIT[categorie]} » ce mois — saisissez-la ci-dessus ou importez un CSV.`}
                    </TableVide>
                  )}
                </TableBody>
                {lignes.length > 0 && (
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={categorie === "toutes" ? 3 : 2}>TOTAL · {lignes.length} ligne(s){categorie !== "toutes" ? ` · ${LIBELLE_COURT[categorie]}` : ""}</TableCell>
                      <TableCell numerique className="bg-ocean-brume font-mono text-xs"><N v={totalVisible} /></TableCell>
                      <TableCell colSpan={2} />
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            )}

            {categorie !== "toutes" && (
              <RapportAudit
                key={`${categorie}-${periode}`}
                titre={`Rapport d'audit — ${LIBELLE_AUDIT[categorie]} · ${libellePeriode(periode)}`}
                rapport={rapport}
                onEnregistrer={async (contenu) => {
                  await enregistrerRapport({ periode, categorie, contenu });
                  toast.success("Rapport enregistré", { description: `${LIBELLE_AUDIT[categorie]} · ${libellePeriode(periode)}` });
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------ Salaires versés */}
      {onglet === "salaires" && (
        <div className="flex flex-col gap-3.5 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1">
            <p className="mb-2 text-xs text-encre-douce">Ce que la paie a réellement versé sur les six derniers mois — bulletins figés pour les mois clôturés, calcul en direct pour le mois ouvert — à rapprocher des montants audités « Masse salariale ».</p>
            {salaires === undefined ? (
              <SqueletteTableau colonnes={7} lignes={6} />
            ) : (
              <Table classNameConteneur="rounded-xl">
                <TableHeader>
                  <TableRow>
                    <TableHead>Mois</TableHead>
                    <TableHead>État</TableHead>
                    <TableHead numerique>Bulletins</TableHead>
                    <TableHead numerique>Brut (FCFA)</TableHead>
                    <TableHead numerique>Retenues</TableHead>
                    <TableHead numerique className="bg-ocean-nuit">Net versé</TableHead>
                    <TableHead numerique>Variation du net</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(salaires as any[]).map((m) => (
                    <TableRow key={m.periode}>
                      <TableCell className="whitespace-nowrap text-[13px] font-semibold">{libellePeriode(m.periode)}</TableCell>
                      <TableCell>{m.cloture ? <Flag variant="verrou" size="xs">clôturé · figé</Flag> : <Flag variant="direct" size="xs">ouvert · calcul en direct</Flag>}</TableCell>
                      <TableCell numerique className="font-mono text-xs"><N v={m.nombre} /></TableCell>
                      <TableCell numerique className="font-mono text-xs"><N v={m.brut} /></TableCell>
                      <TableCell numerique className="font-mono text-xs text-carmin">{m.retenues ? `−${num(m.retenues)}` : <span className="text-encre-pale">0</span>}</TableCell>
                      <TableCell numerique className="bg-ocean-brume font-mono text-xs font-semibold"><N v={m.net} /></TableCell>
                      <TableCell numerique>{m.pct === null ? <span className="text-encre-pale">—</span> : <Delta v={m.delta} p={m.pct} />}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
          <aside className="w-full rounded-xl border border-filet bg-surface p-4 lg:w-[22rem] lg:shrink-0">
            {graphes ? (
              <Barres titre={`Net versé par mois — ${graphes.horizon} derniers mois`} donnees={graphes.salaires.map((s: any) => ({ cle: s.key, libelle: libelleMoisCourt(s.key), valeur: s.value }))} cleActive={periode} format={num} couleur="var(--chart-3)" className="rounded-xl" />
            ) : <SqueletteTableau colonnes={1} lignes={4} />}
          </aside>
        </div>
      )}

      {/* Dialogue : ajout (mode bouton) ou modification d'une ligne */}
      <Dialog open={edition !== null} onOpenChange={(o) => { if (!o) setEdition(null); }}>
        <DialogContent className="sm:max-w-lg">
          {edition && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!edition.designation.trim()) { toast.error("La désignation est requise."); return; }
                try {
                  await enregistrer({ ligneId: (edition.ligneId ?? undefined) as any, periode, categorie: edition.categorie, designation: edition.designation, dateDebut: edition.dateDebut || undefined, dateFin: edition.dateFin || undefined, montant: edition.montant, notes: edition.notes || undefined });
                  toast.success(edition.ligneId ? "Ligne mise à jour" : "Ligne ajoutée");
                  setEdition(null);
                } catch (err) { toast.error("Enregistrement refusé", { description: messageErreur(err) }); }
              }}
            >
              <DialogHeader>
                <DialogTitle>{edition.ligneId ? "Modifier la ligne d'audit" : "Nouvelle ligne d'audit"}</DialogTitle>
                <DialogDescription>{libellePeriode(periode)} · ce que l'auditeur a constaté pour cette catégorie.</DialogDescription>
              </DialogHeader>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Champ libelle="Catégorie" requis>
                    {(a) => (
                      <Select value={edition.categorie} onValueChange={(v) => setEdition({ ...edition, categorie: v as Cat })}>
                        <SelectTrigger id={a.id} className="w-full" aria-label="Catégorie"><SelectValue /></SelectTrigger>
                        <SelectContent>{CATEGORIES_AUDIT.map(([c, l]) => <SelectItem key={c} value={c}>{l}</SelectItem>)}</SelectContent>
                      </Select>
                    )}
                  </Champ>
                </div>
                <div className="col-span-2"><Champ libelle="Nom / désignation" requis>{(a) => <Input {...a} required value={edition.designation} onChange={(e) => setEdition({ ...edition, designation: e.target.value })} placeholder="Dr Nom Prénom, poste, objet…" />}</Champ></div>
                <Champ libelle="Date début">{(a) => <Input {...a} type="date" value={edition.dateDebut} onChange={(e) => setEdition({ ...edition, dateDebut: e.target.value })} />}</Champ>
                <Champ libelle="Date fin">{(a) => <Input {...a} type="date" value={edition.dateFin} onChange={(e) => setEdition({ ...edition, dateFin: e.target.value })} />}</Champ>
                <ChampNombre libelle="Montant" unite="FCFA" requis step={1000} valeur={edition.montant} onChange={(n) => setEdition({ ...edition, montant: n })} />
                <Champ libelle="Notes">{(a) => <Input {...a} value={edition.notes} onChange={(e) => setEdition({ ...edition, notes: e.target.value })} placeholder="Observation, pièce, anomalie…" />}</Champ>
              </div>
              <DialogFooter className="mt-5">
                <Button type="button" variant="outline" onClick={() => setEdition(null)}>Annuler</Button>
                <Button type="submit">{edition.ligneId ? "Mettre à jour" : "Ajouter la ligne"}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialogue : import CSV — la catégorie cible est choisie explicitement */}
      <Dialog open={importCsv !== null} onOpenChange={(o) => { if (!o) setImportCsv(null); }}>
        <DialogContent className="sm:max-w-md">
          {importCsv && (
            <>
              <DialogHeader>
                <DialogTitle>Importer des lignes d'audit</DialogTitle>
                <DialogDescription>Fichier « {importCsv.fichier.name} » · toutes les lignes iront dans la catégorie choisie, pour {libellePeriode(periode)}. Colonnes : Nom / Désignation ; Date début ; Date fin ; Montant ; Notes.</DialogDescription>
              </DialogHeader>
              <Champ libelle="Catégorie" requis>
                {(a) => (
                  <Select value={importCsv.categorie} onValueChange={(v) => setImportCsv({ ...importCsv, categorie: v as Cat })}>
                    <SelectTrigger id={a.id} className="w-full" aria-label="Catégorie"><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES_AUDIT.map(([c, l]) => <SelectItem key={c} value={c}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              </Champ>
              <DialogFooter className="mt-4">
                <Button variant="outline" onClick={() => setImportCsv(null)}>Annuler</Button>
                <Button onClick={confirmerImport}><UploadIcon /> Importer</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- Rapport d'audit du mois pour une catégorie -------------------------------------

function RapportAudit({ titre, rapport, onEnregistrer }: { titre: string; rapport: any; onEnregistrer: (contenu: string) => Promise<void> }) {
  const [texte, setTexte] = React.useState<string>(rapport?.contenu ?? "");
  const [sale, setSale] = React.useState(false);
  const [enCours, setEnCours] = React.useState(false);
  React.useEffect(() => { if (!sale) setTexte(rapport?.contenu ?? ""); }, [rapport?.contenu, sale]);
  return (
    <section className="rounded-xl border border-filet bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-filet px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold"><FileTextIcon className="h-4 w-4 text-ocean-profond" />{titre}</div>
        <span className="text-2xs text-encre-pale">{rapport === undefined ? "…" : rapport ? `Dernière version : ${fmtDateHeure(rapport.majLe)} · ${rapport.auteur}` : "Aucun rapport pour ce mois."}</span>
      </div>
      <div className="p-4">
        <Textarea
          rows={6}
          value={texte}
          onChange={(e) => { setTexte(e.target.value); setSale(true); }}
          placeholder="Observations, anomalies détectées, pièces demandées, recommandations…"
          aria-label="Rapport d'audit"
          className="text-sm"
        />
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-2xs text-encre-pale">{sale ? "Modifications non enregistrées" : "Le rapport est conservé par mois et par catégorie, avec son auteur."}</span>
          <div className="flex gap-2">
            {sale && <Button variant="outline" size="sm" onClick={() => { setSale(false); setTexte(rapport?.contenu ?? ""); }}>Annuler</Button>}
            <Button size="sm" disabled={!sale || enCours} onClick={async () => { setEnCours(true); try { await onEnregistrer(texte); setSale(false); } catch (e) { toast.error("Rapport non enregistré", { description: messageErreur(e) }); } finally { setEnCours(false); } }}>
              <CheckIcon /> Enregistrer le rapport
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

// --- Ligne de saisie permanente (skill §7) ---------------------------------------

const CS = "bg-ocean-brume/40 align-middle";

function LigneSaisie({ categorie, onEnregistrer }: { categorie: Cat | "toutes"; onEnregistrer: (l: Omit<Ligne, "ligneId">) => Promise<void> }) {
  const catDefaut: Cat = categorie === "toutes" ? "externes" : categorie;
  const vierge = React.useCallback((): Omit<Ligne, "ligneId"> => ({ categorie: catDefaut, designation: "", dateDebut: "", dateFin: "", montant: 0, notes: "" }), [catDefaut]);
  const [l, setL] = React.useState(vierge);
  const [enCours, setEnCours] = React.useState(false);
  const premier = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => { setL((x) => (x.designation ? { ...x, categorie: catDefaut } : vierge())); }, [catDefaut, vierge]);

  const vider = () => { setL(vierge()); premier.current?.focus(); };
  const valider = async () => {
    if (!l.designation.trim()) { toast.error("La désignation est requise."); premier.current?.focus(); return; }
    setEnCours(true);
    try {
      await onEnregistrer({ ...l, designation: l.designation.trim(), notes: l.notes.trim() });
      // La période reste : on saisit souvent plusieurs bénéficiaires sur la même période.
      setL({ ...vierge(), categorie: l.categorie, dateDebut: l.dateDebut, dateFin: l.dateFin });
      premier.current?.focus();
    } catch (e) { toast.error("Ligne non ajoutée", { description: messageErreur(e) }); }
    finally { setEnCours(false); }
  };
  const k = (e: React.KeyboardEvent) => { if (e.key === "Enter") { e.preventDefault(); void valider(); } if (e.key === "Escape") { e.preventDefault(); vider(); } };

  return (
    <TableRow className={CS} aria-label="Nouvelle ligne d'audit">
      {categorie === "toutes" && (
        <TableCell className={CS}>
          <Select value={l.categorie} onValueChange={(v) => setL({ ...l, categorie: v as Cat })}>
            <SelectTrigger size="sm" className="h-8 w-36 text-xs" aria-label="Catégorie (nouvelle ligne)"><SelectValue /></SelectTrigger>
            <SelectContent>{CATEGORIES_AUDIT.map(([c, lib]) => <SelectItem key={c} value={c}>{lib}</SelectItem>)}</SelectContent>
          </Select>
        </TableCell>
      )}
      <TableCell className={CS}><Input ref={premier} value={l.designation} onChange={(e) => setL({ ...l, designation: e.target.value })} onKeyDown={k} placeholder="Nom / désignation" aria-label="Désignation (nouvelle ligne)" className="h-8 w-40 text-xs" /></TableCell>
      <TableCell className={CS}>
        <div className="flex items-center gap-1">
          <Input type="date" value={l.dateDebut} onChange={(e) => setL({ ...l, dateDebut: e.target.value })} onKeyDown={k} aria-label="Date début (nouvelle ligne)" className="h-8 w-[7.2rem] px-1 text-2xs" />
          <span className="text-encre-pale">→</span>
          <Input type="date" value={l.dateFin} onChange={(e) => setL({ ...l, dateFin: e.target.value })} onKeyDown={k} aria-label="Date fin (nouvelle ligne)" className="h-8 w-[7.2rem] px-1 text-2xs" />
        </div>
      </TableCell>
      <TableCell numerique className={CS}><span onKeyDown={k}><CelluleNombre libelle="Montant (nouvelle ligne)" valeur={l.montant} onChange={(n) => setL({ ...l, montant: n })} largeur={92} pas={1000} /></span></TableCell>
      <TableCell className={CS}><Input value={l.notes} onChange={(e) => setL({ ...l, notes: e.target.value })} onKeyDown={k} placeholder="Notes" aria-label="Notes (nouvelle ligne)" className="h-8 w-28 text-xs" /></TableCell>
      <TableCell className={cn(CS, "text-right")}>
        <Button size="icon-sm" onClick={() => void valider()} disabled={enCours} aria-label="Ajouter la ligne" title="Ajouter (Entrée) · vider (Échap)"><PlusIcon /></Button>
      </TableCell>
    </TableRow>
  );
}

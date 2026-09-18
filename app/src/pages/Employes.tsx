/**
 * Employés — refonte (charte poitiers-ui-ux-system).
 *
 * Le registre des salariés : identité de paie (matricule, nom), société de
 * rattachement, brut de référence, date d'entrée (base de l'acquisition des
 * congés), CNPS. Tout est repris automatiquement par la paie.
 *
 * Saisie en série (skill §7) : ligne de saisie permanente en tête du tableau
 * (matricule, nom, fonction, société, brut, date d'entrée) ; la fiche complète
 * (CNPS, NIU, adresse, e-mail, congés initiaux, retrait) s'ouvre sur la ligne.
 * L'import CSV / Excel reste la vraie saisie de masse (upsert par matricule).
 */
import * as React from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { PlusIcon, SearchIcon, UploadIcon, UserRoundPenIcon } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { parseCsv, toFcfa } from "@/lib/csv";
import { messageErreur, num } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageEnTete } from "@/components/app/en-tete";
import { GrilleTuiles, Tuile } from "@/components/app/tuile";
import { Montant } from "@/components/app/montant";
import { CelluleNombre } from "@/components/app/champs";
import { SqueletteTableau } from "@/components/app/chargement";
import { BoutonPersistance, useSaisiePersistante } from "@/components/app/saisie-persistante";
import { SelecteurLignes, useLignesVisibles } from "@/components/app/lignes-visibles";
import { FicheEmploye, SOCIETES, type EmployeFiche, type Societe } from "@/components/app/fiche-employe";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Flag } from "@/components/ui/flag";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableVide } from "@/components/ui/table";

const fmtDate = (s?: string) => (s ? new Date(s + "T00:00:00").toLocaleDateString("fr-FR") : "");
const sansAccents = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function Employes() {
  const employes = useQuery(api.employes.liste, {});
  const creer = useMutation(api.employes.creer);
  const modifier = useMutation(api.employes.modifier);
  const importer = useMutation(api.employes.importer);
  const fichierRef = React.useRef<HTMLInputElement>(null);

  const [persistant, setPersistant] = useSaisiePersistante("employes", true);
  const lignesVisibles = useLignesVisibles("employes", 15);
  const [societe, setSociete] = React.useState<Societe | "toutes">("toutes");
  const [etat, setEtat] = React.useState<"actifs" | "inactifs" | "tous">("actifs");
  const [recherche, setRecherche] = React.useState("");

  const tous = (employes ?? []) as any[];
  const actifs = tous.filter((e) => e.actif);
  const q = sansAccents(recherche.trim());
  const liste = tous
    .filter((e) => (etat === "tous" || (etat === "actifs") === !!e.actif) && (societe === "toutes" || e.societe === societe))
    .filter((e) => !q || sansAccents(`${e.nom} ${e.matricule} ${e.fonction ?? ""} ${e.cnps ?? ""}`).includes(q))
    .sort((a, b) => a.nom.localeCompare(b.nom));
  const sansDate = actifs.filter((e) => !e.dateDebut).length;
  const sansCnps = actifs.filter((e) => !e.cnps).length;
  const masseBrute = actifs.reduce((s, e) => s + e.salaireBrut, 0);
  const parSociete = (s: Societe) => actifs.filter((e) => e.societe === s).length;

  const onImport = async (file: File) => {
    const rows = parseCsv(await file.text());
    const lignes = rows
      .map((r) => ({
        matricule: r.matricule ?? "", nom: r.nom ?? r["nom_et_prénoms"] ?? r.noms ?? "",
        fonction: r.fonction || undefined, adresse: r.adresse || undefined,
        cnps: r.cnps || undefined, niu: r.niu || undefined, email: r.email || undefined,
        societe: (SOCIETES.includes((r.societe ?? "").toUpperCase() as Societe) ? r.societe.toUpperCase() : "SGC") as Societe,
        salaireBrut: toFcfa(r.salaire_brut ?? r.salairebrut ?? r.brut ?? "0"),
        dateDebut: /^\d{4}-\d{2}-\d{2}$/.test(r.date_debut ?? "") ? r.date_debut : undefined,
      }))
      .filter((l) => l.matricule && l.nom);
    if (!lignes.length) { toast.error("Aucune ligne valide dans ce fichier", { description: "Colonnes attendues : matricule ; nom ; fonction ; societe ; salaire_brut ; date_debut ; cnps ; email" }); return; }
    try {
      const r = await importer({ lignes });
      toast.success(`Import terminé : ${r.crees} créé(s), ${r.majs} mis à jour`, { description: "Reconnaissance par matricule · les bulletins du mois se recalculent" });
    } catch (e) { toast.error("Import refusé", { description: messageErreur(e) }); }
  };

  const fiche = (e: any): EmployeFiche => ({
    employeId: String(e._id), matricule: e.matricule, nom: e.nom, fonction: e.fonction, adresse: e.adresse, cnps: e.cnps, niu: e.niu,
    email: e.email, societe: e.societe, salaireBrut: e.salaireBrut, dateDebut: e.dateDebut, congesInitial: e.congesInitial, actif: e.actif,
  });

  return (
    <div className="space-y-4">
      <PageEnTete
        titre="Employés"
        description="Registre des salariés : identité de paie, société de rattachement, brut de référence, date d'entrée (base de l'acquisition des congés). Tout est repris automatiquement par la paie."
        statut={sansDate || sansCnps ? <Flag variant="a-renseigner" size="sm" title="À compléter dans la fiche">{[sansDate ? `${sansDate} sans date d'entrée` : "", sansCnps ? `${sansCnps} sans n° CNPS` : ""].filter(Boolean).join(" · ")}</Flag> : null}
        actions={
          <>
            <input ref={fichierRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void onImport(f); e.target.value = ""; }} />
            <Button variant="outline" size="sm" onClick={() => fichierRef.current?.click()} title="Colonnes : matricule ; nom ; fonction ; societe ; salaire_brut ; date_debut ; cnps ; email — mise à jour par matricule">
              <UploadIcon /> Importer CSV / Excel
            </Button>
            {!persistant ? <FicheEmploye creer={creer as any} modifier={modifier as any} /> : null}
            <BoutonPersistance actif={persistant} onChange={setPersistant} />
          </>
        }
      />

      <GrilleTuiles>
        <Tuile libelle="Effectif actif" valeur={employes ? actifs.length : undefined} note={employes ? `${tous.length - actifs.length} inactif(s) conservé(s)` : undefined} vedette />
        <Tuile libelle="Par société" valeur={employes ? <span className="font-mono text-lg tabular-nums">{parSociete("SESAME")} · {parSociete("SOFINA")} · {parSociete("SGC")}</span> : undefined} note="SESAME · SOFINA · SGC" />
        <Tuile libelle="Masse brute de référence" valeur={employes ? <Montant valeur={masseBrute} zero="0" /> : undefined} note="somme des bruts mensuels des actifs" />
        <Tuile libelle="Fiches à compléter" valeur={employes ? sansDate + sansCnps : undefined} note="date d'entrée ou n° CNPS manquant" />
      </GrilleTuiles>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-filet bg-surface px-3 py-2 shadow-xs print:hidden">
        <div role="tablist" aria-label="Société" className="flex items-center gap-1 rounded-xl border border-filet bg-slate-100/80 p-1">
          {([["toutes", "Toutes"], ...SOCIETES.map((s) => [s, s])] as [Societe | "toutes", string][]).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={societe === k} onClick={() => setSociete(k)}
              className={cn("inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors", societe === k ? "bg-ocean-profond text-white shadow-xs" : "text-encre-douce hover:bg-white hover:text-encre")}>
              {l}<span className={cn("font-mono text-[10px] tabular-nums", societe === k ? "text-white/80" : "text-encre-pale")}>{k === "toutes" ? actifs.length : parSociete(k)}</span>
            </button>
          ))}
        </div>
        <Select value={etat} onValueChange={(v) => setEtat(v as typeof etat)}>
          <SelectTrigger size="sm" className="w-32" aria-label="État"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="actifs">Actifs</SelectItem>
            <SelectItem value="inactifs">Inactifs</SelectItem>
            <SelectItem value="tous">Tous</SelectItem>
          </SelectContent>
        </Select>
        <span className="flex-1" />
        <SelecteurLignes valeur={lignesVisibles.lignes} onChange={lignesVisibles.setLignes} />
        <div className="relative w-56">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-encre-pale" aria-hidden="true" />
          <Input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Nom, matricule, fonction, CNPS…" aria-label="Rechercher un employé" className="h-8 pl-8" />
        </div>
      </div>

      {employes === undefined ? (
        <SqueletteTableau colonnes={8} lignes={8} />
      ) : (
        <Table classNameConteneur="rounded-xl" hauteurMax={lignesVisibles.hauteurMax(49, 40, 0)}>
          <TableHeader>
            <TableRow>
              <TableHead>Matricule</TableHead>
              <TableHead>Noms et prénoms</TableHead>
              <TableHead>Fonction</TableHead>
              <TableHead>Société</TableHead>
              <TableHead numerique>Brut mensuel (FCFA)</TableHead>
              <TableHead>Date d'entrée</TableHead>
              <TableHead>N° CNPS</TableHead>
              <TableHead>État</TableHead>
              <TableHead aria-label="Fiche" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {persistant && (
              <LigneSaisie
                societeParDefaut={societe === "toutes" ? "SGC" : societe}
                onEnregistrer={async (l) => {
                  await creer({ matricule: l.matricule, nom: l.nom, fonction: l.fonction || undefined, societe: l.societe, salaireBrut: l.salaireBrut, dateDebut: l.dateDebut || undefined });
                  toast.success(`${l.nom} ajouté à l'effectif`, { description: `${l.matricule} · ${l.societe} · complétez CNPS et adresse dans la fiche` });
                }}
              />
            )}
            {liste.map((e) => (
              <TableRow key={String(e._id)} className={cn(!e.actif && "opacity-60")}>
                <TableCell className="whitespace-nowrap font-mono text-xs font-semibold text-ocean-profond">{e.matricule}</TableCell>
                <TableCell className="whitespace-nowrap text-[13px] font-semibold">{e.nom}</TableCell>
                <TableCell className="max-w-[14rem] truncate text-xs text-encre-douce" title={e.fonction}>{e.fonction || <span className="text-encre-pale">—</span>}</TableCell>
                <TableCell><Flag variant="neutre" size="xs">{e.societe}</Flag></TableCell>
                <TableCell numerique className="font-mono text-xs font-semibold">{num(e.salaireBrut)}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {e.dateDebut ? (
                    <span className="font-mono text-xs tabular-nums">{fmtDate(e.dateDebut)}</span>
                  ) : e.actif ? (
                    // Fiche incomplète : la date se saisit sur la ligne, elle conditionne l'acquisition des congés.
                    <Input type="date" aria-label={`Date d'entrée — ${e.nom}`} className="h-7 w-[8.5rem] border-amber-300 px-1.5 text-2xs" onChange={(ev) => { if (ev.target.value) void modifier({ employeId: e._id, dateDebut: ev.target.value }).then(() => toast.success(`Date d'entrée enregistrée — ${e.nom}`)); }} />
                  ) : <span className="text-encre-pale">—</span>}
                </TableCell>
                <TableCell className="whitespace-nowrap font-mono text-xs">{e.cnps || <Flag variant="a-renseigner" size="xs">à renseigner</Flag>}</TableCell>
                <TableCell>{e.actif ? <Flag variant="renseigne" size="xs">Actif</Flag> : <Flag variant="verrou" size="xs">Inactif</Flag>}</TableCell>
                <TableCell className="text-right">
                  <FicheEmploye
                    employe={fiche(e)}
                    creer={creer as any}
                    modifier={modifier as any}
                    declencheur={<Button variant="ghost" size="icon-sm" aria-label={`Fiche — ${e.nom}`} title="Fiche complète (CNPS, NIU, adresse, e-mail, congés initiaux)"><UserRoundPenIcon /></Button>}
                  />
                </TableCell>
              </TableRow>
            ))}
            {liste.length === 0 && (
              <TableVide colonnes={9}>{q || societe !== "toutes" || etat !== "actifs" ? "Aucun employé ne correspond aux filtres." : "Aucun employé : saisissez la première fiche ci-dessus ou importez un CSV."}</TableVide>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

// --- Ligne de saisie permanente (skill §7) ---------------------------------------

const CS = "bg-ocean-brume/40 align-middle";
type Nouveau = { matricule: string; nom: string; fonction: string; societe: Societe; salaireBrut: number; dateDebut: string };

function LigneSaisie({ societeParDefaut, onEnregistrer }: { societeParDefaut: Societe; onEnregistrer: (l: Nouveau) => Promise<void> }) {
  const vierge = React.useCallback((): Nouveau => ({ matricule: "", nom: "", fonction: "", societe: societeParDefaut, salaireBrut: 0, dateDebut: "" }), [societeParDefaut]);
  const [l, setL] = React.useState(vierge);
  const [enCours, setEnCours] = React.useState(false);
  const premier = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => { setL((x) => (x.matricule || x.nom ? x : vierge())); }, [vierge]);

  const vider = () => { setL(vierge()); premier.current?.focus(); };
  const valider = async () => {
    if (!l.matricule.trim() || !l.nom.trim()) { toast.error("Matricule et nom sont requis."); premier.current?.focus(); return; }
    if (!(l.salaireBrut > 0)) { toast.error("Le salaire brut doit être supérieur à 0."); return; }
    setEnCours(true);
    try {
      await onEnregistrer({ ...l, matricule: l.matricule.trim(), nom: l.nom.trim().toUpperCase(), fonction: l.fonction.trim() });
      setL({ ...vierge(), societe: l.societe });
      premier.current?.focus();
    } catch (e) { toast.error("Employé non ajouté", { description: messageErreur(e) }); }
    finally { setEnCours(false); }
  };
  const k = (e: React.KeyboardEvent) => { if (e.key === "Enter") { e.preventDefault(); void valider(); } if (e.key === "Escape") { e.preventDefault(); vider(); } };

  return (
    <TableRow className={CS} aria-label="Nouvel employé">
      <TableCell className={CS}><Input ref={premier} value={l.matricule} onChange={(e) => setL({ ...l, matricule: e.target.value })} onKeyDown={k} placeholder="E009" aria-label="Matricule (nouvel employé)" className="h-8 w-20 font-mono text-xs" /></TableCell>
      <TableCell className={CS}><Input value={l.nom} onChange={(e) => setL({ ...l, nom: e.target.value })} onKeyDown={k} placeholder="NOM Prénoms" aria-label="Noms et prénoms (nouvel employé)" className="h-8 w-48 text-xs" /></TableCell>
      <TableCell className={CS}><Input value={l.fonction} onChange={(e) => setL({ ...l, fonction: e.target.value })} onKeyDown={k} placeholder="Fonction" aria-label="Fonction (nouvel employé)" className="h-8 w-36 text-xs" /></TableCell>
      <TableCell className={CS}>
        <Select value={l.societe} onValueChange={(v) => setL({ ...l, societe: v as Societe })}>
          <SelectTrigger size="sm" className="h-8 w-24 text-xs" aria-label="Société (nouvel employé)"><SelectValue /></SelectTrigger>
          <SelectContent>{SOCIETES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
      </TableCell>
      <TableCell numerique className={CS}><span onKeyDown={k}><CelluleNombre libelle="Brut mensuel (nouvel employé)" valeur={l.salaireBrut} onChange={(n) => setL({ ...l, salaireBrut: n })} largeur={104} min={0} pas={5000} /></span></TableCell>
      <TableCell className={CS}><Input type="date" value={l.dateDebut} onChange={(e) => setL({ ...l, dateDebut: e.target.value })} onKeyDown={k} aria-label="Date d'entrée (nouvel employé)" className="h-8 w-[8.5rem] px-1.5 text-2xs" /></TableCell>
      <TableCell className={cn(CS, "text-2xs text-encre-pale")} colSpan={2}>CNPS, NIU, adresse : dans la fiche</TableCell>
      <TableCell className={cn(CS, "text-right")}>
        <Button size="icon-sm" onClick={() => void valider()} disabled={enCours} aria-label="Ajouter l'employé" title="Ajouter (Entrée) · vider (Échap)"><PlusIcon /></Button>
      </TableCell>
    </TableRow>
  );
}

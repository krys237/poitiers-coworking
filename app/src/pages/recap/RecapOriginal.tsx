/**
 * Onglet « Modèle original » : reproduction du récapitulatif de l'application
 * de paie du directeur (`paie-poitiers-coworking/src/routes/paie.tsx`), telle
 * quelle — en-tête, sélecteur mois/année, liens, carte des taux, tableau à
 * 20 colonnes avec saisie dans les cellules, fiche employé et dialogue
 * « Saisie du mois » par ligne, totaux par société, légende.
 *
 * Seules différences : les données viennent de Convex (enregistrement
 * automatique), les taux sont ceux du barème daté (lecture seule), et la
 * clôture passe par une confirmation avec mot-clé (garde-fou n°4).
 */
import * as React from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  Archive, CalendarRange, ClipboardEdit, Coins, FileText, History, Mail, Percent, Printer, UserRoundPen, UsersRound,
} from "lucide-react";
import { MOIS, bornesPeriode } from "../../../convex/lib/periode";
import { libellePeriode, num } from "@/lib/format";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { BoutonConfirmation } from "@/components/app/bouton-action";
import {
  type Brouillon, type BulletinLigne, type Champ, type RecapPaie, type Valeurs, LIBELLE, SOCIETES, UNITE,
  apercuBulletin, baremeClient, validerValeurs,
} from "./commun";

function Num({
  value, onChange, onBlur, step = 1000, readOnly = false, label,
}: {
  value: number; onChange: (n: number) => void; onBlur?: () => void; step?: number; readOnly?: boolean; label: string;
}) {
  return (
    <input
      type="number"
      step={step}
      value={value === 0 ? "" : value}
      placeholder="0"
      onFocus={(e) => e.target.select()}
      readOnly={readOnly}
      disabled={readOnly}
      aria-label={label}
      title={label}
      onChange={(ev) => {
        const val = ev.target.value;
        onChange(val === "" ? 0 : Number(val) || 0);
      }}
      onBlur={onBlur}
      className="w-24 rounded border border-border bg-background px-1 py-0.5 text-right text-xs tabular-nums outline-none focus:border-ring disabled:cursor-not-allowed disabled:opacity-60"
    />
  );
}

const LIEN = "inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-accent";

/** Carte des taux du mois, identique au `TauxMois` du modèle (champs en lecture seule ici). */
function TauxMoisCarte({ bareme, periode }: { bareme: any; periode: string }) {
  if (!bareme) return null;
  const lignes: [string, number, string][] = [
    ["Plafond CNPS", bareme.plafondCnps, "FCFA"], ["CNPS salarié (PVID)", bareme.tauxPvidSal, "%"],
    ["CFC salarié", bareme.tauxCfcSal, "%"], ["Abattement IRPP annuel", bareme.abattementIrppAnnuel ?? 500000, "FCFA"],
    ["CAC (sur IRPP)", bareme.tauxCac, "%"], ["Prestations familiales", bareme.tauxPf, "%"],
    ["PVID patronal", bareme.tauxPvidPat, "%"], ["Accidents du travail", bareme.tauxAtmp, "%"],
    ["FNE", bareme.tauxFne, "%"], ["CFC patronal", bareme.tauxCfcPat, "%"],
  ];
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Percent className="h-4 w-4 text-primary" /> Taux du mois – {libellePeriode(periode)}
          </h2>
          <p className="text-xs text-muted-foreground">
            Lus automatiquement dans le barème officiel applicable à ce mois ({bareme.source}, en vigueur depuis le{" "}
            {new Date(bareme.effectiveFrom + "T00:00:00").toLocaleDateString("fr-FR")}). Ils alimentent tous les
            bulletins de la période.
          </p>
        </div>
        <Link to="/bareme" className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] hover:bg-accent">
          Barème daté
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {lignes.map(([label, v, unite]) => (
          <label key={label} className="block text-xs">
            <span className="mb-1 block text-muted-foreground">{label} ({unite})</span>
            <input
              type="number"
              disabled
              value={v}
              readOnly
              aria-label={label}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-right tabular-nums outline-none disabled:opacity-60"
            />
          </label>
        ))}
      </div>
    </section>
  );
}

/** Fiche employé du modèle : identité et brut, enregistrés dans `employes`. */
function FicheEmploye({ b, recap, disabled }: { b: BulletinLigne; recap: RecapPaie; disabled: boolean }) {
  const [open, setOpen] = React.useState(false);
  const [f, setF] = React.useState({ fonction: b.fonction ?? "", cnps: b.cnps ?? "", adresse: b.adresse ?? "", salaireBrut: b.salaireBrut, societe: b.societe });
  React.useEffect(() => {
    if (open) setF({ fonction: b.fonction ?? "", cnps: b.cnps ?? "", adresse: b.adresse ?? "", salaireBrut: b.salaireBrut, societe: b.societe });
  }, [open, b]);
  const champ = (cle: keyof typeof f, label: string, type: "text" | "number" = "text") => (
    <label className="block text-xs">
      <span className="mb-1 block font-medium text-foreground">{label}</span>
      <input
        type={type}
        value={f[cle] as any}
        onChange={(ev) => setF({ ...f, [cle]: type === "number" ? Number(ev.target.value) || 0 : ev.target.value })}
        className="w-full rounded-md border border-border bg-background px-2 py-1.5 outline-none focus:border-ring"
      />
    </label>
  );
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="inline-flex items-center gap-1 whitespace-nowrap rounded border border-border px-2 py-0.5 text-[10px] font-medium text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          <UserRoundPen className="h-3 w-3" /> Fiche
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Fiche employé – {b.nom}</DialogTitle>
          <DialogDescription>Matricule {b.matricule}. Le brut de référence alimente le salaire journalier.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          {champ("fonction", "Fonction")}
          {champ("salaireBrut", "Salaire brut (FCFA)", "number")}
          {champ("cnps", "N° CNPS")}
          <label className="block text-xs">
            <span className="mb-1 block font-medium text-foreground">Société</span>
            <select
              value={f.societe}
              onChange={(ev) => setF({ ...f, societe: ev.target.value as any })}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 outline-none focus:border-ring"
            >
              {SOCIETES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <div className="col-span-2">{champ("adresse", "Adresse")}</div>
        </div>
        <DialogFooter>
          <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-border px-3 py-2 text-xs font-medium hover:bg-accent">Annuler</button>
          <button
            type="button"
            onClick={async () => {
              try {
                await recap.modifierEmploye({ employeId: b.employeId, ...f });
                toast.success(`Fiche de ${b.nom} enregistrée`);
                setOpen(false);
              } catch (e: any) {
                toast.error("Fiche non enregistrée", { description: e?.message });
              }
            }}
            className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Enregistrer la fiche
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Dialogue « Saisie du mois » du modèle (13 champs, validation, aperçu). */
export function SaisieDuMoisDialog({
  b, brouillon, bareme, periode, disabled, declencheur,
}: {
  b: BulletinLigne; brouillon: Brouillon; bareme: any; periode: string; disabled?: boolean; declencheur?: React.ReactNode;
}) {
  const id = String(b.employeId);
  const [open, setOpen] = React.useState(false);
  const [c, setC] = React.useState<Valeurs>(() => brouillon.valeurs(id));
  const [err, setErr] = React.useState<Partial<Record<Champ, string>>>({});
  React.useEffect(() => {
    if (open) { setC(brouillon.valeurs(id)); setErr({}); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const apercu = apercuBulletin(b, c, baremeClient(bareme));

  const champ = (cle: Champ, step = 1000) => (
    <label className="block text-xs">
      <span className="mb-1 block font-medium text-foreground">{LIBELLE[cle]} ({UNITE[cle]})</span>
      <input
        type="number"
        step={step}
        value={c[cle]}
        onChange={(ev) => setC({ ...c, [cle]: Number(ev.target.value) || 0 })}
        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-right tabular-nums outline-none focus:border-ring"
      />
      {err[cle] && <span className="mt-1 block text-[11px] font-medium text-destructive">{err[cle]}</span>}
    </label>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {declencheur ?? (
          <button
            type="button"
            disabled={disabled}
            className="inline-flex items-center gap-1 whitespace-nowrap rounded border border-border px-2 py-0.5 text-[10px] font-medium text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ClipboardEdit className="h-3 w-3" /> Saisie du mois
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Saisie du mois – {b.nom}</DialogTitle>
          <DialogDescription>
            Éléments variables de {libellePeriode(periode)}. Le récapitulatif et le bulletin se recalculent
            automatiquement à l'enregistrement.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {champ("joursTravailles", 1)}
          <label className="block text-xs">
            <span className="mb-1 block font-medium text-foreground">Congés pris (jours)</span>
            <input type="number" value={b.details?.congesPris ?? 0} disabled readOnly className="w-full rounded-md border border-border bg-muted px-2 py-1.5 text-right tabular-nums opacity-70" />
            <span className="mt-1 block text-[10px] text-muted-foreground">Vient du planning des absences.</span>
          </label>
          {champ("absences")}
          {champ("sanctions")}
          {champ("dettesSoins")}
          {champ("acompte")}
          {champ("primesVariables")}
          {champ("transport")}
          {champ("primeAssiduite")}
          {champ("indemniteLogement")}
          {champ("heuresSup")}
          {champ("anciennete")}
          {champ("mutuellePct", 0.5)}
        </div>
        <div className="grid grid-cols-2 gap-2 rounded-md border border-border bg-muted/40 p-3 text-xs sm:grid-cols-4">
          {([
            ["Salaire de base", apercu?.details.salaireBase],
            ["Total brut", apercu?.details.total1],
            ["Mutuelle", apercu?.details.mutuelle],
            ["Net à payer", apercu?.net],
          ] as [string, number | undefined][]).map(([l, v]) => (
            <div key={l}>
              <span className="block text-muted-foreground">{l}</span>
              <span className="font-semibold tabular-nums text-foreground">{v == null ? "…" : `${num(v)} FCFA`}</span>
            </div>
          ))}
        </div>
        <DialogFooter>
          <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-border px-3 py-2 text-xs font-medium hover:bg-accent">Annuler</button>
          <button
            type="button"
            onClick={async () => {
              const e2 = validerValeurs(c);
              setErr(e2);
              if (Object.keys(e2).length > 0) { toast.error("Corrigez les champs en rouge."); return; }
              await brouillon.enregistrer(id, c);
              toast.success(`Saisie du mois enregistrée pour ${b.nom}`);
              setOpen(false);
            }}
            className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Enregistrer la saisie
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RecapOriginal({
  periode, onPeriode, recap, brouillon,
}: {
  periode: string; onPeriode: (p: string) => void; recap: RecapPaie; brouillon: Brouillon;
}) {
  const { bulletins, cloture, bareme, generer, paie } = recap;
  const peutEditer = !cloture;
  const [annee, mois] = periode.split("-");
  const annees = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 3 + i);
  const totalPar = (s: string) => bulletins.filter((b) => b.societe === s).reduce((acc, b) => acc + b.net, 0);
  const bornes = bornesPeriode(periode);

  const cellule = (id: string, cle: Champ, step = 1000, nom: string) => (
    <Num
      readOnly={!peutEditer}
      value={brouillon.val(id, cle)}
      step={step}
      label={`${LIBELLE[cle]} — ${nom}`}
      onChange={(n) => brouillon.set(id, cle, n)}
      onBlur={() => brouillon.flush(id)}
    />
  );

  return (
    <div className="bg-background">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Ressources humaines</p>
          <h1 className="text-3xl font-bold text-foreground">POITIERS COWORKING</h1>
          <p className="mt-1 text-sm text-muted-foreground">Récapitulatif des salaires</p>
          <p className="mt-1 text-sm font-medium text-primary">Période de paie : {libellePeriode(periode)}</p>
          <p className="mt-1 text-sm text-muted-foreground">Tout est calculé automatiquement et lié aux bulletins de paie.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-2 print:hidden">
            <CalendarRange className="h-4 w-4 text-primary" />
            <select
              value={Number(mois)}
              onChange={(ev) => onPeriode(`${annee}-${String(ev.target.value).padStart(2, "0")}`)}
              aria-label="Mois de paie"
              className="rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:border-ring"
            >
              {MOIS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <select
              value={Number(annee)}
              onChange={(ev) => onPeriode(`${ev.target.value}-${mois}`)}
              aria-label="Année de paie"
              className="rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:border-ring"
            >
              {annees.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            {!cloture && bulletins.length > 0 ? (
              <BoutonConfirmation
                variant="default"
                size="sm"
                libelle={<><FileText className="h-3.5 w-3.5" /> Générer les bulletins du mois</>}
                titre={`Générer et clôturer ${libellePeriode(periode)} ?`}
                consequence={`Les ${bulletins.length} bulletins seront figés (période du ${bornes.du} au ${bornes.au}) et les saisies ne seront plus modifiables.`}
                motCle="CLOTURER"
                confirmer="Générer et clôturer"
                onConfirmer={() => generer({ periode })}
                succes={(r: any) => `${r.bulletins} bulletin(s) générés – ${libellePeriode(periode)}`}
              />
            ) : (
              <span className="rounded bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground">
                {cloture ? "Mois clôturé — bulletins figés" : "Aucun employé"}
              </span>
            )}
          </div>
          <Link to="/employes" className={LIEN}><UsersRound className="h-3.5 w-3.5" /> Employés</Link>
          <Link to="/paie/liste" className={LIEN}><FileText className="h-3.5 w-3.5" /> Liste des salaires</Link>
          <Link to={`/paie/bulletins?periode=${periode}`} className={LIEN}><Printer className="h-3.5 w-3.5" /> Bulletins du mois</Link>
          <Link to="/paie/archives" className={LIEN}><History className="h-3.5 w-3.5" /> Historique</Link>
          <Link to="/paie/primes" className={LIEN}><Coins className="h-3.5 w-3.5" /> Primes &amp; charges</Link>
          <Link to="/paie/archives" className={LIEN}><Archive className="h-3.5 w-3.5" /> Bulletins archivés</Link>
          <Link to="/paie/courrier" className={LIEN}><Mail className="h-3.5 w-3.5" /> Courrier de paie</Link>
        </div>
      </header>

      <div className="mb-6"><TauxMoisCarte bareme={bareme} periode={periode} /></div>
      {paie?.erreur && <p className="mb-4 text-sm font-medium text-destructive">{paie.erreur}</p>}

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th colSpan={20} className="border border-border bg-primary px-3 py-2 text-center text-base font-bold uppercase text-primary-foreground">
                Récapitulatif salaire
              </th>
            </tr>
            <tr className="bg-muted text-[11px] uppercase text-muted-foreground">
              {["Noms et prénoms", "Salaire journalier", "Nbre de jours travaillés", "Salaire de base", "Primes fixes / congé", "Heures sup / ancienneté"].map((h) => (
                <th key={h} className="border border-border px-2 py-2">{h}</th>
              ))}
              <th className="border border-border bg-chart-2/30 px-2 py-2">Total 1</th>
              {["Sanctions", "Absence", "Dettes de soins"].map((h) => <th key={h} className="border border-border px-2 py-2">{h}</th>)}
              <th className="border border-border px-2 py-2">Acompte / dette / impôts &amp; CNPS</th>
              <th className="border border-border px-2 py-2">Mutuelle %</th>
              <th className="border border-border px-2 py-2">Mutuelle</th>
              <th className="border border-border bg-chart-2/30 px-2 py-2">Total 2</th>
              <th className="border border-border bg-chart-1/40 px-2 py-2">Salaire SESAME</th>
              <th className="border border-border bg-chart-4/40 px-2 py-2">Salaire SOFINA</th>
              <th className="border border-border bg-chart-2/50 px-2 py-2">Salaire SGC</th>
              <th className="border border-border px-2 py-2">Bulletin</th>
            </tr>
          </thead>
          <tbody>
            {bulletins.map((b) => {
              const id = String(b.employeId);
              const d = b.details;
              return (
                <tr key={id} className="hover:bg-accent/40">
                  <td className="border border-border px-2 py-1">
                    <div className="w-44 px-1 py-0.5 font-semibold">{b.nom}</div>
                    <div className="mt-1 flex items-center gap-1">
                      <span className="w-32 px-1 text-[10px] text-muted-foreground">{b.fonction || "Fonction"}</span>
                      <FicheEmploye b={b} recap={recap} disabled={!peutEditer} />
                      <SaisieDuMoisDialog b={b} brouillon={brouillon} bareme={bareme} periode={periode} disabled={!peutEditer} />
                    </div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground">CNPS {b.cnps || "—"} · {b.adresse || "adresse —"}</div>
                  </td>
                  <td className="border border-border px-2 py-1 text-right tabular-nums">
                    <div className="text-[10px] text-muted-foreground">Brut&nbsp;{num(b.salaireBrut)}</div>
                    <div className="font-medium">{num(d?.salaireJournalier ?? 0)}</div>
                  </td>
                  <td className="border border-border px-2 py-1 text-right">{cellule(id, "joursTravailles", 1, b.nom)}</td>
                  <td className="border border-border px-2 py-1 text-right font-medium tabular-nums">{num(d?.salaireBase ?? 0)}</td>
                  <td className="border border-border px-2 py-1 text-right">
                    {cellule(id, "primesVariables", 1000, b.nom)}
                    <div className="mt-1 text-[10px] text-muted-foreground">Congés pris&nbsp;<span className="tabular-nums">{d?.congesPris ?? 0}</span> j</div>
                    <div className="text-[10px] text-muted-foreground">Ind. congés : {num(d?.indemniteConges ?? 0)}</div>
                  </td>
                  <td className="border border-border px-2 py-1 text-right">
                    {cellule(id, "heuresSup", 1000, b.nom)}
                    <div className="mt-1">{cellule(id, "anciennete", 1000, b.nom)}</div>
                  </td>
                  <td className="border border-border bg-chart-2/20 px-2 py-1 text-right font-semibold tabular-nums">{num(d?.total1 ?? b.brut)}</td>
                  <td className="border border-border px-2 py-1 text-right">{cellule(id, "sanctions", 1000, b.nom)}</td>
                  <td className="border border-border px-2 py-1 text-right">{cellule(id, "absences", 1000, b.nom)}</td>
                  <td className="border border-border px-2 py-1 text-right">{cellule(id, "dettesSoins", 1000, b.nom)}</td>
                  <td className="border border-border px-2 py-1 text-right">
                    {cellule(id, "acompte", 1000, b.nom)}
                    <div className="mt-1 text-[10px] text-muted-foreground">+ retenues {num(d?.chargesSalariales ?? 0)}</div>
                    <div className="font-medium tabular-nums">{num(d?.acompteImpotsCnps ?? 0)}</div>
                  </td>
                  <td className="border border-border px-2 py-1 text-right">{cellule(id, "mutuellePct", 0.5, b.nom)}</td>
                  <td className="border border-border px-2 py-1 text-right tabular-nums">{num(d?.mutuelle ?? 0)}</td>
                  <td className="border border-border bg-chart-2/20 px-2 py-1 text-right font-semibold tabular-nums">{num(d?.total2 ?? b.net)}</td>
                  {SOCIETES.map((s) => (
                    <td key={s} className="border border-border px-2 py-1 text-center">
                      <button
                        type="button"
                        disabled={!peutEditer}
                        aria-pressed={b.societe === s}
                        onClick={async () => {
                          if (b.societe === s) return;
                          try {
                            await recap.modifierEmploye({ employeId: b.employeId, societe: s });
                            toast.success(`Salaire affecté à ${s}`);
                          } catch (e: any) { toast.error("Affectation refusée", { description: e?.message }); }
                        }}
                        className={`w-full rounded px-2 py-1 text-[11px] font-semibold transition ${b.societe === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"} disabled:cursor-not-allowed disabled:opacity-60`}
                      >
                        {b.societe === s ? num(b.net) : "⚑"}
                      </button>
                    </td>
                  ))}
                  <td className="border border-border px-2 py-1 text-center">
                    <Link
                      to={`/paie/bulletins?periode=${periode}&employe=${encodeURIComponent(b.matricule)}`}
                      className="rounded bg-secondary px-2 py-1 text-[11px] font-medium text-secondary-foreground hover:bg-accent"
                    >
                      Ouvrir
                    </Link>
                  </td>
                </tr>
              );
            })}
            {paie && bulletins.length === 0 && (
              <tr>
                <td colSpan={20} className="border border-border px-4 py-12">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <UsersRound className="h-10 w-10 text-muted-foreground" />
                    <p className="text-sm font-medium text-foreground">Aucun employé actif pour ce mois</p>
                    <Link to="/employes" className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground">Aller aux employés</Link>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="bg-muted font-semibold">
              <td className="border border-border px-2 py-2" colSpan={14}>Totaux par société</td>
              {SOCIETES.map((s) => (
                <td key={s} className="border border-border px-2 py-2 text-right tabular-nums">{num(totalPar(s))}</td>
              ))}
              <td className="border border-border" />
            </tr>
          </tfoot>
        </table>
      </div>

      <section className="mt-6 rounded-lg border border-border bg-card p-4 text-sm">
        <div className="space-y-1 text-xs text-muted-foreground">
          <p><strong className="text-foreground">TOTAL 1</strong> = salaire de base + primes + congés + heures sup + ancienneté</p>
          <p><strong className="text-foreground">TOTAL 2 (salaire net)</strong> = TOTAL 1 − sanctions − absence − dettes de soins − (acompte + impôts &amp; CNPS) − mutuelle</p>
          <p>Salaire journalier = salaire brut / 30 · Salaire de base = journalier × jours travaillés · Mutuelle = TOTAL 1 × %</p>
        </div>
      </section>
    </div>
  );
}

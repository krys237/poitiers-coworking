/**
 * Onglet « Option A — Tout visible » : les 18 colonnes tiennent à l'écran sans
 * défilement horizontal à 1440 px, grâce à la barre latérale repliée en rail
 * (64 px) et à la densité « registre » (une ligne par employé, chiffres en mono).
 *
 * Saisie directement dans la cellule : trait pointillé = modifiable, anneau au
 * focus, liseré ocre le temps de l'enregistrement automatique. Les cellules
 * composées (primes / congé, heures sup / ancienneté) s'ouvrent en mini-fenêtre.
 */
import * as React from "react";
import { Link } from "react-router-dom";
import { FileCheck2Icon, PencilIcon } from "lucide-react";
import { num } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useRailLateral } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChampNombre } from "@/components/app/champs";
import { SqueletteTableau } from "@/components/app/chargement";
import { TableVide } from "@/components/ui/table";
import {
  type Brouillon, type BulletinLigne, type Champ, type FiltreRecap, type RecapPaie, type Valeurs, LIBELLE, SOCIETES, UNITE,
  BarreFiltre, BarreRecap, EtatLigneBadge, LegendeRecap, PastilleSociete, TuilesRecap, totaux,
} from "./commun";

/** Cellule modifiable en place : texte formaté au repos, saisie brute au focus. */
function CelluleInline({
  libelle, valeur, onChange, onCommit, modifie, lectureSeule, decimales = false, className,
}: {
  libelle: string; valeur: number; onChange: (v: number) => void; onCommit: () => void;
  modifie?: boolean; lectureSeule?: boolean; decimales?: boolean; className?: string;
}) {
  const [focus, setFocus] = React.useState(false);
  const [brut, setBrut] = React.useState("");
  if (lectureSeule) {
    return <span className={cn("tabular-nums", className)}>{valeur === 0 ? <span className="text-encre-pale">0</span> : num(valeur)}</span>;
  }
  const affiche = focus ? brut : decimales ? String(valeur).replace(".", ",") : num(valeur);
  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={libelle}
      title={libelle}
      value={affiche}
      onFocus={(e) => { setBrut(decimales ? String(valeur).replace(".", ",") : String(valeur)); setFocus(true); e.currentTarget.select(); }}
      onBlur={() => { setFocus(false); onCommit(); }}
      onChange={(e) => {
        const raw = e.target.value;
        setBrut(raw);
        const n = Number(raw.replace(/\s| /g, "").replace(",", "."));
        if (!Number.isNaN(n)) onChange(n);
      }}
      onKeyDown={(e) => { if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur(); }}
      className={cn(
        "h-7 w-full min-w-[3.25rem] rounded-sm border border-transparent bg-transparent px-1.5 text-right font-mono text-[11.5px] tabular-nums",
        "border-b-sky-300 [border-bottom-style:dashed] hover:border-filet hover:bg-surface",
        "outline-none focus-visible:border-ocean-ceruleen focus-visible:bg-surface focus-visible:ring-[3px] focus-visible:ring-ring/30",
        modifie && "border-ocre bg-ocre-clair/60 [border-bottom-style:solid]",
        className
      )}
    />
  );
}

/** Cellule composée : total affiché, détail (2 à 4 champs) dans une mini-fenêtre. */
function CellulePopover({
  b, champs, total, sousTitre, brouillon, lectureSeule, libelle,
}: {
  b: BulletinLigne; champs: Champ[]; total: number; sousTitre?: React.ReactNode; brouillon: Brouillon; lectureSeule: boolean; libelle: string;
}) {
  const id = String(b.employeId);
  const [open, setOpen] = React.useState(false);
  const [v, setV] = React.useState<Partial<Valeurs>>({});
  React.useEffect(() => {
    if (open) setV(Object.fromEntries(champs.map((c) => [c, brouillon.val(id, c)])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const totalLocal = champs.reduce((s, c) => s + (v[c] ?? 0), 0);
  if (lectureSeule) {
    return (
      <div className="text-right">
        <span className="font-mono tabular-nums">{num(total)}</span>
        {sousTitre && <div className="text-[10px] leading-none text-encre-pale">{sousTitre}</div>}
      </div>
    );
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${libelle} — ${b.nom}`}
          title={`${libelle} — ${b.nom} (détail)`}
          className={cn(
            "group/pop flex w-full flex-col items-end rounded-sm px-1.5 py-0.5 text-right",
            "hover:bg-surface hover:ring-1 hover:ring-filet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30",
            brouillon.modifie(id) && "bg-ocre-clair/40"
          )}
        >
          <span className="inline-flex items-center gap-1 border-b border-dashed border-sky-300 font-mono text-[11.5px] tabular-nums">
            {num(total)}
            <PencilIcon className="h-2.5 w-2.5 text-encre-pale opacity-0 transition-opacity group-hover/pop:opacity-100" />
          </span>
          {sousTitre && <span className="text-[10px] leading-none text-encre-pale">{sousTitre}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3">
        <div className="mb-2">
          <div className="text-sm font-semibold">{libelle}</div>
          <div className="text-xs text-encre-douce">{b.nom}</div>
        </div>
        <div className="flex flex-col gap-2">
          {champs.map((c) => (
            <ChampNombre
              key={c}
              libelle={LIBELLE[c]}
              unite={UNITE[c]}
              valeur={v[c] ?? 0}
              onChange={(n) => setV({ ...v, [c]: n })}
              min={0}
            />
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-filet-clair pt-2">
          <span className="text-xs text-encre-douce">
            Total <b className="font-mono tabular-nums text-encre">{num(totalLocal)}</b>
          </span>
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Annuler</Button>
            <Button size="sm" onClick={async () => { await brouillon.enregistrer(id, v); setOpen(false); }}>Enregistrer</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

const COLONNES = [
  "w-[178px]", "w-[66px]", "w-[52px]", "w-[74px]", "w-[82px]", "w-[78px]", "w-[78px]", "w-[58px]", "w-[58px]",
  "w-[60px]", "w-[94px]", "w-[46px]", "w-[60px]", "w-[78px]", "w-[70px]", "w-[70px]", "w-[70px]", "w-[32px]",
];
const TH = "px-1.5 py-1.5 text-right text-[10px] font-semibold uppercase leading-tight tracking-wide whitespace-normal align-bottom";
const TD = "h-10 px-1.5 text-right font-mono text-[11.5px] tabular-nums whitespace-nowrap border-b border-filet-clair";

export function RecapToutVisible({
  periode, onPeriode, recap, brouillon, filtre, actif,
}: {
  periode: string; onPeriode: (p: string) => void; recap: RecapPaie; brouillon: Brouillon; filtre: FiltreRecap; actif: boolean;
}) {
  useRailLateral(actif);
  const { cloture, paie } = recap;
  const bulletins = filtre.visibles;
  const t = totaux(bulletins);
  const hauteurMax = filtre.hauteurMax(40, 46, 42);
  const ro = cloture;

  const cel = (b: BulletinLigne, c: Champ, decimales = false) => {
    const id = String(b.employeId);
    return (
      <CelluleInline
        libelle={`${LIBELLE[c]} — ${b.nom}`}
        valeur={brouillon.val(id, c)}
        onChange={(v) => brouillon.set(id, c, v)}
        onCommit={() => brouillon.flush(id)}
        modifie={brouillon.modifie(id)}
        lectureSeule={ro}
        decimales={decimales}
      />
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <BarreRecap periode={periode} onPeriode={onPeriode} recap={recap} tauxLong />
      <TuilesRecap recap={recap} periode={periode} />
      {paie?.erreur && <p className="text-sm font-medium text-carmin">{paie.erreur}</p>}
      <BarreFiltre filtre={filtre} />

      {paie === undefined ? (
        <SqueletteTableau colonnes={18} lignes={6} />
      ) : (
        <div
          className="overflow-auto rounded-xl border border-filet bg-surface"
          style={hauteurMax ? { maxHeight: hauteurMax } : undefined}
        >
          <table className="w-full min-w-[1180px] table-fixed border-collapse text-sm">
            {/* Largeurs calibrées pour 1336 px utiles (1440 − rail 64 − marges) : aucune colonne ne déborde. */}
            <colgroup>
              {COLONNES.map((w, i) => <col key={i} className={w} />)}
            </colgroup>
            <thead className="sticky top-0 z-10 bg-sceau text-primary-foreground">
              <tr>
                <th className={cn(TH, "sticky left-0 z-20 bg-sceau text-left")}>Noms et prénoms</th>
                <th className={TH}>Sal. journalier</th>
                <th className={TH}>Jours trav.</th>
                <th className={TH}>Salaire de base</th>
                <th className={TH}>Primes fixes / congé</th>
                <th className={TH}>H. sup / ancienneté</th>
                <th className={cn(TH, "bg-ocean-nuit")}>Total 1</th>
                <th className={TH}>Sanctions</th>
                <th className={TH}>Absence</th>
                <th className={TH}>Dettes de soins</th>
                <th className={TH}>Acompte / dette / impôts &amp; CNPS</th>
                <th className={TH}>Mut. %</th>
                <th className={TH}>Mutuelle</th>
                <th className={cn(TH, "bg-ocean-nuit")}>Total 2</th>
                <th className={cn(TH, "bg-[#0a5c8f]")}>Sal. SESAME</th>
                <th className={cn(TH, "bg-[#0a5c8f]")}>Sal. SOFINA</th>
                <th className={cn(TH, "bg-[#0a5c8f]")}>Sal. SGC</th>
                <th className={TH} aria-label="Bulletin" />
              </tr>
            </thead>
            <tbody className="[&>tr:nth-child(even)]:bg-bande [&>tr:hover]:bg-sceau-clair/70">
              {bulletins.map((b) => {
                const id = String(b.employeId);
                const d = b.details;
                return (
                  <tr key={id}>
                    <td className={cn(TD, "sticky left-0 z-10 bg-inherit text-left font-sans leading-tight shadow-[6px_0_12px_-8px_rgba(15,23,42,.25)]")}>
                      <div className="flex flex-col gap-0.5 overflow-hidden">
                        <span className="truncate text-[13px] font-semibold" title={b.nom}>{b.nom}</span>
                        <span className="flex items-center gap-1.5 text-[10px] text-encre-pale">
                          <span className="truncate">{b.fonction ?? "—"}</span>
                          <PastilleSociete societe={b.societe} />
                          <EtatLigneBadge etat={brouillon.etat(id)} />
                        </span>
                      </div>
                    </td>
                    <td className={cn(TD, "text-encre-douce")}>
                      {num(d?.salaireJournalier ?? 0)}
                      <div className="font-sans text-[10px] leading-none text-encre-pale">brut {num(b.salaireBrut)}</div>
                    </td>
                    <td className={TD}>{cel(b, "joursTravailles")}</td>
                    <td className={TD}>{num(d?.salaireBase ?? 0)}</td>
                    <td className={TD}>
                      <CellulePopover
                        b={b} brouillon={brouillon} lectureSeule={ro} libelle="Primes fixes / congé"
                        champs={["primesVariables", "transport", "primeAssiduite", "indemniteLogement"]}
                        total={(d?.primes ?? 0) + (d?.indemniteConges ?? 0)}
                        sousTitre={`${d?.congesPris ?? 0} j congés`}
                      />
                    </td>
                    <td className={TD}>
                      <CellulePopover
                        b={b} brouillon={brouillon} lectureSeule={ro} libelle="Heures sup / ancienneté"
                        champs={["heuresSup", "anciennete"]}
                        total={(d?.heuresSup ?? 0) + (d?.anciennete ?? 0)}
                      />
                    </td>
                    <td className={cn(TD, "bg-ocean-brume font-semibold")}>{num(d?.total1 ?? b.brut)}</td>
                    <td className={TD}>{cel(b, "sanctions")}</td>
                    <td className={TD}>{cel(b, "absences")}</td>
                    <td className={TD}>{cel(b, "dettesSoins")}</td>
                    <td className={TD}>
                      {cel(b, "acompte")}
                      <div className="font-sans text-[10px] leading-none text-encre-pale">
                        = <b className="font-mono text-encre">{num(d?.acompteImpotsCnps ?? 0)}</b> avec impôts
                      </div>
                    </td>
                    <td className={TD}>{cel(b, "mutuellePct", true)}</td>
                    <td className={TD}>{num(d?.mutuelle ?? 0)}</td>
                    <td className={cn(TD, "bg-ocean-brume font-semibold")}>{num(d?.total2 ?? b.net)}</td>
                    {SOCIETES.map((s) => (
                      <td key={s} className={cn(TD, "font-semibold")}>{b.societe === s ? num(b.net) : <span className="text-encre-pale">—</span>}</td>
                    ))}
                    <td className={cn(TD, "px-1 text-center")}>
                      <Link
                        to={`/paie/bulletins?periode=${periode}&employe=${encodeURIComponent(b.matricule)}`}
                        title={`Ouvrir le bulletin — ${b.nom}`}
                        aria-label={`Ouvrir le bulletin — ${b.nom}`}
                        className="inline-flex h-6.5 w-6.5 items-center justify-center rounded-md border border-filet bg-surface text-ocean-profond hover:bg-ocean-brume"
                      >
                        <FileCheck2Icon className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {bulletins.length === 0 && (
                <TableVide colonnes={18}>{filtre.recherche ? "Aucun employé ne correspond à la recherche." : "Aucun employé actif pour ce mois."}</TableVide>
              )}
            </tbody>
            {bulletins.length > 0 && (
              <tfoot className="sticky bottom-0 z-10 border-t-4 border-double border-encre bg-surface font-semibold">
                <tr>
                  <td className={cn(TD, "sticky left-0 z-10 bg-surface text-left font-sans")}>
                    TOTAL · {t.effectif}{filtre.recherche ? ` / ${filtre.total}` : ""} employés
                  </td>
                  <td className={TD} /><td className={TD} />
                  <td className={TD}>{num(t.salaireBase)}</td>
                  <td className={TD}>{num(t.primes)}</td>
                  <td className={TD}>{num(t.heuresSupAnciennete)}</td>
                  <td className={cn(TD, "bg-ocean-brume")}>{num(t.total1)}</td>
                  <td className={TD} /><td className={TD} /><td className={TD} />
                  <td className={TD}>{num(t.acompteImpotsCnps)}</td>
                  <td className={TD} />
                  <td className={TD}>{num(t.mutuelle)}</td>
                  <td className={cn(TD, "bg-ocean-brume")}>{num(t.total2)}</td>
                  {SOCIETES.map((s) => <td key={s} className={TD}>{num(t.netSociete[s])}</td>)}
                  <td className={TD} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
      <LegendeRecap />
    </div>
  );
}

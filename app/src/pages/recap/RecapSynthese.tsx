/**
 * Onglet « Option C — Synthèse + fiche » : un tableau de lecture à 8 colonnes,
 * et la ligne sélectionnée s'ouvre dans un volet ancré à droite avec les 13
 * champs groupés (temps de travail, gains, retenues) et l'aperçu en direct.
 * Le plus lisible ; un clic de plus pour saisir, mais jamais d'ambiguïté sur
 * la personne et le mois que l'on modifie.
 */
import * as React from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { CheckIcon, ChevronRightIcon, FileCheck2Icon, XIcon } from "lucide-react";
import { libellePeriode, num } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChampNombre } from "@/components/app/champs";
import { SqueletteTableau } from "@/components/app/chargement";
import { Montant } from "@/components/app/montant";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow, TableVide } from "@/components/ui/table";
import {
  type Brouillon, type BulletinLigne, type Champ, type FiltreRecap, type RecapPaie, type Valeurs, LIBELLE, UNITE,
  BarreFiltre, BarreRecap, LegendeRecap, PastilleSociete, TuilesRecap, apercuBulletin, baremeClient, totaux, validerValeurs,
} from "./commun";

const GROUPES: { titre: string; champs: Champ[]; colonnes: string }[] = [
  { titre: "Temps de travail", champs: ["joursTravailles", "absences"], colonnes: "grid-cols-3" },
  { titre: "Gains", champs: ["primesVariables", "transport", "primeAssiduite", "indemniteLogement", "heuresSup", "anciennete"], colonnes: "grid-cols-3" },
  { titre: "Retenues", champs: ["sanctions", "dettesSoins", "acompte", "mutuellePct"], colonnes: "grid-cols-4" },
];

/** Volet de saisie d'un employé (ancré, pas superposé : le tableau reste visible). */
function FicheSaisie({
  b, brouillon, bareme, periode, cloture, onFermer,
}: {
  b: BulletinLigne; brouillon: Brouillon; bareme: any; periode: string; cloture: boolean; onFermer: () => void;
}) {
  const id = String(b.employeId);
  const [v, setV] = React.useState<Valeurs>(() => brouillon.valeurs(id));
  const [err, setErr] = React.useState<Partial<Record<Champ, string>>>({});
  const [enCours, setEnCours] = React.useState(false);
  // Nouvel employé sélectionné → on repart de ses valeurs.
  React.useEffect(() => { setV(brouillon.valeurs(id)); setErr({}); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const apercu = apercuBulletin(b, v, baremeClient(bareme));
  const d = b.details;

  const enregistrer = async () => {
    const e2 = validerValeurs(v);
    setErr(e2);
    if (Object.keys(e2).length) { toast.error("Corrigez les champs en rouge."); return; }
    setEnCours(true);
    try {
      await brouillon.enregistrer(id, v);
      toast.success(`Saisie enregistrée — ${b.nom}`, { description: libellePeriode(periode) });
    } finally { setEnCours(false); }
  };

  return (
    <aside
      className="flex w-full flex-col overflow-hidden rounded-xl border border-filet bg-surface lg:w-[27.5rem] lg:shrink-0"
      aria-label={`Saisie du mois — ${b.nom}`}
    >
      <div className="flex items-start justify-between gap-3 border-b border-filet px-5 py-4">
        <div className="min-w-0">
          <div className="truncate text-base font-semibold">{b.nom}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-encre-douce">
            <span>{b.fonction ?? "—"}</span>
            <PastilleSociete societe={b.societe} />
            <span className="font-mono tabular-nums text-encre-pale">{b.matricule} · brut {num(b.salaireBrut)}</span>
          </div>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onFermer} aria-label="Fermer la fiche"><XIcon /></Button>
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-3">
        {cloture && (
          <p className="rounded-md border border-filet bg-papier px-3 py-2 text-xs text-encre-douce">
            Mois clôturé : valeurs figées, lecture seule.
          </p>
        )}
        {GROUPES.map((g) => (
          <section key={g.titre}>
            <h3 className="mb-2 text-2xs font-bold uppercase tracking-[0.08em] text-ocean-profond">{g.titre}</h3>
            <div className={cn("grid gap-2.5", g.colonnes)}>
              {g.titre === "Temps de travail" && (
                <>
                  <ChampNombre libelle={LIBELLE.joursTravailles} unite="j" valeur={v.joursTravailles} onChange={(n) => setV({ ...v, joursTravailles: n })} min={0} max={31} disabled={cloture} erreur={err.joursTravailles} />
                  <ChampNombre libelle="Congés pris" unite="j" valeur={d?.congesPris ?? 0} onChange={() => {}} disabled aide="Planning des absences" />
                </>
              )}
              {g.champs.filter((c) => c !== "joursTravailles").map((c) => (
                <ChampNombre
                  key={c}
                  libelle={LIBELLE[c]}
                  unite={UNITE[c]}
                  valeur={v[c]}
                  onChange={(n) => setV({ ...v, [c]: n })}
                  min={0}
                  step={c === "mutuellePct" ? 0.5 : 1000}
                  disabled={cloture}
                  erreur={err[c]}
                />
              ))}
            </div>
          </section>
        ))}

        <div className="rounded-lg border border-filet bg-papier px-3.5 py-3">
          <div className="mb-2 text-2xs font-semibold text-encre-douce">Aperçu en direct</div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <div><dt className="text-encre-pale">Salaire de base</dt><dd className="font-mono font-semibold tabular-nums">{apercu ? num(apercu.details.salaireBase) : "…"}</dd></div>
            <div><dt className="text-encre-pale">Total 1</dt><dd className="font-mono font-semibold tabular-nums">{apercu ? num(apercu.details.total1) : "…"}</dd></div>
            <div><dt className="text-encre-pale">Impôts &amp; CNPS + acompte</dt><dd className="font-mono font-semibold tabular-nums text-carmin">{apercu ? `−${num(apercu.details.acompteImpotsCnps)}` : "…"}</dd></div>
            <div><dt className="text-encre-pale">Net à payer · Total 2</dt><dd className="font-mono text-base font-semibold tabular-nums text-ocean-profond">{apercu ? <Montant valeur={apercu.net} /> : "…"}</dd></div>
          </dl>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-filet px-5 py-3">
        <Link
          to={`/paie/bulletins?periode=${periode}&employe=${encodeURIComponent(b.matricule)}`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-ocean-profond hover:underline"
        >
          <FileCheck2Icon className="h-3.5 w-3.5" /> Ouvrir le bulletin
        </Link>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setV(brouillon.valeurs(id)); setErr({}); }} disabled={cloture}>Annuler</Button>
          <Button onClick={enregistrer} disabled={cloture || enCours}><CheckIcon /> Enregistrer la saisie</Button>
        </div>
      </div>
    </aside>
  );
}

export function RecapSynthese({
  periode, onPeriode, recap, brouillon, filtre,
}: {
  periode: string; onPeriode: (p: string) => void; recap: RecapPaie; brouillon: Brouillon; filtre: FiltreRecap;
}) {
  const { cloture, paie, bareme } = recap;
  const bulletins = filtre.visibles;
  const [selection, setSelection] = React.useState<string | null>(null);
  React.useEffect(() => setSelection(null), [periode]);
  const t = totaux(bulletins);
  // La fiche reste ouverte même si la recherche masque la ligne sélectionnée.
  const choisi = recap.bulletins.find((b) => String(b.employeId) === selection) ?? null;
  const retenues = (b: BulletinLigne) => (b.details?.total1 ?? b.brut) - (b.details?.total2 ?? b.net);

  return (
    <div className="flex flex-col gap-3">
      <BarreRecap periode={periode} onPeriode={onPeriode} recap={recap} />
      <TuilesRecap recap={recap} periode={periode} />
      {paie?.erreur && <p className="text-sm font-medium text-carmin">{paie.erreur}</p>}
      <BarreFiltre filtre={filtre} />

      <div className="flex flex-col gap-3.5 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          {paie === undefined ? (
            <SqueletteTableau colonnes={8} lignes={6} />
          ) : (
            <Table classNameConteneur="rounded-xl" hauteurMax={filtre.hauteurMax(49, 40, 44)}>
              <TableHeader>
                <TableRow>
                  <TableHead>Noms et prénoms</TableHead>
                  <TableHead numerique>Jours</TableHead>
                  <TableHead numerique>Salaire de base</TableHead>
                  <TableHead numerique className="bg-ocean-nuit">Total 1</TableHead>
                  <TableHead numerique>Retenues</TableHead>
                  <TableHead numerique className="bg-ocean-nuit">Total 2 · net</TableHead>
                  <TableHead>Société</TableHead>
                  <TableHead aria-label="Ouvrir" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {bulletins.map((b) => {
                  const id = String(b.employeId);
                  const d = b.details;
                  const active = selection === id;
                  return (
                    <TableRow
                      key={id}
                      active={active}
                      className={cn("cursor-pointer", active && "shadow-[inset_3px_0_0_var(--ocean-ceruleen)]")}
                      onClick={() => setSelection(active ? null : id)}
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelection(active ? null : id); } }}
                      aria-selected={active}
                    >
                      <TableCell className="leading-tight">
                        <div className="whitespace-nowrap text-[13px] font-semibold">{b.nom}</div>
                        <div className="flex items-center gap-1.5 whitespace-nowrap text-2xs text-encre-pale">
                          <span className="max-w-[14rem] truncate">{b.fonction ?? "—"}</span>
                          {brouillon.etat(id) === "enregistre" && <span className="text-emerald-700">Enregistré ✓</span>}
                        </div>
                      </TableCell>
                      <TableCell numerique className="font-mono text-xs">{brouillon.val(id, "joursTravailles")}</TableCell>
                      <TableCell numerique className="font-mono text-xs">{num(d?.salaireBase ?? 0)}</TableCell>
                      <TableCell numerique className="bg-ocean-brume font-mono text-xs font-semibold">{num(d?.total1 ?? b.brut)}</TableCell>
                      <TableCell numerique className="font-mono text-xs text-carmin">−{num(retenues(b))}</TableCell>
                      <TableCell numerique className="bg-ocean-brume font-mono text-xs font-semibold">{num(d?.total2 ?? b.net)}</TableCell>
                      <TableCell><PastilleSociete societe={b.societe} /></TableCell>
                      <TableCell className="text-ocean-profond"><ChevronRightIcon className={cn("h-4 w-4 transition-transform", active && "rotate-90")} /></TableCell>
                    </TableRow>
                  );
                })}
                {bulletins.length === 0 && (
                  <TableVide colonnes={8}>{filtre.recherche ? "Aucun employé ne correspond à la recherche." : "Aucun employé actif pour ce mois."}</TableVide>
                )}
              </TableBody>
              {bulletins.length > 0 && (
                <TableFooter>
                  <TableRow>
                    <TableCell>TOTAL · {t.effectif}{filtre.recherche ? ` / ${filtre.total}` : ""} employés</TableCell>
                    <TableCell />
                    <TableCell numerique className="font-mono text-xs">{num(t.salaireBase)}</TableCell>
                    <TableCell numerique className="bg-ocean-brume font-mono text-xs">{num(t.total1)}</TableCell>
                    <TableCell numerique className="font-mono text-xs text-carmin">−{num(t.retenues)}</TableCell>
                    <TableCell numerique className="bg-ocean-brume font-mono text-xs">{num(t.total2)}</TableCell>
                    <TableCell /><TableCell />
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          )}
          <LegendeRecap />
        </div>

        {choisi ? (
          <FicheSaisie b={choisi} brouillon={brouillon} bareme={bareme} periode={periode} cloture={cloture} onFermer={() => setSelection(null)} />
        ) : (
          <aside className="hidden w-[27.5rem] shrink-0 items-center justify-center rounded-xl border border-dashed border-filet bg-surface/60 p-6 text-center text-sm text-encre-douce lg:flex">
            Sélectionnez un employé pour ouvrir sa fiche de saisie du mois.
          </aside>
        )}
      </div>
    </div>
  );
}

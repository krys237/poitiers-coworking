import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarClock, FileSpreadsheet, Loader2, UsersRound } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { usePaie } from "@/lib/paie-store";
import { useRole } from "@/lib/role-store";
import { RoleSwitcher } from "@/components/role-switcher";
import { TauxMois } from "@/components/taux-mois";
import { calculer, fcfa, type Employe } from "@/lib/payroll";
import {
  ANNEES,
  MOIS,
  bornes,
  libellePeriode,
  joursDuMois,
  type Periode,
} from "@/lib/periode";

export const Route = createFileRoute("/mensuel")({
  head: () => ({
    meta: [
      { title: "Paie du mois – calcul automatique des bulletins" },
      {
        name: "description",
        content:
          "Saisissez absences, primes et heures supplémentaires par employé : les bulletins du mois se calculent seuls et alimentent l'historique.",
      },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "Paie du mois – calcul automatique" },
      {
        property: "og:description",
        content:
          "Saisie mensuelle par employé et génération automatique des bulletins.",
      },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PageMensuelle,
});

const CHAMPS: { cle: keyof Employe; label: string }[] = [
  { cle: "joursTravailles", label: "Jours" },
  { cle: "absences", label: "Absences" },
  { cle: "sanctions", label: "Sanctions" },
  { cle: "primesFixes", label: "Primes" },
  { cle: "primeTransport", label: "Transport" },
  { cle: "heuresSup", label: "Heures sup." },
  { cle: "anciennete", label: "Ancienneté" },
  { cle: "mutuellePct", label: "Mutuelle %" },
];

function PageMensuelle() {
  const { employes, maj, tauxDe, archiver } = usePaie();
  const { profil, peut } = useRole();
  const peutEditer = peut("paie:editer");
  const voitTout = peut("tous:voir");

  const now = new Date();
  const [periode, setPeriode] = useState<Periode>({
    mois: now.getMonth() + 1,
    annee: now.getFullYear(),
  });
  const [generation, setGeneration] = useState(false);

  const cle = `${periode.annee}-${String(periode.mois).padStart(2, "0")}`;
  const taux = tauxDe(cle);
  const visibles = useMemo(
    () => (voitTout ? employes : employes.filter((e) => e.nom === profil.utilisateur)),
    [employes, voitTout, profil.utilisateur],
  );
  const lignes = visibles.map((e) => ({ e, c: calculer(e, taux) }));
  const totalNet = lignes.reduce((s, l) => s + l.c.netAPayer, 0);

  const generer = () => {
    setGeneration(true);
    const b = bornes(periode);
    const patch = {
      periodeDu: b.du,
      periodeAu: b.au,
      datePaiement: b.paiement,
    };
    setTimeout(() => {
      try {
        visibles.forEach((e) => maj(e.id, patch));
        archiver(
          {
            cle,
            mois: periode.mois,
            annee: periode.annee,
            libelle: libellePeriode(periode),
          },
          visibles.map((e) => ({ ...e, ...patch })),
        );
        toast.success(
          `${visibles.length} bulletin(s) calculés et archivés – ${libellePeriode(periode)}`,
        );
      } catch {
        toast.error("La génération du mois a échoué");
      } finally {
        setGeneration(false);
      }
    }, 600);
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <CalendarClock className="h-6 w-6 text-primary" /> Paie du mois
          </h1>
          <p className="text-sm text-muted-foreground">
            Saisie des absences, primes et heures supplémentaires : chaque
            bulletin se recalcule aussitôt et alimente l'historique.
          </p>
        </div>
        <RoleSwitcher />
      </header>

      <nav className="mb-6 flex flex-wrap gap-3 text-sm">
        <Link to="/" className="text-primary underline">
          Récapitulatif des salaires
        </Link>
        <Link to="/planning" className="text-primary underline">
          Planning des absences
        </Link>
        <Link to="/historique" className="text-primary underline">
          Historique
        </Link>
        <Link to="/courrier" className="text-primary underline">
          Courrier de paie
        </Link>
      </nav>

      <section className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
        <label className="text-xs">
          <span className="mb-1 block text-muted-foreground">Mois</span>
          <select
            value={periode.mois}
            onChange={(e) =>
              setPeriode((p) => ({ ...p, mois: Number(e.target.value) }))
            }
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          >
            {MOIS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          <span className="mb-1 block text-muted-foreground">Année</span>
          <select
            value={periode.annee}
            onChange={(e) =>
              setPeriode((p) => ({ ...p, annee: Number(e.target.value) }))
            }
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          >
            {ANNEES.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-muted-foreground">
          {joursDuMois(periode)} jours calendaires – paiement le{" "}
          {bornes(periode).paiement}
        </p>
        <button
          type="button"
          disabled={!peutEditer || generation || visibles.length === 0}
          onClick={generer}
          className="ml-auto inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {generation ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileSpreadsheet className="h-4 w-4" />
          )}
          Calculer et archiver le mois
        </button>
      </section>

      <div className="mb-4">
        <TauxMois
          cle={cle}
          periode={libellePeriode(periode)}
          taux={taux}
          disabled={!peutEditer}
          onChange={() => undefined}
          onReset={() => undefined}
        />
      </div>

      {generation ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : visibles.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <UsersRound className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="font-medium">Aucun employé pour ce mois</p>
          <p className="mb-4 text-sm text-muted-foreground">
            Ajoutez vos employés ou importez votre fichier Excel/CSV depuis le
            récapitulatif.
          </p>
          <Link
            to="/"
            className="inline-block rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"
          >
            Aller au récapitulatif
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[1000px] text-sm">
            <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-2 text-left">Employé</th>
                {CHAMPS.map((c) => (
                  <th key={c.cle} className="p-2 text-right">
                    {c.label}
                  </th>
                ))}
                <th className="p-2 text-right">Brut</th>
                <th className="p-2 text-right">Retenues</th>
                <th className="p-2 text-right">Net à payer</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {lignes.map(({ e, c }) => (
                <tr key={e.id} className="border-t border-border">
                  <td className="p-2">
                    <span className="font-medium">{e.nom}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      {e.fonction} – {e.societe}
                    </span>
                  </td>
                  {CHAMPS.map((ch) => (
                    <td key={ch.cle} className="p-1 text-right">
                      <input
                        type="number"
                        min={0}
                        disabled={!peutEditer}
                        value={e[ch.cle] as number}
                        onChange={(ev) =>
                          maj(e.id, {
                            [ch.cle]: Math.max(0, Number(ev.target.value) || 0),
                          } as Partial<Employe>)
                        }
                        className="w-20 rounded border border-transparent bg-transparent px-1 py-1 text-right tabular-nums outline-none hover:border-border focus:border-ring disabled:opacity-60"
                      />
                    </td>
                  ))}
                  <td className="p-2 text-right tabular-nums">{fcfa(c.total1)}</td>
                  <td className="p-2 text-right tabular-nums text-destructive">
                    -{fcfa(c.totalRetenues)}
                  </td>
                  <td className="p-2 text-right font-semibold tabular-nums">
                    {fcfa(c.netAPayer)}
                  </td>
                  <td className="p-2 text-right">
                    <Link
                      to="/bulletin/$id"
                      params={{ id: e.id }}
                      className="text-xs text-primary underline"
                    >
                      Bulletin
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-muted/40 font-semibold">
              <tr>
                <td className="p-2" colSpan={CHAMPS.length + 3}>
                  Total net du mois
                </td>
                <td className="p-2 text-right tabular-nums">{fcfa(totalNet)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </main>
  );
}

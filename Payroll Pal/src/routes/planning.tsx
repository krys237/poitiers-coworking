import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarDays, UsersRound } from "lucide-react";
import { usePaie } from "@/lib/paie-store";
import { useRole } from "@/lib/role-store";
import { RoleSwitcher } from "@/components/role-switcher";
import { type Employe } from "@/lib/payroll";
import { ANNEES, MOIS, joursDuMois, libellePeriode, type Periode } from "@/lib/periode";

export const Route = createFileRoute("/planning")({
  head: () => ({
    meta: [
      { title: "Planning des absences et congés par employé" },
      {
        name: "description",
        content:
          "Saisissez par mois les jours travaillés, les congés acquis et pris et les absences de chaque employé.",
      },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "Planning des absences et congés" },
      {
        property: "og:description",
        content: "Congés, jours travaillés et absences par employé et par mois.",
      },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PagePlanning,
});

function PagePlanning() {
  const { employes, maj } = usePaie();
  const { profil, peut } = useRole();
  const peutEditer = peut("paie:editer");
  const voitTout = peut("tous:voir");

  const now = new Date();
  const [periode, setPeriode] = useState<Periode>({
    mois: now.getMonth() + 1,
    annee: now.getFullYear(),
  });
  const jours = joursDuMois(periode);

  const visibles = useMemo(
    () => (voitTout ? employes : employes.filter((e) => e.nom === profil.utilisateur)),
    [employes, voitTout, profil.utilisateur],
  );

  const set = (e: Employe, patch: Partial<Employe>) => {
    maj(e.id, patch);
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <CalendarDays className="h-6 w-6 text-primary" /> Planning des absences
          </h1>
          <p className="text-sm text-muted-foreground">
            Congés, jours travaillés et absences par employé pour{" "}
            {libellePeriode(periode)} ({jours} jours calendaires).
          </p>
        </div>
        <RoleSwitcher />
      </header>

      <nav className="mb-6 flex flex-wrap gap-3 text-sm">
        <Link to="/" className="text-primary underline">
          Récapitulatif
        </Link>
        <Link to="/mensuel" className="text-primary underline">
          Paie du mois
        </Link>
        <Link to="/historique" className="text-primary underline">
          Historique
        </Link>
      </nav>

      <section className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
        <label className="text-xs">
          <span className="mb-1 block text-muted-foreground">Mois</span>
          <select
            value={periode.mois}
            onChange={(e) => setPeriode((p) => ({ ...p, mois: Number(e.target.value) }))}
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
            onChange={(e) => setPeriode((p) => ({ ...p, annee: Number(e.target.value) }))}
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          >
            {ANNEES.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
      </section>

      {visibles.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <UsersRound className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="font-medium">Aucun employé à planifier</p>
          <p className="mb-4 text-sm text-muted-foreground">
            Ajoutez vos employés depuis le récapitulatif pour saisir leurs congés.
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
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-2 text-left">Employé</th>
                <th className="p-2 text-right">Jours travaillés</th>
                <th className="p-2 text-right">Absences (jours)</th>
                <th className="p-2 text-right">Congés acquis</th>
                <th className="p-2 text-right">Congés pris</th>
                <th className="p-2 text-right">Solde congés</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((e) => {
                const solde = Math.max(0, e.congesJoursAcquis - e.congesJoursPris);
                const trop = e.joursTravailles > jours;
                return (
                  <tr key={e.id} className="border-t border-border">
                    <td className="p-2">
                      <span className="font-medium">{e.nom}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        {e.fonction} – {e.societe}
                      </span>
                    </td>
                    {(
                      [
                        ["joursTravailles", jours],
                        ["absences", jours],
                        ["congesJoursAcquis", 60],
                        ["congesJoursPris", 60],
                      ] as [keyof Employe, number][]
                    ).map(([cle, max]) => (
                      <td key={cle} className="p-1 text-right">
                        <input
                          type="number"
                          min={0}
                          max={max}
                          disabled={!peutEditer}
                          value={e[cle] as number}
                          onChange={(ev) => {
                            const v = Math.max(0, Number(ev.target.value) || 0);
                            if (v > max) {
                              toast.error(
                                `Valeur limitée à ${max} pour ${e.nom}`,
                              );
                              set(e, { [cle]: max } as Partial<Employe>);
                              return;
                            }
                            set(e, { [cle]: v } as Partial<Employe>);
                          }}
                          className="w-24 rounded border border-transparent bg-transparent px-1 py-1 text-right tabular-nums outline-none hover:border-border focus:border-ring disabled:opacity-60"
                        />
                      </td>
                    ))}
                    <td className="p-2 text-right tabular-nums font-medium">
                      {solde}
                      {trop && (
                        <span className="block text-[11px] text-destructive">
                          jours &gt; mois
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

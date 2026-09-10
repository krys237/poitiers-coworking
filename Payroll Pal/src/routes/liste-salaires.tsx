import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { FileText, Printer, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { usePaie } from "@/lib/paie-store";
import { useRole } from "@/lib/role-store";
import { ANNEES, MOIS, bornes, libellePeriode, type Periode } from "@/lib/periode";
import { calculer, fcfa, type Societe } from "@/lib/payroll";

export const Route = createFileRoute("/liste-salaires")({
  head: () => ({
    meta: [
      { title: "Liste des salaires – Polyclinique de Poitiers" },
      {
        name: "description",
        content:
          "Récapitulatif général salaire et primes perçus : colonnes SOFINA, SGC, SESAME, primes et total, avec génération des bulletins du mois.",
      },
      { property: "og:title", content: "Liste des salaires – Poitiers" },
      {
        property: "og:description",
        content:
          "Tableau des salaires par société avec génération automatique des bulletins de paie.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ListeSalaires,
});

const SOCIETES: Societe[] = ["SOFINA", "SGC", "SESAME"];

function ListeSalaires() {
  const { employes, maj, archiver, tauxDe } = usePaie();
  const { peut, profil } = useRole();
  const maintenant = new Date();
  const [periode, setPeriode] = useState<Periode>({
    mois: maintenant.getMonth() + 1,
    annee: maintenant.getFullYear(),
  });
  const [generation, setGeneration] = useState(false);
  const [generes, setGeneres] = useState<string[] | null>(null);

  const peutEditer = peut("paie:editer");
  const tousVoir = peut("tous:voir");
  const cle = `${periode.annee}-${String(periode.mois).padStart(2, "0")}`;
  const taux = tauxDe(cle);

  const lignes = useMemo(() => {
    const visibles = tousVoir
      ? employes
      : employes.filter(
          (e) => e.nom.toUpperCase() === profil.utilisateur.toUpperCase(),
        );
    return visibles.map((e) => ({ e, c: calculer(e, taux) }));
  }, [employes, tousVoir, profil.utilisateur, taux]);

  const totalSociete = (s: Societe) =>
    lignes
      .filter((l) => l.e.societe === s)
      .reduce((acc, l) => acc + l.c.netAPayer, 0);
  const totalPrimes = lignes.reduce(
    (a, l) =>
      a +
      l.e.primesFixes +
      l.e.primeTransport +
      l.e.primeAssiduite +
      l.e.indemniteLogement,
    0,
  );
  const totalGeneral = lignes.reduce((a, l) => a + l.c.netAPayer, 0);

  const generer = () => {
    if (lignes.length === 0) {
      toast.error("Aucun employé dans la liste");
      return;
    }
    setGeneration(true);
    setGeneres(null);
    const b = bornes(periode);
    window.setTimeout(() => {
      const patch = {
        periodeDu: b.du,
        periodeAu: b.au,
        datePaiement: b.paiement,
      };
      lignes.forEach(({ e }) => maj(e.id, patch));
      archiver(
        {
          cle,
          mois: periode.mois,
          annee: periode.annee,
          libelle: libellePeriode(periode),
        },
        lignes.map(({ e }) => ({ ...e, ...patch })),
      );
      setGeneres(lignes.map((l) => l.e.id));
      setGeneration(false);
      toast.success(
        `${lignes.length} bulletin(s) générés – ${libellePeriode(periode)}`,
        { description: `Période du ${b.du} au ${b.au}` },
      );
    }, 600);
  };

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-[1400px]">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4 print:hidden">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Liste des salaires
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Mêmes colonnes que la liste papier : SOFINA, SGC, SESAME, primes
              et total. Les bulletins sont générés à partir de ces montants.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={periode.mois}
              onChange={(ev) =>
                setPeriode((p) => ({ ...p, mois: Number(ev.target.value) }))
              }
              aria-label="Mois"
              className="rounded border border-border bg-background px-2 py-1.5 text-xs"
            >
              {MOIS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
            <select
              value={periode.annee}
              onChange={(ev) =>
                setPeriode((p) => ({ ...p, annee: Number(ev.target.value) }))
              }
              aria-label="Année"
              className="rounded border border-border bg-background px-2 py-1.5 text-xs"
            >
              {ANNEES.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={generer}
              disabled={!peutEditer || generation}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              <FileText className="h-3.5 w-3.5" />
              {generation ? "Génération…" : "Générer les bulletins"}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
            >
              <Printer className="h-3.5 w-3.5" /> Imprimer
            </button>
            <Link
              to="/employes"
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
            >
              <Users className="h-3.5 w-3.5" /> Employés
            </Link>
          </div>
        </header>

        <h2 className="mb-3 text-center text-sm font-bold uppercase text-foreground">
          Récapitulatif général salaire et primes perçus de la Polyclinique de
          Poitiers – {libellePeriode(periode)}
        </h2>

        {generation ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : lignes.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-10 text-center">
            <Users className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium text-foreground">
              Aucun employé dans la liste
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Ajoutez ou importez vos employés pour générer les bulletins.
            </p>
            <Link
              to="/employes"
              className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
            >
              <Users className="h-3.5 w-3.5" /> Ouvrir la page Employés
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[900px] text-xs">
              <thead className="bg-muted">
                <tr className="text-left">
                  <th className="px-2 py-2">N°</th>
                  <th className="px-2 py-2">Noms et prénoms</th>
                  <th className="px-2 py-2 text-right">SOFINA</th>
                  <th className="px-2 py-2 text-right">SGC</th>
                  <th className="px-2 py-2 text-right">SESAME</th>
                  <th className="px-2 py-2 text-right">Primes</th>
                  <th className="px-2 py-2 text-right">Total perçu</th>
                  <th className="px-2 py-2 print:hidden">Bulletin</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map(({ e, c }, i) => {
                  const primes =
                    e.primesFixes +
                    e.primeTransport +
                    e.primeAssiduite +
                    e.indemniteLogement;
                  return (
                    <tr key={e.id} className="border-t border-border">
                      <td className="px-2 py-1.5 tabular-nums">{i + 1}</td>
                      <td className="px-2 py-1.5 font-medium">{e.nom}</td>
                      {SOCIETES.map((s) => (
                        <td
                          key={s}
                          className="px-2 py-1.5 text-right tabular-nums"
                        >
                          {e.societe === s ? fcfa(c.netAPayer) : "—"}
                        </td>
                      ))}
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {primes ? fcfa(primes) : "—"}
                      </td>
                      <td className="px-2 py-1.5 text-right font-semibold tabular-nums">
                        {fcfa(c.netAPayer)}
                      </td>
                      <td className="px-2 py-1.5 print:hidden">
                        <Link
                          to="/bulletin/$id"
                          params={{ id: e.id }}
                          className="text-primary underline"
                        >
                          {generes?.includes(e.id) ? "Voir (généré)" : "Voir"}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-muted font-semibold">
                <tr>
                  <td className="px-2 py-2" colSpan={2}>
                    TOTAUX ({lignes.length} employés)
                  </td>
                  {SOCIETES.map((s) => (
                    <td key={s} className="px-2 py-2 text-right tabular-nums">
                      {fcfa(totalSociete(s))}
                    </td>
                  ))}
                  <td className="px-2 py-2 text-right tabular-nums">
                    {fcfa(totalPrimes)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {fcfa(totalGeneral)}
                  </td>
                  <td className="print:hidden" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}

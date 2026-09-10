import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Archive, Inbox, Search } from "lucide-react";
import { usePaie } from "@/lib/paie-store";
import { useRole } from "@/lib/role-store";
import { RoleSwitcher } from "@/components/role-switcher";
import { fcfa } from "@/lib/payroll";

export const Route = createFileRoute("/archives")({
  head: () => ({
    meta: [
      { title: "Bulletins archivés – Consultation par mois et employé" },
      {
        name: "description",
        content:
          "Consultez les bulletins de paie déjà générés, filtrés par année, mois et employé, sans avoir à les imprimer.",
      },
      { property: "og:title", content: "Bulletins de paie archivés" },
      {
        property: "og:description",
        content:
          "Recherche des bulletins passés par année, mois et employé, avec net à payer et statut de validation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Archives,
});

const MOIS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

function Archives() {
  const { archives } = usePaie();
  const { peut, profil } = useRole();
  const [annee, setAnnee] = useState("toutes");
  const [mois, setMois] = useState("tous");
  const [recherche, setRecherche] = useState("");

  const annees = useMemo(
    () => [...new Set(archives.map((a) => String(a.annee)))].sort().reverse(),
    [archives],
  );

  const resultats = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return archives
      .filter((a) => annee === "toutes" || String(a.annee) === annee)
      .filter((a) => mois === "tous" || String(a.mois) === mois)
      .flatMap((a) =>
        a.bulletins
          .filter((b) => peut("tous:voir") || b.nom === profil.utilisateur)
          .filter((b) => (q ? b.nom.toLowerCase().includes(q) : true))
          .map((b) => ({ archive: a, bulletin: b })),
      );
  }, [archives, annee, mois, recherche, peut, profil]);

  const total = resultats.reduce((s, r) => s + r.bulletin.netAPayer, 0);
  const champ =
    "rounded-md border border-input bg-background px-2 py-1.5 text-xs";

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <header className="mx-auto mb-6 flex max-w-[1200px] flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Ressources humaines
          </p>
          <h1 className="text-3xl font-bold text-foreground">
            Bulletins archivés
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Retrouvez un bulletin passé par année, mois ou employé, et
            consultez-le à l'écran sans l'imprimer.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/"
            className="rounded-md border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-accent"
          >
            ← Récapitulatif salaire
          </Link>
          <Link
            to="/historique"
            className="rounded-md border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-accent"
          >
            Historique des mois
          </Link>
          <RoleSwitcher />
        </div>
      </header>

      <section className="mx-auto mb-6 flex max-w-[1200px] flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
        <label className="text-xs">
          <span className="mb-1 block text-muted-foreground">Année</span>
          <select
            value={annee}
            onChange={(e) => setAnnee(e.target.value)}
            className={champ}
          >
            <option value="toutes">Toutes</option>
            {annees.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          <span className="mb-1 block text-muted-foreground">Mois</span>
          <select
            value={mois}
            onChange={(e) => setMois(e.target.value)}
            className={champ}
          >
            <option value="tous">Tous</option>
            {MOIS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-[200px] flex-1 text-xs">
          <span className="mb-1 block text-muted-foreground">Employé</span>
          <div className="flex items-center gap-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Nom de l'employé"
              className={`${champ} w-full`}
            />
          </div>
        </label>
        <p className="text-xs text-muted-foreground">
          {resultats.length} bulletin(s) · Net total{" "}
          <strong className="text-foreground">{fcfa(total)} FCFA</strong>
        </p>
      </section>

      <section className="mx-auto max-w-[1200px]">
        {resultats.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-card px-6 py-16 text-center">
            <Inbox className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-medium">Aucun bulletin archivé trouvé</p>
            <p className="max-w-md text-xs text-muted-foreground">
              Générez les bulletins d'un mois depuis le récapitulatif : ils
              seront conservés ici et consultables à tout moment.
            </p>
            <Link
              to="/"
              className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Générer un mois
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full text-xs">
              <thead className="bg-muted text-left">
                <tr>
                  <th className="px-3 py-2">Mois</th>
                  <th className="px-3 py-2">Employé</th>
                  <th className="px-3 py-2">Fonction</th>
                  <th className="px-3 py-2">Société</th>
                  <th className="px-3 py-2">Période</th>
                  <th className="px-3 py-2 text-right">Net à payer</th>
                  <th className="px-3 py-2">Statut</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {resultats.map(({ archive: a, bulletin: b }) => (
                  <tr
                    key={`${a.cle}-${b.employeId}`}
                    className="border-t border-border"
                  >
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1">
                        <Archive className="h-3 w-3 text-primary" />
                        {a.libelle}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-medium">{b.nom}</td>
                    <td className="px-3 py-2">{b.fonction || "—"}</td>
                    <td className="px-3 py-2">{b.societe}</td>
                    <td className="px-3 py-2">
                      {b.periodeDu} – {b.periodeAu}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">
                      {fcfa(b.netAPayer)}
                    </td>
                    <td className="px-3 py-2">
                      {b.valide ? "Validé" : "Non validé"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        to="/bulletin/$id"
                        params={{ id: b.employeId }}
                        className="rounded-md border border-border px-2 py-1 font-medium hover:bg-accent"
                      >
                        Consulter
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

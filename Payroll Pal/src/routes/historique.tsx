import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  Archive,
  BadgeCheck,
  ChevronDown,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { usePaie } from "@/lib/paie-store";
import { useRole } from "@/lib/role-store";
import { RoleSwitcher } from "@/components/role-switcher";
import { fcfa } from "@/lib/payroll";

export const Route = createFileRoute("/historique")({
  head: () => ({
    meta: [
      { title: "Historique des bulletins – Paie TALENTO" },
      {
        name: "description",
        content:
          "Retrouvez chaque mois de paie déjà généré et ses bulletins archivés, avec le net à payer figé au moment de la génération.",
      },
      { property: "og:title", content: "Historique des mois de paie" },
      {
        property: "og:description",
        content:
          "Archive mois par mois des bulletins de paie générés, consultables sans recalcul.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Historique,
});

function Historique() {
  const { archives, supprimerArchive, validerArchive } = usePaie();
  const { peut, profil } = useRole();
  const [ouvert, setOuvert] = useState<string | null>(archives[0]?.cle ?? null);
  const peutValider = peut("paie:editer");
  const totalNonValides = archives.reduce(
    (s, a) => s + a.bulletins.filter((b) => !b.valide).length,
    0,
  );

  const validerTout = (cle: string, libelle: string) => {
    const nb = validerArchive(cle, profil.utilisateur);
    if (nb === 0) {
      toast.info(`Tous les bulletins de ${libelle} étaient déjà validés.`);
      return;
    }
    toast.success(`${nb} bulletin(s) de ${libelle} validé(s) par ${profil.utilisateur}`);
  };


  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <header className="mx-auto mb-6 flex max-w-[1200px] flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Ressources humaines
          </p>
          <h1 className="text-3xl font-bold text-foreground">
            Historique des mois générés
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Chaque génération archive les bulletins du mois : les montants
            restent figés, sans recalcul.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="rounded-md border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-accent"
          >
            ← Récapitulatif salaire
          </Link>
          <RoleSwitcher />
        </div>
      </header>

      <div className="mx-auto max-w-[1200px] space-y-4">
        {totalNonValides > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3">
            <p className="flex items-center gap-2 text-sm font-medium text-foreground">
              <TriangleAlert className="h-4 w-4 text-destructive" />
              {totalNonValides} bulletin(s) archivé(s) ne sont pas encore validés
              par les RH.
            </p>
            {peutValider && (
              <button
                type="button"
                onClick={() => {
                  let nb = 0;
                  archives.forEach((a) => {
                    nb += validerArchive(a.cle, profil.utilisateur);
                  });
                  toast.success(
                    `${nb} bulletin(s) validé(s) automatiquement par ${profil.utilisateur}`,
                  );
                }}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
              >
                <BadgeCheck className="h-4 w-4" /> Tout valider automatiquement
              </button>
            )}
          </div>
        )}

        {archives.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-card px-6 py-16 text-center">
            <Archive className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">
              Aucun mois archivé pour le moment
            </p>
            <p className="max-w-md text-xs text-muted-foreground">
              Générez les bulletins d'un mois depuis le récapitulatif : ils
              seront automatiquement archivés ici.
            </p>
            <Link
              to="/"
              className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Générer les bulletins du mois
            </Link>
          </div>
        )}

        {archives.map((a) => {
          const total = a.bulletins.reduce((s, b) => s + b.netAPayer, 0);
          const estOuvert = ouvert === a.cle;
          return (
            <section
              key={a.cle}
              className="overflow-hidden rounded-lg border border-border bg-card"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <button
                  type="button"
                  onClick={() => setOuvert(estOuvert ? null : a.cle)}
                  className="flex items-center gap-2 text-left"
                >
                  <ChevronDown
                    className={`h-4 w-4 text-muted-foreground transition ${estOuvert ? "" : "-rotate-90"}`}
                  />
                  <span>
                    <span className="block font-semibold text-foreground">
                      {a.libelle}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {a.bulletins.length} bulletin(s) · archivé le {a.genereLe}
                    </span>
                  </span>
                </button>
                <div className="flex flex-wrap items-center gap-3">
                  {a.bulletins.some((b) => !b.valide) && (
                    <span className="inline-flex items-center gap-1 rounded bg-destructive/15 px-2 py-1 text-[11px] font-medium text-destructive">
                      <TriangleAlert className="h-3 w-3" />
                      {a.bulletins.filter((b) => !b.valide).length} non validé(s)
                    </span>
                  )}
                  {peutValider && a.bulletins.some((b) => !b.valide) && (
                    <button
                      type="button"
                      onClick={() => validerTout(a.cle, a.libelle)}
                      className="inline-flex items-center gap-1 rounded bg-primary px-2 py-1 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90"
                    >
                      <BadgeCheck className="h-3 w-3" /> Valider ce mois
                    </button>
                  )}
                  <span className="text-sm font-bold tabular-nums text-foreground">
                    {fcfa(total)} FCFA
                  </span>
                  {peut("employes:gerer") && (

                    <button
                      type="button"
                      onClick={() => {
                        supprimerArchive(a.cle);
                        toast.success(`Archive ${a.libelle} supprimée`);
                      }}
                      className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] text-destructive hover:bg-accent"
                    >
                      <Trash2 className="h-3 w-3" /> Supprimer
                    </button>
                  )}
                </div>
              </div>

              {estOuvert && (
                <div className="overflow-x-auto border-t border-border">
                  <table className="w-full border-collapse text-xs">
                    <thead className="bg-muted text-[11px] uppercase text-muted-foreground">
                      <tr>
                        {[
                          "Employé",
                          "Fonction",
                          "Période",
                          "Payé par",
                          "Salaire brut",
                          "Retenues",
                          "Net à payer",
                          "Validation",
                          "",
                        ].map((h) => (
                          <th
                            key={h}
                            className="border border-border px-2 py-2 text-left"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {a.bulletins.map((b) => (
                        <tr key={b.employeId} className="hover:bg-accent/40">
                          <td className="border border-border px-2 py-1 font-semibold">
                            {b.nom}
                          </td>
                          <td className="border border-border px-2 py-1">
                            {b.fonction || "—"}
                          </td>
                          <td className="border border-border px-2 py-1">
                            du {b.periodeDu} au {b.periodeAu}
                          </td>
                          <td className="border border-border px-2 py-1">
                            SALAIRE {b.societe}
                          </td>
                          <td className="border border-border px-2 py-1 text-right tabular-nums">
                            {fcfa(b.calcul.total1)}
                          </td>
                          <td className="border border-border px-2 py-1 text-right tabular-nums">
                            {fcfa(b.calcul.totalRetenues)}
                          </td>
                          <td className="border border-border px-2 py-1 text-right font-bold tabular-nums">
                            {fcfa(b.netAPayer)}
                          </td>
                          <td className="border border-border px-2 py-1">
                            {b.valide ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary">
                                <BadgeCheck className="h-3.5 w-3.5" /> Validé
                                {b.responsableRH ? ` – ${b.responsableRH}` : ""}
                              </span>
                            ) : (
                              <span className="text-[11px] text-muted-foreground">
                                Non validé
                              </span>
                            )}
                          </td>
                          <td className="border border-border px-2 py-1 text-center">
                            <Link
                              to="/bulletin/$id"
                              params={{ id: b.employeId }}
                              className="rounded bg-secondary px-2 py-1 text-[11px] font-medium text-secondary-foreground hover:bg-accent"
                            >
                              Ouvrir
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}

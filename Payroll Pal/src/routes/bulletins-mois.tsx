import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { FileWarning, Printer } from "lucide-react";
import { BulletinA4 } from "@/components/bulletin-a4";
import { usePaie } from "@/lib/paie-store";
import { useRole } from "@/lib/role-store";
import { ANNEES, MOIS, bornes, libellePeriode, type Periode } from "@/lib/periode";
import { calculer, fcfa, type Bulletin, type Employe } from "@/lib/payroll";

export const Route = createFileRoute("/bulletins-mois")({
  head: () => ({
    meta: [
      { title: "Bulletins du mois – Paie Polyclinique de Poitiers" },
      {
        name: "description",
        content:
          "Tous les bulletins de paie du mois au format A4, prêts à imprimer en PDF, avec filtre par mois et par année.",
      },
      { property: "og:title", content: "Bulletins du mois – Paie Poitiers" },
      {
        property: "og:description",
        content:
          "Impression groupée des bulletins de paie du mois au format A4.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BulletinsMois,
});

function BulletinsMois() {
  const { employes, archives, tauxDe } = usePaie();
  const { peut, profil } = useRole();
  const maintenant = new Date();
  const [periode, setPeriode] = useState<Periode>({
    mois: maintenant.getMonth() + 1,
    annee: maintenant.getFullYear(),
  });

  const cle = `${periode.annee}-${String(periode.mois).padStart(2, "0")}`;
  const taux = tauxDe(cle);
  const tousVoir = peut("tous:voir");

  const { lignes, source } = useMemo(() => {
    const archive = archives.find((a) => a.cle === cle);
    const b = bornes(periode);
    let base: { e: Employe; c: Bulletin }[];
    let src: "archive" | "direct";
    if (archive) {
      base = archive.bulletins.map((x) => ({ e: x.snapshot, c: x.calcul }));
      src = "archive";
    } else {
      base = employes.map((e) => {
        const ajuste: Employe = {
          ...e,
          periodeDu: b.du,
          periodeAu: b.au,
          datePaiement: b.paiement,
        };
        return { e: ajuste, c: calculer(ajuste, taux) };
      });
      src = "direct";
    }
    const visibles = tousVoir
      ? base
      : base.filter(
          (x) => x.e.nom.toUpperCase() === profil.utilisateur.toUpperCase(),
        );
    return { lignes: visibles, source: src };
  }, [archives, cle, periode, employes, taux, tousVoir, profil.utilisateur]);

  const totalNet = lignes.reduce((s, x) => s + x.c.netAPayer, 0);

  return (
    <main className="min-h-screen bg-muted/40 px-4 py-6">
      <div className="mx-auto mb-6 max-w-[900px] print:hidden">
        <Link to="/" className="text-sm text-primary underline">
          ← Récapitulatif salaire
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-foreground">
          Bulletins du mois
        </h1>
        <p className="text-sm text-muted-foreground">
          Tous les bulletins de {libellePeriode(periode)} au format A4, un
          bulletin par page à l'impression.
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">Mois</span>
            <select
              value={periode.mois}
              onChange={(e) =>
                setPeriode((p) => ({ ...p, mois: Number(e.target.value) }))
              }
              className="rounded border border-border bg-background px-2 py-1 text-sm"
            >
              {MOIS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">Année</span>
            <select
              value={periode.annee}
              onChange={(e) =>
                setPeriode((p) => ({ ...p, annee: Number(e.target.value) }))
              }
              className="rounded border border-border bg-background px-2 py-1 text-sm"
            >
              {ANNEES.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={lignes.length === 0}
            onClick={() => {
              toast.success(
                `${lignes.length} bulletin(s) envoyé(s) à l'impression`,
              );
              window.print();
            }}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Printer className="h-4 w-4" /> Imprimer / PDF
          </button>
          <div className="ml-auto text-right text-xs text-muted-foreground">
            <div>
              {lignes.length} bulletin(s) —{" "}
              {source === "archive"
                ? "mois archivé"
                : "calcul direct (mois non archivé)"}
            </div>
            <div className="text-sm font-semibold text-foreground">
              Total net : {fcfa(totalNet)} FCFA
            </div>
          </div>
        </div>
      </div>

      {lignes.length === 0 ? (
        <div className="mx-auto flex max-w-[900px] flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-card p-10 text-center print:hidden">
          <FileWarning className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Aucun bulletin pour {libellePeriode(periode)}.
          </p>
          <Link
            to="/liste-salaires"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Générer les bulletins du mois
          </Link>
        </div>
      ) : (
        <div className="space-y-8 print:space-y-0">
          {lignes.map((x, i) => (
            <div
              key={x.e.id}
              className={i < lignes.length - 1 ? "page-break" : ""}
            >
              <BulletinA4 e={x.e} c={x.c} />
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

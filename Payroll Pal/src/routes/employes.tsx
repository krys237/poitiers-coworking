import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ListChecks, Plus, Trash2, UsersRound } from "lucide-react";
import { usePaie } from "@/lib/paie-store";
import { useRole } from "@/lib/role-store";
import { ImportPaie } from "@/components/import-paie";
import { fcfa, nouvelEmploye, type Employe, type Societe } from "@/lib/payroll";

export const Route = createFileRoute("/employes")({
  head: () => ({
    meta: [
      { title: "Employés – Fonctions, CNPS et jours travaillés" },
      {
        name: "description",
        content:
          "Saisie ligne par ligne des employés : fonction, adresse, CNPS, NIU, salaire brut et jours travaillés, avec import Excel ou CSV.",
      },
      { property: "og:title", content: "Employés – Gestion de paie" },
      {
        property: "og:description",
        content:
          "Complétez fonction, CNPS et jours travaillés avant de générer les bulletins de paie.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PageEmployes,
});

const SOCIETES: Societe[] = ["SESAME", "SOFINA", "SGC"];

type Champ = keyof Pick<
  Employe,
  | "nom"
  | "fonction"
  | "adresse"
  | "cnps"
  | "niu"
  | "matricule"
  | "salaireBrut"
  | "joursTravailles"
>;

function erreursLigne(e: Employe): Partial<Record<Champ, string>> {
  const err: Partial<Record<Champ, string>> = {};
  if (!e.nom.trim()) err.nom = "Nom requis";
  if (e.salaireBrut <= 0) err.salaireBrut = "Salaire brut > 0";
  if (e.joursTravailles < 0 || e.joursTravailles > 31)
    err.joursTravailles = "Entre 0 et 31";
  if (e.cnps && !/^[A-Za-z0-9-]{4,20}$/.test(e.cnps))
    err.cnps = "4 à 20 caractères";
  return err;
}

function PageEmployes() {
  const { employes, maj, ajouter, supprimer, viderEffectif } = usePaie();
  const { peut } = useRole();
  const [recherche, setRecherche] = useState("");

  const peutEditer = peut("paie:editer");
  const peutGerer = peut("employes:gerer");

  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return q
      ? employes.filter(
          (e) =>
            e.nom.toLowerCase().includes(q) ||
            e.matricule.toLowerCase().includes(q),
        )
      : employes;
  }, [employes, recherche]);

  const incomplets = employes.filter(
    (e) => !e.fonction.trim() || !e.cnps.trim() || !e.joursTravailles,
  ).length;

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Employés</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Complétez fonction, adresse, CNPS/NIU et jours travaillés. Tout
              est repris automatiquement dans le récapitulatif et les bulletins.
            </p>
            {incomplets > 0 && (
              <p className="mt-2 text-xs font-medium text-destructive">
                {incomplets} fiche(s) incomplète(s) (fonction, CNPS ou jours
                travaillés).
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={recherche}
              onChange={(ev) => setRecherche(ev.target.value)}
              placeholder="Rechercher un employé…"
              className="rounded border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-ring"
            />
            <button
              type="button"
              disabled={!peutGerer}
              onClick={() => {
                ajouter({
                  ...nouvelEmploye("NOUVEL EMPLOYÉ", 0),
                  matricule: `POI-${String(employes.length + 1).padStart(3, "0")}`,
                });
                toast.success("Ligne ajoutée – complétez la fiche");
              }}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              <Plus className="h-3.5 w-3.5" /> Ajouter une ligne
            </button>
            <button
              type="button"
              disabled={!peutGerer || employes.length === 0}
              onClick={() => {
                if (
                  !window.confirm(
                    "Vider tout l'effectif ? Cette action supprime tous les employés enregistrés.",
                  )
                )
                  return;
                viderEffectif();
                toast.success("Effectif vidé");
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-destructive px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" /> Vider l'effectif
            </button>
            <Link
              to="/liste-salaires"
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
            >
              <ListChecks className="h-3.5 w-3.5" /> Liste des salaires
            </Link>
          </div>
        </header>

        <div className="mb-6">
          <ImportPaie disabled={!peutGerer} />
        </div>

        {visibles.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-10 text-center">
            <UsersRound className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium text-foreground">
              Aucun employé trouvé
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Ajoutez une ligne ou importez votre fichier Excel/CSV.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[1200px] text-xs">
              <thead className="bg-muted">
                <tr className="text-left">
                  <th className="px-2 py-2">Matricule</th>
                  <th className="px-2 py-2">Nom et prénoms</th>
                  <th className="px-2 py-2">Fonction</th>
                  <th className="px-2 py-2">Adresse</th>
                  <th className="px-2 py-2">CNPS</th>
                  <th className="px-2 py-2">NIU</th>
                  <th className="px-2 py-2">Société</th>
                  <th className="px-2 py-2 text-right">Salaire brut</th>
                  <th className="px-2 py-2 text-right">Jours</th>
                  <th className="px-2 py-2 print:hidden" />
                </tr>
              </thead>
              <tbody>
                {visibles.map((e) => {
                  const err = erreursLigne(e);
                  const champ = (
                    nom: Champ,
                    type: "text" | "number" = "text",
                    largeur = "w-40",
                  ) => (
                    <td className="px-2 py-1.5 align-top">
                      <input
                        type={type}
                        value={e[nom] as string | number}
                        disabled={!peutEditer}
                        onChange={(ev) =>
                          maj(e.id, {
                            [nom]:
                              type === "number"
                                ? Number(ev.target.value) || 0
                                : ev.target.value,
                          } as Partial<Employe>)
                        }
                        className={`${largeur} rounded border bg-background px-1.5 py-1 text-xs outline-none focus:border-ring disabled:opacity-60 ${
                          err[nom] ? "border-destructive" : "border-border"
                        } ${type === "number" ? "text-right tabular-nums" : ""}`}
                      />
                      {err[nom] && (
                        <p className="mt-0.5 text-[10px] font-medium text-destructive">
                          {err[nom]}
                        </p>
                      )}
                    </td>
                  );
                  return (
                    <tr key={e.id} className="border-t border-border">
                      {champ("matricule", "text", "w-24")}
                      {champ("nom", "text", "w-56")}
                      {champ("fonction", "text", "w-44")}
                      {champ("adresse", "text", "w-44")}
                      {champ("cnps", "text", "w-32")}
                      {champ("niu", "text", "w-32")}
                      <td className="px-2 py-1.5 align-top">
                        <select
                          value={e.societe}
                          disabled={!peut("societe:affecter")}
                          onChange={(ev) =>
                            maj(e.id, {
                              societe: ev.target.value as Societe,
                            })
                          }
                          className="rounded border border-border bg-background px-1.5 py-1 text-xs disabled:opacity-60"
                        >
                          {SOCIETES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </td>
                      {champ("salaireBrut", "number", "w-28")}
                      {champ("joursTravailles", "number", "w-16")}
                      <td className="px-2 py-1.5 align-top print:hidden">
                        <button
                          type="button"
                          disabled={!peutGerer}
                          onClick={() => {
                            supprimer(e.id);
                            toast.success(`${e.nom} retiré de l'effectif`);
                          }}
                          className="rounded p-1 text-destructive hover:bg-destructive/10 disabled:opacity-40"
                          aria-label={`Supprimer ${e.nom}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-muted font-semibold">
                <tr>
                  <td className="px-2 py-2" colSpan={7}>
                    {visibles.length} employé(s)
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {fcfa(visibles.reduce((a, e) => a + e.salaireBrut, 0))}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}

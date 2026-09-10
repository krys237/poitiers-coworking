import { createFileRoute, Link } from "@tanstack/react-router";
import { MailCheck, Inbox, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { RoleSwitcher } from "@/components/role-switcher";
import { useRole } from "@/lib/role-store";
import { useEnvois, viderEnvois, LIBELLE_STATUT } from "@/lib/envois-store";

export const Route = createFileRoute("/envois")({
  head: () => ({
    meta: [
      { title: "Bulletins envoyés – Suivi des e-mails de paie" },
      {
        name: "description",
        content:
          "Suivi des bulletins de paie envoyés par e-mail : date, employé, adresse et statut de l'envoi.",
      },
      { property: "og:title", content: "Suivi des bulletins envoyés par e-mail" },
      {
        property: "og:description",
        content:
          "Vérifiez qui a reçu son bulletin de paie, à quelle date et avec quel statut.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Envois,
});

const couleur: Record<string, string> = {
  envoye: "bg-emerald-100 text-emerald-800",
  echec: "bg-destructive/10 text-destructive",
  en_attente: "bg-amber-100 text-amber-800",
};

function Envois() {
  const { envois, pret } = useEnvois();
  const { peut, profil } = useRole();

  const visibles = peut("tous:voir")
    ? envois
    : envois.filter((e) => e.employe === profil.utilisateur);

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <header className="mx-auto mb-6 flex max-w-[1100px] flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Ressources humaines
          </p>
          <h1 className="text-3xl font-bold text-foreground">Bulletins envoyés</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Qui a reçu son bulletin, quand, et où en est l'envoi.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/courrier"
            className="rounded-md border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-accent"
          >
            ← Courrier de paie
          </Link>
          {peut("tous:voir") && visibles.length > 0 && (
            <button
              type="button"
              onClick={() => {
                viderEnvois();
                toast.success("Historique des envois effacé.");
              }}
              className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-semibold hover:bg-accent"
            >
              <Trash2 className="h-4 w-4" /> Effacer l'historique
            </button>
          )}
          <RoleSwitcher />
        </div>
      </header>

      {!pret && (
        <div className="mx-auto max-w-[1100px] space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      )}

      {pret && visibles.length === 0 && (
        <div className="mx-auto flex max-w-[1100px] flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-card px-6 py-16 text-center">
          <Inbox className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm font-medium">Aucun bulletin envoyé pour l'instant</p>
          <p className="max-w-md text-xs text-muted-foreground">
            Depuis la page « Courrier de paie », saisissez l'adresse e-mail d'un
            employé et cliquez sur « Envoyer le PDF » : l'envoi apparaîtra ici.
          </p>
          <Link
            to="/courrier"
            className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Aller au courrier de paie
          </Link>
        </div>
      )}

      {pret && visibles.length > 0 && (
        <div className="mx-auto max-w-[1100px] overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3 text-left">Date</th>
                <th className="p-3 text-left">Employé</th>
                <th className="p-3 text-left">Adresse e-mail</th>
                <th className="p-3 text-left">Période</th>
                <th className="p-3 text-left">Statut</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((e) => (
                <tr key={e.id} className="border-t border-border">
                  <td className="p-3 whitespace-nowrap">
                    {new Date(e.date).toLocaleString("fr-FR")}
                  </td>
                  <td className="p-3 font-medium">{e.employe}</td>
                  <td className="p-3">{e.email}</td>
                  <td className="p-3 whitespace-nowrap">{e.periode}</td>
                  <td className="p-3">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                        couleur[e.statut] ?? "bg-muted"
                      }`}
                      title={e.detail}
                    >
                      <MailCheck className="h-3 w-3" />
                      {LIBELLE_STATUT[e.statut]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

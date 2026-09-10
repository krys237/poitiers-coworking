import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Mail, Printer, Inbox, Send } from "lucide-react";
import { usePaie } from "@/lib/paie-store";
import { useRole } from "@/lib/role-store";
import { RoleSwitcher } from "@/components/role-switcher";
import { Skeleton } from "@/components/ui/skeleton";
import { enregistrerEnvoi } from "@/lib/envois-store";
import { calculer, fcfa, type Employe } from "@/lib/payroll";

export const Route = createFileRoute("/courrier")({
  head: () => ({
    meta: [
      { title: "Courrier de paie – Envoi des bulletins" },
      {
        name: "description",
        content:
          "Générez un courrier PDF par employé accompagné de son bulletin de paie, prêt à être envoyé.",
      },
      { property: "og:title", content: "Courrier de paie – Bulletins par employé" },
      {
        property: "og:description",
        content:
          "Un courrier d'accompagnement et le détail du bulletin pour chaque employé, imprimable en PDF.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Courrier,
});

function Courrier() {
  const { employes, tauxDe } = usePaie();
  const { peut, profil } = useRole();
  const [selection, setSelection] = useState<string[]>([]);
  const [chargement, setChargement] = useState(false);

  const visibles = useMemo(
    () =>
      peut("tous:voir")
        ? employes
        : employes.filter((e) => e.nom === profil.utilisateur),
    [employes, peut, profil],
  );

  const cle = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, []);
  const taux = tauxDe(cle);

  const retenus = selection.length
    ? visibles.filter((e) => selection.includes(e.id))
    : visibles;

  const [emails, setEmails] = useState<Record<string, string>>({});

  const envoyer = (e: Employe) => {
    const adresse = (emails[e.id] ?? "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(adresse)) {
      toast.error("Adresse e-mail invalide.");
      return;
    }
    enregistrerEnvoi({
      employeId: e.id,
      employe: e.nom,
      email: adresse,
      periode: `${e.periodeDu} – ${e.periodeAu}`,
      statut: "en_attente",
      detail:
        "En attente : le domaine d'envoi de l'entreprise n'est pas encore configuré.",
    });
    toast.warning(
      `Envoi enregistré pour ${e.nom}. Il partira dès que votre domaine d'envoi sera configuré.`,
    );
  };


  const imprimer = () => {
    if (retenus.length === 0) {
      toast.error("Aucun employé sélectionné.");
      return;
    }
    setChargement(true);
    setTimeout(() => {
      setChargement(false);
      toast.success(
        `${retenus.length} courrier(s) prêt(s) : enregistrez en PDF depuis la fenêtre d'impression.`,
      );
      window.print();
    }, 600);
  };

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <header className="no-print mx-auto mb-6 flex max-w-[1000px] flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Ressources humaines
          </p>
          <h1 className="text-3xl font-bold text-foreground">Courrier de paie</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Un courrier d'accompagnement + le bulletin de chaque employé, sur une
            page par personne, à enregistrer en PDF.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/"
            className="rounded-md border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-accent"
          >
            ← Récapitulatif salaire
          </Link>
          <button
            type="button"
            onClick={imprimer}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Printer className="h-4 w-4" /> Générer les PDF
          </button>
          <RoleSwitcher />
        </div>
      </header>

      {visibles.length === 0 && (
        <div className="no-print mx-auto flex max-w-[1000px] flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-card px-6 py-16 text-center">
          <Inbox className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm font-medium">Aucun employé à envoyer</p>
          <p className="max-w-md text-xs text-muted-foreground">
            Ajoutez ou importez vos employés depuis le récapitulatif pour
            préparer leurs courriers de paie.
          </p>
          <Link
            to="/"
            className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Aller au récapitulatif
          </Link>
        </div>
      )}

      {visibles.length > 0 && (
        <section className="no-print mx-auto mb-6 max-w-[1000px] rounded-lg border border-border bg-card p-4">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Mail className="h-4 w-4 text-primary" /> Destinataires
          </h2>
          <div className="flex flex-wrap gap-2">
            {visibles.map((e) => {
              const actif = selection.includes(e.id);
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() =>
                    setSelection((s) =>
                      s.includes(e.id) ? s.filter((i) => i !== e.id) : [...s, e.id],
                    )
                  }
                  className={`rounded-full border px-3 py-1 text-xs ${
                    actif
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:bg-accent"
                  }`}
                >
                  {e.nom}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Aucune sélection = tous les employés ({visibles.length}).
          </p>

          <div className="mt-4 space-y-2 border-t border-border pt-4">
            <h3 className="text-sm font-semibold">Envoi par e-mail</h3>
            {retenus.map((e) => (
              <div
                key={e.id}
                className="flex flex-col gap-2 rounded-md border border-border p-2 sm:flex-row sm:items-center"
              >
                <span className="min-w-[160px] text-xs font-medium">{e.nom}</span>
                <input
                  type="email"
                  value={emails[e.id] ?? ""}
                  onChange={(ev) =>
                    setEmails((m) => ({ ...m, [e.id]: ev.target.value }))
                  }
                  placeholder="adresse e-mail de l'employé"
                  className="w-full flex-1 rounded-md border border-input bg-background px-2 py-1 text-xs"
                />
                <button
                  type="button"
                  onClick={() => envoyer(e)}
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-border px-3 py-1 text-xs font-semibold hover:bg-accent"
                >
                  <Send className="h-3.5 w-3.5" /> Envoyer le PDF
                </button>
              </div>
            ))}
            <Link
              to="/envois"
              className="inline-block text-xs font-medium text-primary underline-offset-2 hover:underline"
            >
              Voir les bulletins déjà envoyés →
            </Link>
          </div>
        </section>
      )}

      {chargement && (
        <div className="no-print mx-auto max-w-[1000px] space-y-3">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      )}

      <div className="mx-auto max-w-[1000px] space-y-6">
        {retenus.map((e) => (
          <CourrierEmploye key={e.id} employe={e} taux={taux} />
        ))}
      </div>
    </main>
  );
}

function CourrierEmploye({
  employe: e,
  taux,
}: {
  employe: Employe;
  taux: ReturnType<ReturnType<typeof usePaie>["tauxDe"]>;
}) {
  const c = calculer(e, taux);
  return (
    <article className="bulletin page-break rounded-lg border border-border bg-card p-6 text-sm shadow-sm">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            SALAIRE {e.societe}
          </p>
          <p className="text-lg font-bold">Bulletin de paie – courrier</p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <p>Période du {e.periodeDu} au {e.periodeAu}</p>
          <p>Date de paiement : {e.datePaiement}</p>
        </div>
      </header>

      <div className="mb-4 text-xs">
        <p className="font-semibold text-foreground">{e.nom}</p>
        <p className="text-muted-foreground">{e.fonction || "Fonction —"}</p>
        <p className="text-muted-foreground">{e.adresse || "Adresse —"}</p>
        <p className="text-muted-foreground">
          NIU {e.niu || "—"} · CNPS {e.cnps || "—"}
        </p>
      </div>

      <p className="mb-4 text-xs leading-relaxed">
        Madame, Monsieur, veuillez trouver ci-joint votre bulletin de paie
        correspondant à la période indiquée. Le montant net de{" "}
        <strong>{fcfa(c.netAPayer)} FCFA</strong> vous sera versé à la date de
        paiement mentionnée. Pour toute question, rapprochez-vous du service des
        ressources humaines.
      </p>

      <table className="w-full border-collapse text-xs">
        <tbody>
          {[
            ["Jours travaillés", `${e.joursTravailles} j`],
            ["Salaire journalier", fcfa(c.salaireJournalier)],
            ["Salaire de base", fcfa(c.salaireBase)],
            ["Primes et indemnités", fcfa(c.primes)],
            ["Heures supplémentaires", fcfa(e.heuresSup)],
            ["Ancienneté", fcfa(e.anciennete)],
            ["Total brut", fcfa(c.total1)],
            ["CNPS salarié", fcfa(c.cnpsSalarie)],
            ["IRPP + CAC", fcfa(c.irpp + c.cac)],
            ["TDL / RAV / CFC", fcfa(c.tdl + c.rav + c.cfcSalarie)],
            ["Mutuelle", fcfa(c.mutuelle)],
            ["Absences / sanctions", fcfa(e.absences + e.sanctions)],
            ["Acomptes, dettes & soins", fcfa(e.acompte + e.dettesSoins)],
          ].map(([l, v]) => (
            <tr key={l}>
              <td className="border border-border px-2 py-1">{l}</td>
              <td className="border border-border px-2 py-1 text-right tabular-nums">
                {v}
              </td>
            </tr>
          ))}
          <tr>
            <td className="border border-border bg-muted px-2 py-1 font-bold">
              NET À PAYER
            </td>
            <td className="border border-border bg-muted px-2 py-1 text-right font-bold tabular-nums">
              {fcfa(c.netAPayer)} FCFA
            </td>
          </tr>
        </tbody>
      </table>

      <footer className="mt-4 flex flex-wrap items-end justify-between gap-4 text-xs">
        <div>
          <p className="text-muted-foreground">Visa du responsable RH</p>
          <p className="font-semibold">{e.responsableRH || "—"}</p>
          <p className="text-muted-foreground">
            {e.valide ? `Bulletin validé le ${e.valideLe}` : "Bulletin non validé"}
          </p>
        </div>
        <Link
          to="/bulletin/$id"
          params={{ id: e.id }}
          className="no-print rounded-md border border-border px-3 py-2 font-medium hover:bg-accent"
        >
          Ouvrir le bulletin complet
        </Link>
      </footer>
    </article>
  );
}

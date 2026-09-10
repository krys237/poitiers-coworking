import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { BadgeCheck, Lock } from "lucide-react";
import { usePaie } from "@/lib/paie-store";
import { useRole } from "@/lib/role-store";
import { RoleSwitcher } from "@/components/role-switcher";
import { calculer, type Employe } from "@/lib/payroll";
import { BulletinA4 } from "@/components/bulletin-a4";

export const Route = createFileRoute("/bulletin/$id")({
  head: () => ({
    meta: [
      { title: "Bulletin de paie – Gestion de paie TALENTO" },
      {
        name: "description",
        content:
          "Bulletin de paie généré automatiquement à partir du récapitulatif salaire : cotisations, impôts et net à payer calculés.",
      },
      { property: "og:title", content: "Bulletin de paie – Paie TALENTO" },
      {
        property: "og:description",
        content:
          "Bulletin de paie imprimable en PDF avec calculs automatiques.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BulletinPage,
});

function Champ({
  label,
  value,
  onChange,
  type = "text",
  readOnly = false,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  readOnly?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        readOnly={readOnly}
        disabled={readOnly}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-border bg-background px-2 py-1 text-sm outline-none focus:border-ring disabled:cursor-not-allowed disabled:opacity-60"
      />
    </label>
  );
}

function BulletinPage() {
  const { id } = Route.useParams();
  const { employes, maj, tauxDe } = usePaie();
  const { profil, peut } = useRole();
  const peutEditer = peut("paie:editer");
  const e = employes.find((x) => x.id === id);

  if (!e) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Employé introuvable.</p>
          <Link to="/" className="text-primary underline">
            Retour au récapitulatif
          </Link>
        </div>
      </main>
    );
  }

  // Taux légaux du mois de la période du bulletin (jj/mm/aaaa)
  const [, mm, aaaa] = (e.periodeDu || "").split("/");
  const c = calculer(e, tauxDe(aaaa && mm ? `${aaaa}-${mm}` : ""));

  const set = (patch: Partial<Employe>) => maj(e.id, patch);
  const num = (v: string) => Number(v) || 0;




  return (
    <main className="min-h-screen bg-muted/40 px-4 py-6">
      <div className="mx-auto mb-6 flex max-w-[900px] items-center justify-between gap-3 print:hidden">
        <Link to="/" className="text-sm text-primary underline">
          ← Récapitulatif salaire
        </Link>
        <RoleSwitcher />
        <button
          onClick={() => {
            toast.success("Bulletin envoyé à l'impression / PDF");
            window.print();
          }}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Générer le PDF / Imprimer
        </button>
      </div>

      {!peutEditer && (
        <div className="mx-auto mb-4 flex max-w-[900px] items-center gap-2 rounded-lg border border-border bg-muted/60 px-3 py-2 text-xs text-muted-foreground print:hidden">
          <Lock className="h-4 w-4" />
          Profil « {profil.libelle} » : consultation et impression uniquement,
          la saisie des éléments de paie est réservée à l'Administrateur et au
          Gestionnaire RH.
        </div>
      )}

      {/* Saisie liée au récapitulatif */}
      <section className="mx-auto mb-6 grid max-w-[900px] grid-cols-2 gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-4 print:hidden">
        <Champ
          readOnly={!peutEditer}
          label="Nom"
          value={e.nom}
          onChange={(v) => set({ nom: v })}
        />
        <Champ
          readOnly={!peutEditer}
          label="Fonction / emploi occupé"
          value={e.fonction}
          onChange={(v) => set({ fonction: v })}
        />
        <Champ
          readOnly={!peutEditer}
          label="Adresse"
          value={e.adresse}
          onChange={(v) => set({ adresse: v })}
        />
        <Champ
          readOnly={!peutEditer}
          label="NIU"
          value={e.niu}
          onChange={(v) => set({ niu: v })}
        />
        <Champ
          readOnly={!peutEditer}
          label="N° CNPS"
          value={e.cnps}
          onChange={(v) => set({ cnps: v })}
        />
        <Champ
          readOnly={!peutEditer}
          label="Matricule"
          value={e.matricule}
          onChange={(v) => set({ matricule: v })}
        />
        <Champ
          readOnly={!peutEditer}
          label="Catégorie"
          value={e.categorie}
          onChange={(v) => set({ categorie: v })}
        />
        <Champ
          readOnly={!peutEditer}
          label="Échelon"
          value={e.echelon}
          onChange={(v) => set({ echelon: v })}
        />
        <Champ
          readOnly={!peutEditer}
          label="Département"
          value={e.departement}
          onChange={(v) => set({ departement: v })}
        />
        <Champ
          readOnly={!peutEditer}
          label="Date d'embauche"
          value={e.dateEmbauche}
          onChange={(v) => set({ dateEmbauche: v })}
        />
        <Champ
          readOnly={!peutEditer}
          label="Période du"
          value={e.periodeDu}
          onChange={(v) => set({ periodeDu: v })}
        />
        <Champ
          readOnly={!peutEditer}
          label="au"
          value={e.periodeAu}
          onChange={(v) => set({ periodeAu: v })}
        />
        <Champ
          readOnly={!peutEditer}
          label="Paiement le"
          value={e.datePaiement}
          onChange={(v) => set({ datePaiement: v })}
        />
        <Champ
          readOnly={!peutEditer}
          label="Salaire brut mensuel"
          type="number"
          value={e.salaireBrut}
          onChange={(v) => set({ salaireBrut: num(v) })}
        />
        <Champ
          readOnly={!peutEditer}
          label="Jours travaillés"
          type="number"
          value={e.joursTravailles}
          onChange={(v) => set({ joursTravailles: num(v) })}
        />
        <Champ
          readOnly={!peutEditer}
          label="Congés acquis (jours)"
          type="number"
          value={e.congesJoursAcquis}
          onChange={(v) => set({ congesJoursAcquis: num(v) })}
        />
        <Champ
          readOnly={!peutEditer}
          label="Congés pris (jours)"
          type="number"
          value={e.congesJoursPris}
          onChange={(v) => set({ congesJoursPris: num(v) })}
        />
        <Champ
          readOnly={!peutEditer}
          label="Prime de transport"
          type="number"
          value={e.primeTransport}
          onChange={(v) => set({ primeTransport: num(v) })}
        />
        <Champ
          readOnly={!peutEditer}
          label="Prime d'assiduité"
          type="number"
          value={e.primeAssiduite}
          onChange={(v) => set({ primeAssiduite: num(v) })}
        />
        <Champ
          readOnly={!peutEditer}
          label="Indemnité de logement"
          type="number"
          value={e.indemniteLogement}
          onChange={(v) => set({ indemniteLogement: num(v) })}
        />
        <Champ
          readOnly={!peutEditer}
          label="Primes fixes"
          type="number"
          value={e.primesFixes}
          onChange={(v) => set({ primesFixes: num(v) })}
        />
        <Champ
          readOnly={!peutEditer}
          label="Heures supplémentaires"
          type="number"
          value={e.heuresSup}
          onChange={(v) => set({ heuresSup: num(v) })}
        />
        <Champ
          readOnly={!peutEditer}
          label="Ancienneté"
          type="number"
          value={e.anciennete}
          onChange={(v) => set({ anciennete: num(v) })}
        />
        <Champ
          readOnly={!peutEditer}
          label="Sanctions"
          type="number"
          value={e.sanctions}
          onChange={(v) => set({ sanctions: num(v) })}
        />
        <Champ
          readOnly={!peutEditer}
          label="Absences"
          type="number"
          value={e.absences}
          onChange={(v) => set({ absences: num(v) })}
        />
        <Champ
          readOnly={!peutEditer}
          label="Dettes de soins"
          type="number"
          value={e.dettesSoins}
          onChange={(v) => set({ dettesSoins: num(v) })}
        />
        <Champ
          readOnly={!peutEditer}
          label="Acompte"
          type="number"
          value={e.acompte}
          onChange={(v) => set({ acompte: num(v) })}
        />
        <Champ
          readOnly={!peutEditer}
          label="Mutuelle (%)"
          type="number"
          value={e.mutuellePct}
          onChange={(v) => set({ mutuellePct: num(v) })}
        />
      </section>

      {/* Bulletin imprimable */}
      <BulletinA4 e={e} c={c} />

      <section className="mx-auto mt-6 max-w-[900px] rounded-lg border border-border bg-card p-4 print:hidden">
        <h2 className="text-sm font-semibold text-foreground">
          Validation et signature RH
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Le visa apparaît sur le bulletin imprimé en PDF.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Champ
            readOnly={!peutEditer}
            label="Responsable RH"
            value={e.responsableRH}
            onChange={(v) => set({ responsableRH: v })}
          />
          <Champ
            readOnly={!peutEditer}
            label="Signature (nom manuscrit)"
            value={e.signatureRH}
            onChange={(v) => set({ signatureRH: v })}
          />
          <div className="flex items-end">
            <button
              type="button"
              disabled={!peutEditer}
              onClick={() => {
                if (!e.valide && e.responsableRH.trim().length < 3) {
                  toast.error("Responsable RH requis", {
                    description:
                      "Renseignez le nom du responsable avant de valider.",
                  });
                  return;
                }
                const nouveau = !e.valide;
                set({
                  valide: nouveau,
                  valideLe: nouveau ? new Date().toLocaleDateString("fr-FR") : "",
                  signatureRH: nouveau
                    ? e.signatureRH || e.responsableRH
                    : e.signatureRH,
                });
                toast.success(
                  nouveau
                    ? `Bulletin de ${e.nom} validé et signé`
                    : "Validation retirée",
                );
              }}
              className={`w-full rounded-md px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${
                e.valide
                  ? "border border-border text-muted-foreground hover:bg-accent"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              }`}
            >
              {e.valide ? "Annuler la validation" : "Valider et signer"}
            </button>
          </div>
        </div>
        {e.valide && (
          <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary">
            <BadgeCheck className="h-4 w-4" /> Validé le {e.valideLe} par{" "}
            {e.responsableRH}
          </p>
        )}
      </section>
    </main>
  );
}

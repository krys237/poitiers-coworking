import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Coins, Inbox, Plus, Trash2 } from "lucide-react";
import { usePaie } from "@/lib/paie-store";
import { useRole } from "@/lib/role-store";
import { RoleSwitcher } from "@/components/role-switcher";
import { Skeleton } from "@/components/ui/skeleton";
import { fcfa } from "@/lib/payroll";
import {
  ecrirePrimes,
  lirePrimes,
  totauxDuMois,
  type LignePrime,
} from "@/lib/primes-store";

export const Route = createFileRoute("/primes")({
  head: () => ({
    meta: [
      { title: "Primes et charges du mois – Gestion de paie" },
      {
        name: "description",
        content:
          "Saisissez les primes et les charges de chaque employé avec montant, date et mois : elles sont reprises automatiquement dans les bulletins.",
      },
      { property: "og:title", content: "Primes et charges de paie" },
      {
        property: "og:description",
        content:
          "Montant, date et mois pour chaque prime ou retenue, appliqués automatiquement aux bulletins des employés.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Primes,
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

function Primes() {
  const { employes, maj } = usePaie();
  const { peut } = useRole();
  const peutEditer = peut("paie:editer");

  const maintenant = new Date();
  const [mois, setMois] = useState(maintenant.getMonth() + 1);
  const [annee, setAnnee] = useState(maintenant.getFullYear());
  const cle = `${annee}-${String(mois).padStart(2, "0")}`;

  const [lignes, setLignes] = useState<LignePrime[]>([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    setLignes(lirePrimes());
    setChargement(false);
  }, []);

  const [employeId, setEmployeId] = useState("");
  const [type, setType] = useState<"prime" | "charge">("prime");
  const [libelle, setLibelle] = useState("");
  const [montant, setMontant] = useState("");
  const [date, setDate] = useState(
    `${String(maintenant.getDate()).padStart(2, "0")}/${String(mois).padStart(2, "0")}/${annee}`,
  );
  const [erreurs, setErreurs] = useState<Record<string, string>>({});

  const duMois = useMemo(
    () => lignes.filter((l) => l.cle === cle),
    [lignes, cle],
  );

  /** Applique automatiquement les totaux du mois aux bulletins. */
  const appliquer = (list: LignePrime[]) => {
    const totaux = totauxDuMois(list, cle);
    for (const e of employes) {
      const t = totaux[e.id] ?? { primes: 0, charges: 0 };
      if (e.primesFixes !== t.primes || e.dettesSoins !== t.charges) {
        maj(e.id, { primesFixes: t.primes, dettesSoins: t.charges });
      }
    }
  };

  const enregistrer = () => {
    const err: Record<string, string> = {};
    if (!employeId) err["employe"] = "Choisissez un employé.";
    if (libelle.trim().length < 2) err["libelle"] = "Indiquez un libellé.";
    const m = Number(montant.replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(m) || m <= 0) err["montant"] = "Montant invalide.";
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(date))
      err["date"] = "Date au format jj/mm/aaaa.";
    setErreurs(err);
    if (Object.keys(err).length) {
      toast.error("Vérifiez les champs en rouge.");
      return;
    }
    const employe = employes.find((e) => e.id === employeId);
    const suite: LignePrime[] = [
      {
        id: crypto.randomUUID(),
        employeId,
        employe: employe?.nom ?? "",
        type,
        libelle: libelle.trim(),
        montant: Math.round(m),
        date,
        cle,
      },
      ...lignes,
    ];
    setLignes(suite);
    ecrirePrimes(suite);
    appliquer(suite);
    setLibelle("");
    setMontant("");
    toast.success(
      `${type === "prime" ? "Prime" : "Charge"} enregistrée pour ${employe?.nom} – reprise dans son bulletin.`,
    );
  };

  const supprimer = (id: string) => {
    const suite = lignes.filter((l) => l.id !== id);
    setLignes(suite);
    ecrirePrimes(suite);
    appliquer(suite);
    toast.success("Ligne supprimée et bulletins mis à jour.");
  };

  const totalPrimes = duMois
    .filter((l) => l.type === "prime")
    .reduce((s, l) => s + l.montant, 0);
  const totalCharges = duMois
    .filter((l) => l.type === "charge")
    .reduce((s, l) => s + l.montant, 0);

  const champ =
    "w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs";

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <header className="mx-auto mb-6 flex max-w-[1200px] flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Ressources humaines
          </p>
          <h1 className="text-3xl font-bold text-foreground">
            Primes et charges
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Montant, date et mois pour chaque prime ou retenue : les totaux du
            mois alimentent automatiquement les bulletins.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/"
            className="rounded-md border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-accent"
          >
            ← Récapitulatif salaire
          </Link>
          <RoleSwitcher />
        </div>
      </header>

      <section className="mx-auto mb-6 max-w-[1200px] rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs">
            <span className="mb-1 block text-muted-foreground">Mois</span>
            <select
              value={mois}
              onChange={(e) => setMois(Number(e.target.value))}
              className={champ}
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
            <input
              type="number"
              value={annee}
              onChange={(e) => setAnnee(Number(e.target.value))}
              className={champ}
            />
          </label>
          <p className="text-xs text-muted-foreground">
            Total primes :{" "}
            <strong className="text-foreground">{fcfa(totalPrimes)}</strong> ·
            Total charges :{" "}
            <strong className="text-foreground">{fcfa(totalCharges)}</strong>
          </p>
        </div>
      </section>

      {peutEditer && (
        <section className="mx-auto mb-6 max-w-[1200px] rounded-lg border border-border bg-card p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Coins className="h-4 w-4 text-primary" /> Nouvelle ligne
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                Employé
              </label>
              <select
                value={employeId}
                onChange={(e) => setEmployeId(e.target.value)}
                className={champ}
              >
                <option value="">— Choisir —</option>
                {employes.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nom}
                  </option>
                ))}
              </select>
              {erreurs["employe"] && (
                <p className="mt-1 text-[11px] text-destructive">
                  {erreurs["employe"]}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                Type
              </label>
              <select
                value={type}
                onChange={(e) =>
                  setType(e.target.value as "prime" | "charge")
                }
                className={champ}
              >
                <option value="prime">Prime (ajoutée au salaire)</option>
                <option value="charge">Charge (retenue)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                Libellé
              </label>
              <input
                value={libelle}
                onChange={(e) => setLibelle(e.target.value)}
                placeholder="Prime de rendement"
                className={champ}
              />
              {erreurs["libelle"] && (
                <p className="mt-1 text-[11px] text-destructive">
                  {erreurs["libelle"]}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                Montant (FCFA)
              </label>
              <input
                value={montant}
                onChange={(e) => setMontant(e.target.value)}
                placeholder="15000"
                className={champ}
              />
              {erreurs["montant"] && (
                <p className="mt-1 text-[11px] text-destructive">
                  {erreurs["montant"]}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                Date
              </label>
              <input
                value={date}
                onChange={(e) => setDate(e.target.value)}
                placeholder="jj/mm/aaaa"
                className={champ}
              />
              {erreurs["date"] && (
                <p className="mt-1 text-[11px] text-destructive">
                  {erreurs["date"]}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={enregistrer}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" /> Enregistrer
          </button>
        </section>
      )}

      <section className="mx-auto max-w-[1200px]">
        {chargement && (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        )}

        {!chargement && duMois.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-card px-6 py-16 text-center">
            <Inbox className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-medium">
              Aucune prime ni charge pour {MOIS[mois - 1]} {annee}
            </p>
            <p className="max-w-md text-xs text-muted-foreground">
              Ajoutez une ligne ci-dessus : elle sera automatiquement reprise
              dans le bulletin de l'employé concerné.
            </p>
          </div>
        )}

        {!chargement && duMois.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full text-xs">
              <thead className="bg-muted text-left">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Employé</th>
                  <th className="px-3 py-2">Libellé</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2 text-right">Montant</th>
                  {peutEditer && <th className="px-3 py-2" />}
                </tr>
              </thead>
              <tbody>
                {duMois.map((l) => (
                  <tr key={l.id} className="border-t border-border">
                    <td className="px-3 py-2">{l.date}</td>
                    <td className="px-3 py-2 font-medium">{l.employe}</td>
                    <td className="px-3 py-2">{l.libelle}</td>
                    <td className="px-3 py-2">
                      {l.type === "prime" ? "Prime" : "Charge"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {l.type === "charge" ? "-" : ""}
                      {fcfa(l.montant)}
                    </td>
                    {peutEditer && (
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => supprimer(l.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 hover:bg-accent"
                        >
                          <Trash2 className="h-3 w-3" /> Supprimer
                        </button>
                      </td>
                    )}
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

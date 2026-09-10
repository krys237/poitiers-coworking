import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Archive,
  Coins,
  UsersRound,
  CalendarRange,
  FileText,
  History,
  Mail,
  CalendarClock,
  CalendarDays, Printer,
} from "lucide-react";
import {
  ANNEES,
  MOIS,
  bornes,
  libellePeriode,
  type Periode,
} from "@/lib/periode";
import { Skeleton } from "@/components/ui/skeleton";
import { usePaie } from "@/lib/paie-store";
import { useRole } from "@/lib/role-store";
import { RoleSwitcher } from "@/components/role-switcher";
import { FicheEmploye } from "@/components/fiche-employe";
import { ImportPaie } from "@/components/import-paie";
import { SaisieMensuelle } from "@/components/saisie-mensuelle";
import { TauxMois } from "@/components/taux-mois";
import { VeilleBareme } from "@/components/veille-bareme";

import {
  calculer,
  fcfa,
  nouvelEmploye,
  type Employe,
  type Societe,
} from "@/lib/payroll";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bulletin de salaire – Récapitulatif et bulletins de paie" },
      {
        name: "description",
        content:
          "Fiche récapitulative des salaires liée aux bulletins de paie : calculs automatiques des primes, retenues, CNPS, IRPP et net à payer.",
      },
      { property: "og:title", content: "Bulletin de salaire" },
      {
        property: "og:description",
        content:
          "Saisissez les éléments variables et générez automatiquement les bulletins de paie.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Recap,
});

const SOCIETES: Societe[] = ["SESAME", "SOFINA", "SGC"];

function Num({
  value,
  onChange,
  step = 1000,
  readOnly = false,
}: {
  value: number;
  onChange: (n: number) => void;
  step?: number;
  readOnly?: boolean;
}) {
  return (
    <input
      type="number"
      step={step}
      value={value}
      readOnly={readOnly}
      disabled={readOnly}
      onChange={(ev) => onChange(Number(ev.target.value) || 0)}
      className="w-24 disabled:cursor-not-allowed disabled:opacity-60 rounded border border-border bg-background px-1 py-0.5 text-right text-xs tabular-nums outline-none focus:border-ring"
    />
  );
}

function Recap() {
  const {
    employes,
    maj,
    ajouter,
    supprimer,
    reinitialiser,
    viderEffectif,
    archiver,
    tauxDe,
    majTaux,
    reinitialiserTaux,
  } = usePaie();
  const { profil, peut } = useRole();
  const [nom, setNom] = useState("");
  const [brut, setBrut] = useState(0);
  const [erreur, setErreur] = useState<string | null>(null);
  const maintenant = new Date();
  const [periode, setPeriode] = useState<Periode>({
    mois: maintenant.getMonth() + 1,
    annee: maintenant.getFullYear(),
  });
  const [generation, setGeneration] = useState(false);
  const [generes, setGeneres] = useState<string[] | null>(null);

  const peutEditer = peut("paie:editer");
  const peutGerer = peut("employes:gerer");
  const peutAffecter = peut("societe:affecter");
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

  const totalPar = (s: Societe) =>
    lignes
      .filter((l) => l.e.societe === s)
      .reduce((acc, l) => acc + l.c.netAPayer, 0);


  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <header className="mx-auto mb-6 flex max-w-[1600px] flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Ressources humaines
          </p>
          <h1 className="text-3xl font-bold text-foreground">
            Bulletin de salaire
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Récapitulatif des salaires
          </p>
          <p className="mt-1 text-sm font-medium text-primary">
            Période de paie : {libellePeriode(periode)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Tout est calculé automatiquement et lié aux bulletins de paie.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-2 print:hidden">
            <CalendarRange className="h-4 w-4 text-primary" />
            <select
              value={periode.mois}
              disabled={!peutEditer}
              onChange={(ev) => {
                setPeriode((p) => ({ ...p, mois: Number(ev.target.value) }));
                setGeneres(null);
              }}
              className="rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:border-ring disabled:opacity-60"
              aria-label="Mois de paie"
            >
              {MOIS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
            <select
              value={periode.annee}
              disabled={!peutEditer}
              onChange={(ev) => {
                setPeriode((p) => ({ ...p, annee: Number(ev.target.value) }));
                setGeneres(null);
              }}
              className="rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:border-ring disabled:opacity-60"
              aria-label="Année de paie"
            >
              {ANNEES.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!peutEditer || generation}
              onClick={() => {
                if (lignes.length === 0) {
                  toast.error("Aucun employé à traiter pour ce profil");
                  return;
                }
                setGeneration(true);
                setGeneres(null);
                const b = bornes(periode);
                window.setTimeout(() => {
                  const majPeriode = {
                    periodeDu: b.du,
                    periodeAu: b.au,
                    datePaiement: b.paiement,
                  };
                  lignes.forEach(({ e }) => maj(e.id, majPeriode));
                  archiver(
                    {
                      cle: `${periode.annee}-${String(periode.mois).padStart(2, "0")}`,
                      mois: periode.mois,
                      annee: periode.annee,
                      libelle: libellePeriode(periode),
                    },
                    lignes.map(({ e }) => ({ ...e, ...majPeriode })),
                  );
                  setGeneres(lignes.map((l) => l.e.id));
                  setGeneration(false);
                  toast.success(
                    `${lignes.length} bulletin(s) générés – ${libellePeriode(periode)}`,
                    {
                      description: `Période du ${b.du} au ${b.au} · archivés dans l'historique`,
                    },
                  );
                }, 700);
              }}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FileText className="h-3.5 w-3.5" />
              {generation ? "Génération…" : "Générer les bulletins du mois"}
            </button>
          </div>
          <Link
            to="/employes"
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-accent"
          >
            <UsersRound className="h-3.5 w-3.5" /> Employés
          </Link>
          <Link
            to="/liste-salaires"
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-accent"
          >
            <FileText className="h-3.5 w-3.5" /> Liste des salaires
          </Link>
          <Link
            to="/bulletins-mois"
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-accent"
          >
            <Printer className="h-3.5 w-3.5" /> Bulletins du mois
          </Link>
          <Link
            to="/historique"
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-accent"
          >
            <History className="h-3.5 w-3.5" /> Historique
          </Link>

          <Link
            to="/primes"
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-accent"
          >
            <Coins className="h-3.5 w-3.5" /> Primes & charges
          </Link>
          <Link
            to="/archives"
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-accent"
          >
            <Archive className="h-3.5 w-3.5" /> Bulletins archivés
          </Link>
          <Link
            to="/courrier"
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-accent"
          >
            <Mail className="h-3.5 w-3.5" /> Courrier de paie
          </Link>
          {peut("simulation:reinitialiser") && (
            <button
              onClick={() => {
                reinitialiser();
                toast.success("Simulation réinitialisée");
              }}
              className="rounded-md border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-accent"
            >
              Réinitialiser la simulation
            </button>
          )}
          <RoleSwitcher />
        </div>
      </header>

      <div className="mx-auto mb-4 max-w-[1600px]">
        <VeilleBareme />
      </div>

      <div className="mx-auto mb-6 max-w-[1600px]">
        <TauxMois
          cle={cle}
          periode={libellePeriode(periode)}
          taux={taux}
          disabled={!peutEditer}
          onChange={(patch) => majTaux(cle, patch)}
          onReset={() => reinitialiserTaux(cle)}
        />
      </div>

      <div className="mx-auto max-w-[1600px] overflow-x-auto rounded-lg border border-border bg-card">

        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th
                colSpan={20}
                className="border border-border bg-primary px-3 py-2 text-center text-base font-bold uppercase text-primary-foreground"
              >
                Récapitulatif salaire
              </th>
            </tr>
            <tr className="bg-muted text-[11px] uppercase text-muted-foreground">
              {[
                "Noms et prénoms",
                "Salaire journalier",
                "Nbre de jours travaillés",
                "Salaire de base",
                "Primes fixes / congé",
                "Heures sup / ancienneté",
              ].map((h) => (
                <th key={h} className="border border-border px-2 py-2">
                  {h}
                </th>
              ))}
              <th className="border border-border bg-chart-2/30 px-2 py-2">
                Total 1
              </th>
              {["Sanctions", "Absence", "Dettes de soins"].map((h) => (
                <th key={h} className="border border-border px-2 py-2">
                  {h}
                </th>
              ))}
              <th className="border border-border px-2 py-2">
                Acompte / dette / impôts &amp; CNPS
              </th>
              <th className="border border-border px-2 py-2">Mutuelle %</th>
              <th className="border border-border px-2 py-2">Mutuelle</th>
              <th className="border border-border bg-chart-2/30 px-2 py-2">
                Total 2
              </th>
              <th className="border border-border bg-chart-1/40 px-2 py-2">
                Salaire SESAME
              </th>
              <th className="border border-border bg-chart-4/40 px-2 py-2">
                Salaire SOFINA
              </th>
              <th className="border border-border bg-chart-2/50 px-2 py-2">
                Salaire SGC
              </th>
              <th className="border border-border px-2 py-2">Bulletin</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map(({ e, c }) => (
              <tr key={e.id} className="hover:bg-accent/40">
                <td className="border border-border px-2 py-1">
                  <input
                    value={e.nom}
                    readOnly={!peutEditer}
                    onChange={(ev) => maj(e.id, { nom: ev.target.value })}
                    className="w-44 rounded border border-transparent bg-transparent px-1 py-0.5 font-semibold outline-none hover:border-border focus:border-ring"
                  />
                  <div className="mt-1 flex items-center gap-1">
                    <input
                      value={e.fonction}
                      readOnly={!peutEditer}
                      onChange={(ev) =>
                        maj(e.id, { fonction: ev.target.value })
                      }
                      placeholder="Fonction"
                      className="w-32 rounded border border-transparent bg-transparent px-1 text-[10px] text-muted-foreground outline-none hover:border-border focus:border-ring"
                    />
                    <FicheEmploye
                      employe={e}
                      disabled={!peutGerer}
                      onEnregistrer={(f) => maj(e.id, f)}
                    />
                    <SaisieMensuelle
                      employe={e}
                      periode={libellePeriode(periode)}
                      taux={taux}
                      disabled={!peutEditer}
                      onEnregistrer={(patch) => maj(e.id, patch)}
                    />

                    {peutGerer && (
                      <button
                        onClick={() => {
                          supprimer(e.id);
                          toast.success(`${e.nom} supprimé du récapitulatif`);
                        }}
                        className="text-[10px] text-destructive hover:underline"
                      >
                        suppr.
                      </button>
                    )}
                  </div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">
                    CNPS {e.cnps || "—"} · {e.adresse || "adresse —"}
                  </div>
                </td>
                <td className="border border-border px-2 py-1 text-right tabular-nums">
                  <div className="text-[10px] text-muted-foreground">
                    Brut&nbsp;
                    <Num
                      readOnly={!peutEditer}
                      value={e.salaireBrut}
                      onChange={(n) => maj(e.id, { salaireBrut: n })}
                      step={5000}
                    />
                  </div>
                  <div className="font-medium">{fcfa(c.salaireJournalier)}</div>
                </td>
                <td className="border border-border px-2 py-1 text-right">
                  <Num
                    readOnly={!peutEditer}
                    value={e.joursTravailles}
                    step={1}
                    onChange={(n) => maj(e.id, { joursTravailles: n })}
                  />
                </td>
                <td className="border border-border px-2 py-1 text-right font-medium tabular-nums">
                  {fcfa(c.salaireBase)}
                </td>
                <td className="border border-border px-2 py-1 text-right">
                  <Num
                    readOnly={!peutEditer}
                    value={e.primesFixes}
                    onChange={(n) => maj(e.id, { primesFixes: n })}
                  />
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    Congés pris&nbsp;
                    <Num
                      readOnly={!peutEditer}
                      value={e.congesJoursPris}
                      step={1}
                      onChange={(n) => maj(e.id, { congesJoursPris: n })}
                    />
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Ind. congés : {fcfa(c.indemniteConges)}
                  </div>
                </td>
                <td className="border border-border px-2 py-1 text-right">
                  <Num
                    readOnly={!peutEditer}
                    value={e.heuresSup}
                    onChange={(n) => maj(e.id, { heuresSup: n })}
                  />
                  <div className="mt-1">
                    <Num
                      readOnly={!peutEditer}
                      value={e.anciennete}
                      onChange={(n) => maj(e.id, { anciennete: n })}
                    />
                  </div>
                </td>
                <td className="border border-border bg-chart-2/20 px-2 py-1 text-right font-semibold tabular-nums">
                  {fcfa(c.total1)}
                </td>
                <td className="border border-border px-2 py-1 text-right">
                  <Num
                    readOnly={!peutEditer}
                    value={e.sanctions}
                    onChange={(n) => maj(e.id, { sanctions: n })}
                  />
                </td>
                <td className="border border-border px-2 py-1 text-right">
                  <Num
                    readOnly={!peutEditer}
                    value={e.absences}
                    onChange={(n) => maj(e.id, { absences: n })}
                  />
                </td>
                <td className="border border-border px-2 py-1 text-right">
                  <Num
                    readOnly={!peutEditer}
                    value={e.dettesSoins}
                    onChange={(n) => maj(e.id, { dettesSoins: n })}
                  />
                </td>
                <td className="border border-border px-2 py-1 text-right">
                  <Num
                    readOnly={!peutEditer}
                    value={e.acompte}
                    onChange={(n) => maj(e.id, { acompte: n })}
                  />
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    + retenues {fcfa(c.totalRetenues)}
                  </div>
                  <div className="font-medium tabular-nums">
                    {fcfa(c.acompteImpotsCnps)}
                  </div>
                </td>
                <td className="border border-border px-2 py-1 text-right">
                  <Num
                    readOnly={!peutEditer}
                    value={e.mutuellePct}
                    step={0.5}
                    onChange={(n) => maj(e.id, { mutuellePct: n })}
                  />
                </td>
                <td className="border border-border px-2 py-1 text-right tabular-nums">
                  {fcfa(c.mutuelle)}
                </td>
                <td className="border border-border bg-chart-2/20 px-2 py-1 text-right font-semibold tabular-nums">
                  {fcfa(c.total2)}
                </td>
                {SOCIETES.map((s) => (
                  <td
                    key={s}
                    className="border border-border px-2 py-1 text-center"
                  >
                    <button
                      disabled={!peutAffecter}
                      onClick={() => {
                        maj(e.id, { societe: s });
                        toast.success(`Salaire affecté à ${s}`);
                      }}
                      className={`w-full rounded px-2 py-1 text-[11px] font-semibold transition ${
                        e.societe === s
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-accent"
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                      aria-pressed={e.societe === s}
                    >
                      {e.societe === s ? fcfa(c.netAPayer) : "⚑"}
                    </button>
                  </td>
                ))}
                <td className="border border-border px-2 py-1 text-center">
                  <Link
                    to="/bulletin/$id"
                    params={{ id: e.id }}
                    className="rounded bg-secondary px-2 py-1 text-[11px] font-medium text-secondary-foreground hover:bg-accent"
                  >
                    Ouvrir
                  </Link>
                </td>
              </tr>
            ))}
            {lignes.length === 0 && (
              <tr>
                <td colSpan={20} className="border border-border px-4 py-12">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <UsersRound className="h-10 w-10 text-muted-foreground" />
                    <p className="text-sm font-medium text-foreground">
                      Aucune fiche de salaire visible pour ce profil
                    </p>
                    <p className="max-w-md text-xs text-muted-foreground">
                      Le profil « {profil.libelle} » ne peut consulter que son
                      propre bulletin. Basculez sur Administrateur ou
                      Gestionnaire RH pour voir tout le récapitulatif.
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="bg-muted font-semibold">
              <td className="border border-border px-2 py-2" colSpan={14}>
                Totaux par société
              </td>
              {SOCIETES.map((s) => (
                <td
                  key={s}
                  className="border border-border px-2 py-2 text-right tabular-nums"
                >
                  {fcfa(totalPar(s))}
                </td>
              ))}
              <td className="border border-border" />
            </tr>
          </tfoot>
        </table>
      </div>

      {(generation || generes) && (
        <section className="mx-auto mt-6 max-w-[1600px] rounded-lg border border-border bg-card p-4">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-foreground">
            <FileText className="h-4 w-4 text-primary" />
            Bulletins de paie – {libellePeriode(periode)}
          </h2>
          {generation ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: Math.max(1, lignes.length) }).map((_, i) => (
                <div key={i} className="rounded-lg border border-border p-3">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="mt-2 h-3 w-24" />
                  <Skeleton className="mt-4 h-8 w-full" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {lignes
                .filter((l) => generes?.includes(l.e.id))
                .map(({ e, c }) => (
                  <article
                    key={e.id}
                    className="flex flex-col gap-1 rounded-lg border border-border p-3"
                  >
                    <p className="text-sm font-semibold text-foreground">
                      {e.nom}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {e.fonction || "Fonction non renseignée"} · {e.societe}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Du {e.periodeDu} au {e.periodeAu}
                    </p>
                    <p className="mt-1 text-base font-bold tabular-nums text-foreground">
                      {fcfa(c.netAPayer)}
                    </p>
                    <Link
                      to="/bulletin/$id"
                      params={{ id: e.id }}
                      className="mt-2 rounded bg-primary px-2 py-1.5 text-center text-xs font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      Voir le bulletin
                    </Link>
                  </article>
                ))}
            </div>
          )}
        </section>
      )}

      {peutGerer && (
        <div className="mx-auto mt-6 max-w-[1600px]">
          <ImportPaie disabled={!peutGerer} />
        </div>
      )}

      <section className="mx-auto mt-6 max-w-[1600px] rounded-lg border border-border bg-card p-4 text-sm">
        {peutGerer && (
        <>
        <h2 className="mb-3 font-semibold text-foreground">
          Fiches employés
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <FicheEmploye onEnregistrer={(f) => ajouter(f)} />
          <span className="text-xs text-muted-foreground">
            ou ajout rapide :
          </span>
          <input
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder="Noms et prénoms"
            className="rounded border border-border bg-background px-2 py-1 text-sm outline-none focus:border-ring"
          />
          <input
            type="number"
            value={brut}
            onChange={(e) => setBrut(Number(e.target.value) || 0)}
            placeholder="Salaire brut"
            className="w-40 rounded border border-border bg-background px-2 py-1 text-sm outline-none focus:border-ring"
          />
          <button
            onClick={() => {
              if (nom.trim().length < 3) {
                setErreur("Le nom doit contenir au moins 3 caractères.");
                toast.error("Formulaire incomplet");
                return;
              }
              if (brut <= 0) {
                setErreur("Le salaire brut doit être supérieur à 0.");
                toast.error("Salaire brut invalide");
                return;
              }
              setErreur(null);
              ajouter(nouvelEmploye(nom.toUpperCase(), brut) as Employe);
              toast.success(`${nom.toUpperCase()} ajouté au récapitulatif`);
              setNom("");
              setBrut(0);
            }}
            className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Ajouter
          </button>
          <button
            onClick={() => {
              viderEffectif();
              toast.success("Effectif vidé", {
                description:
                  "Créez vos fiches employés ou importez votre fichier Excel/CSV.",
              });
            }}
            className="rounded border border-border px-3 py-1.5 text-xs font-medium text-destructive hover:bg-accent"
          >
            Vider l'effectif simulé
          </button>
        </div>
        {erreur && (
          <p className="mt-2 text-xs font-medium text-destructive">{erreur}</p>
        )}
        </>
        )}
        <div className="mt-4 space-y-1 text-xs text-muted-foreground">
          <p>
            <strong className="text-foreground">TOTAL 1</strong> = salaire de
            base + primes + congés + heures sup + ancienneté
          </p>
          <p>
            <strong className="text-foreground">TOTAL 2 (salaire net)</strong> =
            TOTAL 1 − sanctions − absence − dettes de soins − (acompte + impôts
            &amp; CNPS) − mutuelle
          </p>
          <p>
            Salaire journalier = salaire brut / 30 · Salaire de base = journalier
            × jours travaillés · Mutuelle = TOTAL 1 × %
          </p>
        </div>
      </section>
    </main>
  );
}

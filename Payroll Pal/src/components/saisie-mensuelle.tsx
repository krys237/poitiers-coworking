import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ClipboardEdit } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { calculer, fcfa, type Employe, type Taux } from "@/lib/payroll";

type Champs = {
  joursTravailles: number;
  absences: number;
  sanctions: number;
  dettesSoins: number;
  acompte: number;
  primesFixes: number;
  primeTransport: number;
  primeAssiduite: number;
  indemniteLogement: number;
  heuresSup: number;
  anciennete: number;
  congesJoursPris: number;
  mutuellePct: number;
};

const depuis = (e: Employe): Champs => ({
  joursTravailles: e.joursTravailles,
  absences: e.absences,
  sanctions: e.sanctions,
  dettesSoins: e.dettesSoins,
  acompte: e.acompte,
  primesFixes: e.primesFixes,
  primeTransport: e.primeTransport,
  primeAssiduite: e.primeAssiduite,
  indemniteLogement: e.indemniteLogement,
  heuresSup: e.heuresSup,
  anciennete: e.anciennete,
  congesJoursPris: e.congesJoursPris,
  mutuellePct: e.mutuellePct,
});

function valider(c: Champs) {
  const err: Partial<Record<keyof Champs, string>> = {};
  if (c.joursTravailles < 0 || c.joursTravailles > 31)
    err.joursTravailles = "Entre 0 et 31 jours.";
  if (c.congesJoursPris < 0 || c.congesJoursPris > 31)
    err.congesJoursPris = "Entre 0 et 31 jours.";
  if (c.mutuellePct < 0 || c.mutuellePct > 100)
    err.mutuellePct = "Pourcentage entre 0 et 100.";
  (
    [
      "absences",
      "sanctions",
      "dettesSoins",
      "acompte",
      "primesFixes",
      "primeTransport",
      "primeAssiduite",
      "indemniteLogement",
      "heuresSup",
      "anciennete",
    ] as const
  ).forEach((k) => {
    if (c[k] < 0) err[k] = "Montant négatif interdit.";
  });
  return err;
}

/** Saisie manuelle des éléments variables du mois pour un employé. */
export function SaisieMensuelle({
  employe,
  periode,
  taux,
  disabled,
  onEnregistrer,
}: {
  employe: Employe;
  periode: string;
  taux: Taux;
  disabled?: boolean;
  onEnregistrer: (patch: Partial<Employe>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [c, setC] = useState<Champs>(() => depuis(employe));
  const [err, setErr] = useState<Partial<Record<keyof Champs, string>>>({});

  useEffect(() => {
    if (open) {
      setC(depuis(employe));
      setErr({});
    }
  }, [open, employe]);

  const apercu = calculer({ ...employe, ...c }, taux);

  const champ = (
    cle: keyof Champs,
    label: string,
    step = 1000,
    suffixe?: string,
  ) => (
    <label className="block text-xs">
      <span className="mb-1 block font-medium text-foreground">
        {label}
        {suffixe ? ` (${suffixe})` : ""}
      </span>
      <input
        type="number"
        step={step}
        value={c[cle]}
        onChange={(ev) =>
          setC({ ...c, [cle]: Number(ev.target.value) || 0 })
        }
        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-right tabular-nums outline-none focus:border-ring"
      />
      {err[cle] && (
        <span className="mt-1 block text-[11px] font-medium text-destructive">
          {err[cle]}
        </span>
      )}
    </label>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 text-[10px] font-medium text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ClipboardEdit className="h-3 w-3" /> Saisie du mois
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Saisie du mois – {employe.nom}</DialogTitle>
          <DialogDescription>
            Éléments variables de {periode}. Le récapitulatif et le bulletin se
            recalculent automatiquement à l'enregistrement.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {champ("joursTravailles", "Jours travaillés", 1)}
          {champ("congesJoursPris", "Congés pris", 1, "jours")}
          {champ("absences", "Absences", 1000, "FCFA")}
          {champ("sanctions", "Sanctions", 1000, "FCFA")}
          {champ("dettesSoins", "Dettes & soins", 1000, "FCFA")}
          {champ("acompte", "Acompte", 1000, "FCFA")}
          {champ("primesFixes", "Primes fixes", 1000, "FCFA")}
          {champ("primeTransport", "Prime transport", 1000, "FCFA")}
          {champ("primeAssiduite", "Prime assiduité", 1000, "FCFA")}
          {champ("indemniteLogement", "Ind. logement", 1000, "FCFA")}
          {champ("heuresSup", "Heures supplémentaires", 1000, "FCFA")}
          {champ("anciennete", "Ancienneté", 1000, "FCFA")}
          {champ("mutuellePct", "Mutuelle", 0.5, "%")}
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-md border border-border bg-muted/40 p-3 text-xs sm:grid-cols-4">
          {[
            ["Salaire de base", apercu.salaireBase],
            ["Total brut", apercu.total1],
            ["Mutuelle", apercu.mutuelle],
            ["Net à payer", apercu.netAPayer],
          ].map(([l, v]) => (
            <div key={l as string}>
              <span className="block text-muted-foreground">{l as string}</span>
              <span className="font-semibold tabular-nums text-foreground">
                {fcfa(v as number)} FCFA
              </span>
            </div>
          ))}
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md border border-border px-3 py-2 text-xs font-medium hover:bg-accent"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => {
              const e2 = valider(c);
              setErr(e2);
              if (Object.keys(e2).length > 0) {
                toast.error("Corrigez les champs en rouge.");
                return;
              }
              onEnregistrer(c);
              toast.success(`Saisie du mois enregistrée pour ${employe.nom}`);
              setOpen(false);
            }}
            className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Enregistrer la saisie
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

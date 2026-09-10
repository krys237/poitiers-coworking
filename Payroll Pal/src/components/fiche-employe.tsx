import { useEffect, useState } from "react";
import { toast } from "sonner";
import { IdCard, Plus, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { nouvelEmploye, type Employe, type Societe } from "@/lib/payroll";

const SOCIETES: Societe[] = ["SESAME", "SOFINA", "SGC"];

type Champs = {
  nom: string;
  fonction: string;
  adresse: string;
  cnps: string;
  niu: string;
  matricule: string;
  departement: string;
  salaireBrut: number;
  joursTravailles: number;
  societe: Societe;
};

const depuis = (e?: Employe): Champs => ({
  nom: e?.nom ?? "",
  fonction: e?.fonction ?? "",
  adresse: e?.adresse ?? "",
  cnps: e?.cnps ?? "",
  niu: e?.niu ?? "",
  matricule: e?.matricule ?? "",
  departement: e?.departement ?? "",
  salaireBrut: e?.salaireBrut ?? 0,
  joursTravailles: e?.joursTravailles ?? 30,
  societe: e?.societe ?? "SGC",
});

function valider(c: Champs) {
  const err: Partial<Record<keyof Champs, string>> = {};
  if (c.nom.trim().length < 3) err.nom = "Le nom doit contenir au moins 3 caractères.";
  if (c.fonction.trim().length < 2) err.fonction = "La fonction est obligatoire.";
  if (c.adresse.trim().length < 2) err.adresse = "L'adresse est obligatoire.";
  if (!/^[0-9\-\s/]{6,}$/.test(c.cnps.trim()))
    err.cnps = "Numéro CNPS invalide (chiffres et tirets, 6 caractères min.).";
  if (!(c.salaireBrut > 0)) err.salaireBrut = "Le salaire brut doit être supérieur à 0.";
  if (c.joursTravailles < 0 || c.joursTravailles > 31)
    err.joursTravailles = "Les jours travaillés doivent être compris entre 0 et 31.";
  return err;
}

export function FicheEmploye({
  employe,
  onEnregistrer,
  disabled,
}: {
  employe?: Employe;
  onEnregistrer: (e: Employe) => void;
  disabled?: boolean;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [c, setC] = useState<Champs>(depuis(employe));
  const [err, setErr] = useState<Partial<Record<keyof Champs, string>>>({});

  useEffect(() => {
    if (ouvert) {
      setC(depuis(employe));
      setErr({});
    }
  }, [ouvert, employe]);

  const set = (patch: Partial<Champs>) => setC((v) => ({ ...v, ...patch }));

  const Texte = ({
    id,
    label,
    value,
    onChange,
    type = "text",
    placeholder,
  }: {
    id: keyof Champs;
    label: string;
    value: string | number;
    onChange: (v: string) => void;
    type?: string;
    placeholder?: string;
  }) => (
    <label className="flex flex-col gap-1 text-xs">
      <span className="font-medium text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(ev) => onChange(ev.target.value)}
        aria-invalid={Boolean(err[id])}
        className="rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-ring aria-[invalid=true]:border-destructive"
      />
      {err[id] && (
        <span className="text-[11px] font-medium text-destructive">{err[id]}</span>
      )}
    </label>
  );

  return (
    <Dialog open={ouvert} onOpenChange={setOuvert}>
      <DialogTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={
            employe
              ? "inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-accent disabled:opacity-50"
              : "inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          }
        >
          {employe ? (
            <>
              <Pencil className="h-3 w-3" /> Fiche
            </>
          ) : (
            <>
              <Plus className="h-3.5 w-3.5" /> Nouvelle fiche employé
            </>
          )}
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IdCard className="h-4 w-4 text-primary" />
            {employe ? `Fiche employé – ${employe.nom}` : "Nouvelle fiche employé"}
          </DialogTitle>
          <DialogDescription>
            Ces informations alimentent automatiquement le récapitulatif salaire
            et le bulletin de paie.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <Texte id="nom" label="Noms et prénoms *" value={c.nom} onChange={(v) => set({ nom: v.toUpperCase() })} placeholder="TARGNE JEAN BEAU" />
          <Texte id="fonction" label="Fonction *" value={c.fonction} onChange={(v) => set({ fonction: v })} placeholder="Agent commercial" />
          <Texte id="adresse" label="Adresse *" value={c.adresse} onChange={(v) => set({ adresse: v })} placeholder="Akwa, Douala" />
          <Texte id="cnps" label="N° CNPS *" value={c.cnps} onChange={(v) => set({ cnps: v })} placeholder="351-1213677-6" />
          <Texte id="niu" label="NIU" value={c.niu} onChange={(v) => set({ niu: v })} placeholder="M072517858332C" />
          <Texte id="matricule" label="Matricule" value={c.matricule} onChange={(v) => set({ matricule: v })} placeholder="EMP-005" />
          <Texte id="departement" label="Département" value={c.departement} onChange={(v) => set({ departement: v })} placeholder="Commercial" />
          <Texte id="salaireBrut" label="Salaire brut mensuel (FCFA) *" type="number" value={c.salaireBrut} onChange={(v) => set({ salaireBrut: Number(v) || 0 })} />
          <Texte id="joursTravailles" label="Jours travaillés *" type="number" value={c.joursTravailles} onChange={(v) => set({ joursTravailles: Number(v) || 0 })} />
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-muted-foreground">Société payeuse</span>
            <select
              value={c.societe}
              onChange={(ev) => set({ societe: ev.target.value as Societe })}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-ring"
            >
              {SOCIETES.map((s) => (
                <option key={s} value={s}>
                  SALAIRE {s}
                </option>
              ))}
            </select>
          </label>
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => setOuvert(false)}
            className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-accent"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => {
              const e2 = valider(c);
              setErr(e2);
              if (Object.keys(e2).length > 0) {
                toast.error("Fiche incomplète", {
                  description: "Corrigez les champs en rouge avant d'enregistrer.",
                });
                return;
              }
              const base = employe ?? nouvelEmploye(c.nom, c.salaireBrut, c.fonction);
              onEnregistrer({ ...base, ...c });
              toast.success(
                employe ? `Fiche de ${c.nom} mise à jour` : `${c.nom} ajouté à l'effectif`,
                { description: "Le récapitulatif et le bulletin sont recalculés." },
              );
              setOuvert(false);
            }}
            className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Enregistrer la fiche
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

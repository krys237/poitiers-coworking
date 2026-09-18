/**
 * Fiche employé (reprise du modèle du directeur) : identité, société, brut de
 * référence, date d'entrée, congés initiaux — en création comme en modification —
 * et le retrait de l'effectif (ou sa réactivation), confirmés.
 *
 * Partagée par l'écran Employés et le récapitulatif salaires. Le nom et le
 * matricule ne se modifient pas (identité de paie) ; ils se saisissent à la création.
 */
import * as React from "react";
import { toast } from "sonner";
import { UserRoundPenIcon, UserRoundPlusIcon } from "lucide-react";
import { messageErreur } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Champ, ChampNombre } from "@/components/app/champs";
import { BoutonConfirmation } from "@/components/app/bouton-action";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export const SOCIETES = ["SESAME", "SOFINA", "SGC"] as const;
export type Societe = (typeof SOCIETES)[number];

/** Ce que la fiche lit et écrit. `employeId` absent = création. */
export type EmployeFiche = {
  employeId?: string;
  matricule: string; nom: string; fonction?: string; adresse?: string; cnps?: string; niu?: string; email?: string;
  societe: Societe; salaireBrut: number; dateDebut?: string; congesInitial?: number; actif?: boolean;
};
type Champs = Required<Omit<EmployeFiche, "employeId" | "actif">>;

export type CreerEmploye = (a: { matricule: string; nom: string; fonction?: string; adresse?: string; cnps?: string; niu?: string; email?: string; societe: Societe; salaireBrut: number; dateDebut?: string; congesInitial?: number }) => Promise<unknown>;
export type ModifierEmploye = (a: { employeId: any; fonction?: string; adresse?: string; cnps?: string; niu?: string; email?: string; societe?: Societe; salaireBrut?: number; dateDebut?: string; congesInitial?: number; actif?: boolean }) => Promise<unknown>;

const depuis = (e?: EmployeFiche): Champs => ({
  matricule: e?.matricule ?? "", nom: e?.nom ?? "", fonction: e?.fonction ?? "", adresse: e?.adresse ?? "", cnps: e?.cnps ?? "",
  niu: e?.niu ?? "", email: e?.email ?? "", societe: e?.societe ?? "SGC", salaireBrut: e?.salaireBrut ?? 0,
  dateDebut: e?.dateDebut ?? "", congesInitial: e?.congesInitial ?? 0,
});

export function FicheEmploye({
  employe, creer, modifier, disabled, declencheur, onEnregistre,
}: {
  employe?: EmployeFiche;
  creer: CreerEmploye;
  modifier: ModifierEmploye;
  disabled?: boolean;
  declencheur?: React.ReactNode;
  onEnregistre?: (id?: string) => void;
}) {
  const creation = !employe?.employeId;
  const [open, setOpen] = React.useState(false);
  const [f, setF] = React.useState<Champs>(() => depuis(employe));
  const [enCours, setEnCours] = React.useState(false);
  React.useEffect(() => { if (open) setF(depuis(employe)); }, [open, employe]);

  const texte = (cle: keyof Champs, libelle: string, placeholder?: string, requis?: boolean, type = "text") => (
    <Champ libelle={libelle} requis={requis}>
      {(a) => <Input {...a} type={type} required={requis} placeholder={placeholder} value={f[cle] as string} onChange={(e) => setF({ ...f, [cle]: e.target.value })} />}
    </Champ>
  );

  const enregistrer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creation && (!f.nom.trim() || !f.matricule.trim())) { toast.error("Matricule et nom sont requis."); return; }
    if (f.salaireBrut <= 0) { toast.error("Le salaire brut doit être supérieur à 0."); return; }
    setEnCours(true);
    const commun = {
      fonction: f.fonction || undefined, adresse: f.adresse || undefined, cnps: f.cnps || undefined, niu: f.niu || undefined,
      email: f.email || undefined, societe: f.societe, salaireBrut: Math.round(f.salaireBrut), dateDebut: f.dateDebut || undefined,
      congesInitial: f.congesInitial || undefined,
    };
    try {
      if (creation) {
        const id = await creer({ matricule: f.matricule.trim(), nom: f.nom.trim().toUpperCase(), ...commun });
        toast.success(`${f.nom.trim().toUpperCase()} ajouté à l'effectif`, { description: `${f.matricule} · ${f.societe}` });
        onEnregistre?.(typeof id === "string" ? id : undefined);
      } else {
        await modifier({ employeId: employe!.employeId, ...commun });
        toast.success(`Fiche de ${employe!.nom} enregistrée`);
        onEnregistre?.(employe!.employeId);
      }
      setOpen(false);
    } catch (err) {
      toast.error("Fiche non enregistrée", { description: messageErreur(err) });
    } finally { setEnCours(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {declencheur ?? (
          <Button variant={creation ? "default" : "outline"} size="sm" disabled={disabled}>
            {creation ? <><UserRoundPlusIcon /> Nouvel employé</> : <><UserRoundPenIcon /> Fiche</>}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={enregistrer}>
          <DialogHeader>
            <DialogTitle>{creation ? "Nouvel employé" : `Fiche employé — ${employe!.nom}`}</DialogTitle>
            <DialogDescription>
              {creation
                ? "La fiche crée l'identité de paie ; le récapitulatif du mois se recalcule aussitôt."
                : `Matricule ${employe!.matricule}. Le brut de référence alimente le salaire journalier (brut ÷ 30).`}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {creation ? (
              <>
                {texte("matricule", "Matricule", "E009", true)}
                <div className="col-span-2">{texte("nom", "Noms et prénoms", "TARGNE Jean Beau", true)}</div>
              </>
            ) : null}
            {texte("fonction", "Fonction", "Agent commercial")}
            <Champ libelle="Société" requis>
              {(a) => (
                <Select value={f.societe} onValueChange={(v) => setF({ ...f, societe: v as Societe })}>
                  <SelectTrigger id={a.id} className="w-full" aria-label="Société"><SelectValue /></SelectTrigger>
                  <SelectContent>{SOCIETES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              )}
            </Champ>
            <ChampNombre libelle="Salaire brut mensuel" unite="FCFA" requis min={0} step={5000} valeur={f.salaireBrut} onChange={(n) => setF({ ...f, salaireBrut: n })} />
            {texte("cnps", "N° CNPS", "351-1213677-6")}
            {texte("niu", "NIU", "M072517858332C")}
            {texte("email", "E-mail (courrier de paie)", "prenom.nom@…", false, "email")}
            <div className="col-span-2 sm:col-span-3">{texte("adresse", "Adresse", "Akwa, Douala")}</div>
            {texte("dateDebut", "Date d'entrée", undefined, false, "date")}
            <ChampNombre libelle="Congés initiaux" unite="j" min={0} step={0.5} decimales valeur={f.congesInitial} onChange={(n) => setF({ ...f, congesInitial: n })} aide="Solde reporté à l'arrivée" />
          </div>
          <DialogFooter className="mt-5 sm:justify-between">
            {!creation ? (
              employe!.actif === false ? (
                <Button
                  type="button" variant="outline" size="sm"
                  onClick={async () => { await modifier({ employeId: employe!.employeId, actif: true }); toast.success(`${employe!.nom} réintégré à l'effectif`); setOpen(false); }}
                >
                  Réintégrer à l'effectif
                </Button>
              ) : (
                <BoutonConfirmation
                  variant="ghost"
                  size="sm"
                  className="text-carmin hover:bg-carmin-clair hover:text-carmin"
                  libelle="Retirer de l'effectif"
                  titre={`Retirer ${employe!.nom} de l'effectif ?`}
                  consequence="La fiche est conservée (historique de paie, archives) mais l'employé disparaît du récapitulatif des mois ouverts. Réintégrable depuis sa fiche."
                  confirmer="Retirer"
                  onConfirmer={async () => { await modifier({ employeId: employe!.employeId, actif: false }); setOpen(false); }}
                  succes={`${employe!.nom} retiré de l'effectif`}
                />
              )
            ) : <span />}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={enCours}>Annuler</Button>
              <Button type="submit" disabled={enCours}>{creation ? "Créer l'employé" : "Enregistrer la fiche"}</Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

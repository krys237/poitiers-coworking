/**
 * Fiche employé du récapitulatif (reprise du modèle du directeur) : identité,
 * société, brut de référence, date d'entrée, congés initiaux — en création
 * comme en modification — et le retrait de l'effectif, confirmé.
 *
 * Le nom et le matricule ne se modifient pas ici (identité de paie) ; ils se
 * saisissent à la création.
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
import { type BulletinLigne, type RecapPaie, type Societe, SOCIETES } from "./commun";

type Fiche = {
  matricule: string; nom: string; fonction: string; adresse: string; cnps: string; niu: string; email: string;
  societe: Societe; salaireBrut: number; dateDebut: string; congesInitial: number;
};

const depuis = (b?: BulletinLigne): Fiche => ({
  matricule: b?.matricule ?? "", nom: b?.nom ?? "", fonction: b?.fonction ?? "", adresse: b?.adresse ?? "",
  cnps: b?.cnps ?? "", niu: b?.niu ?? "", email: b?.email ?? "", societe: (b?.societe ?? "SGC") as Societe,
  salaireBrut: b?.salaireBrut ?? 0, dateDebut: b?.dateDebut ?? "", congesInitial: 0,
});

export function FicheEmploye({
  b, recap, disabled, declencheur,
}: {
  /** Absent = création d'un nouvel employé. */
  b?: BulletinLigne;
  recap: RecapPaie;
  disabled?: boolean;
  declencheur?: React.ReactNode;
}) {
  const creation = !b;
  const [open, setOpen] = React.useState(false);
  const [f, setF] = React.useState<Fiche>(() => depuis(b));
  const [enCours, setEnCours] = React.useState(false);
  React.useEffect(() => { if (open) setF(depuis(b)); }, [open, b]);

  const texte = (cle: keyof Fiche, libelle: string, placeholder?: string, requis?: boolean, type = "text") => (
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
    };
    try {
      if (creation) {
        await recap.creerEmploye({ matricule: f.matricule.trim(), nom: f.nom.trim().toUpperCase(), ...commun, congesInitial: f.congesInitial || undefined });
        toast.success(`${f.nom.trim().toUpperCase()} ajouté à l'effectif`, { description: `${f.matricule} · ${f.societe}` });
      } else {
        await recap.modifierEmploye({ employeId: b!.employeId, ...commun, congesInitial: f.congesInitial || undefined });
        toast.success(`Fiche de ${b!.nom} enregistrée`);
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
            <DialogTitle>{creation ? "Nouvel employé" : `Fiche employé — ${b!.nom}`}</DialogTitle>
            <DialogDescription>
              {creation
                ? "La fiche crée l'identité de paie ; le récapitulatif du mois se recalcule aussitôt."
                : `Matricule ${b!.matricule}. Le brut de référence alimente le salaire journalier (brut ÷ 30).`}
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
              <BoutonConfirmation
                variant="ghost"
                size="sm"
                className="text-carmin hover:bg-carmin-clair hover:text-carmin"
                libelle="Retirer de l'effectif"
                titre={`Retirer ${b!.nom} de l'effectif ?`}
                consequence="La fiche est conservée (historique de paie, archives) mais l'employé disparaît du récapitulatif des mois ouverts. Réactivable depuis l'écran Employés."
                confirmer="Retirer"
                onConfirmer={async () => { await recap.modifierEmploye({ employeId: b!.employeId, actif: false }); setOpen(false); }}
                succes={`${b!.nom} retiré de l'effectif`}
              />
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

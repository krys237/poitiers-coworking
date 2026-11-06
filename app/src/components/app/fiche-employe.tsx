/**
 * Fiche employé (reprise du modèle du directeur) : identité, société, brut de
 * référence, date d'entrée, congés initiaux — en création comme en modification —
 * et le retrait de l'effectif (ou sa réactivation), confirmés.
 *
 * Partagée par l'écran Employés et le récapitulatif salaires. Le nom et le
 * matricule ne se modifient pas (identité de paie) ; ils se saisissent à la création.
 */
import * as React from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "sonner";
import { UserRoundPenIcon, UserRoundPlusIcon } from "lucide-react";
import { messageErreur } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Champ, ChampNombre } from "@/components/app/champs";
import { ChampAutocomplete } from "@/components/app/champ-autocomplete";
import { ChampTelephone } from "@/components/app/champ-telephone";
import { erreurTelephone } from "../../../convex/lib/telephone";
import { BoutonConfirmation } from "@/components/app/bouton-action";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export const SOCIETES = ["SESAME", "SOFINA", "SGC"] as const;
export type Societe = (typeof SOCIETES)[number];

/** Ce que la fiche lit et écrit. `employeId` absent = création. */
export type EmployeFiche = {
  employeId?: string;
  matricule: string; nom: string; fonction?: string; adresse?: string; cnps?: string; niu?: string; email?: string; whatsapp?: string;
  societe: Societe; salaireBase?: number; salaireBrut?: number; dateDebut?: string; congesInitial?: number; actif?: boolean;
  serviceId?: string; immatriculeImpots?: boolean; dateEntreeCnps?: string;
  methodeEnvoi?: "auto" | "email" | "whatsapp";
};
// `salaireBrut` est l'ancien nom, encore présent dans les fiches non migrées : le formulaire
// ne l'édite jamais, il ne travaille que sur `salaireBase`.
type Champs = Required<Omit<EmployeFiche, "employeId" | "actif" | "salaireBrut">>;

export type CreerEmploye = (a: { matricule: string; nom: string; fonction?: string; adresse?: string; cnps?: string; niu?: string; email?: string; whatsapp?: string; societe: Societe; salaireBase: number; dateDebut?: string; congesInitial?: number;
  serviceId?: string; immatriculeImpots?: boolean; dateEntreeCnps?: string;
  methodeEnvoi?: "auto" | "email" | "whatsapp";
  /** Sociétés supplémentaires à rattacher dès la création (lot R10). */
  rattachements?: { societe: Societe; salaireBase?: number }[] }) => Promise<unknown>;
export type ModifierEmploye = (a: { employeId: any; fonction?: string; adresse?: string; cnps?: string; niu?: string; email?: string; whatsapp?: string; societe?: Societe; salaireBase?: number; dateDebut?: string; congesInitial?: number; actif?: boolean;
  serviceId?: string; immatriculeImpots?: boolean; dateEntreeCnps?: string;
  methodeEnvoi?: "auto" | "email" | "whatsapp" }) => Promise<unknown>;

const depuis = (e?: EmployeFiche): Champs => ({
  matricule: e?.matricule ?? "", nom: e?.nom ?? "", fonction: e?.fonction ?? "", adresse: e?.adresse ?? "", cnps: e?.cnps ?? "",
  niu: e?.niu ?? "", email: e?.email ?? "", whatsapp: e?.whatsapp ?? "", societe: e?.societe ?? "SGC", salaireBase: e?.salaireBase ?? e?.salaireBrut ?? 0,
  dateDebut: e?.dateDebut ?? "", congesInitial: e?.congesInitial ?? 0,
  serviceId: e?.serviceId ?? "", immatriculeImpots: e?.immatriculeImpots ?? false,
  dateEntreeCnps: e?.dateEntreeCnps ?? "", methodeEnvoi: e?.methodeEnvoi ?? "auto",
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
  // Sociétés SUPPLÉMENTAIRES, saisies dès la création (lot R10). La société de la fiche reste la
  // principale : elle n'apparaît donc pas dans cette liste, et le backend la matérialise.
  //
  // Le composant `RattachementsEmploye` n'est pas réutilisé ici : il agit par mutations sur une
  // fiche DÉJÀ enregistrée. Le mettre en mode brouillon serait disproportionné pour deux lignes.
  const [autresSocietes, setAutresSocietes] = React.useState<Record<string, number | null>>({});
  const basculerSociete = (soc: Societe) =>
    setAutresSocietes((x) => {
      const n = { ...x };
      if (soc in n) delete n[soc];
      else n[soc] = null;
      return n;
    });
  // Les services alimentent le sélecteur : sans service, la frise annuelle affiche un
  // code couleur neutre, ce que la RH avait signalé le 03/11/2026.
  const services = useQuery(api.services.liste, {});
  // Référentiel des fonctions : « les fonctions sont vides » venait de l'absence de
  // toute proposition à la saisie (constat du 03/11/2026).
  const fonctions = useQuery(api.fonctions.liste, {});
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
    if (f.salaireBase <= 0) { toast.error("Le salaire de base doit être supérieur à 0."); return; }
    setEnCours(true);
    const commun = {
      fonction: f.fonction || undefined, adresse: f.adresse || undefined, cnps: f.cnps || undefined, niu: f.niu || undefined,
      email: f.email || undefined, societe: f.societe, salaireBase: Math.round(f.salaireBase), dateDebut: f.dateDebut || undefined,
      serviceId: f.serviceId || undefined, immatriculeImpots: f.immatriculeImpots,
      dateEntreeCnps: f.dateEntreeCnps || undefined, methodeEnvoi: f.methodeEnvoi,
      congesInitial: f.congesInitial || undefined,
    };
    // WhatsApp : transmis seulement s'il a changé (les écrans qui ne le chargent pas ne l'effacent pas).
    const whatsapp = f.whatsapp !== (employe?.whatsapp ?? "") ? f.whatsapp : undefined;
    try {
      if (creation) {
        const rattachements = Object.entries(autresSocietes).map(([societe, salaire]) => ({
          societe: societe as Societe,
          ...(salaire !== null && salaire > 0 ? { salaireBase: salaire } : {}),
        }));
        const id = await creer({
          matricule: f.matricule.trim(), nom: f.nom.trim().toUpperCase(), ...commun,
          whatsapp: whatsapp || undefined,
          ...(rattachements.length ? { rattachements } : {}),
        });
        toast.success(`${f.nom.trim().toUpperCase()} ajouté à l'effectif`, { description: `${f.matricule} · ${f.societe}` });
        onEnregistre?.(typeof id === "string" ? id : undefined);
      } else {
        await modifier({ employeId: employe!.employeId, ...commun, whatsapp });
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
                : `Matricule ${employe!.matricule}. Le salaire de base alimente le salaire journalier (brut ÷ 30).`}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 sm:grid-cols-3">
            {creation ? (
              <>
                {texte("matricule", "Matricule", "E009", true)}
                <div className="min-[480px]:col-span-2">{texte("nom", "Noms et prénoms", "TARGNE Jean Beau", true)}</div>
              </>
            ) : null}
            <Champ libelle="Fonction" aide="Proposée depuis le référentiel ; une saisie libre reste acceptée et sera conservée">
              {() => (
                <ChampAutocomplete
                  valeur={f.fonction}
                  ariaLabel="Fonction"
                  placeholder="Infirmier(ère), Aide-soignant(e)…"
                  options={(fonctions ?? []).map((x: { libelle: string; categorie?: string; echelon?: string }) => ({
                    valeur: x.libelle,
                    libelle: x.libelle,
                    note: [x.categorie && `cat. ${x.categorie}`, x.echelon && `éch. ${x.echelon}`]
                      .filter(Boolean).join(" · ") || undefined,
                  }))}
                  // La catégorie et l'échelon du référentiel sont affichés en note mais pas
                  // repris : ce formulaire ne les édite pas, ils vivent sur le bulletin.
                  onChange={(v) => setF({ ...f, fonction: v })}
                />
              )}
            </Champ>
            <Champ libelle="Société" requis>
              {(a) => (
                <Select value={f.societe} onValueChange={(v) => setF({ ...f, societe: v as Societe })}>
                  <SelectTrigger id={a.id} className="w-full" aria-label="Société"><SelectValue /></SelectTrigger>
                  <SelectContent>{SOCIETES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              )}
            </Champ>
            <ChampNombre libelle="Salaire de base mensuel" aide="Hors primes : transport, assiduité, logement et ancienneté se saisissent dans le récapitulatif du mois." unite="FCFA" requis min={0} step={5000} valeur={f.salaireBase} onChange={(n) => setF({ ...f, salaireBase: n })} />
            {/* Lot R10 : les autres sociétés dès la création, et non en deux temps. Un
                rattachement refusé annule la création entière — la mutation est transactionnelle. */}
            {creation ? (
              <div className="sm:col-span-2 rounded-lg border border-filet bg-papier p-3">
                <div className="text-xs font-semibold">Autres sociétés qui la rémunèrent</div>
                <p className="mt-0.5 text-2xs text-encre-pale">
                  Facultatif. Chaque société verse sa part et produit son propre bulletin. Sans
                  montant, c'est le salaire de base ci-dessus qui s'applique.
                </p>
                <div className="mt-2 space-y-1.5">
                  {SOCIETES.filter((soc) => soc !== f.societe).map((soc) => (
                    <div key={soc} className="flex items-center gap-2">
                      <label className="flex min-w-24 cursor-pointer items-center gap-1.5 text-xs">
                        <input
                          type="checkbox"
                          checked={soc in autresSocietes}
                          onChange={() => basculerSociete(soc)}
                          className="accent-ocean-profond"
                        />
                        {soc}
                      </label>
                      {soc in autresSocietes ? (
                        <Input
                          inputMode="numeric"
                          placeholder={`Salaire chez ${soc} (défaut : ci-dessus)`}
                          value={autresSocietes[soc] ?? ""}
                          onChange={(e) => {
                            const brut = e.target.value.replace(/[^\d]/g, "");
                            setAutresSocietes((x) => ({ ...x, [soc]: brut ? Number(brut) : null }));
                          }}
                          className="h-8 flex-1 text-right font-mono text-xs"
                        />
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {texte("cnps", "N° CNPS", "351-1213677-6")}
            {texte("niu", "NIU", "M072517858332C")}
            {texte("email", "E-mail (courrier de paie)", "prenom.nom@…", false, "email")}
            <Champ libelle="Méthode d'envoi du courrier" aide="« Automatique » choisit selon ce qui est renseigné ; forcer une voie reste possible">
              {(a) => (
                <Select value={f.methodeEnvoi} onValueChange={(v) => setF({ ...f, methodeEnvoi: v as "auto" | "email" | "whatsapp" })}>
                  <SelectTrigger id={a.id} className="w-full" aria-label="Méthode d'envoi"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Automatique</SelectItem>
                    <SelectItem value="email">E-mail</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </Champ>
            <Champ libelle="WhatsApp (courrier de paie)" aide="Indicatif pré-rempli : saisir seulement le numéro" erreur={f.whatsapp && f.whatsapp !== (employe?.whatsapp ?? "") ? erreurTelephone(f.whatsapp) ?? undefined : undefined}>
              {(a) => <ChampTelephone id={a.id} aria-describedby={a["aria-describedby"]} aria-invalid={a["aria-invalid"]} valeur={f.whatsapp} onChange={(v) => setF({ ...f, whatsapp: v })} />}
            </Champ>
            <div className="min-[480px]:col-span-2 sm:col-span-3">{texte("adresse", "Adresse", "Akwa, Douala")}</div>
            <Champ libelle="Service" aide="Porte la couleur du planning annuel et sert à détecter qu'un service se dégarnit">
              {(a) => (
                <Select value={f.serviceId || "aucun"} onValueChange={(v) => setF({ ...f, serviceId: v === "aucun" ? "" : v })}>
                  <SelectTrigger id={a.id} className="w-full" aria-label="Service"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aucun">Sans service</SelectItem>
                    {(services ?? []).map((x) => (
                      <SelectItem key={x._id} value={x._id}>{x.nom}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Champ>
            {texte("dateDebut", "Date d'entrée", undefined, false, "date")}
            {texte("dateEntreeCnps", "Date d'entrée à la CNPS", undefined, false, "date")}
            <Champ libelle="Immatriculé aux impôts" aide="Un employé non immatriculé reçoit un « Récapitulatif de paie » non téléchargeable et n'apparaît pas au DIPE">
              {(a) => (
                <Select value={f.immatriculeImpots ? "oui" : "non"} onValueChange={(v) => setF({ ...f, immatriculeImpots: v === "oui" })}>
                  <SelectTrigger id={a.id} className="w-full" aria-label="Immatriculé aux impôts"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="oui">Oui — bulletin de paie</SelectItem>
                    <SelectItem value="non">Non — récapitulatif de paie</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </Champ>
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

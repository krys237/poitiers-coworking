// Gestion des sociétés (entités) — Paramètres → Sociétés.
//
// Il manquait : `entites.creer` et `entites.modifier` existaient côté serveur depuis le lot M1,
// mais aucun écran ne les appelait. Les deux sociétés de recette avaient dû être créées par un
// import direct en base, et le propriétaire ne pouvait pas en ajouter lui-même — alors que c'est
// précisément l'exigence qu'il avait posée : « laisser à chaque responsable la latitude de
// rallonger la liste de ses sociétés ».
//
// Vocabulaire : à l'écran on dit « société », dans le code `entite` — pour ne jamais la confondre
// avec le déclarant de paie (`societe` : SESAME / SOFINA / SGC), qui est transversal.

import * as React from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "sonner";
import { Building2, PlusIcon } from "lucide-react";
import { messageErreur } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Champ } from "@/components/app/champs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/** Le code est un slug : il sert de clé stable dans les exports et les journaux. */
const slug = (x: string) =>
  x.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 31);

type Entite = {
  entiteId: string; nom: string; code: string; actif: boolean; ordre: number;
  raisonSociale?: string; adresse?: string; telephone?: string;
  niu?: string; numeroCnps?: string; registreCommerce?: string;
  dirigeant?: string; emailExpediteur?: string;
};

const VIERGE = {
  nom: "", code: "", raisonSociale: "", adresse: "", telephone: "",
  niu: "", numeroCnps: "", registreCommerce: "", dirigeant: "", emailExpediteur: "",
};

export function GestionSocietes() {
  const entites = useQuery(api.entites.liste, {}) as Entite[] | undefined;
  const creer = useMutation(api.entites.creer);
  const modifier = useMutation(api.entites.modifier);

  const [ouvert, setOuvert] = React.useState(false);
  const [f, setF] = React.useState(VIERGE);
  const [enCours, setEnCours] = React.useState(false);
  // Le code se déduit du nom tant que l'utilisateur ne l'a pas touché lui-même : une saisie
  // commencée à la main ne doit jamais être écrasée par une suggestion qui arrive après.
  const [codeManuel, setCodeManuel] = React.useState(false);

  const champ = (cle: keyof typeof VIERGE, libelle: string, placeholder?: string, requis?: boolean) => (
    <Champ libelle={libelle} requis={requis}>
      {(a) => (
        <Input
          {...a} required={requis} placeholder={placeholder} value={f[cle]}
          onChange={(e) => {
            const v = e.target.value;
            setF((x) => ({ ...x, [cle]: v, ...(cle === "nom" && !codeManuel ? { code: slug(v) } : {}) }));
          }}
        />
      )}
    </Champ>
  );

  const enregistrer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.nom.trim()) { toast.error("Le nom de la société est requis."); return; }
    if (!f.code.trim()) { toast.error("Le code est requis : il sert de clé stable."); return; }
    setEnCours(true);
    try {
      await creer({
        nom: f.nom.trim(), code: f.code.trim(),
        raisonSociale: f.raisonSociale.trim() || undefined,
        adresse: f.adresse.trim() || undefined,
        telephone: f.telephone.trim() || undefined,
        niu: f.niu.trim() || undefined,
        numeroCnps: f.numeroCnps.trim() || undefined,
        registreCommerce: f.registreCommerce.trim() || undefined,
        dirigeant: f.dirigeant.trim() || undefined,
        emailExpediteur: f.emailExpediteur.trim() || undefined,
      });
      toast.success(`« ${f.nom.trim()} » créée`, {
        description: "Elle apparaît dans le sélecteur de société. Ses écrans sont vides : rien n'est repris d'une autre société.",
      });
      setF(VIERGE); setCodeManuel(false); setOuvert(false);
    } catch (err) {
      toast.error("Société non créée", { description: messageErreur(err) });
    } finally { setEnCours(false); }
  };

  const basculerActif = async (e: Entite) => {
    try {
      await modifier({ entiteId: e.entiteId as any, actif: !e.actif });
      toast.success(e.actif ? `« ${e.nom} » désactivée` : `« ${e.nom} » réactivée`);
    } catch (err) {
      toast.error("Modification refusée", { description: messageErreur(err) });
    }
  };

  return (
    <div className="rounded-2xl border border-filet bg-surface shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-filet px-4 py-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Building2 className="h-4 w-4 text-ocean-profond" aria-hidden="true" />
            Sociétés
          </div>
          <p className="mt-0.5 max-w-2xl text-2xs text-encre-pale">
            Chaque société est une <strong>personne morale</strong> : son registre du commerce, son
            NIU, ses employés, ses comptes. Les écrans ne montrent que la société active, et le
            sélecteur du bandeau n'apparaît qu'à partir de deux sociétés accessibles.
          </p>
        </div>
        <Dialog open={ouvert} onOpenChange={setOuvert}>
          <DialogTrigger asChild>
            <Button size="sm"><PlusIcon /> Nouvelle société</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
            <form onSubmit={enregistrer}>
              <DialogHeader>
                <DialogTitle>Nouvelle société</DialogTitle>
                <DialogDescription>
                  Elle démarre <strong>vide</strong> : aucun employé, aucun document, aucune écriture
                  n'est reprise d'une autre société. L'identité juridique saisie ici est celle qui
                  figurera sur ses contrats et ses déclarations.
                </DialogDescription>
              </DialogHeader>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">{champ("nom", "Nom affiché", "EDR-TIM", true)}</div>
                <Champ
                  libelle="Code"
                  requis
                  aide="Minuscules, chiffres et tirets. IMMUABLE après création : il sert de clé dans les exports et les journaux."
                >
                  {(a) => (
                    <Input
                      {...a} required placeholder="edrtim" value={f.code}
                      onChange={(e) => { setCodeManuel(true); setF((x) => ({ ...x, code: slug(e.target.value) })); }}
                    />
                  )}
                </Champ>
                {champ("raisonSociale", "Raison sociale", "EDR-TIM SARL")}
                {champ("registreCommerce", "N° registre du commerce", "RC/DLA/2019/B/1234")}
                {champ("niu", "NIU", "M0..............")}
                {champ("numeroCnps", "N° CNPS employeur")}
                {champ("dirigeant", "Dirigeant", "Signe les contrats et les actes")}
                <div className="sm:col-span-2">{champ("adresse", "Adresse", "Akwa, Douala")}</div>
                {champ("telephone", "Téléphone")}
                {champ("emailExpediteur", "E-mail expéditeur", "paie@societe.cm")}
              </div>
              <DialogFooter className="mt-5">
                <Button type="button" variant="outline" onClick={() => setOuvert(false)}>Annuler</Button>
                <Button type="submit" disabled={enCours}>{enCours ? "Création…" : "Créer la société"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {entites === undefined ? (
        <p className="p-4 text-xs text-encre-pale">Chargement…</p>
      ) : entites.length === 0 ? (
        <p className="p-4 text-xs text-encre-pale">Aucune société. Créez la première.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Identité juridique</TableHead>
              <TableHead>Active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entites.map((e) => {
              const manque = [
                !e.registreCommerce && "registre du commerce",
                !e.niu && "NIU",
                !e.dirigeant && "dirigeant",
              ].filter(Boolean) as string[];
              return (
                <TableRow key={e.entiteId}>
                  <TableCell className="font-semibold">{e.nom}</TableCell>
                  <TableCell className="font-mono text-2xs text-encre-pale">{e.code}</TableCell>
                  <TableCell className="text-2xs">
                    {manque.length === 0
                      ? <span className="text-encre-douce">complète</span>
                      : <span className="text-ocre-fonce">à renseigner : {manque.join(", ")}</span>}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={e.actif}
                      onCheckedChange={() => void basculerActif(e)}
                      aria-label={`Société ${e.nom} active`}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <p className="border-t border-filet px-4 py-2.5 text-2xs text-encre-pale">
        Désactiver une société la retire du sélecteur de tous les membres sans rien supprimer :
        ses données restent en base et redeviennent visibles à la réactivation. Seul le super
        administrateur continue de la voir, pour pouvoir la rouvrir.
      </p>
    </div>
  );
}

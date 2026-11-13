/**
 * Gestion des services (lot R7) — accessible depuis le planning annuel.
 *
 * `services.enregistrer` et `services.supprimer` existaient depuis R1, mais aucun écran ne les
 * appelait : seul le bandeau d'amorçage « Créer les services » était branché. La RH cherchait
 * donc à créer un service depuis le planning sans le trouver (constat du 22/10/2026) — c'est
 * exactement là qu'elle le cherchait, donc c'est là que ça se passe.
 *
 * La couleur n'est pas décorative : elle porte le repère visuel de la frise. Au-delà de huit
 * services la palette validée est épuisée (`lib/planningAnnuel.PALETTE_SERVICES`) et les suivants
 * reçoivent un neutre — l'écran le dit, plutôt que d'inventer une teinte indistinguable.
 */
import * as React from "react";
import { useMutation } from "convex/react";
import { PaletteIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { PALETTE_SERVICES, COULEUR_NEUTRE } from "../../../convex/lib/planningAnnuel";
import { BoutonAction, BoutonConfirmation } from "@/components/app/bouton-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableVide,
} from "@/components/ui/table";

type Service = { _id: string; nom: string; couleur: string; ordre: number; actif: boolean };

export function GestionServices({
  services,
  disabled,
}: {
  services: Service[] | undefined;
  disabled?: boolean;
}) {
  const enregistrer = useMutation(api.services.enregistrer);
  const supprimer = useMutation(api.services.supprimer);
  const [nouveau, setNouveau] = React.useState("");
  const liste = services ?? [];

  // Première teinte libre de la palette : au-delà de 8 services, c'est le neutre.
  const couleurProposee =
    liste.length < PALETTE_SERVICES.length ? PALETTE_SERVICES[liste.length] : COULEUR_NEUTRE;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={disabled}>
          <PaletteIcon /> Services
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Services</DialogTitle>
          <DialogDescription>
            Chaque employé est rattaché à un service. La couleur sert de repère dans la frise, et
            c'est le regroupement par service qui permet de voir qu'un service se dégarnit.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-filet">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Nom</TableHead>
                <TableHead className="w-28">Couleur</TableHead>
                <TableHead className="w-16 text-right">Ordre</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {!liste.length ? (
                <TableVide colonnes={5}>
                  Aucun service. Créez-les ci-dessous, ou utilisez le bandeau d'amorçage du planning
                  pour charger ceux du classeur d'un coup.
                </TableVide>
              ) : (
                liste.map((s) => (
                  <LigneService key={s._id} service={s} enregistrer={enregistrer} supprimer={supprimer} />
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {liste.length >= PALETTE_SERVICES.length ? (
          <p className="text-xs text-encre-pale">
            La palette validée compte {PALETTE_SERVICES.length} teintes distinguables. Au-delà, les
            nouveaux services reçoivent un gris neutre : choisissez-leur une couleur à la main, et
            souvenez-vous que c'est le <strong>regroupement des lignes</strong> qui identifie le
            service dans la frise, pas la couleur seule.
          </p>
        ) : null}

        <DialogFooter className="sm:justify-start">
          <div className="flex w-full flex-wrap items-center gap-2">
            <span
              className="h-6 w-6 shrink-0 rounded-md border border-filet"
              style={{ backgroundColor: couleurProposee }}
              aria-hidden="true"
            />
            <Input
              value={nouveau}
              onChange={(e) => setNouveau(e.target.value)}
              placeholder="Nom du nouveau service"
              aria-label="Nom du nouveau service"
              className="h-9 max-w-xs"
            />
            <BoutonAction
              size="sm"
              disabled={!nouveau.trim()}
              onAction={() => enregistrer({ nom: nouveau, couleur: couleurProposee })}
              succes={() => {
                const n = nouveau;
                setNouveau("");
                return `Service « ${n.trim().toUpperCase()} » créé`;
              }}
            >
              <PlusIcon /> Ajouter
            </BoutonAction>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LigneService({
  service,
  enregistrer,
  supprimer,
}: {
  service: Service;
  enregistrer: ReturnType<typeof useMutation>;
  supprimer: ReturnType<typeof useMutation>;
}) {
  const [nom, setNom] = React.useState(service.nom);
  const [couleur, setCouleur] = React.useState(service.couleur);
  React.useEffect(() => {
    setNom(service.nom);
    setCouleur(service.couleur);
  }, [service.nom, service.couleur]);

  const modifie = nom !== service.nom || couleur !== service.couleur;

  return (
    <TableRow>
      <TableCell>
        <span
          className="block h-5 w-5 rounded-md border border-filet"
          style={{ backgroundColor: couleur }}
          aria-hidden="true"
        />
      </TableCell>
      <TableCell>
        <Input
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          aria-label={`Nom du service ${service.nom}`}
          className="h-8"
        />
      </TableCell>
      <TableCell>
        <Input
          type="color"
          value={couleur}
          onChange={(e) => setCouleur(e.target.value)}
          aria-label={`Couleur du service ${service.nom}`}
          className="h-8 w-20 p-1"
        />
      </TableCell>
      <TableCell className="text-right tabular-nums text-xs text-encre-pale">{service.ordre}</TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          {modifie ? (
            <BoutonAction
              size="sm"
              onAction={() => enregistrer({ id: service._id as any, nom, couleur })}
              succes="Service modifié"
            >
              Enregistrer
            </BoutonAction>
          ) : (
            // La suppression est refusée côté serveur si des employés y sont rattachés :
            // un employé orphelin sortirait de la détection de chevauchement.
            <BoutonConfirmation
              size="sm"
              variant="ghost"
              libelle={<Trash2Icon />}
              titre={`Supprimer le service « ${service.nom} » ?`}
              consequence="La suppression est refusée si des employés y sont encore rattachés : réaffectez-les d'abord, sinon leurs congés sortiraient de la détection de chevauchement."
              onConfirmer={() => supprimer({ id: service._id as any })}
              succes="Service supprimé"
            />
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

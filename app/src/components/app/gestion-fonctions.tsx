/**
 * Référentiel des fonctions (lot R10).
 *
 * « Je constate aussi que les fonctions soient vides. La RH doit pouvoir en créer depuis la
 * plateforme » — 03/11/2026. Même forme que la gestion des services : une boîte compacte,
 * ouverte depuis l'écran où le besoin se présente.
 *
 * Le bouton « Reprendre les fonctions des fiches » est le premier geste à faire : il amorce le
 * référentiel avec ce qui a déjà été saisi en texte libre, pour qu'elle n'ait rien à retaper.
 */
import * as React from "react";
import { useMutation, useQuery } from "convex/react";
import { BriefcaseBusinessIcon, DownloadIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { BoutonAction, BoutonConfirmation } from "@/components/app/bouton-action";
import { Button } from "@/components/ui/button";
import { Flag } from "@/components/ui/flag";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableVide,
} from "@/components/ui/table";

export function GestionFonctions({ disabled }: { disabled?: boolean }) {
  const [ouvert, setOuvert] = React.useState(false);
  const fonctions = useQuery(api.fonctions.liste, ouvert ? { inclureInactives: true } : "skip");
  const enregistrer = useMutation(api.fonctions.enregistrer);
  const supprimer = useMutation(api.fonctions.supprimer);
  const reprendre = useMutation(api.fonctions.reprendreDesFiches);
  const [nouveau, setNouveau] = React.useState({ libelle: "", categorie: "", echelon: "" });

  const liste = fonctions ?? [];

  return (
    <Dialog open={ouvert} onOpenChange={setOuvert}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={disabled}>
          <BriefcaseBusinessIcon /> Fonctions
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Référentiel des fonctions</DialogTitle>
          <DialogDescription>
            Les fonctions définies ici sont proposées à la saisie sur la fiche employé. La saisie
            libre reste acceptée : le référentiel propose, il ne contraint pas — une fonction
            renommée n'efface donc pas celle inscrite sur une fiche ou sur un contrat signé.
          </DialogDescription>
        </DialogHeader>

        {liste.length === 0 && fonctions !== undefined ? (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-filet bg-bande px-4 py-3">
            <p className="flex-1 text-sm">
              <strong>Le référentiel est vide.</strong> Commencez par reprendre les fonctions déjà
              saisies sur les fiches : vous n'aurez rien à retaper.
            </p>
            <BoutonAction
              size="sm"
              onAction={() => reprendre({})}
              succes={(r: any) =>
                `${r.ajoutees} fonction(s) reprise(s)` +
                (r.fichesSansFonction ? ` — ${r.fichesSansFonction} fiche(s) sans fonction` : "")
              }
            >
              <DownloadIcon /> Reprendre les fonctions des fiches
            </BoutonAction>
          </div>
        ) : null}

        <div className="rounded-xl border border-filet">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Libellé</TableHead>
                <TableHead className="w-24">Catégorie</TableHead>
                <TableHead className="w-20">Échelon</TableHead>
                <TableHead className="w-20" />
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {fonctions === undefined ? (
                <TableVide colonnes={5}>Chargement…</TableVide>
              ) : !liste.length ? (
                <TableVide colonnes={5}>Aucune fonction.</TableVide>
              ) : (
                liste.map((f) => (
                  <LigneFonction key={String(f._id)} fonction={f} enregistrer={enregistrer} supprimer={supprimer} />
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <DialogFooter className="sm:justify-start">
          <div className="flex w-full flex-wrap items-end gap-2">
            <Input
              value={nouveau.libelle}
              onChange={(e) => setNouveau({ ...nouveau, libelle: e.target.value })}
              placeholder="Libellé de la fonction"
              aria-label="Libellé de la nouvelle fonction"
              className="h-9 max-w-xs flex-1"
            />
            <Input
              value={nouveau.categorie}
              onChange={(e) => setNouveau({ ...nouveau, categorie: e.target.value })}
              placeholder="Catégorie"
              aria-label="Catégorie"
              className="h-9 w-24"
            />
            <Input
              value={nouveau.echelon}
              onChange={(e) => setNouveau({ ...nouveau, echelon: e.target.value })}
              placeholder="Échelon"
              aria-label="Échelon"
              className="h-9 w-20"
            />
            <BoutonAction
              size="sm"
              disabled={!nouveau.libelle.trim()}
              onAction={() =>
                enregistrer({
                  libelle: nouveau.libelle,
                  categorie: nouveau.categorie || undefined,
                  echelon: nouveau.echelon || undefined,
                })
              }
              succes={() => {
                const l = nouveau.libelle.trim();
                setNouveau({ libelle: "", categorie: "", echelon: "" });
                return `Fonction « ${l} » créée`;
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

// ---------------------------------------------------------------------------

type Fonction = { _id: string; libelle: string; categorie?: string; echelon?: string; actif: boolean };

function LigneFonction({
  fonction, enregistrer, supprimer,
}: {
  fonction: Fonction;
  enregistrer: ReturnType<typeof useMutation>;
  supprimer: ReturnType<typeof useMutation>;
}) {
  const [v, setV] = React.useState({
    libelle: fonction.libelle,
    categorie: fonction.categorie ?? "",
    echelon: fonction.echelon ?? "",
  });
  React.useEffect(() => {
    setV({ libelle: fonction.libelle, categorie: fonction.categorie ?? "", echelon: fonction.echelon ?? "" });
  }, [fonction.libelle, fonction.categorie, fonction.echelon]);

  const modifie =
    v.libelle !== fonction.libelle ||
    v.categorie !== (fonction.categorie ?? "") ||
    v.echelon !== (fonction.echelon ?? "");

  return (
    <TableRow className={fonction.actif ? undefined : "opacity-60"}>
      <TableCell>
        <Input value={v.libelle} onChange={(e) => setV({ ...v, libelle: e.target.value })}
          aria-label={`Libellé de ${fonction.libelle}`} className="h-8" />
      </TableCell>
      <TableCell>
        <Input value={v.categorie} onChange={(e) => setV({ ...v, categorie: e.target.value })}
          aria-label={`Catégorie de ${fonction.libelle}`} className="h-8" />
      </TableCell>
      <TableCell>
        <Input value={v.echelon} onChange={(e) => setV({ ...v, echelon: e.target.value })}
          aria-label={`Échelon de ${fonction.libelle}`} className="h-8" />
      </TableCell>
      <TableCell>
        {!fonction.actif ? <Flag variant="verrou" size="xs">inactive</Flag> : null}
      </TableCell>
      <TableCell>
        {modifie ? (
          <BoutonAction
            size="sm"
            onAction={() => enregistrer({ id: fonction._id as any, ...v })}
            succes="Fonction modifiée"
          >
            Enregistrer
          </BoutonAction>
        ) : (
          // Une fonction portée par des fiches est DÉSACTIVÉE et non supprimée : la supprimer
          // laisserait un libellé orphelin sur les employés, sans trace de son existence.
          <BoutonConfirmation
            size="sm"
            variant="ghost"
            libelle={<Trash2Icon />}
            titre={`Supprimer la fonction « ${fonction.libelle} » ?`}
            consequence="Si des fiches la portent, elle sera seulement désactivée : elle disparaît des propositions mais reste lisible sur les fiches existantes."
            onConfirmer={() => supprimer({ id: fonction._id as any })}
            succes={(r: any) =>
              r.desactivee
                ? `Désactivée — ${r.porteurs} fiche(s) la portent encore`
                : "Fonction supprimée"
            }
          />
        )}
      </TableCell>
    </TableRow>
  );
}

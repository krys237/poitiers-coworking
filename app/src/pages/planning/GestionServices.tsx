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
import { useEntite } from "@/app/EntiteActive";
import { useMutation } from "convex/react";
import { PaletteIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { PALETTE_SERVICES, COULEUR_NEUTRE } from "../../../convex/lib/planningAnnuel";
import { usePeut } from "@/auth/useMe";
import { BoutonAction, BoutonConfirmation } from "@/components/app/bouton-action";
import { ChampAutocomplete, type OptionAutocomplete } from "@/components/app/champ-autocomplete";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableVide,
} from "@/components/ui/table";

/** Un chef résolu par le serveur (`services.liste`) : le nom est déjà prêt à afficher. */
type ChefService = { _id: string; nom: string };

type Service = {
  _id: string;
  nom: string;
  couleur: string;
  ordre: number;
  actif: boolean;
  /** Identifiants des chefs, deux au plus. */
  chefs?: string[];
  /** Noms déjà résolus par `services.liste` ; un chef supprimé entre-temps en est simplement absent. */
  chefsDetail?: ChefService[];
};

export function GestionServices({
  services,
  disabled,
  optionsChefs = [],
}: {
  services: Service[] | undefined;
  disabled?: boolean;
  /**
   * Options pour désigner un chef (identifiant + nom), déjà au format de `ChampAutocomplete`.
   * Vide par défaut : le planning n'a pas le droit d'interroger les membres lui-même (voir
   * COMPTE-RENDU pour la requête serveur proposée) — l'appelant branchera ce tableau en une ligne
   * dès qu'elle existera.
   */
  optionsChefs?: OptionAutocomplete[];
}) {
  // Un service créé appartient à la société active, sinon il naîtrait sans société.
  const { entiteId: entiteActive } = useEntite();
  const enregistrer = useMutation(api.services.enregistrer);
  const supprimer = useMutation(api.services.supprimer);
  // Règle du projet (28/09/2026) : sans le droit « Faire », la ligne se lit mais ne s'édite pas.
  // Le masquage n'est pas la sécurité (Convex revalide), il évite de proposer une action perdue.
  const peutFaire = usePeut("/paie/planning", "faire");
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
            c'est le regroupement par service qui permet de voir qu'un service se dégarnit. Les
            chefs désignés ici deviendront les destinataires des comptes rendus du service.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-filet">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Nom</TableHead>
                <TableHead className="w-56">Chefs</TableHead>
                <TableHead className="w-28">Couleur</TableHead>
                <TableHead className="w-16 text-right">Ordre</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {!liste.length ? (
                <TableVide colonnes={6}>
                  Aucun service. Créez-les ci-dessous, ou utilisez le bandeau d'amorçage du planning
                  pour charger ceux du classeur d'un coup.
                </TableVide>
              ) : (
                liste.map((s) => (
                  <LigneService
                    key={s._id}
                    service={s}
                    enregistrer={enregistrer}
                    supprimer={supprimer}
                    optionsChefs={optionsChefs}
                    peutFaire={peutFaire}
                  />
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
              onAction={() => enregistrer({ nom: nouveau, couleur: couleurProposee, entiteId: entiteActive as any })}
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
  optionsChefs,
  peutFaire,
}: {
  service: Service;
  enregistrer: ReturnType<typeof useMutation>;
  supprimer: ReturnType<typeof useMutation>;
  optionsChefs: OptionAutocomplete[];
  peutFaire: boolean;
}) {
  const [nom, setNom] = React.useState(service.nom);
  const [couleur, setCouleur] = React.useState(service.couleur);
  const [chefs, setChefs] = React.useState<string[]>(service.chefs ?? []);
  // Dépendance sur la sérialisation plutôt que sur le tableau : `service.chefs` change de
  // référence à chaque rafraîchissement de la requête Convex même quand son contenu est
  // identique, et resynchroniser à tort effacerait une édition de chefs en cours.
  const signatureChefs = (service.chefs ?? []).join(",");
  React.useEffect(() => {
    setNom(service.nom);
    setCouleur(service.couleur);
    setChefs(service.chefs ?? []);
  }, [service.nom, service.couleur, signatureChefs]);

  const chefsModifies = chefs.join(",") !== signatureChefs;
  const modifie = nom !== service.nom || couleur !== service.couleur || chefsModifies;

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
        <SelecteurChefs
          chefs={chefs}
          chefsDetail={service.chefsDetail ?? []}
          options={optionsChefs}
          onChange={setChefs}
          peutEditer={peutFaire}
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
              onAction={() => enregistrer({ id: service._id as any, nom, couleur, chefs })}
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

/** Le message honnête demandé par le propriétaire : pas de création à la volée, un chef est forcément un membre existant. */
const MESSAGE_CHEF_INCONNU =
  "Aucun membre ne porte ce nom. Un chef de service doit être un membre de la plateforme — " +
  "vérifie l'orthographe, ou crée le membre dans l'écran Membres.";

const sansAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Jusqu'à deux chefs par service — `services.enregistrer` refuse un troisième et un doublon, la
 * limite n'est donc affichée ici que pour éviter de proposer une saisie qui échouerait.
 *
 * Le champ est volontairement utilisé en mode NON strict : c'est le seul moyen d'observer chaque
 * frappe. En mode strict, `ChampAutocomplete` ne notifie jamais le parent d'une saisie qui ne
 * correspond à aucune option — il reste muet tant qu'aucune suggestion n'est cliquée — ce qui
 * rendrait impossible la détection du cas « inconnu » demandée par le propriétaire. La valeur
 * réellement conservée reste malgré tout strictement un identifiant : le texte libre n'est jamais
 * transmis à `onChange` de ce composant, seul `option.valeur` l'est.
 */
function SelecteurChefs({
  chefs,
  chefsDetail,
  options,
  onChange,
  peutEditer,
}: {
  /** Identifiants des chefs retenus pour cette ligne, avant enregistrement. */
  chefs: string[];
  /** Noms déjà résolus par le serveur pour les chefs effectivement enregistrés. */
  chefsDetail: ChefService[];
  options: OptionAutocomplete[];
  onChange: (chefs: string[]) => void;
  peutEditer: boolean;
}) {
  const [saisie, setSaisie] = React.useState("");
  const [erreur, setErreur] = React.useState<string | null>(null);

  // Un chef qui vient d'être ajouté n'a pas encore de `chefsDetail` (résolu par le serveur) :
  // on retrouve son nom dans les options déjà chargées, pour ne jamais afficher un identifiant brut.
  const nomDe = (id: string) =>
    chefsDetail.find((c) => c._id === id)?.nom ?? options.find((o) => o.valeur === id)?.libelle ?? id;

  if (!peutEditer) {
    // Lecture seule : les noms résolus côté serveur, jamais une case vide.
    return chefsDetail.length ? (
      <span className="text-sm">{chefsDetail.map((c) => c.nom).join(", ")}</span>
    ) : (
      <span className="text-xs italic text-encre-pale">Aucun chef désigné</span>
    );
  }

  function retirer(id: string) {
    onChange(chefs.filter((c) => c !== id));
  }

  function surSaisie(texte: string, option?: OptionAutocomplete) {
    if (option) {
      // Une option cliquée (ou validée au clavier) désigne, par construction, un membre existant.
      setErreur(null);
      setSaisie("");
      if (!chefs.includes(option.valeur)) onChange([...chefs, option.valeur]);
      return;
    }
    setSaisie(texte);
    const t = texte.trim();
    if (!t) {
      setErreur(null);
      return;
    }
    const q = sansAccents(t);
    const connu = options.some((o) => sansAccents(o.libelle).includes(q));
    setErreur(connu ? null : MESSAGE_CHEF_INCONNU);
  }

  return (
    <div className="flex flex-col gap-1">
      {chefs.map((id) => (
        <span key={id} className="flex items-center gap-1 text-sm">
          <span className="truncate">{nomDe(id)}</span>
          <button
            type="button"
            aria-label={`Retirer ${nomDe(id)} comme chef`}
            className="rounded p-0.5 text-encre-pale hover:text-encre"
            onClick={() => retirer(id)}
          >
            <XIcon className="h-3 w-3" />
          </button>
        </span>
      ))}
      {chefs.length < 2 ? (
        <>
          <ChampAutocomplete
            valeur={saisie}
            options={options.filter((o) => !chefs.includes(o.valeur))}
            onChange={surSaisie}
            placeholder="Ajouter un chef"
            ariaLabel="Ajouter un chef de service"
            // Sans ça, le champ annoncerait « votre saisie sera conservée telle quelle » — faux
            // ici : le mode non strict ne sert qu'à observer la frappe, seule une option de la
            // liste est jamais retenue. Deux messages contradictoires s'affichaient.
            messageSansSuggestion={MESSAGE_CHEF_INCONNU}
            className="w-full max-w-[14rem]"
          />
          {erreur ? <p className="text-xs text-encre-pale">{erreur}</p> : null}
        </>
      ) : null}
    </div>
  );
}

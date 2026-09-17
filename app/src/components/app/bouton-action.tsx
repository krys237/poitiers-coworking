import * as React from "react";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { messageErreur } from "@/lib/format";

type VariantBouton = React.ComponentProps<typeof Button>["variant"];
type TailleBouton = React.ComponentProps<typeof Button>["size"];

/**
 * Bouton qui declenche une mutation Convex.
 *
 * Prend en charge les trois choses qu'on oublie a chaque appel ecrit a la main :
 * le bouton se verrouille pendant l'operation (donc pas de double envoi), le
 * resultat part en notification, et l'erreur Convex est deballee avant d'etre
 * montree.
 *
 * Le libelle de succes se conjugue au passe de l'action : le bouton « Generer
 * les bulletins » produit « Bulletins generes ». C'est ce qui fait comprendre
 * que la notification parle bien du bouton qu'on vient de presser.
 */
export function BoutonAction({
  onAction,
  succes,
  children,
  variant,
  size,
  disabled,
  ...props
}: {
  onAction: () => Promise<unknown>;
  /** Message de succes, ou fonction du resultat de la mutation. */
  succes?: React.ReactNode | ((resultat: any) => React.ReactNode);
  children: React.ReactNode;
  variant?: VariantBouton;
  size?: TailleBouton;
  disabled?: boolean;
} & Omit<React.ComponentProps<"button">, "onClick" | "children">) {
  const [enCours, setEnCours] = React.useState(false);

  const lancer = async () => {
    setEnCours(true);
    try {
      const resultat = await onAction();
      if (succes) {
        toast.success(
          typeof succes === "function" ? succes(resultat) : succes
        );
      }
    } catch (e) {
      toast.error("L'operation n'a pas abouti", {
        description: messageErreur(e),
      });
    } finally {
      setEnCours(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      disabled={disabled || enCours}
      onClick={lancer}
      {...props}
    >
      {enCours ? <Loader2Icon className="animate-spin" aria-hidden="true" /> : null}
      {children}
    </Button>
  );
}

/**
 * Bouton d'action IRREVERSIBLE.
 *
 * Remplace le motif « cliquer deux fois sur le meme bouton » utilise pour la
 * cloture du mois. Ce motif posait deux problemes : rien n'annonce qu'un second
 * clic engage, et un `onBlur` suffisait a perdre l'etat de confirmation — donc
 * l'utilisateur reclique sans savoir ou il en est.
 *
 * Ici la boite de dialogue enonce la consequence AVANT, et pour les operations
 * les plus lourdes `motCle` exige de recopier un mot : on ne cloture pas un mois
 * de paie par reflexe.
 *
 *     <BoutonConfirmation
 *       libelle="Generer les bulletins"
 *       titre="Cloturer octobre 2026 ?"
 *       consequence="Les 42 bulletins du mois seront figes. Les montants ne pourront plus etre modifies, meme si le bareme change."
 *       motCle="CLOTURER"
 *       onConfirmer={() => generer({ periode })}
 *       succes={(r) => `${r.bulletins} bulletins generes — mois cloture.`}
 *     />
 */
export function BoutonConfirmation({
  libelle,
  titre,
  consequence,
  motCle,
  confirmer = "Confirmer",
  onConfirmer,
  succes,
  variant = "destructive",
  size,
  disabled,
}: {
  /** Texte du bouton. Dit ce qui va se passer, a l'infinitif. */
  libelle: React.ReactNode;
  /** Question posee dans la boite, avec l'objet concerne nomme. */
  titre: React.ReactNode;
  /** Ce qui devient impossible apres. Concret, chiffre si possible. */
  consequence: React.ReactNode;
  /** Mot a recopier pour debloquer le bouton. Reserve aux operations lourdes. */
  motCle?: string;
  /** Libelle du bouton de validation dans la boite. */
  confirmer?: string;
  onConfirmer: () => Promise<unknown>;
  succes?: React.ReactNode | ((resultat: any) => React.ReactNode);
  variant?: VariantBouton;
  size?: TailleBouton;
  disabled?: boolean;
}) {
  const [ouvert, setOuvert] = React.useState(false);
  const [saisie, setSaisie] = React.useState("");
  const [enCours, setEnCours] = React.useState(false);

  const verrouille = motCle ? saisie.trim().toUpperCase() !== motCle.toUpperCase() : false;

  const valider = async () => {
    setEnCours(true);
    try {
      const resultat = await onConfirmer();
      setOuvert(false);
      setSaisie("");
      if (succes) {
        toast.success(typeof succes === "function" ? succes(resultat) : succes);
      }
    } catch (e) {
      toast.error("L'operation n'a pas abouti", { description: messageErreur(e) });
    } finally {
      setEnCours(false);
    }
  };

  return (
    <AlertDialog
      open={ouvert}
      onOpenChange={(o) => {
        setOuvert(o);
        if (!o) setSaisie("");
      }}
    >
      <AlertDialogTrigger asChild>
        <Button variant={variant} size={size} disabled={disabled}>
          {libelle}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{titre}</AlertDialogTitle>
          <AlertDialogDescription>{consequence}</AlertDialogDescription>
        </AlertDialogHeader>

        {motCle ? (
          <label className="block text-sm">
            <span className="text-encre-douce">
              Pour confirmer, tapez <b className="font-mono text-encre">{motCle}</b>
            </span>
            <input
              className="mt-1.5 h-9 w-full rounded-md border border-input bg-surface px-2.5 font-mono outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              value={saisie}
              onChange={(e) => setSaisie(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={enCours}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            disabled={verrouille || enCours}
            onClick={(e) => {
              e.preventDefault();
              void valider();
            }}
          >
            {enCours ? <Loader2Icon className="animate-spin" aria-hidden="true" /> : null}
            {confirmer}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

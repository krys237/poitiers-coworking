import * as React from "react";
import { useQuery } from "convex/react";
import { LockIcon } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { canAccess, type Role } from "../../../convex/rbac";
import { EtatVide } from "@/components/app/etat-vide";

/**
 * Controle d'acces cote interface.
 *
 * RAPPEL : ceci n'est PAS une securite. Le serveur reste seul juge — chaque
 * query et chaque mutation verifie le role. Ces composants servent a ne pas
 * montrer des commandes qui seraient refusees, ce qui est une question
 * d'ergonomie, pas de protection.
 *
 * Ils remplacent les `{niveau >= 4 && (…)}` semes dans les pages, ou le seuil
 * est un nombre nu : on ne sait pas, en lisant, ce que « 4 » autorise.
 */

/** Identite du membre connecte, avec role et niveau normalises. */
export function useMoi() {
  const moi = useQuery(api.users.me);
  return {
    moi,
    chargement: moi === undefined,
    role: (moi?.role ?? "employe") as Role,
    niveau: moi?.niveau ?? 0,
    estAuditeur: moi?.role === "auditeur_externe",
  };
}

/**
 * N'affiche son contenu qu'au-dessus d'un niveau.
 *
 * Pendant le chargement de l'identite, rien n'est rendu : c'est volontaire.
 * Afficher puis retirer une commande est pire que de l'afficher un instant plus
 * tard — l'utilisateur a le temps de cliquer.
 */
export function NiveauRequis({
  niveau: requis,
  children,
  sinon = null,
}: {
  niveau: number;
  children: React.ReactNode;
  /** Ce qu'on montre a la place. Par defaut : rien. */
  sinon?: React.ReactNode;
}) {
  const { niveau, chargement } = useMoi();
  if (chargement) return null;
  return <>{niveau >= requis ? children : sinon}</>;
}

/**
 * Garde d'ecran complet : verifie la permission de route de `rbac.canAccess`.
 * Sur refus, explique au lieu de rediriger en silence.
 */
export function EcranProtege({
  permission,
  children,
}: {
  /** La cle de route de la matrice RBAC. Ex. « /paie/bulletins ». */
  permission: string;
  children: React.ReactNode;
}) {
  const { role, chargement } = useMoi();
  if (chargement) return null;

  if (!canAccess(role, permission)) {
    return (
      <EtatVide icone={LockIcon} titre="Cet ecran ne vous est pas ouvert">
        Votre role ne donne pas acces a cette partie de la plateforme. Si vous
        pensez que c'est une erreur, demandez au directeur general de revoir vos
        droits dans Membres.
      </EtatVide>
    );
  }
  return <>{children}</>;
}

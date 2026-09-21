import { Link, useLocation } from "react-router-dom";
import { CompassIcon } from "lucide-react";
import { EtatVide } from "@/components/app/etat-vide";
import { Button } from "@/components/ui/button";

/** Adresse inconnue dans l'application : dire ce qui s'est passé plutôt qu'une page blanche. */
export function PageIntrouvable() {
  const { pathname } = useLocation();
  return (
    <EtatVide icone={CompassIcon} titre="Cette page n'existe pas" action={<Button size="sm" asChild><Link to="/">Retour au tableau de bord</Link></Button>}>
      L'adresse <code className="rounded bg-filet-clair px-1 font-mono text-xs">{pathname}</code> ne correspond à aucun écran. Le menu de gauche liste ceux qui vous sont ouverts.
    </EtatVide>
  );
}

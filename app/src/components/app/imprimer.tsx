import * as React from "react";
import { PrinterIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { nomFichierPdf } from "../../../convex/lib/periode";

/**
 * Impression des documents.
 *
 * Le navigateur nomme le PDF « Imprimer en PDF » d'apres le titre du document.
 * La plateforme contourne cela en changeant `document.title` juste avant
 * `window.print()`, puis en le restaurant — un motif recopie a l'identique dans
 * trois ecrans, avec un `addEventListener("afterprint")` a chaque fois.
 *
 * Ce hook le fait une fois, et remet le titre en place meme si le composant est
 * demonte pendant l'impression.
 */
export function useImpression() {
  const titreOrigine = React.useRef<string | null>(null);

  const restaurer = React.useCallback(() => {
    if (titreOrigine.current !== null) {
      document.title = titreOrigine.current;
      titreOrigine.current = null;
    }
  }, []);

  React.useEffect(() => restaurer, [restaurer]);

  /** Imprime en nommant le fichier « Entreprise - Document - Periode ». */
  return React.useCallback(
    (nom: { entreprise: string; document: string; periode?: string }) => {
      titreOrigine.current = document.title;
      document.title = nomFichierPdf(nom.entreprise, nom.document, nom.periode);
      window.addEventListener("afterprint", restaurer, { once: true });
      window.print();
    },
    [restaurer]
  );
}

/**
 * Bouton d'impression. Desactive quand il n'y a rien a imprimer — imprimer une
 * page vide est un aller-retour perdu pour l'utilisateur.
 */
export function BoutonImprimer({
  entreprise,
  document: nomDocument,
  periode,
  desactive,
  children = "Imprimer",
  variant = "outline",
}: {
  entreprise: string;
  document: string;
  periode?: string;
  desactive?: boolean;
  children?: React.ReactNode;
  variant?: React.ComponentProps<typeof Button>["variant"];
}) {
  const imprimer = useImpression();
  return (
    <Button
      variant={variant}
      disabled={desactive}
      onClick={() => imprimer({ entreprise, document: nomDocument, periode })}
    >
      <PrinterIcon aria-hidden="true" />
      {children}
    </Button>
  );
}

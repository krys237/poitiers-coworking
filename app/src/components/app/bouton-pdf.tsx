import * as React from "react";
import { toast } from "sonner";
import { FileDownIcon, Loader2Icon, PrinterIcon } from "lucide-react";
import { messageErreur } from "@/lib/format";
import { Button } from "@/components/ui/button";

/** Télécharge un PDF reçu d'une action Convex (octets + nom de fichier), sans passer par le stockage. */
export function telechargerPdf(pdf: ArrayBuffer, nomFichier: string) {
  const url = URL.createObjectURL(new Blob([pdf], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nomFichier;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/**
 * Envoie un PDF DIRECTEMENT à l'imprimante, sans passer par un téléchargement.
 *
 * C'est le geste attendu pour les actes RH : ils s'impriment sur des pro forma dont l'en-tête est
 * déjà imprimé, et la RH enchaîne « choisir l'acte → remplir → prévisualiser → imprimer ».
 * Télécharger d'abord lui imposerait de retrouver le fichier, l'ouvrir, puis imprimer.
 *
 * L'iframe reste dans le document le temps de l'impression : la retirer tout de suite annulerait
 * le dialogue du navigateur. Elle est nettoyée après coup, avec l'URL du blob.
 */
export function imprimerPdf(pdf: ArrayBuffer, titre?: string) {
  const url = URL.createObjectURL(new Blob([pdf], { type: "application/pdf" }));
  const cadre = document.createElement("iframe");
  cadre.style.position = "fixed";
  cadre.style.width = "0";
  cadre.style.height = "0";
  cadre.style.border = "0";
  cadre.setAttribute("aria-hidden", "true");
  if (titre) cadre.title = titre;
  cadre.src = url;
  cadre.onload = () => {
    try {
      cadre.contentWindow?.focus();
      cadre.contentWindow?.print();
    } catch {
      // Navigateur qui refuse l'impression depuis une iframe : on ouvre l'onglet, la RH imprime
      // depuis la visionneuse. Mieux qu'un bouton qui ne fait rien.
      window.open(url, "_blank", "noopener");
    }
  };
  document.body.appendChild(cadre);
  setTimeout(() => {
    cadre.remove();
    URL.revokeObjectURL(url);
  }, 60_000);
}

/**
 * Bouton « PDF » : appelle `generer`, puis télécharge le fichier. Le libellé dit ce qui sortira
 * (« PDF du mois (10) », « PDF »…) ; pendant la génération, le bouton est occupé et le dit.
 */
export function BoutonPdf({ generer, children, titre, variant = "outline", desactive, mode = "telecharger" }: {
  generer: () => Promise<{ pdf: ArrayBuffer; nomFichier: string }>;
  children: React.ReactNode;
  titre?: string;
  variant?: "outline" | "default";
  desactive?: boolean;
  /** `imprimer` envoie droit à l'imprimante, sans fichier à retrouver. */
  mode?: "telecharger" | "imprimer";
}) {
  const [enCours, setEnCours] = React.useState(false);
  const lancer = async () => {
    setEnCours(true);
    try {
      const r = await generer();
      if (mode === "imprimer") {
        imprimerPdf(r.pdf, r.nomFichier);
        toast.success("Envoyé à l'impression", { description: r.nomFichier });
      } else {
        telechargerPdf(r.pdf, r.nomFichier);
        toast.success("PDF généré", { description: r.nomFichier });
      }
    } catch (err) {
      toast.error("PDF impossible", { description: messageErreur(err) });
    } finally {
      setEnCours(false);
    }
  };
  return (
    <Button variant={variant} size="sm" onClick={() => void lancer()} disabled={desactive || enCours} title={titre}>
      {enCours ? <Loader2Icon className="animate-spin" /> : mode === "imprimer" ? <PrinterIcon /> : <FileDownIcon />}
      {enCours ? "Génération…" : children}
    </Button>
  );
}

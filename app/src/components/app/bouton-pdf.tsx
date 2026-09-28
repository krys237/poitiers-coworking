import * as React from "react";
import { toast } from "sonner";
import { FileDownIcon, Loader2Icon } from "lucide-react";
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
 * Bouton « PDF » : appelle `generer`, puis télécharge le fichier. Le libellé dit ce qui sortira
 * (« PDF du mois (10) », « PDF »…) ; pendant la génération, le bouton est occupé et le dit.
 */
export function BoutonPdf({ generer, children, titre, variant = "outline", desactive }: {
  generer: () => Promise<{ pdf: ArrayBuffer; nomFichier: string }>;
  children: React.ReactNode;
  titre?: string;
  variant?: "outline" | "default";
  desactive?: boolean;
}) {
  const [enCours, setEnCours] = React.useState(false);
  const lancer = async () => {
    setEnCours(true);
    try {
      const r = await generer();
      telechargerPdf(r.pdf, r.nomFichier);
      toast.success("PDF généré", { description: r.nomFichier });
    } catch (err) {
      toast.error("PDF impossible", { description: messageErreur(err) });
    } finally {
      setEnCours(false);
    }
  };
  return (
    <Button variant={variant} size="sm" onClick={() => void lancer()} disabled={desactive || enCours} title={titre}>
      {enCours ? <Loader2Icon className="animate-spin" /> : <FileDownIcon />}
      {enCours ? "Génération…" : children}
    </Button>
  );
}

import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { verifierBareme, type EtatBareme } from "@/lib/bareme.functions";

const CLE_STOCKAGE = "paie-bareme-veille-v1";

type Veille = {
  empreinte: string | null;
  verifieLe: string;
  changement: boolean;
  message: string;
};

const lire = (): Veille | null => {
  if (typeof window === "undefined") return null;
  try {
    const brut = window.localStorage.getItem(CLE_STOCKAGE);
    return brut ? (JSON.parse(brut) as Veille) : null;
  } catch {
    return null;
  }
};

export function VeilleBareme() {
  const appel = useServerFn(verifierBareme);
  const [veille, setVeille] = useState<Veille | null>(null);
  const [chargement, setChargement] = useState(false);

  const enregistrer = useCallback((v: Veille) => {
    setVeille(v);
    try {
      window.localStorage.setItem(CLE_STOCKAGE, JSON.stringify(v));
    } catch {
      /* stockage indisponible */
    }
  }, []);

  const controler = useCallback(
    async (manuel: boolean) => {
      setChargement(true);
      try {
        const res = (await appel({})) as EtatBareme;
        const precedent = lire();
        const changement =
          res.ok &&
          !!precedent?.empreinte &&
          !!res.empreinte &&
          precedent.empreinte !== res.empreinte;
        enregistrer({
          empreinte: res.empreinte ?? precedent?.empreinte ?? null,
          verifieLe: res.verifieLe,
          changement,
          message: res.message,
        });
        if (manuel) {
          if (!res.ok) toast.error(res.message);
          else if (changement)
            toast.warning("Le barème officiel a changé, vérifiez les taux du mois.");
          else toast.success("Barème officiel inchangé.");
        }
      } catch {
        if (manuel) toast.error("Vérification du barème impossible.");
      } finally {
        setChargement(false);
      }
    },
    [appel, enregistrer],
  );

  useEffect(() => {
    const precedent = lire();
    setVeille(precedent);
    const moisCourant = new Date().toISOString().slice(0, 7);
    if (!precedent || precedent.verifieLe.slice(0, 7) !== moisCourant) {
      void controler(false);
    }
  }, [controler]);

  if (chargement && !veille) return <Skeleton className="h-20 w-full" />;

  const changement = veille?.changement ?? false;

  return (
    <Alert variant={changement ? "destructive" : "default"}>
      {changement ? (
        <AlertTriangle className="h-4 w-4" />
      ) : (
        <CheckCircle2 className="h-4 w-4" />
      )}
      <AlertTitle>
        {changement
          ? "Le barème officiel CNPS semble avoir changé"
          : "Barème officiel CNPS sous surveillance"}
      </AlertTitle>
      <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span>
          {veille
            ? `Dernier contrôle le ${veille.verifieLe} — ${veille.message}`
            : "Contrôle automatique une fois par mois sur cnps.cm."}
          {changement
            ? " Comparez les taux affichés avec la source officielle avant de payer."
            : ""}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={chargement}
          onClick={() => void controler(true)}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${chargement ? "animate-spin" : ""}`} />
          Vérifier maintenant
        </Button>
      </AlertDescription>
    </Alert>
  );
}

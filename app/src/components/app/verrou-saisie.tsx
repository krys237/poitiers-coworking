/**
 * Verrou de saisie, côté écran (Caisse du mois, Primes médecins).
 *
 * Une ligne n'est plus modifiable `verrouMin` minutes après sa saisie, sauf pour qui détient le droit
 * « … : modifier après le délai ». L'état est recalculé chaque minute dans le navigateur, sans attendre
 * le serveur — qui reste seul juge au moment d'écrire.
 */
import * as React from "react";
import { LockIcon } from "lucide-react";

export type EtatVerrou = { verrouMin: number; peutDeverrouiller: boolean };

/** Heure courante, rafraîchie chaque minute (pour les verrous qui tombent avec le temps). */
function useMaintenant() {
  const [t, setT] = React.useState(() => Date.now());
  React.useEffect(() => { const id = setInterval(() => setT(Date.now()), 60_000); return () => clearInterval(id); }, []);
  return t;
}

/** `verrouillee(ligne)` pour masquer les actions, `<Cadenas ligne>` pour les remplacer. */
export function useVerrouSaisie(etat: EtatVerrou | undefined) {
  const maintenant = useMaintenant();
  const verrouillee = React.useCallback(
    (l: { _creationTime: number }) => !!etat && !etat.peutDeverrouiller && maintenant - l._creationTime > etat.verrouMin * 60_000,
    [etat, maintenant],
  );
  const Cadenas = React.useCallback(
    ({ ligne }: { ligne: { _creationTime: number } }) => (
      <span
        className="inline-flex items-center gap-1 px-1.5 text-2xs text-encre-pale"
        title={`Saisie le ${new Date(ligne._creationTime).toLocaleString("fr-FR")} : modifiable ${etat?.verrouMin ?? 60} min après la saisie. Seul un administrateur peut désormais la corriger.`}
      >
        <LockIcon className="h-3.5 w-3.5" /> verrouillée
      </span>
    ),
    [etat],
  );
  return { verrouillee, Cadenas };
}

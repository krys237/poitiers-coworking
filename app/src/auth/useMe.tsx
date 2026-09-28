// Contrat d'interface pour l'agent front : tout ce qui touche aux droits passe par ici.
// Ne jamais réimplémenter de logique d'accès dans un écran — importer `useMe` / `SiNiveau`.
//
// ⚠️ Masquer un bouton n'est PAS une sécurité. Le contrôle réel est côté Convex
// (`requireLevel` dans chaque query/mutation). Le masquage sert seulement à ne pas
// proposer une action qui échouerait.
import { ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { NIVEAU, Role, type Action } from "../../convex/rbac";

/**
 * Le membre courant.
 * - `undefined` : requête en cours (ne RIEN décider sur cette valeur, surtout pas rediriger) ;
 * - `null` : aucune session ouverte ;
 * - sinon : le membre, avec `niveau`, `roleLibelle`, `enAttente` et `modeDev`.
 */
export function useMe() {
  return useQuery(api.users.me);
}

export type Membre = NonNullable<ReturnType<typeof useMe>>;

/** Niveau du membre courant (0 si non connecté ou compte en attente d'autorisation). */
export function useNiveau(): number {
  const me = useMe();
  if (!me || me.enAttente) return 0;
  return NIVEAU[me.role as Role];
}

/** Le membre courant peut-il VOIR (défaut) ou FAIRE dans ce module ? (clé de rbac.MODULES, ex. "/financier") */
export function usePeut(module: string, action: Action = "voir"): boolean {
  const me = useMe();
  if (!me || me.enAttente) return false;
  return !!me.droits?.[module]?.[action];
}

/** Affiche ses enfants seulement si le membre a le droit demandé sur le module. */
export function SiDroit({ module, action = "faire", children, sinon = null }: { module: string; action?: Action; children: ReactNode; sinon?: ReactNode }) {
  return <>{usePeut(module, action) ? children : sinon}</>;
}

/**
 * Affiche ses enfants seulement au-dessus d'un niveau donné.
 *
 * ```tsx
 * <SiNiveau min={5}>
 *   <button onClick={cloturer}>Clôturer le mois</button>
 * </SiNiveau>
 * ```
 * `sinon` permet d'afficher un repli (une explication, un bouton désactivé…).
 */
export function SiNiveau({ min, children, sinon = null }: { min: number; children: ReactNode; sinon?: ReactNode }) {
  return <>{useNiveau() >= min ? children : sinon}</>;
}

// Contexte React de l'entité (société) active — Lot 2 du chantier multi-société.
//
// ⚠️ Règle de sécurité : ce contexte ne fait qu'exprimer une PRÉFÉRENCE D'AFFICHAGE.
// La liste vient de `api.entites.mesEntites` (résolue côté serveur depuis l'identité
// authentifiée) ; toute requête scopée revérifie côté serveur que le membre atteint bien
// l'entité demandée.
//
// À l'écran, l'entité s'appelle « Société » ; dans le code, la variable s'appelle `entite`
// pour ne jamais la confondre avec le déclarant de paie (`societe` : SESAME / SOFINA / SGC).

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export const CLE_ENTITE_ACTIVE = "poitiers:entite-active";

export type EntiteVue = {
  entiteId: string;
  nom: string;
  code: string;
  principale: boolean;
  role: string;
};

export type ContexteEntite = {
  /** Identifiant de l'entité active, ou `undefined` tant que la liste n'est pas chargée. */
  entiteId: string | undefined;
  /** Nom affiché de l'entité active, ou `undefined` tant que la liste n'est pas chargée. */
  nom: string | undefined;
  /** Bascule sur une entité du périmètre (ignoré si hors liste). */
  basculer: (id: string) => void;
  /** Entités accessibles, déjà filtrées et ordonnées par le serveur (principale en tête). */
  entites: EntiteVue[];
};

const EntiteContext = createContext<ContexteEntite>({
  entiteId: undefined,
  nom: undefined,
  basculer: () => {},
  entites: [],
});

function lireEntiteStockee(): string | undefined {
  try {
    return window.localStorage.getItem(CLE_ENTITE_ACTIVE) || undefined;
  } catch {
    return undefined;
  }
}

function ecrireEntiteStockee(id: string | undefined) {
  try {
    if (id) window.localStorage.setItem(CLE_ENTITE_ACTIVE, id);
    else window.localStorage.removeItem(CLE_ENTITE_ACTIVE);
  } catch {
    // Mode privé ou quota atteint : le choix reste en mémoire de session.
  }
}

export function FournisseurEntite({ children }: { children: ReactNode }) {
  const chargees = useQuery(api.entites.mesEntites) as EntiteVue[] | undefined;
  const [choisie, setChoisie] = useState<string | undefined>(lireEntiteStockee);

  // Résolution déterministe : tant que `chargees` est `undefined`, `active` reste `undefined`
  // pour que les écrans passent `"skip"` à leurs queries plutôt qu'une entité vide.
  // Si l'entité mémorisée n'est plus dans la liste (accès révoqué ou société désactivée),
  // on retombe silencieusement sur la première de la liste.
  const active = useMemo<EntiteVue | undefined>(() => {
    if (!chargees || chargees.length === 0) return undefined;
    return (choisie ? chargees.find((e) => e.entiteId === choisie) : undefined) ?? chargees[0];
  }, [chargees, choisie]);

  const activeId = active?.entiteId;

  // Resynchronise le stockage si le repli silencieux a corrigé une entité devenue inaccessible.
  // Dépend uniquement de l'identifiant (jamais de l'objet `active` recréé à chaque rendu).
  useEffect(() => {
    if (!activeId) return;
    if (choisie !== activeId) {
      setChoisie(activeId);
      ecrireEntiteStockee(activeId);
    }
  }, [activeId, choisie]);

  const basculer = useCallback(
    (id: string) => {
      if (!chargees || !chargees.some((e) => e.entiteId === id)) return;
      setChoisie(id);
      ecrireEntiteStockee(id);
    },
    [chargees],
  );

  const valeur = useMemo<ContexteEntite>(
    () => ({
      entiteId: active?.entiteId,
      nom: active?.nom,
      basculer,
      entites: chargees ?? [],
    }),
    [active?.entiteId, active?.nom, basculer, chargees],
  );

  return <EntiteContext.Provider value={valeur}>{children}</EntiteContext.Provider>;
}

/** L'entité active, ou `undefined` tant que la liste n'est pas chargée. */
export function useEntite(): ContexteEntite {
  return useContext(EntiteContext);
}

/**
 * Défilement automatique vers un panneau de détail (skill poitiers-ui-ux-system).
 *
 * Plusieurs écrans partagent le même schéma : une ligne cliquée dans un tableau
 * ouvre un panneau — à côté sur grand écran, EN DESSOUS du tableau sur petit
 * écran ou mobile (bulletin, intervention, récapitulatif de salaire, commande…).
 * Sans défilement automatique, le panneau apparaît hors du cadre visible et la
 * RH doit chercher où il est passé. Un seul hook, posé sur le conteneur du
 * panneau, couvre tous ces écrans.
 */
import * as React from "react";

export function useDefilerVersDetail<T extends HTMLElement = HTMLDivElement>(cle: string | null | undefined) {
  const ref = React.useRef<T>(null);
  React.useEffect(() => {
    if (cle) ref.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [cle]);
  return ref;
}

/**
 * Récapitulatif salaires.
 *
 * Deux présentations du même écran, au choix de l'utilisateur (skill §7) :
 *  - par défaut, la synthèse à 8 colonnes avec le volet de saisie latéral
 *    (lecture confortable, un employé à la fois) ;
 *  - « Rendre les champs persistants » : la grille des 18 colonnes en saisie
 *    directe, barre latérale repliée (saisie du mois entier sans un clic).
 *
 * Les deux partagent les données, le brouillon à enregistrement automatique
 * et le moteur de calcul (`pages/recap/commun.tsx`).
 */
import * as React from "react";
import { Link } from "react-router-dom";
import { UsersIcon } from "lucide-react";
import { periodeCourante } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { BoutonPersistance, useSaisiePersistante } from "@/components/app/saisie-persistante";
import { useBrouillon, useFiltreRecap, useRecapPaie } from "./recap/commun";
import { FicheEmploye } from "@/components/app/fiche-employe";
import { RecapToutVisible } from "./recap/RecapToutVisible";
import { RecapSynthese } from "./recap/RecapSynthese";

export function SaisieMensuelle() {
  const [periode, setPeriode] = React.useState(periodeCourante());
  const [persistant, setPersistant] = useSaisiePersistante("recap-salaires");
  const recap = useRecapPaie(periode);
  const brouillon = useBrouillon(recap, periode);
  const filtre = useFiltreRecap(recap.bulletins);

  const actions = (
    <>
      <FicheEmploye creer={recap.creerEmploye as any} modifier={recap.modifierEmploye as any} disabled={recap.cloture} />
      <Button variant="outline" size="sm" asChild>
        <Link to="/employes" title="Fiches complètes, import CSV / Excel, réactivation"><UsersIcon /> Employés</Link>
      </Button>
      <BoutonPersistance actif={persistant} onChange={setPersistant} />
    </>
  );

  return persistant ? (
    <RecapToutVisible periode={periode} onPeriode={setPeriode} recap={recap} brouillon={brouillon} filtre={filtre} actif actions={actions} />
  ) : (
    <RecapSynthese periode={periode} onPeriode={setPeriode} recap={recap} brouillon={brouillon} filtre={filtre} actions={actions} />
  );
}

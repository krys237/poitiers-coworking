/**
 * Récapitulatif salaires — trois présentations du même écran, à trancher en
 * réunion de validation (septembre 2026) :
 *
 *   1. « Modèle original »  : le récapitulatif du directeur, tel quel.
 *   2. « Option A »         : 18 colonnes visibles d'un coup, saisie en cellule.
 *   3. « Option C »         : synthèse à 8 colonnes + fiche de saisie latérale.
 *
 * Les trois partagent les données, le brouillon à enregistrement automatique
 * et le moteur de calcul (`pages/recap/commun.tsx`). Une fois l'option retenue,
 * les deux autres se suppriment sans toucher au socle.
 */
import * as React from "react";
import { periodeCourante } from "@/lib/format";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBrouillon, useFiltreRecap, useRecapPaie } from "./recap/commun";
import { RecapOriginal } from "./recap/RecapOriginal";
import { RecapToutVisible } from "./recap/RecapToutVisible";
import { RecapSynthese } from "./recap/RecapSynthese";

type Onglet = "original" | "a" | "c";
const CLE_ONGLET = "recap-salaires:onglet";

function ongletInitial(): Onglet {
  try {
    const v = window.localStorage.getItem(CLE_ONGLET);
    if (v === "original" || v === "a" || v === "c") return v;
  } catch { /* stockage indisponible : onglet par défaut */ }
  return "original";
}

export function SaisieMensuelle() {
  const [periode, setPeriode] = React.useState(periodeCourante());
  const [onglet, setOnglet] = React.useState<Onglet>(ongletInitial);
  const recap = useRecapPaie(periode);
  const brouillon = useBrouillon(recap, periode);
  const filtre = useFiltreRecap(recap.bulletins);

  const changerOnglet = (v: string) => {
    setOnglet(v as Onglet);
    try { window.localStorage.setItem(CLE_ONGLET, v); } catch { /* ignoré */ }
  };

  return (
    <Tabs value={onglet} onValueChange={changerOnglet} className="gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <TabsList variant="line">
          <TabsTrigger value="original">Modèle original</TabsTrigger>
          <TabsTrigger value="a">Option A — Tout visible</TabsTrigger>
          <TabsTrigger value="c">Option C — Synthèse + fiche</TabsTrigger>
        </TabsList>
        <span className="text-2xs text-encre-pale">
          Trois présentations du même récapitulatif — à trancher en réunion de validation.
        </span>
      </div>

      <TabsContent value="original">
        <RecapOriginal periode={periode} onPeriode={setPeriode} recap={recap} brouillon={brouillon} />
      </TabsContent>
      <TabsContent value="a">
        <RecapToutVisible periode={periode} onPeriode={setPeriode} recap={recap} brouillon={brouillon} filtre={filtre} actif={onglet === "a"} />
      </TabsContent>
      <TabsContent value="c">
        <RecapSynthese periode={periode} onPeriode={setPeriode} recap={recap} brouillon={brouillon} filtre={filtre} />
      </TabsContent>
    </Tabs>
  );
}

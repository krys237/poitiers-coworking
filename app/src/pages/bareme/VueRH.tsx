/**
 * « Vue RH » du barème (lot R9).
 *
 * Demande de la responsable RH : garder l'écran Barème tel quel, et ajouter un bouton qui déplie
 * **tout le détail des règles de calcul**, pour qu'elle puisse vérifier nos chiffres sans nous.
 *
 * Le parti pris : cette vue n'énonce aucune règle de son cru. Tout vient de `lib/vueRH.ts`, qui
 * lit le barème applicable à la période et fait dérouler l'exemple par le moteur réel. Si le
 * calcul change, la vue change avec lui — une page qui recopierait les règles finirait par mentir.
 */
import * as React from "react";
import { useQuery } from "convex/react";
import { BookOpenCheckIcon, InfoIcon, TriangleAlertIcon } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { libellePeriode } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Flag } from "@/components/ui/flag";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

type Onglet = "assiettes" | "retenues" | "forfaits" | "exemple";
const fcfa = (n: number) => n.toLocaleString("fr-FR").replace(/ /g, " ");

export function VueRH({ periode }: { periode: string }) {
  const [onglet, setOnglet] = React.useState<Onglet>("assiettes");
  const [ouvert, setOuvert] = React.useState(false);
  // La requête ne part qu'à l'ouverture : inutile de la charger pour tout le monde.
  const vue = useQuery(api.bareme.vueRH, ouvert ? { periode } : "skip");

  return (
    <Dialog open={ouvert} onOpenChange={setOuvert}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <BookOpenCheckIcon /> Vue RH
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Comment la paie est calculée — {libellePeriode(periode)}</DialogTitle>
          <DialogDescription>
            Chaque valeur ci-dessous est lue dans le barème applicable à cette période, et l'exemple
            est déroulé par le moteur de calcul lui-même. Rien n'est recopié : ce que vous lisez ici
            est exactement ce qui est appliqué.
          </DialogDescription>
        </DialogHeader>

        {vue === undefined ? (
          <p className="py-8 text-center text-sm text-encre-pale">Chargement…</p>
        ) : !vue.trouve ? (
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-ocre bg-ocre-clair/50 px-4 py-3">
            <TriangleAlertIcon className="h-5 w-5 shrink-0 text-ocre" aria-hidden="true" />
            <p className="text-sm">
              Aucune version de barème ne s'applique à {libellePeriode(periode)} : il n'y a donc
              aucune règle à afficher.
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Flag variant="renseigne" size="sm">Version du {vue.effectiveFrom}</Flag>
              <span className="text-xs text-encre-pale">{vue.source}</span>
            </div>

            {/* Un barème antérieur aux corrections n'applique pas les mêmes règles : le dire,
                sinon la RH lirait des règles qui ne sont pas celles de sa période. */}
            {!vue.correctionsActives.transportTaxable || !vue.correctionsActives.seuilExoneration ? (
              <div className="flex gap-3 rounded-xl border border-filet bg-bande px-4 py-3">
                <InfoIcon className="h-5 w-5 shrink-0 text-ocean-ceruleen" aria-hidden="true" />
                <p className="text-xs">
                  <strong>Cette version de barème est antérieure aux corrections du 20/10/2026.</strong>{" "}
                  {!vue.correctionsActives.transportTaxable
                    ? "La prime de transport y est détaxée (elle est désormais taxable). "
                    : ""}
                  {!vue.correctionsActives.seuilExoneration
                    ? "Aucun plancher d'exonération n'y est appliqué. "
                    : ""}
                  C'est volontaire : un mois déjà clôturé doit rester rejouable à l'identique.
                </p>
              </div>
            ) : null}

            <Tabs value={onglet} onValueChange={(v) => setOnglet(v as Onglet)}>
              <TabsList>
                <TabsTrigger value="assiettes">Les quatre assiettes</TabsTrigger>
                <TabsTrigger value="retenues">Impôts & cotisations</TabsTrigger>
                <TabsTrigger value="forfaits">TDL & RAV</TabsTrigger>
                <TabsTrigger value="exemple">Un cas déroulé</TabsTrigger>
              </TabsList>
            </Tabs>

            {onglet === "assiettes" ? (
              <div className="space-y-3">
                <p className="text-xs text-encre-douce">
                  Il n'y a pas <em>une</em> assiette mais quatre, et chaque rubrique de paie
                  appartient ou non à chacune. C'est ce qui explique qu'un même salaire donne des
                  bases différentes selon l'impôt ou la cotisation.
                </p>
                {vue.assiettes.map((a) => (
                  <div key={a.cle} className="rounded-xl border border-filet bg-surface p-3">
                    <h3 className="text-sm font-semibold">{a.nom}</h3>
                    <p className="mt-0.5 text-xs text-encre-douce">{a.definition}</p>
                    <p className="mt-1 text-xs font-medium text-sceau">{a.sertA}</p>
                    <p className="mt-1.5 text-[11px] text-encre-pale">
                      <strong>{a.rubriques.length} rubrique(s)</strong> : {a.rubriques.join(" · ")}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}

            {onglet === "retenues" ? (
              <div className="space-y-4">
                <BlocRegles titre="Impôt sur le revenu (IRPP)" regles={vue.irpp} />
                <BlocRegles titre="Cotisations CNPS" regles={vue.cnps} />
                <BlocRegles titre="Autres retenues et charges" regles={vue.autresRetenues} />
                <BlocRegles
                  titre="Le plancher d'exonération, et ce qu'il ne couvre pas"
                  regles={vue.plancher}
                />
              </div>
            ) : null}

            {onglet === "forfaits" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <BlocForfait
                  titre="Taxe de développement local"
                  base="Salaire de BASE"
                  actif={vue.forfaits.tdlActif}
                  tranches={vue.forfaits.tdl}
                />
                <BlocForfait
                  titre="Redevance audiovisuelle"
                  base="Salaire taxable"
                  actif={vue.forfaits.ravActif}
                  tranches={vue.forfaits.rav}
                />
                <p className="text-xs text-encre-pale sm:col-span-2">
                  Un seuil se lit « <strong>en deçà de</strong> » : le montant d'une ligne s'applique
                  aux salaires strictement inférieurs à son seuil. La dernière ligne, sans seuil,
                  couvre tout le reste. Ces tranches sont modifiables en publiant une nouvelle
                  version du barème.
                </p>
              </div>
            ) : null}

            {onglet === "exemple" ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-filet bg-bande p-3">
                  <h3 className="mb-1.5 text-sm font-semibold">Les éléments de départ</h3>
                  <dl className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
                    {vue.exemple.entrees.map((e) => (
                      <div key={e.libelle} className="flex justify-between gap-3 border-b border-filet-clair pb-0.5">
                        <dt className="text-encre-douce">{e.libelle}</dt>
                        <dd className="font-medium tabular-nums">{e.valeur}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Étape</TableHead>
                      <TableHead>Comment on l'obtient</TableHead>
                      <TableHead className="text-right">Montant</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vue.exemple.etapes.map((e, i) => (
                      <TableRow key={i} className={e.total ? "bg-ocean-brume/40" : undefined}>
                        <TableCell className={e.total ? "font-semibold" : ""}>{e.libelle}</TableCell>
                        <TableCell className="text-xs text-encre-douce">{e.formule}</TableCell>
                        <TableCell className={`text-right tabular-nums ${e.total ? "font-semibold" : ""}`}>
                          {fcfa(e.valeur)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------

type Regle = { libelle: string; valeur: string; base?: string; fondement?: string; reserve?: string };

function BlocRegles({ titre, regles }: { titre: string; regles: Regle[] }) {
  return (
    <div className="rounded-xl border border-filet bg-surface">
      <h3 className="border-b border-filet-clair px-3 py-2 text-sm font-semibold">{titre}</h3>
      <dl className="divide-y divide-filet-clair">
        {regles.map((r, i) => (
          <div key={i} className="px-3 py-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <dt className="text-sm">{r.libelle}</dt>
              <dd className="font-mono text-sm font-semibold tabular-nums">{r.valeur}</dd>
            </div>
            {r.base ? <p className="text-[11px] text-encre-pale">sur : {r.base}</p> : null}
            {r.fondement ? <p className="text-[11px] text-encre-douce">{r.fondement}</p> : null}
            {r.reserve ? (
              <p className="mt-1 flex gap-1.5 text-[11px] text-ocre">
                <TriangleAlertIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {r.reserve}
              </p>
            ) : null}
          </div>
        ))}
      </dl>
    </div>
  );
}

function BlocForfait({
  titre, base, actif, tranches,
}: {
  titre: string;
  base: string;
  actif: boolean;
  tranches: { jusqua: number | null; montant: number }[];
}) {
  return (
    <div className="rounded-xl border border-filet bg-surface">
      <div className="flex items-center justify-between border-b border-filet-clair px-3 py-2">
        <div>
          <h3 className="text-sm font-semibold">{titre}</h3>
          <p className="text-[11px] text-encre-pale">sur : {base}</p>
        </div>
        <Flag variant={actif ? "renseigne" : "verrou"} size="xs">
          {actif ? "appliquée" : "désactivée"}
        </Flag>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>En deçà de</TableHead>
            <TableHead className="text-right">Montant</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tranches.map((t, i) => (
            <TableRow key={i}>
              <TableCell className="tabular-nums">
                {t.jusqua === null ? <span className="text-encre-pale">au-delà</span> : fcfa(t.jusqua)}
              </TableCell>
              <TableCell className="text-right tabular-nums">{fcfa(t.montant)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

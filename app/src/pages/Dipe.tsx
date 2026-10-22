/**
 * DIPE — Document d'Information sur le Personnel Employé (lot R3).
 *
 * Trois onglets :
 *  · **État du mois** : les colonnes de son classeur, aux formules corrigées, avec les quatre
 *    assiettes visibles. Export CSV en un clic (elle le recopiait à la main chaque mois).
 *  · **Récapitulatif** : les retenues du SALARIÉ et les charges de l'EMPLOYEUR séparées, et les
 *    deux totaux par destinataire (DGI / CNPS) — son classeur les additionnait.
 *  · **Rapport d'écart** : on dépose son fichier, et chaque différence est NOMMÉE et justifiée.
 *    C'est le livrable qui fait accepter l'outil : sans lui, elle verra des chiffres différents
 *    des siens et conclura que l'application est fausse.
 *
 * La comparaison se fait **entièrement dans le navigateur** (logique pure de `convex/lib/dipe`) :
 * son fichier n'est jamais envoyé au serveur.
 *
 * UN DIPE PAR DÉCLARANT (lot R2 bis, décision du 20/10/2026) : « SESAME déclare de son côté. »
 * Chaque société dépose son propre état, sous son propre NIU et son propre numéro CNPS, et n'y
 * reprend que les rémunérations QU'ELLE a versées. Le sélecteur de société choisit le déclarant ;
 * « Les trois » n'est qu'une vue d'ensemble pour la RH — ce n'est la déclaration de personne et
 * elle ne se dépose pas telle quelle.
 */
import * as React from "react";
import { useQuery } from "convex/react";
import { AlertTriangleIcon, DownloadIcon, FileUpIcon, InfoIcon } from "lucide-react";
import { api } from "../../convex/_generated/api";
import {
  COLONNES_CALCULEES,
  ENTETES_RECONNUES,
  EXPLICATIONS,
  comparerDipe,
  exportCsvDipe,
  type CodeEcart,
  type Ecart,
  type LigneDipe,
} from "../../convex/lib/dipe";
import { parseCsv, toFcfa } from "@/lib/csv";
import { libellePeriode, periodeCourante } from "@/lib/format";
import { PageEnTete } from "@/components/app/en-tete";
import { GrilleTuiles, Tuile } from "@/components/app/tuile";
import { StatutMois } from "@/components/app/statut";
import { SelecteurPeriode } from "@/components/app/selecteur-periode";
import { Button } from "@/components/ui/button";
import { Flag } from "@/components/ui/flag";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableVide,
} from "@/components/ui/table";

type Onglet = "etat" | "recapitulatif" | "ecarts";
type Declarante = "SESAME" | "SOFINA" | "SGC";
const SOCIETES: Declarante[] = ["SESAME", "SOFINA", "SGC"];
const fcfa = (n: number) => n.toLocaleString("fr-FR");
const fmtDate = (s: string) => new Date(s + "T00:00:00").toLocaleDateString("fr-FR");

function telecharger(nom: string, contenu: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + contenu], { type: "text/csv;charset=utf-8" }));
  a.download = nom;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function Dipe() {
  const [periode, setPeriode] = React.useState(periodeCourante());
  const [onglet, setOnglet] = React.useState<Onglet>("etat");
  const [sien, setSien] = React.useState<Record<string, Partial<Record<keyof LigneDipe, number>>> | null>(null);
  const [importMsg, setImportMsg] = React.useState<string | null>(null);
  // Société déclarante : « toutes » = vue d'ensemble, jamais un document à déposer.
  const [societe, setSociete] = React.useState<Declarante | "toutes">("toutes");

  const vue = useQuery(api.dipe.etat, societe === "toutes" ? { periode } : { periode, societe });
  const lignes = vue?.lignes ?? [];
  const recap = vue?.recapitulatif;

  const comparaison = React.useMemo(
    () => (sien && lignes.length ? comparerDipe(lignes as LigneDipe[], sien) : null),
    [sien, lignes],
  );

  const gains = (vue?.rubriques ?? [])
    .filter((r) => r.sens === "gain" && r.code !== "PRIME")
    .sort((a, b) => a.ordre - b.ordre);

  function importer(fichier: File) {
    const lecteur = new FileReader();
    lecteur.onload = () => {
      const brut = parseCsv(String(lecteur.result));
      if (!brut.length) {
        setImportMsg("Fichier vide ou illisible : attendu un CSV avec une ligne d'en-tête.");
        setSien(null);
        return;
      }
      const cle = Object.keys(brut[0]).find((h) => ENTETES_RECONNUES[h] === "matricule");
      if (!cle) {
        setImportMsg(
          "Aucune colonne « Matricule Entreprise » trouvée : c'est elle qui permet d'apparier les lignes.",
        );
        setSien(null);
        return;
      }
      const out: Record<string, Partial<Record<keyof LigneDipe, number>>> = {};
      let reconnues = 0;
      for (const r of brut) {
        const matricule = String(r[cle] ?? "").trim();
        if (!matricule) continue;
        const ligne: Partial<Record<keyof LigneDipe, number>> = {};
        for (const [entete, valeur] of Object.entries(r)) {
          const cible = ENTETES_RECONNUES[entete];
          if (!cible || cible === "matricule" || cible === "matriculeCnps") continue;
          if (String(valeur).trim() === "") continue;
          ligne[cible] = toFcfa(String(valeur));
          reconnues++;
        }
        out[matricule] = ligne;
      }
      setSien(out);
      setImportMsg(
        `${Object.keys(out).length} ligne(s) lue(s), ${reconnues} valeur(s) reconnue(s). ` +
          "Les colonnes non reconnues sont ignorées.",
      );
      setOnglet("ecarts");
    };
    lecteur.readAsText(fichier, "utf-8");
  }

  return (
    <div className="space-y-4">
      <PageEnTete
        titre="DIPE — impôts & CNPS"
        description="État mensuel du personnel employé, dû avant le 15 du mois suivant. Ce document ne porte que les retenues fiscales et sociales : son net diffère de celui du bulletin de paie."
        statut={<StatutMois cloture={vue === undefined ? undefined : vue.cloture} />}
        actions={
          <Button
            size="sm"
            variant="outline"
            disabled={!lignes.length}
            onClick={() =>
              telecharger(
                `DIPE-${societe === "toutes" ? "consolide" : societe}-${periode}.csv`,
                exportCsvDipe(lignes as LigneDipe[], vue!.rubriques),
              )
            }
          >
            <DownloadIcon /> Exporter en CSV
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-filet bg-surface px-3 py-2 shadow-xs print:hidden">
        <SelecteurPeriode valeur={periode} onChange={setPeriode} />
        <span className="text-sm font-semibold">{libellePeriode(periode)}</span>
        {vue ? (
          <span className="text-xs text-encre-pale">
            échéance de dépôt : <strong>{fmtDate(vue.echeance)}</strong>
          </span>
        ) : null}
        <div role="tablist" aria-label="Société déclarante" className="flex items-center gap-1 rounded-xl border border-filet bg-slate-100/80 p-1">
          {([["toutes", "Les trois"], ...SOCIETES.map((x) => [x, x])] as [Declarante | "toutes", string][]).map(([k, l]) => {
            const d = vue?.declarants.find((x) => x.societe === k);
            return (
              <button
                key={k} role="tab" aria-selected={societe === k} onClick={() => setSociete(k)}
                title={k === "toutes" ? "Vue d'ensemble des trois sociétés : ne se dépose pas" : `DIPE déposé par ${k}`}
                className={
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors " +
                  (societe === k ? "bg-ocean-profond text-white shadow-xs" : "text-encre-douce hover:bg-white hover:text-encre")
                }
              >
                {l}
                <span className={"font-mono text-[10px] tabular-nums " + (societe === k ? "text-white/80" : "text-encre-pale")}>
                  {k === "toutes" ? (vue?.declarants.reduce((t, x) => t + x.effectif, 0) ?? "") : (d?.effectif ?? "")}
                </span>
              </button>
            );
          })}
        </div>
        <span className="flex-1" />
        <Tabs value={onglet} onValueChange={(v) => setOnglet(v as Onglet)}>
          <TabsList>
            <TabsTrigger value="etat">État du mois</TabsTrigger>
            <TabsTrigger value="recapitulatif">Récapitulatif</TabsTrigger>
            <TabsTrigger value="ecarts">Rapport d'écart</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {vue?.erreur ? (
        <div className="flex items-center gap-3 rounded-2xl border border-dashed border-ocre bg-ocre-clair/50 px-4 py-3">
          <AlertTriangleIcon className="h-5 w-5 shrink-0 text-ocre" aria-hidden="true" />
          <p className="text-sm">{vue.erreur}</p>
        </div>
      ) : null}

      {vue && societe !== "toutes" && vue.declarant ? (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-2xl border border-filet bg-surface px-4 py-3 shadow-xs">
          <span className="text-sm font-semibold">{vue.declarant.raisonSociale}</span>
          <span className="text-xs text-encre-douce">
            NIU <strong className="font-mono tabular-nums">{vue.declarant.niu || "—"}</strong>
          </span>
          <span className="text-xs text-encre-douce">
            N° CNPS <strong className="font-mono tabular-nums">{vue.declarant.numeroCnps || "—"}</strong>
          </span>
          <span className="flex-1" />
          {vue.declarant.reprisDeLEntreprise ? (
            <Flag variant="a-renseigner" size="sm" title="Paramètres → identité déclarante de chaque société">
              identité reprise de l'entreprise
            </Flag>
          ) : null}
          {!vue.declarant.complet ? <Flag variant="a-renseigner" size="sm">NIU ou n° CNPS manquant</Flag> : null}
        </div>
      ) : null}

      {vue && societe === "toutes" && vue.declarants.filter((d) => d.effectif).length > 1 ? (
        <div className="flex items-start gap-3 rounded-2xl border border-filet bg-bande px-4 py-3">
          <InfoIcon className="h-5 w-5 shrink-0 text-ocean-ceruleen" aria-hidden="true" />
          <p className="text-sm">
            Vue d'ensemble des trois sociétés : <strong>ce n'est la déclaration de personne</strong>.
            Chaque société dépose son propre DIPE sous son propre NIU — choisissez-la ci-dessus pour
            obtenir le document à déposer.
            {vue.pluriEmployes ? (
              <>
                {" "}
                <strong>{vue.pluriEmployes} salarié(s)</strong> sont déclarés par plusieurs sociétés :
                c'est du pluri-emploi régulier, chaque employeur ne déclarant que ce qu'il verse.
              </>
            ) : null}
          </p>
        </div>
      ) : null}

      {vue && vue.assiettesReconstituees > 0 ? (
        <div className="flex items-center gap-3 rounded-2xl border border-filet bg-bande px-4 py-3">
          <InfoIcon className="h-5 w-5 shrink-0 text-ocean-ceruleen" aria-hidden="true" />
          <p className="text-sm">
            <strong>{vue.assiettesReconstituees} ligne(s)</strong> proviennent d'un mois clôturé
            avant la refonte des assiettes : leurs quatre assiettes ont été reconstituées au mieux
            depuis l'ancien instantané, et non recalculées.
          </p>
        </div>
      ) : null}

      <GrilleTuiles>
        <Tuile libelle="Effectif déclaré" valeur={recap?.effectif} note={`${libellePeriode(periode)} · ${societe === "toutes" ? "les trois sociétés" : societe}`} />
        <Tuile libelle="Masse brute" valeur={recap ? fcfa(recap.masseBrute) : undefined} note="FCFA" />
        <Tuile libelle="À reverser à la DGI" valeur={recap ? fcfa(recap.totalImpots) : undefined} note="IRPP, CAC, CFC, TDL, RAV, FNE" />
        <Tuile libelle="À reverser à la CNPS" valeur={recap ? fcfa(recap.totalCnps) : undefined} note="PVID, PF, AT/MP" vedette />
      </GrilleTuiles>

      {onglet === "etat" ? (
        <div className="rounded-2xl border border-filet bg-surface shadow-xs">
          <div className="overflow-x-auto">
            <Table className="min-w-[80rem]">
              <TableHeader>
                <TableRow>
                  <TableHead>N°</TableHead>
                  <TableHead>Matricule</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead className="text-right">Jours</TableHead>
                  {gains.map((g) => (
                    <TableHead key={g.code} className="text-right whitespace-nowrap">{g.libelle}</TableHead>
                  ))}
                  {COLONNES_CALCULEES.map((c) => (
                    <TableHead key={String(c.cle)} className="text-right whitespace-nowrap">{c.entete}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {!lignes.length ? (
                  <TableVide colonnes={4 + gains.length + COLONNES_CALCULEES.length}>
                    Aucun bulletin pour cette période.
                  </TableVide>
                ) : (
                  lignes.map((l) => (
                    <TableRow key={l.cle}>
                      <TableCell className="tabular-nums">{l.no}</TableCell>
                      <TableCell className="font-medium">{l.matricule}</TableCell>
                      <TableCell className="whitespace-nowrap">{l.nom}</TableCell>
                      <TableCell className="text-right tabular-nums">{l.joursTravailles}</TableCell>
                      {gains.map((g) => (
                        <TableCell key={g.code} className="text-right tabular-nums">
                          {l.gains[g.code] ? fcfa(l.gains[g.code]) : <span className="text-encre-pale">—</span>}
                        </TableCell>
                      ))}
                      {COLONNES_CALCULEES.map((c) => (
                        <TableCell key={String(c.cle)} className="text-right tabular-nums">
                          {fcfa(l[c.cle] as number)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : null}

      {onglet === "recapitulatif" && recap ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Bloc titre="Retenues sur le salarié" sousTitre="L'employeur les retient et les reverse">
            {recap.retenuesSalariales.map((x) => (
              <Ligne key={x.libelle} libelle={x.libelle} montant={x.montant} />
            ))}
            <Ligne libelle="Total retenu aux salariés" montant={recap.totalRetenuesSalariales} fort />
          </Bloc>

          <Bloc titre="Charges de l'employeur" sousTitre="Dues dès le premier franc de salaire, sans plancher">
            {recap.chargesPatronales.map((x) => (
              <Ligne key={x.libelle} libelle={x.libelle} montant={x.montant} />
            ))}
            <Ligne libelle="Total charges patronales" montant={recap.totalChargesPatronales} fort />
          </Bloc>

          <Bloc titre="À reverser, par destinataire" sousTitre="Deux organismes distincts : jamais additionnés">
            <Ligne libelle="Direction Générale des Impôts" montant={recap.totalImpots} />
            <Ligne libelle="Caisse Nationale de Prévoyance Sociale" montant={recap.totalCnps} />
          </Bloc>

          <Bloc titre="Masses et coût" sousTitre="Assiettes cumulées du mois">
            <Ligne libelle="Masse salariale brute" montant={recap.masseBrute} />
            <Ligne libelle="Masse taxable" montant={recap.masseTaxable} />
            <Ligne libelle="Masse cotisable plafonnée" montant={recap.masseCotisable} />
            <Ligne libelle="Net à payer (au sens du DIPE)" montant={recap.netAPayer} />
            <Ligne libelle="Coût total employeur" montant={recap.coutEmployeur} fort />
          </Bloc>
        </div>
      ) : null}

      {onglet === "ecarts" ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-filet bg-surface p-4 shadow-xs">
            <h2 className="text-sm font-semibold">Comparer avec le classeur de la responsable RH</h2>
            <p className="mt-1 max-w-3xl text-xs text-encre-douce">
              Enregistrez son onglet DIPE en CSV et déposez-le ici. L'appariement se fait sur la
              colonne <strong>Matricule Entreprise</strong>. Chaque différence est ensuite nommée et
              justifiée. <strong>Le fichier reste dans votre navigateur</strong> : il n'est pas envoyé
              au serveur.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-filet bg-bande px-3 py-1.5 text-xs font-semibold hover:bg-ocean-brume">
                <FileUpIcon className="h-4 w-4" aria-hidden="true" />
                Choisir un fichier CSV
                <Input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) importer(f);
                    e.target.value = "";
                  }}
                />
              </label>
              {sien ? (
                <Button size="sm" variant="ghost" onClick={() => { setSien(null); setImportMsg(null); }}>
                  Retirer
                </Button>
              ) : null}
              {importMsg ? <span className="text-xs text-encre-douce">{importMsg}</span> : null}
            </div>
          </div>

          {!comparaison ? null : (
            <>
              <GrilleTuiles>
                <Tuile libelle="Lignes comparées" valeur={comparaison.compares} note={`sur ${lignes.length} déclarées`} />
                <Tuile
                  libelle="Écarts relevés"
                  valeur={comparaison.ecarts.length}
                  note="hors arrondis d'un franc"
                  ton={comparaison.ecarts.length ? "attente" : "succes"}
                />
                <Tuile
                  libelle="Non appariées"
                  valeur={comparaison.absents.length}
                  note="matricule absent de son fichier"
                  ton={comparaison.absents.length ? "attente" : "succes"}
                />
                <Tuile libelle="Causes distinctes" valeur={Object.keys(comparaison.parCode).length} note="règles en jeu" />
              </GrilleTuiles>

              {Object.keys(comparaison.parCode).length ? (
                <div className="space-y-2 rounded-2xl border border-filet bg-surface p-4 shadow-xs">
                  <h2 className="text-sm font-semibold">Pourquoi nos chiffres diffèrent</h2>
                  {Object.entries(comparaison.parCode)
                    .sort((a, b) => b[1] - a[1])
                    .map(([code, n]) => (
                      <div key={code} className="flex gap-3 border-t border-filet-clair pt-2 first:border-0 first:pt-0">
                        <Flag variant={code === "arrondi" ? "neutre" : "a-renseigner"} size="sm" className="mt-0.5 shrink-0">
                          {n} écart{n > 1 ? "s" : ""}
                        </Flag>
                        <p className="text-xs text-encre-douce">{EXPLICATIONS[code as CodeEcart]}</p>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 text-sm">
                  <strong>Aucun écart.</strong> Les {comparaison.compares} lignes comparées
                  concordent à un franc près avec son classeur.
                </div>
              )}

              <div className="rounded-2xl border border-filet bg-surface shadow-xs">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Matricule</TableHead>
                      <TableHead>Nom</TableHead>
                      <TableHead>Colonne</TableHead>
                      <TableHead className="text-right">Son fichier</TableHead>
                      <TableHead className="text-right">L'application</TableHead>
                      <TableHead className="text-right">Écart</TableHead>
                      <TableHead>Cause</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!comparaison.ecarts.length ? (
                      <TableVide colonnes={7}>Aucun écart au-delà de l'arrondi.</TableVide>
                    ) : (
                      comparaison.ecarts.map((e: Ecart, i) => (
                        <TableRow key={`${e.matricule}-${e.colonne}-${i}`}>
                          <TableCell className="font-medium">{e.matricule}</TableCell>
                          <TableCell className="whitespace-nowrap">{e.nom}</TableCell>
                          <TableCell>{e.colonne}</TableCell>
                          <TableCell className="text-right tabular-nums">{fcfa(e.elle)}</TableCell>
                          <TableCell className="text-right tabular-nums">{fcfa(e.nous)}</TableCell>
                          <TableCell className={`text-right tabular-nums font-semibold ${e.difference > 0 ? "text-carmin" : ""}`}>
                            {e.difference > 0 ? "+" : ""}{fcfa(e.difference)}
                          </TableCell>
                          <TableCell>
                            <span title={EXPLICATIONS[e.code]}>
                              <Flag variant={e.code === "arrondi" ? "neutre" : "a-renseigner"} size="xs">
                                {e.code.replace(/_/g, " ")}
                              </Flag>
                            </span>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {comparaison.absents.length ? (
                <p className="px-1 text-xs text-encre-pale">
                  Matricules déclarés mais absents de son fichier :{" "}
                  {comparaison.absents.slice(0, 20).join(", ")}
                  {comparaison.absents.length > 20 ? ` … (+${comparaison.absents.length - 20})` : ""}
                </p>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Bloc({ titre, sousTitre, children }: { titre: string; sousTitre: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-filet bg-surface p-4 shadow-xs">
      <h2 className="text-sm font-semibold">{titre}</h2>
      <p className="mb-2 text-xs text-encre-pale">{sousTitre}</p>
      <dl className="space-y-1">{children}</dl>
    </div>
  );
}

function Ligne({ libelle, montant, fort }: { libelle: string; montant: number; fort?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 border-t border-filet-clair pt-1 text-sm ${fort ? "font-semibold" : ""}`}>
      <dt className={fort ? "" : "text-encre-douce"}>{libelle}</dt>
      <dd className="tabular-nums">{montant.toLocaleString("fr-FR")}</dd>
    </div>
  );
}

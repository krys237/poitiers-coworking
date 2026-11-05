// Retenue à la source sur les honoraires des médecins (lot R6).
//
// Ce que l'écran doit rendre évident, parce que c'est ce qui bloquait le lot pendant deux
// semaines :
//
//  • le taux appliqué n'est PAS le taux annoncé — 5 % devient 5,5 %, 10 % devient 11 %, centimes
//    additionnels communaux inclus. La colonne affiche les DEUX, sinon la RH croirait à une
//    erreur de saisie ;
//  • la base n'est pas le chiffre d'affaires : c'est tout l'assurance plus 30 % des espèces. La
//    part retenue sur les espèces a donc sa propre colonne, visible, et non un calcul implicite.
//
// Le détail de chaque ligne est accessible en infobulle, et les quatre explications du module
// sont dépliables en bas — même principe que l'écran DIPE.

import * as React from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { AlertTriangleIcon, DownloadIcon, InfoIcon, PlusIcon } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { PART_ESPECES_PCT, TAUX_BASE, retenueMedecin, tauxEffectif } from "../../convex/lib/retenueMedecins";
import { libellePeriode, messageErreur, periodeCourante } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageEnTete } from "@/components/app/en-tete";
import { GrilleTuiles, Tuile } from "@/components/app/tuile";
import { SelecteurPeriode } from "@/components/app/selecteur-periode";
import { Montant, Nombre } from "@/components/app/montant";
import { ChampAutocomplete } from "@/components/app/champ-autocomplete";
import { BoutonAction } from "@/components/app/bouton-action";
import { SqueletteTexte } from "@/components/app/chargement";
import { Button } from "@/components/ui/button";
import { Flag } from "@/components/ui/flag";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableVide,
} from "@/components/ui/table";

const VIDE = { medecin: "", tauxBase: 5, caAssurance: "", caEspeces: "", notes: "" };

export function RetenuesMedecins() {
  const [periode, setPeriode] = React.useState(periodeCourante());
  const etat = useQuery(api.retenueMedecins.etat, { periode });
  const tauxConnus = useQuery(api.retenueMedecins.tauxConnus, {});
  const csv = useQuery(api.retenueMedecins.exportCsv, { periode });
  const enregistrer = useMutation(api.retenueMedecins.enregistrer);
  const supprimer = useMutation(api.retenueMedecins.supprimer);

  const [saisie, setSaisie] = React.useState<typeof VIDE>(VIDE);
  const [modifieId, setModifieId] = React.useState<string | null>(null);
  const [enCours, setEnCours] = React.useState(false);
  const [explicationOuverte, setExplicationOuverte] = React.useState<string | null>(null);

  const maj = <K extends keyof typeof VIDE>(k: K, v: (typeof VIDE)[K]) =>
    setSaisie((s) => ({ ...s, [k]: v }));

  // Le taux d'un médecin est pré-rempli d'après sa dernière déclaration : le changer ici
  // n'altère pas les périodes passées, les montants y étant figés.
  const choisirMedecin = (nom: string) => {
    const connu = tauxConnus?.find((t) => t.medecin.toLowerCase() === nom.trim().toLowerCase());
    setSaisie((s) => ({ ...s, medecin: nom, tauxBase: connu?.tauxBase ?? s.tauxBase }));
  };

  // Aperçu vivant : la RH voit la base et la retenue AVANT d'enregistrer.
  const apercu = React.useMemo(() => {
    const a = Number(saisie.caAssurance) || 0;
    const e = Number(saisie.caEspeces) || 0;
    if (!a && !e) return null;
    return retenueMedecin({ medecin: saisie.medecin, tauxBase: saisie.tauxBase, caAssurance: a, caEspeces: e });
  }, [saisie.medecin, saisie.tauxBase, saisie.caAssurance, saisie.caEspeces]);

  const reinitialiser = () => { setSaisie(VIDE); setModifieId(null); };

  const valider = async () => {
    const a = Number(saisie.caAssurance);
    const e = Number(saisie.caEspeces);
    if (!saisie.medecin.trim()) { toast.error("Nom du médecin requis."); return; }
    if (!Number.isInteger(a) || !Number.isInteger(e)) {
      toast.error("Chiffre d'affaires", { description: "Entier FCFA attendu, sans décimale." });
      return;
    }
    setEnCours(true);
    try {
      const r = await enregistrer({
        ligneId: (modifieId ?? undefined) as never,
        periode, medecin: saisie.medecin.trim(), tauxBase: saisie.tauxBase,
        caAssurance: a, caEspeces: e, notes: saisie.notes.trim() || undefined,
      });
      toast.success(modifieId ? "Ligne modifiée" : "Ligne ajoutée", {
        description: `Base ${r.base.toLocaleString("fr-FR")} × ${String(r.taux).replace(".", ",")} % = ${r.retenue.toLocaleString("fr-FR")} FCFA`,
      });
      reinitialiser();
    } catch (err) {
      toast.error("Enregistrement refusé", { description: messageErreur(err) });
    } finally { setEnCours(false); }
  };

  const telecharger = () => {
    if (!csv) return;
    const blob = new Blob(["﻿" + csv.csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = csv.nomFichier; a.click();
    URL.revokeObjectURL(url);
  };

  const r = etat?.recapitulatif;

  return (
    <div className="space-y-4">
      <PageEnTete
        titre="Retenue médecins"
        description={
          "L'impôt prélevé à la source sur les honoraires des médecins. La base n'est pas leur " +
          "chiffre d'affaires : c'est l'intégralité du CA « assurance » plus 30 % du CA " +
          "« espèces ». Et le taux décidé par la RH — 5 % ou 10 % — se majore des centimes " +
          "additionnels communaux, soit 5,5 % ou 11 % effectivement prélevés."
        }
        actions={
          <>
            <SelecteurPeriode valeur={periode} onChange={setPeriode} />
            <Button variant="outline" size="sm" disabled={!etat?.lignes.length} onClick={telecharger}>
              <DownloadIcon /> Exporter en CSV
            </Button>
          </>
        }
      />

      {etat === undefined ? (
        <SqueletteTexte lignes={8} />
      ) : (
        <>
          <GrilleTuiles>
            <Tuile libelle="Médecins déclarés" valeur={<Nombre valeur={r?.medecins ?? 0} />} note={libellePeriode(periode)} compact />
            <Tuile libelle="CA assurance" valeur={<Montant valeur={r?.caAssurance ?? 0} />} note="retenu en entier" compact />
            <Tuile libelle="CA espèces" valeur={<Montant valeur={r?.caEspeces ?? 0} />} note={`retenu à ${PART_ESPECES_PCT} %`} compact />
            <Tuile libelle="Retenue à verser" valeur={<Montant valeur={r?.retenue ?? 0} />} note={`sur une base de ${(r?.base ?? 0).toLocaleString("fr-FR")} FCFA`} vedette compact />
          </GrilleTuiles>

          {/* La règle a bougé depuis le dépôt : c'est une information, pas une erreur. */}
          {etat.regleABouge ? (
            <div className="flex gap-2 rounded-xl border border-dashed border-ocre bg-ocre-clair/40 px-3 py-2">
              <AlertTriangleIcon className="h-4 w-4 shrink-0 text-ocre" aria-hidden="true" />
              <p className="text-xs">
                Les montants <strong>figés au dépôt</strong> totalisent{" "}
                <Montant valeur={etat.retenueFigee} /> ; recalculés avec la règle actuelle, ils
                donneraient <Montant valeur={r?.retenue ?? 0} />. La déclaration déposée reste
                celle qui fait foi — réenregistrez une ligne pour la recalculer.
              </p>
            </div>
          ) : null}

          {r?.anomalies.length ? (
            <ul className="rounded-xl border border-carmin/30 bg-carmin/5 px-3 py-2 text-xs text-carmin" role="alert">
              {r.anomalies.map((a, i) => (
                <li key={i}><strong>{a.medecin}</strong> — {a.motif}</li>
              ))}
            </ul>
          ) : null}

          {/* ---- Ventilation par taux : ce que porte la déclaration ---- */}
          {r && r.parTaux.length > 0 ? (
            <div className="rounded-2xl border border-filet bg-surface p-3 shadow-xs">
              <h2 className="mb-2 text-sm font-semibold">Ventilation par taux</h2>
              <div className="flex flex-wrap gap-2">
                {r.parTaux.map((t) => (
                  <div key={t.tauxBase} className="rounded-lg border border-filet bg-papier px-3 py-2">
                    <div className="text-xs text-encre-pale">
                      {t.tauxBase} % annoncé → <strong className="text-encre">{String(t.taux).replace(".", ",")} %</strong> appliqué
                    </div>
                    <div className="mt-0.5 text-sm">
                      <Nombre valeur={t.medecins} unite="médecin(s)" /> ·{" "}
                      base <Montant valeur={t.base} devise={false} /> ·{" "}
                      <strong><Montant valeur={t.retenue} /></strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* ---- Saisie ---- */}
          <div className="rounded-2xl border border-filet bg-surface p-3 shadow-xs">
            <h2 className="mb-2 text-sm font-semibold">
              {modifieId ? "Modifier la ligne" : "Ajouter un médecin"}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <label className="grid gap-1 text-xs lg:col-span-2">
                Médecin
                <ChampAutocomplete
                  valeur={saisie.medecin}
                  ariaLabel="Médecin"
                  placeholder="Nom du médecin…"
                  options={(tauxConnus ?? []).map((t) => ({
                    valeur: t.medecin,
                    libelle: t.medecin,
                    note: `${t.tauxBase} %`,
                  }))}
                  onChange={choisirMedecin}
                />
              </label>
              <label className="grid gap-1 text-xs">
                Taux décidé
                <select
                  className="h-9 rounded-md border border-filet bg-surface px-2 text-sm"
                  value={saisie.tauxBase}
                  onChange={(e) => maj("tauxBase", Number(e.target.value))}
                >
                  {TAUX_BASE.map((t) => (
                    <option key={t} value={t}>
                      {t} % → {String(tauxEffectif(t)).replace(".", ",")} % appliqué
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-xs">
                CA assurance
                <Input
                  inputMode="numeric"
                  value={saisie.caAssurance}
                  onChange={(e) => maj("caAssurance", e.target.value.replace(/[^\d]/g, ""))}
                  placeholder="0"
                  className="text-right font-mono"
                />
              </label>
              <label className="grid gap-1 text-xs">
                CA espèces
                <Input
                  inputMode="numeric"
                  value={saisie.caEspeces}
                  onChange={(e) => maj("caEspeces", e.target.value.replace(/[^\d]/g, ""))}
                  placeholder="0"
                  className="text-right font-mono"
                />
              </label>
            </div>

            {/* L'aperçu dit ce qui sera enregistré, avant de l'enregistrer. */}
            {apercu ? (
              <div className="mt-3 rounded-lg border border-ocean-ciel bg-ocean-brume/30 px-3 py-2 text-xs">
                <ul className="space-y-0.5">
                  {apercu.detail.map((d, i) => <li key={i}>{d}</li>)}
                </ul>
              </div>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button size="sm" disabled={enCours || !saisie.medecin.trim()} onClick={() => void valider()}>
                <PlusIcon /> {modifieId ? "Enregistrer" : "Ajouter"}
              </Button>
              {modifieId ? (
                <Button variant="outline" size="sm" onClick={reinitialiser}>Annuler</Button>
              ) : null}
            </div>
          </div>

          {/* ---- La déclaration ---- */}
          <div className="rounded-2xl border border-filet bg-surface shadow-xs">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Médecin</TableHead>
                  <TableHead className="text-right">CA assurance</TableHead>
                  <TableHead className="text-right">CA espèces</TableHead>
                  <TableHead className="text-right">dont {PART_ESPECES_PCT} %</TableHead>
                  <TableHead className="text-right">Base</TableHead>
                  <TableHead className="text-right">Taux</TableHead>
                  <TableHead className="text-right">Retenue</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {!etat.lignes.length ? (
                  <TableVide colonnes={8}>
                    Aucun médecin déclaré pour {libellePeriode(periode)}.
                  </TableVide>
                ) : (
                  etat.lignes.map((l) => (
                    <TableRow key={String(l._id)}>
                      <TableCell className="font-medium">
                        {l.medecin}
                        {l.recalculeDiffere ? (
                          <Flag variant="a-renseigner" size="xs" className="ml-1.5">règle modifiée depuis</Flag>
                        ) : null}
                        {l.notes ? <div className="text-2xs text-encre-pale">{l.notes}</div> : null}
                      </TableCell>
                      <TableCell className="text-right"><Montant valeur={l.caAssurance} devise={false} /></TableCell>
                      <TableCell className="text-right"><Montant valeur={l.caEspeces} devise={false} /></TableCell>
                      <TableCell className="text-right text-encre-pale"><Montant valeur={l.partEspeces} devise={false} /></TableCell>
                      <TableCell className="text-right"><Montant valeur={l.base} devise={false} /></TableCell>
                      <TableCell className="text-right tabular-nums">
                        <span title={`${l.tauxBase} % annoncé, majoré des centimes additionnels`} className="cursor-help border-b border-dotted border-encre-pale">
                          {String(l.taux).replace(".", ",")} %
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        <span title={l.detail.join("\n")} className="cursor-help border-b border-dotted border-encre-pale">
                          <Montant valeur={l.retenue} devise={false} />
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => {
                              setModifieId(String(l._id));
                              setSaisie({
                                medecin: l.medecin, tauxBase: l.tauxBase,
                                caAssurance: String(l.caAssurance), caEspeces: String(l.caEspeces),
                                notes: l.notes ?? "",
                              });
                            }}
                          >
                            Modifier
                          </Button>
                          {/* Même motif que l'annulation d'un acte : un retrait de déclaration
                              fiscale exige une raison, et elle est journalisée. */}
                          <BoutonAction
                            size="sm"
                            variant="ghost"
                            onAction={() => {
                              const motif = window.prompt(`Pourquoi retirer ${l.medecin} de la déclaration ?`);
                              if (!motif) throw new Error("Retrait abandonné : un motif est obligatoire.");
                              return supprimer({ ligneId: l._id as never, motif });
                            }}
                            succes="Ligne retirée — le motif est journalisé"
                          >
                            Retirer
                          </BoutonAction>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* ---- Les explications, dépliables ---- */}
          <div className="rounded-2xl border border-filet bg-surface p-3 shadow-xs">
            <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
              <InfoIcon className="h-4 w-4 text-sceau" aria-hidden="true" />
              Comprendre ces chiffres
            </h2>
            <ul className="space-y-1.5">
              {etat.explications.map((e) => (
                <li key={e.cle}>
                  <button
                    type="button"
                    className={cn(
                      "w-full rounded-lg border px-3 py-2 text-left text-xs transition-colors",
                      explicationOuverte === e.cle ? "border-ocean-ciel bg-ocean-brume/30" : "border-filet bg-papier hover:border-ocean-ciel",
                    )}
                    aria-expanded={explicationOuverte === e.cle}
                    onClick={() => setExplicationOuverte((x) => (x === e.cle ? null : e.cle))}
                  >
                    <span className="font-semibold">{e.titre}</span>
                    {explicationOuverte === e.cle ? (
                      <span className="mt-1 block font-normal text-encre-douce">{e.texte}</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

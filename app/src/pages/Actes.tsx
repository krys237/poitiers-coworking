/**
 * Actes RH (lot R11) — attestations, notifications, stages et contrats.
 *
 * Ce que l'écran remplace : la RH ouvre un fichier Word, remplace les pointillés à la main, et
 * pour une attestation de salaire **recopie seize montants** depuis le bulletin. Ici elle choisit
 * le modèle, le salarié et la période : tout ce que le système sait est déjà en place, et il ne
 * reste à saisir que ce qu'il ne peut pas deviner — un motif, une date d'effet, un diplôme.
 *
 * Deux partis pris visibles à l'écran :
 *  · l'aperçu se met à jour **à la frappe**, parce qu'un acte se relit avant d'être remis ;
 *  · un champ laissé vide ne disparaît pas du document — il devient une ligne de pointillés,
 *    comme dans ses modèles Word, pour que l'acte reste imprimable et complétable à la main.
 */
import * as React from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { FileTextIcon, InfoIcon, TriangleAlertIcon } from "lucide-react";
import { api } from "../../convex/_generated/api";
import {
  LIBELLE_FAMILLE, rendreActe, type FamilleActe,
} from "../../convex/lib/actes";
import { periodeCourante } from "@/lib/format";
import { PageEnTete } from "@/components/app/en-tete";
import { BoutonAction } from "@/components/app/bouton-action";
import { BoutonPdf } from "@/components/app/bouton-pdf";
import { ChampAutocomplete } from "@/components/app/champ-autocomplete";
import { SelecteurPeriode } from "@/components/app/selecteur-periode";
import { Flag } from "@/components/ui/flag";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableVide,
} from "@/components/ui/table";

type Onglet = "generer" | "historique";

export function Actes() {
  const [onglet, setOnglet] = React.useState<Onglet>("generer");
  const [code, setCode] = React.useState<string>("");
  const [employeId, setEmployeId] = React.useState<string>("");
  const [periode, setPeriode] = React.useState(periodeCourante());
  // Valeurs modifiées à la main : elles PRIMENT sur le pré-remplissage, sinon chaque
  // rechargement de la préparation écraserait la saisie en cours.
  const [saisies, setSaisies] = React.useState<Record<string, string>>({});

  const catalogue = useQuery(api.actes.modeles, {});
  const employes = useQuery(api.employes.liste, {});
  const prepa = useQuery(
    api.actes.preparer,
    code ? { code, employeId: (employeId || undefined) as any, periode } : "skip",
  );
  const generer = useMutation(api.actes.generer);
  const initModeles = useMutation(api.actes.initialiserModeles);
  const pdfApercu = useAction(api.actesPdf.pdfApercu);

  const modeles = catalogue?.modeles ?? [];
  const modele = modeles.find((m) => m.code === code);

  // Changer de modèle ou de salarié repart d'une saisie vierge : garder des valeurs d'un
  // autre acte produirait un document faux sans que rien ne le signale.
  React.useEffect(() => setSaisies({}), [code, employeId]);

  const valeurs = React.useMemo(
    () => ({ ...(prepa?.valeurs ?? {}), ...saisies }),
    [prepa?.valeurs, saisies],
  );
  const apercu = modele ? rendreActe(modele.corps, valeurs) : "";
  const manquants = (modele?.champs ?? []).filter(
    (c) => c.obligatoire && !(valeurs[c.nom] ?? "").trim(),
  );

  const parFamille = React.useMemo(() => {
    const m = new Map<FamilleActe, typeof modeles>();
    for (const x of modeles) {
      const f = x.famille as FamilleActe;
      m.set(f, [...(m.get(f) ?? []), x]);
    }
    return [...m.entries()];
  }, [modeles]);

  return (
    <div className="space-y-4">
      <PageEnTete
        titre="Actes RH"
        description="Attestations, notifications, accords de stage et contrats. Les montants et l'identité sont repris de la fiche et du bulletin : il ne reste à saisir que ce que le système ne peut pas savoir."
        actions={
          <Tabs value={onglet} onValueChange={(v) => setOnglet(v as Onglet)}>
            <TabsList>
              <TabsTrigger value="generer">Délivrer un acte</TabsTrigger>
              <TabsTrigger value="historique">Actes délivrés</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      {catalogue?.source === "defaut" ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-filet bg-bande px-4 py-3">
          <InfoIcon className="h-5 w-5 shrink-0 text-ocean-ceruleen" aria-hidden="true" />
          <p className="flex-1 text-sm">
            Les modèles proviennent du catalogue livré. <strong>Chargez-les en base</strong> pour
            pouvoir en corriger les formulations vous-même.
          </p>
          <BoutonAction
            size="sm"
            variant="outline"
            onAction={() => initModeles({})}
            succes={(r: any) => `${r.ajoutes} modèle(s) chargé(s) et désormais modifiables`}
          >
            Charger les modèles
          </BoutonAction>
        </div>
      ) : null}

      {onglet === "historique" ? <Historique /> : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
          {/* ---- Le formulaire ---- */}
          <div className="space-y-3">
            <div className="rounded-2xl border border-filet bg-surface p-3 shadow-xs">
              <label className="grid gap-1 text-xs">
                Type d'acte
                <Select value={code} onValueChange={setCode}>
                  <SelectTrigger aria-label="Type d'acte">
                    <SelectValue placeholder="Choisir un acte…" />
                  </SelectTrigger>
                  <SelectContent>
                    {parFamille.map(([famille, liste]) => (
                      <React.Fragment key={famille}>
                        <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-encre-pale">
                          {LIBELLE_FAMILLE[famille]}
                        </div>
                        {liste.map((m) => (
                          <SelectItem key={m.code} value={m.code}>{m.libelle}</SelectItem>
                        ))}
                      </React.Fragment>
                    ))}
                  </SelectContent>
                </Select>
              </label>

              {modele ? (
                <>
                  <label className="mt-3 grid gap-1 text-xs">
                    Salarié concerné
                    <ChampAutocomplete
                      strict
                      valeur={employeId}
                      ariaLabel="Salarié concerné"
                      placeholder="Nom ou matricule…"
                      options={(employes ?? []).map((e: any) => ({
                        valeur: String(e._id),
                        libelle: e.nom,
                        note: e.matricule,
                        recherche: `${e.fonction ?? ""} ${e.cnps ?? ""}`,
                      }))}
                      onChange={(v) => setEmployeId(v)}
                    />
                  </label>

                  {modele.champs.some((c) => c.source.de === "bulletin") ? (
                    <div className="mt-3 grid gap-1 text-xs">
                      Période du bulletin
                      <SelecteurPeriode valeur={periode} onChange={setPeriode} />
                      <span className="text-[11px] text-encre-pale">
                        Les montants de l'acte sont repris du bulletin de ce mois.
                      </span>
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>

            {prepa?.avertissement ? (
              <div className="flex gap-2 rounded-xl border border-dashed border-ocre bg-ocre-clair/40 px-3 py-2">
                <TriangleAlertIcon className="h-4 w-4 shrink-0 text-ocre" aria-hidden="true" />
                <p className="text-xs">{prepa.avertissement}</p>
              </div>
            ) : null}

            {modele ? (
              <div className="space-y-2 rounded-2xl border border-filet bg-surface p-3 shadow-xs">
                <h2 className="text-sm font-semibold">
                  Champs
                  <span className="ml-2 text-xs font-normal text-encre-pale">
                    {modele.champs.length - manquants.length}/{modele.champs.length} renseigné(s)
                  </span>
                </h2>
                {modele.champs.map((c) => {
                  const propose = (prepa?.valeurs ?? {})[c.nom];
                  const valeur = valeurs[c.nom] ?? "";
                  const vide = c.obligatoire && !valeur.trim();
                  return (
                    <label key={c.nom} className="grid gap-0.5 text-xs">
                      <span className="flex items-center gap-1.5">
                        {c.libelle}
                        {c.obligatoire ? <span className="text-carmin">*</span> : null}
                        {propose && !saisies[c.nom] ? (
                          <Flag variant="renseigne" size="xs">pré-rempli</Flag>
                        ) : null}
                      </span>
                      {c.type === "zone" ? (
                        <Textarea
                          value={valeur}
                          rows={2}
                          aria-label={c.libelle}
                          onChange={(e) => setSaisies((s) => ({ ...s, [c.nom]: e.target.value }))}
                        />
                      ) : (
                        <Input
                          value={valeur}
                          aria-label={c.libelle}
                          className={vide ? "border-ocre" : undefined}
                          onChange={(e) => setSaisies((s) => ({ ...s, [c.nom]: e.target.value }))}
                        />
                      )}
                      {c.aide ? <span className="text-[11px] text-encre-pale">{c.aide}</span> : null}
                    </label>
                  );
                })}
              </div>
            ) : null}
          </div>

          {/* ---- L'aperçu ---- */}
          <div className="space-y-3">
            {!modele ? (
              <div className="rounded-2xl border border-dashed border-filet bg-bande p-8 text-center text-sm text-encre-pale">
                Choisissez un type d'acte pour en voir l'aperçu.
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  {manquants.length ? (
                    <Flag variant="a-renseigner" size="sm">
                      {manquants.length} champ(s) obligatoire(s) à renseigner
                    </Flag>
                  ) : (
                    <Flag variant="renseigne" size="sm">Prêt à délivrer</Flag>
                  )}
                  <span className="flex-1" />
                  <BoutonPdf
                    variant="outline"
                    titre="Aperçu PDF"
                    generer={() => pdfApercu({ corps: apercu, titre: modele.libelle })}
                  >
                    Aperçu PDF
                  </BoutonPdf>
                  <BoutonAction
                    disabled={manquants.length > 0}
                    onAction={() =>
                      generer({
                        code,
                        employeId: (employeId || undefined) as any,
                        periode: modele.champs.some((c) => c.source.de === "bulletin") ? periode : undefined,
                        valeurs,
                      })
                    }
                    succes={(r: any) => {
                      setSaisies({});
                      return `Acte délivré${r.reference ? ` — réf. ${r.reference}` : ""}`;
                    }}
                  >
                    <FileTextIcon /> Délivrer et archiver
                  </BoutonAction>
                </div>

                <div className="rounded-2xl border border-filet bg-surface p-6 shadow-xs">
                  {/* La marge haute reproduit à l'écran l'espace que le papier à en-tête occupe
                      sur le PDF : ce qu'elle voit ici est ce qui sortira de l'imprimante. */}
                  <div className="mb-5 flex h-16 items-center justify-center rounded-lg border border-dashed border-filet bg-bande text-[11px] text-encre-pale">
                    Emplacement réservé à l'en-tête imprimé (44 mm)
                  </div>
                  <pre className="whitespace-pre-wrap font-serif text-[13px] leading-relaxed text-encre">
                    {apercu}
                  </pre>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Historique() {
  const actes = useQuery(api.actes.historique, {});
  const annuler = useMutation(api.actes.annuler);
  const pdf = useAction(api.actesPdf.pdfActe);
  const fmt = (iso: string) => new Date(iso).toLocaleString("fr-FR");

  return (
    <div className="rounded-2xl border border-filet bg-surface shadow-xs">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Délivré le</TableHead>
            <TableHead>Acte</TableHead>
            <TableHead>Bénéficiaire</TableHead>
            <TableHead>Référence</TableHead>
            <TableHead>Par</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {actes === undefined ? (
            <TableVide colonnes={6}>Chargement…</TableVide>
          ) : !actes.length ? (
            <TableVide colonnes={6}>Aucun acte délivré.</TableVide>
          ) : (
            actes.map((a) => (
              <TableRow key={String(a._id)} className={a.annuleLe ? "opacity-60" : undefined}>
                <TableCell className="whitespace-nowrap text-xs">{fmt(a.genereLe)}</TableCell>
                <TableCell>
                  {a.modeleLibelle}
                  {a.annuleLe ? <Flag variant="verrou" size="xs" className="ml-1.5">annulé</Flag> : null}
                </TableCell>
                <TableCell>{a.nomBeneficiaire}</TableCell>
                <TableCell className="font-mono text-xs">{a.reference ?? "—"}</TableCell>
                <TableCell className="text-xs text-encre-pale">{a.genereParNom ?? "—"}</TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <BoutonPdf variant="outline" titre="Télécharger" generer={() => pdf({ id: a._id })}>
                      PDF
                    </BoutonPdf>
                    {!a.annuleLe ? (
                      <BoutonAction
                        size="sm"
                        variant="ghost"
                        onAction={() => {
                          const motif = window.prompt("Motif de l'annulation ?");
                          if (!motif) throw new Error("Annulation abandonnée : un motif est obligatoire.");
                          return annuler({ id: a._id, motif });
                        }}
                        succes="Acte annulé — il reste consultable"
                      >
                        Annuler
                      </BoutonAction>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * Bulletins du mois — refonte (charte poitiers-ui-ux-system).
 *
 * Tous les bulletins d'une période, calculés en direct tant que le mois est
 * ouvert, figés dès qu'il est clôturé. À gauche, la page récapitulative (un
 * salarié par ligne : brut, retenues, net) qui sert aussi de sommaire ; à
 * droite, le bulletin du salarié sélectionné, tel qu'il sera imprimé.
 *
 * Impression : la page récapitulative puis un bulletin A4 par page — tous, ou
 * seulement la sélection (`?employe=matricule`). La clôture (« Générer et
 * clôturer ») fige les bulletins ; elle est confirmée par mot-clé, comme le
 * grand livre.
 */
import * as React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { ArchiveIcon, FileCheck2Icon, PrinterIcon, SearchIcon, TableIcon, XIcon } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { fcfa, libellePeriode, num, periodeCourante } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageEnTete } from "@/components/app/en-tete";
import { GrilleTuiles, Tuile } from "@/components/app/tuile";
import { StatutMois } from "@/components/app/statut";
import { SelecteurPeriode } from "@/components/app/selecteur-periode";
import { BoutonConfirmation } from "@/components/app/bouton-action";
import { BoutonImprimer, useImpression } from "@/components/app/imprimer";
import { SqueletteTableau } from "@/components/app/chargement";
import { EtatVide } from "@/components/app/etat-vide";
import { SelecteurLignes, useLignesVisibles } from "@/components/app/lignes-visibles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Flag } from "@/components/ui/flag";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow, TableVide } from "@/components/ui/table";
import { Feuille, EnTeteDocument, TableauDocument, MentionDocument } from "@/components/documents/feuille";
import { BulletinCard } from "../components/BulletinCard";

const sansAccents = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function Bulletins() {
  const [params, setParams] = useSearchParams();
  const [periode, setPeriode] = React.useState(params.get("periode") ?? periodeCourante());
  const filtre = params.get("employe");
  const paie = useQuery(api.payroll.bulletinsDuMois, { periode });
  const entreprise = useQuery(api.parametres.get);
  const generer = useMutation(api.payroll.genererEtCloturer);
  const lignesVisibles = useLignesVisibles("bulletins", 15);
  const [q, setQ] = React.useState("");
  const [ouvert, setOuvert] = React.useState<string | null>(filtre);
  const imprimer = useImpression();
  // « Imprimer seul » : on limite d'abord l'impression au salarié (adresse), puis on imprime une fois le filtre appliqué.
  const [imprimerSeul, setImprimerSeul] = React.useState<string | null>(null);

  const tous = (paie?.bulletins ?? []) as any[];
  const qq = sansAccents(q.trim());
  const liste = tous.filter((b) => !qq || sansAccents(`${b.nom} ${b.matricule} ${b.societe}`).includes(qq));
  // À imprimer : le salarié filtré par l'adresse, sinon tous.
  const aImprimer = filtre ? tous.filter((b) => b.matricule === filtre) : tous;
  const selection = tous.find((b) => b.matricule === ouvert) ?? tous[0] ?? null;
  const total = (cle: "brut" | "totalRetenues" | "net", src: any[] = tous) => src.reduce((t, b) => t + (b[cle] ?? 0), 0);
  const nomEntreprise = entreprise?.nom ?? "POITIERS COWORKING";

  React.useEffect(() => {
    if (imprimerSeul && filtre === imprimerSeul && aImprimer.length === 1) {
      setImprimerSeul(null);
      imprimer({ entreprise: nomEntreprise, document: aImprimer[0].nom, periode: libellePeriode(periode) });
    }
  }, [imprimerSeul, filtre, aImprimer, imprimer, nomEntreprise, periode]);

  const changerPeriode = (p: string) => { setPeriode(p); setOuvert(null); setParams({ periode: p }, { replace: true }); };
  const filtrer = (matricule: string | null) => {
    const next: Record<string, string> = { periode };
    if (matricule) next.employe = matricule;
    setParams(next, { replace: true });
    setOuvert(matricule);
  };

  return (
    <div className="space-y-4">
      <PageEnTete
        className="print:hidden"
        titre="Bulletins du mois"
        description="Un bulletin A4 par salarié, calculé en direct tant que le mois est ouvert, figé à la clôture. Cliquez un salarié pour voir son bulletin ; l'impression sort la page récapitulative puis un bulletin par page."
        statut={<StatutMois cloture={paie === undefined ? undefined : paie.cloture} />}
        actions={
          <>
            <SelecteurPeriode valeur={periode} onChange={changerPeriode} />
            <BoutonImprimer entreprise={nomEntreprise} document={filtre && aImprimer[0] ? aImprimer[0].nom : "Bulletins"} periode={libellePeriode(periode)} desactive={!aImprimer.length}>
              Imprimer {filtre ? "le bulletin" : `(${tous.length})`}
            </BoutonImprimer>
            {paie && !paie.cloture && tous.length > 0 && (
              <BoutonConfirmation
                libelle={<><FileCheck2Icon /> Générer et clôturer</>}
                titre={`Clôturer la paie de ${libellePeriode(periode)} ?`}
                consequence={`${tous.length} bulletin(s) seront figés tels qu'ils sont affichés : plus aucune saisie, absence ou prime ne les modifiera. Le mois passera en lecture seule et rejoindra les archives.`}
                motCle="CLOTURER"
                confirmer="Clôturer le mois"
                onConfirmer={() => generer({ periode })}
                succes={(r: any) => `${libellePeriode(periode)} clôturé : ${r.bulletins} bulletin(s) figé(s)${r.pdfPlanifies ? ", PDF en cours de génération" : ""}.`}
              />
            )}
          </>
        }
      />

      <GrilleTuiles className="print:hidden">
        <Tuile libelle="Bulletins" valeur={paie ? tous.length : undefined} note={paie?.cloture ? "figés à la clôture" : "calculés en direct"} vedette />
        <Tuile libelle="Masse brute" valeur={paie ? <span className="font-mono">{num(total("brut"))}</span> : undefined} note="FCFA · Total 1" />
        <Tuile libelle="Retenues" valeur={paie ? <span className="font-mono">{num(total("totalRetenues"))}</span> : undefined} note="FCFA · cotisations, impôts, autres retenues" />
        <Tuile libelle="Net à payer" valeur={paie ? <span className="font-mono">{num(total("net"))}</span> : undefined} note="FCFA · Total 2" />
      </GrilleTuiles>

      {paie?.erreur && <p className="text-sm font-medium text-carmin print:hidden">{paie.erreur}</p>}

      <div className="print:hidden">
      {paie === undefined ? (
        <SqueletteTableau colonnes={6} lignes={8} />
      ) : tous.length === 0 ? (
        <EtatVide icone={TableIcon} titre={`Aucun bulletin pour ${libellePeriode(periode)}`} action={<Button size="sm" asChild><Link to="/paie/saisie">Récapitulatif salaires</Link></Button>}>
          {paie.erreur ?? "Les bulletins se calculent dès qu'un employé actif existe et qu'un barème s'applique à la période."}
        </EtatVide>
      ) : (
        <div className="flex flex-col gap-3.5 xl:flex-row xl:items-start">
          {/* Récapitulatif : un salarié par ligne, la ligne active est celle du bulletin affiché. */}
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-3">
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-encre-pale" aria-hidden="true" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom, matricule, société…" className="h-9 w-64 pl-8" aria-label="Rechercher un salarié" />
              </div>
              {filtre && (
                <Flag variant="saisie-active" size="sm">
                  Impression limitée à {aImprimer[0]?.nom ?? filtre}
                  <button type="button" className="ml-1 rounded hover:bg-white/20" onClick={() => filtrer(null)} aria-label="Imprimer tous les bulletins"><XIcon className="h-3 w-3" /></button>
                </Flag>
              )}
              <span className="ml-auto text-xs text-encre-douce">{liste.length} salarié(s)</span>
              <SelecteurLignes valeur={lignesVisibles.lignes} onChange={lignesVisibles.setLignes} />
            </div>
            <Table classNameConteneur="rounded-xl" hauteurMax={lignesVisibles.hauteurMax(44, 40, 44)}>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">N°</TableHead>
                  <TableHead>Salarié</TableHead>
                  <TableHead>Société</TableHead>
                  <TableHead numerique>Brut (FCFA)</TableHead>
                  <TableHead numerique>Retenues</TableHead>
                  <TableHead numerique className="bg-ocean-nuit">Net à payer</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {liste.map((b, i) => (
                  <TableRow key={String(b.employeId)} active={selection?.matricule === b.matricule} className="cursor-pointer" tabIndex={0} onClick={() => setOuvert(b.matricule)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOuvert(b.matricule); } }}>
                    <TableCell className="font-mono text-2xs text-encre-pale">{i + 1}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div className="text-[13px] font-semibold">{b.nom}</div>
                      <div className="max-w-[16rem] truncate font-mono text-2xs text-encre-pale" title={b.fonction}>{b.matricule}{b.fonction ? ` · ${b.fonction}` : ""}</div>
                    </TableCell>
                    <TableCell><Flag variant="neutre" size="xs">{b.societe}</Flag></TableCell>
                    <TableCell numerique className="font-mono text-xs">{num(b.brut)}</TableCell>
                    <TableCell numerique className="font-mono text-xs">{num(b.totalRetenues)}</TableCell>
                    <TableCell numerique className="bg-ocean-brume font-mono text-xs font-semibold">{num(b.net)}</TableCell>
                  </TableRow>
                ))}
                {liste.length === 0 && <TableVide colonnes={6}>Aucun salarié ne correspond.</TableVide>}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3}>TOTAL · {liste.length} salarié(s)</TableCell>
                  <TableCell numerique className="font-mono text-xs">{num(total("brut", liste))}</TableCell>
                  <TableCell numerique className="font-mono text-xs">{num(total("totalRetenues", liste))}</TableCell>
                  <TableCell numerique className="bg-ocean-brume font-mono text-xs font-semibold">{num(total("net", liste))}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>

          {/* Aperçu du bulletin sélectionné : la feuille A4 réduite pour tenir dans le volet. */}
          <aside className="flex w-full flex-col overflow-hidden rounded-xl border border-filet bg-surface xl:w-[30rem] xl:shrink-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-filet px-4 py-3">
              <div>
                <div className="text-sm font-semibold">{selection ? selection.nom : "Bulletin"}</div>
                <div className="text-2xs text-encre-pale">{selection ? `${selection.matricule} · ${selection.societe} · net ${fcfa(selection.net)}` : "Choisissez un salarié."}</div>
              </div>
              {selection && (
                <div className="flex items-center gap-1.5">
                  {filtre === selection.matricule
                    ? <Button variant="outline" size="sm" onClick={() => filtrer(null)} title="Revenir à l'impression de tous les bulletins"><XIcon /> Tous à l'impression</Button>
                    : <Button variant="outline" size="sm" onClick={() => { filtrer(selection.matricule); setImprimerSeul(selection.matricule); }} title="Imprimer uniquement ce bulletin"><PrinterIcon /> Imprimer seul</Button>}
                  {paie.cloture && <Button variant="outline" size="sm" asChild><Link to="/paie/archives"><ArchiveIcon /> Archives</Link></Button>}
                </div>
              )}
            </div>
            <div className="bg-papier p-3">
              {selection ? <ApercuFeuille><BulletinCard b={selection} entreprise={entreprise} page="page 1/1" /></ApercuFeuille> : null}
            </div>
          </aside>
        </div>
      )}
      </div>

      {/* Impression : page récapitulative puis un bulletin par page. */}
      <div className="hidden print:block">
        {aImprimer.length > 1 && (
          <Feuille>
            <EnTeteDocument raisonSociale={nomEntreprise} coordonnees={<>{entreprise?.adresse}<br />NIU {entreprise?.niu || "—"} · N° CNPS {entreprise?.numeroCnps || "—"}</>} nature="RÉCAPITULATIF DE PAIE" periode={`${libellePeriode(periode)} · ${aImprimer.length} bulletin(s)`} />
            <TableauDocument>
              <thead><tr><th className="c">N°</th><th>Nom et prénoms</th><th>Matricule</th><th className="c">Société</th><th className="r">Brut (FCFA)</th><th className="r">Retenues</th><th className="r">Net à payer</th></tr></thead>
              <tbody>
                {aImprimer.map((b, i) => (
                  <tr key={String(b.employeId)}><td className="c">{i + 1}</td><td>{b.nom}</td><td className="c">{b.matricule}</td><td className="c">{b.societe}</td><td className="r">{num(b.brut)}</td><td className="r">{num(b.totalRetenues)}</td><td className="r">{num(b.net)}</td></tr>
                ))}
                <tr className="appuyee"><td colSpan={4}>TOTAUX</td><td className="r">{num(total("brut", aImprimer))}</td><td className="r">{num(total("totalRetenues", aImprimer))}</td><td className="r">{num(total("net", aImprimer))}</td></tr>
              </tbody>
            </TableauDocument>
            <MentionDocument valide={!!paie?.cloture} dateValidation={aImprimer[0]?.valideLe ? new Date(aImprimer[0].valideLe).toLocaleDateString("fr-FR") : undefined} />
          </Feuille>
        )}
        {aImprimer.map((b, i) => <BulletinCard key={String(b.employeId)} b={b} entreprise={entreprise} page={`page ${i + 1}/${aImprimer.length}`} />)}
      </div>
    </div>
  );
}

/** Réduit une feuille A4 (210 mm) à la largeur disponible, sans la reformater. */
function ApercuFeuille({ children }: { children: React.ReactNode }) {
  const cadre = React.useRef<HTMLDivElement>(null);
  const feuille = React.useRef<HTMLDivElement>(null);
  const [k, setK] = React.useState(1);
  const [h, setH] = React.useState<number>();
  React.useEffect(() => {
    const ajuster = () => {
      if (!cadre.current || !feuille.current) return;
      const kk = Math.min(1, cadre.current.clientWidth / feuille.current.offsetWidth);
      setK(kk); setH(feuille.current.offsetHeight * kk);
    };
    ajuster();
    const ro = new ResizeObserver(ajuster);
    if (cadre.current) ro.observe(cadre.current);
    if (feuille.current) ro.observe(feuille.current);
    return () => ro.disconnect();
  }, [children]);
  return (
    <div ref={cadre} className="w-full overflow-hidden" style={{ height: h }}>
      <div ref={feuille} className={cn("origin-top-left [&>.feuille]:m-0 [&>.feuille]:w-[210mm] [&>.feuille]:max-w-none")} style={{ transform: `scale(${k})`, width: "210mm" }}>{children}</div>
    </div>
  );
}

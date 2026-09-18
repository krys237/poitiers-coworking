/**
 * Liste des salaires — refonte (charte poitiers-ui-ux-system).
 *
 * « Récapitulatif général salaire et primes perçus » : la liste papier signée
 * par la direction. Le net de chaque employé figure dans la colonne de SA
 * société (SOFINA · SGC · SESAME), avec ses primes et le total perçu ; les
 * bulletins se génèrent à partir de ces montants.
 *
 * À l'écran : tableau ERP (filtre par société, recherche, lignes visibles,
 * défilement intégré). À l'impression : la feuille A4 seule, en-tête de
 * l'entreprise, totaux arrêtés, cases de visa, mention d'état.
 */
import * as React from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { FileCheck2Icon, SearchIcon, UsersIcon } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { libellePeriode, num, periodeCourante } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageEnTete } from "@/components/app/en-tete";
import { GrilleTuiles, Tuile } from "@/components/app/tuile";
import { Montant } from "@/components/app/montant";
import { StatutMois } from "@/components/app/statut";
import { SelecteurPeriode } from "@/components/app/selecteur-periode";
import { BoutonConfirmation } from "@/components/app/bouton-action";
import { BoutonImprimer } from "@/components/app/imprimer";
import { SqueletteTableau } from "@/components/app/chargement";
import { SelecteurLignes, useLignesVisibles } from "@/components/app/lignes-visibles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow, TableVide } from "@/components/ui/table";
import { CaseDocument, CasesDocument, EnTeteDocument, Feuille, MentionDocument, TableauDocument } from "@/components/documents/feuille";

// Ordre des colonnes de la liste papier.
const SOCIETES = ["SOFINA", "SGC", "SESAME"] as const;
type Societe = (typeof SOCIETES)[number];
const sansAccents = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const N = ({ v }: { v: number }) => (v ? <>{num(v)}</> : <span className="text-encre-pale">0</span>);

export function ListeSalaires() {
  const [periode, setPeriode] = React.useState(periodeCourante());
  const paie = useQuery(api.payroll.bulletinsDuMois, { periode });
  const entreprise = useQuery(api.parametres.get);
  const generer = useMutation(api.payroll.genererEtCloturer);
  const lignesVisibles = useLignesVisibles("liste-salaires", 20);
  const [societe, setSociete] = React.useState<Societe | "toutes">("toutes");
  const [recherche, setRecherche] = React.useState("");

  const cloture = paie?.cloture ?? false;
  const toutes = (paie?.bulletins ?? []) as any[];
  const primesDe = (b: any) => b.details?.primes ?? 0;
  const q = sansAccents(recherche.trim());
  const lignes = toutes.filter((b) => (societe === "toutes" || b.societe === societe) && (!q || sansAccents(`${b.nom} ${b.matricule} ${b.fonction ?? ""}`).includes(q)));
  const totalSociete = (rows: any[], s: string) => rows.filter((b) => b.societe === s).reduce((t, b) => t + b.net, 0);
  const totalPrimes = (rows: any[]) => rows.reduce((t, b) => t + primesDe(b), 0);
  const totalNet = (rows: any[]) => rows.reduce((t, b) => t + b.net, 0);
  const nomEntreprise = entreprise?.nom ?? "POITIERS COWORKING";
  const filtre = societe !== "toutes" || q;

  return (
    <div className="space-y-4">
      <PageEnTete
        titre="Liste des salaires"
        description="Récapitulatif général des salaires et primes perçus, aux colonnes de la liste papier : le net de chaque employé dans la colonne de sa société (SOFINA · SGC · SESAME), ses primes, le total perçu. Les bulletins du mois se génèrent à partir de ces montants."
        statut={<StatutMois cloture={paie === undefined ? undefined : cloture} />}
        actions={
          <>
            <Button variant="outline" size="sm" asChild><Link to={`/paie/bulletins?periode=${periode}`}><FileCheck2Icon /> Bulletins du mois</Link></Button>
            <Button variant="outline" size="sm" asChild><Link to="/employes"><UsersIcon /> Employés</Link></Button>
            <BoutonImprimer entreprise={nomEntreprise} document="Liste des salaires" periode={libellePeriode(periode)} desactive={!lignes.length} />
            {!cloture && toutes.length > 0 ? (
              <BoutonConfirmation
                variant="default"
                size="sm"
                libelle="Générer et clôturer le mois"
                titre={`Générer et clôturer ${libellePeriode(periode)} ?`}
                consequence={`Les ${toutes.length} bulletins seront figés sur ces montants et les saisies du mois ne seront plus modifiables. Opération irréversible.`}
                motCle="CLOTURER"
                confirmer="Générer et clôturer"
                onConfirmer={() => generer({ periode })}
                succes={(r: any) => `${r.bulletins} bulletin(s) générés — ${libellePeriode(periode)} clôturé.`}
              />
            ) : null}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-filet bg-surface px-3 py-2 shadow-xs print:hidden">
        <SelecteurPeriode valeur={periode} onChange={setPeriode} />
        <span className="text-sm font-semibold">{libellePeriode(periode)}</span>
        <span className="hidden h-6 w-px bg-filet sm:block" aria-hidden="true" />
        <div role="tablist" aria-label="Société" className="flex items-center gap-1 rounded-xl border border-filet bg-slate-100/80 p-1">
          {([["toutes", "Toutes"], ...SOCIETES.map((s) => [s, s])] as [Societe | "toutes", string][]).map(([k, l]) => {
            const n = k === "toutes" ? toutes.length : toutes.filter((b) => b.societe === k).length;
            return (
              <button key={k} role="tab" aria-selected={societe === k} onClick={() => setSociete(k)}
                className={cn("inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors", societe === k ? "bg-ocean-profond text-white shadow-xs" : "text-encre-douce hover:bg-white hover:text-encre")}>
                {l}<span className={cn("font-mono text-[10px] tabular-nums", societe === k ? "text-white/80" : "text-encre-pale")}>{n}</span>
              </button>
            );
          })}
        </div>
        <span className="flex-1" />
        <SelecteurLignes valeur={lignesVisibles.lignes} onChange={lignesVisibles.setLignes} />
        <div className="relative w-56">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-encre-pale" aria-hidden="true" />
          <Input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Nom, matricule, fonction…" aria-label="Rechercher un employé" className="h-8 pl-8" />
        </div>
      </div>

      <GrilleTuiles className="print:hidden">
        <Tuile libelle="Total perçu" valeur={paie ? <Montant valeur={totalNet(toutes)} zero="0" gras /> : undefined} note={paie ? `${toutes.length} employé(s) · ${cloture ? "bulletins figés" : "calcul en direct"}` : undefined} vedette />
        {SOCIETES.map((s) => (
          <Tuile key={s} libelle={`Net ${s}`} valeur={paie ? <Montant valeur={totalSociete(toutes, s)} zero="0" /> : undefined} note={paie ? `${toutes.filter((b) => b.societe === s).length} employé(s)` : undefined} />
        ))}
      </GrilleTuiles>

      {paie?.erreur && <p className="text-sm font-medium text-carmin print:hidden">{paie.erreur}</p>}

      {/* Écran : tableau ERP */}
      <div className="print:hidden">
        {paie === undefined ? (
          <SqueletteTableau colonnes={8} lignes={8} />
        ) : (
          <Table classNameConteneur="rounded-xl" hauteurMax={lignesVisibles.hauteurMax(49, 40, 44)}>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">N°</TableHead>
                <TableHead>Noms et prénoms</TableHead>
                {SOCIETES.map((s) => <TableHead key={s} numerique className={cn(societe === s && "bg-ocean-nuit")}>{s}</TableHead>)}
                <TableHead numerique>Primes</TableHead>
                <TableHead numerique className="bg-ocean-nuit">Total perçu (FCFA)</TableHead>
                <TableHead aria-label="Bulletin" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {lignes.map((b, i) => (
                <TableRow key={String(b.employeId)}>
                  <TableCell className="font-mono text-xs text-encre-pale">{i + 1}</TableCell>
                  <TableCell className="leading-tight">
                    <div className="whitespace-nowrap text-[13px] font-semibold">{b.nom}</div>
                    <div className="whitespace-nowrap text-2xs text-encre-pale">{b.matricule}{b.fonction ? ` · ${b.fonction}` : ""}</div>
                  </TableCell>
                  {SOCIETES.map((s) => <TableCell key={s} numerique className="font-mono text-xs">{b.societe === s ? <b>{num(b.net)}</b> : <span className="text-encre-pale">—</span>}</TableCell>)}
                  <TableCell numerique className="font-mono text-xs"><N v={primesDe(b)} /></TableCell>
                  <TableCell numerique className="bg-ocean-brume font-mono text-xs font-semibold">{num(b.net)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon-sm" asChild aria-label={`Bulletin — ${b.nom}`} title="Ouvrir le bulletin">
                      <Link to={`/paie/bulletins?periode=${periode}&employe=${encodeURIComponent(b.matricule)}`}><FileCheck2Icon /></Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {lignes.length === 0 && <TableVide colonnes={8}>{filtre ? "Aucun employé ne correspond aux filtres." : "Aucun employé actif pour ce mois."}</TableVide>}
            </TableBody>
            {lignes.length > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={2}>TOTAUX · {lignes.length}{filtre ? ` / ${toutes.length}` : ""} employés</TableCell>
                  {SOCIETES.map((s) => <TableCell key={s} numerique className="font-mono text-xs"><N v={totalSociete(lignes, s)} /></TableCell>)}
                  <TableCell numerique className="font-mono text-xs"><N v={totalPrimes(lignes)} /></TableCell>
                  <TableCell numerique className="bg-ocean-brume font-mono text-xs">{num(totalNet(lignes))}</TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            )}
          </Table>
        )}
      </div>

      {/* Impression : la feuille A4 seule */}
      <div className="hidden print:block">
        <Feuille provisoire={!cloture}>
          <EnTeteDocument
            raisonSociale={nomEntreprise}
            coordonnees={[entreprise?.adresse, entreprise?.niu ? `NIU ${entreprise.niu}` : null, entreprise?.numeroCnps ? `N° CNPS ${entreprise.numeroCnps}` : null].filter(Boolean).join(" · ")}
            nature="Liste des salaires"
            periode={`Récapitulatif général salaire et primes perçus — ${libellePeriode(periode)}${societe !== "toutes" ? ` · ${societe}` : ""}`}
          />
          <TableauDocument>
            <thead>
              <tr><th>N°</th><th>Noms et prénoms</th>{SOCIETES.map((s) => <th key={s} className="num">{s}</th>)}<th className="num">Primes</th><th className="num">Total perçu</th></tr>
            </thead>
            <tbody>
              {lignes.map((b, i) => (
                <tr key={String(b.employeId)}>
                  <td>{i + 1}</td><td>{b.nom}</td>
                  {SOCIETES.map((s) => <td key={s} className="num">{b.societe === s ? num(b.net) : "—"}</td>)}
                  <td className="num">{primesDe(b) ? num(primesDe(b)) : "—"}</td>
                  <td className="num"><b>{num(b.net)}</b></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}><b>TOTAUX ({lignes.length} employés)</b></td>
                {SOCIETES.map((s) => <td key={s} className="num"><b>{num(totalSociete(lignes, s))}</b></td>)}
                <td className="num"><b>{num(totalPrimes(lignes))}</b></td>
                <td className="num"><b>{num(totalNet(lignes))}</b></td>
              </tr>
            </tfoot>
          </TableauDocument>
          <CasesDocument>
            <CaseDocument intitule={`Établi par${entreprise?.responsableRH ? ` — ${entreprise.responsableRH}` : " (RH)"}`} />
            <CaseDocument intitule="Visa de la Direction" />
          </CasesDocument>
          <MentionDocument valide={cloture} />
        </Feuille>
      </div>
    </div>
  );
}

/**
 * Archives de paie — refonte (charte poitiers-ui-ux-system).
 *
 * Les mois clôturés : leurs bulletins sont figés (snapshot, jamais recalculés),
 * les envois tracés, les PDF conservés dans le stockage. C'est ici qu'on
 * retrouve, prévisualise, télécharge ou ré-imprime un bulletin passé.
 *
 * À gauche la liste des mois clôturés (qui a clôturé, quand, combien de
 * bulletins, brut, net, envoyés, PDF archivés) ; à droite les bulletins figés
 * du mois choisi, avec aperçu et téléchargement du PDF. La génération des PDF
 * manquants se lance par mois, elle est idempotente.
 */
import * as React from "react";
import { Link } from "react-router-dom";
import { useAction, useQuery } from "convex/react";
import { ArchiveIcon, DownloadIcon, EyeIcon, FileCheck2Icon, FileDownIcon, SearchIcon, XIcon } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { BulletinCard } from "../components/BulletinCard";
import { libellePeriode, num } from "@/lib/format";
import { PageEnTete } from "@/components/app/en-tete";
import { GrilleTuiles, Tuile } from "@/components/app/tuile";
import { BoutonConfirmation } from "@/components/app/bouton-action";
import { SqueletteTableau } from "@/components/app/chargement";
import { EtatVide } from "@/components/app/etat-vide";
import { SelecteurLignes, useLignesVisibles } from "@/components/app/lignes-visibles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Flag } from "@/components/ui/flag";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const fmtDateHeure = (s?: string) => (s ? new Date(s).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "—");
const fmtDate = (s?: string) => (s ? new Date(s).toLocaleDateString("fr-FR") : "");
const sansAccents = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function Archives() {
  const mois = useQuery(api.archives.liste);
  const entreprise = useQuery(api.parametres.get);
  const archiver = useAction(api.paiePdf.archiverPdfs);
  const lignesVisibles = useLignesVisibles("archives", 15);
  const [ouvert, setOuvert] = React.useState<string | null>(null);
  const [recherche, setRecherche] = React.useState("");
  const [apercuDe, setApercuDe] = React.useState<string | null>(null);

  const liste = (mois ?? []) as any[];
  // Le premier mois clôturé s'ouvre de lui-même.
  React.useEffect(() => { if (ouvert === null && liste.length) setOuvert(liste[0].periode); }, [liste.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const detail = useQuery(api.archives.bulletinsDuMois, ouvert ? { periode: ouvert } : "skip");
  // Les snapshots complets (détails du bulletin) pour l'aperçu.
  const snapshots = useQuery(api.payroll.bulletinsDuMois, ouvert ? { periode: ouvert } : "skip");
  const moisOuvert = liste.find((m) => m.periode === ouvert) ?? null;

  const q = sansAccents(recherche.trim());
  const bulletins = ((detail ?? []) as any[]).filter((b) => !q || sansAccents(`${b.nom} ${b.matricule} ${b.societe}`).includes(q));
  const totalBulletins = liste.reduce((s, m) => s + m.nombre, 0);
  const pdfManquants = liste.reduce((s, m) => s + (m.nombre - m.pdfs), 0);
  const apercu = apercuDe ? ((snapshots?.bulletins ?? []) as any[]).find((b) => String(b.employeId) === apercuDe) ?? null : null;

  return (
    <div className="space-y-4">
      <PageEnTete
        titre="Archives de paie"
        description="Les mois clôturés : bulletins figés à la clôture (jamais recalculés), envois tracés, PDF conservés dans le stockage. Retrouvez, prévisualisez, téléchargez ou ré-imprimez un bulletin passé."
        statut={<Flag variant="verrou" size="sm" icon={<ArchiveIcon className="h-3 w-3" />}>Lecture seule</Flag>}
      />

      <GrilleTuiles>
        <Tuile libelle="Mois archivés" valeur={mois ? liste.length : undefined} note={liste.length ? `du ${libellePeriode(liste[liste.length - 1].periode)} au ${libellePeriode(liste[0].periode)}` : "aucun mois clôturé"} vedette />
        <Tuile libelle="Bulletins figés" valeur={mois ? totalBulletins : undefined} note="tous mois confondus" />
        <Tuile libelle="PDF à générer" valeur={mois ? pdfManquants : undefined} note={pdfManquants ? "bulletins figés sans PDF archivé" : "tous les PDF sont archivés"} />
        <Tuile libelle="Dernière clôture" valeur={mois ? (liste[0] ? libellePeriode(liste[0].periode) : "—") : undefined} note={liste[0] ? `${fmtDateHeure(liste[0].closedAt)} · ${liste[0].closedBy}` : undefined} compact />
      </GrilleTuiles>

      {mois === undefined ? (
        <SqueletteTableau colonnes={8} lignes={5} />
      ) : liste.length === 0 ? (
        <EtatVide
          icone={ArchiveIcon}
          titre="Aucun mois clôturé"
          action={<Button size="sm" asChild><Link to="/paie/liste"><FileCheck2Icon /> Liste des salaires</Link></Button>}
        >
          Un mois s'archive quand vous le clôturez (« Générer et clôturer le mois » depuis la liste des salaires ou le récapitulatif). Ses bulletins sont alors figés.
        </EtatVide>
      ) : (
        <div className="flex flex-col gap-3.5 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-xs text-encre-douce">{liste.length} mois clôturé(s) — cliquez un mois pour voir ses bulletins.</span>
              <SelecteurLignes valeur={lignesVisibles.lignes} onChange={lignesVisibles.setLignes} />
            </div>
            <Table classNameConteneur="rounded-xl" hauteurMax={lignesVisibles.hauteurMax(49, 40, 44)}>
              <TableHeader>
                <TableRow>
                  <TableHead>Mois</TableHead>
                  <TableHead>Clôturé le · par</TableHead>
                  <TableHead numerique>Bulletins</TableHead>
                  <TableHead numerique>Brut (FCFA)</TableHead>
                  <TableHead numerique className="bg-ocean-nuit">Net (FCFA)</TableHead>
                  <TableHead>Envoyés</TableHead>
                  <TableHead>PDF archivés</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {liste.map((m) => {
                  const actif = ouvert === m.periode;
                  const complet = m.pdfs === m.nombre;
                  return (
                    <TableRow key={m.periode} active={actif} className="cursor-pointer" tabIndex={0} aria-selected={actif}
                      onClick={() => setOuvert(m.periode)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOuvert(m.periode); } }}>
                      <TableCell className="whitespace-nowrap text-[13px] font-semibold">{libellePeriode(m.periode)}</TableCell>
                      <TableCell className="leading-tight">
                        <div className="whitespace-nowrap font-mono text-xs tabular-nums">{fmtDateHeure(m.closedAt)}</div>
                        <div className="whitespace-nowrap text-2xs text-encre-pale">{m.closedBy}</div>
                      </TableCell>
                      <TableCell numerique className="font-mono text-xs">{m.nombre}</TableCell>
                      <TableCell numerique className="font-mono text-xs">{num(m.brut)}</TableCell>
                      <TableCell numerique className="bg-ocean-brume font-mono text-xs font-semibold">{num(m.net)}</TableCell>
                      <TableCell><Flag variant={m.envoyes === m.nombre ? "renseigne" : m.envoyes ? "a-renseigner" : "neutre"} size="xs">{m.envoyes} / {m.nombre}</Flag></TableCell>
                      <TableCell><Flag variant={complet ? "renseigne" : "a-renseigner"} size="xs" title={complet ? "Tous les PDF sont dans le stockage" : `${m.nombre - m.pdfs} PDF à générer`}>{m.pdfs} / {m.nombre}{complet ? " archivés" : " · à générer"}</Flag></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={2}>TOTAL · {liste.length} mois</TableCell>
                  <TableCell numerique className="font-mono text-xs">{totalBulletins}</TableCell>
                  <TableCell numerique className="font-mono text-xs">{num(liste.reduce((s, m) => s + m.brut, 0))}</TableCell>
                  <TableCell numerique className="bg-ocean-brume font-mono text-xs">{num(liste.reduce((s, m) => s + m.net, 0))}</TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
              </TableFooter>
            </Table>
          </div>

          {/* Volet : bulletins figés du mois ouvert */}
          <aside className="flex w-full flex-col overflow-hidden rounded-xl border border-filet bg-surface lg:w-[26rem] lg:shrink-0">
            <div className="flex items-start justify-between gap-3 border-b border-filet px-4 py-3">
              <div>
                <div className="text-sm font-semibold">{moisOuvert ? `Bulletins figés — ${libellePeriode(moisOuvert.periode)}` : "Bulletins figés"}</div>
                <div className="text-2xs text-encre-pale">{moisOuvert ? `Clôturé le ${fmtDateHeure(moisOuvert.closedAt)} par ${moisOuvert.closedBy}` : "Choisissez un mois."}</div>
              </div>
              {moisOuvert ? (
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <Button variant="outline" size="sm" asChild><Link to={`/paie/bulletins?periode=${moisOuvert.periode}`}><FileCheck2Icon /> Tous les bulletins</Link></Button>
                  {moisOuvert.pdfs < moisOuvert.nombre && (
                    <BoutonConfirmation
                      variant="outline"
                      size="sm"
                      libelle={<><FileDownIcon /> Générer les PDF manquants ({moisOuvert.nombre - moisOuvert.pdfs})</>}
                      titre={`Générer ${moisOuvert.nombre - moisOuvert.pdfs} PDF pour ${libellePeriode(moisOuvert.periode)} ?`}
                      consequence={`Chaque bulletin figé sans PDF sera rendu (lettre + bulletin) et archivé dans le stockage. Les ${moisOuvert.pdfs} PDF déjà présents ne sont pas refaits. Aucun envoi n'est déclenché.`}
                      confirmer="Générer"
                      onConfirmer={() => archiver({ periode: moisOuvert.periode })}
                      succes={(r: any) => `${libellePeriode(moisOuvert.periode)} : ${r.generes} PDF généré(s), ${r.dejaPresents} déjà archivé(s) (${Math.round(r.octets / 1024)} Ko)`}
                    />
                  )}
                </div>
              ) : null}
            </div>
            <div className="border-b border-filet px-4 py-2">
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-encre-pale" aria-hidden="true" />
                <Input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Employé, matricule, société…" aria-label="Rechercher un bulletin" className="h-8 pl-8" />
              </div>
            </div>
            <div className="max-h-[32rem] overflow-y-auto">
              {detail === undefined ? (
                <div className="p-4"><SqueletteTableau colonnes={3} lignes={5} /></div>
              ) : (
                <table className="w-full text-xs">
                  <tbody>
                    {bulletins.map((b) => (
                      <tr key={String(b.bulletinId)} className="border-b border-filet-clair last:border-0 hover:bg-sceau-clair/60">
                        <td className="px-4 py-2 leading-tight">
                          <div className="whitespace-nowrap text-[13px] font-semibold">{b.nom}</div>
                          <div className="whitespace-nowrap text-2xs text-encre-pale">{b.matricule} · {b.societe}</div>
                        </td>
                        <td className="px-2 py-2 text-right font-mono tabular-nums font-semibold whitespace-nowrap">{num(b.net)}</td>
                        <td className="px-2 py-2 whitespace-nowrap">
                          {b.statut === "envoye"
                            ? <Flag variant="renseigne" size="xs" title={fmtDateHeure(b.envoyeLe)}>envoyé {fmtDate(b.envoyeLe)}</Flag>
                            : <Flag variant="neutre" size="xs" title="Figé à la clôture, jamais envoyé par e-mail">figé</Flag>}
                        </td>
                        <td className="px-2 py-2 text-right whitespace-nowrap">
                          <span className="inline-flex items-center gap-0.5">
                            <Button variant="ghost" size="icon-sm" aria-label={`Aperçu du bulletin — ${b.nom}`} title="Aperçu du bulletin figé" onClick={() => setApercuDe(String(b.employeId))}><EyeIcon /></Button>
                            {b.pdfUrl
                              ? <Button variant="ghost" size="icon-sm" asChild aria-label={`Télécharger le PDF — ${b.nom}`} title="Télécharger le PDF archivé"><a href={b.pdfUrl} target="_blank" rel="noreferrer"><DownloadIcon /></a></Button>
                              : <span className="inline-flex h-7 w-7 items-center justify-center text-encre-pale/50" title="PDF non généré"><DownloadIcon className="h-3.5 w-3.5" /></span>}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {bulletins.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-xs text-encre-pale">{q ? "Aucun bulletin ne correspond." : "Aucun bulletin figé."}</td></tr>}
                  </tbody>
                </table>
              )}
            </div>
            {moisOuvert ? (
              <div className="flex items-center justify-between border-t border-filet px-4 py-2 text-2xs text-encre-pale">
                <span>{bulletins.length}{q ? ` / ${detail?.length ?? 0}` : ""} bulletin(s) · net <span className="font-mono tabular-nums text-encre">{num(bulletins.reduce((s, b) => s + b.net, 0))}</span></span>
                <span>{moisOuvert.pdfs} / {moisOuvert.nombre} PDF</span>
              </div>
            ) : null}
          </aside>
        </div>
      )}

      {/* Aperçu d'un bulletin figé */}
      <Dialog open={apercuDe !== null} onOpenChange={(o) => { if (!o) setApercuDe(null); }}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{apercu ? `Bulletin figé — ${apercu.nom} · ${libellePeriode(ouvert ?? "")}` : "Bulletin figé"}</DialogTitle>
            <DialogDescription>Tel qu'il a été arrêté à la clôture du mois ; il ne sera plus recalculé.</DialogDescription>
          </DialogHeader>
          {apercu ? <div className="mt-2"><BulletinCard b={apercu} entreprise={entreprise} /></div> : snapshots === undefined ? <div className="p-4"><SqueletteTableau colonnes={2} lignes={6} /></div> : <p className="flex items-center gap-2 p-4 text-sm text-encre-douce"><XIcon className="h-4 w-4" /> Bulletin introuvable dans les snapshots du mois.</p>}
        </DialogContent>
      </Dialog>
    </div>
  );
}

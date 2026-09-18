/**
 * Journal d'activité — refonte (charte poitiers-ui-ux-system).
 *
 * Qui a fait quoi, quand : connexions et membres, clôtures de paie et
 * financières, appels de l'API, contrôles et versions du barème, rapports
 * d'audit. Réservé au niveau 7 ; en lecture seule — un journal ne se corrige
 * pas, il se consulte.
 *
 * Lecture : une fenêtre de temps (24 h, 7 j, 30 j, tout), une famille
 * d'actions, une action précise, un auteur et une recherche libre (cible,
 * détail, IP) se cumulent. Tuiles = comptes sur la fenêtre. Le tableau défile
 * dans la page (lignes visibles au choix) ; cliquer un événement l'ouvre en
 * détail. Export CSV de ce qui est affiché, pour l'auditeur.
 */
import * as React from "react";
import { useQuery } from "convex/react";
import { useSearchParams } from "react-router-dom";
import { DownloadIcon, ScrollTextIcon, SearchIcon } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { ACTIONS_LIBELLES, FAMILLES, type FamilleJournal } from "../../convex/lib/journalFamilles";
import { cn } from "@/lib/utils";
import { PageEnTete } from "@/components/app/en-tete";
import { GrilleTuiles, Tuile } from "@/components/app/tuile";
import { SqueletteTableau } from "@/components/app/chargement";
import { EtatVide } from "@/components/app/etat-vide";
import { SelecteurLignes, useLignesVisibles } from "@/components/app/lignes-visibles";
import { Auteur, CodeHttp, FlagAction, LIBELLE_FAMILLE, familleDe, fmtDateHeure, relatif } from "@/components/app/journal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Flag } from "@/components/ui/flag";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// --- Vocabulaire ----------------------------------------------------------------

type Evenement = { _id: string; date: string; auteurNom?: string; action: string; actionLibelle: string; cible?: string; detail?: string; statut?: number; ip?: string };

const FENETRES = [
  { cle: "24h", libelle: "24 dernières heures", heures: 24 },
  { cle: "7j", libelle: "7 derniers jours", heures: 24 * 7 },
  { cle: "30j", libelle: "30 derniers jours", heures: 24 * 30 },
  { cle: "tout", libelle: "Tout (500 derniers)", heures: 0 },
] as const;
type Fenetre = typeof FENETRES[number]["cle"];
const TOUS = "__tous";

const sansAccents = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** CSV UTF-8 avec BOM (Excel fr) ; point-virgule ; guillemets doublés. */
function csvDe(rows: Evenement[]) {
  const cel = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lignes = [["Date", "Auteur", "Action", "Cible", "Détail", "Statut", "IP"].map(cel).join(";")];
  for (const r of rows) lignes.push([fmtDateHeure(r.date), r.auteurNom ?? "système / API", r.actionLibelle, r.cible, r.detail, r.statut, r.ip].map(cel).join(";"));
  return "\uFEFF" + lignes.join("\r\n");
}
function telecharger(nom: string, contenu: string) {
  const url = URL.createObjectURL(new Blob([contenu], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: nom });
  a.click();
  URL.revokeObjectURL(url);
}

// --- Page -------------------------------------------------------------------------

export function Journal() {
  // `?action=api_financial` (depuis la fiche API) pré-filtre le journal.
  const [params] = useSearchParams();
  const actionInitiale = params.get("action");
  const [fenetre, setFenetre] = React.useState<Fenetre>("30j");
  const [famille, setFamille] = React.useState<FamilleJournal | typeof TOUS>(actionInitiale ? familleDe(actionInitiale) : TOUS);
  const [action, setAction] = React.useState<string>(actionInitiale ?? TOUS);
  const [auteur, setAuteur] = React.useState<string>(TOUS);
  const [q, setQ] = React.useState("");
  const [ouvert, setOuvert] = React.useState<Evenement | null>(null);
  const lignesVisibles = useLignesVisibles("journal", 15);

  const heures = FENETRES.find((f) => f.cle === fenetre)!.heures;
  // Figée par fenêtre : recalculer Date.now() à chaque rendu changerait les arguments de la requête en boucle.
  const depuis = React.useMemo(() => (heures ? new Date(Date.now() - heures * 3600_000).toISOString() : undefined), [heures]);
  const rows = useQuery(api.journal.liste, { action: action === TOUS ? undefined : action, depuis, limite: 500 }) as Evenement[] | undefined;

  // Les actions proposées se limitent à la famille choisie ; changer de famille remet l'action à « toutes ».
  const actionsDeFamille = ACTIONS_LIBELLES.filter(([cle]) => famille === TOUS || familleDe(cle) === famille);
  const choisirFamille = (f: string) => { setFamille(f as FamilleJournal | typeof TOUS); setAction(TOUS); };

  const auteurs = React.useMemo(() => Array.from(new Set((rows ?? []).map((r) => r.auteurNom ?? ""))).sort((a, b) => a.localeCompare(b, "fr")), [rows]);
  const filtres = React.useMemo(() => {
    const qq = sansAccents(q.trim());
    return (rows ?? []).filter((r) =>
      (famille === TOUS || familleDe(r.action) === famille) &&
      (auteur === TOUS || (r.auteurNom ?? "") === auteur) &&
      (!qq || sansAccents([r.actionLibelle, r.cible, r.detail, r.ip, r.auteurNom].filter(Boolean).join(" ")).includes(qq)));
  }, [rows, famille, auteur, q]);

  // Tuiles : sur la fenêtre, avant les filtres de famille / auteur / recherche.
  const total = rows?.length ?? 0;
  const n = (pred: (r: Evenement) => boolean) => (rows ?? []).filter(pred).length;
  const api4xx5xx = n((r) => r.action === "api_financial" && (r.statut ?? 0) >= 400);
  const fenetreLibelle = FENETRES.find((f) => f.cle === fenetre)!.libelle.toLowerCase();

  return (
    <div className="space-y-4">
      <PageEnTete
        titre="Journal d'activité"
        description="Qui a fait quoi, quand : connexions et membres, clôtures de paie et financières, appels de l'API, contrôles et versions du barème, rapports d'audit. Le journal se consulte, il ne se modifie pas."
        statut={<Flag variant="verrou" size="sm" icon={<ScrollTextIcon className="h-3 w-3" />}>Lecture seule · niveau 7</Flag>}
        actions={
          <Button variant="outline" size="sm" disabled={!filtres.length} onClick={() => telecharger(`journal-${new Date().toISOString().slice(0, 10)}.csv`, csvDe(filtres))}>
            <DownloadIcon /> Exporter ({filtres.length})
          </Button>
        }
      />

      <GrilleTuiles>
        <Tuile libelle="Événements" valeur={rows ? total : undefined} note={`sur les ${fenetreLibelle}${total >= 500 ? " · plafond de 500 atteint" : ""}`} ton={total >= 500 ? "attente" : undefined} vedette />
        <Tuile libelle="Accès & membres" valeur={rows ? n((r) => familleDe(r.action) === "acces") : undefined} note="connexions, rôles, activations" />
        <Tuile libelle="Clôtures" valeur={rows ? n((r) => r.action === "cloture_paie" || r.action === "cloture_financier") : undefined} note="paie et grand livre" />
        <Tuile libelle="Appels API" valeur={rows ? n((r) => r.action === "api_financial") : undefined} note={api4xx5xx ? `dont ${api4xx5xx} refusé(s) ou en erreur` : "aucun refus ni erreur"} ton={api4xx5xx ? "alerte" : undefined} />
      </GrilleTuiles>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={fenetre} onValueChange={(v) => setFenetre(v as Fenetre)}>
          <SelectTrigger className="h-9 w-48" aria-label="Fenêtre de temps"><SelectValue /></SelectTrigger>
          <SelectContent>{FENETRES.map((f) => <SelectItem key={f.cle} value={f.cle}>{f.libelle}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={famille} onValueChange={choisirFamille}>
          <SelectTrigger className="h-9 w-44" aria-label="Famille d'actions"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={TOUS}>Toutes les familles</SelectItem>
            {FAMILLES.map(([cle, l]) => <SelectItem key={cle} value={cle}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={action} onValueChange={setAction}>
          <SelectTrigger className="h-9 w-64" aria-label="Action"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={TOUS}>Toutes les actions</SelectItem>
            {actionsDeFamille.map(([cle, l]) => <SelectItem key={cle} value={cle}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={auteur} onValueChange={setAuteur}>
          <SelectTrigger className="h-9 w-52" aria-label="Auteur"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={TOUS}>Tous les auteurs</SelectItem>
            {auteurs.map((a) => <SelectItem key={a || "__sys"} value={a}>{a || "système / API"}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative min-w-56 grow sm:max-w-xs">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-encre-pale" aria-hidden="true" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cible, détail, IP…" className="h-9 pl-8" aria-label="Rechercher dans le journal" />
        </div>
        <span className="ml-auto text-xs text-encre-douce">{rows ? `${filtres.length} événement(s)` : "…"}</span>
        <SelecteurLignes valeur={lignesVisibles.lignes} onChange={lignesVisibles.setLignes} />
      </div>

      {rows === undefined ? (
        <SqueletteTableau colonnes={7} lignes={8} />
      ) : filtres.length === 0 ? (
        <EtatVide icone={ScrollTextIcon} titre={total === 0 ? "Aucun événement sur cette fenêtre" : "Aucun événement ne correspond aux filtres"}>
          {total === 0 ? "Élargissez la fenêtre de temps : le journal garde tout, il n'a peut-être rien reçu récemment." : "Retirez un filtre ou la recherche."}
        </EtatVide>
      ) : (
        <Table classNameConteneur="rounded-xl" hauteurMax={lignesVisibles.hauteurMax(44, 40)}>
          <TableHeader>
            <TableRow>
              <TableHead className="w-40">Quand</TableHead>
              <TableHead>Auteur</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Cible</TableHead>
              <TableHead>Détail</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>IP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtres.map((r) => (
              <TableRow key={r._id} className="cursor-pointer" tabIndex={0} onClick={() => setOuvert(r)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOuvert(r); } }}>
                <TableCell className="whitespace-nowrap">
                  <div className="font-mono text-xs tabular-nums">{fmtDateHeure(r.date)}</div>
                  <div className="text-2xs text-encre-pale">{relatif(r.date)}</div>
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs"><Auteur nom={r.auteurNom} /></TableCell>
                <TableCell><FlagAction action={r.action} libelle={r.actionLibelle} /></TableCell>
                <TableCell className="max-w-[12rem] truncate text-xs" title={r.cible}>{r.cible ?? <span className="text-encre-pale">—</span>}</TableCell>
                <TableCell className="max-w-[24rem] truncate text-xs text-encre-douce" title={r.detail}>{r.detail ?? <span className="text-encre-pale">—</span>}</TableCell>
                <TableCell><CodeHttp code={r.statut} /></TableCell>
                <TableCell className="font-mono text-2xs text-encre-douce">{r.ip ?? <span className="text-encre-pale">—</span>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={!!ouvert} onOpenChange={(o) => { if (!o) setOuvert(null); }}>
        <DialogContent className="sm:max-w-lg">
          {ouvert && (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2">{ouvert.actionLibelle} <FlagAction action={ouvert.action} libelle={LIBELLE_FAMILLE[familleDe(ouvert.action)]} /></DialogTitle>
                <DialogDescription>{fmtDateHeure(ouvert.date)} · {relatif(ouvert.date)}</DialogDescription>
              </DialogHeader>
              <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2 text-xs">
                <Detail libelle="Auteur"><Auteur nom={ouvert.auteurNom} /></Detail>
                <Detail libelle="Cible">{ouvert.cible ?? "—"}</Detail>
                <Detail libelle="Détail" long>{ouvert.detail ?? "—"}</Detail>
                <Detail libelle="Statut HTTP"><CodeHttp code={ouvert.statut} /></Detail>
                <Detail libelle="Adresse IP"><span className="font-mono">{ouvert.ip ?? "—"}</span></Detail>
                <Detail libelle="Identifiant"><span className="font-mono text-2xs text-encre-pale">{ouvert._id}</span></Detail>
              </dl>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Detail({ libelle, long, children }: { libelle: string; long?: boolean; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-encre-pale">{libelle}</dt>
      <dd className={cn("min-w-0 break-words", long && "whitespace-pre-wrap")}>{children}</dd>
    </>
  );
}

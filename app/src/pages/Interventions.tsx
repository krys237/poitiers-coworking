/**
 * Interventions techniciens — refonte (charte poitiers-ui-ux-system).
 *
 * File de traitement : onglets de statut avec compteurs, priorité, recherche ;
 * tableau dense ; la ligne choisie s'ouvre dans un volet ancré à droite
 * (parcours de la demande, photos, chiffrage, validation, commentaires).
 * La création se fait dans un dialogue en trois étapes numérotées.
 *
 * Le RBAC ne bouge pas : validation, clôture et rejet restent réservés au
 * niveau 5+ côté serveur (`convex/interventions.ts`) ; l'interface ne fait
 * que le dire clairement.
 */
import * as React from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import {
  CameraIcon, CheckIcon, ChevronRightIcon, ClipboardListIcon, ImagePlusIcon, LockIcon, MapPinIcon, MessageSquareIcon,
  PlusIcon, SearchIcon, SendIcon, Trash2Icon, WrenchIcon, XIcon,
} from "lucide-react";
import { api } from "../../convex/_generated/api";
import { messageErreur, num } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMoi } from "@/components/app/acces";
import { PageEnTete } from "@/components/app/en-tete";
import { GrilleTuiles, Tuile } from "@/components/app/tuile";
import { Montant } from "@/components/app/montant";
import { BoutonConfirmation } from "@/components/app/bouton-action";
import { Champ, ChampNombre, GrilleFormulaire } from "@/components/app/champs";
import { SqueletteTableau } from "@/components/app/chargement";
import { EtatVide } from "@/components/app/etat-vide";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Flag, type FlagVariant } from "@/components/ui/flag";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableVide } from "@/components/ui/table";

// --- Vocabulaire ----------------------------------------------------------------

type Statut = "ouverte" | "en_cours" | "cloturee" | "rejetee";
type Priorite = "basse" | "moyenne" | "haute";

const STATUT: Record<Statut, { label: string; pluriel: string; variant: FlagVariant; aide: string }> = {
  ouverte: { label: "Ouverte", pluriel: "Ouvertes", variant: "a-renseigner", aide: "En attente de validation par la direction" },
  en_cours: { label: "En cours", pluriel: "En cours", variant: "direct", aide: "Validée, intervention en cours" },
  cloturee: { label: "Clôturée", pluriel: "Clôturées", variant: "renseigne", aide: "Intervention terminée" },
  rejetee: { label: "Rejetée", pluriel: "Rejetées", variant: "verrou", aide: "Refusée par la direction (motif dans le fil)" },
};
const ORDRE_STATUTS: Statut[] = ["ouverte", "en_cours", "cloturee", "rejetee"];

const PRIORITE: Record<Priorite, { label: string; variant: FlagVariant }> = {
  haute: { label: "Haute", variant: "om" },
  moyenne: { label: "Moyenne", variant: "momo" },
  basse: { label: "Basse", variant: "neutre" },
};
const ORDRE_PRIORITES: Priorite[] = ["haute", "moyenne", "basse"];

type Ligne = { produit: string; quantite: number; prixUnitaire: number };
const LIGNE_VIDE: Ligne = { produit: "", quantite: 1, prixUnitaire: 0 };

const fmtDate = (s?: string) => (s ? new Date(s.length === 10 ? s + "T00:00:00" : s).toLocaleDateString("fr-FR") : "—");
const fmtDateHeure = (s?: string) => (s ? new Date(s).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "—");
const aujourdHui = () => new Date().toISOString().slice(0, 10);
const sansAccents = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const totalLignes = (ls: Ligne[]) => ls.reduce((t, l) => t + Math.round(Number(l.quantite) * Number(l.prixUnitaire)), 0);

// --- Page -------------------------------------------------------------------------

export function Interventions() {
  const { moi: me, niveau } = useMoi();
  const peutArbitrer = niveau >= 5;

  const liste = useQuery(api.interventions.liste, {});
  const [statut, setStatut] = React.useState<Statut | "toutes">("toutes");
  const [priorite, setPriorite] = React.useState<Priorite | "">("");
  const [recherche, setRecherche] = React.useState("");
  const [lignesVisibles, setLignesVisibles] = React.useState<number>(10);
  const [sel, setSel] = React.useState<string | null>(null);
  const [ouvrirCreation, setOuvrirCreation] = React.useState(false);

  const toutes = (liste ?? []) as any[];
  const compte = (s: Statut) => toutes.filter((i) => i.statut === s).length;
  const q = sansAccents(recherche.trim());
  const visibles = toutes.filter(
    (i) =>
      (statut === "toutes" || i.statut === statut) &&
      (!priorite || i.priorite === priorite) &&
      (!q || sansAccents(`${i.reference} ${i.titre} ${i.lieu ?? ""} ${i.demandeur} ${i.service ?? ""}`).includes(q))
  );

  const il30j = new Date(Date.now() - 30 * 86400e3).toISOString().slice(0, 10);
  const engage = toutes.filter((i) => i.statut === "ouverte" || i.statut === "en_cours").reduce((t, i) => t + i.total, 0);
  const cloturees30 = toutes.filter((i) => i.statut === "cloturee" && i.dateDemande >= il30j).length;

  return (
    <div className="space-y-4">
      <PageEnTete
        titre="Interventions techniciens"
        description="Demandes de maintenance et de matériel : photos, chiffrage, validation par la direction, fil de commentaires."
        statut={<Flag variant="finance" size="xs">Maintenance</Flag>}
        actions={
          <Button size="sm" onClick={() => setOuvrirCreation(true)}>
            <PlusIcon /> Nouvelle intervention
          </Button>
        }
      />

      <GrilleTuiles>
        <Tuile libelle="À valider" valeur={liste === undefined ? undefined : compte("ouverte")} note={peutArbitrer ? "à arbitrer par vous (niveau 5+)" : "arbitrage par la direction"} />
        <Tuile libelle="En cours" valeur={liste === undefined ? undefined : compte("en_cours")} note="validées, intervention lancée" />
        <Tuile libelle="Clôturées · 30 jours" valeur={liste === undefined ? undefined : cloturees30} note={`${compte("cloturee")} au total`} />
        <Tuile libelle="Montant engagé" valeur={liste === undefined ? undefined : <Montant valeur={engage} zero="0" />} note="lignes chiffrées des demandes ouvertes et en cours" vedette />
      </GrilleTuiles>

      {/* Barre de file : onglets de statut, priorité, recherche, hauteur */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-filet bg-surface px-3 py-2 shadow-xs print:hidden">
        <div role="tablist" aria-label="Filtrer par statut" className="flex items-center gap-1 rounded-xl border border-filet bg-slate-100/80 p-1">
          {(["toutes", ...ORDRE_STATUTS] as const).map((s) => {
            const actif = statut === s;
            const n = s === "toutes" ? toutes.length : compte(s);
            return (
              <button
                key={s}
                role="tab"
                aria-selected={actif}
                onClick={() => setStatut(s)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                  actif ? "bg-ocean-profond text-white shadow-xs" : "text-encre-douce hover:bg-white hover:text-encre"
                )}
              >
                {s === "toutes" ? "Toutes" : STATUT[s].pluriel}
                <span className={cn("font-mono tabular-nums text-[10px]", actif ? "text-white/80" : "text-encre-pale")}>{n}</span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-1" role="group" aria-label="Filtrer par priorité">
          {ORDRE_PRIORITES.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={priorite === p}
              onClick={() => setPriorite(priorite === p ? "" : p)}
              className={cn("rounded-full transition-opacity", priorite && priorite !== p && "opacity-40")}
            >
              <Flag variant={PRIORITE[p].variant} size="sm" className={cn(priorite === p && "ring-2 ring-ocean-ceruleen/40")}>
                {PRIORITE[p].label}
              </Flag>
            </button>
          ))}
        </div>
        <span className="flex-1" />
        <div className="relative w-56">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-encre-pale" aria-hidden="true" />
          <Input
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Référence, titre, lieu…"
            aria-label="Rechercher une intervention"
            className="h-8 pl-8"
          />
        </div>
        <label className="flex items-center gap-2 text-xs text-encre-douce">
          Lignes
          <Select value={String(lignesVisibles)} onValueChange={(v) => setLignesVisibles(Number(v))}>
            <SelectTrigger size="sm" className="w-[5.5rem]" aria-label="Nombre de lignes visibles"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[5, 10, 20, 50].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
              <SelectItem value="0">Toutes</SelectItem>
            </SelectContent>
          </Select>
        </label>
      </div>

      <div className="flex flex-col gap-3.5 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          {liste === undefined ? (
            <SqueletteTableau colonnes={8} lignes={6} />
          ) : toutes.length === 0 ? (
            <EtatVide
              icone={WrenchIcon}
              titre="Aucune intervention enregistrée"
              action={<Button size="sm" onClick={() => setOuvrirCreation(true)}><PlusIcon /> Nouvelle intervention</Button>}
            >
              Déposez la première demande : titre, priorité, lieu, matériel chiffré et photos. La direction la validera ici même.
            </EtatVide>
          ) : (
            <Table classNameConteneur="rounded-xl" hauteurMax={lignesVisibles ? `${lignesVisibles * 49 + 42}px` : undefined}>
              <TableHeader>
                <TableRow>
                  <TableHead>Référence</TableHead>
                  <TableHead>Intervention</TableHead>
                  <TableHead>Priorité</TableHead>
                  <TableHead className={cn(sel && "hidden 2xl:table-cell")}>Demandeur</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead numerique className={cn(sel && "hidden 2xl:table-cell")}>Photos</TableHead>
                  <TableHead numerique>Chiffrage (FCFA)</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead aria-label="Ouvrir" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibles.map((i) => {
                  const id = String(i._id);
                  const active = sel === id;
                  return (
                    <TableRow
                      key={id}
                      active={active}
                      tabIndex={0}
                      aria-selected={active}
                      onClick={() => setSel(active ? null : id)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSel(active ? null : id); } }}
                      className={cn("cursor-pointer", active && "shadow-[inset_3px_0_0_var(--ocean-ceruleen)]")}
                    >
                      <TableCell className="whitespace-nowrap font-mono text-xs font-semibold text-ocean-profond">{i.reference}</TableCell>
                      <TableCell className="leading-tight">
                        <div className="text-[13px] font-semibold">{i.titre}</div>
                        <div className="flex items-center gap-1 whitespace-nowrap text-2xs text-encre-pale">
                          {i.lieu ? <><MapPinIcon className="h-3 w-3" />{i.lieu}</> : null}
                          {i.service ? <span>· {i.service}</span> : null}
                        </div>
                      </TableCell>
                      <TableCell><Flag variant={PRIORITE[i.priorite as Priorite].variant} size="xs">{PRIORITE[i.priorite as Priorite].label}</Flag></TableCell>
                      <TableCell className={cn("whitespace-nowrap text-xs", sel && "hidden 2xl:table-cell")}>{i.demandeur}</TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-xs tabular-nums">{fmtDate(i.dateDemande)}</TableCell>
                      <TableCell numerique className={cn("font-mono text-xs", sel && "hidden 2xl:table-cell")}>{i.nbPhotos ? i.nbPhotos : <span className="text-encre-pale">0</span>}</TableCell>
                      <TableCell numerique className="font-mono text-xs">{i.total ? num(i.total) : <span className="text-encre-pale">0</span>}</TableCell>
                      <TableCell><Flag variant={STATUT[i.statut as Statut].variant} size="xs">{STATUT[i.statut as Statut].label}</Flag></TableCell>
                      <TableCell className="text-ocean-profond"><ChevronRightIcon className={cn("h-4 w-4 transition-transform", active && "rotate-90")} /></TableCell>
                    </TableRow>
                  );
                })}
                {visibles.length === 0 && <TableVide colonnes={9}>Aucune intervention ne correspond aux filtres.</TableVide>}
              </TableBody>
            </Table>
          )}
        </div>

        {sel ? (
          <DetailIntervention id={sel} peutArbitrer={peutArbitrer} onFermer={() => setSel(null)} />
        ) : (
          <aside className="hidden w-[27.5rem] shrink-0 items-center justify-center rounded-xl border border-dashed border-filet bg-surface/60 p-6 text-center text-sm text-encre-douce lg:flex">
            Sélectionnez une intervention pour voir son parcours, ses photos et son chiffrage.
          </aside>
        )}
      </div>

      <NouvelleIntervention
        ouvert={ouvrirCreation}
        onFermer={() => setOuvrirCreation(false)}
        onCreee={(id) => { setOuvrirCreation(false); setStatut("toutes"); setSel(id); }}
        demandeurParDefaut={me?.nom ?? ""}
      />
    </div>
  );
}

// --- Volet de détail ------------------------------------------------------------

function Parcours({ statut, valideLe, validateur, dateDemande }: { statut: Statut; valideLe?: string; validateur?: string | null; dateDemande: string }) {
  const etapes = statut === "rejetee"
    ? [
        { label: "Demande déposée", sous: fmtDate(dateDemande), etat: "fait" as const },
        { label: "Rejetée", sous: validateur ? `${validateur} · ${fmtDateHeure(valideLe)}` : fmtDateHeure(valideLe), etat: "rejet" as const },
      ]
    : [
        { label: "Demande déposée", sous: fmtDate(dateDemande), etat: "fait" as const },
        { label: "Validée", sous: statut === "ouverte" ? "en attente" : validateur ? `${validateur} · ${fmtDateHeure(valideLe)}` : fmtDateHeure(valideLe), etat: statut === "ouverte" ? ("attente" as const) : ("fait" as const) },
        { label: "Clôturée", sous: statut === "cloturee" ? fmtDateHeure(valideLe) : "à venir", etat: statut === "cloturee" ? ("fait" as const) : ("attente" as const) },
      ];
  return (
    <ol className="flex items-start gap-2" aria-label="Parcours de la demande">
      {etapes.map((e, i) => (
        <li key={e.label} className="flex min-w-0 flex-1 items-start gap-2">
          <span
            className={cn(
              "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold",
              e.etat === "fait" && "border-ocean-profond bg-ocean-profond text-white",
              e.etat === "attente" && "border-filet bg-surface text-encre-pale",
              e.etat === "rejet" && "border-carmin bg-carmin text-white"
            )}
            aria-hidden="true"
          >
            {e.etat === "fait" ? <CheckIcon className="h-3 w-3" /> : e.etat === "rejet" ? <XIcon className="h-3 w-3" /> : i + 1}
          </span>
          <span className="min-w-0 leading-tight">
            <span className={cn("block text-xs font-semibold", e.etat === "attente" && "text-encre-douce")}>{e.label}</span>
            <span className="line-clamp-2 block text-2xs text-encre-pale">{e.sous}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

function DetailIntervention({ id, peutArbitrer, onFermer }: { id: string; peutArbitrer: boolean; onFermer: () => void }) {
  const detail = useQuery(api.interventions.detail, { interventionId: id as any });
  const changerStatut = useMutation(api.interventions.changerStatut);
  const commenter = useMutation(api.interventions.commenter);
  const genererUploadUrl = useMutation(api.interventions.genererUploadUrl);
  const ajouterPhoto = useMutation(api.interventions.ajouterPhoto);
  const [texte, setTexte] = React.useState("");
  const [motif, setMotif] = React.useState("");
  const [enCours, setEnCours] = React.useState(false);

  React.useEffect(() => { setTexte(""); setMotif(""); }, [id]);

  const transition = async (s: Statut, commentaire?: string) => {
    setEnCours(true);
    try {
      await changerStatut({ interventionId: id as any, statut: s, commentaire: commentaire?.trim() || undefined });
      toast.success(`Intervention ${STATUT[s].label.toLowerCase()}`, { description: detail?.reference });
      setMotif("");
    } catch (e) {
      toast.error("Changement de statut refusé", { description: messageErreur(e) });
    } finally { setEnCours(false); }
  };

  const publier = async () => {
    if (!texte.trim()) return;
    try { await commenter({ interventionId: id as any, texte }); setTexte(""); toast.success("Commentaire publié"); }
    catch (e) { toast.error("Commentaire refusé", { description: messageErreur(e) }); }
  };

  const ajouter = async (file: File) => {
    try {
      const url = await genererUploadUrl();
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
      const { storageId } = await res.json();
      await ajouterPhoto({ interventionId: id as any, storageId });
      toast.success("Photo ajoutée");
    } catch (e) { toast.error("Photo non ajoutée", { description: messageErreur(e) }); }
  };

  const conteneur = "flex w-full flex-col overflow-hidden rounded-xl border border-filet bg-surface lg:w-[27.5rem] lg:shrink-0";
  if (detail === undefined) return <aside className={cn(conteneur, "p-5")}><SqueletteTableau colonnes={2} lignes={5} /></aside>;
  if (detail === null) return <aside className={cn(conteneur, "p-5 text-sm text-encre-douce")}>Intervention introuvable.</aside>;

  const st = detail.statut as Statut;
  const ouverte = st === "ouverte" || st === "en_cours";
  const meta: [string, React.ReactNode][] = [
    ["Demandeur", detail.demandeur], ["Service", detail.service ?? "—"], ["Chef de service", detail.chefService ?? "—"],
    ["Lieu", detail.lieu ?? "—"], ["Méthode", detail.methode ?? "—"], ["Date de demande", fmtDate(detail.dateDemande)],
  ];

  return (
    <aside className={conteneur} aria-label={`Intervention ${detail.reference}`}>
      <div className="flex items-start justify-between gap-3 border-b border-filet px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-semibold text-ocean-profond">{detail.reference}</span>
            <Flag variant={STATUT[st].variant} size="xs">{STATUT[st].label}</Flag>
            <Flag variant={PRIORITE[detail.priorite as Priorite].variant} size="xs">Priorité {PRIORITE[detail.priorite as Priorite].label.toLowerCase()}</Flag>
          </div>
          <h2 className="mt-1 text-base font-semibold leading-tight">{detail.titre}</h2>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onFermer} aria-label="Fermer le détail"><XIcon /></Button>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
        <Parcours statut={st} valideLe={detail.valideLe} validateur={detail.validateur} dateDemande={detail.dateDemande} />

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          {meta.map(([k, v]) => (
            <div key={k} className="min-w-0"><dt className="text-2xs font-semibold uppercase tracking-wide text-encre-pale">{k}</dt><dd className="truncate">{v}</dd></div>
          ))}
        </dl>
        {detail.commentaireInitial && (
          <p className="rounded-lg border border-filet bg-papier px-3 py-2 text-xs text-encre-douce"><b className="text-encre">Contexte :</b> {detail.commentaireInitial}</p>
        )}

        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-2xs font-bold uppercase tracking-[0.08em] text-ocean-profond">
            <CameraIcon className="h-3.5 w-3.5" /> Photos <span className="font-mono text-encre-pale">{detail.photosUrls.length}</span>
          </h3>
          <div className="grid grid-cols-4 gap-2">
            {detail.photosUrls.map((u: string, i: number) => (
              <a key={i} href={u} target="_blank" rel="noreferrer" className="aspect-square overflow-hidden rounded-lg border border-filet bg-papier">
                <img src={u} alt={`Photo ${i + 1} — ${detail.titre}`} className="h-full w-full object-cover" loading="lazy" />
              </a>
            ))}
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-filet text-2xs text-encre-douce hover:border-ocean-ceruleen hover:text-ocean-profond">
              <ImagePlusIcon className="h-4 w-4" /> Ajouter
              <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void ajouter(f); e.target.value = ""; }} />
            </label>
          </div>
        </section>

        {detail.lignes.length > 0 && (
          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-2xs font-bold uppercase tracking-[0.08em] text-ocean-profond">
              <ClipboardListIcon className="h-3.5 w-3.5" /> Matériel & chiffrage
            </h3>
            <table className="w-full text-xs">
              <tbody>
                {detail.lignes.map((l: any, i: number) => (
                  <tr key={i} className="border-b border-filet-clair">
                    <td className="py-1.5 pr-2">{l.produit}</td>
                    <td className="py-1.5 pr-2 text-right font-mono tabular-nums text-encre-douce whitespace-nowrap">{l.quantite} × {num(l.prixUnitaire)}</td>
                    <td className="py-1.5 text-right font-mono tabular-nums font-semibold">{num(l.quantite * l.prixUnitaire)}</td>
                  </tr>
                ))}
                <tr className="border-t-4 border-double border-encre">
                  <td className="py-1.5 font-semibold" colSpan={2}>Total</td>
                  <td className="py-1.5 text-right font-mono tabular-nums font-semibold"><Montant valeur={detail.total} zero="0" /></td>
                </tr>
              </tbody>
            </table>
          </section>
        )}

        {ouverte && (
          <section className="rounded-lg border border-filet bg-papier p-3">
            <h3 className="mb-2 text-2xs font-bold uppercase tracking-[0.08em] text-ocean-profond">Décision de la direction</h3>
            {peutArbitrer ? (
              <div className="flex flex-col gap-2">
                <Input value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Commentaire joint à la décision (obligatoire pour un rejet)" aria-label="Commentaire de décision" className="h-8 text-xs" />
                <div className="flex flex-wrap gap-2">
                  {st === "ouverte" && (
                    <Button size="sm" disabled={enCours} onClick={() => transition("en_cours", motif)}><CheckIcon /> Valider — passer en cours</Button>
                  )}
                  {st === "en_cours" && (
                    <Button size="sm" disabled={enCours} onClick={() => transition("cloturee", motif)}><CheckIcon /> Clôturer</Button>
                  )}
                  <BoutonConfirmation
                    variant="outline"
                    size="sm"
                    disabled={enCours || !motif.trim()}
                    libelle="Rejeter"
                    titre={`Rejeter ${detail.reference} ?`}
                    consequence={<>La demande passera en « Rejetée », état définitif. Motif transmis au demandeur : <i>« {motif.trim()} »</i>.</>}
                    confirmer="Rejeter la demande"
                    onConfirmer={() => transition("rejetee", motif)}
                  />
                  {!motif.trim() && <span className="self-center text-2xs text-encre-pale">Un motif est requis pour rejeter.</span>}
                </div>
              </div>
            ) : (
              <p className="flex items-center gap-2 text-xs text-encre-douce"><LockIcon className="h-3.5 w-3.5" /> Validation, clôture et rejet réservés à la direction (niveau 5 et plus).</p>
            )}
          </section>
        )}

        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-2xs font-bold uppercase tracking-[0.08em] text-ocean-profond">
            <MessageSquareIcon className="h-3.5 w-3.5" /> Fil de commentaires <span className="font-mono text-encre-pale">{detail.commentaires.length}</span>
          </h3>
          {detail.commentaires.length === 0 ? (
            <p className="text-xs text-encre-pale">Aucun commentaire pour le moment.</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {detail.commentaires.map((c: any, i: number) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ocean-brume text-[10px] font-bold text-ocean-profond" aria-hidden="true">{c.auteur.charAt(0).toUpperCase()}</span>
                  <div className="min-w-0 flex-1 rounded-lg border border-filet px-3 py-2">
                    <div className="flex items-baseline justify-between gap-2 text-2xs"><b className="text-encre">{c.auteur}</b><span className="text-encre-pale">{fmtDateHeure(c.date)}</span></div>
                    <p className="mt-0.5 whitespace-pre-line text-xs">{c.texte}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
          <div className="mt-2 flex items-end gap-2">
            <Textarea
              value={texte}
              onChange={(e) => setTexte(e.target.value)}
              onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") void publier(); }}
              placeholder="Ajouter un commentaire… (Ctrl + Entrée pour publier)"
              aria-label="Nouveau commentaire"
              rows={2}
              className="min-h-0 text-xs"
            />
            <Button size="icon-sm" onClick={publier} disabled={!texte.trim()} aria-label="Publier le commentaire"><SendIcon /></Button>
          </div>
        </section>
      </div>
    </aside>
  );
}

// --- Création -------------------------------------------------------------------

function NouvelleIntervention({
  ouvert, onFermer, onCreee, demandeurParDefaut,
}: { ouvert: boolean; onFermer: () => void; onCreee: (id: string) => void; demandeurParDefaut: string }) {
  const creer = useMutation(api.interventions.creer);
  const genererUploadUrl = useMutation(api.interventions.genererUploadUrl);
  const vierge = () => ({ titre: "", priorite: "moyenne" as Priorite, lieu: "", service: "", chefService: "", methode: "", dateDemande: aujourdHui(), demandeur: demandeurParDefaut, commentaireInitial: "" });
  const [f, setF] = React.useState(vierge);
  const [lignes, setLignes] = React.useState<Ligne[]>([{ ...LIGNE_VIDE }]);
  const [fichiers, setFichiers] = React.useState<File[]>([]);
  const [envoi, setEnvoi] = React.useState(false);
  const apercus = React.useMemo(() => fichiers.map((x) => ({ nom: x.name, url: x.type.startsWith("image/") ? URL.createObjectURL(x) : null })), [fichiers]);
  React.useEffect(() => () => apercus.forEach((a) => a.url && URL.revokeObjectURL(a.url)), [apercus]);
  React.useEffect(() => { if (ouvert) { setF(vierge()); setLignes([{ ...LIGNE_VIDE }]); setFichiers([]); } }, [ouvert]); // eslint-disable-line react-hooks/exhaustive-deps

  const majLigne = (i: number, patch: Partial<Ligne>) => setLignes((ls) => ls.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const lignesValides = lignes.filter((l) => l.produit.trim() && l.quantite > 0);

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.titre.trim()) { toast.error("Le titre est requis."); return; }
    setEnvoi(true);
    try {
      const photos: string[] = [];
      for (const file of fichiers) {
        const url = await genererUploadUrl();
        const res = await fetch(url, { method: "POST", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
        photos.push((await res.json()).storageId);
      }
      const r = await creer({
        ...f, lieu: f.lieu || undefined, service: f.service || undefined, chefService: f.chefService || undefined, methode: f.methode || undefined,
        demandeur: f.demandeur || demandeurParDefaut, commentaireInitial: f.commentaireInitial || undefined, photos: photos as any,
        lignes: lignesValides.map((l) => ({ produit: l.produit.trim(), quantite: Number(l.quantite), prixUnitaire: Number(l.prixUnitaire) })),
      });
      toast.success(`Intervention ${r.reference} déposée`, { description: `${photos.length} photo(s) · en attente de validation` });
      onCreee(String(r.id));
    } catch (err) {
      toast.error("La demande n'a pas été déposée", { description: messageErreur(err) });
    } finally { setEnvoi(false); }
  };

  const etape = (n: number, titre: string, aide: string) => (
    <div className="mb-2 flex items-baseline gap-2">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-ocean-profond text-[10px] font-bold text-white" aria-hidden="true">{n}</span>
      <span className="text-sm font-semibold">Étape {n} : {titre}</span>
      <span className="text-2xs text-encre-pale">{aide}</span>
    </div>
  );
  const texte = (cle: keyof ReturnType<typeof vierge>, libelle: string, placeholder?: string, requis?: boolean) => (
    <Champ libelle={libelle} requis={requis}>
      {(attrs) => <Input {...attrs} value={f[cle] as string} onChange={(e) => setF({ ...f, [cle]: e.target.value })} placeholder={placeholder} required={requis} />}
    </Champ>
  );

  return (
    <Dialog open={ouvert} onOpenChange={(o) => { if (!o) onFermer(); }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <form onSubmit={soumettre}>
          <DialogHeader>
            <DialogTitle>Nouvelle intervention</DialogTitle>
            <DialogDescription>Trois étapes : la demande, le matériel chiffré, les photos. La référence INT-AAAA-NNN est attribuée au dépôt.</DialogDescription>
          </DialogHeader>

          <div className="mt-4 flex flex-col gap-5">
            <section>
              {etape(1, "La demande", "qui demande quoi, où, avec quelle urgence")}
              <GrilleFormulaire className="mb-0">
                <div className="[grid-column:1/-1] sm:[grid-column:span_2]">{texte("titre", "Titre", "Ex : Remplacement onduleur salle serveurs", true)}</div>
                <Champ libelle="Priorité">
                  {(attrs) => (
                    <Select value={f.priorite} onValueChange={(v) => setF({ ...f, priorite: v as Priorite })}>
                      <SelectTrigger id={attrs.id} aria-label="Priorité"><SelectValue /></SelectTrigger>
                      <SelectContent>{ORDRE_PRIORITES.map((p) => <SelectItem key={p} value={p}>{PRIORITE[p].label}</SelectItem>)}</SelectContent>
                    </Select>
                  )}
                </Champ>
                <Champ libelle="Date de demande" requis>
                  {(attrs) => <Input {...attrs} type="date" value={f.dateDemande} onChange={(e) => setF({ ...f, dateDemande: e.target.value })} required />}
                </Champ>
                {texte("demandeur", "Demandeur", demandeurParDefaut)}
                {texte("service", "Service", "Maintenance, Labo…")}
                {texte("chefService", "Chef de service")}
                {texte("lieu", "Lieu", "Salle serveurs, bloc C…")}
                {texte("methode", "Méthode de demande", "E-mail, téléphone, en personne…")}
                <div className="[grid-column:1/-1]">
                  <Champ libelle="Contexte" aide="Urgence, symptômes, contraintes d'accès…">
                    {(attrs) => <Textarea {...attrs} rows={2} value={f.commentaireInitial} onChange={(e) => setF({ ...f, commentaireInitial: e.target.value })} />}
                  </Champ>
                </div>
              </GrilleFormulaire>
            </section>

            <section>
              {etape(2, "Matériel & chiffrage", "facultatif — montants en FCFA entiers")}
              <div className="overflow-hidden rounded-lg border border-filet">
                <table className="w-full text-xs">
                  <thead className="bg-bande text-2xs uppercase tracking-wide text-encre-douce">
                    <tr><th className="px-2 py-1.5 text-left">Produit / matériel</th><th className="w-24 px-2 py-1.5 text-right">Quantité</th><th className="w-32 px-2 py-1.5 text-right">Prix unitaire</th><th className="w-28 px-2 py-1.5 text-right">Total</th><th className="w-9" /></tr>
                  </thead>
                  <tbody>
                    {lignes.map((l, i) => (
                      <tr key={i} className="border-t border-filet-clair">
                        <td className="px-2 py-1"><Input value={l.produit} onChange={(e) => majLigne(i, { produit: e.target.value })} placeholder="Nom du produit" aria-label={`Produit, ligne ${i + 1}`} className="h-8" /></td>
                        <td className="px-2 py-1"><ChampNombre libelle={<span className="sr-only">Quantité, ligne {i + 1}</span>} valeur={l.quantite} onChange={(n) => majLigne(i, { quantite: n })} min={0} step={1} className="h-8" /></td>
                        <td className="px-2 py-1"><ChampNombre libelle={<span className="sr-only">Prix unitaire, ligne {i + 1}</span>} unite="FCFA" valeur={l.prixUnitaire} onChange={(n) => majLigne(i, { prixUnitaire: n })} min={0} step={1000} className="h-8" /></td>
                        <td className="px-2 py-1 text-right font-mono tabular-nums">{l.quantite * l.prixUnitaire ? num(l.quantite * l.prixUnitaire) : <span className="text-encre-pale">0</span>}</td>
                        <td className="px-1 py-1 text-center">
                          <Button type="button" variant="ghost" size="icon-sm" aria-label={`Retirer la ligne ${i + 1}`} onClick={() => setLignes((ls) => (ls.length > 1 ? ls.filter((_, j) => j !== i) : [{ ...LIGNE_VIDE }]))}><Trash2Icon /></Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-4 border-double border-encre bg-surface">
                      <td className="px-2 py-1.5" colSpan={3}>
                        <Button type="button" variant="outline" size="sm" onClick={() => setLignes((ls) => [...ls, { ...LIGNE_VIDE }])}><PlusIcon /> Ajouter une ligne</Button>
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono tabular-nums font-semibold"><Montant valeur={totalLignes(lignes)} zero="0" /></td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>

            <section>
              {etape(3, "Photos & pièces jointes", "images ou PDF, plusieurs fichiers possibles")}
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {apercus.map((a, i) => (
                  <div key={i} className="group relative aspect-square overflow-hidden rounded-lg border border-filet bg-papier">
                    {a.url ? <img src={a.url} alt={a.nom} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center p-1 text-center text-2xs text-encre-douce">{a.nom}</div>}
                    <button type="button" aria-label={`Retirer ${a.nom}`} onClick={() => setFichiers((fs) => fs.filter((_, j) => j !== i))} className="absolute right-1 top-1 rounded-full bg-white/90 p-0.5 text-encre shadow-xs opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"><XIcon className="h-3 w-3" /></button>
                  </div>
                ))}
                <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-filet text-2xs text-encre-douce hover:border-ocean-ceruleen hover:text-ocean-profond">
                  <ImagePlusIcon className="h-5 w-5" /> Ajouter
                  <input type="file" accept="image/*,.pdf" multiple hidden onChange={(e) => { setFichiers((fs) => [...fs, ...Array.from(e.target.files ?? [])]); e.target.value = ""; }} />
                </label>
              </div>
            </section>
          </div>

          <DialogFooter className="mt-5">
            <Button type="button" variant="outline" onClick={onFermer} disabled={envoi}>Annuler</Button>
            <Button type="submit" disabled={envoi || !f.titre.trim()}>
              {envoi ? "Dépôt en cours…" : <><SendIcon /> Déposer la demande</>}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

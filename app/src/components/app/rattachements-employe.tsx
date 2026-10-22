/**
 * Rattachements multi-société d'un employé (lot R2 bis).
 *
 * Décision du propriétaire du 20/10/2026 : « SESAME déclare de son côté. » SESAME, SOFINA et SGC
 * sont trois employeurs juridiquement distincts ; un employé peut relever de deux ou trois d'entre
 * elles. Chacune verse sa propre part, édite son propre bulletin et dépose son propre DIPE.
 *
 * Patron de saisie (skill §7) : ce n'est PAS une modale de plus. Le besoin réel est « déclarer
 * qu'un salarié relève d'une deuxième société et saisir sa paie chez elle » — deux ou trois lignes
 * courtes, en série, dans le contexte de la fiche. D'où le panneau DÉPLIABLE sur la ligne de
 * l'employé, avec une ligne de saisie permanente en tête, comme le registre des primes : on entre,
 * Entrée valide, la ligne apparaît, le focus revient au premier champ.
 *
 * Les montants suivent le formalisme de la charte : `font-mono tabular-nums`, séparateur de
 * milliers en espace insécable, « — » pour un non-applicable, aucune décimale sur un FCFA.
 */
import * as React from "react";
import { toast } from "sonner";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { messageErreur, num } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Flag } from "@/components/ui/flag";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CelluleNombre } from "@/components/app/champs";
import { BoutonConfirmation } from "@/components/app/bouton-action";
import { SOCIETES, type Societe } from "@/components/app/fiche-employe";

/** Forme résolue rendue par `employes.rattachements` (voir `convex/lib/societes.ts`). */
export type RattachementVu = {
  rattachementId?: string;
  societe: Societe;
  salaireBase: number;
  joursBase: number;
  matriculeEmployeur?: string;
  cnpsEmployeur?: string;
  dateDebut?: string;
  dateFin?: string;
  principal: boolean;
  origine: "fiche" | "table";
};

export type ActionsRattachement = {
  ajouter: (a: { employeId: any; societe: Societe; salaireBase?: number; matriculeEmployeur?: string; cnpsEmployeur?: string; dateDebut?: string }) => Promise<unknown>;
  modifier: (a: { rattachementId: any; salaireBase?: number; matriculeEmployeur?: string; cnpsEmployeur?: string; dateDebut?: string; dateFin?: string; actif?: boolean }) => Promise<unknown>;
  supprimer: (a: { rattachementId: any }) => Promise<unknown>;
  /** Le rattachement de la société PORTEUSE se modifie sur la fiche : les deux sont la même chose. */
  modifierFiche: (a: { employeId: any; salaireBase?: number }) => Promise<unknown>;
};

/** Pastille société, capsule douce sans point de couleur (charte §4). */
export function PastilleSociete({ societe, vedette }: { societe: string; vedette?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide",
        vedette ? "border-ocean-ceruleen/40 bg-ocean-profond text-white" : "border-filet bg-bande text-encre-douce",
      )}
    >
      {societe}
    </span>
  );
}

/** Résumé d'une ligne de tableau : les sociétés qui rémunèrent ce salarié. */
export function ResumeSocietes({ rattachements }: { rattachements: RattachementVu[] | undefined }) {
  if (!rattachements?.length) return <span className="text-encre-pale">—</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {rattachements.map((r) => <PastilleSociete key={r.societe} societe={r.societe} vedette={r.principal} />)}
    </span>
  );
}

export function PanneauRattachements({
  employeId, nom, matricule, rattachements, actions, lectureSeule,
}: {
  employeId: string;
  nom: string;
  matricule: string;
  rattachements: RattachementVu[];
  actions: ActionsRattachement;
  lectureSeule?: boolean;
}) {
  const prises = new Set(rattachements.map((r) => r.societe));
  const libres = SOCIETES.filter((s) => !prises.has(s));
  const pluri = rattachements.length > 1;

  return (
    <div className="space-y-2 rounded-xl border border-filet bg-bande/40 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-xs font-bold uppercase tracking-wide text-encre-douce">Sociétés qui rémunèrent {nom}</h4>
        <p className="max-w-[46rem] text-2xs leading-relaxed text-encre-pale">
          Chaque société est un employeur distinct : elle verse sa part, édite son bulletin et dépose son DIPE de son côté.
          {pluri ? " Le plafond CNPS et les tranches d'impôt s'appliquent donc par société, sans cumul — c'est voulu." : ""}
        </p>
      </div>

      <table className="w-full border-separate border-spacing-0 text-xs">
        <thead>
          <tr className="text-left text-2xs uppercase tracking-wide text-encre-pale">
            <th className="pb-1 pr-3 font-semibold">Société</th>
            <th className="pb-1 pr-3 text-right font-semibold">Salaire de base (FCFA)</th>
            <th className="pb-1 pr-3 font-semibold">Matricule chez elle</th>
            <th className="pb-1 pr-3 font-semibold">N° CNPS chez elle</th>
            <th className="pb-1 pr-3 font-semibold">Entrée</th>
            <th className="pb-1 font-semibold" aria-label="Retirer" />
          </tr>
        </thead>
        <tbody>
          {rattachements.map((r) => (
            <LigneRattachement
              key={r.societe}
              employeId={employeId}
              matriculeFiche={matricule}
              r={r}
              actions={actions}
              lectureSeule={lectureSeule}
            />
          ))}
          {!lectureSeule && libres.length > 0 && (
            <LigneAjout employeId={employeId} nom={nom} libres={libres} ajouter={actions.ajouter} />
          )}
        </tbody>
      </table>

      {libres.length === 0 && !lectureSeule ? (
        <p className="text-2xs text-encre-pale">Les trois sociétés sont rattachées : il n'y en a pas d'autre à ajouter.</p>
      ) : null}
    </div>
  );
}

// --- Une ligne existante : modification EN PLACE, jamais dans un dialogue ---------

function LigneRattachement({
  employeId, matriculeFiche, r, actions, lectureSeule,
}: {
  employeId: string;
  matriculeFiche: string;
  r: RattachementVu;
  actions: ActionsRattachement;
  lectureSeule?: boolean;
}) {
  const [salaire, setSalaire] = React.useState(r.salaireBase);
  React.useEffect(() => setSalaire(r.salaireBase), [r.salaireBase]);

  // Le rattachement de la société porteuse EST la fiche : on écrit au même endroit, sinon les deux
  // montants divergeraient en silence.
  const enregistrer = async (patch: { salaireBase?: number; matriculeEmployeur?: string; cnpsEmployeur?: string; dateDebut?: string }) => {
    try {
      if (r.origine === "fiche" || !r.rattachementId) {
        if (patch.salaireBase === undefined) {
          toast.info("Ce détail se saisit dans la fiche de l'employé", { description: `${r.societe} est la société portée par la fiche.` });
          return;
        }
        await actions.modifierFiche({ employeId, salaireBase: patch.salaireBase });
      } else {
        await actions.modifier({ rattachementId: r.rattachementId, ...patch });
      }
      toast.success(`${r.societe} — enregistré`);
    } catch (e) {
      toast.error("Modification refusée", { description: messageErreur(e) });
      setSalaire(r.salaireBase);
    }
  };

  const cellule = "border-t border-filet py-1.5 pr-3 align-middle";

  return (
    <tr>
      <td className={cellule}>
        <span className="inline-flex items-center gap-1.5">
          <PastilleSociete societe={r.societe} vedette={r.principal} />
          {r.principal ? <span className="text-2xs text-encre-pale" title="Société portée par la fiche employé">fiche</span> : null}
        </span>
      </td>
      <td className={cn(cellule, "text-right")}>
        {lectureSeule ? (
          <span className="font-mono tabular-nums">{num(salaire)}</span>
        ) : (
          <CelluleNombre
            libelle={`Salaire de base chez ${r.societe}`}
            valeur={salaire}
            onChange={setSalaire}
            largeur={110}
            min={0}
            pas={5000}
            className={cn(salaire !== r.salaireBase && "border-ocre bg-ocre-clair/50")}
          />
        )}
        {!lectureSeule && salaire !== r.salaireBase ? (
          <Button size="sm" variant="outline" className="ml-1.5 h-7 text-2xs" onClick={() => void enregistrer({ salaireBase: Math.round(salaire) })}>
            Enregistrer
          </Button>
        ) : null}
      </td>
      <td className={cellule}>
        <ChampTexteLigne
          libelle={`Matricule chez ${r.societe}`}
          valeur={r.matriculeEmployeur ?? ""}
          placeholder={matriculeFiche}
          lectureSeule={lectureSeule || r.origine === "fiche"}
          onEnregistrer={(matriculeEmployeur) => enregistrer({ matriculeEmployeur })}
        />
      </td>
      <td className={cellule}>
        <ChampTexteLigne
          libelle={`N° CNPS chez ${r.societe}`}
          valeur={r.cnpsEmployeur ?? ""}
          placeholder="351-…"
          lectureSeule={lectureSeule || r.origine === "fiche"}
          onEnregistrer={(cnpsEmployeur) => enregistrer({ cnpsEmployeur })}
        />
      </td>
      <td className={cellule}>
        <ChampTexteLigne
          libelle={`Date d'entrée chez ${r.societe}`}
          valeur={r.dateDebut ?? ""}
          type="date"
          lectureSeule={lectureSeule || r.origine === "fiche"}
          onEnregistrer={(dateDebut) => enregistrer({ dateDebut })}
        />
      </td>
      <td className={cn(cellule, "text-right")}>
        {r.principal ? (
          <span className="text-2xs text-encre-pale" title="La société de la fiche se change dans la fiche de l'employé">—</span>
        ) : lectureSeule ? (
          <span className="text-encre-pale">—</span>
        ) : (
          <BoutonConfirmation
            variant="ghost"
            size="icon-sm"
            className="text-carmin hover:bg-carmin-clair hover:text-carmin"
            libelle={<Trash2Icon />}
            titre={`Retirer ${r.societe} ?`}
            consequence={`${r.societe} cessera d'éditer un bulletin et de déclarer ce salarié. Si elle lui a déjà versé un mois clôturé, le rattachement est seulement désactivé : l'historique de paie d'un employeur ne s'efface pas.`}
            confirmer="Retirer"
            onConfirmer={async () => { await actions.supprimer({ rattachementId: r.rattachementId }); }}
            succes={`${r.societe} retirée`}
          />
        )}
      </td>
    </tr>
  );
}

/** Champ texte d'une ligne : enregistre à la sortie du champ ou sur Entrée, jamais à la frappe. */
function ChampTexteLigne({
  libelle, valeur, placeholder, type = "text", lectureSeule, onEnregistrer,
}: {
  libelle: string;
  valeur: string;
  placeholder?: string;
  type?: string;
  lectureSeule?: boolean;
  onEnregistrer: (v: string) => void | Promise<void>;
}) {
  const [v, setV] = React.useState(valeur);
  React.useEffect(() => setV(valeur), [valeur]);
  if (lectureSeule) {
    return <span className={cn("text-xs", type === "date" ? "font-mono tabular-nums" : "")}>{valeur || <span className="text-encre-pale">—</span>}</span>;
  }
  return (
    <Input
      type={type}
      value={v}
      aria-label={libelle}
      title={libelle}
      placeholder={placeholder}
      className={cn("h-7 text-2xs", type === "date" ? "w-[8.5rem] px-1.5 font-mono tabular-nums" : "w-32")}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => { if (v !== valeur) void onEnregistrer(v); }}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); if (v !== valeur) void onEnregistrer(v); }
        if (e.key === "Escape") { e.preventDefault(); setV(valeur); }
      }}
    />
  );
}

// --- Ligne de saisie permanente (skill §7) ---------------------------------------

function LigneAjout({
  employeId, nom, libres, ajouter,
}: {
  employeId: string;
  nom: string;
  libres: Societe[];
  ajouter: ActionsRattachement["ajouter"];
}) {
  const vierge = React.useCallback(
    () => ({ societe: libres[0], salaireBase: 0, matriculeEmployeur: "", cnpsEmployeur: "", dateDebut: "" }),
    [libres],
  );
  const [l, setL] = React.useState(vierge);
  const [enCours, setEnCours] = React.useState(false);
  const premier = React.useRef<HTMLButtonElement>(null);
  // La société disponible change dès qu'un rattachement est créé : la ligne suit, sans écraser
  // une saisie en cours.
  React.useEffect(() => { setL((x) => (libres.includes(x.societe) ? x : { ...x, societe: libres[0] })); }, [libres]);

  const valider = async () => {
    if (!l.societe) return;
    setEnCours(true);
    try {
      await ajouter({
        employeId,
        societe: l.societe,
        salaireBase: l.salaireBase > 0 ? Math.round(l.salaireBase) : undefined,
        matriculeEmployeur: l.matriculeEmployeur.trim() || undefined,
        cnpsEmployeur: l.cnpsEmployeur.trim() || undefined,
        dateDebut: l.dateDebut || undefined,
      });
      toast.success(`${nom} est aussi rémunéré par ${l.societe}`, {
        description: "Elle éditera son propre bulletin et le reprendra dans son DIPE.",
      });
      setL(vierge());
      premier.current?.focus();
    } catch (e) {
      toast.error("Rattachement refusé", { description: messageErreur(e) });
    } finally { setEnCours(false); }
  };

  const k = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); void valider(); }
    if (e.key === "Escape") { e.preventDefault(); setL(vierge()); }
  };
  const cellule = "border-t border-filet bg-ocean-brume/40 py-1.5 pr-3 align-middle";

  return (
    <tr aria-label={`Rattacher ${nom} à une autre société`}>
      <td className={cellule}>
        <Select value={l.societe} onValueChange={(v) => setL({ ...l, societe: v as Societe })}>
          <SelectTrigger ref={premier} size="sm" className="h-7 w-24 text-2xs" aria-label="Société à rattacher"><SelectValue /></SelectTrigger>
          <SelectContent>{libres.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
      </td>
      <td className={cn(cellule, "text-right")}>
        <span onKeyDown={k}>
          <CelluleNombre libelle={`Salaire de base versé par ${l.societe}`} valeur={l.salaireBase} onChange={(n) => setL({ ...l, salaireBase: n })} largeur={110} min={0} pas={5000} />
        </span>
      </td>
      <td className={cellule}>
        <Input value={l.matriculeEmployeur} onChange={(e) => setL({ ...l, matriculeEmployeur: e.target.value })} onKeyDown={k} placeholder="matricule" aria-label={`Matricule chez ${l.societe}`} className="h-7 w-32 text-2xs" />
      </td>
      <td className={cellule}>
        <Input value={l.cnpsEmployeur} onChange={(e) => setL({ ...l, cnpsEmployeur: e.target.value })} onKeyDown={k} placeholder="n° CNPS" aria-label={`N° CNPS chez ${l.societe}`} className="h-7 w-32 text-2xs" />
      </td>
      <td className={cellule}>
        <Input type="date" value={l.dateDebut} onChange={(e) => setL({ ...l, dateDebut: e.target.value })} onKeyDown={k} aria-label={`Date d'entrée chez ${l.societe}`} className="h-7 w-[8.5rem] px-1.5 font-mono text-2xs tabular-nums" />
      </td>
      <td className={cn(cellule, "text-right")}>
        <Button size="icon-sm" onClick={() => void valider()} disabled={enCours} aria-label="Rattacher cette société" title="Rattacher (Entrée) · vider (Échap)"><PlusIcon /></Button>
      </td>
    </tr>
  );
}

/** Repère discret pour la liste : « 2 sociétés » quand il y en a plus d'une. */
export function BadgePluriEmploi({ nb }: { nb: number }) {
  if (nb <= 1) return null;
  return <Flag variant="direct" size="xs" title="Pluri-emploi : un bulletin et un DIPE par société">{nb} sociétés</Flag>;
}

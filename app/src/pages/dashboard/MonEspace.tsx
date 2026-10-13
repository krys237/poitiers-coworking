/**
 * « Mon espace » du tableau de bord — ce qui concerne le membre lui-même, selon ses modules
 * (retour terrain du 13/10/2026 : le tableau de bord d'un employé était presque vide).
 *
 * Quatre tuiles (comptes rendus, demandes d'intervention, documents partagés, dernier bulletin) puis
 * trois listes courtes. Chaque bloc suit le droit « Voir » du module d'où vient son chiffre : sans le
 * module, le bloc n'existe pas. Les requêtes sont déjà filtrées côté serveur au périmètre du membre
 * (interventions : ses demandes ; documents : ceux qu'il peut lire ; bulletins : les siens).
 */
import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { ClipboardCheckIcon, FileTextIcon, FolderOpenIcon, UserRoundIcon, WrenchIcon } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { fcfa, libellePeriode } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Tuile } from "@/components/app/tuile";
import { Statut } from "@/components/app/statut";
import { Flag, type FlagVariant } from "@/components/ui/flag";

type Droits = Record<string, { voir: boolean; faire: boolean }>;
type Historique = { _id: string; date: string; heure: string; horsFenetre: boolean; points: number; statut: string }[];

const fmtDate = (s?: string) => (s ? new Date(s.length === 10 ? s + "T00:00:00" : s).toLocaleDateString("fr-FR") : "—");
const INTERVENTION: Record<string, { label: string; variant: FlagVariant }> = {
  ouverte: { label: "Ouverte", variant: "a-renseigner" },
  en_cours: { label: "En cours", variant: "direct" },
  cloturee: { label: "Clôturée", variant: "renseigne" },
  rejetee: { label: "Rejetée", variant: "verrou" },
};

export function MonEspace({ droits, periode, cr }: {
  droits: Droits;
  periode: string;
  /** `comptesRendus.monEspace`, déjà chargé par le tableau de bord. */
  cr: { score: number; aujourdHui: unknown; historique: Historique } | undefined;
}) {
  const voit = (m: string) => !!droits[m]?.voir;
  const interventions = useQuery(api.interventions.liste, voit("/interventions") ? {} : "skip");
  const documents = useQuery(api.documents.liste, voit("/documents") ? {} : "skip");
  const bulletins = useQuery(api.mesBulletins.liste, voit("/mes-bulletins") ? {} : "skip");

  const il7j = new Date(Date.now() - 7 * 86400e3).toISOString();
  const docs = documents?.documents ?? [];
  const docsRecents = docs.filter((d) => d.deposeLe >= il7j).length;
  const demandes = (interventions ?? []) as { _id: string; reference: string; titre: string; dateDemande: string; statut: string }[];
  const enTraitement = demandes.filter((i) => i.statut === "ouverte" || i.statut === "en_cours").length;
  const crDuMois = cr?.historique.filter((c) => c.date.startsWith(periode)) ?? [];
  const dernierCr = cr?.historique[0];
  const dernierBulletin = bulletins?.bulletins[0];

  return (
    <section aria-labelledby="mon-espace" className="space-y-4">
      <div className="flex items-center gap-2 border-b border-filet pb-3">
        <UserRoundIcon className="h-4 w-4 text-ocean-profond" aria-hidden="true" />
        <h2 id="mon-espace" className="text-xs font-bold uppercase tracking-wider text-encre">Mon espace</h2>
        <span className="hidden text-2xs text-encre-pale sm:inline">· vos comptes rendus, vos demandes, les documents partagés, vos bulletins</span>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
        {voit("/comptes-rendus") && (
          <Tuile
            ton={cr?.aujourdHui ? "succes" : "attente"}
            libelle={`Comptes rendus · ${libellePeriode(periode)}`}
            valeur={cr ? String(crDuMois.length) : undefined}
            note={cr ? `${cr.score} point(s) de présence · dernier le ${dernierCr ? fmtDate(dernierCr.date) : "—"}` : undefined}
            lienVers="/comptes-rendus"
          />
        )}
        {voit("/interventions") && (
          <Tuile
            ton={enTraitement ? "info" : "neutre"}
            libelle="Mes demandes d'intervention"
            valeur={interventions === undefined ? undefined : String(enTraitement)}
            note={interventions === undefined ? undefined : `en traitement · ${demandes.filter((i) => i.statut === "cloturee").length} clôturée(s) · ${demandes.filter((i) => i.statut === "rejetee").length} rejetée(s)`}
            lienVers="/interventions"
          />
        )}
        {voit("/documents") && (
          <Tuile
            ton={docsRecents ? "info" : "neutre"}
            libelle="Documents partagés"
            valeur={documents === undefined ? undefined : String(docs.length)}
            note={documents === undefined ? undefined : docsRecents ? `${docsRecents} nouveau(x) ces 7 derniers jours` : "aucun nouveau dépôt cette semaine"}
            lienVers="/documents"
          />
        )}
        {voit("/mes-bulletins") && (
          <Tuile
            ton="neutre"
            compact={!dernierBulletin}
            libelle="Mon dernier bulletin"
            valeur={bulletins === undefined ? undefined : dernierBulletin ? fcfa(dernierBulletin.net) : bulletins.employe ? "Aucun mois clôturé" : "Compte non relié"}
            note={dernierBulletin ? `net à payer · ${libellePeriode(dernierBulletin.periode)} · brut ${fcfa(dernierBulletin.brut)}` : bulletins?.employe ? "Le bulletin apparaît à la clôture du mois" : "La Direction relie votre compte à votre fiche dans Membres"}
            lienVers="/mes-bulletins"
          />
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {voit("/interventions") && (
          <Liste icone={WrenchIcon} titre="Mes demandes" lien="/interventions" vide={interventions !== undefined && demandes.length === 0}
            texteVide={<>Aucune demande déposée. <Link to="/interventions" className="font-semibold text-ocean-profond hover:underline">Déposer une demande →</Link></>}>
            {demandes.slice(0, 4).map((i) => (
              <li key={i._id} className="flex items-center justify-between gap-2 py-1.5">
                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold text-encre">{i.titre}</div>
                  <div className="font-mono text-2xs text-encre-pale">{i.reference} · {fmtDate(i.dateDemande)}</div>
                </div>
                <Flag variant={INTERVENTION[i.statut]?.variant ?? "neutre"} size="xs">{INTERVENTION[i.statut]?.label ?? i.statut}</Flag>
              </li>
            ))}
          </Liste>
        )}
        {voit("/documents") && (
          <Liste icone={FolderOpenIcon} titre="Documents récents" lien="/documents" vide={documents !== undefined && docs.length === 0}
            texteVide="Aucun document ne vous est encore partagé.">
            {docs.slice(0, 4).map((d) => (
              <li key={String(d._id)} className="flex items-center justify-between gap-2 py-1.5">
                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold text-encre">{d.titre}</div>
                  <div className="truncate text-2xs text-encre-pale">{d.categorie} · {d.deposePar} · {fmtDate(d.deposeLe)}</div>
                </div>
                <FileTextIcon className="h-3.5 w-3.5 shrink-0 text-encre-pale" aria-hidden="true" />
              </li>
            ))}
          </Liste>
        )}
        {voit("/comptes-rendus") && (
          <Liste icone={ClipboardCheckIcon} titre="Mes comptes rendus" lien="/comptes-rendus" vide={cr !== undefined && cr.historique.length === 0}
            texteVide={<>Aucun compte rendu pour l'instant. <Link to="/comptes-rendus" className="font-semibold text-ocean-profond hover:underline">Rédiger celui du jour →</Link></>}>
            {(cr?.historique ?? []).slice(0, 4).map((c) => (
              <li key={c._id} className="flex items-center justify-between gap-2 py-1.5">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-encre">{fmtDate(c.date)} <span className="font-mono text-2xs font-normal text-encre-pale">à {c.heure}</span></div>
                  <div className="text-2xs text-encre-pale">{c.points} point(s){c.horsFenetre ? " · hors fenêtre" : ""}</div>
                </div>
                <Statut etat={c.statut === "valide" ? "validee" : c.horsFenetre ? "hors_fenetre" : "soumis"} />
              </li>
            ))}
          </Liste>
        )}
      </div>
    </section>
  );
}

function Liste({ icone: Icone, titre, lien, vide, texteVide, children }: {
  icone: React.ComponentType<{ className?: string }>; titre: string; lien: string; vide: boolean; texteVide: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-filet bg-surface p-4 shadow-sm">
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icone className="h-4 w-4 text-ocean-profond" />
          <h3 className="whitespace-nowrap text-xs font-bold text-encre">{titre}</h3>
        </div>
        <Link to={lien} className="whitespace-nowrap text-2xs font-semibold text-ocean-profond hover:underline">Tout voir →</Link>
      </div>
      {vide ? (
        <p className="py-3 text-xs text-encre-douce">{texteVide}</p>
      ) : (
        <ul className={cn("divide-y divide-filet-clair")}>{children}</ul>
      )}
    </div>
  );
}

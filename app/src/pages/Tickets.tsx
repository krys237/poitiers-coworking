// Tickets : dysfonctionnements et besoins remontés par les membres (demande N5).
//
// Ce que l'écran doit réussir : qu'un agent qui vient de se heurter à un problème le DISE, au
// lieu de renoncer. Donc trois choses — le formulaire est ouvert sans détour, il demande ce qui
// s'est passé plutôt qu'un code, et il accepte une capture d'écran.
//
// Et deux pistes séparées : le Directeur juge la PERTINENCE, le développeur la RÉALISATION. Un
// ticket peut être pertinent et pas encore traité ; les deux colonnes sont donc distinctes et
// jamais fondues en un seul statut.

import * as React from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { ImagePlusIcon, LifeBuoyIcon, SendIcon, XIcon } from "lucide-react";
import { api } from "../../convex/_generated/api";
import {
  MIN_DESCRIPTION, PIECES_MAX, TYPES_PIECE, controlerPiece, controlerTicket,
} from "../../convex/lib/tickets";
import { fmtDateHeure, relatif } from "@/components/app/journal";
import { messageErreur } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageEnTete } from "@/components/app/en-tete";
import { GrilleTuiles, Tuile } from "@/components/app/tuile";
import { SqueletteTexte } from "@/components/app/chargement";
import { BoutonAction } from "@/components/app/bouton-action";
import { Button } from "@/components/ui/button";
import { Flag } from "@/components/ui/flag";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Piece = { fichierId: string; nomFichier: string; typeMime: string; taille: number };

const VARIANTE_AVIS: Record<string, "renseigne" | "a-renseigner" | "verrou"> = {
  pertinent: "renseigne",
  en_attente: "a-renseigner",
  non_pertinent: "verrou",
};
const VARIANTE_ETAT: Record<string, "renseigne" | "a-renseigner" | "verrou"> = {
  nouveau: "a-renseigner",
  en_cours: "a-renseigner",
  resolu: "renseigne",
  abandonne: "verrou",
};

// Les libellés viennent du serveur, dont le type est plus strict que la ligne lue (`any`) :
// l'indexation passe donc par ces deux accès, plutôt que par un transtypage qui masquerait un
// état inconnu au lieu de l'afficher.
const libelleAvis = (m: Record<string, string>, cle: string) => m[cle] ?? cle;
const libelleEtat = (m: Record<string, string>, cle: string) => m[cle] ?? cle;

export function Tickets() {
  const vue = useQuery(api.tickets.liste, {});
  const ouvrir = useMutation(api.tickets.ouvrir);
  const urlDepot = useMutation(api.tickets.genererUploadUrl);
  const arbitrer = useMutation(api.tickets.arbitrer);
  const avancer = useMutation(api.tickets.avancer);

  const [titre, setTitre] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [nature, setNature] = React.useState("dysfonctionnement");
  const [ecran, setEcran] = React.useState("");
  const [pieces, setPieces] = React.useState<Piece[]>([]);
  const [depotEnCours, setDepotEnCours] = React.useState(false);
  const [enCours, setEnCours] = React.useState(false);

  // Les contrôles sont les MÊMES qu'au serveur (`lib/tickets`) : l'écran les applique pour
  // expliquer avant d'envoyer, le serveur pour garantir. Jamais deux jeux de règles.
  const erreurs = controlerTicket({ titre, description, nature, ecran });
  const reste = Math.max(0, MIN_DESCRIPTION - description.trim().length);

  const deposer = async (fichiers: FileList | null) => {
    if (!fichiers?.length) return;
    if (pieces.length + fichiers.length > PIECES_MAX) {
      toast.error("Trop de pièces", { description: `${PIECES_MAX} au maximum par ticket.` });
      return;
    }
    setDepotEnCours(true);
    try {
      const ajouts: Piece[] = [];
      for (const f of Array.from(fichiers)) {
        const refus = controlerPiece({ typeMime: f.type, taille: f.size });
        if (refus) { toast.error(f.name, { description: refus }); continue; }
        const url = await urlDepot({});
        const r = await fetch(url, { method: "POST", headers: { "Content-Type": f.type }, body: f });
        if (!r.ok) throw new Error(`Dépôt refusé pour ${f.name}.`);
        const { storageId } = (await r.json()) as { storageId: string };
        ajouts.push({ fichierId: storageId, nomFichier: f.name, typeMime: f.type, taille: f.size });
      }
      if (ajouts.length) setPieces((p) => [...p, ...ajouts]);
    } catch (e) {
      toast.error("Dépôt impossible", { description: messageErreur(e) });
    } finally { setDepotEnCours(false); }
  };

  const envoyer = async () => {
    setEnCours(true);
    try {
      await ouvrir({
        titre, description, nature: nature as never,
        ecran: ecran.trim() || undefined,
        ...(pieces.length ? { pieces: pieces as never } : {}),
      });
      toast.success("Ticket ouvert", {
        description: "Le Directeur et le développeur le voient dès maintenant.",
      });
      setTitre(""); setDescription(""); setEcran(""); setPieces([]);
    } catch (e) {
      toast.error("Ouverture refusée", { description: messageErreur(e) });
    } finally { setEnCours(false); }
  };

  const c = vue?.compteurs;

  return (
    <div className="space-y-4">
      <PageEnTete
        titre="Tickets"
        description={
          "Quelque chose ne marche pas, ou il vous manque quelque chose ? Dites-le ici. Le " +
          "Directeur juge si le besoin est à retenir, le développeur s'occupe de le faire. Vous " +
          "voyez l'avancement des deux côtés, et la raison en cas de refus."
        }
      />

      {vue === undefined ? (
        <SqueletteTexte lignes={8} />
      ) : (
        <>
          {vue.voitTout && c ? (
            <GrilleTuiles>
              <Tuile libelle="Ouverts" valeur={c.ouverts} note={`sur ${c.total} au total`} vedette compact />
              <Tuile libelle="À arbitrer" valeur={c.aArbitrer} note="en attente du Directeur" compact />
              <Tuile libelle="À traiter" valeur={c.aTraiter} note="côté développement" compact />
              <Tuile
                libelle="Nature"
                valeur={<span className="text-sm">{c.parNature.filter((n) => n.n).map((n) => `${n.n} ${n.nature}`).join(" · ") || "—"}</span>}
                compact
              />
            </GrilleTuiles>
          ) : null}

          {/* ---- Ouvrir un ticket ---- */}
          <section className="rounded-2xl border border-filet bg-surface p-3 shadow-xs">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold">
              <LifeBuoyIcon className="h-4 w-4 text-sceau" aria-hidden="true" />
              Ouvrir un ticket
            </h2>

            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <label className="grid gap-1 text-2xs sm:col-span-1">
                De quoi s'agit-il&nbsp;?
                <select
                  className="h-9 rounded-md border border-filet bg-surface px-2 text-sm"
                  value={nature}
                  onChange={(e) => setNature(e.target.value)}
                >
                  {vue.natures.map((n) => <option key={n.cle} value={n.cle}>{n.libelle}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-2xs sm:col-span-2">
                Titre
                <Input
                  value={titre} onChange={(e) => setTitre(e.target.value)}
                  placeholder="En deux mots, pour le retrouver" className="h-9"
                />
              </label>
              <label className="grid gap-1 text-2xs sm:col-span-3">
                Sur quel écran&nbsp;? <span className="text-encre-pale">facultatif, mais ça fait gagner du temps</span>
                <Input
                  value={ecran} onChange={(e) => setEcran(e.target.value)}
                  placeholder="Récapitulatif salaires, Planning annuel, Actes RH…" className="h-9"
                />
              </label>
            </div>

            <label className="mt-2 grid gap-1 text-2xs">
              Que s'est-il passé&nbsp;?
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                placeholder="Ce que vous faisiez, ce que vous attendiez, et ce qui s'est passé à la place. Si un message d'erreur est apparu, recopiez-le."
              />
              {/* Le minimum est dit AVANT le refus : un compteur qui descend vaut mieux qu'un
                  message d'erreur après coup. */}
              <span className={cn("text-2xs", reste ? "text-ocre" : "text-encre-pale")}>
                {reste
                  ? `Encore ${reste} caractère(s) — « ça ne marche pas » ne permet pas de reproduire le problème.`
                  : "Merci, c'est assez précis pour être repris."}
              </span>
            </label>

            {/* ---- Captures d'écran ---- */}
            <div className="mt-2">
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-filet bg-papier px-2.5 py-1.5 text-2xs hover:border-ocean-ciel">
                  <ImagePlusIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  {depotEnCours ? "Dépôt…" : "Ajouter une capture"}
                  <input
                    type="file" multiple hidden
                    accept={TYPES_PIECE.join(",")}
                    disabled={depotEnCours || pieces.length >= PIECES_MAX}
                    onChange={(e) => { void deposer(e.target.files); e.target.value = ""; }}
                  />
                </label>
                <span className="text-2xs text-encre-pale">
                  {pieces.length}/{PIECES_MAX} · captures, photos ou PDF, 10 Mo maximum
                </span>
              </div>
              {pieces.length ? (
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {pieces.map((p, i) => (
                    <li key={p.fichierId} className="flex items-center gap-1 rounded border border-filet bg-papier px-2 py-1 text-2xs">
                      <span className="max-w-48 truncate">{p.nomFichier}</span>
                      <button
                        type="button"
                        aria-label={`Retirer ${p.nomFichier}`}
                        className="text-encre-pale hover:text-carmin"
                        onClick={() => setPieces((x) => x.filter((_, j) => j !== i))}
                      >
                        <XIcon className="h-3 w-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            {erreurs.length && (titre || description) ? (
              <ul className="mt-2 space-y-0.5 text-2xs text-ocre">
                {erreurs.map((e) => <li key={e}>{e}</li>)}
              </ul>
            ) : null}

            <Button
              size="sm" className="mt-2"
              disabled={enCours || depotEnCours || erreurs.length > 0}
              onClick={() => void envoyer()}
            >
              <SendIcon /> {enCours ? "Envoi…" : "Envoyer au Directeur et au développeur"}
            </Button>
          </section>

          {/* ---- La liste ---- */}
          <section className="space-y-2">
            <h2 className="text-sm font-semibold">
              {vue.voitTout ? "Tous les tickets" : "Mes tickets"}
              <span className="ml-2 text-xs font-normal text-encre-pale">
                {vue.tickets.length ? "ce qui attend une action d'abord" : ""}
              </span>
            </h2>

            {!vue.tickets.length ? (
              <p className="rounded-xl border border-dashed border-filet bg-papier px-3 py-6 text-center text-xs text-encre-pale">
                Aucun ticket. C'est bon signe — ou bien personne n'ose encore.
              </p>
            ) : (
              vue.tickets.map((t: any) => (
                <article
                  key={String(t._id)}
                  className={cn(
                    "rounded-xl border bg-surface p-3 shadow-xs",
                    t.clos ? "border-filet opacity-75" : "border-filet",
                  )}
                >
                  <div className="flex flex-wrap items-baseline gap-2">
                    <h3 className="text-sm font-semibold">{t.titre}</h3>
                    <span className="text-2xs text-encre-pale">
                      {vue.libelles.nature[t.nature]} · {t.auteurNom} · {relatif(t.cree)}
                    </span>
                    <span className="ml-auto flex flex-wrap gap-1">
                      <Flag variant={VARIANTE_AVIS[t.avis]} size="xs">{libelleAvis(vue.libelles.avis, t.avis)}</Flag>
                      <Flag variant={VARIANTE_ETAT[t.etat]} size="xs">{libelleEtat(vue.libelles.etat, t.etat)}</Flag>
                    </span>
                  </div>

                  {t.ecran ? <p className="mt-0.5 text-2xs text-encre-pale">Écran : {t.ecran}</p> : null}
                  <p className="mt-1.5 whitespace-pre-wrap text-xs text-encre-douce">{t.description}</p>

                  {t.pieces?.length ? (
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {t.pieces.map((p: any) => (
                        <li key={p.fichierId}>
                          <a
                            href={p.url ?? "#"} target="_blank" rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded border border-filet bg-papier px-2 py-1 text-2xs underline-offset-2 hover:underline"
                          >
                            {p.nomFichier}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {/* Les décisions prises, et leur motif : un refus sans raison est inutilisable. */}
                  {t.avisMotif ? (
                    <p className="mt-2 rounded-lg border border-filet bg-papier px-2.5 py-1.5 text-2xs">
                      <strong>Avis de {t.avisPar}</strong> — {t.avisMotif}
                      <span className="block text-encre-pale">{fmtDateHeure(t.avisLe)}</span>
                    </p>
                  ) : null}
                  {t.etatNote ? (
                    <p className="mt-1.5 rounded-lg border border-filet bg-papier px-2.5 py-1.5 text-2xs">
                      <strong>{t.etatPar}</strong> — {t.etatNote}
                      <span className="block text-encre-pale">{fmtDateHeure(t.etatLe)}</span>
                    </p>
                  ) : null}

                  {/* ---- Les deux pistes de décision, côte à côte et distinctes ---- */}
                  {vue.peutArbitrer || vue.peutTraiter ? (
                    <div className="mt-2 flex flex-wrap gap-3 border-t border-filet-clair pt-2">
                      {vue.peutArbitrer ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-2xs font-semibold text-encre-pale">Pertinence :</span>
                          <BoutonAction
                            size="sm" variant="ghost"
                            onAction={() => arbitrer({ ticketId: t._id, avis: "pertinent" })}
                            succes="Jugé pertinent"
                          >
                            Retenir
                          </BoutonAction>
                          <BoutonAction
                            size="sm" variant="ghost"
                            onAction={() => {
                              const motif = window.prompt("Pourquoi ce ticket n'est-il pas retenu ?");
                              if (!motif) throw new Error("Refus abandonné : un motif est obligatoire.");
                              return arbitrer({ ticketId: t._id, avis: "non_pertinent", motif });
                            }}
                            succes="Refus enregistré — l'auteur en voit la raison"
                          >
                            Ne pas retenir
                          </BoutonAction>
                        </div>
                      ) : null}

                      {vue.peutTraiter ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-2xs font-semibold text-encre-pale">Traitement :</span>
                          <BoutonAction
                            size="sm" variant="ghost"
                            onAction={() => avancer({ ticketId: t._id, etat: "en_cours" })}
                            succes="Pris en charge"
                          >
                            En cours
                          </BoutonAction>
                          <BoutonAction
                            size="sm" variant="ghost"
                            onAction={() => {
                              const note = window.prompt("Ce qui a été fait (facultatif)") ?? undefined;
                              return avancer({ ticketId: t._id, etat: "resolu", note });
                            }}
                            succes="Marqué résolu"
                          >
                            Résolu
                          </BoutonAction>
                          <BoutonAction
                            size="sm" variant="ghost"
                            onAction={() => {
                              const note = window.prompt("Pourquoi abandonner ?");
                              if (!note) throw new Error("Abandon annulé : une explication est obligatoire.");
                              return avancer({ ticketId: t._id, etat: "abandonne", note });
                            }}
                            succes="Abandonné — l'auteur en voit la raison"
                          >
                            Abandonner
                          </BoutonAction>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              ))
            )}
          </section>
        </>
      )}
    </div>
  );
}

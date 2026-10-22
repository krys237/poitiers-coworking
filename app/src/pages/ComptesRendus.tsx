import { useEffect, useState, useMemo, Fragment } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { dureeLisible } from "../../convex/lib/fenetre";
import { messageErreur } from "../lib/format";
import { useMe } from "@/auth/useMe";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Flag, FlagVariant } from "@/components/ui/flag";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SelecteurLignes, useLignesVisibles } from "@/components/app/lignes-visibles";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  CheckCircle2,
  AlertTriangle,
  Users,
  Plus,
  ChevronUp,
  X,
  Send,
  History,
  RotateCcw,
  Check,
  AlertCircle,
  FileText,
  PencilIcon,
  MessageSquare,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const fmtDateHeure = (iso: string) => {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })} à ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
  } catch {
    return iso;
  }
};

const fmtDateLongue = (s: string) => {
  if (!s) return "";
  try {
    return new Date(s + "T00:00:00").toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return s;
  }
};

const fmtDateCourte = (s: string) => {
  if (!s) return "";
  try {
    return new Date(s + "T00:00:00").toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return s;
  }
};

const STATUT_INFO: Record<string, { label: string; variant: FlagVariant }> = {
  valide: { label: "Validé", variant: "especes" },
  en_relecture: { label: "En relecture", variant: "om" },
  brouillon: { label: "Brouillon", variant: "neutre" },
};

export function ComptesRendus() {
  const me = useMe();
  const espace = useQuery(api.comptesRendus.monEspace);
  const soumettre = useMutation(api.comptesRendus.soumettre);
  const modifierCompteRendu = useMutation(api.comptesRendus.modifier);
  const changerStatut = useMutation(api.comptesRendus.changerStatut);
  const ajouterCommentaire = useMutation(api.comptesRendus.ajouterCommentaire);

  const [contenu, setContenu] = useState("");
  const [date, setDate] = useState("");
  const [formOuvert, setFormOuvert] = useState(false);
  // Identifiant du compte rendu repris depuis l'historique : le même formulaire sert au dépôt d'un
  // jour vierge et à la correction d'une ligne existante, il faut savoir d'où l'on vient.
  const [editionId, setEditionId] = useState<string | null>(null);
  const [enEnvoi, setEnEnvoi] = useState(false);
  const [tick, setTick] = useState(Date.now());
  const [jourSup, setJourSup] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [vueOngletSuperviseur, setVueOngletSuperviseur] = useState<"tableau" | "feed">("tableau");
  // Aperçu et échange avec le collaborateur (superviseur uniquement).
  const [apercuId, setApercuId] = useState<string | null>(null);
  const [texteCommentaireApercu, setTexteCommentaireApercu] = useState("");
  const [envoiCommentaire, setEnvoiCommentaire] = useState(false);
  // Dépliage en ligne dans le tableau superviseur
  const [ligneDetailId, setLigneDetailId] = useState<string | null>(null);
  // Une remarque par compte rendu : un membre peut en avoir plusieurs pour la même journée, chaque
  // saisie doit rester attachée au rapport qu'elle commente.
  const [texteCommentaireLigne, setTexteCommentaireLigne] = useState<Record<string, string>>({});
  const [envoiCommentaireLigne, setEnvoiCommentaireLigne] = useState(false);
  const lignesVisibles = useLignesVisibles("comptes-rendus:supervision");

  const hier = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }, []);

  const sup = useQuery(
    api.comptesRendus.vueSuperviseur,
    espace?.superviseur ? { date: jourSup || undefined } : "skip"
  );
  const apercu = apercuId ? (sup?.contenus ?? []).find((c: any) => String(c._id) === apercuId) ?? null : null;

  // Dispense de créneau horaire : niveau 5+ (DAF, DG, Super Admin)
  const estDispense = Boolean((me?.niveau ?? 0) >= 5 || espace?.dispenseFenetre);

  // Horloge de recalcul du compte à rebours toutes les 30 secondes
  useEffect(() => {
    const t = setInterval(() => setTick(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  // Synchronisation des valeurs initiales lorsque les données sont chargées.
  // Le contenu n'est volontairement PAS pré-rempli avec le compte rendu du jour : le formulaire est
  // un dépôt, pas une mise à jour déguisée (demande du propriétaire : le bouton principal doit rester
  // disponible pour déposer). La reprise d'un texte existant passe par l'action « Modifier » de la liste.
  useEffect(() => {
    if (espace && !date) {
      setDate(espace.fenetre.aujourdHui);
    }
  }, [espace?.fenetre.aujourdHui]);

  const fen = espace?.fenetre;

  // Calcul du compte à rebours précis (ou créneau libre pour la Direction)
  const { compteAReboursTexte, estFermeeBientot } = useMemo(() => {
    if (estDispense) {
      return {
        compteAReboursTexte: "Dépôt libre (Direction)",
        estFermeeBientot: false,
      };
    }
    if (!fen) return { compteAReboursTexte: "Chargement...", estFermeeBientot: false };
    if (fen.ouverte && fen.finA) {
      const msRestant = new Date(fen.finA).getTime() - tick;
      const fermeeBientot = msRestant > 0 && msRestant < 30 * 60000;
      return {
        compteAReboursTexte: `Ferme à ${fen.fermeture}h00 (reste ${dureeLisible(msRestant)})`,
        estFermeeBientot: fermeeBientot,
      };
    }
    const msAvantOuverture = new Date(fen.prochaine).getTime() - tick;
    return {
      compteAReboursTexte: `Ouvre à ${fen.ouverture}h00 (dans ${dureeLisible(msAvantOuverture)})`,
      estFermeeBientot: false,
    };
  }, [fen, tick, estDispense]);

  // Statut de soumission du jour
  const estRattrapage = Boolean(fen && date && date !== fen.aujourdHui);
  const seraHorsFenetre = Boolean(!estDispense && (estRattrapage || (fen && !fen.ouverte)));

  // Droit « Comptes rendus : plusieurs par jour » (matrice des droits, décision du 22/10/2026) : il
  // change le sens du dépôt — ajout à la journée au lieu de remplacement du compte rendu du jour.
  const plusieursParJour = Boolean(espace?.plusieursParJour);
  // Comptes rendus déjà déposés pour la date choisie, dans l'ordre des dépôts. La détection porte sur
  // l'historique chargé (30 derniers dépôts) ; au-delà, c'est le serveur qui tranche de toute façon.
  const existantsPourDate = useMemo(
    () => (espace?.historique ?? []).filter((c: any) => c.date === date).slice().reverse(),
    [espace?.historique, date]
  );
  const dernierPourDate = existantsPourDate[existantsPourDate.length - 1] ?? null;
  // Sans le droit, le dépôt remplace le dernier compte rendu du jour : s'il est validé, le serveur
  // refuse. Avec le droit, un compte rendu validé n'empêche pas d'en ajouter un autre.
  const existantVerrouille = !plusieursParJour && dernierPourDate?.statut === "valide";
  // Comptes rendus du jour (liste : la journée peut en porter plusieurs).
  const crDuJour: any[] = espace?.aujourdHui ?? [];
  const dernierDuJour = crDuJour[crDuJour.length - 1] ?? null;

  // Le bouton d'en-tête ouvre toujours un dépôt : on repart d'une feuille blanche à la date du jour
  // dès qu'on sortait d'une correction, sinon on préserve le brouillon en cours de rédaction.
  const ouvrirDepot = () => {
    if (editionId) {
      setEditionId(null);
      setContenu("");
      setDate(espace?.fenetre.aujourdHui ?? "");
    }
    setFormOuvert(true);
  };

  // Reprise d'une ligne de l'historique : correction CIBLÉE de ce compte rendu (mutation `modifier`),
  // pas un nouveau dépôt. Le formulaire est au-dessus de la liste, d'où la remontée du défilement —
  // sans elle, le clic depuis le bas de page paraît sans effet.
  const ouvrirEdition = (c: any) => {
    setEditionId(String(c._id));
    setDate(c.date);
    setContenu(c.contenu);
    setFormOuvert(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Modèles de structure rapide pour aider le collaborateur
  const insererModele = (titre: string) => {
    const amorce = `\n\n### ${titre} :\n- `;
    setContenu((prev) => (prev.trim() ? prev + amorce : `### ${titre} :\n- `));
  };

  const onSoumettre = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contenu.trim()) {
      toast.error("Veuillez rédiger le contenu de votre compte rendu.");
      return;
    }
    // Expliqué ici plutôt que de laisser remonter l'erreur brute de la mutation, qui refuse aussi.
    if (!editionId && existantVerrouille) {
      toast.error("Compte rendu déjà validé", {
        description: `Le compte rendu du ${fmtDateCourte(date)} a été validé par la hiérarchie : il n'est plus modifiable.`,
      });
      return;
    }

    setEnEnvoi(true);
    try {
      // Correction d'un compte rendu précis : ni l'heure de dépôt ni le point de présence ne bougent.
      if (editionId) {
        const r = await modifierCompteRendu({ compteRenduId: editionId as any, contenu: contenu.trim() });
        toast.success(`Compte rendu du ${fmtDateCourte(r.date)} corrigé`, {
          description: `Dépôt de ${r.heure} conservé${r.points ? " · point de présence conservé" : ""}.`,
        });
        setFormOuvert(false);
        setEditionId(null);
        setContenu("");
        setDate(espace?.fenetre.aujourdHui ?? date);
        return;
      }
      const r = await soumettre({ date: date || undefined, contenu: contenu.trim() });
      if (r.ajout && r.nbDuJour > 1) {
        // Dépôt supplémentaire : le droit « plusieurs par jour » ajoute, il ne remplace pas.
        toast.success(`Compte rendu ajouté au ${fmtDateCourte(r.date)}`, {
          description: `${r.nbDuJour} comptes rendus pour cette journée · point de présence : ${r.pointsJour}/1 (acquis une seule fois par jour).`,
        });
      } else if (r.horsFenetre) {
        toast.warning(`Compte rendu du ${fmtDateCourte(r.date)} enregistré`, {
          description: `Soumis à ${r.heure} hors créneau (0 point). Les superviseurs en ont été notifiés.`,
        });
      } else {
        toast.success(`Compte rendu du ${fmtDateCourte(r.date)} soumis avec succès`, {
          description: estDispense
            ? `Enregistré à ${r.heure} selon votre disponibilité (+1 point).`
            : `Enregistré à ${r.heure} dans le créneau officiel : +${r.points} point de présence attribué.`,
        });
      }
      // Dépôt terminé : on vide la saisie pour que le prochain « Nouveau compte rendu » ne reprenne
      // pas le texte qui vient d'être envoyé (le dépôt s'ajoute ou remplace, selon le droit).
      setFormOuvert(false);
      setEditionId(null);
      setContenu("");
      setDate(espace?.fenetre.aujourdHui ?? date);
    } catch (err) {
      toast.error("Échec de la soumission", {
        description: messageErreur(err),
      });
    } finally {
      setEnEnvoi(false);
    }
  };

  const handleChangerStatut = async (
    compteRenduId: any,
    nouveauStatut: "brouillon" | "en_relecture" | "valide",
    nomMembre: string,
    commentaireOptionnel?: string
  ) => {
    try {
      await changerStatut({
        compteRenduId,
        statut: nouveauStatut,
        commentaire: commentaireOptionnel?.trim() || undefined,
      });
      if (nouveauStatut === "valide") {
        toast.success(
          commentaireOptionnel?.trim()
            ? `Compte rendu de ${nomMembre} validé avec remarque`
            : `Compte rendu de ${nomMembre} validé`
        );
      } else {
        toast.info(
          commentaireOptionnel?.trim()
            ? `Statut de ${nomMembre} passé en relecture avec consigne`
            : `Statut de ${nomMembre} passé en relecture`
        );
      }
      setTexteCommentaireApercu("");
    } catch (err) {
      toast.error("Erreur de validation", {
        description: messageErreur(err),
      });
    }
  };

  const handleEnvoyerCommentaire = async (compteRenduId: any, texte: string) => {
    if (!texte.trim()) return;
    setEnvoiCommentaire(true);
    try {
      await ajouterCommentaire({ compteRenduId, texte: texte.trim() });
      toast.success("Remarque transmise au collaborateur");
      setTexteCommentaireApercu("");
    } catch (err) {
      toast.error("Impossible d'enregistrer la remarque", {
        description: messageErreur(err),
      });
    } finally {
      setEnvoiCommentaire(false);
    }
  };

  const handleEnvoyerCommentaireLigne = async (compteRenduId: any) => {
    const cle = String(compteRenduId);
    const texte = (texteCommentaireLigne[cle] ?? "").trim();
    if (!texte) return;
    setEnvoiCommentaireLigne(true);
    try {
      await ajouterCommentaire({ compteRenduId, texte });
      toast.success("Remarque enregistrée et transmise au collaborateur");
      setTexteCommentaireLigne((prev) => ({ ...prev, [cle]: "" }));
    } catch (err) {
      toast.error("Erreur lors de l'enregistrement de la remarque", {
        description: messageErreur(err),
      });
    } finally {
      setEnvoiCommentaireLigne(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. En-tête institutionnel & Action de rédaction */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-encre">
              Comptes rendus journaliers & Présences
            </h1>
            <Flag variant="finance" size="xs">
              Douala UTC+1
            </Flag>
          </div>
          <p className="text-xs sm:text-sm text-encre-douce">
            Validation quotidienne des activités et assiduité · Fenêtre officielle de {fen?.ouverture ?? 16}h00 à {fen?.fermeture ?? 20}h00
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Badge d'état du jour */}
          {dernierDuJour ? (
            <Flag
              variant={STATUT_INFO[dernierDuJour.statut]?.variant ?? "especes"}
              size="sm"
            >
              Aujourd'hui : {STATUT_INFO[dernierDuJour.statut]?.label} ({dernierDuJour.heure})
              {crDuJour.length > 1 && ` · ${crDuJour.length} dépôts`}
            </Flag>
          ) : (
            <Flag variant={fen?.ouverte ? "a-renseigner" : "neutre"} size="sm">
              {fen?.ouverte ? "À rédiger (créneau ouvert)" : "Non soumis aujourd'hui"}
            </Flag>
          )}

          {/* Bouton primaire rétractable pour déplier/replier la rédaction */}
          <Button
            size="sm"
            onClick={() => (formOuvert ? setFormOuvert(false) : ouvrirDepot())}
            className={cn(
              "text-xs font-bold gap-1.5 shadow-xs transition-colors",
              formOuvert
                ? "bg-slate-200 text-slate-700 hover:bg-slate-300"
                : "bg-ocean-profond hover:bg-ocean-nuit text-white"
            )}
          >
            {formOuvert ? (
              <>
                <ChevronUp className="h-3.5 w-3.5" /> Masquer la saisie
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5" />
                Nouveau compte rendu
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 2. Bandeau compact de 4 KPI d'assiduité & créneau */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        {/* KPI 1 : Mon score cumulé */}
        <div className="rounded-xl border border-filet bg-surface p-3 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
            <span className="truncate">Mon score d'assiduité</span>
            <Flag variant="finance" size="xs">
              Points
            </Flag>
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-encre">
              {espace ? espace.score : "—"}
            </span>
            <span className="text-3xs font-medium text-encre-pale">pts de présence</span>
          </div>
        </div>

        {/* KPI 2 : Compte rendu du jour */}
        <div className="rounded-xl border border-filet bg-surface p-3 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
            <span className="truncate">Statut du jour</span>
            <Flag
              variant={
                dernierDuJour
                  ? STATUT_INFO[dernierDuJour.statut]?.variant ?? "especes"
                  : "a-renseigner"
              }
              size="xs"
            >
              {dernierDuJour ? (crDuJour.length > 1 ? `${crDuJour.length} dépôts` : "Déposé") : "En attente"}
            </Flag>
          </div>
          <div className="mt-1">
            <div className="text-base sm:text-lg font-bold font-mono text-ocean-nuit truncate">
              {dernierDuJour ? `Soumis à ${dernierDuJour.heure}` : "Non renseigné"}
            </div>
            {/* Le point de présence vient de la journée entière, pas du dernier dépôt : plusieurs
                comptes rendus le même jour ne valent qu'un point (décision du 22/10/2026). */}
            <div className="text-3xs text-encre-pale truncate">
              {!dernierDuJour
                ? estDispense
                  ? "Dépôt libre en continu"
                  : `À déposer avant ${fen?.fermeture ?? 20}h00`
                : (espace?.pointsDuJour ?? 0) > 0
                ? "+1 point de présence (une fois par jour)"
                : "Hors créneau (0 pt)"}
            </div>
          </div>
        </div>

        {/* KPI 3 : Fenêtre horaire */}
        <div className="rounded-xl border border-filet bg-surface p-3 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
            <span className="truncate">Créneau officiel</span>
            <Flag
              variant={estDispense ? "finance" : fen?.ouverte ? "especes" : "verrou"}
              size="xs"
            >
              {estDispense ? "Libre" : fen?.ouverte ? "Ouvert" : "Fermé"}
            </Flag>
          </div>
          <div className="mt-1">
            <div
              className={cn(
                "text-xs sm:text-sm font-bold font-mono truncate",
                estDispense ? "text-ocean-profond" : fen?.ouverte ? "text-emerald-700" : "text-slate-600",
                !estDispense && estFermeeBientot && "text-amber-600"
              )}
            >
              {compteAReboursTexte}
            </div>
            <div className="text-3xs text-encre-pale truncate">
              {estDispense
                ? "Poste niveau ≥ 5 : pas de contrainte horaire"
                : `${fen?.samedi ? "Lundi–samedi" : "Jours ouvrables"} : ${fen?.ouverture ?? 16}h–${fen?.fermeture ?? 20}h`}
            </div>
          </div>
        </div>

        {/* KPI 4 : Statut éditorial OU Taux équipe */}
        <div className="rounded-xl border border-filet bg-surface p-3 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
            <span className="truncate">
              {espace?.superviseur ? "Taux équipe du jour" : "Contrôle hiérarchique"}
            </span>
            <Flag variant={espace?.superviseur ? "direct" : "neutre"} size="xs">
              {espace?.superviseur ? "Équipe" : "Revue"}
            </Flag>
          </div>
          <div className="mt-1">
            {espace?.superviseur ? (
              <>
                <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-encre">
                  {sup ? `${sup.soumis} / ${sup.membres}` : "—"}
                </div>
                <div className="text-3xs text-encre-pale">
                  {sup?.taux ?? 0}% de participation
                </div>
              </>
            ) : (
              <>
                <div className="text-base sm:text-lg font-bold text-ocean-nuit truncate">
                  {dernierDuJour
                    ? STATUT_INFO[dernierDuJour.statut]?.label ?? "En cours"
                    : "En attente"}
                </div>
                <div className="text-3xs text-encre-pale">
                  {dernierDuJour?.statut === "valide"
                    ? "Validé par le superviseur"
                    : "En cours de lecture"}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 3. Module de Rédaction Rétractable (Facilité d'utilisation) */}
      {formOuvert && (
        <Card className="border-ocean-ceruleen/40 bg-surface shadow-sm overflow-hidden animate-in fade-in duration-200">
          <CardHeader className="p-4 pb-3 border-b border-filet bg-blue-50/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-ocean-profond" />
                <CardTitle className="text-sm sm:text-base font-bold text-ocean-nuit">
                  {editionId
                    ? `Correction du compte rendu du ${fmtDateCourte(date)}`
                    : existantsPourDate.length > 0
                    ? plusieursParJour
                      ? `Compte rendu supplémentaire pour le ${fmtDateCourte(date)}`
                      : `Nouveau dépôt pour le ${fmtDateCourte(date)} (remplacement)`
                    : "Rédaction et soumission du compte rendu journalier"}
                </CardTitle>
              </div>
              <button
                type="button"
                onClick={() => setFormOuvert(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
                title="Fermer le formulaire"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <CardDescription className="text-xs text-encre-douce">
              Renseignez de manière synthétique les missions réalisées, les difficultés rencontrées et vos priorités.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-4 sm:p-5 space-y-4">
            {/* Correction : rien d'autre que le texte ne change (ni heure de dépôt, ni point), donc
                aucun avertissement de créneau n'a de sens ici. */}
            {editionId && (
              <div className="flex items-start gap-2.5 rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-xs text-ocean-nuit">
                <PencilIcon className="h-4 w-4 text-ocean-profond shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Correction d'un compte rendu déposé : </span>
                  vous corrigez le texte du compte rendu du <b>{fmtDateLongue(date)}</b>. L'heure de dépôt et le
                  point de présence déjà acquis sont conservés ; aucun nouveau compte rendu n'est créé.
                </div>
              </div>
            )}

            {/* Un dépôt sur une date déjà renseignée s'AJOUTE (droit « plusieurs par jour ») ou REMPLACE
                le compte rendu de ce jour : on l'annonce, et on bloque net si la hiérarchie l'a validé. */}
            {!editionId && existantsPourDate.length > 0 &&
              (plusieursParJour ? (
                <div className="flex items-start gap-2.5 rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-xs text-ocean-nuit">
                  <History className="h-4 w-4 text-ocean-profond shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">
                      {existantsPourDate.length} compte{existantsPourDate.length > 1 ? "s" : ""} rendu
                      {existantsPourDate.length > 1 ? "s" : ""} déjà déposé{existantsPourDate.length > 1 ? "s" : ""} pour ce jour :{" "}
                    </span>
                    celui-ci sera <b>ajouté</b> aux autres (dépôts de {existantsPourDate.map((c: any) => c.heure).join(", ")}),
                    sans rien remplacer. Le <b>point de présence reste acquis une seule fois par journée</b>.
                    Pour corriger un compte rendu déjà déposé, utilisez le crayon de votre historique.
                  </div>
                </div>
              ) : existantVerrouille ? (
                <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-900">
                  <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Compte rendu déjà validé : </span>
                    Celui du <b>{fmtDateLongue(date)}</b> a été validé par la hiérarchie, il n'est plus modifiable.
                    Choisissez une autre date pour déposer un nouveau compte rendu.
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-900">
                  <History className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Un compte rendu existe déjà pour ce jour : </span>
                    déposé à {dernierPourDate?.heure} ({STATUT_INFO[dernierPourDate?.statut]?.label ?? "en cours"}).
                    L'enregistrement <b>remplacera son contenu</b> — un seul compte rendu est conservé par journée.
                    Pour corriger ce texte sans toucher à l'heure de dépôt, utilisez plutôt le crayon de votre historique.
                    {(dernierPourDate?.points ?? 0) > 0 && seraHorsFenetre && (
                      <>
                        {" "}
                        <b>
                          Ce compte rendu a déjà rapporté {dernierPourDate?.points} point ; réenregistré hors créneau,
                          il repassera à 0.
                        </b>
                      </>
                    )}
                  </div>
                </div>
              ))}

            {/* Avertissements contextuels de fenêtre (dépôt seulement : une correction ne recalcule
                ni l'heure, ni le point de présence). */}
            {!editionId && (estDispense ? (
              <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-xs text-ocean-nuit">
                <CheckCircle2 className="h-4 w-4 text-ocean-profond shrink-0" />
                <span>
                  <b>Dépôt libre (Direction & Encadrement) : </b>
                  Vous pouvez soumettre et actualiser votre compte rendu à tout moment selon votre disponibilité (1 point accordé).
                </span>
              </div>
            ) : estRattrapage ? (
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-900">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Rattrapage d'une date antérieure : </span>
                  Ce compte rendu concerne le <b>{fmtDateLongue(date)}</b>. Il sera enregistré pour le suivi hiérarchique, mais comptera comme hors fenêtre et ne rapportera pas de point.
                </div>
              </div>
            ) : seraHorsFenetre ? (
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-900">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Soumission hors créneau officiel : </span>
                  La fenêtre officielle ({fen?.ouverture ?? 16}h00–{fen?.fermeture ?? 20}h00) est actuellement fermée. Votre compte rendu sera reçu et transmis aux superviseurs avec la mention « hors fenêtre » (0 point).
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-900">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>
                  <b>Créneau officiel actif : </b>
                  La soumission de ce compte rendu validera <b>1 point de présence</b> pour votre journée.
                </span>
              </div>
            ))}

            <form onSubmit={onSoumettre} className="space-y-3.5">
              {/* Ligne date concernée & raccourcis */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-filet">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-700 shrink-0">
                    Jour concerné :
                  </label>
                  {/* En correction, la date est celle du compte rendu repris : la déplacer reviendrait
                      à déposer pour un autre jour, ce qui est le rôle du bouton « Nouveau compte rendu ». */}
                  <Input
                    type="date"
                    value={date}
                    max={fen?.aujourdHui}
                    disabled={!!editionId}
                    title={editionId ? "Jour du compte rendu corrigé : non modifiable" : undefined}
                    onChange={(e) => setDate(e.target.value)}
                    className="h-8 text-xs w-40 bg-white border-filet rounded-lg font-mono disabled:bg-slate-100 disabled:text-slate-500"
                  />
                  {date && (
                    <span className="text-2xs text-slate-500 hidden md:inline">
                      ({fmtDateLongue(date)})
                    </span>
                  )}
                </div>

                {/* Boutons d'aide à la structure */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-3xs uppercase font-bold text-slate-400 mr-1">
                    Insérer :
                  </span>
                  <button
                    type="button"
                    onClick={() => insererModele("Tâches accomplies")}
                    className="rounded-full px-2.5 py-0.5 text-3xs font-semibold bg-blue-50 text-ocean-profond hover:bg-blue-100/80 border border-blue-200 transition-colors"
                  >
                    + Tâches
                  </button>
                  <button
                    type="button"
                    onClick={() => insererModele("Blocages / Points d'attention")}
                    className="rounded-full px-2.5 py-0.5 text-3xs font-semibold bg-amber-50 text-amber-800 hover:bg-amber-100/80 border border-amber-200 transition-colors"
                  >
                    + Blocages
                  </button>
                  <button
                    type="button"
                    onClick={() => insererModele("Priorités du lendemain")}
                    className="rounded-full px-2.5 py-0.5 text-3xs font-semibold bg-emerald-50 text-emerald-800 hover:bg-emerald-100/80 border border-emerald-200 transition-colors"
                  >
                    + Demain
                  </button>
                </div>
              </div>

              {/* Zone de saisie principale */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Contenu du compte rendu <span className="text-rose-600">*</span>
                </label>
                <textarea
                  rows={6}
                  value={contenu}
                  onChange={(e) => setContenu(e.target.value)}
                  placeholder={`Décrivez vos actions marquantes de la journée du ${fmtDateCourte(date || fen?.aujourdHui || "")}…`}
                  className="w-full rounded-xl border border-filet bg-white p-3 text-xs text-encre placeholder:text-slate-400 focus:border-ocean-profond focus:outline-none focus:ring-1 focus:ring-ocean-ceruleen/40 transition-all resize-y font-sans leading-relaxed"
                />
                <div className="flex items-center justify-between text-3xs text-slate-400 px-1">
                  <span>{contenu.length} caractères saisis</span>
                  <span>Conseil : soyez précis et concis</span>
                </div>
              </div>

              {/* Barre d'action de soumission */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-filet">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setFormOuvert(false)}
                  className="text-xs"
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={!contenu.trim() || enEnvoi || existantVerrouille}
                  className="bg-ocean-profond hover:bg-ocean-nuit text-white text-xs font-bold shadow-xs gap-1.5"
                >
                  <Send className="h-3.5 w-3.5" />
                  {enEnvoi
                    ? "Enregistrement en cours…"
                    : editionId
                    ? `Enregistrer la correction du ${fmtDateCourte(date)}`
                    : existantVerrouille
                    ? "Compte rendu validé — non modifiable"
                    : existantsPourDate.length > 0
                    ? plusieursParJour
                      ? `Ajouter ce compte rendu au ${fmtDateCourte(date)}`
                      : `Remplacer le compte rendu du ${fmtDateCourte(date)}`
                    : "Soumettre mon compte rendu"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* 3 bis. Remarques du superviseur sur les comptes rendus du jour */}
      {(() => {
        // La journée peut porter plusieurs comptes rendus : on rassemble leurs remarques en gardant
        // l'heure du dépôt commenté, pour que le collaborateur sache lequel est visé.
        const remarques = crDuJour.flatMap((c: any) =>
          (c.commentaires ?? []).map((comm: any) => ({ ...comm, heureDepot: c.heure }))
        );
        if (remarques.length === 0) return null;
        return (
        <div className="rounded-2xl border border-ocean-ceruleen/40 bg-gradient-to-r from-blue-50/90 via-sky-50/50 to-white p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-ocean-profond" />
              <h3 className="text-sm font-bold text-ocean-nuit">
                Remarques de la hiérarchie sur {crDuJour.length > 1 ? "vos comptes rendus" : "votre compte rendu"} d'aujourd'hui
              </h3>
            </div>
            <Flag variant="finance" size="xs">
              {remarques.length} remarque{remarques.length > 1 ? "s" : ""}
            </Flag>
          </div>

          <div className="space-y-2">
            {remarques.map((comm: any, idx: number) => {
              const estMoi = me?._id && String(comm.auteurId) === String(me._id);
              return (
                <div
                  key={idx}
                  className={cn(
                    "rounded-xl p-3 text-xs border shadow-2xs",
                    estMoi
                      ? "bg-white/95 border-blue-200 ml-4"
                      : "bg-white border-blue-100 mr-4"
                  )}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-bold text-xs text-ocean-nuit">
                      {comm.auteur} {estMoi ? "(Vous)" : "(Superviseur)"}
                      {crDuJour.length > 1 && (
                        <span className="font-normal text-slate-500"> · sur le dépôt de {comm.heureDepot}</span>
                      )}
                    </span>
                    <span className="text-3xs text-slate-400 font-mono">
                      {fmtDateHeure(comm.date)}
                    </span>
                  </div>
                  <p className="text-encre leading-relaxed whitespace-pre-wrap">
                    {comm.texte}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="text-3xs text-slate-500 italic pt-0.5">
            Observations et consignes formulées par votre responsable (lecture seule).
          </div>
        </div>
        );
      })()}

      {/* 4. Historique personnel des comptes rendus */}
      <div className="rounded-2xl border border-filet bg-surface p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-ocean-profond" />
            <h2 className="text-sm sm:text-base font-bold text-ocean-nuit">
              Mon historique d'activité ({espace?.historique.length ?? 0})
            </h2>
          </div>
          <Flag variant="neutre" size="sm" className="font-mono">
            30 derniers dépôts
          </Flag>
        </div>

        {espace && espace.historique.length === 0 ? (
          <div className="p-8 text-center text-encre-douce text-xs border border-dashed border-slate-200 rounded-xl bg-papier/50">
            Aucun compte rendu n'a été enregistré pour le moment.
          </div>
        ) : (
          <div className="space-y-2.5">
            {(espace?.historique ?? []).map((c: any) => {
              const id = String(c._id);
              const estOuvert = expandedId === id;
              const statutObj = STATUT_INFO[c.statut] ?? STATUT_INFO.brouillon;

              return (
                <div
                  key={id}
                  className="rounded-xl border border-filet bg-surface p-3.5 shadow-2xs hover:border-slate-300 transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-filet/70 pb-2 mb-2">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-bold text-xs text-ocean-nuit">
                        {fmtDateLongue(c.date)}
                      </span>
                      <Flag
                        variant={c.horsFenetre ? "verrou" : "especes"}
                        size="xs"
                      >
                        {c.horsFenetre
                          ? `Soumis à ${c.heure} (hors créneau)`
                          : `Soumis à ${c.heure} (dans le créneau)`}
                      </Flag>
                      <Flag variant={statutObj.variant} size="xs">
                        {statutObj.label}
                      </Flag>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      {(c.commentaires ?? []).length > 0 && (
                        <Flag variant="finance" size="xs">
                          <MessageSquare className="h-2.5 w-2.5 mr-1 inline" />
                          {c.commentaires.length}
                        </Flag>
                      )}
                      <span className="text-xs font-mono font-bold text-ocean-profond bg-ocean-brume/60 px-2 py-0.5 rounded-full">
                        +{c.points} pt{c.points > 1 ? "s" : ""}
                      </span>
                      <button
                        type="button"
                        onClick={() => setExpandedId(estOuvert ? null : id)}
                        className="text-xs text-slate-400 hover:text-ocean-profond font-semibold px-1 py-0.5 transition-colors"
                      >
                        {estOuvert ? "Réduire" : "Lire"}
                      </button>
                      {/* Correction d'un compte rendu déjà déposé : action de ligne, comme partout
                          ailleurs dans l'application. Le bouton d'en-tête reste dédié au dépôt. */}
                      {c.statut === "valide" ? (
                        <span
                          className="inline-flex"
                          title="Compte rendu validé par la hiérarchie : il n'est plus modifiable."
                        >
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            disabled
                            aria-label={`Modification impossible — compte rendu du ${fmtDateCourte(c.date)} validé`}
                          >
                            <PencilIcon className="h-3.5 w-3.5" />
                          </Button>
                        </span>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => ouvrirEdition(c)}
                          title="Modifier ce compte rendu"
                          aria-label={`Modifier le compte rendu du ${fmtDateCourte(c.date)}`}
                        >
                          <PencilIcon className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Contenu du compte rendu */}
                  <div
                    onClick={() => setExpandedId(estOuvert ? null : id)}
                    className={cn(
                      "text-xs text-encre font-sans leading-relaxed cursor-pointer whitespace-pre-line transition-all",
                      !estOuvert && "line-clamp-2 text-slate-600 hover:text-encre"
                    )}
                  >
                    {c.contenu}
                  </div>

                  {/* Fil d'échanges / remarques */}
                  {(c.commentaires ?? []).length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-filet/70 space-y-2">
                      <div className="flex items-center gap-1.5 text-2xs font-bold text-ocean-nuit">
                        <MessageSquare className="h-3 w-3 text-ocean-profond" />
                        <span>Remarques du superviseur & échanges ({c.commentaires.length})</span>
                      </div>
                      <div className="space-y-1.5 pl-2 border-l-2 border-ocean-profond/30">
                        {c.commentaires.map((comm: any, idx: number) => {
                          const estMoi = me?._id && String(comm.auteurId) === String(me._id);
                          return (
                            <div key={idx} className="text-2xs bg-papier/70 rounded-lg p-2 border border-filet">
                              <div className="flex items-center justify-between text-3xs text-slate-500 mb-0.5">
                                <span className="font-semibold text-ocean-nuit">
                                  {comm.auteur} {estMoi ? "(Vous)" : "(Superviseur)"}
                                </span>
                                <span className="font-mono">{fmtDateHeure(comm.date)}</span>
                              </div>
                              <div className="text-encre leading-relaxed whitespace-pre-wrap">{comm.texte}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}


                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. Espace Superviseur (Accréditation Niveau 2+) */}
      {espace?.superviseur && (
        <div className="rounded-2xl border border-ocean-ceruleen/30 bg-surface p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-filet pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-ocean-profond" />
                <h2 className="text-base sm:text-lg font-bold text-ocean-nuit">
                  Supervision d'équipe & Contrôle d'assiduité
                </h2>
                <Flag variant="direct" size="xs">
                  Niveau 2+
                </Flag>
              </div>
              <p className="text-xs text-encre-douce">
                Vue consolidée des déclarations journalières des membres actifs
              </p>
            </div>

            {/* Sélecteur de date d'observation */}
            <div className="flex items-center gap-2 flex-wrap">
              <label className="text-xs font-bold text-slate-700 shrink-0">
                Date observée :
              </label>
              <Input
                type="date"
                value={jourSup || (sup?.date ?? "")}
                max={fen?.aujourdHui}
                onChange={(e) => setJourSup(e.target.value)}
                className="h-8 text-xs w-36 bg-white border-filet rounded-lg font-mono"
              />
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  type="button"
                  variant={!jourSup || jourSup === fen?.aujourdHui ? "default" : "outline"}
                  onClick={() => setJourSup("")}
                  className={cn("h-8 text-2xs px-2.5", (!jourSup || jourSup === fen?.aujourdHui) && "bg-ocean-profond text-white")}
                >
                  Aujourd'hui
                </Button>
                <Button
                  size="sm"
                  type="button"
                  variant={jourSup === hier ? "default" : "outline"}
                  onClick={() => setJourSup(hier)}
                  className={cn("h-8 text-2xs px-2.5", jourSup === hier && "bg-ocean-profond text-white")}
                >
                  Hier
                </Button>
              </div>
            </div>
          </div>

          {/* Bannière d'aide si aucun rapport déposé aujourd'hui */}
          {sup && sup.soumis === 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-900 animate-in fade-in">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                <span>
                  Aucun compte rendu déposé pour la date du <b>{fmtDateLongue(sup.date)}</b>.
                  {sup.date === fen?.aujourdHui ? " (Les collaborateurs déposent généralement en fin de journée entre 16h et 20h)." : ""}
                </span>
              </div>
              {sup.date === fen?.aujourdHui && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setJourSup(hier)}
                  className="h-7 text-xs bg-white text-amber-900 border-amber-300 hover:bg-amber-100 self-start sm:self-auto shrink-0 shadow-2xs font-semibold"
                >
                  Consulter la journée d'hier ({fmtDateCourte(hier)})
                </Button>
              )}
            </div>
          )}

          {/* Mini KPI d'équipe pour la date sélectionnée */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-filet bg-papier/60 p-3 flex items-center justify-between">
              <div>
                <div className="text-2xs font-bold uppercase text-slate-500">
                  Taux de soumission
                </div>
                <div className="text-lg font-bold font-mono text-ocean-nuit mt-0.5">
                  {sup ? `${sup.soumis} / ${sup.membres} membres` : "—"}
                </div>
              </div>
              <Flag variant="finance" size="sm">
                {sup?.taux ?? 0} %
              </Flag>
            </div>

            <div className="rounded-xl border border-filet bg-papier/60 p-3 flex items-center justify-between">
              <div>
                <div className="text-2xs font-bold uppercase text-slate-500">
                  Déclarations hors créneau
                </div>
                <div className="text-lg font-bold font-mono text-amber-700 mt-0.5">
                  {sup ? sup.lignes.filter((l: any) => l.horsFenetre).length : "—"}
                </div>
              </div>
              <Flag variant="om" size="sm">
                Retards
              </Flag>
            </div>

            <div className="rounded-xl border border-filet bg-papier/60 p-3 flex items-center justify-between">
              <div>
                <div className="text-2xs font-bold uppercase text-slate-500">
                  En attente de soumission
                </div>
                <div className="text-lg font-bold font-mono text-rose-700 mt-0.5">
                  {sup ? sup.membres - sup.soumis : "—"}
                </div>
              </div>
              <Flag variant="a-renseigner" size="sm">
                Non déposés
              </Flag>
            </div>
          </div>

          {/* Sélecteur de sous-vue : Tableau des membres vs Feed de lecture */}
          <div className="flex items-center justify-between border-b border-filet pt-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setVueOngletSuperviseur("tableau")}
                className={cn(
                  "px-3 py-1.5 text-xs font-bold border-b-2 transition-all",
                  vueOngletSuperviseur === "tableau"
                    ? "border-ocean-profond text-ocean-profond"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                )}
              >
                Tableau nominatif & lecture rapide ({sup?.lignes.length ?? 0})
              </button>
              <button
                type="button"
                onClick={() => setVueOngletSuperviseur("feed")}
                className={cn(
                  "px-3 py-1.5 text-xs font-bold border-b-2 transition-all",
                  vueOngletSuperviseur === "feed"
                    ? "border-ocean-profond text-ocean-profond"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                )}
              >
                Flux détaillé des rapports ({sup?.contenus.length ?? 0})
              </button>
            </div>

            <div className="flex items-center gap-3">
              {vueOngletSuperviseur === "tableau" && <SelecteurLignes valeur={lignesVisibles.lignes} onChange={lignesVisibles.setLignes} />}
              <span className="text-2xs text-slate-500 font-mono hidden sm:inline">
                {sup?.date ? fmtDateLongue(sup.date) : ""}
              </span>
            </div>
          </div>

          {/* Vue A : Tableau de présence et statut par membre */}
          {vueOngletSuperviseur === "tableau" ? (
            <Table classNameConteneur="rounded-xl" hauteurMax={lignesVisibles.hauteurMax(49)}>
              <TableHeader>
                <TableRow>
                  <TableHead>Membre</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Dépôt du jour</TableHead>
                  <TableHead numerique>Points du jour</TableHead>
                  <TableHead numerique>Score cumulé (pts)</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead aria-label="Action" />
                </TableRow>
              </TableHeader>
              <TableBody>
                  {(sup?.lignes ?? []).map((l: any) => {
                    const statutObj = l.statut ? STATUT_INFO[l.statut] : null;

                    return (
                      <Fragment key={String(l.membreId)}>
                        <TableRow>
                        <TableCell className="leading-tight">
                          <div className="whitespace-nowrap text-[13px] font-semibold">{l.nom}</div>
                          <div className="whitespace-nowrap font-mono text-2xs text-encre-pale">{l.email}</div>
                        </TableCell>
                        <TableCell>
                          <Flag variant="neutre" size="xs">
                            {l.role}
                          </Flag>
                        </TableCell>
                        <TableCell>
                          {l.soumis ? (
                            <div className="flex items-center gap-1.5 whitespace-nowrap">
                              <span className="font-mono text-xs tabular-nums">
                                Déposé à {l.heure}
                              </span>
                              {/* Dépôts multiples (droit « plusieurs par jour ») : on dit combien il y
                                  en a eu, sans suivre aucun nombre attendu. */}
                              {l.nbDepots > 1 && (
                                <Flag variant="finance" size="xs" title="Plusieurs comptes rendus déposés ce jour">
                                  {l.nbDepots} dépôts
                                </Flag>
                              )}
                              {l.horsFenetre && (
                                <Flag variant="verrou" size="xs">
                                  Hors créneau
                                </Flag>
                              )}
                            </div>
                          ) : (
                            <Flag variant="a-renseigner" size="xs">
                              En attente
                            </Flag>
                          )}
                        </TableCell>
                        <TableCell numerique className="font-mono text-xs font-semibold">
                          {l.points ? `+${l.points}` : <span className="text-encre-pale">0</span>}
                        </TableCell>
                        <TableCell numerique className="font-mono text-xs font-semibold text-ocean-profond">
                          {l.score ? l.score : <span className="text-encre-pale">0</span>}
                        </TableCell>
                        <TableCell>
                          {statutObj ? (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Flag variant={statutObj.variant} size="xs">
                                {statutObj.label}
                              </Flag>
                              {l.nbCommentaires > 0 && (
                                <Flag variant="finance" size="xs" title={`${l.nbCommentaires} remarque(s)`}>
                                  <MessageSquare className="h-2.5 w-2.5 mr-0.5 inline" />
                                  {l.nbCommentaires}
                                </Flag>
                              )}
                            </div>
                          ) : (
                            <span className="text-encre-pale">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {l.id && (
                            <Button
                              size="sm"
                              variant={ligneDetailId === String(l.id) ? "default" : "outline"}
                              onClick={() => {
                                setLigneDetailId(ligneDetailId === String(l.id) ? null : String(l.id));
                              }}
                              className={cn(
                                "mr-1 h-7 gap-1 px-2.5 text-3xs font-semibold",
                                ligneDetailId === String(l.id)
                                  ? "bg-ocean-profond text-white"
                                  : "text-ocean-profond hover:bg-ocean-brume/30 border-ocean-ceruleen/40"
                              )}
                              title="Lire le rapport directement dans le tableau"
                            >
                              <FileText className="h-3 w-3" />
                              {ligneDetailId === String(l.id) ? "Masquer" : l.nbDepots > 1 ? `Lire les ${l.nbDepots} rapports` : "Lire le rapport"}
                              {l.nbCommentaires > 0 && ` (${l.nbCommentaires})`}
                            </Button>
                          )}
                          {l.id && l.statut !== "valide" && (
                            <Button
                              size="sm"
                              onClick={() => handleChangerStatut(l.id, "valide", l.nom)}
                              className="h-7 text-3xs font-bold px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                            >
                              <Check className="h-3 w-3" />
                              Valider
                            </Button>
                          )}
                          {l.id && l.statut === "valide" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleChangerStatut(l.id, "en_relecture", l.nom)}
                              className="h-7 text-3xs px-2 text-slate-600 hover:text-slate-900 gap-1"
                            >
                              <RotateCcw className="h-3 w-3" />
                              Rouvrir
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>

                      {/* Panneau déplié de lecture directe : TOUS les comptes rendus que le membre a
                          déposés ce jour-là (il peut en avoir plusieurs), chacun avec son heure. */}
                      {l.id && ligneDetailId === String(l.id) && (() => {
                        const siens = (sup?.contenus ?? []).filter((x: any) => String(x.auteurId) === String(l.membreId));
                        if (siens.length === 0) return null;
                        return (
                          <tr className="border-b border-filet bg-papier/70 animate-in fade-in duration-150">
                            <td colSpan={7} className="p-3 sm:p-4">
                              <div className="space-y-2.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-2xs font-bold uppercase tracking-wider text-slate-500">
                                    {siens.length > 1
                                      ? `${siens.length} comptes rendus de ${l.nom} · ${fmtDateLongue(sup?.date ?? "")}`
                                      : `Compte rendu de ${l.nom}`}
                                  </span>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setLigneDetailId(null)}
                                    className="h-6 text-3xs text-slate-400 hover:text-slate-600"
                                  >
                                    Fermer
                                  </Button>
                                </div>
                                {siens.map((c: any, i: number) => (
                              <div key={String(c._id)} className="rounded-xl border border-ocean-ceruleen/40 bg-white p-4 shadow-sm space-y-3">
                                <div className="flex items-center justify-between border-b border-filet pb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-xs text-ocean-nuit">
                                      {siens.length > 1 ? `Dépôt ${i + 1} sur ${siens.length} · ${c.heure}` : `Compte rendu de ${l.nom} · ${c.heure}`}
                                    </span>
                                    {c.horsFenetre && <Flag variant="verrou" size="xs">Hors créneau</Flag>}
                                    {c.dispenseFenetre && <Flag variant="finance" size="xs">Direction (Libre)</Flag>}
                                    {STATUT_INFO[c.statut] && (
                                      <Flag variant={STATUT_INFO[c.statut].variant} size="xs">
                                        {STATUT_INFO[c.statut].label}
                                      </Flag>
                                    )}
                                  </div>
                                </div>

                                <div className="text-xs text-encre font-sans whitespace-pre-line leading-relaxed bg-papier/60 p-3 rounded-lg border border-filet">
                                  {c.contenu}
                                </div>

                                {/* Remarques déjà enregistrées */}
                                {(c.commentaires ?? []).length > 0 && (
                                  <div className="space-y-1.5 pt-1 border-t border-filet/60">
                                    <div className="text-3xs font-bold uppercase text-slate-500 flex items-center gap-1">
                                      <MessageSquare className="h-3 w-3 text-ocean-profond" />
                                      Remarques & consignes au collaborateur ({c.commentaires.length}) :
                                    </div>
                                    <div className="space-y-1">
                                      {c.commentaires.map((comm: any, idx: number) => (
                                        <div key={idx} className="rounded-lg bg-blue-50/50 p-2 text-2xs border border-blue-100 flex flex-col gap-0.5">
                                          <div className="flex items-center justify-between text-3xs text-slate-500">
                                            <span className="font-bold text-ocean-nuit">{comm.auteur}</span>
                                            <span className="font-mono">{fmtDateHeure(comm.date)}</span>
                                          </div>
                                          <span className="text-encre whitespace-pre-wrap">{comm.texte}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Saisie d'une remarque par le superviseur */}
                                <div className="pt-2 border-t border-filet/60 space-y-2">
                                  <label className="text-3xs font-bold uppercase tracking-wider text-slate-600 block">
                                    Ajouter une consigne ou remarque pour {l.nom} :
                                  </label>
                                  <div className="flex gap-2">
                                    <Input
                                      value={texteCommentaireLigne[String(c._id)] ?? ""}
                                      onChange={(e) => setTexteCommentaireLigne((prev) => ({ ...prev, [String(c._id)]: e.target.value }))}
                                      placeholder="Ex: Merci de relancer le client X, point à approfondir..."
                                      className="h-8 text-xs bg-white"
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter" && !e.shiftKey) {
                                          e.preventDefault();
                                          void handleEnvoyerCommentaireLigne(c._id);
                                        }
                                      }}
                                    />
                                    <Button
                                      size="sm"
                                      type="button"
                                      disabled={!(texteCommentaireLigne[String(c._id)] ?? "").trim() || envoiCommentaireLigne}
                                      onClick={() => void handleEnvoyerCommentaireLigne(c._id)}
                                      className="h-8 text-xs bg-ocean-profond hover:bg-ocean-nuit text-white px-3 gap-1 shrink-0 font-semibold"
                                    >
                                      <Send className="h-3 w-3" />
                                      Envoyer
                                    </Button>
                                  </div>
                                </div>
                              </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        );
                      })()}
                      </Fragment>
                    );
                  })}
              </TableBody>
            </Table>
          ) : (
            /* Vue B : Feed complet des comptes rendus rédigés */
            <div className="space-y-3">
              {(sup?.contenus ?? []).length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-filet rounded-xl">
                  Aucun compte rendu rédigé n'a été trouvé pour cette date.
                </div>
              ) : (
                (sup?.contenus ?? []).map((c: any) => {
                  const statutObj = STATUT_INFO[c.statut] ?? STATUT_INFO.brouillon;

                  return (
                    <div
                      key={String(c._id)}
                      className="rounded-xl border border-filet bg-white p-4 shadow-2xs space-y-2.5 hover:border-slate-300 transition-colors"
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2 border-b border-filet/70 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-ocean-nuit">
                            {c.auteur}
                          </span>
                          <span className="text-3xs text-slate-400 font-mono">
                            Déposé à {c.heure} {c.horsFenetre && "(hors créneau)"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {(c.commentaires ?? []).length > 0 && (
                            <Flag variant="finance" size="xs">
                              <MessageSquare className="h-2.5 w-2.5 mr-0.5 inline" />
                              {c.commentaires.length}
                            </Flag>
                          )}
                          <Flag variant={statutObj.variant} size="xs">
                            {statutObj.label}
                          </Flag>
                        </div>
                      </div>
                      <div className="text-xs text-encre font-sans whitespace-pre-line leading-relaxed">
                        {c.contenu}
                      </div>

                      {/* Remarques déjà enregistrées */}
                      {(c.commentaires ?? []).length > 0 && (
                        <div className="mt-2 pt-2 border-t border-filet/60 space-y-1.5">
                          <div className="text-3xs font-bold uppercase text-slate-500 flex items-center gap-1">
                            <MessageSquare className="h-3 w-3 text-ocean-profond" />
                            Remarques & Consignes ({c.commentaires.length}) :
                          </div>
                          <div className="space-y-1">
                            {c.commentaires.map((comm: any, idx: number) => (
                              <div key={idx} className="rounded-lg bg-papier/70 p-2 text-2xs border border-filet flex flex-col gap-0.5">
                                <div className="flex items-center justify-between text-3xs text-slate-400">
                                  <span className="font-bold text-ocean-nuit">{comm.auteur}</span>
                                  <span className="font-mono">{fmtDateHeure(comm.date)}</span>
                                </div>
                                <span className="text-encre whitespace-pre-wrap">{comm.texte}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-filet/50">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setApercuId(String(c._id));
                            setTexteCommentaireApercu("");
                          }}
                          className="h-7 text-xs text-ocean-profond hover:text-ocean-nuit gap-1 px-2.5"
                        >
                          <MessageSquare className="h-3 w-3" />
                          Remarque & Décision
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {/* Aperçu superviseur : lecture du compte rendu + fil de remarques et consignes */}
      <Dialog
        open={!!apercu}
        onOpenChange={(o) => {
          if (!o) {
            setApercuId(null);
            setTexteCommentaireApercu("");
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          {apercu && (
            <>
              <DialogHeader className="p-5 pb-3 border-b border-filet bg-papier">
                <DialogTitle className="flex flex-wrap items-center gap-2 text-base font-bold text-ocean-nuit">
                  <span>Compte rendu de {apercu.auteur}</span>
                  <Flag variant={STATUT_INFO[apercu.statut]?.variant ?? "neutre"} size="xs">
                    {STATUT_INFO[apercu.statut]?.label ?? apercu.statut}
                  </Flag>
                  {apercu.horsFenetre && <Flag variant="a-renseigner" size="xs">hors fenêtre</Flag>}
                  {apercu.dispenseFenetre && <Flag variant="finance" size="xs">Direction (Libre)</Flag>}
                </DialogTitle>
                <DialogDescription className="text-xs text-encre-douce">
                  {fmtDateLongue(sup?.date ?? "")} · Déposé à {apercu.heure}
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {/* Contenu du compte rendu */}
                <div className="space-y-1.5">
                  <div className="text-2xs font-bold uppercase tracking-wider text-slate-500">
                    Contenu rédigé par le collaborateur
                  </div>
                  <div className="whitespace-pre-wrap rounded-xl border border-filet bg-papier/70 p-3.5 text-xs font-sans leading-relaxed text-encre">
                    {apercu.contenu}
                  </div>
                </div>

                {/* Fil d'échanges & remarques */}
                <div className="rounded-xl border border-filet bg-white p-3.5 space-y-3">
                  <div className="flex items-center justify-between border-b border-filet/70 pb-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-ocean-nuit">
                      <MessageSquare className="h-4 w-4 text-ocean-profond" />
                      <span>Remarques & Consignes au dépositaire</span>
                    </div>
                    <Flag variant={(apercu.commentaires ?? []).length > 0 ? "finance" : "neutre"} size="xs">
                      {(apercu.commentaires ?? []).length} message{(apercu.commentaires ?? []).length > 1 ? "s" : ""}
                    </Flag>
                  </div>

                  {(apercu.commentaires ?? []).length === 0 ? (
                    <div className="py-3 text-center text-2xs text-slate-400 italic">
                      Aucune remarque formulée pour ce compte rendu. Vous pouvez en rédiger une ci-dessous.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {apercu.commentaires.map((comm: any, idx: number) => {
                        const estMoi = me?._id && String(comm.auteurId) === String(me._id);
                        return (
                          <div
                            key={idx}
                            className={cn(
                              "rounded-lg p-2.5 text-xs border transition-colors",
                              estMoi
                                ? "bg-blue-50/70 border-blue-200/80 ml-4"
                                : "bg-slate-50 border-filet mr-4"
                            )}
                          >
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="font-bold text-2xs text-ocean-nuit">
                                {comm.auteur} {estMoi && "(Vous)"}
                              </span>
                              <span className="text-3xs text-slate-400 font-mono">
                                {fmtDateHeure(comm.date)}
                              </span>
                            </div>
                            <p className="text-encre leading-relaxed whitespace-pre-wrap text-xs">
                              {comm.texte}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Saisie d'une remarque */}
                  <div className="space-y-2 pt-1 border-t border-filet/70">
                    <label className="text-2xs font-bold text-slate-600 block">
                      Nouvelle consigne ou remarque pour {apercu.auteur} :
                    </label>
                    <div className="flex gap-2">
                      <textarea
                        rows={2}
                        value={texteCommentaireApercu}
                        onChange={(e) => setTexteCommentaireApercu(e.target.value)}
                        placeholder="Ex: Merci de relancer le client X demain matin, bien documenter..."
                        className="flex-1 rounded-lg border border-filet bg-white p-2.5 text-xs text-encre placeholder:text-slate-400 focus:border-ocean-profond focus:outline-none focus:ring-1 focus:ring-ocean-ceruleen/40 resize-none font-sans"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                            e.preventDefault();
                            void handleEnvoyerCommentaire(apercu._id, texteCommentaireApercu);
                          }
                        }}
                      />
                      <Button
                        type="button"
                        size="sm"
                        disabled={!texteCommentaireApercu.trim() || envoiCommentaire}
                        onClick={() => void handleEnvoyerCommentaire(apercu._id, texteCommentaireApercu)}
                        className="self-end h-9 text-xs font-semibold bg-ocean-profond hover:bg-ocean-nuit text-white px-3 gap-1.5 shrink-0"
                      >
                        <Send className="h-3.5 w-3.5" />
                        Envoyer
                      </Button>
                    </div>
                    <div className="text-3xs text-slate-400">
                      Astuce : <kbd className="px-1 py-0.5 rounded bg-slate-100 border text-slate-500 font-mono text-3xs">Ctrl+Entrée</kbd> pour envoyer rapidement.
                    </div>
                  </div>
                </div>
              </div>

              {/* Barre d'actions du modal */}
              <div className="p-4 border-t border-filet bg-papier flex items-center justify-between gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setApercuId(null);
                    setTexteCommentaireApercu("");
                  }}
                  className="text-xs text-slate-600"
                >
                  Fermer
                </Button>
                <div className="flex items-center gap-2">
                  {apercu.statut !== "valide" ? (
                    <Button
                      size="sm"
                      onClick={() => {
                        void handleChangerStatut(apercu._id, "valide", apercu.auteur, texteCommentaireApercu);
                        setApercuId(null);
                      }}
                      className="bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-bold gap-1.5"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Valider {texteCommentaireApercu.trim() && "avec remarque"}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        void handleChangerStatut(apercu._id, "en_relecture", apercu.auteur, texteCommentaireApercu);
                        setApercuId(null);
                      }}
                      className="text-xs text-slate-700 hover:text-slate-900 gap-1.5"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Rouvrir {texteCommentaireApercu.trim() && "avec consigne"}
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

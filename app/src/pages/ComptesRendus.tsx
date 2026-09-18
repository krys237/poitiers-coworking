import { useEffect, useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { dureeLisible, HEURE_OUVERTURE, HEURE_FERMETURE } from "../../convex/lib/fenetre";
import { messageErreur } from "../lib/format";
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
} from "lucide-react";

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
  const espace = useQuery(api.comptesRendus.monEspace);
  const soumettre = useMutation(api.comptesRendus.soumettre);
  const changerStatut = useMutation(api.comptesRendus.changerStatut);

  const [contenu, setContenu] = useState("");
  const [date, setDate] = useState("");
  const [formOuvert, setFormOuvert] = useState(false);
  const [enEnvoi, setEnEnvoi] = useState(false);
  const [tick, setTick] = useState(Date.now());
  const [jourSup, setJourSup] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [vueOngletSuperviseur, setVueOngletSuperviseur] = useState<"tableau" | "feed">("tableau");
  const lignesVisibles = useLignesVisibles("comptes-rendus:supervision");

  const sup = useQuery(
    api.comptesRendus.vueSuperviseur,
    espace?.superviseur ? { date: jourSup || undefined } : "skip"
  );

  // Horloge de recalcul du compte à rebours toutes les 30 secondes
  useEffect(() => {
    const t = setInterval(() => setTick(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  // Synchronisation des valeurs initiales lorsque les données sont chargées
  useEffect(() => {
    if (espace && !date) {
      setDate(espace.fenetre.aujourdHui);
    }
    if (espace?.aujourdHui && !contenu) {
      setContenu(espace.aujourdHui.contenu);
    }
  }, [espace?.fenetre.aujourdHui]);

  const fen = espace?.fenetre;

  // Calcul du compte à rebours précis
  const { compteAReboursTexte, estFermeeBientot } = useMemo(() => {
    if (!fen) return { compteAReboursTexte: "Chargement...", estFermeeBientot: false };
    if (fen.ouverte && fen.finA) {
      const msRestant = new Date(fen.finA).getTime() - tick;
      const fermeeBientot = msRestant > 0 && msRestant < 30 * 60000;
      return {
        compteAReboursTexte: `Ferme à ${HEURE_FERMETURE}h00 (reste ${dureeLisible(msRestant)})`,
        estFermeeBientot: fermeeBientot,
      };
    }
    const msAvantOuverture = new Date(fen.prochaine).getTime() - tick;
    return {
      compteAReboursTexte: `Ouvre à ${HEURE_OUVERTURE}h00 (dans ${dureeLisible(msAvantOuverture)})`,
      estFermeeBientot: false,
    };
  }, [fen, tick]);

  // Statut de soumission du jour
  const estSoumisAujourdhui = !!espace?.aujourdHui;
  const estRattrapage = Boolean(fen && date && date !== fen.aujourdHui);
  const seraHorsFenetre = Boolean(estRattrapage || (fen && !fen.ouverte));

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

    setEnEnvoi(true);
    try {
      const r = await soumettre({ date: date || undefined, contenu: contenu.trim() });
      if (r.horsFenetre) {
        toast.warning(`Compte rendu du ${fmtDateCourte(r.date)} enregistré`, {
          description: `Soumis à ${r.heure} hors créneau (0 point). Les superviseurs en ont été notifiés.`,
        });
      } else {
        toast.success(`Compte rendu du ${fmtDateCourte(r.date)} soumis avec succès`, {
          description: `Enregistré à ${r.heure} dans le créneau officiel : +${r.points} point de présence attribué.`,
        });
      }
      setFormOuvert(false);
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
    nomMembre: string
  ) => {
    try {
      await changerStatut({ compteRenduId, statut: nouveauStatut });
      if (nouveauStatut === "valide") {
        toast.success(`Compte rendu de ${nomMembre} validé`);
      } else {
        toast.info(`Statut de ${nomMembre} passé en relecture`);
      }
    } catch (err) {
      toast.error("Erreur de validation", {
        description: messageErreur(err),
      });
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
            Validation quotidienne des activités et assiduité · Fenêtre officielle de 16h00 à 20h00
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Badge d'état du jour */}
          {espace?.aujourdHui ? (
            <Flag
              variant={STATUT_INFO[espace.aujourdHui.statut]?.variant ?? "especes"}
              size="sm"
            >
              Aujourd'hui : {STATUT_INFO[espace.aujourdHui.statut]?.label} ({espace.aujourdHui.heure})
            </Flag>
          ) : (
            <Flag variant={fen?.ouverte ? "a-renseigner" : "neutre"} size="sm">
              {fen?.ouverte ? "À rédiger (créneau ouvert)" : "Non soumis aujourd'hui"}
            </Flag>
          )}

          {/* Bouton primaire rétractable pour déplier/replier la rédaction */}
          <Button
            size="sm"
            onClick={() => setFormOuvert((v) => !v)}
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
                {estSoumisAujourdhui ? "Modifier mon compte rendu" : "Rédiger mon compte rendu"}
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
                espace?.aujourdHui
                  ? STATUT_INFO[espace.aujourdHui.statut]?.variant ?? "especes"
                  : "a-renseigner"
              }
              size="xs"
            >
              {espace?.aujourdHui ? "Déposé" : "En attente"}
            </Flag>
          </div>
          <div className="mt-1">
            <div className="text-base sm:text-lg font-bold font-mono text-ocean-nuit truncate">
              {espace?.aujourdHui ? `Soumis à ${espace.aujourdHui.heure}` : "Non renseigné"}
            </div>
            <div className="text-3xs text-encre-pale truncate">
              {espace?.aujourdHui?.horsFenetre
                ? "Hors créneau (0 pt)"
                : espace?.aujourdHui
                ? "+1 point accordé"
                : "À déposer avant 20h00"}
            </div>
          </div>
        </div>

        {/* KPI 3 : Fenêtre horaire */}
        <div className="rounded-xl border border-filet bg-surface p-3 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
            <span className="truncate">Créneau officiel</span>
            <Flag
              variant={fen?.ouverte ? "especes" : "verrou"}
              size="xs"
            >
              {fen?.ouverte ? "Ouvert" : "Fermé"}
            </Flag>
          </div>
          <div className="mt-1">
            <div
              className={cn(
                "text-xs sm:text-sm font-bold font-mono truncate",
                fen?.ouverte ? "text-emerald-700" : "text-slate-600",
                estFermeeBientot && "text-amber-600"
              )}
            >
              {compteAReboursTexte}
            </div>
            <div className="text-3xs text-encre-pale truncate">
              Jours ouvrables : 16h–20h
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
                  {espace?.aujourdHui
                    ? STATUT_INFO[espace.aujourdHui.statut]?.label ?? "En cours"
                    : "En attente"}
                </div>
                <div className="text-3xs text-encre-pale">
                  {espace?.aujourdHui?.statut === "valide"
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
                  {estSoumisAujourdhui && date === fen?.aujourdHui
                    ? "Mise à jour de votre compte rendu du jour"
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
            {/* Avertissements contextuels de fenêtre */}
            {estRattrapage ? (
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
                  La fenêtre officielle (16h00–20h00) est actuellement fermée. Votre compte rendu sera reçu et transmis aux superviseurs avec la mention « hors fenêtre » (0 point).
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
            )}

            <form onSubmit={onSoumettre} className="space-y-3.5">
              {/* Ligne date concernée & raccourcis */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-filet">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-700 shrink-0">
                    Jour concerné :
                  </label>
                  <Input
                    type="date"
                    value={date}
                    max={fen?.aujourdHui}
                    onChange={(e) => setDate(e.target.value)}
                    className="h-8 text-xs w-40 bg-white border-filet rounded-lg font-mono"
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
                  disabled={!contenu.trim() || enEnvoi}
                  className="bg-ocean-profond hover:bg-ocean-nuit text-white text-xs font-bold shadow-xs gap-1.5"
                >
                  <Send className="h-3.5 w-3.5" />
                  {enEnvoi
                    ? "Enregistrement en cours…"
                    : estSoumisAujourdhui && date === fen?.aujourdHui
                    ? "Mettre à jour mon compte rendu"
                    : "Soumettre mon compte rendu"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

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
            30 derniers jours
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
            <div className="flex items-center gap-2">
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
              {jourSup && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setJourSup("")}
                  className="h-8 text-2xs px-2"
                >
                  Aujourd'hui
                </Button>
              )}
            </div>
          </div>

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
                Tableau nominatif ({sup?.lignes.length ?? 0})
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
                Comptes rendus rédigés ({sup?.contenus.length ?? 0})
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
                      <TableRow key={String(l.membreId)}>
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
                            <Flag variant={statutObj.variant} size="xs">
                              {statutObj.label}
                            </Flag>
                          ) : (
                            <span className="text-encre-pale">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
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
                      className="rounded-xl border border-filet bg-white p-4 shadow-2xs space-y-2 hover:border-slate-300 transition-colors"
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
                        <Flag variant={statutObj.variant} size="xs">
                          {statutObj.label}
                        </Flag>
                      </div>
                      <div className="text-xs text-encre font-sans whitespace-pre-line leading-relaxed">
                        {c.contenu}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

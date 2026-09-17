import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  BLOCS,
  SOLDES,
  SOLDES_PRINCIPAUX,
  calculerSoldes,
  recetteTotale,
  formule,
  CLE_PIECE,
} from "../../convex/lib/tresorerie";
import { fcfa, libellePeriode, messageErreur } from "../lib/format";
import { BoutonConfirmation } from "@/components/app/bouton-action";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Flag } from "@/components/ui/flag";
import {
  Calendar,
  Lock,
  Unlock,
  Save,
  Paperclip,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Building2,
  ChevronDown,
  ChevronUp,
  Plus,
  ShieldCheck,
  RotateCcw,
  PenLine,
} from "lucide-react";

type Mouv = Record<string, Record<string, number>>;
const aujourdHui = () => new Date().toISOString().slice(0, 10);
const fmtDate = (s: string) =>
  new Date(s + "T00:00:00").toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export function Financier() {
  const [date, setDate] = useState(aujourdHui());
  const j = useQuery(api.financier.journee, { date });
  const histo = useQuery(api.financier.historique, { date });
  const enregistrer = useMutation(api.financier.enregistrer);
  const prendreVerrou = useMutation(api.financier.prendreVerrou);
  const libererVerrou = useMutation(api.financier.libererVerrou);
  const cloturer = useMutation(api.financier.cloturerMois);
  const genererUploadUrl = useMutation(api.financier.genererUploadUrl);
  const attacherPiece = useMutation(api.financier.attacherPiece);

  const [draft, setDraft] = useState<Mouv>({});
  const [notes, setNotes] = useState("");
  const [dirty, setDirty] = useState(false);
  const [editJ0, setEditJ0] = useState(false);
  const [j0, setJ0] = useState<Record<string, number>>({});
  const [caisseActive, setCaisseActive] = useState<string>("poitiers");
  const [voirSoldesDetails, setVoirSoldesDetails] = useState(false);
  const [voirHisto, setVoirHisto] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [uploadCle, setUploadCle] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Synchronise le brouillon avec le serveur tant que rien n'a été modifié localement
  useEffect(() => {
    if (!j || dirty) return;
    setDraft(j.mouvements);
    setNotes(j.notes);
    setJ0(j.soldesOuverture);
    setEditJ0(false);
  }, [j?.date, j?.existe, j?.recetteTotale, dirty]);

  useEffect(() => {
    setDirty(false);
    setMsg(null);
  }, [date]);

  const peutEditer = !!j && !j.cloture && j.verrou.mien;
  const ouverture = editJ0 ? j0 : j?.soldesOuverture ?? {};
  const soldes = calculerSoldes(ouverture, draft);
  const recette = recetteTotale(draft);

  const setMontant = (bloc: string, ligne: string, val: string) => {
    const raw = val.replace(/[^\d-]/g, "");
    const n = raw === "" ? 0 : parseInt(raw, 10);
    setDraft((d) => ({
      ...d,
      [bloc]: { ...(d[bloc] ?? {}), [ligne]: Number.isFinite(n) ? n : 0 },
    }));
    setDirty(true);
  };

  const sauver = async () => {
    try {
      const r = await enregistrer({
        date,
        mouvements: draft,
        notes,
        soldesOuverture: editJ0 ? j0 : undefined,
      });
      setDirty(false);
      setEditJ0(false);
      setMsg(
        `Journée enregistrée — recette ${fcfa(r.recetteTotale)} · Caisse F3 Poitiers ${fcfa(
          r.soldes.poitiers_f3 ?? 0
        )}.`
      );
    } catch (e) {
      setMsg(`Erreur : ${messageErreur(e)}`);
    }
  };

  const verrouiller = async () => {
    try {
      await prendreVerrou({ date });
      setMsg("Verrou activé : vous avez la main exclusive pour saisir et enregistrer.");
    } catch (e) {
      setMsg(`Erreur : ${messageErreur(e)}`);
    }
  };

  const libererLaMain = async () => {
    try {
      await libererVerrou({ date });
      setMsg("Verrou libéré : la journée est désormais accessible aux autres utilisateurs.");
    } catch (e) {
      setMsg(`Erreur : ${messageErreur(e)}`);
    }
  };

  const envoyerPiece = async (file: File) => {
    if (!uploadCle) return;
    try {
      const url = await genererUploadUrl();
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      const { storageId } = await res.json();
      await attacherPiece({ date, cle: uploadCle, storageId });
      setMsg(`Justificatif attaché avec succès (${file.name}).`);
    } catch (e) {
      setMsg(`Erreur : ${messageErreur(e)}`);
    } finally {
      setUploadCle(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  // Caisse active et navigation séquentielle
  const blocIndex = BLOCS.findIndex((b) => b.cle === caisseActive);
  const blocActif = BLOCS[blocIndex >= 0 ? blocIndex : 0];
  const blocPrecedent = blocIndex > 0 ? BLOCS[blocIndex - 1] : null;
  const blocSuivant = blocIndex < BLOCS.length - 1 ? BLOCS[blocIndex + 1] : null;

  // Calcul de la ventilation par canal (Collection Summary)
  const canaux = useMemo(() => {
    const c = { especes: 0, om: 0, momo: 0, banque: 0, autres: 0, retraits: 0 };
    for (const b of BLOCS) {
      for (const l of b.lignes) {
        const v = draft[b.cle]?.[l.cle] ?? 0;
        if (l.sens === "retrait") {
          c.retraits += v;
        } else {
          if (l.cle === "especes") c.especes += v;
          else if (l.cle === "om") c.om += v;
          else if (l.cle === "momo") c.momo += v;
          else if (["cheque", "visa", "depot"].includes(l.cle)) c.banque += v;
          else c.autres += v;
        }
      }
    }
    return c;
  }, [draft]);

  // Historique ordonné chronologiquement (pour sparkline)
  const chronoHisto = useMemo(() => {
    return [...(histo ?? [])].reverse();
  }, [histo]);
  const maxRecetteHisto = Math.max(...chronoHisto.map((h: any) => h.recetteTotale), 1);

  // Totaux de la caisse active
  const sousTotalActif = blocActif.lignes
    .filter((l) => l.sens === "entree")
    .reduce((t, l) => t + (draft[blocActif.cle]?.[l.cle] ?? 0), 0);
  const sousTotalRetraitsActif = blocActif.lignes
    .filter((l) => l.sens === "retrait")
    .reduce((t, l) => t + (draft[blocActif.cle]?.[l.cle] ?? 0), 0);
  const soldesDuBloc = SOLDES.filter((s) => s.bloc === blocActif.cle);

  // Nombre de caisses ayant des données saisies
  const nbCaissesRenseignees = useMemo(() => {
    return BLOCS.filter((b) =>
      b.lignes.some((l) => (draft[b.cle]?.[l.cle] ?? 0) !== 0)
    ).length;
  }, [draft]);

  return (
    <div className="space-y-4">
      {/* 1. En-tête institutionnel & Contexte de Trésorerie */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-encre">
            Récapitulatif financier
          </h1>
          <p className="text-xs sm:text-sm text-encre-douce">
            Cockpit de trésorerie journalier multi-entités et grand livre réactif
          </p>
        </div>

        {j?.cloture ? (
          <Badge variant="verrou" className="self-start sm:self-auto py-1 px-3">
            <Lock className="mr-1.5 h-3.5 w-3.5" />
            Mois {libellePeriode(j.periode)} clôturé · Lecture seule
          </Badge>
        ) : (
          <Badge variant="succes" className="self-start sm:self-auto py-1 px-3">
            <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
            Mois en cours · Opérations ouvertes
          </Badge>
        )}
      </div>

      {/* 2. Barre d'action de contrôle & Sélecteur de date (hauteur optimisée et compacte) */}
      <div className="rounded-2xl border border-filet bg-surface px-3 sm:px-4 py-2 sm:py-2.5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2.5 sm:gap-3">
          {/* Sélecteur de date journalière */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative flex items-center">
              <Calendar className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-lg border border-filet bg-papier/70 pl-8 pr-2.5 py-1 text-xs font-semibold text-encre focus:border-ocean-profond focus:bg-white focus:outline-none transition-colors"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold capitalize text-slate-700">
                {fmtDate(date)}
              </span>
              {date !== aujourdHui() && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDate(aujourdHui())}
                  className="h-6 px-2 text-2xs text-ocean-profond hover:bg-ocean-brume/50"
                >
                  Aujourd'hui
                </Button>
              )}
            </div>

            {/* Statut du jour sélectionné */}
            {j && !j.existe && (
              <Flag variant="a-renseigner" size="sm">
                Journée non encore saisie
              </Flag>
            )}
          </div>

          {/* Zone d'actions avec labels explicites & statut du verrou */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Statut du verrou */}
            {j?.cloture ? (
              <Flag variant="verrou" size="sm" icon={<Lock className="h-3 w-3 text-slate-500" />}>
                Données figées
              </Flag>
            ) : j?.verrou.actif ? (
              j.verrou.mien ? (
                <Flag variant="saisie-active" size="sm">
                  Mode édition actif
                </Flag>
              ) : (
                <Flag variant="verrou" size="sm" icon={<Lock className="h-3 w-3 text-slate-500" />}>
                  Verrouillé par {j.verrou.parNom}
                </Flag>
              )
            ) : (
              <Flag variant="neutre" size="sm" icon={<Lock className="h-3 w-3 text-slate-400" />}>
                Lecture seule
              </Flag>
            )}

            {/* Bouton pour prendre la main */}
            {j && !j.cloture && !j.verrou.mien && (
              <Button
                size="sm"
                variant="default"
                disabled={j.verrou.actif}
                onClick={verrouiller}
                className="h-8 bg-ocean-profond hover:bg-ocean-nuit text-xs font-semibold gap-1.5 shadow-xs"
              >
                <Unlock className="h-3.5 w-3.5" />
                Prendre la main pour saisir
              </Button>
            )}

            {/* Bouton pour ajuster les soldes J0 (Jour zéro) */}
            {peutEditer && (
              <Button
                size="sm"
                variant={editJ0 ? "secondary" : "outline"}
                onClick={() => setEditJ0((v) => !v)}
                className="h-8 text-xs"
              >
                <RotateCcw className="mr-1 h-3 w-3 text-slate-500" />
                {editJ0 ? "Masquer soldes J0" : "Soldes d'ouverture J0"}
              </Button>
            )}

            {/* Bouton pour libérer la main */}
            {peutEditer && (
              <Button
                size="sm"
                variant="outline"
                onClick={libererLaMain}
                className="h-8 text-xs text-slate-600 hover:text-slate-900"
              >
                <Lock className="mr-1 h-3 w-3 text-slate-400" />
                Libérer la main
              </Button>
            )}

            {/* Bouton Enregistrer avec puce de modification */}
            {peutEditer && (
              <Button
                size="sm"
                disabled={!dirty && !editJ0}
                onClick={sauver}
                className={cn(
                  "h-8 text-xs font-bold gap-1.5 transition-all shadow-xs",
                  dirty
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-emerald-500/20"
                    : "bg-slate-200 text-slate-500"
                )}
              >
                <Save className="h-3.5 w-3.5" />
                {dirty ? "Enregistrer les modifications •" : "Enregistré"}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Message de notification / retour d'action */}
      {msg && (
        <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50/80 px-4 py-3 text-xs text-blue-900 shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-ocean-profond shrink-0" />
            <span>{msg}</span>
          </div>
          <button
            type="button"
            onClick={() => setMsg(null)}
            className="text-blue-500 hover:text-blue-800 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* 3. Bandeau de 8 KPI clés - Disposition 4/4 (2 lignes de 4) optimisée pour les grands montants */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {/* Recette totale */}
        <div className="rounded-xl border border-ocean-profond/30 bg-[#0077b6] text-white p-3 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-bold text-blue-100">
            <span className="truncate">Recette du jour</span>
            <Flag variant="recette" size="sm">Toutes caisses</Flag>
          </div>
          <div className="text-base sm:text-lg font-bold font-mono tabular-nums tracking-tight mt-1.5 text-white">
            {fcfa(recette)}
          </div>
        </div>

        {/* F3 Poitiers */}
        <div className="rounded-xl border border-filet bg-surface p-3 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
            <span className="truncate">F3 Poitiers</span>
            <Flag variant="especes" size="sm">Espèces</Flag>
          </div>
          <div
            className={cn(
              "text-base sm:text-lg font-bold font-mono tabular-nums mt-1.5",
              (soldes.poitiers_f3 ?? 0) < 0 ? "text-carmin" : "text-encre"
            )}
          >
            {fcfa(soldes.poitiers_f3 ?? 0)}
          </div>
        </div>

        {/* OM Poitiers */}
        <div className="rounded-xl border border-filet bg-surface p-3 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
            <span className="truncate">OM Poitiers</span>
            <Flag variant="om" size="sm">Orange Money</Flag>
          </div>
          <div
            className={cn(
              "text-base sm:text-lg font-bold font-mono tabular-nums mt-1.5",
              (soldes.poitiers_om ?? 0) < 0 ? "text-carmin" : "text-encre"
            )}
          >
            {fcfa(soldes.poitiers_om ?? 0)}
          </div>
        </div>

        {/* MOMO Poitiers */}
        <div className="rounded-xl border border-filet bg-surface p-3 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
            <span className="truncate">MOMO Poitiers</span>
            <Flag variant="momo" size="sm">MTN MOMO</Flag>
          </div>
          <div
            className={cn(
              "text-base sm:text-lg font-bold font-mono tabular-nums mt-1.5",
              (soldes.poitiers_momo ?? 0) < 0 ? "text-carmin" : "text-encre"
            )}
          >
            {fcfa(soldes.poitiers_momo ?? 0)}
          </div>
        </div>

        {/* F3 Les Lilas */}
        <div className="rounded-xl border border-filet bg-surface p-3 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
            <span className="truncate">F3 Les Lilas</span>
            <Flag variant="especes" size="sm">Espèces</Flag>
          </div>
          <div
            className={cn(
              "text-base sm:text-lg font-bold font-mono tabular-nums mt-1.5",
              (soldes.lilas_f3 ?? 0) < 0 ? "text-carmin" : "text-encre"
            )}
          >
            {fcfa(soldes.lilas_f3 ?? 0)}
          </div>
        </div>

        {/* OM Les Lilas */}
        <div className="rounded-xl border border-filet bg-surface p-3 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
            <span className="truncate">OM Les Lilas</span>
            <Flag variant="om" size="sm">Orange Money</Flag>
          </div>
          <div
            className={cn(
              "text-base sm:text-lg font-bold font-mono tabular-nums mt-1.5",
              (soldes.lilas_om ?? 0) < 0 ? "text-carmin" : "text-encre"
            )}
          >
            {fcfa(soldes.lilas_om ?? 0)}
          </div>
        </div>

        {/* MOMO Les Lilas */}
        <div className="rounded-xl border border-filet bg-surface p-3 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
            <span className="truncate">MOMO Les Lilas</span>
            <Flag variant="momo" size="sm">MTN MOMO</Flag>
          </div>
          <div
            className={cn(
              "text-base sm:text-lg font-bold font-mono tabular-nums mt-1.5",
              (soldes.lilas_momo ?? 0) < 0 ? "text-carmin" : "text-encre"
            )}
          >
            {fcfa(soldes.lilas_momo ?? 0)}
          </div>
        </div>

        {/* E DR TIM Finance */}
        <div className="rounded-xl border border-filet bg-surface p-3 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
            <span className="truncate">E DR TIM Finance</span>
            <Flag variant="finance" size="sm">Finance</Flag>
          </div>
          <div
            className={cn(
              "text-base sm:text-lg font-bold font-mono tabular-nums mt-1.5",
              (soldes.edrtim_finance ?? 0) < 0 ? "text-carmin" : "text-encre"
            )}
          >
            {fcfa(soldes.edrtim_finance ?? 0)}
          </div>
        </div>
      </div>

      {/* Saisie manuelle des Soldes d'ouverture J0 (si activé) */}
      {editJ0 && (
        <Card className="border-ocean-ceruleen/40 bg-ocean-brume/20 shadow-xs animate-in fade-in duration-150">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold text-ocean-nuit flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-ocean-profond" />
              Soldes d'ouverture (J0) — Saisie manuelle des 9 soldes de départ
            </CardTitle>
            <CardDescription className="text-xs">
              Permet de fixer ou corriger les soldes de départ d'une caisse. Ces valeurs servent de base aux formules de calcul.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {SOLDES_PRINCIPAUX.map((s) => (
                <div key={s.cle} className="space-y-1">
                  <label className="text-2xs font-semibold text-encre-douce">
                    {s.libelle}
                  </label>
                  <Input
                    inputMode="numeric"
                    value={j0[s.cle] ? j0[s.cle] : ""}
                    placeholder="0"
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^\d-]/g, "");
                      setJ0({
                        ...j0,
                        [s.cle]: raw === "" ? 0 : parseInt(raw, 10) || 0,
                      });
                      setDirty(true);
                    }}
                    className="font-mono tabular-nums text-xs bg-white"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 4. DISPOSITION PRINCIPALE BICOLONNE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4.5">
        {/* =========================================================
            COLONNE GAUCHE (4 colonnes sur 12) : Synthèse & Vigilance
            ========================================================= */}
        <div className="lg:col-span-4 space-y-4">
          {/* Carte Trésorerie & Carte Visa (Couleur unie institutionnelle #03045e - Sans dégradé) */}
          <div className="relative overflow-hidden rounded-2xl bg-[#03045e] border border-blue-900/50 p-4 text-white shadow-sm">
            <div className="flex items-center justify-between pb-2.5 border-b border-white/10">
              <span className="text-2xs font-extrabold tracking-wider uppercase text-blue-200">
                Poitiers Trésorerie
              </span>
              <span className="text-sm font-black tracking-widest text-white">
                VISA
              </span>
            </div>

            <div className="my-3 space-y-0.5">
              <div className="text-2xs font-medium uppercase tracking-wider text-blue-200/70">
                Solde Carte Visa
              </div>
              <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums tracking-tight text-white">
                {fcfa(soldes.carte_visa ?? 0)}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2.5 border-t border-white/10 text-2xs">
              <div>
                <span className="block text-blue-200/70">Caisse F3 Poitiers</span>
                <b className="font-mono tabular-nums text-xs text-white">
                  {fcfa(soldes.poitiers_f3 ?? 0)}
                </b>
              </div>
              <div className="text-right">
                <span className="block text-blue-200/70">Date active</span>
                <b className="text-xs text-white">
                  {new Date(date + "T00:00:00").toLocaleDateString("fr-FR", {
                    day: "2-digit",
                    month: "short",
                  })}
                </b>
              </div>
            </div>
          </div>

          {/* Ventilation des encaissements par canal (Collection Summary) */}
          <Card className="border-filet bg-surface shadow-xs">
            <CardHeader className="pb-3 border-b border-filet/70">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-encre">
                  Encaissements du jour
                </CardTitle>
                <Badge variant="info" className="font-mono tabular-nums font-bold text-xs">
                  {fcfa(recette)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-3.5">
              {/* Espèces */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 font-medium text-slate-700">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
                    Espèces (Caisse F3)
                  </span>
                  <span className="font-mono tabular-nums font-semibold text-slate-800">
                    {fcfa(canaux.especes)}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-emerald-600 rounded-full transition-all duration-300"
                    style={{
                      width: `${recette > 0 ? (canaux.especes / recette) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              {/* Orange Money */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 font-medium text-slate-700">
                    <span className="h-2.5 w-2.5 rounded-full bg-orange-600" />
                    Orange Money (OM)
                  </span>
                  <span className="font-mono tabular-nums font-semibold text-slate-800">
                    {fcfa(canaux.om)}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-orange-600 rounded-full transition-all duration-300"
                    style={{
                      width: `${recette > 0 ? (canaux.om / recette) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              {/* MTN MOMO */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 font-medium text-slate-700">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-600" />
                    MTN Mobile Money
                  </span>
                  <span className="font-mono tabular-nums font-semibold text-slate-800">
                    {fcfa(canaux.momo)}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-amber-600 rounded-full transition-all duration-300"
                    style={{
                      width: `${recette > 0 ? (canaux.momo / recette) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              {/* Banque & Chèques */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 font-medium text-slate-700">
                    <span className="h-2.5 w-2.5 rounded-full bg-ocean-profond" />
                    Chèques & Carte Visa
                  </span>
                  <span className="font-mono tabular-nums font-semibold text-slate-800">
                    {fcfa(canaux.banque)}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-ocean-profond rounded-full transition-all duration-300"
                    style={{
                      width: `${recette > 0 ? (canaux.banque / recette) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              {/* Autres prestations */}
              {canaux.autres > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 font-medium text-slate-700">
                      <span className="h-2.5 w-2.5 rounded-full bg-indigo-600" />
                      Autres prestations
                    </span>
                    <span className="font-mono tabular-nums font-semibold text-slate-800">
                      {fcfa(canaux.autres)}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                      style={{
                        width: `${recette > 0 ? (canaux.autres / recette) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Total des retraits du jour */}
              <div className="pt-3 border-t border-filet flex items-center justify-between text-xs">
                <span className="font-semibold text-carmin">
                  Total des retraits (décaissements)
                </span>
                <b className="font-mono tabular-nums font-bold text-carmin">
                  {fcfa(canaux.retraits)}
                </b>
              </div>
            </CardContent>
          </Card>

          {/* Évolution des recettes (Sparkline interactif) */}
          {chronoHisto.length > 1 && (
            <Card className="border-filet bg-surface shadow-xs">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between text-xs">
                  <CardTitle className="text-xs font-bold text-encre">
                    Tendance des 14 derniers jours
                  </CardTitle>
                  <span className="text-2xs text-encre-pale font-mono">
                    Pic : {fcfa(maxRecetteHisto)}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-1">
                <div className="h-16 w-full">
                  <svg
                    viewBox="0 0 320 60"
                    className="w-full h-full overflow-visible"
                  >
                    <defs>
                      <linearGradient id="sparkGradOcean" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0077b6" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#0077b6" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    {(() => {
                      const step = 320 / (chronoHisto.length - 1);
                      const pts = chronoHisto.map((h: any, i: number) => {
                        const x = i * step;
                        const y = 52 - (h.recetteTotale / maxRecetteHisto) * 44;
                        return { x, y, date: h.date, recette: h.recetteTotale };
                      });
                      const ptsStr = pts.map((p) => `${p.x},${p.y}`).join(" ");
                      const fillStr = `0,56 ${ptsStr} 320,56`;
                      return (
                        <>
                          <polygon points={fillStr} fill="url(#sparkGradOcean)" />
                          <polyline
                            points={ptsStr}
                            fill="none"
                            stroke="#0077b6"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          {pts.map((p) => (
                            <circle
                              key={p.date}
                              cx={p.x}
                              cy={p.y}
                              r={p.date === date ? 4.5 : 2.5}
                              fill={p.date === date ? "#03045e" : "#0077b6"}
                              stroke="#fff"
                              strokeWidth={1.5}
                              className="cursor-pointer hover:scale-125 transition-transform"
                              onClick={() => setDate(p.date)}
                            >
                              <title>{`${p.date} : ${fcfa(p.recette)}`}</title>
                            </circle>
                          ))}
                        </>
                      );
                    })()}
                  </svg>
                </div>
                <div className="text-2xs text-slate-400 text-center mt-1">
                  Cliquez sur un point pour charger la journée correspondante
                </div>
              </CardContent>
            </Card>
          )}

          {/* Soldes consolidés détaillés (Accordéon compact) */}
          <Card className="border-filet bg-surface shadow-xs">
            <CardHeader
              className="p-3.5 cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => setVoirSoldesDetails((v) => !v)}
            >
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <span>Tous les soldes consolidés ({SOLDES_PRINCIPAUX.length})</span>
                <span className="text-2xs text-ocean-profond font-bold flex items-center gap-1">
                  {voirSoldesDetails ? (
                    <>Masquer <ChevronUp className="h-3 w-3" /></>
                  ) : (
                    <>Afficher <ChevronDown className="h-3 w-3" /></>
                  )}
                </span>
              </div>
            </CardHeader>
            {voirSoldesDetails && (
              <CardContent className="p-3.5 pt-0 border-t border-filet space-y-2">
                {SOLDES_PRINCIPAUX.map((s) => (
                  <div
                    key={s.cle}
                    title={formule(s)}
                    className="flex items-center justify-between text-xs py-1 border-b border-slate-100 last:border-0"
                  >
                    <span className="text-slate-600 truncate max-w-[200px]">
                      {s.libelle}
                    </span>
                    <span
                      className={cn(
                        "font-mono tabular-nums font-semibold",
                        (soldes[s.cle] ?? 0) < 0 ? "text-carmin" : "text-slate-900"
                      )}
                    >
                      {fcfa(soldes[s.cle] ?? 0)}
                    </span>
                  </div>
                ))}
              </CardContent>
            )}
          </Card>

          {/* Notes & Observations du jour */}
          <Card className="border-filet bg-surface shadow-xs">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-bold text-encre">
                  Notes & Observations de la journée
                </CardTitle>
                {dirty && <Badge variant="attente" className="text-2xs">Non sauvé</Badge>}
              </div>
            </CardHeader>
            <CardContent className="p-3.5 pt-1">
              <textarea
                rows={3}
                disabled={!peutEditer}
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value);
                  setDirty(true);
                }}
                placeholder="Ex : Remise d'espèces en banque, incident de caisse, justificatif manquant..."
                className="w-full rounded-xl border border-filet bg-papier/60 p-2.5 text-xs text-encre placeholder:text-slate-400 focus:border-ocean-profond focus:bg-white focus:outline-none transition-colors disabled:opacity-60 resize-y"
              />
            </CardContent>
          </Card>
        </div>

        {/* =========================================================
            COLONNE DROITE (8 colonnes sur 12) : Poste de Saisie
            ========================================================= */}
        <div className="lg:col-span-8 space-y-4">
          {/* ÉTAPE 1 : Guidage et Choix de la Caisse à renseigner */}
          <div className="rounded-2xl border border-blue-200/80 bg-gradient-to-r from-blue-50/90 via-white to-blue-50/50 p-3 sm:p-3.5 shadow-2xs space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-start sm:items-center gap-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-ocean-profond text-white font-black text-xs shadow-xs">
                  1
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-ocean-nuit">
                      Sélectionnez la caisse à renseigner
                    </span>
                    <Flag variant="finance" size="sm">
                      Étape obligatoire
                    </Flag>
                  </div>
                  <p className="text-2xs text-slate-600">
                    Cliquez sur une caisse ci-dessous pour ouvrir et saisir ses entrées et retraits du jour.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <Flag variant="neutre" size="sm" className="font-mono bg-white">
                  {nbCaissesRenseignees} / {BLOCS.length} caisses avec saisie
                </Flag>
                {peutEditer ? (
                  <Flag variant="saisie-active" size="sm">
                    <PenLine className="h-3 w-3 inline mr-1" />
                    Saisie débloquée
                  </Flag>
                ) : (
                  <Flag variant="verrou" size="sm" icon={<Lock className="h-3 w-3 text-slate-500" />}>
                    Lecture seule
                  </Flag>
                )}
              </div>
            </div>

            {/* Grille sélecteur des 8 caisses */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              {BLOCS.map((b) => {
                const estActif = b.cle === caisseActive;
                const totalCaisse = b.lignes
                  .filter((l) => l.sens === "entree")
                  .reduce((t, l) => t + (draft[b.cle]?.[l.cle] ?? 0), 0);
                const aDesRetraits =
                  b.lignes
                    .filter((l) => l.sens === "retrait")
                    .reduce((t, l) => t + (draft[b.cle]?.[l.cle] ?? 0), 0) > 0;
                const aDonnees = totalCaisse > 0 || aDesRetraits;

                return (
                  <button
                    key={b.cle}
                    type="button"
                    onClick={() => setCaisseActive(b.cle)}
                    className={cn(
                      "relative flex flex-col items-start gap-1 rounded-xl p-2.5 text-left transition-all cursor-pointer border",
                      estActif
                        ? "bg-ocean-profond text-white border-ocean-profond shadow-sm ring-2 ring-ocean-ceruleen/50 ring-offset-1"
                        : aDonnees
                        ? "bg-emerald-50/70 border-emerald-300/80 hover:bg-emerald-100/70 text-slate-800"
                        : "bg-white border-dashed border-slate-300 hover:border-ocean-profond/60 hover:bg-blue-50/40 text-slate-700"
                    )}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span
                        className={cn(
                          "text-xs font-bold truncate",
                          estActif ? "text-white" : "text-slate-900"
                        )}
                      >
                        {b.libelle}
                      </span>
                      {estActif && (
                        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                      )}
                    </div>

                    <div className="flex items-center justify-between w-full mt-1">
                      {estActif ? (
                        <Flag variant="saisie-active" size="xs" className="bg-white/20 text-white border-white/30">
                          Saisie active
                        </Flag>
                      ) : aDonnees ? (
                        <Flag variant="renseigne" size="xs">
                          ✓ {fcfa(totalCaisse)}
                        </Flag>
                      ) : (
                        <Flag variant="a-renseigner" size="xs">
                          À renseigner
                        </Flag>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ÉTAPE 2 : Station de saisie de la caisse active */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-ocean-nuit text-white font-black text-xs shadow-xs">
                2
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-encre">
                Feuille de saisie journalière : <b className="text-ocean-profond">{blocActif.libelle}</b>
              </span>
            </div>
            {!peutEditer && (
              <span className="text-2xs text-amber-700 font-medium hidden sm:inline-block">
                🔒 Cliquez sur "Prendre la main pour saisir" en haut pour éditer
              </span>
            )}
          </div>

          {/* Station de saisie de la caisse active */}
          <Card className="border-filet bg-surface shadow-xs overflow-hidden">
            {/* Bannière d'aide contextuelle pour la saisie */}
            {!peutEditer && (
              <div className="bg-amber-50 border-b border-amber-200/80 px-4 py-2.5 text-xs text-amber-900 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="h-3.5 w-3.5 text-amber-700 shrink-0" />
                  <span>
                    <strong>Consultation seule :</strong> Pour saisir ou modifier les entrées et sorties de <u>{blocActif.libelle}</u>, activez le bouton <strong>« Prendre la main pour saisir »</strong> en haut.
                  </span>
                </div>
              </div>
            )}

            {/* En-tête de la station */}
            <CardHeader className="p-3.5 sm:p-4 border-b border-filet bg-papier/40">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-ocean-profond" />
                    <CardTitle className="text-base font-bold text-encre">
                      {blocActif.libelle}
                    </CardTitle>
                    <Flag variant="neutre" size="xs" className="font-mono">
                      {blocActif.lignes.length} flux
                    </Flag>
                  </div>
                  <CardDescription className="text-xs text-encre-douce mt-0.5">
                    Renseignez les montants des flux pour cette caisse
                  </CardDescription>
                </div>

                <div className="text-right bg-white px-3.5 py-2 rounded-xl border border-filet shadow-2xs">
                  <div className="text-2xs font-medium uppercase tracking-wider text-slate-500">
                    Entrées :{" "}
                    <strong className="text-emerald-700 font-mono">
                      {fcfa(sousTotalActif)}
                    </strong>
                    {sousTotalRetraitsActif > 0 && (
                      <>
                        {" · "}Retraits :{" "}
                        <strong className="text-carmin font-mono">
                          {fcfa(sousTotalRetraitsActif)}
                        </strong>
                      </>
                    )}
                  </div>
                  <div className="text-sm font-extrabold text-ocean-nuit font-mono tabular-nums mt-0.5">
                    Flux net : {fcfa(sousTotalActif - sousTotalRetraitsActif)}
                  </div>
                </div>
              </div>
            </CardHeader>

            {/* Lignes de saisie de la caisse */}
            <CardContent className="p-4 space-y-3">
              <div className="divide-y divide-slate-100">
                {blocActif.lignes.map((l) => {
                  const cle = CLE_PIECE(blocActif.cle, l.cle);
                  const piece = j?.pieces[cle];
                  const estRetrait = l.sens === "retrait";
                  return (
                    <div
                      key={l.cle}
                      className="grid grid-cols-1 sm:grid-cols-12 items-center gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      {/* Libellé & Sens comptable */}
                      <div className="sm:col-span-6 space-y-1">
                        <div className="text-xs font-semibold text-encre">
                          {l.libelle}
                        </div>
                        <Flag
                          variant={estRetrait ? "a-renseigner" : "renseigne"}
                          size="xs"
                        >
                          {estRetrait ? "Retrait (débit)" : "Entrée (crédit)"}
                        </Flag>
                      </div>

                      {/* Champ de saisie monétaire */}
                      <div className="sm:col-span-4">
                        <div className="relative flex items-center">
                          <Input
                            inputMode="numeric"
                            disabled={!peutEditer}
                            value={
                              draft[blocActif.cle]?.[l.cle]
                                ? draft[blocActif.cle][l.cle]
                                : ""
                            }
                            placeholder="0"
                            onFocus={(e) => e.target.select()}
                            onChange={(e) =>
                              setMontant(blocActif.cle, l.cle, e.target.value)
                            }
                            className={cn(
                              "font-mono tabular-nums text-xs pr-12 bg-white",
                              estRetrait && "text-carmin font-semibold",
                              !peutEditer && "bg-slate-50 opacity-75"
                            )}
                          />
                          <span className="pointer-events-none absolute right-3 text-2xs font-bold text-slate-400">
                            FCFA
                          </span>
                        </div>
                      </div>

                      {/* Pièce justificative */}
                      <div className="sm:col-span-2 text-right">
                        {piece ? (
                          <Button
                            asChild
                            size="sm"
                            variant="outline"
                            className="h-8 text-2xs font-semibold text-emerald-700 hover:bg-emerald-50 border-emerald-300"
                          >
                            <a href={piece} target="_blank" rel="noreferrer">
                              <Paperclip className="mr-1 h-3 w-3" />
                              Voir reçu
                            </a>
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={!peutEditer}
                            onClick={() => {
                              setUploadCle(cle);
                              fileRef.current?.click();
                            }}
                            className="h-8 text-2xs text-slate-500 hover:text-ocean-profond"
                          >
                            <Plus className="mr-1 h-3 w-3" />
                            Justificatif
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Soldes recalculés automatiquement pour cette caisse */}
              {soldesDuBloc.length > 0 && (
                <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50/50 p-3.5 space-y-2">
                  <div className="text-2xs font-bold uppercase tracking-wider text-ocean-profond">
                    Soldes recalculés pour {blocActif.libelle}
                  </div>
                  {soldesDuBloc.map((s) => (
                    <div
                      key={s.cle}
                      className="rounded-lg bg-white p-2.5 border border-blue-100/80 shadow-2xs space-y-1"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <b className="text-ocean-nuit">
                          {s.libelle} :{" "}
                          <span className="font-mono tabular-nums font-extrabold text-blue-700">
                            {fcfa(soldes[s.cle] ?? 0)}
                          </span>
                        </b>
                        <span className="text-2xs text-slate-500 font-mono">
                          Ouverture J-1 : {fcfa(ouverture[s.cle] ?? 0)}
                        </span>
                      </div>
                      <div className="text-2xs text-slate-500 font-mono">
                        = {formule(s)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>

            {/* Pied de station : navigation et sauvegarde rapide */}
            <div className="p-4 border-t border-filet bg-papier/30 flex items-center justify-between">
              <div>
                {blocPrecedent ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCaisseActive(blocPrecedent.cle)}
                    className="text-xs"
                  >
                    <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                    {blocPrecedent.libelle}
                  </Button>
                ) : (
                  <span />
                )}
              </div>

              <div className="flex items-center gap-2">
                {peutEditer && (
                  <Button
                    size="sm"
                    disabled={!dirty}
                    onClick={sauver}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                  >
                    <Save className="mr-1.5 h-3.5 w-3.5" />
                    Sauvegarder
                  </Button>
                )}
                {blocSuivant && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => setCaisseActive(blocSuivant.cle)}
                    className="bg-ocean-profond hover:bg-ocean-nuit text-xs"
                  >
                    {blocSuivant.libelle}
                    <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        hidden
        onChange={(e) => e.target.files?.[0] && envoyerPiece(e.target.files[0])}
      />

      {/* 5. HISTORIQUE & CLÔTURE MENSUELLE SÉCURISÉE */}
      <Card className="border-filet bg-surface shadow-xs">
        <CardHeader className="p-4 pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-bold text-encre">
                Historique des 14 dernières journées & Clôture mensuelle
              </CardTitle>
              <CardDescription className="text-xs text-encre-douce mt-0.5">
                Consultez les journées précédentes ou procédez à la clôture officielle du mois ({libellePeriode(j?.periode ?? "")})
              </CardDescription>
            </div>

            <div className="flex items-center gap-2.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setVoirHisto((v) => !v)}
                className="text-xs"
              >
                {voirHisto ? (
                  <>Masquer l'historique <ChevronUp className="ml-1.5 h-3.5 w-3.5" /></>
                ) : (
                  <>Voir les 14 dernières journées <ChevronDown className="ml-1.5 h-3.5 w-3.5" /></>
                )}
              </Button>

              {/* Clôture irréversible protégée par dialogue modal de confirmation */}
              {j && !j.cloture && peutEditer && (
                <BoutonConfirmation
                  libelle={`Clôturer ${libellePeriode(j.periode)}`}
                  titre={`Clôturer définitivement le mois de ${libellePeriode(j.periode)} ?`}
                  consequence={`Cette action est irréversible. Toutes les journées de trésorerie de ${libellePeriode(j.periode)} seront figées et certifiées. Aucune modification ne pourra plus être apportée.`}
                  motCle="CLOTURER"
                  confirmer="Clôturer définitivement le mois"
                  onConfirmer={async () => {
                    const r = await cloturer({ periode: j.periode });
                    setMsg(
                      `${libellePeriode(r.periode)} clôturé avec succès : ${r.journees} journée(s) certifiée(s).`
                    );
                  }}
                  variant="destructive"
                  size="sm"
                />
              )}
            </div>
          </div>
        </CardHeader>

        {voirHisto && (
          <CardContent className="p-4 pt-0">
            <div className="rounded-xl border border-filet overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead numerique>Recette Totale</TableHead>
                    <TableHead numerique>F3 Poitiers</TableHead>
                    <TableHead numerique>OM Poitiers</TableHead>
                    <TableHead numerique>MOMO Poitiers</TableHead>
                    <TableHead numerique>F3 Lilas</TableHead>
                    <TableHead numerique>Carte Visa</TableHead>
                    <TableHead>État</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(histo ?? []).map((h: any) => {
                    const estJourSelectionne = h.date === date;
                    return (
                      <TableRow
                        key={h.date}
                        onClick={() => setDate(h.date)}
                        className={cn(
                          "cursor-pointer transition-colors",
                          estJourSelectionne
                            ? "bg-ocean-brume/30 font-semibold"
                            : "hover:bg-slate-50"
                        )}
                      >
                        <TableCell className="font-medium">
                          {new Date(h.date + "T00:00:00").toLocaleDateString("fr-FR")}
                          {estJourSelectionne && (
                            <Badge variant="info" className="ml-2 text-2xs py-0">Actif</Badge>
                          )}
                        </TableCell>
                        <TableCell numerique className="font-bold text-ocean-nuit font-mono">
                          {fcfa(h.recetteTotale)}
                        </TableCell>
                        <TableCell numerique className="font-mono">
                          {fcfa(h.soldes.poitiers_f3 ?? 0)}
                        </TableCell>
                        <TableCell numerique className="font-mono">
                          {fcfa(h.soldes.poitiers_om ?? 0)}
                        </TableCell>
                        <TableCell numerique className="font-mono">
                          {fcfa(h.soldes.poitiers_momo ?? 0)}
                        </TableCell>
                        <TableCell numerique className="font-mono">
                          {fcfa(h.soldes.lilas_f3 ?? 0)}
                        </TableCell>
                        <TableCell numerique className="font-mono">
                          {fcfa(h.soldes.carte_visa ?? 0)}
                        </TableCell>
                        <TableCell>
                          {h.cloture ? (
                            <Badge variant="verrou">Clôturée</Badge>
                          ) : (
                            <Badge variant="succes">Ouverte</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {histo && histo.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-6 text-slate-400">
                        Aucune journée saisie avant cette date.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}


import { useState, useRef, useMemo } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { messageErreur } from "../lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Flag } from "@/components/ui/flag";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BoutonConfirmation } from "@/components/app/bouton-action";
import { cn } from "@/lib/utils";
import {
  FileText,
  UploadCloud,
  Search,
  Lock,
  Sparkles,
  Download,
  ShieldAlert,
  FolderOpen,
  Plus,
  X,
  KeyRound,
  CheckCircle2,
  FileSpreadsheet,
  FileImage,
  FileCode,
  FileArchive,
  FileCheck,
  ChevronUp,
  Trash2,
  LayoutGrid,
  Rows3,
} from "lucide-react";

const NIVEAUX = [
  [1, "Niveau 1 — Tous les membres"],
  [2, "Niveau 2 — Chef d'équipe et plus"],
  [3, "Niveau 3 — Comptabilité et plus"],
  [4, "Niveau 4 — Ressources Humaines et plus"],
  [5, "Niveau 5 — Direction (DA1 et plus)"],
  [6, "Niveau 6 — Direction Générale Adjointe (DA2)"],
  [7, "Niveau 7 — Directeur Général seul (DG)"],
] as const;

const CATEGORIES = [
  "Factures",
  "Contrats",
  "Paie",
  "Procédures",
  "Rapports",
  "Devis",
  "Comptes rendus",
  "Administratif",
  "Divers",
];

const ko = (n: number) => {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} Mo`;
  return `${Math.max(1, Math.round(n / 1024))} Ko`;
};

const getFileIconAndBadge = (typeMime: string, nomFichier: string) => {
  const ext = nomFichier.split(".").pop()?.toUpperCase() || "DOC";
  if (typeMime.includes("pdf") || ext === "PDF") {
    return {
      icon: <FileText className="h-5 w-5 text-rose-600" />,
      badgeClass: "bg-rose-50 text-rose-700 border-rose-200/80",
      ext: "PDF",
    };
  }
  if (
    typeMime.includes("sheet") ||
    typeMime.includes("excel") ||
    ["XLS", "XLSX", "CSV"].includes(ext)
  ) {
    return {
      icon: <FileSpreadsheet className="h-5 w-5 text-emerald-600" />,
      badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
      ext: ext || "XLS",
    };
  }
  if (typeMime.includes("image") || ["PNG", "JPG", "JPEG", "WEBP"].includes(ext)) {
    return {
      icon: <FileImage className="h-5 w-5 text-purple-600" />,
      badgeClass: "bg-purple-50 text-purple-700 border-purple-200/80",
      ext: ext || "IMG",
    };
  }
  if (["ZIP", "RAR", "7Z", "TAR", "GZ"].includes(ext)) {
    return {
      icon: <FileArchive className="h-5 w-5 text-amber-600" />,
      badgeClass: "bg-amber-50 text-amber-700 border-amber-200/80",
      ext: ext || "ZIP",
    };
  }
  if (typeMime.includes("json") || typeMime.includes("xml") || ["XML", "JSON", "TS", "JS"].includes(ext)) {
    return {
      icon: <FileCode className="h-5 w-5 text-sky-600" />,
      badgeClass: "bg-sky-50 text-sky-700 border-sky-200/80",
      ext: ext || "CODE",
    };
  }
  return {
    icon: <FileText className="h-5 w-5 text-ocean-profond" />,
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200/80",
    ext: ext || "DOC",
  };
};

type Form = {
  fichierId: string | null;
  nomFichier: string;
  taille: number;
  typeMime: string;
  titre: string;
  description: string;
  categorie: string;
  niveauVisible: number;
  niveauTelechargement: number;
  confidentiel: boolean;
  codeAcces: string;
  mode: "ia" | "heuristique" | "manuel";
  detail?: string;
};

const FORM_VIDE: Form = {
  fichierId: null,
  nomFichier: "",
  taille: 0,
  typeMime: "",
  titre: "",
  description: "",
  categorie: "Divers",
  niveauVisible: 1,
  niveauTelechargement: 2,
  confidentiel: false,
  codeAcces: "",
  mode: "manuel",
};

export function Documents() {
  const [recherche, setRecherche] = useState("");
  const [categorieFiltre, setCategorieFiltre] = useState("");
  const liste = useQuery(api.documents.liste, {
    recherche: recherche || undefined,
  });

  const genererUploadUrl = useMutation(api.documents.genererUploadUrl);
  const deposer = useMutation(api.documents.deposer);
  const obtenirUrl = useMutation(api.documents.obtenirUrl);
  const supprimer = useMutation(api.documents.supprimer);
  const extraire = useAction(api.documentsIa.extraireMetadonnees);

  const [formOuvert, setFormOuvert] = useState(false);
  const [f, setF] = useState<Form>(FORM_VIDE);
  const [analyse, setAnalyse] = useState(false);
  const [msg, setMsg] = useState<{ type: "succes" | "erreur"; texte: string } | null>(null);
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [demandeCode, setDemandeCode] = useState<string | null>(null);
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [dragOver, setDragOver] = useState(false);
  // Vue « tableau » (dense, même grammaire que Interventions) ou « cartes ».
  const [vue, setVue] = useState<"tableau" | "cartes">(() => {
    try { return window.localStorage.getItem("documents:vue") === "cartes" ? "cartes" : "tableau"; } catch { return "tableau"; }
  });
  const changerVue = (v: "tableau" | "cartes") => {
    setVue(v);
    try { window.localStorage.setItem("documents:vue", v); } catch { /* ignoré */ }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const monNiveau = liste?.monNiveau ?? 1;

  // Tous les documents visibles correspondant à la recherche texte
  const tousDocs = useMemo(() => liste?.documents ?? [], [liste?.documents]);

  // Décompte précis du nombre d'éléments par catégorie
  const compteurs = useMemo(() => {
    const res: Record<string, number> = {};
    for (const d of tousDocs) {
      const c = d.categorie || "Divers";
      res[c] = (res[c] || 0) + 1;
    }
    return res;
  }, [tousDocs]);

  // Documents filtrés par la catégorie active
  const docs = useMemo(() => {
    if (!categorieFiltre) return tousDocs;
    return tousDocs.filter((d: any) => (d.categorie || "Divers") === categorieFiltre);
  }, [tousDocs, categorieFiltre]);

  // Métriques de synthèse globales
  const nbConfidentiels = useMemo(() => tousDocs.filter((d: any) => d.confidentiel).length, [tousDocs]);
  const nbIa = useMemo(() => tousDocs.filter((d: any) => d.modeMeta === "ia").length, [tousDocs]);
  const nbCategories = useMemo(
    () => new Set(tousDocs.map((d: any) => d.categorie || "Divers")).size,
    [tousDocs]
  );

  // Catégories ordonnées : celles avec des éléments en premier (par volume décroissant),
  // puis les autres catégories de référence avec (0)
  const categoriesDisponibles = useMemo(() => {
    const ens = new Set([...(liste?.categories ?? []), ...CATEGORIES]);
    return Array.from(ens).sort((a, b) => {
      const qteA = compteurs[a] || 0;
      const qteB = compteurs[b] || 0;
      if (qteA > 0 && qteB === 0) return -1;
      if (qteA === 0 && qteB > 0) return 1;
      if (qteA !== qteB) return qteB - qteA;
      return a.localeCompare(b);
    });
  }, [liste?.categories, compteurs]);

  const traiterFichier = async (file: File) => {
    setAnalyse(true);
    setMsg(null);
    setFormOuvert(true);
    try {
      const url = await genererUploadUrl();
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      const { storageId } = await res.json();
      const meta = await extraire({
        fichierId: storageId,
        nomFichier: file.name,
        typeMime: file.type || "application/octet-stream",
      });

      setF({
        ...FORM_VIDE,
        fichierId: storageId,
        nomFichier: file.name,
        taille: file.size,
        typeMime: file.type || "application/octet-stream",
        titre: meta.titre || file.name.replace(/\.[^/.]+$/, ""),
        description: meta.description || "",
        categorie: meta.categorie || "Divers",
        mode: meta.mode,
        detail: meta.detail,
      });
    } catch (e) {
      setMsg({ type: "erreur", texte: `Erreur lors de l'analyse : ${messageErreur(e)}` });
    } finally {
      setAnalyse(false);
    }
  };

  const enregistrer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.fichierId || !f.titre.trim()) return;
    try {
      await deposer({
        fichierId: f.fichierId as any,
        nomFichier: f.nomFichier,
        taille: f.taille,
        typeMime: f.typeMime,
        titre: f.titre.trim(),
        description: f.description.trim() || undefined,
        categorie: f.categorie || undefined,
        niveauVisible: f.niveauVisible,
        niveauTelechargement: f.niveauTelechargement,
        confidentiel: f.confidentiel,
        codeAcces: f.codeAcces.trim() || undefined,
        modeMeta: f.mode,
      });
      setMsg({ type: "succes", texte: `Le document « ${f.titre.trim()} » a été déposé et indexé avec succès.` });
      setF(FORM_VIDE);
      setFormOuvert(false);
    } catch (err) {
      setMsg({ type: "erreur", texte: `Erreur d'enregistrement : ${messageErreur(err)}` });
    }
  };

  const telecharger = async (d: any) => {
    const id = String(d._id);
    if (d.codeRequis && demandeCode !== id) {
      setDemandeCode(id);
      return;
    }
    try {
      const r = await obtenirUrl({ documentId: d._id, code: codes[id] });
      setErreurs((m) => ({ ...m, [id]: "" }));
      setDemandeCode(null);
      window.open(r.url, "_blank", "noopener");
    } catch (err) {
      setErreurs((m) => ({ ...m, [id]: messageErreur(err) }));
    }
  };

  const supprimerDocument = async (id: string) => {
    try {
      await supprimer({ documentId: id as any });
      setMsg({ type: "succes", texte: "Document supprimé de l'espace d'archivage." });
    } catch (err) {
      setMsg({ type: "erreur", texte: `Erreur : ${messageErreur(err)}` });
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. En-tête institutionnel & Accréditation de l'utilisateur */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-encre">
            Gestion documentaire & Archives
          </h1>
          <p className="text-xs sm:text-sm text-encre-douce">
            Espace sécurisé de conservation, d'indexation par IA et de diffusion cloisonnée des pièces
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Flag variant="finance" size="sm">
            Accréditation : Niveau {monNiveau}
          </Flag>
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
                <ChevronUp className="h-3.5 w-3.5" /> Masquer le formulaire
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5" /> Déposer un document
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 2. Bandeau compact de 4 KPI documentaires */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        {/* Total documents visibles */}
        <div className="rounded-xl border border-filet bg-surface p-3 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
            <span className="truncate">Documents visibles</span>
            <Flag variant="finance" size="xs">
              GED
            </Flag>
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono tabular-nums text-encre mt-1">
            {tousDocs.length}
          </div>
        </div>

        {/* Catégories répertoriées */}
        <div className="rounded-xl border border-filet bg-surface p-3 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
            <span className="truncate">Catégories actives</span>
            <Flag variant="especes" size="xs">
              Classement
            </Flag>
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono tabular-nums text-encre mt-1">
            {nbCategories}
          </div>
        </div>

        {/* Documents confidentiels */}
        <div className="rounded-xl border border-filet bg-surface p-3 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
            <span className="truncate">Confidentiels (DAF/DG)</span>
            <Flag variant="om" size="xs">
              Cloisonné
            </Flag>
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono tabular-nums text-encre mt-1">
            {nbConfidentiels}
          </div>
        </div>

        {/* Indexés par IA */}
        <div className="rounded-xl border border-filet bg-surface p-3 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
            <span className="truncate">Indexés par IA</span>
            <Flag variant="direct" size="xs">
              Gemini
            </Flag>
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono tabular-nums text-encre mt-1">
            {nbIa}
          </div>
        </div>
      </div>

      {/* Notifications / Messages de retour */}
      {msg && (
        <div
          className={cn(
            "flex items-center justify-between rounded-xl px-4 py-2.5 text-xs shadow-2xs border transition-all",
            msg.type === "succes"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-rose-200 bg-rose-50 text-rose-900"
          )}
        >
          <div className="flex items-center gap-2">
            {msg.type === "succes" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <ShieldAlert className="h-4 w-4 text-rose-600 shrink-0" />
            )}
            <span>{msg.texte}</span>
          </div>
          <button
            type="button"
            onClick={() => setMsg(null)}
            className="text-slate-400 hover:text-slate-700 font-bold ml-3"
          >
            ✕
          </button>
        </div>
      )}

      {/* 3. Zone de Dépôt de Document & Qualification IA (Dépliable) */}
      {formOuvert && (
        <Card className="border-ocean-ceruleen/40 bg-surface shadow-sm overflow-hidden animate-in fade-in duration-200">
          <CardHeader className="p-4 pb-3 border-b border-filet bg-blue-50/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UploadCloud className="h-5 w-5 text-ocean-profond" />
                <CardTitle className="text-sm sm:text-base font-bold text-ocean-nuit">
                  Dépôt et indexation d'un nouveau document
                </CardTitle>
              </div>
              <button
                type="button"
                onClick={() => setFormOuvert(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <CardDescription className="text-xs text-encre-douce">
              Glissez votre fichier : l'IA analyse automatiquement son contenu pour pré-remplir le titre, la description et la catégorie.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-4 sm:p-5 space-y-4">
            {/* Zone Drag & Drop */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                if (e.dataTransfer.files?.[0]) {
                  traiterFichier(e.dataTransfer.files[0]);
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "relative flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-2xl cursor-pointer transition-all",
                dragOver
                  ? "border-ocean-profond bg-blue-50/80 scale-[0.99]"
                  : "border-slate-300 hover:border-ocean-ceruleen bg-papier/50 hover:bg-blue-50/30"
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                hidden
                disabled={analyse}
                onChange={(e) => e.target.files?.[0] && traiterFichier(e.target.files[0])}
              />

              <div className="h-10 w-10 rounded-full bg-blue-100/80 flex items-center justify-center text-ocean-profond mb-2 shadow-2xs">
                {analyse ? (
                  <Sparkles className="h-5 w-5 text-amber-500 animate-spin" />
                ) : (
                  <UploadCloud className="h-5 w-5" />
                )}
              </div>

              {analyse ? (
                <div className="text-center space-y-1">
                  <span className="text-xs font-bold text-ocean-nuit flex items-center justify-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
                    Analyse et extraction automatique des métadonnées par IA en cours…
                  </span>
                  <p className="text-2xs text-slate-500">
                    Veuillez patienter pendant le téléversement et l'indexation sémantique
                  </p>
                </div>
              ) : (
                <div className="text-center space-y-1">
                  <span className="text-xs font-bold text-ocean-nuit">
                    Cliquez pour sélectionner un fichier ou glissez-le ici
                  </span>
                  <p className="text-2xs text-slate-500">
                    PDF, documents Word, feuilles Excel, images, archives comprimées
                  </p>
                </div>
              )}
            </div>

            {/* Fichier détecté & Rapport de l'IA */}
            {f.fichierId && (
              <div className="rounded-xl border border-blue-200/80 bg-blue-50/60 p-3 space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <FileCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span className="font-bold text-slate-900">{f.nomFichier}</span>
                    <span className="text-2xs text-slate-500 font-mono font-medium">
                      ({ko(f.taille)})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Flag
                      variant={f.mode === "ia" ? "direct" : "neutre"}
                      size="xs"
                    >
                      {f.mode === "ia"
                        ? "Indexé par IA"
                        : f.mode === "heuristique"
                        ? "Indexé (heuristique)"
                        : "Manuel"}
                    </Flag>
                    {f.detail && (
                      <span className="text-2xs text-slate-500 hidden sm:inline">
                        — {f.detail}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Formulaire de métadonnées et sécurité */}
            <form onSubmit={enregistrer} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Colonne Gauche : Métadonnées documentaires */}
                <div className="space-y-3">
                  <div>
                    <label className="text-2xs font-bold uppercase tracking-wider text-slate-600 block mb-1">
                      Titre du document <span className="text-rose-600">*</span>
                    </label>
                    <Input
                      required
                      disabled={!f.fichierId || analyse}
                      value={f.titre}
                      onChange={(e) => setF({ ...f, titre: e.target.value })}
                      placeholder="Ex: Facture réactif Scanner Septembre 2026"
                      className="text-xs bg-white"
                    />
                  </div>

                  <div>
                    <label className="text-2xs font-bold uppercase tracking-wider text-slate-600 block mb-1">
                      Description & Mots-clés
                    </label>
                    <textarea
                      rows={2}
                      disabled={!f.fichierId || analyse}
                      value={f.description}
                      onChange={(e) => setF({ ...f, description: e.target.value })}
                      placeholder="Ex: Reçu certifié fournisseur, bon de commande associé..."
                      className="w-full rounded-xl border border-filet bg-white p-2 text-xs text-encre focus:border-ocean-profond focus:outline-none transition-colors disabled:opacity-60 resize-y"
                    />
                  </div>

                  <div>
                    <label className="text-2xs font-bold uppercase tracking-wider text-slate-600 block mb-1">
                      Catégorie de classement
                    </label>
                    <div className="flex gap-2">
                      <select
                        disabled={!f.fichierId || analyse}
                        value={f.categorie}
                        onChange={(e) => setF({ ...f, categorie: e.target.value })}
                        className="flex-1 rounded-xl border border-filet bg-white px-3 py-2 text-xs font-semibold text-encre focus:border-ocean-profond focus:outline-none"
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Colonne Droite : Paramètres de sécurité et d'accès */}
                <div className="space-y-3">
                  <div>
                    <label className="text-2xs font-bold uppercase tracking-wider text-slate-600 block mb-1">
                      Niveau minimum de visibilité (Lecture)
                    </label>
                    <select
                      disabled={!f.fichierId || analyse}
                      value={f.niveauVisible}
                      onChange={(e) => setF({ ...f, niveauVisible: +e.target.value })}
                      className="w-full rounded-xl border border-filet bg-white px-3 py-2 text-xs font-semibold text-encre focus:border-ocean-profond focus:outline-none"
                    >
                      {NIVEAUX.map(([n, l]) => (
                        <option key={n} value={n}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-2xs font-bold uppercase tracking-wider text-slate-600 block mb-1">
                      Niveau minimum de téléchargement (Fichier brut)
                    </label>
                    <select
                      disabled={!f.fichierId || analyse}
                      value={f.niveauTelechargement}
                      onChange={(e) => setF({ ...f, niveauTelechargement: +e.target.value })}
                      className="w-full rounded-xl border border-filet bg-white px-3 py-2 text-xs font-semibold text-encre focus:border-ocean-profond focus:outline-none"
                    >
                      {NIVEAUX.map(([n, l]) => (
                        <option key={n} value={n}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-2xs font-bold uppercase tracking-wider text-slate-600 block mb-1">
                      Code d'accès optionnel pour le téléchargement
                    </label>
                    <div className="relative flex items-center">
                      <KeyRound className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-slate-400" />
                      <Input
                        type="password"
                        disabled={!f.fichierId || analyse}
                        value={f.codeAcces}
                        onChange={(e) => setF({ ...f, codeAcces: e.target.value })}
                        placeholder="Laisser vide si aucun mot de passe requis"
                        className="text-xs bg-white pl-9"
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={f.confidentiel}
                        disabled={!f.fichierId || monNiveau < 5 || analyse}
                        onChange={(e) => setF({ ...f, confidentiel: e.target.checked })}
                        className="h-4 w-4 rounded border-slate-300 text-ocean-profond focus:ring-ocean-ceruleen"
                      />
                      <span className="text-xs font-bold text-slate-800">
                        Marquer comme Document Confidentiel (DAF / DG uniquement)
                      </span>
                    </label>
                    {monNiveau < 5 && (
                      <p className="text-3xs text-slate-400 mt-0.5 ml-6">
                        Réservé aux membres de la direction (Niveau 5 et supérieur)
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Barre d'action de validation */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-filet">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setF(FORM_VIDE);
                    setFormOuvert(false);
                  }}
                  className="text-xs"
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={!f.fichierId || !f.titre.trim() || analyse}
                  className="bg-ocean-profond hover:bg-ocean-nuit text-white text-xs font-bold shadow-xs gap-1.5"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Valider et enregistrer le document
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* 4. Barre de Recherche et Filtres par Catégorie (Chips) */}
      <div className="rounded-2xl border border-filet bg-surface p-3 shadow-xs space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Recherche textuelle avec loupe bien calée et espacée du texte */}
          <div className="relative flex-1 group">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-4 w-4 text-slate-400 group-focus-within:text-ocean-profond transition-colors" />
            </div>
            <Input
              type="text"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher par titre, description, fichier ou mot-clé..."
              className="w-full h-9 pl-10 pr-9 text-xs rounded-xl bg-papier/70 border-filet text-encre placeholder:text-slate-400 focus-visible:border-ocean-profond focus-visible:bg-white focus-visible:ring-1 focus-visible:ring-ocean-ceruleen/40 transition-all shadow-2xs"
            />
            {recherche && (
              <button
                type="button"
                onClick={() => setRecherche("")}
                className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-slate-700 transition-colors"
                title="Effacer la recherche"
                aria-label="Effacer la recherche"
              >
                <span className="flex items-center justify-center h-5 w-5 rounded-full hover:bg-slate-200/60">
                  <X className="h-3.5 w-3.5" />
                </span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div role="group" aria-label="Mode d'affichage" className="flex items-center gap-0.5 rounded-lg border border-filet bg-slate-100/80 p-0.5">
              {([["tableau", Rows3, "Tableau"], ["cartes", LayoutGrid, "Cartes"]] as const).map(([v, Icone, libelle]) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={vue === v}
                  title={libelle}
                  onClick={() => changerVue(v)}
                  className={cn(
                    "inline-flex h-7 items-center gap-1 rounded-md px-2 text-2xs font-semibold transition-colors",
                    vue === v ? "bg-ocean-profond text-white shadow-xs" : "text-encre-douce hover:bg-white hover:text-encre"
                  )}
                >
                  <Icone className="h-3.5 w-3.5" />
                  {libelle}
                </button>
              ))}
            </div>
            <Flag variant="neutre" size="sm" className="font-mono">
              {docs.length} document{docs.length > 1 ? "s" : ""} affiché{docs.length > 1 ? "s" : ""}
              {categorieFiltre && ` (sur ${tousDocs.length})`}
            </Flag>
          </div>
        </div>

        {/* Chips de filtres par catégorie avec indicateur de volume */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 pt-0.5 no-scrollbar">
          <button
            type="button"
            onClick={() => setCategorieFiltre("")}
            className={cn(
              "group flex items-center gap-1.5 rounded-full px-3 py-1 text-2xs font-semibold transition-all cursor-pointer shrink-0 border",
              categorieFiltre === ""
                ? "bg-ocean-profond text-white border-ocean-profond shadow-2xs"
                : "bg-surface hover:bg-slate-50 text-slate-700 border-filet hover:border-slate-300"
            )}
            title={`Tous les documents (${tousDocs.length})`}
          >
            <span>Toutes</span>
            <span
              className={cn(
                "rounded-full px-1.5 py-0.2 text-3xs font-mono font-bold leading-tight",
                categorieFiltre === ""
                  ? "bg-white/20 text-white"
                  : "bg-ocean-brume/70 text-ocean-profond"
              )}
            >
              {tousDocs.length}
            </span>
          </button>

          {categoriesDisponibles.map((cat: string) => {
            const count = compteurs[cat] || 0;
            const aDesElements = count > 0;
            const estActive = categorieFiltre === cat;

            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategorieFiltre(estActive ? "" : cat)}
                className={cn(
                  "group flex items-center gap-1.5 rounded-full px-3 py-1 text-2xs font-semibold transition-all cursor-pointer shrink-0 border",
                  estActive
                    ? "bg-ocean-profond text-white border-ocean-profond shadow-2xs"
                    : aDesElements
                      ? "bg-surface hover:bg-blue-50/40 text-slate-800 border-filet hover:border-ocean-ceruleen/50 shadow-2xs"
                      : "bg-slate-50/60 hover:bg-slate-100/60 text-slate-400 border-dashed border-slate-200"
                )}
                title={
                  aDesElements
                    ? `${count} document${count > 1 ? "s" : ""} dans « ${cat} »`
                    : `Aucun document dans « ${cat} »`
                }
              >
                <span className={cn(!aDesElements && !estActive && "opacity-75")}>
                  {cat}
                </span>
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.2 text-3xs font-mono font-bold leading-tight",
                    estActive
                      ? "bg-white/20 text-white"
                      : aDesElements
                        ? "bg-ocean-brume/80 text-ocean-profond group-hover:bg-ocean-brume"
                        : "bg-slate-200/60 text-slate-400"
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. Grille de Documents (Cartes modernes) */}
      {docs.length === 0 ? (
        <Card className="border-filet bg-surface p-8 text-center shadow-xs">
          <div className="flex flex-col items-center justify-center space-y-2">
            <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
              <FolderOpen className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-bold text-encre">Aucun document trouvé</h3>
            <p className="text-xs text-encre-douce max-w-sm">
              {recherche || categorieFiltre
                ? "Aucun fichier ne correspond à vos critères de recherche ou de catégorie."
                : "Aucun document n'est encore visible pour votre niveau d'accréditation."}
            </p>
            {(recherche || categorieFiltre) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setRecherche("");
                  setCategorieFiltre("");
                }}
                className="text-xs mt-2"
              >
                Réinitialiser les filtres
              </Button>
            )}
          </div>
        </Card>
      ) : vue === "tableau" ? (
        <Table classNameConteneur="rounded-xl">
          <TableHeader>
            <TableRow>
              <TableHead>Document</TableHead>
              <TableHead>Catégorie</TableHead>
              <TableHead>Accès</TableHead>
              <TableHead>Déposé</TableHead>
              <TableHead numerique>Taille</TableHead>
              <TableHead aria-label="Actions" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {docs.map((d: any) => {
              const id = String(d._id);
              const { icon, ext } = getFileIconAndBadge(d.typeMime, d.nomFichier);
              const enDemandeCode = demandeCode === id;
              return (
                <TableRow key={id} active={enDemandeCode}>
                  <TableCell className="leading-tight">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-filet-clair bg-papier" aria-hidden="true">{icon}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-[13px] font-semibold" title={d.titre}>{d.titre}</span>
                          <span className="shrink-0 rounded-sm border border-filet px-1 font-mono text-[9px] font-bold uppercase text-encre-douce">{ext}</span>
                          {d.modeMeta === "ia" && <Sparkles className="h-3 w-3 shrink-0 text-amber-500" aria-label="Métadonnées extraites par IA" />}
                        </div>
                        <div className="truncate text-2xs text-encre-pale" title={d.description || d.nomFichier}>{d.description || d.nomFichier}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><Flag variant="neutre" size="xs">{d.categorie}</Flag></TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="whitespace-nowrap font-mono text-2xs text-encre-douce" title="Niveau de visibilité / de téléchargement">niv. {d.niveauVisible} / {d.niveauTelechargement}</span>
                      {d.confidentiel && <Flag variant="a-renseigner" size="xs">Confidentiel</Flag>}
                      {d.codeRequis && <Flag variant="verrou" size="xs" icon={<Lock className="h-2.5 w-2.5 text-slate-500" />}>Code</Flag>}
                    </div>
                  </TableCell>
                  <TableCell className="leading-tight">
                    <div className="whitespace-nowrap font-mono text-xs tabular-nums">{new Date(d.deposeLe).toLocaleDateString("fr-FR")}</div>
                    <div className="whitespace-nowrap text-2xs text-encre-pale">{d.deposePar}</div>
                  </TableCell>
                  <TableCell numerique className="whitespace-nowrap font-mono text-xs">{ko(d.taille).replace(".", ",")}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1.5">
                      {enDemandeCode && (
                        <div className="flex items-center gap-1.5">
                          <Input
                            autoFocus
                            type="password"
                            value={codes[id] ?? ""}
                            onChange={(e) => setCodes((c) => ({ ...c, [id]: e.target.value }))}
                            onKeyDown={(e) => { if (e.key === "Enter") telecharger(d); if (e.key === "Escape") setDemandeCode(null); }}
                            placeholder="Code d'accès"
                            aria-label={`Code d'accès — ${d.titre}`}
                            className="h-7 w-32 text-2xs"
                          />
                          <Button size="sm" onClick={() => telecharger(d)} className="h-7 px-2.5 text-2xs">Valider</Button>
                          <Button size="icon-sm" variant="ghost" onClick={() => setDemandeCode(null)} aria-label="Annuler"><X /></Button>
                        </div>
                      )}
                      {erreurs[id] && <span className="text-2xs font-semibold text-carmin">{erreurs[id]}</span>}
                      {!enDemandeCode && (d.telechargeable ? (
                        <Button size="sm" variant="outline" onClick={() => telecharger(d)} className="h-7 gap-1 px-2.5 text-2xs font-semibold text-ocean-profond" aria-label={`Télécharger ${d.titre}`}>
                          <Download className="h-3.5 w-3.5" />
                          {d.codeRequis ? "Code" : "Télécharger"}
                        </Button>
                      ) : (
                        <Flag variant="verrou" size="xs">Réservé</Flag>
                      ))}
                      <BoutonConfirmation
                        libelle={<Trash2 className="h-3.5 w-3.5" />}
                        titre="Supprimer ce document ?"
                        consequence={`Le fichier « ${d.titre} » sera définitivement supprimé de l'espace d'archivage.`}
                        confirmer="Supprimer"
                        onConfirmer={() => supprimerDocument(id)}
                        succes="Document supprimé"
                        variant="ghost"
                        size="icon-sm"
                        className="text-encre-pale hover:bg-carmin-clair hover:text-carmin"
                      />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
          {docs.map((d: any) => {
            const id = String(d._id);
            const { icon, badgeClass, ext } = getFileIconAndBadge(d.typeMime, d.nomFichier);
            const enDemandeCode = demandeCode === id;

            return (
              <div
                key={id}
                className="rounded-2xl border border-filet bg-surface p-4 shadow-2xs hover:shadow-xs transition-all hover:border-slate-300 flex flex-col justify-between space-y-3"
              >
                {/* En-tête de la carte : Icone MIME, Catégorie et Drapeaux de sécurité */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-xl bg-slate-50 border border-slate-100 shrink-0">
                        {icon}
                      </div>
                      <span
                        className={cn(
                          "rounded-md px-1.5 py-0.5 text-3xs font-mono font-bold border",
                          badgeClass
                        )}
                      >
                        {ext}
                      </span>
                      <Flag variant="neutre" size="xs">
                        {d.categorie}
                      </Flag>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {d.confidentiel && (
                        <Flag variant="a-renseigner" size="xs">
                          Confidentiel
                        </Flag>
                      )}
                      {d.codeRequis && (
                        <Flag
                          variant="verrou"
                          size="xs"
                          icon={<Lock className="h-2.5 w-2.5 text-slate-500" />}
                        >
                          Code
                        </Flag>
                      )}
                    </div>
                  </div>

                  {/* Titre & Description */}
                  <div>
                    <h3
                      className="text-sm font-bold text-encre tracking-tight line-clamp-1"
                      title={d.titre}
                    >
                      {d.titre}
                    </h3>
                    <p
                      className="text-xs text-encre-douce line-clamp-2 mt-0.5 min-h-[32px]"
                      title={d.description}
                    >
                      {d.description || "Aucune description renseignée."}
                    </p>
                  </div>
                </div>

                {/* Métadonnées & Accréditations */}
                <div className="space-y-2 pt-2 border-t border-filet/70 text-2xs text-slate-500">
                  <div className="flex items-center justify-between font-mono">
                    <span className="truncate">{d.nomFichier}</span>
                    <span className="font-bold shrink-0 ml-2">{ko(d.taille)}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span>
                      {new Date(d.deposeLe).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}{" "}
                      · <strong className="text-slate-700">{d.deposePar}</strong>
                    </span>
                    {d.modeMeta === "ia" && (
                      <span
                        className="flex items-center gap-1 text-3xs font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200"
                        title="Métadonnées extraites par Gemini"
                      >
                        <Sparkles className="h-2.5 w-2.5 text-amber-500" />
                        IA
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-3xs text-slate-400 bg-papier/60 px-2 py-1 rounded-lg">
                    <span>Visibilité : Niv. {d.niveauVisible}+</span>
                    <span>Téléchargement : Niv. {d.niveauTelechargement}+</span>
                  </div>
                </div>

                {/* Actions de téléchargement et suppression */}
                <div className="pt-2 border-t border-filet space-y-2">
                  {enDemandeCode && (
                    <div className="flex items-center gap-2 animate-in fade-in duration-150">
                      <div className="relative flex-1 group">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5">
                          <KeyRound className="h-3 w-3 text-slate-400 group-focus-within:text-ocean-profond transition-colors" />
                        </div>
                        <Input
                          autoFocus
                          type="password"
                          value={codes[id] ?? ""}
                          onChange={(e) =>
                            setCodes((c) => ({ ...c, [id]: e.target.value }))
                          }
                          onKeyDown={(e) => e.key === "Enter" && telecharger(d)}
                          placeholder="Code d'accès requis"
                          className="h-7 text-2xs pl-7.5 bg-white border-filet focus-visible:border-ocean-profond"
                        />
                      </div>
                      <Button
                        size="sm"
                        onClick={() => telecharger(d)}
                        className="h-7 text-2xs px-2.5 bg-ocean-profond text-white"
                      >
                        Valider
                      </Button>
                      <button
                        type="button"
                        onClick={() => setDemandeCode(null)}
                        className="text-slate-400 hover:text-slate-600 text-xs px-1"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {erreurs[id] && (
                    <div className="text-3xs text-rose-600 font-semibold bg-rose-50 px-2 py-1 rounded">
                      {erreurs[id]}
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2">
                    {d.telechargeable ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => telecharger(d)}
                        className="h-8 text-xs font-semibold text-ocean-profond hover:bg-ocean-brume/40 border-ocean-profond/30 flex-1 justify-center gap-1.5"
                      >
                        <Download className="h-3.5 w-3.5" />
                        {d.codeRequis && !enDemandeCode
                          ? "Télécharger (code)"
                          : "Télécharger"}
                      </Button>
                    ) : (
                      <Flag variant="verrou" size="sm" className="flex-1 justify-center">
                        Téléchargement réservé
                      </Flag>
                    )}

                    {/* Bouton de suppression sécurisé avec modal */}
                    <BoutonConfirmation
                      libelle={<Trash2 className="h-3.5 w-3.5" />}
                      titre="Supprimer ce document ?"
                      consequence={`Le fichier « ${d.titre} » sera définitivement supprimé de l'espace d'archivage.`}
                      confirmer="Supprimer"
                      onConfirmer={() => supprimerDocument(id)}
                      succes="Document supprimé"
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs text-slate-400 hover:text-rose-600 hover:bg-rose-50 px-2.5"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

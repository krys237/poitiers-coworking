import { useState, useMemo, useRef, Fragment } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { parseCsvLignes, exportCsvLignes, totalLigne, totalCommande } from "../../convex/lib/commandes";
import { fcfa, messageErreur } from "../lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Flag, FlagVariant } from "@/components/ui/flag";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  ShoppingCart,
  Plus,
  ChevronUp,
  ChevronRight,
  X,
  Upload,
  Download,
  Search,
  CheckCircle2,
  Clock,
  Package,
  Pill,
  Send,
  Trash2,
  FileSpreadsheet,
  TrendingUp,
  TrendingDown,
  Check,
  Ban,
  Truck,
  MessageSquare,
} from "lucide-react";

type TypeCommande = "medicale" | "fourniture";
type Ligne = { produit: string; dci?: string; quantite: number; prixUnitaire: number };

const STATUT_CONFIG: Record<string, { label: string; variant: FlagVariant; icon?: any }> = {
  en_attente: { label: "En attente", variant: "a-renseigner" },
  validee: { label: "Validée", variant: "finance" },
  rejetee: { label: "Rejetée", variant: "verrou" },
  livree: { label: "Livrée", variant: "especes" },
};

const fmtDate = (s: string) => {
  if (!s) return "—";
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

const aujourdHui = () => new Date().toISOString().slice(0, 10);
const LIGNE_VIDE: Ligne = { produit: "", dci: "", quantite: 1, prixUnitaire: 0 };

function telechargerFichier(nom: string, contenu: string) {
  const url = URL.createObjectURL(new Blob([contenu], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nom;
  a.click();
  URL.revokeObjectURL(url);
}

export function Commandes() {
  const me = useQuery(api.users.me);
  const [type, setType] = useState<TypeCommande>("medicale");
  const liste = useQuery(api.commandes.liste, {});

  const [sel, setSel] = useState<string | null>(null);
  const detail = useQuery(api.commandes.detail, sel ? { commandeId: sel as any } : "skip");

  const creer = useMutation(api.commandes.creer);
  const changerStatut = useMutation(api.commandes.changerStatut);
  const commenter = useMutation(api.commandes.commenter);

  const [recherche, setRecherche] = useState("");
  const [ouvrirForm, setOuvrirForm] = useState(false);
  const [enCreation, setEnCreation] = useState(false);
  const [enTransition, setEnTransition] = useState(false);

  const [f, setF] = useState({
    date: aujourdHui(),
    libelle: "",
    demandeur: "",
    service: "",
    commentaire: "",
  });

  const [lignes, setLignes] = useState<Ligne[]>([
    { ...LIGNE_VIDE },
    { ...LIGNE_VIDE },
    { ...LIGNE_VIDE },
  ]);

  const [motifRejet, setMotifRejet] = useState("");
  const [demandeRejet, setDemandeRejet] = useState(false);
  const [texteCommentaire, setTexteCommentaire] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const niveau = me?.niveau ?? 0;

  const majLigne = (i: number, patch: Partial<Ligne>) =>
    setLignes((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const lignesValides = useMemo(
    () => lignes.filter((l) => l.produit.trim()),
    [lignes]
  );

  const totalFormulaire = useMemo(
    () =>
      totalCommande(
        lignesValides.map((l) => ({
          ...l,
          quantite: Number(l.quantite) || 0,
          prixUnitaire: Number(l.prixUnitaire) || 0,
        }))
      ),
    [lignesValides]
  );

  const toutesCommandes = useMemo(() => liste ?? [], [liste]);

  const countMedicale = useMemo(
    () => toutesCommandes.filter((c: any) => c.type === "medicale").length,
    [toutesCommandes]
  );
  const countFourniture = useMemo(
    () => toutesCommandes.filter((c: any) => c.type === "fourniture").length,
    [toutesCommandes]
  );

  const commandesDuType = useMemo(
    () => toutesCommandes.filter((c: any) => c.type === type),
    [toutesCommandes, type]
  );

  // Statistiques de synthèse pour les 4 KPIs
  const { totalCommandes, nbEnAttente, nbValidees, totalEngage } = useMemo(() => {
    let enAttente = 0;
    let validees = 0;
    let engage = 0;

    for (const c of commandesDuType) {
      if (c.statut === "en_attente") enAttente++;
      if (c.statut === "validee" || c.statut === "livree") validees++;
      engage += c.total || 0;
    }

    return {
      totalCommandes: commandesDuType.length,
      nbEnAttente: enAttente,
      nbValidees: validees,
      totalEngage: engage,
    };
  }, [commandesDuType]);

  // Filtrage des commandes par terme de recherche
  const commandesFiltrees = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (!q) return commandesDuType;
    return commandesDuType.filter((c: any) =>
      `${c.reference} ${c.libelle ?? ""} ${c.demandeur} ${c.service ?? ""}`
        .toLowerCase()
        .includes(q)
    );
  }, [commandesDuType, recherche]);

  const onImportCsv = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = parseCsvLignes(text);
      if (!parsed.length) {
        toast.error("Aucune ligne reconnue dans le fichier CSV", {
          description: "Colonnes attendues : Nom du produit;DCI;Quantité;Prix unitaire",
        });
        return;
      }
      setLignes(parsed);
      setOuvrirForm(true);
      toast.success(`${parsed.length} article(s) importé(s) du CSV`, {
        description: "Vérifiez les données du bon de commande avant validation.",
      });
    } catch (e) {
      toast.error("Erreur lors de l'import CSV", { description: messageErreur(e) });
    }
  };

  const onCreerCommande = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lignesValides.length) {
      toast.error("Veuillez renseigner au moins une ligne de produit.");
      return;
    }

    setEnCreation(true);
    try {
      const r = await creer({
        type,
        date: f.date,
        libelle: f.libelle.trim() || undefined,
        demandeur: f.demandeur.trim() || (me?.nom ?? ""),
        service: f.service.trim() || undefined,
        commentaire: f.commentaire.trim() || undefined,
        lignes: lignesValides.map((l) => ({
          produit: l.produit.trim(),
          dci: type === "medicale" && l.dci ? l.dci.trim() : undefined,
          quantite: Number(l.quantite) || 1,
          prixUnitaire: Number(l.prixUnitaire) || 0,
        })),
      });

      toast.success(`Commande ${r.reference} créée avec succès`, {
        description: `Montant total : ${fcfa(r.total)}. Soumise pour validation hiérarchique.`,
      });

      setOuvrirForm(false);
      setLignes([{ ...LIGNE_VIDE }, { ...LIGNE_VIDE }, { ...LIGNE_VIDE }]);
      setF({ date: aujourdHui(), libelle: "", demandeur: "", service: "", commentaire: "" });
      setSel(r.id);
    } catch (err) {
      toast.error("Erreur de création", { description: messageErreur(err) });
    } finally {
      setEnCreation(false);
    }
  };

  const transitionStatut = async (nouveauStatut: "validee" | "rejetee" | "livree") => {
    if (!sel) return;
    if (nouveauStatut === "rejetee" && !motifRejet.trim()) {
      toast.error("Un motif de rejet est obligatoire pour refuser la commande.");
      return;
    }

    setEnTransition(true);
    try {
      await changerStatut({
        commandeId: sel as any,
        statut: nouveauStatut,
        commentaire: motifRejet.trim() || undefined,
      });

      toast.success(`Statut mis à jour : ${STATUT_CONFIG[nouveauStatut].label}`);
      setMotifRejet("");
      setDemandeRejet(false);
    } catch (err) {
      toast.error("Erreur de modification du statut", { description: messageErreur(err) });
    } finally {
      setEnTransition(false);
    }
  };

  const posterCommentaire = async () => {
    if (!sel || !texteCommentaire.trim()) return;
    try {
      await commenter({ commandeId: sel as any, texte: texteCommentaire.trim() });
      setTexteCommentaire("");
      toast.success("Commentaire publié");
    } catch (e) {
      toast.error("Erreur lors de la publication", { description: messageErreur(e) });
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. En-tête institutionnel & Actions rapides */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-encre">
              Commandes & Approvisionnements
            </h1>
            <Flag variant="finance" size="xs">
              Achats
            </Flag>
          </div>
          <p className="text-xs sm:text-sm text-encre-douce">
            Commandes de médicaments (avec DCI) et fournitures générales · Workflow de validation hiérarchique
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {/* Input fichier CSV invisible */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={(e) => e.target.files?.[0] && onImportCsv(e.target.files[0])}
          />

          <Button
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="text-xs font-semibold gap-1.5 border-filet hover:bg-slate-50"
          >
            <Upload className="h-3.5 w-3.5 text-slate-500" />
            Importer CSV
          </Button>

          {/* Bouton primaire rétractable pour déplier/replier la saisie */}
          <Button
            size="sm"
            onClick={() => {
              setOuvrirForm((v) => !v);
              if (!ouvrirForm) setSel(null);
            }}
            className={cn(
              "text-xs font-bold gap-1.5 shadow-xs transition-colors",
              ouvrirForm
                ? "bg-slate-200 text-slate-700 hover:bg-slate-300"
                : "bg-ocean-profond hover:bg-ocean-nuit text-white"
            )}
          >
            {ouvrirForm ? (
              <>
                <ChevronUp className="h-3.5 w-3.5" /> Masquer le formulaire
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5" /> Nouvelle commande
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 2. Bandeau compact de 4 KPIs d'approvisionnement */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        {/* KPI 1 : Commandes actives du type */}
        <div className="rounded-xl border border-filet bg-surface p-3 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
            <span className="truncate">Commandes enregistrées</span>
            <Flag variant="finance" size="xs">
              Total
            </Flag>
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-encre mt-1">
            {totalCommandes}
          </div>
          <div className="text-3xs text-encre-pale mt-0.5">
            Flux {type === "medicale" ? "pharmaceutique" : "fournitures"}
          </div>
        </div>

        {/* KPI 2 : En attente d'arbitrage */}
        <div className="rounded-xl border border-filet bg-surface p-3 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
            <span className="truncate">En attente de validation</span>
            <Flag variant="a-renseigner" size="xs">
              Niveau 5+
            </Flag>
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-amber-700 mt-1">
            {nbEnAttente}
          </div>
          <div className="text-3xs text-encre-pale mt-0.5">
            À arbitrer par la Direction
          </div>
        </div>

        {/* KPI 3 : Validées / En cours de livraison */}
        <div className="rounded-xl border border-filet bg-surface p-3 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
            <span className="truncate">Approuvées / Livrées</span>
            <Flag variant="especes" size="xs">
              Validées
            </Flag>
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-emerald-700 mt-1">
            {nbValidees}
          </div>
          <div className="text-3xs text-encre-pale mt-0.5">
            Prêtes ou réceptionnées
          </div>
        </div>

        {/* KPI 4 : Montant total engagé */}
        <div className="rounded-xl border border-filet bg-surface p-3 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
            <span className="truncate">Budget engagé</span>
            <Flag variant="direct" size="xs">
              FCFA
            </Flag>
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono tabular-nums text-ocean-profond mt-1 truncate">
            {fcfa(totalEngage)}
          </div>
          <div className="text-3xs text-encre-pale mt-0.5">
            Cumul du flux sélectionné
          </div>
        </div>
      </div>

      {/* 3. Sélecteur de type de commande & Barre de recherche */}
      <div className="rounded-2xl border border-filet bg-surface p-3 shadow-xs space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Onglets de type de commande avec couleurs vives affirmées */}
          <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-100/90 border border-filet self-start shadow-2xs">
            <button
              type="button"
              onClick={() => {
                setType("medicale");
                setSel(null);
              }}
              className={cn(
                "flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all cursor-pointer border",
                type === "medicale"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm border-emerald-600 ring-2 ring-emerald-500/20"
                  : "text-slate-700 hover:text-emerald-950 hover:bg-emerald-50/80 border-transparent"
              )}
            >
              <Pill className={cn("h-4 w-4", type === "medicale" ? "text-white" : "text-emerald-600")} />
              <span>Médicaments (DCI)</span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-3xs font-mono font-bold",
                  type === "medicale"
                    ? "bg-white/25 text-white"
                    : "bg-emerald-100 text-emerald-800"
                )}
              >
                {countMedicale}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setType("fourniture");
                setSel(null);
              }}
              className={cn(
                "flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all cursor-pointer border",
                type === "fourniture"
                  ? "bg-ocean-profond hover:bg-ocean-nuit text-white shadow-sm border-ocean-profond ring-2 ring-ocean-profond/20"
                  : "text-slate-700 hover:text-ocean-nuit hover:bg-blue-50/80 border-transparent"
              )}
            >
              <Package className={cn("h-4 w-4", type === "fourniture" ? "text-white" : "text-ocean-profond")} />
              <span>Fournitures générales</span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-3xs font-mono font-bold",
                  type === "fourniture"
                    ? "bg-white/25 text-white"
                    : "bg-sky-100 text-ocean-profond"
                )}
              >
                {countFourniture}
              </span>
            </button>
          </div>

          {/* Barre de recherche temps réel */}
          <div className="relative w-full sm:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              type="search"
              placeholder="Rechercher par référence, libellé, agent, service…"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              className="pl-9 pr-9 h-10 text-xs bg-white border-filet focus-visible:ring-ocean-profond"
            />
            {recherche && (
              <button
                type="button"
                onClick={() => setRecherche("")}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 transition-colors"
                title="Effacer la recherche"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4. Formulaire de Nouvelle Commande (Dépliable) */}
      {ouvrirForm && (
        <Card className="border-ocean-ceruleen/40 bg-surface shadow-sm overflow-hidden animate-in fade-in duration-200">
          <CardHeader className="p-4 pb-3 border-b border-filet bg-gradient-to-r from-blue-50/50 via-slate-50 to-white">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-ocean-profond text-white shadow-2xs">
                  <ShoppingCart className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-sm sm:text-base font-bold text-ocean-nuit">
                    Nouveau bon de commande
                  </CardTitle>
                  <CardDescription className="text-xs text-encre-douce">
                    Saisissez les articles ou importez un fichier CSV. Total calculé automatiquement.
                  </CardDescription>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Sélecteur de type directement dans le formulaire */}
                <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 border border-filet">
                  <button
                    type="button"
                    onClick={() => setType("medicale")}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                      type === "medicale"
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-emerald-950 hover:bg-emerald-50"
                    )}
                  >
                    <Pill className="h-3.5 w-3.5" />
                    Médicaments
                  </button>
                  <button
                    type="button"
                    onClick={() => setType("fourniture")}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                      type === "fourniture"
                        ? "bg-ocean-profond text-white shadow-xs"
                        : "text-slate-600 hover:text-ocean-nuit hover:bg-blue-50"
                    )}
                  >
                    <Package className="h-3.5 w-3.5" />
                    Fournitures
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setOuvrirForm(false)}
                  className="text-slate-400 hover:text-slate-600 transition-colors p-1.5 rounded-lg hover:bg-slate-100"
                  title="Fermer le formulaire"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-4 sm:p-5 space-y-4">
            <form onSubmit={onCreerCommande} className="space-y-4">
              {/* Métadonnées de commande */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 p-3.5 rounded-xl bg-papier/60 border border-filet">
                <div>
                  <label className="text-2xs font-bold uppercase tracking-wider text-slate-600 block mb-1">
                    Date de commande <span className="text-rose-600">*</span>
                  </label>
                  <Input
                    type="date"
                    required
                    value={f.date}
                    onChange={(e) => setF({ ...f, date: e.target.value })}
                    className="h-8 text-xs bg-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-2xs font-bold uppercase tracking-wider text-slate-600 block mb-1">
                    Libellé / Objet
                  </label>
                  <Input
                    value={f.libelle}
                    onChange={(e) => setF({ ...f, libelle: e.target.value })}
                    placeholder={type === "medicale" ? "Réapprovisionnement mensuel" : "Fournitures bureau T3"}
                    className="h-8 text-xs bg-white"
                  />
                </div>

                <div>
                  <label className="text-2xs font-bold uppercase tracking-wider text-slate-600 block mb-1">
                    Demandeur
                  </label>
                  <Input
                    value={f.demandeur}
                    onChange={(e) => setF({ ...f, demandeur: e.target.value })}
                    placeholder={me?.nom ?? "Nom du responsable"}
                    className="h-8 text-xs bg-white"
                  />
                </div>

                <div>
                  <label className="text-2xs font-bold uppercase tracking-wider text-slate-600 block mb-1">
                    Service destinataire
                  </label>
                  <Input
                    value={f.service}
                    onChange={(e) => setF({ ...f, service: e.target.value })}
                    placeholder="Pharmacie, Accueil, Labo…"
                    className="h-8 text-xs bg-white"
                  />
                </div>
              </div>

              {/* Tableau interactif des articles */}
              <div className="rounded-xl border border-filet overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-filet text-3xs font-bold uppercase text-slate-600 tracking-wider">
                        <th className="p-2.5 w-10 text-center">#</th>
                        <th className="p-2.5">Désignation du produit</th>
                        {type === "medicale" && <th className="p-2.5 w-44">DCI (Dénomination commune)</th>}
                        <th className="p-2.5 w-24 text-right">Quantité</th>
                        <th className="p-2.5 w-32 text-right">Prix unitaire (FCFA)</th>
                        <th className="p-2.5 w-36 text-right">Total ligne</th>
                        <th className="p-2.5 w-10 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-filet bg-white">
                      {lignes.map((l, i) => {
                        const totalItem = (Number(l.quantite) || 0) * (Number(l.prixUnitaire) || 0);

                        return (
                          <tr key={i} className="hover:bg-slate-50/50">
                            <td className="p-2 text-center text-slate-400 font-mono text-2xs">
                              {i + 1}
                            </td>
                            <td className="p-2">
                              <Input
                                value={l.produit}
                                onChange={(e) => majLigne(i, { produit: e.target.value })}
                                placeholder="Ex: Paracétamol 500mg, Rames papier A4…"
                                className="h-7 text-xs bg-white border-filet"
                              />
                            </td>
                            {type === "medicale" && (
                              <td className="p-2">
                                <Input
                                  value={l.dci ?? ""}
                                  onChange={(e) => majLigne(i, { dci: e.target.value })}
                                  placeholder="Ex: Paracétamol"
                                  className="h-7 text-xs bg-white border-filet"
                                />
                              </td>
                            )}
                            <td className="p-2 text-right">
                              <Input
                                type="number"
                                min={1}
                                value={l.quantite ? l.quantite : ""}
                                placeholder="1"
                                onFocus={(e) => e.target.select()}
                                onChange={(e) =>
                                  majLigne(i, {
                                    quantite: e.target.value === "" ? 0 : Number(e.target.value),
                                  })
                                }
                                className="h-7 text-xs text-right bg-white border-filet font-mono"
                              />
                            </td>
                            <td className="p-2 text-right">
                              <Input
                                type="number"
                                min={0}
                                value={l.prixUnitaire ? l.prixUnitaire : ""}
                                placeholder="0"
                                onFocus={(e) => e.target.select()}
                                onChange={(e) =>
                                  majLigne(i, {
                                    prixUnitaire: e.target.value === "" ? 0 : Number(e.target.value),
                                  })
                                }
                                className="h-7 text-xs text-right bg-white border-filet font-mono"
                              />
                            </td>
                            <td className="p-2 text-right font-mono font-semibold text-ocean-nuit">
                              {fcfa(totalItem)}
                            </td>
                            <td className="p-2 text-center">
                              {lignes.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => setLignes((ls) => ls.filter((_, j) => j !== i))}
                                  className="text-slate-400 hover:text-rose-600 p-1 transition-colors"
                                  title="Supprimer cette ligne"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50 border-t-2 border-filet font-bold">
                        <td colSpan={type === "medicale" ? 5 : 4} className="p-3 text-right text-xs text-slate-700">
                          Total général estimé :
                        </td>
                        <td className="p-3 text-right font-mono text-sm text-ocean-profond font-extrabold">
                          {fcfa(totalFormulaire)}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div className="p-2.5 bg-papier/50 border-t border-filet flex items-center justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setLignes((ls) => [...ls, { ...LIGNE_VIDE }])}
                    className="h-7 text-xs gap-1 border-filet bg-white hover:bg-blue-50/50"
                  >
                    <Plus className="h-3 w-3 text-ocean-profond" />
                    Ajouter une ligne de produit
                  </Button>
                  <span className="text-3xs text-slate-500">
                    {lignesValides.length} article(s) valide(s)
                  </span>
                </div>
              </div>

              {/* Commentaire optionnel */}
              <div>
                <label className="text-2xs font-bold uppercase tracking-wider text-slate-600 block mb-1">
                  Commentaire ou instructions pour la direction (optionnel)
                </label>
                <Input
                  value={f.commentaire}
                  onChange={(e) => setF({ ...f, commentaire: e.target.value })}
                  placeholder="Justificatif du besoin, urgence éventuelle, contact fournisseur…"
                  className="h-8 text-xs bg-white"
                />
              </div>

              {/* Barre d'actions d'enregistrement */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-filet">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setOuvrirForm(false)}
                  className="text-xs"
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={!lignesValides.length || enCreation}
                  className="bg-ocean-profond hover:bg-ocean-nuit text-white text-xs font-bold shadow-xs gap-1.5"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {enCreation ? "Enregistrement en cours…" : "Valider et soumettre le bon de commande"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* 5. Tableau des Commandes Enregistrées */}
      <div className="rounded-2xl border border-filet bg-surface p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-ocean-profond" />
            <h2 className="text-sm sm:text-base font-bold text-ocean-nuit">
              Liste des bons de commande ({commandesFiltrees.length})
            </h2>
          </div>
          {type === "medicale" ? (
            <Flag variant="especes" size="sm">
              <Pill className="h-3 w-3 mr-1 inline" />
              Pharmacie & DCI
            </Flag>
          ) : (
            <Flag variant="direct" size="sm">
              <Package className="h-3 w-3 mr-1 inline" />
              Fournitures générales
            </Flag>
          )}
        </div>

        {commandesFiltrees.length === 0 ? (
          <div className="p-8 text-center text-encre-douce text-xs border border-dashed border-slate-200 rounded-xl bg-papier/50">
            {recherche
              ? `Aucune commande ne correspond à votre recherche « ${recherche} ».`
              : `Aucune commande de type ${type === "medicale" ? "médicaments" : "fournitures"} enregistrée pour l'instant.`}
          </div>
        ) : (
          <Table classNameConteneur="rounded-xl">
              <TableHeader>
                <TableRow>
                  <TableHead>Référence</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Commande</TableHead>
                  <TableHead>Demandeur</TableHead>
                  <TableHead numerique>Articles</TableHead>
                  <TableHead numerique>Montant (FCFA)</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead aria-label="Ouvrir" />
                </TableRow>
              </TableHeader>
              {/* Pas de bandes alternées : la fiche dépliée s'insère sous sa ligne. */}
              <TableBody bandes={false}>
                {commandesFiltrees.map((c: any) => {
                  const id = String(c._id);
                  const estSelectionne = sel === id;
                  const statutObj = STATUT_CONFIG[c.statut] ?? STATUT_CONFIG.en_attente;

                  return (
                    <Fragment key={id}>
                      <TableRow
                        active={estSelectionne}
                        tabIndex={0}
                        aria-selected={estSelectionne}
                        aria-expanded={estSelectionne}
                        onClick={() => setSel(estSelectionne ? null : id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSel(estSelectionne ? null : id);
                          }
                        }}
                        className={cn("cursor-pointer", estSelectionne && "shadow-[inset_3px_0_0_var(--ocean-ceruleen)]")}
                      >
                        <TableCell className="whitespace-nowrap font-mono text-xs font-semibold text-ocean-profond">
                          {c.reference}
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-mono text-xs tabular-nums">
                          {fmtDate(c.date)}
                        </TableCell>
                        <TableCell className="leading-tight">
                          <div className="text-[13px] font-semibold">{c.libelle ?? "—"}</div>
                          {c.service ? (
                            <div className="whitespace-nowrap text-2xs text-encre-pale">{c.service}</div>
                          ) : null}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs">{c.demandeur}</TableCell>
                        <TableCell numerique className="font-mono text-xs">
                          {c.nbLignes ? c.nbLignes : <span className="text-encre-pale">0</span>}
                        </TableCell>
                        <TableCell numerique className="font-mono text-xs font-semibold">
                          {c.total ? fcfa(c.total).replace(" FCFA", "") : <span className="text-encre-pale">0</span>}
                        </TableCell>
                        <TableCell>
                          <Flag variant={statutObj.variant} size="xs">
                            {statutObj.label}
                          </Flag>
                        </TableCell>
                        <TableCell className="text-ocean-profond">
                          <ChevronRight
                            className={cn("h-4 w-4 transition-transform", estSelectionne && "rotate-90")}
                            aria-hidden="true"
                          />
                        </TableCell>
                      </TableRow>

                      {/* Fiche détaillée dépliable directement sous la ligne sélectionnée */}
                      {estSelectionne && (
                        <tr className="border-b border-filet bg-papier">
                          <td colSpan={8} className="p-2 sm:p-4">
                            {!detail || String(detail._id) !== id ? (
                              <div className="flex items-center justify-center p-8 text-xs text-slate-500 gap-2 bg-white rounded-xl border border-filet">
                                <Clock className="h-4 w-4 animate-spin text-ocean-profond" />
                                <span>Chargement des détails de la commande {c.reference}…</span>
                              </div>
                            ) : (
                              <Card className="border-ocean-ceruleen/50 bg-surface shadow-md overflow-hidden animate-in fade-in duration-200">
                                <CardHeader className="p-4 pb-3 border-b border-filet bg-gradient-to-r from-blue-50/60 to-white">
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div>
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-lg font-bold font-mono text-ocean-nuit">
                                          {detail.reference}
                                        </span>
                                        <Flag
                                          variant={STATUT_CONFIG[detail.statut]?.variant ?? "neutre"}
                                          size="sm"
                                        >
                                          {STATUT_CONFIG[detail.statut]?.label ?? detail.statut}
                                        </Flag>
                                        <Flag
                                          variant={detail.type === "medicale" ? "especes" : "direct"}
                                          size="xs"
                                        >
                                          {detail.type === "medicale" ? "Médicaments (DCI)" : "Fournitures"}
                                        </Flag>
                                      </div>
                                      <h3 className="text-xs sm:text-sm font-semibold text-encre-douce mt-1">
                                        {detail.libelle ?? "Bon de commande d'approvisionnement"}
                                      </h3>
                                    </div>

                                    <div className="flex items-center gap-2 self-start sm:self-auto">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() =>
                                          telechargerFichier(
                                            `${detail.reference}.csv`,
                                            exportCsvLignes(detail.lignes)
                                          )
                                        }
                                        className="h-8 text-xs gap-1.5 border-filet bg-white hover:bg-slate-50"
                                      >
                                        <Download className="h-3.5 w-3.5 text-ocean-profond" />
                                        Exporter CSV
                                      </Button>
                                      <button
                                        type="button"
                                        onClick={() => setSel(null)}
                                        className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                                        title="Fermer la vue détaillée"
                                      >
                                        <X className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </div>
                                </CardHeader>

                                <CardContent className="p-4 sm:p-5 space-y-4">
                                  {/* Cartouche des métadonnées */}
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-xl bg-papier/60 border border-filet text-xs">
                                    <div>
                                      <span className="text-3xs uppercase font-bold text-slate-400 block">Date</span>
                                      <span className="font-semibold text-ocean-nuit font-mono">{fmtDate(detail.date)}</span>
                                    </div>
                                    <div>
                                      <span className="text-3xs uppercase font-bold text-slate-400 block">Demandeur</span>
                                      <span className="font-semibold text-ocean-nuit">{detail.demandeur}</span>
                                    </div>
                                    <div>
                                      <span className="text-3xs uppercase font-bold text-slate-400 block">Service</span>
                                      <span className="font-semibold text-ocean-nuit">{detail.service ?? "—"}</span>
                                    </div>
                                    <div>
                                      <span className="text-3xs uppercase font-bold text-slate-400 block">Validation</span>
                                      <span className="font-semibold text-ocean-nuit">
                                        {detail.validateur
                                          ? `${detail.validateur} · ${fmtDate(detail.valideLe?.slice(0, 10) ?? "")}`
                                          : "En attente d'arbitrage"}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Tableau exhaustif des articles */}
                                  <div className="space-y-1.5">
                                    <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                                      <span>Articles commandés ({detail.lignes.length})</span>
                                      <span className="font-mono text-ocean-profond">{fcfa(detail.total)}</span>
                                    </div>

                                    <div className="rounded-xl border border-filet overflow-hidden">
                                      <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs border-collapse">
                                          <thead>
                                            <tr className="bg-slate-50 border-b border-filet text-3xs font-bold uppercase text-slate-600 tracking-wider">
                                              <th className="p-2.5 w-10 text-center">#</th>
                                              <th className="p-2.5">Produit</th>
                                              {detail.type === "medicale" && <th className="p-2.5">DCI</th>}
                                              <th className="p-2.5 text-right w-24">Quantité</th>
                                              <th className="p-2.5 text-right w-32">Prix unitaire</th>
                                              <th className="p-2.5 text-right w-36">Total</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-filet bg-white">
                                            {detail.lignes.map((l: any, i: number) => (
                                              <tr key={i} className="hover:bg-slate-50/50">
                                                <td className="p-2.5 text-center font-mono text-slate-400 text-2xs">
                                                  {i + 1}
                                                </td>
                                                <td className="p-2.5 font-medium text-encre">
                                                  {l.produit}
                                                </td>
                                                {detail.type === "medicale" && (
                                                  <td className="p-2.5 text-slate-500">
                                                    {l.dci ?? "—"}
                                                  </td>
                                                )}
                                                <td className="p-2.5 text-right font-mono">
                                                  {l.quantite}
                                                </td>
                                                <td className="p-2.5 text-right font-mono text-slate-600">
                                                  {fcfa(l.prixUnitaire)}
                                                </td>
                                                <td className="p-2.5 text-right font-mono font-bold text-ocean-nuit">
                                                  {fcfa(totalLigne(l))}
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                          <tfoot>
                                            <tr className="bg-slate-50 border-t-2 border-filet font-bold">
                                              <td colSpan={detail.type === "medicale" ? 5 : 4} className="p-3 text-right text-xs text-slate-700">
                                                Total général arrêté :
                                              </td>
                                              <td className="p-3 text-right font-mono text-sm text-ocean-profond font-extrabold">
                                                {fcfa(detail.total)}
                                              </td>
                                            </tr>
                                          </tfoot>
                                        </table>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Cartouche d'analyse comparative avec la commande précédente */}
                                  <div className="rounded-xl border border-filet bg-papier/60 p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <FileSpreadsheet className="h-4 w-4 text-ocean-profond" />
                                        <span className="text-xs font-bold text-ocean-nuit">
                                          Analyse comparative avec la commande précédente
                                        </span>
                                      </div>
                                      {detail.precedente && (
                                        <span className="text-3xs font-mono text-slate-500">
                                          Réf. {detail.precedente.reference} ({fmtDate(detail.precedente.date)})
                                        </span>
                                      )}
                                    </div>

                                    {detail.comparaison && detail.precedente ? (
                                      <div className="space-y-2.5">
                                        <div className="flex items-center gap-2 text-xs text-encre bg-white p-2.5 rounded-lg border border-filet">
                                          {detail.comparaison.variation >= 0 ? (
                                            <TrendingUp className="h-4 w-4 text-rose-600 shrink-0" />
                                          ) : (
                                            <TrendingDown className="h-4 w-4 text-emerald-600 shrink-0" />
                                          )}
                                          <span>
                                            Variation globale :{" "}
                                            <b>
                                              {detail.comparaison.variation >= 0 ? "+" : ""}
                                              {fcfa(detail.comparaison.variation)}
                                            </b>
                                            {detail.comparaison.variationPct != null && (
                                              <span className="text-slate-500 ml-1">
                                                ({detail.comparaison.variationPct >= 0 ? "+" : ""}
                                                {detail.comparaison.variationPct} %)
                                              </span>
                                            )}{" "}
                                            · {detail.comparaison.inchanges} article(s) à volume et prix identiques.
                                          </span>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-2xs">
                                          {/* Articles ajoutés */}
                                          <div className="rounded-lg bg-emerald-50/70 border border-emerald-200/70 p-2.5 space-y-1">
                                            <div className="font-bold text-emerald-900 flex items-center justify-between">
                                              <span>Articles ajoutés</span>
                                              <span className="font-mono">({detail.comparaison.ajoutes.length})</span>
                                            </div>
                                            <div className="text-emerald-800 max-h-24 overflow-y-auto space-y-0.5">
                                              {detail.comparaison.ajoutes.map((l: any) => (
                                                <div key={l.produit} className="truncate">
                                                  + {l.produit} × {l.quantite}
                                                </div>
                                              ))}
                                              {!detail.comparaison.ajoutes.length && <span className="text-slate-400">Aucun</span>}
                                            </div>
                                          </div>

                                          {/* Articles retirés */}
                                          <div className="rounded-lg bg-rose-50/70 border border-rose-200/70 p-2.5 space-y-1">
                                            <div className="font-bold text-rose-900 flex items-center justify-between">
                                              <span>Articles retirés</span>
                                              <span className="font-mono">({detail.comparaison.retires.length})</span>
                                            </div>
                                            <div className="text-rose-800 max-h-24 overflow-y-auto space-y-0.5">
                                              {detail.comparaison.retires.map((l: any) => (
                                                <div key={l.produit} className="truncate">
                                                  − {l.produit} × {l.quantite}
                                                </div>
                                              ))}
                                              {!detail.comparaison.retires.length && <span className="text-slate-400">Aucun</span>}
                                            </div>
                                          </div>

                                          {/* Articles modifiés */}
                                          <div className="rounded-lg bg-amber-50/70 border border-amber-200/70 p-2.5 space-y-1">
                                            <div className="font-bold text-amber-900 flex items-center justify-between">
                                              <span>Prix ou volumes modifiés</span>
                                              <span className="font-mono">({detail.comparaison.modifies.length})</span>
                                            </div>
                                            <div className="text-amber-800 max-h-24 overflow-y-auto space-y-0.5">
                                              {detail.comparaison.modifies.map((m: any) => (
                                                <div key={m.produit} className="truncate">
                                                  {m.produit} : {m.avant.quantite} × {fcfa(m.avant.prixUnitaire)} →{" "}
                                                  <b>
                                                    {m.apres.quantite} × {fcfa(m.apres.prixUnitaire)}
                                                  </b>
                                                </div>
                                              ))}
                                              {!detail.comparaison.modifies.length && <span className="text-slate-400">Aucun</span>}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="text-xs text-slate-500 italic bg-white p-2.5 rounded-lg border border-filet">
                                        Première commande enregistrée pour ce flux : aucun historique antérieur pour comparaison.
                                      </div>
                                    )}
                                  </div>

                                  {/* Espace de validation hiérarchique (Workflow Direction) */}
                                  {(detail.statut === "en_attente" || detail.statut === "validee") && (
                                    <div className="p-4 rounded-xl border border-filet bg-gradient-to-r from-slate-50 to-white space-y-3">
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                                          Décision & Workflow opérationnel
                                        </span>
                                        <Flag
                                          variant={STATUT_CONFIG[detail.statut]?.variant ?? "neutre"}
                                          size="xs"
                                        >
                                          {STATUT_CONFIG[detail.statut]?.label}
                                        </Flag>
                                      </div>

                                      {detail.statut === "en_attente" && (
                                        <>
                                          {niveau >= 5 ? (
                                            <div className="space-y-3">
                                              {demandeRejet && (
                                                <div className="space-y-1.5 p-3 rounded-xl bg-rose-50 border border-rose-200 animate-in fade-in">
                                                  <label className="text-xs font-bold text-rose-900 block">
                                                    Motif obligatoire du rejet de la commande :
                                                  </label>
                                                  <Input
                                                    autoFocus
                                                    value={motifRejet}
                                                    onChange={(e) => setMotifRejet(e.target.value)}
                                                    placeholder="Ex: Dépassement budgétaire, doublon avec commande passée…"
                                                    className="h-8 text-xs bg-white border-rose-300"
                                                  />
                                                </div>
                                              )}

                                              <div className="flex items-center gap-2 flex-wrap">
                                                <Button
                                                  size="sm"
                                                  disabled={enTransition}
                                                  onClick={() => transitionStatut("validee")}
                                                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold gap-1.5"
                                                >
                                                  <Check className="h-3.5 w-3.5" />
                                                  Valider le bon de commande
                                                </Button>

                                                {demandeRejet ? (
                                                  <Button
                                                    size="sm"
                                                    variant="destructive"
                                                    disabled={!motifRejet.trim() || enTransition}
                                                    onClick={() => transitionStatut("rejetee")}
                                                    className="text-xs font-bold gap-1.5"
                                                  >
                                                    <Ban className="h-3.5 w-3.5" />
                                                    Confirmer le rejet
                                                  </Button>
                                                ) : (
                                                  <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => setDemandeRejet(true)}
                                                    className="text-xs font-semibold text-rose-700 hover:bg-rose-50 border-rose-200 gap-1.5"
                                                  >
                                                    <Ban className="h-3.5 w-3.5" />
                                                    Rejeter la commande
                                                  </Button>
                                                )}

                                                {demandeRejet && (
                                                  <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => {
                                                      setDemandeRejet(false);
                                                      setMotifRejet("");
                                                    }}
                                                    className="text-xs text-slate-500"
                                                  >
                                                    Annuler
                                                  </Button>
                                                )}
                                              </div>
                                            </div>
                                          ) : (
                                            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
                                              <Clock className="h-4 w-4 text-amber-600 shrink-0" />
                                              <span>
                                                En attente d'arbitrage par la Direction Générale ou Administrative (Niveau 5+).
                                              </span>
                                            </div>
                                          )}
                                        </>
                                      )}

                                      {detail.statut === "validee" && (
                                        <div className="flex items-center justify-between gap-3 flex-wrap">
                                          <div className="text-xs text-emerald-800 flex items-center gap-2">
                                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                            <span>Commande validée le {fmtDate(detail.valideLe?.slice(0, 10) ?? "")}.</span>
                                          </div>

                                          {niveau >= 3 && (
                                            <Button
                                              size="sm"
                                              disabled={enTransition}
                                              onClick={() => transitionStatut("livree")}
                                              className="bg-ocean-profond hover:bg-ocean-nuit text-white text-xs font-bold gap-1.5"
                                            >
                                              <Truck className="h-3.5 w-3.5" />
                                              Confirmer la réception (Marquer comme livrée)
                                            </Button>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* Fil de discussion & commentaires */}
                                  <div className="space-y-2.5 pt-2 border-t border-filet">
                                    <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                                      <MessageSquare className="h-4 w-4 text-ocean-profond" />
                                      <span>Commentaires et échanges ({detail.commentaires?.length ?? 0})</span>
                                    </div>

                                    <div className="space-y-2 max-h-48 overflow-y-auto">
                                      {(detail.commentaires ?? []).map((c: any, i: number) => (
                                        <div
                                          key={i}
                                          className="p-3 rounded-xl bg-papier/70 border border-filet text-xs space-y-1"
                                        >
                                          <div className="flex items-center justify-between text-3xs text-slate-500">
                                            <span className="font-bold text-ocean-nuit">{c.auteur}</span>
                                            <span className="font-mono">
                                              {new Date(c.date).toLocaleString("fr-FR", {
                                                dateStyle: "short",
                                                timeStyle: "short",
                                              })}
                                            </span>
                                          </div>
                                          <p className="text-slate-700 leading-relaxed">{c.texte}</p>
                                        </div>
                                      ))}
                                      {!detail.commentaires?.length && (
                                        <div className="text-xs text-slate-400 italic">
                                          Aucun commentaire pour le moment sur cette commande.
                                        </div>
                                      )}
                                    </div>

                                    {/* Saisie de nouveau commentaire */}
                                    <div className="flex items-center gap-2 pt-1">
                                      <Input
                                        value={texteCommentaire}
                                        onChange={(e) => setTexteCommentaire(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && posterCommentaire()}
                                        placeholder="Ajouter une note ou poser une question…"
                                        className="h-8 text-xs bg-white"
                                      />
                                      <Button
                                        size="sm"
                                        disabled={!texteCommentaire.trim()}
                                        onClick={posterCommentaire}
                                        className="h-8 text-xs bg-ocean-profond hover:bg-ocean-nuit text-white px-3 gap-1"
                                      >
                                        <Send className="h-3 w-3" />
                                        Publier
                                      </Button>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

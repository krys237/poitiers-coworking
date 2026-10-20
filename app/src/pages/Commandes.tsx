import { useState, useMemo, useRef, Fragment } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { parseCsvLignes, exportCsvLignes, totalCommande, normaliserCleProduit } from "../../convex/lib/commandes";
import { fcfa, messageErreur } from "../lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Flag, FlagVariant } from "@/components/ui/flag";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SelecteurLignes, useLignesVisibles } from "@/components/app/lignes-visibles";
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
  FlaskConical,
  Building2,
  Send,
  Trash2,
  FileSpreadsheet,
  TrendingUp,
  TrendingDown,
  Check,
  Ban,
  Truck,
  MessageSquare,
  FileText,
  Printer,
  Pencil,
} from "lucide-react";
import { ModalFournisseur } from "@/components/app/modal-fournisseur";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { RegistreCommandeTable, type LigneRegistre } from "@/components/app/registre-commande-table";
import { CircuitApprovisionnement } from "@/components/app/circuit-approvisionnement";
import { ModalProforma } from "@/components/app/modal-proforma";
import { ModalReceptionLitige } from "@/components/app/modal-reception-litige";
import { ModalResolutionLitige } from "@/components/app/modal-resolution-litige";
import { PackageCheck, AlertCircle } from "lucide-react";

type TypeCommande = "medicale" | "fourniture" | "reactifs_labo";
type Ligne = LigneRegistre;

const STATUT_CONFIG: Record<string, { label: string; variant: FlagVariant; icon?: any }> = {
  preparation: { label: "Préparation", variant: "a-renseigner" },
  en_attente: { label: "En attente DG", variant: "finance" },
  validee: { label: "Validée DG", variant: "finance" },
  en_reception: { label: "En réception", variant: "direct" },
  en_litige: { label: "En litige", variant: "om" },
  rejetee: { label: "Rejetée", variant: "verrou" },
  livree: { label: "Livrée", variant: "especes" },
  cloturee: { label: "Clôturée", variant: "especes" },
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
const LIGNE_VIDE: Ligne = {
  produit: "",
  ancienneDate: "",
  ancienneQuantite: undefined,
  quantiteUtilisee: undefined,
  quantiteRestante: undefined,
  quantite: 1,
  prixUnitaire: 0,
};

function telechargerFichier(nom: string, contenu: string) {
  const url = URL.createObjectURL(new Blob([contenu], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nom;
  a.click();
  URL.revokeObjectURL(url);
}

function CommandesContenu() {
  const me = useQuery(api.users.me);
  const [type, setType] = useState<TypeCommande>("medicale");
  const liste = useQuery(api.commandes.liste, {});
  const fournisseurs = useQuery(api.fournisseurs.liste, {});

  const [sel, setSel] = useState<string | null>(null);
  const detail = useQuery(api.commandes.detail, sel ? { commandeId: sel as any } : "skip");
  // Récupération des antécédents d'achats en BD (Option 1 : verrouillage automatique / Option 3 : saisie libre si base vide)
  const antecedentsCreation = useQuery(api.commandes.derniersAchats, { type });
  const antecedentsModif = useQuery(
    api.commandes.derniersAchats,
    detail ? { type: detail.type, saufCommandeId: detail._id } : "skip"
  );


  const creer = useMutation(api.commandes.creer);
  const modifier = useMutation(api.commandes.modifier);
  const supprimer = useMutation(api.commandes.supprimer);
  const changerStatut = useMutation(api.commandes.changerStatut);
  const commenter = useMutation(api.commandes.commenter);

  // État de modification d'un bon en préparation
  const [enModeEdition, setEnModeEdition] = useState(false);
  const [fModif, setFModif] = useState({
    date: "",
    fournisseurId: "",
    libelle: "",
    demandeur: "",
    service: "",
    commentaire: "",
  });
  const [lignesModif, setLignesModif] = useState<Ligne[]>([]);
  const [enEnregistrementModif, setEnEnregistrementModif] = useState(false);

  const [recherche, setRecherche] = useState("");
  const [fournisseurFiltre, setFournisseurFiltre] = useState<string>("tous");
  const [etapeFiltre, setEtapeFiltre] = useState<string>("toutes");
  const [modalFournisseurOuverte, setModalFournisseurOuverte] = useState(false);
  const [modalProformaOuverte, setModalProformaOuverte] = useState(false);
  const [commandePourProforma, setCommandePourProforma] = useState<any | null>(null);
  const [modalReceptionOuverte, setModalReceptionOuverte] = useState(false);
  const [commandePourReception, setCommandePourReception] = useState<any | null>(null);
  const [modalResolutionOuverte, setModalResolutionOuverte] = useState(false);
  const [commandePourResolution, setCommandePourResolution] = useState<any | null>(null);

  const lignesVisibles = useLignesVisibles("commandes");
  const [ouvrirForm, setOuvrirForm] = useState(false);
  const [enCreation, setEnCreation] = useState(false);
  const [enTransition, setEnTransition] = useState(false);

  const [f, setF] = useState({
    date: aujourdHui(),
    fournisseurId: "",
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
  const peutValider = !!me?.droits?.["/commandes/validation"]?.faire;
  const peutGerer = !!me?.droits?.["/commandes"]?.faire;




  const lignesValides = useMemo(
    () => lignes.filter((l) => l.produit.trim()),
    [lignes]
  );

  /* const _totalFormulaire = useMemo(
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

  */
  const toutesCommandes = useMemo(() => liste ?? [], [liste]);

  const countMedicale = useMemo(
    () => toutesCommandes.filter((c: any) => c.type === "medicale").length,
    [toutesCommandes]
  );
  const countFourniture = useMemo(
    () => toutesCommandes.filter((c: any) => c.type === "fourniture").length,
    [toutesCommandes]
  );
  const countReactifsLabo = useMemo(
    () => toutesCommandes.filter((c: any) => c.type === "reactifs_labo").length,
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
      if (c.statut === "preparation" || c.statut === "en_attente") enAttente++;
      if (c.statut === "validee" || c.statut === "en_reception" || c.statut === "livree" || c.statut === "cloturee") validees++;
      engage += c.total || 0;
    }

    return {
      totalCommandes: commandesDuType.length,
      nbEnAttente: enAttente,
      nbValidees: validees,
      totalEngage: engage,
    };
  }, [commandesDuType]);

  // Compteurs par étape du circuit d'approvisionnement (avec litiges)
  const compteursEtapes = useMemo(() => {
    let prep = 0;
    let att = 0;
    let recep = 0;
    let litiges = 0;
    let clot = 0;
    let rej = 0;

    for (const c of commandesDuType) {
      if (c.statut === "preparation") prep++;
      else if (c.statut === "en_attente") att++;
      else if (c.statut === "en_litige") {
        litiges++;
        recep++;
      } else if (c.statut === "validee" || c.statut === "en_reception") recep++;
      else if (c.statut === "cloturee" || c.statut === "livree") clot++;
      else if (c.statut === "rejetee") rej++;
    }

    return {
      toutes: commandesDuType.length,
      preparation: prep,
      en_attente: att,
      en_reception: recep,
      litiges,
      cloturee: clot,
      rejets: rej,
    };
  }, [commandesDuType]);

  // Filtrage des commandes par étape, fournisseur et terme de recherche
  const commandesFiltrees = useMemo(() => {
    let list = commandesDuType;

    // Filtre par étape du circuit
    if (etapeFiltre === "preparation") {
      list = list.filter((c: any) => c.statut === "preparation");
    } else if (etapeFiltre === "en_attente") {
      list = list.filter((c: any) => c.statut === "en_attente");
    } else if (etapeFiltre === "en_reception") {
      list = list.filter((c: any) => c.statut === "validee" || c.statut === "en_reception");
    } else if (etapeFiltre === "litiges") {
      list = list.filter((c: any) => c.statut === "en_litige");
    } else if (etapeFiltre === "cloturee") {
      list = list.filter((c: any) => c.statut === "cloturee" || c.statut === "livree");
    } else if (etapeFiltre === "rejets") {
      list = list.filter((c: any) => c.statut === "rejetee");
    }

    // Filtre par fournisseur
    if (fournisseurFiltre !== "tous") {
      list = list.filter((c: any) => c.fournisseurId === fournisseurFiltre);
    }

    // Recherche plein texte
    const q = recherche.trim().toLowerCase();
    if (!q) return list;
    return list.filter((c: any) =>
      `${c.reference} ${c.libelle ?? ""} ${c.demandeur} ${c.service ?? ""} ${c.fournisseur?.nom ?? ""}`
        .toLowerCase()
        .includes(q)
    );
  }, [commandesDuType, etapeFiltre, fournisseurFiltre, recherche]);

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
      // Synchronisation avec les antécédents en base :
      // Option 1 : si le produit a déjà été commandé, on verrouille avec l'historique de BD
      // Option 3 : si premier achat (base vide ou nouveau produit), on conserve les valeurs du CSV
      const mapAnt = new Map<string, any>();
      if (antecedentsCreation) {
        for (const a of antecedentsCreation) {
          mapAnt.set(a.cle || normaliserCleProduit(a.produit), a);
        }
      }

      const parsedAjuste = parsed.map((l) => {
        const k = normaliserCleProduit(l.produit);
        const ant = mapAnt.get(k);
        if (ant) {
          const ancQte = ant.quantite;
          const ancDate = ant.date;
          const rest = l.quantiteRestante;
          const ut = rest !== undefined ? Math.max(0, ancQte - rest) : l.quantiteUtilisee;
          return {
            ...l,
            ancienneDate: ancDate,
            ancienneQuantite: ancQte,
            quantiteUtilisee: ut,
            prixUnitaire: l.prixUnitaire || ant.prixUnitaire || 0,
          };
        }
        return l;
      });

      setLignes(parsedAjuste);
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
        fournisseurId: f.fournisseurId ? (f.fournisseurId as any) : undefined,
        date: f.date,
        libelle: f.libelle.trim() || undefined,
        demandeur: f.demandeur.trim() || (me?.nom ?? ""),
        service: f.service.trim() || undefined,
        commentaire: f.commentaire.trim() || undefined,
        lignes: lignesValides.map((l) => ({
          produit: l.produit.trim(),
          ancienneDate: l.ancienneDate || undefined,
          ancienneQuantite: l.ancienneQuantite !== undefined ? Number(l.ancienneQuantite) : undefined,
          quantiteUtilisee: l.quantiteUtilisee !== undefined ? Number(l.quantiteUtilisee) : undefined,
          quantiteRestante: l.quantiteRestante !== undefined ? Number(l.quantiteRestante) : undefined,
          quantite: Number(l.quantite) || 1,
          prixUnitaire: Number(l.prixUnitaire) || 0,
        })),
      });

      toast.success(`Commande ${r.reference} créée avec succès`, {
        description: `Montant total : ${fcfa(r.total)}. Enregistrée en préparation.`,
      });

      setOuvrirForm(false);
      setLignes([{ ...LIGNE_VIDE }, { ...LIGNE_VIDE }, { ...LIGNE_VIDE }]);
      setF({ date: aujourdHui(), fournisseurId: "", libelle: "", demandeur: "", service: "", commentaire: "" });
      setSel(r.id);
    } catch (err) {
      toast.error("Erreur de création", { description: messageErreur(err) });
    } finally {
      setEnCreation(false);
    }
  };

  const demarrerModification = () => {
    if (!detail) return;
    setFModif({
      date: detail.date,
      fournisseurId: detail.fournisseurId ?? "",
      libelle: detail.libelle ?? "",
      demandeur: detail.demandeur ?? "",
      service: detail.service ?? "",
      commentaire: "",
    });
    setLignesModif(
      detail.lignes.map((l: any) => ({
        produit: l.produit,
        dci: l.dci ?? "",
        ancienneDate: l.ancienneDate ?? "",
        ancienneQuantite: l.ancienneQuantite,
        quantiteUtilisee: l.quantiteUtilisee,
        quantiteRestante: l.quantiteRestante,
        quantite: l.quantite,
        prixUnitaire: l.prixUnitaire,
      }))
    );
    setEnModeEdition(true);
  };

  const totalLignesModif = useMemo(
    () =>
      totalCommande(
        lignesModif
          .filter((l) => l.produit.trim())
          .map((l) => ({
            ...l,
            quantite: Number(l.quantite) || 0,
            prixUnitaire: Number(l.prixUnitaire) || 0,
          }))
      ),
    [lignesModif]
  );

  const onEnregistrerModif = async (etSoumettre = false) => {
    if (!detail) return;
    const lignesValidesModif = lignesModif.filter((l) => l.produit.trim());
    if (!lignesValidesModif.length) {
      toast.error("Veuillez renseigner au moins une ligne de produit.");
      return;
    }
    setEnEnregistrementModif(true);
    try {
      await modifier({
        commandeId: detail._id,
        type: detail.type,
        date: fModif.date,
        fournisseurId: fModif.fournisseurId ? (fModif.fournisseurId as any) : undefined,
        libelle: fModif.libelle.trim() || undefined,
        demandeur: fModif.demandeur.trim() || (me?.nom ?? ""),
        service: fModif.service.trim() || undefined,
        commentaire: fModif.commentaire.trim() || undefined,
        lignes: lignesValidesModif.map((l) => ({
          produit: l.produit.trim(),
          dci: l.dci?.trim() || undefined,
          ancienneDate: l.ancienneDate || undefined,
          ancienneQuantite: l.ancienneQuantite !== undefined ? Number(l.ancienneQuantite) : undefined,
          quantiteUtilisee: l.quantiteUtilisee !== undefined ? Number(l.quantiteUtilisee) : undefined,
          quantiteRestante: l.quantiteRestante !== undefined ? Number(l.quantiteRestante) : undefined,
          quantite: Number(l.quantite) || 1,
          prixUnitaire: Number(l.prixUnitaire) || 0,
        })),
      });

      if (etSoumettre) {
        await changerStatut({ commandeId: detail._id, statut: "en_attente" });
        toast.success(`Bon ${detail.reference} mis à jour et soumis à la Direction`);
      } else {
        toast.success(`Bon ${detail.reference} mis à jour avec succès (enregistré en préparation)`);
      }
      setEnModeEdition(false);
    } catch (err) {
      toast.error("Erreur lors de la modification", { description: messageErreur(err) });
    } finally {
      setEnEnregistrementModif(false);
    }
  };

  const onSupprimerBrouillon = async () => {
    if (!detail) return;
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer définitivement le bon ${detail.reference} ?`)) {
      return;
    }
    try {
      await supprimer({ commandeId: detail._id });
      toast.success(`Bon ${detail.reference} supprimé avec succès`);
      setSel(null);
      setEnModeEdition(false);
    } catch (err) {
      toast.error("Erreur lors de la suppression", { description: messageErreur(err) });
    }
  };

  const transitionStatut = async (
    nouveauStatut: "preparation" | "en_attente" | "validee" | "en_reception" | "en_litige" | "rejetee" | "livree" | "cloturee",
    options?: { commentaire?: string; ouvrirProforma?: boolean }
  ) => {
    if (!sel) return;
    const motif = options?.commentaire ?? motifRejet;
    if (nouveauStatut === "rejetee" && !motif.trim()) {
      toast.error("Un motif de rejet est obligatoire pour refuser la commande.");
      return;
    }

    setEnTransition(true);
    try {
      await changerStatut({
        commandeId: sel as any,
        statut: nouveauStatut,
        commentaire: motif.trim() || undefined,
      });

      toast.success(`Statut mis à jour : ${STATUT_CONFIG[nouveauStatut]?.label ?? nouveauStatut}`);
      setMotifRejet("");
      setDemandeRejet(false);

      if (nouveauStatut === "validee" && options?.ouvrirProforma && detail) {
        setCommandePourProforma(detail);
        setModalProformaOuverte(true);
      }
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
      <div className="rounded-2xl border border-filet bg-surface p-3 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Onglets de type de commande : design unifié, sobre et élégant */}
          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100/90 border border-filet self-start shadow-2xs">
            <button
              type="button"
              onClick={() => {
                setType("medicale");
                setSel(null);
              }}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all cursor-pointer border",
                type === "medicale"
                  ? "bg-emerald-600 text-white font-bold shadow-xs border-emerald-600 ring-2 ring-emerald-500/20"
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
                "flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all cursor-pointer border",
                type === "fourniture"
                  ? "bg-ocean-profond text-white font-bold shadow-xs border-ocean-profond ring-2 ring-ocean-profond/20"
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

            <button
              type="button"
              onClick={() => {
                setType("reactifs_labo");
                setSel(null);
              }}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all cursor-pointer border",
                type === "reactifs_labo"
                  ? "bg-purple-600 text-white font-bold shadow-xs border-purple-600 ring-2 ring-purple-500/20"
                  : "text-slate-700 hover:text-purple-950 hover:bg-purple-50/80 border-transparent"
              )}
            >
              <FlaskConical className={cn("h-4 w-4", type === "reactifs_labo" ? "text-white" : "text-purple-600")} />
              <span>Réactifs Labo</span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-3xs font-mono font-bold",
                  type === "reactifs_labo"
                    ? "bg-white/25 text-white"
                    : "bg-purple-100 text-purple-800"
                )}
              >
                {countReactifsLabo}
              </span>
            </button>
          </div>

          {/* Filtres secondaires : Fournisseur et recherche */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 border border-filet shadow-2xs">
              <Building2 className="h-3.5 w-3.5 text-slate-500 shrink-0" />
              <select
                value={fournisseurFiltre}
                onChange={(e) => setFournisseurFiltre(e.target.value)}
                className="text-xs font-medium text-slate-700 bg-transparent border-0 focus:outline-hidden cursor-pointer"
                aria-label="Filtrer par fournisseur"
              >
                <option value="tous">Tous les fournisseurs ({fournisseurs?.length ?? 0})</option>
                {fournisseurs?.map((fourn: any) => (
                  <option key={fourn._id} value={fourn._id}>
                    {fourn.nom}
                  </option>
                ))}
              </select>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setModalFournisseurOuverte(true)}
              className="h-9 px-3 text-xs font-semibold gap-1 text-ocean-profond border-ocean-ciel/40 bg-white hover:bg-ocean-brume/20 shadow-2xs"
              title="Ajouter un nouveau fournisseur"
            >
              <Plus className="h-3.5 w-3.5" />
              Fournisseur
            </Button>

            <SelecteurLignes valeur={lignesVisibles.lignes} onChange={lignesVisibles.setLignes} />

            {/* Barre de recherche temps réel */}
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                type="search"
                placeholder="Réf, libellé, demandeur…"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                className="pl-8 pr-8 h-9 text-xs bg-white border-filet focus-visible:ring-ocean-profond"
              />
              {recherche && (
                <button
                  type="button"
                  onClick={() => setRecherche("")}
                  className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  title="Effacer la recherche"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Barre de navigation des 4 étapes : palette unifiée, claire et professionnelle */}
        <div className="pt-2.5 border-t border-filet flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs">
          <span className="text-3xs font-bold uppercase tracking-wider text-slate-400 mr-1.5 shrink-0">
            Circuit :
          </span>

          <div className="inline-flex items-center gap-1 p-0.5 rounded-xl bg-slate-100/70 border border-filet flex-wrap">
            <button
              type="button"
              onClick={() => setEtapeFiltre("toutes")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer",
                etapeFiltre === "toutes"
                  ? "bg-ocean-profond text-white shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              )}
            >
              <span>Toutes les étapes</span>
              <span
                className={cn(
                  "px-1.5 py-0.5 rounded-full text-3xs font-mono font-bold",
                  etapeFiltre === "toutes"
                    ? "bg-white/25 text-white"
                    : "bg-slate-200 text-slate-600"
                )}
              >
                {compteursEtapes.toutes}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setEtapeFiltre("preparation")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer",
                etapeFiltre === "preparation"
                  ? "bg-ocean-profond text-white shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              )}
            >
              <span>1. Préparation</span>
              <span
                className={cn(
                  "px-1.5 py-0.5 rounded-full text-3xs font-mono font-bold",
                  etapeFiltre === "preparation"
                    ? "bg-white/25 text-white"
                    : "bg-slate-200 text-slate-600"
                )}
              >
                {compteursEtapes.preparation}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setEtapeFiltre("en_attente")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer",
                etapeFiltre === "en_attente"
                  ? "bg-ocean-profond text-white shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              )}
            >
              <span>2. Validation DG</span>
              <span
                className={cn(
                  "px-1.5 py-0.5 rounded-full text-3xs font-mono font-bold",
                  etapeFiltre === "en_attente"
                    ? "bg-white/25 text-white"
                    : "bg-slate-200 text-slate-600"
                )}
              >
                {compteursEtapes.en_attente}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setEtapeFiltre("en_reception")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer",
                etapeFiltre === "en_reception"
                  ? "bg-ocean-profond text-white shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              )}
            >
              <span>3. En réception</span>
              <span
                className={cn(
                  "px-1.5 py-0.5 rounded-full text-3xs font-mono font-bold",
                  etapeFiltre === "en_reception"
                    ? "bg-white/25 text-white"
                    : "bg-slate-200 text-slate-600"
                )}
              >
                {compteursEtapes.en_reception}
              </span>
            </button>

            {/* Onglet Litiges : mis en avant dès qu'un litige existe */}
            <button
              type="button"
              onClick={() => setEtapeFiltre("litiges")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer",
                etapeFiltre === "litiges"
                  ? "bg-rose-600 text-white shadow-xs font-bold"
                  : compteursEtapes.litiges > 0
                  ? "text-rose-700 bg-rose-50 hover:bg-rose-100 font-bold border border-rose-200"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              )}
            >
              <span>Litiges</span>
              <span
                className={cn(
                  "px-1.5 py-0.5 rounded-full text-3xs font-mono font-bold",
                  etapeFiltre === "litiges"
                    ? "bg-white/25 text-white"
                    : compteursEtapes.litiges > 0
                    ? "bg-rose-600 text-white"
                    : "bg-slate-200 text-slate-600"
                )}
              >
                {compteursEtapes.litiges}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setEtapeFiltre("cloturee")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer",
                etapeFiltre === "cloturee"
                  ? "bg-ocean-profond text-white shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              )}
            >
              <span>4. Clôturées</span>
              <span
                className={cn(
                  "px-1.5 py-0.5 rounded-full text-3xs font-mono font-bold",
                  etapeFiltre === "cloturee"
                    ? "bg-white/25 text-white"
                    : "bg-slate-200 text-slate-600"
                )}
              >
                {compteursEtapes.cloturee}
              </span>
            </button>

            {compteursEtapes.rejets > 0 && (
              <button
                type="button"
                onClick={() => setEtapeFiltre("rejets")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer",
                  etapeFiltre === "rejets"
                    ? "bg-rose-700 text-white shadow-xs font-bold"
                    : "text-rose-700 hover:bg-rose-50"
                )}
              >
                <span>Rejetées</span>
                <span
                  className={cn(
                    "px-1.5 py-0.5 rounded-full text-3xs font-mono font-bold",
                    etapeFiltre === "rejets"
                      ? "bg-white/25 text-white"
                      : "bg-rose-100 text-rose-800"
                  )}
                >
                  {compteursEtapes.rejets}
                </span>
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
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border",
                      type === "medicale"
                        ? "bg-emerald-600 text-white font-bold shadow-xs border-emerald-600"
                        : "text-slate-600 hover:text-emerald-950 hover:bg-emerald-50 border-transparent"
                    )}
                  >
                    <Pill className={cn("h-3.5 w-3.5", type === "medicale" ? "text-white" : "text-emerald-600")} />
                    Médicaments
                  </button>
                  <button
                    type="button"
                    onClick={() => setType("fourniture")}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border",
                      type === "fourniture"
                        ? "bg-ocean-profond text-white font-bold shadow-xs border-ocean-profond"
                        : "text-slate-600 hover:text-ocean-nuit hover:bg-blue-50 border-transparent"
                    )}
                  >
                    <Package className={cn("h-3.5 w-3.5", type === "fourniture" ? "text-white" : "text-ocean-profond")} />
                    Fournitures
                  </button>
                  <button
                    type="button"
                    onClick={() => setType("reactifs_labo")}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border",
                      type === "reactifs_labo"
                        ? "bg-purple-600 text-white font-bold shadow-xs border-purple-600"
                        : "text-slate-600 hover:text-purple-950 hover:bg-purple-50 border-transparent"
                    )}
                  >
                    <FlaskConical className={cn("h-3.5 w-3.5", type === "reactifs_labo" ? "text-white" : "text-purple-600")} />
                    Réactifs Labo
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
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 p-3.5 rounded-xl bg-papier/60 border border-filet">
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
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-2xs font-bold uppercase tracking-wider text-slate-600">
                      Fournisseur
                    </label>
                    <button
                      type="button"
                      onClick={() => setModalFournisseurOuverte(true)}
                      className="text-3xs font-semibold text-ocean-profond hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      <Plus className="h-2.5 w-2.5" /> Nouveau
                    </button>
                  </div>
                  <select
                    value={f.fournisseurId}
                    onChange={(e) => setF({ ...f, fournisseurId: e.target.value })}
                    className="h-8 w-full text-xs rounded-md border border-filet bg-white px-2 text-slate-800"
                  >
                    <option value="">Sélectionner un fournisseur…</option>
                    {fournisseurs?.map((fourn: any) => (
                      <option key={fourn._id} value={fourn._id}>
                        {fourn.nom} {fourn.telephone ? `(${fourn.telephone})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-2xs font-bold uppercase tracking-wider text-slate-600 block mb-1">
                    Libellé / Objet
                  </label>
                  <Input
                    value={f.libelle}
                    onChange={(e) => setF({ ...f, libelle: e.target.value })}
                    placeholder={
                      type === "medicale"
                        ? "Réapprovisionnement mensuel"
                        : type === "reactifs_labo"
                        ? "Réactifs hématologie"
                        : "Fournitures bureau T3"
                    }
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
                    placeholder={type === "reactifs_labo" ? "Laboratoire" : "Pharmacie, Accueil…"}
                    className="h-8 text-xs bg-white"
                  />
                </div>
              </div>

              {/* Grille Registre de commande conforme au croquis manuscrit */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-2xs font-bold uppercase tracking-wider text-slate-700 block">
                    Registre des articles & Justification de réapprovisionnement
                  </label>
                  <span className="text-3xs text-muted-foreground">
                    Modèle officiel : Désignation · Ancienne commande (Date/Qté) · Qté utilisée · Qté restante · Nouvelle commande
                  </span>
                </div>
                <RegistreCommandeTable
                  lignes={lignes}
                  onChange={setLignes}
                  dateCommande={f.date}
                  editable={true}
                  categorie={type}
                  antecedents={antecedentsCreation}
                />
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
          ) : type === "reactifs_labo" ? (
            <Flag variant="finance" size="sm">
              <FlaskConical className="h-3 w-3 mr-1 inline text-purple-600" />
              Réactifs Laboratoire
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
              : fournisseurFiltre !== "tous"
              ? "Aucune commande trouvée pour ce fournisseur."
              : `Aucune commande de type ${
                  type === "medicale"
                    ? "médicaments"
                    : type === "reactifs_labo"
                    ? "réactifs labo"
                    : "fournitures"
                } enregistrée pour l'instant.`}
          </div>
        ) : (
          // Une fiche dépliée occupe plusieurs « lignes » : la hauteur choisie reste indicative.
          <Table classNameConteneur="rounded-xl" hauteurMax={lignesVisibles.hauteurMax(49)}>
              <TableHeader>
                <TableRow>
                  <TableHead>Référence</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Fournisseur</TableHead>
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
                        className={"cursor-pointer"}
                      >
                        <TableCell className="whitespace-nowrap font-mono text-xs font-semibold text-ocean-profond">
                          {c.reference}
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-mono text-xs tabular-nums">
                          {fmtDate(c.date)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          {c.fournisseur ? (
                            <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                              <Building2 className="h-3 w-3 text-slate-400" />
                              {c.fournisseur.nom}
                            </span>
                          ) : (
                            <span className="text-encre-pale">—</span>
                          )}
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

                                    <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                                      {(detail.statut === "preparation" || detail.statut === "rejetee") && peutGerer && !enModeEdition && (
                                          <>
                                            <Button
                                              size="sm"
                                              onClick={demarrerModification}
                                              className="h-8 text-xs gap-1.5 bg-ocean-profond hover:bg-ocean-nuit text-white font-bold shadow-2xs cursor-pointer"
                                              title="Modifier ce bon de commande en cours de préparation"
                                            >
                                              <Pencil className="h-3.5 w-3.5" />
                                              Modifier ce bon
                                            </Button>
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              onClick={onSupprimerBrouillon}
                                              className="h-8 text-xs gap-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
                                              title="Supprimer ce bon de commande"
                                            >
                                              <Trash2 className="h-3.5 w-3.5" />
                                              Supprimer
                                            </Button>
                                          </>
                                        )}
                                        <Button
                                        id="btn-bon-proforma"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          setCommandePourProforma(detail);
                                          setModalProformaOuverte(true);
                                        }}
                                        className="h-8 text-xs gap-1.5 border-ocean-profond/40 bg-ocean-ceruleen/10 text-ocean-profond hover:bg-ocean-ceruleen/20 font-bold shadow-2xs cursor-pointer"
                                        title="Éditer / Imprimer le bon de commande proforma officiel"
                                      >
                                        <FileText className="h-3.5 w-3.5" />
                                        Bon Proforma
                                      </Button>

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
                                        onClick={() => { setSel(null); setEnModeEdition(false); }}
                                        className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                                        title="Fermer la vue détaillée"
                                      >
                                        <X className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </div>
                                </CardHeader>

                                <CardContent className="p-4 sm:p-5 space-y-4">
                                  {/* Stepper visuel du circuit d'approvisionnement en 4 étapes */}
                                  <CircuitApprovisionnement
                                    statut={detail.statut}
                                    valideLe={detail.valideLe}
                                    validateur={detail.validateur}
                                  />

                                  {/* Mode Modification d'un bon en préparation */}
                                  {enModeEdition && (detail.statut === "preparation" || detail.statut === "rejetee") ? (
                                    <div className="space-y-4 rounded-xl border border-amber-300 bg-amber-50/50 p-4 shadow-xs animate-in fade-in duration-200">
                                      <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                                        <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                                          <Pencil className="h-4 w-4 text-amber-700" />
                                          <span>Modification du bon {detail.reference} ({detail.type})</span>
                                        </div>
                                        <Flag variant="a-renseigner" size="xs">
                                          Édition active
                                        </Flag>
                                      </div>

                                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                                        <div>
                                          <label className="text-2xs font-bold uppercase tracking-wider text-slate-700 block mb-1">
                                            Date du bon
                                          </label>
                                          <Input
                                            type="date"
                                            value={fModif.date}
                                            onChange={(e) => setFModif({ ...fModif, date: e.target.value })}
                                            className="h-8 text-xs bg-white font-mono"
                                          />
                                        </div>

                                        <div>
                                          <label className="text-2xs font-bold uppercase tracking-wider text-slate-700 block mb-1">
                                            Fournisseur
                                          </label>
                                          <select
                                            value={fModif.fournisseurId}
                                            onChange={(e) => setFModif({ ...fModif, fournisseurId: e.target.value })}
                                            className="h-8 w-full rounded-md border border-input bg-white px-2.5 text-xs text-encre focus:border-ocean-profond focus:outline-none"
                                          >
                                            <option value="">Sélectionner un fournisseur</option>
                                            {(fournisseurs ?? []).map((fourn: any) => (
                                              <option key={String(fourn._id)} value={String(fourn._id)}>
                                                {fourn.nom} {fourn.ville ? `(${fourn.ville})` : ""}
                                              </option>
                                            ))}
                                          </select>
                                        </div>

                                        <div>
                                          <label className="text-2xs font-bold uppercase tracking-wider text-slate-700 block mb-1">
                                            Libellé / Objet
                                          </label>
                                          <Input
                                            value={fModif.libelle}
                                            onChange={(e) => setFModif({ ...fModif, libelle: e.target.value })}
                                            placeholder="Objet de la commande..."
                                            className="h-8 text-xs bg-white"
                                          />
                                        </div>

                                        <div>
                                          <label className="text-2xs font-bold uppercase tracking-wider text-slate-700 block mb-1">
                                            Demandeur
                                          </label>
                                          <Input
                                            value={fModif.demandeur}
                                            onChange={(e) => setFModif({ ...fModif, demandeur: e.target.value })}
                                            className="h-8 text-xs bg-white"
                                          />
                                        </div>

                                        <div>
                                          <label className="text-2xs font-bold uppercase tracking-wider text-slate-700 block mb-1">
                                            Service
                                          </label>
                                          <Input
                                            value={fModif.service}
                                            onChange={(e) => setFModif({ ...fModif, service: e.target.value })}
                                            placeholder="Pharmacie, Accueil..."
                                            className="h-8 text-xs bg-white"
                                          />
                                        </div>
                                      </div>

                                      <div className="space-y-1.5 pt-1">
                                        <div className="flex items-center justify-between">
                                          <label className="text-2xs font-bold uppercase tracking-wider text-slate-700">
                                            Articles & Consommations (Modifiables)
                                          </label>
                                          <span className="text-3xs text-slate-500 font-mono">
                                            Nouveau montant : <b className="text-ocean-profond font-bold">{fcfa(totalLignesModif)}</b>
                                          </span>
                                        </div>
                                        <RegistreCommandeTable
                                          lignes={lignesModif}
                                          onChange={setLignesModif}
                                          dateCommande={fModif.date}
                                          editable={true}
                                          categorie={detail.type}
                                          antecedents={antecedentsModif}
                                        />
                                      </div>

                                      <div>
                                        <label className="text-2xs font-bold uppercase tracking-wider text-slate-700 block mb-1">
                                          Note d'ajustement ou motif de modification (optionnel)
                                        </label>
                                        <Input
                                          value={fModif.commentaire}
                                          onChange={(e) => setFModif({ ...fModif, commentaire: e.target.value })}
                                          placeholder="Ex: Rectification des quantités demandées..."
                                          className="h-8 text-xs bg-white"
                                        />
                                      </div>

                                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-amber-200">
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          onClick={() => setEnModeEdition(false)}
                                          className="text-xs"
                                        >
                                          Annuler
                                        </Button>
                                        <Button
                                          type="button"
                                          size="sm"
                                          disabled={enEnregistrementModif || !lignesModif.some((l) => l.produit.trim())}
                                          onClick={() => onEnregistrerModif(false)}
                                          className="bg-white border-ocean-profond text-ocean-profond hover:bg-ocean-ceruleen/10 text-xs font-bold gap-1.5"
                                        >
                                          <Check className="h-3.5 w-3.5" />
                                          {enEnregistrementModif ? "Enregistrement..." : "Enregistrer les modifications"}
                                        </Button>
                                        <Button
                                          type="button"
                                          size="sm"
                                          disabled={enEnregistrementModif || !lignesModif.some((l) => l.produit.trim())}
                                          onClick={() => onEnregistrerModif(true)}
                                          className="bg-ocean-profond hover:bg-ocean-nuit text-white text-xs font-bold gap-1.5 shadow-xs"
                                        >
                                          <Send className="h-3.5 w-3.5" />
                                          {enEnregistrementModif ? "Enregistrement..." : "Enregistrer & Soumettre à la Direction"}
                                        </Button>
                                      </div>
                                    </div>
                                  ) : null}

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

                                  {/* Grille Registre de Commande (Modèle Poitiers) */}
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                                      <span className="flex items-center gap-1.5">
                                        <Package className="h-3.5 w-3.5 text-ocean-profond" />
                                        Feuille de registre & consommations ({detail.lignes.length} article{detail.lignes.length > 1 ? "s" : ""})
                                      </span>
                                      <span className="font-mono text-ocean-profond font-bold">{fcfa(detail.total)}</span>
                                    </div>

                                    <RegistreCommandeTable
                                      lignes={detail.lignes}
                                      dateCommande={detail.date}
                                      editable={false}
                                      categorie={detail.type}
                                      antecedents={antecedentsCreation}
                                    />
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

                                  {/* Espace de suivi & Workflow opérationnel des 4 étapes */}
                                  <div className="p-4 rounded-xl border border-filet bg-gradient-to-r from-slate-50 to-white space-y-3">
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                        <Clock className="h-3.5 w-3.5 text-ocean-profond" />
                                        Décision & Circuit d'approvisionnement
                                      </span>
                                      <Flag
                                        variant={STATUT_CONFIG[detail.statut]?.variant ?? "neutre"}
                                        size="xs"
                                      >
                                        {STATUT_CONFIG[detail.statut]?.label}
                                      </Flag>
                                    </div>

                                    {/* Étape 1 : Préparation */}
                                    {detail.statut === "preparation" && (
                                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-slate-100/70 border border-slate-200">
                                        <div className="text-xs text-slate-700 space-y-0.5">
                                          <div className="font-bold flex items-center gap-1.5 text-slate-900">
                                            <Clock className="h-3.5 w-3.5 text-slate-500" />
                                            Étape 1 : Registre en cours de préparation interne
                                          </div>
                                          <p className="text-2xs text-slate-500">
                                            Vérifiez les consommations et les quantités avant de transmettre le bon à la Direction Générale.
                                          </p>
                                        </div>

                                        {peutGerer && (
                                          <div className="flex items-center gap-2 shrink-0 flex-wrap">
                                            {!enModeEdition && (
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={demarrerModification}
                                                className="bg-white text-ocean-profond border-ocean-profond/40 hover:bg-ocean-ceruleen/10 text-xs font-bold gap-1.5"
                                              >
                                                <Pencil className="h-3.5 w-3.5" />
                                                Modifier ce bon
                                              </Button>
                                            )}
                                            <Button
                                              size="sm"
                                              disabled={enTransition}
                                              onClick={() => transitionStatut("en_attente")}
                                              className="bg-ocean-profond hover:bg-ocean-nuit text-white text-xs font-bold gap-1.5 shrink-0 shadow-xs"
                                            >
                                              <Send className="h-3.5 w-3.5" />
                                              Soumettre à la Direction Générale
                                            </Button>
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {/* Étape 2 : En attente de validation Direction */}
                                    {detail.statut === "en_attente" && (
                                      <>
                                        {peutValider ? (
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
                                                onClick={() => transitionStatut("validee", { ouvrirProforma: true })}
                                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold gap-1.5 shadow-xs"
                                              >
                                                <Check className="h-3.5 w-3.5" />
                                                Valider & Générer le Proforma
                                              </Button>

                                              <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => {
                                                  setCommandePourProforma(detail);
                                                  setModalProformaOuverte(true);
                                                }}
                                                className="text-xs font-semibold text-ocean-profond border-ocean-ciel/40 bg-white hover:bg-ocean-brume/20 gap-1.5"
                                              >
                                                <FileText className="h-3.5 w-3.5" />
                                                Examiner le projet Proforma
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
                                                  className="text-xs font-semibold text-rose-700 hover:bg-rose-50 border-rose-200 gap-1.5 ml-auto"
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
                                              Étape 2 : En attente d'arbitrage par la Direction Générale (Niveau 5+).
                                            </span>
                                          </div>
                                        )}
                                      </>
                                    )}

                                    {/* Étape 3A : Commande validée par la Direction */}
                                    {detail.statut === "validee" && (
                                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-emerald-50/70 border border-emerald-200">
                                        <div className="text-xs text-emerald-900 space-y-0.5">
                                          <div className="font-bold flex items-center gap-1.5">
                                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                            Commande approuvée par la Direction Générale
                                          </div>
                                          <p className="text-2xs text-emerald-800">
                                            {detail.validateur ? `Validée par ${detail.validateur}` : "Validée"} le {fmtDate(detail.valideLe?.slice(0, 10) ?? "")} · Proforma n° <b className="font-mono">{detail.proformaRef || `PRO-${detail.reference}`}</b>
                                          </p>
                                        </div>

                                        <div className="flex items-center gap-2 flex-wrap">
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => {
                                              setCommandePourProforma(detail);
                                              setModalProformaOuverte(true);
                                            }}
                                            className="bg-white hover:bg-slate-50 text-ocean-profond border-filet text-xs font-semibold gap-1.5 shadow-2xs"
                                          >
                                            <Printer className="h-3.5 w-3.5" />
                                            Imprimer le Proforma
                                          </Button>

                                          {peutGerer && (
                                            <Button
                                              size="sm"
                                              disabled={enTransition}
                                              onClick={() => transitionStatut("en_reception")}
                                              className="bg-ocean-profond hover:bg-ocean-nuit text-white text-xs font-bold gap-1.5 shadow-xs"
                                            >
                                              <Truck className="h-3.5 w-3.5" />
                                              Transmettre au fournisseur (Étape 3)
                                            </Button>
                                          )}
                                        </div>
                                      </div>
                                    )}

                                    {/* Étape 3B : En cours de réception chez le fournisseur */}
                                    {detail.statut === "en_reception" && (
                                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-blue-50/70 border border-blue-200">
                                        <div className="text-xs text-blue-950 space-y-0.5">
                                          <div className="font-bold flex items-center gap-1.5 text-ocean-profond">
                                            <Truck className="h-4 w-4 text-ocean-profond" />
                                            Étape 3 : Commande transmise au fournisseur · En attente de livraison
                                          </div>
                                          <p className="text-2xs text-slate-600">
                                            Fournisseur : <b>{detail.fournisseur?.nom ?? "Non spécifié"}</b>
                                            {detail.fournisseur?.telephone ? ` (${detail.fournisseur.telephone})` : ""}
                                          </p>
                                        </div>

                                        <div className="flex items-center gap-2 flex-wrap">
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => {
                                              setCommandePourProforma(detail);
                                              setModalProformaOuverte(true);
                                            }}
                                            className="bg-white hover:bg-slate-50 text-ocean-profond border-filet text-xs font-semibold gap-1.5 shadow-2xs"
                                          >
                                            <FileText className="h-3.5 w-3.5" />
                                            Bon Proforma
                                          </Button>

                                          {peutGerer && (
                                            <Button
                                              id="btn-pointage-reception"
                                              size="sm"
                                              onClick={() => {
                                                setCommandePourReception(detail);
                                                setModalReceptionOuverte(true);
                                              }}
                                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold gap-1.5 shadow-xs cursor-pointer"
                                            >
                                              <PackageCheck className="h-4 w-4" />
                                              Pointer la réception & vérifier
                                            </Button>
                                          )}
                                        </div>
                                      </div>
                                    )}

                                    {/* Étape Litige : Commande bloquée en litige */}
                                    {detail.statut === "en_litige" && (
                                      <div className="flex flex-col gap-3 p-4 rounded-xl bg-rose-50/80 border-2 border-rose-300">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-rose-200 pb-2.5">
                                          <div className="flex items-center gap-2">
                                            <div className="p-1.5 rounded-lg bg-rose-600 text-white shadow-2xs">
                                              <AlertCircle className="h-4 w-4" />
                                            </div>
                                            <div>
                                              <span className="text-xs font-bold text-rose-950 uppercase tracking-wide">
                                                Litige de réception en cours
                                              </span>
                                              <span className="text-2xs text-rose-700 ml-2">
                                                Signalé le {detail.litige?.dateSignalement ? fmtDate(detail.litige.dateSignalement.slice(0, 10)) : "Récemment"}
                                              </span>
                                            </div>
                                          </div>

                                          <div className="flex items-center gap-2">
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              onClick={() => {
                                                setCommandePourProforma(detail);
                                                setModalProformaOuverte(true);
                                              }}
                                              className="bg-white hover:bg-slate-50 text-slate-700 border-filet text-xs font-semibold gap-1.5 shadow-2xs"
                                            >
                                              <FileText className="h-3.5 w-3.5 text-ocean-profond" />
                                              Bon Proforma
                                            </Button>

                                            {peutGerer && (
                                              <Button
                                                id="btn-resoudre-litige"
                                                size="sm"
                                                onClick={() => {
                                                  setCommandePourResolution(detail);
                                                  setModalResolutionOuverte(true);
                                                }}
                                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold gap-1.5 shadow-xs cursor-pointer"
                                              >
                                                <CheckCircle2 className="h-3.5 w-3.5" />
                                                Résoudre le litige & Clôturer
                                              </Button>
                                            )}
                                          </div>
                                        </div>

                                        {/* Détail du motif et de l'anomalie */}
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                                          <div className="bg-white p-2.5 rounded-lg border border-rose-200">
                                            <span className="text-3xs font-bold uppercase text-slate-500 block">Motif du litige</span>
                                            <span className="font-bold text-rose-900 capitalize">
                                              {detail.litige?.type === "peremption"
                                                ? "⚠️ Péremption courte ou expirée"
                                                : detail.litige?.type === "quantite_insuffisante"
                                                ? "📉 Quantité insuffisante"
                                                : detail.litige?.type === "manquant"
                                                ? "📉 Articles manquants"
                                                : detail.litige?.type === "avarie"
                                                ? "💥 Avarie / Casse colis"
                                                : "ℹ️ Autre litige"}
                                            </span>
                                          </div>
                                          <div className="sm:col-span-2 bg-white p-2.5 rounded-lg border border-rose-200">
                                            <span className="text-3xs font-bold uppercase text-slate-500 block">Description de l'anomalie</span>
                                            <p className="text-xs text-slate-800 font-medium">
                                              {detail.litige?.description || "Aucun descriptif détaillé renseigné."}
                                            </p>
                                          </div>
                                        </div>
                                      </div>
                                    )}

                                    {/* Étape 4 : Clôturée / Livrée */}
                                    {(detail.statut === "cloturee" || detail.statut === "livree") && (
                                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-emerald-50/60 border border-emerald-200">
                                        <div className="text-xs text-emerald-950 space-y-0.5">
                                          <div className="font-bold flex items-center gap-1.5 text-emerald-800">
                                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                            Étape 4 : Commande soldée et clôturée
                                          </div>
                                          <p className="text-2xs text-emerald-700">
                                            Les articles ont été réceptionnés et le dossier d'approvisionnement est clos.
                                          </p>
                                          {detail.litige?.resolu && (
                                            <div className="mt-1.5 p-2 rounded-lg bg-white/90 border border-emerald-200 text-3xs text-emerald-900">
                                              <span className="font-bold">Historique litige résolu : </span>
                                              <span>{detail.litige.type} · {detail.litige.description}</span>
                                            </div>
                                          )}
                                        </div>

                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => {
                                            setCommandePourProforma(detail);
                                            setModalProformaOuverte(true);
                                          }}
                                          className="bg-white hover:bg-slate-50 text-slate-700 border-filet text-xs font-semibold gap-1.5 shadow-2xs self-start sm:self-auto"
                                        >
                                          <FileText className="h-3.5 w-3.5 text-ocean-profond" />
                                          Voir le Proforma archivé
                                        </Button>
                                      </div>
                                    )}

                                    {/* Rejetée */}
                                    {detail.statut === "rejetee" && (
                                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-rose-50 border border-rose-200">
                                        <div className="text-xs text-rose-950 space-y-0.5">
                                          <div className="font-bold flex items-center gap-1.5 text-rose-800">
                                            <Ban className="h-4 w-4 text-rose-600" />
                                            Commande rejetée par la Direction Générale
                                          </div>
                                          <p className="text-2xs text-rose-700">
                                            Motif : {detail.commentaires?.[detail.commentaires.length - 1]?.texte || "Non spécifié"}
                                          </p>
                                        </div>

                                        {peutGerer && (
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            disabled={enTransition}
                                            onClick={() => transitionStatut("preparation")}
                                            className="bg-white hover:bg-rose-50 text-rose-800 border-rose-300 text-xs font-semibold gap-1.5"
                                          >
                                            Repasser en préparation
                                          </Button>
                                        )}
                                      </div>
                                    )}
                                  </div>

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

      <ModalFournisseur
        ouvert={modalFournisseurOuverte}
        onClose={() => setModalFournisseurOuverte(false)}
        onFournisseurCree={(id, _nom) => {
          setF((prev) => ({ ...prev, fournisseurId: id }));
          setFournisseurFiltre(id);
        }}
        categorieInitiale={type}
      />

      <ModalProforma
        ouverte={modalProformaOuverte}
        onFermer={() => setModalProformaOuverte(false)}
        commande={commandePourProforma}
      />

      <ModalReceptionLitige
        ouverte={modalReceptionOuverte}
        onFermer={() => setModalReceptionOuverte(false)}
        commande={commandePourReception}
        onSucces={() => {
          if (commandePourReception?._id) setSel(commandePourReception._id);
        }}
      />

      <ModalResolutionLitige
        ouverte={modalResolutionOuverte}
        onFermer={() => setModalResolutionOuverte(false)}
        commande={commandePourResolution}
        onSucces={() => {
          if (commandePourResolution?._id) setSel(commandePourResolution._id);
        }}
      />
    </div>
  );
}

export function Commandes() {
  return (
    <ErrorBoundary fallbackTitle="Module Commandes temporairement indisponible">
      <CommandesContenu />
    </ErrorBoundary>
  );
}

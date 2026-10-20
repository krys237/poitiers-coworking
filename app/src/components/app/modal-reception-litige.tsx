import { useState, useMemo } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Flag } from "@/components/ui/flag";
import {
  X,
  CheckCircle2,
  AlertTriangle,
  PackageCheck,
  ShieldAlert,
  Calendar,
  Layers,
  Box,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { messageErreur } from "@/lib/format";

export type MotifLitige = "peremption" | "quantite_insuffisante" | "manquant" | "avarie" | "autre";

interface ModalReceptionLitigeProps {
  ouverte: boolean;
  onFermer: () => void;
  commande: any | null;
  onSucces?: () => void;
}

export function ModalReceptionLitige({
  ouverte,
  onFermer,
  commande,
  onSucces,
}: ModalReceptionLitigeProps) {
  const confirmerReceptionConforme = useMutation(api.commandes.confirmerReceptionConforme);
  const signalerLitige = useMutation(api.commandes.signalerLitige);

  // État local des quantités reçues (initialisé par ligne avec la quantité commandée)
  const [quantitesRecues, setQuantitesRecues] = useState<Record<number, number>>({});
  const [modeLitige, setModeLitige] = useState(false);
  const [motifSelectionne, setMotifSelectionne] = useState<MotifLitige>("quantite_insuffisante");
  const [descriptionLitige, setDescriptionLitige] = useState("");
  const [enCours, setEnCours] = useState(false);

  // Initialisation à l'ouverture de la modale
  const lignes = commande?.lignes ?? [];

  const initialiserPointage = () => {
    const init: Record<number, number> = {};
    lignes.forEach((l: any, i: number) => {
      init[i] = l.quantite ?? 1;
    });
    setQuantitesRecues(init);
    setModeLitige(false);
    setDescriptionLitige("");
    setMotifSelectionne("quantite_insuffisante");
  };

  // Synchronisation lors de l'ouverture
  useMemo(() => {
    if (ouverte && commande) {
      initialiserPointage();
    }
  }, [ouverte, commande?._id]);

  if (!ouverte || !commande) return null;

  // Détection des écarts
  const ecartsDetectes = lignes.some((l: any, i: number) => {
    const recu = quantitesRecues[i] ?? l.quantite;
    return recu !== l.quantite;
  });

  const handleChangerQteRecue = (index: number, val: string) => {
    const num = Math.max(0, parseInt(val, 10) || 0);
    setQuantitesRecues((prev) => ({ ...prev, [index]: num }));
  };

  const handlePointerToutConforme = () => {
    const init: Record<number, number> = {};
    lignes.forEach((l: any, i: number) => {
      init[i] = l.quantite ?? 1;
    });
    setQuantitesRecues(init);
    toast.success("Toutes les quantités ont été recalées sur la commande initiale.");
  };

  // 1. Validation réception 100% conforme
  const onValiderReceptionConforme = async () => {
    setEnCours(true);
    try {
      await confirmerReceptionConforme({
        commandeId: commande._id,
        commentaire: "Contrôle physique effectué : colis intacts et quantités 100% conformes.",
      });
      toast.success(`Commande ${commande.reference} réceptionnée et clôturée avec succès !`);
      onSucces?.();
      onFermer();
    } catch (err) {
      toast.error("Erreur lors de la confirmation de réception", {
        description: messageErreur(err),
      });
    } finally {
      setEnCours(false);
    }
  };

  // 2. Déclaration d'un litige
  const onDeclarerLitige = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!descriptionLitige.trim()) {
      toast.error("Veuillez décrire précisément le litige constaté (détail des avaries, dates, quantités).");
      return;
    }

    setEnCours(true);
    try {
      await signalerLitige({
        commandeId: commande._id,
        motif: motifSelectionne,
        description: descriptionLitige.trim(),
      });
      toast.warning(`Litige enregistré sur la commande ${commande.reference}`, {
        description: "La commande est passée en statut « En litige » pour traitement avec le fournisseur.",
      });
      onSucces?.();
      onFermer();
    } catch (err) {
      toast.error("Erreur lors du signalement du litige", {
        description: messageErreur(err),
      });
    } finally {
      setEnCours(false);
    }
  };

  const motifsConfig: Array<{
    id: MotifLitige;
    titre: string;
    description: string;
    icon: any;
    color: string;
  }> = [
    {
      id: "peremption",
      titre: "Péremption (date courte ou expirée)",
      description: "Le produit a une DLUO/péremption dépassée ou inférieure au seuil autorisé.",
      icon: Calendar,
      color: "text-amber-600 bg-amber-50 border-amber-200",
    },
    {
      id: "quantite_insuffisante",
      titre: "Quantité insuffisante / manquante",
      description: "Le colis est incomplet ou le nombre d'unités livrées est inférieur au bon de commande.",
      icon: Layers,
      color: "text-rose-600 bg-rose-50 border-rose-200",
    },
    {
      id: "avarie",
      titre: "Avarie / Casse / Non-conformité",
      description: "Emballage abîmé, flacon brisé, rupture de chaîne du froid ou produit altéré.",
      icon: Box,
      color: "text-red-600 bg-red-50 border-red-200",
    },
    {
      id: "autre",
      titre: "Autre litige ou anomalie",
      description: "Facturation non conforme, mauvais dosage ou erreur de référence livrée.",
      icon: AlertTriangle,
      color: "text-slate-600 bg-slate-50 border-slate-200",
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-reception-titre"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        className="relative w-full max-w-3xl rounded-2xl bg-surface border border-filet shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-filet bg-gradient-to-r from-ocean-brume/40 via-surface to-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ocean-profond text-white shadow-xs">
              <PackageCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="modal-reception-titre" className="text-base font-bold text-ocean-nuit">
                  Pointage de réception & Contrôle
                </h2>
                <Flag variant="direct" size="xs">
                  {commande.reference}
                </Flag>
              </div>
              <p className="text-2xs text-slate-500 mt-0.5">
                Vérification physique des articles livrés par{" "}
                <b className="text-slate-700">{commande.fournisseur?.nom ?? "Fournisseur"}</b>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onFermer}
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            title="Fermer la fenêtre"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Corps déroulable */}
        <div className="p-5 overflow-y-auto space-y-5">
          {/* Cartouche d'information commande */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-slate-50 border border-filet text-xs">
            <div>
              <span className="text-3xs font-bold uppercase text-slate-400 block">Type de flux</span>
              <span className="font-semibold text-slate-700 capitalize">
                {commande.type === "medicale"
                  ? "Médicaments (DCI)"
                  : commande.type === "reactifs_labo"
                  ? "Réactifs Labo"
                  : "Fournitures"}
              </span>
            </div>
            <div>
              <span className="text-3xs font-bold uppercase text-slate-400 block">Fournisseur</span>
              <span className="font-semibold text-slate-700 truncate block">
                {commande.fournisseur?.nom ?? "—"}
              </span>
            </div>
            <div>
              <span className="text-3xs font-bold uppercase text-slate-400 block">Demandeur</span>
              <span className="font-semibold text-slate-700 truncate block">
                {commande.demandeur}
              </span>
            </div>
            <div>
              <span className="text-3xs font-bold uppercase text-slate-400 block">Articles à pointer</span>
              <span className="font-mono font-bold text-ocean-profond">
                {lignes.length} article{lignes.length > 1 ? "s" : ""}
              </span>
            </div>
          </div>

          {/* Grille de pointage par article */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Tableau de pointage des quantités
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePointerToutConforme}
                className="h-7 text-3xs font-semibold border-filet text-slate-700 hover:bg-slate-100 gap-1"
              >
                Pointer 100% conforme
              </Button>
            </div>

            <div className="rounded-xl border border-filet overflow-hidden shadow-2xs">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-filet text-3xs uppercase font-bold text-slate-600">
                    <th className="p-2.5 w-10 text-center">#</th>
                    <th className="p-2.5">Article commandé</th>
                    <th className="p-2.5 w-24 text-right">Qté cmd.</th>
                    <th className="p-2.5 w-32 text-center">Qté reçue</th>
                    <th className="p-2.5 w-28 text-center">Conformité</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-filet bg-white">
                  {lignes.map((l: any, i: number) => {
                    const qteCmd = Number(l.quantite) || 0;
                    const qteRecue = quantitesRecues[i] !== undefined ? quantitesRecues[i] : qteCmd;
                    const estConforme = qteRecue === qteCmd;
                    const estManquant = qteRecue < qteCmd;

                    return (
                      <tr key={i} className={cn(!estConforme && "bg-amber-50/40")}>
                        <td className="p-2.5 text-center text-slate-400 font-mono text-3xs">
                          {i + 1}
                        </td>
                        <td className="p-2.5">
                          <div className="font-semibold text-slate-800">{l.produit}</div>
                          {l.dci && <div className="text-3xs text-slate-500">DCI : {l.dci}</div>}
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-slate-700">
                          {qteCmd}
                        </td>
                        <td className="p-2.5 text-center">
                          <Input
                            type="number"
                            min="0"
                            value={qteRecue}
                            onChange={(e) => handleChangerQteRecue(i, e.target.value)}
                            className={cn(
                              "h-8 w-24 mx-auto text-center font-mono font-bold text-xs bg-white",
                              !estConforme
                                ? "border-amber-400 text-amber-900 bg-amber-50/50"
                                : "border-filet text-emerald-900"
                            )}
                          />
                        </td>
                        <td className="p-2.5 text-center">
                          {estConforme ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs font-bold bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="h-3 w-3" /> Conforme
                            </span>
                          ) : estManquant ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs font-bold bg-amber-100 text-amber-800">
                              <AlertTriangle className="h-3 w-3" /> Manque {qteCmd - qteRecue}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs font-bold bg-blue-100 text-blue-800">
                              Surplus +{qteRecue - qteCmd}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Deux voies : Réception normale vs Déclaration Litige */}
          {!modeLitige ? (
            <div className="p-4 rounded-xl border border-filet bg-gradient-to-r from-slate-50 to-white space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-800">
                    Conclusion du contrôle de livraison
                  </h3>
                  <p className="text-2xs text-slate-500">
                    {ecartsDetectes
                      ? "Des écarts de quantités sont constatés. Vous pouvez déclarer un litige pour action fournisseur."
                      : "Tous les articles sont réputés reçus conformes et prêts pour intégration au stock."}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setModeLitige(true)}
                  className="text-xs font-semibold text-rose-700 border-rose-200 hover:bg-rose-50 gap-1.5"
                >
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Signaler un litige / anomalie
                </Button>
              </div>

              {ecartsDetectes && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>
                    Attention : Vous avez pointé des quantités différentes de la commande. Il est conseillé de signaler un litige ou d'ajuster les quantités.
                  </span>
                </div>
              )}

              <Button
                type="button"
                disabled={enCours}
                onClick={onValiderReceptionConforme}
                className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-2 shadow-xs cursor-pointer"
              >
                <CheckCircle2 className="h-4 w-4" />
                {enCours ? "Clôture en cours…" : "Valider la réception conforme & Clôturer la commande"}
              </Button>
            </div>
          ) : (
            /* Formulaire officiel de déclaration de litige */
            <form onSubmit={onDeclarerLitige} className="p-4 rounded-xl border-2 border-rose-300 bg-rose-50/40 space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b border-rose-200 pb-2">
                <div className="flex items-center gap-2 text-rose-900 font-bold text-xs">
                  <ShieldAlert className="h-4 w-4 text-rose-600" />
                  <span>Déclaration officielle de litige à la réception</span>
                </div>
                <button
                  type="button"
                  onClick={() => setModeLitige(false)}
                  className="text-2xs text-slate-500 hover:text-slate-800 font-semibold"
                >
                  Annuler le litige
                </button>
              </div>

              {/* Sélection du motif de litige */}
              <div className="space-y-1.5">
                <label className="text-3xs font-bold uppercase text-slate-600 block">
                  Motif principal du litige *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {motifsConfig.map((m) => {
                    const estSelect = motifSelectionne === m.id;
                    const IconComp = m.icon;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setMotifSelectionne(m.id)}
                        className={cn(
                          "flex items-start gap-2.5 p-2.5 rounded-xl border text-left transition-all cursor-pointer",
                          estSelect
                            ? "bg-white border-rose-500 ring-2 ring-rose-500/20 shadow-xs"
                            : "bg-white/80 border-filet hover:border-slate-300"
                        )}
                      >
                        <div className={cn("p-1.5 rounded-lg shrink-0", m.color)}>
                          <IconComp className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-800">{m.titre}</div>
                          <div className="text-3xs text-slate-500 line-clamp-2">{m.description}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Description détaillée de l'anomalie */}
              <div className="space-y-1">
                <label className="text-3xs font-bold uppercase text-slate-600 block">
                  Description précise de l'anomalie constatée *
                </label>
                <textarea
                  rows={3}
                  value={descriptionLitige}
                  onChange={(e) => setDescriptionLitige(e.target.value)}
                  placeholder="Ex: 5 flacons reçus avec date de péremption à moins de 3 mois (11/2026), carton n°2 détrempé et 2 ampoules brisées."
                  className="w-full text-xs p-2.5 rounded-lg border border-rose-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-rose-500/30 font-medium"
                />
                <p className="text-3xs text-slate-500">
                  Ce descriptif sera notifié sur la commande et transmis au fournisseur pour régularisation ou avoir.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setModeLitige(false)}
                  className="text-xs border-filet"
                >
                  Revenir au pointage
                </Button>
                <Button
                  type="submit"
                  disabled={enCours || !descriptionLitige.trim()}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs gap-1.5 shadow-xs cursor-pointer"
                >
                  <ShieldAlert className="h-3.5 w-3.5" />
                  {enCours ? "Enregistrement…" : "Enregistrer le litige (Statut En litige)"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

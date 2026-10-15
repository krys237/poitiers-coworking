import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Flag } from "@/components/ui/flag";
import { X, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { messageErreur } from "@/lib/format";

interface ModalResolutionLitigeProps {
  ouverte: boolean;
  onFermer: () => void;
  commande: any | null;
  onSucces?: () => void;
}

export function ModalResolutionLitige({
  ouverte,
  onFermer,
  commande,
  onSucces,
}: ModalResolutionLitigeProps) {
  const resoudreLitigeEtCloturer = useMutation(api.commandes.resoudreLitigeEtCloturer);
  const [solution, setSolution] = useState("");
  const [enCours, setEnCours] = useState(false);

  if (!ouverte || !commande) return null;

  const onConfirmerResolution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!solution.trim()) {
      toast.error("Veuillez préciser la solution convenue pour régulariser ce litige.");
      return;
    }

    setEnCours(true);
    try {
      await resoudreLitigeEtCloturer({
        commandeId: commande._id,
        commentaire: solution.trim(),
      });
      toast.success(`Litige résolu et commande ${commande.reference} clôturée avec succès !`);
      setSolution("");
      onSucces?.();
      onFermer();
    } catch (err) {
      toast.error("Erreur lors de la résolution du litige", {
        description: messageErreur(err),
      });
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-resolution-titre"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        className="relative w-full max-w-lg rounded-2xl bg-surface border border-filet shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-filet bg-gradient-to-r from-emerald-50 via-surface to-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="modal-resolution-titre" className="text-base font-bold text-ocean-nuit">
                  Résolution du litige
                </h2>
                <Flag variant="especes" size="xs">
                  {commande.reference}
                </Flag>
              </div>
              <p className="text-2xs text-slate-500 mt-0.5">
                Régularisation avec le fournisseur et clôture officielle
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onFermer}
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            title="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Formulaire */}
        <form onSubmit={onConfirmerResolution} className="p-5 space-y-4">
          {/* Rappel du litige */}
          <div className="p-3 rounded-xl bg-rose-50/80 border border-rose-200 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-rose-900">
              <AlertCircle className="h-3.5 w-3.5 text-rose-600" />
              Litige initial signalé ({commande.litige?.type ?? "anomalie"}) :
            </div>
            <p className="text-rose-800 text-2xs italic leading-relaxed">
              « {commande.litige?.description || "Description non disponible"} »
            </p>
          </div>

          {/* Saisie de la solution */}
          <div className="space-y-1.5">
            <label className="text-3xs font-bold uppercase text-slate-600 block">
              Solution apportée & justificatif de régularisation *
            </label>
            <textarea
              rows={4}
              required
              value={solution}
              onChange={(e) => setSolution(e.target.value)}
              placeholder="Ex: Le fournisseur a livré le reliquat de 5 unités conformes ce matin. Colis inspecté et conforme / Avoir n°482 déduit de la facture."
              className="w-full text-xs p-2.5 rounded-lg border border-filet bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 font-medium"
            />
            <p className="text-3xs text-slate-500">
              Cette mention sera consignée au dossier d'approvisionnement et archivera le litige.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-filet">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onFermer}
              className="text-xs border-filet"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={enCours || !solution.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 shadow-xs cursor-pointer"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {enCours ? "Clôture…" : "Confirmer la résolution & Clôturer"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

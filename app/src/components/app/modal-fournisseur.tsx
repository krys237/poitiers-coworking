import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChampTelephone } from "./champ-telephone";
import { toast } from "sonner";
import { Building2, Phone, MapPin, Tag } from "lucide-react";

interface ModalFournisseurProps {
  ouvert: boolean;
  onClose: () => void;
  onFournisseurCree?: (id: string, nom: string) => void;
  categorieInitiale?: string;
}

export function ModalFournisseur({
  ouvert,
  onClose,
  onFournisseurCree,
  categorieInitiale,
}: ModalFournisseurProps) {
  const creer = useMutation(api.fournisseurs.creer);
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [ville, setVille] = useState("Douala");
  const [categories, setCategories] = useState<string[]>(
    categorieInitiale ? [categorieInitiale] : ["reactifs_labo"]
  );
  const [chargement, setChargement] = useState(false);

  const toggleCategorie = (cat: string) => {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const reinitialiser = () => {
    setNom("");
    setTelephone("");
    setVille("Douala");
    setCategories(categorieInitiale ? [categorieInitiale] : ["reactifs_labo"]);
  };

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nom.trim()) {
      toast.error("Veuillez saisir le nom du fournisseur.");
      return;
    }
    if (!telephone.trim()) {
      toast.error("Le numéro de téléphone est obligatoire.");
      return;
    }

    setChargement(true);
    try {
      const id = await creer({
        nom: nom.trim(),
        telephone: telephone.trim(),
        ville: ville.trim() || undefined,
        categories: categories.length ? categories : undefined,
      });
      toast.success(`Fournisseur "${nom.trim()}" ajouté avec succès`);
      if (onFournisseurCree) {
        onFournisseurCree(id as any, nom.trim());
      }
      reinitialiser();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de la création du fournisseur.");
    } finally {
      setChargement(false);
    }
  };

  return (
    <Dialog open={ouvert} onOpenChange={(o) => { if (!o) { reinitialiser(); onClose(); } }}>
      <DialogContent className="sm:max-w-[480px] p-6 rounded-2xl bg-surface border border-filet shadow-xl">
        <DialogHeader className="pb-3 border-b border-filet">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-ocean-brume/60 text-ocean-profond flex items-center justify-center font-bold">
              <Building2 className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-ocean-nuit">
                Nouveau Fournisseur
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Ajoutez un partenaire commercial pour le circuit d'approvisionnement
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={soumettre} className="space-y-4 pt-3">
          {/* Nom du fournisseur */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-ocean-nuit flex items-center gap-1.5">
              <span>Raison sociale / Nom</span>
              <span className="text-carmin">*</span>
            </label>
            <div className="relative">
              <Input
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="Ex : LABOPHARMA Cameroun, PHARMACAM…"
                className="h-9 text-sm"
                autoFocus
              />
            </div>
          </div>

          {/* Numéro de téléphone */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-ocean-nuit flex items-center gap-1.5">
              <Phone className="size-3.5 text-ocean-profond" />
              <span>Numéro de téléphone WhatsApp / Appel</span>
              <span className="text-carmin">*</span>
            </label>
            <ChampTelephone
              valeur={telephone}
              onChange={setTelephone}
              placeholder="6 99 00 00 00"
              taille="sm"
            />
            <p className="text-[11px] text-muted-foreground">
              Indicatif pré-rempli (+237). Utilisé pour le suivi des commandes et réceptions.
            </p>
          </div>

          {/* Ville */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-ocean-nuit flex items-center gap-1.5">
              <MapPin className="size-3.5 text-ocean-profond" />
              <span>Ville d'implantation</span>
            </label>
            <Input
              value={ville}
              onChange={(e) => setVille(e.target.value)}
              placeholder="Ex : Douala, Yaoundé…"
              className="h-9 text-sm"
            />
          </div>

          {/* Catégories de fournitures */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-ocean-nuit flex items-center gap-1.5">
              <Tag className="size-3.5 text-ocean-profond" />
              <span>Spécialités d'approvisionnement</span>
            </label>
            <div className="flex flex-wrap gap-2 pt-1">
              {[
                { id: "reactifs_labo", label: "Réactifs Labo" },
                { id: "medicale", label: "Médicaments" },
                { id: "fourniture", label: "Fournitures générales" },
              ].map((c) => {
                const actif = categories.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleCategorie(c.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      actif
                        ? "bg-ocean-profond text-white shadow-xs"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          <DialogFooter className="pt-3 border-t border-filet flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => { reinitialiser(); onClose(); }}
              disabled={chargement}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={chargement}
              className="bg-ocean-profond hover:bg-ocean-nuit text-white"
            >
              {chargement ? "Enregistrement..." : "Créer le fournisseur"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

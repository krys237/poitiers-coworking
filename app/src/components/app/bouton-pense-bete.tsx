// Bouton « Me le rappeler » sur un dossier (commande ou intervention — lot S7).
// Ouvre un dialogue pré-rempli avec la référence et le lien du dossier, avec raccourcis
// de date (demain, dans 3 jours, lundi prochain) et un champ libre.

import { useState } from "react";
import { useMutation } from "convex/react";
import { BellPlus } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function formatLocalDateTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function raccourciDate(jours: number, lundiProchain = false): string {
  const d = new Date();
  if (lundiProchain) {
    const dow = d.getDay();
    const ajout = dow === 0 ? 1 : 8 - dow;
    d.setDate(d.getDate() + ajout);
  } else {
    d.setDate(d.getDate() + jours);
  }
  d.setHours(9, 0, 0, 0);
  return formatLocalDateTime(d);
}

export function BoutonPenseBete({
  table,
  id,
  reference,
  lien,
  texteDefaut,
}: {
  table: "commandes" | "interventions";
  id: string;
  reference: string;
  lien: string;
  texteDefaut?: string;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [texte, setTexte] = useState(texteDefaut ?? `Suivre le dossier ${reference}`);
  const [echeance, setEcheance] = useState(() => raccourciDate(1));
  const [enCours, setEnCours] = useState(false);
  const creer = useMutation(api.penseBetes.creer);

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    setEnCours(true);
    try {
      await creer({
        texte,
        echeance: new Date(echeance).toISOString(),
        objet: { table, id, reference },
        lien,
      });
      toast.success("Pense-bête enregistré.");
      setOuvert(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de créer le rappel.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <Dialog open={ouvert} onOpenChange={setOuvert}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
          <BellPlus className="h-3.5 w-3.5" />
          Me le rappeler
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Me rappeler {reference}</DialogTitle>
        </DialogHeader>
        <form onSubmit={enregistrer} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pb-texte">Message du rappel</Label>
            <Input
              id="pb-texte"
              value={texte}
              onChange={(e) => setTexte(e.target.value)}
              maxLength={500}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pb-echeance">Date et heure</Label>
            <div className="flex flex-wrap gap-1.5">
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setEcheance(raccourciDate(1))}>
                Demain 9 h
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setEcheance(raccourciDate(3))}>
                Dans 3 jours
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setEcheance(raccourciDate(0, true))}>
                Lundi prochain
              </Button>
            </div>
            <Input
              id="pb-echeance"
              type="datetime-local"
              value={echeance}
              onChange={(e) => setEcheance(e.target.value)}
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOuvert(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={enCours}>
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Download, Upload } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { MODELE_CSV, fusionner, lireFichierPaie } from "@/lib/import-paie";
import { usePaie } from "@/lib/paie-store";

export function ImportPaie({ disabled }: { disabled?: boolean }) {
  const { employes, remplacerTous } = usePaie();
  const input = useRef<HTMLInputElement>(null);
  const [chargement, setChargement] = useState(false);
  const [resume, setResume] = useState<string | null>(null);

  const telechargerModele = () => {
    const blob = new Blob([`\ufeff${MODELE_CSV}`], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modele-import-paie.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Modèle CSV téléchargé");
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-semibold text-foreground">
        Importer les éléments du mois (Excel ou CSV)
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Chargez un fichier .xlsx, .xls ou .csv : chaque ligne = un employé. Les
        employés existants sont mis à jour (par matricule ou par nom), les
        nouveaux sont créés, puis tous les calculs sont refaits automatiquement.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          ref={input}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={async (ev) => {
            const file = ev.target.files?.[0];
            ev.target.value = "";
            if (!file) return;
            setChargement(true);
            setResume(null);
            try {
              const lignes = await lireFichierPaie(file);
              const { resultat, misAJour, crees } = fusionner(employes, lignes);
              remplacerTous(resultat);
              setResume(
                `${lignes.length} ligne(s) importée(s) · ${misAJour} mise(s) à jour · ${crees} création(s)`,
              );
              toast.success("Import réussi", {
                description: `${misAJour} employé(s) mis à jour, ${crees} créé(s).`,
              });
            } catch (e) {
              toast.error("Import impossible", {
                description:
                  e instanceof Error ? e.message : "Fichier illisible.",
              });
            } finally {
              setChargement(false);
            }
          }}
        />
        <button
          type="button"
          disabled={disabled || chargement}
          onClick={() => input.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Upload className="h-3.5 w-3.5" />
          {chargement ? "Lecture du fichier…" : "Importer un fichier"}
        </button>
        <button
          type="button"
          onClick={telechargerModele}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent"
        >
          <Download className="h-3.5 w-3.5" /> Modèle CSV
        </button>
      </div>

      {chargement && (
        <div className="mt-3 space-y-2">
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      )}
      {resume && !chargement && (
        <p className="mt-3 text-xs font-medium text-primary">{resume}</p>
      )}
    </div>
  );
}

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { periodeCourante } from "@/lib/format";

const MOIS = [
  "Janvier", "Fevrier", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Aout", "Septembre", "Octobre", "Novembre", "Decembre",
];

/** Decale une periode « AAAA-MM » de n mois. */
export function decalerPeriode(periode: string, mois: number): string {
  const [a, m] = periode.split("-").map(Number);
  const d = new Date(a, (m ?? 1) - 1 + mois, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Selecteur de periode de paie.
 *
 * La periode est le filtre le plus manipule de la plateforme : elle pilote la
 * paie, les bulletins, le planning, les primes, l'audit et les statistiques.
 * Deux ajouts par rapport aux deux `<select>` d'origine :
 *
 *  - des fleches mois precedent / mois suivant, parce que le geste reel n'est
 *    pas « aller en mars 2024 » mais « revenir au mois d'avant » ;
 *  - un retour au mois courant des qu'on s'en est ecarte.
 *
 * Le groupe porte un `role="group"` nomme, sinon un lecteur d'ecran annonce
 * deux listes deroulantes sans dire de quoi elles parlent.
 */
export function SelecteurPeriode({
  valeur,
  onChange,
  desactive,
  anneeMin = 2023,
  anneeMax = new Date().getFullYear() + 1,
}: {
  valeur: string;
  onChange: (periode: string) => void;
  desactive?: boolean;
  anneeMin?: number;
  anneeMax?: number;
}) {
  const [annee, mois] = valeur.split("-");
  const annees = Array.from(
    { length: anneeMax - anneeMin + 1 },
    (_, i) => anneeMin + i
  );
  const courante = periodeCourante();

  return (
    <div
      role="group"
      aria-label="Periode de paie"
      className="inline-flex items-center gap-1 print:hidden"
    >
      <Button
        variant="outline"
        size="icon-sm"
        disabled={desactive}
        onClick={() => onChange(decalerPeriode(valeur, -1))}
        aria-label="Mois precedent"
      >
        <ChevronLeftIcon />
      </Button>

      <Select
        value={mois}
        disabled={desactive}
        onValueChange={(m) => onChange(`${annee}-${m}`)}
      >
        <SelectTrigger size="sm" className="w-[7.5rem]" aria-label="Mois">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MOIS.map((nom, i) => (
            <SelectItem key={nom} value={String(i + 1).padStart(2, "0")}>
              {nom}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={annee}
        disabled={desactive}
        onValueChange={(a) => onChange(`${a}-${mois}`)}
      >
        <SelectTrigger size="sm" className="w-[5.5rem]" aria-label="Annee">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {annees.map((a) => (
            <SelectItem key={a} value={String(a)}>
              {a}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        variant="outline"
        size="icon-sm"
        disabled={desactive}
        onClick={() => onChange(decalerPeriode(valeur, 1))}
        aria-label="Mois suivant"
      >
        <ChevronRightIcon />
      </Button>

      {valeur !== courante ? (
        <Button
          variant="ghost"
          size="sm"
          disabled={desactive}
          onClick={() => onChange(courante)}
        >
          Mois courant
        </Button>
      ) : null}
    </div>
  );
}

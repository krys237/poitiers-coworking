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

/** Toutes les periodes « AAAA-MM » entre `debut` et `fin`, bornes incluses (ordre croissant, meme si `debut` et `fin` sont inverses). */
export function periodesEntre(debut: string, fin: string): string[] {
  const [a1, m1] = debut.split("-").map(Number);
  const [a2, m2] = fin.split("-").map(Number);
  let n1 = a1 * 12 + (m1 - 1);
  let n2 = a2 * 12 + (m2 - 1);
  if (n1 > n2) [n1, n2] = [n2, n1];
  const out: string[] = [];
  for (let n = n1; n <= n2; n++) out.push(`${Math.floor(n / 12)}-${String((n % 12) + 1).padStart(2, "0")}`);
  return out;
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

/**
 * Selecteur d'un INTERVALLE de periodes (« Du » mois-annee « a » mois-annee), pour les exports qui
 * couvrent plusieurs mois (bulletins d'un employe, liste des salaires). Pas de fleches ni de retour
 * au mois courant ici : contrairement a `SelecteurPeriode`, ce n'est pas le filtre pilote en continu,
 * seulement le choix ponctuel d'une plage avant de lancer l'export.
 */
export function SelecteurIntervallePeriode({
  debut,
  fin,
  onChange,
  desactive,
  anneeMin = 2023,
  anneeMax = new Date().getFullYear() + 1,
}: {
  debut: string;
  fin: string;
  onChange: (debut: string, fin: string) => void;
  desactive?: boolean;
  anneeMin?: number;
  anneeMax?: number;
}) {
  const annees = Array.from(
    { length: anneeMax - anneeMin + 1 },
    (_, i) => anneeMin + i
  );

  const champ = (valeur: string, onValeur: (p: string) => void, etiquette: string) => {
    const [a, m] = valeur.split("-");
    return (
      <div className="inline-flex items-center gap-1">
        <Select value={m} disabled={desactive} onValueChange={(mm) => onValeur(`${a}-${mm}`)}>
          <SelectTrigger size="sm" className="w-[7.5rem]" aria-label={`Mois (${etiquette})`}>
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
        <Select value={a} disabled={desactive} onValueChange={(aa) => onValeur(`${aa}-${m}`)}>
          <SelectTrigger size="sm" className="w-[5.5rem]" aria-label={`Annee (${etiquette})`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {annees.map((an) => (
              <SelectItem key={an} value={String(an)}>
                {an}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  };

  return (
    <div
      role="group"
      aria-label="Intervalle de periodes"
      className="inline-flex flex-wrap items-center gap-2 print:hidden"
    >
      <span className="text-xs font-semibold text-encre-douce">Du</span>
      {champ(debut, (d) => onChange(d, fin), "debut")}
      <span className="text-xs font-semibold text-encre-douce">a</span>
      {champ(fin, (f) => onChange(debut, f), "fin")}
    </div>
  );
}

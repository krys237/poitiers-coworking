/**
 * Socle commun des trois onglets du récapitulatif salaires.
 *
 *  - données Convex de la période (bulletins réactifs, saisies brutes, barème) ;
 *  - brouillon de saisie avec ENREGISTREMENT AUTOMATIQUE (plus de bouton
 *    « Enregistrer » par ligne) et remise à zéro au changement de période ;
 *  - aperçu calculé côté client avec le moteur pur `convex/lib/paie.ts` ;
 *  - barre de contrôle, tuiles de synthèse et légende partagées.
 *
 * Les formules ne bougent pas : elles sont dans `convex/lib/paie.ts` (CLAUDE.md,
 * « Format de paie de référence »).
 */
import * as React from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { ChevronDownIcon, PrinterIcon, SearchIcon, XIcon } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { BulletinPeriode } from "../../../convex/lib/calculBulletins";
import { computeBulletin, type Bareme, type Bulletin, type SaisieMois } from "../../../convex/lib/paie";
import { bornesPeriode, joursDuMois } from "../../../convex/lib/periode";
import { fcfa, libellePeriode, messageErreur, num } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SelecteurPeriode } from "@/components/app/selecteur-periode";
import { StatutMois } from "@/components/app/statut";
import { BoutonConfirmation } from "@/components/app/bouton-action";
import { GrilleTuiles, Tuile } from "@/components/app/tuile";
import { Montant } from "@/components/app/montant";

// --- Champs de saisie du mois -------------------------------------------------

export type Champ =
  | "joursTravailles" | "primesVariables" | "transport" | "primeAssiduite" | "indemniteLogement"
  | "heuresSup" | "anciennete" | "sanctions" | "absences" | "dettesSoins" | "acompte" | "mutuellePct";

export const CHAMPS: Champ[] = [
  "joursTravailles", "primesVariables", "transport", "primeAssiduite", "indemniteLogement",
  "heuresSup", "anciennete", "sanctions", "absences", "dettesSoins", "acompte", "mutuellePct",
];

export const DEFAUT: Record<Champ, number> = {
  joursTravailles: 30, primesVariables: 0, transport: 0, primeAssiduite: 0, indemniteLogement: 0,
  heuresSup: 0, anciennete: 0, sanctions: 0, absences: 0, dettesSoins: 0, acompte: 0, mutuellePct: 0,
};

/** Libellé court de chaque champ (en-têtes, libellés accessibles). */
export const LIBELLE: Record<Champ, string> = {
  joursTravailles: "Jours travaillés", primesVariables: "Primes fixes", transport: "Prime transport",
  primeAssiduite: "Prime assiduité", indemniteLogement: "Indemnité logement", heuresSup: "Heures supplémentaires",
  anciennete: "Ancienneté", sanctions: "Sanctions", absences: "Absences", dettesSoins: "Dettes de soins",
  acompte: "Acompte", mutuellePct: "Mutuelle",
};

export const UNITE: Record<Champ, string> = {
  joursTravailles: "j", primesVariables: "FCFA", transport: "FCFA", primeAssiduite: "FCFA", indemniteLogement: "FCFA",
  heuresSup: "FCFA", anciennete: "FCFA", sanctions: "FCFA", absences: "FCFA", dettesSoins: "FCFA", acompte: "FCFA",
  mutuellePct: "%",
};

export const SOCIETES = ["SESAME", "SOFINA", "SGC"] as const;
export type Societe = (typeof SOCIETES)[number];

export type Valeurs = Record<Champ, number>;
export type BulletinLigne = BulletinPeriode;

/** Bornes de validation du dialogue de saisie (reprises du modèle du directeur). */
export function validerValeurs(v: Valeurs): Partial<Record<Champ, string>> {
  const err: Partial<Record<Champ, string>> = {};
  if (v.joursTravailles < 0 || v.joursTravailles > 31) err.joursTravailles = "Entre 0 et 31 jours.";
  if (v.mutuellePct < 0 || v.mutuellePct > 100) err.mutuellePct = "Pourcentage entre 0 et 100.";
  for (const c of CHAMPS) {
    if (c === "joursTravailles" || c === "mutuellePct") continue;
    if (v[c] < 0) err[c] = "Montant négatif interdit.";
  }
  return err;
}

// --- Données de la période ---------------------------------------------------

export function useRecapPaie(periode: string) {
  const paie = useQuery(api.payroll.bulletinsDuMois, { periode });
  const saisies = useQuery(api.payroll.saisiesDuMois, { periode });
  const bareme = useQuery(api.bareme.pourPeriode, { periode });
  const saisir = useMutation(api.payroll.saisirMois);
  const generer = useMutation(api.payroll.genererEtCloturer);
  const modifierEmploye = useMutation(api.employes.modifier);
  const creerEmploye = useMutation(api.employes.creer);

  const cloture = paie?.cloture ?? false;
  const bulletins: BulletinLigne[] = (paie?.bulletins ?? []) as BulletinLigne[];

  return { paie, saisies, bareme, saisir, generer, modifierEmploye, creerEmploye, cloture, bulletins };
}

export type RecapPaie = ReturnType<typeof useRecapPaie>;

// --- Brouillon avec enregistrement automatique ------------------------------

export type EtatLigne = "modifie" | "enregistrement" | "enregistre";

/**
 * Le brouillon est indexé par employé ET remis à zéro à chaque changement de
 * période : une valeur tapée en septembre ne réapparaît plus en octobre.
 * Chaque modification programme un enregistrement 800 ms plus tard ; `flush`
 * l'exécute tout de suite (sortie de champ, fermeture d'un dialogue).
 */
export function useBrouillon(recap: RecapPaie, periode: string) {
  const { saisies, saisir, cloture } = recap;
  const [brouillon, setBrouillon] = React.useState<Record<string, Partial<Valeurs>>>({});
  const [etats, setEtats] = React.useState<Record<string, EtatLigne>>({});
  const brouillonRef = React.useRef(brouillon);
  brouillonRef.current = brouillon;
  const minuteries = React.useRef<Record<string, number>>({});

  React.useEffect(() => {
    setBrouillon({});
    setEtats({});
    for (const t of Object.values(minuteries.current)) window.clearTimeout(t);
    minuteries.current = {};
  }, [periode]);

  const val = React.useCallback(
    (id: string, c: Champ): number =>
      brouillon[id]?.[c] ?? (saisies?.[id] as Partial<Valeurs> | undefined)?.[c] ?? DEFAUT[c],
    [brouillon, saisies]
  );

  /** Valeurs complètes d'un employé (brouillon + saisie serveur + défauts). */
  const valeurs = React.useCallback(
    (id: string): Valeurs => Object.fromEntries(CHAMPS.map((c) => [c, val(id, c)])) as Valeurs,
    [val]
  );

  const enregistrer = React.useCallback(
    async (id: string, patch?: Partial<Valeurs>) => {
      window.clearTimeout(minuteries.current[id]);
      const courant = { ...(brouillonRef.current[id] ?? {}), ...(patch ?? {}) };
      if (Object.keys(courant).length === 0) return;
      const base = Object.fromEntries(
        CHAMPS.map((c) => [c, courant[c] ?? (saisies?.[id] as Partial<Valeurs> | undefined)?.[c] ?? DEFAUT[c]])
      ) as Valeurs;
      setEtats((e) => ({ ...e, [id]: "enregistrement" }));
      try {
        await saisir({
          employeId: id as Id<"employes">,
          periode,
          valeurs: { ...base, absencesJours: (saisies?.[id] as any)?.absencesJours ?? 0 },
        });
        // On ne retire du brouillon que ce qui vient d'être enregistré : une valeur
        // tapée pendant l'aller-retour serveur reste en attente.
        setBrouillon((b) => {
          const cur = b[id];
          if (!cur) return b;
          const reste: Partial<Valeurs> = { ...cur };
          for (const c of CHAMPS) if (reste[c] === base[c]) delete reste[c];
          const out = { ...b };
          if (Object.keys(reste).length) out[id] = reste;
          else delete out[id];
          return out;
        });
        setEtats((e) => ({ ...e, [id]: "enregistre" }));
        window.setTimeout(() => setEtats((e) => (e[id] === "enregistre" ? { ...e, [id]: undefined as any } : e)), 2500);
      } catch (err) {
        setEtats((e) => ({ ...e, [id]: "modifie" }));
        toast.error("La saisie n'a pas été enregistrée", { description: messageErreur(err) });
      }
    },
    [periode, saisies, saisir]
  );

  const set = React.useCallback(
    (id: string, c: Champ, v: number, auto = true) => {
      if (cloture) return;
      // Mêmes bornes que le serveur, appliquées à la frappe : pas de 445 654 688 % de mutuelle.
      if (c === "mutuellePct") v = Math.min(100, Math.max(0, v));
      else if (c === "joursTravailles") v = Math.min(31, Math.max(0, v));
      else v = Math.max(0, v);
      setBrouillon((b) => ({ ...b, [id]: { ...b[id], [c]: v } }));
      setEtats((e) => ({ ...e, [id]: "modifie" }));
      if (auto) {
        window.clearTimeout(minuteries.current[id]);
        minuteries.current[id] = window.setTimeout(() => void enregistrer(id), 800);
      }
    },
    [cloture, enregistrer]
  );

  const flush = React.useCallback((id: string) => void enregistrer(id), [enregistrer]);
  const modifie = React.useCallback((id: string) => !!brouillon[id], [brouillon]);
  const etat = React.useCallback((id: string): EtatLigne | undefined => etats[id], [etats]);

  return { val, valeurs, set, flush, enregistrer, modifie, etat, cloture };
}

export type Brouillon = ReturnType<typeof useBrouillon>;

// --- Aperçu calculé côté client ----------------------------------------------

/** Projection du document `baremes` vers l'entrée du moteur (même mapping que le serveur). */
export function baremeClient(b: any): Bareme | null {
  if (!b) return null;
  return {
    plafondCnps: b.plafondCnps, tauxPvidSal: b.tauxPvidSal, tauxPvidPat: b.tauxPvidPat,
    tauxPf: b.tauxPf, tauxAtmp: b.tauxAtmp, tauxCfcSal: b.tauxCfcSal, tauxCfcPat: b.tauxCfcPat,
    tauxFne: b.tauxFne, abattementIrppPct: b.abattementIrppPct, tauxCac: b.tauxCac,
    irppBrackets: b.irppBrackets,
    abattementIrppAnnuel: b.abattementIrppAnnuel ?? 500000, tdlActif: b.tdlActif ?? true, ravActif: b.ravActif ?? true,
  };
}

/**
 * Recalcule un bulletin à partir de valeurs non encore enregistrées.
 * Les lignes libres du registre « Primes & charges » sont reprises du bulletin
 * courant (codes PRIME / RETENUE) ; congés et jours de base aussi.
 */
export function apercuBulletin(b: BulletinLigne, v: Valeurs, bareme: Bareme | null): Bulletin | null {
  if (!bareme) return null;
  const d = b.details;
  const s: SaisieMois = {
    ...v,
    // journalier = brut ÷ joursBase → on retrouve la base de jours de la fiche employé.
    joursBase: d && d.salaireJournalier > 0 ? Math.round(b.salaireBrut / d.salaireJournalier) : 30,
    congesPris: d?.congesPris ?? 0,
    congesAcquis: d?.congesAcquis ?? 0,
    congesRestants: d?.congesRestants,
  };
  const extras = {
    primes: b.lignesGain.filter((l) => l.code === "PRIME").map((l) => ({ libelle: l.libelle, montant: l.gain })),
    charges: b.cotisations.filter((l) => l.code === "RETENUE").map((l) => ({ libelle: l.libelle, montant: l.retenue })),
  };
  try {
    return computeBulletin(b.salaireBrut, s, bareme, extras);
  } catch {
    return null;
  }
}

// --- Totaux ---------------------------------------------------------------------

export function totaux(bulletins: BulletinLigne[]) {
  const t = (k: string) => bulletins.reduce((s, b) => s + (((b.details ?? {}) as any)[k] ?? 0), 0);
  const netSociete = Object.fromEntries(
    SOCIETES.map((s) => [s, bulletins.filter((b) => b.societe === s).reduce((x, b) => x + b.net, 0)])
  ) as Record<Societe, number>;
  const total1 = t("total1");
  const total2 = t("total2");
  const net = bulletins.reduce((s, b) => s + b.net, 0);
  return {
    effectif: bulletins.length,
    salaireBase: t("salaireBase"),
    primes: t("primes") + t("indemniteConges"),
    heuresSupAnciennete: t("heuresSup") + t("anciennete"),
    total1,
    acompteImpotsCnps: t("acompteImpotsCnps"),
    mutuelle: t("mutuelle"),
    total2,
    net,
    retenues: total1 - total2,
    netSociete,
  };
}

// --- Composants partagés ---------------------------------------------------------

/** Ligne « Taux du mois » compacte, détail dans un popover. */
export function TauxDuMois({ bareme, periode, long }: { bareme: any; periode: string; long?: boolean }) {
  if (!bareme) return null;
  const items: [string, string][] = [
    ["Plafond CNPS", fcfa(bareme.plafondCnps)],
    ["CNPS salarié (PVID)", `${bareme.tauxPvidSal} %`],
    ["CFC salarié", `${bareme.tauxCfcSal} %`],
    ["Abattement IRPP annuel", fcfa(bareme.abattementIrppAnnuel ?? 500000)],
    ["CAC (sur IRPP)", `${bareme.tauxCac} %`],
    ["Prestations familiales", `${bareme.tauxPf} %`],
    ["PVID patronal", `${bareme.tauxPvidPat} %`],
    ["Accidents du travail", `${bareme.tauxAtmp} %`],
    ["FNE", `${bareme.tauxFne} %`],
    ["CFC patronal", `${bareme.tauxCfcPat} %`],
    ["TDL", (bareme.tdlActif ?? true) ? "appliquée" : "non appliquée"],
    ["RAV", (bareme.ravActif ?? true) ? "appliquée" : "non appliquée"],
  ];
  return (
    <div className="flex items-center gap-2 whitespace-nowrap text-xs text-encre-douce">
      <span className="font-semibold text-encre">Taux du mois</span>
      {long ? (
        <span className="hidden items-center gap-2 2xl:inline-flex">
          <span className="font-mono tabular-nums">CNPS {bareme.tauxPvidSal} %</span>
          <span className="text-encre-pale">·</span>
          <span className="font-mono tabular-nums">CFC {bareme.tauxCfcSal} %</span>
          <span className="text-encre-pale">·</span>
          <span className="font-mono tabular-nums">CAC {bareme.tauxCac} %</span>
        </span>
      ) : null}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-sm font-medium text-ocean-profond hover:underline"
          >
            Barème {bareme.effectiveFrom?.slice(0, 7)}
            <ChevronDownIcon className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[26rem]">
          <div className="mb-2 text-sm font-semibold">Taux du mois — {libellePeriode(periode)}</div>
          <p className="mb-3 text-xs text-encre-douce">
            Lus dans le barème applicable ({bareme.source}, effectif depuis le{" "}
            {new Date(bareme.effectiveFrom + "T00:00:00").toLocaleDateString("fr-FR")}). Ils alimentent tous les
            bulletins de la période.
          </p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            {items.map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-2 border-b border-filet-clair pb-1">
                <dt className="text-encre-douce">{k}</dt>
                <dd className="font-mono tabular-nums font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-3 text-right">
            <Link to="/bareme" className="text-xs font-medium text-ocean-profond hover:underline">
              Ouvrir le barème →
            </Link>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** Barre de contrôle slim (règle « premier regard » de la charte) : ~50 px. */
export function BarreRecap({
  periode,
  onPeriode,
  recap,
  tauxLong,
  actions,
}: {
  periode: string;
  onPeriode: (p: string) => void;
  recap: RecapPaie;
  tauxLong?: boolean;
  /** Actions propres à l'écran (fiche employé, champs persistants…), à gauche de « Imprimer ». */
  actions?: React.ReactNode;
}) {
  const { cloture, bulletins, generer, paie, bareme } = recap;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-filet bg-surface px-3 py-2 shadow-xs print:hidden">
      <SelecteurPeriode valeur={periode} onChange={onPeriode} />
      <StatutMois cloture={paie === undefined ? undefined : cloture} />
      <span className="hidden h-6 w-px bg-filet sm:block" aria-hidden="true" />
      <TauxDuMois bareme={bareme} periode={periode} long={tauxLong} />
      <span className="flex-1" />
      {actions}
      <Button variant="outline" size="sm" onClick={() => window.print()}>
        <PrinterIcon />
        Imprimer
      </Button>
      {!cloture && bulletins.length > 0 ? (
        <BoutonConfirmation
          variant="default"
          size="sm"
          libelle="Générer et clôturer le mois"
          titre={`Générer et clôturer ${libellePeriode(periode)} ?`}
          consequence={`Les ${bulletins.length} bulletins seront figés et les saisies du mois ne seront plus modifiables. Cette opération est irréversible.`}
          motCle="CLOTURER"
          confirmer="Générer et clôturer"
          onConfirmer={() => generer({ periode })}
          succes={(r: any) => `${r.bulletins} bulletin(s) générés — ${libellePeriode(periode)} clôturé.`}
        />
      ) : null}
    </div>
  );
}

/** Quatre tuiles fines : effectif, Total 1, retenues, net à payer par société. */
export function TuilesRecap({ recap, periode }: { recap: RecapPaie; periode: string }) {
  const { paie, bulletins } = recap;
  const t = totaux(bulletins);
  const charge = paie === undefined;
  const bornes = bornesPeriode(periode);
  return (
    <GrilleTuiles className="print:hidden">
      <Tuile
        libelle="Effectif payé"
        valeur={charge ? undefined : t.effectif}
        note={`${joursDuMois(periode)} jours calendaires · paiement le ${bornes.paiement}`}
        compact
      />
      <Tuile
        libelle="Masse brute · Total 1"
        valeur={charge ? undefined : <Montant valeur={t.total1} zero="0" />}
        note="base + primes + congés + HS + ancienneté"
      />
      <Tuile
        libelle="Retenues du mois"
        valeur={charge ? undefined : <Montant valeur={-t.retenues} signe zero="0" />}
        note="impôts & CNPS, acomptes, mutuelle, sanctions"
      />
      <Tuile
        libelle="Net à payer · Total 2"
        valeur={charge ? undefined : <Montant valeur={t.net} gras zero="0" />}
        note={
          <span className="font-mono tabular-nums">
            SESAME {num(t.netSociete.SESAME)} · SOFINA {num(t.netSociete.SOFINA)} · SGC {num(t.netSociete.SGC)}
          </span>
        }
        vedette
      />
    </GrilleTuiles>
  );
}

export function LegendeRecap({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap gap-x-5 gap-y-1 text-2xs leading-relaxed text-encre-douce print:hidden", className)}>
      <span><b className="text-encre">Total 1</b> = base + primes + congés + heures sup + ancienneté</span>
      <span><b className="text-encre">Total 2 (net)</b> = Total 1 − sanctions − absences − dettes − acompte / impôts &amp; CNPS − mutuelle</span>
      <span><b className="text-encre">SESAME</b> non déclarés CNPS · <b className="text-encre">SOFINA</b> nouveaux employés · <b className="text-encre">SGC</b> déclarés CNPS</span>
      <span>Journalier = brut ÷ 30 · transport exonéré de cotisations</span>
    </div>
  );
}

/** Nombre calculé dans une cellule : milliers séparés, zéro réel en gris pâle (formalisme des chiffres). */
export function N({ valeur }: { valeur: number | undefined }) {
  const v = valeur ?? 0;
  if (v === 0) return <span className="text-encre-pale">0</span>;
  return <>{v < 0 ? "−" : ""}{num(Math.abs(v))}</>;
}

/** Pastille société (capsule douce, sans point de couleur — charte §4). */
export function PastilleSociete({ societe }: { societe: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-filet bg-bande px-2 py-0.5 text-[10px] font-semibold tracking-wide text-encre-douce">
      {societe}
    </span>
  );
}

/** Indicateur d'état d'une ligne (enregistrement automatique). */
export function EtatLigneBadge({ etat }: { etat: EtatLigne | undefined }) {
  if (!etat) return null;
  const libelle = etat === "modifie" ? "Modifié…" : etat === "enregistrement" ? "Enregistrement…" : "Enregistré ✓";
  return (
    <span
      className={cn(
        "text-[10px] font-medium",
        etat === "enregistre" ? "text-emerald-700" : "text-ocre"
      )}
      aria-live="polite"
    >
      {libelle}
    </span>
  );
}

// --- Recherche et hauteur du tableau --------------------------------------------

export const LIGNES_CHOIX = [5, 10, 15, 20, 30] as const;
export type LignesVisibles = (typeof LIGNES_CHOIX)[number] | 0; // 0 = toutes

const sansAccents = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/**
 * Recherche par nom / fonction / matricule et nombre de lignes visibles.
 * Le tableau défile SEUL (en-tête et pied collants), la page ne bouge pas :
 * c'est l'utilisateur qui choisit la hauteur, comme un filtre.
 */
export function useFiltreRecap(bulletins: BulletinLigne[]) {
  const [recherche, setRecherche] = React.useState("");
  const [lignes, setLignes] = React.useState<LignesVisibles>(() => {
    try {
      const v = Number(window.localStorage.getItem("recap-salaires:lignes") ?? "10");
      return (LIGNES_CHOIX as readonly number[]).includes(v) || v === 0 ? (v as LignesVisibles) : 10;
    } catch { return 10; }
  });
  const changerLignes = (n: LignesVisibles) => {
    setLignes(n);
    try { window.localStorage.setItem("recap-salaires:lignes", String(n)); } catch { /* ignoré */ }
  };
  const q = sansAccents(recherche.trim());
  const visibles = q
    ? bulletins.filter((b) => sansAccents(`${b.nom} ${b.fonction ?? ""} ${b.matricule} ${b.societe}`).includes(q))
    : bulletins;
  /** Hauteur maximale du conteneur défilant pour `hauteurLigne` px par ligne (+ en-tête et pied). */
  const hauteurMax = (hauteurLigne: number, enTete = 46, pied = 46) =>
    lignes === 0 ? undefined : `${lignes * hauteurLigne + enTete + pied + 2}px`;
  return { recherche, setRecherche, lignes, changerLignes, visibles, total: bulletins.length, hauteurMax };
}

export type FiltreRecap = ReturnType<typeof useFiltreRecap>;

export function BarreFiltre({ filtre, className }: { filtre: FiltreRecap; className?: string }) {
  const { recherche, setRecherche, lignes, changerLignes, visibles, total } = filtre;
  return (
    <div className={cn("flex flex-wrap items-center gap-3 print:hidden", className)}>
      <div className="relative w-full max-w-xs">
        <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-encre-pale" aria-hidden="true" />
        <Input
          type="search"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher un employé (nom, fonction, matricule)…"
          aria-label="Rechercher un employé"
          className="h-9 pl-8 pr-8"
        />
        {recherche ? (
          <button
            type="button"
            onClick={() => setRecherche("")}
            aria-label="Effacer la recherche"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-encre-pale hover:text-encre"
          >
            <XIcon className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      <span className="text-xs text-encre-douce" aria-live="polite">
        {recherche ? <><b className="text-encre">{visibles.length}</b> sur {total} employés</> : <>{total} employés</>}
      </span>
      <span className="flex-1" />
      <label className="flex items-center gap-2 text-xs text-encre-douce">
        Lignes visibles
        <Select value={String(lignes)} onValueChange={(v) => changerLignes(Number(v) as LignesVisibles)}>
          <SelectTrigger size="sm" className="w-[6.5rem]" aria-label="Nombre de lignes visibles avant défilement">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LIGNES_CHOIX.map((n) => <SelectItem key={n} value={String(n)}>{n} lignes</SelectItem>)}
            <SelectItem value="0">Toutes</SelectItem>
          </SelectContent>
        </Select>
      </label>
    </div>
  );
}

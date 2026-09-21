/**
 * Barème CNPS / CGI — refonte (charte poitiers-ui-ux-system).
 *
 * Le référentiel des taux qui font le bulletin : cotisations CNPS, CFC / FNE,
 * IRPP (abattements, CAC, tranches) et taxes forfaitaires (TDL, RAV). Chaque
 * version est datée : un bulletin utilise la version applicable à sa période,
 * un mois clôturé n'est jamais recalculé.
 *
 * Lecture : le tableau des versions (une ligne = une version), la version
 * sélectionnée détaillée en dessous par famille de taux, avec l'écart par
 * rapport à la version précédente quand une valeur a changé. Par défaut, la
 * version sélectionnée est celle qui s'applique à la période choisie.
 *
 * Écriture (niveau 7) : « Nouvelle version » ouvre un dialogue pré-rempli avec
 * la version sélectionnée ; l'enregistrement est confirmé, avec ses
 * conséquences (mois ouverts recalculés, mois clôturés intacts), et journalisé.
 * Un barème ne se saisit pas en série : le dialogue suffit.
 */
import * as React from "react";
import { useMutation, useQuery } from "convex/react";
import { BookOpenCheckIcon, PlusIcon, RefreshCwIcon, Trash2Icon } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { libellePeriode, num, pct, periodeCourante } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageEnTete } from "@/components/app/en-tete";
import { GrilleTuiles, Tuile } from "@/components/app/tuile";
import { Statut } from "@/components/app/statut";
import { SelecteurPeriode } from "@/components/app/selecteur-periode";
import { BoutonAction, BoutonConfirmation } from "@/components/app/bouton-action";
import { Champ, ChampNombre } from "@/components/app/champs";
import { SqueletteTableau } from "@/components/app/chargement";
import { SelecteurLignes, useLignesVisibles } from "@/components/app/lignes-visibles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Flag } from "@/components/ui/flag";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// --- Vocabulaire ----------------------------------------------------------------

type Version = {
  _id: string; effectiveFrom: string; source: string; statut: "actif" | "brouillon"; controleLe?: string;
  plafondCnps: number; tauxPvidSal: number; tauxPvidPat: number; tauxPf: number; tauxAtmp: number;
  tauxCfcSal: number; tauxCfcPat: number; tauxFne: number; abattementIrppPct: number; tauxCac: number;
  abattementIrppAnnuel?: number; tdlActif?: boolean; ravActif?: boolean;
  irppBrackets: { jusqua: number | null; taux: number }[];
};
type CleTaux = "plafondCnps" | "tauxPvidSal" | "tauxPvidPat" | "tauxPf" | "tauxAtmp" | "tauxCfcSal" | "tauxCfcPat" | "tauxFne" | "abattementIrppPct" | "tauxCac" | "abattementIrppAnnuel";

/** Un taux : sa clé, son libellé, son unité et qui le supporte. */
type Taux = { cle: CleTaux; libelle: string; unite: "FCFA" | "%"; part?: "salarié" | "employeur"; aide?: string };
/** Les familles de taux, dans l'ordre du bulletin. */
const FAMILLES: { titre: string; description: string; taux: Taux[] }[] = [
  {
    titre: "Cotisations CNPS",
    description: "Base = brut plafonné.",
    taux: [
      { cle: "plafondCnps", libelle: "Plafond mensuel", unite: "FCFA", aide: "au-delà, le brut n'est plus cotisé" },
      { cle: "tauxPvidSal", libelle: "PVID", unite: "%", part: "salarié" },
      { cle: "tauxPvidPat", libelle: "PVID", unite: "%", part: "employeur" },
      { cle: "tauxPf", libelle: "Prestations familiales", unite: "%", part: "employeur" },
      { cle: "tauxAtmp", libelle: "Accidents du travail (ATMP)", unite: "%", part: "employeur" },
    ],
  },
  {
    titre: "CFC & FNE",
    description: "Base = brut taxable (transport exonéré).",
    taux: [
      { cle: "tauxCfcSal", libelle: "Crédit foncier (CFC)", unite: "%", part: "salarié" },
      { cle: "tauxCfcPat", libelle: "Crédit foncier (CFC)", unite: "%", part: "employeur" },
      { cle: "tauxFne", libelle: "Fonds national de l'emploi (FNE)", unite: "%", part: "employeur" },
    ],
  },
  {
    titre: "IRPP & CAC",
    description: "Base = (taxable × (1 − abattement) − CNPS − abattement annuel ÷ 12) × 12, sur les tranches annuelles.",
    taux: [
      { cle: "abattementIrppPct", libelle: "Abattement forfaitaire", unite: "%" },
      { cle: "abattementIrppAnnuel", libelle: "Abattement annuel", unite: "FCFA", aide: "appliqué ÷ 12 chaque mois" },
      { cle: "tauxCac", libelle: "Centimes additionnels (CAC)", unite: "%", aide: "sur l'IRPP" },
    ],
  },
];
const DEFAUT: Partial<Record<CleTaux, number>> = { abattementIrppAnnuel: 500000 };
const valeurDe = (b: Version, k: CleTaux) => (b[k] as number | undefined) ?? DEFAUT[k] ?? 0;
const afficher = (t: Taux, v: number) => (t.unite === "FCFA" ? num(v) : pct(v, 2));

const fmtDate = (s?: string) => (s ? new Date(s.length === 10 ? s + "T00:00:00" : s).toLocaleDateString("fr-FR") : "—");
const fmtDateHeure = (s?: string) => (s ? new Date(s).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "—");
const aujourdHui = () => new Date().toISOString().slice(0, 10);

// --- Page -------------------------------------------------------------------------

export function Bareme() {
  const [periode, setPeriode] = React.useState(periodeCourante());
  const me = useQuery(api.users.me);
  const applicable = useQuery(api.bareme.pourPeriode, { periode }) as Version | null | undefined;
  const versions = useQuery(api.bareme.liste) as Version[] | undefined;
  const controle = useQuery(api.bareme.dernierControle);
  const verifier = useMutation(api.bareme.verifierMaintenant);
  const lignesVisibles = useLignesVisibles("bareme", 5);

  // Version détaillée : celle que l'on a cliquée, sinon celle qui s'applique à la période.
  const [choisie, setChoisie] = React.useState<string | null>(null);
  const liste = versions ?? [];
  const selection = (choisie && liste.find((v) => v._id === choisie)) || applicable || liste[0] || null;
  // Version précédente (plus ancienne) : sert à signaler ce qui a changé.
  const precedente = selection ? liste.find((v) => v.effectiveFrom < selection.effectiveFrom) ?? null : null;
  const [nouvelle, setNouvelle] = React.useState(false);
  const peutModifier = !!me && me.niveau >= 7;

  return (
    <div className="space-y-4">
      <PageEnTete
        titre="Barème CNPS / CGI"
        description="Les taux qui font le bulletin, en versions datées : chaque bulletin utilise la version applicable à sa période, un mois clôturé n'est jamais recalculé. La source officielle est contrôlée chaque jour à 06:00 UTC."
        statut={applicable === undefined ? null : applicable
          ? <Flag variant="renseigne" size="sm">Applicable à {libellePeriode(periode)} : version du {fmtDate(applicable.effectiveFrom)}</Flag>
          : <Flag variant="a-renseigner" size="sm">Aucune version applicable à {libellePeriode(periode)}</Flag>}
        actions={
          <>
            <SelecteurPeriode valeur={periode} onChange={(p) => { setPeriode(p); setChoisie(null); }} />
            <BoutonAction variant="outline" size="sm" onAction={() => verifier()} succes="Contrôle planifié : le résultat apparaît dans « Dernier contrôle » et dans le journal d'activité.">
              <RefreshCwIcon /> Vérifier la source
            </BoutonAction>
            {peutModifier && (
              <Button size="sm" onClick={() => setNouvelle(true)} disabled={!selection}>
                <PlusIcon /> Nouvelle version
              </Button>
            )}
          </>
        }
      />

      <GrilleTuiles>
        <Tuile libelle={`Version applicable · ${libellePeriode(periode)}`} valeur={applicable === undefined ? undefined : applicable ? fmtDate(applicable.effectiveFrom) : "aucune"} note={applicable ? applicable.source : "les bulletins de ce mois ne peuvent pas être calculés"} vedette />
        <Tuile libelle="Versions" valeur={versions ? liste.length : undefined} note={liste[0] ? `la plus récente est effective au ${fmtDate(liste[0].effectiveFrom)}` : "aucune version enregistrée"} />
        <Tuile libelle="Source officielle" valeur={controle ? <Statut etat={controle.sourceConfiguree ? "configure" : "absent"}>{controle.sourceConfiguree ? "Configurée" : "Non configurée"}</Statut> : undefined} note={controle?.sourceConfiguree ? "variable BAREME_SOURCE_URL" : "définir BAREME_SOURCE_URL sur le déploiement"} compact />
        <Tuile libelle="Dernier contrôle" valeur={controle ? (controle.dernier ? fmtDateHeure(controle.dernier.date) : "jamais") : undefined} note={controle?.dernier?.detail} compact />
      </GrilleTuiles>

      {versions === undefined ? (
        <SqueletteTableau colonnes={7} lignes={3} />
      ) : (
        <>
          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-xs text-encre-douce">{liste.length} version(s) — cliquez une version pour voir ses taux.</span>
              <SelecteurLignes valeur={lignesVisibles.lignes} onChange={lignesVisibles.setLignes} />
            </div>
            <Table classNameConteneur="rounded-xl" hauteurMax={lignesVisibles.hauteurMax(49, 40)}>
              <TableHeader>
                <TableRow>
                  <TableHead>Effective depuis</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead numerique>Plafond CNPS</TableHead>
                  <TableHead numerique>PVID sal.</TableHead>
                  <TableHead numerique>CFC sal.</TableHead>
                  <TableHead numerique>CAC</TableHead>
                  <TableHead numerique>Tranches IRPP</TableHead>
                  <TableHead>Contrôlée le</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {liste.map((v) => {
                  const estApplicable = applicable?._id === v._id;
                  return (
                    <TableRow key={v._id} active={selection?._id === v._id} className="cursor-pointer" onClick={() => setChoisie(v._id)} tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setChoisie(v._id); } }}>
                      <TableCell>
                        <div className="font-semibold">{fmtDate(v.effectiveFrom)}</div>
                        {estApplicable && <div className="text-2xs text-ocean-ceruleen">applicable à {libellePeriode(periode)}</div>}
                      </TableCell>
                      <TableCell className="max-w-[16rem] truncate text-xs" title={v.source}>{v.source}</TableCell>
                      <TableCell numerique className="font-mono text-xs">{num(v.plafondCnps)}</TableCell>
                      <TableCell numerique className="font-mono text-xs">{pct(v.tauxPvidSal, 2)}</TableCell>
                      <TableCell numerique className="font-mono text-xs">{pct(v.tauxCfcSal, 2)}</TableCell>
                      <TableCell numerique className="font-mono text-xs">{pct(v.tauxCac, 2)}</TableCell>
                      <TableCell numerique className="font-mono text-xs">{v.irppBrackets.length}</TableCell>
                      <TableCell className="text-xs text-encre-douce">{fmtDateHeure(v.controleLe)}</TableCell>
                      <TableCell><Statut etat={v.statut === "actif" ? "actif" : "non_saisi"}>{v.statut === "actif" ? "Active" : "Brouillon"}</Statut></TableCell>
                    </TableRow>
                  );
                })}
                {liste.length === 0 && (
                  <TableRow><TableCell colSpan={9} className="py-8 text-center text-xs text-encre-pale">Aucune version : le tableau de bord propose d'initialiser les données de démo (barème indicatif).</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {selection && <DetailVersion version={selection} precedente={precedente} estApplicable={applicable?._id === selection._id} periode={periode} />}
        </>
      )}

      {selection && (
        <DialogueNouvelleVersion ouvert={nouvelle} onFermer={() => setNouvelle(false)} base={selection} />
      )}
    </div>
  );
}

// --- Détail d'une version -------------------------------------------------------------

function DetailVersion({ version, precedente, estApplicable, periode }: { version: Version; precedente: Version | null; estApplicable: boolean; periode: string }) {
  const change = precedente
    ? (k: CleTaux) => valeurDe(precedente, k) !== valeurDe(version, k)
    : () => false;
  const tranchesChangees = precedente ? JSON.stringify(precedente.irppBrackets) !== JSON.stringify(version.irppBrackets) : false;

  return (
    <section className="rounded-xl border border-filet bg-surface" aria-labelledby="detail-version">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-filet px-4 py-3">
        <div>
          <h2 id="detail-version" className="text-sm font-semibold">Taux de la version du {fmtDate(version.effectiveFrom)}</h2>
          <div className="text-2xs text-encre-pale">{version.source}{precedente ? ` · les écarts sont indiqués par rapport à la version du ${fmtDate(precedente.effectiveFrom)}` : " · première version"}</div>
        </div>
        {estApplicable
          ? <Flag variant="renseigne" size="xs" icon={<BookOpenCheckIcon className="h-3 w-3" />}>Applicable à {libellePeriode(periode)}</Flag>
          : <Flag variant="neutre" size="xs">Non applicable à {libellePeriode(periode)}</Flag>}
      </div>
      <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-4">
        {FAMILLES.map((f) => (
          <Famille key={f.titre} titre={f.titre} description={f.description}>
            {f.taux.map((t) => (
              <LigneTaux key={t.cle} libelle={t.libelle} part={t.part} aide={t.aide} valeur={afficher(t, valeurDe(version, t.cle))} precedente={change(t.cle) && precedente ? afficher(t, valeurDe(precedente, t.cle)) : undefined} />
            ))}
          </Famille>
        ))}
        <Famille titre="Taxes forfaitaires" description="Barèmes par paliers (TDL sur le salaire de base, RAV sur la base taxable).">
          <LigneTaux libelle="Taxe de développement local (TDL)" part="salarié" valeur={(version.tdlActif ?? true) ? "appliquée" : "non appliquée"} precedente={precedente && (precedente.tdlActif ?? true) !== (version.tdlActif ?? true) ? ((precedente.tdlActif ?? true) ? "appliquée" : "non appliquée") : undefined} />
          <LigneTaux libelle="Redevance audiovisuelle (RAV)" part="salarié" valeur={(version.ravActif ?? true) ? "appliquée" : "non appliquée"} precedente={precedente && (precedente.ravActif ?? true) !== (version.ravActif ?? true) ? ((precedente.ravActif ?? true) ? "appliquée" : "non appliquée") : undefined} />
        </Famille>
        <Famille titre="Tranches IRPP" description="Saisies en base mensuelle ; le moteur les applique ×12 sur la base annuelle." className="md:col-span-2 xl:col-span-4" badge={tranchesChangees ? <Flag variant="a-renseigner" size="xs">modifiées</Flag> : null}>
          <Table classNameConteneur="mt-1 border-0" >
            <TableHeader>
              <TableRow>
                <TableHead>Tranche</TableHead>
                <TableHead numerique>Jusqu'à (par mois)</TableHead>
                <TableHead numerique>Jusqu'à (par an)</TableHead>
                <TableHead numerique>Taux</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {version.irppBrackets.map((b, i) => {
                const depuis = i === 0 ? 0 : version.irppBrackets[i - 1].jusqua ?? 0;
                return (
                  <TableRow key={i}>
                    <TableCell className="text-xs">{i + 1}<sup>{i === 0 ? "re" : "e"}</sup> tranche · de {num(depuis)} {b.jusqua === null ? "et au-delà" : `à ${num(b.jusqua)}`}</TableCell>
                    <TableCell numerique className="font-mono text-xs">{b.jusqua === null ? "au-delà" : num(b.jusqua)}</TableCell>
                    <TableCell numerique className="font-mono text-xs text-encre-douce">{b.jusqua === null ? "au-delà" : num(b.jusqua * 12)}</TableCell>
                    <TableCell numerique className="font-mono text-xs font-semibold">{pct(b.taux, 2)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Famille>
      </div>
    </section>
  );
}

function Famille({ titre, description, badge, className, children }: { titre: string; description?: string; badge?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-lg border border-filet-clair bg-fond p-3", className)}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <div className="text-xs font-semibold text-encre">{titre}</div>
          {description && <div className="text-2xs text-encre-pale">{description}</div>}
        </div>
        {badge}
      </div>
      <dl className="divide-y divide-filet-clair">{children}</dl>
    </div>
  );
}

function LigneTaux({ libelle, part, aide, valeur, precedente }: { libelle: string; part?: "salarié" | "employeur"; aide?: string; valeur: string; precedente?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="min-w-0 text-xs text-encre-douce">
        {libelle}
        {part && <span className={cn("ml-1.5 rounded px-1 text-2xs", part === "salarié" ? "bg-ocean-brume text-ocean-nuit" : "bg-filet-clair text-encre-douce")}>{part}</span>}
        {aide && <div className="text-2xs text-encre-pale">{aide}</div>}
      </dt>
      <dd className="shrink-0 text-right font-mono text-xs tabular-nums">
        <div className={cn("font-semibold", precedente && "text-ocre")}>{valeur}</div>
        {precedente && <div className="text-2xs text-encre-pale line-through" title="valeur de la version précédente">{precedente}</div>}
      </dd>
    </div>
  );
}

// --- Nouvelle version ---------------------------------------------------------------

type Formulaire = {
  effectiveFrom: string; source: string; tdlActif: boolean; ravActif: boolean;
  taux: Record<CleTaux, number>;
  tranches: { jusqua: number | null; taux: number }[];
};
const formulaireDepuis = (b: Version): Formulaire => ({
  effectiveFrom: "",
  source: "",
  tdlActif: b.tdlActif ?? true,
  ravActif: b.ravActif ?? true,
  taux: Object.fromEntries(FAMILLES.flatMap((f) => f.taux).map((t) => [t.cle, valeurDe(b, t.cle)])) as Record<CleTaux, number>,
  tranches: b.irppBrackets.map((t) => ({ ...t })),
});

function DialogueNouvelleVersion({ ouvert, onFermer, base }: { ouvert: boolean; onFermer: () => void; base: Version }) {
  const upsert = useMutation(api.bareme.upsert);
  const [f, setF] = React.useState<Formulaire>(() => formulaireDepuis(base));
  React.useEffect(() => { if (ouvert) setF(formulaireDepuis(base)); }, [ouvert, base]);

  const erreurs: string[] = [];
  if (!f.effectiveFrom) erreurs.push("La date d'effet est obligatoire.");
  else if (f.effectiveFrom <= base.effectiveFrom) erreurs.push(`La date d'effet doit être postérieure au ${fmtDate(base.effectiveFrom)} (version de départ).`);
  for (const t of FAMILLES.flatMap((x) => x.taux)) if (t.unite === "%" && f.taux[t.cle] > 100) erreurs.push(`${t.libelle} : un taux ne dépasse pas 100 %.`);
  const ouvertes = f.tranches.filter((t) => t.jusqua === null).length;
  if (!f.tranches.length) erreurs.push("Il faut au moins une tranche IRPP.");
  else if (f.tranches[f.tranches.length - 1].jusqua !== null) erreurs.push("La dernière tranche IRPP doit être ouverte (plafond vide).");
  else if (ouvertes > 1) erreurs.push("Une seule tranche IRPP peut être ouverte : la dernière.");
  for (let i = 1; i < f.tranches.length; i++) {
    const a = f.tranches[i - 1].jusqua, b = f.tranches[i].jusqua;
    if (a !== null && b !== null && b <= a) { erreurs.push("Les plafonds des tranches IRPP doivent être croissants."); break; }
  }
  const valide = erreurs.length === 0;

  const majTranche = (i: number, patch: Partial<{ jusqua: number | null; taux: number }>) => setF((x) => ({ ...x, tranches: x.tranches.map((t, j) => (j === i ? { ...t, ...patch } : t)) }));

  const enregistrer = async () => {
    await upsert({
      effectiveFrom: f.effectiveFrom,
      source: f.source.trim() || "Saisie manuelle",
      valeurs: { ...f.taux, tdlActif: f.tdlActif, ravActif: f.ravActif, irppBrackets: f.tranches },
    });
    onFermer();
  };

  return (
    <Dialog open={ouvert} onOpenChange={(o) => { if (!o) onFermer(); }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Nouvelle version du barème</DialogTitle>
          <DialogDescription>Pré-remplie avec la version du {fmtDate(base.effectiveFrom)}. Ne modifiez que ce qui change ; la version de départ reste applicable aux périodes antérieures à la date d'effet.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <Champ libelle="Effective à partir du" requis aide="Les périodes de paie commençant à cette date ou après utilisent cette version.">
            {(a) => <Input {...a} type="date" min={aujourdHui() < base.effectiveFrom ? base.effectiveFrom : undefined} value={f.effectiveFrom} onChange={(e) => setF({ ...f, effectiveFrom: e.target.value })} />}
          </Champ>
          <Champ libelle="Source" aide="Le texte qui fonde ces taux : loi de finances, circulaire CNPS…">
            {(a) => <Input {...a} value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} placeholder="Loi de finances 2027, circulaire CNPS…" />}
          </Champ>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {FAMILLES.map((fam) => (
            <fieldset key={fam.titre} className="rounded-lg border border-filet-clair bg-fond p-3">
              <legend className="px-1 text-xs font-semibold">{fam.titre}</legend>
              <div className="grid gap-2.5">
                {fam.taux.map((t) => (
                  <ChampNombre
                    key={t.cle}
                    libelle={<>{t.libelle}{t.part && <span className="ml-1 text-2xs text-encre-pale">({t.part})</span>}</>}
                    unite={t.unite}
                    valeur={f.taux[t.cle]}
                    onChange={(v) => setF((x) => ({ ...x, taux: { ...x.taux, [t.cle]: v } }))}
                    className={cn(valeurDe(base, t.cle) !== f.taux[t.cle] && "border-ocre bg-ocre/5")}
                  />
                ))}
              </div>
            </fieldset>
          ))}
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_2fr]">
          <fieldset className="rounded-lg border border-filet-clair bg-fond p-3">
            <legend className="px-1 text-xs font-semibold">Taxes forfaitaires</legend>
            <label className="flex items-center justify-between gap-3 py-1.5 text-xs">
              <span>Appliquer la TDL <span className="block text-2xs text-encre-pale">taxe de développement local</span></span>
              <Switch checked={f.tdlActif} onCheckedChange={(c) => setF({ ...f, tdlActif: c })} />
            </label>
            <label className="flex items-center justify-between gap-3 py-1.5 text-xs">
              <span>Appliquer la RAV <span className="block text-2xs text-encre-pale">redevance audiovisuelle</span></span>
              <Switch checked={f.ravActif} onCheckedChange={(c) => setF({ ...f, ravActif: c })} />
            </label>
          </fieldset>

          <fieldset className="rounded-lg border border-filet-clair bg-fond p-3">
            <legend className="px-1 text-xs font-semibold">Tranches IRPP (base mensuelle)</legend>
            <div className="grid gap-2">
              {f.tranches.map((t, i) => {
                const derniere = i === f.tranches.length - 1;
                return (
                  <div key={i} className="grid grid-cols-[auto_1fr_6.5rem_auto] items-end gap-2">
                    <span className="w-6 pb-2.5 text-xs text-encre-douce">{i + 1}<sup>{i === 0 ? "re" : "e"}</sup></span>
                    {derniere && t.jusqua === null ? (
                      <Champ libelle={<span className={cn(i > 0 && "sr-only")}>Jusqu'à</span>}>{(a) => <Input {...a} value="au-delà" readOnly className="bg-filet-clair/40 text-right font-mono" />}</Champ>
                    ) : (
                      <ChampNombre libelle={<span className={cn(i > 0 && "sr-only")}>Jusqu'à</span>} unite="FCFA" valeur={t.jusqua ?? 0} onChange={(v) => majTranche(i, { jusqua: v })} />
                    )}
                    <ChampNombre libelle={<span className={cn(i > 0 && "sr-only")}>Taux</span>} unite="%" valeur={t.taux} onChange={(v) => majTranche(i, { taux: v })} />
                    <Button type="button" variant="ghost" size="icon" className="mb-0.5 text-encre-pale hover:text-carmin" aria-label={`Retirer la tranche ${i + 1}`} disabled={f.tranches.length <= 1} onClick={() => setF((x) => ({ ...x, tranches: x.tranches.filter((_, j) => j !== i) }))}><Trash2Icon /></Button>
                  </div>
                );
              })}
              <div>
                <Button type="button" variant="outline" size="sm" onClick={() => setF((x) => {
                  // La nouvelle tranche s'insère avant la tranche ouverte, avec un plafond à compléter.
                  const t = [...x.tranches];
                  const ouverte = t.length && t[t.length - 1].jusqua === null ? t.pop()! : null;
                  t.push({ jusqua: (t[t.length - 1]?.jusqua ?? 0) + 100000, taux: ouverte?.taux ?? 0 });
                  if (ouverte) t.push(ouverte); else t.push({ jusqua: null, taux: 0 });
                  return { ...x, tranches: t };
                })}><PlusIcon /> Ajouter une tranche</Button>
              </div>
            </div>
          </fieldset>
        </div>

        {erreurs.length > 0 && (
          <ul className="rounded-md border border-carmin/30 bg-carmin/5 px-3 py-2 text-xs text-carmin" role="alert">
            {erreurs.map((e) => <li key={e}>{e}</li>)}
          </ul>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onFermer}>Annuler</Button>
          <BoutonConfirmation
            disabled={!valide}
            libelle="Enregistrer la version"
            titre={`Enregistrer la version effective au ${f.effectiveFrom ? fmtDate(f.effectiveFrom) : "…"} ?`}
            consequence="Les mois de paie ouverts dont la période commence à cette date ou après seront recalculés avec ces taux, en direct. Les mois clôturés ne bougent pas. L'opération est journalisée à votre nom."
            confirmer="Enregistrer"
            onConfirmer={enregistrer}
            succes={`Version effective au ${f.effectiveFrom ? fmtDate(f.effectiveFrom) : ""} enregistrée.`}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

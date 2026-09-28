/**
 * Paramètres — refonte (charte poitiers-ui-ux-system).
 *
 * Tout ce qui se règle une fois et que l'utilisateur ne voit pas directement :
 *  - Entreprise & documents : identité qui apparaît sur bulletins, listes, PDF (avec aperçu) ;
 *  - Paie & congés : jour de paiement, congés acquis, visa RH, jours de base, plafond de saisie,
 *    PDF à la clôture ;
 *  - Courrier & e-mail : expéditeur, modèle de lettre, interrupteur d'envoi réel ;
 *  - Fonctionnement : fenêtre des comptes rendus, verrou financier, IA documents ;
 *  - Rôles & accès : qui voit et qui fait quoi, module par module (matrice modifiable), et les
 *    exceptions accordées ou retirées à une personne précise ;
 *  - Déploiement (super administrateur) : variables d'environnement définies ou non, jamais leur valeur.
 *
 * Un seul bouton « Enregistrer » pour la page : les modifications de tous les onglets partent
 * ensemble, le compteur dit combien attendent. Droit « Paramètres » (Faire pour modifier) ; l'onglet Déploiement exige le niveau 8.
 */
import * as React from "react";
import { useMutation, useQuery } from "convex/react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Building2Icon, LockIcon, RotateCcwIcon, SaveIcon, ShieldCheckIcon, XIcon } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { DESCRIPTION, LIBELLE, MODULES, NIVEAU, ROLES_ORDONNES, droitsEffectifs, estVerrouille, normaliser, type Action, type Cellule, type Exception, type Module, type Role, type SurchargeRole } from "../../convex/rbac";
import { REGLAGES_DEFAUT, reglagesDe, validerReglages, type Reglages } from "../../convex/lib/reglages";
import { MODELE_DEFAUT } from "../../convex/lib/courrier";
import { messageErreur, num } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageEnTete } from "@/components/app/en-tete";
import { GrilleTuiles, Tuile } from "@/components/app/tuile";
import { Statut } from "@/components/app/statut";
import { fmtDateHeure, relatif } from "@/components/app/journal";
import { Champ, ChampNombre } from "@/components/app/champs";
import { SqueletteTexte } from "@/components/app/chargement";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Flag } from "@/components/ui/flag";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// --- Vocabulaire ----------------------------------------------------------------

type Entreprise = {
  nom: string; adresse: string; niu: string; numeroCnps: string; logoUrl: string; couleurEntete: string; filigrane: string;
  responsableRH: string; jourPaiement: number; congesParMois: number; emailExpediteur: string; modeleCourrier: string;
};
const entrepriseDe = (p: any): Entreprise => ({
  nom: p?.nom ?? "", adresse: p?.adresse ?? "", niu: p?.niu ?? "", numeroCnps: p?.numeroCnps ?? "", logoUrl: p?.logoUrl ?? "",
  couleurEntete: p?.couleurEntete ?? "#0f2a44", filigrane: p?.filigrane ?? "", responsableRH: p?.responsableRH ?? "",
  jourPaiement: p?.jourPaiement ?? 5, congesParMois: p?.congesParMois ?? 1.5, emailExpediteur: p?.emailExpediteur ?? "", modeleCourrier: p?.modeleCourrier ?? "",
});
const ONGLETS = ["entreprise", "paie", "courrier", "fonctionnement", "roles", "deploiement"] as const;
type Onglet = typeof ONGLETS[number];

const memes = (a: object, b: object) => JSON.stringify(a) === JSON.stringify(b);

// --- Page -------------------------------------------------------------------------

export function Parametres() {
  const p = useQuery(api.parametres.get);
  const me = useQuery(api.users.me);
  const modeCourrier = useQuery(api.courrier.mode);
  const dernierEnreg = useQuery(api.journal.liste, { action: "parametres_modification", limite: 1 });
  const enregistrer = useMutation(api.parametres.enregistrer);
  const enregistrerReglages = useMutation(api.parametres.enregistrerReglages);
  const enregistrerDroits = useMutation(api.parametres.enregistrerDroitsRoles);
  const [params, setParams] = useSearchParams();
  const ongletUrl = params.get("onglet") as Onglet | null;
  const onglet: Onglet = ongletUrl && ONGLETS.includes(ongletUrl) ? ongletUrl : "entreprise";
  const superAdmin = !!me && me.niveau >= 8;
  const peutModifier = !!me?.droits?.["/parametres"]?.faire;

  // Deux états locaux, initialisés depuis la base ; « dirty » = différent de ce qui est en base.
  const [e, setE] = React.useState<Entreprise | null>(null);
  const [r, setR] = React.useState<Reglages | null>(null);
  const [dR, setDR] = React.useState<Matrice | null>(null);
  React.useEffect(() => { if (p !== undefined && e === null) { setE(entrepriseDe(p)); setR(reglagesDe(p?.reglages)); setDR(matriceDe(p?.droitsRoles)); } }, [p, e]);
  const baseE = entrepriseDe(p);
  const baseR = reglagesDe(p?.reglages);
  const baseD = React.useMemo(() => matriceDe(p?.droitsRoles), [p?.droitsRoles]);
  const dirtyE = !!e && !memes(e, baseE);
  const dirtyR = !!r && !memes(r, baseR);
  const modifsD = dR ? Object.keys(baseD).filter((k) => !memeCellule(dR[k], baseD[k])).length : 0;
  const nbModifs = (e ? (Object.keys(e) as (keyof Entreprise)[]).filter((k) => e[k] !== baseE[k]).length : 0)
    + (r ? (Object.keys(r) as (keyof Reglages)[]).filter((k) => r[k] !== baseR[k]).length : 0) + modifsD;
  const erreursR = r ? validerReglages(r) : [];
  const erreursE = e ? [
    ...(!e.nom.trim() ? ["Le nom de l'entreprise est obligatoire."] : []),
    ...(!e.adresse.trim() ? ["L'adresse est obligatoire."] : []),
    ...(e.jourPaiement < 1 || e.jourPaiement > 28 ? ["Jour de paiement : entre 1 et 28."] : []),
    ...(e.congesParMois < 0 || e.congesParMois > 10 ? ["Congés acquis par mois : entre 0 et 10 jours."] : []),
    ...(e.emailExpediteur && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.emailExpediteur) ? ["E-mail expéditeur invalide."] : []),
  ] : [];
  const erreurs = [...erreursE, ...erreursR];
  const [enCours, setEnCours] = React.useState(false);

  const sauvegarder = async () => {
    if (!e || !r || erreurs.length) return;
    setEnCours(true);
    try {
      if (dirtyE) await enregistrer({
        nom: e.nom.trim(), adresse: e.adresse.trim(), couleurEntete: e.couleurEntete,
        logoUrl: e.logoUrl.trim() || undefined, filigrane: e.filigrane.trim() || undefined, emailExpediteur: e.emailExpediteur.trim() || undefined,
        modeleCourrier: e.modeleCourrier.trim() || undefined, congesParMois: e.congesParMois,
        niu: e.niu.trim() || undefined, numeroCnps: e.numeroCnps.trim() || undefined, responsableRH: e.responsableRH.trim() || undefined,
        jourPaiement: e.jourPaiement,
      });
      if (dirtyR) await enregistrerReglages({ reglages: r });
      if (dR && modifsD) await enregistrerDroits({ droits: Object.entries(dR).map(([k, c]) => { const [role, module] = k.split("|"); return { role, module, voir: c.voir, faire: c.faire }; }) });
      toast.success("Paramètres enregistrés", { description: `${nbModifs} modification(s) appliquée(s) — journalisées.` });
    } catch (err) { toast.error("Enregistrement refusé", { description: messageErreur(err) }); }
    finally { setEnCours(false); }
  };
  const annuler = () => { setE(baseE); setR(baseR); setDR(baseD); };

  const majE = <K extends keyof Entreprise>(k: K, v: Entreprise[K]) => setE((x) => (x ? { ...x, [k]: v } : x));
  const majR = <K extends keyof Reglages>(k: K, v: Reglages[K]) => setR((x) => (x ? { ...x, [k]: v } : x));
  const modifieE = (k: keyof Entreprise) => !!e && e[k] !== baseE[k];
  const modifieR = (k: keyof Reglages) => !!r && r[k] !== baseR[k];

  return (
    <div className="space-y-4">
      <PageEnTete
        titre="Paramètres"
        description="Ce qui se règle une fois et que personne ne voit à l'écran : identité de l'entreprise sur les documents, règles de paie et de congés, courrier, fonctionnement de l'ERP, matrice des rôles. Chaque enregistrement est journalisé."
        statut={me ? <Flag variant="verrou" size="sm" icon={<ShieldCheckIcon className="h-3 w-3" />}>{me.roleLibelle}</Flag> : null}
        actions={
          <>
            {nbModifs > 0 && <span className={cn("text-xs", erreurs.length ? "text-carmin" : "text-ocre")}>{erreurs.length ? `${erreurs.length} erreur(s)` : `${nbModifs} modification(s) non enregistrée(s)`}</span>}
            <Button variant="outline" size="sm" disabled={!nbModifs || enCours} onClick={annuler}><XIcon /> Annuler</Button>
            <Button size="sm" disabled={!nbModifs || !!erreurs.length || enCours} onClick={() => void sauvegarder()}><SaveIcon /> Enregistrer</Button>
          </>
        }
      />

      {erreurs.length > 0 && (
        <ul className="rounded-md border border-carmin/30 bg-carmin/5 px-3 py-2 text-xs text-carmin" role="alert">{erreurs.map((x) => <li key={x}>{x}</li>)}</ul>
      )}

      <GrilleTuiles>
        <Tuile libelle="Entreprise" valeur={p === undefined ? undefined : <span className="truncate text-lg">{baseE.nom || "—"}</span>} note={baseE.adresse || "adresse à renseigner"} vedette compact />
        <Tuile libelle="Courrier de paie" valeur={modeCourrier === undefined ? undefined : <Statut etat={modeCourrier.reel ? "configure" : "non_saisi"}>{modeCourrier.reel ? "Envoi réel" : "Simulation"}</Statut>} note={modeCourrier?.reel ? "les e-mails partent réellement" : !modeCourrier?.cleConfiguree ? "clé RESEND_API_KEY absente" : "interrupteur d'envoi réel fermé"} compact />
        <Tuile libelle="Réglages personnalisés" valeur={p === undefined ? undefined : (Object.keys(REGLAGES_DEFAUT) as (keyof Reglages)[]).filter((k) => baseR[k] !== REGLAGES_DEFAUT[k]).length} note={`sur ${Object.keys(REGLAGES_DEFAUT).length} réglages de fonctionnement`} />
        <Tuile libelle="Dernier enregistrement" valeur={dernierEnreg === undefined ? undefined : dernierEnreg[0] ? relatif(dernierEnreg[0].date) : "jamais"} note={dernierEnreg?.[0] ? `${fmtDateHeure(dernierEnreg[0].date)} · ${dernierEnreg[0].auteurNom ?? "système"}` : "aucune modification journalisée"} compact />
      </GrilleTuiles>

      <Tabs value={onglet} onValueChange={(v) => setParams(v === "entreprise" ? {} : { onglet: v }, { replace: true })} className="gap-4">
        {/* Sélecteur de section : segmenté, l'actif en fond océan (même contrôle que les filtres d'état de Membres / Courrier). */}
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-filet bg-surface px-3.5 py-2 shadow-xs sm:py-2.5">
          <TabsList className="h-auto flex-wrap gap-1 rounded-xl border border-filet bg-slate-100/80 p-1">
            {([
              ["entreprise", "Entreprise & documents", (["nom", "adresse", "niu", "numeroCnps", "logoUrl", "couleurEntete", "filigrane"] as (keyof Entreprise)[]).some(modifieE)],
              ["paie", "Paie & congés", (["responsableRH", "jourPaiement", "congesParMois"] as (keyof Entreprise)[]).some(modifieE) || (["joursBaseDefaut", "plafondSaisie", "pdfAutoCloture"] as (keyof Reglages)[]).some(modifieR)],
              ["courrier", "Courrier & e-mail", (["emailExpediteur", "modeleCourrier"] as (keyof Entreprise)[]).some(modifieE) || modifieR("envoiReelActive")],
              ["fonctionnement", "Fonctionnement", (["crHeureOuverture", "crHeureFermeture", "crSamedi", "verrouFinancierMin", "iaDocumentsActive"] as (keyof Reglages)[]).some(modifieR)],
              ["roles", "Rôles & accès", modifsD > 0],
              ...(superAdmin ? [["deploiement", "Déploiement", false] as const] : []),
            ] as [Onglet, string, boolean][]).map(([k, l, modifie]) => (
              <TabsTrigger key={k} value={k} className={cn(
                "h-auto flex-none rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors data-[state=inactive]:text-encre-douce data-[state=inactive]:hover:bg-white data-[state=inactive]:hover:text-encre",
                "data-[state=active]:bg-ocean-profond data-[state=active]:text-white data-[state=active]:shadow-xs",
              )}>
                {l}{modifie ? <Point /> : null}
              </TabsTrigger>
            ))}
          </TabsList>
          <span className="ml-auto text-2xs text-encre-pale">{onglet === "deploiement" ? "super administrateur · lecture seule" : peutModifier ? "modifiable" : "consultation seule"}</span>
        </div>

        {!e || !r ? (
          <div className="mt-4"><SqueletteTexte lignes={6} /></div>
        ) : (
          <>
            {/* --- Entreprise & documents ------------------------------------------------ */}
            <TabsContent value="entreprise" className="grid gap-4 lg:grid-cols-[1fr_22rem]">
              <Bloc titre="Identité" description="Reprise en en-tête des bulletins, listes et PDF, et dans les courriers.">
                <Grille>
                  <Champ libelle="Nom de l'entreprise" aide="Tel qu'il s'imprime en tête des bulletins, listes et courriers" requis className={modif(modifieE("nom"))}>{(a) => <Input {...a} value={e.nom} onChange={(x) => majE("nom", x.target.value)} />}</Champ>
                  <Champ libelle="Adresse" requis className={cn("sm:col-span-2", modif(modifieE("adresse")))}>{(a) => <Input {...a} value={e.adresse} onChange={(x) => majE("adresse", x.target.value)} />}</Champ>
                  <Champ libelle="NIU (entreprise)" aide="Numéro d'identifiant unique, bloc employeur du bulletin" className={modif(modifieE("niu"))}>{(a) => <Input {...a} value={e.niu} onChange={(x) => majE("niu", x.target.value)} placeholder="M0…" className="font-mono" />}</Champ>
                  <Champ libelle="N° CNPS employeur" className={modif(modifieE("numeroCnps"))}>{(a) => <Input {...a} value={e.numeroCnps} onChange={(x) => majE("numeroCnps", x.target.value)} className="font-mono" />}</Champ>
                </Grille>
              </Bloc>
              <Bloc titre="Aperçu de l'en-tête" description="Tel qu'il apparaît sur un document imprimé." className="lg:row-span-2">
                <div className="rounded-lg bg-papier p-3"><div className="rounded border border-filet bg-white p-4 text-encre shadow-sm">
                  <div className="flex items-start gap-3 border-b-2 pb-3" style={{ borderColor: e.couleurEntete }}>
                    {e.logoUrl ? <img src={e.logoUrl} alt="" className="h-12 w-12 shrink-0 object-contain" /> : <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-filet-clair text-encre-pale"><Building2Icon className="h-6 w-6" /></div>}
                    <div className="min-w-0">
                      <div className="truncate text-base font-bold uppercase tracking-wide" style={{ color: e.couleurEntete }}>{e.nom || "Nom de l'entreprise"}</div>
                      <div className="text-2xs text-encre-douce">{e.adresse || "Adresse"}</div>
                      <div className="font-mono text-2xs text-encre-pale">{[e.niu && `NIU ${e.niu}`, e.numeroCnps && `CNPS ${e.numeroCnps}`].filter(Boolean).join(" · ") || "NIU · N° CNPS"}</div>
                    </div>
                  </div>
                  <div className="relative mt-3 h-24 overflow-hidden">
                    <div className="space-y-1.5 opacity-60">{[1, 2, 3, 4].map((i) => <div key={i} className="h-2 rounded bg-filet-clair" style={{ width: `${90 - i * 12}%` }} />)}</div>
                    {e.filigrane && <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-2xl font-black uppercase tracking-widest text-encre/10 -rotate-12 select-none">{e.filigrane}</div>}
                  </div>
                  <div className="mt-2 border-t border-filet-clair pt-2 text-2xs text-encre-pale">Visa RH : {e.responsableRH || "—"}</div>
                </div></div>
              </Bloc>
              <Bloc titre="Apparence des documents" description="Couleur de l'en-tête, logo, filigrane des PDF.">
                <Grille>
                  <Champ libelle="Couleur d'en-tête" className={modif(modifieE("couleurEntete"))}>{(a) => (
                    <div className="flex items-center gap-2">
                      <input id={a.id} type="color" value={e.couleurEntete} onChange={(x) => majE("couleurEntete", x.target.value)} className="h-9 w-12 cursor-pointer rounded border border-filet bg-surface p-0.5" />
                      <Input value={e.couleurEntete} onChange={(x) => majE("couleurEntete", x.target.value)} className="w-28 font-mono" aria-label="Code couleur" />
                    </div>
                  )}</Champ>
                  <Champ libelle="Logo (URL)" aide="Image accessible publiquement ; vide = pas de logo" className={cn("sm:col-span-2", modif(modifieE("logoUrl")))}>{(a) => <Input {...a} value={e.logoUrl} onChange={(x) => majE("logoUrl", x.target.value)} placeholder="https://…/logo.png" />}</Champ>
                  <Champ libelle="Filigrane des PDF" aide="Texte en diagonale sur chaque page ; vide = aucun" className={modif(modifieE("filigrane"))}>{(a) => <Input {...a} value={e.filigrane} onChange={(x) => majE("filigrane", x.target.value)} />}</Champ>
                </Grille>
              </Bloc>
            </TabsContent>

            {/* --- Paie & congés ------------------------------------------------------------ */}
            <TabsContent value="paie" className="grid gap-4 lg:grid-cols-2">
              <Bloc titre="Bulletin & paiement" description="Mentions portées sur chaque bulletin.">
                <Grille>
                  <Champ libelle="Responsable RH (visa des bulletins)" className={cn("sm:col-span-2", modif(modifieE("responsableRH")))}>{(a) => <Input {...a} value={e.responsableRH} onChange={(x) => majE("responsableRH", x.target.value)} placeholder="Nom du signataire" />}</Champ>
                  <ChampNombre libelle="Jour de paiement (mois suivant)" aide="Mention du bulletin : « Paiement le N du mois suivant par banque »" unite="le" valeur={e.jourPaiement} onChange={(v) => majE("jourPaiement", v)} className={modif(modifieE("jourPaiement"))} />
                  <ChampNombre libelle="Congés acquis par mois de service" aide="Solde = initial + N × mois de service − congés pris" unite="j" decimales valeur={e.congesParMois} onChange={(v) => majE("congesParMois", v)} className={modif(modifieE("congesParMois"))} />
                </Grille>
              </Bloc>
              <Bloc titre="Calcul & garde-fous" description="Réglages du moteur de paie et de la saisie.">
                <Grille>
                  <ChampNombre libelle="Jours de base d'un nouvel employé" aide="Diviseur du salaire journalier (brut ÷ N). Les employés existants gardent le leur." unite="j" valeur={r.joursBaseDefaut} onChange={(v) => majR("joursBaseDefaut", v)} className={modif(modifieR("joursBaseDefaut"))} />
                  <ChampNombre libelle="Plafond de saisie mensuelle" aide="Au-delà, la saisie est refusée : protège des fautes de frappe." unite="FCFA" valeur={r.plafondSaisie} onChange={(v) => majR("plafondSaisie", v)} className={modif(modifieR("plafondSaisie"))} />
                </Grille>
                <Interrupteur libelle="Générer les PDF à la clôture" aide="Dès qu'un mois est clôturé, les bulletins figés sont rendus en PDF et archivés — sinon, à la demande depuis Archives." valeur={r.pdfAutoCloture} onChange={(v) => majR("pdfAutoCloture", v)} modifie={modifieR("pdfAutoCloture")} />
              </Bloc>
            </TabsContent>

            {/* --- Courrier & e-mail ---------------------------------------------------------- */}
            <TabsContent value="courrier" className="grid gap-4 lg:grid-cols-2">
              <Bloc titre="Expéditeur & envoi" description="Le courrier de paie part par Resend ; sans clé ou sans l'interrupteur, il est simulé (journal seul).">
                <Grille>
                  <Champ libelle="E-mail expéditeur" aide="Sur un domaine vérifié chez Resend" className={cn("sm:col-span-2", modif(modifieE("emailExpediteur")))}>{(a) => <Input {...a} type="email" value={e.emailExpediteur} onChange={(x) => majE("emailExpediteur", x.target.value)} placeholder="paie@votre-domaine.com" />}</Champ>
                </Grille>
                <Interrupteur libelle="Envoi réel des e-mails" aide={modeCourrier?.cleConfiguree ? "La clé RESEND_API_KEY est définie : activer fait réellement partir les courriers." : "Sans effet tant que RESEND_API_KEY n'est pas définie sur le déploiement (onglet Déploiement)."} valeur={r.envoiReelActive} onChange={(v) => majR("envoiReelActive", v)} modifie={modifieR("envoiReelActive")} />
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <span className="text-encre-douce">État :</span>
                  {modeCourrier === undefined ? "…" : modeCourrier.reel
                    ? <Flag variant="renseigne" size="xs">envoi réel actif</Flag>
                    : <Flag variant="a-renseigner" size="xs">simulation · {!modeCourrier.cleConfiguree ? "clé absente" : "interrupteur fermé"}</Flag>}
                </div>
              </Bloc>
              <Bloc titre="Modèle de lettre" description="Variables : {nom} {periode} {net} {entreprise}. Vide = modèle par défaut. Modifiable aussi depuis Courrier de paie.">
                <Champ libelle="Lettre d'accompagnement" className={modif(modifieE("modeleCourrier"))}>{(a) => <Textarea {...a} value={e.modeleCourrier} onChange={(x) => majE("modeleCourrier", x.target.value)} placeholder={MODELE_DEFAUT} rows={9} className="font-mono text-xs" />}</Champ>
                {e.modeleCourrier && <Button type="button" variant="ghost" size="sm" className="mt-1 text-2xs" onClick={() => majE("modeleCourrier", "")}>Revenir au modèle par défaut</Button>}
              </Bloc>
            </TabsContent>

            {/* --- Fonctionnement -------------------------------------------------------------- */}
            <TabsContent value="fonctionnement" className="grid gap-4 lg:grid-cols-2">
              <Bloc titre="Comptes rendus" description="Fenêtre de soumission (heure de Douala). Dans la fenêtre : 1 point ; hors fenêtre : accepté, 0 point.">
                <Grille>
                  <ChampNombre libelle="Ouverture" unite="h" valeur={r.crHeureOuverture} onChange={(v) => majR("crHeureOuverture", v)} className={modif(modifieR("crHeureOuverture"))} />
                  <ChampNombre libelle="Fermeture" aide="exclue" unite="h" valeur={r.crHeureFermeture} onChange={(v) => majR("crHeureFermeture", v)} className={modif(modifieR("crHeureFermeture"))} />
                </Grille>
                <Interrupteur libelle="Ouvrir aussi le samedi" aide="Par défaut, lundi à vendredi." valeur={r.crSamedi} onChange={(v) => majR("crSamedi", v)} modifie={modifieR("crSamedi")} />
              </Bloc>
              <Bloc titre="Grand livre financier" description="Un membre qui saisit une journée la verrouille pour les autres.">
                <Grille>
                  <ChampNombre libelle="Expiration d'un verrou inactif" aide="Passé ce délai sans activité, un autre membre peut reprendre la journée." unite="min" valeur={r.verrouFinancierMin} onChange={(v) => majR("verrouFinancierMin", v)} className={modif(modifieR("verrouFinancierMin"))} />
                </Grille>
              </Bloc>
              <Bloc titre="Documents" description="Extraction automatique du titre, de la description et de la catégorie au dépôt.">
                <Interrupteur libelle="Extraction par IA" aide="Si ANTHROPIC_API_KEY est définie. Désactivé : repli heuristique (nom du fichier, mots-clés)." valeur={r.iaDocumentsActive} onChange={(v) => majR("iaDocumentsActive", v)} modifie={modifieR("iaDocumentsActive")} />
              </Bloc>
              <Bloc titre="Valeurs par défaut" description="Ce que vaut chaque réglage si vous n'y touchez pas.">
                <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-xs">
                  <dt className="text-encre-douce">Comptes rendus</dt><dd className="font-mono">{REGLAGES_DEFAUT.crHeureOuverture}h–{REGLAGES_DEFAUT.crHeureFermeture}h, lun–ven</dd>
                  <dt className="text-encre-douce">Verrou financier</dt><dd className="font-mono">{REGLAGES_DEFAUT.verrouFinancierMin} min</dd>
                  <dt className="text-encre-douce">Envoi réel · IA · PDF à la clôture</dt><dd className="font-mono">non · oui · non</dd>
                  <dt className="text-encre-douce">Jours de base · plafond</dt><dd className="font-mono">{REGLAGES_DEFAUT.joursBaseDefaut} j · {num(REGLAGES_DEFAUT.plafondSaisie)} FCFA</dd>
                </dl>
                <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => setR({ ...REGLAGES_DEFAUT })}><RotateCcwIcon /> Remettre les valeurs par défaut</Button>
              </Bloc>
            </TabsContent>
          </>
        )}

        {/* --- Rôles & accès --------------------------------------------------------------- */}
        <TabsContent value="roles">
          <div className="space-y-4">
            <Bloc titre="Rôles & accès" description="Qui voit et qui fait quoi, module par module. Un clic sur V (voir) ou F (faire) ; les changements partent avec « Enregistrer » et sont journalisés. Le serveur applique exactement ce tableau.">
              {dR ? <MatriceRoles valeur={dR} base={baseD} onChange={setDR} lectureSeule={!peutModifier} /> : <SqueletteTexte lignes={6} />}
            </Bloc>
            <Bloc titre="Exceptions par personne" description="Accorder ou retirer un droit à un membre précis, au-delà de ce que donne son rôle. S'enregistre membre par membre.">
              <ExceptionsParPersonne base={baseD} lectureSeule={!peutModifier} peutVoirMembres={!!me?.droits?.["/membres"]?.voir} />
            </Bloc>
          </div>
        </TabsContent>

        {/* --- Déploiement (super administrateur) -------------------------------------------- */}
        {superAdmin && (
          <TabsContent value="deploiement">
            <Bloc titre="État du déploiement" description="Quelles variables d'environnement sont définies et ce que leur absence implique. Les valeurs ne sont jamais affichées ni transmises au navigateur.">
              <EtatDeploiement />
            </Bloc>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

// --- Briques de mise en page ----------------------------------------------------------

const modif = (m: boolean) => (m ? "[&_input]:border-ocre [&_input]:bg-ocre/5 [&_textarea]:border-ocre [&_textarea]:bg-ocre/5" : "");
const Point = () => <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-ocre ring-2 ring-white/70" aria-label="modifications non enregistrées" />;

function Bloc({ titre, description, className, children }: { titre: string; description?: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={cn("flex flex-col overflow-hidden rounded-xl border border-filet bg-surface shadow-xs", className)}>
      <div className="flex items-start gap-3 border-b border-filet bg-papier/70 px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold leading-tight">{titre}</h2>
          {description && <p className="mt-0.5 text-2xs text-encre-douce">{description}</p>}
        </div>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}
function Grille({ children }: { children: React.ReactNode }) {
  return <div className="grid items-start gap-3 sm:grid-cols-2">{children}</div>;
}
function Interrupteur({ libelle, aide, valeur, onChange, modifie }: { libelle: string; aide?: string; valeur: boolean; onChange: (v: boolean) => void; modifie?: boolean }) {
  return (
    <label className={cn("mt-3 flex cursor-pointer items-center justify-between gap-4 rounded-lg border px-3 py-2.5 transition-colors", valeur ? "border-ocean-ciel bg-ocean-brume/40" : "border-filet bg-papier", modifie && "border-ocre bg-ocre/5")}>
      <span>
        <span className="block text-xs font-semibold">{libelle}</span>
        {aide && <span className="block text-2xs text-encre-pale">{aide}</span>}
      </span>
      <Switch checked={valeur} onCheckedChange={onChange} aria-label={libelle} />
    </label>
  );
}

// --- Rôles & accès -------------------------------------------------------------------
// Matrice rôle × module, deux cases par croisement : VOIR et FAIRE. Elle part des droits
// effectifs enregistrés (rbac.droitsEffectifs) ; ses changements partent avec « Enregistrer ».

type Matrice = Record<string, Cellule>; // clé `${role}|${module}`
const cleM = (r: Role, m: string) => `${r}|${m}`;
const matriceDe = (surcharges?: SurchargeRole[]): Matrice => {
  const out: Matrice = {};
  for (const r of ROLES_ORDONNES) {
    const d = droitsEffectifs(r, surcharges ?? []);
    for (const m of MODULES) out[cleM(r, m.cle)] = d[m.cle];
  }
  return out;
};
const memeCellule = (a?: Cellule, b?: Cellule) => !!a && !!b && a.voir === b.voir && a.faire === b.faire;
const libelleCellule = (c: Cellule) => (c.faire ? "voir + faire" : c.voir ? "voir" : "aucun");
const CATEGORIES_MODULES = Array.from(new Set(MODULES.map((m) => m.categorie)));
const roleCourt = (r: Role) => LIBELLE[r].replace(" (Admin)", "").replace(" (technique)", "").replace(" (DAF)", "");

/** Nouvelle cellule après un clic : « Faire » entraîne « Voir », retirer « Voir » retire « Faire ». */
function basculer(m: Module, c: Cellule, action: Action): Cellule {
  if (m.voir === null) return normaliser(m, { voir: !c.faire, faire: !c.faire });
  return normaliser(m, action === "voir" ? { voir: !c.voir, faire: c.voir ? false : c.faire } : { voir: c.faire ? c.voir : true, faire: !c.faire });
}

function CaseDroit({ actif, libelle, modifie, verrou, desactive, onClick, titre }: {
  actif: boolean; libelle: string; modifie?: boolean; verrou?: boolean; desactive?: boolean; onClick?: () => void; titre: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={actif}
      aria-label={titre}
      title={titre}
      disabled={desactive}
      onClick={onClick}
      className={cn(
        "h-6 min-w-7 rounded-md border px-1 text-2xs font-bold transition-colors",
        actif ? "border-ocean-profond bg-ocean-profond text-white" : "border-filet bg-white text-encre-pale hover:border-ocean-ciel hover:text-encre",
        verrou && "cursor-not-allowed opacity-60",
        desactive && !verrou && "cursor-default",
        modifie && "ring-2 ring-ocre ring-offset-1",
      )}
    >
      {libelle}
    </button>
  );
}

function MatriceRoles({ valeur, base, onChange, lectureSeule }: { valeur: Matrice; base: Matrice; onChange: (m: Matrice) => void; lectureSeule: boolean }) {
  const roles = ROLES_ORDONNES;
  const maj = (r: Role, m: Module, action: Action) => {
    const k = cleM(r, m.cle);
    onChange({ ...valeur, [k]: basculer(m, valeur[k], action) });
  };
  const defaut = React.useMemo(() => matriceDe(), []);
  const auDefaut = Object.keys(defaut).every((k) => memeCellule(defaut[k], valeur[k]));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-2xs text-encre-douce">
        <span className="flex items-center gap-1.5"><CaseDroit actif libelle="V" titre="Voir" desactive /> Voir : consulter le module</span>
        <span className="flex items-center gap-1.5"><CaseDroit actif libelle="F" titre="Faire" desactive /> Faire : saisir, valider, envoyer (entraîne Voir)</span>
        <span className="flex items-center gap-1.5"><CaseDroit actif={false} libelle="V" titre="Modifié" modifie desactive /> modifié, pas encore enregistré</span>
        <span className="flex items-center gap-1.5"><LockIcon className="h-3 w-3" /> garde-fou, non modifiable</span>
        {!lectureSeule && (
          <Button type="button" variant="outline" size="sm" className="ml-auto" disabled={auDefaut} onClick={() => onChange({ ...defaut })}>
            <RotateCcwIcon /> Revenir aux droits par défaut
          </Button>
        )}
      </div>
      <Table classNameConteneur="rounded-xl">
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[16rem]">Module</TableHead>
            {roles.map((r) => (
              <TableHead key={r} className="text-center" title={DESCRIPTION[r]}>
                <div className="text-2xs font-semibold leading-tight">{roleCourt(r)}</div>
                <div className="font-mono text-2xs font-normal opacity-80">{NIVEAU[r] ? `niv. ${NIVEAU[r]}` : "à part"}</div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {CATEGORIES_MODULES.map((cat) => (
            <React.Fragment key={cat}>
              <TableRow className="bg-ocean-brume/40 hover:bg-ocean-brume/40">
                <TableCell colSpan={roles.length + 1} className="py-1.5 text-2xs font-semibold uppercase tracking-wide text-ocean-nuit">{cat}</TableCell>
              </TableRow>
              {MODULES.filter((m) => m.categorie === cat).map((m) => (
                <TableRow key={m.cle}>
                  <TableCell className="text-xs">
                    <div className="font-semibold">{m.libelle}</div>
                    <div className="text-2xs text-encre-pale">
                      {m.voir && <>Voir : {m.voir}</>}{m.voir && m.faire && " · "}{m.faire && <>Faire : {m.faire}</>}
                    </div>
                  </TableCell>
                  {roles.map((r) => {
                    const k = cleM(r, m.cle);
                    const c = valeur[k];
                    const verrou = estVerrouille(r, m.cle);
                    const modifie = !memeCellule(c, base[k]);
                    const off = lectureSeule || verrou;
                    const qui = `${roleCourt(r)} · ${m.libelle}`;
                    return (
                      <TableCell key={r} className="text-center">
                        <div className="inline-flex items-center gap-1">
                          {m.voir !== null && <CaseDroit actif={c.voir} libelle="V" titre={`${qui} : voir${verrou ? " (garde-fou)" : ""}`} modifie={modifie} verrou={verrou} desactive={off} onClick={() => maj(r, m, "voir")} />}
                          {m.faire !== null && <CaseDroit actif={c.faire} libelle="F" titre={`${qui} : faire${verrou ? " (garde-fou)" : ""}`} modifie={modifie} verrou={verrou} desactive={off} onClick={() => maj(r, m, "faire")} />}
                          {verrou && <LockIcon className="h-3 w-3 text-encre-pale" aria-hidden />}
                        </div>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </React.Fragment>
          ))}
        </TableBody>
      </Table>
      <p className="text-2xs text-encre-pale">
        Garde-fous : le super administrateur garde tout ; le Directeur Général garde Paramètres et Membres. Nul n'attribue un rôle
        au-dessus du sien ni ne modifie un membre au-dessus de lui. Un document porte en plus son propre niveau de visibilité et de
        téléchargement, et éventuellement un code. Le tableau de bord est ouvert à tout membre autorisé ; la fiche API reste technique.
      </p>
    </div>
  );
}

// Exceptions par personne : accorder ou retirer un droit à un membre précis, au-delà de son rôle.
const REGLE_ROLE = "role";
type ChoixException = typeof REGLE_ROLE | "aucun" | "voir" | "faire";
const choixDe = (c?: Cellule): ChoixException => (!c ? REGLE_ROLE : c.faire ? "faire" : c.voir ? "voir" : "aucun");
const celluleDe = (x: Exclude<ChoixException, "role">): Cellule => ({ voir: x !== "aucun", faire: x === "faire" });

function ExceptionsParPersonne({ base, lectureSeule, peutVoirMembres }: { base: Matrice; lectureSeule: boolean; peutVoirMembres: boolean }) {
  const membres = useQuery(api.users.liste, peutVoirMembres ? {} : "skip");
  const modifier = useMutation(api.users.modifierDroitsPerso);
  const [membreId, setMembreId] = React.useState<string>("");
  const [brouillon, setBrouillon] = React.useState<Record<string, ChoixException>>({});
  const [enCours, setEnCours] = React.useState(false);
  const actifs = (membres ?? []).filter((u) => u.isActive && !u.enAttente && u.role !== "super_admin");
  const membre = actifs.find((u) => String(u._id) === membreId);
  const enregistre = React.useMemo(() => {
    const out: Record<string, ChoixException> = {};
    for (const e of (membre?.droitsPerso ?? []) as Exception[]) out[e.module] = choixDe(e);
    return out;
  }, [membre]);
  React.useEffect(() => { setBrouillon(enregistre); }, [enregistre]);

  if (!peutVoirMembres) return <p className="text-xs text-encre-pale">Les exceptions par personne demandent l'accès au module Membres.</p>;
  if (membres === undefined) return <SqueletteTexte lignes={3} />;

  const avecExceptions = actifs.filter((u) => (u.droitsPerso ?? []).length > 0);
  const modifs = MODULES.filter((m) => (brouillon[m.cle] ?? REGLE_ROLE) !== (enregistre[m.cle] ?? REGLE_ROLE)).length;
  const sauver = async () => {
    if (!membre) return;
    setEnCours(true);
    try {
      const droits = Object.entries(brouillon).filter(([, x]) => x !== REGLE_ROLE).map(([module, x]) => ({ module, ...celluleDe(x as Exclude<ChoixException, "role">) }));
      await modifier({ userId: membre._id, droits });
      toast.success("Droits particuliers enregistrés", { description: `${membre.nom ?? membre.email} · journalisé` });
    } catch (err) { toast.error("Enregistrement refusé", { description: messageErreur(err) }); }
    finally { setEnCours(false); }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[16rem]">
          <div className="mb-1 text-2xs font-semibold text-encre-douce">Membre</div>
          <Select value={membreId} onValueChange={setMembreId}>
            <SelectTrigger className="w-72"><SelectValue placeholder="Choisir un membre…" /></SelectTrigger>
            <SelectContent>
              {actifs.map((u) => (
                <SelectItem key={String(u._id)} value={String(u._id)}>
                  {u.nom ?? u.email} · {u.roleLibelle}{(u.droitsPerso ?? []).length ? " · exceptions" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {avecExceptions.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-2xs text-encre-douce">
            Membres avec exceptions :
            {avecExceptions.map((u) => (
              <button key={String(u._id)} type="button" onClick={() => setMembreId(String(u._id))} className="rounded-full border border-ocre/50 bg-ocre/10 px-2 py-0.5 font-semibold text-encre hover:bg-ocre/20">
                {u.nom ?? u.email} ({(u.droitsPerso ?? []).length})
              </button>
            ))}
          </div>
        )}
      </div>

      {membre && (
        <>
          <Table classNameConteneur="rounded-xl">
            <TableHeader>
              <TableRow>
                <TableHead>Module</TableHead>
                <TableHead>Par son rôle ({roleCourt(membre.role as Role)})</TableHead>
                <TableHead>Pour {membre.nom ?? membre.email}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MODULES.map((m) => {
                const parRole = base[cleM(membre.role as Role, m.cle)];
                const choix = brouillon[m.cle] ?? REGLE_ROLE;
                const verrou = estVerrouille(membre.role as Role, m.cle);
                const options: [ChoixException, string][] = [
                  [REGLE_ROLE, `Comme son rôle (${libelleCellule(parRole)})`],
                  ["aucun", "Aucun accès"],
                  ...(m.voir !== null ? [["voir", "Voir"] as [ChoixException, string]] : []),
                  ...(m.faire !== null ? [["faire", m.voir === null ? "Faire" : "Voir + faire"] as [ChoixException, string]] : []),
                ];
                const modifie = choix !== (enregistre[m.cle] ?? REGLE_ROLE);
                return (
                  <TableRow key={m.cle}>
                    <TableCell className="text-xs font-semibold">{m.libelle}</TableCell>
                    <TableCell className="text-xs text-encre-douce">{libelleCellule(parRole)}</TableCell>
                    <TableCell>
                      <Select value={choix} onValueChange={(x) => setBrouillon((b) => ({ ...b, [m.cle]: x as ChoixException }))} disabled={lectureSeule || verrou}>
                        <SelectTrigger size="sm" className={cn("w-60", choix !== REGLE_ROLE && "border-ocean-ciel bg-ocean-brume/40", modifie && "ring-2 ring-ocre")}><SelectValue /></SelectTrigger>
                        <SelectContent>{options.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {!lectureSeule && (
            <div className="flex flex-wrap items-center justify-end gap-2">
              {modifs > 0 && <span className="text-xs text-ocre">{modifs} modification(s) non enregistrée(s)</span>}
              <Button type="button" variant="outline" size="sm" disabled={enCours || !Object.values(brouillon).some((x) => x !== REGLE_ROLE)} onClick={() => setBrouillon({})}><RotateCcwIcon /> Tout ramener à son rôle</Button>
              <Button type="button" size="sm" disabled={enCours || !modifs} onClick={() => void sauver()}><SaveIcon /> Enregistrer les droits de {membre.nom ?? membre.email}</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// --- Déploiement ---------------------------------------------------------------------

function EtatDeploiement() {
  const etat = useQuery(api.parametres.etatDeploiement);
  if (etat === undefined) return <SqueletteTexte lignes={6} />;
  const manquantes = etat.variables.filter((v) => !v.definie && !v.sensible).length;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Flag variant="direct" size="xs">déploiement</Flag><span className="font-mono">{etat.deploiement ?? "—"}</span>
        <Flag variant="direct" size="xs">site</Flag><span className="font-mono">{etat.site ?? "—"}</span>
        {etat.bypassDev && <Flag variant="a-renseigner" size="xs">AUTH_DEV_BYPASS actif — à retirer avant diffusion</Flag>}
        {manquantes > 0 && <Flag variant="a-renseigner" size="xs">{manquantes} variable(s) non définie(s)</Flag>}
      </div>
      <Table classNameConteneur="rounded-xl">
        <TableHeader>
          <TableRow>
            <TableHead>Variable</TableHead>
            <TableHead>État</TableHead>
            <TableHead>Rôle</TableHead>
            <TableHead>Si absente</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {etat.variables.map((v) => (
            <TableRow key={v.cle} className={cn(v.sensible && v.definie && "bg-ocre/5")}>
              <TableCell className="font-mono text-xs">{v.cle}</TableCell>
              <TableCell>{v.definie ? <Flag variant={v.sensible ? "a-renseigner" : "renseigne"} size="xs">{v.sensible ? "active" : "définie"}</Flag> : <Flag variant="neutre" size="xs">non définie</Flag>}</TableCell>
              <TableCell className="text-xs">{v.role}</TableCell>
              <TableCell className="text-xs text-encre-douce">{v.absence}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="text-2xs text-encre-pale">Pour définir une variable : <code className="font-mono">npx convex env set NOM valeur</code> (depuis <code className="font-mono">app/</code>), puis redéployer si elle est lue par <code className="font-mono">auth.config.ts</code>.</p>
    </div>
  );
}

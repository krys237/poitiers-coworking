/**
 * Paramètres — refonte (charte poitiers-ui-ux-system).
 *
 * Tout ce qui se règle une fois et que l'utilisateur ne voit pas directement :
 *  - Entreprise & documents : identité qui apparaît sur bulletins, listes, PDF (avec aperçu) ;
 *  - Paie & congés : jour de paiement, congés acquis, visa RH, jours de base, plafond de saisie,
 *    PDF à la clôture ;
 *  - Courrier & e-mail : expéditeur, modèle de lettre, interrupteur d'envoi réel ;
 *  - Fonctionnement : fenêtre des comptes rendus, verrou financier, IA documents ;
 *  - Rôles & accès : la matrice qui dit ce que chaque rôle ouvre (lecture seule, dérivée de rbac.ts) ;
 *  - Déploiement (super administrateur) : variables d'environnement définies ou non, jamais leur valeur.
 *
 * Un seul bouton « Enregistrer » pour la page : les modifications de tous les onglets partent
 * ensemble, le compteur dit combien attendent. Niveau 7 ; l'onglet Déploiement exige le niveau 8.
 */
import * as React from "react";
import { useMutation, useQuery } from "convex/react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { BanknoteIcon, Building2Icon, CalculatorIcon, CheckIcon, ClockIcon, FileTextIcon, FolderOpenIcon, LandmarkIcon, MailIcon, MinusIcon, PaletteIcon, RotateCcwIcon, SaveIcon, ServerCogIcon, ShieldCheckIcon, XIcon } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { DESCRIPTION, DROITS, LIBELLE, NIVEAU, ROLES_ORDONNES, aLeDroit } from "../../convex/rbac";
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
  const [params, setParams] = useSearchParams();
  const ongletUrl = params.get("onglet") as Onglet | null;
  const onglet: Onglet = ongletUrl && ONGLETS.includes(ongletUrl) ? ongletUrl : "entreprise";
  const superAdmin = !!me && me.niveau >= 8;

  // Deux états locaux, initialisés depuis la base ; « dirty » = différent de ce qui est en base.
  const [e, setE] = React.useState<Entreprise | null>(null);
  const [r, setR] = React.useState<Reglages | null>(null);
  React.useEffect(() => { if (p !== undefined && e === null) { setE(entrepriseDe(p)); setR(reglagesDe(p?.reglages)); } }, [p, e]);
  const baseE = entrepriseDe(p);
  const baseR = reglagesDe(p?.reglages);
  const dirtyE = !!e && !memes(e, baseE);
  const dirtyR = !!r && !memes(r, baseR);
  const nbModifs = (e ? (Object.keys(e) as (keyof Entreprise)[]).filter((k) => e[k] !== baseE[k]).length : 0)
    + (r ? (Object.keys(r) as (keyof Reglages)[]).filter((k) => r[k] !== baseR[k]).length : 0);
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
      toast.success("Paramètres enregistrés", { description: `${nbModifs} modification(s) appliquée(s) — journalisées.` });
    } catch (err) { toast.error("Enregistrement refusé", { description: messageErreur(err) }); }
    finally { setEnCours(false); }
  };
  const annuler = () => { setE(baseE); setR(baseR); };

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
        <div className="rounded-2xl border border-filet bg-surface px-3.5 py-2 shadow-xs sm:py-2.5">
        <TabsList className="flex-wrap bg-transparent p-0">
          <TabsTrigger value="entreprise">Entreprise & documents{dirtyE && ["nom", "adresse", "niu", "numeroCnps", "logoUrl", "couleurEntete", "filigrane"].some((k) => modifieE(k as keyof Entreprise)) ? <Point /> : null}</TabsTrigger>
          <TabsTrigger value="paie">Paie & congés{(["responsableRH", "jourPaiement", "congesParMois"] as (keyof Entreprise)[]).some(modifieE) || (["joursBaseDefaut", "plafondSaisie", "pdfAutoCloture"] as (keyof Reglages)[]).some(modifieR) ? <Point /> : null}</TabsTrigger>
          <TabsTrigger value="courrier">Courrier & e-mail{(["emailExpediteur", "modeleCourrier"] as (keyof Entreprise)[]).some(modifieE) || modifieR("envoiReelActive") ? <Point /> : null}</TabsTrigger>
          <TabsTrigger value="fonctionnement">Fonctionnement{(["crHeureOuverture", "crHeureFermeture", "crSamedi", "verrouFinancierMin", "iaDocumentsActive"] as (keyof Reglages)[]).some(modifieR) ? <Point /> : null}</TabsTrigger>
          <TabsTrigger value="roles">Rôles & accès</TabsTrigger>
          {superAdmin && <TabsTrigger value="deploiement"><ServerCogIcon className="h-3.5 w-3.5" /> Déploiement</TabsTrigger>}
        </TabsList>
        </div>

        {!e || !r ? (
          <div className="mt-4"><SqueletteTexte lignes={6} /></div>
        ) : (
          <>
            {/* --- Entreprise & documents ------------------------------------------------ */}
            <TabsContent value="entreprise" className="grid gap-4 lg:grid-cols-[1fr_22rem]">
              <Bloc titre="Identité" icone={Building2Icon} description="Reprise en en-tête des bulletins, listes et PDF, et dans les courriers.">
                <Grille>
                  <Champ libelle="Raison sociale" requis className={modif(modifieE("nom"))}>{(a) => <Input {...a} value={e.nom} onChange={(x) => majE("nom", x.target.value)} />}</Champ>
                  <Champ libelle="Adresse" requis className={cn("sm:col-span-2", modif(modifieE("adresse")))}>{(a) => <Input {...a} value={e.adresse} onChange={(x) => majE("adresse", x.target.value)} />}</Champ>
                  <Champ libelle="NIU (entreprise)" aide="Numéro d'identifiant unique, bloc employeur du bulletin" className={modif(modifieE("niu"))}>{(a) => <Input {...a} value={e.niu} onChange={(x) => majE("niu", x.target.value)} placeholder="M0…" className="font-mono" />}</Champ>
                  <Champ libelle="N° CNPS employeur" className={modif(modifieE("numeroCnps"))}>{(a) => <Input {...a} value={e.numeroCnps} onChange={(x) => majE("numeroCnps", x.target.value)} className="font-mono" />}</Champ>
                </Grille>
              </Bloc>
              <Bloc titre="Aperçu de l'en-tête" icone={FileTextIcon} description="Tel qu'il apparaît sur un document imprimé." className="lg:row-span-2">
                <div className="rounded-lg bg-papier p-3"><div className="rounded border border-filet bg-white p-4 text-encre shadow-sm">
                  <div className="flex items-start gap-3 border-b-2 pb-3" style={{ borderColor: e.couleurEntete }}>
                    {e.logoUrl ? <img src={e.logoUrl} alt="" className="h-12 w-12 shrink-0 object-contain" /> : <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-filet-clair text-encre-pale"><Building2Icon className="h-6 w-6" /></div>}
                    <div className="min-w-0">
                      <div className="truncate text-base font-bold uppercase tracking-wide" style={{ color: e.couleurEntete }}>{e.nom || "Raison sociale"}</div>
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
              <Bloc titre="Apparence des documents" icone={PaletteIcon} description="Couleur de l'en-tête, logo, filigrane des PDF.">
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
              <Bloc titre="Bulletin & paiement" icone={BanknoteIcon} description="Mentions portées sur chaque bulletin.">
                <Grille>
                  <Champ libelle="Responsable RH (visa des bulletins)" className={cn("sm:col-span-2", modif(modifieE("responsableRH")))}>{(a) => <Input {...a} value={e.responsableRH} onChange={(x) => majE("responsableRH", x.target.value)} placeholder="Nom du signataire" />}</Champ>
                  <ChampNombre libelle="Jour de paiement (mois suivant)" aide="Mention du bulletin : « Paiement le N du mois suivant par banque »" unite="le" valeur={e.jourPaiement} onChange={(v) => majE("jourPaiement", v)} className={modif(modifieE("jourPaiement"))} />
                  <ChampNombre libelle="Congés acquis par mois de service" aide="Solde = initial + N × mois de service − congés pris" unite="j" decimales valeur={e.congesParMois} onChange={(v) => majE("congesParMois", v)} className={modif(modifieE("congesParMois"))} />
                </Grille>
              </Bloc>
              <Bloc titre="Calcul & garde-fous" icone={CalculatorIcon} description="Réglages du moteur de paie et de la saisie.">
                <Grille>
                  <ChampNombre libelle="Jours de base d'un nouvel employé" aide="Diviseur du salaire journalier (brut ÷ N). Les employés existants gardent le leur." unite="j" valeur={r.joursBaseDefaut} onChange={(v) => majR("joursBaseDefaut", v)} className={modif(modifieR("joursBaseDefaut"))} />
                  <ChampNombre libelle="Plafond de saisie mensuelle" aide="Au-delà, la saisie est refusée : protège des fautes de frappe." unite="FCFA" valeur={r.plafondSaisie} onChange={(v) => majR("plafondSaisie", v)} className={modif(modifieR("plafondSaisie"))} />
                </Grille>
                <Interrupteur libelle="Générer les PDF à la clôture" aide="Dès qu'un mois est clôturé, les bulletins figés sont rendus en PDF et archivés — sinon, à la demande depuis Archives." valeur={r.pdfAutoCloture} onChange={(v) => majR("pdfAutoCloture", v)} modifie={modifieR("pdfAutoCloture")} />
              </Bloc>
            </TabsContent>

            {/* --- Courrier & e-mail ---------------------------------------------------------- */}
            <TabsContent value="courrier" className="grid gap-4 lg:grid-cols-2">
              <Bloc titre="Expéditeur & envoi" icone={MailIcon} description="Le courrier de paie part par Resend ; sans clé ou sans l'interrupteur, il est simulé (journal seul).">
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
              <Bloc titre="Modèle de lettre" icone={FileTextIcon} description="Variables : {nom} {periode} {net} {entreprise}. Vide = modèle par défaut. Modifiable aussi depuis Courrier de paie.">
                <Champ libelle="Lettre d'accompagnement" className={modif(modifieE("modeleCourrier"))}>{(a) => <Textarea {...a} value={e.modeleCourrier} onChange={(x) => majE("modeleCourrier", x.target.value)} placeholder={MODELE_DEFAUT} rows={9} className="font-mono text-xs" />}</Champ>
                {e.modeleCourrier && <Button type="button" variant="ghost" size="sm" className="mt-1 text-2xs" onClick={() => majE("modeleCourrier", "")}>Revenir au modèle par défaut</Button>}
              </Bloc>
            </TabsContent>

            {/* --- Fonctionnement -------------------------------------------------------------- */}
            <TabsContent value="fonctionnement" className="grid gap-4 lg:grid-cols-2">
              <Bloc titre="Comptes rendus" icone={ClockIcon} description="Fenêtre de soumission (heure de Douala). Dans la fenêtre : 1 point ; hors fenêtre : accepté, 0 point.">
                <Grille>
                  <ChampNombre libelle="Ouverture" unite="h" valeur={r.crHeureOuverture} onChange={(v) => majR("crHeureOuverture", v)} className={modif(modifieR("crHeureOuverture"))} />
                  <ChampNombre libelle="Fermeture" aide="exclue" unite="h" valeur={r.crHeureFermeture} onChange={(v) => majR("crHeureFermeture", v)} className={modif(modifieR("crHeureFermeture"))} />
                </Grille>
                <Interrupteur libelle="Ouvrir aussi le samedi" aide="Par défaut, lundi à vendredi." valeur={r.crSamedi} onChange={(v) => majR("crSamedi", v)} modifie={modifieR("crSamedi")} />
              </Bloc>
              <Bloc titre="Grand livre financier" icone={LandmarkIcon} description="Un membre qui saisit une journée la verrouille pour les autres.">
                <Grille>
                  <ChampNombre libelle="Expiration d'un verrou inactif" aide="Passé ce délai sans activité, un autre membre peut reprendre la journée." unite="min" valeur={r.verrouFinancierMin} onChange={(v) => majR("verrouFinancierMin", v)} className={modif(modifieR("verrouFinancierMin"))} />
                </Grille>
              </Bloc>
              <Bloc titre="Documents" icone={FolderOpenIcon} description="Extraction automatique du titre, de la description et de la catégorie au dépôt.">
                <Interrupteur libelle="Extraction par IA" aide="Si ANTHROPIC_API_KEY est définie. Désactivé : repli heuristique (nom du fichier, mots-clés)." valeur={r.iaDocumentsActive} onChange={(v) => majR("iaDocumentsActive", v)} modifie={modifieR("iaDocumentsActive")} />
              </Bloc>
              <Bloc titre="Valeurs par défaut" icone={RotateCcwIcon} description="Ce que vaut chaque réglage si vous n'y touchez pas.">
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
          <Bloc titre="Rôles & accès" icone={ShieldCheckIcon} description="Ce que chaque rôle ouvre. Les niveaux sont cumulatifs ; l'auditeur externe est hors hiérarchie. Dérivé du code (convex/rbac.ts) : l'écran affiche exactement ce que le serveur applique.">
            <MatriceRoles />
          </Bloc>
        </TabsContent>

        {/* --- Déploiement (super administrateur) -------------------------------------------- */}
        {superAdmin && (
          <TabsContent value="deploiement">
            <Bloc titre="État du déploiement" icone={ServerCogIcon} description="Quelles variables d'environnement sont définies et ce que leur absence implique. Les valeurs ne sont jamais affichées ni transmises au navigateur.">
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
const Point = () => <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-ocre" aria-label="modifications non enregistrées" />;

function Bloc({ titre, description, icone: Icone, className, children }: { titre: string; description?: string; icone?: React.ComponentType<{ className?: string }>; className?: string; children: React.ReactNode }) {
  return (
    <section className={cn("flex flex-col overflow-hidden rounded-xl border border-filet bg-surface shadow-xs", className)}>
      <div className="flex items-start gap-3 border-b border-filet bg-papier/70 px-4 py-3">
        {Icone && <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-ocean-brume text-ocean-profond"><Icone className="h-4 w-4" /></span>}
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

function MatriceRoles() {
  const roles = ROLES_ORDONNES;
  const categories = Array.from(new Set(DROITS.map((d) => d.categorie)));
  return (
    <div className="space-y-4">
      <Table classNameConteneur="rounded-xl">
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[18rem]">Droit</TableHead>
            {roles.map((r) => (
              <TableHead key={r} className="text-center" title={DESCRIPTION[r]}>
                <div className="text-2xs font-semibold leading-tight">{LIBELLE[r].replace(" (Admin)", "").replace(" (technique)", "").replace(" (DAF)", "")}</div>
                <div className="font-mono text-2xs font-normal opacity-80">{NIVEAU[r] ? `niv. ${NIVEAU[r]}` : "à part"}</div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {categories.map((cat) => (
            <React.Fragment key={cat}>
              <TableRow className="bg-ocean-brume/40 hover:bg-ocean-brume/40">
                <TableCell colSpan={roles.length + 1} className="py-1.5 text-2xs font-semibold uppercase tracking-wide text-ocean-nuit">{cat}</TableCell>
              </TableRow>
              {DROITS.filter((d) => d.categorie === cat).map((d) => (
                <TableRow key={d.libelle}>
                  <TableCell className="text-xs">{d.libelle}{d.audit ? <span className="ml-1.5 text-2xs text-encre-pale">(cloisonné)</span> : null}<span className="ml-1.5 font-mono text-2xs text-encre-pale">≥ {d.niveau}</span></TableCell>
                  {roles.map((r) => {
                    const ok = aLeDroit(r, d);
                    return <TableCell key={r} className="text-center">{ok ? <CheckIcon className="mx-auto h-4 w-4 text-emerald-600" aria-label="oui" /> : <MinusIcon className="mx-auto h-3.5 w-3.5 text-encre-pale/50" aria-label="non" />}</TableCell>;
                  })}
                </TableRow>
              ))}
            </React.Fragment>
          ))}
        </TableBody>
      </Table>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {roles.map((r) => (
          <div key={r} className="rounded-lg border border-filet bg-papier p-3 shadow-[inset_3px_0_0_var(--ocean-profond)]">
            <div className="flex items-center justify-between gap-2 text-xs font-semibold"><span className="truncate">{LIBELLE[r]}</span><Flag variant={NIVEAU[r] ? "finance" : "verrou"} size="xs" className="shrink-0 font-mono">{NIVEAU[r] ? `niv. ${NIVEAU[r]}` : "à part"}</Flag></div>
            <div className="mt-1 text-2xs text-encre-douce">{DESCRIPTION[r]}</div>
          </div>
        ))}
      </div>
      <p className="text-2xs text-encre-pale">Règles transverses : nul n'attribue un rôle au-dessus du sien ni ne modifie un membre au-dessus de lui ; le dernier Directeur Général actif ne peut être ni désactivé ni rétrogradé ; les documents et lignes financières portent en plus leur propre niveau de visibilité, de téléchargement et un code d'accès.</p>
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

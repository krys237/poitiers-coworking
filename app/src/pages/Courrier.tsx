/**
 * Courrier de paie — refonte (charte poitiers-ui-ux-system).
 *
 * Le courrier = une lettre d'accompagnement + le bulletin, pour chaque employé
 * du mois. Il s'imprime (une page par personne) ou part en PDF par e-mail et/ou WhatsApp (UltraMsg), avec le PDF
 * (lettre + bulletin) en pièce jointe.
 *
 * Le parcours, dans l'ordre de la page : la période → le modèle de lettre
 * (partagé, à droite) → les destinataires (tous cochés par défaut, e-mail
 * corrigeable sur la ligne) → aperçu par employé → Imprimer ou Envoyer.
 * L'envoi est simulé tant que RESEND_API_KEY n'est pas défini sur le
 * déploiement ; l'écran le dit et le journal des envois garde la trace.
 */
import * as React from "react";
import { Link } from "react-router-dom";
import { useAction, useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { CheckIcon, EyeIcon, MailIcon, MailWarningIcon, SearchIcon, SendIcon } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { BulletinCard } from "../components/BulletinCard";
import { libellePeriode, messageErreur, num, periodeCourante } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageEnTete } from "@/components/app/en-tete";
import { GrilleTuiles, Tuile } from "@/components/app/tuile";
import { StatutMois } from "@/components/app/statut";
import { SelecteurPeriode } from "@/components/app/selecteur-periode";
import { BoutonConfirmation } from "@/components/app/bouton-action";
import { BoutonImprimer } from "@/components/app/imprimer";
import { SqueletteTableau } from "@/components/app/chargement";
import { SelecteurLignes, useLignesVisibles } from "@/components/app/lignes-visibles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Flag, type FlagVariant } from "@/components/ui/flag";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableVide } from "@/components/ui/table";
import { EnTeteDocument, Feuille } from "@/components/documents/feuille";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { erreurTelephone, formaterTelephone } from "../../convex/lib/telephone";
import { ChampTelephone } from "@/components/app/champ-telephone";

const STATUT: Record<string, { label: string; variant: FlagVariant }> = {
  envoye: { label: "Envoyé", variant: "renseigne" },
  simule: { label: "Simulé", variant: "a-renseigner" },
  echec: { label: "Échec", variant: "verrou" },
};
const VARIABLES = ["{nom}", "{periode}", "{net}", "{entreprise}"];
const fmtDateHeure = (s?: string) => (s ? new Date(s).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "—");
const sansAccents = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const emailValide = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

export function Courrier() {
  const [periode, setPeriode] = React.useState(periodeCourante());
  const apercu = useQuery(api.courrier.apercu, { periode });
  const mode = useQuery(api.courrier.mode);
  const journal = useQuery(api.courrier.journal, { periode });
  const envoyer = useAction(api.paiePdf.envoyerCourrier);
  const modifierEmploye = useMutation(api.employes.modifier);
  const modifierCourrier = useMutation(api.parametres.modifierCourrier);

  const lignesVisibles = useLignesVisibles("courrier", 15);
  const [onglet, setOnglet] = React.useState<"destinataires" | "journal">("destinataires");
  const [filtre, setFiltre] = React.useState<"tous" | "sans_email" | "non_envoyes" | "echecs">("tous");
  const [recherche, setRecherche] = React.useState("");
  const [selection, setSelection] = React.useState<Set<string>>(new Set());
  const [apercuDe, setApercuDe] = React.useState<string | null>(null);
  const [envoiEnCours, setEnvoiEnCours] = React.useState(false);
  // Canal d'envoi : e-mail (Resend), WhatsApp (UltraMsg) ou les deux — chacun réel ou simulé (courrier.mode).
  const [canal, setCanal] = React.useState<"email" | "whatsapp" | "les_deux">("email");
  const canaux = canal === "les_deux" ? (["email", "whatsapp"] as const) : ([canal] as const);
  const parEmail = canal !== "whatsapp", parWhatsapp = canal !== "email";
  const reelCanal = (parEmail ? !!mode?.reel : true) && (parWhatsapp ? !!mode?.whatsapp.reel : true);

  const lignes = (apercu?.lignes ?? []) as any[];
  const entreprise = apercu?.entreprise;
  // Par défaut tout le monde est destinataire quand la période change.
  React.useEffect(() => { if (apercu) setSelection(new Set(lignes.map((l) => String(l.bulletin.employeId)))); }, [periode, apercu?.lignes.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const q = sansAccents(recherche.trim());
  const visibles = lignes.filter((l) => {
    const b = l.bulletin, d = l.dernierEnvoi;
    const ok = filtre === "tous" || (filtre === "sans_email" ? !b.email : filtre === "non_envoyes" ? !(d && d.statut === "envoye") : d?.statut === "echec");
    return ok && (!q || sansAccents(`${b.nom} ${b.email ?? ""} ${b.societe}`).includes(q));
  });
  const selectionnees = lignes.filter((l) => selection.has(String(l.bulletin.employeId)));
  const sansEmail = lignes.filter((l) => !l.bulletin.email);
  const sansEmailSel = selectionnees.filter((l) => !l.bulletin.email).length;
  const sansWhatsappSel = selectionnees.filter((l) => !l.bulletin.whatsapp).length;
  const envoyes = lignes.filter((l) => l.dernierEnvoi?.statut === "envoye").length;
  const echecs = lignes.filter((l) => l.dernierEnvoi?.statut === "echec").length;
  const toutesVisiblesCochees = visibles.length > 0 && visibles.every((l) => selection.has(String(l.bulletin.employeId)));

  const toggle = (id: string) => setSelection((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const cocherVisibles = (on: boolean) => setSelection((s) => { const n = new Set(s); for (const l of visibles) { const id = String(l.bulletin.employeId); if (on) n.add(id); else n.delete(id); } return n; });

  const lancerEnvoi = async () => {
    setEnvoiEnCours(true);
    try {
      const r = await envoyer({ periode, employeIds: selectionnees.map((l) => l.bulletin.employeId), canaux: [...canaux] });
      // Une simulation ne doit jamais passer pour un envoi : on le dit en toutes lettres.
      const simulation = r.simules ? ` — ${r.simules} simulé(s) : RIEN n'est parti pour ceux-là (clé absente du déploiement ou interrupteur fermé)` : "";
      return `${r.envoyes} réellement envoyé(s), ${r.echecs} échec(s) sur ${r.total}${simulation} · PDF : ${Math.round(r.pdfOctets / 1024)} Ko`;
    } finally { setEnvoiEnCours(false); }
  };

  const ligneApercu = lignes.find((l) => String(l.bulletin.employeId) === apercuDe) ?? null;

  return (
    <div className="space-y-4">
      <PageEnTete
        titre="Courrier de paie"
        description="Pour chaque employé du mois, une lettre d'accompagnement et son bulletin : à imprimer (une page par personne) ou à envoyer en PDF par e-mail et/ou par WhatsApp. Le modèle de lettre est commun ; adresses et numéros se corrigent sur la ligne."
        statut={
          <>
            <StatutMois cloture={apercu === undefined ? undefined : apercu.cloture} />
            {mode ? (
              mode.reel
                ? <Flag variant="renseigne" size="sm" icon={<MailIcon className="h-3 w-3" />}>Envoi réel (Resend)</Flag>
                : <Flag variant="a-renseigner" size="sm" icon={<MailWarningIcon className="h-3 w-3" />} title={!mode.cleConfiguree ? "Aucune clé RESEND_API_KEY sur le déploiement : l'envoi est journalisé sans partir réellement." : "L'envoi réel est désactivé dans Paramètres → Fonctionnement : l'envoi est journalisé sans partir réellement."}>Mode simulation{mode.cleConfiguree ? " · envoi réel désactivé" : " · clé absente"}</Flag>
            ) : null}
            {mode ? (
              mode.whatsapp.reel
                ? <Flag variant="renseigne" size="sm">WhatsApp réel (UltraMsg)</Flag>
                : <Flag variant="a-renseigner" size="sm" title={!mode.whatsapp.cleConfiguree ? "Clés ULTRAMSG_INSTANCE_ID / ULTRAMSG_TOKEN absentes : l'envoi WhatsApp est journalisé sans partir." : "Interrupteur « WhatsApp réel » fermé (Paramètres → Courrier & e-mail)."}>WhatsApp simulé</Flag>
            ) : null}
          </>
        }
        actions={
          <>
            <Select value={canal} onValueChange={(v) => setCanal(v as typeof canal)}>
              <SelectTrigger size="sm" className="w-40" aria-label="Canal d'envoi"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Par e-mail</SelectItem>
                <SelectItem value="whatsapp">Par WhatsApp</SelectItem>
                <SelectItem value="les_deux">E-mail et WhatsApp</SelectItem>
              </SelectContent>
            </Select>
            <BoutonImprimer entreprise={entreprise?.nom ?? "POITIERS COWORKING"} document="Courrier de paie" periode={libellePeriode(periode)} desactive={!selectionnees.length}>
              Imprimer {selectionnees.length ? `(${selectionnees.length})` : ""}
            </BoutonImprimer>
            <BoutonConfirmation
              variant="default"
              size="sm"
              disabled={!selectionnees.length || envoiEnCours || !!apercu?.erreur}
              libelle={<><SendIcon /> {envoiEnCours ? "Envoi…" : `${reelCanal ? "Envoyer" : "Simuler l'envoi"} (${selectionnees.length})`}</>}
              titre={reelCanal ? `Envoyer réellement le courrier de ${libellePeriode(periode)} ?` : `Envoyer le courrier de ${libellePeriode(periode)} (simulation incluse) ?`}
              consequence={
                <>
                  {selectionnees.length} destinataire(s) recevront la lettre et leur bulletin en PDF
                  {parEmail && parWhatsapp ? " par e-mail et par WhatsApp" : parWhatsapp ? " par WhatsApp" : " par e-mail"}.
                  {parEmail && !mode?.reel ? " E-mail en simulation : rien ne part, le journal est alimenté." : null}
                  {parWhatsapp && !mode?.whatsapp.reel ? " WhatsApp en simulation : rien ne part, le journal est alimenté." : null}
                  {parEmail && sansEmailSel ? <> <b>{sansEmailSel} n'ont pas d'adresse e-mail</b> et seront comptés en échec.</> : null}
                  {parWhatsapp && sansWhatsappSel ? <> <b>{sansWhatsappSel} n'ont pas de numéro WhatsApp</b> et seront comptés en échec.</> : null}
                  {!apercu?.cloture ? <> Le mois n'est pas clôturé : les bulletins envoyés sont provisoires.</> : null}
                </>
              }
              confirmer={reelCanal ? "Envoyer" : "Envoyer (simulation)"}
              onConfirmer={lancerEnvoi}
              succes={(r: any) => `Courrier de ${libellePeriode(periode)} — ${r}`}
            />
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-filet bg-surface px-3 py-2 shadow-xs print:hidden">
        <SelecteurPeriode valeur={periode} onChange={setPeriode} />
        <span className="text-sm font-semibold">{libellePeriode(periode)}</span>
        <span className="hidden h-6 w-px bg-filet sm:block" aria-hidden="true" />
        {onglet === "destinataires" && (
          <div role="tablist" aria-label="Filtre" className="flex items-center gap-1 rounded-xl border border-filet bg-slate-100/80 p-1">
            {([["tous", "Tous", lignes.length], ["sans_email", "Sans e-mail", sansEmail.length], ["non_envoyes", "Non envoyés", lignes.length - envoyes], ["echecs", "Échecs", echecs]] as [typeof filtre, string, number][]).map(([k, l, n]) => (
              <button key={k} role="tab" aria-selected={filtre === k} onClick={() => setFiltre(k)}
                className={cn("inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors", filtre === k ? "bg-ocean-profond text-white shadow-xs" : "text-encre-douce hover:bg-white hover:text-encre")}>
                {l}<span className={cn("font-mono text-[10px] tabular-nums", filtre === k ? "text-white/80" : "text-encre-pale")}>{n}</span>
              </button>
            ))}
          </div>
        )}
        <span className="flex-1" />
        <SelecteurLignes valeur={lignesVisibles.lignes} onChange={lignesVisibles.setLignes} />
        <div className="relative w-52">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-encre-pale" aria-hidden="true" />
          <Input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Nom, e-mail…" aria-label="Rechercher" className="h-8 pl-8" />
        </div>
        <Tabs value={onglet} onValueChange={(v) => setOnglet(v as typeof onglet)}>
          <TabsList>
            <TabsTrigger value="destinataires">Destinataires</TabsTrigger>
            <TabsTrigger value="journal">Journal des envois{journal ? ` (${journal.length})` : ""}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <GrilleTuiles className="print:hidden">
        <Tuile libelle="Destinataires sélectionnés" valeur={apercu ? `${selectionnees.length} / ${lignes.length}` : undefined} note="cochés dans la liste" vedette />
        <Tuile libelle="Sans adresse e-mail" valeur={apercu ? sansEmail.length : undefined} note={sansEmail.length ? "à compléter sur la ligne avant envoi" : "toutes les adresses sont renseignées"} />
        <Tuile libelle="Envoyés ce mois" valeur={apercu ? envoyes : undefined} note="dernier envoi réussi par employé" />
        <Tuile libelle="Échecs" valeur={apercu ? echecs : undefined} note={echecs ? "voir le motif dans la colonne Dernier envoi" : "aucun échec"} />
      </GrilleTuiles>

      {apercu?.erreur && <p className="text-sm font-medium text-carmin print:hidden">{apercu.erreur}</p>}

      {onglet === "destinataires" ? (
        <div className="flex flex-col gap-3.5 print:hidden lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1">
            {apercu === undefined ? (
              <SqueletteTableau colonnes={7} lignes={8} />
            ) : (
              <Table classNameConteneur="rounded-xl" hauteurMax={lignesVisibles.hauteurMax(49, 40, 0)}>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"><Checkbox checked={toutesVisiblesCochees} onCheckedChange={(v) => cocherVisibles(!!v)} aria-label="Sélectionner les lignes affichées" className="border-white/70 data-[state=checked]:bg-white data-[state=checked]:text-ocean-profond" /></TableHead>
                    <TableHead>Employé</TableHead>
                    <TableHead>Adresse e-mail</TableHead>
                    <TableHead>WhatsApp</TableHead>
                    <TableHead numerique>Net (FCFA)</TableHead>
                    <TableHead>Dernier envoi</TableHead>
                    <TableHead aria-label="Aperçu" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibles.map((l) => {
                    const b = l.bulletin, id = String(b.employeId), d = l.dernierEnvoi;
                    return (
                      <TableRow key={id}>
                        <TableCell><Checkbox checked={selection.has(id)} onCheckedChange={() => toggle(id)} aria-label={`Sélectionner ${b.nom}`} /></TableCell>
                        <TableCell className="leading-tight">
                          <div className="whitespace-nowrap text-[13px] font-semibold">{b.nom}</div>
                          <div className="whitespace-nowrap text-2xs text-encre-pale">{b.matricule} · {b.societe}</div>
                        </TableCell>
                        <TableCell>
                          <CelluleEmail
                            valeur={b.email ?? ""}
                            libelle={`Adresse e-mail — ${b.nom}`}
                            onEnregistrer={async (email) => { await modifierEmploye({ employeId: b.employeId, email }); toast.success(`Adresse enregistrée — ${b.nom}`); }}
                          />
                        </TableCell>
                        <TableCell>
                          <CelluleWhatsapp
                            valeur={b.whatsapp ?? ""}
                            libelle={`Numéro WhatsApp — ${b.nom}`}
                            onEnregistrer={async (whatsapp) => { await modifierEmploye({ employeId: b.employeId, whatsapp }); toast.success(`Numéro WhatsApp enregistré — ${b.nom}`); }}
                          />
                        </TableCell>
                        <TableCell numerique className="font-mono text-xs font-semibold">{num(b.net)}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {d ? (
                            <span className="inline-flex items-center gap-1.5">
                              <Flag variant={STATUT[d.statut].variant} size="xs" title={d.erreur ?? d.email}>{STATUT[d.statut].label}</Flag>
                              <span className="font-mono text-2xs tabular-nums text-encre-pale">{fmtDateHeure(d.envoyeLe)}</span>
                              {d.erreur ? <span className="max-w-[12rem] truncate text-2xs text-carmin" title={d.erreur}>{d.erreur}</span> : null}
                            </span>
                          ) : <span className="text-2xs text-encre-pale">jamais envoyé</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon-sm" aria-label={`Aperçu du courrier — ${b.nom}`} title="Aperçu lettre + bulletin" onClick={() => setApercuDe(id)}><EyeIcon /></Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {visibles.length === 0 && <TableVide colonnes={7}>{q || filtre !== "tous" ? "Aucun employé ne correspond aux filtres." : "Aucun employé actif pour ce mois."}</TableVide>}
                </TableBody>
              </Table>
            )}
          </div>

          <aside className="flex w-full flex-col gap-3.5 lg:w-[23rem] lg:shrink-0">
            <ModeleLettre modele={apercu?.modele} onEnregistrer={async (m) => { await modifierCourrier({ modeleCourrier: m }); toast.success("Modèle de lettre enregistré", { description: "Appliqué à tous les courriers à venir" }); }} />
            <section className="rounded-xl border border-filet bg-surface px-4 py-3 text-xs text-encre-douce">
              <div className="mb-1 text-2xs font-bold uppercase tracking-[0.08em] text-ocean-profond">Expéditeur</div>
              <div className="font-mono text-xs text-encre">{entreprise?.emailExpediteur || "onboarding@resend.dev"}</div>
              <div className="mt-1 text-2xs text-encre-pale">{entreprise?.emailExpediteur ? "Configuré dans Paramètres." : <>Adresse par défaut — à configurer dans <Link to="/parametres" className="text-ocean-profond hover:underline">Paramètres</Link> sur un domaine vérifié.</>}</div>
            </section>
          </aside>
        </div>
      ) : (
        <div className="print:hidden">
          {journal === undefined ? (
            <SqueletteTableau colonnes={5} lignes={6} />
          ) : (
            <Table classNameConteneur="rounded-xl" hauteurMax={lignesVisibles.hauteurMax(41, 40, 0)}>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Employé</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Adresse</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Résultat</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(journal as any[]).map((e) => {
                  const nom = lignes.find((l) => String(l.bulletin.employeId) === String(e.employeId))?.bulletin.nom ?? "—";
                  return (
                    <TableRow key={String(e._id)}>
                      <TableCell className="whitespace-nowrap font-mono text-xs tabular-nums">{fmtDateHeure(e.envoyeLe)}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs font-semibold">{nom}</TableCell>
                      <TableCell><Flag variant="neutre" size="xs">{e.canal === "whatsapp" ? "WhatsApp" : "e-mail"}</Flag></TableCell>
                      <TableCell className="font-mono text-xs">{e.email ? (e.canal === "whatsapp" ? formaterTelephone(e.email) : e.email) : <span className="text-encre-pale">—</span>}</TableCell>
                      <TableCell>{e.mode === "reel" ? <Flag variant="renseigne" size="xs">réel</Flag> : <Flag variant="neutre" size="xs">simulation</Flag>}</TableCell>
                      <TableCell className="whitespace-nowrap"><Flag variant={STATUT[e.statut].variant} size="xs">{STATUT[e.statut].label}</Flag>{e.erreur ? <span className="ml-2 text-2xs text-carmin">{e.erreur}</span> : null}{e.messageId ? <span className="ml-2 font-mono text-2xs text-encre-pale">{e.messageId}</span> : null}</TableCell>
                    </TableRow>
                  );
                })}
                {journal.length === 0 && <TableVide colonnes={5}>Aucun envoi enregistré pour {libellePeriode(periode)}.</TableVide>}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      {/* Aperçu d'un courrier : la lettre puis le bulletin, tels qu'imprimés */}
      <Dialog open={ligneApercu !== null} onOpenChange={(o) => { if (!o) setApercuDe(null); }}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
          {ligneApercu && (
            <>
              <DialogHeader>
                <DialogTitle>Courrier de {ligneApercu.bulletin.nom} — {libellePeriode(periode)}</DialogTitle>
                <DialogDescription>Ce que l'employé reçoit : la lettre (page 1) puis son bulletin (page 2), en PDF ou sur papier.</DialogDescription>
              </DialogHeader>
              <div className="mt-2 flex flex-col gap-4">
                <Lettre entreprise={entreprise} periode={periode} texte={ligneApercu.lettre} />
                <BulletinCard b={ligneApercu.bulletin} entreprise={entreprise} />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Impression : lettre + bulletin par destinataire sélectionné */}
      <div className="hidden print:block">
        {selectionnees.map((l) => (
          <React.Fragment key={String(l.bulletin.employeId)}>
            <Lettre entreprise={entreprise} periode={periode} texte={l.lettre} />
            <BulletinCard b={l.bulletin} entreprise={entreprise} />
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// --- Lettre d'accompagnement (feuille A4) ------------------------------------------

function Lettre({ entreprise, periode, texte }: { entreprise: any; periode: string; texte: string }) {
  return (
    <Feuille>
      <EnTeteDocument
        raisonSociale={entreprise?.nom ?? "POITIERS COWORKING"}
        coordonnees={entreprise?.adresse}
        nature="Courrier de paie"
        periode={libellePeriode(periode)}
      />
      <div className="whitespace-pre-line text-[11pt] leading-[1.7]">{texte}</div>
    </Feuille>
  );
}

// --- Modèle de lettre (partagé) ----------------------------------------------------

function ModeleLettre({ modele, onEnregistrer }: { modele: string | undefined; onEnregistrer: (m: string) => Promise<void> }) {
  const [texte, setTexte] = React.useState(modele ?? "");
  const [sale, setSale] = React.useState(false);
  const [enCours, setEnCours] = React.useState(false);
  const zone = React.useRef<HTMLTextAreaElement>(null);
  React.useEffect(() => { if (!sale && modele !== undefined) setTexte(modele); }, [modele, sale]);
  const inserer = (v: string) => {
    const el = zone.current;
    if (!el) { setTexte((t) => t + v); setSale(true); return; }
    const [a, b] = [el.selectionStart, el.selectionEnd];
    const t = texte.slice(0, a) + v + texte.slice(b);
    setTexte(t); setSale(true);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(a + v.length, a + v.length); });
  };
  return (
    <section className="rounded-xl border border-filet bg-surface">
      <div className="border-b border-filet px-4 py-3">
        <div className="text-sm font-semibold">Modèle de lettre</div>
        <div className="text-2xs text-encre-pale">Commun à tous les employés ; les variables sont remplacées à l'impression et à l'envoi.</div>
      </div>
      <div className="flex flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center gap-1">
          <span className="mr-1 text-2xs text-encre-pale">Insérer :</span>
          {VARIABLES.map((v) => (
            <button key={v} type="button" onClick={() => inserer(v)} className="rounded-md border border-filet bg-papier px-1.5 py-0.5 font-mono text-2xs text-ocean-profond hover:border-ocean-ceruleen" title={`Insérer ${v} à la position du curseur`}>{v}</button>
          ))}
        </div>
        <Textarea ref={zone} rows={9} value={texte} onChange={(e) => { setTexte(e.target.value); setSale(true); }} aria-label="Modèle de lettre" className="text-sm leading-relaxed" />
        <div className="flex items-center justify-between gap-2">
          <span className="text-2xs text-encre-pale">{sale ? "Modifications non enregistrées" : "À jour"}</span>
          <div className="flex gap-2">
            {sale && <Button variant="outline" size="sm" onClick={() => { setSale(false); setTexte(modele ?? ""); }}>Annuler</Button>}
            <Button size="sm" disabled={!sale || enCours} onClick={async () => { setEnCours(true); try { await onEnregistrer(texte); setSale(false); } catch (e) { toast.error("Modèle non enregistré", { description: messageErreur(e) }); } finally { setEnCours(false); } }}><CheckIcon /> Enregistrer le modèle</Button>
          </div>
        </div>
      </div>
    </section>
  );
}

// --- Adresse e-mail modifiable sur la ligne ---------------------------------------

function CelluleEmail({ valeur, libelle, onEnregistrer }: { valeur: string; libelle: string; onEnregistrer: (email: string) => Promise<void> }) {
  const [texte, setTexte] = React.useState(valeur);
  React.useEffect(() => setTexte(valeur), [valeur]);
  const commit = async () => {
    const v = texte.trim();
    if (v === (valeur ?? "")) return;
    if (v && !emailValide(v)) { toast.error("Adresse e-mail invalide"); setTexte(valeur); return; }
    try { await onEnregistrer(v); } catch (e) { toast.error("Adresse non enregistrée", { description: messageErreur(e) }); setTexte(valeur); }
  };
  return (
    <Input
      type="email"
      value={texte}
      onChange={(e) => setTexte(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur(); if (e.key === "Escape") setTexte(valeur); }}
      placeholder="adresse@domaine.com"
      aria-label={libelle}
      className={cn("h-8 w-52 font-mono text-xs", !valeur && "border-dashed border-amber-300 bg-amber-50/40 placeholder:text-amber-800/70")}
    />
  );
}

// Numéro WhatsApp corrigeable sur la ligne : indicatif pré-rempli (+237) comme partout, on ne tape que le
// numéro ; enregistré en quittant la case (ou Entrée), vide = effacer.
function CelluleWhatsapp({ valeur, libelle, onEnregistrer }: { valeur: string; libelle: string; onEnregistrer: (numero: string) => Promise<void> }) {
  const [numero, setNumero] = React.useState(valeur);
  const [cle, setCle] = React.useState(0); // pour remettre le champ à la valeur enregistrée après un refus
  React.useEffect(() => setNumero(valeur), [valeur]);
  const commit = async () => {
    if ((numero ?? "") === (valeur ?? "")) return;
    const err = numero ? erreurTelephone(numero) : null;
    if (err) { toast.error("Numéro WhatsApp incomplet", { description: err }); setNumero(valeur); setCle((k) => k + 1); return; }
    try { await onEnregistrer(numero); } catch (e) { toast.error("Numéro non enregistré", { description: messageErreur(e) }); setNumero(valeur); setCle((k) => k + 1); }
  };
  return (
    <div
      className={cn("w-52", !valeur && "[&_input]:border-dashed")}
      // Quitter tout le champ (indicatif + numéro) déclenche l'enregistrement ; passer de l'un à l'autre, non.
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) void commit(); }}
    >
      <ChampTelephone
        key={cle}
        valeur={numero}
        onChange={setNumero}
        taille="sm"
        ariaLabel={libelle}
        placeholder="6 90 00 00 00"
        onKeyDown={(e) => { if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur(); if (e.key === "Escape") { setNumero(valeur); setCle((k) => k + 1); } }}
      />
    </div>
  );
}

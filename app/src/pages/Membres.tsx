/**
 * Membres — refonte (charte poitiers-ui-ux-system). Réservé au DG (niveau 7).
 *
 * Les comptes de la plateforme : qui a accès, à quel niveau (1 à 7, cumulatifs ;
 * l'auditeur externe est à part). Deux chemins d'entrée :
 *  - le DG pré-provisionne un membre par e-mail avec son rôle : à sa première
 *    connexion avec cette adresse, le compte reprend ce rôle ;
 *  - une inscription spontanée crée un compte « en attente » sans aucun droit,
 *    que le DG autorise ici en lui donnant un rôle.
 *
 * Saisie en série (skill §7) : ligne permanente de pré-provisionnement en tête
 * du tableau (au choix) ; la fiche complète (rôle, poste, société, code d'accès,
 * activation) s'ouvre sur la ligne. Garde-fou serveur : jamais le dernier DG
 * actif désactivé ou rétrogradé.
 */
import * as React from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { CheckIcon, KeyRoundIcon, PlusIcon, SearchIcon, ShieldCheckIcon, UserRoundPenIcon, UserRoundPlusIcon } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { LIBELLE, NIVEAU, type Role } from "../../convex/rbac";
import { messageErreur } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageEnTete } from "@/components/app/en-tete";
import { GrilleTuiles, Tuile } from "@/components/app/tuile";
import { Champ } from "@/components/app/champs";
import { SqueletteTableau } from "@/components/app/chargement";
import { BoutonConfirmation } from "@/components/app/bouton-action";
import { BoutonPersistance, useSaisiePersistante } from "@/components/app/saisie-persistante";
import { SelecteurLignes, useLignesVisibles } from "@/components/app/lignes-visibles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Flag, type FlagVariant } from "@/components/ui/flag";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableVide } from "@/components/ui/table";

// --- Vocabulaire ----------------------------------------------------------------

const ROLES = Object.keys(LIBELLE) as Role[];
const SOCIETES = ["SESAME", "SOFINA", "SGC"] as const;
const AUCUNE = "__aucune__";
/** Libellé de rôle avec son niveau : « Niv. 4 · Gestionnaire RH ». */
const libelleRole = (r: Role) => (NIVEAU[r] ? `Niv. ${NIVEAU[r]} · ${LIBELLE[r]}` : `${LIBELLE[r]} · hors hiérarchie`);
const ORIGINE: Record<string, { label: string; variant: FlagVariant; aide: string }> = {
  attente: { label: "En attente d'autorisation", variant: "a-renseigner", aide: "S'est inscrit sans être pré-provisionné : aucun droit tant que le DG n'a pas autorisé." },
  compte: { label: "Compte actif", variant: "renseigne", aide: "Compte rattaché à son identité de connexion." },
  pending: { label: "Pré-provisionné", variant: "direct", aide: "Créé par le DG ; reprendra son rôle à sa première connexion avec cet e-mail." },
  demo: { label: "Démo", variant: "neutre", aide: "Jeu de données de démonstration." },
  dev: { label: "Dev", variant: "verrou", aide: "Compte du mode développement (AUTH_DEV_BYPASS)." },
  autre: { label: "Autre", variant: "neutre", aide: "" },
};

type Fiche = { userId: string | null; email: string; nom: string; role: Role; poste: string; departement: string; societe: string; codeAcces: string; isActive: boolean; enAttente: boolean };
const sansAccents = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// --- Page -------------------------------------------------------------------------

export function Membres() {
  const membres = useQuery(api.users.liste);
  const me = useQuery(api.users.me);
  const modifier = useMutation(api.users.modifier);
  const creer = useMutation(api.users.creer);

  const [persistant, setPersistant] = useSaisiePersistante("membres", false);
  const lignesVisibles = useLignesVisibles("membres", 15);
  const [etat, setEtat] = React.useState<"actifs" | "attente" | "inactifs" | "tous">("tous");
  const [role, setRole] = React.useState<Role | "tous">("tous");
  const [recherche, setRecherche] = React.useState("");
  const [fiche, setFiche] = React.useState<Fiche | null>(null);

  const tous = (membres ?? []) as any[];
  const enAttente = tous.filter((m) => m.enAttente);
  const actifs = tous.filter((m) => m.isActive && !m.enAttente);
  const dgActifs = tous.filter((m) => m.role === "dg" && m.isActive).length;
  const q = sansAccents(recherche.trim());
  const liste = tous.filter((m) =>
    (etat === "tous" || (etat === "attente" ? m.enAttente : etat === "actifs" ? m.isActive && !m.enAttente : !m.isActive && !m.enAttente)) &&
    (role === "tous" || m.role === role) &&
    (!q || sansAccents(`${m.nom ?? ""} ${m.email} ${m.poste ?? ""} ${m.departement ?? ""}`).includes(q))
  );

  const ouvrir = (m: any, autoriser = false): Fiche => ({
    userId: String(m._id), email: m.email, nom: m.nom ?? "", role: m.role, poste: m.poste ?? "", departement: m.departement ?? "",
    societe: m.societe ?? "", codeAcces: "", isActive: autoriser ? true : !!m.isActive, enAttente: !!m.enAttente,
  });
  const nouvelle = (): Fiche => ({ userId: null, email: "", nom: "", role: "employe", poste: "", departement: "", societe: "", codeAcces: "", isActive: true, enAttente: false });

  const enregistrer = async (f: Fiche) => {
    if (f.userId) {
      await modifier({ userId: f.userId as any, role: f.role, nom: f.nom || undefined, poste: f.poste || undefined, departement: f.departement || undefined, societe: (f.societe || undefined) as any, codeAcces: f.codeAcces || undefined, isActive: f.isActive });
      toast.success(f.enAttente && f.isActive ? `Accès accordé à ${f.nom || f.email}` : `Membre ${f.nom || f.email} mis à jour`, { description: libelleRole(f.role) });
    } else {
      await creer({ email: f.email.trim(), nom: f.nom || undefined, role: f.role, poste: f.poste || undefined, departement: f.departement || undefined, societe: (f.societe || undefined) as any, codeAcces: f.codeAcces || undefined });
      toast.success(`Membre ${f.email.trim()} pré-provisionné`, { description: `${libelleRole(f.role)} · reprendra ce rôle à sa première connexion` });
    }
  };

  return (
    <div className="space-y-4">
      <PageEnTete
        titre="Membres & accès"
        description="Les comptes de la plateforme et leur niveau d'accès (1 à 7, cumulatifs ; l'auditeur externe est à part). Un membre pré-provisionné par e-mail reprend son rôle à sa première connexion ; une inscription spontanée attend votre autorisation."
        statut={<Flag variant="verrou" size="sm" icon={<ShieldCheckIcon className="h-3 w-3" />}>Directeur Général</Flag>}
        actions={
          <>
            {!persistant ? <Button size="sm" onClick={() => setFiche(nouvelle())}><UserRoundPlusIcon /> Nouveau membre</Button> : null}
            <BoutonPersistance actif={persistant} onChange={setPersistant} />
          </>
        }
      />

      <GrilleTuiles>
        <Tuile libelle="Comptes actifs" valeur={membres ? actifs.length : undefined} note={membres ? `${tous.filter((m) => !m.isActive && !m.enAttente).length} désactivé(s)` : undefined} vedette />
        <Tuile libelle="En attente d'autorisation" valeur={membres ? enAttente.length : undefined} note={enAttente.length ? "à autoriser ci-dessous" : "aucune inscription en attente"} />
        <Tuile libelle="Directeurs Généraux actifs" valeur={membres ? dgActifs : undefined} note={dgActifs <= 1 ? "le dernier DG ne peut être ni désactivé ni rétrogradé" : "garde-fou : au moins un doit rester actif"} />
        <Tuile libelle="Pré-provisionnés" valeur={membres ? tous.filter((m) => m.origine === "pending").length : undefined} note="en attente de première connexion" />
      </GrilleTuiles>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-filet bg-surface px-3 py-2 shadow-xs print:hidden">
        <div role="tablist" aria-label="État" className="flex items-center gap-1 rounded-xl border border-filet bg-slate-100/80 p-1">
          {([["tous", "Tous", tous.length], ["actifs", "Actifs", actifs.length], ["attente", "En attente", enAttente.length], ["inactifs", "Désactivés", tous.filter((m) => !m.isActive && !m.enAttente).length]] as [typeof etat, string, number][]).map(([k, l, n]) => (
            <button key={k} role="tab" aria-selected={etat === k} onClick={() => setEtat(k)}
              className={cn("inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors", etat === k ? "bg-ocean-profond text-white shadow-xs" : "text-encre-douce hover:bg-white hover:text-encre", k === "attente" && n > 0 && etat !== k && "text-amber-800")}>
              {l}<span className={cn("font-mono text-[10px] tabular-nums", etat === k ? "text-white/80" : "text-encre-pale")}>{n}</span>
            </button>
          ))}
        </div>
        <Select value={role} onValueChange={(v) => setRole(v as Role | "tous")}>
          <SelectTrigger size="sm" className="w-56" aria-label="Rôle"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="tous">Tous les rôles</SelectItem>
            {ROLES.map((r) => <SelectItem key={r} value={r}>{libelleRole(r)}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="flex-1" />
        <SelecteurLignes valeur={lignesVisibles.lignes} onChange={lignesVisibles.setLignes} />
        <div className="relative w-56">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-encre-pale" aria-hidden="true" />
          <Input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Nom, e-mail, poste…" aria-label="Rechercher un membre" className="h-8 pl-8" />
        </div>
      </div>

      {membres === undefined ? (
        <SqueletteTableau colonnes={7} lignes={8} />
      ) : (
        <Table classNameConteneur="rounded-xl" hauteurMax={lignesVisibles.hauteurMax(49, 40, 0)}>
          <TableHeader>
            <TableRow>
              <TableHead>Membre</TableHead>
              <TableHead>Rôle · niveau d'accès</TableHead>
              <TableHead>Poste · département</TableHead>
              <TableHead>Société</TableHead>
              <TableHead>Origine du compte</TableHead>
              <TableHead>État</TableHead>
              <TableHead aria-label="Actions" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {persistant && (
              <LigneSaisie onEnregistrer={async (f) => { await enregistrer(f); }} />
            )}
            {liste.map((m) => {
              const o = ORIGINE[m.origine] ?? ORIGINE.autre;
              const moi = me && String(me._id) === String(m._id);
              return (
                <TableRow key={String(m._id)} className={cn("cursor-pointer", !m.isActive && !m.enAttente && "opacity-60")} onClick={() => setFiche(ouvrir(m))}>
                  <TableCell className="leading-tight">
                    <div className="flex items-center gap-1.5 whitespace-nowrap text-[13px] font-semibold">{m.nom || <span className="text-encre-pale">(sans nom)</span>}{moi ? <Flag variant="saisie-active" size="xs">vous</Flag> : null}</div>
                    <div className="whitespace-nowrap font-mono text-2xs text-encre-pale">{m.email}</div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <span className="text-xs font-semibold">{m.roleLibelle}</span>
                    <span className="ml-1.5 font-mono text-2xs text-encre-pale">{m.niveau ? `niv. ${m.niveau}` : "hors hiérarchie"}</span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-encre-douce">{m.poste || <span className="text-encre-pale">—</span>}{m.departement ? <span className="text-encre-pale"> · {m.departement}</span> : null}</TableCell>
                  <TableCell>{m.societe ? <Flag variant="neutre" size="xs">{m.societe}</Flag> : <span className="text-encre-pale">—</span>}</TableCell>
                  <TableCell><Flag variant={o.variant} size="xs" title={o.aide}>{o.label}</Flag></TableCell>
                  <TableCell>{m.enAttente ? <Flag variant="a-renseigner" size="xs">à autoriser</Flag> : m.isActive ? <Flag variant="renseigne" size="xs">Actif</Flag> : <Flag variant="verrou" size="xs">Désactivé</Flag>}</TableCell>
                  <TableCell className="whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      {m.enAttente ? (
                        <Button size="sm" className="h-7 text-2xs" onClick={() => setFiche(ouvrir(m, true))}><CheckIcon /> Autoriser</Button>
                      ) : null}
                      <Button variant="ghost" size="icon-sm" aria-label={`Fiche — ${m.nom ?? m.email}`} title="Fiche du membre (rôle, poste, société, code d'accès, activation)" onClick={() => setFiche(ouvrir(m))}><UserRoundPenIcon /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {liste.length === 0 && <TableVide colonnes={7}>{q || etat !== "tous" || role !== "tous" ? "Aucun membre ne correspond aux filtres." : "Aucun membre."}</TableVide>}
          </TableBody>
        </Table>
      )}

      {/* Fiche membre : création (pré-provisionnement), modification, autorisation */}
      <Dialog open={fiche !== null} onOpenChange={(o) => { if (!o) setFiche(null); }}>
        <DialogContent className="sm:max-w-xl">
          {fiche && (
            <FormFiche
              fiche={fiche}
              estMoi={!!(me && fiche.userId && String(me._id) === fiche.userId)}
              dernierDg={dgActifs <= 1 && fiche.role === "dg" && fiche.isActive}
              onFermer={() => setFiche(null)}
              onEnregistrer={async (f) => { await enregistrer(f); setFiche(null); }}
              onDesactiver={async () => { await modifier({ userId: fiche.userId as any, isActive: false }); setFiche(null); }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- Fiche membre ------------------------------------------------------------------

function FormFiche({ fiche, estMoi, dernierDg, onFermer, onEnregistrer, onDesactiver }: {
  fiche: Fiche; estMoi: boolean; dernierDg: boolean; onFermer: () => void; onEnregistrer: (f: Fiche) => Promise<void>; onDesactiver: () => Promise<void>;
}) {
  const [f, setF] = React.useState(fiche);
  const [enCours, setEnCours] = React.useState(false);
  const creation = !f.userId;
  const autorisation = fiche.enAttente && fiche.isActive;
  const texte = (cle: keyof Fiche, libelle: string, placeholder?: string, requis?: boolean, type = "text") => (
    <Champ libelle={libelle} requis={requis}>{(a) => <Input {...a} type={type} required={requis} placeholder={placeholder} value={f[cle] as string} onChange={(e) => setF({ ...f, [cle]: e.target.value })} />}</Champ>
  );
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (creation && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) { toast.error("Adresse e-mail invalide."); return; }
        setEnCours(true);
        try { await onEnregistrer(f); } catch (err) { toast.error("Enregistrement refusé", { description: messageErreur(err) }); } finally { setEnCours(false); }
      }}
    >
      <DialogHeader>
        <DialogTitle>{creation ? "Nouveau membre" : autorisation ? `Autoriser ${fiche.nom || fiche.email}` : `Fiche membre — ${fiche.nom || fiche.email}`}</DialogTitle>
        <DialogDescription>
          {creation
            ? "Le membre est créé avec son rôle avant toute connexion : à sa première connexion avec cet e-mail, son compte reprend ce rôle."
            : autorisation
              ? "Ce compte s'est inscrit sans être pré-provisionné : il n'a aucun droit. Choisissez son rôle et enregistrez pour lui ouvrir l'accès."
              : `${fiche.email} · le rôle fixe le niveau d'accès (1 à 7, cumulatifs).`}
        </DialogDescription>
      </DialogHeader>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {creation ? <div className="col-span-2">{texte("email", "E-mail", "prenom.nom@domaine.com", true, "email")}</div> : null}
        {texte("nom", "Nom")}
        <Champ libelle="Rôle · niveau d'accès" requis>
          {(a) => (
            <Select value={f.role} onValueChange={(v) => setF({ ...f, role: v as Role })}>
              <SelectTrigger id={a.id} className="w-full" aria-label="Rôle"><SelectValue /></SelectTrigger>
              <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{libelleRole(r)}</SelectItem>)}</SelectContent>
            </Select>
          )}
        </Champ>
        {texte("poste", "Poste", "Caissier, Infirmière…")}
        {texte("departement", "Département", "Accueil, Laboratoire…")}
        <Champ libelle="Société" aide="Segmente paie et exports">
          {(a) => (
            <Select value={f.societe || AUCUNE} onValueChange={(v) => setF({ ...f, societe: v === AUCUNE ? "" : v })}>
              <SelectTrigger id={a.id} className="w-full" aria-label="Société"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value={AUCUNE}>— aucune —</SelectItem>{SOCIETES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          )}
        </Champ>
        <Champ libelle="Code d'accès personnel" aide={creation ? "Optionnel" : "Laisser vide pour ne pas le changer"}>
          {(a) => (
            <div className="relative">
              <KeyRoundIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-encre-pale" aria-hidden="true" />
              <Input {...a} type="password" autoComplete="new-password" value={f.codeAcces} onChange={(e) => setF({ ...f, codeAcces: e.target.value })} placeholder="••••••" className="pl-8" />
            </div>
          )}
        </Champ>
        {!creation ? (
          <div className="col-span-2 flex items-center justify-between rounded-lg border border-filet bg-papier px-3 py-2">
            <div>
              <div className="text-xs font-semibold">{f.isActive ? "Compte actif" : "Compte désactivé"}</div>
              <div className="text-2xs text-encre-pale">{autorisation ? "L'enregistrement ouvre l'accès." : f.isActive ? "Le membre peut se connecter avec ses droits." : "Bloqué dès la connexion, la fiche est conservée."}</div>
            </div>
            {!autorisation ? (
              f.isActive ? (
                <BoutonConfirmation
                  variant="outline" size="sm" className="text-carmin hover:bg-carmin-clair hover:text-carmin"
                  disabled={estMoi || dernierDg}
                  libelle="Désactiver"
                  titre={`Désactiver ${fiche.nom || fiche.email} ?`}
                  consequence="Le membre ne pourra plus se connecter. Sa fiche et son historique sont conservés ; réactivable ici."
                  confirmer="Désactiver"
                  onConfirmer={onDesactiver}
                  succes="Compte désactivé"
                />
              ) : (
                <Button type="button" variant="outline" size="sm" onClick={() => setF({ ...f, isActive: true })}>Réactiver à l'enregistrement</Button>
              )
            ) : null}
          </div>
        ) : null}
        {(estMoi || dernierDg) && !creation ? <p className="col-span-2 text-2xs text-encre-pale">{estMoi ? "Vous ne pouvez pas désactiver votre propre compte. " : ""}{dernierDg ? "Dernier Directeur Général actif : ni désactivation ni rétrogradation possible." : ""}</p> : null}
      </div>
      <DialogFooter className="mt-5">
        <Button type="button" variant="outline" onClick={onFermer} disabled={enCours}>Annuler</Button>
        <Button type="submit" disabled={enCours}>{creation ? "Pré-provisionner" : autorisation ? <><CheckIcon /> Accorder l'accès</> : "Enregistrer"}</Button>
      </DialogFooter>
    </form>
  );
}

// --- Ligne de saisie permanente : pré-provisionnement en série (skill §7) ----------

const CS = "bg-ocean-brume/40 align-middle";

function LigneSaisie({ onEnregistrer }: { onEnregistrer: (f: Fiche) => Promise<void> }) {
  const vierge = (): Fiche => ({ userId: null, email: "", nom: "", role: "employe", poste: "", departement: "", societe: "", codeAcces: "", isActive: true, enAttente: false });
  const [f, setF] = React.useState<Fiche>(vierge);
  const [enCours, setEnCours] = React.useState(false);
  const premier = React.useRef<HTMLInputElement>(null);
  const vider = () => { setF(vierge()); premier.current?.focus(); };
  const valider = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) { toast.error("Adresse e-mail invalide."); premier.current?.focus(); return; }
    setEnCours(true);
    try { await onEnregistrer(f); setF({ ...vierge(), role: f.role, societe: f.societe, departement: f.departement }); premier.current?.focus(); }
    catch (e) { toast.error("Membre non créé", { description: messageErreur(e) }); }
    finally { setEnCours(false); }
  };
  const k = (e: React.KeyboardEvent) => { if (e.key === "Enter") { e.preventDefault(); void valider(); } if (e.key === "Escape") { e.preventDefault(); vider(); } };
  return (
    <TableRow className={CS} aria-label="Pré-provisionner un membre">
      <TableCell className={CS}>
        <div className="flex flex-col gap-1">
          <Input ref={premier} type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} onKeyDown={k} placeholder="prenom.nom@domaine.com" aria-label="E-mail (nouveau membre)" className="h-8 w-56 text-xs" />
          <Input value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} onKeyDown={k} placeholder="Nom (optionnel)" aria-label="Nom (nouveau membre)" className="h-8 w-56 text-xs" />
        </div>
      </TableCell>
      <TableCell className={CS}>
        <Select value={f.role} onValueChange={(v) => setF({ ...f, role: v as Role })}>
          <SelectTrigger size="sm" className="h-8 w-52 text-xs" aria-label="Rôle (nouveau membre)"><SelectValue /></SelectTrigger>
          <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{libelleRole(r)}</SelectItem>)}</SelectContent>
        </Select>
      </TableCell>
      <TableCell className={CS}>
        <div className="flex flex-col gap-1">
          <Input value={f.poste} onChange={(e) => setF({ ...f, poste: e.target.value })} onKeyDown={k} placeholder="Poste" aria-label="Poste (nouveau membre)" className="h-8 w-36 text-xs" />
          <Input value={f.departement} onChange={(e) => setF({ ...f, departement: e.target.value })} onKeyDown={k} placeholder="Département" aria-label="Département (nouveau membre)" className="h-8 w-36 text-xs" />
        </div>
      </TableCell>
      <TableCell className={CS}>
        <Select value={f.societe || AUCUNE} onValueChange={(v) => setF({ ...f, societe: v === AUCUNE ? "" : v })}>
          <SelectTrigger size="sm" className="h-8 w-24 text-xs" aria-label="Société (nouveau membre)"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value={AUCUNE}>—</SelectItem>{SOCIETES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
      </TableCell>
      <TableCell className={cn(CS, "text-2xs text-encre-pale")} colSpan={2}>Pré-provisionné : reprendra son rôle à sa première connexion</TableCell>
      <TableCell className={cn(CS, "text-right")}>
        <Button size="icon-sm" onClick={() => void valider()} disabled={enCours} aria-label="Pré-provisionner le membre" title="Ajouter (Entrée) · vider (Échap)"><PlusIcon /></Button>
      </TableCell>
    </TableRow>
  );
}

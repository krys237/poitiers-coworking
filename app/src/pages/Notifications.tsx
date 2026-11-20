// Écran « Mes notifications » (`/notifications`) :
//   - Onglet Historique (lot S2) : pagination par curseur, filtres, tableau à défilement interne.
//   - Onglet Préférences (lots S2 & S4) : mise en silence par type + activation Push PWA + guide iOS.
//   - Onglet Mes rappels (lot S7) : pense-bêtes personnels avec ligne de saisie permanente.

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { Bell, CheckCheck, Smartphone, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { TYPES, type Importance } from "../../convex/lib/notifications";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Flag } from "@/components/ui/flag";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableVide,
} from "@/components/ui/table";
import { EtatVide } from "@/components/app/etat-vide";
import { SelecteurLignes, useLignesVisibles } from "@/components/app/lignes-visibles";
import { flagImportance, tempsRelatif } from "@/components/app/cloche-notifications";
import {
  decrireAppareil,
  estIosSansPwa,
  lireEtatPermissionPush,
  obtenirJetonPush,
  type EtatPermissionPush,
} from "@/lib/push";
import { cn } from "@/lib/utils";

type Onglet = "historique" | "preferences" | "rappels";

export function Notifications() {
  const [onglet, setOnglet] = useState<Onglet>("historique");

  return (
    <div className="space-y-5">
      {/* Contrôle segmenté aligné sur Parametres.tsx */}
      <div className="inline-flex flex-wrap rounded-lg border border-filet bg-surface p-1 shadow-2xs">
        {(
          [
            { id: "historique", label: "Historique" },
            { id: "preferences", label: "Préférences" },
            { id: "rappels", label: "Mes rappels" },
          ] as { id: Onglet; label: string }[]
        ).map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => setOnglet(o.id)}
            className={cn(
              "rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors",
              onglet === o.id
                ? "bg-ocean-profond text-white shadow-xs"
                : "text-encre-douce hover:text-encre",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>

      {onglet === "historique" && <OngletHistorique />}
      {onglet === "preferences" && <OngletPreferences />}
      {onglet === "rappels" && <OngletRappels />}
    </div>
  );
}

function OngletHistorique() {
  const navigate = useNavigate();
  const [curseur, setCurseur] = useState<string | undefined>(undefined);
  const [pages, setPages] = useState<any[]>([]);
  const [nonLuesSeules, setNonLuesSeules] = useState(false);
  const [filtreImportance, setFiltreImportance] = useState<string>("toutes");
  const [filtreType, setFiltreType] = useState<string>("tous");
  const { lignes: nbLignes, setLignes, hauteurMax } = useLignesVisibles("notifications", 15);

  const pageCourante = useQuery(api.notifications.historique, { limite: 30, avant: curseur });
  const marquerLue = useMutation(api.notifications.marquerLue);
  const marquerToutesLues = useMutation(api.notifications.marquerToutesLues);

  const silencieuses = new Set(pageCourante?.silencieuses ?? []);
  const lignesCumulees = curseur ? [...pages, ...(pageCourante?.lignes ?? [])] : (pageCourante?.lignes ?? []);

  const filtrees = lignesCumulees.filter((n) => {
    if (nonLuesSeules && n.lu) return false;
    if (filtreImportance !== "toutes" && n.importance !== filtreImportance) return false;
    if (filtreType !== "tous" && n.type !== filtreType) return false;
    return true;
  });

  function chargerPlus() {
    if (!pageCourante?.suivant) return;
    setPages(lignesCumulees);
    setCurseur(pageCourante.suivant);
  }

  function ouvrir(id: Id<"notifications">, lien: string, lu: boolean) {
    if (!lu) void marquerLue({ notificationId: id });
    navigate(lien);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-filet bg-surface p-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-medium text-encre">
            <Checkbox
              checked={nonLuesSeules}
              onCheckedChange={(v) => setNonLuesSeules(Boolean(v))}
            />
            Non lues seulement
          </label>

          <Select value={filtreImportance} onValueChange={setFiltreImportance}>
            <SelectTrigger size="sm" className="w-36 text-xs">
              <SelectValue placeholder="Importance" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="toutes">Toutes importances</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
              <SelectItem value="a_traiter">À traiter</SelectItem>
              <SelectItem value="info">Info</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filtreType} onValueChange={setFiltreType}>
            <SelectTrigger size="sm" className="w-56 text-xs">
              <SelectValue placeholder="Type d'événement" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tous">Tous les types</SelectItem>
              {TYPES.map((t) => (
                <SelectItem key={t.cle} value={t.cle}>
                  {t.libelle}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => void marquerToutesLues({})}
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Tout marquer comme lu
          </Button>
          <SelecteurLignes valeur={nbLignes} onChange={setLignes} />
        </div>
      </div>

      <Table hauteurMax={hauteurMax(46)}>
        <TableHeader>
          <TableRow>
            <TableHead figee className="min-w-[220px]">Notification</TableHead>
            <TableHead className="w-28">Importance</TableHead>
            <TableHead className="min-w-[200px]">Détail</TableHead>
            <TableHead className="w-36">Acteur</TableHead>
            <TableHead className="w-32" numerique>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtrees.length === 0 ? (
            <TableVide colonnes={5}>Aucune notification pour ces filtres.</TableVide>
          ) : (
            filtrees.map((n) => {
              const imp = flagImportance(n.importance as Importance);
              return (
                <TableRow
                  key={n._id}
                  onClick={() => ouvrir(n._id, n.lien, n.lu)}
                  className={cn("cursor-pointer", n.lu && "opacity-60")}
                >
                  <TableCell figee className="font-medium text-encre">
                    <div className="flex flex-wrap items-center gap-2">
                      <span>{n.titre}</span>
                      {silencieuses.has(n.type) && (
                        <Flag variant="neutre" size="xs">
                          type mis en silence
                        </Flag>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Flag variant={imp.variant} size="xs">
                      {imp.label}
                    </Flag>
                  </TableCell>
                  <TableCell className="max-w-[320px] truncate text-xs text-encre-douce">
                    {n.corps ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs text-encre-douce">
                    {n.acteurNom ?? "—"}
                  </TableCell>
                  <TableCell numerique className="font-mono text-xs text-encre-pale">
                    {tempsRelatif(n.creeLe)}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      {pageCourante?.suivant && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={chargerPlus}>
            Charger plus
          </Button>
        </div>
      )}
    </div>
  );
}

function OngletPreferences() {
  const prefs = useQuery(api.notifications.mesPreferences);
  const appareils = useQuery(api.appareils.mesAppareils);
  const regler = useMutation(api.notifications.reglerPreferences);
  const enregistrerAppareil = useMutation(api.appareils.enregistrer);
  const oublierAppareil = useMutation(api.appareils.oublier);

  const [permission, setPermission] = useState<EtatPermissionPush>(() => lireEtatPermissionPush());
  const [activationEnCours, setActivationEnCours] = useState(false);
  const iosSansPwa = estIosSansPwa();
  const silencieuses = new Set(prefs?.silencieuses ?? []);

  // Rafraîchit silencieusement le jeton FCM si la permission est déjà accordée (S4 §5).
  useEffect(() => {
    if (permission !== "granted") return;
    void (async () => {
      const res = await obtenirJetonPush(false);
      if (res.ok && res.jeton) {
        const info = decrireAppareil();
        await enregistrerAppareil({ jeton: res.jeton, ...info });
      }
    })();
  }, [permission, enregistrerAppareil]);

  async function basculerType(cle: string, recevoir: boolean) {
    const suivant = new Set(silencieuses);
    if (recevoir) suivant.delete(cle);
    else suivant.add(cle);
    try {
      await regler({ silencieux: [...suivant] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur de sauvegarde.");
    }
  }

  async function activerPush() {
    setActivationEnCours(true);
    try {
      const res = await obtenirJetonPush(true);
      setPermission(res.permission);
      if (res.ok && res.jeton) {
        const info = decrireAppareil();
        await enregistrerAppareil({ jeton: res.jeton, ...info });
        toast.success("Notifications système activées sur cet appareil.");
      } else if (res.erreur) {
        toast.error(res.erreur);
      }
    } finally {
      setActivationEnCours(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Bloc Push système (lot S4) */}
      <div className="rounded-lg border border-filet bg-surface p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-ocean-profond" />
            <h2 className="text-sm font-semibold text-encre">
              Notifications système sur cet appareil (PWA)
            </h2>
          </div>

          {permission === "non_configure" ? (
            <Flag variant="neutre" size="sm">Notifications système non configurées</Flag>
          ) : permission === "non_supporte" ? (
            <Flag variant="neutre" size="sm">Non pris en charge par ce navigateur</Flag>
          ) : permission === "granted" ? (
            <Flag variant="renseigne" size="sm">Activées sur cet appareil</Flag>
          ) : permission === "denied" ? (
            <Flag variant="om" size="sm">Bloquées dans le navigateur</Flag>
          ) : (
            <Button size="sm" disabled={activationEnCours || iosSansPwa} onClick={() => void activerPush()}>
              Activer les notifications sur cet appareil
            </Button>
          )}
        </div>

        {iosSansPwa && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
            Sur iPhone/iPad, les notifications push exigent que la plateforme soit installée sur
            l&apos;écran d&apos;accueil : touchez <strong>Partager</strong> puis{" "}
            <strong>Sur l&apos;écran d&apos;accueil</strong>, et rouvrez l&apos;application depuis son icône.
          </div>
        )}

        {permission === "denied" && (
          <p className="text-xs text-encre-douce">
            Vous avez refusé les notifications pour ce site. Pour les réactiver, autorisez-les dans
            les réglages de votre navigateur puis rechargez la page.
          </p>
        )}

        {(appareils?.length ?? 0) > 0 && (
          <div className="divide-y divide-filet-clair rounded-md border border-filet">
            {appareils!.map((app) => (
              <div key={app._id} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                <div>
                  <div className="font-medium text-encre">{app.libelle ?? "Appareil enregistré"}</div>
                  <div className="font-mono text-[11px] text-encre-pale">
                    Vu {tempsRelatif(app.vuLe)}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 text-xs text-encre-douce hover:text-carmin"
                  onClick={() => void oublierAppareil({ jeton: app.jeton })}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Ne plus recevoir ici
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bloc préférences par type (lot S2 §6) */}
      <div className="rounded-lg border border-filet bg-surface p-4 space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-encre">Préférences par type d&apos;événement</h2>
          <p className="text-xs text-encre-douce">
            Mettre un type en silence le masque du badge et coupe WhatsApp/push, tout en conservant
            la trace dans votre historique.
          </p>
        </div>

        <div className="divide-y divide-filet-clair rounded-md border border-filet">
          {TYPES.map((t) => {
            const actif = !silencieuses.has(t.cle);
            const imp = flagImportance(t.importance);
            return (
              <div key={t.cle} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                <div className="min-w-0 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-encre">{t.libelle}</span>
                    <Flag variant={imp.variant} size="xs">{imp.label}</Flag>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-encre-pale">
                    {actif ? "Recevoir" : "En silence"}
                  </span>
                  <Switch
                    checked={actif}
                    onCheckedChange={(v) => void basculerType(t.cle, v)}
                    aria-label={t.libelle}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function OngletRappels() {
  const rappels = useQuery(api.penseBetes.miens);
  const creer = useMutation(api.penseBetes.creer);
  const annuler = useMutation(api.penseBetes.annuler);
  const navigate = useNavigate();

  const [texte, setTexte] = useState("");
  const [date, setDate] = useState(() => {
    const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 10);
  });
  const [heure, setHeure] = useState("09:00");
  const champTexteRef = useRef<HTMLInputElement>(null);

  async function ajouter(e: React.FormEvent) {
    e.preventDefault();
    if (!texte.trim()) return;
    try {
      const echeance = new Date(`${date}T${heure}`).toISOString();
      await creer({ texte: texte.trim(), echeance });
      setTexte("");
      champTexteRef.current?.focus();
      toast.success("Pense-bête ajouté.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible d'ajouter le pense-bête.");
    }
  }

  return (
    <div className="space-y-4">
      {/* Ligne de saisie permanente (spec S7 §5) : Entrée valide et remet le focus au 1er champ. */}
      <form
        onSubmit={ajouter}
        className="flex flex-wrap items-end gap-2 rounded-lg border border-filet bg-surface p-3"
      >
        <div className="min-w-[220px] flex-1">
          <label className="mb-1 block text-[11px] font-medium text-encre-douce" htmlFor="pb-rapide">
            Nouveau pense-bête
          </label>
          <Input
            id="pb-rapide"
            ref={champTexteRef}
            placeholder="Ex. Relancer le fournisseur mardi…"
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            maxLength={500}
            required
          />
        </div>
        <div className="w-36">
          <label className="mb-1 block text-[11px] font-medium text-encre-douce" htmlFor="pb-date">
            Date
          </label>
          <Input id="pb-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div className="w-28">
          <label className="mb-1 block text-[11px] font-medium text-encre-douce" htmlFor="pb-heure">
            Heure
          </label>
          <Input id="pb-heure" type="time" value={heure} onChange={(e) => setHeure(e.target.value)} required />
        </div>
        <Button type="submit" size="sm">
          Ajouter
        </Button>
      </form>

      {(rappels?.length ?? 0) === 0 ? (
        <EtatVide icone={Bell} compact titre="Aucun pense-bête">
          Ajoutez un rappel daté ci-dessus ou depuis le détail d&apos;une commande ou d&apos;une intervention.
        </EtatVide>
      ) : (
        <div className="divide-y divide-filet-clair rounded-lg border border-filet bg-surface">
          {rappels!.map((pb) => (
            <div
              key={pb._id}
              className={cn(
                "flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs",
                pb.etat !== "en_attente" && "opacity-60",
              )}
            >
              <div className="min-w-0 space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-encre">{pb.texte}</span>
                  <Flag
                    variant={
                      pb.etat === "en_attente"
                        ? "a-renseigner"
                        : pb.etat === "declenche"
                          ? "renseigne"
                          : "neutre"
                    }
                    size="xs"
                  >
                    {pb.etat === "en_attente"
                      ? "En attente"
                      : pb.etat === "declenche"
                        ? "Déclenché"
                        : "Annulé"}
                  </Flag>
                </div>
                <div className="flex items-center gap-3 font-mono text-[11px] text-encre-pale">
                  <span>{pb.echeance.slice(0, 16).replace("T", " ")}</span>
                  {pb.objet?.reference && pb.lien && (
                    <button
                      type="button"
                      onClick={() => navigate(pb.lien!)}
                      className="text-ocean-profond underline-offset-2 hover:underline"
                    >
                      {pb.objet.reference}
                    </button>
                  )}
                </div>
              </div>
              {pb.etat === "en_attente" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-encre-douce hover:text-carmin"
                  onClick={() => void annuler({ penseBeteId: pb._id })}
                >
                  Annuler
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

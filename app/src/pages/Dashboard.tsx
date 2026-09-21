import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { fcfa, libellePeriode, periodeCourante, messageErreur } from "../lib/format";
import { Tuile } from "@/components/app/tuile";
import { Barres } from "@/components/app/barres";
import { Statut } from "@/components/app/statut";
import { Avis } from "@/components/app/avis";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ArrowUpRight,
  TrendingUp,
  FileCheck2,
  CalendarCheck,
  ShieldCheck,
  Users,
  Coins,
  Bell,
  CheckCircle2,
  AlertTriangle,
  X,
} from "lucide-react";

/**
 * Illustration vectorielle de la bannière d'accueil :
 * Plante verte en pot et pile de trois registres (bleu océan, doré, bleu roi),
 * avec nuage doux et oiseaux, directement inspirée de la référence visuelle.
 */
function BanniereIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 340 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Nuage doux en arrière-plan */}
      <path
        d="M230 75C230 68 235 63 242 63C244 58 249 54 256 54C264 54 270 59 271 66C275 66 279 69 279 74C279 79 275 83 270 83H238C233.5 83 230 79.5 230 75Z"
        fill="#DCEBFA"
        fillOpacity="0.8"
      />

      {/* Petits oiseaux stylisés en vol */}
      <path
        d="M305 28C307 26 309 27 311 29C313 27 315 26 317 28"
        stroke="#3B82F6"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M318 38C319.5 36.5 321 37.2 322.5 38.8C324 37.2 325.5 36.5 327 38"
        stroke="#60A5FA"
        strokeWidth="1.3"
        strokeLinecap="round"
      />

      {/* Ombre du pot de plante */}
      <ellipse cx="148" cy="103" rx="18" ry="3" fill="#BFDBFE" fillOpacity="0.6" />
      <path
        d="M136 78H160L156 102H140L136 78Z"
        fill="#FFFFFF"
        stroke="#CBD5E1"
        strokeWidth="1.5"
      />
      <path d="M134 76H162V79H134V76Z" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1" rx="1.5" />

      {/* Plante verte avec tiges et feuilles douces */}
      <path
        d="M148 76V48"
        stroke="#16A34A"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M148 68C140 66 136 59 137 51C143 51 148 58 148 68Z"
        fill="#22C55E"
      />
      <path
        d="M148 59C156 57 160 50 159 42C153 42 148 49 148 59Z"
        fill="#16A34A"
      />
      <path
        d="M148 49C143 43 144 34 148 28C152 34 153 43 148 49Z"
        fill="#4ADE80"
      />
      <path
        d="M148 40C139 39 135 33 137 25C144 26 148 33 148 40Z"
        fill="#22C55E"
      />

      {/* Ombre sous les ordinateurs */}
      <ellipse cx="240" cy="105" rx="60" ry="4" fill="#BFDBFE" fillOpacity="0.6" />

      {/* 1. Écran de bureau secondaire (en arrière-plan) */}
      <g>
        {/* Pied de l'écran */}
        <path d="M255 78H265L268 98H252L255 78Z" fill="#94A3B8" />
        <ellipse cx="260" cy="98" rx="16" ry="2.5" fill="#64748B" />
        {/* Cadre de l'écran */}
        <rect x="220" y="32" width="80" height="50" rx="3.5" fill="#0F172A" stroke="#1E293B" strokeWidth="1.5" />
        {/* Dalle écran allumée avec graphique financier */}
        <rect x="223" y="35" width="74" height="42" rx="2" fill="#0077B6" />
        {/* Courbe financière et histogramme sur l'écran */}
        <path d="M228 65L238 56L248 60L258 48L268 52L278 44L288 47" stroke="#CAF0F8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="232" y="66" width="4" height="6" fill="#90E0EF" rx="0.5" />
        <rect x="242" y="62" width="4" height="10" fill="#90E0EF" rx="0.5" />
        <rect x="252" y="58" width="4" height="14" fill="#90E0EF" rx="0.5" />
        <rect x="262" y="54" width="4" height="18" fill="#90E0EF" rx="0.5" />
        <rect x="272" y="50" width="4" height="22" fill="#90E0EF" rx="0.5" />
        <rect x="282" y="52" width="4" height="20" fill="#90E0EF" rx="0.5" />
      </g>

      {/* 2. Ordinateur portable moderne au premier plan */}
      <g>
        {/* Écran du laptop (ouvert) */}
        <path
          d="M174 52C174 49.5 176 47.5 178.5 47.5H237.5C240 47.5 242 49.5 242 52V92H174V52Z"
          fill="#0B132B"
          stroke="#1E293B"
          strokeWidth="1.2"
        />
        {/* Dalle du laptop */}
        <rect x="177" y="50.5" width="62" height="38.5" rx="1.5" fill="#003566" />
        {/* Contenu de l'écran du laptop : interface financière épurée */}
        <rect x="181" y="54" width="22" height="4" rx="1" fill="#00B4D8" />
        <rect x="181" y="61" width="54" height="12" rx="1.5" fill="#001D3D" />
        <path d="M184 70C190 65 196 68 202 64C208 60 214 66 220 62L228 65" stroke="#00B4D8" strokeWidth="1.2" strokeLinecap="round" />
        <circle cx="202" cy="64" r="1.5" fill="#90E0EF" />
        <circle cx="220" cy="62" r="1.5" fill="#90E0EF" />
        {/* Mini widgets métriques */}
        <rect x="181" y="76" width="25" height="10" rx="1.5" fill="#001D3D" />
        <rect x="184" y="78" width="12" height="2" rx="0.5" fill="#90E0EF" />
        <rect x="184" y="82" width="18" height="2" rx="0.5" fill="#22C55E" />
        <rect x="210" y="76" width="25" height="10" rx="1.5" fill="#001D3D" />
        <rect x="213" y="78" width="12" height="2" rx="0.5" fill="#90E0EF" />
        <rect x="213" y="82" width="15" height="2" rx="0.5" fill="#F59E0B" />

        {/* Base / Clavier du laptop (en perspective) */}
        <path
          d="M165 92H251L247 101C246.5 102 245.5 102.5 244 102.5H172C170.5 102.5 169.5 102 169 101L165 92Z"
          fill="#CBD5E1"
          stroke="#94A3B8"
          strokeWidth="1"
        />
        {/* Clavier */}
        <path d="M172 93.5H244L242 97H174L172 93.5Z" fill="#64748B" />
        {/* Trackpad */}
        <rect x="200" y="98" width="16" height="3.5" rx="0.5" fill="#94A3B8" />
        {/* Encoche ouverture */}
        <rect x="204" y="92" width="8" height="1" rx="0.5" fill="#64748B" />
      </g>
    </svg>
  );
}

export function Dashboard() {
  const periode = periodeCourante();
  const me = useQuery(api.users.me);
  const niveau = me?.niveau ?? 0;
  const estAuditeur = me?.role === "auditeur_externe";

  const employes = useQuery(api.employes.liste, me && niveau >= 3 ? {} : "skip");
  const paie = useQuery(api.payroll.bulletinsDuMois, me && niveau >= 4 ? { periode } : "skip");
  const fin = useQuery(api.financier.kpi, me ? {} : "skip");
  const cr = useQuery(api.comptesRendus.monEspace, me && !estAuditeur ? {} : "skip");
  const st = useQuery(api.stats.kpi, me && niveau >= 3 ? { periode } : "skip");
  const audit = useQuery(api.audit.resume, me && (estAuditeur || me?.role === "dg") ? { periode } : "skip");

  // Démo / Seed
  const demo = useQuery(api.seed.etatDemo, me ? {} : "skip");
  const demo4 = useQuery(api.seed.etatDemo4, me ? {} : "skip");
  const seed = useMutation(api.seed.initialiser);
  const seedPhase2 = useAction(api.seed.phase2);
  const seedPhase3 = useMutation(api.seed.phase3);
  const seedPhase4 = useMutation(api.seed.phase4);

  const [msg, setMsg] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [notifEquipe, setNotifEquipe] = useState<{
    titre: string;
    texte: string;
    auteur?: string;
  } | null>(null);

  const heureActuelle = new Date().getHours();
  const salutation = heureActuelle < 12 ? "Bonjour" : heureActuelle < 18 ? "Bon après-midi" : "Bonsoir";

  const totalNet = paie?.bulletins.reduce((t: number, b: any) => t + b.net, 0) ?? 0;
  const totalBrut = paie?.bulletins.reduce((t: number, b: any) => t + b.brut, 0) ?? 0;
  const effectifActif = employes ? employes.filter((e: any) => e.actif).length : undefined;

  const lancer = async (nom: string, fn: () => Promise<any>, fmt: (r: any) => string) => {
    setEnCours(true);
    try {
      setMsg(`${nom} : ${fmt(await fn())}`);
    } catch (e) {
      setMsg(`Erreur : ${messageErreur(e)}`);
    } finally {
      setEnCours(false);
    }
  };

  // Données du graphique de flux financiers
  const donneesFlux = [
    {
      cle: "recettes",
      libelle: "Chiffre d'aff.",
      valeur: st?.chiffreAffaires ?? 0,
    },
    {
      cle: "brut",
      libelle: "Masse brute",
      valeur: totalBrut,
    },
    {
      cle: "net",
      libelle: "Net payé",
      valeur: totalNet,
    },
    {
      cle: "primes",
      libelle: "Primes méd.",
      valeur: st?.primes ?? 0,
    },
  ];

  return (
    <div className="space-y-6">
      {/* 1. Bandeaux d'information et initialisation Démo (super administrateur, ou déploiement vierge) */}
      {(me === null || (niveau >= 8 && employes && employes.length === 0)) && (
        <Avis
          ton="attention"
          titre="Première utilisation"
          action={
            <Button
              size="sm"
              onClick={async () => {
                const r = await seed();
                setMsg(`Initialisé : ${JSON.stringify(r)}`);
              }}
            >
              Initialiser la démo
            </Button>
          }
        >
          Initialisez les données de démonstration (membre DG, entreprise, barème, 8 employés).
        </Avis>
      )}

      {me && niveau >= 8 && fin && !fin.derniere && (
        <Avis
          ton="info"
          titre="Phase 2 Trésorerie"
          action={
            <Button
              size="sm"
              disabled={enCours}
              onClick={() =>
                lancer(
                  "Phase 2",
                  () => seedPhase2(),
                  (r) => `${r.journees} journée(s), ${r.documents} document(s).`
                )
              }
            >
              {enCours ? "Chargement…" : "Charger la démo Phase 2"}
            </Button>
          }
        >
          Aucune journée financière : chargez la démo (3 journées + 3 documents).
        </Avis>
      )}

      {me && niveau >= 8 && demo && !demo.phase3 && (
        <Avis
          ton="info"
          titre="Phase 3 Activité"
          action={
            <Button
              size="sm"
              disabled={enCours}
              onClick={() =>
                lancer(
                  "Phase 3",
                  () => seedPhase3(),
                  (r) => `${r.membres} membre(s), ${r.commandes} commande(s).`
                )
              }
            >
              {enCours ? "Chargement…" : "Charger la démo Phase 3"}
            </Button>
          }
        >
          Chargez la démo activité : membres, commandes, interventions et caisse.
        </Avis>
      )}

      {me && niveau >= 8 && demo4 && !demo4.phase4 && (
        <Avis
          ton="info"
          titre="Phase 4 Contrôle"
          action={
            <Button
              size="sm"
              disabled={enCours}
              onClick={() =>
                lancer(
                  "Phase 4",
                  () => seedPhase4(),
                  (r) => `${r.auditeur} auditeur, ${r.lignes} ligne(s) d'audit.`
                )
              }
            >
              {enCours ? "Chargement…" : "Charger la démo Phase 4"}
            </Button>
          }
        >
          Chargez la démo contrôle : auditeur externe, lignes d'audit et journal.
        </Avis>
      )}

      {/* 2. Bannière d'accueil & Période en cours (Inspirée de la capture) */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-sky-100 bg-gradient-to-r from-[#eef7ff] via-[#f5f9ff] to-[#e4f1fd] p-5 sm:p-6 shadow-sm">
        {/* Accent de brillance douce en arrière-plan */}
        <div
          className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-blue-400/10 blur-2xl"
          aria-hidden="true"
        />

        {/* Partie Haute : Texte à gauche & Illustration vectorielle à droite */}
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          {/* Bloc Texte & Identité */}
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-semibold text-slate-500">
                {salutation}, 👋
              </span>
              {paie && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-0.5 text-2xs font-medium text-slate-700 border border-blue-100 shadow-2xs">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      paie.cloture ? "bg-amber-500" : "bg-emerald-500 animate-pulse"
                    )}
                  />
                  {paie.cloture ? "Mois clôturé" : "En direct"}
                </span>
              )}
            </div>

            <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-blue-700">
              {me?.nom ?? "Polyclinique de Poitiers"} !
            </h2>

            <p className="text-xs sm:text-sm text-slate-600 max-w-xl">
              Période en cours :{" "}
              <span className="font-semibold text-slate-800">
                {libellePeriode(periode)}
              </span>{" "}
              · Suivi opérationnel en temps réel de Poitiers Coworking.
            </p>
          </div>

          {/* Illustration vectorielle (Plante verte en pot, pile de registres, oiseaux) */}
          <div className="relative shrink-0 self-center md:self-end">
            <BanniereIllustration className="h-20 sm:h-24 lg:h-28 w-auto drop-shadow-xs" />
          </div>
        </div>

        {/* 
          Espace dédié aux Alertes, Notifications et Actions effectuées :
          Présente en direct les actions exécutées par l'utilisateur courant,
          les notifications d'autres collaborateurs ou les alertes du jour.
        */}
        <div className="relative z-10 mt-4 pt-3.5 border-t border-blue-100/80">
          {msg ? (
            /* Action venant d'être effectuée par l'utilisateur */
            <div className="flex items-center justify-between gap-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 px-3.5 py-2.5 text-emerald-950 shadow-2xs animate-in fade-in duration-200">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </div>
                <div className="text-xs">
                  <span className="font-semibold text-emerald-950">Action effectuée :</span>{" "}
                  <span className="text-emerald-900">{msg}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMsg(null)}
                className="rounded-lg p-1 text-emerald-700 hover:bg-emerald-500/20 hover:text-emerald-950 transition-colors"
                title="Fermer la notification"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : notifEquipe ? (
            /* Notification d'un autre utilisateur ou événement d'équipe */
            <div className="flex items-center justify-between gap-3 rounded-xl bg-blue-600/10 border border-blue-600/25 px-3.5 py-2.5 text-blue-950 shadow-2xs animate-in fade-in duration-200">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
                  <Bell className="h-3.5 w-3.5 animate-bounce" />
                </div>
                <div className="text-xs">
                  <span className="font-semibold text-blue-950">{notifEquipe.titre} :</span>{" "}
                  <span className="text-blue-900">{notifEquipe.texte}</span>
                  {notifEquipe.auteur && (
                    <span className="ml-2 text-2xs text-blue-700/80 font-normal">
                      · par {notifEquipe.auteur}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setNotifEquipe(null)}
                className="rounded-lg p-1 text-blue-700 hover:bg-blue-600/20 hover:text-blue-950 transition-colors"
                title="Fermer la notification"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : cr && !cr.aujourdHui ? (
            /* Alerte opérationnelle : Compte rendu du jour en attente */
            <div className="flex items-center justify-between gap-3 rounded-xl bg-amber-500/10 border border-amber-500/30 px-3.5 py-2.5 text-amber-950 shadow-2xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white">
                  <AlertTriangle className="h-3.5 w-3.5" />
                </div>
                <div className="text-xs">
                  <span className="font-semibold text-amber-950">Alerte équipe :</span>{" "}
                  Votre compte rendu opérationnel du jour est en attente de rédaction.
                </div>
              </div>
              <Link
                to="/comptes-rendus"
                className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-amber-900 border border-amber-300 shadow-2xs hover:bg-amber-50 transition-colors shrink-0"
              >
                Rédiger
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          ) : (
            /* État nominal : Espace d'alertes & notifications prêt et rassurant */
            <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl bg-white/75 backdrop-blur-xs px-3.5 py-2 border border-blue-100/70 text-xs text-slate-600 shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="font-medium text-slate-700">Canal d'alertes & actions :</span>
                <span className="text-slate-500 hidden sm:inline">
                  Système synchronisé en continu avec Convex · 0 incident signalé
                </span>
                <span className="text-slate-500 sm:hidden">Système en ligne</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setNotifEquipe({
                      titre: "Notification collaborateur",
                      texte: "La réconciliation des encaissements de la journée a été validée.",
                      auteur: "Direction Financière",
                    })
                  }
                  className="text-2xs text-blue-600 hover:text-blue-800 font-medium hover:underline cursor-pointer"
                  title="Simuler la réception d'une notification d'un autre utilisateur"
                >
                  Tester une alerte
                </button>
                <span className="inline-block h-1 w-1 rounded-full bg-slate-300" />
                <Link
                  to="/journal"
                  className="text-2xs text-slate-500 hover:text-blue-700 hover:underline"
                >
                  Journal d'activité →
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Organisation principale : Zone Cockpit (Gauche) + Rail d'actions (Droite) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Colonne Gauche : Cockpit 2x2 + Graphique des Flux (8 colonnes sur 12) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Grille 2x2 des 4 Tuiles Majeures */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Tuile 1 (Vedette) : Chiffre d'Affaires du Mois */}
            {niveau >= 3 && (
              <Tuile
                vedette
                ton="info"
                libelle="Chiffre d'affaires du mois"
                valeur={st ? fcfa(st.chiffreAffaires) : undefined}
                note={`Recettes encaissées en ${libellePeriode(periode)}`}
                lienVers="/statistiques"
                badge={
                  <Badge variant="info">
                    <TrendingUp className="mr-1 h-3 w-3" />
                    Live
                  </Badge>
                }
              />
            )}

            {/* Tuile 2 : Solde Trésorerie F3 Poitiers */}
            <Tuile
              ton="neutre"
              libelle="Solde Trésorerie F3"
              valeur={
                fin === undefined
                  ? undefined
                  : fin?.derniere
                    ? fcfa(fin.derniere.f3Poitiers)
                    : "—"
              }
              note={
                fin?.derniere
                  ? `Dernière recette : ${fcfa(fin.derniere.recetteTotale)} (${new Date(fin.derniere.date + "T00:00:00").toLocaleDateString("fr-FR")})`
                  : "Aucune journée enregistrée"
              }
              lienVers="/financier"
              badge={
                fin?.recetteDuJour != null ? (
                  <Badge variant="succes">
                    Journée saisie
                  </Badge>
                ) : (
                  <Badge variant="attente">
                    Non saisie
                  </Badge>
                )
              }
            />

            {/* Tuile 3 : Net à Payer (Paie) */}
            {niveau >= 4 && (
              <Tuile
                ton="neutre"
                libelle="Net à payer du mois"
                valeur={paie ? fcfa(totalNet) : undefined}
                note={
                  paie
                    ? `${paie.bulletins.length} bulletin(s) généré(s)`
                    : "Calcul en cours…"
                }
                lienVers="/paie/bulletins"
                badge={
                  <Badge variant="neutre">
                    <FileCheck2 className="mr-1 h-3 w-3" />
                    Paie
                  </Badge>
                }
              />
            )}

            {/* Tuile 4 : Masse Brute & Primes */}
            {niveau >= 4 && (
              <Tuile
                ton="neutre"
                libelle="Masse brute & Charges"
                valeur={paie ? fcfa(totalBrut) : undefined}
                note={
                  st
                    ? `Primes méd. : ${fcfa(st.primes)} · ${effectifActif ?? 0} actif(s)`
                    : `${effectifActif ?? 0} employé(s) actif(s)`
                }
                lienVers="/paie/primes"
                badge={
                  <Badge variant="neutre">
                    <Users className="mr-1 h-3 w-3" />
                    {effectifActif ?? 0} salariés
                  </Badge>
                }
              />
            )}
          </div>

          {/* Graphique de Répartition des Flux Financiers (Large Card) */}
          <div className="rounded-xl border border-filet bg-surface p-5 shadow-sm">
            <div className="flex items-center justify-between pb-4 border-b border-filet mb-4">
              <div>
                <h2 className="text-sm font-bold tracking-tight text-encre">
                  Répartition des flux du mois
                </h2>
                <p className="text-xs text-encre-douce">
                  Recettes vs Masse salariale brute vs Net à décaisser vs Primes
                </p>
              </div>
              <Link
                to="/financier"
                className="flex h-7 w-7 items-center justify-center rounded-full bg-papier text-encre-douce hover:bg-ocean-brume hover:text-ocean-profond transition-colors"
                title="Voir le grand livre financier"
              >
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>

            <Barres
              donnees={donneesFlux}
              titre="Répartition des flux financiers du mois"
              cleActive="recettes"
              format={fcfa}
              hauteur={180}
            />
          </div>
        </div>

        {/* Colonne Droite : Rail « À faire aujourd'hui » (4 colonnes sur 12) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Card Espace Quotidien */}
          <div className="rounded-xl border border-filet bg-surface p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-filet pb-3">
              <CalendarCheck className="h-4 w-4 text-ocean-profond" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-encre">
                À faire aujourd'hui
              </h2>
            </div>

            {/* Action 1 : Compte Rendu du Jour */}
            {!estAuditeur && (
              <div className="rounded-lg border border-filet bg-papier/60 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-encre">
                    Compte rendu du jour
                  </span>
                  {cr ? (
                    cr.aujourdHui ? (
                      <Statut etat="soumis">
                        {cr.aujourdHui.heure}
                        {cr.aujourdHui.horsFenetre && " (hors fenêtre)"}
                      </Statut>
                    ) : (
                      <Statut etat="non_soumis">En attente</Statut>
                    )
                  ) : (
                    <span className="text-2xs text-encre-pale">…</span>
                  )}
                </div>
                <p className="text-2xs text-encre-douce">
                  {cr?.aujourdHui
                    ? "Votre compte rendu de journée a été enregistré."
                    : `Votre compte rendu journalier doit être renseigné avant ${cr?.fenetre?.fermeture ?? 20}h.`}
                </p>
                <Button
                  asChild
                  variant={cr?.aujourdHui ? "outline" : "default"}
                  size="sm"
                  className="w-full text-xs"
                >
                  <Link to="/comptes-rendus">
                    {cr?.aujourdHui ? "Consulter mes comptes rendus" : "Rédiger mon compte rendu →"}
                  </Link>
                </Button>
              </div>
            )}

            {/* Action 2 : Recette Journalière */}
            {niveau >= 5 && (
              <div className="rounded-lg border border-filet bg-papier/60 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-encre">
                    Recette journalière
                  </span>
                  {fin === undefined ? (
                    <span className="text-2xs text-encre-pale">…</span>
                  ) : fin?.recetteDuJour != null ? (
                    <Statut etat="validee">{fcfa(fin.recetteDuJour)}</Statut>
                  ) : (
                    <Statut etat="non_saisi">Non saisie</Statut>
                  )}
                </div>
                <p className="text-2xs text-encre-douce">
                  {fin?.recetteDuJour != null
                    ? "La recette du jour a été enregistrée avec succès."
                    : "La journée financière d'aujourd'hui est en attente de clôture."}
                </p>
                <Button asChild variant="outline" size="sm" className="w-full text-xs">
                  <Link to="/financier">
                    {fin?.recetteDuJour != null ? "Consulter le journal" : "Saisir la recette du jour →"}
                  </Link>
                </Button>
              </div>
            )}

            {/* Action 3 : Score Présence */}
            {!estAuditeur && (
              <div className="flex items-center justify-between rounded-lg border border-filet bg-papier/60 p-3">
                <div className="flex items-center gap-2">
                  <Coins className="h-4 w-4 text-amber-600" />
                  <span className="text-xs font-semibold text-encre">
                    Points de présence
                  </span>
                </div>
                <span className="font-bold tabular-nums text-encre text-sm">
                  {cr ? `${cr.score} pt(s)` : "…"}
                </span>
              </div>
            )}
          </div>

          {/* Bloc Audit Confidentiel (visible pour Auditeur externe ou DG) */}
          {audit && (
            <div className="rounded-xl border border-filet bg-surface p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-filet pb-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-ocean-profond" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-encre">
                    Audit confidentiel
                  </h3>
                </div>
                <Link
                  to="/audit"
                  className="text-2xs font-semibold text-ocean-profond hover:underline flex items-center gap-0.5"
                >
                  Détail <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-encre-douce">Total audité (mois) :</span>
                  <span className="font-semibold tabular-nums text-encre">
                    {fcfa(audit.total)}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-encre-douce">Mois précédent :</span>
                  <span className="tabular-nums text-encre-pale">
                    {fcfa(audit.totalPrecedent)}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-encre-douce">Rapports finalisés :</span>
                  <span className="font-bold text-ocean-profond tabular-nums">
                    {audit.categories.filter((c: any) => c.rapport).length} / {audit.categories.length}
                  </span>
                </div>
              </div>

              {/* Petite jauge de progression des rapports en SVG pur sans style en ligne */}
              <div className="w-full bg-filet rounded-full h-2 overflow-hidden">
                <svg className="w-full h-full block" viewBox="0 0 100 8" preserveAspectRatio="none">
                  <rect
                    x="0"
                    y="0"
                    width={Math.round(
                      (audit.categories.filter((c: any) => c.rapport).length /
                        Math.max(1, audit.categories.length)) *
                        100
                    )}
                    height="8"
                    className="fill-ocean-profond"
                  />
                </svg>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

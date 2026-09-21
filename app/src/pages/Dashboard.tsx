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
  X,
  FileEdit,
} from "lucide-react";
import banniereAnalyticsIcon from "@/assets/banniere-analytics-icon.jpg";

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

      {/* 2. Bannière d'accueil & Période en cours (Style Executive Midnight) */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-blue-900/40 bg-gradient-to-br from-[#02033b] via-[#03045e] to-[#011640] p-5 sm:p-6 lg:p-7 text-white shadow-xl shadow-blue-950/30">
        {/* Lueur céruléenne diffuse & texture discrète en arrière-plan */}
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[#00b4d8]/20 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute left-1/3 -bottom-16 h-48 w-48 rounded-full bg-[#0077b6]/25 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.035] bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]"
          aria-hidden="true"
        />

        {/* Partie Haute : Texte à gauche & Icône graphique 3D à droite */}
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          {/* Bloc Texte & Identité */}
          <div className="space-y-2 min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-sky-200/80 tracking-wide">
              <span>{salutation},</span>
              {me?.role && (
                <span className="text-xs px-2 py-0.5 rounded-md bg-white/10 text-sky-200 border border-white/15 font-mono font-medium">
                  {me.role === "dg"
                    ? "Direction Générale"
                    : me.role === "da1"
                    ? "Direction Adjointe"
                    : me.role === "comptable"
                    ? "Comptabilité"
                    : me.role === "gestionnaire_rh"
                    ? "Ressources Humaines"
                    : me.role === "chef_equipe"
                    ? "Chef d'équipe"
                    : me.role === "super_admin"
                    ? "Super administrateur"
                    : me.role === "auditeur_externe"
                    ? "Audit Externe"
                    : "Collaborateur"}
                </span>
              )}
              {paie?.cloture && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-2.5 py-0.5 text-2xs font-semibold text-amber-300 border border-amber-400/30 shadow-2xs font-mono">
                  Mois clôturé
                </span>
              )}
            </div>

            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white drop-shadow-xs">
              {me?.nom ?? "Polyclinique de Poitiers"}
            </h2>

            <p className="text-xs sm:text-sm text-sky-100/80 max-w-xl leading-relaxed">
              Période en cours :{" "}
              <span className="font-semibold text-white font-mono bg-white/10 px-2 py-0.5 rounded">
                {libellePeriode(periode)}
              </span>{" "}
              · Suivi opérationnel en temps réel de Poitiers Coworking.
            </p>
          </div>

          {/* Icône graphique 3D haute fidélité */}
          <div className="relative shrink-0 flex items-center justify-center self-center md:self-end">
            <div className="relative group">
              <div className="absolute -inset-2 rounded-2xl bg-gradient-to-r from-cyan-500/25 to-blue-600/25 blur-xl group-hover:blur-2xl transition-all duration-300" />
              <img
                src={banniereAnalyticsIcon}
                alt="Indicateurs de gestion et croissance"
                className="relative h-24 sm:h-28 lg:h-32 w-24 sm:w-28 lg:w-32 rounded-2xl object-cover border border-sky-400/30 shadow-xl shadow-blue-950/80 transition-transform duration-300 group-hover:scale-105"
              />
            </div>
          </div>
        </div>

        {/* 
          Espace dédié aux Alertes, Notifications et Actions effectuées (Dock Flottant Glassmorphism)
        */}
        <div className="relative z-10 mt-5 pt-3.5 border-t border-white/10">
          {msg ? (
            /* Action venant d'être effectuée par l'utilisateur */
            <div className="flex items-center justify-between gap-3 rounded-xl bg-emerald-500/15 backdrop-blur-md border border-emerald-400/30 px-3.5 py-2.5 text-white shadow-lg animate-in fade-in duration-200">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </div>
                <div className="text-xs">
                  <span className="font-semibold text-emerald-300">Action effectuée :</span>{" "}
                  <span className="text-emerald-100">{msg}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMsg(null)}
                className="rounded-lg p-1 text-emerald-300 hover:bg-emerald-500/20 hover:text-white transition-colors"
                title="Fermer la notification"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : notifEquipe ? (
            /* Notification d'un autre utilisateur ou événement d'équipe */
            <div className="flex items-center justify-between gap-3 rounded-xl bg-sky-500/15 backdrop-blur-md border border-sky-400/30 px-3.5 py-2.5 text-white shadow-lg animate-in fade-in duration-200">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-500 text-white">
                  <Bell className="h-3.5 w-3.5 animate-bounce" />
                </div>
                <div className="text-xs">
                  <span className="font-semibold text-sky-200">{notifEquipe.titre} :</span>{" "}
                  <span className="text-sky-100">{notifEquipe.texte}</span>
                  {notifEquipe.auteur && (
                    <span className="ml-2 text-2xs text-sky-300/80 font-normal">
                      · par {notifEquipe.auteur}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setNotifEquipe(null)}
                className="rounded-lg p-1 text-sky-300 hover:bg-sky-500/20 hover:text-white transition-colors"
                title="Fermer la notification"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : cr && !cr.aujourdHui ? (
            /* Alerte opérationnelle : Compte rendu du jour en attente */
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl bg-white/[0.08] backdrop-blur-md border border-white/15 px-4 py-2.5 text-white shadow-lg shadow-black/10 hover:bg-white/[0.11] transition-all">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 border border-amber-400/40 text-amber-300 shadow-xs">
                  <FileEdit className="h-4 w-4" />
                </div>
                <div className="text-xs leading-relaxed">
                  <span className="font-bold text-amber-300 font-mono uppercase text-2xs tracking-wider mr-1.5 px-1.5 py-0.5 rounded bg-amber-400/10 border border-amber-400/30">
                    Alerte équipe
                  </span>
                  <span className="text-slate-100 font-medium">
                    Votre compte rendu opérationnel du jour est en attente de rédaction.
                  </span>
                </div>
              </div>
              <Link
                to="/comptes-rendus"
                style={{ color: "#03045e" }}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-white !text-[#03045e] px-4 py-1.5 text-xs font-bold hover:bg-sky-50 shadow-md shadow-black/20 transition-all shrink-0 self-end sm:self-auto hover:translate-x-0.5 cursor-pointer"
              >
                <span style={{ color: "#03045e" }} className="!text-[#03045e] font-bold">Rédiger</span>
                <ArrowUpRight style={{ color: "#03045e" }} className="h-3.5 w-3.5 !text-[#03045e]" />
              </Link>
            </div>
          ) : (
            /* État nominal : Espace d'alertes & notifications prêt et rassurant */
            <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl bg-white/[0.06] backdrop-blur-md px-3.5 py-2 border border-white/10 text-xs text-sky-200/90 shadow-2xs">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <span className="font-medium text-white">Canal d'alertes & actions :</span>
                <span className="text-sky-200/70 hidden sm:inline">
                  Système synchronisé en continu · 0 incident signalé
                </span>
                <span className="text-sky-200/70 sm:hidden">Système en ligne</span>
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
                  className="rounded-md bg-white/10 hover:bg-white/20 border border-white/20 px-2.5 py-1 text-2xs font-semibold text-sky-200 hover:text-white transition-colors cursor-pointer"
                  title="Simuler la réception d'une notification d'un autre utilisateur"
                >
                  Tester une alerte
                </button>
                <span className="inline-block h-1 w-1 rounded-full bg-sky-300/40" />
                <Link
                  to="/journal"
                  className="rounded-md bg-white/10 hover:bg-white/20 border border-white/20 px-2.5 py-1 text-2xs font-semibold text-sky-200 hover:text-white transition-colors"
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

            {/* Tuile 2 : Solde Trésorerie F3 Poitiers (grand livre : niveau 5) */}
            {niveau >= 5 && (
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
            )}

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

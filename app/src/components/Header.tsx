import { useLocation } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { libellePeriode, periodeCourante } from "@/lib/format";
import {
  Menu,
  Calendar,
  Search,
  Bell,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const TITRES_PAGES: Record<string, { titre: string; sousTitre: string }> = {
  "/": { titre: "Tableau de bord", sousTitre: "Cockpit et vue d'ensemble" },
  "/financier": { titre: "Récapitulatif financier", sousTitre: "Trésorerie et recettes journalières" },
  "/documents": { titre: "Documents", sousTitre: "Pièces justificatives et archivage" },
  "/comptes-rendus": { titre: "Comptes rendus", sousTitre: "Activité et présences quotidiennes" },
  "/commandes": { titre: "Commandes", sousTitre: "Gestion des commandes clients" },
  "/interventions": { titre: "Interventions", sousTitre: "Prestations et suivi terrain" },
  "/statistiques": { titre: "Caisse & primes médecins", sousTitre: "Recettes mensuelles et rétrocessions (hors paie)" },
  "/employes": { titre: "Employés", sousTitre: "Gestion des effectifs et contrats" },
  "/paie/saisie": { titre: "Récapitulatif salaires", sousTitre: "Grille mensuelle des éléments de paie" },
  "/paie/liste": { titre: "Liste des salaires", sousTitre: "Récapitulatif ordonné des virements" },
  "/paie/bulletins": { titre: "Bulletins du mois", sousTitre: "Fiches de paie individuelles" },
  "/paie/courrier": { titre: "Courrier de paie", sousTitre: "Lettres et bulletins imprimables" },
  "/paie/planning": { titre: "Planning des absences", sousTitre: "Congés et indisponibilités" },
  "/paie/primes": { titre: "Primes & retenues", sousTitre: "Lignes libres du bulletin de paie" },
  "/paie/archives": { titre: "Archives de paie", sousTitre: "Historique des clôtures mensuelles" },
  "/audit": { titre: "Audit confidentiel", sousTitre: "Contrôle financier indépendant" },
  "/bareme": { titre: "Barème", sousTitre: "Grille salariale et taux de référence" },
  "/membres": { titre: "Membres & accès", sousTitre: "Comptes et niveaux d'accès (DG)" },
  "/journal": { titre: "Journal d'activité", sousTitre: "Traçabilité des opérations système" },
  "/api-readme": { titre: "Fiche API", sousTitre: "Documentation technique des endpoints" },
  "/parametres": { titre: "Paramètres", sousTitre: "Configuration générale" },
};

export function Header({ onOpenMobileMenu }: { onOpenMobileMenu?: () => void }) {
  const location = useLocation();
  const me = useQuery(api.users.me);
  const periode = periodeCourante();

  const infoPage = TITRES_PAGES[location.pathname] ?? {
    titre: "Poitiers Coworking",
    sousTitre: "Plateforme de gestion",
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 print:hidden w-full items-center justify-between border-b border-filet bg-surface/95 px-4 backdrop-blur sm:px-6">
      {/* Côté Gauche : Menu Mobile + Contexte de Page */}
      <div className="flex items-center gap-3">
        {onOpenMobileMenu && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onOpenMobileMenu}
            className="md:hidden text-encre-douce hover:text-encre"
            aria-label="Ouvrir le menu de navigation"
          >
            <Menu className="h-5 w-5" />
          </Button>
        )}
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold tracking-tight text-encre sm:text-lg">
              {infoPage.titre}
            </h1>
            <span className="hidden text-xs text-encre-pale sm:inline">/</span>
            <span className="hidden text-xs font-medium text-encre-douce sm:inline">
              {infoPage.sousTitre}
            </span>
          </div>
        </div>
      </div>

      {/* Côté Droit : Sélecteur de Période, Live, Alertes & Profil */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Pilule Période active */}
        <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-ocean-ceruleen/30 bg-ocean-brume/40 px-3 py-1 text-xs font-medium text-ocean-profond">
          <Calendar className="h-3.5 w-3.5 text-ocean-profond" />
          <span>{libellePeriode(periode)}</span>
        </div>

        {/* Statut Live Convex */}
        <div
          className="hidden md:flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-2xs font-medium text-emerald-700 border border-emerald-200"
          title="Connexion en temps réel active"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
          </span>
          <span>En direct</span>
        </div>

        {/* Bouton recherche rapide (visuel interactif) */}
        <div className="relative hidden lg:block">
          <div className="flex items-center gap-2 rounded-lg border border-filet bg-papier px-2.5 py-1.5 text-xs text-encre-pale">
            <Search className="h-3.5 w-3.5 text-encre-pale" />
            <span>Rechercher...</span>
            <kbd className="rounded border border-filet bg-surface px-1.5 py-0.5 text-2xs font-semibold text-encre-pale">
              Ctrl K
            </kbd>
          </div>
        </div>

        {/* Bouton d'accès au Guide Interactif (Pédagogie & Règles) */}
        <a
          href="/guide-interactif.html"
          target="_blank"
          rel="noopener noreferrer"
          title="Ouvrir le guide interactif : Rôles, interactions des onglets et règles de calcul"
          className="inline-flex items-center gap-1.5 rounded-lg border border-ocean-ceruleen/30 bg-ocean-brume/50 px-2.5 py-1.5 text-xs font-semibold text-ocean-profond hover:bg-ocean-brume/80 hover:text-ocean-profond transition-colors shadow-2xs"
        >
          <BookOpen className="h-3.5 w-3.5 text-ocean-profond" />
          <span className="hidden md:inline">Guide des Rôles & Calculs</span>
        </a>

        {/* Cloche d'alertes */}
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 text-encre-douce hover:bg-papier hover:text-encre"
          aria-label="Alertes et notifications"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-ocean-ceruleen" />
        </Button>

        {/* Avatar Profil compact */}
        <div className="flex items-center gap-2 pl-1 sm:border-l sm:border-filet sm:pl-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ocean-profond text-xs font-bold text-white shadow-sm">
            {me?.nom ? me.nom.charAt(0).toUpperCase() : me?.email ? me.email.charAt(0).toUpperCase() : "U"}
          </div>
          <div className="hidden flex-col text-left xl:flex">
            <span className="text-xs font-semibold leading-none text-encre">
              {me?.nom ?? me?.email ?? "Utilisateur"}
            </span>
            <span className="text-2xs text-encre-pale">
              {me?.roleLibelle ?? "Membre"}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

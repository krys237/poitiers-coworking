import { createContext, useContext, useEffect, useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuthActions } from "@convex-dev/auth/react";
import { canAccess, Role } from "../../convex/rbac";
import { Header } from "./Header";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import logoPolyclinique from "@/assets/logo-polyclinique.png";
import {
  LayoutDashboard,
  Wallet,
  FolderOpen,
  ClipboardCheck,
  ShoppingBag,
  Wrench,
  TrendingUp,
  Users,
  TableProperties,
  ListOrdered,
  FileCheck2,
  Mail,
  CalendarDays,
  Receipt,
  Archive,
  ShieldAlert,
  SlidersHorizontal,
  UserCog,
  History,
  Code2,
  Settings,
  LogOut,
  PanelLeftOpen,
} from "lucide-react";
import { useMe } from "../auth/useMe";
import "../auth/auth.css";

// Mode « rail » : la barre latérale se replie en une colonne d'icônes de 64 px.
// Un écran très large (le récapitulatif salaires et ses 18 colonnes) le demande
// le temps où il est affiché ; tout est rétabli quand on le quitte.
const RailContext = createContext<{ rail: boolean; setRail: (rail: boolean) => void }>({
  rail: false,
  setRail: () => {},
});

export function useRailLateral(actif: boolean) {
  const { setRail } = useContext(RailContext);
  useEffect(() => {
    setRail(actif);
    return () => setRail(false);
  }, [actif, setRail]);
}

type NavItem = {
  to: string;
  label: string;
  perm: string;
  icon: React.ComponentType<{ className?: string }>;
};

const NAV: { grp: string; items: NavItem[] }[] = [
  {
    grp: "Exploitation",
    items: [
      { to: "/", label: "Tableau de bord", perm: "/", icon: LayoutDashboard },
      { to: "/financier", label: "Récapitulatif financier", perm: "/financier", icon: Wallet },
      { to: "/documents", label: "Documents", perm: "/documents", icon: FolderOpen },
      { to: "/comptes-rendus", label: "Comptes rendus", perm: "/comptes-rendus", icon: ClipboardCheck },
      { to: "/commandes", label: "Commandes", perm: "/commandes", icon: ShoppingBag },
      { to: "/interventions", label: "Interventions", perm: "/interventions", icon: Wrench },
      { to: "/statistiques", label: "Caisse & primes médecins", perm: "/statistiques", icon: TrendingUp },
    ],
  },
  {
    grp: "Paie",
    items: [
      { to: "/employes", label: "Employés", perm: "/employes", icon: Users },
      // `perm` reprend exactement la clé de la route correspondante dans App.tsx :
      // le menu et le garde d'accès lisent ainsi la même ligne de `NIVEAU_MODULE`.
      { to: "/paie/saisie", label: "Récapitulatif salaires", perm: "/paie/saisie", icon: TableProperties },
      { to: "/paie/liste", label: "Liste des salaires", perm: "/paie/liste", icon: ListOrdered },
      { to: "/paie/bulletins", label: "Bulletins du mois", perm: "/paie/bulletins", icon: FileCheck2 },
      { to: "/paie/courrier", label: "Courrier de paie", perm: "/paie/courrier", icon: Mail },
      { to: "/paie/planning", label: "Planning des absences", perm: "/paie/planning", icon: CalendarDays },
      { to: "/paie/primes", label: "Primes & retenues (paie)", perm: "/paie/primes", icon: Receipt },
      { to: "/paie/archives", label: "Archives", perm: "/paie/archives", icon: Archive },
    ],
  },
  {
    grp: "Contrôle",
    items: [
      { to: "/audit", label: "Audit confidentiel", perm: "/audit", icon: ShieldAlert },
      { to: "/bareme", label: "Barème", perm: "/bareme", icon: SlidersHorizontal },
      { to: "/membres", label: "Membres", perm: "/membres", icon: UserCog },
      { to: "/journal", label: "Journal d'activité", perm: "/journal", icon: History },
      { to: "/api-readme", label: "Fiche API", perm: "/api-readme", icon: Code2 },
      { to: "/parametres", label: "Paramètres", perm: "/parametres", icon: Settings },
    ],
  },
];

function SidebarContent({
  role,
  me,
  onItemClick,
  signOut,
}: {
  role: Role;
  me: any;
  onItemClick?: () => void;
  signOut: () => Promise<unknown>;
}) {
  return (
    <div className="relative flex h-full flex-col justify-between bg-white text-slate-800 overflow-hidden border-r border-slate-200/80">
      {/* 
        1. Dégradé bleu supérieur harmonisé avec le sélecteur actif :
        Utilise exactement les mêmes tons bleu (from-blue-600 to-[#0077b6]) que les items
        actifs de navigation pour une parfaite cohérence chromatique de la barre latérale.
      */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[280px] bg-gradient-to-b from-blue-600 via-[#0077b6] via-[52%] via-[#00b4d8]/20 via-[82%] to-white"
        aria-hidden="true"
      />

      {/* 2. En-tête : Logo Polyclinique & Titre Institutionnel */}
      <div className="relative z-10 flex flex-col items-center px-4 pt-5 pb-3 text-center">
        {/* Badge blanc avec Logo officiel de la Polyclinique */}
        <div className="flex items-center justify-center rounded-2xl bg-white px-3.5 py-1.5 shadow-md ring-1 ring-black/5">
          <img
            src={logoPolyclinique}
            alt="Polyclinique de Poitiers"
            className="h-9 w-auto max-w-[180px] object-contain"
          />
        </div>
        <div className="mt-2.5 text-xs font-bold tracking-wider uppercase text-white drop-shadow-sm">
          Polyclinique de Poitiers
        </div>
        <div className="text-2xs font-medium text-blue-100/90">
          Plateforme de gestion & paie
        </div>
      </div>

      {/* 
        3. Carte blanche de navigation :
        Coins supérieurs arrondis généreux (rounded-t-[26px]) avec ombre douce
        diffuse vers le haut pour une transition organique et fluide avec le bleu.
      */}
      <div className="relative z-10 flex flex-1 flex-col mx-2.5 rounded-t-[26px] bg-white text-slate-700 shadow-[0_-8px_25px_rgba(13,80,208,0.12),0_2px_8px_rgba(0,0,0,0.03)] border-t border-white/60 overflow-hidden">
        {/* Liste des fonctionnalités scrollable */}
        <div className="flex-1 overflow-y-auto px-3 py-3.5">
          <nav className="space-y-4">
            {NAV.map((g) => {
              const items = g.items.filter((i) => canAccess(role, i.perm));
              if (!items.length) return null;
              return (
                <div key={g.grp} className="space-y-1">
                  <div className="px-3 text-2xs font-bold uppercase tracking-wider text-slate-400">
                    {g.grp}
                  </div>
                  <div className="space-y-0.5">
                    {items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          end={item.to === "/"}
                          onClick={onItemClick}
                          className={({ isActive }) =>
                            cn(
                              "group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-medium transition-all duration-150",
                              isActive
                                ? "!bg-gradient-to-r !from-blue-600 !to-[#0077b6] !text-white shadow-sm font-semibold"
                                : "text-slate-600 hover:bg-slate-50 hover:text-blue-600"
                            )
                          }
                        >
                          {({ isActive }) => (
                            <>
                              <Icon
                                className={cn(
                                  "h-4 w-4 shrink-0 transition-colors",
                                  isActive
                                    ? "!text-white"
                                    : "text-slate-400 group-hover:text-blue-600"
                                )}
                              />
                              <span className={cn("truncate", isActive ? "!text-white font-semibold" : "")}>
                                {item.label}
                              </span>
                            </>
                          )}
                        </NavLink>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>
        </div>
      </div>

      {/* 
        4. Bas de la Sidebar : Profil utilisateur conservé en Bleu nuit
        comme demandé ("laisser le poste tout en bas en bleu comme actuellement")
      */}
      <div className="relative z-10 border-t border-ocean-profond/40 bg-ocean-nuit px-4 py-3.5 text-slate-200">
        {me === undefined ? (
          <div className="text-2xs text-slate-400">Chargement…</div>
        ) : me === null ? (
          <div className="rounded-lg bg-amber-950/40 p-2 text-2xs text-amber-200 border border-amber-800/40">
            Session expirée — rechargez la page.
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ocean-profond text-xs font-bold text-white shadow-sm ring-2 ring-ocean-ceruleen/40">
              {me.nom ? me.nom.charAt(0).toUpperCase() : "U"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-semibold text-white">
                {me.nom ?? me.email}
              </div>
              <div className="flex items-center gap-1.5 text-2xs text-ocean-ciel/80">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-emerald-400/20" />
                <span className="truncate">{me.roleLibelle} · niv. {me.niveau}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void signOut()}
              title="Se déconnecter"
              aria-label="Se déconnecter"
              className="shrink-0 rounded-lg p-1.5 text-slate-300 transition-colors hover:bg-ocean-profond hover:text-white"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Barre latérale repliée : mêmes entrées, même filtrage d'accès, icônes seules. */
function RailLateral({
  role,
  me,
  signOut,
  onDeplier,
}: {
  role: Role;
  me: any;
  signOut: () => Promise<unknown>;
  onDeplier: () => void;
}) {
  const items = NAV.flatMap((g) => g.items).filter((i) => canAccess(role, i.perm));
  return (
    <div className="relative flex h-full flex-col justify-between overflow-hidden border-r border-slate-200/80 bg-white">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[200px] bg-gradient-to-b from-blue-600 via-[#0077b6] via-[48%] via-[#00b4d8]/20 via-[80%] to-white"
        aria-hidden="true"
      />
      <div className="relative z-10 flex flex-col items-center gap-1.5 px-3 pt-3.5">
        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-md ring-1 ring-black/5">
          <img src={logoPolyclinique} alt="Polyclinique de Poitiers" className="h-6 w-auto object-contain" />
        </div>
        <nav className="flex flex-col gap-1" aria-label="Navigation principale (repliée)">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                title={item.label}
                aria-label={item.label}
                className={({ isActive }) =>
                  cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl transition-colors",
                    isActive
                      ? "!bg-gradient-to-r !from-blue-600 !to-[#0077b6] !text-white shadow-sm"
                      : "text-slate-500 hover:bg-slate-50 hover:text-blue-600"
                  )
                }
              >
                <Icon className="h-[18px] w-[18px]" />
              </NavLink>
            );
          })}
        </nav>
      </div>
      <div className="relative z-10 flex flex-col items-center gap-2 border-t border-ocean-profond/40 bg-ocean-nuit py-3">
        <button
          type="button"
          onClick={onDeplier}
          title="Déplier la barre latérale"
          aria-label="Déplier la barre latérale"
          className="rounded-lg p-1.5 text-slate-300 transition-colors hover:bg-ocean-profond hover:text-white"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </button>
        <div
          className="flex h-9 w-9 items-center justify-center rounded-full bg-ocean-profond text-xs font-bold text-white shadow-sm ring-2 ring-ocean-ceruleen/40"
          title={me?.nom ?? me?.email ?? ""}
        >
          {me?.nom ? me.nom.charAt(0).toUpperCase() : "U"}
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          title="Se déconnecter"
          aria-label="Se déconnecter"
          className="rounded-lg p-1.5 text-slate-300 transition-colors hover:bg-ocean-profond hover:text-white"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function Layout() {
  const me = useMe();
  const { signOut } = useAuthActions();
  // `PortailAuth` garantit qu'on n'arrive ici qu'avec un membre autorisé ; le repli sur
  // "employe" ne sert qu'au bref instant de rechargement d'une session.
  const role = (me?.role ?? "employe") as Role;
  const [mobileOpen, setMobileOpen] = useState(false);
  // Rail demandé par l'écran courant (useRailLateral) ; « déplier » l'annule jusqu'au
  // prochain changement d'écran.
  const [railDemande, setRailDemande] = useState(false);
  const [railForceOuvert, setRailForceOuvert] = useState(false);
  const rail = railDemande && !railForceOuvert;

  return (
    <RailContext.Provider
      value={{
        rail,
        setRail: (r) => {
          setRailDemande(r);
          setRailForceOuvert(false);
        },
      }}
    >
    <div className="flex min-h-screen bg-papier text-encre">
      {/* Sidebar Desktop Fixe (ou rail replié) */}
      <aside className={cn("hidden shrink-0 print:!hidden md:block", rail ? "w-16" : "w-64")}>
        <div className="sticky top-0 h-screen shadow-md">
          {rail ? (
            <RailLateral role={role} me={me} signOut={signOut} onDeplier={() => setRailForceOuvert(true)} />
          ) : (
            <SidebarContent role={role} me={me} signOut={signOut} />
          )}
        </div>
      </aside>

      {/* Sidebar Mobile en Drawer (Sheet) */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0 border-r-0">
          <SheetTitle className="sr-only">Menu de navigation</SheetTitle>
          <SidebarContent
            role={role}
            me={me}
            signOut={signOut}
            onItemClick={() => setMobileOpen(false)}
          />
        </SheetContent>
      </Sheet>

      {/* Conteneur Principal avec Header Bar et Contenu */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Tant que AUTH_DEV_BYPASS est actif, TOUTE personne disposant du lien est
            Directeur Général. Le bandeau doit rester visible et déplaisant. */}
        {me?.modeDev && (
          <div className="auth-bandeau-dev print:hidden">
            Mode développement actif (<code>AUTH_DEV_BYPASS</code>) — toute personne ayant ce lien
            dispose des droits de {me.roleLibelle}. À désactiver avant toute diffusion.
            {" "}<Link to="/connexion" className="underline underline-offset-2 hover:text-white/80">Se connecter avec un compte de test</Link>
          </div>
        )}
        <Header onOpenMobileMenu={() => setMobileOpen(true)} />
        <main className={cn("flex-1 p-4 print:p-0", rail ? "sm:p-5" : "sm:p-6 lg:p-8")}>
          <Outlet />
        </main>
      </div>
    </div>
    </RailContext.Provider>
  );
}

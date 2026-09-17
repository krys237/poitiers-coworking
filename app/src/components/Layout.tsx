import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
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
} from "lucide-react";
import { useMe } from "../auth/useMe";
import "../auth/auth.css";

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
      { to: "/statistiques", label: "Statistiques & primes", perm: "/statistiques", icon: TrendingUp },
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
      { to: "/paie/primes", label: "Primes & charges", perm: "/paie/primes", icon: Receipt },
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
        1. Dégradé bleu supérieur avec transition fluide et fondue vers le blanc :
        Descend depuis le bleu royal électrique en haut, traverse l'en-tête et l'onglet Dashboard,
        puis se dissout progressivement et doucement dans le blanc pur (aucun décrochage net).
      */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[280px] bg-gradient-to-b from-[#1e69ff] via-[#155dfc] via-[45%] via-[#0077b6] via-[65%] via-[#38bdf8]/25 via-[85%] to-white"
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

export function Layout() {
  const me = useMe();
  const { signOut } = useAuthActions();
  // `PortailAuth` garantit qu'on n'arrive ici qu'avec un membre autorisé ; le repli sur
  // "employe" ne sert qu'au bref instant de rechargement d'une session.
  const role = (me?.role ?? "employe") as Role;
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-papier text-encre">
      {/* Sidebar Desktop Fixe */}
      <aside className="hidden w-64 shrink-0 md:block">
        <div className="sticky top-0 h-screen shadow-md">
          <SidebarContent role={role} me={me} signOut={signOut} />
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
          <div className="auth-bandeau-dev">
            Mode développement actif (<code>AUTH_DEV_BYPASS</code>) — toute personne ayant ce lien
            dispose des droits de Directeur Général. À désactiver avant toute diffusion.
          </div>
        )}
        <Header onOpenMobileMenu={() => setMobileOpen(true)} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

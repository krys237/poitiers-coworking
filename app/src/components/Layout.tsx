import { NavLink, Outlet } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { canAccess, Role } from "../../convex/rbac";

const NAV: { grp: string; items: { to: string; label: string; perm: string }[] }[] = [
  { grp: "Exploitation", items: [
    { to: "/", label: "Tableau de bord", perm: "/" },
    { to: "/financier", label: "Récapitulatif financier", perm: "/financier" },
    { to: "/documents", label: "Documents", perm: "/documents" },
    { to: "/comptes-rendus", label: "Comptes rendus", perm: "/comptes-rendus" },
    { to: "/commandes", label: "Commandes", perm: "/commandes" },
    { to: "/interventions", label: "Interventions", perm: "/interventions" },
    { to: "/statistiques", label: "Statistiques & primes", perm: "/statistiques" },
  ] },
  {
    grp: "Paie",
    items: [
      { to: "/employes", label: "Employés", perm: "/employes" },
      { to: "/paie/saisie", label: "Saisie mensuelle", perm: "/paie" },
      { to: "/paie/bulletins", label: "Bulletins", perm: "/paie/bulletins" },
      { to: "/paie/courrier", label: "Courrier de paie", perm: "/paie/courrier" },
      { to: "/paie/planning", label: "Planning des absences", perm: "/paie/planning" },
      { to: "/paie/primes", label: "Primes & charges", perm: "/paie/primes" },
      { to: "/paie/archives", label: "Archives", perm: "/paie/archives" },
    ],
  },
  { grp: "Contrôle", items: [
    { to: "/audit", label: "Audit confidentiel", perm: "/audit" },
    { to: "/bareme", label: "Barème", perm: "/bareme" },
    { to: "/membres", label: "Membres", perm: "/membres" },
    { to: "/journal", label: "Journal d'activité", perm: "/journal" },
    { to: "/api-readme", label: "Fiche API", perm: "/api-readme" },
    { to: "/parametres", label: "Paramètres", perm: "/parametres" },
  ] },
];

export function Layout() {
  const me = useQuery(api.users.me);
  const role = (me?.role ?? "employe") as Role;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">POITIERS COWORKING</div>
        <div className="me">
          {me === undefined ? "…" : me === null ? (
            <span>Non connecté — activer <code>AUTH_DEV_BYPASS</code> et initialiser la démo.</span>
          ) : (<><b>{me.nom ?? me.email}</b>{me.roleLibelle} · niv. {me.niveau}</>)}
        </div>
        {NAV.map((g) => {
          const items = g.items.filter((i) => canAccess(role, i.perm));
          if (!items.length) return null;
          return (
            <div key={g.grp}>
              <div className="grp">{g.grp}</div>
              {items.map((i) => (
                <NavLink key={i.to} to={i.to} end={i.to === "/"} className={({ isActive }) => (isActive ? "active" : "")}>
                  {i.label}
                </NavLink>
              ))}
            </div>
          );
        })}
      </aside>
      <main className="main"><Outlet /></main>
    </div>
  );
}

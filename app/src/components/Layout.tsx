import { NavLink, Outlet } from "react-router-dom";
import { useAuthActions } from "@convex-dev/auth/react";
import { canAccess, Role } from "../../convex/rbac";
import { useMe } from "../auth/useMe";
import "../auth/auth.css";

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
      // `perm` reprend exactement la clé de la route correspondante dans App.tsx :
      // le menu et le garde d'accès lisent ainsi la même ligne de `NIVEAU_MODULE`.
      { to: "/paie/saisie", label: "Récapitulatif salaires", perm: "/paie/saisie" },
      { to: "/paie/liste", label: "Liste des salaires", perm: "/paie/liste" },
      { to: "/paie/bulletins", label: "Bulletins du mois", perm: "/paie/bulletins" },
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
  const me = useMe();
  const { signOut } = useAuthActions();
  // `PortailAuth` garantit qu'on n'arrive ici qu'avec un membre autorisé ; le repli sur
  // "employe" ne sert qu'au bref instant de rechargement d'une session.
  const role = (me?.role ?? "employe") as Role;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">POITIERS COWORKING</div>
        <div className="me">
          {me === undefined ? "…" : me === null ? (
            <span>Session expirée — rechargez la page.</span>
          ) : (
            <div className="auth-moi">
              <b>{me.nom ?? me.email}</b>
              <span>{me.roleLibelle} · niv. {me.niveau}</span>
              <button className="auth-deconnexion" type="button" onClick={() => void signOut()}>
                Se déconnecter
              </button>
            </div>
          )}
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
      <main className="main">
        {/* Tant que AUTH_DEV_BYPASS est actif, TOUTE personne disposant du lien est
            Directeur Général. Le bandeau doit rester visible et déplaisant. */}
        {me?.modeDev && (
          <div className="auth-bandeau-dev">
            Mode développement actif (<code>AUTH_DEV_BYPASS</code>) — toute personne ayant ce lien
            dispose des droits de Directeur Général. À désactiver avant toute diffusion.
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}

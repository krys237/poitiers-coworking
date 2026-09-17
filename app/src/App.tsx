import { BrowserRouter, Routes, Route } from "react-router-dom";
import { PortailAuth, Guard } from "./auth/Guard";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { Employes } from "./pages/Employes";
import { SaisieMensuelle } from "./pages/SaisieMensuelle";
import { Bulletins } from "./pages/Bulletins";
import { Courrier } from "./pages/Courrier";
import { Planning } from "./pages/Planning";
import { Primes } from "./pages/Primes";
import { Archives } from "./pages/Archives";
import { ListeSalaires } from "./pages/ListeSalaires";
import { Financier } from "./pages/Financier";
import { Documents } from "./pages/Documents";
import { Commandes } from "./pages/Commandes";
import { Interventions } from "./pages/Interventions";
import { ComptesRendus } from "./pages/ComptesRendus";
import { Statistiques } from "./pages/Statistiques";
import { Parametres } from "./pages/Parametres";
import { Audit } from "./pages/Audit";
import { Membres } from "./pages/Membres";
import { Journal } from "./pages/Journal";
import { ApiReadme } from "./pages/ApiReadme";
import { Bareme } from "./pages/Bareme";

// Table des routes. `perm` est la clé de `NIVEAU_MODULE` (convex/rbac.ts) qui commande l'accès.
// Jusqu'ici le menu était filtré mais les routes ne l'étaient pas : taper une URL directement
// affichait la page (les données, elles, restaient protégées par le serveur). Chaque route est
// désormais enveloppée d'un `<Guard>`.
//
// AJOUT D'UN ÉCRAN : inscrire la route ici ET son niveau dans `NIVEAU_MODULE`. Une route sans
// entrée dans la matrice est refusée à tout le monde, Directeur Général compris.
const ROUTES: { path: string; perm: string; element: JSX.Element }[] = [
  { path: "/", perm: "/", element: <Dashboard /> },
  { path: "/employes", perm: "/employes", element: <Employes /> },
  { path: "/paie/saisie", perm: "/paie/saisie", element: <SaisieMensuelle /> },
  { path: "/paie/bulletins", perm: "/paie/bulletins", element: <Bulletins /> },
  { path: "/paie/liste", perm: "/paie/liste", element: <ListeSalaires /> },
  { path: "/paie/courrier", perm: "/paie/courrier", element: <Courrier /> },
  { path: "/paie/planning", perm: "/paie/planning", element: <Planning /> },
  { path: "/paie/primes", perm: "/paie/primes", element: <Primes /> },
  { path: "/paie/archives", perm: "/paie/archives", element: <Archives /> },
  { path: "/financier", perm: "/financier", element: <Financier /> },
  { path: "/documents", perm: "/documents", element: <Documents /> },
  { path: "/commandes", perm: "/commandes", element: <Commandes /> },
  { path: "/interventions", perm: "/interventions", element: <Interventions /> },
  { path: "/comptes-rendus", perm: "/comptes-rendus", element: <ComptesRendus /> },
  { path: "/statistiques", perm: "/statistiques", element: <Statistiques /> },
  { path: "/audit", perm: "/audit", element: <Audit /> },
  { path: "/membres", perm: "/membres", element: <Membres /> },
  { path: "/journal", perm: "/journal", element: <Journal /> },
  { path: "/api-readme", perm: "/api-readme", element: <ApiReadme /> },
  { path: "/bareme", perm: "/bareme", element: <Bareme /> },
  { path: "/parametres", perm: "/parametres", element: <Parametres /> },
];

export function App() {
  return (
    <BrowserRouter>
      <PortailAuth>
        <Routes>
          <Route element={<Layout />}>
            {ROUTES.map((r) => (
              <Route key={r.path} path={r.path} element={<Guard perm={r.perm}>{r.element}</Guard>} />
            ))}
          </Route>
        </Routes>
      </PortailAuth>
    </BrowserRouter>
  );
}

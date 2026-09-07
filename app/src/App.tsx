import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { Employes } from "./pages/Employes";
import { SaisieMensuelle } from "./pages/SaisieMensuelle";
import { Bulletins } from "./pages/Bulletins";
import { Courrier } from "./pages/Courrier";
import { Planning } from "./pages/Planning";
import { Primes } from "./pages/Primes";
import { Archives } from "./pages/Archives";
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

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/employes" element={<Employes />} />
          <Route path="/paie/saisie" element={<SaisieMensuelle />} />
          <Route path="/paie/bulletins" element={<Bulletins />} />
          <Route path="/paie/courrier" element={<Courrier />} />
          <Route path="/paie/planning" element={<Planning />} />
          <Route path="/paie/primes" element={<Primes />} />
          <Route path="/paie/archives" element={<Archives />} />
          <Route path="/financier" element={<Financier />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/commandes" element={<Commandes />} />
          <Route path="/interventions" element={<Interventions />} />
          <Route path="/comptes-rendus" element={<ComptesRendus />} />
          <Route path="/statistiques" element={<Statistiques />} />
          <Route path="/audit" element={<Audit />} />
          <Route path="/membres" element={<Membres />} />
          <Route path="/journal" element={<Journal />} />
          <Route path="/api-readme" element={<ApiReadme />} />
          <Route path="/bareme" element={<Bareme />} />
          <Route path="/parametres" element={<Parametres />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

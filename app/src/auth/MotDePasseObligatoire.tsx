/**
 * Première connexion avec le mot de passe provisoire (décision du 13/10/2026) : rien d'autre n'est
 * accessible tant que le membre n'a pas choisi son mot de passe. Même décor que l'écran de connexion.
 */
import { useAuthActions } from "@convex-dev/auth/react";
import { FormulaireMotDePasse } from "./FormulaireMotDePasse";
import type { Membre } from "./useMe";
import logo from "@/assets/logo-polyclinique.png";
import fond from "@/assets/bg-clogin.jpg";
import "./auth.css";

export function MotDePasseObligatoire({ me }: { me: Membre }) {
  const { signOut } = useAuthActions();
  return (
    <div className="auth-scene" style={{ backgroundImage: `url(${fond})` }}>
      <div className="auth-voile" aria-hidden="true" />
      <main className="auth-modale" aria-labelledby="mdp-titre">
        <header className="auth-entete">
          <img src={logo} alt="" className="auth-logo" />
          <div>
            <p className="auth-marque">Polyclinique de Poitiers</p>
            <h1 id="mdp-titre" className="auth-titre">Choisissez votre mot de passe</h1>
          </div>
        </header>
        <p className="auth-aide" style={{ marginBottom: 12 }}>
          Bonjour {me.nom ?? me.email}. Le mot de passe provisoire remis par la Direction ne sert qu'à cette première connexion :
          choisissez le vôtre pour continuer.
        </p>
        <div className="rounded-xl bg-white p-4 text-left">
          <FormulaireMotDePasse provisoire libelleValider="Enregistrer et continuer" />
        </div>
        <p className="auth-pied">
          <button type="button" className="auth-lien" onClick={() => void signOut()}>Se déconnecter</button>
        </p>
      </main>
    </div>
  );
}

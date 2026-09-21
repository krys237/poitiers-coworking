// Écran de connexion : une image en arrière-plan, une modale, un identifiant (e-mail ou
// numéro de téléphone avec indicatif) et un mot de passe. Pas d'inscription ici : les comptes
// sont pré-provisionnés par la Direction (écran Membres) et le rôle est repris à la première
// connexion. L'identifiant du fournisseur ("password") doit correspondre à convex/auth.ts.
import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvex } from "convex/react";
import { EyeIcon, EyeOffIcon, LockKeyholeIcon } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { messageErreur } from "../lib/format";
import { erreurTelephone } from "../../convex/lib/telephone";
import { ChampTelephone } from "@/components/app/champ-telephone";
import logo from "@/assets/logo-polyclinique.png";
import fond from "@/assets/bg-clogin.jpg";
import "./auth.css";

export function Login() {
  const { signIn } = useAuthActions();
  const convex = useConvex();
  // Deux façons de s'identifier ; le choix est mémorisé sur l'appareil.
  const [mode, setMode] = useState<"email" | "telephone">(() => { try { return localStorage.getItem("connexion:mode") === "telephone" ? "telephone" : "email"; } catch { return "email"; } });
  const choisir = (m: "email" | "telephone") => { setMode(m); setErreur(null); try { localStorage.setItem("connexion:mode", m); } catch { /* stockage indisponible : sans effet */ } };
  const [email, setEmail] = useState("");
  const [telephone, setTelephone] = useState("");
  const identifiant = mode === "email" ? email : telephone;
  const [motDePasse, setMotDePasse] = useState("");
  const [voir, setVoir] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  const aideIdentifiant = mode === "telephone" ? erreurTelephone(telephone) : null;

  const connecter = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setErreur(null);
    if (aideIdentifiant) { setErreur(aideIdentifiant); return; }
    setOccupe(true);
    try {
      // Le compte est indexé par e-mail : un numéro de téléphone est d'abord traduit.
      const email = await convex.query(api.users.emailPourIdentifiant, { identifiant: identifiant.trim() });
      if (!email) throw new Error("Identifiant ou mot de passe incorrect.");
      await signIn("password", { email, password: motDePasse, flow: "signIn" });
    } catch (e) {
      const m = messageErreur(e);
      setErreur(/InvalidSecret|InvalidAccountId|incorrect|Invalid/i.test(m) ? "Identifiant ou mot de passe incorrect." : m);
    } finally {
      setOccupe(false);
    }
  };

  return (
    <div className="auth-scene" style={{ backgroundImage: `url(${fond})` }}>
      <div className="auth-voile" aria-hidden="true" />
      <main className="auth-modale" aria-labelledby="auth-titre">
        <header className="auth-entete">
          <img src={logo} alt="" className="auth-logo" />
          <div>
            <p className="auth-marque">Polyclinique de Poitiers</p>
            <h1 id="auth-titre" className="auth-titre">Plateforme de Coworking</h1>
          </div>
        </header>

        <div className="auth-modes" role="tablist" aria-label="Mode de connexion">
          <button type="button" role="tab" aria-selected={mode === "email"} className={mode === "email" ? "actif" : ""} onClick={() => choisir("email")}>Adresse e-mail</button>
          <button type="button" role="tab" aria-selected={mode === "telephone"} className={mode === "telephone" ? "actif" : ""} onClick={() => choisir("telephone")}>Numéro de téléphone</button>
        </div>

        <form className="auth-form" onSubmit={connecter} noValidate>
          {mode === "email" ? (
            <label>
              Adresse e-mail
              <input
                type="email"
                value={email}
                autoComplete="username"
                inputMode="email"
                required
                autoFocus
                onChange={(e) => { setEmail(e.target.value); setErreur(null); }}
                placeholder="prenom.nom@domaine.com"
              />
            </label>
          ) : (
            <label>
              Numéro de téléphone
              <ChampTelephone valeur={telephone} onChange={(v) => { setTelephone(v); setErreur(null); }} autoFocus autoComplete="username" aria-describedby="auth-aide-tel" aria-invalid={aideIdentifiant ? true : undefined} />
              <span id="auth-aide-tel" className={`auth-aide${aideIdentifiant ? " auth-aide-erreur" : ""}`}>
                {aideIdentifiant ?? "Le même numéro que sur WhatsApp : l'indicatif est déjà rempli."}
              </span>
            </label>
          )}
          <label>
            Mot de passe
            <span className="auth-champ-mdp">
              <input
                type={voir ? "text" : "password"}
                value={motDePasse}
                required
                autoComplete="current-password"
                onChange={(e) => { setMotDePasse(e.target.value); setErreur(null); }}
              />
              <button type="button" className="auth-oeil" onClick={() => setVoir((v) => !v)} aria-label={voir ? "Masquer le mot de passe" : "Afficher le mot de passe"} aria-pressed={voir}>
                {voir ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </span>
          </label>

          {erreur && <p className="auth-erreur" role="alert">{erreur}</p>}

          <button className="auth-valider" type="submit" disabled={occupe || !identifiant.trim() || !motDePasse}>
            <LockKeyholeIcon aria-hidden="true" />
            {occupe ? "Connexion…" : "Se connecter"}
          </button>
        </form>

        <p className="auth-pied">
          Les accès sont attribués par la Direction. Mot de passe oublié ou compte manquant : adressez-vous au Directeur Général.
        </p>
      </main>
    </div>
  );
}

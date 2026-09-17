// Écran de connexion : mot de passe, ou code à usage unique reçu par e-mail.
// Les identifiants des fournisseurs ("password", "resend-otp") doivent correspondre
// exactement à ceux déclarés dans convex/auth.ts.
import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { messageErreur } from "../lib/format";
import "./auth.css";

type Onglet = "motdepasse" | "code";
type Flux = "signIn" | "signUp";

export function Login() {
  const { signIn } = useAuthActions();
  const [onglet, setOnglet] = useState<Onglet>("motdepasse");
  const [flux, setFlux] = useState<Flux>("signIn");
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [code, setCode] = useState("");
  const [codeEnvoye, setCodeEnvoye] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  // Enveloppe commune : un seul endroit pour l'état d'attente et la remontée d'erreur.
  const tenter = async (action: () => Promise<void>) => {
    setErreur(null);
    setOccupe(true);
    try {
      await action();
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setOccupe(false);
    }
  };

  const parMotDePasse = (ev: React.FormEvent) => {
    ev.preventDefault();
    void tenter(async () => {
      await signIn("password", { email: email.trim().toLowerCase(), password: motDePasse, flow: flux });
    });
  };

  const demanderCode = (ev: React.FormEvent) => {
    ev.preventDefault();
    void tenter(async () => {
      await signIn("resend-otp", { email: email.trim().toLowerCase() });
      setCodeEnvoye(true);
      setInfo("Code envoyé. Vérifiez votre boîte de réception — il est valable 10 minutes.");
    });
  };

  const validerCode = (ev: React.FormEvent) => {
    ev.preventDefault();
    void tenter(async () => {
      await signIn("resend-otp", { email: email.trim().toLowerCase(), code: code.trim() });
    });
  };

  const changerOnglet = (o: Onglet) => {
    setOnglet(o);
    setErreur(null);
    setInfo(null);
    setCodeEnvoye(false);
    setCode("");
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <p className="auth-marque">POITIERS COWORKING</p>
        <h1 className="auth-titre">
          {onglet === "motdepasse" && flux === "signUp" ? "Créer votre compte" : "Connexion"}
        </h1>

        <div className="auth-onglets" role="tablist">
          <button type="button" role="tab" aria-selected={onglet === "motdepasse"}
            className={onglet === "motdepasse" ? "actif" : ""} onClick={() => changerOnglet("motdepasse")}>
            Mot de passe
          </button>
          <button type="button" role="tab" aria-selected={onglet === "code"}
            className={onglet === "code" ? "actif" : ""} onClick={() => changerOnglet("code")}>
            Code par e-mail
          </button>
        </div>

        {onglet === "motdepasse" && (
          <form className="auth-form" onSubmit={parMotDePasse}>
            <label>
              Adresse e-mail
              <input type="email" value={email} autoComplete="username" required
                onChange={(e) => setEmail(e.target.value)} placeholder="prenom.nom@domaine.com" />
            </label>
            <label>
              Mot de passe
              <input type="password" value={motDePasse} required minLength={8}
                autoComplete={flux === "signUp" ? "new-password" : "current-password"}
                onChange={(e) => setMotDePasse(e.target.value)} />
            </label>
            {flux === "signUp" && <p className="auth-aide">8 caractères minimum, mêlant lettres et chiffres.</p>}
            <button className="auth-valider" type="submit" disabled={occupe || !email || !motDePasse}>
              {occupe ? "…" : flux === "signUp" ? "Créer le compte" : "Se connecter"}
            </button>
            <button type="button" className="auth-lien"
              onClick={() => { setFlux(flux === "signIn" ? "signUp" : "signIn"); setErreur(null); }}>
              {flux === "signIn" ? "Première connexion ? Créer votre compte" : "J'ai déjà un compte"}
            </button>
          </form>
        )}

        {onglet === "code" && !codeEnvoye && (
          <form className="auth-form" onSubmit={demanderCode}>
            <label>
              Adresse e-mail
              <input type="email" value={email} autoComplete="username" required
                onChange={(e) => setEmail(e.target.value)} placeholder="prenom.nom@domaine.com" />
            </label>
            <p className="auth-aide">Un code à 6 chiffres vous sera envoyé. Aucun mot de passe n'est nécessaire.</p>
            <button className="auth-valider" type="submit" disabled={occupe || !email}>
              {occupe ? "…" : "Recevoir un code"}
            </button>
          </form>
        )}

        {onglet === "code" && codeEnvoye && (
          <form className="auth-form" onSubmit={validerCode}>
            <label>
              Code reçu à l'adresse {email}
              <input className="auth-code" value={code} inputMode="numeric" autoComplete="one-time-code"
                pattern="[0-9]*" maxLength={6} required placeholder="000000"
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
            </label>
            <button className="auth-valider" type="submit" disabled={occupe || code.length < 6}>
              {occupe ? "…" : "Valider le code"}
            </button>
            <button type="button" className="auth-lien" onClick={() => { setCodeEnvoye(false); setCode(""); setInfo(null); }}>
              Changer d'adresse ou demander un nouveau code
            </button>
          </form>
        )}

        {info && <p className="auth-info">{info}</p>}
        {erreur && <p className="auth-erreur">{erreur}</p>}

        <p className="auth-pied">
          Les accès sont attribués par la Direction. Si votre compte vient d'être créé,
          il peut devoir être autorisé avant de vous donner accès aux modules.
        </p>
      </div>
    </div>
  );
}

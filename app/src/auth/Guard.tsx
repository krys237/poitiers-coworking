// Portail d'authentification et garde des routes.
//
// Deux composants, deux rôles distincts :
//  - `<PortailAuth>` décide s'il faut afficher l'application, l'écran de connexion
//    ou l'écran d'attente. Il enveloppe TOUTE l'application (voir App.tsx).
//  - `<Guard perm="/x">` vérifie qu'un membre déjà connecté a le droit d'ouvrir CE module.
//
// Le portail se fonde sur `users.me` (l'avis du serveur) et non sur l'état de session de
// Convex Auth : c'est ce qui permet au mode `AUTH_DEV_BYPASS` de continuer à fonctionner,
// puisqu'il produit un membre sans jamais ouvrir de session côté client.
import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuthActions } from "@convex-dev/auth/react";
import { canAccess, NIVEAU_MODULE, Role } from "../../convex/rbac";
import { useMe } from "./useMe";
import { Login } from "./Login";
import "./auth.css";

function Patiente({ message }: { message: string }) {
  return (
    <div className="auth-page">
      <div className="auth-card auth-centre">
        <p className="auth-marque">POITIERS COWORKING</p>
        <p className="auth-attente-texte">{message}</p>
      </div>
    </div>
  );
}

/** Compte créé mais pas encore autorisé par un Directeur Général. */
function EnAttente({ email }: { email: string }) {
  const { signOut } = useAuthActions();
  return (
    <div className="auth-page">
      <div className="auth-card auth-centre">
        <p className="auth-marque">POITIERS COWORKING</p>
        <h1 className="auth-titre">Compte en attente d'autorisation</h1>
        <p className="auth-attente-texte">
          Votre compte <b>{email}</b> a bien été créé, mais aucun accès ne lui a encore été attribué.
          Un Directeur Général doit vous autoriser et choisir votre niveau depuis l'écran « Membres ».
        </p>
        <p className="auth-aide">Cette page se mettra à jour d'elle-même dès que ce sera fait.</p>
        <button className="auth-lien" type="button" onClick={() => void signOut()}>Se déconnecter</button>
      </div>
    </div>
  );
}

/** Accès refusé à un module précis (le membre est bien connecté, mais son niveau ne suffit pas). */
function Refuse({ module }: { module: string }) {
  const requis = NIVEAU_MODULE[module];
  return (
    <div className="auth-refus">
      <h1>Accès refusé</h1>
      <p>
        Ce module est réservé à un niveau d'habilitation supérieur
        {requis !== undefined ? ` (niveau ${requis} minimum)` : ""}. Si vous pensez devoir y accéder,
        demandez à la Direction de relever votre niveau.
      </p>
    </div>
  );
}

/**
 * `/connexion` : l'écran de connexion, même quand le bypass de développement est actif.
 * Une session réelle prime sur le bypass (`getCurrentUser` regarde d'abord Convex Auth) :
 * dès qu'elle est ouverte, on renvoie à l'accueil. Se déconnecter ramène au compte « dev ».
 */
export function PageConnexion() {
  const me = useMe();
  if (me === undefined) return <Patiente message="Vérification de votre session…" />;
  if (me && !me.modeDev) return <Navigate to="/" replace />;
  return <Login />;
}

/**
 * Enveloppe toute l'application : connexion, attente d'autorisation, ou contenu.
 */
export function PortailAuth({ children }: { children: ReactNode }) {
  const me = useMe();
  if (me === undefined) return <Patiente message="Vérification de votre session…" />;
  if (me === null) return <Login />;
  if (me.enAttente) return <EnAttente email={me.email} />;
  return <>{children}</>;
}

/**
 * Garde d'un module. `perm` est une clé de `NIVEAU_MODULE` (convex/rbac.ts).
 *
 * ⚠️ Toute route doit avoir une entrée dans `NIVEAU_MODULE` : une clé absente est refusée
 * à TOUT LE MONDE, Directeur Général compris (`canAccess` renvoie false si le niveau requis
 * est `undefined`). C'est volontaire — mieux vaut fermer une route oubliée que l'ouvrir.
 */
export function Guard({ perm, children }: { perm: string; children: ReactNode }) {
  const me = useMe();
  // `PortailAuth` a déjà traité les cas « chargement » et « non connecté » en amont ;
  // ce garde-fou couvre le cas où la session tombe pendant la navigation.
  if (me === undefined) return <Patiente message="Chargement…" />;
  if (me === null) return <Login />;
  return canAccess(me.role as Role, perm) ? <>{children}</> : <Refuse module={perm} />;
}

import React from "react";
import ReactDOM from "react-dom/client";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { App } from "./App";
import "./styles.css";

const convexUrl =
  (import.meta.env.VITE_CONVEX_URL as string) ||
  "https://wonderful-shark-673.eu-west-1.convex.cloud";

const rootEl = document.getElementById("root")!;

try {
  const convex = new ConvexReactClient(convexUrl);

  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      {/* ConvexAuthProvider remplace ConvexProvider : lui seul joint le jeton d'authentification
          aux requêtes. Avec un simple ConvexProvider, l'application resterait déconnectée en
          silence, sans la moindre erreur — c'est le piège classique de cette mise en place.
          Les jetons sont conservés dans localStorage (comportement par défaut). */}
      <ConvexAuthProvider client={convex}>
        <App />
      </ConvexAuthProvider>
    </React.StrictMode>
  );
} catch (err: any) {
  ReactDOM.createRoot(rootEl).render(
    <div style={{ padding: "40px", fontFamily: "system-ui, sans-serif", maxWidth: "600px", margin: "40px auto", background: "#fff", border: "1px solid #d6ded4", borderRadius: "10px" }}>
      <h2 style={{ color: "#b23b3b", marginTop: 0 }}>Erreur de configuration Convex</h2>
      <p>Impossible de se connecter au backend Convex :</p>
      <pre style={{ background: "#f4f6f3", padding: "12px", borderRadius: "6px", color: "#16222e" }}>{err?.message || String(err)}</pre>
      <p style={{ fontSize: "13px", color: "#48586a" }}>Vérifiez que la variable <code>VITE_CONVEX_URL</code> est bien définie dans votre fichier <code>.env.local</code>.</p>
    </div>
  );
}

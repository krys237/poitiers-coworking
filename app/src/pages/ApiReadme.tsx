import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { ENTITES } from "../../convex/lib/apiSecurite";

const SITE = (import.meta.env.VITE_CONVEX_SITE_URL as string) || "https://<deployment>.convex.site";
const CODES: [string, string, string][] = [
  ["200", "Succès", "—"], ["400", "Date invalide ou entité inconnue", "Corriger les paramètres"], ["401", "Clé absente ou invalide", "Vérifier l'en-tête X-Api-Key"],
  ["403", "IP non autorisée (proxy)", "Ajouter l'IP à ALLOWED_IPS"], ["404", "Aucune journée saisie à cette date", "Vérifier le grand livre"],
  ["429", "Quota dépassé (proxy)", "Attendre Retry-After ou augmenter RATE_LIMIT_RPM"], ["502", "Backend injoignable (proxy)", "Vérifier CONVEX_SITE_URL"], ["503", "Clé non configurée côté backend", "npx convex env set FINANCIAL_API_KEY …"],
];
const couleur = (s?: number) => (s === undefined ? "" : s < 300 ? "" : s < 500 ? "warn" : "lock");

export function ApiReadme() {
  const etat = useQuery(api.journal.etatApi);
  return (
    <>
      <h1>Fiche API — export financier</h1>
      <p className="sub">Exposition sécurisée du grand livre journalier à des systèmes tiers (comptabilité, BI). Deux couches : proxy Node.js (IP · clé · rate-limit) puis backend qui re-valide la clé.</p>

      <div className="cards">
        <div className="card"><div className="k">Clé backend</div><div className="v">{etat === undefined ? "…" : etat.cleConfiguree ? <span className="badge">configurée</span> : <span className="badge lock">absente</span>}</div></div>
        <div className="card"><div className="k">Appels sur 7 jours</div><div className="v">{etat?.appels7j ?? "…"}</div></div>
        <div className="card"><div className="k">Derniers statuts</div><div className="v" style={{ fontSize: 15 }}>{etat ? Object.entries(etat.parStatut).map(([s, n]) => <span key={s} className={`badge ${couleur(+s)}`} style={{ marginRight: 4 }}>{s} ×{n as number}</span>) : "…"}</div></div>
        <div className="card"><div className="k">Version</div><div className="v">v2.0 · 8 entités</div></div>
      </div>

      <div className="panel">
        <h3 style={{ margin: "0 0 8px" }}>Requête type</h3>
        <pre style={{ background: "var(--navy)", color: "#dce6f1", padding: 12, borderRadius: 8, overflowX: "auto", fontSize: 12 }}>{`# via le proxy (recommandé)
curl "http://VOTRE-PROXY:3100/api/financial?date=2026-09-07&entity=poitiers,lilas" -H "X-Api-Key: <clé>"

# directement sur le backend (réseau privé uniquement)
curl "${SITE}/api/financial?date=2026-09-07" -H "X-Api-Key: <clé>"

# JavaScript
const r = await fetch("${SITE}/api/financial?date=2026-09-07&entity=poitiers", { headers: { "X-Api-Key": process.env.FINANCIAL_API_KEY } });
const data = await r.json(); // { date, periode, cloture, entites, soldesOuverture, soldes, recetteTotale }`}</pre>
        <div className="meta-grid" style={{ marginTop: 10 }}>
          <div><b>date</b> requis · YYYY-MM-DD</div>
          <div><b>entity</b> optionnel · {ENTITES.join(" | ")} · plusieurs séparées par des virgules ; absent = toutes</div>
          <div><b>Réponse</b> date, periode, cloture, entites{"{"}libelle, lignes, entrees, retraits, net{"}"}, soldesOuverture, soldes, recetteTotale</div>
          <div><b>En-têtes</b> Cache-Control: no-store · X-Content-Type-Options: nosniff</div>
          <div><b>Santé</b> GET /health (backend et proxy)</div>
        </div>
      </div>

      <div className="panel">
        <h3 style={{ margin: "0 0 8px" }}>Codes de réponse</h3>
        <div className="tbl-wrap"><table className="grid"><thead><tr><th>Code</th><th>Signification</th><th>Action</th></tr></thead>
          <tbody>{CODES.map(([c, s, a]) => <tr key={c}><td><b>{c}</b></td><td>{s}</td><td>{a}</td></tr>)}</tbody></table></div>
      </div>

      <div className="panel">
        <h3 style={{ margin: "0 0 8px" }}>Proxy Node.js (dossier <code>app/api-proxy/</code>)</h3>
        <div className="meta-grid">
          <div><b>server.mjs</b> serveur (liste blanche IP, clé en temps constant, rate-limit, en-têtes, logs JSON, relais)</div>
          <div><b>lib.mjs</b> logique pure testée (<code>npm run test:proxy</code>)</div>
          <div><b>.env.example</b> PROXY_PORT · CONVEX_SITE_URL · FINANCIAL_API_KEY · ALLOWED_IPS · RATE_LIMIT_RPM</div>
          <div><b>README.md</b> démarrage, PM2, HTTPS (Nginx/Caddy), rotation de clé</div>
        </div>
        <p className="sub" style={{ margin: "8px 0 0" }}>Générer une clé : <code>node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"</code> puis <code>npx convex env set FINANCIAL_API_KEY &lt;clé&gt;</code> et la même valeur dans le <code>.env</code> du proxy. La clé n'est jamais affichée ici.</p>
      </div>

      <div className="panel">
        <h3 style={{ margin: "0 0 8px" }}>20 derniers appels</h3>
        <div className="tbl-wrap"><table className="grid">
          <thead><tr><th>Date</th><th>Statut</th><th>Date demandée</th><th>Détail</th><th>IP</th></tr></thead>
          <tbody>
            {(etat?.derniers ?? []).map((d: any) => <tr key={d._id}><td style={{ whiteSpace: "nowrap" }}>{new Date(d.date).toLocaleString("fr-FR")}</td><td><span className={`badge ${couleur(d.statut)}`}>{d.statut}</span></td><td>{d.cible ?? "—"}</td><td>{d.detail ?? "—"}</td><td>{d.ip ?? "—"}</td></tr>)}
            {etat && etat.derniers.length === 0 && <tr><td colSpan={5}>Aucun appel journalisé.</td></tr>}
          </tbody>
        </table></div>
      </div>
    </>
  );
}

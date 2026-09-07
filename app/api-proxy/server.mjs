#!/usr/bin/env node
// Proxy sécurisé de l'API financière POITIERS COWORKING — aucune dépendance npm (Node ≥ 18).
// Couche 1 : liste blanche IP · clé API (temps constant) · rate-limit par IP · en-têtes de sécurité · logs JSON.
// Couche 2 (backend Convex, /api/financial) : re-validation de la clé.
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { comparaisonConstante, creerAllowlist, creerRateLimiter, chargerEnv, normaliserIp } from "./lib.mjs";

const ici = dirname(fileURLToPath(import.meta.url));
const env = { ...chargerEnv(join(ici, ".env")), ...process.env };
const PORT = Number(env.PROXY_PORT || 3100);
const CIBLE = String(env.CONVEX_SITE_URL || "").replace(/\/$/, "");
const CLE = env.FINANCIAL_API_KEY || "";
const allow = creerAllowlist(env.ALLOWED_IPS);
const limiteur = creerRateLimiter(env.RATE_LIMIT_RPM || 30);

if (!CIBLE || !CLE) { console.error(JSON.stringify({ niveau: "fatal", msg: "CONVEX_SITE_URL et FINANCIAL_API_KEY sont requis (fichier .env)" })); process.exit(1); }

const log = (obj) => console.log(JSON.stringify({ ts: new Date().toISOString(), ...obj }));
const SECURITE = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "no-referrer", "Content-Type": "application/json; charset=utf-8" };
const repondre = (res, statut, corps, extra = {}) => { res.writeHead(statut, { ...SECURITE, ...extra }); res.end(JSON.stringify(corps)); };

const serveur = createServer(async (req, res) => {
  const debut = Date.now();
  const url = new URL(req.url ?? "/", "http://proxy");
  const ip = normaliserIp((req.headers["x-forwarded-for"] ?? "").toString().split(",")[0] || req.socket.remoteAddress);
  const fin = (statut, extra = {}) => log({ ip, methode: req.method, chemin: url.pathname, entity: url.searchParams.get("entity"), date: url.searchParams.get("date"), statut, ms: Date.now() - debut, ...extra });

  if (url.pathname === "/health") { repondre(res, 200, { status: "ok", service: "POITIERS COWORKING — API Proxy", cible: CIBLE, allowlist: allow.taille, rpm: limiteur.max }); return fin(200); }
  if (req.method !== "GET" || url.pathname !== "/api/financial") { repondre(res, 404, { erreur: "Route inconnue" }); return fin(404); }
  if (!allow.permet(ip)) { repondre(res, 403, { erreur: "IP non autorisée" }); return fin(403, { raison: "allowlist" }); }
  const cle = (req.headers["x-api-key"] ?? "").toString();
  if (!cle || !comparaisonConstante(cle, CLE)) { repondre(res, 401, { erreur: "Clé API manquante ou invalide" }); return fin(401, { raison: "cle" }); }
  const rl = limiteur.autorise(ip);
  if (!rl.ok) { repondre(res, 429, { erreur: "Quota dépassé", retryAfterSeconds: rl.retryAfter }, { "Retry-After": String(rl.retryAfter) }); return fin(429, { raison: "rate-limit" }); }

  try {
    const r = await fetch(`${CIBLE}/api/financial?${url.searchParams.toString()}`, { headers: { "X-Api-Key": CLE, "X-Forwarded-For": ip } });
    const corps = await r.text();
    res.writeHead(r.status, { ...SECURITE, "X-RateLimit-Remaining": String(rl.restant) });
    res.end(corps);
    fin(r.status, { relais: true });
  } catch (e) {
    repondre(res, 502, { erreur: "Backend injoignable", detail: String(e?.message ?? e) });
    fin(502, { raison: "backend" });
  }
});

serveur.listen(PORT, () => log({ msg: `Proxy API financière à l'écoute sur :${PORT}`, cible: CIBLE, allowlist: allow.taille, rpm: limiteur.max }));

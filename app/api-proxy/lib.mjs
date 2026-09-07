// Logique pure du proxy (testable) : comparaison en temps constant, liste blanche IP, rate-limit glissant, lecture .env.
import { readFileSync } from "node:fs";

export function comparaisonConstante(a, b) {
  const ea = Buffer.from(String(a ?? ""), "utf8"), eb = Buffer.from(String(b ?? ""), "utf8");
  const n = Math.max(ea.length, eb.length);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < n; i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}

// ALLOWED_IPS="1.2.3.4, 10.0.0.5" ; vide = pas de restriction. Les préfixes IPv4-mappés (::ffff:) sont normalisés.
export function normaliserIp(ip) { return String(ip ?? "").replace(/^::ffff:/, "").trim(); }
export function creerAllowlist(str) {
  const set = new Set(String(str ?? "").split(",").map((s) => normaliserIp(s)).filter(Boolean));
  return { taille: set.size, permet: (ip) => set.size === 0 || set.has(normaliserIp(ip)) };
}

// Rate-limit par IP : au plus `rpm` requêtes par fenêtre glissante de 60 s.
export function creerRateLimiter(rpm) {
  const max = Math.max(1, Number(rpm) || 30);
  const fenetres = new Map(); // ip -> horodatages (ms) des requêtes récentes
  return {
    autorise(ip, now = Date.now()) {
      const cle = normaliserIp(ip);
      const recents = (fenetres.get(cle) ?? []).filter((t) => now - t < 60000);
      if (recents.length >= max) { fenetres.set(cle, recents); return { ok: false, restant: 0, retryAfter: Math.ceil((60000 - (now - recents[0])) / 1000) }; }
      recents.push(now); fenetres.set(cle, recents);
      return { ok: true, restant: max - recents.length, retryAfter: 0 };
    },
    max,
  };
}

// Lecture minimale d'un fichier .env (KEY=VALUE, # commentaires, guillemets optionnels) — sans dépendance.
export function chargerEnv(chemin) {
  const out = {};
  let texte = "";
  try { texte = readFileSync(chemin, "utf8"); } catch { return out; }
  for (const ligne of texte.split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i.exec(ligne);
    if (!m || ligne.trim().startsWith("#")) continue;
    out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

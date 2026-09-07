// Tests de la logique pure du proxy : `npm run test:proxy`.
import { comparaisonConstante, creerAllowlist, creerRateLimiter, normaliserIp } from "../api-proxy/lib.mjs";

let echecs = 0;
const check = (nom: string, cond: boolean, d?: unknown) => { if (cond) console.log(`  ok  ${nom}`); else { console.error(`  KO  ${nom}`, d ?? ""); echecs++; } };

check("clé égale", comparaisonConstante("k1", "k1") && !comparaisonConstante("k1", "k2") && !comparaisonConstante("k1", "k11"));
check("ip normalisée", normaliserIp("::ffff:10.0.0.5") === "10.0.0.5");
const a = creerAllowlist("10.0.0.5, 192.168.1.10");
check("allowlist : autorisée / refusée", a.permet("10.0.0.5") && a.permet("::ffff:192.168.1.10") && !a.permet("8.8.8.8"));
check("allowlist vide = tout passe", creerAllowlist("").permet("8.8.8.8"));
const rl = creerRateLimiter(3);
const t0 = 1_000_000;
const r1 = rl.autorise("1.1.1.1", t0), r2 = rl.autorise("1.1.1.1", t0 + 10), r3 = rl.autorise("1.1.1.1", t0 + 20), r4 = rl.autorise("1.1.1.1", t0 + 30);
check("rate-limit : 3 ok puis refus", r1.ok && r2.ok && r3.ok && !r4.ok && r4.retryAfter > 0, { r1, r4 });
check("rate-limit : autre IP indépendante", rl.autorise("2.2.2.2", t0 + 40).ok);
check("rate-limit : fenêtre glissante libère", rl.autorise("1.1.1.1", t0 + 60001).ok);

if (echecs) { console.error(`\n${echecs} test(s) en échec`); process.exit(1); } else console.log("\nTous les tests passent.");

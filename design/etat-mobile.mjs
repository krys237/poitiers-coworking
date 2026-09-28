// État des lieux mobile : chaque écran à 390 px (compte DG), débordement horizontal mesuré, capture par écran.
// Usage (serveur de dev sur 5199) : node design/etat-mobile.mjs <dossier des captures>
import { chromium } from "playwright";
const BASE = "http://localhost:5199", S = process.argv[2];
const ROUTES = ["/", "/financier", "/documents", "/comptes-rendus", "/mes-bulletins", "/commandes", "/interventions", "/statistiques", "/employes", "/paie/saisie", "/paie/liste", "/paie/bulletins", "/paie/courrier", "/paie/planning", "/paie/primes", "/paie/archives", "/audit", "/bareme", "/membres", "/journal", "/parametres"];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
await page.goto(`${BASE}/connexion`, { waitUntil: "networkidle" }); await page.waitForTimeout(2000);
await page.locator('input[autocomplete="username"]').first().fill("dg.test@poitiers.local");
await page.locator('input[type="password"]').first().fill("Poitiers2026");
await page.getByRole("button", { name: /Se connecter/ }).click();
await page.waitForURL((u) => !u.pathname.startsWith("/connexion"), { timeout: 20000 });
for (const r of ROUTES) {
  await page.goto(`${BASE}${r}`, { waitUntil: "networkidle" }); await page.waitForTimeout(3500);
  const m = await page.evaluate(() => {
    const doc = document.documentElement.scrollWidth;
    // Éléments qui dépassent la largeur de l'écran (hors conteneurs à défilement horizontal voulu).
    const larges = [...document.querySelectorAll("main *")].filter((e) => {
      const b = e.getBoundingClientRect(); if (b.width < 1 || b.right <= window.innerWidth + 1) return false;
      let p = e.parentElement; while (p) { const o = getComputedStyle(p).overflowX; if (o === "auto" || o === "scroll" || o === "hidden") return false; p = p.parentElement; } return true;
    });
    const hauteur = document.documentElement.scrollHeight;
    return { doc, debord: larges.length, exemple: larges.slice(0, 2).map((e) => `${e.tagName.toLowerCase()}.${String(e.className).split(" ").slice(0, 2).join(".")}`), hauteur };
  });
  const nom = r === "/" ? "accueil" : r.slice(1).replace(/\//g, "-");
  await page.screenshot({ path: `${S}/${nom}.png` });
  console.log(`${r.padEnd(17)} largeur ${m.doc} ${m.doc > 391 ? "DÉBORDE" : "ok     "} · éléments hors écran ${String(m.debord).padStart(3)} ${m.exemple.join(" ")}`);
}
await browser.close();

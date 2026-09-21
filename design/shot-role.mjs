// Capture d'une page vue par un compte de test : node ./design/shot-role.mjs <email> <motDePasse> <chemin> <png>
import { chromium } from "playwright";
const [email, mdp, chemin, out] = process.argv.slice(2);
const BASE = process.env.BASE || "http://localhost:5199";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`${BASE}/connexion`, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
await page.locator('input[type="email"]').first().fill(email);
await page.locator('input[type="password"]').first().fill(mdp);
await page.getByRole("button", { name: /Se connecter/ }).click();
await page.waitForURL((u) => !u.pathname.startsWith("/connexion"), { timeout: 20000 }).catch(() => {});
await page.goto(`${BASE}${chemin}`, { waitUntil: "networkidle" });
await page.waitForTimeout(Number(process.env.WAIT || 5000));
await page.screenshot({ path: out });
console.log("ok", page.url());
await browser.close();

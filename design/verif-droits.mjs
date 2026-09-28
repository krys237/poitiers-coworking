// Vérifie, par compte de test, le menu et l'accès (refusé / voir seulement / voir + faire) aux modules.
// Lecture seule : ne modifie aucune donnée. Serveur de dev sur 5199 : node ./design/verif-droits.mjs
import { chromium } from "playwright";
const BASE = "http://localhost:5199";
const S = process.env.S;
const CAS = {
  dg: ["/parametres?onglet=roles", "/paie/bulletins", "/audit"],
  comptable: ["/financier", "/employes", "/paie/bulletins", "/commandes"],
  auditeur: ["/paie/bulletins", "/financier", "/membres", "/parametres", "/documents", "/journal", "/paie/archives", "/comptes-rendus", "/audit"],
  employe: ["/", "/financier", "/comptes-rendus"],
};
const browser = await chromium.launch();
for (const [role, chemins] of Object.entries(CAS)) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const erreurs = [];
  page.on("pageerror", (e) => erreurs.push(e.message.slice(0, 160)));
  page.on("console", (m) => { if (m.type() === "error") erreurs.push(m.text().slice(0, 900)); });
  await page.goto(`${BASE}/connexion`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.locator('input[autocomplete="username"]').first().fill(`${role}.test@poitiers.local`);
  await page.locator('input[type="password"]').first().fill("Poitiers2026");
  await page.getByRole("button", { name: /Se connecter/ }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/connexion"), { timeout: 20000 });
  await page.waitForTimeout(3000);
  const menu = (await page.locator("aside nav").first().innerText().catch(() => "")).split("\n").filter((x) => x && x === x.trim() && !/^[A-ZÉ ]+$/.test(x));
  console.log(`\n=== ${role} — menu : ${menu.join(" | ")}`);
  for (const c of chemins) {
    await page.goto(`${BASE}${c}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(3500);
    const t = await page.locator("main").first().innerText().catch(() => "");
    const partiel = await page.locator("[data-droits=voir]").count();
    const etat = t.includes("Accès refusé") ? "REFUSÉ" : partiel ? "voir seulement" : "ouvert (voir + faire)";
    console.log(`  ${c.padEnd(26)} ${etat}`);
    if (S && role === "dg" && c.includes("roles")) await page.screenshot({ path: `${S}/matrice.png`, fullPage: true });
    if (S && role === "auditeur" && c === "/paie/bulletins") await page.screenshot({ path: `${S}/auditeur-bulletins.png` });
  }
  if (erreurs.length) console.log("  erreurs console :", [...new Set(erreurs)].slice(0, 5));
  await page.close();
}
await browser.close();

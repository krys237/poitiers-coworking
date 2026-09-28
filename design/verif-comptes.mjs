// Vérifie les huit comptes de test un par un : connexion, rôle affiché, nombre d'entrées de menu.
// Lecture seule. Serveur de dev sur 5199 : node ./design/verif-comptes.mjs
import { chromium } from "playwright";
const BASE = process.env.BASE || "http://localhost:5199";
const COMPTES = ["employe", "chef", "comptable", "rh", "daf", "dg", "superadmin", "auditeur"];
const browser = await chromium.launch();
for (const c of COMPTES) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${BASE}/connexion`, { waitUntil: "networkidle" }); await page.waitForTimeout(1500);
  await page.locator('input[autocomplete="username"]').first().fill(`${c}.test@poitiers.local`);
  await page.locator('input[type="password"]').first().fill(process.env.MDP || "Poitiers2026");
  await page.getByRole("button", { name: /Se connecter/ }).click();
  try {
    await page.waitForURL((u) => !u.pathname.startsWith("/connexion"), { timeout: 15000 });
    await page.waitForTimeout(2500);
    const aside = (await page.locator("aside").first().innerText()).split("\n").map((x) => x.trim()).filter(Boolean);
    const role = aside.find((l) => /niv\.|Auditeur|hors/.test(l)) ?? "?";
    const menu = (await page.locator("aside nav a").allInnerTexts()).filter(Boolean).length;
    console.log(`OK  ${c.padEnd(11)} ${role.padEnd(44)} ${menu} entrées de menu`);
  } catch {
    console.log(`KO  ${c.padEnd(11)} ${(await page.locator("[role=alert], .auth-erreur").first().innerText().catch(() => "connexion impossible")).slice(0, 80)}`);
  }
  await page.close();
}
await browser.close();

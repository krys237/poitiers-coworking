// Crée le mot de passe des comptes de test (un par rôle) via le formulaire de connexion,
// exactement comme le ferait un utilisateur : /connexion → « Créer votre compte ».
// Usage : node ./design/comptes-test.mjs [motDePasse]   (défaut : Poitiers2026)
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://localhost:5199";
const MOT_DE_PASSE = process.argv[2] || "Poitiers2026";
const COMPTES = ["employe", "chef", "comptable", "rh", "daf", "dg", "superadmin", "auditeur"].map((id) => `${id}.test@poitiers.local`);

const browser = await chromium.launch();
for (const email of COMPTES) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/connexion`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  await page.getByRole("button", { name: /Créer votre compte/ }).click();
  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(MOT_DE_PASSE);
  await page.getByRole("button", { name: /Créer le compte/ }).click();
  // Session ouverte → redirection vers l'accueil ; le nom du profil apparaît en bas de la barre latérale.
  try {
    await page.waitForURL((u) => !u.pathname.startsWith("/connexion"), { timeout: 15000 });
    await page.waitForTimeout(2500);
    const profil = await page.locator("aside").first().innerText().catch(() => "");
    console.log(`ok  ${email}  →  ${profil.split("\n").filter(Boolean).slice(-2).join(" · ")}`);
  } catch {
    const err = await page.locator(".auth-erreur, [role=alert]").first().innerText().catch(() => "sans message");
    console.log(`KO  ${email}  →  ${err}`);
  }
  await ctx.close();
}
await browser.close();

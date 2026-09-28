// Jeu d'impression pour la validation papier du directeur : 3 bulletins, la liste des salaires et un
// courrier de paie (lettre + bulletin), imprimés par l'application elle-même (feuilles d'impression A4),
// puis réunis en un seul PDF.
// Usage (serveur de dev lancé sur 5199) : node ./design/jeu-impression.mjs [periode AAAA-MM] [sortie.pdf]
import { chromium } from "playwright";
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";

const require = createRequire(new URL("../app/package.json", import.meta.url));
const { PDFDocument } = require("pdf-lib");

const BASE = process.env.BASE || "http://localhost:5199";
const PERIODE = process.argv[2] || "2026-09";
const SORTIE = process.argv[3] || `jeu-impression-directeur-${PERIODE}.pdf`;
const COMPTE = process.env.COMPTE || "dg.test@poitiers.local";
const MDP = process.env.MDP || "Poitiers2026";
// Cas choisis : référence du format de paie (E001), cadre à IRPP élevé (E008), autres retenues (E009).
const BULLETINS = (process.env.BULLETINS || "E001,E008,E009").split(",");
const COURRIER_POUR = process.env.COURRIER || "ABAMI Rosine Belie";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`${BASE}/connexion`, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
await page.locator('input[autocomplete="username"]').first().fill(COMPTE);
await page.locator('input[type="password"]').first().fill(MDP);
await page.getByRole("button", { name: /Se connecter/ }).click();
await page.waitForURL((u) => !u.pathname.startsWith("/connexion"), { timeout: 20000 });

const pdfs = [];
async function imprimer(libelle) {
  await page.emulateMedia({ media: "print" });
  pdfs.push({ libelle, octets: await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true }) });
  await page.emulateMedia({ media: "screen" });
  console.log("ok", libelle);
}
async function ouvrir(chemin) {
  await page.goto(`${BASE}${chemin}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(Number(process.env.WAIT || 5000));
}

for (const matricule of BULLETINS) {
  await ouvrir(`/paie/bulletins?periode=${PERIODE}&employe=${matricule}`);
  await imprimer(`bulletin ${matricule}`);
}

await ouvrir(`/paie/liste?periode=${PERIODE}`);
await imprimer("liste des salaires");

await ouvrir(`/paie/courrier?periode=${PERIODE}`);
await page.getByRole("checkbox", { name: "Sélectionner les lignes affichées" }).click();
await page.waitForTimeout(300);
if (await page.getByRole("checkbox", { name: "Sélectionner les lignes affichées" }).getAttribute("data-state") === "checked")
  await page.getByRole("checkbox", { name: "Sélectionner les lignes affichées" }).click();
await page.getByRole("checkbox", { name: `Sélectionner ${COURRIER_POUR}` }).click();
await page.waitForTimeout(500);
await imprimer(`courrier ${COURRIER_POUR}`);
await browser.close();

const jeu = await PDFDocument.create();
for (const { libelle, octets } of pdfs) {
  const src = await PDFDocument.load(octets);
  const pages = await jeu.copyPages(src, src.getPageIndices());
  pages.forEach((p) => jeu.addPage(p));
  console.log(`  ${libelle} : ${pages.length} page(s)`);
}
jeu.setTitle(`Jeu d'impression — validation papier — ${PERIODE}`);
writeFileSync(SORTIE, await jeu.save());
console.log("pdf ok", SORTIE, jeu.getPageCount(), "pages");

// PDF d'un fichier HTML local : node ./design/print-file.mjs <chemin.html> <sortie.pdf>
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
const [file, out] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(pathToFileURL(file).href, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.pdf({ path: out, format: "A4", printBackground: true, preferCSSPageSize: true });
await browser.close();
console.log("pdf ok");

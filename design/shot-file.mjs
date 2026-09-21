// Capture d'un fichier HTML local : node ./design/shot-file.mjs <chemin.html> <png>
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
const [file, out] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
await page.goto(pathToFileURL(file).href, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.screenshot({ path: out, fullPage: false });
await browser.close();
console.log("ok");

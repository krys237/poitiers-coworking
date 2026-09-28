// PDF d'un fichier HTML local : node ./design/print-file.mjs <chemin.html> <sortie.pdf>
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
const [file, out] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(pathToFileURL(file).href, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
// PIED (facultatif) : texte du pied de page, répété sur chaque page avec « page n / N » — un élément
// position:fixed dans le HTML chevauchait le haut des pages suivantes.
const pied = process.env.PIED;
await page.pdf({
  path: out, format: "A4", printBackground: true, preferCSSPageSize: true,
  ...(pied ? {
    displayHeaderFooter: true, headerTemplate: "<span></span>",
    footerTemplate: `<div style="width:100%;margin:0 14mm;display:flex;justify-content:space-between;font-family:'Segoe UI',sans-serif;font-size:7pt;color:#64748b"><span>${pied.replace(/[<&]/g, "")}</span><span>page <span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
  } : {}),
});
await browser.close();
console.log("pdf ok");

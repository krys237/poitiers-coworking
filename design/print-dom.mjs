import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(process.argv[2], { waitUntil: "networkidle" });
await page.waitForTimeout(8000);
await page.emulateMedia({ media: "print" });
console.log(await page.evaluate(() => {
  const r = document.querySelector(".doc-entete .raison");
  const aside = document.querySelector("aside");
  return JSON.stringify({ raison: r?.innerHTML, asideDisplay: aside ? getComputedStyle(aside).display : null, asideClass: aside?.className });
}));
await browser.close();

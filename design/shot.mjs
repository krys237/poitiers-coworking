import { chromium } from "playwright";
const [url, out, tab, clic] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const logs = [];
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") logs.push(m.type() + ": " + m.text().slice(0, 300)); });
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(4000);
if (tab) { const t = page.getByRole("tab", { name: new RegExp(tab, "i") }); if (await t.count()) { await t.first().click(); await page.waitForTimeout(2500); } }
if (clic) { await page.getByText(clic, { exact: false }).first().click(); await page.waitForTimeout(1500); }
await page.screenshot({ path: out, fullPage: false });
console.log("title:", await page.title());
console.log("body:", (await page.locator("body").innerText()).slice(0, 400).replace(/\n+/g, " | "));
console.log(logs.slice(0, 8).join("\n"));
await browser.close();

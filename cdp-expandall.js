const { chromium } = require('playwright');
const path = require('path');
const APP = 'poitiers-coworking-366166.onhercules.app';
(async () => {
  const route = process.argv[2];
  const labels = process.argv.slice(3);
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const ctx = browser.contexts()[0];
  let page = ctx.pages().find(p => p.url().includes(APP)) || ctx.pages()[0];
  await page.bringToFront().catch(() => {});
  await page.goto('https://' + APP + route, { waitUntil: 'networkidle', timeout: 60000 }).catch(e => console.error(e.message));
  await page.waitForTimeout(2000);
  for (const l of labels) {
    try { await page.getByText(l, { exact: true }).first().click({ timeout: 4000 }); await page.waitForTimeout(600); }
    catch (e) { try { await page.getByText(l, { exact: false }).first().click({ timeout: 4000 }); await page.waitForTimeout(600); } catch (e2) { console.log('!! ' + l); } }
  }
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(__dirname, 'shots', 'financial_expanded.png'), fullPage: true }).catch(() => {});
  const txt = await page.evaluate(() => (document.querySelector('main') || document.body).innerText);
  console.log(txt);
  await browser.close();
})();

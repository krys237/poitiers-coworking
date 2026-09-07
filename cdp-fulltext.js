// Dumps the full structured text of a route (headings + labels per block).
const { chromium } = require('playwright');
const APP = 'poitiers-coworking-366166.onhercules.app';
(async () => {
  const route = process.argv[2];
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const ctx = browser.contexts()[0];
  let page = ctx.pages().find(p => p.url().includes(APP)) || ctx.pages()[0];
  await page.bringToFront().catch(() => {});
  await page.goto('https://' + APP + route, { waitUntil: 'networkidle', timeout: 60000 }).catch(e => console.error(e.message));
  await page.waitForTimeout(2000);
  const txt = await page.evaluate(() => {
    // remove the nav sidebar for clarity
    const main = document.querySelector('main') || document.body;
    return main.innerText;
  });
  console.log(txt);
  await browser.close();
})();

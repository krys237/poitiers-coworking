// Clicks a series of tabs/panels on a route and dumps table columns + key text per tab.
// Usage: node cdp-tabs.js <route> "<Tab1>" "<Tab2>" ...
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const APP = 'poitiers-coworking-366166.onhercules.app';

async function dumpTab(page, tag) {
  const data = await page.evaluate(() => {
    const clean = s => (s || '').trim().replace(/\s+/g, ' ');
    const cols = [...document.querySelectorAll('th,[role="columnheader"]')].map(h => clean(h.innerText)).filter(Boolean);
    const heads = [...document.querySelectorAll('h1,h2,h3,h4')].map(h => clean(h.innerText)).filter(Boolean).slice(0, 30);
    // input placeholders reveal editable column semantics
    const phs = [...new Set([...document.querySelectorAll('input')].map(i => i.placeholder).filter(Boolean))];
    // first couple of data rows
    const rows = [...document.querySelectorAll('table tr')].slice(0, 6).map(r => clean(r.innerText).slice(0, 200)).filter(Boolean);
    return { cols, heads, phs, rows };
  });
  console.log(`\n########## ${tag} ##########`);
  console.log('HEADS: ' + data.heads.join(' | '));
  console.log('COLUMNS: ' + data.cols.join(' | '));
  if (data.phs.length) console.log('INPUT PLACEHOLDERS: ' + data.phs.join(' | '));
  if (data.rows.length) { console.log('ROWS:'); data.rows.forEach(r => console.log('  ' + r)); }
}

(async () => {
  const route = process.argv[2];
  const tabs = process.argv.slice(3);
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const ctx = browser.contexts()[0];
  let page = ctx.pages().find(p => p.url().includes(APP)) || ctx.pages()[0];
  await page.bringToFront().catch(() => {});
  fs.mkdirSync(path.join(__dirname, 'shots'), { recursive: true });

  await page.goto('https://' + APP + route, { waitUntil: 'networkidle', timeout: 60000 }).catch(e => console.error('goto', e.message));
  await page.waitForTimeout(2000);
  const rslug = route.replace(/[^a-z0-9]/gi, '_');

  await dumpTab(page, route + ' [default]');
  for (const tab of tabs) {
    try {
      await page.getByRole('button', { name: tab, exact: false }).first().click({ timeout: 5000 });
    } catch (e) {
      try { await page.getByText(tab, { exact: false }).first().click({ timeout: 5000 }); }
      catch (e2) { console.log(`\n!! tab "${tab}" not clickable`); continue; }
    }
    await page.waitForTimeout(1800);
    const safe = (rslug + '_' + tab).replace(/[^a-z0-9]/gi, '_').toLowerCase().slice(0, 55);
    await page.screenshot({ path: path.join(__dirname, 'shots', 'tab_' + safe + '.png'), fullPage: true }).catch(() => {});
    await dumpTab(page, route + ' > ' + tab);
  }
  await browser.close();
})();

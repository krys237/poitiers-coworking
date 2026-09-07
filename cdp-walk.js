// Walks a list of routes on a base URL (new page), compact dump per route.
// Usage: node cdp-walk.js <baseUrl> <route1> <route2> ...
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const base = process.argv[2].replace(/\/$/, '');
  const routes = process.argv.slice(3);
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const ctx = browser.contexts()[0];
  const page = await ctx.newPage();
  const client = await ctx.newCDPSession(page);
  await client.send('Network.setCacheDisabled', { cacheDisabled: true }).catch(() => {});
  fs.mkdirSync(path.join(__dirname, 'shots'), { recursive: true });

  for (const r of routes) {
    try { await page.goto(base + r, { waitUntil: 'networkidle', timeout: 45000 }); await page.waitForTimeout(1800); }
    catch (e) { console.log(`\n## ${r} :: goto failed ${e.message}`); continue; }
    const safe = ('lov' + r).replace(/[^a-z0-9]/gi, '_').toLowerCase().slice(0, 40) || 'lov_root';
    await page.screenshot({ path: path.join(__dirname, 'shots', safe + '.png'), fullPage: true }).catch(() => {});
    const d = await page.evaluate(() => {
      const clean = s => (s || '').trim().replace(/\s+/g, ' ');
      const main = document.querySelector('main') || document.body;
      const heads = [...main.querySelectorAll('h1,h2,h3,h4')].map(h => clean(h.innerText)).filter(Boolean).slice(0, 25);
      const cols = [...main.querySelectorAll('th,[role="columnheader"]')].map(h => clean(h.innerText)).filter(Boolean).slice(0, 45);
      const btns = [...new Set([...main.querySelectorAll('button,[role="button"]')].map(b => clean(b.innerText)).filter(Boolean))].slice(0, 40);
      const phs = [...new Set([...main.querySelectorAll('input,textarea')].map(i => i.placeholder).filter(Boolean))].slice(0, 30);
      const tabs = [...new Set([...main.querySelectorAll('[role="tab"]')].map(t => clean(t.innerText)).filter(Boolean))];
      const rows = [...main.querySelectorAll('table tbody tr')].slice(0, 4).map(r => clean(r.innerText).slice(0, 180)).filter(Boolean);
      return { heads, cols, btns, phs, tabs, rows, textlen: main.innerText.length, snippet: clean(main.innerText).slice(0, 900) };
    });
    console.log(`\n########## ${r} ##########`);
    console.log('HEADS: ' + d.heads.join(' | '));
    if (d.tabs.length) console.log('TABS: ' + d.tabs.join(' | '));
    if (d.cols.length) console.log('COLUMNS: ' + d.cols.join(' | '));
    console.log('BUTTONS: ' + d.btns.join(' | '));
    if (d.phs.length) console.log('PLACEHOLDERS: ' + d.phs.join(' | '));
    if (d.rows.length) { console.log('ROWS:'); d.rows.forEach(x => console.log('  ' + x)); }
    console.log('SNIPPET: ' + d.snippet);
  }
  await page.close();
  await browser.close();
})();

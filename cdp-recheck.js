// Re-checks the Hercules platform with cache DISABLED, dumping the nav + each
// module's headings/buttons/placeholders compactly so we can diff vs the doc.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const APP = 'poitiers-coworking-366166.onhercules.app';

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const ctx = browser.contexts()[0];
  let page = ctx.pages().find(p => p.url().includes(APP)) || ctx.pages()[0];
  await page.bringToFront().catch(() => {});
  const client = await ctx.newCDPSession(page);
  await client.send('Network.setCacheDisabled', { cacheDisabled: true }).catch(() => {});
  fs.mkdirSync(path.join(__dirname, 'shots'), { recursive: true });

  await page.goto('https://' + APP + '/', { waitUntil: 'networkidle', timeout: 60000 });
  await page.reload({ waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(__dirname, 'shots', 'recheck_dashboard.png'), fullPage: true }).catch(() => {});

  // nav links = list of modules
  const nav = await page.evaluate(() => {
    const clean = s => (s || '').trim().replace(/\s+/g, ' ');
    const links = [...document.querySelectorAll('a[href^="/"]')].map(a => ({ t: clean(a.innerText), href: a.getAttribute('href') }));
    // dedupe
    const seen = new Set(); const out = [];
    for (const l of links) { const k = l.href + '|' + l.t; if (!seen.has(k) && l.t) { seen.add(k); out.push(l); } }
    return { links: out, dash: clean(document.body.innerText).slice(0, 1500), role: (document.body.innerText.match(/Directeur Général \(Admin\)|Employé|Auditeur/)||[''])[0] };
  });
  console.log('ROLE:', nav.role);
  console.log('\n===== NAV MODULES =====');
  const uniqueRoutes = [...new Set(nav.links.map(l => l.href))];
  nav.links.filter((l,i,a) => a.findIndex(x=>x.href===l.href)===i).forEach(l => console.log(`  ${l.href}  ->  ${l.t}`));
  console.log('\n===== DASHBOARD TEXT =====\n' + nav.dash);

  // walk each route directly (faster than clicking)
  const routes = uniqueRoutes.filter(r => r && r !== '/readme');
  for (const r of routes) {
    try {
      await page.goto('https://' + APP + r, { waitUntil: 'networkidle', timeout: 45000 });
      await page.waitForTimeout(1500);
    } catch (e) { console.log(`\n## ${r} :: goto failed ${e.message}`); continue; }
    const d = await page.evaluate(() => {
      const clean = s => (s || '').trim().replace(/\s+/g, ' ');
      const main = document.querySelector('main') || document.body;
      const heads = [...main.querySelectorAll('h1,h2,h3,h4')].map(h => clean(h.innerText)).filter(Boolean).slice(0, 25);
      const cols = [...main.querySelectorAll('th,[role="columnheader"]')].map(h => clean(h.innerText)).filter(Boolean).slice(0, 40);
      const btns = [...new Set([...main.querySelectorAll('button,[role="button"]')].map(b => clean(b.innerText)).filter(Boolean))].filter(b => b !== 'Se déconnecter').slice(0, 40);
      const phs = [...new Set([...main.querySelectorAll('input,textarea')].map(i => i.placeholder).filter(Boolean))].slice(0, 30);
      const tabs = [...new Set([...main.querySelectorAll('[role="tab"]')].map(t => clean(t.innerText)).filter(Boolean))];
      return { heads, cols, btns, phs, tabs };
    });
    console.log(`\n########## ${r} ##########`);
    console.log('HEADS: ' + d.heads.join(' | '));
    if (d.tabs.length) console.log('TABS: ' + d.tabs.join(' | '));
    if (d.cols.length) console.log('COLUMNS: ' + d.cols.join(' | '));
    console.log('BUTTONS: ' + d.btns.join(' | '));
    if (d.phs.length) console.log('PLACEHOLDERS: ' + d.phs.join(' | '));
  }
  await browser.close();
})();

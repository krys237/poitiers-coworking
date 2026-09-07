// Explores an arbitrary URL in a NEW CDP page (keeps other tabs intact).
// Usage: node cdp-lovable.js <url> <name> [clickText]
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const url = process.argv[2];
  const name = process.argv[3] || 'lovable';
  const clickText = process.argv[4];
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const ctx = browser.contexts()[0];
  const page = await ctx.newPage();
  const client = await ctx.newCDPSession(page);
  await client.send('Network.setCacheDisabled', { cacheDisabled: true }).catch(() => {});
  fs.mkdirSync(path.join(__dirname, 'shots'), { recursive: true });

  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(e => console.error('goto:', e.message));
  await page.waitForTimeout(3000);
  if (clickText) {
    try { await page.getByText(clickText, { exact: false }).first().click({ timeout: 6000 }); await page.waitForTimeout(2500); }
    catch (e) { console.log('click failed:', e.message); }
  }
  console.log('FINAL_URL:', page.url());
  console.log('TITLE:', await page.title());
  await page.screenshot({ path: path.join(__dirname, 'shots', name + '.png'), fullPage: true }).catch(() => {});

  const d = await page.evaluate(() => {
    const clean = s => (s || '').trim().replace(/\s+/g, ' ');
    const links = [...document.querySelectorAll('a')].map(a => ({ t: clean(a.innerText).slice(0,60), href: a.getAttribute('href') })).filter(l => l.t || l.href).slice(0, 60);
    const btns = [...new Set([...document.querySelectorAll('button,[role="button"]')].map(b => clean(b.innerText)).filter(Boolean))].slice(0, 50);
    const heads = [...document.querySelectorAll('h1,h2,h3,h4')].map(h => clean(h.innerText)).filter(Boolean).slice(0, 40);
    const cols = [...document.querySelectorAll('th,[role="columnheader"]')].map(h => clean(h.innerText)).filter(Boolean).slice(0, 50);
    const inputs = [...document.querySelectorAll('input,select,textarea')].map(i => `${i.tagName.toLowerCase()}[${i.type||''}] name=${i.name||i.id||''} ph="${i.placeholder||''}"`).slice(0, 40);
    const nav = [...new Set([...document.querySelectorAll('nav a, aside a, [role="navigation"] a')].map(a => clean(a.innerText)).filter(Boolean))];
    return { text: (document.querySelector('main')||document.body).innerText.slice(0, 6000), links, btns, heads, cols, inputs, nav };
  });
  console.log('\n===== HEADINGS =====\n' + d.heads.join(' | '));
  if (d.nav.length) console.log('\n===== NAV =====\n' + d.nav.join(' | '));
  if (d.cols.length) console.log('\n===== COLUMNS =====\n' + d.cols.join(' | '));
  console.log('\n===== BUTTONS =====\n' + d.btns.join(' | '));
  if (d.inputs.length) { console.log('\n===== INPUTS ====='); d.inputs.forEach(i => console.log('  ' + i)); }
  console.log('\n===== LINKS ====='); d.links.forEach(l => console.log(`  [${l.t}] ${l.href}`));
  console.log('\n===== TEXT =====\n' + d.text);

  await page.close();
  await browser.close();
})();

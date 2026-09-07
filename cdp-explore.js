// Connects over CDP to the live logged-in Chrome and walks the sidebar,
// screenshotting + dumping each section. Args: list of menu labels to click.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const APP = 'poitiers-coworking-366166.onhercules.app';

async function dump(page, tag) {
  const data = await page.evaluate(() => {
    const clean = s => (s || '').trim().replace(/\s+/g, ' ');
    const links = [...document.querySelectorAll('a')].map(a => ({ t: clean(a.innerText).slice(0, 60), href: a.getAttribute('href') })).filter(l => l.t || l.href);
    const buttons = [...document.querySelectorAll('button,[role="button"]')].map(b => clean(b.innerText).slice(0, 60)).filter(Boolean);
    const inputs = [...document.querySelectorAll('input,select,textarea')].map(i => `${i.tagName.toLowerCase()}[${i.type||''}] name=${i.name||i.id||''} ph="${i.placeholder||''}"`);
    const heads = [...document.querySelectorAll('h1,h2,h3,th')].map(h => clean(h.innerText)).filter(Boolean).slice(0, 40);
    const rows = [...document.querySelectorAll('table tr')].slice(0, 15).map(r => clean(r.innerText).slice(0, 160)).filter(Boolean);
    return { text: document.body.innerText.slice(0, 4000), links, buttons, inputs, heads, rows };
  });
  console.log(`\n########## ${tag} :: ${page.url()} ##########`);
  console.log('HEADINGS:', data.heads.join(' | '));
  console.log('\n--TEXT--\n' + data.text);
  console.log('\n--LINKS--'); data.links.forEach(l => console.log(`  [${l.t}] ${l.href}`));
  console.log('\n--BUTTONS--'); data.buttons.forEach(b => console.log('  ' + b));
  console.log('\n--INPUTS--'); data.inputs.forEach(i => console.log('  ' + i));
  if (data.rows.length) { console.log('\n--TABLE ROWS--'); data.rows.forEach(r => console.log('  ' + r)); }
}

(async () => {
  const labels = process.argv.slice(2);
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const ctx = browser.contexts()[0];
  let page = ctx.pages().find(p => p.url().includes(APP)) || ctx.pages()[0];
  await page.bringToFront().catch(() => {});
  fs.mkdirSync(path.join(__dirname, 'shots'), { recursive: true });

  for (const label of labels) {
    try {
      await page.getByText(label, { exact: false }).first().click({ timeout: 8000 });
      await page.waitForTimeout(2500);
    } catch (e) { console.log(`\n!! click "${label}" failed: ${e.message}`); }
    const safe = label.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    await page.screenshot({ path: path.join(__dirname, 'shots', 'sec_' + safe + '.png'), fullPage: true }).catch(() => {});
    await dump(page, label);
  }
  await browser.close();
})();

// Opens forms/modals/detail views and dumps their field structure.
// Usage: node cdp-forms.js <route> "<Label1>" "<Label2>" ...
// Navigates to route, then for each label: click -> screenshot -> dump fields -> Escape.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const APP = 'poitiers-coworking-366166.onhercules.app';

async function dumpFields(page, tag) {
  const data = await page.evaluate(() => {
    const clean = s => (s || '').trim().replace(/\s+/g, ' ');
    // prefer a dialog/modal scope if present
    const scope = document.querySelector('[role="dialog"], .modal, [class*="modal"], [class*="Modal"]') || document.body;
    const labelFor = el => {
      // try wrapping label, aria-label, preceding label, placeholder
      let l = el.getAttribute('aria-label') || '';
      if (!l && el.id) { const lb = document.querySelector(`label[for="${el.id}"]`); if (lb) l = lb.innerText; }
      if (!l) { const p = el.closest('label'); if (p) l = p.innerText; }
      if (!l) { const prev = el.previousElementSibling; if (prev && /label|span|div/i.test(prev.tagName)) l = prev.innerText; }
      return clean(l).slice(0, 50);
    };
    const fields = [...scope.querySelectorAll('input,select,textarea')].map(el => {
      const opts = el.tagName === 'SELECT' ? [...el.options].map(o => clean(o.text)).slice(0, 20) : null;
      return { tag: el.tagName.toLowerCase(), type: el.type || '', name: el.name || el.id || '', ph: el.placeholder || '', label: labelFor(el), opts };
    });
    const heads = [...scope.querySelectorAll('h1,h2,h3,h4,th,[role="columnheader"]')].map(h => clean(h.innerText)).filter(Boolean).slice(0, 60);
    const btns = [...scope.querySelectorAll('button,[role="button"]')].map(b => clean(b.innerText)).filter(Boolean).slice(0, 40);
    const isDialog = !!document.querySelector('[role="dialog"], .modal, [class*="modal"], [class*="Modal"]');
    const dialogText = isDialog ? clean(scope.innerText).slice(0, 2500) : '';
    return { fields, heads, btns, isDialog, dialogText };
  });
  console.log(`\n########## ${tag} :: dialog=${data.isDialog} :: ${page.url()} ##########`);
  if (data.dialogText) console.log('\n--DIALOG TEXT--\n' + data.dialogText);
  console.log('\n--HEADINGS/COLUMNS--\n  ' + data.heads.join(' | '));
  console.log('\n--FIELDS--');
  data.fields.forEach(f => console.log(`  ${f.tag}[${f.type}] label="${f.label}" name="${f.name}" ph="${f.ph}"${f.opts ? ' opts=' + JSON.stringify(f.opts) : ''}`));
  console.log('\n--BUTTONS--\n  ' + data.btns.join(' | '));
}

(async () => {
  const route = process.argv[2];
  const labels = process.argv.slice(3);
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const ctx = browser.contexts()[0];
  let page = ctx.pages().find(p => p.url().includes(APP)) || ctx.pages()[0];
  await page.bringToFront().catch(() => {});
  fs.mkdirSync(path.join(__dirname, 'shots'), { recursive: true });

  await page.goto('https://' + APP + route, { waitUntil: 'networkidle', timeout: 60000 }).catch(e => console.error('goto', e.message));
  await page.waitForTimeout(2000);

  const rslug = route.replace(/[^a-z0-9]/gi, '_') || 'root';
  if (labels.length === 0) {
    await page.screenshot({ path: path.join(__dirname, 'shots', 'form_' + rslug + '.png'), fullPage: true }).catch(() => {});
    await dumpFields(page, route);
  }
  for (const label of labels) {
    try {
      await page.getByRole('button', { name: label, exact: false }).first().click({ timeout: 6000 });
    } catch (e) {
      try { await page.getByText(label, { exact: false }).first().click({ timeout: 6000 }); }
      catch (e2) { console.log(`\n!! click "${label}" failed`); continue; }
    }
    await page.waitForTimeout(2200);
    const safe = (rslug + '_' + label).replace(/[^a-z0-9]/gi, '_').toLowerCase().slice(0, 60);
    await page.screenshot({ path: path.join(__dirname, 'shots', 'form_' + safe + '.png'), fullPage: true }).catch(() => {});
    await dumpFields(page, route + ' > ' + label);
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(1200);
  }
  await browser.close();
})();

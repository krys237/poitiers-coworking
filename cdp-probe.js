// Targeted probes for icon-button modals.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const APP = 'poitiers-coworking-366166.onhercools.app'.replace('onhercools','onhercules');

async function dump(page, tag) {
  const data = await page.evaluate(() => {
    const clean = s => (s || '').trim().replace(/\s+/g, ' ');
    const scope = document.querySelector('[role="dialog"], [class*="modal"], [class*="Modal"]') || document.body;
    const labelFor = el => {
      let l = el.getAttribute('aria-label') || '';
      if (!l && el.id) { const lb = document.querySelector(`label[for="${el.id}"]`); if (lb) l = lb.innerText; }
      if (!l) { const p = el.closest('label'); if (p) l = p.innerText; }
      return clean(l).slice(0, 50);
    };
    const fields = [...scope.querySelectorAll('input,select,textarea')].map(el => ({
      tag: el.tagName.toLowerCase(), type: el.type || '', name: el.name || el.id || '', ph: el.placeholder || '', label: labelFor(el),
      opts: el.tagName === 'SELECT' ? [...el.options].map(o => clean(o.text)) : null,
    }));
    const isDialog = !!document.querySelector('[role="dialog"], [class*="modal"], [class*="Modal"]');
    return { text: clean(scope.innerText).slice(0, 2500), fields, isDialog };
  });
  console.log(`\n########## ${tag} :: dialog=${data.isDialog} ##########`);
  console.log('--TEXT--\n' + data.text);
  console.log('\n--FIELDS--');
  data.fields.forEach(f => console.log(`  ${f.tag}[${f.type}] label="${f.label}" name="${f.name}" ph="${f.ph}"${f.opts ? ' opts=' + JSON.stringify(f.opts) : ''}`));
}

(async () => {
  const mode = process.argv[2];
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const ctx = browser.contexts()[0];
  let page = ctx.pages().find(p => p.url().includes('poitiers-coworking')) || ctx.pages()[0];
  await page.bringToFront().catch(() => {});
  fs.mkdirSync(path.join(__dirname, 'shots'), { recursive: true });

  if (mode === 'member') {
    await page.goto('https://poitiers-coworking-366166.onhercules.app/admin/users', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2000);
    // find the card (nearest ancestor div that contains a button) of the member name
    const card = page.getByText('GOUETMENE Audrey', { exact: false }).first()
      .locator('xpath=ancestor::div[.//button][1]');
    const btns = card.locator('button');
    const n = await btns.count();
    console.log('buttons in card:', n);
    await btns.first().click({ timeout: 6000 }).catch(e => console.log('click err', e.message));
    await page.waitForTimeout(1800);
    await page.screenshot({ path: path.join(__dirname, 'shots', 'member_edit.png'), fullPage: true }).catch(() => {});
    await dump(page, 'member edit');
  }

  if (mode === 'payroll') {
    await page.goto('https://poitiers-coworking-366166.onhercules.app/payroll', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2000);
    // list all buttons/links
    const controls = await page.evaluate(() => {
      const clean = s => (s || '').trim().replace(/\s+/g, ' ');
      return [...document.querySelectorAll('button,a,[role="button"]')].map(b => `${b.tagName}:${clean(b.innerText).slice(0,40)}`).filter(x => x.split(':')[1]);
    });
    console.log('CONTROLS:', JSON.stringify(controls, null, 1));
    await page.getByText('Nouveau bulletin', { exact: false }).first().click({ timeout: 6000 }).catch(e => console.log('click err', e.message));
    await page.waitForTimeout(1800);
    await page.screenshot({ path: path.join(__dirname, 'shots', 'payroll_new.png'), fullPage: true }).catch(() => {});
    await dump(page, 'payroll nouveau bulletin');
  }

  await browser.close();
})();

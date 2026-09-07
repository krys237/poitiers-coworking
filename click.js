// Usage: node click.js <url> <selectorOrText> <name>
// Navigates to url, clicks the first element matching text, waits, screenshots.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const url = process.argv[2];
  const clickText = process.argv[3];
  const name = process.argv[4] || 'after';
  fs.mkdirSync(path.join(__dirname, 'shots'), { recursive: true });

  const ctx = await chromium.launchPersistentContext(path.join(__dirname, 'profile'), {
    headless: true,
    viewport: { width: 1440, height: 900 },
  });
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(e => console.error('goto:', e.message));
  await page.waitForTimeout(2000);

  if (clickText) {
    try {
      await page.getByText(clickText, { exact: false }).first().click({ timeout: 10000 });
    } catch (e) {
      try { await page.locator(clickText).first().click({ timeout: 10000 }); }
      catch (e2) { console.error('click failed:', e.message, '|', e2.message); }
    }
    await page.waitForTimeout(3000);
  }

  console.log('FINAL_URL:', page.url());
  console.log('TITLE:', await page.title());
  await page.screenshot({ path: path.join(__dirname, 'shots', name + '.png'), fullPage: true });

  const data = await page.evaluate(() => {
    const links = [...document.querySelectorAll('a')].map(a => ({ text: a.innerText.trim().replace(/\s+/g, ' ').slice(0, 80), href: a.href })).filter(l => l.text || l.href);
    const buttons = [...document.querySelectorAll('button, [role="button"]')].map(b => b.innerText.trim().replace(/\s+/g, ' ').slice(0, 80)).filter(Boolean);
    const inputs = [...document.querySelectorAll('input, select, textarea')].map(i => `${i.tagName.toLowerCase()}[type=${i.type || ''}] name=${i.name} placeholder="${i.placeholder || ''}"`);
    return { text: document.body.innerText.slice(0, 8000), links, buttons, inputs };
  });
  console.log('\n===== VISIBLE TEXT =====\n' + data.text);
  console.log('\n===== LINKS =====');
  data.links.forEach(l => console.log(`- [${l.text}] ${l.href}`));
  console.log('\n===== BUTTONS =====');
  data.buttons.forEach(b => console.log('- ' + b));
  console.log('\n===== INPUTS =====');
  data.inputs.forEach(i => console.log('- ' + i));

  await ctx.close();
})();

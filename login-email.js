// Drives the Hercules email-code login up to sending the code.
// Usage: node login-email.js <email>
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const email = process.argv[2];
  if (!email) { console.error('email required'); process.exit(1); }
  fs.mkdirSync(path.join(__dirname, 'shots'), { recursive: true });

  const ctx = await chromium.launchPersistentContext(path.join(__dirname, 'profile'), {
    headless: true,
    viewport: { width: 1440, height: 900 },
  });
  const page = ctx.pages()[0] || await ctx.newPage();

  await page.goto('https://poitiers-coworking-366166.onhercules.app/readme', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.getByText('Sign In', { exact: false }).first().click();
  await page.waitForTimeout(3000);

  await page.getByText('Continue with email code', { exact: false }).first().click();
  await page.waitForTimeout(2500);

  // fill email
  const emailInput = page.locator('input[type="email"], input[name="email"], input[type="text"]').first();
  await emailInput.fill(email);
  await page.screenshot({ path: path.join(__dirname, 'shots', 'email-entered.png'), fullPage: true });

  // submit
  const submit = page.getByRole('button', { name: /continue|send|next|log in|sign/i }).first();
  await submit.click().catch(async () => {
    await emailInput.press('Enter');
  });
  await page.waitForTimeout(4000);

  console.log('FINAL_URL:', page.url());
  await page.screenshot({ path: path.join(__dirname, 'shots', 'code-prompt.png'), fullPage: true });
  const data = await page.evaluate(() => ({
    text: document.body.innerText.slice(0, 3000),
    inputs: [...document.querySelectorAll('input')].map(i => `${i.name || i.id}[type=${i.type}] placeholder="${i.placeholder||''}"`),
  }));
  console.log('\n===== TEXT =====\n' + data.text);
  console.log('\n===== INPUTS =====\n' + data.inputs.join('\n'));

  // keep the browser context saved (persistent) so state stays; close.
  await ctx.close();
})();

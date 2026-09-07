// Headed login: fills email, then waits for the user to solve the Cloudflare
// captcha and type the emailed OTP code directly in the visible window.
// Detects successful auth (redirect back to the app) then saves & exits.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const APP = 'poitiers-coworking-366166.onhercules.app';
const email = process.argv[2] || 'germannpessidjo6@gmail.com';

(async () => {
  fs.mkdirSync(path.join(__dirname, 'shots'), { recursive: true });
  const ctx = await chromium.launchPersistentContext(path.join(__dirname, 'profile'), {
    headless: false,
    viewport: { width: 1440, height: 900 },
    args: ['--start-maximized'],
  });
  const page = ctx.pages()[0] || await ctx.newPage();

  await page.goto('https://' + APP + '/readme', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.getByText('Sign In', { exact: false }).first().click();
  await page.waitForTimeout(3000);
  await page.getByText('Continue with email code', { exact: false }).first().click();
  await page.waitForTimeout(2500);
  const emailInput = page.locator('input[type="email"], input[name="otp-email"], input[name="email"]').first();
  await emailInput.fill(email);
  const submit = page.getByRole('button', { name: /continue|send|next|log in|sign/i }).first();
  await submit.click().catch(() => emailInput.press('Enter'));

  console.log('>>> Fenetre prete. Coche le captcha Cloudflare puis tape le code recu par email.');
  console.log('>>> En attente de connexion (jusqu a 8 min)...');

  const deadline = Date.now.bind ? null : null; // Date.now unavailable; use loop counter
  let logged = false;
  for (let i = 0; i < 240; i++) { // 240 * 2s = 8 min
    await page.waitForTimeout(2000);
    let url = '';
    try { url = page.url(); } catch (e) {}
    const onApp = url.includes(APP);
    const onAuth = url.includes('hercules-auth.com');
    const onReadme = url.includes('/readme');
    if (onApp && !onAuth && !onReadme) { logged = true; break; }
    // some apps land back on /readme but authenticated; check for a logged-in marker
    if (onApp && onReadme) {
      const hasSignIn = await page.getByText('Sign In', { exact: false }).count().catch(() => 1);
      if (hasSignIn === 0) { logged = true; break; }
    }
  }

  await page.waitForTimeout(2500);
  let finalUrl = '';
  try { finalUrl = page.url(); } catch (e) {}
  console.log('LOGGED:', logged, 'FINAL_URL:', finalUrl);
  try { await page.screenshot({ path: path.join(__dirname, 'shots', 'after-login.png'), fullPage: true }); } catch (e) {}
  await ctx.close(); // persists cookies to ./profile
  console.log('DONE. Session sauvegardee dans ./profile');
})();

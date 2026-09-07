// Connects to the user-launched Chrome over CDP (not automation-flagged),
// drives up to the email-send step, then waits for the user to solve the
// Cloudflare captcha + type the OTP. Detects auth success and reports.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const APP = 'poitiers-coworking-366166.onhercules.app';
const email = process.argv[2] || 'germannpessidjo6@gmail.com';

(async () => {
  fs.mkdirSync(path.join(__dirname, 'shots'), { recursive: true });
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const ctx = browser.contexts()[0];
  let page = ctx.pages().find(p => p.url().includes(APP)) || ctx.pages()[0] || await ctx.newPage();

  await page.bringToFront().catch(() => {});
  if (!page.url().includes(APP)) {
    await page.goto('https://' + APP + '/readme', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(e => console.error('goto', e.message));
  }
  await page.waitForTimeout(1500);

  // If already authenticated, skip.
  const hasSignIn = await page.getByText('Sign In', { exact: false }).count().catch(() => 0);
  if (hasSignIn > 0) {
    await page.getByText('Sign In', { exact: false }).first().click().catch(e => console.error('signin click', e.message));
    await page.waitForTimeout(3000);
    await page.getByText('Continue with email code', { exact: false }).first().click().catch(e => console.error('emailcode click', e.message));
    await page.waitForTimeout(2500);
    const emailInput = page.locator('input[type="email"], input[name="otp-email"], input[name="email"]').first();
    await emailInput.fill(email).catch(e => console.error('fill', e.message));
    const submit = page.getByRole('button', { name: /continue|send|next|log in|sign/i }).first();
    await submit.click().catch(() => emailInput.press('Enter'));
    console.log('>>> Email soumis. A TOI: coche le captcha Cloudflare puis tape le code recu par email.');
  } else {
    console.log('>>> Deja authentifie apparemment, verification...');
  }

  console.log('>>> Attente de connexion (jusqu a 8 min)...');
  let logged = false;
  for (let i = 0; i < 240; i++) {
    await page.waitForTimeout(2000);
    let url = '';
    try { url = page.url(); } catch (e) {}
    if (url.includes(APP) && !url.includes('hercules-auth.com') && !url.includes('/readme')) { logged = true; break; }
    if (url.includes(APP) && url.includes('/readme')) {
      const s = await page.getByText('Sign In', { exact: false }).count().catch(() => 1);
      if (s === 0) { logged = true; break; }
    }
  }
  await page.waitForTimeout(2000);
  let finalUrl = ''; try { finalUrl = page.url(); } catch (e) {}
  console.log('LOGGED:', logged, 'FINAL_URL:', finalUrl);
  try { await page.screenshot({ path: path.join(__dirname, 'shots', 'after-login.png'), fullPage: true }); } catch (e) {}
  // Do NOT close the browser: keep the Chrome session alive for further CDP work.
  await browser.close(); // detaches CDP connection only, Chrome stays open
  console.log('DONE (CDP detached, Chrome reste ouvert avec la session).');
})();

const { chromium } = require('playwright');
const fs = require('fs');

const OUT = 'C:/Users/User/AppData/Local/Temp/dbe-screenshots';
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const b = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();

  // 1. Login screen
  await p.goto('http://localhost:5173/login');
  await p.waitForTimeout(1800);
  await p.screenshot({ path: `${OUT}/01-login.png` });
  console.log('01 login');

  // Switch to cadastro/register
  try {
    const allBtns = await p.$$('button');
    for (const btn of allBtns) {
      const txt = (await btn.textContent() || '').trim();
      if (txt.toLowerCase().includes('criar') || txt.toLowerCase().includes('cadastro') || txt.toLowerCase().includes('registr')) {
        await btn.click(); break;
      }
    }
    await p.waitForTimeout(700);
  } catch(e) {}

  await p.screenshot({ path: `${OUT}/02-register-tab.png` });
  console.log('02 register tab');

  // Fill form
  const inputs = await p.$$('input');
  console.log('inputs found:', inputs.length);
  if (inputs[0]) await inputs[0].fill('Dra. Ana Teste');
  if (inputs[1]) await inputs[1].fill('teste@dbe.com');
  if (inputs[2]) await inputs[2].fill('senha123');
  if (inputs[3]) await inputs[3].fill('senha123');
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${OUT}/03-form-filled.png` });
  console.log('03 form filled');

  // Submit
  const submitBtn = await p.$('button[type="submit"]');
  if (submitBtn) { await submitBtn.click(); await p.waitForTimeout(2500); }
  console.log('url after submit:', p.url());
  await p.screenshot({ path: `${OUT}/04-post-register.png` });
  console.log('04 post register');

  // Navigate through onboarding if needed
  let maxSteps = 12;
  while (p.url().includes('onboarding') && maxSteps-- > 0) {
    const btns = await p.$$('button');
    let found = false;
    for (const btn of btns) {
      const txt = (await btn.textContent() || '').trim();
      if (txt.includes('Próximo') || txt.includes('Concluir') || txt.includes('Finalizar') || txt.includes('Começar')) {
        await btn.click(); found = true; break;
      }
    }
    if (!found) break;
    await p.waitForTimeout(900);
  }
  await p.waitForTimeout(800);
  console.log('url after onboarding:', p.url());
  await p.screenshot({ path: `${OUT}/05-home.png` });
  console.log('05 home');

  // Go to /espaco
  await p.goto('http://localhost:5173/espaco');
  await p.waitForTimeout(1800);
  await p.screenshot({ path: `${OUT}/06-espaco-full.png`, fullPage: false });
  console.log('06 espaco top viewport');

  // Scroll via main element
  await p.evaluate(() => {
    const main = document.querySelector('main');
    if (main) main.scrollTop = 350;
  });
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${OUT}/07-espaco-mood.png` });
  console.log('07 espaco mood section');

  await p.evaluate(() => {
    const main = document.querySelector('main');
    if (main) main.scrollTop = 750;
  });
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${OUT}/08-espaco-journal.png` });
  console.log('08 espaco journal');

  await p.evaluate(() => {
    const main = document.querySelector('main');
    if (main) main.scrollTop = 1300;
  });
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${OUT}/09-espaco-ideas-ai.png` });
  console.log('09 espaco ideas + ai');

  // Click gear icon for setup modal
  try {
    const gearBtns = await p.$$('button');
    for (const btn of gearBtns) {
      const svg = await btn.$('svg');
      if (svg) {
        const cls = await svg.getAttribute('class') || '';
        if (cls.includes('settings') || cls.includes('Settings')) {
          await btn.click(); break;
        }
      }
    }
    await p.waitForTimeout(800);
    await p.screenshot({ path: `${OUT}/10-setup-modal.png` });
    console.log('10 setup modal');
  } catch(e) { console.log('gear err:', e.message); }

  // Close modal and check nav when on dark page
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);
  await p.goto('http://localhost:5173/');
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `${OUT}/11-home-dark-nav.png` });
  console.log('11 home dark nav (6 items)');

  // Nav closeup - crop nav area
  await p.goto('http://localhost:5173/espaco');
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `${OUT}/12-espaco-light-nav.png` });
  console.log('12 espaco light nav');

  await b.close();
  console.log('ALL DONE - saved to', OUT);
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });

const { chromium } = require('playwright');
const fs = require('fs');

const OUT = 'C:/Users/User/AppData/Local/Temp/dbe-screenshots';
fs.mkdirSync(OUT, { recursive: true });

const MOCK_STATE = {
  user: {
    id: 'test-001',
    name: 'Dra. Ana Martins',
    email: 'ana@teste.com',
    createdAt: new Date().toISOString(),
    plan: 'pro',
    onboardingCompleted: true
  },
  profile: {
    professionalName: 'Dra. Ana Martins',
    specialty: 'Dermatologia',
    city: 'São Paulo, SP',
    targetAudience: 'Mulheres 25-45 anos',
    instagram: '@draanamartin',
    serviceType: 'Consultas presenciais',
    currentGoal: 'Atrair novos pacientes',
    exposureLevel: 'comfortable-talking',
    voiceTone: ['didático', 'acolhedor', 'direto'],
    pillars: [
      { id: '1', name: 'Cuidados com a pele', description: 'Rotinas e dicas práticas', priority: 1 },
      { id: '2', name: 'Autoestima', description: 'Conexão emocional com a beleza', priority: 2 },
      { id: '3', name: 'Procedimentos', description: 'O que eu faço no consultório', priority: 3 }
    ],
    services: [
      { id: '1', name: 'Botox', category: 'Estética', commercialGoal: 'Converter consultas' },
      { id: '2', name: 'Peeling', category: 'Rejuvenescimento', commercialGoal: 'Educar' }
    ],
    limits: { avoidTopics: [], sensitiveMatter: [], noTeamShow: false, noOfficeShow: false, humorRestrictions: '' },
    catchphrase: 'Sua pele conta sua história',
    preferredWords: ['cuidado', 'natural', 'resultado'],
    avoidedWords: ['milagre', 'perfeito'],
    availableMoments: ['Manhã', 'Intervalo']
  },
  ideas: [],
  missions: [],
  progress: {
    missionsCompleted: 12,
    currentStreak: 5,
    weeklyMissions: 3,
    contentBalance: { authority: 4, backstage: 2, connection: 3, sale: 1, interaction: 1, humor: 1 },
    lastActivity: new Date().toISOString(),
    level: 'Ganhando presença'
  },
  personalSpace: {
    context: {},
    journal: [],
    ideas: [],
    todayMood: null,
    todayMoodNote: null,
    todayMoodDate: null
  }
};

(async () => {
  const b = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();

  // Inject state into localStorage before app loads
  await p.goto('http://localhost:5173/login');
  await p.waitForTimeout(800);
  await p.evaluate((state) => {
    localStorage.setItem('dbe-pulse-state', JSON.stringify(state));
    localStorage.setItem('dbe-pulse-week', '2026-W22');
  }, MOCK_STATE);
  console.log('state injected');

  // Navigate to home
  await p.goto('http://localhost:5173/');
  await p.waitForTimeout(2000);
  await p.screenshot({ path: `${OUT}/01-home.png` });
  console.log('01 home');

  // Scroll home to see content
  await p.evaluate(() => { const m = document.querySelector('main'); if(m) m.scrollTop = 300; });
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${OUT}/02-home-scrolled.png` });
  console.log('02 home scrolled');

  // Navigate to /espaco
  await p.goto('http://localhost:5173/espaco');
  await p.waitForTimeout(2000);
  await p.screenshot({ path: `${OUT}/03-espaco-top.png` });
  console.log('03 espaco top (setup banner + header)');

  // Show setup banner zone (scroll a bit)
  await p.evaluate(() => { const m = document.querySelector('main'); if(m) m.scrollTop = 200; });
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${OUT}/04-espaco-mood-picker.png` });
  console.log('04 mood picker');

  // Select a mood
  try {
    const moodBtns = await p.$$('[style*="F6F5FF"], button');
    // Find mood grid buttons by looking for emoji text
    const btns = await p.$$('button');
    for (const btn of btns) {
      const txt = (await btn.textContent() || '').trim();
      if (txt.startsWith('🔥') || txt === '🔥Motivado') {
        await btn.click(); break;
      }
    }
    await p.waitForTimeout(400);
    await p.screenshot({ path: `${OUT}/05-mood-selected.png` });
    console.log('05 mood selected');
  } catch(e) { console.log('mood err:', e.message); }

  // Scroll to journal section
  await p.evaluate(() => { const m = document.querySelector('main'); if(m) m.scrollTop = 700; });
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${OUT}/06-journal-section.png` });
  console.log('06 journal section');

  // Click "Nova história"
  try {
    const btns = await p.$$('button');
    for (const btn of btns) {
      const txt = (await btn.textContent() || '').trim();
      if (txt.includes('Nova história') || txt.includes('Nova historia')) {
        await btn.click(); break;
      }
    }
    await p.waitForTimeout(600);
    await p.screenshot({ path: `${OUT}/07-journal-open.png` });
    console.log('07 journal form open');
    // Type something
    const ta = await p.$('textarea');
    if (ta) {
      await ta.fill('Hoje foi um dia incrível! Atendi uma paciente que estava muito insegura com a pele, e ao final da consulta ela saiu com um sorriso enorme. Esses momentos me lembram por que escolhi essa profissão.');
      await p.waitForTimeout(300);
      await p.screenshot({ path: `${OUT}/08-journal-filled.png` });
      console.log('08 journal filled');
    }
  } catch(e) { console.log('journal err:', e.message); }

  // Scroll to ideas section
  await p.evaluate(() => { const m = document.querySelector('main'); if(m) m.scrollTop = 1400; });
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${OUT}/09-ideas-section.png` });
  console.log('09 ideas section');

  // Scroll to AI section
  await p.evaluate(() => { const m = document.querySelector('main'); if(m) m.scrollTop = 2000; });
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${OUT}/10-ai-section.png` });
  console.log('10 AI suggestions section');

  // Open setup modal via gear icon
  await p.evaluate(() => { const m = document.querySelector('main'); if(m) m.scrollTop = 0; });
  await p.waitForTimeout(400);
  try {
    // The gear button is in the header area - find it by position
    const headerBtns = await p.$$('button');
    for (const btn of headerBtns) {
      const box = await btn.boundingBox();
      if (box && box.x > 300 && box.y < 200) { // top-right area
        await btn.click(); break;
      }
    }
    await p.waitForTimeout(800);
    await p.screenshot({ path: `${OUT}/11-setup-modal.png` });
    console.log('11 setup modal step 1');

    // Go to step 2
    const nextBtns = await p.$$('button');
    for (const btn of nextBtns) {
      const txt = (await btn.textContent() || '').trim();
      if (txt.includes('Continuar')) {
        await btn.click(); break;
      }
    }
    await p.waitForTimeout(500);
    await p.screenshot({ path: `${OUT}/12-setup-modal-step2.png` });
    console.log('12 setup modal step 2');

    // Go to step 3
    const nextBtns2 = await p.$$('button');
    for (const btn of nextBtns2) {
      const txt = (await btn.textContent() || '').trim();
      if (txt.includes('Continuar')) {
        await btn.click(); break;
      }
    }
    await p.waitForTimeout(500);
    await p.screenshot({ path: `${OUT}/13-setup-modal-step3.png` });
    console.log('13 setup modal step 3');
  } catch(e) { console.log('modal err:', e.message); }

  // Compare nav: home (dark) vs espaco (light)
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);

  // Dark nav - home
  await p.goto('http://localhost:5173/');
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `${OUT}/14-home-dark-nav.png` });
  console.log('14 home dark nav');

  // Light nav - espaco
  await p.goto('http://localhost:5173/espaco');
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `${OUT}/15-espaco-light-nav.png` });
  console.log('15 espaco light nav');

  // Now inject personal context to show the "ready" state
  await p.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('dbe-pulse-state'));
    state.personalSpace.context = {
      nickname: 'Ana',
      lifeMoment: 'Acabei de completar 5 anos de consultório e estou num momento de expansão.',
      hobbies: ['Culinária', 'Viagens', 'Yoga'],
      personalValues: ['Família', 'Saúde', 'Autenticidade'],
      motivations: 'Ver meus pacientes mais confiantes consigo mesmos.',
      setupCompleted: true
    };
    state.personalSpace.journal = [
      { id: 'j1', content: 'Hoje foi um dia incrível! Atendi uma paciente que saiu do consultório com sorriso no rosto. Esses momentos me lembram por que escolhi essa profissão.', mood: '🌟', date: new Date().toISOString() },
      { id: 'j2', content: 'Dia corrido mas muito produtivo. Fiz uma live sobre cuidados com pele no sol que teve ótima repercussão.', mood: '😊', date: new Date(Date.now() - 86400000).toISOString() }
    ];
    state.personalSpace.ideas = [
      { id: 'i1', content: 'Story mostrando minha rotina matinal de skincare', category: 'conteúdo', createdAt: new Date().toISOString() },
      { id: 'i2', content: 'Fazer aula de culinária com amigos este fim de semana', category: 'pessoal', createdAt: new Date().toISOString() },
      { id: 'i3', content: 'Reels comparando antes/depois de peeling com paciente autorizada', category: 'conteúdo', createdAt: new Date().toISOString() }
    ];
    state.personalSpace.todayMood = '🔥';
    state.personalSpace.todayMoodNote = 'Dia cheio de energia, pronta para criar!';
    state.personalSpace.todayMoodDate = new Date().toDateString();
    localStorage.setItem('dbe-pulse-state', JSON.stringify(state));
  });

  await p.reload();
  await p.waitForTimeout(2000);
  await p.screenshot({ path: `${OUT}/16-espaco-with-data-top.png` });
  console.log('16 espaco with all data - top');

  await p.evaluate(() => { const m = document.querySelector('main'); if(m) m.scrollTop = 400; });
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${OUT}/17-espaco-data-diary.png` });
  console.log('17 espaco diary with entries');

  await p.evaluate(() => { const m = document.querySelector('main'); if(m) m.scrollTop = 950; });
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${OUT}/18-espaco-data-ideas.png` });
  console.log('18 espaco ideas filled');

  await b.close();
  console.log('\nALL DONE -', OUT);
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });

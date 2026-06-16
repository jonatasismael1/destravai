#!/usr/bin/env node
/*
 * Gera conteudo/roteiros-90-dias.html a partir de conteudo/roteiros-90-dias.md
 * Uso: node scripts/gerar-html-roteiros.cjs
 * Mantem o HTML sempre em sincronia com o markdown (fonte unica de verdade).
 */
const fs = require('fs');
const path = require('path');

const MD = path.join(__dirname, '..', 'conteudo', 'roteiros-90-dias.md');
const OUT = path.join(__dirname, '..', 'conteudo', 'roteiros-90-dias.html');

const md = fs.readFileSync(MD, 'utf8');

// Cada roteiro comeca em "### Dia N — Titulo". Ignora cabecalhos soltos.
const blocks = md.split(/\n(?=### Dia \d)/).filter((b) => /^### Dia \d/.test(b.trim()));

function field(block, label) {
  const re = new RegExp(`- \\*\\*${label}:\\*\\*\\s*(.+)`);
  const m = block.match(re);
  return m ? m[1].trim() : '';
}
function esc(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const roteiros = blocks.map((b) => {
  const head = b.match(/^### (Dia \d+) — (.+)/);
  const dia = head ? head[1] : '';
  const titulo = head ? head[2].trim() : '';
  const pilarFull = field(b, 'Pilar');
  // pilar "curto" para o filtro (antes do parenteses/barra)
  const pilarKey = pilarFull.split(/[(/]/)[0].trim();
  return {
    dia,
    titulo,
    pilar: pilarFull,
    pilarKey,
    gancho: field(b, 'Gancho'),
    desenvolvimento: field(b, 'Desenvolvimento'),
    cta: field(b, 'CTA'),
    legenda: field(b, 'Legenda'),
    tela: field(b, 'Texto na tela'),
  };
});

const pilares = [...new Set(roteiros.map((r) => r.pilarKey))];

// cor por pilar
const cores = {
  'Crença': '#7c3aed',
  'História': '#db2777',
  'Provocação': '#ea580c',
  'Dor': '#0891b2',
  'Dica': '#16a34a',
  'Bastidor': '#2563eb',
  'Venda': '#ca8a04',
};
function corPilar(key) {
  return cores[key] || '#475569';
}

const cards = roteiros
  .map(
    (r) => `
    <article class="card" data-pilar="${esc(r.pilarKey)}" data-busca="${esc(
      (r.titulo + ' ' + r.gancho + ' ' + r.desenvolvimento).toLowerCase()
    )}">
      <header class="card-head">
        <span class="dia">${esc(r.dia)}</span>
        <span class="pilar" style="background:${corPilar(r.pilarKey)}">${esc(r.pilar)}</span>
      </header>
      <h2>${esc(r.titulo)}</h2>
      <div class="campo"><span class="rotulo">Gancho</span><p class="gancho">${esc(r.gancho)}</p></div>
      <div class="campo"><span class="rotulo">Desenvolvimento</span><p>${esc(r.desenvolvimento)}</p></div>
      <div class="campo"><span class="rotulo">CTA</span><p>${esc(r.cta)}</p></div>
      <div class="campo"><span class="rotulo">Legenda</span><p>${esc(r.legenda)}</p></div>
      <div class="campo"><span class="rotulo">Texto na tela</span><p class="tela">${esc(r.tela)}</p></div>
      <button class="copiar" onclick="copiar(this)">Copiar roteiro</button>
    </article>`
  )
  .join('\n');

const filtros = ['Todos', ...pilares]
  .map(
    (p) =>
      `<button class="filtro${p === 'Todos' ? ' ativo' : ''}" data-f="${esc(
        p
      )}" onclick="filtrar(this)">${esc(p)}</button>`
  )
  .join('');

const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Roteiros Destravaí — 90 dias</title>
<style>
  :root { --roxo:#7c3aed; --tinta:#0f172a; --cinza:#64748b; --borda:#e2e8f0; --fundo:#f8fafc; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background:var(--fundo); color:var(--tinta); }
  .topo { background: linear-gradient(135deg,#7c3aed,#db2777); color:#fff; padding:32px 20px; }
  .topo .wrap { max-width:1100px; margin:0 auto; }
  .topo h1 { margin:0 0 6px; font-size:28px; }
  .topo p { margin:0; opacity:.92; }
  .barra { position:sticky; top:0; z-index:5; background:#fff; border-bottom:1px solid var(--borda); padding:12px 20px; }
  .barra .wrap { max-width:1100px; margin:0 auto; display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
  .busca { flex:1; min-width:200px; padding:9px 12px; border:1px solid var(--borda); border-radius:8px; font-size:14px; }
  .filtro { border:1px solid var(--borda); background:#fff; color:var(--cinza); padding:7px 12px; border-radius:20px; cursor:pointer; font-size:13px; }
  .filtro.ativo { background:var(--tinta); color:#fff; border-color:var(--tinta); }
  .grid { max-width:1100px; margin:24px auto; padding:0 20px; display:grid; grid-template-columns:repeat(auto-fill,minmax(320px,1fr)); gap:16px; }
  .card { background:#fff; border:1px solid var(--borda); border-radius:14px; padding:18px; display:flex; flex-direction:column; box-shadow:0 1px 2px rgba(0,0,0,.04); }
  .card-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; }
  .dia { font-weight:700; font-size:13px; color:var(--cinza); letter-spacing:.5px; }
  .pilar { color:#fff; font-size:11px; padding:3px 9px; border-radius:20px; font-weight:600; }
  .card h2 { font-size:18px; margin:0 0 12px; line-height:1.25; }
  .campo { margin-bottom:10px; }
  .rotulo { display:block; font-size:10px; text-transform:uppercase; letter-spacing:1px; color:var(--cinza); font-weight:700; margin-bottom:2px; }
  .campo p { margin:0; font-size:14px; line-height:1.5; }
  .gancho { font-weight:600; }
  .tela { font-style:italic; color:var(--roxo); font-weight:600; }
  .copiar { margin-top:auto; align-self:flex-start; background:var(--tinta); color:#fff; border:0; padding:8px 14px; border-radius:8px; cursor:pointer; font-size:13px; }
  .copiar:hover { opacity:.9; }
  .copiar.ok { background:#16a34a; }
  .vazio { max-width:1100px; margin:40px auto; padding:0 20px; text-align:center; color:var(--cinza); display:none; }
  footer { text-align:center; color:var(--cinza); font-size:13px; padding:30px 20px; }
</style>
</head>
<body>
  <div class="topo"><div class="wrap">
    <h1>Roteiros Destravaí — 90 dias</h1>
    <p>Reels de 30 a 60s · Gancho → Desenvolvimento → CTA · ${roteiros.length} roteiros prontos pra gravar</p>
  </div></div>
  <div class="barra"><div class="wrap">
    <input class="busca" type="text" placeholder="Buscar por tema, palavra, gancho..." oninput="buscar(this.value)">
    ${filtros}
  </div></div>
  <main class="grid" id="grid">
    ${cards}
  </main>
  <div class="vazio" id="vazio">Nenhum roteiro encontrado com esse filtro.</div>
  <footer>Gerado a partir de roteiros-90-dias.md · edite o .md e rode <code>node scripts/gerar-html-roteiros.cjs</code> pra atualizar.</footer>
<script>
  let filtroAtual = 'Todos';
  let buscaAtual = '';
  function aplicar() {
    const cards = document.querySelectorAll('.card');
    let visiveis = 0;
    cards.forEach((c) => {
      const okF = filtroAtual === 'Todos' || c.dataset.pilar === filtroAtual;
      const okB = !buscaAtual || c.dataset.busca.includes(buscaAtual);
      const mostra = okF && okB;
      c.style.display = mostra ? 'flex' : 'none';
      if (mostra) visiveis++;
    });
    document.getElementById('vazio').style.display = visiveis ? 'none' : 'block';
  }
  function filtrar(btn) {
    document.querySelectorAll('.filtro').forEach((b) => b.classList.remove('ativo'));
    btn.classList.add('ativo');
    filtroAtual = btn.dataset.f;
    aplicar();
  }
  function buscar(v) { buscaAtual = v.toLowerCase().trim(); aplicar(); }
  function copiar(btn) {
    const card = btn.closest('.card');
    const t = [...card.querySelectorAll('.campo')]
      .map((c) => c.querySelector('.rotulo').innerText + ': ' + c.querySelector('p').innerText)
      .join('\\n\\n');
    const texto = card.querySelector('h2').innerText + '\\n\\n' + t;
    navigator.clipboard.writeText(texto).then(() => {
      btn.innerText = 'Copiado!';
      btn.classList.add('ok');
      setTimeout(() => { btn.innerText = 'Copiar roteiro'; btn.classList.remove('ok'); }, 1500);
    });
  }
</script>
</body>
</html>`;

fs.writeFileSync(OUT, html, 'utf8');
console.log(`OK: ${roteiros.length} roteiros -> ${path.relative(process.cwd(), OUT)}`);

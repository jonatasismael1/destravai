// Gera mockups de "prints" das telas do Destravaí em formato de celular (PNG).
// Reproduz fielmente as cores, layout e textos reais do app, com dados de exemplo
// (sem dados sensíveis). Saída: docs/Prints/*.png
//
// Uso: node scripts/generate-mockups.mjs

import sharp from 'sharp'
import { writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', 'docs', 'Prints')

// ── Tokens de design (espelham src/index.css e tailwind.config.js) ──────────
const C = {
  bg: '#0B0B12',
  bgCard: '#16151F',
  bgCardBright: '#1E1C2E',
  bgInput: '#14131C',
  purple: '#7C5CFF',
  lilac: '#A78BFA',
  purpleSoft: '#9B8CFF',
  coral: '#FF7A6B',
  mint: '#53D6A1',
  amber: '#FFB547',
  text: '#F7F4FF',
  textSec: 'rgba(247,244,255,0.55)',
  textMuted: 'rgba(247,244,255,0.32)',
  border: 'rgba(55,50,75,0.9)',
}

const W = 390, H = 844

// ── Helpers de SVG ──────────────────────────────────────────────────────────
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function statusBar() {
  return `
    <text x="28" y="34" font-size="14" font-weight="700" fill="${C.text}">9:41</text>
    <g transform="translate(322,22)" fill="${C.text}">
      <rect x="0" y="3" width="17" height="11" rx="2.5" opacity="0.5"/>
      <rect x="20" y="3" width="3" height="11" rx="1.5" opacity="0.5"/>
      <rect x="34" y="0" width="22" height="11" rx="3" fill="none" stroke="${C.text}" stroke-width="1" opacity="0.6"/>
      <rect x="36" y="2" width="16" height="7" rx="1.5"/>
    </g>`
}

function bottomNav(active) {
  const items = [
    { k: 'home', label: 'Início' },
    { k: 'criar', label: 'Criar' },
    { k: 'bib', label: 'Biblioteca' },
    { k: 'cal', label: 'Agenda' },
    { k: 'eu', label: 'Meu Espaço' },
  ]
  const slot = W / items.length
  let out = `<rect x="0" y="${H - 78}" width="${W}" height="78" fill="rgba(11,11,18,0.92)"/>
    <line x1="0" y1="${H - 78}" x2="${W}" y2="${H - 78}" stroke="${C.border}" stroke-width="1"/>`
  items.forEach((it, i) => {
    const cx = slot * i + slot / 2
    const on = it.k === active
    const col = on ? C.purpleSoft : C.textMuted
    out += `
      <circle cx="${cx}" cy="${H - 50}" r="4.5" fill="${col}"/>
      <text x="${cx}" y="${H - 26}" font-size="9.5" font-weight="${on ? 700 : 600}" fill="${col}" text-anchor="middle">${it.label}</text>`
    if (on) out += `<rect x="${cx - 16}" y="${H - 76}" width="32" height="3" rx="1.5" fill="${C.purple}"/>`
  })
  return out
}

function homeIndicator() {
  return `<rect x="${W/2 - 67}" y="${H - 9}" width="134" height="5" rx="2.5" fill="rgba(247,244,255,0.25)"/>`
}

function card(x, y, w, h, opts = {}) {
  const fill = opts.fill || C.bgCard
  const stroke = opts.stroke || C.border
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${opts.r ?? 20}" fill="${fill}" stroke="${stroke}" stroke-width="1"/>`
}

function text(x, y, content, opts = {}) {
  const anchor = opts.anchor || 'start'
  return `<text x="${x}" y="${y}" font-size="${opts.size || 14}" font-weight="${opts.weight || 500}" fill="${opts.fill || C.text}" text-anchor="${anchor}" ${opts.spacing ? `letter-spacing="${opts.spacing}"` : ''}>${esc(content)}</text>`
}

function tag(x, y, label, color) {
  const w = label.length * 6.5 + 20
  return `<rect x="${x}" y="${y}" width="${w}" height="22" rx="11" fill="${color}22" stroke="${color}55" stroke-width="1"/>
    <text x="${x + w/2}" y="${y + 15}" font-size="10" font-weight="700" fill="${color}" text-anchor="middle">${esc(label)}</text>`
}

function pillButton(x, y, w, label, opts = {}) {
  const grad = opts.grad || 'url(#gPurple)'
  return `<rect x="${x}" y="${y}" width="${w}" height="${opts.h || 48}" rx="${(opts.h||48)/2}" fill="${grad}"/>
    <text x="${x + w/2}" y="${y + (opts.h||48)/2 + 5}" font-size="15" font-weight="700" fill="#fff" text-anchor="middle">${esc(label)}</text>`
}

function defs() {
  return `<defs>
    <linearGradient id="gPurple" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${C.purple}"/><stop offset="1" stop-color="${C.lilac}"/>
    </linearGradient>
    <linearGradient id="gCoral" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${C.coral}"/><stop offset="1" stop-color="${C.amber}"/>
    </linearGradient>
    <linearGradient id="gMint" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${C.mint}"/><stop offset="1" stop-color="#3BB88A"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.3" r="0.8">
      <stop offset="0" stop-color="${C.purple}" stop-opacity="0.25"/>
      <stop offset="1" stop-color="${C.purple}" stop-opacity="0"/>
    </radialGradient>
  </defs>`
}

function frame(inner, opts = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Manrope, -apple-system, Segoe UI, sans-serif">
    ${defs()}
    <rect width="${W}" height="${H}" fill="${C.bg}"/>
    <rect width="${W}" height="320" fill="url(#glow)"/>
    ${statusBar()}
    ${inner}
    ${opts.noNav ? '' : bottomNav(opts.active || 'home')}
    ${homeIndicator()}
  </svg>`
}

// ── Telas ───────────────────────────────────────────────────────────────────

function screenHome() {
  let s = ''
  s += text(28, 80, 'Boa tarde, Marina', { size: 22, weight: 800 })
  s += text(28, 104, 'Vamos manter o ritmo hoje?', { size: 14, fill: C.textSec })

  // Nível
  s += card(20, 124, 350, 92, { fill: 'rgba(124,92,255,0.10)', stroke: 'rgba(124,92,255,0.30)' })
  s += `<circle cx="58" cy="170" r="22" fill="url(#gPurple)"/>`
  s += `<text x="58" y="177" font-size="20" text-anchor="middle">🏆</text>`
  s += text(92, 158, 'NÍVEL ATUAL', { size: 10, weight: 700, fill: C.textMuted, spacing: 1.5 })
  s += text(92, 180, 'Criando ritmo', { size: 17, weight: 800 })
  s += `<rect x="92" y="192" width="258" height="6" rx="3" fill="${C.bgInput}"/>`
  s += `<rect x="92" y="192" width="150" height="6" rx="3" fill="url(#gPurple)"/>`

  // Constância dia-a-dia
  s += card(20, 228, 350, 116)
  s += text(36, 256, 'SUA CONSTÂNCIA', { size: 11, weight: 700, fill: C.textMuted, spacing: 1.2 })
  s += text(354, 256, 'Dia 3 de 7', { size: 12, weight: 700, fill: C.coral, anchor: 'end' })
  for (let i = 0; i < 7; i++) {
    const x = 36 + i * 47.5
    const done = i < 3
    const cur = i === 3
    const col = done ? 'url(#gCoral)' : cur ? 'rgba(255,181,71,0.35)' : C.bgInput
    s += `<rect x="${x}" y="276" width="38" height="6" rx="3" fill="${col}"/>`
    s += `<text x="${x + 19}" y="300" font-size="11" font-weight="700" fill="${done ? C.coral : C.textMuted}" text-anchor="middle">${i+1}</text>`
  }
  s += text(36, 330, 'Faltam 4 dias para completar sua primeira semana. Continue!', { size: 11, fill: C.textSec })

  // Check-in
  s += text(28, 378, 'Como está seu dia?', { size: 15, weight: 800 })
  const chips = [['⚡ Tenho 2 min', 0], ['⏱ Tenho 10 min', 1], ['🛍 Quero vender', 2], ['📖 Quero educar', 3]]
  chips.forEach(([label, i]) => {
    const col = i % 2, row = Math.floor(i / 2)
    const x = 20 + col * 178, y = 392 + row * 64
    s += card(x, y, 168, 52, { r: 16 })
    s += text(x + 18, y + 32, label, { size: 13, weight: 700 })
  })

  // Botão surpresa
  s += pillButton(20, 528, 350, '✨ Me surpreenda com uma ideia', { grad: 'url(#gPurple)' })

  return frame(s, { active: 'home' })
}

function screenCriar() {
  let s = ''
  s += text(28, 80, 'Criar conteúdo', { size: 22, weight: 800 })
  s += text(28, 104, 'Gere roteiros sob medida com IA', { size: 13, fill: C.textSec })

  // Tipo de conteúdo
  s += text(28, 142, 'TIPO DE CONTEÚDO', { size: 10, weight: 700, fill: C.textMuted, spacing: 1.5 })
  const types = [['Story', true], ['Sequência', false], ['Reels', false]]
  types.forEach(([label, on], i) => {
    const x = 20 + i * 118
    s += card(x, 154, 108, 70, on ? { fill: 'rgba(124,92,255,0.15)', stroke: 'rgba(124,92,255,0.4)' } : {})
    s += `<text x="${x + 54}" y="190" font-size="22" text-anchor="middle">${i===0?'📱':i===1?'🎬':'🎥'}</text>`
    s += text(x + 54, 212, label, { size: 12, weight: 700, anchor: 'middle', fill: on ? C.purpleSoft : C.textSec })
  })

  // Tema
  s += text(28, 252, 'TEMA', { size: 10, weight: 700, fill: C.textMuted, spacing: 1.5 })
  s += card(20, 264, 350, 50, { fill: C.bgInput })
  s += text(38, 294, 'Como organizo minha rotina de trabalho', { size: 13, fill: C.text })

  // Objetivo
  s += text(28, 344, 'OBJETIVO', { size: 10, weight: 700, fill: C.textMuted, spacing: 1.5 })
  s += card(20, 356, 350, 50, { fill: C.bgInput })
  s += text(38, 386, 'Mostrar autoridade e gerar conexão', { size: 13, fill: C.text })

  // Resultado preview
  s += card(20, 426, 350, 132, { fill: 'rgba(124,92,255,0.08)', stroke: 'rgba(124,92,255,0.25)' })
  s += tag(36, 442, 'Story', C.purple)
  s += tag(92, 442, '2 min', C.amber)
  s += text(36, 488, 'Roteiro gerado', { size: 14, weight: 800 })
  s += text(36, 510, 'Abertura: "Você também sente que o dia', { size: 11.5, fill: C.textSec })
  s += text(36, 526, 'não rende? Eu descobri 3 ajustes que', { size: 11.5, fill: C.textSec })
  s += text(36, 542, 'mudaram minha rotina..."', { size: 11.5, fill: C.textSec })

  s += pillButton(20, 576, 350, '✨ Gerar roteiro', { grad: 'url(#gPurple)' })

  return frame(s, { active: 'criar' })
}

function screenBiblioteca() {
  let s = ''
  s += text(28, 80, 'Biblioteca de ideias', { size: 22, weight: 800 })
  s += text(28, 104, '43 conteúdos prontos para usar', { size: 13, fill: C.textSec })

  // Filtros
  const filters = [['Todos', true], ['Stories', false], ['Reels', false], ['Legendas', false]]
  let fx = 20
  filters.forEach(([label, on]) => {
    const w = label.length * 7 + 28
    s += `<rect x="${fx}" y="124" width="${w}" height="34" rx="17" fill="${on ? 'url(#gPurple)' : C.bgCard}" stroke="${on ? 'none' : C.border}" stroke-width="1"/>`
    s += text(fx + w/2, 146, label, { size: 12, weight: 700, anchor: 'middle', fill: on ? '#fff' : C.textSec })
    fx += w + 8
  })

  // Lista de cards
  const items = [
    ['📱', 'Story', '3 erros que te fazem perder clientes', 'Autoridade', C.purple],
    ['🎥', 'Reels', 'Bastidores do meu processo de trabalho', 'Bastidor', C.amber],
    ['💬', 'Legenda', 'Por que constância vale mais que perfeição', 'Conexão', C.mint],
    ['🛍', 'Story', 'Como funciona meu atendimento (passo a passo)', 'Venda', C.coral],
  ]
  items.forEach((it, i) => {
    const y = 178 + i * 108
    s += card(20, y, 350, 96)
    s += `<rect x="36" y="${y+16}" width="48" height="48" rx="14" fill="${it[4]}22"/>`
    s += `<text x="60" y="${y+47}" font-size="22" text-anchor="middle">${it[0]}</text>`
    s += tag(100, y + 16, it[1], it[4])
    s += text(100, y + 56, it[2].length > 32 ? it[2].slice(0,30)+'…' : it[2], { size: 13, weight: 700 })
    s += text(100, y + 76, '★ ' + it[3], { size: 11, fill: C.textMuted })
  })

  return frame(s, { active: 'bib' })
}

function screenTeleprompter() {
  let s = ''
  // Fundo "câmera" — mais escuro, simulando preview
  s = `<rect width="${W}" height="${H}" fill="#08080D"/>`
  s += statusBar()
  // moldura de gravação
  s += `<rect x="12" y="56" width="${W-24}" height="${H-150}" rx="28" fill="#0E0E16" stroke="rgba(255,122,107,0.5)" stroke-width="2"/>`
  // REC
  s += `<circle cx="40" cy="86" r="6" fill="${C.coral}"/>`
  s += text(54, 91, 'REC  00:14', { size: 13, weight: 700, fill: C.coral })
  s += text(W - 24, 91, 'Story · 2 min', { size: 12, fill: C.textSec, anchor: 'end' })

  // Teleprompter overlay (texto grande rolando)
  s += `<rect x="28" y="300" width="${W-56}" height="240" rx="20" fill="rgba(0,0,0,0.55)"/>`
  const lines = [
    ['Você sente que o dia nunca rende?', C.text, 19],
    ['Eu vivia assim. Até mudar 3 coisas', C.text, 19],
    ['simples na minha rotina.', C.text, 19],
    ['', C.text, 8],
    ['A primeira foi parar de começar', 'rgba(247,244,255,0.4)', 17],
    ['o dia pelo celular...', 'rgba(247,244,255,0.4)', 17],
  ]
  let ly = 340
  lines.forEach(([t, col, sz]) => {
    if (t) s += text(W/2, ly, t, { size: sz, weight: 700, fill: col, anchor: 'middle' })
    ly += sz === 8 ? 16 : 34
  })

  // Controles inferiores
  s += `<circle cx="${W/2}" cy="${H-110}" r="34" fill="none" stroke="#fff" stroke-width="3"/>`
  s += `<circle cx="${W/2}" cy="${H-110}" r="26" fill="${C.coral}"/>`
  s += `<rect x="${W/2-8}" y="${H-118}" width="16" height="16" rx="3" fill="#fff"/>`
  s += text(70, H - 105, '⚙ Velocidade', { size: 12, fill: C.textSec })
  s += text(W - 70, H - 105, '🔄 Virar', { size: 12, fill: C.textSec, anchor: 'end' })
  s += homeIndicator()

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Manrope, sans-serif">${defs()}${s}</svg>`
}

function screenConstancia() {
  let s = ''
  s += text(28, 80, 'Meu progresso', { size: 22, weight: 800 })

  // Score de constância
  s += card(20, 100, 350, 96)
  s += text(36, 130, 'SCORE DE CONSTÂNCIA', { size: 10, weight: 700, fill: C.textMuted, spacing: 1.2 })
  s += text(36, 152, 'Presença constante', { size: 14, weight: 800, fill: C.purpleSoft })
  s += text(354, 150, '72', { size: 30, weight: 800, anchor: 'end' })
  s += text(354, 168, '/100', { size: 12, fill: C.textMuted, anchor: 'end' })
  s += `<rect x="36" y="174" width="318" height="6" rx="3" fill="${C.bgInput}"/>`
  s += `<rect x="36" y="174" width="229" height="6" rx="3" fill="url(#gPurple)"/>`

  // Jornada 7 dias
  s += card(20, 208, 350, 132)
  s += text(36, 236, 'JORNADA DE CONSTÂNCIA', { size: 10, weight: 700, fill: C.textMuted, spacing: 1.2 })
  s += text(354, 236, '🔥 3/7', { size: 13, weight: 800, anchor: 'end' })
  for (let i = 0; i < 7; i++) {
    const x = 36 + i * 47
    const done = i < 3, cur = i === 3
    const fill = done ? 'url(#gCoral)' : cur ? 'rgba(255,181,71,0.12)' : C.bgInput
    s += `<rect x="${x}" y="252" width="40" height="40" rx="13" fill="${fill}" ${cur?`stroke="${C.amber}" stroke-dasharray="3 3" stroke-width="1.5"`:''}/>`
    s += `<text x="${x+20}" y="277" font-size="13" font-weight="700" fill="${done?'#fff':C.textMuted}" text-anchor="middle">${done?'✓':i+1}</text>`
    s += text(x + 20, 308, 'Dia ' + (i+1), { size: 8.5, weight: 700, anchor: 'middle', fill: done ? C.amber : C.textMuted })
  }
  s += text(36, 330, 'Faltam 4 dias para completar sua primeira semana.', { size: 11, fill: C.textSec })

  // Stats
  const stats = [['12', 'Concluídas', C.mint], ['3', 'Dias seguidos', C.coral], ['5', 'Esta semana', C.purpleSoft]]
  stats.forEach((st, i) => {
    const x = 20 + i * 118
    s += card(x, 352, 108, 80, { r: 16 })
    s += text(x + 54, 392, st[0], { size: 24, weight: 800, anchor: 'middle', fill: st[2] })
    s += text(x + 54, 414, st[1], { size: 9.5, weight: 700, anchor: 'middle', fill: C.textMuted })
  })

  // Conquistas
  s += text(28, 470, 'Conquistas', { size: 15, weight: 800 })
  s += text(354, 470, '4/9', { size: 12, weight: 700, fill: C.purpleSoft, anchor: 'end' })
  const badges = ['🎯','🔥','⭐','🚀','🔒','🔒']
  badges.forEach((b, i) => {
    const x = 20 + i * 59
    const on = i < 4
    s += `<rect x="${x}" y="484" width="51" height="51" rx="14" fill="${on?'rgba(124,92,255,0.15)':C.bgCard}" stroke="${on?'rgba(124,92,255,0.35)':C.border}" stroke-width="1"/>`
    s += `<text x="${x+25}" y="516" font-size="20" text-anchor="middle" opacity="${on?1:0.4}">${b}</text>`
  })

  return frame(s, { active: 'eu' })
}

function screenCheckout() {
  let s = ''
  s += text(28, 80, 'Escolha seu plano', { size: 22, weight: 800 })
  s += text(28, 104, '7 dias de garantia. Cancele quando quiser.', { size: 13, fill: C.textSec })

  const plans = [
    ['Starter', 'R$ 29', 'Roteiros ilimitados + biblioteca', false],
    ['Pro', 'R$ 49', 'Tudo do Starter + teleprompter + grupos', true],
    ['Expert', 'R$ 69', 'Tudo do Pro + prioridade e recursos novos', false],
  ]
  let y = 132
  plans.forEach(([name, price, desc, hot]) => {
    const h = hot ? 130 : 104
    s += card(20, y, 350, h, hot ? { fill: 'rgba(124,92,255,0.12)', stroke: 'rgba(124,92,255,0.45)' } : {})
    if (hot) {
      s += `<rect x="250" y="${y-11}" width="104" height="24" rx="12" fill="url(#gCoral)"/>`
      s += text(302, y + 5, 'MAIS POPULAR', { size: 9.5, weight: 800, anchor: 'middle', fill: '#fff', spacing: 0.5 })
    }
    s += text(36, y + 34, name, { size: 17, weight: 800 })
    s += text(354, y + 36, price, { size: 22, weight: 800, anchor: 'end', fill: hot ? C.purpleSoft : C.text })
    s += text(354, y + 54, '/mês', { size: 11, fill: C.textMuted, anchor: 'end' })
    s += text(36, y + 60, desc, { size: 12, fill: C.textSec })
    if (hot) s += pillButton(36, y + 78, 318, 'Assinar Pro', { grad: 'url(#gPurple)', h: 42 })
    y += h + 16
  })

  return frame(s, { noNav: true })
}

function screenRanking() {
  let s = ''
  s += text(28, 80, 'Grupos & Ranking', { size: 22, weight: 800 })
  s += text(28, 104, 'Dispute constância com seus amigos', { size: 13, fill: C.textSec })

  // Card do grupo
  s += card(20, 124, 350, 70, { fill: 'rgba(124,92,255,0.10)', stroke: 'rgba(124,92,255,0.3)' })
  s += `<rect x="36" y="140" width="40" height="40" rx="12" fill="url(#gPurple)"/>`
  s += `<text x="56" y="166" font-size="18" text-anchor="middle">👥</text>`
  s += text(88, 152, 'Constância em Grupo', { size: 15, weight: 800 })
  s += text(88, 172, '5 membros · código DBE7', { size: 11.5, fill: C.textSec })

  // Ranking
  s += text(28, 232, 'Ranking da semana', { size: 14, weight: 800 })
  const rank = [
    ['1', 'Marina (você)', '320 XP', '🥇', true],
    ['2', 'Carla', '285 XP', '🥈', false],
    ['3', 'Júlia', '240 XP', '🥉', false],
    ['4', 'Beatriz', '190 XP', '', false],
    ['5', 'Rafa', '120 XP', '', false],
  ]
  rank.forEach((r, i) => {
    const y = 252 + i * 64
    s += card(20, y, 350, 52, r[4] ? { fill: 'rgba(124,92,255,0.10)', stroke: 'rgba(124,92,255,0.3)' } : {})
    s += r[3]
      ? `<text x="44" y="${y+34}" font-size="20" text-anchor="middle">${r[3]}</text>`
      : text(44, y + 33, r[0], { size: 16, weight: 800, anchor: 'middle', fill: C.textMuted })
    s += text(72, y + 33, r[1], { size: 13.5, weight: r[4] ? 800 : 700, fill: r[4] ? C.purpleSoft : C.text })
    s += text(354, y + 33, r[2], { size: 13, weight: 800, anchor: 'end', fill: C.amber })
  })

  return frame(s, { active: 'eu' })
}

function screenEssencia() {
  let s = ''
  s += text(28, 80, 'Minha Essência', { size: 22, weight: 800 })
  s += text(28, 104, 'O que torna seu conteúdo único', { size: 13, fill: C.textSec })

  // resumo IA
  s += card(20, 124, 350, 120, { fill: 'rgba(83,214,161,0.08)', stroke: 'rgba(83,214,161,0.25)' })
  s += `<text x="40" y="156" font-size="16">✨</text>`
  s += text(60, 156, 'Seu posicionamento', { size: 13, weight: 800, fill: C.mint })
  s += text(36, 182, 'Você ajuda profissionais ocupados a', { size: 12, fill: C.text })
  s += text(36, 200, 'organizarem a rotina com clareza e leveza,', { size: 12, fill: C.text })
  s += text(36, 218, 'sem culpa e sem burnout.', { size: 12, fill: C.text })

  const fields = [
    ['PROFISSÃO', 'Consultora de produtividade'],
    ['NICHO', 'Mulheres empreendedoras 30-45'],
    ['TOM DE VOZ', 'Próximo, direto e acolhedor'],
    ['PILARES', 'Rotina · Mindset · Organização · Vendas'],
  ]
  let y = 260
  fields.forEach(([label, val]) => {
    s += text(28, y, label, { size: 10, weight: 700, fill: C.textMuted, spacing: 1.2 })
    s += card(20, y + 10, 350, 46, { fill: C.bgInput })
    s += text(38, y + 38, val, { size: 13, weight: 600 })
    y += 74
  })

  s += pillButton(20, y + 4, 350, 'Atualizar essência', { grad: 'url(#gPurple)' })

  return frame(s, { active: 'eu' })
}

function screenOnboarding() {
  let s = ''
  // Hero centralizado
  s += `<rect width="${W}" height="${H}" fill="${C.bg}"/>`.replace(/^<rect.*?\/>/, '') // noop keep bg from frame
  s += `<circle cx="${W/2}" cy="200" r="56" fill="url(#gPurple)" opacity="0.95"/>`
  s += `<text x="${W/2}" y="218" font-size="48" text-anchor="middle">🚀</text>`
  s += text(W/2, 300, 'Bem-vinda ao Destravaí', { size: 24, weight: 800, anchor: 'middle' })
  s += text(W/2, 332, 'Seu copiloto para nunca mais travar', { size: 14, fill: C.textSec, anchor: 'middle' })
  s += text(W/2, 352, 'na hora de criar conteúdo.', { size: 14, fill: C.textSec, anchor: 'middle' })

  // Steps
  const steps = [
    ['🎯', 'Roteiros sob medida', 'IA que entende seu nicho e seu tom de voz'],
    ['🎥', 'Grave sem travar', 'Teleprompter integrado em cada roteiro'],
    ['🔥', 'Mantenha a constância', 'Acompanhe seus 7 dias e evolua de nível'],
  ]
  let y = 392
  steps.forEach(([icon, title, desc]) => {
    s += card(20, y, 350, 76)
    s += `<rect x="36" y="${y+16}" width="44" height="44" rx="13" fill="rgba(124,92,255,0.15)"/>`
    s += `<text x="58" y="${y+46}" font-size="20" text-anchor="middle">${icon}</text>`
    s += text(94, y + 34, title, { size: 14, weight: 800 })
    s += text(94, y + 54, desc, { size: 11.5, fill: C.textSec })
    y += 88
  })

  s += pillButton(20, y + 8, 350, 'Começar agora', { grad: 'url(#gPurple)' })
  return frame(s, { noNav: true })
}

// ── Geração ──────────────────────────────────────────────────────────────────
const SCREENS = {
  '01-home': screenHome,
  '02-onboarding': screenOnboarding,
  '03-criar-stories': screenCriar,
  '04-biblioteca-de-ideias': screenBiblioteca,
  '05-teleprompter-gravador': screenTeleprompter,
  '06-constancia-progresso': screenConstancia,
  '07-planos-checkout': screenCheckout,
  '08-grupos-ranking': screenRanking,
  '09-minha-essencia': screenEssencia,
}

async function main() {
  await mkdir(OUT, { recursive: true })
  for (const [name, fn] of Object.entries(SCREENS)) {
    const svg = fn()
    await writeFile(join(OUT, `${name}.svg`), svg, 'utf8')
    await sharp(Buffer.from(svg), { density: 144 })
      .png()
      .toFile(join(OUT, `${name}.png`))
    console.log('✓', name)
  }
  console.log('\nMockups gerados em docs/Prints/')
}

main().catch(e => { console.error(e); process.exit(1) })

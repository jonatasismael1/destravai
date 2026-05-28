/**
 * Substitui cores hardcoded em inline styles de todos os .tsx pelo sistema de CSS variables.
 * Executar uma vez: node scripts/theme-transform.cjs
 */
const fs = require('fs')
const path = require('path')

const SRC = path.join(__dirname, '..', 'src')

// Quais arquivos processar
const FILES = [
  'pages/Home.tsx',
  'pages/Criar.tsx',
  'pages/Essencia.tsx',
  'pages/Biblioteca.tsx',
  'pages/Progresso.tsx',
  'pages/Configuracoes.tsx',
  'pages/Login.tsx',
  'pages/Onboarding.tsx',
  'components/Layout.tsx',
]

// Regras de substituição — ordem importa (mais específico antes)
const RULES = [
  // ── Texto primário ──────────────────────────────────
  [/'#F0EEF8'/g,                          "'var(--text-primary)'"],
  [/'rgba\(240,238,248,0\.9\)'/g,         "'var(--text-primary)'"],
  [/'rgba\(240,238,248,0\.85\)'/g,        "'var(--text-primary)'"],
  [/'rgba\(240,238,248,0\.8\)'/g,         "'var(--text-primary)'"],

  // ── Texto secundário ────────────────────────────────
  [/'rgba\(240,238,248,0\.7\)'/g,         "'var(--text-secondary)'"],
  [/'rgba\(240,238,248,0\.65\)'/g,        "'var(--text-secondary)'"],
  [/'rgba\(240,238,248,0\.6\)'/g,         "'var(--text-secondary)'"],
  [/'rgba\(240,238,248,0\.55\)'/g,        "'var(--text-secondary)'"],
  [/'rgba\(240,238,248,0\.5\)'/g,         "'var(--text-secondary)'"],
  [/'rgba\(240,238,248,0\.45\)'/g,        "'var(--text-secondary)'"],

  // ── Texto mudo ──────────────────────────────────────
  [/'rgba\(240,238,248,0\.4\)'/g,         "'var(--text-muted)'"],
  [/'rgba\(240,238,248,0\.35\)'/g,        "'var(--text-muted)'"],
  [/'rgba\(240,238,248,0\.3\)'/g,         "'var(--text-muted)'"],
  [/'rgba\(240,238,248,0\.25\)'/g,        "'var(--text-muted)'"],
  [/'rgba\(240,238,248,0\.2\)'/g,         "'var(--text-muted)'"],
  [/'rgba\(240,238,248,0\.15\)'/g,        "'var(--text-muted)'"],
  [/'rgba\(240,238,248,0\.1\)'/g,         "'var(--text-muted)'"],

  // ── Fundos de card ──────────────────────────────────
  // Apenas quando precedido de "background: " ou "background:" (JS style props)
  [/background: 'rgba\(255,255,255,0\.04\)'/g,  "background: 'var(--bg-card)'"],
  [/background: 'rgba\(255,255,255,0\.05\)'/g,  "background: 'var(--bg-card)'"],
  [/background: 'rgba\(255,255,255,0\.06\)'/g,  "background: 'var(--bg-card-bright)'"],
  [/background: 'rgba\(255,255,255,0\.07\)'/g,  "background: 'var(--bg-card-bright)'"],
  [/background: 'rgba\(255,255,255,0\.08\)'/g,  "background: 'var(--bg-card-bright)'"],
  [/background: 'rgba\(255,255,255,0\.09\)'/g,  "background: 'var(--bg-card-bright)'"],
  [/background: 'rgba\(255,255,255,0\.1\)'/g,   "background: 'var(--bg-card-bright)'"],

  // ── Bordas de card ──────────────────────────────────
  // Apenas quando é "1px solid rgba(...)" ou "1.5px solid rgba(...)"
  [/'1px solid rgba\(255,255,255,0\.07\)'/g,    "'1px solid var(--border-color)'"],
  [/'1px solid rgba\(255,255,255,0\.08\)'/g,    "'1px solid var(--border-color)'"],
  [/'1px solid rgba\(255,255,255,0\.09\)'/g,    "'1px solid var(--border-color)'"],
  [/'1px solid rgba\(255,255,255,0\.1\)'/g,     "'1px solid var(--border-bright)'"],
  [/'1px solid rgba\(255,255,255,0\.12\)'/g,    "'1px solid var(--border-bright)'"],
  [/'1px solid rgba\(255,255,255,0\.14\)'/g,    "'1px solid var(--border-bright)'"],
  [/'1px solid rgba\(255,255,255,0\.15\)'/g,    "'1px solid var(--border-bright)'"],
  [/'1px solid rgba\(255,255,255,0\.2\)'/g,     "'1px solid var(--border-bright)'"],
  [/'1\.5px solid rgba\(255,255,255,0\.\d+\)'/g, "'1.5px solid var(--border-color)'"],
]

let totalReplacements = 0

FILES.forEach(relPath => {
  const filePath = path.join(SRC, relPath)
  if (!fs.existsSync(filePath)) {
    console.log(`SKIP (not found): ${relPath}`)
    return
  }

  let content = fs.readFileSync(filePath, 'utf8')
  const original = content
  let fileReplacements = 0

  RULES.forEach(([pattern, replacement]) => {
    const before = content
    content = content.replace(pattern, replacement)
    // Count replacements by comparing lengths (rough estimate)
    if (content !== before) fileReplacements++
  })

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8')
    console.log(`✓ Updated: ${relPath} (${fileReplacements} rules applied)`)
    totalReplacements += fileReplacements
  } else {
    console.log(`  No changes: ${relPath}`)
  }
})

console.log(`\nDone — ${totalReplacements} rule applications across ${FILES.length} files.`)

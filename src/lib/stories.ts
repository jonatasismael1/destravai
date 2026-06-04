// Utilitários para lidar com SEQUÊNCIAS de stories.
//
// A IA, ao gerar uma sequência, marca cada story com um cabeçalho "STORY 1",
// "STORY 2", "STORY 3" (ver prompts em src/lib/ai.ts). Estas funções quebram esse
// conteúdo em stories individuais para que o usuário grave 1 a 1 — e não veja um
// único bloco gigante com tudo junto.
//
// Centralizado aqui para que Home, Criar e Biblioteca usem exatamente a mesma
// lógica (antes a regra vivia só na Home).

// Regex do cabeçalho de story. Aceita "STORY 1", "HISTÓRIA 2", com "===" opcional
// antes (alguns modelos decoram com isso). Usado tanto para detectar quanto para
// dividir o texto.
const STORY_HEADER = /(?:^|\n)\s*(?:={2,}\s*)?(?:STORY|HIST[ÓO]RIA)\s*\d+/i

// Divide o conteúdo de uma SEQUÊNCIA em stories individuais usando os marcadores
// "STORY 1/2/3". Sem marcadores (geração antiga), devolve o conteúdo inteiro como
// um único item — assim nada quebra com conteúdo legado.
export function splitSequenceStories(content: string): string[] {
  const text = (content || '').trim()
  if (!text) return []
  if (!STORY_HEADER.test(text)) return [text]
  return text
    .split(/\n(?=\s*(?:={2,}\s*)?(?:STORY|HIST[ÓO]RIA)\s*\d+)/i)
    .map(s => s.trim())
    .filter(Boolean)
}

// Remove o cabeçalho "STORY N" da primeira linha (para exibir o corpo limpo).
export function stripStoryHeader(story: string): string {
  return story.replace(/^\s*(?:={2,}\s*)?(?:STORY|HIST[ÓO]RIA)\s*\d+\s*[—:-]?\s*/i, '').trim()
}

// Extrai APENAS o "texto na tela" de um bloco de conteúdo (story/foto), ou seja,
// exatamente o que a pessoa vai escrever visualmente no story. Descarta rótulos
// de instrução (FOTO:, CENA:, LEGENDA:, EDIÇÃO:, dica, observação…) e o cabeçalho
// "STORY N". Usado pelo botão "copiar texto" do conteúdo com foto.
//
// Reconhece "TEXTO NA TELA:" (e variações como "TEXTO:", "TELA:") e captura tudo
// que vem depois, inclusive linhas de continuação, até o próximo rótulo.
export function extractScreenText(raw: string): string {
  const body = stripStoryHeader(raw || '')
  const out: string[] = []
  let capturing = false

  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) { capturing = false; continue }      // linha vazia encerra o bloco
    const colon = line.indexOf(':')
    const label = colon > 0 && colon <= 40 ? line.slice(0, colon).toUpperCase().trim() : ''

    if (label) {
      // É o rótulo do texto na tela? (TEXTO NA TELA / TEXTO / TELA)
      if (/\bTEXTO\b/.test(label) || /\bTELA\b/.test(label)) {
        capturing = true
        const after = line.slice(colon + 1).trim()
        if (after) out.push(after)
      } else {
        capturing = false                            // outro rótulo → para de capturar
      }
    } else if (capturing) {
      out.push(line)                                 // continuação do texto na tela
    }
  }

  const screen = out.join('\n').trim()
  // Sem rótulos reconhecidos (conteúdo legado/sem marcação): devolve o corpo limpo
  // para o botão copiar nunca ficar vazio.
  return screen || body.trim()
}

// Inverso de extractScreenText: devolve só a DIREÇÃO da foto (o que fotografar,
// cena, ângulo…), descartando o "texto na tela". Usado para exibir a orientação
// sem repetir o texto que já aparece destacado/copiável. Vazio se só houver texto.
export function extractPhotoDirection(raw: string): string {
  const body = stripStoryHeader(raw || '')
  const out: string[] = []
  let skipping = false   // dentro de um bloco "TEXTO NA TELA" (descartar)

  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) { skipping = false; continue }
    const colon = line.indexOf(':')
    const label = colon > 0 && colon <= 40 ? line.slice(0, colon).toUpperCase().trim() : ''

    if (label) {
      if (/\bTEXTO\b/.test(label) || /\bTELA\b/.test(label)) {
        skipping = true                  // pula este rótulo e suas continuações
      } else {
        skipping = false
        out.push(line)                   // outro rótulo (FOTO:, CENA:…) → mantém
      }
    } else if (!skipping) {
      out.push(line)
    }
  }
  return out.join('\n').trim()
}

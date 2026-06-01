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

import type { EssenceContext } from './initialLibrary'

export type GenerationContentType =
  | 'story_sequence'
  | 'reels_script'
  | 'caption'
  | 'carousel_idea'
  | 'static_post'
  | 'hook'
  | 'cta'
  | 'daily_prompt'

const TYPE_INSTRUCTIONS: Record<GenerationContentType, string> = {
  story_sequence: `Crie uma sequência de 3 stories encadeados:
Story 1 — Gancho: captura atenção, cria curiosidade ou identificação
Story 2 — Desenvolvimento: aprofunda, educa ou conecta emocionalmente
Story 3 — CTA: convida para uma ação clara e natural
Para cada story: descreva visual, texto na tela e fala sugerida.`,

  reels_script: `Crie um roteiro completo para Reels de 30-45 segundos:
- Gancho (3 segundos): frase ou cena que para o scroll
- Corpo: desenvolvimento dinâmico, uma ideia por corte
- Fechamento: conclusão + CTA integrado
Descreva cena, câmera, texto na tela e fala sugerida.`,

  caption: `Crie uma legenda para Instagram:
- Abertura com frase de impacto (sem emoji)
- Desenvolvimento que complementa o visual
- Fechamento com CTA natural
- Quebras de linha para leitura fácil
Inclua 8-10 hashtags relevantes para o nicho.`,

  carousel_idea: `Crie uma ideia de carrossel:
- Capa: frase de gancho
- Slides 2-8: desenvolvimento com uma ideia por slide
- Último slide: CTA
Para cada slide: descreva o texto principal e visual sugerido.`,

  static_post: `Crie uma ideia de post estático:
- Descrição do visual/foto ideal
- Texto para sobrepor na imagem
- Legenda complementar
- CTA sugerido`,

  hook: `Crie um gancho de abertura impactante:
- Uma única frase que para o scroll instantaneamente
- Deve criar curiosidade, identificação ou provocar reação
- Máximo 10 palavras
- Não usar clichês`,

  cta: `Crie uma chamada para ação personalizada:
- Direta e natural no tom de voz desta pessoa
- Específica para o nicho e serviços
- Máximo 2 linhas
- Deve soar como essa pessoa falaria no dia a dia`,

  daily_prompt: `Crie um prompt de rotina diária:
- Uma ideia rápida para gravar em 2-5 minutos
- Executável em qualquer lugar (clínica, casa, carro)
- Não requer edição complexa
- Conecta momento pessoal com autoridade profissional`,
}

export function buildContentGenerationPrompt(
  type: GenerationContentType,
  essence: EssenceContext,
  context?: Record<string, unknown>
): string {
  const positioning = essence.ai_positioning ? JSON.stringify(essence.ai_positioning) : ''

  return `Você é um estrategista de conteúdo para Instagram. Crie UM conteúdo personalizado para este profissional.

════════════════════════════════════
PERFIL
════════════════════════════════════
Profissão: ${essence.profession ?? ''}
Nicho: ${essence.niche ?? ''}
Público: ${essence.audience ?? ''}
Tom de voz: ${essence.tone_of_voice ?? ''}
Serviços: ${(essence.services ?? []).join(', ') || ''}
Restrições: ${(essence.restrictions ?? []).join(', ') || 'nenhuma'}
${positioning ? `Posicionamento: ${positioning}` : ''}
${essence.ai_summary ? `Essência: ${essence.ai_summary.slice(0, 300)}` : ''}

════════════════════════════════════
INSTRUÇÕES PARA O TIPO: ${type.toUpperCase()}
════════════════════════════════════
${TYPE_INSTRUCTIONS[type]}

${context ? `CONTEXTO ADICIONAL FORNECIDO:\n${JSON.stringify(context, null, 2)}` : ''}

════════════════════════════════════
DIRETRIZES OBRIGATÓRIAS
════════════════════════════════════
1. O conteúdo deve soar como a VOZ REAL desta pessoa — não genérico
2. Respeite TODAS as restrições listadas
3. Para profissionais da saúde: evite promessas absolutas, diagnósticos ou sensacionalismo
4. Nada de clichês, frases de autoajuda rasa ou linguagem inflada
5. Texto direto, executável, que caiba na rotina real

Responda EXCLUSIVAMENTE com este JSON (sem markdown, sem texto fora):
{
  "type": "${type}",
  "title": "título descritivo em até 8 palavras",
  "content": "conteúdo completo com todos os detalhes de execução",
  "category": "categoria temática",
  "tags": ["tag1", "tag2"]
}`
}

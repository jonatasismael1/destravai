export interface EssenceContext {
  profession?: string | null
  niche?: string | null
  audience?: string | null
  tone_of_voice?: string | null
  ai_summary?: string | null
  ai_positioning?: string | null
  topics?: string[] | null
  restrictions?: string[] | null
  services?: string[] | null
  frequent_questions?: string[] | null
  common_objections?: string[] | null
  phrases?: string[] | null
  differentials?: string | null
}

export function buildInitialLibraryPrompt(essence: EssenceContext): string {
  const positioning = essence.ai_positioning ? JSON.stringify(essence.ai_positioning) : ''

  return `Você é um estrategista de conteúdo para Instagram especializado em criar material prático e personalizado.

Seu trabalho agora é criar uma biblioteca inicial de conteúdos para este profissional. Os conteúdos devem ser específicos para o perfil abaixo — nada genérico.

════════════════════════════════════
PERFIL DO PROFISSIONAL
════════════════════════════════════

Profissão: ${essence.profession ?? 'não informado'}
Nicho: ${essence.niche ?? 'não informado'}
Público-alvo: ${essence.audience ?? 'não informado'}
Tom de voz: ${essence.tone_of_voice ?? 'não informado'}
Serviços: ${(essence.services ?? []).join(', ') || 'não informado'}
Assuntos: ${(essence.topics ?? []).join(', ') || 'não informado'}
Restrições: ${(essence.restrictions ?? []).join(', ') || 'nenhuma'}
Dúvidas frequentes do público: ${(essence.frequent_questions ?? []).join(' / ') || 'não informado'}
Objeções comuns: ${(essence.common_objections ?? []).join(' / ') || 'não informado'}
Frases e bordões: ${(essence.phrases ?? []).join(', ') || 'nenhum'}
Diferenciais: ${essence.differentials ?? 'não informado'}
${positioning ? `Posicionamento completo: ${positioning}` : ''}
${essence.ai_summary ? `Resumo da essência: ${essence.ai_summary}` : ''}

════════════════════════════════════
INSTRUÇÕES
════════════════════════════════════

Gere uma biblioteca inicial personalizada. Cada item deve:
- Ser específico para este profissional (não genérico)
- Respeitar as restrições listadas
- Usar o tom de voz declarado
- Ser executável em stories, reels ou posts
- Ter título claro, conteúdo completo e prático

Gere EXATAMENTE os seguintes itens no JSON abaixo:
- 10 ideias de stories (type: "content_idea", format: "story")
- 10 ideias de reels curtos (type: "content_idea", format: "reels")
- 10 ganchos de abertura (type: "hook")
- 10 CTAs personalizados (type: "cta")
- 5 sequências de stories completas (type: "story_sequence")
- 5 ideias de carrossel (type: "carousel_idea")
- 5 ideias de post estático (type: "static_post_idea")
- 10 respostas para objeções/dúvidas comuns (type: "objection_answer")
- 7 prompts de rotina diária (type: "routine_prompt")

Total: 72 itens.

Responda EXCLUSIVAMENTE com este JSON (sem markdown, sem texto fora):
{
  "items": [
    {
      "type": "content_idea",
      "title": "título em até 8 palavras",
      "content": "roteiro completo ou descrição detalhada de como executar",
      "category": "categoria temática do conteúdo",
      "format": "story | reels | carousel | static | hook | cta | routine",
      "tags": ["tag1", "tag2"]
    }
  ]
}`
}

export function buildSingleItemPrompt(
  essence: EssenceContext,
  type: string,
  context?: Record<string, unknown>
): string {
  const positioning = essence.ai_positioning ? JSON.stringify(essence.ai_positioning) : ''

  return `Você é um estrategista de conteúdo para Instagram.

Crie UM conteúdo do tipo "${type}" para este profissional.

PERFIL
Profissão: ${essence.profession ?? ''}
Nicho: ${essence.niche ?? ''}
Público: ${essence.audience ?? ''}
Tom de voz: ${essence.tone_of_voice ?? ''}
Restrições: ${(essence.restrictions ?? []).join(', ') || 'nenhuma'}
${positioning ? `Posicionamento: ${positioning}` : ''}

${context ? `CONTEXTO ADICIONAL: ${JSON.stringify(context)}` : ''}

DIRETRIZES
- Nada genérico — personalize para este profissional
- Respeite as restrições listadas
- Use o tom de voz declarado
- Conteúdo executável, direto, prático

Responda EXCLUSIVAMENTE com este JSON:
{
  "type": "${type}",
  "title": "título em até 8 palavras",
  "content": "conteúdo completo e detalhado",
  "category": "categoria temática",
  "format": "story | reels | carousel | static | hook | cta | routine",
  "tags": ["tag1", "tag2"]
}`
}

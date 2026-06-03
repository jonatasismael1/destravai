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
  pronoun?: string | null   // 'ele' | 'ela' | 'neutro' — concordância de gênero
}

const PRONOUN_RULE: Record<string, string> = {
  ele: 'Esta pessoa se identifica no MASCULINO (ele). Faça toda a concordância de gênero no masculino. Nunca a trate no feminino.',
  ela: 'Esta pessoa se identifica no FEMININO (ela). Faça toda a concordância de gênero no feminino. Nunca a trate no masculino.',
  neutro: 'Use linguagem neutra de gênero ao se referir a esta pessoa.',
}

export function buildInitialLibraryPrompt(essence: EssenceContext): string {
  const positioning = essence.ai_positioning ? JSON.stringify(essence.ai_positioning) : ''
  const pronounRule = essence.pronoun ? PRONOUN_RULE[essence.pronoun] : ''

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
${pronounRule ? `Identidade (concordância de gênero — siga à risca): ${pronounRule}` : ''}
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

Gere EXATAMENTE os seguintes itens no JSON abaixo (conteúdo conciso e direto
em cada um, para caber tudo na resposta):
- 5 ideias de stories (type: "content_idea", format: "story")
- 4 ideias de reels curtos (type: "content_idea", format: "reels")
- 5 ganchos de abertura (type: "hook")
- 5 CTAs personalizados (type: "cta")
- 3 sequências de stories completas (type: "story_sequence")
- 2 ideias de carrossel (type: "carousel_idea")
- 2 ideias de post estático (type: "static_post_idea")
- 4 respostas para objeções/dúvidas comuns (type: "objection_answer")
- 3 prompts de rotina diária (type: "routine_prompt")

Total: 33 itens.

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

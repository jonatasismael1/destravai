export interface EssenceAnswers {
  profession?: string
  niche?: string
  audience?: string
  tone_of_voice?: string
  content_goals?: string
  routine?: string
  preferred_formats?: string[]
  topics?: string[]
  restrictions?: string[]
  differentials?: string
  services?: string[]
  frequent_questions?: string[]
  common_objections?: string[]
  phrases?: string[]
  references_text?: string
  [key: string]: unknown
}

export function buildEssenceSummaryPrompt(answers: EssenceAnswers): string {
  return `Você é um estrategista de marca e posicionamento digital especializado em profissionais que criam conteúdo para Instagram.

Sua tarefa é analisar as respostas abaixo e gerar um perfil estratégico completo desta pessoa.

════════════════════════════════════
RESPOSTAS DO PROFISSIONAL
════════════════════════════════════

Profissão / área de atuação: ${answers.profession ?? 'não informado'}
Nicho específico: ${answers.niche ?? 'não informado'}
Público-alvo: ${answers.audience ?? 'não informado'}
Tom de voz: ${answers.tone_of_voice ?? 'não informado'}
Objetivos com conteúdo: ${answers.content_goals ?? 'não informado'}
Rotina de gravação: ${answers.routine ?? 'não informado'}
Formatos preferidos: ${(answers.preferred_formats ?? []).join(', ') || 'não informado'}
Assuntos que aborda: ${(answers.topics ?? []).join(', ') || 'não informado'}
Restrições (ética, comercial, pessoal): ${(answers.restrictions ?? []).join(', ') || 'nenhuma'}
Diferenciais: ${answers.differentials ?? 'não informado'}
Serviços e produtos: ${(answers.services ?? []).join(', ') || 'não informado'}
Dúvidas frequentes do público: ${(answers.frequent_questions ?? []).join(' / ') || 'não informado'}
Objeções comuns: ${(answers.common_objections ?? []).join(' / ') || 'não informado'}
Frases e bordões: ${(answers.phrases ?? []).join(', ') || 'nenhum'}
Referências de estilo/criadores: ${answers.references_text ?? 'não informado'}

════════════════════════════════════
INSTRUÇÕES
════════════════════════════════════

Gere um perfil estratégico completo com:

1. **Resumo da essência** (3-4 parágrafos): Quem é essa pessoa, o que ela representa, o que a diferencia e como ela se comunica. Escreva como se fosse uma briefing para um time de conteúdo. Tom claro, direto, sem jargões.

2. **Posicionamento organizado** (formato JSON com os campos abaixo): Use este posicionamento como contexto fixo em todos os prompts de geração de conteúdo.

Responda EXCLUSIVAMENTE com este JSON (sem markdown, sem texto fora do JSON):
{
  "ai_summary": "texto corrido de 3-4 parágrafos descrevendo a essência completa da pessoa",
  "ai_positioning": {
    "who": "quem é esse profissional em 1 frase",
    "audience": "para quem cria conteúdo em 1 frase",
    "tone": "como se comunica — descrição do tom de voz",
    "pillars": ["pilar 1", "pilar 2", "pilar 3", "pilar 4"],
    "differentials": "o que diferencia esse profissional em 1-2 frases",
    "avoid": "o que nunca deve aparecer no conteúdo",
    "services": ["serviço 1", "serviço 2"],
    "common_questions": ["dúvida 1", "dúvida 2", "dúvida 3"],
    "content_formats": ["formato 1", "formato 2"],
    "goals": "objetivo principal com o conteúdo"
  }
}`
}

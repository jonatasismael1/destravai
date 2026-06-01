import type { ContentIdea, GenerateRequest, ExposureLevel, ProfessionalProfile, PersonalContext, JournalEntry, PersonalIdea } from '../types'
import type { BrandEssence, LibraryItemType } from './supabase/types'
import { generateText } from './ai/googleGemini'
import { buildEssenceSummaryPrompt } from './ai/prompts/essenceSummary'
import { buildInitialLibraryPrompt } from './ai/prompts/initialLibrary'
import { loadUserMemory, buildMemoryBlock } from '../services/userMemoryService'

// ── Cache curto da memória do usuário ─────────────────────────────────────────
// Ações como o check-in da Home disparam 3 gerações em sequência. Para não
// consultar o banco 3x, guardamos o bloco de memória por alguns segundos.
// Tolerante a falhas: se a memória falhar, devolve string vazia e o prompt fica
// EXATAMENTE igual ao comportamento atual.
let _memoryBlockCache: { value: string; at: number } | null = null
const MEMORY_TTL_MS = 30_000

async function getMemoryBlock(): Promise<string> {
  const now = Date.now()
  if (_memoryBlockCache && now - _memoryBlockCache.at < MEMORY_TTL_MS) {
    return _memoryBlockCache.value
  }
  try {
    const memory = await loadUserMemory()
    const block = buildMemoryBlock(memory)
    _memoryBlockCache = { value: block, at: now }
    return block
  } catch {
    return ''
  }
}

const EXPOSURE_LABELS: Record<ExposureLevel, string> = {
  'no-appearance': 'não aparece no vídeo — usa só texto, imagem estática ou carrossel',
  'appear-no-talk': 'aparece fisicamente mas não fala — texto na tela, gestual, presença',
  'short-videos': 'grava vídeos curtos de até 30 segundos, fala de forma rápida e direta',
  'comfortable-talking': 'fala diretamente para a câmera com naturalidade e desenvoltura',
  'humor-backstage': 'usa bastidores reais, humor genuíno, momentos autênticos do dia a dia',
}

const TYPE_INSTRUCTIONS: Record<string, string> = {
  story: `Crie 1 story único e impactante. Estrutura: gancho visual/texto + mensagem central + encerramento.
Deve ser direto, executável em menos de 30 segundos de atenção. Descreva o visual, o texto na tela e a fala (se houver).`,

  sequence: `Crie uma sequência de 3 stories encadeados. Cada story deve ter:
Story 1 — Gancho: captura atenção, cria curiosidade ou identificação
Story 2 — Desenvolvimento: aprofunda, educa, conecta emocionalmente ou apresenta solução
Story 3 — CTA: convida a uma ação clara e natural
Descreva visual, texto na tela e fala para cada story.`,

  reel: `Crie um roteiro completo para um Reels de 30 a 45 segundos. Estrutura:
- Gancho (primeiros 3 segundos): a frase ou imagem que para o scroll
- Corpo: desenvolvimento dinâmico, ritmo rápido, 1 ideia por corte
- Fechamento: conclusão + CTA integrado
Descreva cena, posição de câmera, texto na tela, fala e sugestão de edição.`,
}

function buildPrompt(req: GenerateRequest, memoryBlock = ''): string {
  const { profile } = req
  const pillarList = profile.pillars.map((p, i) => `${i + 1}. ${p.name}${p.description ? ` (${p.description})` : ''}`).join('\n')
  const serviceList = profile.services.map(s => `- ${s.name}${s.commercialGoal ? ` (${s.commercialGoal})` : ''}`).join('\n')
  const toneList = profile.voiceTone.join(', ')
  const exposureDesc = EXPOSURE_LABELS[req.exposureLevel]
  const audience = profile.targetAudience || `público interessado em ${profile.specialty}`

  return `Você é um estrategista de conteúdo digital para Instagram. Sua tarefa é criar um roteiro ORIGINAL e PERSONALIZADO para o seguinte profissional.

═══════════════════════════════
PERFIL DO PROFISSIONAL
═══════════════════════════════
Nome profissional: ${profile.professionalName}
Área de atuação: ${profile.specialty}
Público-alvo: ${audience}
Tom de voz: ${toneList || 'profissional, humano e acessível'}
${profile.catchphrase ? `Bordão/frase característica: "${profile.catchphrase}"` : ''}

Pilares de conteúdo (temas que domina e quer comunicar):
${pillarList || '- Autoridade na área\n- Humanização do atendimento'}

Serviços/produtos que oferece:
${serviceList || '- Serviços e atendimentos na área de atuação'}

${profile.avoidedWords?.length ? `NUNCA use estas palavras ou expressões: ${profile.avoidedWords.join(', ')}` : ''}
${profile.limits?.avoidTopics?.length ? `EVITE completamente estes temas: ${profile.limits.avoidTopics.join(', ')}` : ''}

═══════════════════════════════
BRIEFING DO CONTEÚDO
═══════════════════════════════
Formato: ${req.type === 'story' ? 'Story único' : req.type === 'sequence' ? 'Sequência de 3 stories' : 'Reels curto (30-45s)'}
Tema central: ${req.theme}
Objetivo principal: ${req.objective}
${req.format ? `Estilo/formato específico: ${req.format}` : ''}
Tempo que o profissional tem para gravar: ${req.timeAvailable}
Como aparece no conteúdo: ${exposureDesc}

═══════════════════════════════
DIRETRIZES OBRIGATÓRIAS
═══════════════════════════════
1. O conteúdo deve soar como se fosse a voz REAL desta pessoa, não um texto genérico
2. Use o conhecimento da área para criar algo que só este profissional poderia dizer com autoridade
3. Adapte o tom ao estilo declarado (${toneList})
4. O roteiro deve ser 100% executável dentro do tempo disponível (${req.timeAvailable})
5. Considere o nível de exposição: ${exposureDesc}
6. Toda venda deve ter contexto humano — nunca soe como propaganda
7. Seja específico sobre gestos, posicionamento de câmera e texto na tela

═══════════════════════════════
INSTRUÇÃO DE GERAÇÃO
═══════════════════════════════
${TYPE_INSTRUCTIONS[req.type]}
${memoryBlock}
${req.type === 'sequence' ? `
FORMATO OBRIGATÓRIO DA SEQUÊNCIA (para o app separar os stories e a pessoa gravar 1 a 1):
Dentro de "content", comece CADA um dos 3 stories com uma linha contendo APENAS "STORY 1", depois "STORY 2", depois "STORY 3" (nessa ordem), seguida das linhas rotuladas (FALA:, TEXTO NA TELA:, CENA:) daquele story.` : ''}

Responda EXCLUSIVAMENTE com este JSON (sem markdown, sem explicação, sem texto fora do JSON):
{
  "theme": "título criativo e descritivo do conteúdo (máx 8 palavras)",
  "objective": "o que este conteúdo vai gerar no público (1 frase)",
  "timeEstimate": "tempo real de gravação estimado",
  "content": "roteiro em LINHAS ROTULADAS. Cada linha começa com um destes rótulos em MAIÚSCULAS seguido de dois-pontos: 'FALA:' = exatamente o que dizer em voz alta, palavra por palavra, em primeira pessoa (SEM instruções dentro da fala); 'TEXTO NA TELA:' = o que aparece escrito; 'CENA:' = enquadramento/ação; 'EDIÇÃO:' = corte/transição. Separe cada bloco com uma quebra de linha. Use uma linha 'FALA:' para cada trecho falado. Se o conteúdo não tiver fala, não inclua linhas 'FALA:'.${req.type === 'sequence' ? ' Para SEQUÊNCIA: preceda cada story com a linha STORY 1, STORY 2, STORY 3.' : ''}",
  "cta": "chamada para ação final natural e não-forçada, que soe como a pessoa falaria",
  "tags": ["categoria1", "categoria2"]
}`
}

// Chama a IA via Edge Function destravai-gemini (chave fica no servidor).
async function callGemini(prompt: string): Promise<string> {
  return generateText(prompt)
}

function extractJSON(raw: string): Record<string, unknown> {
  const cleaned = raw
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim()

  // 1) Tenta o texto inteiro.
  try {
    return JSON.parse(cleaned)
  } catch { /* segue para tentativas tolerantes */ }

  // 2) Recorta do primeiro { (ou [) até o último } (ou ]) — ignora texto ao redor.
  const firstObj = cleaned.indexOf('{')
  const lastObj = cleaned.lastIndexOf('}')
  const firstArr = cleaned.indexOf('[')
  const lastArr = cleaned.lastIndexOf(']')

  const candidates: string[] = []
  if (firstObj !== -1 && lastObj > firstObj) candidates.push(cleaned.slice(firstObj, lastObj + 1))
  if (firstArr !== -1 && lastArr > firstArr) candidates.push(cleaned.slice(firstArr, lastArr + 1))

  for (const c of candidates) {
    try {
      const parsed = JSON.parse(c)
      // Se vier um array, embrulha para manter o contrato Record<string, unknown>.
      return Array.isArray(parsed) ? { items: parsed } : parsed
    } catch { /* tenta o próximo */ }
  }

  // 3) Reparo de JSON TRUNCADO. O Gemini às vezes corta a resposta no limite de
  //    tokens, deixando o JSON incompleto. Aqui pegamos do primeiro abre-chave/
  //    colchete até o fim e fechamos o que ficou em aberto (string + estruturas).
  const start = firstObj !== -1 && (firstArr === -1 || firstObj < firstArr) ? firstObj : firstArr
  if (start !== -1) {
    const repaired = repairTruncatedJSON(cleaned.slice(start))
    if (repaired) {
      try {
        const parsed = JSON.parse(repaired)
        return Array.isArray(parsed) ? { items: parsed } : parsed
      } catch { /* desiste abaixo */ }
    }
  }

  throw new Error(`JSON_NOT_FOUND — modelo retornou: "${cleaned.slice(0, 200)}"`)
}

// Fecha um JSON que foi cortado no meio (resposta truncada da IA). Percorre o
// texto rastreando se está dentro de string e a pilha de { } / [ ]; no fim,
// fecha a string aberta e todas as estruturas pendentes, na ordem correta.
function repairTruncatedJSON(s: string): string | null {
  const stack: string[] = []
  let inString = false
  let escaped = false

  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (inString) {
      if (escaped) { escaped = false }
      else if (ch === '\\') { escaped = true }
      else if (ch === '"') { inString = false }
      continue
    }
    if (ch === '"') inString = true
    else if (ch === '{') stack.push('}')
    else if (ch === '[') stack.push(']')
    else if (ch === '}' || ch === ']') stack.pop()
  }

  if (stack.length === 0 && !inString) return null // não estava truncado

  let out = s
  // Remove uma vírgula/dois-pontos pendente no fim para não gerar JSON inválido.
  out = out.replace(/[\s]*$/, '')
  if (inString) out += '"'           // fecha a string aberta
  out = out.replace(/[,:]\s*$/, '')  // remove separador solto após fechar string
  while (stack.length) out += stack.pop()
  return out
}

function buildPersonalSuggestionsPrompt(
  profile: ProfessionalProfile,
  ctx: PersonalContext,
  recentJournal: JournalEntry[],
  recentIdeas: PersonalIdea[]
): string {
  const journalExcerpts = recentJournal.length > 0
    ? recentJournal.map(e => `- [${e.mood}] "${e.content.slice(0, 120)}..."`).join('\n')
    : '(nenhuma entrada ainda)'

  const ideaList = recentIdeas.length > 0
    ? recentIdeas.map(i => `- [${i.category}] ${i.content}`).join('\n')
    : '(nenhuma ideia anotada ainda)'

  return `Você é um estrategista de conteúdo autêntico que ajuda profissionais a criarem conteúdo no Instagram que reflita quem eles realmente são.

═══════════════════════════════
PERFIL PROFISSIONAL
═══════════════════════════════
Nome: ${profile.professionalName}
Área de atuação: ${profile.specialty}
Tom de voz: ${profile.voiceTone?.join(', ') || 'profissional e humano'}
Público: ${profile.targetAudience || `interessados em ${profile.specialty}`}

═══════════════════════════════
CONTEXTO PESSOAL
═══════════════════════════════
${ctx.nickname ? `Como gosta de ser chamado(a): ${ctx.nickname}` : ''}
${ctx.lifeMoment ? `Momento de vida atual: ${ctx.lifeMoment}` : ''}
${ctx.hobbies?.length ? `Hobbies e interesses: ${ctx.hobbies.join(', ')}` : ''}
${ctx.personalValues?.length ? `Valores pessoais: ${ctx.personalValues.join(', ')}` : ''}
${ctx.motivations ? `O que me motiva: ${ctx.motivations}` : ''}

ENTRADAS RECENTES DO DIÁRIO:
${journalExcerpts}

IDEIAS ANOTADAS:
${ideaList}

═══════════════════════════════
TAREFA
═══════════════════════════════
Gere EXATAMENTE 3 sugestões de ideias de conteúdo que:
1. Conectem autenticamente a vida pessoal deste profissional com sua autoridade técnica
2. Soem como histórias reais que só esta pessoa poderia contar
3. Sejam práticas de executar em stories ou reels curtos
4. Não sejam genéricas — devem fazer referência explícita a elementos do contexto pessoal fornecido

Cada sugestão deve ser uma FRASE CURTA (máx 2 linhas) descrevendo a ideia de conteúdo de forma instigante.

Responda EXCLUSIVAMENTE com JSON (sem markdown, sem texto fora do JSON):
{
  "suggestions": [
    "ideia 1 aqui",
    "ideia 2 aqui",
    "ideia 3 aqui"
  ]
}`
}

interface CheckinConfig {
  ctx: string
  time: string
  type: ContentIdea['type']
  formatLabel: string
  formatInstruction: string
}

// Contextos de check-in universais (sem linguagem saúde-específica)
const CHECKIN_CONFIG: Record<string, CheckinConfig> = {
  '2min': {
    ctx: 'Tenho apenas 2 minutos livres agora, precisa ser MUITO rápido e simples de executar',
    time: '2 minutos',
    type: 'story',
    formatLabel: 'Story',
    formatInstruction: 'STORY de até 30 segundos falando direto para a câmera, ou foto com frase impactante. Nada que exija edição complexa.',
  },
  '10min': {
    ctx: 'Tenho 10 minutos disponíveis agora',
    time: '10 minutos',
    type: 'sequence',
    formatLabel: 'Sequência de stories',
    formatInstruction: 'SEQUÊNCIA de 3 stories encadeados (story 1: gancho, story 2: conteúdo, story 3: CTA). Cada story simples de gravar.',
  },
  'work': {
    ctx: 'Estou no meu local de trabalho agora — posso usar o ambiente profissional como cenário',
    time: '5 minutos',
    type: 'story',
    formatLabel: 'Story',
    formatInstruction: 'STORY ou FOTO com frase impactante usando o ambiente de trabalho como cenário. Pode ser foto do espaço, da mesa, do ambiente — com uma frase que capture o sentimento do dia.',
  },
  'home': {
    ctx: 'Estou em casa agora — ambiente doméstico, momento pessoal, posso estar mais relaxado(a)',
    time: '5 minutos',
    type: 'story',
    formatLabel: 'Story',
    formatInstruction: 'STORY conversacional como se estivesse falando com um(a) amigo(a) próximo(a) — tom pessoal, leve, autêntico. Pode ser sentado(a) no sofá, na cozinha, etc.',
  },
  'sell': {
    ctx: 'Quero gerar interesse em um serviço ou produto hoje, de forma natural e sem parecer propaganda',
    time: '5 minutos',
    type: 'sequence',
    formatLabel: 'Sequência de stories',
    formatInstruction: 'SEQUÊNCIA de 2-3 stories com storytelling: começa com identificação/problema, apresenta a solução de forma humana, termina com CTA leve.',
  },
  'educate': {
    ctx: 'Quero educar meu público sobre algum tema relevante da minha área',
    time: '5 minutos',
    type: 'story',
    formatLabel: 'Story',
    formatInstruction: 'STORY educativo com 1 informação prática e valiosa. Pode ser mito/verdade, dúvida frequente ou curiosidade. Tom de especialista que explica de forma simples.',
  },
  'light': {
    ctx: 'Quero algo leve, descontraído, que gere conexão e simpatia com o público',
    time: '3 minutos',
    type: 'story',
    formatLabel: 'Story',
    formatInstruction: 'STORY leve e pessoal — bastidor do dia, momento engraçado, reflexão rápida. Estilo conversa de corredor, sem roteiro rígido.',
  },
  'reel': {
    ctx: 'Quero gravar um reels rápido agora mesmo',
    time: '5 minutos',
    type: 'reel',
    formatLabel: 'Reels',
    formatInstruction: 'REELS de 15-30 segundos. Gancho nos primeiros 3s, desenvolvimento dinâmico, fechamento com frase de impacto.',
  },
}

function buildCheckinPrompt(profile: ProfessionalProfile, checkinKey: string, variationHint?: string, memoryBlock = ''): string {
  const cfg = CHECKIN_CONFIG[checkinKey] ?? CHECKIN_CONFIG['2min']
  const pillars = profile.pillars.slice(0, 3).map(p => p.name).join(', ') || 'autoridade na área'
  const services = profile.services.slice(0, 3).map(s => s.name).join(', ') || profile.specialty
  const tone = profile.voiceTone.join(', ') || 'natural, humano, próximo'
  const exposure = EXPOSURE_LABELS[profile.exposureLevel] ?? ''

  return `Você é um consultor de presença digital especializado em Instagram. Crie UMA ideia de conteúdo específica e executável agora para este profissional.

PROFISSIONAL
Nome: ${profile.professionalName}
Área de atuação: ${profile.specialty}
Tom de voz: ${tone}
Como aparece no conteúdo: ${exposure}
Pilares de conteúdo: ${pillars}
Serviços/produtos: ${services}
${profile.catchphrase ? `Bordão: "${profile.catchphrase}"` : ''}

CONTEXTO AGORA
${cfg.ctx}
${variationHint ? `VARIAÇÃO PEDIDA: ${variationHint} — adapte a ideia com este foco específico` : ''}

FORMATO OBRIGATÓRIO: ${cfg.formatInstruction}
Tempo disponível: ${cfg.time}

DIRETRIZES
- A ideia deve soar como algo SÓ ESTA PESSOA poderia fazer — use a área de atuação e o tom dela
- Seja específico: sugira a FRASE EXATA a ser dita ou escrita na tela
- Para foto: diga o que fotografar + a frase de legenda/sobreposição
- Para story falado: escreva o roteiro como ela falaria, em primeira pessoa, natural
- Respeite o nível de exposição declarado
- Nenhuma ideia genérica que qualquer profissional poderia usar
${memoryBlock}

Responda SOMENTE com este JSON (sem texto fora, sem markdown):
{
  "theme": "título curto da ideia em até 6 palavras",
  "objective": "o que esse conteúdo vai gerar no público em 1 frase",
  "timeEstimate": "${cfg.time}",
  "content": "${cfg.type === 'sequence'
    ? 'SEQUÊNCIA de 3 stories para gravar 1 a 1. Comece CADA story com uma linha contendo APENAS STORY 1, depois STORY 2, depois STORY 3 (nessa ordem). Em cada story, use ROTEIRO/FRASE: com a fala exata em primeira pessoa e, se útil, AÇÃO: e DICA:.'
    : 'AÇÃO: descreva exatamente o que fazer agora (seguindo o formato: ' + cfg.formatLabel + ')\\n\\nROTEIRO/FRASE: escreva a frase exata ou o roteiro completo em primeira pessoa\\n\\nDICA: um detalhe prático para executar melhor'}",
  "cta": "frase de legenda ou call-to-action curto e no tom dela",
  "tags": ["tag1", "tag2"]
}`
}

export async function generateCheckinIdea(
  profile: ProfessionalProfile,
  checkinKey: string,
  variationHint?: string
): Promise<ContentIdea> {
  const cfg = CHECKIN_CONFIG[checkinKey] ?? CHECKIN_CONFIG['2min']

  const memoryBlock = await getMemoryBlock()
  const prompt = buildCheckinPrompt(profile, checkinKey, variationHint, memoryBlock)
  const raw = await callGemini(prompt)
  const parsed = extractJSON(raw)

  return {
    id: crypto.randomUUID(),
    type: cfg.type,
    theme: String(parsed.theme ?? cfg.ctx),
    objective: String(parsed.objective ?? ''),
    content: String(parsed.content ?? ''),
    cta: String(parsed.cta ?? ''),
    timeEstimate: cfg.time,
    exposureLevel: profile.exposureLevel,
    status: 'pending',
    favorite: false,
    createdAt: new Date().toISOString(),
    tags: Array.isArray(parsed.tags) ? parsed.tags.map(String) : [],
  }
}

export async function generatePersonalSuggestions(
  profile: ProfessionalProfile,
  ctx: PersonalContext,
  recentJournal: JournalEntry[],
  recentIdeas: PersonalIdea[]
): Promise<string[]> {
  const fallback = [
    `Conte como um hobby seu — ${ctx.hobbies?.[0] ?? 'algo que você ama'} — te ensinou algo valioso sobre ${profile.specialty}`,
    `${ctx.lifeMoment ? 'Baseado no que você está vivendo agora: compartilhe' : 'Compartilhe'} uma lição que sua trajetória como ${profile.specialty} te ensinou sobre equilíbrio`,
    `Uma história real do seu dia a dia que conecta o humano ao técnico — o tipo de conteúdo que só você pode contar`,
  ]

  try {
    const prompt = buildPersonalSuggestionsPrompt(profile, ctx, recentJournal, recentIdeas)
    const raw = await callGemini(prompt)
    const parsed = extractJSON(raw)
    const suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions.map(String) : []
    return suggestions.length > 0 ? suggestions : fallback
  } catch {
    return fallback
  }
}

// Gera legenda completa para Instagram a partir de uma ideia existente
export async function generateCaption(
  idea: ContentIdea,
  profile: ProfessionalProfile
): Promise<{ caption: string; hashtags: string[] }> {
  const fallback = {
    caption: `${idea.theme}\n\n${idea.objective}\n\n${idea.cta || 'Me conta nos comentários!'}`,
    hashtags: ['#instagram', `#${profile.specialty.toLowerCase().replace(/\s+/g, '')}`, '#conteudo'],
  }

  const tone = profile.voiceTone.join(', ') || 'natural e próximo'
  const prompt = `Você é um copywriter especializado em legendas para Instagram.

PROFISSIONAL
Nome: ${profile.professionalName}
Área: ${profile.specialty}
Tom de voz: ${tone}
${profile.catchphrase ? `Bordão: "${profile.catchphrase}"` : ''}

CONTEÚDO (story/reel que será postado)
Tema: ${idea.theme}
Objetivo: ${idea.objective}
CTA já definido: ${idea.cta || '(sem CTA definido)'}

TAREFA
Crie uma legenda para o Instagram que:
1. Complemente o conteúdo visual (não repita palavra por palavra o roteiro)
2. Use o tom de voz declarado
3. Abra com uma frase de impacto (sem emoji no início)
4. Termine com o CTA de forma natural
5. Inclua quebras de linha para facilitar a leitura
6. Sugira entre 5 e 10 hashtags relevantes para o nicho

Responda SOMENTE com este JSON:
{
  "caption": "legenda completa aqui com quebras de linha marcadas com \\n",
  "hashtags": ["#hashtag1", "#hashtag2", "#hashtag3"]
}`

  try {
    const raw = await callGemini(prompt)
    const parsed = extractJSON(raw)
    return {
      caption: String(parsed.caption ?? idea.objective),
      hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags.map(String) : [],
    }
  } catch {
    return fallback
  }
}

// Gera CTAs personalizados para o perfil do usuário
export async function generatePersonalizedCTAs(
  profile: ProfessionalProfile
): Promise<Array<{ text: string; type: string; typeLabel: string }>> {
  const name = profile.professionalName
  const fallback = [
    { text: `Me manda mensagem e vamos conversar sobre o que você precisa!`, type: 'interaction', typeLabel: 'Interação' },
    { text: `Salva esse post pra não perder quando precisar`, type: 'save', typeLabel: 'Salvar' },
    { text: `Tem dúvida sobre isso? Me manda no direct, respondo hoje.`, type: 'interaction', typeLabel: 'Interação' },
    { text: `Quer saber mais? Clica no link da bio de ${name}`, type: 'soft-sell', typeLabel: 'Venda leve' },
    { text: `Me marca quando fizer isso — adoro ver quando funciona!`, type: 'interaction', typeLabel: 'Interação' },
  ]

  const services = profile.services.slice(0, 3).map(s => s.name).join(', ') || profile.specialty
  const tone = profile.voiceTone.join(', ') || 'próximo e natural'

  const prompt = `Você é um especialista em copywriting para Instagram.

PROFISSIONAL
Nome: ${profile.professionalName}
Área: ${profile.specialty}
Serviços/produtos: ${services}
Tom de voz: ${tone}
${profile.catchphrase ? `Bordão: "${profile.catchphrase}"` : ''}
Público: ${profile.targetAudience || `interessados em ${profile.specialty}`}

TAREFA
Crie 8 CTAs (chamadas para ação) personalizados para este profissional, cobrindo diferentes objetivos:
- 2 de interação (comentar, responder, marcar alguém)
- 2 de salvamento (salvar post, compartilhar)
- 1 de agendamento/consulta
- 1 de venda leve (link na bio, direct para saber mais)
- 1 de caixinha de perguntas
- 1 de engajamento pessoal (marca, repost, conta pra mim)

Cada CTA deve:
- Soar como a voz desta pessoa específica (tom: ${tone})
- Ser direto, máx 2 linhas
- NÃO parecer forçado ou genérico

Responda SOMENTE com este JSON:
{
  "ctas": [
    {"text": "texto do CTA aqui", "type": "interaction", "typeLabel": "Interação"},
    {"text": "texto do CTA aqui", "type": "save", "typeLabel": "Salvar"},
    {"text": "texto do CTA aqui", "type": "schedule", "typeLabel": "Agendamento"},
    {"text": "texto do CTA aqui", "type": "soft-sell", "typeLabel": "Venda leve"},
    {"text": "texto do CTA aqui", "type": "question-box", "typeLabel": "Caixinha"},
    {"text": "texto do CTA aqui", "type": "interaction", "typeLabel": "Interação"},
    {"text": "texto do CTA aqui", "type": "save", "typeLabel": "Salvar"},
    {"text": "texto do CTA aqui", "type": "interaction", "typeLabel": "Engajamento"}
  ]
}`

  try {
    const raw = await callGemini(prompt)
    const parsed = extractJSON(raw)
    const ctas = Array.isArray(parsed.ctas) ? parsed.ctas : []
    const mapped = ctas.map((c: Record<string, unknown>) => ({
      text: String(c.text ?? ''),
      type: String(c.type ?? 'interaction'),
      typeLabel: String(c.typeLabel ?? 'Interação'),
    }))
    return mapped.length > 0 ? mapped : fallback
  } catch {
    return fallback
  }
}

// ── Essência: resumo + posicionamento gerados pela IA ──────────────
export interface EssenceSummaryResult {
  aiSummary: string
  aiPositioning: string
}

export async function generateEssenceSummary(answers: Record<string, unknown>): Promise<EssenceSummaryResult> {
  const raw = await callGemini(buildEssenceSummaryPrompt(answers))
  const p = extractJSON(raw)
  const positioning = p.ai_positioning
  return {
    aiSummary: String(p.ai_summary ?? ''),
    aiPositioning: typeof positioning === 'string' ? positioning : JSON.stringify(positioning ?? {}),
  }
}

// ── Biblioteca: itens de conteúdo gerados a partir da essência ──────
const VALID_LIBRARY_TYPES: LibraryItemType[] = [
  'story_sequence', 'reels_script', 'caption', 'hook', 'cta', 'content_idea',
  'objection_answer', 'routine_prompt', 'daily_prompt', 'carousel_idea', 'static_post_idea',
]

export interface GeneratedLibraryItem {
  type: LibraryItemType
  title: string
  content: string
  category: string
  tags: string[]
}

export async function generateLibraryItems(essence: BrandEssence): Promise<GeneratedLibraryItem[]> {
  // Biblioteca tem muitos itens → precisa de mais tokens de saída.
  const raw = await generateText(buildInitialLibraryPrompt(essence), { maxOutputTokens: 8192 })
  const p = extractJSON(raw)
  const items = Array.isArray(p.items) ? p.items : []
  return items.map((i: Record<string, unknown>) => {
    const t = String(i.type ?? 'content_idea') as LibraryItemType
    return {
      type: VALID_LIBRARY_TYPES.includes(t) ? t : 'content_idea',
      title: String(i.title ?? 'Sem título'),
      content: String(i.content ?? ''),
      category: String(i.category ?? ''),
      tags: Array.isArray(i.tags) ? i.tags.map(String) : [],
    }
  }).filter((i: GeneratedLibraryItem) => i.content.length > 0)
}

// ── Momento livre ──────────────────────────────────────────────────────────
// Cria um story a partir do que a pessoa está pensando/fazendo AGORA — pode ser
// um tema fora do nicho dela (ex.: profissional de marketing falando de política).
// Mantém a VOZ dela (tom, bordão, palavras a evitar) mas com liberdade temática
// e tom mais leve/pessoal. Aproveita o nível de exposição declarado.
function buildFreeStoryPrompt(
  profile: ProfessionalProfile,
  topic: string,
  vibe: string,
): string {
  const tone = profile.voiceTone.join(', ') || 'natural, leve, pessoal'
  const exposure = EXPOSURE_LABELS[profile.exposureLevel] ?? ''

  return `Você é um roteirista que ajuda criadores a transformar QUALQUER pensamento ou momento do dia em um story autêntico para o Instagram — mesmo que o tema NÃO tenha relação com a profissão da pessoa.

QUEM ESTÁ FALANDO (mantenha a voz, não a obrigue a falar da profissão)
Nome: ${profile.professionalName}
Tom de voz natural: ${tone}
Como aparece no conteúdo: ${exposure}
${profile.catchphrase ? `Bordão: "${profile.catchphrase}"` : ''}
${profile.avoidedWords?.length ? `NUNCA use estas palavras: ${profile.avoidedWords.join(', ')}` : ''}

O QUE A PESSOA QUER FALAR AGORA (tema livre, pode ser pessoal/opinião/cotidiano)
"${topic}"

ESTILO PEDIDO: ${vibe}

DIRETRIZES
- Este é um conteúdo PESSOAL/LIVRE: NÃO force conexão com a profissão dela nem CTA de venda.
- Soe como um desabafo/opinião/relato espontâneo, do jeito que ela falaria com amigos.
- Tom leve e humano. Pode ter humor, vulnerabilidade ou opinião — desde que natural.
- Se o tema for sensível (ex.: política), traga de forma respeitosa e pessoal, sem radicalismo nem ataque.
- Roteiro curto, executável em até 30-45 segundos.

Responda SOMENTE com este JSON (sem texto fora, sem markdown):
{
  "theme": "título curto e instigante em até 6 palavras",
  "objective": "que sensação/conexão esse story gera (1 frase)",
  "timeEstimate": "tempo estimado de gravação",
  "content": "roteiro em LINHAS ROTULADAS. Use 'FALA:' para o que dizer em voz alta (1ª pessoa, palavra por palavra), 'TEXTO NA TELA:' para o que aparece escrito e 'CENA:' para enquadramento. Uma linha por trecho.",
  "cta": "uma pergunta leve ou convite à interação (sem vender nada)",
  "tags": ["livre", "tag2"]
}`
}

export async function generateFreeStory(
  profile: ProfessionalProfile,
  topic: string,
  vibe = 'leve e pessoal',
): Promise<ContentIdea> {
  const prompt = buildFreeStoryPrompt(profile, topic, vibe)
  const raw = await callGemini(prompt)
  const parsed = extractJSON(raw)

  return {
    id: crypto.randomUUID(),
    type: 'story',
    theme: String(parsed.theme ?? topic.slice(0, 40)),
    objective: String(parsed.objective ?? 'Conteúdo livre do momento'),
    content: String(parsed.content ?? ''),
    cta: String(parsed.cta ?? ''),
    timeEstimate: String(parsed.timeEstimate ?? '30 segundos'),
    exposureLevel: profile.exposureLevel,
    status: 'pending',
    favorite: false,
    createdAt: new Date().toISOString(),
    tags: Array.isArray(parsed.tags) ? parsed.tags.map(String) : ['livre'],
  }
}

// Embrulha um roteiro escrito pela PRÓPRIA pessoa num ContentIdea, sem chamar a
// IA — para ela digitar/colar o texto e ir direto para o teleprompter (StudioModal).
export function ideaFromOwnScript(text: string, opts?: { theme?: string; type?: ContentIdea['type']; exposureLevel?: ExposureLevel }): ContentIdea {
  const body = text.trim()
  const firstLine = body.split(/\r?\n/)[0]?.trim() ?? ''
  const theme = opts?.theme?.trim() || (firstLine.length > 0 ? firstLine.slice(0, 48) : 'Meu roteiro')
  return {
    id: crypto.randomUUID(),
    type: opts?.type ?? 'story',
    theme,
    objective: 'Roteiro escrito por você',
    // Sem rótulos: o StudioModal trata texto neutro como fala (teleprompter).
    content: body,
    cta: '',
    timeEstimate: '—',
    exposureLevel: opts?.exposureLevel ?? 'comfortable-talking',
    status: 'pending',
    favorite: false,
    createdAt: new Date().toISOString(),
    tags: ['meu-roteiro'],
  }
}

export async function generateContent(req: GenerateRequest): Promise<ContentIdea> {
  const memoryBlock = await getMemoryBlock()
  const prompt = buildPrompt(req, memoryBlock)
  const raw = await callGemini(prompt)
  const parsed = extractJSON(raw)

  return {
    id: crypto.randomUUID(),
    type: req.type,
    theme: String(parsed.theme ?? req.theme),
    objective: String(parsed.objective ?? req.objective),
    content: String(parsed.content ?? ''),
    cta: String(parsed.cta ?? ''),
    timeEstimate: String(parsed.timeEstimate ?? req.timeAvailable),
    exposureLevel: req.exposureLevel,
    status: 'pending',
    favorite: false,
    createdAt: new Date().toISOString(),
    tags: Array.isArray(parsed.tags) ? parsed.tags.map(String) : [],
  }
}

export interface ThemeTemplate {
  id: string
  title: string
  type: 'story' | 'sequence' | 'reel'
  objective: string
  format: string
  theme: string
  specialty: string[]
  difficulty: 'fácil' | 'médio' | 'avançado'
  timeEstimate: string
  description: string
  tags: string[]
}

// Biblioteca de temas universais — linguagem neutra que serve para qualquer nicho.
// `specialty: []` significa que o template aparece para todo mundo.
export const THEME_LIBRARY: ThemeTemplate[] = [
  {
    id: 't1', title: 'Dúvida mais frequente', type: 'story',
    objective: 'Educar', format: 'Story único', theme: 'Dúvida frequente do seu público',
    specialty: [], difficulty: 'fácil', timeEstimate: '2 minutos',
    description: 'Responda a pergunta que mais aparece no seu dia a dia. Direto, sem enrolação.',
    tags: ['autoridade', 'educação'],
  },
  {
    id: 't2', title: 'Mito e verdade', type: 'reel',
    objective: 'Quebrar objeção', format: 'Mito rápido', theme: 'Mito comum da sua área',
    specialty: [], difficulty: 'fácil', timeEstimate: '3 minutos',
    description: 'Escolha um mito que seu público acredita e derrube com autoridade.',
    tags: ['autoridade', 'educação', 'engajamento'],
  },
  {
    id: 't3', title: 'Look do dia com contexto', type: 'sequence',
    objective: 'Aproximar', format: 'Sequência de 3 stories', theme: 'Bastidor do seu dia',
    specialty: [], difficulty: 'fácil', timeEstimate: '3 minutos',
    description: 'Mostre seu look do dia e conecte com sua identidade profissional.',
    tags: ['bastidor', 'conexão'],
  },
  {
    id: 't4', title: 'Antes de começar o dia', type: 'story',
    objective: 'Mostrar bastidor', format: 'Bastidor comentado', theme: 'Rotina de trabalho',
    specialty: [], difficulty: 'fácil', timeEstimate: '2 minutos',
    description: 'Grave um story rápido chegando ao trabalho. Humaniza sem esforço.',
    tags: ['bastidor', 'conexão'],
  },
  {
    id: 't5', title: 'Sequência de venda leve', type: 'sequence',
    objective: 'Vender serviço', format: 'Sequência comercial leve', theme: 'Serviço principal',
    specialty: [], difficulty: 'médio', timeEstimate: '7 minutos',
    description: '5 stories que vendem sem parecer propaganda. Contexto, problema, solução, prova e CTA.',
    tags: ['venda', 'autoridade'],
  },
  {
    id: 't6', title: 'Resposta de caixinha', type: 'reel',
    objective: 'Gerar interação', format: 'Respondendo dúvida', theme: 'Pergunta do público',
    specialty: [], difficulty: 'fácil', timeEstimate: '3 minutos',
    description: 'Responda uma pergunta real que chegou nos seus stories ou no direct.',
    tags: ['interação', 'autoridade'],
  },
  {
    id: 't7', title: 'Lista rápida', type: 'reel',
    objective: 'Educar', format: 'Lista curta', theme: 'Top 3 da sua área',
    specialty: [], difficulty: 'fácil', timeEstimate: '3 minutos',
    description: '"3 coisas que ninguém te contou sobre [tema]" — simples e muito compartilhável.',
    tags: ['autoridade', 'educação'],
  },
  {
    id: 't8', title: 'Sequência de conexão pessoal', type: 'sequence',
    objective: 'Aproximar', format: 'Sequência de conexão', theme: 'Personalidade e bastidor',
    specialty: [], difficulty: 'médio', timeEstimate: '5 minutos',
    description: 'Bastidor real, comentário pessoal, relação com o público e enquete.',
    tags: ['conexão', 'bastidor'],
  },
  {
    id: 't9', title: 'Frase de impacto', type: 'story',
    objective: 'Gerar interação', format: 'Story único', theme: 'Pensamento da semana',
    specialty: [], difficulty: 'fácil', timeEstimate: '1 minuto',
    description: 'Uma frase sua sobre a profissão. Fundo simples, letra grande. Fácil de compartilhar.',
    tags: ['autoridade', 'conexão'],
  },
  {
    id: 't10', title: 'Bastidor de um trabalho', type: 'reel',
    objective: 'Divulgar produto ou serviço', format: 'Bastidor estratégico', theme: 'Um trabalho ou entrega recente',
    specialty: [], difficulty: 'médio', timeEstimate: '5 minutos',
    description: 'Mostre o processo ou o antes/depois de um trabalho de forma ética e respeitosa.',
    tags: ['bastidor', 'venda', 'autoridade'],
  },
  {
    id: 't11', title: 'O erro mais comum', type: 'reel',
    objective: 'Educar', format: 'Fala direta', theme: 'Erro comum do seu público',
    specialty: [], difficulty: 'fácil', timeEstimate: '3 minutos',
    description: 'Aponte o erro que você mais vê e mostre o caminho certo. Gera autoridade na hora.',
    tags: ['autoridade', 'educação'],
  },
  {
    id: 't12', title: 'Por que eu faço o que faço', type: 'story',
    objective: 'Aproximar', format: 'Story único', theme: 'Propósito e história pessoal',
    specialty: [], difficulty: 'fácil', timeEstimate: '2 minutos',
    description: 'Conte em uma frase o que te motiva na sua profissão. Conexão pura.',
    tags: ['conexão', 'autoridade'],
  },
  {
    id: 't13', title: 'Enquete que gera conversa', type: 'story',
    objective: 'Gerar interação', format: 'Enquete', theme: 'Tema polêmico leve da sua área',
    specialty: [], difficulty: 'fácil', timeEstimate: '1 minuto',
    description: 'Faça uma enquete simples sobre um tema do seu nicho. Engajamento fácil.',
    tags: ['interação'],
  },
  {
    id: 't14', title: 'Passo a passo simples', type: 'reel',
    objective: 'Educar', format: 'Lista curta', theme: 'Um processo da sua área em 3 passos',
    specialty: [], difficulty: 'médio', timeEstimate: '5 minutos',
    description: 'Ensine algo prático em 3 passos rápidos. Salvável e compartilhável.',
    tags: ['autoridade', 'educação'],
  },
]

export function getTemplatesBySpecialty(specialty: string): ThemeTemplate[] {
  return THEME_LIBRARY.filter(t => t.specialty.length === 0 || t.specialty.includes(specialty))
}

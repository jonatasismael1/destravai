import type { TourScreen } from '../supabase/types'

// ─────────────────────────────────────────────────────────────────────────
// Definição dos tours guiados.
//
// COMO EDITAR: mude apenas os textos (title/body) abaixo. Para apontar o
// spotlight para um elemento real da tela, use `target` com o mesmo valor do
// atributo `data-tour="..."` colocado no JSX daquele elemento. Sem `target`,
// o passo aparece centralizado (sem destaque), útil para boas-vindas/fechamento.
//
// Ao mudar textos de forma relevante, suba o TOUR_VERSION para reexibir a todos.
// ─────────────────────────────────────────────────────────────────────────

export const TOUR_VERSION = '1.0'

export interface TourStep {
  /** Valor do data-tour do elemento a destacar. Ausente = passo central. */
  target?: string
  title: string
  body: string
}

export const TOURS: Record<TourScreen, TourStep[]> = {
  // Tour de boas-vindas — roda na Home, logo após a essência. Apresenta o app
  // destacando a barra de navegação (sempre visível).
  main: [
    {
      title: 'Seu ponto de partida',
      body: 'Esta é a tela Hoje. Aqui você acompanha suas ideias, atalhos e os próximos passos para postar com mais clareza.',
    },
    {
      target: 'nav-criar',
      title: 'Crie sem travar',
      body: 'Escolha o tipo de conteúdo e o Destravaí transforma sua essência em ideias prontas para usar.',
    },
    {
      target: 'nav-espaco',
      title: 'Suas ideias salvas',
      body: 'No Espaço fica sua Biblioteca: tudo que você cria é guardado aqui para consultar, adaptar ou postar depois.',
    },
    {
      target: 'nav-agenda',
      title: 'Planeje a semana',
      body: 'Organize o que postar em cada dia e mantenha o ritmo sem ficar pensando na hora.',
    },
    {
      title: 'Grave com mais segurança',
      body: 'Ao tocar em Gravar, o teleprompter mostra seu roteiro na tela enquanto você fala — com tamanho e velocidade ajustáveis.',
    },
    {
      target: 'nav-ranking',
      title: 'Acompanhe seu ritmo',
      body: 'Veja sua constância e dispute com amigos para manter a frequência sem depender só da motivação.',
    },
    {
      target: 'nav-ajustes',
      title: 'Ajuste sua experiência',
      body: 'Edite sua essência, troque o tema e gerencie sua conta. Pode rever este tour por aqui quando quiser.',
    },
    {
      title: 'Pronto para destravar',
      body: 'Agora é só escolher o que criar e começar. O app já usa a sua essência como base.',
    },
  ],

  // Tours curtos (1 passo) na primeira visita de cada tela.
  criar: [
    {
      target: 'criar-tabs',
      title: 'Três formas de criar',
      body: 'Roteiro guiado, um momento livre do dia ou o seu próprio texto. Escolha, ajuste e toque em Destravar ideia.',
    },
  ],
  espaco: [
    {
      target: 'espaco-tabs',
      title: 'Seu espaço pessoal',
      body: 'Aqui ficam seus registros, o seu Progresso e a Biblioteca de conteúdos. Use as abas para alternar.',
    },
  ],
  biblioteca: [
    {
      target: 'biblioteca-busca',
      title: 'Tudo que você salvou',
      body: 'Busque e filtre suas ideias. Toque em uma para ver o conteúdo, editar, agendar ou gravar.',
    },
  ],
  teleprompter: [
    {
      title: 'Leia enquanto grava',
      body: 'O teleprompter exibe seu roteiro na tela. Ajuste o tamanho do texto e a velocidade nos controles, e é só gravar.',
    },
  ],
  ranking: [
    {
      target: 'ranking-acoes',
      title: 'Constância com amigos',
      body: 'Crie um grupo ou entre por código. Cada um pontua por postar, gravar e concluir missões — o ranking reinicia toda semana.',
    },
  ],
  agenda: [
    {
      target: 'agenda-add',
      title: 'Monte sua semana',
      body: 'Toque no + de um dia para planejar o que postar. Arraste para mudar de dia e marque o status (planejado, gravado, postado).',
    },
  ],
  essencia: [
    {
      target: 'essencia-tabs',
      title: 'O cérebro das suas ideias',
      body: 'Edite sua essência quando quiser. Quanto mais completa, mais personalizadas ficam as ideias geradas pela Deby.',
    },
  ],
  configuracoes: [
    {
      target: 'config-tour',
      title: 'Ajustes e tour',
      body: 'Edite seu perfil, troque o tema e gerencie sua conta. Quer rever a apresentação? Use “Ver tour novamente”.',
    },
  ],
}

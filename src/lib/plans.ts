// Planos do Destravaí (espelha os preços do servidor em netlify/functions/_shared.mjs).
// A fonte da verdade do PREÇO cobrado é o servidor; aqui é só para exibição.

export interface Plan {
  id: 'starter' | 'pro' | 'expert'
  name: string
  price: number
  tagline: string
  features: string[]
  highlight?: boolean
}

export const PLANS: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: 29,
    tagline: 'Para começar a postar sem travar.',
    features: [
      'Ideias e roteiros com IA',
      'Teleprompter para gravar',
      'Missão do dia',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 49,
    tagline: 'Para quem quer constância de verdade.',
    features: [
      'Tudo do Starter',
      'CTAs personalizados',
      'Biblioteca de conteúdos',
      'Legendas geradas por IA',
    ],
    highlight: true,
  },
  {
    id: 'expert',
    name: 'Expert',
    price: 69,
    tagline: 'Para escalar sua presença digital.',
    features: [
      'Tudo do Pro',
      'Geração ampliada de ideias',
      'Prioridade nas novidades',
    ],
  },
]

export const GUARANTEE_DAYS = 7

// Oferta unica do Destravai (espelha os valores do servidor em netlify/functions/_shared.mjs).
// A fonte da verdade do PRECO cobrado e o servidor; aqui e so para exibicao.

export interface Plan {
  id: 'destravai_completo'
  name: string
  firstMonthPrice: number
  recurringPrice: number
  tagline: string
  features: string[]
  highlight?: boolean
}

export const COMPLETE_PLAN: Plan = {
  id: 'destravai_completo',
  name: 'Destravai Completo',
  firstMonthPrice: 9.9,
  recurringPrice: 49.9,
  tagline: 'R$9,90 no primeiro mes e R$49,90/mes depois. Sem fidelidade.',
  features: [
    'Ideias e roteiros com a Deby AI',
    'Teleprompter para gravar',
    'CTAs personalizados',
    'Legendas geradas pela Deby AI',
    'Biblioteca de conteudos',
    'Calendario editorial',
    'Studio com teleprompter',
  ],
  highlight: true,
}

export const PLANS: Plan[] = [COMPLETE_PLAN]
export const GUARANTEE_DAYS = 7

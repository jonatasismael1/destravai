// Estimativa de custo de tokens por geração de IA.
// Atualizar os valores de "pricePerMToken" conforme os preços vigentes do Google AI.
// Preços em USD por milhão de tokens (valores de junho/2026 — fonte: Google AI Studio).

export interface AiModelConfig {
  id: string
  label: string
  /** Custo por 1M tokens de entrada (USD) */
  inputPricePerMToken: number
  /** Custo por 1M tokens de saída (USD) */
  outputPricePerMToken: number
  /** Estimativa de tokens de entrada por geração de roteiro */
  avgInputTokens: number
  /** Estimativa de tokens de saída por geração de roteiro */
  avgOutputTokens: number
  /** Observações sobre o modelo */
  notes: string
}

// ──────────────────────────────────────────────────────────────────────────────
// CONFIGURAÇÃO DE MODELOS — edite aqui para atualizar preços ou adicionar modelos
// ──────────────────────────────────────────────────────────────────────────────
export const AI_MODELS: AiModelConfig[] = [
  {
    id: 'gemini-2.0-flash',
    label: 'Gemini 2.0 Flash (atual)',
    inputPricePerMToken: 0.10,
    outputPricePerMToken: 0.40,
    avgInputTokens: 1800,
    avgOutputTokens: 900,
    notes: 'Rápido, barato, boa qualidade. Usado atualmente no app.',
  },
  {
    id: 'gemini-1.5-flash',
    label: 'Gemini 1.5 Flash',
    inputPricePerMToken: 0.075,
    outputPricePerMToken: 0.30,
    avgInputTokens: 1800,
    avgOutputTokens: 900,
    notes: 'Alternativa mais barata, levemente inferior em criatividade.',
  },
  {
    id: 'gemini-1.5-pro',
    label: 'Gemini 1.5 Pro',
    inputPricePerMToken: 1.25,
    outputPricePerMToken: 5.00,
    avgInputTokens: 1800,
    avgOutputTokens: 900,
    notes: 'Alta qualidade, mas custo ~10x maior que Flash. Para versão premium.',
  },
  {
    id: 'claude-haiku-4-5',
    label: 'Claude Haiku 4.5',
    inputPricePerMToken: 0.80,
    outputPricePerMToken: 4.00,
    avgInputTokens: 1800,
    avgOutputTokens: 900,
    notes: 'Alternativa Anthropic. Melhor raciocínio, custo intermediário.',
  },
  {
    id: 'claude-sonnet-4-6',
    label: 'Claude Sonnet 4.6',
    inputPricePerMToken: 3.00,
    outputPricePerMToken: 15.00,
    avgInputTokens: 1800,
    avgOutputTokens: 900,
    notes: 'Alta qualidade criativa, custo maior. Para planos premium.',
  },
]

export interface CostEstimate {
  model: AiModelConfig
  /** Custo por geração individual (USD) */
  perGeneration: number
  /** Para 100 gerações (USD) */
  for100: number
  /** Para 500 gerações (USD) */
  for500: number
  /** Para 1000 gerações (USD) */
  for1000: number
  /** Custo mensal estimado com base em N usuários ativos e média de gerações */
  monthly: (activeUsers: number, generationsPerUserPerMonth: number) => number
}

/** Calcula a estimativa de custo para um modelo. */
export function calcModelCost(model: AiModelConfig): CostEstimate {
  const inputCost = (model.avgInputTokens / 1_000_000) * model.inputPricePerMToken
  const outputCost = (model.avgOutputTokens / 1_000_000) * model.outputPricePerMToken
  const perGeneration = inputCost + outputCost

  return {
    model,
    perGeneration,
    for100: perGeneration * 100,
    for500: perGeneration * 500,
    for1000: perGeneration * 1000,
    monthly: (activeUsers, generationsPerUserPerMonth) =>
      perGeneration * activeUsers * generationsPerUserPerMonth,
  }
}

/** Retorna estimativas para todos os modelos configurados. */
export function getAllCostEstimates(): CostEstimate[] {
  return AI_MODELS.map(calcModelCost)
}

/** Formata um valor USD para exibição. */
export function formatUSD(value: number): string {
  if (value < 0.01) return `$${(value * 100).toFixed(4)}¢`
  return `$${value.toFixed(4)}`
}

/** Formata um valor BRL (conversão aproximada). */
export function formatBRL(valueUSD: number, usdToBrl = 5.20): string {
  const brl = valueUSD * usdToBrl
  return `R$${brl.toFixed(4)}`
}

// ──────────────────────────────────────────────────────────────────────────────
// RESUMO PRÉ-CALCULADO (para exibição rápida na UI ou documentação)
// ──────────────────────────────────────────────────────────────────────────────
export function getCostSummaryTable(): string {
  const estimates = getAllCostEstimates()
  const header = `Modelo | Custo/geração | 100 gerações | 500 gerações | 1.000 gerações`
  const separator = `-------|--------------|-------------|-------------|---------------`
  const rows = estimates.map(e =>
    `${e.model.label} | ${formatUSD(e.perGeneration)} | ${formatUSD(e.for100)} | ${formatUSD(e.for500)} | ${formatUSD(e.for1000)}`
  )
  return [header, separator, ...rows].join('\n')
}

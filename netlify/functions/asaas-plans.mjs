// GET /.netlify/functions/asaas-plans
// Mantido por compatibilidade com o frontend: agora retorna somente a oferta unica.

import { COMPLETE_PLAN, json, preflight } from './_shared.mjs'

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight()
  if (event.httpMethod !== 'GET') return json(405, { error: 'Metodo nao permitido' })

  return json(200, {
    plans: [{
      id: COMPLETE_PLAN.id,
      name: COMPLETE_PLAN.name,
      tagline: COMPLETE_PLAN.tagline,
      price: COMPLETE_PLAN.firstMonthPrice,
      firstMonthPrice: COMPLETE_PLAN.firstMonthPrice,
      recurringPrice: COMPLETE_PLAN.recurringPrice,
      features: COMPLETE_PLAN.features,
      highlight: true,
    }],
  })
}

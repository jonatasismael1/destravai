// GET /.netlify/functions/asaas-plans
// Retorna os planos ATIVOS para a tela de checkout (pública). A fonte da verdade
// é a tabela destravai_plans. O preço cobrado é sempre revalidado no backend
// na hora de criar a cobrança — aqui é apenas para exibição.

import { json, preflight, supabaseAdmin } from './_shared.mjs'

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight()
  if (event.httpMethod !== 'GET') return json(405, { error: 'Método não permitido' })

  try {
    const admin = supabaseAdmin()
    const { data, error } = await admin
      .from('destravai_plans')
      .select('id, name, short_description, monthly_price, benefits, highlight, sort_order')
      .eq('is_active', true)
      .order('sort_order')
    if (error) throw error

    const plans = (data || []).map((p) => ({
      id: p.id,
      name: p.name,
      tagline: p.short_description,
      price: Number(p.monthly_price),
      features: p.benefits || [],
      highlight: !!p.highlight,
    }))

    return json(200, { plans })
  } catch (err) {
    console.error('[asaas-plans]', err?.message)
    return json(500, { error: 'Erro ao carregar planos' })
  }
}

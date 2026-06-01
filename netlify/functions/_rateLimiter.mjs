// Módulo de rate limiting para Netlify Functions.
// Usa memória in-process como cache rápido (primeira linha de defesa) e Supabase
// como storage persistente (garante limites mesmo entre instâncias diferentes).
//
// Como Netlify Functions são stateless, o cache em memória funciona dentro da mesma
// instância (maioria dos requests em produção aquecida) e o Supabase cobre o resto.

import { supabaseAdmin } from './_shared.mjs'

// Cache em memória: { key -> { count, windowStart, expiresAt } }
const _memCache = new Map()

// Extrai o IP real do evento Netlify (suporta proxies e Netlify Edge).
export function getClientIp(event) {
  return (
    event.headers['x-nf-client-connection-ip'] ||
    event.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    event.headers['client-ip'] ||
    'unknown'
  )
}

/**
 * Verifica e incrementa um contador de rate limit.
 *
 * @param key      Chave única (ex: "gemini:user_123" ou "checkout:ip_1.2.3.4")
 * @param limit    Número máximo de requisições na janela
 * @param windowMs Tamanho da janela em milissegundos
 * @returns { allowed: boolean, remaining: number, resetAt: Date }
 */
export async function checkRateLimit(key, limit, windowMs) {
  const now = Date.now()
  const windowStart = Math.floor(now / windowMs) * windowMs
  const windowEnd = windowStart + windowMs
  const windowKey = `${key}:${windowStart}`

  // ── 1. Cache em memória (evita round-trip ao banco na maioria dos casos) ──
  const cached = _memCache.get(windowKey)
  if (cached) {
    if (now > cached.expiresAt) {
      _memCache.delete(windowKey)
    } else {
      if (cached.count >= limit) {
        return { allowed: false, remaining: 0, resetAt: new Date(windowEnd) }
      }
      cached.count++
      return { allowed: true, remaining: limit - cached.count, resetAt: new Date(windowEnd) }
    }
  }

  // ── 2. Persistência no Supabase (fonte da verdade entre instâncias) ──
  try {
    const admin = supabaseAdmin()

    // Upsert atômico: incrementa o contador na janela corrente.
    const { data, error } = await admin.rpc('destravai_rate_limit_increment', {
      p_key: key,
      p_window_start: new Date(windowStart).toISOString(),
      p_window_end: new Date(windowEnd).toISOString(),
    })

    if (error) {
      // Se o RPC falhar (ex: tabela não existe), falha aberrante = permite passar
      // (fail-open) para não derrubar o serviço por causa de rate limit.
      console.warn('[rateLimiter] RPC error, failing open:', error.message)
      return { allowed: true, remaining: limit, resetAt: new Date(windowEnd) }
    }

    const count = data ?? 1

    // Atualiza cache em memória com o valor do banco.
    _memCache.set(windowKey, { count, expiresAt: windowEnd + 5000 })

    // Limpa entradas antigas do cache para evitar vazamento de memória.
    if (_memCache.size > 500) {
      for (const [k, v] of _memCache) {
        if (now > v.expiresAt) _memCache.delete(k)
      }
    }

    const allowed = count <= limit
    return {
      allowed,
      remaining: Math.max(0, limit - count),
      resetAt: new Date(windowEnd),
    }
  } catch (err) {
    console.warn('[rateLimiter] Unexpected error, failing open:', err?.message)
    return { allowed: true, remaining: limit, resetAt: new Date(windowEnd) }
  }
}

/**
 * Retorna uma resposta HTTP 429 padronizada e amigável.
 */
export function rateLimitExceeded(resetAt, customMessage) {
  const retryAfterSec = Math.ceil((resetAt.getTime() - Date.now()) / 1000)
  const resetFormatted = resetAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const message = customMessage || `Muitas tentativas. Aguarde alguns instantes e tente novamente. Limite renova às ${resetFormatted}.`

  return {
    statusCode: 429,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': String(retryAfterSec),
      'X-RateLimit-Reset': resetAt.toISOString(),
    },
    body: JSON.stringify({ error: message, retryAfterSeconds: retryAfterSec }),
  }
}

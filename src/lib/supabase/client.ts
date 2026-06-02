import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  const msg = 'Configuração ausente: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY nas variáveis de ambiente do build (Netlify).'
  // Em vez de deixar a tela em branco, mostra uma mensagem legível
  if (typeof document !== 'undefined') {
    document.body.innerHTML = `<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#0B0B12;color:#F7F4FF;font-family:system-ui,sans-serif;text-align:center;line-height:1.6">${msg}</div>`
  }
  throw new Error(msg)
}

// Lock de autenticação com TIMEOUT.
// O supabase-js serializa o acesso ao token com navigator.locks (Web Locks). O
// lock padrão espera INDEFINIDAMENTE — e em alguns PWAs/navegadores ele não é
// liberado, travando getSession() para sempre: o app loga e fica "carregando…"
// sem entrar. Aqui mantemos a serialização entre abas, mas com teto de espera:
// se o lock não vier em 5s, seguimos SEM ele (em vez de congelar o app).
async function authLockWithTimeout<R>(
  name: string,
  _acquireTimeout: number,
  fn: () => Promise<R>,
): Promise<R> {
  if (typeof navigator === 'undefined' || !navigator.locks?.request) return fn()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5000)
  try {
    return await navigator.locks.request(name, { signal: controller.signal }, fn)
  } catch (err) {
    // Só roda sem lock se foi o TIMEOUT do lock (AbortError). Erro real do fn propaga
    // (evita executar a operação duas vezes).
    if (err instanceof Error && err.name === 'AbortError') return fn()
    throw err
  } finally {
    clearTimeout(timer)
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    lock: authLockWithTimeout,
  },
})

export type SupabaseClient = typeof supabase

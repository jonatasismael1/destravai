import { supabase } from '../lib/supabase/client'

// Sincroniza o e-mail de acesso (Auth) com o perfil e o Asaas DEPOIS que a pessoa
// troca o e-mail no app e confirma pelo link. Tolerante a falha: nunca lança, para
// não atrapalhar o carregamento do app. Retorna true se a chamada respondeu ok.
const FN = '/.netlify/functions'

export async function syncAccessEmail(): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return false
    const res = await fetch(`${FN}/asaas-sync-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
    })
    return res.ok
  } catch {
    return false
  }
}

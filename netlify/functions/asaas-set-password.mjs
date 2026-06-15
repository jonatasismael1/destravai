// POST /.netlify/functions/asaas-set-password
// Define a senha de uma conta criada no checkout (que nasce SEM senha). Dois modos:
//
//  1) token  -> { token, password }  (tela de sucesso pos-pagamento)
//     O token assinado prova que a pessoa acabou de comprar. Caminho seguro,
//     nao depende do e-mail.
//
//  2) claim  -> { email, password }  ("Criar conta" no login)
//     Reivindica a conta SO se: (a) existe uma assinatura com acesso liberado
//     (cliente pago) E (b) a conta NUNCA foi acessada (sem senha definida ainda).
//     Assim, so um cliente real que ainda nao configurou consegue definir a senha.
//
// Apos definir a senha, o frontend faz signInWithPassword normalmente. O e-mail de
// "defina sua senha" continua valendo como caminho alternativo (o ultimo vence).

import { json, preflight, supabaseAdmin, verifySetupToken, getAccessInfo } from './_shared.mjs'
import { checkRateLimit, rateLimitExceeded, getClientIp } from './_rateLimiter.mjs'

const SET_PWD_LIMIT = 10
const SET_PWD_WINDOW_MS = 60 * 60 * 1000 // 10 tentativas por hora por IP

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight()
  if (event.httpMethod !== 'POST') return json(405, { error: 'Metodo nao permitido' })

  try {
    // Anti-abuso: limita tentativas por IP (protege o modo "claim" de varredura).
    const ip = getClientIp(event)
    const rl = await checkRateLimit(`setpwd:ip:${ip}`, SET_PWD_LIMIT, SET_PWD_WINDOW_MS)
    if (!rl.allowed) {
      return rateLimitExceeded(rl.resetAt, 'Muitas tentativas. Aguarde um momento e tente novamente.')
    }

    const body = JSON.parse(event.body || '{}')
    const password = String(body.password || '')
    if (password.length < 8) {
      return json(400, { error: 'A senha deve ter ao menos 8 caracteres.' })
    }

    const admin = supabaseAdmin()
    let uid = null
    let email = null

    if (body.token) {
      // ── Modo token (tela de sucesso) ──
      const decoded = verifySetupToken(body.token)
      if (!decoded) return json(401, { error: 'Link de criacao de senha invalido ou expirado. Use o e-mail que enviamos.' })
      uid = decoded.uid
      email = decoded.email
    } else if (body.email) {
      // ── Modo claim (login "Criar conta") ──
      const clean = String(body.email).trim().toLowerCase()
      const { data: foundId } = await admin.rpc('destravai_find_user_id_by_email', { p_email: clean })
      if (!foundId) {
        return json(404, { error: 'Nao encontramos uma conta para este e-mail. Conclua o pagamento primeiro.' })
      }
      // So permite reivindicar conta que NUNCA foi acessada (sem senha ainda).
      const { data: got, error: getErr } = await admin.auth.admin.getUserById(foundId)
      if (getErr) throw getErr
      if (got?.user?.last_sign_in_at) {
        return json(409, { error: 'Esta conta ja tem senha. Use "Entrar" ou "Esqueci minha senha".' })
      }
      // So cliente pago pode reivindicar (evita definir senha de conta pre-criada
      // que ainda nao tem compra confirmada).
      const access = await getAccessInfo(admin, { id: foundId, email: clean })
      if (!access.allowed) {
        return json(403, { error: 'Pagamento ainda nao confirmado para este e-mail. Assim que confirmar, voce podera criar a senha.' })
      }
      uid = foundId
      email = clean
    } else {
      return json(400, { error: 'Requisicao invalida.' })
    }

    const { error: updErr } = await admin.auth.admin.updateUserById(uid, { password })
    if (updErr) throw updErr

    return json(200, { ok: true, email })
  } catch (err) {
    console.error('[asaas-set-password]', err?.message)
    return json(500, { error: 'Nao foi possivel definir a senha agora. Tente novamente.' })
  }
}

import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { CheckCircle2, Loader2, ArrowRight, Lock } from 'lucide-react'
import { trackClarity } from '../lib/analytics'
import { supabase } from '../lib/supabase/client'
import { setInitialPassword } from '../services/subscriptionService'
import { mensagemDeErro } from '../lib/errors'

export default function PagamentoSucesso() {
  const { state, refreshSubscription } = useApp()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  // Token assinado que veio na URL de retorno do pagamento: prova que a pessoa
  // acabou de comprar e permite criar a senha aqui mesmo, sem depender do e-mail.
  const setupToken = params.get('s')
  const [checking, setChecking] = useState(true)

  // Funil: voltou do Asaas para a tela de sucesso (marcador de sessao no Clarity).
  useEffect(() => { trackClarity('compra_aprovada') }, [])

  const loggedIn = !!state.supabaseUser

  // Formulario de criar senha (modo token).
  const [pwd, setPwd] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [pwdError, setPwdError] = useState('')

  // Faz polling do status só quando há sessão: o acesso libera quando o webhook
  // confirma o pagamento.
  useEffect(() => {
    if (!loggedIn) { setChecking(false); return }
    let tries = 0
    let timer: ReturnType<typeof setTimeout>

    const poll = async () => {
      await refreshSubscription()
      tries++
      if (tries < 6) {
        timer = setTimeout(poll, 3000)
      } else {
        setChecking(false)
      }
    }
    poll()
    return () => clearTimeout(timer)
  }, [loggedIn]) // eslint-disable-line

  const confirmed = loggedIn && state.subscription?.hasAccess

  // Quando confirmar, para de checar
  useEffect(() => { if (confirmed) setChecking(false) }, [confirmed])

  // Cria a senha (modo token), depois loga a pessoa e entra no app.
  const handleSetPassword = async (e: FormEvent) => {
    e.preventDefault()
    setPwdError('')
    if (pwd.length < 8) { setPwdError('A senha deve ter ao menos 8 caracteres.'); return }
    if (pwd !== confirm) { setPwdError('As senhas não conferem.'); return }
    setSaving(true)
    try {
      const { email } = await setInitialPassword({ token: setupToken as string, password: pwd })
      if (email) {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pwd })
        if (error) throw error
      }
      navigate('/')
    } catch (err) {
      setPwdError(mensagemDeErro(err, 'Não foi possível criar a senha agora. Use o e-mail que enviamos como alternativa.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-[100svh] flex flex-col items-center justify-center px-6 text-center" style={{ background: 'var(--bg-base)' }}>
      <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-6"
        style={(confirmed || !loggedIn) ? { background: 'var(--success)' } : { background: 'var(--brand-soft)', border: '1px solid var(--brand-border)' }}>
        {(confirmed || !loggedIn)
          ? <CheckCircle2 size={30} className="text-white" />
          : <Loader2 size={28} style={{ color: 'var(--brand)' }} className="animate-spin" />}
      </div>

      {setupToken && !loggedIn ? (
        // Caminho preferido: a pessoa cria a senha aqui mesmo, logo apos pagar.
        <>
          <h1 className="text-2xl font-extrabold mb-2" style={{ color: 'var(--text-primary)' }}>
            Pagamento recebido! Crie sua senha
          </h1>
          <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
            Defina uma senha para entrar no Destravaí. (Também enviamos um e-mail, caso prefira.)
          </p>
          <form onSubmit={handleSetPassword} className="w-full max-w-sm flex flex-col gap-3">
            <input
              type="password" className="input" placeholder="Crie uma senha (mín. 8 caracteres)"
              value={pwd} onChange={e => { setPwd(e.target.value); setPwdError('') }} autoFocus />
            <input
              type="password" className="input" placeholder="Repita a senha"
              value={confirm} onChange={e => { setConfirm(e.target.value); setPwdError('') }} />
            {pwdError && <p className="text-sm text-left" style={{ color: 'var(--danger)' }}>{pwdError}</p>}
            <button type="submit" disabled={saving} className="btn-primary px-8 py-3.5 disabled:opacity-50">
              {saving ? <Loader2 size={18} className="animate-spin" /> : <><Lock size={18} /> Criar senha e entrar</>}
            </button>
          </form>
        </>
      ) : !loggedIn ? (
        <>
          <h1 className="text-2xl font-extrabold mb-2" style={{ color: 'var(--text-primary)' }}>
            Pagamento recebido!
          </h1>
          <p className="text-sm mb-8" style={{ color: 'var(--text-secondary)' }}>
            Enviamos um e-mail para você criar sua senha e entrar no Destravaí.
            Assim que o pagamento for confirmado, seu acesso é liberado.
          </p>
          <button onClick={() => navigate('/login')} className="btn-primary px-8 py-3.5">
            Ir para o login <ArrowRight size={18} />
          </button>
        </>
      ) : confirmed ? (
        <>
          <h1 className="text-2xl font-extrabold mb-2" style={{ color: 'var(--text-primary)' }}>
            Pagamento recebido!
          </h1>
          <p className="text-sm mb-8" style={{ color: 'var(--text-secondary)' }}>
            Seu acesso ao Destravaí foi liberado. Bora destravar seus stories.
          </p>
          <button onClick={() => navigate('/')} className="btn-primary px-8 py-3.5">
            Entrar no app <ArrowRight size={18} />
          </button>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-extrabold mb-2" style={{ color: 'var(--text-primary)' }}>
            Estamos confirmando seu pagamento
          </h1>
          <p className="text-sm mb-8" style={{ color: 'var(--text-secondary)' }}>
            Isso pode levar alguns instantes. Assim que o pagamento for confirmado,
            seu acesso é liberado automaticamente.
          </p>
          <div className="flex gap-3">
            <button onClick={() => { setChecking(true); refreshSubscription().finally(() => setChecking(false)) }}
              disabled={checking} className="btn-secondary px-6 py-3 disabled:opacity-50">
              {checking ? <Loader2 size={16} className="animate-spin" /> : 'Verificar agora'}
            </button>
            <button onClick={() => navigate('/minha-assinatura')} className="btn-primary px-6 py-3">
              Minha assinatura
            </button>
          </div>
        </>
      )}
    </div>
  )
}

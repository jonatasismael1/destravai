import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { CheckCircle2, Loader2, ArrowRight } from 'lucide-react'

export default function PagamentoSucesso() {
  const { state, refreshSubscription } = useApp()
  const navigate = useNavigate()
  const [checking, setChecking] = useState(true)

  // Quem volta do pagamento por CARTÃO chega aqui SEM sessão (o checkout é anônimo;
  // o acesso é liberado pelo webhook + e-mail). Sem usuário logado, não dá para
  // consultar a assinatura — mostramos a orientação para checar o e-mail.
  const loggedIn = !!state.supabaseUser

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

  return (
    <div className="min-h-[100svh] flex flex-col items-center justify-center px-6 text-center" style={{ background: 'var(--bg-base)' }}>
      <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-6"
        style={(confirmed || !loggedIn) ? { background: 'var(--success)' } : { background: 'var(--brand-soft)', border: '1px solid var(--brand-border)' }}>
        {(confirmed || !loggedIn)
          ? <CheckCircle2 size={30} className="text-white" />
          : <Loader2 size={28} style={{ color: 'var(--brand)' }} className="animate-spin" />}
      </div>

      {!loggedIn ? (
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

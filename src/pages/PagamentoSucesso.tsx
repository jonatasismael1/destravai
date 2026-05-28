import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { CheckCircle2, Loader2, ArrowRight } from 'lucide-react'

export default function PagamentoSucesso() {
  const { state, refreshSubscription } = useApp()
  const navigate = useNavigate()
  const [checking, setChecking] = useState(true)

  // Faz polling do status: o acesso só libera quando o webhook confirmar o pagamento.
  useEffect(() => {
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
  }, []) // eslint-disable-line

  const confirmed = state.subscription?.hasAccess

  // Quando confirmar, para de checar
  useEffect(() => { if (confirmed) setChecking(false) }, [confirmed])

  return (
    <div className="min-h-[100svh] flex flex-col items-center justify-center px-6 text-center" style={{ background: '#0B0B12' }}>
      <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-6"
        style={{ background: confirmed ? 'linear-gradient(135deg, #53D6A1, #3BB88A)' : 'rgba(124,92,255,0.15)', border: '1px solid rgba(124,92,255,0.3)' }}>
        {confirmed
          ? <CheckCircle2 size={30} className="text-white" />
          : <Loader2 size={28} style={{ color: '#9B8CFF' }} className="animate-spin" />}
      </div>

      {confirmed ? (
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

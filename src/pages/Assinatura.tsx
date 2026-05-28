import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { useToast } from '../context/ToastContext'
import { PLANS, GUARANTEE_DAYS } from '../lib/plans'
import { createCheckout } from '../services/subscriptionService'
import { Check, ShieldCheck, ArrowRight, Loader2 } from 'lucide-react'

export default function Assinatura() {
  const { state } = useApp()
  const { addToast } = useToast()
  const navigate = useNavigate()

  const [selected, setSelected] = useState<'starter' | 'pro' | 'expert'>('pro')
  const [cpf, setCpf] = useState('')
  const [name, setName] = useState(
    state.profile?.name ?? state.localProfile?.professionalName ?? ''
  )
  const [loading, setLoading] = useState(false)

  const handleSubscribe = async () => {
    if (!name.trim()) { addToast('Informe seu nome completo.', 'error'); return }
    const cleanCpf = cpf.replace(/\D/g, '')
    if (cleanCpf.length !== 11 && cleanCpf.length !== 14) {
      addToast('Informe um CPF ou CNPJ válido.', 'error'); return
    }
    setLoading(true)
    try {
      const { checkoutUrl } = await createCheckout(selected, cleanCpf, name.trim())
      // Redireciona para a página de pagamento hospedada do Asaas
      window.location.href = checkoutUrl
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao iniciar pagamento'
      addToast(msg, 'error')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[100svh] overflow-y-auto" style={{ background: '#0B0B12' }}>
      <div className="max-w-md mx-auto px-5 py-10">
        <div className="text-center mb-8">
          <img src="/destravai-logo-completa.png" alt="Destravaí" className="h-24 mx-auto mb-4"
            style={{ filter: 'drop-shadow(0 0 24px rgba(124,92,255,0.4))' }} />
          <h1 className="text-2xl font-extrabold tracking-tight mb-2" style={{ color: 'var(--text-primary)' }}>
            Assine e comece a usar agora
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Você tem {GUARANTEE_DAYS} dias de garantia para testar na prática. Se não fizer sentido
            para sua rotina, pode cancelar dentro desse prazo.
          </p>
        </div>

        {/* Status atual, se houver */}
        {state.subscription?.hasSubscription && !state.subscription.hasAccess && (
          <div className="rounded-2xl p-3 mb-5 text-sm font-semibold text-center"
            style={{ background: 'rgba(247,185,85,0.1)', border: '1px solid rgba(247,185,85,0.25)', color: '#FFB547' }}>
            Sua assinatura está {state.subscription.status === 'pending' ? 'aguardando pagamento' : state.subscription.status}.
          </div>
        )}

        {/* Planos */}
        <div className="space-y-3 mb-6">
          {PLANS.map(plan => {
            const active = selected === plan.id
            return (
              <button
                key={plan.id}
                onClick={() => setSelected(plan.id)}
                className="w-full text-left rounded-3xl p-5 transition-all duration-200 relative"
                style={active ? {
                  background: 'linear-gradient(135deg, rgba(124,92,255,0.18), rgba(167,139,250,0.08))',
                  border: '1px solid rgba(124,92,255,0.5)',
                  boxShadow: '0 0 24px rgba(124,92,255,0.15)',
                } : {
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                }}
              >
                {plan.highlight && (
                  <span className="absolute -top-2 right-4 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
                    style={{ background: 'linear-gradient(135deg, #7C5CFF, #A78BFA)', color: '#fff' }}>
                    Mais popular
                  </span>
                )}
                <div className="flex items-center justify-between mb-1">
                  <span className="font-extrabold text-lg" style={{ color: active ? '#A78BFA' : 'var(--text-primary)' }}>
                    {plan.name}
                  </span>
                  <span className="font-extrabold text-lg" style={{ color: 'var(--text-primary)' }}>
                    R$ {plan.price}<span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>/mês</span>
                  </span>
                </div>
                <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>{plan.tagline}</p>
                <ul className="space-y-1.5">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      <Check size={13} style={{ color: '#53D6A1' }} /> {f}
                    </li>
                  ))}
                </ul>
              </button>
            )
          })}
        </div>

        {/* Dados para a cobrança */}
        <div className="space-y-3 mb-5">
          <div>
            <label className="label">Nome completo</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome completo" />
          </div>
          <div>
            <label className="label">CPF ou CNPJ</label>
            <input className="input" value={cpf} onChange={e => setCpf(e.target.value)}
              inputMode="numeric" placeholder="Somente números" />
            <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
              Exigido pelo provedor de pagamento (Asaas) para emitir a cobrança.
            </p>
          </div>
        </div>

        <button onClick={handleSubscribe} disabled={loading} className="btn-primary w-full py-4 text-base disabled:opacity-50">
          {loading
            ? <><Loader2 size={18} className="animate-spin" /> Gerando pagamento...</>
            : <>Assinar {PLANS.find(p => p.id === selected)?.name} <ArrowRight size={18} /></>}
        </button>

        <div className="flex items-center justify-center gap-2 mt-4 text-xs" style={{ color: 'var(--text-muted)' }}>
          <ShieldCheck size={13} style={{ color: '#53D6A1' }} />
          Pagamento seguro via Asaas · Garantia de {GUARANTEE_DAYS} dias
        </div>

        <button onClick={() => navigate('/minha-assinatura')}
          className="w-full text-center text-xs mt-6 font-semibold" style={{ color: 'var(--text-muted)' }}>
          Já assinou? Ver minha assinatura
        </button>
      </div>
    </div>
  )
}

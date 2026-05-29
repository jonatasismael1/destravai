import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { PLANS, GUARANTEE_DAYS } from '../lib/plans'
import { Check, ShieldCheck, ArrowRight } from 'lucide-react'

// Tela de assinatura dentro do app (usuário logado sem acesso ativo).
// O pagamento em si acontece no checkout público (/checkout) — aqui o usuário
// apenas escolhe o plano e é levado para lá.
export default function Assinatura() {
  const { state } = useApp()
  const navigate = useNavigate()
  const [selected, setSelected] = useState<'starter' | 'pro' | 'expert'>('pro')

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

        <button onClick={() => navigate(`/checkout?plan=${selected}`)} className="btn-primary w-full py-4 text-base">
          Continuar para o pagamento <ArrowRight size={18} />
        </button>

        <div className="flex items-center justify-center gap-2 mt-4 text-xs" style={{ color: 'var(--text-muted)' }}>
          <ShieldCheck size={13} style={{ color: '#53D6A1' }} />
          Pagamento seguro · Garantia de {GUARANTEE_DAYS} dias
        </div>

        <button onClick={() => navigate('/minha-assinatura')}
          className="w-full text-center text-xs mt-6 font-semibold" style={{ color: 'var(--text-muted)' }}>
          Já assinou? Ver minha assinatura
        </button>
      </div>
    </div>
  )
}

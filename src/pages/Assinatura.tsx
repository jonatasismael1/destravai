import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { COMPLETE_PLAN } from '../lib/plans'
import { Check, ShieldCheck, ArrowRight } from 'lucide-react'

export default function Assinatura() {
  const { state } = useApp()
  const navigate = useNavigate()

  return (
    <div className="min-h-[100svh] overflow-y-auto" style={{ background: 'var(--bg-base)' }}>
      <div className="max-w-md mx-auto px-5 py-10">
        <div className="text-center mb-8">
          <img src="/destravai-logo-completa.png" alt="Destravai" className="h-20 mx-auto mb-4" />
          <h1 className="text-2xl font-extrabold tracking-tight mb-2" style={{ color: 'var(--text-primary)' }}>
            Assine o Destravai Completo
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Comece por R$9,90 no primeiro mes. Depois, continue por R$49,90/mes.
            Sem fidelidade. Cancele quando quiser.
          </p>
        </div>

        {state.subscription?.hasSubscription && !state.subscription.hasAccess && (
          <div className="rounded-2xl p-4 mb-5 space-y-3 text-center"
            style={{ background: 'rgba(247,185,85,0.1)', border: '1px solid rgba(247,185,85,0.25)' }}>
            <p className="text-sm font-semibold" style={{ color: '#FFB547' }}>
              {state.subscription.status === 'pending'
                ? 'Seu pagamento está sendo processado. Aguarde alguns instantes e verifique o status.'
                : 'Sua assinatura está aguardando confirmação de pagamento.'}
            </p>
            {state.subscription.status === 'pending' && (
              <button
                onClick={() => navigate('/minha-assinatura')}
                className="btn-secondary text-sm px-4 py-2"
              >
                Ver status do pagamento
              </button>
            )}
          </div>
        )}

        <div className="rounded-2xl p-5 mb-6"
          style={{ background: 'var(--brand-soft)', border: '1px solid var(--brand-border)' }}>
          <div className="mb-4">
            <p className="text-xs font-black uppercase tracking-wider mb-1" style={{ color: 'var(--brand)' }}>
              {COMPLETE_PLAN.name}
            </p>
            <p className="font-extrabold text-3xl" style={{ color: 'var(--text-primary)' }}>
              R$9,90 <span className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>no primeiro mes</span>
            </p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              Depois R$49,90/mes. Sem fidelidade.
            </p>
          </div>
          <ul className="space-y-2">
            {COMPLETE_PLAN.features.map(feature => (
              <li key={feature} className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <Check size={14} style={{ color: '#53D6A1' }} /> {feature}
              </li>
            ))}
          </ul>
        </div>

        {/* Só mostra o botão de compra se não houver assinatura pendente — evita
            que quem já pagou crie uma nova cobrança por engano. */}
        {!state.subscription?.hasSubscription && (
          <button onClick={() => navigate('/checkout')} className="btn-primary w-full py-4 text-base">
            Comecar por R$9,90 <ArrowRight size={18} />
          </button>
        )}

        <div className="flex items-center justify-center gap-2 mt-4 text-xs" style={{ color: 'var(--text-muted)' }}>
          <ShieldCheck size={13} style={{ color: '#53D6A1' }} />
          Pagamento seguro. Cancele quando quiser.
        </div>

        <button onClick={() => navigate('/minha-assinatura')}
          className="w-full text-center text-xs mt-6 font-semibold" style={{ color: 'var(--text-muted)' }}>
          Ja assinou? Ver minha assinatura
        </button>
      </div>
    </div>
  )
}

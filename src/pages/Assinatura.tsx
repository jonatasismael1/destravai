import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { COMPLETE_PLAN } from '../lib/plans'
import { Check, ShieldCheck, ArrowRight } from 'lucide-react'

export default function Assinatura() {
  const { state } = useApp()
  const navigate = useNavigate()

  return (
    <div className="min-h-[100svh] overflow-y-auto" style={{ background: '#0B0B12' }}>
      <div className="max-w-md mx-auto px-5 py-10">
        <div className="text-center mb-8">
          <img src="/destravai-logo-completa.png" alt="Destravai" className="h-24 mx-auto mb-4"
            style={{ filter: 'drop-shadow(0 0 24px rgba(124,92,255,0.4))' }} />
          <h1 className="text-2xl font-extrabold tracking-tight mb-2" style={{ color: 'var(--text-primary)' }}>
            Assine o Destravai Completo
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Comece por R$29,90 no primeiro mes. Depois, continue por R$49,90/mes.
            Sem fidelidade. Cancele quando quiser.
          </p>
        </div>

        {state.subscription?.hasSubscription && !state.subscription.hasAccess && (
          <div className="rounded-2xl p-3 mb-5 text-sm font-semibold text-center"
            style={{ background: 'rgba(247,185,85,0.1)', border: '1px solid rgba(247,185,85,0.25)', color: '#FFB547' }}>
            Sua assinatura esta {state.subscription.status === 'pending' ? 'aguardando pagamento' : state.subscription.status}.
          </div>
        )}

        <div className="rounded-3xl p-5 mb-6"
          style={{
            background: 'linear-gradient(135deg, rgba(124,92,255,0.18), rgba(167,139,250,0.08))',
            border: '1px solid rgba(124,92,255,0.5)',
            boxShadow: '0 0 24px rgba(124,92,255,0.15)',
          }}>
          <div className="mb-4">
            <p className="text-xs font-black uppercase tracking-wider mb-1" style={{ color: '#A78BFA' }}>
              {COMPLETE_PLAN.name}
            </p>
            <p className="font-extrabold text-3xl" style={{ color: 'var(--text-primary)' }}>
              R$29,90 <span className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>no primeiro mes</span>
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

        <button onClick={() => navigate('/checkout')} className="btn-primary w-full py-4 text-base">
          Comecar por R$29,90 <ArrowRight size={18} />
        </button>

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

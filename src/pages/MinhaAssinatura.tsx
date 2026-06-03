import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { useToast } from '../context/ToastContext'
import { cancelSubscription } from '../services/subscriptionService'
import { ArrowLeft, ShieldCheck, AlertTriangle, Loader2 } from 'lucide-react'

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  active:   { label: 'Ativa', color: 'var(--success)' },
  trialing: { label: 'Periodo de teste', color: 'var(--brand)' },
  pending:  { label: 'Aguardando pagamento', color: 'var(--warning)' },
  past_due: { label: 'Pagamento atrasado', color: 'var(--danger)' },
  overdue:  { label: 'Pagamento atrasado', color: 'var(--danger)' },
  canceled: { label: 'Cancelada', color: 'var(--text-muted)' },
  refunded: { label: 'Reembolsada', color: 'var(--text-muted)' },
  failed:   { label: 'Falha no pagamento', color: 'var(--danger)' },
}

function fmt(date?: string | null) {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}

function money(value?: number | null, fallback = '-') {
  if (typeof value !== 'number') return fallback
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function MinhaAssinatura() {
  const { state, refreshSubscription } = useApp()
  const { addToast } = useToast()
  const navigate = useNavigate()
  const sub = state.subscription

  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)

  const withinGuarantee = !!sub?.withinGuarantee
  const canCancel = sub?.status === 'active' || sub?.status === 'pending' || sub?.status === 'past_due'
  // Cancelada, mas ainda com acesso até o fim do período já pago.
  const accessUntil = sub?.status === 'canceled' && sub?.accessUntil ? sub.accessUntil : null

  const handleCancel = async () => {
    setLoading(true)
    try {
      const res = await cancelSubscription()
      addToast(res.message, 'success')
      await refreshSubscription()
      setConfirming(false)
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Erro ao cancelar', 'error')
    } finally {
      setLoading(false)
    }
  }

  const st = sub?.status ? STATUS_LABEL[sub.status] : null

  return (
    <div className="min-h-[100svh] overflow-y-auto" style={{ background: 'var(--bg-base)' }}>
      <div className="max-w-md mx-auto px-5 py-8">
        <button onClick={() => navigate('/')} className="inline-flex items-center gap-2 text-sm font-bold mb-8" style={{ color: 'var(--brand)' }}>
          <ArrowLeft size={16} /> Voltar
        </button>

        <h1 className="text-2xl font-extrabold mb-6" style={{ color: 'var(--text-primary)' }}>Minha assinatura</h1>

        {!sub?.hasSubscription ? (
          <div className="rounded-3xl p-6 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>Voce ainda nao tem uma assinatura ativa.</p>
            <button onClick={() => navigate('/assinatura')} className="btn-primary px-6 py-3">Assinar agora</button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-3xl p-5 space-y-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
              <Row label="Plano" value={sub.planName ?? 'Destravai Completo'} />
              <Row label="Status" value={st?.label ?? sub.status ?? '-'} valueColor={st?.color} />
              <Row label="Primeiro mes" value={money(sub.firstMonthPrice, 'R$ 29,90')} />
              <Row label="Valor recorrente" value={`${money(sub.recurringPrice ?? sub.price, 'R$ 49,90')}/mes`} />
              <Row label="Inicio" value={fmt(sub.startedAt)} />
            </div>

            {withinGuarantee && (
              <div className="rounded-2xl p-3 flex items-start gap-2 text-xs"
                style={{ background: 'rgba(83,214,161,0.08)', border: '1px solid rgba(83,214,161,0.2)', color: '#53D6A1' }}>
                <ShieldCheck size={14} className="flex-shrink-0 mt-0.5" />
                Cancelamento solicitado dentro do prazo legal pode gerar reembolso conforme a politica da empresa.
              </div>
            )}

            {accessUntil && (
              <div className="rounded-2xl p-3 flex items-start gap-2 text-xs"
                style={{ background: 'rgba(247,185,85,0.08)', border: '1px solid rgba(247,185,85,0.25)', color: '#F7B955' }}>
                <ShieldCheck size={14} className="flex-shrink-0 mt-0.5" />
                Assinatura cancelada. Você não será cobrado novamente e continua com acesso até {fmt(accessUntil)}.
              </div>
            )}

            {canCancel && !confirming && (
              <button onClick={() => setConfirming(true)} className="btn-secondary w-full py-3 text-sm"
                style={{ color: '#FF7A6B', borderColor: 'rgba(255,122,107,0.3)' }}>
                Cancelar assinatura
              </button>
            )}

            {confirming && (
              <div className="rounded-3xl p-5 space-y-4" style={{ background: 'rgba(255,122,107,0.06)', border: '1px solid rgba(255,122,107,0.25)' }}>
                <div className="flex items-start gap-2">
                  <AlertTriangle size={16} style={{ color: '#FF7A6B' }} className="flex-shrink-0 mt-0.5" />
                  <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                    {withinGuarantee
                      ? 'Sua assinatura sera encerrada e o reembolso sera solicitado conforme a politica da empresa.'
                      : 'Sua assinatura sera cancelada e voce nao sera cobrado novamente. O valor do ciclo atual nao sera reembolsado.'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setConfirming(false)} disabled={loading} className="btn-secondary flex-1 py-3 text-sm">
                    Voltar
                  </button>
                  <button onClick={handleCancel} disabled={loading}
                    className="flex-1 py-3 rounded-2xl font-bold text-sm text-white disabled:opacity-50"
                    style={{ background: 'var(--danger)' }}>
                    {loading ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Confirmar cancelamento'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className="text-sm font-bold" style={{ color: valueColor ?? 'var(--text-primary)' }}>{value}</span>
    </div>
  )
}

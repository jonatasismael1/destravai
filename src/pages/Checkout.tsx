import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Check, ShieldCheck, ArrowRight, Loader2, QrCode, CreditCard,
  Copy, CheckCircle2,
} from 'lucide-react'
import { COMPLETE_PLAN } from '../lib/plans'
import {
  createPublicCheckout, getCheckoutStatus,
  type CheckoutResult,
} from '../services/subscriptionService'

type Step = 'form' | 'pix' | 'success'
type Method = 'PIX' | 'CREDIT_CARD'

function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function maskDocument(raw: string) {
  const d = raw.replace(/\D/g, '').slice(0, 14)
  if (d.length <= 11) {
    return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  }
  return d.replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1/$2').replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}

function maskPhone(raw: string) {
  const d = raw.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 10) return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d{1,4})$/, '$1-$2')
  return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d{1,4})$/, '$1-$2')
}

export default function Checkout() {
  const navigate = useNavigate()
  const [method, setMethod] = useState<Method>('PIX')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [doc, setDoc] = useState('')
  const [step, setStep] = useState<Step>('form')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<CheckoutResult | null>(null)
  const [copied, setCopied] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (step !== 'pix' || !result?.paymentId) return
    const tick = async () => {
      try {
        const status = await getCheckoutStatus(result.paymentId)
        if (status.paid) {
          if (pollRef.current) clearInterval(pollRef.current)
          setStep('success')
        }
      } catch { /* ignora erro pontual de rede no polling */ }
    }
    pollRef.current = setInterval(tick, 4000)
    tick()
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [step, result?.paymentId])

  const validate = () => {
    if (!name.trim()) return 'Informe seu nome completo.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Informe um e-mail valido.'
    const cleanDoc = doc.replace(/\D/g, '')
    if (cleanDoc.length !== 11 && cleanDoc.length !== 14) return 'Informe um CPF ou CNPJ valido.'
    return ''
  }

  const handleSubmit = async () => {
    const v = validate()
    if (v) { setError(v); return }
    setError('')
    setLoading(true)
    try {
      const res = await createPublicCheckout({
        billingType: method,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.replace(/\D/g, ''),
        cpfCnpj: doc.replace(/\D/g, ''),
      })
      setResult(res)
      if (res.method === 'card' && res.checkoutUrl) {
        window.location.href = res.checkoutUrl
        return
      }
      setStep('pix')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao iniciar o pagamento.')
    } finally {
      setLoading(false)
    }
  }

  const copyPix = async () => {
    if (!result?.pix?.copyPaste) return
    try {
      await navigator.clipboard.writeText(result.pix.copyPaste)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard pode falhar em http; usuario copia manualmente */ }
  }

  if (step === 'success') {
    return (
      <Shell>
        <div className="text-center py-6">
          <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-6 mx-auto"
            style={{ background: 'linear-gradient(135deg, #53D6A1, #3BB88A)' }}>
            <CheckCircle2 size={30} className="text-white" />
          </div>
          <h1 className="text-2xl font-extrabold mb-2" style={{ color: 'var(--text-primary)' }}>
            Pagamento confirmado!
          </h1>
          <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
            Seu acesso ao Destravai foi liberado.
          </p>
          <p className="text-sm mb-8" style={{ color: 'var(--text-secondary)' }}>
            Enviamos um e-mail para <strong style={{ color: 'var(--text-primary)' }}>{email}</strong> com
            o link para voce criar sua senha e entrar.
          </p>
          <button onClick={() => navigate('/login')} className="btn-primary w-full py-4 text-base">
            Acessar Destravai <ArrowRight size={18} />
          </button>
        </div>
      </Shell>
    )
  }

  if (step === 'pix' && result?.pix) {
    return (
      <Shell>
        <div className="text-center">
          <div className="inline-flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full mb-4"
            style={{ background: 'rgba(124,92,255,0.15)', border: '1px solid rgba(124,92,255,0.3)', color: '#A78BFA' }}>
            <QrCode size={13} /> Pague com Pix
          </div>
          <h1 className="text-xl font-extrabold mb-1" style={{ color: 'var(--text-primary)' }}>
            Destravai Completo - {formatBRL(COMPLETE_PLAN.firstMonthPrice)}
          </h1>
          <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>
            Este e o primeiro mes. Depois, a assinatura continua por {formatBRL(COMPLETE_PLAN.recurringPrice)}/mes.
          </p>

          {result.pix.qrCodeImage && (
            <div className="inline-block p-3 rounded-2xl bg-white mb-4">
              <img src={`data:image/png;base64,${result.pix.qrCodeImage}`} alt="QR Code Pix"
                className="w-52 h-52" />
            </div>
          )}

          {result.pix.copyPaste && (
            <button onClick={copyPix}
              className="w-full flex items-center justify-between gap-2 rounded-2xl px-4 py-3 mb-4 text-left"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
              <span className="text-xs font-mono truncate" style={{ color: 'var(--text-secondary)' }}>
                {result.pix.copyPaste}
              </span>
              <span className="flex items-center gap-1 text-xs font-bold flex-shrink-0" style={{ color: '#A78BFA' }}>
                {copied ? <><Check size={14} /> Copiado</> : <><Copy size={14} /> Copiar</>}
              </span>
            </button>
          )}

          <div className="rounded-2xl p-3 flex items-center justify-center gap-2 mb-4"
            style={{ background: 'rgba(124,92,255,0.08)', border: '1px solid rgba(124,92,255,0.2)' }}>
            <Loader2 size={15} className="animate-spin" style={{ color: '#9B8CFF' }} />
            <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
              Aguardando confirmacao do pagamento...
            </span>
          </div>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <div className="text-center mb-6">
        <img src="/destravai-logo-completa.png" alt="Destravai" className="h-16 mx-auto mb-3"
          style={{ filter: 'drop-shadow(0 0 24px rgba(124,92,255,0.4))' }} />
        <h1 className="text-xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          Finalize sua assinatura
        </h1>
        <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
          R$29,90 no primeiro mes e R$49,90/mes depois. Sem fidelidade.
        </p>
      </div>

      <div className="rounded-3xl p-5 mb-5 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(124,92,255,0.16), rgba(167,139,250,0.06))',
          border: '1px solid rgba(124,92,255,0.4)',
        }}>
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <span className="font-extrabold text-lg" style={{ color: '#A78BFA' }}>{COMPLETE_PLAN.name}</span>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Depois {formatBRL(COMPLETE_PLAN.recurringPrice)}/mes. Cancele quando quiser.
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <span className="font-extrabold text-xl" style={{ color: 'var(--text-primary)' }}>
              {formatBRL(COMPLETE_PLAN.firstMonthPrice)}
            </span>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>primeiro mes</p>
          </div>
        </div>
        <ul className="space-y-1.5">
          {COMPLETE_PLAN.features.map(f => (
            <li key={f} className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <Check size={13} style={{ color: '#53D6A1' }} /> {f}
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-3 mb-5">
        <div>
          <label className="label">Nome completo</label>
          <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome completo" />
        </div>
        <div>
          <label className="label">E-mail</label>
          <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="seu@email.com" />
          <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
            E neste e-mail que voce vai receber o acesso.
          </p>
        </div>
        <div>
          <label className="label">WhatsApp</label>
          <input className="input" inputMode="numeric" value={phone}
            onChange={e => setPhone(maskPhone(e.target.value))} placeholder="(00) 00000-0000" />
        </div>
        <div>
          <label className="label">CPF ou CNPJ</label>
          <input className="input" inputMode="numeric" value={doc}
            onChange={e => setDoc(maskDocument(e.target.value))} placeholder="Somente numeros" />
        </div>
      </div>

      <label className="label">Forma de pagamento</label>
      <div className="flex gap-2 mb-5">
        <MethodTab active={method === 'PIX'} onClick={() => setMethod('PIX')} icon={QrCode} label="Pix" sub="Aprovacao rapida" />
        <MethodTab active={method === 'CREDIT_CARD'} onClick={() => setMethod('CREDIT_CARD')} icon={CreditCard} label="Cartao" sub="Credito" />
      </div>

      {error && (
        <div className="rounded-xl px-4 py-3 text-sm font-semibold mb-4"
          style={{ background: 'rgba(255,122,107,0.1)', border: '1px solid rgba(255,122,107,0.2)', color: '#FF7A6B' }}>
          {error}
        </div>
      )}

      <button onClick={handleSubmit} disabled={loading} className="btn-primary w-full py-4 text-base disabled:opacity-50">
        {loading
          ? <><Loader2 size={18} className="animate-spin" /> Gerando pagamento...</>
          : <>Comecar por {formatBRL(COMPLETE_PLAN.firstMonthPrice)} <ArrowRight size={18} /></>}
      </button>

      <div className="flex items-center justify-center gap-2 mt-4 text-xs" style={{ color: 'var(--text-muted)' }}>
        <ShieldCheck size={13} style={{ color: '#53D6A1' }} />
        Sem fidelidade. Cancele quando quiser.
      </div>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div data-theme="light" className="w-full" style={{ height: '100svh', overflowY: 'auto', background: '#FFFFFF' }}>
      <div className="max-w-md mx-auto px-5 py-8 pb-24">{children}</div>
    </div>
  )
}

function MethodTab({ active, onClick, icon: Icon, label, sub }: {
  active: boolean; onClick: () => void; icon: React.ElementType; label: string; sub: string
}) {
  return (
    <button onClick={onClick}
      className="flex-1 flex items-center gap-2 rounded-2xl px-3 py-3 transition-all duration-200"
      style={active ? {
        background: 'rgba(124,92,255,0.18)', border: '1px solid rgba(124,92,255,0.5)',
      } : { background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
      <Icon size={18} style={{ color: active ? '#A78BFA' : 'var(--text-muted)' }} />
      <div className="text-left">
        <p className="text-sm font-bold" style={{ color: active ? '#A78BFA' : 'var(--text-primary)' }}>{label}</p>
        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{sub}</p>
      </div>
    </button>
  )
}

import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Check, ShieldCheck, ArrowRight, Loader2, QrCode, CreditCard,
  Copy, CheckCircle2, RefreshCw, Mail, Sparkles, Heart, Lock, Clock, Info,
} from 'lucide-react'
import { COMPLETE_PLAN } from '../lib/plans'
import {
  createPublicCheckout, getCheckoutStatus,
  type CheckoutResult,
} from '../services/subscriptionService'

type Step = 'form' | 'pix' | 'success'
type Method = 'PIX' | 'CREDIT_CARD'
type FieldErrors = Partial<Record<'name' | 'email' | 'phone' | 'doc', string>>

// Benefícios exibidos na coluna esquerda — copy do guia de redesign (seção 27).
// Mantidos aqui para o tom comercial, sem alterar a fonte da verdade do preço.
const CHECKOUT_BENEFITS = [
  'Ideias e roteiros com IA',
  'Missão do dia para postar sem travar',
  'Studio com teleprompter',
  'Legendas e CTAs personalizados',
  'Biblioteca de conteúdos',
  'Calendário editorial',
  'Progresso de constância',
]

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
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [result, setResult] = useState<CheckoutResult | null>(null)
  const [copied, setCopied] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Polling do status do Pix (lógica de pagamento — inalterada).
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

  // Relógio de 1s só enquanto o Pix está na tela (alimenta o contador de expiração).
  useEffect(() => {
    if (step !== 'pix') return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [step])

  // Validação por campo. WhatsApp é opcional, mas se preenchido precisa ser válido.
  const validate = (): FieldErrors => {
    const e: FieldErrors = {}
    if (!name.trim()) e.name = 'Informe seu nome completo.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = 'Informe um e-mail válido.'
    const cleanPhone = phone.replace(/\D/g, '')
    if (cleanPhone.length > 0 && cleanPhone.length < 10) e.phone = 'WhatsApp incompleto.'
    const cleanDoc = doc.replace(/\D/g, '')
    if (cleanDoc.length !== 11 && cleanDoc.length !== 14) e.doc = 'Informe um CPF ou CNPJ válido.'
    return e
  }

  // Limpa o erro de um campo assim que o usuário começa a corrigi-lo.
  const clearErr = (k: keyof FieldErrors) => setFieldErrors(prev => {
    if (!prev[k]) return prev
    const next = { ...prev }; delete next[k]; return next
  })

  const handleSubmit = async () => {
    const errs = validate()
    setFieldErrors(errs)
    if (Object.keys(errs).length) { setError(''); return }
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

  // ─── Sucesso ──────────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <Shell narrow>
        <div className="checkout-card text-center px-7 py-9">
          <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-6 mx-auto"
            style={{ background: 'linear-gradient(135deg, #53D6A1, #3BB88A)', boxShadow: '0 16px 38px rgba(83,214,161,0.35)' }}>
            <CheckCircle2 size={30} className="text-white" />
          </div>
          <h1 className="text-2xl font-extrabold mb-2 tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Pagamento confirmado!
          </h1>
          <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
            Seu acesso ao Destravaí foi liberado.
          </p>
          <p className="text-sm mb-8" style={{ color: 'var(--text-secondary)' }}>
            Enviamos um e-mail para <strong style={{ color: 'var(--text-primary)' }}>{email}</strong> com
            o link para você criar sua senha e entrar.
          </p>
          <button onClick={() => navigate('/login')} className="btn-primary w-full py-4 text-base">
            Acessar Destravaí <ArrowRight size={18} />
          </button>
        </div>
      </Shell>
    )
  }

  // ─── Pix (aguardando pagamento) ───────────────────────────────────
  if (step === 'pix' && result?.pix) {
    const expMs = result.pix.expiration ? new Date(result.pix.expiration).getTime() : null
    const remaining = expMs ? Math.max(0, Math.floor((expMs - now) / 1000)) : null
    const expired = remaining === 0
    const mmss = remaining != null
      ? `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`
      : null

    return (
      <Shell narrow>
        <div className="checkout-card text-center px-7 py-8">
          <div className="inline-flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full mb-4"
            style={{ background: 'rgba(109,93,246,0.10)', border: '1px solid rgba(109,93,246,0.25)', color: '#6D5DF6' }}>
            <QrCode size={13} /> Pague com Pix
          </div>
          <h1 className="text-xl font-extrabold mb-1 tracking-tight" style={{ color: 'var(--text-primary)' }}>
            {COMPLETE_PLAN.name} — {formatBRL(COMPLETE_PLAN.firstMonthPrice)}
          </h1>
          <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
            Este é o primeiro mês. Depois, a assinatura continua por {formatBRL(COMPLETE_PLAN.recurringPrice)}/mês.
          </p>

          {/* Contador de expiração do QR (usa a expiração real do Asaas). */}
          {mmss && (
            <div className="inline-flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full mb-4"
              style={expired
                ? { background: 'rgba(255,122,107,0.10)', border: '1px solid rgba(255,122,107,0.3)', color: '#E25C4D' }
                : { background: 'rgba(247,185,85,0.12)', border: '1px solid rgba(247,185,85,0.3)', color: '#C98A1E' }}>
              <Clock size={13} />
              {expired ? 'QR Code expirado — gere um novo' : `Expira em ${mmss}`}
            </div>
          )}

          {result.pix.qrCodeImage && (
            <div className="inline-block p-3 rounded-2xl bg-white mb-4"
              style={{ boxShadow: '0 18px 60px rgba(109,93,246,0.12)', opacity: expired ? 0.4 : 1 }}>
              <img src={`data:image/png;base64,${result.pix.qrCodeImage}`} alt="QR Code Pix"
                className="w-52 h-52" />
            </div>
          )}

          {result.pix.copyPaste && (
            <button onClick={copyPix}
              className="w-full flex items-center justify-between gap-2 rounded-2xl px-4 py-3 mb-3 text-left"
              style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)' }}>
              <span className="text-xs font-mono truncate" style={{ color: 'var(--text-secondary)' }}>
                {result.pix.copyPaste}
              </span>
              <span className="flex items-center gap-1 text-xs font-bold flex-shrink-0" style={{ color: '#6D5DF6' }}>
                {copied ? <><Check size={14} /> Copiado</> : <><Copy size={14} /> Copiar</>}
              </span>
            </button>
          )}

          {/* Ajuda: como pagar pelo app do banco. */}
          <p className="text-xs leading-relaxed mb-4 text-left" style={{ color: 'var(--text-muted)' }}>
            Abra o app do seu banco, escolha <strong style={{ color: 'var(--text-secondary)' }}>Pix › Pix Copia e Cola</strong>,
            cole o código e confirme. A liberação é automática.
          </p>

          <div className="rounded-2xl p-3 flex items-center justify-center gap-2"
            style={{ background: 'rgba(109,93,246,0.06)', border: '1px solid rgba(109,93,246,0.18)' }}>
            <Loader2 size={15} className="animate-spin" style={{ color: '#6D5DF6' }} />
            <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
              Aguardando confirmação do pagamento...
            </span>
          </div>
        </div>
      </Shell>
    )
  }

  // ─── Formulário (duas colunas no desktop) ─────────────────────────
  return (
    <Shell>
      {/* Topo: logo centralizada + headline curta (aparece cedo no mobile) */}
      <header className="text-center mb-8">
        <img src="/destravai-logo-completa.png" alt="Destravaí" className="h-12 sm:h-14 mx-auto mb-5"
          style={{ filter: 'drop-shadow(0 0 24px rgba(109,93,246,0.35))' }} />
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight"
          style={{ color: 'var(--text-primary)' }}>
          Finalize seu acesso ao <span className="gradient-text">Destravaí</span>
        </h1>
        <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
          Primeiro mês por {formatBRL(COMPLETE_PLAN.firstMonthPrice)}. Depois {formatBRL(COMPLETE_PLAN.recurringPrice)}/mês. Sem fidelidade.
        </p>
      </header>

      <div className="grid lg:grid-cols-2 gap-6 items-start">
        {/* ── Coluna esquerda: oferta + confiança ──────────────────── */}
        {/* order-2 no mobile (vem depois do formulário), order-1 no desktop */}
        <aside className="order-2 lg:order-1 space-y-5">
          <div className="checkout-card p-6 relative overflow-hidden">
            {/* Ícone decorativo no canto */}
            <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full opacity-60 pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(155,140,255,0.35), transparent 70%)' }} />
            <Sparkles size={22} className="absolute right-5 top-5" style={{ color: '#9B8CFF' }} />

            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full mb-4"
              style={{ background: 'rgba(109,93,246,0.10)', border: '1px solid rgba(109,93,246,0.22)', color: '#6D5DF6' }}>
              <Sparkles size={12} /> Acesso completo
            </span>

            <p className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
              Você está levando:
            </p>
            <ul className="space-y-2.5">
              {CHECKOUT_BENEFITS.map(f => (
                <li key={f} className="flex items-center gap-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(83,214,161,0.15)', border: '1px solid rgba(83,214,161,0.4)' }}>
                    <Check size={12} style={{ color: '#53D6A1' }} strokeWidth={3} />
                  </span>
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Faixa de confiança */}
          <div className="grid grid-cols-3 gap-3">
            <TrustItem icon={ShieldCheck} title="Pagamento seguro" sub="Seus dados protegidos" />
            <TrustItem icon={RefreshCw} title="Cancele fácil" sub="Quando quiser" />
            <TrustItem icon={Mail} title="Acesso por e-mail" sub="Rápido e automático" />
          </div>

          {/* Box final emocional */}
          <div className="checkout-card flex items-center gap-3 p-4">
            <span className="flex-shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, rgba(109,93,246,0.12), rgba(255,122,107,0.10))' }}>
              <Heart size={18} style={{ color: '#FF7A6B' }} />
            </span>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Feito para quem quer aparecer com constância sem perder horas pensando no que postar.
            </p>
          </div>
        </aside>

        {/* ── Coluna direita: card do plano + formulário ───────────── */}
        <div className="order-1 lg:order-2 checkout-card p-6">
          {/* Card resumo do plano */}
          <div className="rounded-2xl p-4 mb-5 flex items-center justify-between gap-4"
            style={{
              background: 'linear-gradient(135deg, rgba(109,93,246,0.12), rgba(155,140,255,0.06))',
              border: '1px solid rgba(109,93,246,0.22)',
            }}>
            <div className="flex items-center gap-3">
              <span className="flex-shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center text-white font-extrabold text-lg"
                style={{ background: 'linear-gradient(135deg, #6D5DF6, #9B8CFF)', boxShadow: '0 8px 20px rgba(109,93,246,0.35)' }}>
                D
              </span>
              <div>
                <p className="font-extrabold text-sm" style={{ color: 'var(--text-primary)' }}>{COMPLETE_PLAN.name}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Acesso total a todas as ferramentas</p>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="font-extrabold text-lg leading-none" style={{ color: 'var(--text-primary)' }}>
                {formatBRL(COMPLETE_PLAN.firstMonthPrice)}
              </p>
              <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>primeiro mês</p>
            </div>
          </div>

          {/* Campos */}
          <div className="space-y-3 mb-5">
            <Field label="Nome completo" htmlFor="ck-name" error={fieldErrors.name}>
              <input id="ck-name" name="name" autoComplete="name"
                className={`input ${fieldErrors.name ? 'input-error' : ''}`}
                aria-invalid={!!fieldErrors.name}
                value={name} onChange={e => { setName(e.target.value); clearErr('name') }}
                placeholder="Digite seu nome completo" />
            </Field>

            <Field label="E-mail" htmlFor="ck-email" error={fieldErrors.email}
              hint="É neste e-mail que você vai receber o acesso.">
              <input id="ck-email" name="email" type="email" autoComplete="email" inputMode="email"
                className={`input ${fieldErrors.email ? 'input-error' : ''}`}
                aria-invalid={!!fieldErrors.email}
                value={email} onChange={e => { setEmail(e.target.value); clearErr('email') }}
                placeholder="seu@email.com" />
            </Field>

            <Field label="WhatsApp (opcional)" htmlFor="ck-phone" error={fieldErrors.phone}
              hint="Enviaremos informações importantes no seu WhatsApp.">
              <input id="ck-phone" name="phone" type="tel" autoComplete="tel" inputMode="numeric"
                className={`input ${fieldErrors.phone ? 'input-error' : ''}`}
                aria-invalid={!!fieldErrors.phone}
                value={phone} onChange={e => { setPhone(maskPhone(e.target.value)); clearErr('phone') }}
                placeholder="(00) 00000-0000" />
            </Field>

            <Field label="CPF ou CNPJ" htmlFor="ck-doc" error={fieldErrors.doc}>
              <input id="ck-doc" name="document" autoComplete="off" inputMode="numeric"
                className={`input ${fieldErrors.doc ? 'input-error' : ''}`}
                aria-invalid={!!fieldErrors.doc}
                value={doc} onChange={e => { setDoc(maskDocument(e.target.value)); clearErr('doc') }}
                placeholder="Somente números" />
            </Field>
          </div>

          {/* Forma de pagamento */}
          <label className="label">Forma de pagamento</label>
          <div className="flex gap-2 mb-4">
            <MethodTab active={method === 'PIX'} onClick={() => setMethod('PIX')} icon={QrCode} label="Pix" sub="Aprovação imediata" />
            <MethodTab active={method === 'CREDIT_CARD'} onClick={() => setMethod('CREDIT_CARD')} icon={CreditCard} label="Cartão" sub="Crédito" />
          </div>

          {/* Aviso de redirecionamento do cartão (ambiente seguro do Asaas). */}
          {method === 'CREDIT_CARD' && (
            <div className="rounded-xl px-4 py-3 mb-4 flex items-start gap-2 text-xs"
              style={{ background: 'rgba(109,93,246,0.06)', border: '1px solid rgba(109,93,246,0.18)', color: 'var(--text-secondary)' }}>
              <Info size={15} className="flex-shrink-0 mt-0.5" style={{ color: '#6D5DF6' }} />
              Você será direcionado ao ambiente seguro do Asaas para informar os dados do cartão.
            </div>
          )}

          {error && (
            <div className="rounded-xl px-4 py-3 text-sm font-semibold mb-4"
              style={{ background: 'rgba(255,122,107,0.10)', border: '1px solid rgba(255,122,107,0.25)', color: '#E25C4D' }}>
              {error}
            </div>
          )}

          <button onClick={handleSubmit} disabled={loading} className="btn-primary w-full text-base disabled:opacity-50"
            style={{ height: 58 }}>
            {loading
              ? <><Loader2 size={18} className="animate-spin" /> Gerando pagamento...</>
              : <>Começar meu primeiro mês por {formatBRL(COMPLETE_PLAN.firstMonthPrice)} <ArrowRight size={18} /></>}
          </button>

          {/* Microcopy abaixo do botão */}
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-center gap-2 text-xs text-center" style={{ color: 'var(--text-muted)' }}>
              <Mail size={13} style={{ color: '#6D5DF6' }} className="flex-shrink-0" />
              Acesso liberado no e-mail informado após a confirmação do pagamento.
            </div>
            <div className="flex items-center justify-center gap-2 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
              <Check size={13} style={{ color: '#53D6A1' }} strokeWidth={3} />
              Sem fidelidade • Cancele quando quiser
            </div>
          </div>

          {/* Selo de pagamento seguro */}
          <div className="flex items-center justify-center gap-2 mt-4 pt-4"
            style={{ borderTop: '1px solid var(--border-color)' }}>
            <Lock size={13} style={{ color: 'var(--text-muted)' }} />
            <span className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>
              Pagamento seguro processado pelo Asaas
            </span>
          </div>
        </div>
      </div>
    </Shell>
  )
}

// Casca da página com tema claro premium e orbs suaves de fundo (guia, seção 26).
function Shell({ children, narrow = false }: { children: React.ReactNode; narrow?: boolean }) {
  return (
    <div data-theme="light" className="w-full" style={{
      height: '100svh', overflowY: 'auto',
      background: `
        radial-gradient(circle at 10% 20%, rgba(155,140,255,0.18), transparent 28%),
        radial-gradient(circle at 90% 55%, rgba(109,93,246,0.14), transparent 30%),
        linear-gradient(180deg, #FAF8FF 0%, #F6F2FF 45%, #FFFFFF 100%)`,
    }}>
      <div className={`${narrow ? 'max-w-md' : 'max-w-[1180px]'} mx-auto px-5 py-10 pb-24 ${narrow ? 'min-h-full flex items-center' : ''}`}>
        <div className="w-full">{children}</div>
      </div>
    </div>
  )
}

// Campo de formulário: liga <label> ao <input> (acessibilidade) e exibe hint/erro.
function Field({ label, htmlFor, error, hint, children }: {
  label: string; htmlFor: string; error?: string; hint?: string; children: React.ReactNode
}) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>{label}</label>
      {children}
      {error
        ? <p className="text-[11px] mt-1.5 font-semibold" style={{ color: '#E25C4D' }}>{error}</p>
        : hint
          ? <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-muted)' }}>{hint}</p>
          : null}
    </div>
  )
}

function TrustItem({ icon: Icon, title, sub }: { icon: React.ElementType; title: string; sub: string }) {
  return (
    <div className="checkout-card flex flex-col items-center text-center gap-1.5 px-2 py-4">
      <Icon size={18} style={{ color: '#6D5DF6' }} />
      <p className="text-xs font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>{title}</p>
      <p className="text-[10px] leading-tight" style={{ color: 'var(--text-muted)' }}>{sub}</p>
    </div>
  )
}

function MethodTab({ active, onClick, icon: Icon, label, sub }: {
  active: boolean; onClick: () => void; icon: React.ElementType; label: string; sub: string
}) {
  return (
    <button onClick={onClick}
      className="flex-1 flex items-center gap-2.5 rounded-2xl px-3 py-3 transition-all duration-200 relative"
      style={active ? {
        background: 'rgba(109,93,246,0.10)', border: '1px solid rgba(109,93,246,0.5)',
        boxShadow: '0 0 0 3px rgba(109,93,246,0.10)',
      } : { background: 'var(--bg-input)', border: '1px solid var(--border-color)' }}>
      <Icon size={18} style={{ color: active ? '#6D5DF6' : 'var(--text-muted)' }} />
      <div className="text-left flex-1">
        <p className="text-sm font-bold" style={{ color: active ? '#6D5DF6' : 'var(--text-primary)' }}>{label}</p>
        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{sub}</p>
      </div>
      {active && (
        <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
          style={{ background: '#6D5DF6' }}>
          <Check size={12} className="text-white" strokeWidth={3} />
        </span>
      )}
    </button>
  )
}

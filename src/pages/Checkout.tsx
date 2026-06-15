import { useEffect, useRef, useState } from 'react'
import {
  Check, ShieldCheck, ArrowRight, Loader2, CreditCard,
  RefreshCw, Mail, Sparkles, Heart, Lock, Info, Clock,
} from 'lucide-react'
import { COMPLETE_PLAN } from '../lib/plans'
import { supabase } from '../lib/supabase/client'
import { mensagemDeErro } from '../lib/errors'
import { createPublicCheckout } from '../services/subscriptionService'
import { track } from '../lib/analytics'

type FieldErrors = Partial<Record<'name' | 'email' | 'phone' | 'doc', string>>

// Benefícios exibidos na coluna esquerda — copy do guia de redesign (seção 27).
// Mantidos aqui para o tom comercial, sem alterar a fonte da verdade do preço.
const TIMER_KEY = 'destravai_checkout_deadline'
const TIMER_MINUTES = 10

// Retorna o timestamp de expiração, criando-o na sessionStorage se não existir.
function getOrCreateDeadline(): number {
  const stored = sessionStorage.getItem(TIMER_KEY)
  if (stored) {
    const ts = Number(stored)
    if (!isNaN(ts) && ts > Date.now()) return ts
  }
  const ts = Date.now() + TIMER_MINUTES * 60 * 1000
  sessionStorage.setItem(TIMER_KEY, String(ts))
  return ts
}

const CHECKOUT_BENEFITS = [
  'Ideias e roteiros com a Deby AI',
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

// Data da 1ª renovação: hoje + 30 dias (alinha o checkout à cláusula X.5 dos Termos).
function renewalDateLabel() {
  const d = new Date()
  d.setDate(d.getDate() + 30)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
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
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [doc, setDoc] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.floor((getOrCreateDeadline() - Date.now()) / 1000))
  )
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    timerRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.floor((getOrCreateDeadline() - Date.now()) / 1000))
      setSecondsLeft(remaining)
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  // Funil: o usuario chegou na tela de checkout (1 disparo por carregamento).
  useEffect(() => { track('checkout_iniciado') }, [])

  const renewal = renewalDateLabel()

  // Pré-preenche nome/e-mail quando o usuário já está logado (ex.: voltou para
  // assinar). Não sobrescreve o que ele já digitou.
  useEffect(() => {
    let active = true
    supabase.auth.getUser().then(({ data }) => {
      if (!active || !data.user) return
      if (data.user.email) setEmail(prev => prev || data.user!.email!)
      const metaName = (data.user.user_metadata?.name as string | undefined) ?? ''
      if (metaName) setName(prev => prev || metaName)
    }).catch(() => { /* visitante anônimo: segue com os campos vazios */ })
    return () => { active = false }
  }, [])

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
    // Funil: formulario validado e enviado (intencao de pagar, antes de ir ao Asaas).
    track('checkout_preenchido')
    setLoading(true)
    try {
      const res = await createPublicCheckout({
        billingType: 'CREDIT_CARD',
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.replace(/\D/g, ''),
        cpfCnpj: doc.replace(/\D/g, ''),
      })
      if (res.checkoutUrl) {
        window.location.href = res.checkoutUrl
        return
      }
      setError('Não foi possível abrir o pagamento. Tente novamente.')
    } catch (err) {
      setError(mensagemDeErro(err, 'Não foi possível iniciar o pagamento. Tente novamente.'))
    } finally {
      setLoading(false)
    }
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
          Hoje: {formatBRL(COMPLETE_PLAN.firstMonthPrice)} · A partir de {renewal}: {formatBRL(COMPLETE_PLAN.recurringPrice)}/mês · Cancele quando quiser.
        </p>
      </header>

      {/* ── Banner de urgência com contagem regressiva ──────────── */}
      <CountdownBanner seconds={secondsLeft} />

      <div className="grid lg:grid-cols-2 gap-6 items-start">
        {/* ── Coluna esquerda: oferta + confiança ──────────────────── */}
        {/* order-2 no mobile (vem depois do formulário), order-1 no desktop */}
        <aside className="order-2 lg:order-1 space-y-5">
          <div className="checkout-card p-6 relative overflow-hidden">
            <Sparkles size={20} className="absolute right-5 top-5" style={{ color: 'var(--brand)' }} />

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

          {/* Forma de pagamento: cartão de crédito (recorrência automática) */}
          <label className="label">Forma de pagamento</label>
          <div className="flex items-center gap-2.5 rounded-2xl px-3 py-3 mb-4"
            style={{ background: 'rgba(109,93,246,0.10)', border: '1px solid rgba(109,93,246,0.5)' }}>
            <CreditCard size={18} style={{ color: '#6D5DF6' }} />
            <div className="text-left flex-1">
              <p className="text-sm font-bold" style={{ color: '#6D5DF6' }}>Cartão de crédito</p>
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Renovação automática mensal</p>
            </div>
            <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: '#6D5DF6' }}>
              <Check size={12} className="text-white" strokeWidth={3} />
            </span>
          </div>

          {/* Aviso de redirecionamento do cartão (ambiente seguro do Asaas). */}
          <div className="rounded-xl px-4 py-3 mb-4 flex items-start gap-2 text-xs"
            style={{ background: 'rgba(109,93,246,0.06)', border: '1px solid rgba(109,93,246,0.18)', color: 'var(--text-secondary)' }}>
            <Info size={15} className="flex-shrink-0 mt-0.5" style={{ color: '#6D5DF6' }} />
            Você será direcionado ao ambiente seguro do Asaas para informar os dados do cartão.
          </div>

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
            <div className="text-center text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Hoje você paga {formatBRL(COMPLETE_PLAN.firstMonthPrice)}. A partir de {renewal}, a assinatura
              renova automaticamente por {formatBRL(COMPLETE_PLAN.recurringPrice)}/mês até você cancelar.
            </div>
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

function CountdownBanner({ seconds }: { seconds: number }) {
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss = String(seconds % 60).padStart(2, '0')
  const expired = seconds === 0

  return (
    <div className="rounded-2xl px-4 py-3 mb-6 flex items-center justify-center gap-3"
      style={expired
        ? { background: '#B91C1C', border: '1px solid #991B1B' }
        : { background: '#DC2626', border: '1px solid #B91C1C' }}>
      <Clock size={16} style={{ color: '#fff', flexShrink: 0 }} />
      {expired ? (
        <span className="text-sm font-bold text-white">
          Oferta expirada — recarregue a página para uma nova sessão
        </span>
      ) : (
        <span className="text-sm font-semibold text-white">
          Oferta de lançamento expira em{' '}
          <span className="font-extrabold tabular-nums">{mm}:{ss}</span>
        </span>
      )}
    </div>
  )
}

// Casca da página com tema claro premium e orbs suaves de fundo (guia, seção 26).
function Shell({ children, narrow = false }: { children: React.ReactNode; narrow?: boolean }) {
  return (
    <div data-theme="light" className="w-full" style={{
      height: '100svh', overflowY: 'auto',
      background: 'var(--bg-base)',
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

import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Check, ShieldCheck, ArrowRight, Loader2, QrCode, CreditCard,
  Copy, CheckCircle2, Sparkles, ArrowUpRight,
} from 'lucide-react'
import { PLANS as STATIC_PLANS, GUARANTEE_DAYS } from '../lib/plans'
import {
  fetchPlans, createPublicCheckout, getCheckoutStatus,
  type PublicPlan, type CheckoutResult,
} from '../services/subscriptionService'

type Step = 'form' | 'pix' | 'success'
type Method = 'PIX' | 'CREDIT_CARD'

// Planos estáticos servem de fallback enquanto a API responde.
const FALLBACK: PublicPlan[] = STATIC_PLANS.map(p => ({
  id: p.id, name: p.name, tagline: p.tagline, price: p.price,
  features: p.features, highlight: !!p.highlight,
}))

function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// Máscara leve de CPF/CNPJ conforme o tamanho.
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
  const [params] = useSearchParams()

  const [plans, setPlans] = useState<PublicPlan[]>(FALLBACK)
  const [selectedId, setSelectedId] = useState<string>(params.get('plan') || 'starter')
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

  // Carrega planos da API (fonte da verdade); mantém fallback se falhar.
  useEffect(() => {
    fetchPlans()
      .then(p => { if (p?.length) setPlans(p) })
      .catch(() => { /* mantém fallback */ })
  }, [])

  // Garante que o plano selecionado existe na lista carregada.
  useEffect(() => {
    if (plans.length && !plans.some(p => p.id === selectedId)) {
      setSelectedId(plans[0].id)
    }
  }, [plans]) // eslint-disable-line

  const selected = useMemo(
    () => plans.find(p => p.id === selectedId) ?? plans[0],
    [plans, selectedId],
  )
  const pro = useMemo(() => plans.find(p => p.id === 'pro'), [plans])
  const maxPrice = useMemo(() => plans.reduce((m, p) => Math.max(m, p.price), 0), [plans])
  // Só oferece upgrade para o Pro quando o plano escolhido é MAIS BARATO que ele
  // (ex.: Starter). Se já escolheu o plano mais alto (Expert), parabeniza.
  const showProUpsell = !!pro && !!selected && selected.price < pro.price
  const isTopPlan = !!selected && plans.length > 1 && selected.price >= maxPrice

  // Polling do Pix: confirma o pagamento e avança para a tela de sucesso.
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
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Informe um e-mail válido.'
    const cleanDoc = doc.replace(/\D/g, '')
    if (cleanDoc.length !== 11 && cleanDoc.length !== 14) return 'Informe um CPF ou CNPJ válido.'
    return ''
  }

  const handleSubmit = async () => {
    const v = validate()
    if (v) { setError(v); return }
    setError('')
    setLoading(true)
    try {
      const res = await createPublicCheckout({
        planId: selectedId,
        billingType: method,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.replace(/\D/g, ''),
        cpfCnpj: doc.replace(/\D/g, ''),
      })
      setResult(res)
      if (res.method === 'card' && res.checkoutUrl) {
        // Cartão: o cliente preenche os dados na página segura do Asaas.
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
    } catch { /* clipboard pode falhar em http; usuário copia manualmente */ }
  }

  // ── Tela de sucesso ───────────────────────────────────────────────────
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
            Seu acesso ao Destravaí foi liberado.
          </p>
          <p className="text-sm mb-8" style={{ color: 'var(--text-secondary)' }}>
            Enviamos um e-mail para <strong style={{ color: 'var(--text-primary)' }}>{email}</strong> com
            o link para você <strong>criar sua senha</strong> e entrar.
          </p>
          <button onClick={() => navigate('/login')} className="btn-primary w-full py-4 text-base">
            Acessar Destravaí <ArrowRight size={18} />
          </button>
          <p className="text-xs mt-4" style={{ color: 'var(--text-muted)' }}>
            Não recebeu? Verifique a caixa de spam ou use “Esqueci a senha” na tela de login.
          </p>
        </div>
      </Shell>
    )
  }

  // ── Tela do Pix (QR + copia e cola) ───────────────────────────────────
  if (step === 'pix' && result?.pix) {
    return (
      <Shell>
        <div className="text-center">
          <div className="inline-flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full mb-4"
            style={{ background: 'rgba(124,92,255,0.15)', border: '1px solid rgba(124,92,255,0.3)', color: '#A78BFA' }}>
            <QrCode size={13} /> Pague com Pix
          </div>
          <h1 className="text-xl font-extrabold mb-1" style={{ color: 'var(--text-primary)' }}>
            {selected?.name} · {selected && formatBRL(selected.price)}/mês
          </h1>
          <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>
            Escaneie o QR Code ou copie o código abaixo no app do seu banco.
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
              Aguardando confirmação do pagamento...
            </span>
          </div>

          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Após o pagamento, seu acesso será liberado automaticamente e você
            receberá um e-mail para criar sua senha.
          </p>
        </div>
      </Shell>
    )
  }

  // ── Tela principal do checkout (formulário) ───────────────────────────
  return (
    <Shell>
      <div className="text-center mb-6">
        <img src="/destravai-logo-completa.png" alt="Destravaí" className="h-16 mx-auto mb-3"
          style={{ filter: 'drop-shadow(0 0 24px rgba(124,92,255,0.4))' }} />
        <h1 className="text-xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          Finalize sua assinatura
        </h1>
        <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
          {GUARANTEE_DAYS} dias de garantia. Cancele dentro do prazo se não fizer sentido.
        </p>
      </div>

      {/* Resumo do plano */}
      {selected && (
        <div className="rounded-3xl p-5 mb-4 relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(124,92,255,0.16), rgba(167,139,250,0.06))',
            border: '1px solid rgba(124,92,255,0.4)',
          }}>
          <div className="flex items-center justify-between mb-2">
            <span className="font-extrabold text-lg" style={{ color: '#A78BFA' }}>{selected.name}</span>
            <span className="font-extrabold text-xl" style={{ color: 'var(--text-primary)' }}>
              {formatBRL(selected.price)}<span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>/mês</span>
            </span>
          </div>
          <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>{selected.tagline}</p>
          <ul className="space-y-1.5">
            {selected.features.map(f => (
              <li key={f} className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <Check size={13} style={{ color: '#53D6A1' }} /> {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Upsell discreto para o Pro (só quando o plano é mais barato que ele) */}
      {showProUpsell && pro && (
        <button onClick={() => setSelectedId('pro')}
          className="w-full text-left rounded-2xl p-4 mb-4 transition-all duration-200"
          style={{ background: 'var(--bg-card)', border: '1px dashed rgba(124,92,255,0.4)' }}>
          <div className="flex items-center gap-2 mb-1.5">
            <Sparkles size={14} style={{ color: '#F7B955' }} />
            <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              Quer mais por {formatBRL(pro.price - (selected?.price ?? 0))}/mês a mais?
            </span>
          </div>
          <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>
            O <strong>Pro</strong> inclui biblioteca de conteúdos, CTAs personalizados e legendas
            geradas por IA — o que ajuda quem quer constância de verdade.
          </p>
          <span className="inline-flex items-center gap-1 text-xs font-bold" style={{ color: '#A78BFA' }}>
            Mudar para o Pro <ArrowUpRight size={13} />
          </span>
        </button>
      )}

      {/* Já escolheu o plano mais completo: parabeniza em vez de oferecer upgrade */}
      {!showProUpsell && isTopPlan && (
        <div className="rounded-2xl p-4 mb-4"
          style={{ background: 'rgba(83,214,161,0.08)', border: '1px solid rgba(83,214,161,0.25)' }}>
          <div className="flex items-center gap-2 mb-1.5">
            <Sparkles size={14} style={{ color: '#53D6A1' }} />
            <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              Excelente escolha! Você foi no plano mais completo.
            </span>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Com o <strong>{selected?.name}</strong> você tem tudo para manter constância de verdade
            e escalar sua presença — sem limites te travando.
          </p>
        </div>
      )}

      {/* Outros planos (trocar) */}
      <div className="flex gap-2 mb-5">
        {plans.map(p => {
          const active = p.id === selectedId
          return (
            <button key={p.id} onClick={() => setSelectedId(p.id)}
              className="flex-1 rounded-2xl px-2 py-2.5 text-center transition-all duration-200"
              style={active ? {
                background: 'rgba(124,92,255,0.18)', border: '1px solid rgba(124,92,255,0.5)',
              } : { background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
              <p className="text-xs font-bold" style={{ color: active ? '#A78BFA' : 'var(--text-primary)' }}>{p.name}</p>
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{formatBRL(p.price)}</p>
            </button>
          )
        })}
      </div>

      {/* Dados do cliente */}
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
            É neste e-mail que você vai receber o acesso. Confira com atenção.
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
            onChange={e => setDoc(maskDocument(e.target.value))} placeholder="Somente números" />
          <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
            Exigido pelo provedor de pagamento para emitir a cobrança.
          </p>
        </div>
      </div>

      {/* Forma de pagamento */}
      <label className="label">Forma de pagamento</label>
      <div className="flex gap-2 mb-5">
        <MethodTab active={method === 'PIX'} onClick={() => setMethod('PIX')} icon={QrCode} label="Pix" sub="Aprovação na hora" />
        <MethodTab active={method === 'CREDIT_CARD'} onClick={() => setMethod('CREDIT_CARD')} icon={CreditCard} label="Cartão" sub="Crédito" />
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
          : <>Assinar agora · {selected && formatBRL(selected.price)}/mês <ArrowRight size={18} /></>}
      </button>

      <div className="flex items-center justify-center gap-2 mt-4 text-xs" style={{ color: 'var(--text-muted)' }}>
        <ShieldCheck size={13} style={{ color: '#53D6A1' }} />
        Pagamento processado com segurança · Garantia de {GUARANTEE_DAYS} dias
      </div>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  // min-h + rolagem natural do documento: garante que o formulário inteiro
  // seja alcançável no mobile (sem ficar preso num container de altura fixa).
  return (
    <div className="min-h-[100svh] w-full" style={{ background: '#0B0B12' }}>
      <div className="max-w-md mx-auto px-5 py-8 pb-20">{children}</div>
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

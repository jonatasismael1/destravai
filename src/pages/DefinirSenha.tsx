import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase/client'
import { mensagemDeErro } from '../lib/errors'
import { Eye, EyeOff, Loader2, KeyRound, CheckCircle2, ArrowRight } from 'lucide-react'

// Página de destino do link de e-mail (recovery/convite). O cliente Supabase
// detecta o token na URL (detectSessionInUrl) e cria uma sessão de recuperação;
// aqui o usuário define a própria senha. Vale tanto para conta nova quanto para
// redefinição posterior.

export default function DefinirSenha() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [hasSession, setHasSession] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  // Motivo do link ter falhado (expirado/usado), quando vem na URL.
  const [linkErro, setLinkErro] = useState('')
  // Reenvio de link na propria tela (sem mandar a pessoa de volta ao login).
  const [resendEmail, setResendEmail] = useState('')
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)

  // Aguarda o Supabase processar o token do link e estabelecer a sessão.
  useEffect(() => {
    const url = new URL(window.location.href)

    // 1) Fluxo token_hash (verifyOtp): link mais robusto, resistente a scanners de
    //    e-mail que abrem o link antes do usuario. Usado se o template de e-mail
    //    apontar para /definir-senha?token_hash=...&type=recovery.
    const tokenHash = url.searchParams.get('token_hash')
    const otpType = url.searchParams.get('type')
    if (tokenHash) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase.auth.verifyOtp({ token_hash: tokenHash, type: (otpType || 'recovery') as any })
        .then(({ data, error }) => {
          setHasSession(!!data?.session && !error)
          if (error) setLinkErro('Esse link expirou ou já foi usado.')
          setReady(true)
        })
      return
    }

    // 2) Erro explicito vindo na URL (hash ou query): link expirado/usado.
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const errCode = url.searchParams.get('error_code') || hashParams.get('error_code')
    const errDesc = url.searchParams.get('error') || hashParams.get('error')
    if (errCode || errDesc) {
      setLinkErro(/expired|otp/i.test(`${errCode} ${errDesc}`)
        ? 'Esse link expirou ou já foi usado.'
        : 'Não foi possível validar o link.')
      setHasSession(false)
      setReady(true)
      return
    }

    // 3) Fluxo implicito (detectSessionInUrl coloca a sessao no hash).
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(!!session)
      setReady(true)
    })
    // Caso a sessão já exista (token processado antes do listener montar).
    supabase.auth.getSession().then(({ data: { session } }) => {
      setHasSession(!!session)
      setReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Reenvia o link de definir/recuperar senha para o e-mail informado.
  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault()
    const mail = resendEmail.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) { setError('Digite um e-mail válido.'); return }
    setError('')
    setResending(true)
    try {
      const { error: resendErr } = await supabase.auth.resetPasswordForEmail(mail, {
        redirectTo: `${window.location.origin}/definir-senha`,
      })
      if (resendErr) throw resendErr
      setResent(true)
    } catch (err) {
      setError(mensagemDeErro(err, 'Não foi possível reenviar o link. Tente novamente.'))
    } finally {
      setResending(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('A senha deve ter ao menos 8 caracteres.'); return }
    if (password !== confirm) { setError('As senhas não conferem.'); return }
    setLoading(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError
      setDone(true)
    } catch (err) {
      setError(mensagemDeErro(err, 'Não foi possível salvar a senha. Tente novamente.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="overflow-y-auto" style={{ height: '100svh', background: 'var(--bg-base)' }}>
      <div className="flex flex-col items-center justify-center min-h-full p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <img src="/destravai-logo-completa.png" alt="Destravaí" className="h-16 mx-auto mb-4" />
        </div>

        {!ready ? (
          <div className="text-center py-10">
            <Loader2 size={28} className="animate-spin mx-auto" style={{ color: 'var(--brand)' }} />
          </div>
        ) : done ? (
          <div className="glass p-6 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 mx-auto"
              style={{ background: 'var(--success)' }}>
              <CheckCircle2 size={26} className="text-white" />
            </div>
            <h1 className="text-xl font-extrabold mb-2" style={{ color: 'var(--text-primary)' }}>Senha criada!</h1>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
              Tudo pronto. Agora é só entrar e começar a destravar seus stories.
            </p>
            <div className="rounded-xl px-4 py-3 mb-6 text-sm" style={{ background: 'var(--brand-soft)', border: '1px solid var(--brand-border)' }}>
              <p style={{ color: 'var(--text-secondary)' }}>
                Acesse sempre pelo endereço:
              </p>
              <p className="font-extrabold mt-0.5" style={{ color: 'var(--brand)' }}>destravai.dbe.digital</p>
            </div>
            <button onClick={() => navigate('/')} className="btn-primary w-full py-3.5">
              Entrar no app <ArrowRight size={18} />
            </button>
          </div>
        ) : !hasSession ? (
          resent ? (
            <div className="glass p-6 text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 mx-auto"
                style={{ background: 'var(--success)' }}>
                <CheckCircle2 size={26} className="text-white" />
              </div>
              <h1 className="text-xl font-extrabold mb-2" style={{ color: 'var(--text-primary)' }}>Link enviado!</h1>
              <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                Enviamos um novo link para <strong style={{ color: 'var(--brand)' }}>{resendEmail.trim().toLowerCase()}</strong>.
                Abra o e-mail e clique <strong>logo após receber</strong> (o link expira e é de uso único).
              </p>
              <button onClick={() => navigate('/login')} className="btn-secondary w-full py-3.5">
                Ir para o login
              </button>
            </div>
          ) : (
            <div className="glass p-6">
              <h1 className="text-xl font-extrabold mb-2 text-center" style={{ color: 'var(--text-primary)' }}>
                {linkErro || 'Link inválido ou expirado'}
              </h1>
              <p className="text-sm mb-5 text-center" style={{ color: 'var(--text-secondary)' }}>
                Sem problema — digite seu e-mail que enviamos um novo link na hora.
              </p>
              <form onSubmit={handleResend} className="space-y-3">
                <input type="email" className="input" placeholder="Seu e-mail"
                  value={resendEmail} onChange={e => { setResendEmail(e.target.value); setError('') }} autoFocus />
                {error && (
                  <div className="rounded-xl px-4 py-3 text-sm font-semibold"
                    style={{ background: 'rgba(255,122,107,0.1)', border: '1px solid rgba(255,122,107,0.2)', color: '#FF7A6B' }}>
                    {error}
                  </div>
                )}
                <button type="submit" disabled={resending} className="btn-primary w-full py-3.5 disabled:opacity-50">
                  {resending ? <Loader2 size={18} className="animate-spin" /> : <>Enviar novo link <ArrowRight size={18} /></>}
                </button>
              </form>
              <button onClick={() => navigate('/login')} className="btn-secondary w-full py-3 mt-3">
                Voltar ao login
              </button>
            </div>
          )
        ) : (
          <div className="glass p-6">
            <div className="flex items-center gap-2 mb-1">
              <KeyRound size={18} style={{ color: 'var(--brand)' }} />
              <h1 className="text-xl font-extrabold" style={{ color: 'var(--text-primary)' }}>Crie sua senha</h1>
            </div>
            <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
              Defina a senha que você vai usar para entrar no Destravaí.
            </p>
            <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>
              Depois é só acessar por <strong style={{ color: 'var(--brand)' }}>destravai.dbe.digital</strong> com o seu e-mail e esta senha.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Nova senha</label>
                <div className="relative">
                  <input type={show ? 'text' : 'password'} className="input pr-12"
                    placeholder="Mínimo 8 caracteres" value={password} onChange={e => setPassword(e.target.value)} />
                  <button type="button" onClick={() => setShow(!show)}
                    className="absolute right-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}
                    aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}>
                    {show ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="label">Confirmar senha</label>
                <input type={show ? 'text' : 'password'} className="input"
                  placeholder="Repita a senha" value={confirm} onChange={e => setConfirm(e.target.value)} />
              </div>

              {error && (
                <div className="rounded-xl px-4 py-3 text-sm font-semibold"
                  style={{ background: 'rgba(255,122,107,0.1)', border: '1px solid rgba(255,122,107,0.2)', color: '#FF7A6B' }}>
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading} className="btn-primary w-full py-3.5 disabled:opacity-50">
                {loading ? <Loader2 size={18} className="animate-spin" /> : <>Salvar senha <ArrowRight size={18} /></>}
              </button>
            </form>
          </div>
        )}
      </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { supabase } from '../lib/supabase/client'
import { Link } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff, Zap, Video, Sparkles } from 'lucide-react'

type Mode = 'login' | 'register'

const BENEFITS = [
  { icon: Zap, label: 'Roteiro pronto em 30s', color: '#FFB547' },
  { icon: Video, label: 'Teleprompter integrado', color: '#7C5CFF' },
  { icon: Sparkles, label: 'Deby AI personalizada pro seu jeito', color: '#A78BFA' },
]

export default function Login() {
  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // Mensagem de sucesso/informativa (e-mail enviado, confirme seu e-mail, etc.)
  const [notice, setNotice] = useState('')

  // Escape hatch: se o login travar (sessão/cache corrompido no PWA), o usuário
  // limpa o estado local e recarrega — costuma resolver na hora.
  const handleClearSession = async () => {
    try { await supabase.auth.signOut() } catch { /* ignora */ }
    try { localStorage.clear() } catch { /* ignora */ }
    window.location.reload()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setNotice('')

    if (!email || !password) { setError('Preencha todos os campos.'); return }
    if (mode === 'register' && !name) { setError('Digite seu nome.'); return }
    // No CADASTRO exigimos senha mais forte (mín. 8). No LOGIN não validamos tamanho:
    // quem já tem uma senha curta antiga precisa continuar conseguindo entrar.
    if (mode === 'register' && password.length < 8) { setError('A senha deve ter ao menos 8 caracteres.'); return }

    setLoading(true)
    try {
      if (mode === 'register') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          // emailRedirectTo: para onde o link de confirmação leva (se a confirmação
          // de e-mail estiver ativa no Supabase). Volta para a raiz do app já logado.
          options: { data: { name }, emailRedirectTo: `${window.location.origin}/` },
        })
        if (signUpError) throw signUpError

        // Se a confirmação de e-mail estiver ATIVA, ainda não há sessão: avisamos
        // o usuário para confirmar pelo e-mail. Se estiver desativada, a sessão já
        // vem pronta e o AppContext redireciona normalmente.
        if (!data.session) {
          setNotice(`Enviamos um e-mail de confirmação para ${email}. Confirme para entrar.`)
          return
        }
        // Sessão criada: o AppContext (onAuthStateChange) carrega profile/essência
        // e cuida do redirecionamento. Não fazemos chamadas extras aqui para não
        // disputar o lock de auth do Supabase logo após o login (causava travamento
        // no mobile/PWA).
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) {
          if (signInError.message.includes('Invalid login credentials')) {
            throw new Error('E-mail ou senha incorretos.')
          }
          throw signInError
        }
        // Login OK: o AppContext detecta a sessão e redireciona. Sem chamadas extras.
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao autenticar. Tente novamente.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="relative overflow-y-auto"
      style={{ height: '100svh', background: 'var(--bg-base)' }}
    >
      {/* Centraliza quando cabe na tela; rola quando o conteúdo (modo "criar conta")
          é mais alto que a tela. min-h-full dentro de um container de ALTURA FIXA
          é o que permite rolar até o fim sem cortar o campo de senha. */}
      <div className="flex flex-col items-center justify-center min-h-full p-6">
      <div className="w-full max-w-sm relative z-10 animate-fade-up">

        {/* ── Hero / Pitch ────────────────────────────────── */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-6 animate-float">
            <img
              src="/destravai-logo-completa.png"
              alt="Destravaí"
              className="h-28 w-auto max-w-[240px]"
            />
          </div>

          {/* Headline principal — só aparece no modo registro (pitch de venda) */}
          {mode === 'register' ? (
            <>
              <h1 className="text-2xl font-extrabold tracking-tight leading-tight mb-2"
                style={{ color: 'var(--text-primary)' }}>
                Pare de travar<br />
                <span className="gradient-text">nos stories.</span>
              </h1>
              <p className="text-sm font-medium leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Escolha o momento, receba o roteiro, grave e poste.<br />
                Sem tela em branco. Sem enrolar.
              </p>

              {/* Benefícios com ícones vetoriais */}
              <div className="flex flex-col gap-2 mt-5 text-left">
                {BENEFITS.map(({ icon: Icon, label, color }) => (
                  <div key={label} className="list-item">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
                      <Icon size={15} style={{ color }} />
                    </div>
                    <span className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>{label}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              Stories prontos para você gravar sem travar.
            </p>
          )}
        </div>

        {/* ── Card do formulário ───────────────────────────── */}
        <div className="glass p-6">
          {/* Tab switcher — segmented control nativo */}
          <div className="segmented-control mb-6">
            {(['login', 'register'] as Mode[]).map(m => (
              <button
                key={m}
                type="button"
                data-active={mode === m}
                onClick={() => { setMode(m); setError(''); setNotice('') }}
              >
                {m === 'login' ? 'Entrar' : 'Criar conta'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="label">Seu nome</label>
                <input type="text" className="input" placeholder="Como quer ser chamado(a)?"
                  value={name} onChange={e => setName(e.target.value)} />
              </div>
            )}
            <div>
              <label className="label">E-mail</label>
              <input type="email" className="input" placeholder="seu@email.com"
                value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="label">Senha</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  className="input pr-12"
                  placeholder={mode === 'register' ? 'Mínimo 8 caracteres' : 'Sua senha'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                  aria-label={showPass ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div
                className="rounded-xl px-4 py-3 text-sm font-semibold"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: 'var(--danger)' }}
              >
                {error}
              </div>
            )}

            {notice && (
              <div
                className="rounded-xl px-4 py-3 text-sm font-semibold"
                style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', color: 'var(--success)' }}
              >
                {notice}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full mt-2 text-base"
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  {mode === 'login' ? 'Entrar' : 'Destravar meus stories'}
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          {mode === 'login' && (
            <p className="text-center text-xs mt-4" style={{ color: 'var(--text-muted)' }}>
              Esqueceu a senha?{' '}
              <button
                type="button"
                className="font-bold"
                style={{ color: 'var(--brand)' }}
                onClick={async () => {
                  setError(''); setNotice('')
                  if (!email) { setError('Digite seu e-mail acima primeiro.'); return }
                  // redirectTo precisa estar na lista de Redirect URLs do Supabase.
                  // É a página onde o usuário define a nova senha (/definir-senha).
                  const { error } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: `${window.location.origin}/definir-senha`,
                  })
                  if (error) setError('Erro ao enviar o e-mail de recuperação. Tente novamente.')
                  else setNotice('Enviamos um e-mail com o link para você redefinir sua senha.')
                }}
              >
                Recuperar
              </button>
            </p>
          )}
        </div>

        {/* ── Rodapé de confiança ──────────────────────────── */}
        <p className="text-center text-xs mt-6" style={{ color: 'var(--text-muted)' }}>
          R$9,90 no primeiro mês · Depois R$49,90/mês · Cancele quando quiser
        </p>

        {/* Links legais */}
        <p className="text-center text-[11px] mt-3" style={{ color: 'var(--text-muted)' }}>
          Ao continuar, você concorda com os{' '}
          <Link to="/termos" className="font-semibold underline" style={{ color: 'var(--brand)' }}>Termos de Uso</Link>
          {' '}e a{' '}
          <Link to="/privacidade" className="font-semibold underline" style={{ color: 'var(--brand)' }}>Política de Privacidade</Link>.
        </p>

        <p className="text-center text-[11px] mt-4" style={{ color: 'var(--text-muted)' }}>
          Travou ao entrar?{' '}
          <button type="button" onClick={handleClearSession} className="font-semibold underline" style={{ color: 'var(--brand)' }}>
            Limpar sessão e recarregar
          </button>
        </p>
      </div>
      </div>
    </div>
  )
}

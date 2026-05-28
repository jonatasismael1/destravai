import { useState } from 'react'
import { supabase } from '../lib/supabase/client'
import { useApp } from '../context/AppContext'
import { getCurrentProfile } from '../services/profileService'
import { ArrowRight, Eye, EyeOff, Zap, Video, Sparkles } from 'lucide-react'

type Mode = 'login' | 'register'

const BENEFITS = [
  { icon: Zap, label: 'Roteiro pronto em 30s', color: '#FFB547' },
  { icon: Video, label: 'Teleprompter integrado', color: '#7C5CFF' },
  { icon: Sparkles, label: 'IA personalizada pro seu jeito', color: '#A78BFA' },
]

export default function Login() {
  const { setProfile } = useApp()
  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email || !password) { setError('Preencha todos os campos.'); return }
    if (mode === 'register' && !name) { setError('Digite seu nome.'); return }
    if (password.length < 6) { setError('A senha deve ter ao menos 6 caracteres.'); return }

    setLoading(true)
    try {
      if (mode === 'register') {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name } },
        })
        if (signUpError) throw signUpError

        await new Promise(r => setTimeout(r, 800))
        const profile = await getCurrentProfile()
        if (profile) setProfile(profile)
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) {
          if (signInError.message.includes('Invalid login credentials')) {
            throw new Error('E-mail ou senha incorretos.')
          }
          throw signInError
        }

        const profile = await getCurrentProfile()
        if (profile) setProfile(profile)
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
      className="flex flex-col items-center justify-center p-6 relative overflow-y-auto"
      style={{ minHeight: '100svh', background: '#0B0B12' }}
    >
      {/* Background orbs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-20 -right-20 w-[380px] h-[380px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(124,92,255,0.22) 0%, transparent 65%)', filter: 'blur(60px)' }} />
        <div className="absolute -bottom-20 -left-20 w-[300px] h-[300px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(255,181,71,0.12) 0%, transparent 65%)', filter: 'blur(60px)' }} />
      </div>

      <div className="w-full max-w-sm relative z-10 animate-fade-up">

        {/* ── Hero / Pitch ────────────────────────────────── */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-6 animate-float">
            <img
              src="/destravai-logo-completa.png"
              alt="Destravaí"
              className="h-36 w-auto max-w-[280px]"
              style={{ filter: 'drop-shadow(0 0 28px rgba(124,92,255,0.5))' }}
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
                  <div key={label} className="flex items-center gap-3 px-3 py-2.5 rounded-2xl"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
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
          {/* Tab switcher */}
          <div
            className="flex p-1 mb-6 rounded-2xl gap-1"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
          >
            {(['login', 'register'] as Mode[]).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError('') }}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all duration-300"
                style={mode === m ? {
                  background: 'linear-gradient(135deg, rgba(124,92,255,0.4), rgba(167,139,250,0.3))',
                  color: '#A78BFA',
                  border: '1px solid rgba(124,92,255,0.3)',
                  boxShadow: '0 0 16px rgba(124,92,255,0.2)',
                } : {
                  color: 'var(--text-muted)',
                }}
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
                  placeholder="Mínimo 6 caracteres"
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
                style={{ background: 'rgba(255,122,107,0.1)', border: '1px solid rgba(255,122,107,0.2)', color: '#FF7A6B' }}
              >
                {error}
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
                className="font-bold"
                style={{ color: '#A78BFA' }}
                onClick={async () => {
                  if (!email) { setError('Digite seu e-mail acima primeiro.'); return }
                  const { error } = await supabase.auth.resetPasswordForEmail(email)
                  if (error) setError('Erro ao enviar e-mail de recuperação.')
                  else setError('')
                  alert('E-mail de recuperação enviado!')
                }}
              >
                Recuperar
              </button>
            </p>
          )}
        </div>

        {/* ── Rodapé de confiança ──────────────────────────── */}
        <p className="text-center text-xs mt-6" style={{ color: 'var(--text-muted)' }}>
          Grátis para começar · Sem cartão de crédito
        </p>
      </div>
    </div>
  )
}

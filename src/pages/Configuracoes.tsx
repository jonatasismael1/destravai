import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { useToast } from '../context/ToastContext'
import { useTheme } from '../context/ThemeContext'
import {
  User, Bell, LogOut, ChevronRight, Shield,
  Sparkles, Star, CheckCircle, AlertCircle, Sun, Moon, RefreshCw, TrendingUp,
  KeyRound, CreditCard, LifeBuoy, Loader2,
} from 'lucide-react'
import { deleteDailyCheckin, toISODateKey } from '../services/userJourneyService'
import { supabase } from '../lib/supabase/client'

const SUPPORT_EMAIL = 'assessoriadbe@gmail.com'

function SectionHeader({ title }: { title: string }) {
  return (
    <p className="text-[10px] font-black uppercase tracking-widest px-1 mb-2" style={{ color: 'var(--text-muted)' }}>
      {title}
    </p>
  )
}

function MenuItem({
  icon: Icon, label, sublabel, onClick, danger = false, right,
}: {
  icon: React.ElementType; label: string; sublabel?: string; onClick?: () => void; danger?: boolean; right?: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-4 rounded-2xl text-left transition-all duration-200 active:scale-[0.98]"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={danger ? {
          background: 'rgba(255,122,107,0.12)', border: '1px solid rgba(255,122,107,0.2)',
        } : {
          background: 'rgba(109,93,246,0.12)', border: '1px solid rgba(109,93,246,0.2)',
        }}
      >
        <Icon size={17} style={{ color: danger ? '#FF7A6B' : '#9B8CFF' }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm" style={{ color: danger ? '#FF7A6B' : 'var(--text-primary)' }}>{label}</p>
        {sublabel && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{sublabel}</p>}
      </div>
      {right ?? <ChevronRight size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
    </button>
  )
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="relative w-12 h-6 rounded-full flex-shrink-0 transition-all duration-300"
      style={{
        background: value
          ? 'linear-gradient(135deg, #6D5DF6, #9B8CFF)'
          : 'rgba(255,255,255,0.1)',
        boxShadow: value ? '0 0 12px rgba(109,93,246,0.5)' : 'none',
      }}
    >
      <span
        className="absolute top-0.5 w-5 h-5 rounded-full transition-all duration-300"
        style={{
          background: '#fff',
          left: value ? '26px' : '2px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
        }}
      />
    </button>
  )
}

export default function Configuracoes() {
  const { state, logout } = useApp()
  const { addToast } = useToast()
  const navigate = useNavigate()
  const { isDark, toggleTheme } = useTheme()

  const [notifDaily, setNotifDaily] = useState(true)
  const [notifTips, setNotifTips] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [showResetDayConfirm, setShowResetDayConfirm] = useState(false)

  // Alterar senha (usuário logado: o Supabase não exige a senha atual).
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  const handleChangePassword = async () => {
    if (newPassword.length < 6) { addToast('A senha deve ter ao menos 6 caracteres.', 'error'); return }
    if (newPassword !== confirmPassword) { addToast('As senhas não conferem.', 'error'); return }
    setSavingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      addToast('Senha alterada com sucesso!', 'success')
      setNewPassword(''); setConfirmPassword(''); setShowPasswordForm(false)
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Erro ao alterar a senha.', 'error')
    } finally {
      setSavingPassword(false)
    }
  }

  const profile = state.profile
  const supabaseUser = state.supabaseUser
  const subscription = state.subscription
  const planLabel = state.subscriptionLoading
    ? 'Carregando plano'
    : subscription?.hasSubscription
      ? (subscription.planName ?? 'Plano ativo')
      : 'Sem assinatura ativa'
  const planDescription = subscription?.hasAccess
    ? `Acesso liberado${subscription.price ? ` · R$ ${subscription.price}/mês` : ''}`
    : 'Escolha um plano para liberar os recursos pagos'
  const planBadge = subscription?.hasAccess ? 'Ativo' : 'Pendente'

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  const handleSaveNotifs = () => {
    addToast('Preferências salvas!', 'success')
  }

  const handleResetDay = async () => {
    const key = toISODateKey()
    await deleteDailyCheckin(key).catch(err => console.error('[Configuracoes reset day]', err))
    setShowResetDayConfirm(false)
    addToast('Missão do dia reiniciada!', 'success')
  }

  return (
    <div className="p-5 space-y-6 pb-28">
      <div className="pt-4">
        <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>Configurações</h1>
        <p className="text-sm mt-1 font-medium" style={{ color: 'var(--text-secondary)' }}>
          Gerencie seu perfil e preferências.
        </p>
      </div>

      {/* Profile card */}
      <div
        className="relative rounded-3xl p-5 overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(109,93,246,0.15), rgba(155,140,255,0.07))',
          border: '1px solid rgba(109,93,246,0.25)',
          boxShadow: '0 0 40px rgba(109,93,246,0.1)',
        }}
      >
        <div className="absolute top-0 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(109,93,246,0.6), transparent)' }} />

        <div className="flex items-center gap-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 font-black text-2xl"
            style={{
              background: 'linear-gradient(135deg, #6D5DF6, #9B8CFF)',
              boxShadow: '0 0 24px rgba(109,93,246,0.5)',
            }}
          >
            {(profile?.name ?? supabaseUser?.email ?? '?').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-extrabold text-lg leading-tight" style={{ color: 'var(--text-primary)' }}>{profile?.name ?? 'Usuário'}</p>
            <p className="text-sm mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>{supabaseUser?.email ?? profile?.email ?? '—'}</p>
            {profile?.profession && (
              <span
                className="inline-block mt-1.5 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(109,93,246,0.2)', border: '1px solid rgba(109,93,246,0.3)', color: '#9B8CFF' }}
              >
                {profile.profession}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Plan */}
      <div>
        <SectionHeader title="Plano" />
        <div
          className="rounded-2xl p-4"
          style={{ background: 'rgba(247,185,85,0.07)', border: '1px solid rgba(247,185,85,0.2)' }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(247,185,85,0.15)', border: '1px solid rgba(247,185,85,0.25)' }}>
                <Star size={17} style={{ color: '#F7B955' }} />
              </div>
              <div>
                <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{planLabel}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{planDescription}</p>
              </div>
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(247,185,85,0.15)', border: '1px solid rgba(247,185,85,0.3)', color: '#F7B955' }}>
              {planBadge}
            </span>
          </div>

          <div className="mt-3 flex items-start gap-2">
            <CheckCircle size={13} style={{ color: '#53D6A1', flexShrink: 0, marginTop: 1 }} />
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              As gerações usam a configuração de IA do projeto. Chaves e integrações sensíveis ficam fora da interface do cliente.
            </p>
          </div>
        </div>

        <div className="mt-2">
          <MenuItem
            icon={CreditCard}
            label="Gerenciar assinatura"
            sublabel="Ver status, garantia e cancelar"
            onClick={() => navigate('/minha-assinatura')}
          />
        </div>
      </div>

      {/* Segurança */}
      <div className="space-y-2">
        <SectionHeader title="Segurança" />
        {!showPasswordForm ? (
          <MenuItem
            icon={KeyRound}
            label="Alterar senha"
            sublabel="Defina uma nova senha de acesso"
            onClick={() => setShowPasswordForm(true)}
          />
        ) : (
          <div className="rounded-2xl p-4 space-y-3"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
            <div>
              <label className="label">Nova senha</label>
              <input type="password" className="input" placeholder="Mínimo 6 caracteres"
                value={newPassword} onChange={e => setNewPassword(e.target.value)} />
            </div>
            <div>
              <label className="label">Confirmar nova senha</label>
              <input type="password" className="input" placeholder="Repita a senha"
                value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setShowPasswordForm(false); setNewPassword(''); setConfirmPassword('') }}
                disabled={savingPassword} className="btn-secondary flex-1 py-2.5 text-sm">
                Cancelar
              </button>
              <button onClick={handleChangePassword} disabled={savingPassword}
                className="btn-primary flex-1 py-2.5 text-sm disabled:opacity-50">
                {savingPassword ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Salvar senha'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Suporte */}
      <div className="space-y-2">
        <SectionHeader title="Suporte" />
        <MenuItem
          icon={LifeBuoy}
          label="Falar com o suporte"
          sublabel={SUPPORT_EMAIL}
          onClick={() => { window.location.href = `mailto:${SUPPORT_EMAIL}?subject=Suporte%20Destrava%C3%AD` }}
        />
      </div>

      {/* Perfil */}
      <div className="space-y-2">
        <SectionHeader title="Perfil" />
        <MenuItem
          icon={User}
          label="Editar essência"
          sublabel="Tom de voz, pilares, serviços"
          onClick={() => navigate('/essencia')}
        />
        <MenuItem
          icon={TrendingUp}
          label="Meu progresso"
          sublabel="Consistência, níveis e equilíbrio de conteúdo"
          onClick={() => navigate('/progresso')}
        />
      </div>

      {/* Aparência */}
      <div className="space-y-2">
        <SectionHeader title="Aparência" />
        <div
          className="rounded-2xl p-4"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(109,93,246,0.12)', border: '1px solid rgba(109,93,246,0.2)' }}
            >
              {isDark
                ? <Moon size={17} style={{ color: '#9B8CFF' }} />
                : <Sun size={17} style={{ color: '#F7B955' }} />
              }
            </div>
            <div className="flex-1">
              <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                {isDark ? 'Tema escuro' : 'Tema claro'}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {isDark ? 'Muda para o tema claro' : 'Muda para o tema escuro'}
              </p>
            </div>
            <Toggle value={!isDark} onChange={toggleTheme} />
          </div>
        </div>
      </div>

      {/* Notificações */}
      <div className="space-y-2">
        <SectionHeader title="Notificações" />
        <div
          className="rounded-2xl p-4 space-y-4"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(109,93,246,0.12)', border: '1px solid rgba(109,93,246,0.2)' }}>
              <Bell size={17} style={{ color: '#9B8CFF' }} />
            </div>
            <div className="flex-1">
              <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Lembrete diário</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Missão do dia às 9h</p>
            </div>
            <Toggle value={notifDaily} onChange={setNotifDaily} />
          </div>

          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(109,93,246,0.12)', border: '1px solid rgba(109,93,246,0.2)' }}>
              <Sparkles size={17} style={{ color: '#9B8CFF' }} />
            </div>
            <div className="flex-1">
              <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Dicas semanais</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Estratégias de conteúdo</p>
            </div>
            <Toggle value={notifTips} onChange={setNotifTips} />
          </div>

          <div className="rounded-xl p-2.5 flex items-start gap-2"
            style={{ background: 'rgba(247,185,85,0.07)', border: '1px solid rgba(247,185,85,0.15)' }}>
            <AlertCircle size={13} style={{ color: '#F7B955', flexShrink: 0, marginTop: 1 }} />
            <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
              Notificações requerem permissão do navegador e só funcionam com app instalado (PWA).
            </p>
          </div>

          <button onClick={handleSaveNotifs} className="btn-secondary w-full py-2.5 text-sm">
            Salvar preferências
          </button>
        </div>
      </div>

      {/* Privacidade */}
      <div className="space-y-2">
        <SectionHeader title="Privacidade" />
        <MenuItem
          icon={Shield}
          label="Dados salvos na sua conta"
          sublabel="Essência, progresso, calendário e Meu Espaço sincronizam entre dispositivos"
          right={<CheckCircle size={16} style={{ color: '#53D6A1', flexShrink: 0 }} />}
        />
      </div>

      {/* Reset do dia */}
      <div className="space-y-2">
        <SectionHeader title="Dados" />
        {!showResetDayConfirm ? (
          <MenuItem
            icon={RefreshCw}
            label="Reiniciar missão do dia"
            sublabel="Limpa apenas as ideias de hoje — seu perfil fica intacto"
            onClick={() => setShowResetDayConfirm(true)}
          />
        ) : (
          <div
            className="rounded-2xl p-4 space-y-3"
            style={{ background: 'rgba(109,93,246,0.07)', border: '1px solid rgba(109,93,246,0.2)' }}
          >
            <div className="flex items-center gap-2">
              <AlertCircle size={16} style={{ color: '#9B8CFF' }} />
              <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Reiniciar missão do dia?</p>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              As ideias geradas hoje serão apagadas e você poderá escolher um novo contexto. Seu perfil, diário e histórico <strong>não serão afetados</strong>.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowResetDayConfirm(false)}
                className="btn-secondary flex-1 py-2.5 text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleResetDay}
                className="flex-1 py-2.5 rounded-2xl text-sm font-extrabold transition-all duration-200"
                style={{
                  background: 'linear-gradient(135deg, rgba(109,93,246,0.3), rgba(155,140,255,0.2))',
                  border: '1px solid rgba(109,93,246,0.4)',
                  color: '#9B8CFF',
                }}
              >
                Sim, reiniciar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Logout */}
      <div className="space-y-2">
        <SectionHeader title="Conta" />
        {!showLogoutConfirm ? (
          <MenuItem
            icon={LogOut}
            label="Sair da conta"
            sublabel="Você poderá entrar novamente; preferências locais deste aparelho serão limpas"
            onClick={() => setShowLogoutConfirm(true)}
            danger
          />
        ) : (
          <div
            className="rounded-2xl p-4 space-y-3"
            style={{ background: 'rgba(255,122,107,0.08)', border: '1px solid rgba(255,122,107,0.25)' }}
          >
            <div className="flex items-center gap-2">
              <AlertCircle size={16} style={{ color: '#FF7A6B' }} />
              <p className="font-bold text-sm" style={{ color: '#FF7A6B' }}>Confirmar saída?</p>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Seus dados de conta continuam salvos no Supabase. Esta ação limpa apenas a sessão e preferências locais deste aparelho.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="btn-secondary flex-1 py-2.5 text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 py-2.5 rounded-2xl text-sm font-extrabold transition-all duration-200"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,122,107,0.3), rgba(255,100,80,0.2))',
                  border: '1px solid rgba(255,122,107,0.4)',
                  color: '#FF7A6B',
                }}
              >
                Sim, sair
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="text-center text-[10px] pb-4" style={{ color: 'var(--text-muted)' }}>
        Destravaí v2.0 · Feito com ✦ para profissionais que querem aparecer
      </p>
    </div>
  )
}

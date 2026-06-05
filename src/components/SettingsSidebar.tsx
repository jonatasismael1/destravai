import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { useToast } from '../context/ToastContext'

import {
  Bell, LogOut, Shield, Sparkles, Star, CheckCircle, AlertCircle,
  RefreshCw, KeyRound, CreditCard, Loader2, X, ShieldAlert,
} from 'lucide-react'
import { deleteDailyCheckin, toISODateKey } from '../services/userJourneyService'
import { createTester } from '../services/subscriptionService'
import { enableNotifications, disableNotifications, notificationsEnabled, notificationsSupported } from '../services/notificationsService'
import { supabase } from '../lib/supabase/client'

const ADMIN_EMAIL = 'assessoriadbe@gmail.com'

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
      {right ?? null}
    </button>
  )
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="relative w-12 h-6 rounded-full flex-shrink-0 transition-all duration-300"
      style={{
        background: value ? 'var(--brand)' : 'var(--bg-surface)',
        border: value ? 'none' : '1px solid var(--border-strong)',
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

export default function SettingsSidebar() {
  const { state, setSidebarOpen, logout } = useApp()
  const { addToast } = useToast()
  const navigate = useNavigate()

  const { sidebarOpen, supabaseUser, subscription, subscriptionLoading } = state

  const [notifDaily, setNotifDaily] = useState(notificationsEnabled())
  const [notifTips, setNotifTips] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [showResetDayConfirm, setShowResetDayConfirm] = useState(false)

  // Segurança (Senha)
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  // Admin
  const isAdmin = (supabaseUser?.email ?? '').toLowerCase() === ADMIN_EMAIL
  const [testerName, setTesterName] = useState('')
  const [testerEmail, setTesterEmail] = useState('')
  const [testerPlan] = useState('destravai_completo')
  const [creatingTester, setCreatingTester] = useState(false)

  useEffect(() => {
    setNotifDaily(notificationsEnabled())
  }, [sidebarOpen])

  if (!sidebarOpen) return null

  // Notificações
  const handleToggleNotif = async (on: boolean) => {
    if (!notificationsSupported()) {
      addToast('Seu navegador não suporta notificações.', 'error'); return
    }
    if (on) {
      const granted = await enableNotifications()
      setNotifDaily(granted)
      addToast(granted ? 'Notificações ativadas!' : 'Permissão de notificação negada pelo navegador.', granted ? 'success' : 'error')
    } else {
      disableNotifications()
      setNotifDaily(false)
      addToast('Notificações desativadas.', 'info')
    }
  }

  const handleSaveNotifs = () => {
    addToast('Preferências salvas!', 'success')
  }

  // Senha
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

  // Admin testador
  const handleCreateTester = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testerEmail.trim())) {
      addToast('Informe um e-mail válido.', 'error'); return
    }
    setCreatingTester(true)
    try {
      const res = await createTester(testerName.trim(), testerEmail.trim().toLowerCase(), testerPlan)
      addToast(res.emailSent
        ? 'Testador criado! E-mail de acesso enviado.'
        : 'Testador criado! (Falha ao enviar e-mail — reenvie pelo "Esqueci a senha".)', 'success')
      setTesterName(''); setTesterEmail('')
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Erro ao criar testador.', 'error')
    } finally {
      setCreatingTester(false)
    }
  }

  const handleLogout = async () => {
    setSidebarOpen(false)
    await logout()
    navigate('/login', { replace: true })
  }

  const handleResetDay = async () => {
    const key = toISODateKey()
    await deleteDailyCheckin(key).catch(err => console.error('[Sidebar reset day]', err))
    setShowResetDayConfirm(false)
    addToast('Missão do dia reiniciada!', 'success')
  }

  const planLabel = subscriptionLoading
    ? 'Carregando plano'
    : subscription?.hasSubscription
      ? (subscription.planName ?? 'Plano ativo')
      : 'Sem assinatura ativa'
  const planDescription = subscription?.hasAccess
    ? `Acesso liberado${subscription.price ? ` · R$ ${subscription.price}/mês` : ''}`
    : 'Escolha um plano para liberar os recursos pagos'
  const planBadge = subscription?.hasAccess ? 'Ativo' : 'Pendente'

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex justify-end"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
      onClick={e => { if (e.target === e.currentTarget) setSidebarOpen(false) }}
    >
      <div
        className="w-full max-w-sm h-full flex flex-col animate-slide-left shadow-2xl relative"
        style={{ background: 'var(--bg-base)', borderLeft: '1px solid var(--border-color)' }}
      >
        {/* Cabeçalho do Sidebar */}
        <div className="p-5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-color)' }}>
          <div className="flex items-center gap-2">
            <h2 className="font-extrabold text-lg" style={{ color: 'var(--text-primary)' }}>Ajustes da conta</h2>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95"
            style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)' }}
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Corpo rolável */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-hide pb-28">
          
          {/* Assinatura */}
          <div className="space-y-2">
            <SectionHeader title="Assinatura" />
            <div
              className="rounded-2xl p-4 space-y-3"
              style={{ background: 'rgba(247,185,85,0.07)', border: '1px solid rgba(247,185,85,0.2)' }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(247,185,85,0.15)', border: '1px solid rgba(247,185,85,0.25)' }}>
                    <Star size={17} style={{ color: '#F7B955' }} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{planLabel}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{planDescription}</p>
                  </div>
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full flex-shrink-0"
                  style={{ background: 'rgba(247,185,85,0.15)', border: '1px solid rgba(247,185,85,0.3)', color: '#F7B955' }}>
                  {planBadge}
                </span>
              </div>
            </div>
            <MenuItem
              icon={CreditCard}
              label="Gerenciar assinatura"
              sublabel="Ver cobranças e status"
              onClick={() => { setSidebarOpen(false); navigate('/minha-assinatura') }}
            />
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
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Missão e constância</p>
                </div>
                <Toggle value={notifDaily} onChange={handleToggleNotif} />
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
                  Notificações locais funcionam melhor com o app instalado na tela inicial do seu celular.
                </p>
              </div>

              <button onClick={handleSaveNotifs} className="btn-secondary w-full py-2.5 text-sm">
                Salvar preferências
              </button>
            </div>
          </div>

          {/* Segurança */}
          <div className="space-y-2">
            <SectionHeader title="Segurança" />
            {!showPasswordForm ? (
              <MenuItem
                icon={KeyRound}
                label="Alterar senha"
                sublabel="Nova credencial de acesso"
                onClick={() => setShowPasswordForm(true)}
              />
            ) : (
              <div className="rounded-2xl p-4 space-y-3 animate-fade-up"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                <div>
                  <label className="label">Nova senha</label>
                  <input type="password" className="input text-sm" placeholder="Mínimo 6 caracteres"
                    value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                </div>
                <div>
                  <label className="label">Confirmar senha</label>
                  <input type="password" className="input text-sm" placeholder="Repita a nova senha"
                    value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setShowPasswordForm(false); setNewPassword(''); setConfirmPassword('') }}
                    disabled={savingPassword} className="btn-secondary flex-1 py-2 text-xs">
                    Cancelar
                  </button>
                  <button onClick={handleChangePassword} disabled={savingPassword}
                    className="btn-primary flex-1 py-2 text-xs disabled:opacity-50">
                    {savingPassword ? <Loader2 size={12} className="animate-spin mx-auto" /> : 'Salvar'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Privacidade */}
          <div className="space-y-2">
            <SectionHeader title="Privacidade" />
            <MenuItem
              icon={Shield}
              label="Sincronização ativa"
              sublabel="Dados salvos em nuvem segura"
              right={<CheckCircle size={16} style={{ color: '#53D6A1', flexShrink: 0 }} />}
            />
          </div>

          {/* Reiniciar Missão */}
          <div className="space-y-2">
            <SectionHeader title="Dados locais" />
            {!showResetDayConfirm ? (
              <MenuItem
                icon={RefreshCw}
                label="Reiniciar o dia"
                sublabel="Gera uma nova missão para hoje"
                onClick={() => setShowResetDayConfirm(true)}
              />
            ) : (
              <div
                className="rounded-2xl p-4 space-y-3 animate-fade-up"
                style={{ background: 'rgba(109,93,246,0.07)', border: '1px solid rgba(109,93,246,0.2)' }}
              >
                <div className="flex items-center gap-2">
                  <AlertCircle size={16} style={{ color: '#9B8CFF' }} />
                  <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Confirmar reinício?</p>
                </div>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  As missões de hoje serão apagadas e você fará o check-in novamente. Histórico e perfil continuam intactos.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowResetDayConfirm(false)}
                    className="btn-secondary flex-1 py-2 text-xs"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleResetDay}
                    className="btn-tonal flex-1 py-2 text-xs"
                  >
                    Confirmar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Administração */}
          {isAdmin && (
            <div className="space-y-2">
              <SectionHeader title="Administração" />
              <div className="rounded-2xl p-4 space-y-3"
                style={{ background: 'rgba(83,214,161,0.06)', border: '1px solid rgba(83,214,161,0.2)' }}>
                <div className="flex items-center gap-2">
                  <ShieldAlert size={15} style={{ color: '#53D6A1' }} />
                  <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Criar testador</p>
                </div>
                <input className="input text-xs" placeholder="Nome" value={testerName}
                  onChange={e => setTesterName(e.target.value)} />
                <input className="input text-xs" type="email" placeholder="E-mail" value={testerEmail}
                  onChange={e => setTesterEmail(e.target.value)} />
                <button onClick={handleCreateTester} disabled={creatingTester}
                  className="btn-primary w-full py-2 text-xs disabled:opacity-50">
                  {creatingTester ? <Loader2 size={12} className="animate-spin mx-auto" /> : 'Liberar testador'}
                </button>
              </div>
            </div>
          )}

          {/* Logout */}
          <div className="space-y-2">
            <SectionHeader title="Sair" />
            {!showLogoutConfirm ? (
              <MenuItem
                icon={LogOut}
                label="Sair da conta"
                sublabel="Limpar a sessão ativa"
                onClick={() => setShowLogoutConfirm(true)}
                danger
              />
            ) : (
              <div
                className="rounded-2xl p-4 space-y-3 animate-fade-up"
                style={{ background: 'rgba(255,122,107,0.08)', border: '1px solid rgba(255,122,107,0.25)' }}
              >
                <div className="flex items-center gap-2">
                  <AlertCircle size={16} style={{ color: '#FF7A6B' }} />
                  <p className="font-bold text-sm" style={{ color: '#FF7A6B' }}>Confirmar saída?</p>
                </div>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  Sua conta está salva com segurança. Você precisará digitar suas credenciais para reentrar no app.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowLogoutConfirm(false)}
                    className="btn-secondary flex-1 py-2 text-xs"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleLogout}
                    className="flex-1 py-2 rounded-2xl text-xs font-extrabold transition-all"
                    style={{
                      background: 'rgba(239,68,68,0.12)',
                      border: '1px solid rgba(239,68,68,0.3)',
                      color: 'var(--danger)',
                    }}
                  >
                    Sair
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>,
    document.body
  )
}

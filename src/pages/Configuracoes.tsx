import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { useToast } from '../context/ToastContext'
import { useTheme } from '../context/ThemeContext'
import {
  User, Bell, LogOut, ChevronRight, Shield,
  Sparkles, Star, CheckCircle, AlertCircle, Sun, Moon, RefreshCw, TrendingUp,
  KeyRound, CreditCard, LifeBuoy, Loader2, Camera, Compass, Award, X,
} from 'lucide-react'
import { useOnboarding, useScreenTour } from '../context/OnboardingContext'
import { deleteDailyCheckin, toISODateKey } from '../services/userJourneyService'
import { createTester } from '../services/subscriptionService'
import { uploadAvatar } from '../services/profileService'
import { enableNotifications, disableNotifications, notificationsEnabled, notificationsSupported } from '../services/notificationsService'
import { supabase } from '../lib/supabase/client'

const SUPPORT_EMAIL = 'assessoriadbe@gmail.com'
const ADMIN_EMAIL = 'assessoriadbe@gmail.com'

async function cropAvatarFile(file: File, position: { x: number; y: number }, zoom = 1): Promise<File> {
  const objectUrl = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = objectUrl
    })

    // Janela quadrada de recorte. Quanto maior o zoom, MENOR a janela (aproxima).
    const base = Math.min(image.naturalWidth, image.naturalHeight)
    const size = base / Math.max(1, zoom)
    const sx = Math.max(0, Math.min(image.naturalWidth - size, (image.naturalWidth - size) * (position.x / 100)))
    const sy = Math.max(0, Math.min(image.naturalHeight - size, (image.naturalHeight - size) * (position.y / 100)))
    const canvas = document.createElement('canvas')
    canvas.width = 900
    canvas.height = 900
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Não foi possível preparar a imagem.')
    ctx.drawImage(image, sx, sy, size, size, 0, 0, canvas.width, canvas.height)

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(result => result ? resolve(result) : reject(new Error('Não foi possível recortar a imagem.')), 'image/jpeg', 0.92)
    })
    return new File([blob], 'avatar.jpg', { type: 'image/jpeg' })
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

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

export default function Configuracoes() {
  const { state, logout, setProfile } = useApp()
  const { addToast } = useToast()
  const navigate = useNavigate()
  const { isDark, toggleTheme } = useTheme()
  const { resetTours } = useOnboarding()
  useScreenTour('configuracoes')

  const [notifDaily, setNotifDaily] = useState(notificationsEnabled())
  const [notifTips, setNotifTips] = useState(false)

  // Liga/desliga as notificações locais (lembrete + régua de constância).
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
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [showResetDayConfirm, setShowResetDayConfirm] = useState(false)

  // Foto de perfil
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState('')
  const [avatarPosition, setAvatarPosition] = useState({ x: 50, y: 50 })
  const [avatarZoom, setAvatarZoom] = useState(1)

  const handlePickAvatar = () => fileInputRef.current?.click()

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl)
    }
  }, [avatarPreviewUrl])

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // permite reescolher o mesmo arquivo depois
    if (!file) return
    if (!file.type.startsWith('image/')) { addToast('Escolha um arquivo de imagem.', 'error'); return }
    if (file.size > 5 * 1024 * 1024) { addToast('Imagem muito grande (máx. 5 MB).', 'error'); return }
    if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl)
    setAvatarFile(file)
    setAvatarPreviewUrl(URL.createObjectURL(file))
    setAvatarPosition({ x: 50, y: 50 })
    setAvatarZoom(1)
  }

  const closeAvatarPreview = () => {
    if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl)
    setAvatarFile(null)
    setAvatarPreviewUrl('')
    setAvatarPosition({ x: 50, y: 50 })
    setAvatarZoom(1)
  }

  const handleConfirmAvatar = async () => {
    if (!avatarFile) return
    setUploadingAvatar(true)
    try {
      const cropped = await cropAvatarFile(avatarFile, avatarPosition, avatarZoom)
      const url = await uploadAvatar(cropped)
      if (state.profile) setProfile({ ...state.profile, avatar_url: url })
      addToast('Foto atualizada!', 'success')
      closeAvatarPreview()
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Erro ao atualizar a foto.', 'error')
    } finally {
      setUploadingAvatar(false)
    }
  }

  // Alterar senha (usuário logado: o Supabase não exige a senha atual).
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  // Admin (assessoriadbe): cria testadores com acesso grátis.
  const isAdmin = (state.supabaseUser?.email ?? '').toLowerCase() === ADMIN_EMAIL
  const [testerName, setTesterName] = useState('')
  const [testerEmail, setTesterEmail] = useState('')
  const [testerPlan] = useState('destravai_completo')
  const [creatingTester, setCreatingTester] = useState(false)

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
  const progress = state.progress
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
        <h1 className="premium-title">Você</h1>
        <p className="premium-subtitle">
          Perfil, progresso, assinatura e ajustes em um só lugar.
        </p>
      </div>

      {/* Profile card */}
      <div className="relative rounded-2xl p-5 overflow-hidden app-card">
        <div className="flex items-center gap-4">
          <button
            onClick={handlePickAvatar}
            disabled={uploadingAvatar}
            className="relative w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 font-black text-2xl overflow-hidden text-white"
            style={{ background: 'var(--brand)' }}
            aria-label="Trocar foto de perfil"
            title="Trocar foto"
          >
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Foto de perfil" className="w-full h-full object-cover" />
            ) : (
              (profile?.name ?? supabaseUser?.email ?? '?').charAt(0).toUpperCase()
            )}
            <span className="absolute bottom-0 right-0 w-6 h-6 rounded-tl-lg flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.55)' }}>
              {uploadingAvatar
                ? <RefreshCw size={12} className="text-white animate-spin" />
                : <Camera size={12} className="text-white" />}
            </span>
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
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

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Dias ativos', value: progress.currentStreak },
          { label: 'Conteúdos', value: state.ideas.length },
          { label: 'Missões', value: progress.missionsCompleted },
        ].map(stat => (
          <div key={stat.label} className="premium-card p-3 text-center">
            <p className="text-2xl font-black tabular-nums" style={{ color: 'var(--text-primary)' }}>{stat.value}</p>
            <p className="text-[10px] font-bold leading-tight" style={{ color: 'var(--text-muted)' }}>{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Perfil — logo abaixo da foto: é o que mais se acessa nas Configurações
          (editar essência e ver progresso), então vem por ordem de prioridade. */}
      <div className="space-y-2">
        <SectionHeader title="Você" />
        <MenuItem
          icon={User}
          label="Minha essência"
          sublabel="Tom de voz, pilares, serviços"
          onClick={() => navigate('/essencia')}
        />
        <MenuItem
          icon={TrendingUp}
          label="Progresso"
          sublabel="Consistência, níveis e equilíbrio de conteúdo"
          onClick={() => navigate('/espaco')}
        />
        <MenuItem
          icon={Award}
          label="Medalhas"
          sublabel={`${progress.bestStreak} dias no melhor ritmo · ${progress.streakShields} escudos`}
          onClick={() => navigate('/espaco', { state: { tab: 'progresso' } })}
        />
      </div>

      {/* Aparência — logo após "Medalhas" para deixar o tema claro/escuro
          fácil de encontrar (configuração de alto uso). */}
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

      {/* Admin — só para o administrador (assessoriadbe) */}
      {isAdmin && (
        <div className="space-y-2">
          <SectionHeader title="Administração" />
          <div className="rounded-2xl p-4 space-y-3"
            style={{ background: 'rgba(83,214,161,0.06)', border: '1px solid rgba(83,214,161,0.2)' }}>
            <div className="flex items-center gap-2">
              <Shield size={15} style={{ color: '#53D6A1' }} />
              <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Liberar acesso de teste</p>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Cria um usuário testador com acesso grátis. Ele recebe um e-mail para definir a senha.
            </p>
            <input className="input" placeholder="Nome (opcional)" value={testerName}
              onChange={e => setTesterName(e.target.value)} />
            <input className="input" type="email" placeholder="E-mail do testador" value={testerEmail}
              onChange={e => setTesterEmail(e.target.value)} />
            <div className="input text-sm font-bold" style={{ color: 'var(--text-secondary)' }}>
              Plano: Destravaí Completo
            </div>
            <button onClick={handleCreateTester} disabled={creatingTester}
              className="btn-primary w-full py-2.5 text-sm disabled:opacity-50">
              {creatingTester ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Criar acesso de teste'}
            </button>
          </div>
        </div>
      )}

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

      {/* Ajuda / Tour guiado */}
      <div className="space-y-2">
        <SectionHeader title="Ajuda" />
        <div data-tour="config-tour">
          <MenuItem
            icon={Compass}
            label="Ver tour novamente"
            sublabel="Refazer a apresentação guiada do app"
            onClick={() => { resetTours(); navigate('/') }}
          />
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
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Lembrete da missão e marcos de constância</p>
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
              As notificações precisam da sua permissão e funcionam melhor com o app instalado na tela inicial.
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
                className="btn-tonal flex-1 py-2.5 text-sm"
              >
                Sim, reiniciar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Plano — fica no rodapé, perto de "Sair": acesso continua existindo, mas
          sem destaque no topo (para não puxar a atenção para cancelar). */}
      <div>
        <SectionHeader title="Assinatura" />
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
              As gerações usam a Deby AI configurada no projeto. Chaves e integrações sensíveis ficam fora da interface do cliente.
            </p>
          </div>
        </div>

        <div className="mt-2">
          <MenuItem
            icon={CreditCard}
            label="Gerenciar assinatura"
            sublabel="Ver status e cancelar"
            onClick={() => navigate('/minha-assinatura')}
          />
        </div>
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
              Seus dados de conta continuam salvos com segurança. Esta ação encerra apenas a sessão neste aparelho — é só entrar de novo para continuar de onde parou.
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
                  background: 'rgba(239,68,68,0.12)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  color: 'var(--danger)',
                }}
              >
                Sim, sair
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="text-center text-[10px] pb-4" style={{ color: 'var(--text-muted)' }}>
        Destravaí · Feito com ✦ para profissionais que querem aparecer
      </p>

      {avatarPreviewUrl && (
        <div
          className="fixed inset-0 z-[160] flex flex-col justify-end"
          style={{ background: 'rgba(0,0,0,0.68)', backdropFilter: 'blur(8px)' }}
          onClick={e => { if (e.target === e.currentTarget && !uploadingAvatar) closeAvatarPreview() }}
        >
          <div
            className="rounded-t-3xl max-w-md w-full mx-auto flex flex-col overflow-hidden"
            style={{ background: 'var(--bg-card)', borderTop: '1px solid var(--border-color)', maxHeight: '92vh' }}
          >
            {/* Área rolável: encolhe (min-h-0) para o footer SEMPRE caber abaixo. */}
            <div className="flex-1 min-h-0 p-5 space-y-4 overflow-y-auto">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-extrabold text-base" style={{ color: 'var(--text-primary)' }}>Ajustar foto</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Aproxime e enquadre antes de salvar.</p>
                </div>
                <button
                  onClick={closeAvatarPreview}
                  disabled={uploadingAvatar}
                  className="w-9 h-9 rounded-full flex items-center justify-center disabled:opacity-40"
                  style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)' }}
                  aria-label="Fechar"
                >
                  <X size={17} />
                </button>
              </div>

              <div className="flex justify-center">
                <div
                  className="w-40 h-40 rounded-[34px] overflow-hidden"
                  style={{ background: 'var(--bg-input)', border: '1px solid var(--border-strong)', boxShadow: 'var(--shadow-card)' }}
                >
                  <img
                    src={avatarPreviewUrl}
                    alt="Prévia da foto de perfil"
                    className="w-full h-full object-cover"
                    style={{
                      objectPosition: `${avatarPosition.x}% ${avatarPosition.y}%`,
                      transform: `scale(${avatarZoom})`,
                      transformOrigin: `${avatarPosition.x}% ${avatarPosition.y}%`,
                    }}
                  />
                </div>
              </div>

              <div className="space-y-3.5">
                <label className="block">
                  <span className="label mb-2">Aproximar / afastar</span>
                  <input
                    type="range"
                    min="1"
                    max="3"
                    step="0.01"
                    value={avatarZoom}
                    onChange={e => setAvatarZoom(Number(e.target.value))}
                    className="w-full accent-[var(--brand)]"
                  />
                </label>
                <label className="block">
                  <span className="label mb-2">Mover para os lados</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={avatarPosition.x}
                    onChange={e => setAvatarPosition(pos => ({ ...pos, x: Number(e.target.value) }))}
                    className="w-full accent-[var(--brand)]"
                  />
                </label>
                <label className="block">
                  <span className="label mb-2">Mover para cima/baixo</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={avatarPosition.y}
                    onChange={e => setAvatarPosition(pos => ({ ...pos, y: Number(e.target.value) }))}
                    className="w-full accent-[var(--brand)]"
                  />
                </label>
              </div>
            </div>

            {/* Footer fixo: os botões ficam SEMPRE visíveis, sem depender de rolagem. */}
            <div
              className="flex-shrink-0 grid grid-cols-2 gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
              style={{ background: 'var(--bg-card)', borderTop: '1px solid var(--border-color)' }}
            >
              <button onClick={closeAvatarPreview} disabled={uploadingAvatar} className="btn-secondary py-3 text-sm disabled:opacity-40">
                Cancelar
              </button>
              <button onClick={handleConfirmAvatar} disabled={uploadingAvatar} className="btn-primary py-3 text-sm disabled:opacity-40">
                {uploadingAvatar ? <><Loader2 size={15} className="animate-spin" /> Salvando...</> : <><CheckCircle size={15} /> Usar foto</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

import { useState, useEffect, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { useToast } from '../context/ToastContext'
import {
  Users, Plus, LogIn, Trophy, Flame, Copy, Check, ArrowLeft, Crown, Share2, X,
  Zap, Sparkles, CalendarCheck, Send, Video, Target, Award, ChevronRight,
} from 'lucide-react'
import {
  listMyGroups, createGroup, joinGroupByCode, leaveGroup,
  getWeeklyRanking, countMembers, appearedToday, getMemberProfile,
  type Group, type RankingRow, type MemberProfile,
} from '../services/groupsService'

// Tela de grupos de constância: competição saudável por EXECUÇÃO (postou, gravou,
// missão feita) — não por seguidores. Cada grupo é um convite que traz amigos.
// Totalmente isolada: não toca em nenhum fluxo existente.

function medal(index: number): string {
  return index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}º`
}

export default function Grupos() {
  const { state } = useApp()
  const { addToast } = useToast()
  const myId = state.supabaseUser?.id

  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Group | null>(null)
  const [ranking, setRanking] = useState<RankingRow[]>([])
  const [rankingLoading, setRankingLoading] = useState(false)

  // Perfil de competidor (ao clicar num participante do ranking)
  const [profileUser, setProfileUser] = useState<RankingRow | null>(null)
  const [profile, setProfile] = useState<MemberProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)

  const openProfile = async (row: RankingRow) => {
    if (!selected) return
    setProfileUser(row)
    setProfile(null)
    setProfileLoading(true)
    try {
      const p = await getMemberProfile(selected.id, row.user_id)
      setProfile(p)
    } catch (err) {
      console.error('[Grupos profile]', err)
    } finally {
      setProfileLoading(false)
    }
  }

  // Forms
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [newName, setNewName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  const loadGroups = useCallback(async () => {
    setLoading(true)
    try {
      const list = await listMyGroups()
      // Conta membros de cada grupo (em paralelo).
      const withCounts = await Promise.all(
        list.map(async g => ({ ...g, memberCount: await countMembers(g.id) }))
      )
      setGroups(withCounts)
    } catch (err) {
      console.error('[Grupos load]', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (state.supabaseUser) loadGroups()
    else setLoading(false)
  }, [state.supabaseUser?.id, loadGroups])

  const openGroup = async (g: Group) => {
    setSelected(g)
    setRankingLoading(true)
    try {
      const r = await getWeeklyRanking(g.id)
      setRanking(r)
    } catch (err) {
      console.error('[Grupos ranking]', err)
      setRanking([])
    } finally {
      setRankingLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!newName.trim()) return
    setBusy(true)
    try {
      const g = await createGroup(newName)
      addToast('Grupo criado! Convide seus amigos pelo código.', 'success')
      setNewName(''); setShowCreate(false)
      await loadGroups()
      void openGroup(g)
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Erro ao criar grupo', 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleJoin = async () => {
    if (!joinCode.trim()) return
    setBusy(true)
    try {
      await joinGroupByCode(joinCode)
      addToast('Você entrou no grupo!', 'success')
      setJoinCode(''); setShowJoin(false)
      await loadGroups()
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Erro ao entrar', 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleLeave = async (g: Group) => {
    setBusy(true)
    try {
      await leaveGroup(g.id)
      addToast('Você saiu do grupo.', 'info')
      setSelected(null)
      await loadGroups()
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Erro ao sair', 'error')
    } finally {
      setBusy(false)
    }
  }

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const shareCode = async (g: Group) => {
    const text = `Bora manter a constância juntos no Destravaí! Entre no meu grupo "${g.name}" com o código ${g.invite_code}.`
    try {
      if (navigator.share) await navigator.share({ title: 'Destravaí — Grupo', text })
      else { navigator.clipboard.writeText(text); addToast('Convite copiado!', 'success') }
    } catch { /* usuário cancelou */ }
  }

  // ─────────────────────────────── Detalhe do grupo ───────────────────────────
  if (selected) {
    return (
      <div className="p-5 space-y-5 pb-28">
        <button onClick={() => setSelected(null)} className="flex items-center gap-2 text-sm font-bold" style={{ color: '#9B8CFF' }}>
          <ArrowLeft size={16} /> Meus grupos
        </button>

        <div className="rounded-3xl p-5 relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, rgba(109,93,246,0.2), rgba(155,140,255,0.08))', border: '1px solid rgba(109,93,246,0.3)' }}>
          <h1 className="text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>{selected.name}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Ranking da semana · por constância</p>

          {/* Código de convite */}
          <div className="mt-4 flex items-center gap-2">
            <div className="flex-1 rounded-2xl px-4 py-3 flex items-center justify-between"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Código do grupo</p>
                <p className="text-lg font-extrabold tracking-[0.2em]" style={{ color: '#9B8CFF' }}>{selected.invite_code}</p>
              </div>
              <button onClick={() => copyCode(selected.invite_code)} className="btn-secondary py-2 px-3 text-sm">
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
            <button onClick={() => shareCode(selected)} className="btn-primary py-3 px-4 text-sm" aria-label="Compartilhar convite">
              <Share2 size={15} />
            </button>
          </div>
        </div>

        {/* Ranking */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <Trophy size={16} style={{ color: '#F7B955' }} />
            <p className="section-title">Ranking da semana</p>
          </div>

          {rankingLoading ? (
            <div className="flex justify-center py-10">
              <span className="w-7 h-7 rounded-full animate-spin" style={{ border: '2px solid rgba(109,93,246,0.3)', borderTopColor: '#9B8CFF' }} />
            </div>
          ) : ranking.length === 0 ? (
            <div className="rounded-2xl p-6 text-center text-sm" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
              Ninguém pontuou ainda esta semana. Seja o primeiro a aparecer! 🔥
            </div>
          ) : (
            ranking.map((row, i) => {
              const isMe = row.user_id === myId
              const today = appearedToday(row)
              return (
                <button key={row.user_id} onClick={() => openProfile(row)}
                  className="w-full text-left rounded-2xl p-4 flex items-center gap-3 transition-all active:scale-[0.98]"
                  style={{
                    background: isMe ? 'linear-gradient(135deg, rgba(109,93,246,0.15), rgba(155,140,255,0.06))' : 'var(--bg-card)',
                    border: isMe ? '1px solid rgba(109,93,246,0.35)' : '1px solid var(--border-color)',
                  }}>
                  <span className="text-lg font-extrabold w-7 text-center flex-shrink-0" style={{ color: i < 3 ? '#F7B955' : 'var(--text-muted)' }}>
                    {medal(i)}
                  </span>
                  <Avatar name={row.display_name} url={row.avatar_url} size={40} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                      {row.display_name}{isMe ? ' (você)' : ''}
                      {today && <Flame size={12} style={{ color: '#FF7A6B' }} />}
                    </p>
                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      {row.posted} posts · {row.recorded} gravações · {row.missions} missões
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-sm font-extrabold tabular-nums" style={{ color: '#9B8CFF' }}>{row.xp} XP</span>
                    <ChevronRight size={15} style={{ color: 'var(--text-muted)' }} />
                  </div>
                </button>
              )
            })
          )}
        </div>

        <p className="text-[11px] text-center" style={{ color: 'var(--text-muted)' }}>
          XP: postar = 25 · gravar = 15 · missão concluída = 10. Reinicia toda segunda-feira.
        </p>

        <button onClick={() => handleLeave(selected)} disabled={busy}
          className="w-full text-center text-[11px] py-2 opacity-40 hover:opacity-70 transition-opacity" style={{ color: 'var(--text-muted)' }}>
          Sair deste grupo
        </button>

        {/* Card de perfil do competidor */}
        {profileUser && (
          <ProfileSheet
            row={profileUser}
            profile={profile}
            loading={profileLoading}
            isMe={profileUser.user_id === myId}
            onClose={() => { setProfileUser(null); setProfile(null) }}
          />
        )}
      </div>
    )
  }

  // ─────────────────────────────── Lista de grupos ────────────────────────────
  return (
    <div className="p-5 space-y-6 pb-28">
      <div className="pt-4">
        <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>Grupos</h1>
        <p className="text-sm mt-1 font-medium" style={{ color: 'var(--text-secondary)' }}>
          Constância é mais fácil com amigos. Crie ou entre em um grupo e disputem quem mais aparece.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => setShowCreate(true)} className="rounded-2xl p-4 text-left transition-all active:scale-95"
          style={{ background: 'linear-gradient(135deg, rgba(109,93,246,0.2), rgba(155,140,255,0.08))', border: '1px solid rgba(109,93,246,0.3)' }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-2" style={{ background: 'rgba(124,92,255,0.2)', border: '1px solid rgba(124,92,255,0.3)' }}>
            <Plus size={18} style={{ color: '#9B8CFF' }} />
          </div>
          <span className="block text-sm font-extrabold" style={{ color: 'var(--text-primary)' }}>Criar grupo</span>
          <span className="block text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Você convida os amigos</span>
        </button>

        <button onClick={() => setShowJoin(true)} className="rounded-2xl p-4 text-left transition-all active:scale-95"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-2" style={{ background: 'rgba(83,214,161,0.12)', border: '1px solid rgba(83,214,161,0.25)' }}>
            <LogIn size={18} style={{ color: '#53D6A1' }} />
          </div>
          <span className="block text-sm font-extrabold" style={{ color: 'var(--text-primary)' }}>Entrar por código</span>
          <span className="block text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Recebeu um convite?</span>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <span className="w-7 h-7 rounded-full animate-spin" style={{ border: '2px solid rgba(109,93,246,0.3)', borderTopColor: '#9B8CFF' }} />
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-3xl p-8 flex flex-col items-center text-center gap-3"
          style={{ background: 'rgba(109,93,246,0.06)', border: '1px solid rgba(109,93,246,0.15)' }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(109,93,246,0.3), rgba(155,140,255,0.2))' }}>
            <Users size={24} style={{ color: '#9B8CFF' }} />
          </div>
          <div>
            <p className="font-extrabold text-lg" style={{ color: 'var(--text-primary)' }}>Nenhum grupo ainda</p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Crie o primeiro e chame a galera para manter a constância junto.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          <p className="section-title">Meus grupos</p>
          {groups.map(g => (
            <button key={g.id} onClick={() => openGroup(g)} className="w-full rounded-2xl p-4 flex items-center gap-3 text-left transition-all active:scale-[0.98]"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(124,92,255,0.12)', border: '1px solid rgba(124,92,255,0.2)' }}>
                <Users size={18} style={{ color: '#9B8CFF' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-extrabold truncate flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                  {g.name}
                  {g.owner_id === myId && <Crown size={12} style={{ color: '#F7B955' }} />}
                </p>
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {g.memberCount ?? 1} {(g.memberCount ?? 1) === 1 ? 'membro' : 'membros'} · código {g.invite_code}
                </p>
              </div>
              <Trophy size={16} style={{ color: 'var(--text-muted)' }} />
            </button>
          ))}
        </div>
      )}

      {/* Modal criar */}
      {showCreate && (
        <ModalSheet title="Criar grupo" onClose={() => setShowCreate(false)}>
          <label className="label">Nome do grupo</label>
          <input className="input" value={newName} onChange={e => setNewName(e.target.value)}
            placeholder="Ex: Nutris que postam" maxLength={40} onKeyDown={e => e.key === 'Enter' && handleCreate()} />
          <button onClick={handleCreate} disabled={busy || !newName.trim()} className="btn-primary w-full py-3 text-sm mt-2 disabled:opacity-40">
            {busy ? 'Criando...' : 'Criar grupo'}
          </button>
        </ModalSheet>
      )}

      {/* Modal entrar */}
      {showJoin && (
        <ModalSheet title="Entrar em um grupo" onClose={() => setShowJoin(false)}>
          <label className="label">Código do convite</label>
          <input className="input tracking-[0.2em] uppercase" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())}
            placeholder="EX: ABC123" maxLength={6} onKeyDown={e => e.key === 'Enter' && handleJoin()} />
          <button onClick={handleJoin} disabled={busy || !joinCode.trim()} className="btn-primary w-full py-3 text-sm mt-2 disabled:opacity-40">
            {busy ? 'Entrando...' : 'Entrar no grupo'}
          </button>
        </ModalSheet>
      )}
    </div>
  )
}

// ─────────────────────────────── Avatar ───────────────────────────────────
// Mostra a foto do participante; se não houver, cai para as iniciais do nome
// num fundo derivado do próprio nome (cor estável por pessoa).
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function colorFromName(name: string): string {
  // Hash simples → matiz estável, para cada pessoa ter sua cor.
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 55%, 55%)`
}

function Avatar({ name, url, size = 40 }: { name: string; url?: string | null; size?: number }) {
  const [broken, setBroken] = useState(false)
  const dim = { width: size, height: size }
  if (url && !broken) {
    return (
      <img src={url} alt={name} onError={() => setBroken(true)}
        className="rounded-full object-cover flex-shrink-0"
        style={{ ...dim, border: '1px solid var(--border-color)' }} />
    )
  }
  return (
    <div className="rounded-full flex items-center justify-center flex-shrink-0 font-extrabold text-white"
      style={{ ...dim, background: colorFromName(name), fontSize: size * 0.36 }}>
      {initials(name)}
    </div>
  )
}

// ─────────────────────── Card de perfil do competidor ──────────────────────
function StatBox({ icon, value, label, color }: { icon: React.ReactNode; value: React.ReactNode; label: string; color: string }) {
  return (
    <div className="rounded-2xl p-3 flex flex-col gap-1" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
      <div className="flex items-center gap-1.5" style={{ color }}>
        {icon}
        <span className="text-lg font-extrabold tabular-nums" style={{ color: 'var(--text-primary)' }}>{value}</span>
      </div>
      <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>{label}</span>
    </div>
  )
}

// Conquistas: dão "selos" de competição com base nos números reais.
function badgesFor(p: MemberProfile): { emoji: string; label: string }[] {
  const out: { emoji: string; label: string }[] = []
  if (p.current_streak >= 3) out.push({ emoji: '🔥', label: `${p.current_streak} dias seguidos` })
  if (p.best_streak >= 7) out.push({ emoji: '🏆', label: 'Recorde 7+ dias' })
  if (p.scripts_generated >= 10) out.push({ emoji: '✍️', label: '10+ roteiros' })
  if (p.scripts_generated >= 50) out.push({ emoji: '🚀', label: '50+ roteiros' })
  if (p.week_posted >= 3) out.push({ emoji: '📣', label: 'Postou muito' })
  if (p.total_content_days >= 30) out.push({ emoji: '💎', label: '30+ dias de conteúdo' })
  if (p.rank_position === 1) out.push({ emoji: '👑', label: 'Líder da semana' })
  return out
}

function monthYear(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
}

function ProfileSheet({ row, profile, loading, isMe, onClose }: {
  row: RankingRow; profile: MemberProfile | null; loading: boolean; isMe: boolean; onClose: () => void
}) {
  const name = profile?.display_name ?? row.display_name
  const badges = profile ? badgesFor(profile) : []
  return (
    <div className="fixed inset-0 z-[150] flex flex-col justify-end" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="rounded-t-3xl pb-10 max-h-[88vh] overflow-y-auto max-w-md w-full mx-auto"
        style={{ background: 'var(--bg-primary)', borderTop: '1px solid var(--border-color)' }}>

        {/* Cabeçalho com gradiente */}
        <div className="p-5 relative" style={{ background: 'linear-gradient(135deg, rgba(109,93,246,0.25), rgba(155,140,255,0.06))' }}>
          <button onClick={onClose} className="absolute top-4 right-4" style={{ color: 'var(--text-muted)' }} aria-label="Fechar"><X size={18} /></button>
          <div className="flex items-center gap-3">
            <Avatar name={name} url={profile?.avatar_url ?? row.avatar_url} size={64} />
            <div className="min-w-0">
              <p className="text-xl font-extrabold truncate" style={{ color: 'var(--text-primary)' }}>
                {name}{isMe ? ' (você)' : ''}
              </p>
              <p className="text-[12px] truncate" style={{ color: 'var(--text-secondary)' }}>
                {profile?.profession || 'Criador de conteúdo'}
              </p>
              <div className="flex items-center gap-2 mt-1">
                {profile?.rank_position != null && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(247,185,85,0.15)', color: '#F7B955' }}>
                    {profile.rank_position}º no ranking
                  </span>
                )}
                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  no grupo desde {monthYear(profile?.member_since ?? null)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <span className="w-7 h-7 rounded-full animate-spin" style={{ border: '2px solid rgba(109,93,246,0.3)', borderTopColor: '#9B8CFF' }} />
          </div>
        ) : !profile ? (
          <p className="text-center text-sm py-10" style={{ color: 'var(--text-secondary)' }}>Não foi possível carregar o perfil.</p>
        ) : (
          <div className="p-5 space-y-5">
            {/* Destaque: streak + XP da semana */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-2xl p-4 flex flex-col items-center gap-1"
                style={{ background: 'linear-gradient(135deg, rgba(255,122,107,0.18), rgba(247,185,85,0.06))', border: '1px solid rgba(255,122,107,0.25)' }}>
                <Flame size={22} style={{ color: '#FF7A6B' }} />
                <span className="text-2xl font-extrabold tabular-nums" style={{ color: 'var(--text-primary)' }}>{profile.current_streak}</span>
                <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>dias seguidos agora</span>
              </div>
              <div className="rounded-2xl p-4 flex flex-col items-center gap-1"
                style={{ background: 'linear-gradient(135deg, rgba(109,93,246,0.18), rgba(155,140,255,0.06))', border: '1px solid rgba(109,93,246,0.25)' }}>
                <Zap size={22} style={{ color: '#9B8CFF' }} />
                <span className="text-2xl font-extrabold tabular-nums" style={{ color: 'var(--text-primary)' }}>{profile.week_xp}</span>
                <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>XP nesta semana</span>
              </div>
            </div>

            {/* Métricas da semana */}
            <div>
              <p className="section-title mb-2">Esta semana</p>
              <div className="grid grid-cols-2 gap-2.5">
                <StatBox icon={<Send size={15} />} value={profile.week_posted} label="Posts publicados" color="#53D6A1" />
                <StatBox icon={<Video size={15} />} value={profile.week_recorded} label="Gravações" color="#FF7A6B" />
                <StatBox icon={<Target size={15} />} value={profile.week_missions} label="Missões feitas" color="#F7B955" />
                <StatBox icon={<CalendarCheck size={15} />} value={profile.week_active_days} label="Dias ativos" color="#9B8CFF" />
              </div>
            </div>

            {/* Histórico / total */}
            <div>
              <p className="section-title mb-2">No total</p>
              <div className="grid grid-cols-2 gap-2.5">
                <StatBox icon={<Sparkles size={15} />} value={profile.scripts_generated} label="Roteiros gerados" color="#9B8CFF" />
                <StatBox icon={<CalendarCheck size={15} />} value={profile.total_content_days} label="Dias com conteúdo" color="#53D6A1" />
                <StatBox icon={<Award size={15} />} value={profile.best_streak} label="Maior sequência" color="#F7B955" />
                <StatBox icon={<Trophy size={15} />} value={profile.rank_position != null ? `${profile.rank_position}º` : '—'} label="Posição atual" color="#FF7A6B" />
              </div>
            </div>

            {/* Conquistas */}
            {badges.length > 0 && (
              <div>
                <p className="section-title mb-2">Conquistas</p>
                <div className="flex flex-wrap gap-2">
                  {badges.map((b, i) => (
                    <span key={i} className="text-[12px] font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5"
                      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>
                      <span>{b.emoji}</span> {b.label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {isMe && (
              <p className="text-[11px] text-center" style={{ color: 'var(--text-muted)' }}>
                Apareça todos os dias para manter sua sequência e subir no ranking. 🔥
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ModalSheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[150] flex flex-col justify-end" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="rounded-t-3xl p-5 pb-10 space-y-3 max-w-md w-full mx-auto"
        style={{ background: 'var(--bg-card)', borderTop: '1px solid var(--border-color)' }}>
        <div className="flex items-center justify-between">
          <p className="font-extrabold text-base" style={{ color: 'var(--text-primary)' }}>{title}</p>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }} aria-label="Fechar"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

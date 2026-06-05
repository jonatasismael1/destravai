import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Flame, MessageSquare, Trophy, Users, X, Zap } from 'lucide-react'
import { useToast } from '../context/ToastContext'
import {
  appearedToday,
  countMembers,
  createGroup,
  getWeeklyRanking,
  joinGroupByCode,
  listGroupMessages,
  listMyGroups,
  type Group,
  type GroupMessage,
  type RankingRow,
} from '../services/groupsService'
import { EmptyState, IconBadge, PremiumCard } from './premium'

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase() || '?'
}

function RankingAvatar({ row }: { row: RankingRow }) {
  if (row.avatar_url) {
    return <img src={row.avatar_url} alt="" className="w-16 h-16 rounded-full object-cover border" style={{ borderColor: 'var(--brand-border)' }} />
  }
  return (
    <div className="w-16 h-16 rounded-full flex items-center justify-center font-black text-lg"
      style={{ background: 'var(--brand-soft)', border: '1px solid var(--brand-border)', color: '#9B8CFF' }}>
      {initials(row.display_name)}
    </div>
  )
}

function EmptySection({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <PremiumCard className="p-5">
      <div className="flex items-start gap-3">
        <IconBadge tone="neutral">{icon}</IconBadge>
        <div>
          <p className="font-black text-base" style={{ color: 'var(--text-primary)' }}>{title}</p>
          <p className="text-sm mt-1 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{text}</p>
        </div>
      </div>
    </PremiumCard>
  )
}

function ModalSheet({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[150] flex flex-col justify-end"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="rounded-t-3xl p-5 pb-10 space-y-3 max-w-md w-full mx-auto"
        style={{ background: 'var(--bg-card)', borderTop: '1px solid var(--border-color)' }}
      >
        <div className="flex items-center justify-between">
          <p className="font-extrabold text-base" style={{ color: 'var(--text-primary)' }}>{title}</p>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export default function GroupsOverview() {
  const navigate = useNavigate()
  const { addToast } = useToast()

  const [groups, setGroups] = useState<(Group & { memberCount?: number })[]>([])
  const [ranking, setRanking] = useState<RankingRow[]>([])
  const [messages, setMessages] = useState<GroupMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [newName, setNewName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [busy, setBusy] = useState(false)

  const loadGroups = useCallback(async () => {
    setLoading(true)
    try {
      const list = await listMyGroups()
      const withCounts = await Promise.all(list.map(async group => ({ ...group, memberCount: await countMembers(group.id) })))
      setGroups(withCounts)

      if (withCounts[0]) {
        const [rows, groupMessages] = await Promise.all([
          getWeeklyRanking(withCounts[0].id),
          listGroupMessages(withCounts[0].id, 3),
        ])
        setRanking(rows)
        setMessages(groupMessages)
      } else {
        setRanking([])
        setMessages([])
      }
    } catch (err) {
      console.error('[GroupsOverview]', err)
      setGroups([])
      setRanking([])
      setMessages([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadGroups()
  }, [loadGroups])

  const handleCreate = async () => {
    if (!newName.trim()) return
    setBusy(true)
    try {
      await createGroup(newName)
      addToast('Grupo criado! Convide seus amigos pelo código.', 'success')
      setNewName('')
      setShowCreate(false)
      await loadGroups()
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
      setJoinCode('')
      setShowJoin(false)
      await loadGroups()
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Erro ao entrar no grupo', 'error')
    } finally {
      setBusy(false)
    }
  }

  const topRows = ranking.slice(0, 3)
  const activeRows = ranking.filter(appearedToday)

  if (loading) {
    return (
      <div className="space-y-4 animate-fade-up">
        <div className="h-40 rounded-[22px] shimmer" />
        <div className="h-52 rounded-[22px] shimmer" />
        <div className="h-28 rounded-[22px] shimmer" />
      </div>
    )
  }

  if (groups.length === 0) {
    return (
      <div className="space-y-5 animate-fade-up">
        <PremiumCard className="p-6">
          <EmptyState
            icon={<Users size={32} />}
            title="Nenhum grupo ainda"
            subtitle="Crie um grupo ou entre em um para acompanhar o progresso com seus amigos."
          />
          <div className="mt-5 grid grid-cols-1 gap-2">
            <button onClick={() => setShowCreate(true)} className="btn-primary w-full py-3 text-sm">
              Criar grupo
            </button>
            <button onClick={() => setShowJoin(true)} className="btn-secondary w-full py-3 text-sm">
              Entrar em um grupo
            </button>
          </div>
        </PremiumCard>

        <EmptySection
          icon={<Trophy size={20} />}
          title="Ranking"
          text="O ranking aparecerá quando seu grupo tiver participantes e atividades reais."
        />
        <EmptySection
          icon={<MessageSquare size={20} />}
          title="Conversas"
          text="As conversas aparecerão quando você participar de um grupo."
        />
        <EmptySection
          icon={<Zap size={20} />}
          title="Atividades dos amigos"
          text="As atividades aparecerão quando houver interações reais no grupo."
        />

        {showCreate && (
          <ModalSheet title="Criar grupo" onClose={() => setShowCreate(false)}>
            <label className="label">Nome do grupo</label>
            <input
              className="input"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Ex: Nutris que postam"
              maxLength={40}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
            />
            <button onClick={handleCreate} disabled={busy || !newName.trim()} className="btn-primary w-full py-3 text-sm mt-2 disabled:opacity-40">
              {busy ? 'Criando...' : 'Criar grupo'}
            </button>
          </ModalSheet>
        )}

        {showJoin && (
          <ModalSheet title="Entrar em um grupo" onClose={() => setShowJoin(false)}>
            <label className="label">Código do convite</label>
            <input
              className="input tracking-[0.2em] uppercase"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              placeholder="EX: ABC123"
              maxLength={6}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
            />
            <button onClick={handleJoin} disabled={busy || !joinCode.trim()} className="btn-primary w-full py-3 text-sm mt-2 disabled:opacity-40">
              {busy ? 'Entrando...' : 'Entrar no grupo'}
            </button>
          </ModalSheet>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-7 animate-fade-up">
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="section-title">Seus grupos</h2>
          <button className="text-sm font-extrabold" style={{ color: '#9B8CFF' }} onClick={() => navigate('/grupos')}>
            Ver todos
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {groups.slice(0, 4).map((group, index) => {
            const Icon = index % 2 === 0 ? Users : Flame
            return (
              <button key={group.id} onClick={() => navigate('/grupos')} className="text-left">
                <PremiumCard className="p-4 min-h-36 flex flex-col justify-between">
                  <IconBadge tone={index % 2 === 0 ? 'purple' : 'orange'}><Icon size={21} /></IconBadge>
                  <div className="mt-4">
                    <p className="text-base font-black leading-tight line-clamp-2" style={{ color: 'var(--text-primary)' }}>{group.name}</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                      {group.memberCount ?? 1} {(group.memberCount ?? 1) === 1 ? 'membro' : 'membros'}
                    </p>
                  </div>
                </PremiumCard>
              </button>
            )
          })}
        </div>
      </section>

      <PremiumCard className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <IconBadge><Trophy size={21} /></IconBadge>
            <div>
              <h2 className="section-title">Ranking da semana</h2>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Atividades reais do grupo</p>
            </div>
          </div>
          <button className="text-sm font-extrabold" style={{ color: '#9B8CFF' }} onClick={() => navigate('/grupos')}>
            Ver ranking
          </button>
        </div>

        {topRows.length > 0 ? (
          <div className="mt-6 grid grid-cols-3 items-end gap-2 text-center">
            {topRows.map((row, index) => {
              const place = index + 1
              return (
                <div key={row.user_id} className="flex flex-col items-center">
                  <span className="mb-2 w-7 h-7 rounded-full flex items-center justify-center text-xs font-black"
                    style={{ background: place === 1 ? 'var(--brand)' : 'var(--bg-surface)', color: '#fff' }}>
                    {place}
                  </span>
                  <RankingAvatar row={row} />
                  <p className="mt-2 text-sm font-black truncate max-w-full" style={{ color: 'var(--text-primary)' }}>{row.display_name}</p>
                  <p className="text-sm font-black tabular-nums" style={{ color: '#9B8CFF' }}>{row.xp} XP</p>
                  <div className={`${place === 1 ? 'h-16' : 'h-10'} mt-3 w-full rounded-t-2xl`}
                    style={{ background: place === 1 ? 'linear-gradient(180deg, rgba(124,92,255,0.55), rgba(124,92,255,0.14))' : 'var(--rank-bar-muted)' }} />
                </div>
              )
            })}
          </div>
        ) : (
          <p className="mt-5 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            O ranking aparecerá quando seu grupo tiver participantes e atividades.
          </p>
        )}
      </PremiumCard>

      <section className="space-y-3">
        <h2 className="section-title">Conversas</h2>
        {messages.length > 0 ? (
          <div className="space-y-2.5">
            {messages.map(message => (
              <button key={message.id} onClick={() => navigate('/grupos')} className="w-full text-left">
                <PremiumCard className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden font-black text-sm"
                    style={{ background: 'var(--brand-soft)', border: '1px solid var(--brand-border)', color: '#9B8CFF' }}>
                    {message.avatar_url
                      ? <img src={message.avatar_url} alt="" className="w-full h-full object-cover" />
                      : initials(message.display_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black truncate" style={{ color: 'var(--text-primary)' }}>{message.display_name}</p>
                    <p className="text-sm truncate" style={{ color: 'var(--text-muted)' }}>{message.content}</p>
                  </div>
                  <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                    {new Date(message.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </PremiumCard>
              </button>
            ))}
          </div>
        ) : (
          <EmptySection
            icon={<MessageSquare size={20} />}
            title="Conversas reais"
            text="Abra um grupo para ver e enviar mensagens no chat real."
          />
        )}
      </section>

      <section className="space-y-3">
        <h2 className="section-title">Atividade dos amigos</h2>
        {activeRows.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {activeRows.slice(0, 4).map(row => (
              <PremiumCard key={row.user_id} className="p-4">
                <IconBadge tone="green" className="mb-3"><Zap size={19} /></IconBadge>
                <p className="text-xs font-black" style={{ color: '#53D6A1' }}>Apareceu hoje</p>
                <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{row.display_name}</p>
              </PremiumCard>
            ))}
          </div>
        ) : (
          <EmptySection
            icon={<Zap size={20} />}
            title="Sem atividade recente"
            text="As atividades dos amigos aparecerão quando houver interações reais no grupo."
          />
        )}
      </section>
    </div>
  )
}

import { supabase } from '../lib/supabase/client'

// ── Serviço de grupos de constância ───────────────────────────────────────────
// Grupos de amigos com ranking semanal por XP de EXECUÇÃO (postou/gravou/missão),
// não por seguidores. Usa RPCs SECURITY DEFINER para entrar por código e calcular
// o ranking lendo eventos de todos os membros com segurança.

export interface Group {
  id: string
  name: string
  invite_code: string
  owner_id: string
  created_at: string
  memberCount?: number
}

export interface RankingRow {
  user_id: string
  display_name: string
  xp: number
  posted: number
  recorded: number
  missions: number
  last_event_at: string | null
}

/** Gera um código de convite curto e legível (sem caracteres ambíguos). */
function generateInviteCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // sem I, O, 0, 1
  let code = ''
  for (let i = 0; i < 6; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)]
  return code
}

/** Lista os grupos do usuário logado (aqueles em que ele é membro). */
export async function listMyGroups(): Promise<Group[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // Pega os group_ids onde sou membro e depois os grupos.
  const { data: memberships, error: mErr } = await supabase
    .from('destravai_group_members')
    .select('group_id')
    .eq('user_id', user.id)

  if (mErr || !memberships || memberships.length === 0) return []

  const ids = memberships.map(m => m.group_id)
  const { data: groups, error: gErr } = await supabase
    .from('destravai_groups')
    .select('*')
    .in('id', ids)
    .order('created_at', { ascending: false })

  if (gErr || !groups) return []
  return groups as Group[]
}

/** Conta membros de um grupo (visível por ser membro, via RLS). */
export async function countMembers(groupId: string): Promise<number> {
  const { count } = await supabase
    .from('destravai_group_members')
    .select('id', { count: 'exact', head: true })
    .eq('group_id', groupId)
  return count ?? 0
}

/** Cria um grupo, vira dono e já entra como membro. Retorna o grupo criado. */
export async function createGroup(name: string): Promise<Group> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Faça login para criar um grupo.')

  const trimmed = name.trim()
  if (!trimmed) throw new Error('Dê um nome ao grupo.')

  // Tenta inserir com um código único; em colisão (rara), tenta de novo.
  let lastErr: unknown = null
  for (let attempt = 0; attempt < 5; attempt++) {
    const invite_code = generateInviteCode()
    const { data, error } = await supabase
      .from('destravai_groups')
      .insert({ name: trimmed, invite_code, owner_id: user.id })
      .select()
      .single()

    if (!error && data) {
      // Dono entra como membro (role owner). RLS permite inserir a si mesmo.
      await supabase
        .from('destravai_group_members')
        .upsert({ group_id: data.id, user_id: user.id, role: 'owner' }, { onConflict: 'group_id,user_id', ignoreDuplicates: true })
      return data as Group
    }
    lastErr = error
  }
  throw new Error(`Não foi possível criar o grupo: ${(lastErr as Error)?.message ?? 'tente novamente'}`)
}

/** Entra em um grupo pelo código de convite (via RPC segura). Retorna o group_id. */
export async function joinGroupByCode(code: string): Promise<string> {
  const clean = code.trim().toUpperCase()
  if (!clean) throw new Error('Informe o código do grupo.')

  const { data, error } = await supabase.rpc('destravai_join_group_by_code', { p_code: clean })
  if (error) throw new Error(error.message.includes('inválido') ? 'Código de grupo inválido.' : `Erro ao entrar: ${error.message}`)
  return data as string
}

/** Sai de um grupo (remove a própria associação). */
export async function leaveGroup(groupId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const { error } = await supabase
    .from('destravai_group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', user.id)
  if (error) throw new Error(`Erro ao sair do grupo: ${error.message}`)
}

/** Início da semana atual (segunda-feira 00:00) em ISO — base do ranking. */
function startOfWeekISO(): string {
  const now = new Date()
  const day = now.getDay() // 0=domingo
  const diff = (day === 0 ? 6 : day - 1) // dias desde segunda
  const monday = new Date(now)
  monday.setDate(now.getDate() - diff)
  monday.setHours(0, 0, 0, 0)
  return monday.toISOString()
}

/** Ranking semanal do grupo, do mais ativo ao menos ativo. */
export async function getWeeklyRanking(groupId: string): Promise<RankingRow[]> {
  const { data, error } = await supabase.rpc('destravai_group_ranking', {
    p_group_id: groupId,
    p_since: startOfWeekISO(),
  })
  if (error || !data) return []
  return (data as RankingRow[]).map(r => ({
    ...r,
    xp: Number(r.xp ?? 0),
    posted: Number(r.posted ?? 0),
    recorded: Number(r.recorded ?? 0),
    missions: Number(r.missions ?? 0),
  }))
}

/** Quem "apareceu hoje" (teve algum evento hoje) — derivado do ranking. */
export function appearedToday(row: RankingRow): boolean {
  if (!row.last_event_at) return false
  const last = new Date(row.last_event_at)
  const today = new Date()
  return last.toDateString() === today.toDateString()
}

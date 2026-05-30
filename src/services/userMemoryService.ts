import { supabase } from '../lib/supabase/client'

// ── Memória do usuário (RAG Nível 1, SEM migration) ───────────────────────────
//
// Deriva "fatos" sobre o usuário a partir de dados que JÁ existem no banco:
//   • destravai_library_items   → o que ele já gerou/salvou/favoritou
//   • destravai_execution_events→ o que ele faz de verdade (postou, gravou)
//
// Esses fatos são injetados nos prompts de geração para a IA "lembrar" do usuário,
// evitar repetição e priorizar o estilo aprovado.
//
// IMPORTANTE: tudo aqui é TOLERANTE A FALHAS. Se qualquer query falhar, retorna
// uma memória vazia e a geração de conteúdo segue idêntica ao comportamento atual.

export interface UserMemory {
  /** Temas/categorias que o usuário mais executa (derivado de tags + categorias). */
  topThemes: string[]
  /** Títulos das ideias geradas recentemente — para a IA NÃO repetir. */
  recentTitles: string[]
  /** Títulos de itens favoritados — sinal do estilo/ângulo que ele aprova. */
  approvedTitles: string[]
  /** Quantos conteúdos ele já marcou como postados (sinal de constância). */
  postedCount: number
  /** Se tem qualquer dado útil. Quando false, o prompt fica idêntico ao de hoje. */
  hasData: boolean
}

const EMPTY_MEMORY: UserMemory = {
  topThemes: [],
  recentTitles: [],
  approvedTitles: [],
  postedCount: 0,
  hasData: false,
}

/** Conta ocorrências e devolve os N termos mais frequentes (normalizados). */
function topN(values: string[], n: number): string[] {
  const counts = new Map<string, number>()
  for (const raw of values) {
    const v = raw?.trim()
    if (!v) continue
    const key = v.toLowerCase()
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k)
}

/**
 * Carrega a memória do usuário logado. Nunca lança — em erro, devolve vazio.
 */
export async function loadUserMemory(): Promise<UserMemory> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return EMPTY_MEMORY

    // Busca em paralelo: itens recentes da biblioteca + eventos de execução.
    const [libRes, evRes] = await Promise.all([
      supabase
        .from('destravai_library_items')
        .select('title, tags, category, is_favorite, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(40),
      supabase
        .from('destravai_execution_events')
        .select('event_type')
        .eq('user_id', user.id)
        .limit(500),
    ])

    const items = (libRes.data ?? []) as Array<{
      title: string | null
      tags: string[] | null
      category: string | null
      is_favorite: boolean | null
    }>
    const events = (evRes.data ?? []) as Array<{ event_type: string }>

    // Temas: combina tags + categorias de tudo que ele gerou.
    const themeBag: string[] = []
    for (const it of items) {
      if (it.category) themeBag.push(it.category)
      for (const t of it.tags ?? []) themeBag.push(t)
    }

    const recentTitles = items
      .slice(0, 15)
      .map(i => i.title ?? '')
      .filter(Boolean)

    const approvedTitles = items
      .filter(i => i.is_favorite)
      .map(i => i.title ?? '')
      .filter(Boolean)
      .slice(0, 8)

    const postedCount = events.filter(e => e.event_type === 'posted').length

    const topThemes = topN(themeBag, 6)

    const hasData = topThemes.length > 0 || recentTitles.length > 0

    return { topThemes, recentTitles, approvedTitles, postedCount, hasData }
  } catch {
    // Telemetria/derivação nunca pode atrapalhar a geração de conteúdo.
    return EMPTY_MEMORY
  }
}

/**
 * Monta o bloco de texto que será concatenado ao prompt. Retorna string VAZIA
 * quando não há dados — assim o prompt fica idêntico ao comportamento atual.
 */
export function buildMemoryBlock(memory: UserMemory | null | undefined): string {
  if (!memory || !memory.hasData) return ''

  const lines: string[] = ['', '═══════════════════════════════', 'MEMÓRIA DESTE USUÁRIO', '═══════════════════════════════']

  if (memory.topThemes.length > 0) {
    lines.push(`Costuma criar conteúdo sobre: ${memory.topThemes.join(', ')}`)
  }
  if (memory.approvedTitles.length > 0) {
    lines.push(`Estilo/ângulos que ele aprovou (favoritos): ${memory.approvedTitles.join(' | ')}`)
  }
  if (memory.recentTitles.length > 0) {
    lines.push(`Já gerou recentemente — NÃO repita estes ângulos: ${memory.recentTitles.join(' | ')}`)
  }
  if (memory.postedCount > 0) {
    lines.push(`Já postou ${memory.postedCount} conteúdo(s) — valorize a continuidade da jornada dele.`)
  }

  lines.push('Use isso para personalizar ainda mais e trazer um ângulo NOVO, sem repetir o que já foi feito.')

  return lines.join('\n')
}

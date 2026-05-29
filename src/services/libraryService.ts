import { supabase } from '../lib/supabase/client'
import type { LibraryItem, LibraryItemType } from '../lib/supabase/types'

export interface LibraryFilters {
  type?: LibraryItemType
  category?: string
  isFavorite?: boolean
  search?: string
  page?: number
  pageSize?: number
}

export async function getLibraryItems(
  filters: LibraryFilters = {}
): Promise<{ items: LibraryItem[]; total: number }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { items: [], total: 0 }

  const { type, category, isFavorite, search, page = 1, pageSize = 20 } = filters
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('destravai_library_items')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (type) query = query.eq('type', type)
  if (category) query = query.eq('category', category)
  if (isFavorite) query = query.eq('is_favorite', true)
  if (search) {
    // Escapa caracteres que têm significado no filtro PostgREST (`,` separa
    // condições no .or(), `%`/`_` são curingas do ILIKE, `(` `)` agrupam, `\`
    // é escape). Sem isso, uma busca com vírgula/parêntese quebra a query.
    const safe = search.replace(/[\\%_,()]/g, m => `\\${m}`)
    query = query.or(`title.ilike.%${safe}%,content.ilike.%${safe}%`)
  }

  const { data, error, count } = await query

  if (error) throw new Error(`Erro ao buscar biblioteca: ${error.message}`)
  return { items: data ?? [], total: count ?? 0 }
}

export async function hasLibraryItems(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { count } = await supabase
    .from('destravai_library_items')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  return (count ?? 0) > 0
}

export async function createLibraryItem(
  item: Omit<LibraryItem, 'id' | 'user_id' | 'created_at' | 'updated_at'>
): Promise<LibraryItem> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Usuário não autenticado')

  const { data, error } = await supabase
    .from('destravai_library_items')
    .insert({ ...item, user_id: user.id })
    .select()
    .single()

  if (error) throw new Error(`Erro ao criar item: ${error.message}`)
  return data
}

export async function createLibraryItemsBatch(
  items: Omit<LibraryItem, 'id' | 'user_id' | 'created_at' | 'updated_at'>[]
): Promise<LibraryItem[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Usuário não autenticado')

  const payload = items.map(item => ({ ...item, user_id: user.id }))

  const { data, error } = await supabase
    .from('destravai_library_items')
    .insert(payload)
    .select()

  if (error) throw new Error(`Erro ao criar itens em lote: ${error.message}`)
  return data ?? []
}

export async function updateLibraryItem(
  id: string,
  updates: Partial<Pick<LibraryItem, 'title' | 'content' | 'tags' | 'category' | 'status' | 'is_favorite' | 'metadata'>>
): Promise<LibraryItem> {
  const { data, error } = await supabase
    .from('destravai_library_items')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(`Erro ao atualizar item: ${error.message}`)
  return data
}

export async function toggleFavorite(id: string, current: boolean): Promise<void> {
  const { error } = await supabase
    .from('destravai_library_items')
    .update({ is_favorite: !current, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw new Error(`Erro ao favoritar item: ${error.message}`)
}

export async function deleteLibraryItem(id: string): Promise<void> {
  const { error } = await supabase
    .from('destravai_library_items')
    .delete()
    .eq('id', id)

  if (error) throw new Error(`Erro ao excluir item: ${error.message}`)
}

export async function duplicateLibraryItem(id: string): Promise<LibraryItem> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Usuário não autenticado')

  const { data: original, error: fetchError } = await supabase
    .from('destravai_library_items')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError) throw new Error(`Erro ao buscar item original: ${fetchError.message}`)

  const { id: _id, created_at: _c, updated_at: _u, ...rest } = original

  const { data, error } = await supabase
    .from('destravai_library_items')
    .insert({ ...rest, title: `${rest.title} (cópia)`, user_id: user.id })
    .select()
    .single()

  if (error) throw new Error(`Erro ao duplicar item: ${error.message}`)
  return data
}

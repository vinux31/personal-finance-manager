import { supabase } from '@/lib/supabase'

export interface Category {
  id: number
  name: string
  type: 'income' | 'expense'
  icon: string | null
}

export async function listCategories(type?: 'income' | 'expense'): Promise<Category[]> {
  let query = supabase
    .from('categories')
    .select('id, name, type, icon')
    .order('name')

  if (type) query = query.eq('type', type)

  const { data, error } = await query
  if (error) throw error
  return data as Category[]
}

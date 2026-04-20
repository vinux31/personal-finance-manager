import { supabase } from '@/lib/supabase'

export interface Profile {
  id: string
  is_admin: boolean
  display_name: string | null
  created_at: string
}

export async function listProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, is_admin, display_name, created_at')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data as Profile[]
}

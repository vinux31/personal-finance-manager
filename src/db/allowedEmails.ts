import { supabase } from '@/lib/supabase'

export interface AllowedEmail {
  id: number
  email: string
  added_by: string | null
  created_at: string
}

export async function listAllowedEmails(): Promise<AllowedEmail[]> {
  const { data, error } = await supabase
    .from('allowed_emails')
    .select('id, email, added_by, created_at')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data as AllowedEmail[]
}

export async function addAllowedEmail(email: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase
    .from('allowed_emails')
    .insert({ email: email.trim().toLowerCase(), added_by: user?.id })
  if (error) throw error
}

export async function removeAllowedEmail(id: number): Promise<void> {
  const { error } = await supabase.from('allowed_emails').delete().eq('id', id)
  if (error) throw error
}

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { type Session, type User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

interface AuthContextValue {
  session: Session | null
  user: User | null
  loading: boolean
  isAdmin: boolean
  signIn: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  async function upsertProfile(userId: string, meta: Record<string, any>) {
    await supabase.from('profiles').upsert(
      { id: userId, display_name: meta?.full_name ?? null },
      { onConflict: 'id', ignoreDuplicates: false }
    )
    const { data } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', userId)
      .single()
    setIsAdmin(data?.is_admin ?? false)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        // Refresh token gagal saat startup (e.g. clock skew / "Refresh Token Not Found")
        console.error('[AuthProvider] getSession error:', error)
        toast.error('Sesi berakhir, silakan login kembali')
        supabase.auth.signOut()
        setSession(null)
        setIsAdmin(false)
        setLoading(false)
        return
      }
      setSession(data.session)
      if (data.session?.user) {
        upsertProfile(data.session.user.id, data.session.user.user_metadata)
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Token refresh failed → session becomes null (D-10, D-11)
      if (event === 'TOKEN_REFRESHED' && !session) {
        console.error('[AuthProvider] Token refresh failed')
        toast.error('Sesi berakhir, silakan login kembali')
        supabase.auth.signOut()
        setSession(null)
        setIsAdmin(false)
        return
      }
      setSession(session)
      if (session?.user) {
        upsertProfile(session.user.id, session.user.user_metadata)
      } else {
        setIsAdmin(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signIn() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, isAdmin, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuthContext() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider')
  return ctx
}

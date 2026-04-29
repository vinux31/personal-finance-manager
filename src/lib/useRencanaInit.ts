import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/auth/useAuth'

/**
 * Seeds RENCANA goals + investments on first Dashboard load via the
 * `seed_rencana` RPC (CONS-03). The RPC is idempotent (marker-only dedup
 * via `user_seed_markers` table — see migration 0022) so spurious calls
 * are safe; we still cache a per-user localStorage flag (D-08) to skip
 * the network roundtrip on subsequent loads in the same session.
 *
 * Per-user key: `rencana_seeded_${user.id}` (NOT global — UX-01 fix).
 */
export function useRencanaInit() {
  const qc = useQueryClient()
  const { user } = useAuth()

  useEffect(() => {
    if (!user?.id) return
    const seedKey = `rencana_seeded_${user.id}`
    if (localStorage.getItem(seedKey)) return // fast-path cache (D-08)

    supabase
      .rpc('seed_rencana', { p_uid: null })
      .then(({ error }) => {
        if (error) {
          console.error('seed_rencana RPC failed:', error)
          return
        }
        localStorage.setItem(seedKey, '1')
        qc.invalidateQueries({ queryKey: ['goals'] })
        qc.invalidateQueries({ queryKey: ['investments'] })
      })
      .catch((err) => console.error('seed_rencana threw:', err))
  }, [user?.id, qc])
}

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { seedRencanaGoals } from '@/db/goals'
import { seedRencanaInvestments } from '@/db/investments'
import { useAuth } from '@/auth/useAuth'

export function useRencanaInit() {
  const qc = useQueryClient()
  const { user } = useAuth()

  useEffect(() => {
    // Skip if user is not authenticated
    if (!user?.id) return

    const seedKey = `rencana_seeded_${user.id}`

    if (localStorage.getItem(seedKey)) return
    Promise.all([seedRencanaGoals(), seedRencanaInvestments()])
      .then(() => {
        localStorage.setItem(seedKey, '1')
        qc.invalidateQueries({ queryKey: ['goals'] })
        qc.invalidateQueries({ queryKey: ['investments'] })
      })
      .catch(console.error)
  }, [user?.id, qc])
}

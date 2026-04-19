import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { seedRencanaGoals } from '@/db/goals'
import { seedRencanaInvestments } from '@/db/investments'

const SEED_KEY = 'rencana_seeded'

export function useRencanaInit() {
  const qc = useQueryClient()
  useEffect(() => {
    if (localStorage.getItem(SEED_KEY)) return
    Promise.all([seedRencanaGoals(), seedRencanaInvestments()])
      .then(() => {
        localStorage.setItem(SEED_KEY, '1')
        qc.invalidateQueries({ queryKey: ['goals'] })
        qc.invalidateQueries({ queryKey: ['investments'] })
      })
      .catch(console.error)
  }, [])
}

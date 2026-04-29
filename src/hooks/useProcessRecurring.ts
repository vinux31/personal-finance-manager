import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTargetUserId } from '@/auth/useTargetUserId'
import { supabase } from '@/lib/supabase'
import { todayISO } from '@/lib/format'
import { mapSupabaseError } from '@/lib/errors'

export function useProcessRecurring() {
  const uid = useTargetUserId()
  const qc = useQueryClient()

  useEffect(() => {
    if (!uid) return
    supabase
      .rpc('process_due_recurring', { p_today: todayISO(), p_uid: uid })
      .then(({ data, error }) => {
        if (error) {
          console.error(mapSupabaseError(error))
          return
        }
        const row = Array.isArray(data) ? data[0] : data
        if (row?.processed_count > 0) {
          qc.invalidateQueries({ queryKey: ['transactions'] })
          qc.invalidateQueries({ queryKey: ['recurring-templates'] })
          toast.success(`${row.processed_count} transaksi rutin diproses`)
        }
      })
  }, [uid]) // eslint-disable-line react-hooks/exhaustive-deps
}

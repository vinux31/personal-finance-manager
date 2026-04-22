// src/queries/pensiun.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  getPensionSim,
  upsertPensionSim,
  type PensionSimRow,
  type PensionSimInput,
} from '@/db/pensiun'
import { mapSupabaseError } from '@/lib/errors'
import { useTargetUserId } from '@/auth/useTargetUserId'

export type { PensionSimRow, PensionSimInput }

export function usePensionSim() {
  const uid = useTargetUserId()
  return useQuery({
    queryKey: ['pension-sim', uid],
    queryFn: () => getPensionSim(uid!),
    enabled: !!uid,
    staleTime: 5 * 60 * 1000,
  })
}

export function useUpsertPensionSim() {
  const uid = useTargetUserId()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: PensionSimInput) => upsertPensionSim(uid!, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pension-sim', uid] })
    },
    onError: (e) => toast.error(mapSupabaseError(e)),
  })
}

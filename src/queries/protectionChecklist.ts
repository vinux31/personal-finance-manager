import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { mapSupabaseError } from '@/lib/errors'
import { useTargetUserId } from '@/auth/useTargetUserId'
import { useViewAs } from '@/auth/useViewAs'
import {
  getProtectionChecklist,
  upsertProtectionChecklist,
  type ProtectionChecklistRow,
  type ProtectionChecklistPatch,
} from '@/db/protectionChecklist'

/**
 * Read-only hook for protection_checklist row. Phase 14 PROMOTED from
 * src/queries/kesehatanIndikator.ts inline definition (Phase 13).
 *
 * CRITICAL — query key MUST stay `['kesehatan', 'protection-checklist', targetUid]`
 * (verbatim Phase 13 key at kesehatanIndikator.ts:63). Mismatch = stale indicator
 * post-mutation.
 *
 * Phase 14 widens select '*' (was: 'user_id, health_coverage') so Tier 4 compute
 * (Plan 14-03) reads has_dependents + life_* + estate_* fields.
 *
 * View-As compatibility: useTargetUserId() returns viewingAs?.uid ?? user?.id.
 * Admin View-As reads viewed user's row (RLS allows OR is_admin()).
 */
export function useProtectionChecklist() {
  const targetUid = useTargetUserId()
  return useQuery<ProtectionChecklistRow | null>({
    queryKey: ['kesehatan', 'protection-checklist', targetUid],
    enabled: !!targetUid,
    queryFn: async () => {
      if (!targetUid) return null
      return getProtectionChecklist(targetUid)
    },
    staleTime: 60_000,
  })
}

/**
 * Optimistic mutation for protection_checklist. Pattern verbatim from
 * src/queries/recurringTransactions.ts:83-124 (useMarkBillPaid canonical).
 *
 * Decision F (CONTEXT.md): View-As defensive guard throws BEFORE supabase call —
 * defense-in-depth alongside RLS WITH CHECK auth.uid() = user_id (would 42501).
 *
 * Pitfall 4 mitigation: ALWAYS use updater form with explicit spread merging old
 * + patch — never replace whole row. Otherwise edits to one field nuke other fields.
 *
 * onSettled invalidates ['kesehatan', 'protection-checklist', uid] only — useIndikator
 * depends on this same query, so single invalidation triggers full Phase 13 indicator
 * recompute via useMemo.
 */
export function useUpdateProtectionChecklist() {
  const qc = useQueryClient()
  const uid = useTargetUserId()
  const { viewingAs } = useViewAs()

  return useMutation({
    mutationFn: async (patch: ProtectionChecklistPatch) => {
      // Decision F: View-As defensive guard. Throws plain Error caught by onError →
      // mapSupabaseError surfaces toast. RLS 42501 is fallback if guard ever bypassed.
      if (viewingAs !== null) {
        throw new Error('Tidak boleh modify data user lain (View-As mode)')
      }
      if (!uid) throw new Error('Unauthenticated')
      return upsertProtectionChecklist(uid, patch)
    },

    onMutate: async (patch) => {
      // MUST match queryKey at useProtectionChecklist above + Phase 13 wired path.
      const queryKey = ['kesehatan', 'protection-checklist', uid] as const
      await qc.cancelQueries({ queryKey })
      const snapshot = qc.getQueryData<ProtectionChecklistRow | null>(queryKey)

      // Pitfall 4 mitigation: spread merge — never replace whole row.
      qc.setQueryData<ProtectionChecklistRow | null>(queryKey, (old) => ({
        ...(old ?? { user_id: uid! }),
        ...patch,
      }) as ProtectionChecklistRow)

      return { snapshot, queryKey }
    },

    onError: (err, _patch, ctx) => {
      if (ctx) qc.setQueryData(ctx.queryKey, ctx.snapshot)
      toast.error(mapSupabaseError(err))
    },

    onSuccess: () => {
      toast.success('Tersimpan')
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['kesehatan', 'protection-checklist', uid] })
    },
  })
}

// Re-export type for downstream Plans 14-02 / 14-03 convenience
export type { ProtectionChecklistRow, ProtectionChecklistPatch }

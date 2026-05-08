import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useTargetUserId } from '@/auth/useTargetUserId'

/**
 * Empty state threshold untuk DIAG-11 — total rows < 3 = welcome state.
 * Konstanta supaya gampang adjust pasca-rilis (per STATE.md blockers/concerns:
 * "simpan threshold sebagai konstanta di src/queries/kesehatan.ts (bukan inline)
 * supaya gampang adjust pasca-rilis").
 */
export const EMPTY_STATE_THRESHOLD = 3

type CountResult = {
  total: number
  transactions: number
  accounts: number
  goals: number
  investments: number
}

/**
 * useTotalDataCount — count agregat dari 4 tabel data utama.
 *
 * Tujuan: trigger empty state DIAG-11 saat user baru (total < 3).
 *
 * View-As: pakai `useTargetUserId()` supaya admin View-As lihat empty state
 * berdasarkan data user yang di-view, bukan admin sendiri.
 *
 * Implementation: 4 parallel `select count:exact head:true` queries — lightweight
 * (no row fetch), RLS otomatis enforce ownership via auth.uid(). Untuk admin
 * View-As (impersonate other user), pakai filter `.eq('user_id', targetUid)`
 * — RLS USING clause `auth.uid() = user_id OR is_admin()` allow admin baca.
 *
 * Performance trade-off (per CONTEXT.md Claude's discretion):
 *   - Parallel 4 useQuery vs single RPC agregate: pilih parallel — simpler,
 *     no RPC needed, react-query default cache OK.
 *   - count:exact head:true → server returns count via Postgres count(*),
 *     no row data transferred. Sub-100ms typical.
 */
export function useTotalDataCount() {
  const targetUid = useTargetUserId()

  return useQuery<CountResult>({
    queryKey: ['kesehatan', 'totalDataCount', targetUid],
    enabled: !!targetUid,
    queryFn: async () => {
      if (!targetUid) {
        // Defensive — `enabled` flag should prevent this path
        return { total: 0, transactions: 0, accounts: 0, goals: 0, investments: 0 }
      }

      // 4 parallel HEAD count queries
      const [txRes, accRes, goalRes, invRes] = await Promise.all([
        supabase
          .from('transactions')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', targetUid),
        supabase
          .from('net_worth_accounts')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', targetUid),
        supabase
          .from('goals')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', targetUid),
        supabase
          .from('investments')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', targetUid),
      ])

      // Defensive — kalau ada error di salah satu query, log + treat sebagai 0.
      // Avoid crashing landing — empty state lebih baik dari blank screen.
      const transactions = txRes.error ? 0 : (txRes.count ?? 0)
      const accounts = accRes.error ? 0 : (accRes.count ?? 0)
      const goals = goalRes.error ? 0 : (goalRes.count ?? 0)
      const investments = invRes.error ? 0 : (invRes.count ?? 0)

      if (txRes.error || accRes.error || goalRes.error || invRes.error) {
        console.warn('[useTotalDataCount] partial error', {
          tx: txRes.error?.message,
          acc: accRes.error?.message,
          goal: goalRes.error?.message,
          inv: invRes.error?.message,
        })
      }

      return {
        total: transactions + accounts + goals + investments,
        transactions,
        accounts,
        goals,
        investments,
      }
    },
    // staleTime 60s — total count tidak perlu re-fetch agresif; user baru baru-baru ini
    // tambah row, count update di mutation invalidation existing (transactions/accounts/etc).
    // Default react-query staleTime 0 → unnecessary refetch saat tab focus. Override jadi 60s.
    staleTime: 60_000,
  })
}

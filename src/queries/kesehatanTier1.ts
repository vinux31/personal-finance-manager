import type { Transaction } from '@/db/transactions'
import type { NetWorthAccount, NetWorthLiability } from '@/db/netWorth'
import type { Investment } from '@/db/investments'
import type { IndikatorResult } from './kesehatanTypes'

/**
 * STUB Wave 1 — Wave 2 13-02 akan replace dengan compute real per spec §4.
 *
 * Untuk sementara return placeholder-data-tipis supaya:
 * - TS compile bersih
 * - UI render IndikatorCard "Butuh data" — testable end-to-end Wave 1
 * - Wave 2 13-02 swap implementation tanpa modify import di kesehatanIndikator.ts
 */

export type ProtectionChecklistRow = {
  user_id: string
  health_coverage: 'kantor' | 'bpjs' | 'pribadi' | 'kombinasi' | 'tidak' | null
  // ... field lain (irrelevant untuk Tier 1 #4 shell — Phase 14 deliver mutation form)
}

export function computeDanaDarurat(
  _accounts: NetWorthAccount[],
  _transactions: Transaction[],
): IndikatorResult {
  return { kind: 'placeholder-data-tipis', monthsAvailable: 0, ctaTo: '/transaksi' }
}

export function computeSavingsRate(_transactions: Transaction[]): IndikatorResult {
  return { kind: 'placeholder-data-tipis', monthsAvailable: 0, ctaTo: '/transaksi' }
}

export function computeDARKonsumtif(
  _accounts: NetWorthAccount[],
  _liabilities: NetWorthLiability[],
  _investments: Investment[],
): IndikatorResult {
  return { kind: 'compute', value: 0, color: 'green', display: '—' }
}

/** Info-only DAR Total — render di Tier 1 panel info row, BUKAN indikator warna. */
export function computeDARTotal(
  _accounts: NetWorthAccount[],
  _liabilities: NetWorthLiability[],
  _investments: Investment[],
): { value: number; display: string; kprFraction: number } | null {
  return null
}

/**
 * Tier 1 #4 Asuransi Kesehatan — SHELL only di Phase 13.
 * Phase 14 deliver mutation form untuk write protection_checklist.health_coverage.
 * Phase 13 cuma read existing row kalau ada, else "belum diisi" placeholder.
 */
export function computeAsuransiShell(
  row: ProtectionChecklistRow | null | undefined,
): IndikatorResult {
  if (!row || !row.health_coverage || row.health_coverage === 'tidak') {
    return { kind: 'compute', value: 0, color: 'red', display: 'Belum diisi' }
  }
  return { kind: 'compute', value: 1, color: 'green', display: row.health_coverage }
}

import type { NetWorthAccount } from '@/db/netWorth'
import type { Investment } from '@/db/investments'
import type { IndikatorResult } from './kesehatanTypes'

/** STUB Wave 1 — Wave 2 13-04 akan replace. */

export function computeRasioInvestasi(
  _accounts: NetWorthAccount[],
  _investments: Investment[],
): IndikatorResult {
  return { kind: 'compute', value: 0, color: 'red', display: '0%' }
}

export function computeDiversifikasi(
  _investments: Investment[],
  _accounts: NetWorthAccount[],
): IndikatorResult {
  return { kind: 'compute', value: 0, color: 'red', display: '0 kelas aset' }
}

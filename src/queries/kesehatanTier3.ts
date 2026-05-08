import type { NetWorthAccount } from '@/db/netWorth'
import type { Investment } from '@/db/investments'
import { currentValue } from '@/db/investments'
import {
  THRESHOLDS,
  type IndikatorColor,
  type IndikatorResult,
} from './kesehatanTypes'
import { totalAsetFinansial } from './kesehatanTier1'

// ============================================================
// Tier 3 — PERTUMBUHAN compute logic
// ============================================================
//
// Reuses totalAsetFinansial helper dari kesehatanTier1.ts agar denominator
// konsisten antara DAR Konsumtif (Tier 1 #3), DAR Total (info), dan Rasio
// Investasi (Tier 3 #7).
//   = SUM(accounts WHERE type IN FINANCIAL_TYPES) + SUM(currentValue(inv))
//   - FINANCIAL_TYPES dari kesehatanTypes.ts: tabungan/giro/cash/dompet_digital/deposito
//   - EXCLUDE: properti, kendaraan (per spec §4 + STATE.md decisions)
// ============================================================

// ============================================================
// #7 computeRasioInvestasi (DIAG-07)
// ============================================================
//
// Formula: (investments + deposito) ÷ aset finansial
// Threshold: ≥40% hijau, 20-39% kuning, <20% merah
// Properti & kendaraan EXCLUDE dari denominator (sudah handled via FINANCIAL_TYPES filter)
//
// T-13-19 mitigation: aset finansial = 0 → red "— (belum ada aset)"
// degraded display (acceptable: user 0 aset = high incentive default).
// ============================================================
export function computeRasioInvestasi(
  accounts: NetWorthAccount[],
  investments: Investment[],
): IndikatorResult {
  const asetFinansial = totalAsetFinansial(accounts, investments)

  if (asetFinansial === 0) {
    // Edge case: belum punya aset finansial sama sekali → red default
    // (high incentive to start, ikut tier aggregation as red).
    return {
      kind: 'compute',
      value: 0,
      color: 'red',
      display: '— (belum ada aset)',
    }
  }

  const deposito = accounts
    .filter(a => a.type === 'deposito')
    .reduce((s, a) => s + a.balance, 0)
  const invValue = investments.reduce((s, inv) => s + currentValue(inv), 0)
  const numerator = invValue + deposito

  const pct = (numerator / asetFinansial) * 100

  const color: IndikatorColor =
    pct >= THRESHOLDS.rasioInvestasi.green
      ? 'green'
      : pct >= THRESHOLDS.rasioInvestasi.yellow
      ? 'yellow'
      : 'red'

  return {
    kind: 'compute',
    value: pct,
    color,
    display: `${pct.toFixed(0)}%`,
  }
}

// ============================================================
// #8 computeDiversifikasi (DIAG-08)
// ============================================================
//
// Formula: COUNT(DISTINCT asset_type normalized) + (1 if deposito balance > 0)
// Threshold: ≥3 hijau, 2 kuning, ≤1 merah
//
// asset_type normalization (per CONTEXT.md decision D-asset_type-normalize):
//   - lowercase + trim sebelum DISTINCT
//   - Partial mitigation Risk 5 (TEXT bebas — user bisa game count).
//   - Examples:
//     "Saham BBCA" + "saham bbca" + "  Saham BBCA  " → 1 distinct type (post-normalize)
//     "Reksadana"  + "reksa dana"  → 2 distinct types (no semantic dedup di v1.2)
//   - Trade-off: partial protection vs over-engineering. Full normalize ke 5 standar
//     deferred ke v1.3 per spec out-of-scope (T-13-21 partial mitigation).
//
// Deposito bonus:
//   - +1 jika ada minimal 1 account type='deposito' dengan balance > 0
//   - Deposito dianggap kelas aset terpisah dari investments
//
// T-13-22 mitigation: empty string asset_type post-trim filtered via .length>0
// T-13-24 mitigation: closed positions (currentValue=0) skipped via filter (defense-in-depth
// dengan listInvestments .gt('quantity', 0) di server-side).
// ============================================================
export function computeDiversifikasi(
  investments: Investment[],
  accounts: NetWorthAccount[],
): IndikatorResult {
  // Normalize asset_type: lowercase + trim, skip closed positions + empty strings
  const distinctTypes = new Set<string>(
    investments
      .filter(inv => currentValue(inv) > 0)
      .map(i => i.asset_type.toLowerCase().trim())
      .filter(t => t.length > 0),
  )

  const distinctCount = distinctTypes.size

  const hasDeposito = accounts.some(a => a.type === 'deposito' && a.balance > 0)
  const score = distinctCount + (hasDeposito ? 1 : 0)

  const color: IndikatorColor =
    score >= THRESHOLDS.diversifikasi.green
      ? 'green'
      : score >= THRESHOLDS.diversifikasi.yellow
      ? 'yellow'
      : 'red'

  return {
    kind: 'compute',
    value: score,
    color,
    display: `${score} kelas aset`,
  }
}

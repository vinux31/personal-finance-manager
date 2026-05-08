import type { Transaction } from '@/db/transactions'
import type { NetWorthAccount, NetWorthLiability } from '@/db/netWorth'
import type { Investment } from '@/db/investments'
import { currentValue } from '@/db/investments'
import {
  LIQUID_TYPES,
  FINANCIAL_TYPES,
  KONSUMTIF_LIAB_TYPES,
  THRESHOLDS,
  type IndikatorColor,
  type IndikatorResult,
} from './kesehatanTypes'

// ============================================================
// ProtectionChecklistRow
// ============================================================
//
// Single source of truth untuk shape protection_checklist row yang relevan
// untuk Tier 1 #4 shell. Phase 14 mutation form akan extend type ini (atau
// move ke src/db/protectionChecklist.ts) saat menambah field has_dependents,
// life_*, estate_*. Phase 13 cuma butuh health_coverage.
export type ProtectionChecklistRow = {
  user_id: string
  health_coverage: 'kantor' | 'bpjs' | 'pribadi' | 'kombinasi' | 'tidak' | null
}

// ============================================================
// Helper: distinct calendar months dari array transactions
// ============================================================
function distinctMonths(
  transactions: Transaction[],
  filterType?: 'income' | 'expense',
): string[] {
  const months = new Set<string>()
  for (const t of transactions) {
    if (filterType && t.type !== filterType) continue
    months.add(t.date.substring(0, 7)) // 'YYYY-MM'
  }
  return [...months].sort()
}

// ============================================================
// #1 computeDanaDarurat (DIAG-01) — bulan dana darurat
// ============================================================
//
// Formula spec §4: bulan = SUM(akun likuid) ÷ avg(expense bulanan, 3 bulan kalender).
// Threshold: ≥6 hijau, 3-5 kuning, <3 merah.
// Edge case (DIAG-10): <3 bulan kalender expense → placeholder-data-tipis (tidak ikut
// agregasi warna tier).
export function computeDanaDarurat(
  accounts: NetWorthAccount[],
  transactions: Transaction[],
): IndikatorResult {
  const expenseMonths = distinctMonths(transactions, 'expense')
  if (expenseMonths.length < 3) {
    return {
      kind: 'placeholder-data-tipis',
      monthsAvailable: expenseMonths.length,
      ctaTo: '/transaksi',
    }
  }

  const last3Months = expenseMonths.slice(-3)
  const recentExpenses = transactions.filter(
    t => t.type === 'expense' && last3Months.includes(t.date.substring(0, 7)),
  )
  const totalExpense3mo = recentExpenses.reduce((s, t) => s + t.amount, 0)
  const avgExpenseBulanan = totalExpense3mo / 3

  // T-13-07 mitigation: divide-by-zero guard. Treat as data-tipis kalau tx expense
  // semua 0 — user belum representatif (tidak ikut aggregation).
  if (avgExpenseBulanan === 0) {
    return {
      kind: 'placeholder-data-tipis',
      monthsAvailable: expenseMonths.length,
      ctaTo: '/transaksi',
    }
  }

  const totalLikuid = accounts
    .filter(a => (LIQUID_TYPES as readonly string[]).includes(a.type))
    .reduce((s, a) => s + a.balance, 0)

  const bulan = totalLikuid / avgExpenseBulanan
  const color: IndikatorColor =
    bulan >= THRESHOLDS.danaDarurat.green
      ? 'green'
      : bulan >= THRESHOLDS.danaDarurat.yellow
      ? 'yellow'
      : 'red'

  return {
    kind: 'compute',
    value: bulan,
    color,
    display: `${bulan.toFixed(1)} bulan`,
  }
}

// ============================================================
// #2 computeSavingsRate (DIAG-02) — savings rate 3-bulan avg
// ============================================================
//
// Formula spec §4: per-bulan rate = (income − expense) / income, average per bulan
// kalender lalu rata-rata 3 bulan. Threshold ≥20% hijau, 10-19% kuning, <10% merah.
// Edge case (DIAG-10): <3 bulan kalender → placeholder-data-tipis.
//
// Catatan: kalau income 0 di bulan tertentu → rate = 0 (bukan -Infinity dari division).
// Per-bulan dibatasi 0; rata-rata bisa negatif (expense > income).
export function computeSavingsRate(transactions: Transaction[]): IndikatorResult {
  const allMonths = distinctMonths(transactions)
  if (allMonths.length < 3) {
    return {
      kind: 'placeholder-data-tipis',
      monthsAvailable: allMonths.length,
      ctaTo: '/transaksi',
    }
  }

  const last3Months = allMonths.slice(-3)

  const rates = last3Months.map(m => {
    const mTx = transactions.filter(t => t.date.startsWith(m))
    const income = mTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const expense = mTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    return income > 0 ? (income - expense) / income : 0
  })

  const avgRate = rates.reduce((s, r) => s + r, 0) / rates.length
  const pct = avgRate * 100

  const color: IndikatorColor =
    pct >= THRESHOLDS.savingsRate.green
      ? 'green'
      : pct >= THRESHOLDS.savingsRate.yellow
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
// Helper: aset finansial (denominator DAR & Rasio Investasi)
// ============================================================
function totalAsetFinansial(
  accounts: NetWorthAccount[],
  investments: Investment[],
): number {
  const fromAccounts = accounts
    .filter(a => (FINANCIAL_TYPES as readonly string[]).includes(a.type))
    .reduce((s, a) => s + a.balance, 0)
  const fromInv = investments.reduce((s, inv) => s + currentValue(inv), 0)
  return fromAccounts + fromInv
}

// ============================================================
// #3 computeDARKonsumtif (DIAG-03) — INVERTED threshold
// ============================================================
//
// Formula spec §4: SUM(liabilities WHERE type ≠ 'kpr') ÷ aset finansial × 100.
// Threshold INVERTED (semakin kecil semakin hijau):
//   <20% hijau, 20-40% kuning, >40% merah.
//
// T-13-08 mitigation: aset 0 → red "— (perlu aset)" sebagai degraded display
// (acceptable: user 0 aset = high financial risk default).
export function computeDARKonsumtif(
  accounts: NetWorthAccount[],
  liabilities: NetWorthLiability[],
  investments: Investment[],
): IndikatorResult {
  const asetFinansial = totalAsetFinansial(accounts, investments)

  if (asetFinansial === 0) {
    return {
      kind: 'compute',
      value: 0,
      color: 'red',
      display: '— (perlu aset)',
    }
  }

  const konsumtif = liabilities
    .filter(l => (KONSUMTIF_LIAB_TYPES as readonly string[]).includes(l.type))
    .reduce((s, l) => s + l.amount, 0)

  const pct = (konsumtif / asetFinansial) * 100

  // INVERTED threshold (T-13-10 mitigation):
  //   pct < green  → green
  //   pct <= yellow → yellow
  //   pct > yellow  → red
  const color: IndikatorColor =
    pct < THRESHOLDS.darKonsumtif.green
      ? 'green'
      : pct <= THRESHOLDS.darKonsumtif.yellow
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
// DAR Total — info-only (BUKAN indikator warna)
// ============================================================
//
// Formula: SUM(all liabilities) ÷ aset finansial × 100, plus kprFraction = SUM(kpr) / total.
// Returns null kalau aset 0 ATAU total liabilities 0 (nothing meaningful to display).
export function computeDARTotal(
  accounts: NetWorthAccount[],
  liabilities: NetWorthLiability[],
  investments: Investment[],
): { value: number; display: string; kprFraction: number } | null {
  const asetFinansial = totalAsetFinansial(accounts, investments)
  if (asetFinansial === 0) return null

  const total = liabilities.reduce((s, l) => s + l.amount, 0)
  if (total === 0) return null

  const kpr = liabilities.filter(l => l.type === 'kpr').reduce((s, l) => s + l.amount, 0)
  const pct = (total / asetFinansial) * 100
  const kprFraction = kpr / total

  return {
    value: pct,
    display: `${pct.toFixed(0)}%`,
    kprFraction,
  }
}

// ============================================================
// #4 Asuransi Kesehatan SHELL (DIAG-04 partial — Phase 14 mutation)
// ============================================================
//
// Phase 13 cuma read protection_checklist.health_coverage. Phase 14 deliver
// mutation form (DIAG-04). T-13-09 mitigation: enum value tidak di-display
// raw — selalu lewat HEALTH_COVERAGE_LABEL map (Indonesian label).
const HEALTH_COVERAGE_LABEL: Record<
  NonNullable<ProtectionChecklistRow['health_coverage']>,
  string
> = {
  kantor: 'Dari kantor',
  bpjs: 'BPJS pribadi',
  pribadi: 'Asuransi pribadi',
  kombinasi: 'Kombinasi',
  tidak: 'Tidak covered',
}

export function computeAsuransiShell(
  row: ProtectionChecklistRow | null | undefined,
): IndikatorResult {
  if (!row || row.health_coverage == null) {
    return {
      kind: 'compute',
      value: 0,
      color: 'red',
      display: 'Belum diisi',
    }
  }

  if (row.health_coverage === 'tidak') {
    return {
      kind: 'compute',
      value: 0,
      color: 'red',
      display: 'Tidak covered',
    }
  }

  return {
    kind: 'compute',
    value: 1,
    color: 'green',
    display: HEALTH_COVERAGE_LABEL[row.health_coverage],
  }
}

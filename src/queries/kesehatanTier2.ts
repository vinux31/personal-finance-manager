import type { Goal } from '@/db/goals'
import type { PensionSimRow } from '@/db/pensiun'
import {
  calcBPJS,
  calcDPPK,
  calcDPLK,
  calcTaspen,
  calcPesangon,
  calcInvestasiMandiri,
} from '@/lib/pensiun-calc'
import {
  THRESHOLDS,
  LIFE_EXPECTANCY_YEARS,
  type IndikatorColor,
  type IndikatorResult,
} from './kesehatanTypes'

// ============================================================
// #5 computeGoalsOnTrack (DIAG-05)
// ============================================================
//
// Long-term goal filter: target_date > NOW() + 1 year AND status = 'active'
// On-track: current_amount/target_amount >= time_elapsed/total_duration
// Smart fallback: no long-term goal → cta-fallback /goals
//
// total_duration = target_date - created_at (Plan 13-03 Task 1 added created_at).
// Fallback total_duration start: 1 Jan tahun ini kalau created_at missing
// (defensive — kolom NOT NULL DEFAULT now() di migration 0001 jadi seharusnya
// selalu populated, tapi guard tetap useful kalau ada bug data lama).
// ============================================================

export function computeGoalsOnTrack(goals: Goal[]): IndikatorResult {
  const now = new Date()
  const oneYearFromNow = new Date(now)
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1)

  const longTerm = goals.filter(
    g =>
      g.status === 'active' &&
      g.target_date !== null &&
      new Date(g.target_date) > oneYearFromNow,
  )

  if (longTerm.length === 0) {
    return {
      kind: 'cta-fallback',
      message: 'Belum punya tujuan jangka panjang',
      ctaLabel: 'Buat Goals →',
      ctaTo: '/goals',
    }
  }

  // Linear progress check: progress fraction >= time elapsed fraction
  const onTrack = longTerm.filter(g => {
    // Use g.created_at (Plan 13-03 Task 1 added). Fallback: 1 Jan tahun ini.
    const start = g.created_at
      ? new Date(g.created_at)
      : new Date(now.getFullYear(), 0, 1)
    const end = new Date(g.target_date!) // non-null per filter above

    const totalMs = end.getTime() - start.getTime()
    if (totalMs <= 0) {
      // Edge case: target_date <= start (mis. created in future, atau date salah).
      // Treat as on-track (avoid penalize karena data invalid).
      return true
    }

    const elapsedMs = Math.max(0, now.getTime() - start.getTime())
    const timeElapsedFrac = Math.min(1, elapsedMs / totalMs)
    const progressFrac =
      g.target_amount > 0 ? g.current_amount / g.target_amount : 0

    return progressFrac >= timeElapsedFrac
  })

  const pct = (onTrack.length / longTerm.length) * 100
  const color: IndikatorColor =
    pct >= THRESHOLDS.goalsOnTrack.green
      ? 'green'
      : pct >= THRESHOLDS.goalsOnTrack.yellow
      ? 'yellow'
      : 'red'

  return {
    kind: 'compute',
    value: pct,
    color,
    display: `${onTrack.length}/${longTerm.length} on-track`,
  }
}

// ============================================================
// #6 computePensiun (DIAG-06)
// ============================================================
//
// Formula DEVIATES INTENTIONALLY dari spec §4 literal "× usia_harapan":
// Implementation: proyeksi total ÷ (target_bulanan × 12 × (LIFE_EXPECTANCY_YEARS - usia_pensiun))
// Spec literal "× usia_harapan" (75) akan inflate target 3.75x — semantic incorrect.
// Decision locked Phase 13 plan-checker iteration 2 (rationale di code comment di
// computePensiun body).
// Ratio ≥100% hijau, 70-99% kuning, <70% merah.
// Smart fallback: no row → cta-fallback /pensiun
// Stale notice: updated_at > 6 bulan → set staleMonths field
//
// Proyeksi total: SUM dari aktif source (BPJS/DPPK/DPLK/Taspen/Pesangon/Invest)
// reuse calc helpers dari src/lib/pensiun-calc.ts (exact pattern dari HitungTotalPanel.tsx
// lines 39-59 — sumber object construction + totalLumpSum sum).
// ============================================================

const STALE_THRESHOLD_MONTHS = 6

/**
 * computeProjectionTotal — replicates HitungTotalPanel.tsx pattern.
 *
 * Per-source compute:
 * - BPJS:    jht (lumpsum) + jpBulanan × 12 × 20 (asumsi 20 tahun pensiun draw)
 * - DPPK:    .total (lumpsum dari calcDPPK)
 * - DPLK:    .total (lumpsum dari calcDPLK)
 * - Taspen:  tht (lumpsum) + bulanan × 12 × 20 (asumsi 20 tahun pensiun draw)
 * - Pesangon: .total (lumpsum dari calcPesangon)
 * - Invest:  .total (lumpsum dari calcInvestasiMandiri)
 *
 * `ht_en_*` flag gate masing-masing source — kalau false, skip.
 * Field signatures verified against src/db/pensiun.ts PensionSimRow + src/lib/pensiun-calc.ts.
 */
function computeProjectionTotal(sim: PensionSimRow): number {
  const masaKerja = sim.masa_kerja || 0
  let total = 0

  if (sim.ht_en_bpjs) {
    const r = calcBPJS({
      upahBulanan: sim.ht_bpjs_upah || sim.gaji_pokok || 0,
      masaKerja,
    })
    total += r.jht + r.jpBulanan * 12 * 20
  }

  if (sim.ht_en_dppk) {
    const r = calcDPPK({
      type: (sim.ht_dppk_type as 'ppmp' | 'ppip') || 'ppmp',
      phdp: sim.ht_dppk_phdp || 0,
      faktor: sim.ht_dppk_faktor || 0,
      iuranBulanan: sim.ht_dppk_iuran || 0,
      masaKerja,
    })
    total += r.total
  }

  if (sim.ht_en_dplk) {
    const r = calcDPLK({
      iuranBulanan: sim.ht_dplk_iuran || 0,
      returnPct: sim.ht_dplk_return || 0,
      saldoAwal: sim.ht_dplk_saldo || 0,
      masaKerja,
    })
    total += r.total
  }

  if (sim.ht_en_taspen) {
    const r = calcTaspen({
      gajiTerakhir: sim.ht_taspen_gaji || sim.gaji_pokok || 0,
      golongan: sim.ht_taspen_gol || 'IIIa',
      masaKerja,
    })
    total += r.tht + r.bulanan * 12 * 20
  }

  if (sim.ht_en_pesangon) {
    const r = calcPesangon(sim.gaji_pokok || 0, masaKerja)
    total += r.total
  }

  if (sim.ht_en_invest) {
    const r = calcInvestasiMandiri({
      iuranBulanan: sim.ht_inv_bulanan || 0,
      returnPct: sim.ht_inv_return || 0,
      saldoAwal: sim.ht_inv_saldo || 0,
      kenaikanPct: sim.ht_inv_kenaikan || 0,
      masaKerja,
    })
    total += r.total
  }

  return total
}

export function computePensiun(
  sim: PensionSimRow | null | undefined,
): IndikatorResult {
  if (!sim) {
    return {
      kind: 'cta-fallback',
      message: 'Belum simulasi pensiun',
      ctaLabel: 'Hitung di sini →',
      ctaTo: '/pensiun',
    }
  }

  // Stale check
  const updatedAt = new Date(sim.updated_at)
  const monthsStale =
    (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24 * 30)
  const isStale = monthsStale > STALE_THRESHOLD_MONTHS

  // Compute proyeksi total
  const totalLumpSum = computeProjectionTotal(sim)

  // Edge case: kalau no source enabled, totalLumpSum = 0 → ratio 0
  if (totalLumpSum === 0) {
    return {
      kind: 'cta-fallback',
      message: 'Simulasi pensiun belum punya source aktif',
      ctaLabel: 'Lengkapi simulasi →',
      ctaTo: '/pensiun',
    }
  }

  /**
   * Formula DEVIATES INTENTIONALLY from spec §4 literal "× usia_harapan".
   *
   * Spec literal:    proyeksi ÷ (target_bulanan × 12 × usia_harapan)
   * Implementation:  proyeksi ÷ (target_bulanan × 12 × (LIFE_EXPECTANCY_YEARS - usia_pensiun))
   *
   * Rationale: User pensiun di usia 55 butuh dana untuk 20 tahun PASCA-pensiun
   * (75 − 55), bukan 75 tahun total. Spec wording ambiguous; financial semantics
   * mengarah ke "years remaining after retirement" — kalau dipakai literal "× 75",
   * target jadi 3.75x lebih besar dari kebutuhan riil → semua user merah artificial.
   *
   * Decision locked di Phase 13 planning, sign-off via plan-checker iteration 2.
   *
   * Edge case guard: usia_pensiun ≥ LIFE_EXPECTANCY_YEARS → years remaining ≤ 0 →
   * targetTotal = 0 → ratio = Infinity. Mitigation: floor yearsRemaining ke minimum 1
   * (Math.max) untuk avoid divide-by-zero. Kalau usia_pensiun > 75, treat sebagai
   * "sudah cover sisa hidup" — yearsRemaining=1 = ratio inflated, render compute
   * green (acceptable: user yang plan pensiun setelah usia harapan = edge case rare).
   */
  const yearsRemaining = Math.max(LIFE_EXPECTANCY_YEARS - sim.usia_pensiun, 1)
  const targetTotal = sim.target_bulanan * 12 * yearsRemaining

  // Edge case: target_bulanan 0 atau negatif → ratio undefined; render sebagai compute red
  if (targetTotal <= 0) {
    return {
      kind: 'compute',
      value: 0,
      color: 'red',
      display: '— (set target bulanan)',
      ...(isStale && { staleMonths: Math.floor(monthsStale) }),
    }
  }

  const ratio = (totalLumpSum / targetTotal) * 100
  const color: IndikatorColor =
    ratio >= THRESHOLDS.pensiun.green
      ? 'green'
      : ratio >= THRESHOLDS.pensiun.yellow
      ? 'yellow'
      : 'red'

  return {
    kind: 'compute',
    value: ratio,
    color,
    display: `${ratio.toFixed(0)}%`,
    ...(isStale && { staleMonths: Math.floor(monthsStale) }),
  }
}

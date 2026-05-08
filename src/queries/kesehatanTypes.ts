import type { AccountType, LiabilityType } from '@/db/netWorth'

// ============================================================
// IndikatorResult — return shape dari semua compute functions
// ============================================================

export type IndikatorColor = 'green' | 'yellow' | 'red'

export type IndikatorResult =
  | {
      kind: 'compute'
      value: number
      color: IndikatorColor
      display: string
      /**
       * Optional — extension untuk DIAG-06 stale pension notice.
       * Set kalau pension_simulations.updated_at > 6 bulan.
       * IndikatorCard render badge kecil "Simulasi terakhir: X bulan lalu".
       */
      staleMonths?: number
    }
  | {
      kind: 'placeholder-data-tipis'
      monthsAvailable: number  // 0..2
      ctaTo: string            // '/transaksi'
    }
  | {
      kind: 'cta-fallback'
      message: string          // mis. "Belum punya tujuan jangka panjang"
      ctaLabel: string         // mis. "Buat Goals →"
      ctaTo: string            // mis. "/goals"
    }

// ============================================================
// Threshold constants — exposed supaya gampang tune pasca-rilis
// (per STATE.md blockers/concerns: "simpan threshold sebagai
//  konstanta di kesehatan.ts (bukan inline)").
// ============================================================

export const THRESHOLDS = {
  danaDarurat: { green: 6, yellow: 3 },          // bulan
  savingsRate: { green: 20, yellow: 10 },         // persen
  darKonsumtif: { green: 20, yellow: 40 },        // persen — INVERTED: <green hijau, >yellow merah
  goalsOnTrack: { green: 75, yellow: 50 },        // persen
  pensiun: { green: 100, yellow: 70 },            // persen
  rasioInvestasi: { green: 40, yellow: 20 },      // persen
  diversifikasi: { green: 3, yellow: 2 },         // jumlah distinct asset class
} as const

// ============================================================
// Account/Liability type filters
// ============================================================

export const LIQUID_TYPES: readonly AccountType[] = [
  'tabungan',
  'giro',
  'cash',
  'dompet_digital',
] as const

export const FINANCIAL_TYPES: readonly AccountType[] = [
  'tabungan',
  'giro',
  'cash',
  'dompet_digital',
  'deposito',
] as const

/** Liabilitas konsumtif untuk DIAG-03 — exclude 'kpr' (housing). */
export const KONSUMTIF_LIAB_TYPES: readonly LiabilityType[] = [
  'cicilan_kendaraan',
  'kartu_kredit',
  'paylater',
  'kta',
] as const

// ============================================================
// Pensiun assumption (DIAG-06)
// ============================================================

/**
 * Usia harapan hidup default untuk computePensiun proyeksi.
 * Justifikasi: BPS Indonesia 2024 angka harapan hidup ~74 tahun.
 * Hardcoded di sini supaya gampang adjust kalau ternyata user demografi
 * pfm-web punya target berbeda (mis. raise ke 80 untuk konservatif).
 */
export const LIFE_EXPECTANCY_YEARS = 75

// ============================================================
// CSS color mapping untuk IndikatorCard / Tier badge
// ============================================================

export const COLOR_BADGE_CLASS: Record<IndikatorColor | 'gray', string> = {
  green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  yellow: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  gray: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

export const COLOR_BORDER_CLASS: Record<IndikatorColor | 'gray', string> = {
  green: 'border-l-green-500',
  yellow: 'border-l-amber-500',
  red: 'border-l-red-500',
  gray: 'border-l-gray-400 dark:border-l-gray-600',
}

// ============================================================
// Tier ID helper
// ============================================================

export type TierId = 1 | 2 | 3 | 4

export type TierColors = Record<TierId, IndikatorColor | 'gray'>

import type { Goal } from '@/db/goals'
import type { PensionSimRow } from '@/db/pensiun'
import type { IndikatorResult } from './kesehatanTypes'

/** STUB Wave 1 — Wave 2 13-03 akan replace. */

export function computeGoalsOnTrack(_goals: Goal[]): IndikatorResult {
  return {
    kind: 'cta-fallback',
    message: 'Belum punya tujuan jangka panjang',
    ctaLabel: 'Buat Goals →',
    ctaTo: '/goals',
  }
}

export function computePensiun(_sim: PensionSimRow | null | undefined): IndikatorResult {
  return {
    kind: 'cta-fallback',
    message: 'Belum simulasi pensiun',
    ctaLabel: 'Hitung di sini →',
    ctaTo: '/pensiun',
  }
}

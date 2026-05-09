import { useMemo } from 'react'
import { useTransactions } from '@/queries/transactions'
import { useNetWorthAccounts, useNetWorthLiabilities } from '@/queries/netWorth'
import { useGoals } from '@/queries/goals'
import { useInvestments } from '@/queries/investments'
import { usePensionSim } from '@/queries/pensiun'
import { useProtectionChecklist } from '@/queries/protectionChecklist'
import {
  computeDanaDarurat,
  computeSavingsRate,
  computeDARKonsumtif,
  computeDARTotal,
  computeAsuransiShell,
} from './kesehatanTier1'
import { computeGoalsOnTrack, computePensiun } from './kesehatanTier2'
import { computeRasioInvestasi, computeDiversifikasi } from './kesehatanTier3'
import { computeTier4Color } from './kesehatanTier4'
import type { IndikatorResult, TierColors, TierId } from './kesehatanTypes'
import type { ProtectionChecklistRow } from '@/db/protectionChecklist'

// Re-export types untuk convenience consumers (KesehatanLanding, TierPanel)
export type { IndikatorResult, TierColors, TierId } from './kesehatanTypes'
export {
  THRESHOLDS,
  COLOR_BADGE_CLASS,
  COLOR_BORDER_CLASS,
  LIFE_EXPECTANCY_YEARS,
} from './kesehatanTypes'

/**
 * 8 indikator + DAR Total info, keyed by indicator number per spec §4.
 * Phase 13 = #1, #2, #3, #4 (shell), #5, #6, #7, #8.
 * (#4 detail mutation = Phase 14.)
 */
export type IndikatorMap = {
  '1': IndikatorResult  // Dana Darurat
  '2': IndikatorResult  // Savings Rate
  '3': IndikatorResult  // DAR Konsumtif
  '4': IndikatorResult  // Asuransi Kesehatan shell
  '5': IndikatorResult  // Goals on-track
  '6': IndikatorResult  // Pensiun
  '7': IndikatorResult  // Rasio Investasi
  '8': IndikatorResult  // Diversifikasi
}

export type DARTotalInfo = {
  value: number
  display: string
  kprFraction: number
}

/**
 * useIndikator() — primary hook untuk Phase 13.
 *
 * Strategy: hybrid (CONTEXT.md decision B). Compose 6 existing View-As-aware hooks
 * + useMemo derive 8 IndikatorResult + DARTotalInfo. Zero new mutation, zero schema
 * change. Cache + auto-invalidation reuse dari hooks existing.
 *
 * Untuk DIAG-01/02/10: useTransactions filtered dengan dateFrom = 3-bulan-lalu (per
 * RESEARCH.md pitfall #2 — avoid full-table scan).
 *
 * Phase 14 extension: useIndikator return shape includes `protectionRow` so
 * KesehatanLanding can call `deriveTierColors(indicators, protectionRow)`.
 * Without this, Tier 4 trapezoid stays gray (Phase 13 behavior).
 */
export function useIndikator() {
  const threeMonthsAgoISO = useMemo(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 3)
    return d.toISOString().substring(0, 10)
  }, [])

  const tx = useTransactions({ dateFrom: threeMonthsAgoISO })
  const accounts = useNetWorthAccounts()
  const liabilities = useNetWorthLiabilities()
  const goals = useGoals()
  const inv = useInvestments()
  const pens = usePensionSim()
  const protection = useProtectionChecklist()

  const isLoading =
    tx.isLoading ||
    accounts.isLoading ||
    liabilities.isLoading ||
    goals.isLoading ||
    inv.isLoading ||
    pens.isLoading ||
    protection.isLoading

  const result = useMemo(() => {
    if (isLoading) {
      return { isLoading: true as const, indicators: null, darTotalInfo: null, protectionRow: null }
    }
    const txData = tx.data ?? []
    const accData = accounts.data ?? []
    const liabData = liabilities.data ?? []
    const goalData = goals.data ?? []
    const invData = inv.data ?? []
    const pensData = pens.data ?? null
    const protData = protection.data ?? null

    const indicators: IndikatorMap = {
      '1': computeDanaDarurat(accData, txData),
      '2': computeSavingsRate(txData),
      '3': computeDARKonsumtif(accData, liabData, invData),
      '4': computeAsuransiShell(protData),
      '5': computeGoalsOnTrack(goalData),
      '6': computePensiun(pensData),
      '7': computeRasioInvestasi(accData, invData),
      '8': computeDiversifikasi(invData, accData),
    }

    const darTotalInfo: DARTotalInfo | null = computeDARTotal(accData, liabData, invData)

    return { isLoading: false as const, indicators, darTotalInfo, protectionRow: protData }
  }, [
    isLoading,
    tx.data,
    accounts.data,
    liabilities.data,
    goals.data,
    inv.data,
    pens.data,
    protection.data,
  ])

  return result
}

/**
 * Aggregate tier color — pure function dari list IndikatorResult.
 *
 * Rules (per spec §4 "Agregasi warna tier"):
 * - Gray jika SEMUA indikator placeholder/cta-fallback (no compute)
 * - Red jika ada minimal 1 compute red
 * - Yellow jika ada minimal 1 compute yellow (no red)
 * - Green jika semua compute hijau
 */
export function aggregateTierColor(
  indicators: IndikatorResult[],
): 'green' | 'yellow' | 'red' | 'gray' {
  const computed = indicators.filter(
    (i): i is Extract<IndikatorResult, { kind: 'compute' }> => i.kind === 'compute',
  )
  if (computed.length === 0) return 'gray'
  if (computed.some(i => i.color === 'red')) return 'red'
  if (computed.some(i => i.color === 'yellow')) return 'yellow'
  return 'green'
}

/**
 * Map indikator IDs → tier ID. Per spec §4 struktur 4 tier.
 * Tier 4 = no indicators di Phase 13 (smart-gated checklist Phase 14).
 */
export const TIER_INDICATORS: Record<TierId, ReadonlyArray<keyof IndikatorMap>> = {
  1: ['1', '2', '3', '4'],
  2: ['5', '6'],
  3: ['7', '8'],
  4: [],
}

/**
 * Helper: derive TierColors dari IndikatorMap + protectionRow.
 *
 * Phase 14: signature extended dengan protectionRow param untuk Tier 4 compute.
 * Tier 1-3 unchanged (still aggregate over IndikatorResult[] from indicators map).
 * Tier 4 delegate ke computeTier4Color (gate-conditional + NULL=red rules).
 */
export function deriveTierColors(
  indicators: IndikatorMap | null,
  protectionRow: ProtectionChecklistRow | null,
): TierColors {
  if (!indicators) {
    return { 1: 'gray', 2: 'gray', 3: 'gray', 4: 'gray' }
  }
  return {
    1: aggregateTierColor(TIER_INDICATORS[1].map(id => indicators[id])),
    2: aggregateTierColor(TIER_INDICATORS[2].map(id => indicators[id])),
    3: aggregateTierColor(TIER_INDICATORS[3].map(id => indicators[id])),
    4: computeTier4Color(protectionRow),
  }
}

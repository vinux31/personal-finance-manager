import TierPanel from './TierPanel'
import type { IndikatorMap } from '@/queries/kesehatan'

type Props = {
  indicators: IndikatorMap
}

/**
 * Tier 2 — AKUMULASI panel.
 *
 * Per spec §4 + §4.5:
 * - 2 indikator: Goals on-track (#5), Pensiun (#6)
 * - 2 CTA: Kelola Goals → /goals, Simulasi pensiun → /pensiun
 * - Modul link: Tujuan & Risiko → /kesehatan/tujuan
 *
 * Smart fallback handled di compute layer (kesehatanTier2.ts):
 * - User tanpa long-term goal → indicators['5'] = cta-fallback variant
 * - User tanpa pension_simulations → indicators['6'] = cta-fallback variant
 * - Stale 6+ bulan → indicators['6'].staleMonths set, IndikatorCard render badge
 *
 * Plan 13-01 sudah wire <Tier2Panel ... /> di KesehatanLanding.renderTierContent;
 * Plan 13-03 cuma rewrite body (props signature unchanged → zero file overlap dengan
 * Plan 13-02/13-04 di Wave 2 paralel).
 */
export default function Tier2Panel({ indicators }: Props) {
  return (
    <TierPanel
      tierId={2}
      indicators={[
        {
          label: 'Goals Long-term on-track',
          thresholdHint: '≥ 75% on-track hijau · 50-74% kuning · < 50% merah',
          result: indicators['5'],
        },
        {
          label: 'Kesiapan Pensiun',
          thresholdHint: '≥ 100% target hijau · 70-99% kuning · < 70% merah',
          result: indicators['6'],
        },
      ]}
      ctas={[
        { label: 'Kelola Goals', to: '/goals', variant: 'default' },
        { label: 'Simulasi pensiun', to: '/pensiun', variant: 'outline' },
      ]}
      modulLinks={[{ label: 'Tujuan & Risiko', slug: 'tujuan' }]}
    />
  )
}

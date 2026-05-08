import TierPanel from './TierPanel'
import type { IndikatorMap } from '@/queries/kesehatan'

type Props = {
  indicators: IndikatorMap
}

/**
 * Tier 3 — PERTUMBUHAN panel.
 *
 * Per spec §4 + §4.5:
 * - 2 indikator: Rasio Investasi (#7), Diversifikasi (#8)
 * - 1 CTA: Kelola investasi → /investasi
 * - 2 modul links: Alokasi Aset → /kesehatan/alokasi-aset, Instrumen → /kesehatan/instrumen
 *
 * Tidak ada smart fallback di tier ini — compute selalu return value
 * (worst case 0% atau 0 kelas aset → red).
 *
 * Plan 13-01 sudah wire <Tier3Panel ... /> di KesehatanLanding.renderTierContent;
 * Plan 13-04 cuma rewrite body (props signature unchanged → zero file overlap dengan
 * Plan 13-02/13-03 di Wave 2 paralel).
 */
export default function Tier3Panel({ indicators }: Props) {
  return (
    <TierPanel
      tierId={3}
      indicators={[
        {
          label: 'Rasio Investasi',
          thresholdHint: '≥ 40% hijau · 20-39% kuning · < 20% merah',
          result: indicators['7'],
        },
        {
          label: 'Diversifikasi',
          thresholdHint: '≥ 3 kelas aset hijau · 2 kuning · ≤ 1 merah',
          result: indicators['8'],
        },
      ]}
      ctas={[
        { label: 'Kelola investasi', to: '/investasi', variant: 'default' },
      ]}
      modulLinks={[
        { label: 'Alokasi Aset & Diversifikasi', slug: 'alokasi-aset' },
        { label: 'Instrumen Indonesia & Global', slug: 'instrumen' },
      ]}
    />
  )
}

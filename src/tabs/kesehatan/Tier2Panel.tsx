import TierPanel from './TierPanel'
import type { IndikatorMap } from '@/queries/kesehatan'

type Props = {
  indicators: IndikatorMap
}

/**
 * STUB Wave 1 — Wave 2 13-03 REPLACE dengan implementasi real (Goals on-track +
 * Pensiun + smart fallback CTA + stale notice + 2 CTA [Kelola Goals → /goals,
 * Simulasi pensiun → /pensiun] + 1 modul link [Tujuan & Risiko → /kesehatan/tujuan]).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function Tier2Panel(_props: Props) {
  return (
    <TierPanel
      tierId={2}
      placeholderText="Tier 2 indicators belum di-wire — Wave 2 13-03 akan isi (Goals on-track, Kesiapan Pensiun)."
    />
  )
}

import TierPanel from './TierPanel'
import type { IndikatorMap } from '@/queries/kesehatan'

type Props = {
  indicators: IndikatorMap
}

/**
 * STUB Wave 1 — Wave 2 13-04 REPLACE dengan implementasi real (Rasio Investasi +
 * Diversifikasi + 1 CTA [Kelola investasi → /investasi] + 2 modul links
 * [Alokasi Aset → /kesehatan/alokasi-aset, Instrumen → /kesehatan/instrumen]).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function Tier3Panel(_props: Props) {
  return (
    <TierPanel
      tierId={3}
      placeholderText="Tier 3 indicators belum di-wire — Wave 2 13-04 akan isi (Rasio Investasi, Diversifikasi)."
    />
  )
}

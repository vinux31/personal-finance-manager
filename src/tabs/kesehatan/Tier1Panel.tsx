import TierPanel from './TierPanel'
import type { IndikatorMap, DARTotalInfo } from '@/queries/kesehatan'

type Props = {
  indicators: IndikatorMap
  darTotalInfo: DARTotalInfo | null
}

/**
 * STUB Wave 1 (Plan 13-01) — Wave 2 13-02 REPLACE seluruh isi file ini dengan
 * implementasi real (compute wiring + 4 IndikatorCard + DAR Total infoSlot +
 * 2 CTA [Kelola akun → /kekayaan, Catat transaksi → /transaksi] + 1 modul link
 * [Pondasi & Cash Flow → /kesehatan/arus-kas]).
 *
 * Wave 1 cuma render placeholder text supaya KesehatanLanding wire-able + build
 * sukses. Props signature DIPRESERVED — Wave 2 13-02 cukup ganti body return,
 * tidak ubah props shape. KesehatanLanding TIDAK perlu diedit di Wave 2.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function Tier1Panel(_props: Props) {
  return (
    <TierPanel
      tierId={1}
      placeholderText="Tier 1 indicators belum di-wire — Wave 2 13-02 akan isi (Dana Darurat, Savings Rate, DAR Konsumtif, Asuransi Kesehatan)."
    />
  )
}

import TierPanel from './TierPanel'
import type { IndikatorMap, DARTotalInfo } from '@/queries/kesehatan'

type Props = {
  indicators: IndikatorMap
  darTotalInfo: DARTotalInfo | null
}

/**
 * Tier 1 — PROTEKSI panel.
 *
 * Per spec §4 + §4.5:
 * - 4 indikator: Dana Darurat (#1), Savings Rate (#2), DAR Konsumtif (#3), Asuransi Kesehatan (#4 shell)
 * - Info row: DAR Total (kontekstualisasi mayoritas KPR vs non-KPR)
 * - 2 CTA: Kelola akun & utang → /kekayaan, Catat transaksi → /transaksi
 * - Modul link: Pondasi & Cash Flow → /kesehatan/arus-kas
 *
 * Plan 13-01 sudah wire <Tier1Panel ... /> di KesehatanLanding.renderTierContent;
 * Plan 13-02 cuma rewrite body (props signature unchanged → zero file overlap dengan
 * Plan 13-03/13-04 di Wave 2 paralel).
 */
export default function Tier1Panel({ indicators, darTotalInfo }: Props) {
  // DAR Total info row content (optional — null kalau aset 0 atau total liab 0).
  // kprFraction kontekstualisasi:
  //   >0.5 → mayoritas KPR (beban rumah, relatif sehat)
  //   0..0.5 → campuran KPR & utang konsumtif
  //   0 → tanpa KPR (semua utang konsumtif)
  const infoSlot = darTotalInfo ? (
    <span>
      <strong>DAR Total kamu:</strong> {darTotalInfo.display}
      {darTotalInfo.kprFraction > 0.5
        ? ' (mayoritas KPR — beban rumah)'
        : darTotalInfo.kprFraction > 0
        ? ' (campuran KPR & utang konsumtif)'
        : ' (tanpa KPR)'}
    </span>
  ) : undefined

  return (
    <TierPanel
      tierId={1}
      indicators={[
        {
          label: 'Dana Darurat',
          thresholdHint: '≥ 6 bulan hijau · 3-5 kuning · < 3 merah',
          result: indicators['1'],
        },
        {
          label: 'Savings Rate',
          thresholdHint: '≥ 20% hijau · 10-19% kuning · < 10% merah',
          result: indicators['2'],
        },
        {
          label: 'DAR Konsumtif',
          thresholdHint: '< 20% hijau · 20-40% kuning · > 40% merah',
          result: indicators['3'],
        },
        {
          label: 'Asuransi Kesehatan',
          thresholdHint:
            'Covered (kantor/BPJS/pribadi/kombinasi) hijau · belum diisi atau tidak covered merah',
          result: indicators['4'],
        },
      ]}
      infoSlot={infoSlot}
      ctas={[
        { label: 'Kelola akun & utang', to: '/kekayaan', variant: 'default' },
        { label: 'Catat transaksi', to: '/transaksi', variant: 'outline' },
      ]}
      modulLinks={[{ label: 'Pondasi & Cash Flow', slug: 'arus-kas' }]}
    />
  )
}

import { Eye } from 'lucide-react'
import TierPanel from './TierPanel'
import AsuransiKesehatanForm from './AsuransiKesehatanForm'
import { useViewAs } from '@/auth/useViewAs'
import { useProtectionChecklist } from '@/queries/protectionChecklist'
import type { IndikatorMap, DARTotalInfo } from '@/queries/kesehatan'

type Props = {
  indicators: IndikatorMap
  darTotalInfo: DARTotalInfo | null
}

/**
 * Tier 1 — PROTEKSI panel.
 *
 * Per spec §4 + §4.5:
 * - 3 indikator di TierPanel: Dana Darurat (#1), Savings Rate (#2), DAR Konsumtif (#3)
 * - Indikator #4 Asuransi Kesehatan dirender sebagai SIBLING <AsuransiKesehatanForm />
 *   di bawah TierPanel (Phase 14 DIAG-04 inline form).
 * - Info row: DAR Total
 * - 2 CTA: /kekayaan, /transaksi
 * - Modul link: arus-kas
 *
 * Phase 14 additions (DIAG-04 + DIAG-12):
 * - Inline View-As notice di top saat viewingAs !== null (DIAG-12)
 * - <AsuransiKesehatanForm row={protectionRow} /> sibling di bawah TierPanel (DIAG-04)
 *
 * Tier color aggregation: useIndikator masih compute indicators['4'] via
 * computeAsuransiShell — deriveTierColors (KesehatanLanding) tetap consume #4
 * untuk Tier 1 aggregate. Form mutation flip color via optimistic setQueryData →
 * useIndikator useMemo recompute → tierColors prop change.
 */
export default function Tier1Panel({ indicators, darTotalInfo }: Props) {
  const { viewingAs } = useViewAs()
  const isViewAs = viewingAs !== null
  const { data: protectionRow } = useProtectionChecklist()

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
    <>
      {isViewAs && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-md bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 px-3 py-2 text-sm text-amber-800 dark:text-amber-200 flex items-center gap-2 mx-4 mt-4"
        >
          <Eye className="h-4 w-4" />
          Mode View-As — kamu hanya bisa lihat, tidak bisa simpan.
        </div>
      )}

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
          // NOTE: Indikator #4 (Asuransi Kesehatan) di-render via AsuransiKesehatanForm
          // sebagai sibling di bawah TierPanel — Phase 14 inline form (DIAG-04).
          // IndikatorCard.compute variant tidak dipakai untuk slot #4 lagi.
        ]}
        infoSlot={infoSlot}
        ctas={[
          { label: 'Kelola akun & utang', to: '/kekayaan', variant: 'default' },
          { label: 'Catat transaksi', to: '/transaksi', variant: 'outline' },
        ]}
        modulLinks={[{ label: 'Pondasi & Cash Flow', slug: 'arus-kas' }]}
      />

      {/* Tier 1 #4 inline form — Phase 14 DIAG-04. Sibling of TierPanel to keep
          IndikatorCard variant pure (Option A2 per RESEARCH.md §Pattern 5). */}
      <div className="px-4 pb-4">
        <AsuransiKesehatanForm row={protectionRow ?? null} />
      </div>
    </>
  )
}

import { useNavigate } from 'react-router-dom'
import { ArrowRight, AlertCircle, Lightbulb } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { COLOR_BADGE_CLASS, COLOR_BORDER_CLASS, type IndikatorResult } from '@/queries/kesehatan'

type Props = {
  /** Label indikator (mis. "Dana Darurat", "Savings Rate"). */
  label: string
  /** Threshold legend untuk hover/info — single line, optional. Mis. "≥ 6 bulan hijau, 3-5 kuning, < 3 merah". */
  thresholdHint?: string
  /** Result dari compute function. */
  result: IndikatorResult
}

/**
 * Render satu indikator dalam tier panel.
 *
 * 3 variant render berdasarkan `result.kind`:
 *   - 'compute'                   → angka + warna badge + display + optional staleMonths note
 *   - 'placeholder-data-tipis'    → "Butuh 3 bulan data, sudah X/3" + CTA /transaksi
 *   - 'cta-fallback'              → message + CTA button → ctaTo
 */
export default function IndikatorCard({ label, thresholdHint, result }: Props) {
  const navigate = useNavigate()

  // ============= placeholder-data-tipis variant =============
  if (result.kind === 'placeholder-data-tipis') {
    return (
      <div
        className={`rounded-lg border border-l-4 bg-card p-3 ${COLOR_BORDER_CLASS.gray}`}
      >
        <div className="flex items-start gap-3">
          <AlertCircle className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{label}</span>
              <span className={`rounded px-2 py-0.5 text-xs ${COLOR_BADGE_CLASS.gray}`}>
                Butuh data
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Butuh 3 bulan data — sudah {result.monthsAvailable}/3.
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => navigate(result.ctaTo)}
            >
              Catat transaksi <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ============= cta-fallback variant =============
  if (result.kind === 'cta-fallback') {
    return (
      <div
        className={`rounded-lg border border-l-4 bg-card p-3 ${COLOR_BORDER_CLASS.gray}`}
      >
        <div className="flex items-start gap-3">
          <Lightbulb className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{label}</span>
              <span className={`rounded px-2 py-0.5 text-xs ${COLOR_BADGE_CLASS.gray}`}>
                Belum ada
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{result.message}</p>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => navigate(result.ctaTo)}
            >
              {result.ctaLabel} <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ============= compute variant =============
  return (
    <div
      className={`rounded-lg border border-l-4 bg-card p-3 ${COLOR_BORDER_CLASS[result.color]}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{label}</span>
            {result.staleMonths !== undefined && (
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] ${COLOR_BADGE_CLASS.yellow}`}
                title={`Simulasi terakhir: ${result.staleMonths} bulan lalu`}
              >
                Stale {result.staleMonths}bln
              </span>
            )}
          </div>
          {thresholdHint && (
            <p className="text-[10px] text-muted-foreground">{thresholdHint}</p>
          )}
        </div>
        <span
          className={`rounded px-2 py-1 text-sm font-semibold ${COLOR_BADGE_CLASS[result.color]}`}
        >
          {result.display}
        </span>
      </div>
    </div>
  )
}

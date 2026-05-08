import { toast } from 'sonner'
import type { ReactNode } from 'react'
import { COLOR_BADGE_CLASS, type TierColors, type TierId } from '@/queries/kesehatan'

type Tier = {
  id: TierId
  label: string
  subtitle: string
}

const TIERS: Tier[] = [
  { id: 4, label: 'WARISAN', subtitle: 'Tier 4' },
  { id: 3, label: 'PERTUMBUHAN', subtitle: 'Tier 3' },
  { id: 2, label: 'AKUMULASI', subtitle: 'Tier 2' },
  { id: 1, label: 'PROTEKSI', subtitle: 'Tier 1' },
]

type Props = {
  /** DIAG-11 empty state path (existing dari Phase 12). */
  variant?: 'default' | 'grayed-empty'
  /** Phase 13: warna per tier (dari deriveTierColors). Override default gray. */
  tierColors?: TierColors
  /**
   * Phase 13 wrapper hook: KesehatanLanding wrap setiap trapezoid sebagai
   * AccordionTrigger. Callback receives tier metadata + the rendered button
   * element; return wrapped element. If undefined, fallback toast handler.
   */
  renderTrigger?: (tier: Tier, button: ReactNode) => ReactNode
}

/**
 * 4-tier piramida shell.
 *
 * Phase 12 baseline (variant only): semua tier gray, klik → toast.
 * Phase 13 extend: `tierColors` set warna trapezoid dynamic (hijau/kuning/merah/abu).
 *   `renderTrigger` allow KesehatanLanding wrap trapezoid jadi AccordionTrigger.
 *
 * Visual: 4 trapezoid stacked, top sempit (Tier 4 WARISAN) ke bottom lebar (Tier 1 PROTEKSI).
 * Implementation: CSS clip-path polygon + Tailwind width %.
 */
export default function PiramidaShell({ variant = 'default', tierColors, renderTrigger }: Props) {
  const isEmpty = variant === 'grayed-empty'

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-1 py-4">
      {TIERS.map((tier, index) => {
        // Width %: tier 4 → 50%, tier 3 → 65%, tier 2 → 80%, tier 1 → 95%
        const widthPercent = 50 + index * 15

        // Resolve color: empty state always gray; tierColors override; else fallback gray
        const colorKey: keyof typeof COLOR_BADGE_CLASS =
          isEmpty ? 'gray' : (tierColors?.[tier.id] ?? 'gray')

        const trapezoidClass =
          isEmpty
            ? 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
            : colorKey === 'gray'
              ? 'bg-gray-300 text-gray-700 dark:bg-gray-600 dark:text-gray-200'
              : colorKey === 'green'
                ? 'bg-green-500 text-white'
                : colorKey === 'yellow'
                  ? 'bg-amber-500 text-white'
                  : 'bg-red-500 text-white'

        const trapezoid = (
          <div
            className={`flex h-14 items-center gap-2 px-3 text-xs font-semibold tracking-wide sm:gap-3 sm:px-5 sm:text-sm ${trapezoidClass}`}
            style={{ clipPath: 'polygon(5% 0, 95% 0, 100% 100%, 0 100%)' }}
          >
            <span className="shrink-0 text-[9px] opacity-70 sm:text-[10px]">{tier.subtitle}</span>
            <span className="min-w-0 flex-1 truncate text-center">{tier.label}</span>
          </div>
        )

        const button = (
          <div
            className="group relative w-full max-w-[420px] cursor-pointer transition-transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-ring rounded"
            style={{ width: `${widthPercent}%` }}
            aria-label={`Tier ${tier.id} ${tier.label}`}
          >
            {trapezoid}
          </div>
        )

        // Wave 1: kalau renderTrigger provided (KesehatanLanding wrap dengan AccordionTrigger),
        // delegasikan rendering ke parent. Else fallback existing toast behavior.
        if (renderTrigger) {
          return (
            <div key={tier.id} style={{ width: `${widthPercent}%`, maxWidth: 420 }}>
              {renderTrigger(tier, button)}
            </div>
          )
        }

        return (
          <button
            key={tier.id}
            type="button"
            onClick={() =>
              toast.info(
                isEmpty
                  ? `Yuk isi data dulu — Tier ${tier.id} ${tier.label} akan terbuka setelah ada minimal 3 data poin.`
                  : `Tier ${tier.id} ${tier.label}: detail panel akan tersedia di update berikutnya.`,
              )
            }
            aria-label={`Tier ${tier.id} ${tier.label}`}
            className="group relative w-full max-w-[420px] cursor-pointer transition-transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-ring rounded"
            style={{ width: `${widthPercent}%` }}
          >
            {trapezoid}
          </button>
        )
      })}
      {isEmpty && (
        <p className="mt-3 text-center text-sm text-muted-foreground">
          Yuk mulai isi data untuk lihat warna hijau/kuning/merah di setiap tier.
        </p>
      )}
    </div>
  )
}

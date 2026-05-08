import { toast } from 'sonner'
import type { ReactNode } from 'react'
import { COLOR_BADGE_CLASS, type TierColors, type TierId } from '@/queries/kesehatan'

type Tier = {
  id: TierId
  label: string
}

const TIERS: Tier[] = [
  { id: 4, label: 'WARISAN' },
  { id: 3, label: 'PERTUMBUHAN' },
  { id: 2, label: 'AKUMULASI' },
  { id: 1, label: 'PROTEKSI' },
]

// Width tapering Tier 4 → Tier 1 (60% → 100%), modest taper untuk piramida feel
// tanpa Tier 4 jadi sangat sempit (label muat penuh di 60% even mobile)
const WIDTH_PERCENT: Record<TierId, number> = {
  4: 60,
  3: 75,
  2: 90,
  1: 100,
}

type Props = {
  /** DIAG-11 empty state path (existing dari Phase 12). */
  variant?: 'default' | 'grayed-empty'
  /** Phase 13: warna per tier (dari deriveTierColors). Override default gray. */
  tierColors?: TierColors
  /**
   * Phase 13 wrapper hook: KesehatanLanding wrap setiap tier sebagai
   * AccordionTrigger. Callback receives tier metadata + the rendered button
   * element; return wrapped element. If undefined, fallback toast handler.
   */
  renderTrigger?: (tier: Tier, button: ReactNode) => ReactNode
}

/**
 * 4-tier piramida shell — stepped solid pyramid.
 *
 * Visual: 4 stacked rectangles tapering Tier 4 (60%) → Tier 1 (100%).
 * Pure rectangles (no clip-path) — sharp edges, zero label truncation risk.
 * Pyramid feel via width taper + tight stacking + tier separators + rounded corners
 * di Tier 4 top dan Tier 1 bottom.
 */
export default function PiramidaShell({ variant = 'default', tierColors, renderTrigger }: Props) {
  const isEmpty = variant === 'grayed-empty'
  const lastIndex = TIERS.length - 1

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center py-4">
      {TIERS.map((tier, index) => {
        const widthPercent = WIDTH_PERCENT[tier.id]
        const isFirst = index === 0
        const isLast = index === lastIndex

        // Resolve color: empty state always gray; tierColors override; else fallback gray
        const colorKey: keyof typeof COLOR_BADGE_CLASS =
          isEmpty ? 'gray' : (tierColors?.[tier.id] ?? 'gray')

        const tierClass =
          isEmpty
            ? 'bg-gray-200 text-gray-600 ring-gray-300/60 dark:bg-gray-700 dark:text-gray-400 dark:ring-gray-600/60'
            : colorKey === 'gray'
              ? 'bg-gray-300 text-gray-800 ring-gray-400/50 dark:bg-gray-600 dark:text-gray-100 dark:ring-gray-500/50'
              : colorKey === 'green'
                ? 'bg-emerald-500 text-white ring-emerald-700/30'
                : colorKey === 'yellow'
                  ? 'bg-amber-500 text-white ring-amber-700/30'
                  : 'bg-red-500 text-white ring-red-700/30'

        // Status dot color (saturated, white border for definition on filled bg)
        const dotClass =
          isEmpty || colorKey === 'gray'
            ? 'bg-gray-100 dark:bg-gray-300'
            : colorKey === 'green'
              ? 'bg-emerald-200'
              : colorKey === 'yellow'
                ? 'bg-amber-200'
                : 'bg-red-200'

        // Rounded corners: Tier 4 (top) rounded-t-lg, Tier 1 (bottom) rounded-b-lg, middle squared
        const radiusClass = isFirst
          ? 'rounded-t-lg'
          : isLast
            ? 'rounded-b-lg'
            : ''

        // Border antar tier — top border for all except first, gives crisp seam
        const seamClass = isFirst ? '' : 'border-t border-white/20 dark:border-black/20'

        const tierBlock = (
          <div
            className={`relative flex h-14 items-center justify-center px-5 text-sm font-semibold tracking-wide shadow-sm ring-1 ring-inset transition-colors ${tierClass} ${seamClass} ${radiusClass}`}
          >
            <span className="truncate">{tier.label}</span>
            <span
              className={`absolute right-4 size-2.5 rounded-full ring-2 ring-white/70 dark:ring-black/40 ${dotClass}`}
              aria-hidden
            />
          </div>
        )

        const button = (
          <div
            className="group relative w-full cursor-pointer transition-transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
            style={{ width: `${widthPercent}%` }}
            aria-label={`Tier ${tier.id} ${tier.label}`}
          >
            {tierBlock}
          </div>
        )

        if (renderTrigger) {
          return (
            <div
              key={tier.id}
              className="w-full"
              style={{ width: `${widthPercent}%`, maxWidth: 480 }}
            >
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
            className="group relative cursor-pointer transition-transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
            style={{ width: `${widthPercent}%`, maxWidth: 480 }}
          >
            {tierBlock}
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

import { toast } from 'sonner'

type Tier = {
  id: 1 | 2 | 3 | 4
  label: string  // "PROTEKSI" etc
  subtitle: string  // "Tier 1" etc
}

const TIERS: Tier[] = [
  { id: 4, label: 'WARISAN', subtitle: 'Tier 4' },
  { id: 3, label: 'PERTUMBUHAN', subtitle: 'Tier 3' },
  { id: 2, label: 'AKUMULASI', subtitle: 'Tier 2' },
  { id: 1, label: 'PROTEKSI', subtitle: 'Tier 1' },
]

/**
 * Phase 12 shell — semua tier render gray (no data wiring).
 * Phase 13 akan terima props `indicators` dan render warna hijau/kuning/merah.
 *
 * Visual: 4 trapezoid stacked, top (Tier 4) paling sempit, bottom (Tier 1) paling lebar.
 * Implementation: pakai CSS clip-path trapezoid via inline style + Tailwind untuk spacing.
 * Klik tier → toast "Coming soon" (Phase 13 akan replace dengan slide-down panel).
 */
export default function PiramidaShell({
  variant = 'default',
}: {
  variant?: 'default' | 'grayed-empty'
}) {
  const isEmpty = variant === 'grayed-empty'

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-1 py-4">
      {TIERS.map((tier, index) => {
        // Width percent: tier 4 = 50%, tier 3 = 65%, tier 2 = 80%, tier 1 = 95%
        const widthPercent = 50 + index * 15
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
            <div
              className={`flex h-14 items-center justify-between gap-3 px-5 text-sm font-semibold tracking-wide ${
                isEmpty
                  ? 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                  : 'bg-gray-300 text-gray-700 dark:bg-gray-600 dark:text-gray-200'
              }`}
              style={{
                clipPath: 'polygon(8% 0, 92% 0, 100% 100%, 0 100%)',
              }}
            >
              <span className="text-[10px] opacity-70">{tier.subtitle}</span>
              <span>{tier.label}</span>
              <span className="text-[10px] opacity-0">.</span>
            </div>
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

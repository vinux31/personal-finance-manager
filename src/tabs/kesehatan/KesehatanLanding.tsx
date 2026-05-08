import { useState } from 'react'
import PiramidaShell from './PiramidaShell'
import KalkulatorBanner from './KalkulatorBanner'
import ModulCard from './ModulCard'
import EmptyStateCTA from './EmptyStateCTA'
import { MODUL_CATALOG } from './modulCatalog'
import {
  useTotalDataCount,
  EMPTY_STATE_THRESHOLD,
  useIndikator,
  deriveTierColors,
  type TierId,
} from '@/queries/kesehatan'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import Tier1Panel from './Tier1Panel'
import Tier2Panel from './Tier2Panel'
import Tier3Panel from './Tier3Panel'
import Tier4Panel from './Tier4Panel'

/**
 * Phase 12 landing + Phase 13 panel infra.
 *
 * Branching:
 *   - Loading total count → skeleton
 *   - Empty (total < 3)   → PiramidaShell grayed + EmptyStateCTA + banner + grid modul
 *   - Normal              → Accordion(PiramidaShell tierColors) + banner + grid modul
 *
 * Wave 1 (13-01): Tier panel render skeleton/placeholder via TierPanel default.
 * Wave 2 (13-02/03/04): replace { 1: <Tier1Panel/>, 2: <Tier2Panel/>, ... } di tierPanelMap.
 */
export default function KesehatanLanding() {
  const countQuery = useTotalDataCount()
  const indikator = useIndikator()
  const [openTier, setOpenTier] = useState<string | undefined>(undefined)

  const isLoading = countQuery.isLoading
  const isError = countQuery.isError
  const isEmpty =
    !isLoading &&
    !isError &&
    countQuery.data !== undefined &&
    countQuery.data.total < EMPTY_STATE_THRESHOLD

  // Derive tier colors hanya kalau indikator ready + bukan empty state
  const tierColors = !isEmpty && !indikator.isLoading
    ? deriveTierColors(indikator.indicators)
    : undefined

  /**
   * Build TierPanel content per tier. Wave 1 default:
   *   - Tier 1/2/3: skeleton placeholder card (data not ready) atau "Wave 2 akan isi"
   *     placeholder. Wave 2 plans replace dengan Tier1Panel/Tier2Panel/Tier3Panel components
   *     yang import langsung indicators dari useIndikator hook.
   *   - Tier 4: placeholderText "Smart-gated checklist akan tersedia di update berikutnya"
   */
  const renderTierContent = (tierId: TierId) => {
    // Tier 4 = permanent placeholder (Phase 14 deliver mutation form)
    if (tierId === 4) {
      return <Tier4Panel />
    }

    // Loading guard: render skeleton sambil tunggu compose hooks ready
    if (indikator.isLoading || !indikator.indicators) {
      return (
        <div className="space-y-2 p-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )
    }

    // Wave 1: stub TierNPanel components rendered. Wave 2 (13-02/03/04) modify
    // EACH stub Panel file in-place dengan implementasi real (compute wiring,
    // CTAs, modul links, infoSlot tier-specific). KesehatanLanding TIDAK di-modify
    // di Wave 2 — file ownership exclusive.
    if (tierId === 1) {
      return <Tier1Panel indicators={indikator.indicators} darTotalInfo={indikator.darTotalInfo} />
    }
    if (tierId === 2) {
      return <Tier2Panel indicators={indikator.indicators} />
    }
    if (tierId === 3) {
      return <Tier3Panel indicators={indikator.indicators} />
    }
    return null  // unreachable (TierId = 1|2|3|4 exhaustive)
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Kesehatan Finansial</h1>
        <p className="text-sm text-muted-foreground">
          Lihat kondisi keuangan kamu lewat piramida 4 tier, lalu pelajari konsep finansial dari modul edukasi.
        </p>
      </header>

      {/* HERO: Piramida — branch loading / empty / normal */}
      <section aria-labelledby="piramida-heading">
        <h2 id="piramida-heading" className="sr-only">Piramida Kesehatan</h2>

        {isLoading && (
          <div className="mx-auto flex max-w-md flex-col items-center gap-2 py-4">
            <Skeleton className="h-14 w-1/2" />
            <Skeleton className="h-14 w-2/3" />
            <Skeleton className="h-14 w-4/5" />
            <Skeleton className="h-14 w-[95%]" />
          </div>
        )}

        {!isLoading && isError && (
          <p className="text-sm text-destructive text-center py-2">
            Gagal memuat data. Coba refresh halaman.
          </p>
        )}

        {!isLoading && !isError && isEmpty && (
          <PiramidaShell variant="grayed-empty" />
        )}

        {!isLoading && !isError && !isEmpty && (
          <Accordion
            type="single"
            collapsible
            value={openTier}
            onValueChange={setOpenTier}
            className="w-full"
          >
            <PiramidaShell
              tierColors={tierColors}
              renderTrigger={(tier, button) => (
                <AccordionItem value={`tier-${tier.id}`} className="border-0">
                  <AccordionTrigger className="p-0 hover:no-underline [&>svg]:hidden">
                    {button}
                  </AccordionTrigger>
                  <AccordionContent>
                    {renderTierContent(tier.id)}
                  </AccordionContent>
                </AccordionItem>
              )}
            />
          </Accordion>
        )}
      </section>

      {/* EMPTY STATE: welcome banner — hanya saat empty */}
      {isEmpty && (
        <section aria-labelledby="empty-state-heading">
          <h2 id="empty-state-heading" className="sr-only">Welcome — mulai isi data</h2>
          <EmptyStateCTA />
        </section>
      )}

      {/* BANNER kalkulator */}
      <section aria-labelledby="kalkulator-heading">
        <h2 id="kalkulator-heading" className="sr-only">Kalkulator Compound Interest</h2>
        <KalkulatorBanner />
      </section>

      {/* GRID modul */}
      <section aria-labelledby="modul-heading" className="space-y-3">
        <h2 id="modul-heading" className="text-lg font-semibold">Modul Edukasi</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {MODUL_CATALOG.map((modul) => (
            <ModulCard key={modul.slug} modul={modul} />
          ))}
        </div>
      </section>
    </div>
  )
}

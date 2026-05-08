import PiramidaShell from './PiramidaShell'
import KalkulatorBanner from './KalkulatorBanner'
import ModulCard from './ModulCard'
import EmptyStateCTA from './EmptyStateCTA'
import { MODUL_CATALOG } from './modulCatalog'
import { useTotalDataCount, EMPTY_STATE_THRESHOLD } from '@/queries/kesehatan'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Phase 12 landing — 3 section shell + DIAG-11 empty state branching.
 *
 * Empty state (total rows < 3):
 *   - PiramidaShell variant="grayed-empty"
 *   - EmptyStateCTA welcome banner dengan 3 quick-link CTA
 *   - Banner kalkulator + grid modul tetap accessible (modul/kalkulator gak butuh data)
 *
 * Normal state (total rows ≥ 3):
 *   - PiramidaShell default (Phase 13 akan inject indicators)
 *   - Banner kalkulator + grid modul
 *
 * Loading state: skeleton untuk piramida + banner placeholder, grid modul render
 * normal (modul catalog static, no data wait needed).
 */
export default function KesehatanLanding() {
  const countQuery = useTotalDataCount()

  const isLoading = countQuery.isLoading
  const isError = countQuery.isError
  const isEmpty =
    !isLoading &&
    !isError &&
    countQuery.data !== undefined &&
    countQuery.data.total < EMPTY_STATE_THRESHOLD

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Kesehatan Finansial</h1>
        <p className="text-sm text-muted-foreground">
          Lihat kondisi keuangan kamu lewat piramida 4 tier, lalu pelajari konsep finansial dari modul edukasi.
        </p>
      </header>

      {/* HERO: Piramida shell — branch berdasarkan loading/empty/normal */}
      <section aria-labelledby="piramida-heading">
        <h2 id="piramida-heading" className="sr-only">Piramida Kesehatan</h2>
        {isLoading ? (
          <div className="mx-auto flex max-w-md flex-col items-center gap-2 py-4">
            <Skeleton className="h-14 w-1/2" />
            <Skeleton className="h-14 w-2/3" />
            <Skeleton className="h-14 w-4/5" />
            <Skeleton className="h-14 w-[95%]" />
          </div>
        ) : (
          <>
            {isError && (
              <p className="text-sm text-destructive text-center py-2">
                Gagal memuat data. Coba refresh halaman.
              </p>
            )}
            <PiramidaShell variant={isEmpty ? 'grayed-empty' : 'default'} />
          </>
        )}
      </section>

      {/* EMPTY STATE: Welcome banner dengan 3 quick-link CTA (hanya saat empty) */}
      {isEmpty && (
        <section aria-labelledby="empty-state-heading">
          <h2 id="empty-state-heading" className="sr-only">Welcome — mulai isi data</h2>
          <EmptyStateCTA />
        </section>
      )}

      {/* BANNER kalkulator — selalu accessible (empty atau normal) */}
      <section aria-labelledby="kalkulator-heading">
        <h2 id="kalkulator-heading" className="sr-only">Kalkulator Compound Interest</h2>
        <KalkulatorBanner />
      </section>

      {/* GRID 6 card modul — selalu accessible */}
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

import PiramidaShell from './PiramidaShell'
import KalkulatorBanner from './KalkulatorBanner'
import ModulCard from './ModulCard'
import { MODUL_CATALOG } from './modulCatalog'

/**
 * Phase 12 landing — 3 section shell:
 *  1. HERO: PiramidaShell (4-tier, grayed di Phase 12)
 *  2. BANNER kalkulator
 *  3. GRID 6 card modul (2 kol desktop, 1 kol mobile)
 *
 * Phase 13 akan inject `indicators` ke PiramidaShell + tambah TierPanel.
 * DIAG-11 empty state di Plan 12-03 akan branch render di sini berdasarkan total count.
 */
export default function KesehatanLanding() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Kesehatan Finansial</h1>
        <p className="text-sm text-muted-foreground">
          Lihat kondisi keuangan kamu lewat piramida 4 tier, lalu pelajari konsep finansial dari modul edukasi.
        </p>
      </header>

      {/* HERO: Piramida shell */}
      <section aria-labelledby="piramida-heading">
        <h2 id="piramida-heading" className="sr-only">Piramida Kesehatan</h2>
        <PiramidaShell />
      </section>

      {/* BANNER kalkulator */}
      <section aria-labelledby="kalkulator-heading">
        <h2 id="kalkulator-heading" className="sr-only">Kalkulator Compound Interest</h2>
        <KalkulatorBanner />
      </section>

      {/* GRID 6 card modul */}
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

// Side-effect import: bundles Fraunces Variable woff2 into this chunk.
// routes.tsx wraps KesehatanModulLayout via React.lazy → font loads only when user enters /kesehatan/<slug>.
// ESLint disable: import/order would auto-sort this side-effect import, breaking the Vite chunk boundary.
// Fraunces MUST be the first import so Vite groups its CSS+woff2 with this layout's lazy chunk.
// eslint-disable-next-line import/order
import '@fontsource-variable/fraunces'

import { Link, Outlet, useParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { MODUL_CATALOG } from './modulCatalog'
import { MODUL_ORDER, type ModulSlug } from '@/data/modulContent'
import { cn } from '@/lib/utils'

function getCurrentModul(slug: string | undefined) {
  if (!slug) return null
  return MODUL_CATALOG.find((m) => m.slug === slug) ?? null
}

function getPrevNext(slug: string | undefined) {
  if (!slug) return { prev: null, next: null }
  const idx = MODUL_ORDER.indexOf(slug as ModulSlug)
  if (idx === -1) return { prev: null, next: null }
  const total = MODUL_ORDER.length
  const prevSlug = MODUL_ORDER[(idx - 1 + total) % total]
  const nextSlug = MODUL_ORDER[(idx + 1) % total]
  return {
    prev: MODUL_CATALOG.find((m) => m.slug === prevSlug) ?? null,
    next: MODUL_CATALOG.find((m) => m.slug === nextSlug) ?? null,
  }
}

export default function KesehatanModulLayout() {
  const { slug } = useParams<{ slug: string }>()
  const current = getCurrentModul(slug)
  const { prev, next } = getPrevNext(slug)

  return (
    <div className="space-y-0 pb-16">
      {/* Breadcrumb — D-18 2-level, NOT sticky D-19 */}
      <nav
        aria-label="Breadcrumb"
        className="max-w-[65ch] mx-auto px-4 pt-8 pb-2 font-sans text-sm text-muted-foreground"
      >
        <Link
          to="/kesehatan"
          className="text-brand hover:underline underline-offset-4"
        >
          Kesehatan
        </Link>
        <span className="mx-2 text-border">/</span>
        <span className="text-foreground font-medium">
          {current?.label ?? slug ?? 'Modul'}
        </span>
      </nav>

      {/* Modul body via Outlet → ModulRenderer */}
      <Outlet />

      {/* Footer prev/next — D-05 wrap-around */}
      {prev && next ? (
        <footer className="max-w-[65ch] mx-auto px-4 mt-12">
          <div className="border-t pt-6 flex items-center justify-between gap-4 font-sans">
            <Link
              to={`/kesehatan/${prev.slug}`}
              className={cn(
                "group flex items-center gap-2 text-sm font-semibold text-foreground",
                "transition-colors hover:text-brand",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 rounded-md px-2 py-1",
              )}
              aria-label={`Modul sebelumnya: ${prev.label}`}
            >
              <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
              <span>{prev.label}</span>
            </Link>
            <Link
              to={`/kesehatan/${next.slug}`}
              className={cn(
                "group flex items-center gap-2 text-sm font-semibold text-foreground text-right",
                "transition-colors hover:text-brand",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 rounded-md px-2 py-1",
              )}
              aria-label={`Modul berikutnya: ${next.label}`}
            >
              <span>{next.label}</span>
              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
          <div className="mt-6 text-center">
            <Link
              to="/kesehatan"
              className="text-sm font-sans text-muted-foreground hover:text-brand underline-offset-4 hover:underline"
            >
              Lihat semua modul →
            </Link>
          </div>
        </footer>
      ) : null}
    </div>
  )
}

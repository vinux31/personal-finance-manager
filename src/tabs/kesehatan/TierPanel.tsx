import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import IndikatorCard from './IndikatorCard'
import type { IndikatorResult } from '@/queries/kesehatan'

export type TierPanelIndicator = {
  label: string
  thresholdHint?: string
  result: IndikatorResult
}

export type TierPanelCTA = {
  label: string
  to: string
  variant?: 'default' | 'outline'
}

export type TierPanelModulLink = {
  label: string  // "Pondasi & Cash Flow"
  slug: string   // "arus-kas"
}

export type TierPanelProps = {
  tierId: 1 | 2 | 3 | 4
  /** Daftar indikator yang dirender via IndikatorCard. */
  indicators?: TierPanelIndicator[]
  /** Optional info row (mis. DAR Total info di Tier 1). */
  infoSlot?: ReactNode
  /** CTA buttons di bawah indicator stack. */
  ctas?: TierPanelCTA[]
  /** Optional link ke modul edukasi (1+ slugs). */
  modulLinks?: TierPanelModulLink[]
  /** Override saat tier 4 (placeholder Phase 13). */
  placeholderText?: string
}

/**
 * Generic tier panel shell. Phase 13 plan 13-01 = skeleton; Wave 2 plans (13-02/03/04)
 * pass tier-specific `indicators` + `ctas` + `modulLinks` + `infoSlot`.
 *
 * Tier 4 case: lewat `placeholderText` → render single info card instead of indicators.
 */
export default function TierPanel({
  tierId,
  indicators = [],
  infoSlot,
  ctas = [],
  modulLinks = [],
  placeholderText,
}: TierPanelProps) {
  const navigate = useNavigate()

  return (
    <div className="space-y-4 p-4">
      {placeholderText ? (
        <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
          {placeholderText}
        </div>
      ) : (
        <>
          {/* Indikator stack */}
          {indicators.length > 0 && (
            <div className="space-y-2">
              {indicators.map((ind, idx) => (
                <IndikatorCard
                  key={`${tierId}-${idx}`}
                  label={ind.label}
                  thresholdHint={ind.thresholdHint}
                  result={ind.result}
                />
              ))}
            </div>
          )}

          {/* Info row (mis. DAR Total) */}
          {infoSlot && (
            <div className="rounded-md border-l-2 border-muted bg-muted/20 p-2 text-xs text-muted-foreground">
              {infoSlot}
            </div>
          )}

          {/* CTA row */}
          {ctas.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {ctas.map((cta, idx) => (
                <Button
                  key={idx}
                  variant={cta.variant ?? 'outline'}
                  size="sm"
                  onClick={() => navigate(cta.to)}
                >
                  {cta.label}
                  <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              ))}
            </div>
          )}

          {/* Modul links */}
          {modulLinks.length > 0 && (
            <div className="border-t pt-3 space-y-1">
              {modulLinks.map(link => (
                <button
                  key={link.slug}
                  type="button"
                  onClick={() => navigate(`/kesehatan/${link.slug}`)}
                  className="flex items-center gap-2 text-xs text-primary hover:underline"
                >
                  <BookOpen className="h-3 w-3" />
                  Pelajari: {link.label}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

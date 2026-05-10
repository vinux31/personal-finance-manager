"use client"

import * as React from "react"
import { Popover as PopoverPrimitive } from "radix-ui"
import { GLOSSARY, isGlossaryTerm } from "@/data/glossary"
import { cn } from "@/lib/utils"

export type GlossaryTooltipProps = {
  term: string // string (not GlossaryTerm) — accept anything, validate via guard
  children: React.ReactNode
  className?: string
}

/**
 * Inline glossary tooltip. Click-only on all devices (D-14 revised post-research).
 * Uses Radix Popover (NOT Tooltip) because Radix Tooltip is W3C ARIA hover/focus only —
 * Popover supports click-to-open + tap-to-open + focus management + Esc + outside-click
 * out of the box. See 15-RESEARCH.md §Pitfall #2.
 *
 * If term is not a valid GlossaryTerm key, renders children as plain text fallback —
 * no Popover, no underline, no console error. Authoring sentinel-style markers safe
 * (T-15-07 / T-XSS-2 mitigation: silently ignore unknown markers).
 */
export function GlossaryTooltip({ term, children, className }: GlossaryTooltipProps) {
  // Graceful fallback for unknown / sentinel terms — render plain text.
  if (!isGlossaryTerm(term)) {
    return <span className={className}>{children}</span>
  }

  const entry = GLOSSARY[term]

  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger asChild>
        <span
          data-slot="glossary-tooltip-trigger"
          tabIndex={0}
          role="button"
          aria-label={`Definisi: ${entry.label}`}
          className={cn(
            "inline border-b border-dotted border-muted-foreground cursor-help underline-offset-4",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:rounded-sm",
            "hover:border-foreground transition-colors",
            className,
          )}
          onKeyDown={(e) => {
            // Radix Popover handles Enter/Space via Trigger asChild — ensure it propagates.
            if (e.key === " " || e.key === "Enter") {
              e.preventDefault()
              ;(e.currentTarget as HTMLElement).click()
            }
          }}
        >
          {children}
        </span>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          data-slot="glossary-tooltip-content"
          side="top"
          align="center"
          sideOffset={4}
          collisionPadding={8}
          className={cn(
            "z-50 max-w-xs rounded-md border bg-popover px-3 py-2 text-popover-foreground shadow-md",
            "font-sans text-sm",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
            "data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2",
          )}
        >
          <div className="font-semibold mb-1">{entry.label}</div>
          <div className="leading-relaxed">{entry.definition}</div>
          <PopoverPrimitive.Arrow className="size-2.5 fill-popover -translate-y-px" />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}

export default GlossaryTooltip

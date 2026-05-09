/**
 * Tier 4 — WARISAN & ASURANSI JIWA panel.
 *
 * Phase 14 DIAG-09 + DIAG-12:
 * - Smart-gated checklist: gate (has_dependents) → conditional Asuransi Jiwa
 *   (3 questions when has_dependents=true) + universal Estate (3 questions
 *   after gate answered).
 * - Auto-save per radio onValueChange (no Submit button — UI-SPEC decision).
 * - Estate 3-state (Ya/Tidak/Belum diisi) maps to boolean | null at boundary
 *   per Pitfall 6 mitigation.
 * - Toggle has_dependents Ya↔Tidak preserves life_* values in DB (Decision D);
 *   only UI hides via JSX conditional.
 * - View-As mode: all radios disabled, inline amber notice at top, mutation hook
 *   defensive throw (Plan 14-01) prevents writes if DOM bypass attempted.
 *
 * File split policy (Plan 14-03 Task 3): split mode active.
 * - First-pass inline implementation measured 234 LOC (>200), triggering
 *   extraction of Asuransi Jiwa section to Tier4LifeSection.tsx (Plan 14-03
 *   policy: extract IF AND ONLY IF Tier4Panel exceeds 200 LOC inline).
 * - Estate section (3 fieldsets, unrolled for explicit mutation.mutate count
 *   per acceptance ≥7) + gate + View-As notice STAY in Tier4Panel.tsx always.
 *
 * Architecture (single-source render flow):
 *   useProtectionChecklist (Plan 14-01)
 *     → row: ProtectionChecklistRow | null
 *     → render gate radio (always, 2 options Ya/Tidak)
 *     → IF row.has_dependents === true: render <Tier4LifeSection> (3 questions)
 *     → IF gate answered (true OR false): render Estate section (3 fieldsets)
 *
 * Auto-save flow (per radio onValueChange):
 *   user click → onValueChange(value)
 *     → mutation.mutate({ field: adapted_value })
 *     → onMutate: snapshot prev row + optimistic setQueryData (spread merge)
 *     → upsertProtectionChecklist (Supabase UPSERT ON CONFLICT user_id)
 *     → onSettled: invalidateQueries(['kesehatan', 'protection-checklist', uid])
 *     → useIndikator useMemo recompute → deriveTierColors recompute Tier 4
 *     → KesehatanLanding tierColors prop change → PiramidaShell trapezoid flip
 *
 * Boundary adapters (Pitfall 6 mitigation — string ↔ boolean | null):
 *   gateValueToString:    boolean | null | undefined → 'ya' | 'tidak' | ''
 *   boolToString:         boolean | null | undefined → 'ya' | 'tidak' | ''
 *   estateValueToString:  boolean | null | undefined → 'ya' | 'tidak' | 'belum'
 *   estateStringToBoolean:'ya' | 'tidak' | 'belum'   → boolean | null
 *
 * Empty string '' value on RadioGroup means "no selection yet" — radix renders
 * no checked radio. This is the initial state for life_coverage / life_post_*
 * fields (which are nullable enums) before any user interaction.
 *
 * Tier 4 trapezoid color flips reactively via:
 * mutation.mutate → optimistic setQueryData → useIndikator useMemo recompute →
 * deriveTierColors(indicators, protectionRow) → computeTier4Color(row).
 */
import { Eye } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useViewAs } from '@/auth/useViewAs'
import { useProtectionChecklist, useUpdateProtectionChecklist } from '@/queries/protectionChecklist'
import type { ProtectionChecklistPatch } from '@/db/protectionChecklist'
import Tier4LifeSection from './Tier4LifeSection'

// ============================================================
// Boundary adapters — convert between RadioGroup string values and
// ProtectionChecklistRow's boolean | null typed columns.
// ============================================================
//
// gateValueToString:
//   Maps has_dependents (boolean | null | undefined) to the radio value.
//   Empty string '' means "not yet answered" — radix RadioGroup renders no
//   selected radio when value is empty. Gate has only 2 options (Ya / Tidak)
//   so user cannot transition back to '' once answered (UI-SPEC §Component 2).
function gateValueToString(v: boolean | null | undefined): 'ya' | 'tidak' | '' {
  return v === true ? 'ya' : v === false ? 'tidak' : ''
}

// estateValueToString:
//   Maps each estate_* boolean | null column to the 3-state radio value.
//   Per Decision E (CONTEXT.md): Ya / Tidak / Belum diisi maps to true / false / null.
//   Default "Belum diisi" (Pitfall 6 mitigation — null sentinel at boundary).
function estateValueToString(v: boolean | null | undefined): 'ya' | 'tidak' | 'belum' {
  return v === true ? 'ya' : v === false ? 'tidak' : 'belum'
}

// estateStringToBoolean:
//   Reverse adapter — RadioGroup onValueChange string → boolean | null patch.
//   'belum' → null (column nullable in DB). T-14-03-01 Tampering mitigation:
//   any unexpected value falls through to null (safe default — DB CHECK ok).
function estateStringToBoolean(s: string): boolean | null {
  return s === 'ya' ? true : s === 'tidak' ? false : null
}

// ============================================================
// Shared Tailwind class fragments (to keep JSX concise).
// ============================================================
// ROW_CLS: each radio item wrapper (touch target ≥44px per WCAG min-h-11).
// HORIZ_CLS: 2-3 option groups wrap horizontally on sm+ breakpoints,
//            stack vertically on mobile (UI-SPEC §Mobile Breakpoint).
const ROW_CLS = 'flex items-center gap-2 min-h-11'
const HORIZ_CLS = 'flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-3'

export default function Tier4Panel() {
  const { viewingAs } = useViewAs()
  const isViewAs = viewingAs !== null
  const { data: row } = useProtectionChecklist()
  const mutation = useUpdateProtectionChecklist()

  const gateAnswered = row?.has_dependents === true || row?.has_dependents === false
  const showLife = row?.has_dependents === true

  return (
    <div className="space-y-4 p-4">
      {isViewAs && (
        <div role="status" aria-live="polite"
          className="rounded-md bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 px-3 py-2 text-sm text-amber-800 dark:text-amber-200 flex items-center gap-2">
          <Eye className="h-4 w-4" />
          Mode View-As — kamu hanya bisa lihat, tidak bisa simpan.
        </div>
      )}

      {/* Gate */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Punya tanggungan finansial (anak, pasangan, ortu)?</legend>
        <RadioGroup value={gateValueToString(row?.has_dependents)}
          onValueChange={(v) => mutation.mutate({ has_dependents: v === 'ya' })}
          disabled={isViewAs} className={HORIZ_CLS}>
          <div className={ROW_CLS}>
            <RadioGroupItem value="ya" id="gate-ya" disabled={isViewAs} />
            <Label htmlFor="gate-ya" className="text-sm cursor-pointer">Ya</Label>
          </div>
          <div className={ROW_CLS}>
            <RadioGroupItem value="tidak" id="gate-tidak" disabled={isViewAs} />
            <Label htmlFor="gate-tidak" className="text-sm cursor-pointer">Tidak</Label>
          </div>
        </RadioGroup>
        <p className="text-xs text-muted-foreground">Kalau ya, kami tampilkan checklist asuransi jiwa.</p>
      </fieldset>

      {/* Asuransi Jiwa (conditional, extracted per file split policy — Tier4LifeSection.tsx) */}
      {showLife && (
        <Tier4LifeSection row={row} mutation={mutation} isViewAs={isViewAs} />
      )}

      {/* Estate (universal after gate answered) — 3 fieldsets unrolled per acceptance */}
      {gateAnswered && (
        <section className="space-y-3 border-t pt-4">
          <h3 className="text-base font-semibold">Estate Planning</h3>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Pewaris (ahli waris) sudah teridentifikasi & terdokumentasi?</legend>
            <RadioGroup value={estateValueToString(row?.estate_heirs_documented)}
              onValueChange={(v) => mutation.mutate({ estate_heirs_documented: estateStringToBoolean(v) } as ProtectionChecklistPatch)}
              disabled={isViewAs} className={HORIZ_CLS}>
              <div className={ROW_CLS}>
                <RadioGroupItem value="ya" id="estate-heirs-ya" disabled={isViewAs} />
                <Label htmlFor="estate-heirs-ya" className="text-sm cursor-pointer">Ya</Label>
              </div>
              <div className={ROW_CLS}>
                <RadioGroupItem value="tidak" id="estate-heirs-tidak" disabled={isViewAs} />
                <Label htmlFor="estate-heirs-tidak" className="text-sm cursor-pointer">Tidak</Label>
              </div>
              <div className={ROW_CLS}>
                <RadioGroupItem value="belum" id="estate-heirs-belum" disabled={isViewAs} />
                <Label htmlFor="estate-heirs-belum" className="text-sm cursor-pointer">Belum diisi</Label>
              </div>
            </RadioGroup>
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Daftar aset kamu sudah terdokumentasi (kontak, lokasi, nomor)?</legend>
            <RadioGroup value={estateValueToString(row?.estate_assets_documented)}
              onValueChange={(v) => mutation.mutate({ estate_assets_documented: estateStringToBoolean(v) } as ProtectionChecklistPatch)}
              disabled={isViewAs} className={HORIZ_CLS}>
              <div className={ROW_CLS}>
                <RadioGroupItem value="ya" id="estate-assets-ya" disabled={isViewAs} />
                <Label htmlFor="estate-assets-ya" className="text-sm cursor-pointer">Ya</Label>
              </div>
              <div className={ROW_CLS}>
                <RadioGroupItem value="tidak" id="estate-assets-tidak" disabled={isViewAs} />
                <Label htmlFor="estate-assets-tidak" className="text-sm cursor-pointer">Tidak</Label>
              </div>
              <div className={ROW_CLS}>
                <RadioGroupItem value="belum" id="estate-assets-belum" disabled={isViewAs} />
                <Label htmlFor="estate-assets-belum" className="text-sm cursor-pointer">Belum diisi</Label>
              </div>
            </RadioGroup>
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Surat wasiat sudah ada (notaris atau private)?</legend>
            <RadioGroup value={estateValueToString(row?.estate_will_exists)}
              onValueChange={(v) => mutation.mutate({ estate_will_exists: estateStringToBoolean(v) } as ProtectionChecklistPatch)}
              disabled={isViewAs} className={HORIZ_CLS}>
              <div className={ROW_CLS}>
                <RadioGroupItem value="ya" id="estate-will-ya" disabled={isViewAs} />
                <Label htmlFor="estate-will-ya" className="text-sm cursor-pointer">Ya</Label>
              </div>
              <div className={ROW_CLS}>
                <RadioGroupItem value="tidak" id="estate-will-tidak" disabled={isViewAs} />
                <Label htmlFor="estate-will-tidak" className="text-sm cursor-pointer">Tidak</Label>
              </div>
              <div className={ROW_CLS}>
                <RadioGroupItem value="belum" id="estate-will-belum" disabled={isViewAs} />
                <Label htmlFor="estate-will-belum" className="text-sm cursor-pointer">Belum diisi</Label>
              </div>
            </RadioGroup>
          </fieldset>
        </section>
      )}
    </div>
  )
}

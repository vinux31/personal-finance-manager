import { useState } from 'react'
import { Pencil, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useViewAs } from '@/auth/useViewAs'
import { COLOR_BADGE_CLASS, COLOR_BORDER_CLASS } from '@/queries/kesehatanTypes'
import { useUpdateProtectionChecklist } from '@/queries/protectionChecklist'
import type { ProtectionChecklistRow } from '@/db/protectionChecklist'

/**
 * Tier 1 #4 — Asuransi Kesehatan inline form (Phase 14 DIAG-04).
 *
 * 3-state machine (per UI-SPEC §Component 1):
 *   A. empty   → row null OR health_coverage NULL → red border + "Belum diisi" badge + "Pilih cover →" button
 *   B. editing → 5 radio options vertical + [Batal | Simpan] buttons
 *   C. filled  → green/red border + mapped badge + edit pencil icon
 *
 * Mutation handled by useUpdateProtectionChecklist (Plan 14-01) — optimistic flip
 * + toast.success/toast.error already wired in the hook. DO NOT add toast here.
 *
 * View-As guard (Decision F per CONTEXT.md):
 *   - State A in View-As: NO "Pilih cover" button (badge only).
 *   - State C in View-As: NO pencil icon.
 *   - State B unreachable in View-As (no entry path).
 *   - Defensive: RadioGroupItem disabled={isViewAs} + Submit hidden if reached.
 */

type HealthCoverage = NonNullable<ProtectionChecklistRow['health_coverage']>

const HEALTH_OPTIONS: ReadonlyArray<{ value: HealthCoverage; label: string }> = [
  { value: 'kantor', label: 'Kantor (asuransi grup)' },
  { value: 'bpjs', label: 'BPJS' },
  { value: 'pribadi', label: 'Pribadi (beli sendiri)' },
  { value: 'kombinasi', label: 'Kombinasi (kantor + pribadi)' },
  { value: 'tidak', label: 'Tidak / belum tahu' },
]

// Single source of truth for State C badge display in this component.
// Component-local — do NOT import HEALTH_COVERAGE_LABEL or any other map
// from kesehatanTier1.ts. Each surface owns its own UI strings.
const STATE_C_BADGE_TEXT: Record<HealthCoverage, string> = {
  kantor: 'Kantor',
  bpjs: 'BPJS',
  pribadi: 'Pribadi',
  kombinasi: 'Kombinasi',
  tidak: 'Tidak covered',
}

type Props = { row: { health_coverage: HealthCoverage | null } | null }

export default function AsuransiKesehatanForm({ row }: Props) {
  const { viewingAs } = useViewAs()
  const isViewAs = viewingAs !== null
  const mutation = useUpdateProtectionChecklist()

  const current: HealthCoverage | null = row?.health_coverage ?? null
  const [isEditing, setEditing] = useState(false)
  const [draft, setDraft] = useState<HealthCoverage | ''>(current ?? '')

  const showEdit = isEditing && !isViewAs // State B
  const isFilled = current !== null // State C base
  const stateColor: 'red' | 'green' =
    current === 'tidak' || current === null ? 'red' : 'green'

  function handleEditClick() {
    setDraft(current ?? '')
    setEditing(true)
  }

  function handleCancel() {
    setEditing(false)
  }

  function handleSubmit() {
    if (!draft) return
    mutation.mutate(
      { health_coverage: draft as HealthCoverage },
      { onSuccess: () => setEditing(false) },
    )
  }

  // ============= State B (editing) =============
  if (showEdit) {
    return (
      <div
        className={`rounded-lg border border-l-4 bg-card p-3 space-y-2 ${COLOR_BORDER_CLASS[stateColor]}`}
      >
        <div className="text-sm font-medium">Asuransi Kesehatan</div>
        <Label className="text-sm font-medium">
          Kesehatan kamu (& keluarga) tercover?
        </Label>
        <RadioGroup
          value={draft}
          onValueChange={(v) => setDraft(v as HealthCoverage)}
          disabled={isViewAs}
          className="grid gap-2"
        >
          {HEALTH_OPTIONS.map((opt) => (
            <div key={opt.value} className="flex items-center gap-2 min-h-11">
              <RadioGroupItem
                value={opt.value}
                id={`health-${opt.value}`}
                disabled={isViewAs}
              />
              <Label
                htmlFor={`health-${opt.value}`}
                className="text-sm cursor-pointer"
              >
                {opt.label}
              </Label>
            </div>
          ))}
        </RadioGroup>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={handleCancel}>
            Batal
          </Button>
          {!isViewAs && (
            <Button
              size="sm"
              disabled={!draft || mutation.isPending}
              onClick={handleSubmit}
            >
              Simpan
            </Button>
          )}
        </div>
      </div>
    )
  }

  // ============= State C (filled) =============
  if (isFilled) {
    return (
      <div
        className={`rounded-lg border border-l-4 bg-card p-3 ${COLOR_BORDER_CLASS[stateColor]}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 space-y-1">
            <div className="text-sm font-medium">Asuransi Kesehatan</div>
            <p className="text-[10px] text-muted-foreground">
              Covered (kantor/BPJS/dst) hijau · belum diisi atau tidak covered merah
            </p>
          </div>
          <div className="flex items-center gap-1">
            <span
              className={`rounded px-2 py-1 text-sm font-semibold ${COLOR_BADGE_CLASS[stateColor]}`}
            >
              {current ? STATE_C_BADGE_TEXT[current] : ''}
            </span>
            {!isViewAs && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleEditClick}
                aria-label="Edit asuransi kesehatan"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ============= State A (empty) =============
  return (
    <div
      className={`rounded-lg border border-l-4 bg-card p-3 ${COLOR_BORDER_CLASS.red}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 space-y-1">
          <div className="text-sm font-medium">Asuransi Kesehatan</div>
          <p className="text-[10px] text-muted-foreground">
            Covered (kantor/BPJS/dst) hijau · belum diisi atau tidak covered merah
          </p>
        </div>
        <span
          className={`rounded px-2 py-1 text-sm font-semibold ${COLOR_BADGE_CLASS.red}`}
        >
          Belum diisi
        </span>
      </div>
      {!isViewAs && (
        <div className="flex justify-end pt-2">
          <Button variant="outline" size="sm" onClick={handleEditClick}>
            Pilih cover
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  )
}

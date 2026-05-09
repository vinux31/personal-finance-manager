/**
 * Tier 4 Asuransi Jiwa sub-section (Plan 14-03 Task 3 file split).
 *
 * Extracted from Tier4Panel.tsx because the inline implementation exceeded
 * 200 LOC (file split policy locked in 14-03-PLAN.md). Renders 3 questions:
 * - life_coverage Q1 (4-option radio: kantor / pribadi / keduanya / tidak)
 * - life_coverage_sufficient Q2 (boolean Ya/Tidak)
 * - life_coverage_post_employment Q3 (3-state enum: ya / tidak / tidak_yakin)
 *
 * Auto-save per radio change via mutation prop (no Submit button anywhere).
 * Disabled state controlled by isViewAs prop. Mutation hook (Plan 14-01)
 * provides defense-in-depth throw if View-As bypassed at DOM layer.
 */
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useUpdateProtectionChecklist } from '@/queries/protectionChecklist'
import type { ProtectionChecklistRow } from '@/db/protectionChecklist'

type LifeCoverage = NonNullable<ProtectionChecklistRow['life_coverage']>
type LifePost = NonNullable<ProtectionChecklistRow['life_coverage_post_employment']>

function boolToString(v: boolean | null | undefined): 'ya' | 'tidak' | '' {
  return v === true ? 'ya' : v === false ? 'tidak' : ''
}

const LIFE_OPTS: ReadonlyArray<readonly [LifeCoverage, string]> = [
  ['kantor', 'Kantor (asuransi grup)'],
  ['pribadi', 'Pribadi (beli sendiri)'],
  ['keduanya', 'Keduanya'],
  ['tidak', 'Tidak'],
]

const ROW_CLS = 'flex items-center gap-2 min-h-11'
const HORIZ_CLS = 'flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-3'

type Tier4LifeSectionProps = {
  row: ProtectionChecklistRow | null | undefined
  mutation: ReturnType<typeof useUpdateProtectionChecklist>
  isViewAs: boolean
}

export default function Tier4LifeSection({ row, mutation, isViewAs }: Tier4LifeSectionProps) {
  return (
    <section className="space-y-3 border-t pt-4">
      <h3 className="text-base font-semibold">Asuransi Jiwa</h3>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Apakah kamu punya asuransi jiwa?</legend>
        <RadioGroup value={row?.life_coverage ?? ''}
          onValueChange={(v) => mutation.mutate({ life_coverage: v as LifeCoverage })}
          disabled={isViewAs} className="grid gap-2">
          {LIFE_OPTS.map(([value, label]) => (
            <div key={value} className={ROW_CLS}>
              <RadioGroupItem value={value} id={`life-${value}`} disabled={isViewAs} />
              <Label htmlFor={`life-${value}`} className="text-sm cursor-pointer">{label}</Label>
            </div>
          ))}
        </RadioGroup>
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Apakah jumlah pertanggungan cukup (10× penghasilan tahunan)?</legend>
        <RadioGroup value={boolToString(row?.life_coverage_sufficient)}
          onValueChange={(v) => mutation.mutate({ life_coverage_sufficient: v === 'ya' })}
          disabled={isViewAs} className={HORIZ_CLS}>
          <div className={ROW_CLS}>
            <RadioGroupItem value="ya" id="life-suff-ya" disabled={isViewAs} />
            <Label htmlFor="life-suff-ya" className="text-sm cursor-pointer">Ya</Label>
          </div>
          <div className={ROW_CLS}>
            <RadioGroupItem value="tidak" id="life-suff-tidak" disabled={isViewAs} />
            <Label htmlFor="life-suff-tidak" className="text-sm cursor-pointer">Tidak</Label>
          </div>
        </RadioGroup>
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Tetap aktif setelah keluar dari kantor?</legend>
        <RadioGroup value={row?.life_coverage_post_employment ?? ''}
          onValueChange={(v) => mutation.mutate({ life_coverage_post_employment: v as LifePost })}
          disabled={isViewAs} className={HORIZ_CLS}>
          <div className={ROW_CLS}>
            <RadioGroupItem value="ya" id="life-post-ya" disabled={isViewAs} />
            <Label htmlFor="life-post-ya" className="text-sm cursor-pointer">Ya</Label>
          </div>
          <div className={ROW_CLS}>
            <RadioGroupItem value="tidak" id="life-post-tidak" disabled={isViewAs} />
            <Label htmlFor="life-post-tidak" className="text-sm cursor-pointer">Tidak</Label>
          </div>
          <div className={ROW_CLS}>
            <RadioGroupItem value="tidak_yakin" id="life-post-tidak_yakin" disabled={isViewAs} />
            <Label htmlFor="life-post-tidak_yakin" className="text-sm cursor-pointer">Tidak yakin</Label>
          </div>
        </RadioGroup>
      </fieldset>
    </section>
  )
}

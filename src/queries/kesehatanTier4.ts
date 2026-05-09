// ============================================================
// Tier 4 — WARISAN & ASURANSI JIWA compute logic
// ============================================================
//
// Smart-gated aggregation per CONTEXT.md Decision B + Decision D + Decision E:
//
// Gate (has_dependents):
//   - NULL or undefined  → 'gray' (gate not answered yet — abu-abu trapezoid)
//   - false              → estate-only aggregation (skip life_coverage*)
//   - true               → estate + life_coverage* aggregation
//
// Universal estate (3 fields, always counted after gate answered):
//   - true  → green
//   - false → red
//   - NULL  → red (per CONTEXT.md "NULL estate aggregation → red, push user fill")
//
// Conditional life_coverage* (3 fields, counted only when has_dependents=true):
//   - life_coverage in {kantor, pribadi, keduanya} → green
//   - life_coverage = 'tidak' or NULL              → red
//   - life_coverage_sufficient = true              → green; false/NULL → red
//   - life_coverage_post_employment = 'ya'         → green; 'tidak'/'tidak_yakin'/NULL → red
//
// Yellow boundary: NOT used in Phase 14 (CONTEXT.md deferred — spec §4 binary
// only). Output color domain = {green, red, gray}.
// ============================================================

import { aggregateTierColor } from './kesehatanIndikator'
import type { IndikatorResult } from './kesehatanTypes'
import type { ProtectionChecklistRow } from '@/db/protectionChecklist'

/**
 * Helper: boolean field → IndikatorResult (used for estate_*).
 * NULL maps to red per CONTEXT.md "NULL estate aggregation → red".
 */
function booleanToResult(value: boolean | null, label: string): IndikatorResult {
  if (value === true) {
    return { kind: 'compute', value: 1, color: 'green', display: `${label}: Ya` }
  }
  // false OR NULL → red
  return {
    kind: 'compute',
    value: 0,
    color: 'red',
    display: value === false ? `${label}: Tidak` : `${label}: Belum diisi`,
  }
}

/**
 * Compute aggregate Tier 4 color for PiramidaShell trapezoid.
 *
 * @param row protection_checklist row (or null if not yet created)
 * @returns 'green' | 'red' | 'gray'  (yellow not used in v1.2 — see file header)
 */
export function computeTier4Color(
  row: ProtectionChecklistRow | null,
): 'green' | 'yellow' | 'red' | 'gray' {
  // Gate not answered → gray (PiramidaShell renders abu-abu trapezoid)
  if (!row || row.has_dependents === null || row.has_dependents === undefined) {
    return 'gray'
  }

  const indicators: IndikatorResult[] = [
    booleanToResult(row.estate_heirs_documented, 'Ahli waris'),
    booleanToResult(row.estate_assets_documented, 'Aset terdokumentasi'),
    booleanToResult(row.estate_will_exists, 'Wasiat'),
  ]

  // Pitfall 3 mitigation: SKIP life_coverage* aggregation when has_dependents=false.
  // Decision D: gate=Tidak preserves life_* values in DB but they don't count toward color.
  if (row.has_dependents === true) {
    const lifeCovColor: 'green' | 'red' =
      row.life_coverage && row.life_coverage !== 'tidak' ? 'green' : 'red'
    indicators.push({
      kind: 'compute',
      value: lifeCovColor === 'green' ? 1 : 0,
      color: lifeCovColor,
      display: '',
    })

    indicators.push(
      row.life_coverage_sufficient === true
        ? { kind: 'compute', value: 1, color: 'green', display: '' }
        : { kind: 'compute', value: 0, color: 'red', display: '' },
    )

    const postEmpColor: 'green' | 'red' =
      row.life_coverage_post_employment === 'ya' ? 'green' : 'red'
    indicators.push({
      kind: 'compute',
      value: postEmpColor === 'green' ? 1 : 0,
      color: postEmpColor,
      display: '',
    })
  }

  return aggregateTierColor(indicators)
}

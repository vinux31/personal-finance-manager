---
phase: 08-dev-hygiene
reviewed: 2026-04-29T00:00:00Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - src/tabs/ReportsTab.tsx
  - supabase/seed.sql
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 8: Code Review Report

**Reviewed:** 2026-04-29
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Summary

Two source files reviewed: `src/tabs/ReportsTab.tsx` (295 lines, TypeScript/React) and `supabase/seed.sql` (1 line, intentionally empty placeholder).

`ReportsTab.tsx` is generally well-structured with clear separation of concerns across helper functions and a clean useMemo pattern. No security vulnerabilities or data-loss risks found. Two warnings were identified: a silent async failure path in the PDF export error handler, and a query scope leak in the custom date range preset when both date inputs are empty. Three informational items are noted for correctness hygiene.

`supabase/seed.sql` contains only a comment; no findings.

---

## Warnings

### WR-01: Unresolved async toast in export error handler

**File:** `src/tabs/ReportsTab.tsx:110-112`
**Issue:** The `catch` block in `handleExport` fires a dynamic `import('sonner')` promise but never awaits it. If `exportReportPDF` throws (e.g., jsPDF internal error), the `catch` block completes synchronously without displaying any error to the user. The toast fires asynchronously only if the component is still mounted and the import resolves in time. Additionally, the error is not logged anywhere, making debugging silent failures impossible.

```tsx
// Current — toast may never display
} catch {
  import('sonner').then(({ toast }) => toast.error('Gagal membuat PDF'))
}
```

**Fix:** Either pre-import `toast` at the top of the file (it is already an indirect dependency via sonner being in the project), or await the import inside an async handler:

```tsx
// Option A: pre-import (simplest)
import { toast } from 'sonner'  // add at top of file

function handleExport() {
  setExporting(true)
  try {
    exportReportPDF(params)
  } catch (err) {
    console.error('[ReportsTab] PDF export failed:', err)
    toast.error('Gagal membuat PDF')
  } finally {
    setExporting(false)
  }
}

// Option B: keep dynamic import but make handler async
async function handleExport() {
  setExporting(true)
  try {
    exportReportPDF(params)
  } catch (err) {
    console.error('[ReportsTab] PDF export failed:', err)
    const { toast } = await import('sonner')
    toast.error('Gagal membuat PDF')
  } finally {
    setExporting(false)
  }
}
```

---

### WR-02: Custom date preset fires unbounded queries when inputs are empty

**File:** `src/tabs/ReportsTab.tsx:242-245`
**Issue:** `resolvePreset` returns `{ from: undefined, to: undefined }` when `preset === 'custom'` and the user has not yet entered dates. This causes `useAggregateByPeriod`, `useAggregateByCategory` (×2), and `useInvestments` to execute with no date bounds — returning data for all time. The component shows "Kustom" selected but renders the same result set as "Semua", which is misleading. The queries should be suppressed (or a "pick a date" prompt shown) until at least `from` is set.

```ts
// Current
if (preset === 'custom') return { from: from || undefined, to: to || undefined }
// When from='' and to='', resolves to { from: undefined, to: undefined } → all data
```

**Fix:** Suppress query execution when custom preset has no dates filled in. The cleanest approach is to signal "not ready" from `resolvePreset` and gate the `enabled` flag in the query hooks, or show an empty state:

```tsx
// In ReportsTab:
const range = useMemo(() => resolvePreset(preset, from, to), [preset, from, to])
const customReady = preset !== 'custom' || !!from  // at minimum, from must be set

const { data: periodData = [] } = useAggregateByPeriod(gran, range.from, range.to)
// queries already have enabled: !!uid — add:
// queryFn enabled: !!uid && customReady

// Alternatively, show a prompt when custom + no dates:
{preset === 'custom' && !from && (
  <p className="text-sm text-muted-foreground">Pilih tanggal mulai untuk menampilkan laporan.</p>
)}
```

The simplest surgical fix is to add `&& customReady` to the `enabled` option in each `useQuery` call inside `src/queries/reports.ts`, passing `customReady` as an additional parameter.

---

## Info

### IN-01: PDF filename omits custom range end date

**File:** `src/tabs/ReportsTab.tsx:103`
**Issue:** `buildFilenameMonth(preset, from)` — the `to` date is not passed and not used. For a custom range like `2025-01-01` to `2025-03-31`, the exported filename becomes `laporan-keuangan-2025-01.pdf`, losing the end-date context and risking filename collision if the user exports two custom ranges starting in the same month.

**Fix:** Include the end date in the filename for custom ranges:

```ts
function buildFilenameMonth(p: PeriodPreset, f: string, t: string): string {
  // ...existing cases...
  if (f && t) return `${f.slice(0, 7)}_${t.slice(0, 7)}`
  if (f) return f.slice(0, 7)
  return 'kustom'
}
// Call: buildFilenameMonth(preset, from, to)
```

---

### IN-02: Array index used as React key for Pie chart cells

**File:** `src/tabs/ReportsTab.tsx:201`, `213`
**Issue:** Both `<Cell>` maps use `key={i}` (array index). If data is sorted, filtered, or reordered between renders, React may reuse the wrong cell DOM node and skip re-renders for color/value updates. Each category name is unique within its data set and should be used as the key.

```tsx
// Current (both pie charts)
{expenseByCat.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
```

**Fix:** Use the stable category name as the key:

```tsx
{expenseByCat.map((entry, i) => (
  <Cell key={entry.category} fill={PIE_COLORS[i % PIE_COLORS.length]} />
))}
```

Apply the same fix to the `incomeByCat` map at line 213.

---

### IN-03: seed.sql is intentionally empty — no findings

**File:** `supabase/seed.sql:1`
**Issue:** File contains only a dev comment. No issues. Noted here for completeness since it was in review scope.

**Fix:** No action required.

---

_Reviewed: 2026-04-29_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

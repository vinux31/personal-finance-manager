# Phase 3: Bills Display - Pattern Map

**Mapped:** 2026-04-24
**Files analyzed:** 4 (1 new component, 2 appended files, 1 modified file)
**Analogs found:** 4 / 4

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/components/UpcomingBillsPanel.tsx` | component | request-response (read-only display) | `src/tabs/DashboardTab.tsx` (Transaksi Terakhir + Goals Aktif panels) | exact |
| `src/db/recurringTransactions.ts` (append) | service / data-layer | request-response (Supabase query) | `src/db/recurringTransactions.ts` — `listRecurringTemplates()` | exact |
| `src/queries/recurringTransactions.ts` (append) | hook | request-response (TanStack Query) | `src/queries/recurringTransactions.ts` — `useRecurringTemplates()` | exact |
| `src/tabs/DashboardTab.tsx` (modify) | component / layout | request-response | `src/tabs/DashboardTab.tsx` — existing panel insertion pattern | exact |

---

## Pattern Assignments

### `src/db/recurringTransactions.ts` — append `listUpcomingBills`

**Analog:** `src/db/recurringTransactions.ts` — `listRecurringTemplates()` (lines 50–59)

**Imports pattern** (line 1 — already present, no new imports needed):
```typescript
import { supabase } from '@/lib/supabase'
```

**Core query pattern** (lines 50–59 — copy and extend with filters):
```typescript
export async function listRecurringTemplates(uid?: string): Promise<RecurringTemplate[]> {
  let query = supabase
    .from('recurring_templates')
    .select('id, name, type, category_id, amount, note, frequency, next_due_date, is_active')
    .order('name')
  if (uid) query = query.eq('user_id', uid)
  const { data, error } = await query
  if (error) throw error
  return data as RecurringTemplate[]
}
```

**New function to append — direct derivation of the above:**
```typescript
export async function listUpcomingBills(uid: string | undefined, endOfMonth: string): Promise<RecurringTemplate[]> {
  let query = supabase
    .from('recurring_templates')
    .select('id, name, type, category_id, amount, note, frequency, next_due_date, is_active')
    .eq('is_active', true)
    .eq('type', 'expense')
    .lte('next_due_date', endOfMonth)
    .order('next_due_date')
  if (uid) query = query.eq('user_id', uid)
  const { data, error } = await query
  if (error) throw error
  return data as RecurringTemplate[]
}
```

**Key diffs from analog:**
- Add `.eq('is_active', true)`, `.eq('type', 'expense')`, `.lte('next_due_date', endOfMonth)` filters before the `uid` guard
- Change `.order('name')` to `.order('next_due_date')` for ascending urgency sort (DB-side, no client sort needed)
- Parameter signature changes from `uid?: string` to `uid: string | undefined, endOfMonth: string`

**Native date arithmetic pattern** (lines 29–48 — `nextDueDate` shows the codebase's local-midnight date construction):
```typescript
const [y, m, d] = current.split('-').map(Number)
const date = new Date(y, m - 1, d)   // local midnight — never new Date(isoString)
```

---

### `src/queries/recurringTransactions.ts` — append `useUpcomingBills`

**Analog:** `src/queries/recurringTransactions.ts` — `useRecurringTemplates()` (lines 16–23)

**Imports pattern** (lines 1–13 — already present, add `listUpcomingBills` to the import from `@/db/recurringTransactions`):
```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  listRecurringTemplates,
  // ADD: listUpcomingBills,
  ...
} from '@/db/recurringTransactions'
import { useTargetUserId } from '@/auth/useTargetUserId'
```

**Core hook pattern** (lines 16–23):
```typescript
export function useRecurringTemplates() {
  const uid = useTargetUserId()
  return useQuery({
    queryKey: ['recurring-templates', uid],
    queryFn: () => listRecurringTemplates(uid),
    enabled: !!uid,
  })
}
```

**New hook to append:**
```typescript
export function useUpcomingBills() {
  const uid = useTargetUserId()
  const endOfMonth = useMemo(() => {
    const d = new Date()
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    const y = lastDay.getFullYear()
    const mo = String(lastDay.getMonth() + 1).padStart(2, '0')
    const day = String(lastDay.getDate()).padStart(2, '0')
    return `${y}-${mo}-${day}`
  }, [])
  return useQuery({
    queryKey: ['upcoming-bills', uid, endOfMonth],
    queryFn: () => listUpcomingBills(uid, endOfMonth),
    enabled: !!uid,
  })
}
```

**Additional import required at top of file:**
```typescript
import { useMemo } from 'react'
```

**Key diffs from analog:**
- `queryKey` includes `endOfMonth` to correctly scope cache per calendar month
- `useMemo(()=>{...}, [])` for `endOfMonth` — constant within a page load, prevents unnecessary re-renders
- `enabled: !!uid` — identical guard pattern

---

### `src/components/UpcomingBillsPanel.tsx` (NEW FILE)

**Analog:** `src/tabs/DashboardTab.tsx` — Transaksi Terakhir panel inner content (lines 137–163) + Goals Aktif inner content (lines 165–192)

**Imports pattern** (model from DashboardTab lines 1–12):
```typescript
import { useMemo } from 'react'
import { useUpcomingBills } from '@/queries/recurringTransactions'
import { formatRupiah } from '@/lib/format'
```

**Props interface** (follows DashboardTab's local function component style):
```typescript
interface UpcomingBillsPanelProps {
  income: number   // monthly.income from DashboardTab — already computed, no re-fetch
  expense: number  // monthly.expense from DashboardTab — already computed, no re-fetch
}
```

**Loading / error / empty state pattern** (model from DashboardTab `Empty` component, line 267–270):
```typescript
// DashboardTab Empty pattern:
function Empty({ text }: { text: string }) {
  return (
    <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">{text}</div>
  )
}
// Apply same pattern for loading and error states inside UpcomingBillsPanel
```

**Core list row pattern** (lines 141–162 — Transaksi Terakhir row — copy structure exactly per D-05):
```typescript
<ul className="divide-y">
  {recentTx.map((r) => (
    <li key={r.id} className="flex items-center gap-3 py-2.5">
      <span className={isIncome ? 'text-emerald-600' : 'text-red-500'}>
        {/* icon or dot */}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{r.category_name}</div>
        <div className="text-xs text-muted-foreground">{formatDateID(r.date)}</div>
      </div>
      <span className="text-sm font-semibold tabular-nums">{formatRupiah(r.amount)}</span>
    </li>
  ))}
</ul>
```

**Urgency dot adaptation** (replaces the icon `<span>` with a colored dot per D-03/D-05 and specifics):
```typescript
// Replace icon span with:
<span className={`h-2 w-2 shrink-0 rounded-full ${urgencyDotClass[urgency]}`} />
// urgencyDotClass map:
const urgencyDotClass = {
  overdue: 'bg-red-500',
  soon:    'bg-yellow-500',
  later:   'bg-gray-400',
} as const
// urgencyTextClass map (for sub-text):
const urgencyTextClass = {
  overdue: 'text-red-600',
  soon:    'text-yellow-600',
  later:   'text-muted-foreground',
} as const
```

**Native JS dayDiff helper** (pattern derived from `src/db/recurringTransactions.ts` lines 29–31 — local midnight construction):
```typescript
function dayDiff(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number)
  const due = new Date(y, m - 1, d)          // local midnight — avoids UTC offset bug
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  due.setHours(0, 0, 0, 0)
  return Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function getUrgency(diff: number): 'overdue' | 'soon' | 'later' {
  if (diff <= 0) return 'overdue'
  if (diff <= 7) return 'soon'
  return 'later'
}

function dueSubText(diff: number): string {
  if (diff < 0) return `terlambat ${Math.abs(diff)} hari`
  if (diff === 0) return 'jatuh tempo hari ini'
  if (diff === 1) return 'besok'
  return `${diff} hari lagi`
}
```

**Sisa Aman row pattern** (model from DashboardTab Goals Aktif bottom row, lines 181–186 — `justify-between` + `border-t` divider per specifics):
```typescript
// Divider + summary row at bottom of panel content:
<div className="border-t mt-2 pt-2 flex items-center justify-between">
  <span className="text-sm font-semibold">Sisa Aman Bulan Ini</span>
  <span className={`text-sm font-semibold tabular-nums ${sisaAman < 0 ? 'text-red-500' : ''}`}>
    {formatRupiah(sisaAman)}
  </span>
</div>
```

**useMemo pattern for derived values** (model from DashboardTab lines 46–50):
```typescript
const monthly = useMemo(() => {
  let income = 0; let expense = 0
  for (const p of periodData) { income += Number(p.income); expense += Number(p.expense) }
  return { income, expense, net: income - expense }
}, [periodData])
// Adaptation for UpcomingBillsPanel:
const totalBills = useMemo(
  () => (bills ?? []).reduce((sum, b) => sum + Number(b.amount), 0),
  [bills]
)
const sisaAman = income - expense - totalBills
```

**Max-height scroll** (Claude's discretion, resolved — apply conditionally on `<ul>`):
```typescript
const listClass = `divide-y ${(bills ?? []).length > 6 ? 'max-h-64 overflow-y-auto' : ''}`
```

---

### `src/tabs/DashboardTab.tsx` — insert Row 3

**Analog:** `src/tabs/DashboardTab.tsx` — existing panel grid insertion (lines 135–193)

**Imports to add** (model from lines 1–12):
```typescript
import UpcomingBillsPanel from '@/components/UpcomingBillsPanel'
```

**Layout insertion point** (after closing `</div>` of `grid-cols-1 md:grid-cols-2` at line 193, before closing `</div>` of `space-y-6` at line 194):
```typescript
// Existing Row 2 (lines 135–193):
<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
  <Panel title="Transaksi Terakhir">...</Panel>
  <Panel title="Goals Aktif">...</Panel>
</div>

// ADD Row 3 immediately after (same space-y-6 parent):
<Panel title="Tagihan Bulan Ini">
  <UpcomingBillsPanel income={monthly.income} expense={monthly.expense} />
</Panel>
```

**Panel wrapper pattern** (lines 258–265 — local function, NOT exported, NOT imported by UpcomingBillsPanel):
```typescript
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <h3 className="mb-4 text-sm font-semibold">{title}</h3>
      {children}
    </div>
  )
}
```

**Monthly data already available** (lines 46–50 — pass as props, no new query):
```typescript
const monthly = useMemo(() => {
  let income = 0; let expense = 0
  for (const p of periodData) { income += Number(p.income); expense += Number(p.expense) }
  return { income, expense, net: income - expense }
}, [periodData])
// monthly.income and monthly.expense passed as props to UpcomingBillsPanel
```

---

## Shared Patterns

### Admin View-As / UID Resolution
**Source:** `src/auth/useTargetUserId.ts` (lines 1–8) + `src/queries/recurringTransactions.ts` (line 17) + `src/queries/reports.ts` (line 20)
**Apply to:** `useUpcomingBills()` hook
```typescript
import { useTargetUserId } from '@/auth/useTargetUserId'

// Inside hook:
const uid = useTargetUserId()
// ... useQuery enabled: !!uid
```

### useQuery Hook Structure
**Source:** `src/queries/recurringTransactions.ts` lines 16–23 + `src/queries/reports.ts` lines 14–25
**Apply to:** `useUpcomingBills()` in `src/queries/recurringTransactions.ts`
```typescript
return useQuery({
  queryKey: ['...key...', uid /*, other params */],
  queryFn: () => dbFunction(uid /*, other params */),
  enabled: !!uid,
})
```

### Rupiah Formatting
**Source:** `src/lib/format.ts` lines 8–10
**Apply to:** `UpcomingBillsPanel.tsx` — bill amount and Sisa Aman display
```typescript
import { formatRupiah } from '@/lib/format'
// Usage: formatRupiah(bill.amount)  /  formatRupiah(sisaAman)
```

### Supabase Query + Error Throw
**Source:** `src/db/recurringTransactions.ts` lines 50–59
**Apply to:** `listUpcomingBills()` in `src/db/recurringTransactions.ts`
```typescript
const { data, error } = await query
if (error) throw error
return data as RecurringTemplate[]
```

### Native Local-Midnight Date Construction
**Source:** `src/db/recurringTransactions.ts` lines 29–31
**Apply to:** `dayDiff()` helper in `UpcomingBillsPanel.tsx` and `endOfMonth` computation in `useUpcomingBills()`
```typescript
// CORRECT — creates local midnight, avoids UTC offset bug on UTC+ timezones:
const [y, m, d] = isoString.split('-').map(Number)
const date = new Date(y, m - 1, d)
// WRONG — do not use: new Date(isoString)  (parsed as UTC midnight)
```

### Panel + Empty State Shell
**Source:** `src/tabs/DashboardTab.tsx` lines 258–270
**Apply to:** `UpcomingBillsPanel.tsx` inner states (loading, error, empty)
```typescript
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <h3 className="mb-4 text-sm font-semibold">{title}</h3>
      {children}
    </div>
  )
}
// UpcomingBillsPanel is wrapped by DashboardTab's Panel — it only renders inner content.
// Use the Empty pattern for loading/error/empty states:
<div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
  {/* "Memuat..." / "Gagal memuat tagihan." / "Tidak ada tagihan bulan ini." */}
</div>
```

---

## No Analog Found

No files in this phase are without an analog. All patterns are derived directly from existing codebase files.

---

## Anti-Pattern Warnings (from RESEARCH.md — carry forward to planner)

| Anti-Pattern | File Affected | Correct Approach |
|---|---|---|
| `import { differenceInCalendarDays } from 'date-fns'` | `UpcomingBillsPanel.tsx` | Use native `dayDiff()` helper — `date-fns` is NOT installed |
| `new Date(next_due_date)` for day diff | `UpcomingBillsPanel.tsx` | Use `new Date(y, m-1, d)` component constructor to avoid UTC midnight offset bug |
| Re-fetching `useAggregateByPeriod` inside `UpcomingBillsPanel` | `UpcomingBillsPanel.tsx` | Receive `income` and `expense` as props from DashboardTab (D-08) |
| `import { Panel } from '@/tabs/DashboardTab'` | `UpcomingBillsPanel.tsx` | `Panel` is local/non-exported — DashboardTab wraps `<UpcomingBillsPanel>` inside its own `<Panel>` |
| Rendering Sisa Aman row during `isLoading` or `isError` | `UpcomingBillsPanel.tsx` | Hide Sisa Aman row when `isLoading \|\| isError \|\| bills.length === 0` |
| `bills.sort(...)` client-side | `UpcomingBillsPanel.tsx` | DB query uses `.order('next_due_date')` — no client sort needed |

---

## Metadata

**Analog search scope:** `src/tabs/`, `src/db/`, `src/queries/`, `src/lib/`, `src/auth/`
**Files scanned:** 6 analog files fully read
**Pattern extraction date:** 2026-04-24

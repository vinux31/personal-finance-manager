# Phase 3: Bills Display - Research

**Researched:** 2026-04-24
**Domain:** React/TypeScript dashboard widget — read-only bills display with urgency color-coding and Sisa Aman projection
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Bills widget ditempatkan sebagai full-width panel (row ke-3) di bawah 2-column panel grid yang sudah ada. Tidak mengubah posisi atau keberadaan panel yang sudah ada.
- **D-02:** Dashboard layout: Row 1 (5 MetricCards) unchanged, Row 2 (2-col grid) unchanged, Row 3 (Tagihan Bulan Ini full-width).
- **D-03:** Tiap baris tagihan menampilkan: color dot urgency kiri, nama tagihan, jumlah Rupiah kanan (tabular-nums), teks kecil di bawah nama ("jatuh tempo hari ini" / "N hari lagi" / "terlambat N hari").
- **D-04:** Urgency color rules — Merah: `next_due_date <= today`; Kuning: `next_due_date <= today + 7`; Abu: `next_due_date > today + 7`.
- **D-05:** Row style mengikuti pola "Transaksi Terakhir" — `divide-y`, `flex items-center gap-3 py-2.5`, teks muted untuk sub-info.
- **D-06:** Sisa Aman sebagai summary row di bawah widget, dipisahkan divider — bukan MetricCard ke-6.
- **D-07:** Formula Phase 3: `Sisa Aman = pemasukan_aktual − pengeluaran_aktual − total_tagihan_bulan_ini`. Semua tagihan dihitung belum lunas (Phase 4 akan refine dengan bill_payments). Label: "Sisa Aman Bulan Ini".
- **D-08:** pemasukan_aktual dan pengeluaran_aktual dari `useAggregateByPeriod` yang sudah di-fetch di DashboardTab — tidak perlu query baru.
- **D-09:** Tambah `listUpcomingBills(uid, endOfMonth)` di `src/db/recurringTransactions.ts` dan `useUpcomingBills()` di `src/queries/recurringTransactions.ts`.
- **D-10:** Komponen widget: `src/components/UpcomingBillsPanel.tsx` — terpisah dari DashboardTab.
- **D-11:** `useUpcomingBills()` menggunakan `useTargetUserId()`.
- **D-12:** Empty state: tampilkan pesan sederhana di dalam panel, panel tetap muncul.
- **useProcessRecurring tidak dimodifikasi sama sekali di fase ini.**
- **Tidak ada tombol mark-as-paid — itu Phase 4.**

### Claude's Discretion

- Exact Tailwind classes untuk color dots/badges urgency
- Max height / scroll behavior jika tagihan sangat banyak
- Apakah Sisa Aman negatif ditampilkan merah (direkomendasikan: ya)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BILL-01 | User dapat melihat daftar tagihan bulan ini (dari recurring_templates, type=expense, next_due_date ≤ akhir bulan berjalan) | `listUpcomingBills()` DB function with `.eq('type','expense').eq('is_active',true).lte('next_due_date', endOfMonth)` |
| BILL-02 | Tagihan ditampilkan color-coded by urgency: merah = sudah lewat/hari ini, kuning = ≤7 hari, abu = >7 hari | Urgency classification logic using native JS date diff; Tailwind bg-red-500/bg-yellow-500/bg-gray-400 dots |
| BILL-04 | User dapat lihat "Sisa Aman Bulan Ini" = pemasukan aktual bulan ini − pengeluaran aktual bulan ini − tagihan bulan ini yang belum lunas | `useMemo` in UpcomingBillsPanel consuming existing `monthly.income`/`monthly.expense` props + `useUpcomingBills` sum |
| NAV-02 (partial — bills widget only) | Dashboard mendapat widget panel "Tagihan Bulan Ini" | UpcomingBillsPanel inserted as Row 3 in DashboardTab after the `grid-cols-1 md:grid-cols-2` closing div |
</phase_requirements>

---

## Summary

Phase 3 adds a single read-only widget to the existing Dashboard. All data patterns, layout primitives, and code conventions for this phase are already established in the codebase. The work is purely additive — two new functions appended to existing files, one new component file, and a three-line insertion into DashboardTab.

The most important technical detail to resolve correctly is the date arithmetic for urgency classification and due-date sub-text. The UI-SPEC references `date-fns` (`differenceInCalendarDays`, `parseISO`), but **`date-fns` is not installed and does not appear in `package.json` or `node_modules`**. The entire existing codebase uses native JavaScript `Date` API for all date operations. The plan must implement the `dayDiff` helper with native JS arithmetic — this avoids adding a new dependency and is consistent with the codebase's own patterns.

The Sisa Aman formula consumes `monthly.income` and `monthly.expense` which are already computed in DashboardTab from `useAggregateByPeriod`. The cleanest architecture passes these values as props to `UpcomingBillsPanel` rather than re-fetching them inside the component.

**Primary recommendation:** Three-file change set: (1) append `listUpcomingBills` to `src/db/recurringTransactions.ts`, (2) append `useUpcomingBills` to `src/queries/recurringTransactions.ts`, (3) create `src/components/UpcomingBillsPanel.tsx`, plus a minimal insertion in `src/tabs/DashboardTab.tsx`. Zero modifications to existing logic.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Fetch upcoming bills from DB | API / Supabase Client | — | RLS-guarded query to `recurring_templates` — data layer responsibility |
| Urgency classification logic | Frontend Component | — | Pure date diff, no server round-trip needed; computed from already-fetched `next_due_date` |
| Sisa Aman calculation | Frontend Component (useMemo) | — | Arithmetic over already-fetched aggregates; not a DB aggregate |
| Layout / widget rendering | Frontend Component | — | React/Tailwind, client-side only |
| Admin "view-as" scoping | Query Hook | — | `useTargetUserId()` handles uid resolution — all hooks follow this pattern |

---

## Standard Stack

### Core (all already installed)

| Library | Version in package.json | Purpose | Status |
|---------|------------------------|---------|--------|
| react | ^19.2.4 | Component rendering | Already in use |
| @tanstack/react-query | ^5.99.1 | Data fetching + cache invalidation | Already in use — `useQuery` pattern established |
| @supabase/supabase-js | ^2.103.3 | DB query (Supabase `.lte()` filter) | Already in use |
| tailwindcss | ^4.2.2 | Styling | Already in use |
| lucide-react | ^1.8.0 | Icons (not needed for this phase — dots are plain divs) | Already in use |

### NOT Needed (confirmed absent)

| Library | Status | Implication |
|---------|--------|-------------|
| date-fns | NOT installed, NOT in package.json [VERIFIED: grep node_modules] | Do NOT use `differenceInCalendarDays` — implement native JS dayDiff instead |

**Installation:** No new packages required for this phase.

---

## Architecture Patterns

### System Architecture Diagram

```
DashboardTab (mount)
  │
  ├── useAggregateByPeriod('month', monthStart, today) ──► Supabase RPC aggregate_by_period
  │     └─► monthly.income, monthly.expense (already computed in DashboardTab useMemo)
  │
  ├── useUpcomingBills() ──────────────────────────────► Supabase: recurring_templates
  │     └─► listUpcomingBills(uid, endOfMonth)             WHERE is_active=true
  │           └─► RecurringTemplate[]                       AND type='expense'
  │                                                         AND next_due_date <= endOfMonth
  │
  └── <UpcomingBillsPanel bills={bills} income={monthly.income} expense={monthly.expense} />
        │
        ├── useMemo: sisaAman = income - expense - totalBills
        ├── useMemo: sorted bills (ascending next_due_date)
        │
        └── Render:
              ├── isLoading  → Loading placeholder
              ├── isError    → Error placeholder
              ├── bills = [] → <Empty text="Tidak ada tagihan bulan ini." />
              └── bills > 0  → <ul divide-y>
                                  {bills.map → BillRow (dot + name + subtext + amount)}
                                  <SisaAmanRow />
```

### Recommended Project Structure (new files only)

```
src/
├── components/
│   └── UpcomingBillsPanel.tsx   ← NEW: standalone widget component
├── db/
│   └── recurringTransactions.ts ← APPEND: listUpcomingBills()
├── queries/
│   └── recurringTransactions.ts ← APPEND: useUpcomingBills()
└── tabs/
    └── DashboardTab.tsx          ← MODIFY: import + insert Row 3
```

### Pattern 1: DB Function — listUpcomingBills

**What:** Append a new exported function to the existing `src/db/recurringTransactions.ts`. Does not modify any existing function.

**When to use:** Any time the upcoming-bills widget needs to (re)fetch.

```typescript
// Source: mirrors listRecurringTemplates() pattern [VERIFIED: src/db/recurringTransactions.ts]
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

**Key notes:**
- Uses `.order('next_due_date')` ascending — most urgent first, sorted DB-side (no client sort needed).
- Uses existing `RecurringTemplate` type — no new type required.
- `uid` guard mirrors `listRecurringTemplates` pattern exactly.

### Pattern 2: Query Hook — useUpcomingBills

**What:** Append new hook to `src/queries/recurringTransactions.ts`. Does not modify any existing hook.

```typescript
// Source: mirrors useRecurringTemplates() pattern [VERIFIED: src/queries/recurringTransactions.ts]
export function useUpcomingBills() {
  const uid = useTargetUserId()
  const endOfMonth = useMemo(() => {
    const d = new Date()
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    const y = lastDay.getFullYear()
    const m = String(lastDay.getMonth() + 1).padStart(2, '0')
    const day = String(lastDay.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }, [])
  return useQuery({
    queryKey: ['upcoming-bills', uid, endOfMonth],
    queryFn: () => listUpcomingBills(uid, endOfMonth),
    enabled: !!uid,
  })
}
```

**Key notes:**
- `endOfMonth` computed with `new Date(year, month+1, 0)` — native JS, no date-fns needed [VERIFIED: CONTEXT.md `<specifics>` pattern].
- `useMemo` with `[]` dependency — endOfMonth is constant for the lifetime of a page load.
- Query key includes `endOfMonth` — cache correctly scoped per month.

### Pattern 3: Urgency Classification — Native JS dayDiff

**What:** Compute integer day difference between `next_due_date` (ISO string) and today, using only native JS. This replaces the `differenceInCalendarDays(parseISO(...), new Date())` pattern mentioned in UI-SPEC.

```typescript
// Source: native JS — consistent with existing codebase date arithmetic [VERIFIED: src/db/recurringTransactions.ts, src/lib/format.ts]
function dayDiff(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number)
  const due = new Date(y, m - 1, d)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  due.setHours(0, 0, 0, 0)
  return Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}
```

**Urgency classification:**
```typescript
function getUrgency(diff: number): 'overdue' | 'soon' | 'later' {
  if (diff <= 0) return 'overdue'
  if (diff <= 7) return 'soon'
  return 'later'
}
```

**Sub-text copy:**
```typescript
function dueSubText(diff: number): string {
  if (diff < 0) return `terlambat ${Math.abs(diff)} hari`
  if (diff === 0) return 'jatuh tempo hari ini'
  if (diff === 1) return 'besok'
  return `${diff} hari lagi`
}
```

### Pattern 4: UpcomingBillsPanel Props Interface

**What:** Component receives income/expense as props from DashboardTab (already computed there), plus its own bills query.

```typescript
// [ASSUMED] — interface design, consistent with D-08 (use existing fetch, no new query)
interface UpcomingBillsPanelProps {
  income: number   // monthly.income from DashboardTab
  expense: number  // monthly.expense from DashboardTab
}
```

**Alternative:** The component could call `useAggregateByPeriod` itself. D-08 explicitly says "tidak perlu query baru" — props is the right pattern.

### Pattern 5: Tailwind urgency dot classes

Per UI-SPEC [VERIFIED: 03-UI-SPEC.md]:
```
overdue → bg-red-500 dot; text-red-600 sub-text
soon    → bg-yellow-500 dot; text-yellow-600 sub-text
later   → bg-gray-400 dot; text-muted-foreground sub-text
```

Map in code:
```typescript
const urgencyDotClass = { overdue: 'bg-red-500', soon: 'bg-yellow-500', later: 'bg-gray-400' }
const urgencyTextClass = { overdue: 'text-red-600', soon: 'text-yellow-600', later: 'text-muted-foreground' }
```

### Pattern 6: Max-height scroll (Claude's discretion — resolved)

Per UI-SPEC [VERIFIED: 03-UI-SPEC.md]: When bills > 6, cap with `max-h-64 overflow-y-auto`. Apply this class conditionally on the `<ul>` element.

```typescript
const listClass = `divide-y ${bills.length > 6 ? 'max-h-64 overflow-y-auto' : ''}`
```

### Anti-Patterns to Avoid

- **Importing date-fns:** Library is not installed. Importing it causes a build error. Use the `dayDiff()` native helper instead.
- **Re-fetching income/expense inside UpcomingBillsPanel:** D-08 explicitly says to use the already-fetched data from DashboardTab. Pass as props.
- **Modifying useProcessRecurring or any existing query hook:** Phase 3 is append-only. Any modification to existing hooks is out of scope.
- **Sorting client-side when DB sort is available:** The `.order('next_due_date')` in the Supabase query handles sort — no need for `bills.sort()` in the component.
- **Adding mark-as-paid UI or interaction:** Phase 4 only.
- **Hiding the panel when bills = 0:** D-12 says panel must always render; use `<Empty>` component inside it.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rupiah formatting | Custom number formatter | `formatRupiah()` from `src/lib/format.ts` | Already handles IDR locale, edge cases |
| Rupiah short format | Custom abbreviator | `shortRupiah()` from `src/lib/format.ts` | Established pattern (jt, rb, M) |
| Today ISO string | Custom date serializer | `todayISO()` from `src/lib/format.ts` | Consistent with codebase |
| Query caching/invalidation | Manual fetch + state | `useQuery` from `@tanstack/react-query` | Already the project standard |
| Panel wrapper | Custom div | `Panel` local function in DashboardTab | Same shell used by all existing panels |
| Empty state | Custom empty div | `Empty` local function in DashboardTab | Same pattern used throughout Dashboard |
| Admin scoping | Custom uid logic | `useTargetUserId()` from `@/auth/useTargetUserId` | Required for admin view-as — D-11 |

---

## Common Pitfalls

### Pitfall 1: date-fns not available

**What goes wrong:** Developer follows UI-SPEC literally and writes `import { differenceInCalendarDays, parseISO } from 'date-fns'` — build fails with module not found.

**Why it happens:** UI-SPEC was written with date-fns as a suggestion, but the library was never added to the project.

**How to avoid:** Use the `dayDiff(isoDate: string): number` native helper (see Pattern 3 above). The computation is 5 lines of vanilla JS.

**Warning signs:** Any import from `'date-fns'` in the new files.

### Pitfall 2: Midnight timezone boundary in dayDiff

**What goes wrong:** Day diff is off by 1 for users in UTC+ timezones if you use `new Date(isoDate)` directly (ISO string parsed as UTC midnight vs local midnight).

**Why it happens:** `new Date('2026-04-24')` is parsed as UTC midnight, but `new Date()` is local time. On UTC+7, "today" at 1 AM local is still "yesterday" in UTC, so diff = +1 instead of 0.

**How to avoid:** Use `new Date(y, m-1, d)` constructor (month/day components) — this creates a local midnight date. Then zero out hours on both sides with `setHours(0,0,0,0)`. Pattern 3 above does this correctly [VERIFIED: matches existing codebase pattern in `src/db/recurringTransactions.ts`].

**Warning signs:** `new Date(next_due_date)` — string constructor without parsing components.

### Pitfall 3: Sisa Aman formula applied before data loads

**What goes wrong:** `sisaAman` flickers to a large negative number on first render because one or both of `income`/`expense`/`bills` is 0 before queries resolve.

**Why it happens:** Props arrive from DashboardTab which also has loading states; bills query has its own loading state.

**How to avoid:** Guard the Sisa Aman row — only render it when both `!isLoading` (for bills) AND `bills.length > 0` (or always show with 0). DashboardTab already defaults `periodData = []` so monthly.income/expense default to 0. This is acceptable for Phase 3 because: (a) the loading state hides the entire bill list, and (b) when bills are loading, the panel shows the "Memuat..." placeholder — the Sisa Aman row is not rendered in loading/error/empty states.

**Warning signs:** Rendering the Sisa Aman row inside the loading placeholder branch.

### Pitfall 4: endOfMonth computed without useMemo causes infinite re-render

**What goes wrong:** `useUpcomingBills()` hook recomputes `endOfMonth` on every render, creating a new string every time, causing the `useQuery` key to change and triggering a re-fetch loop.

**Why it happens:** String `new Date(...).toString()` returns a new reference each call, but YYYY-MM-DD strings from `padStart` are compared by value — actually fine. However, `useMemo` is still good practice.

**How to avoid:** `useMemo` with `[]` dependency in the hook (Pattern 2 above). Since endOfMonth only changes at month rollover and the page will be refreshed, `[]` is correct.

### Pitfall 5: Panel local component not exported from DashboardTab

**What goes wrong:** `UpcomingBillsPanel.tsx` tries to import `Panel` from DashboardTab and gets a module error because `Panel` is a local function (not exported).

**Why it happens:** D-10 says UpcomingBillsPanel is a separate file. The `Panel` wrapper in DashboardTab is local.

**How to avoid:** `UpcomingBillsPanel.tsx` must replicate the Panel shell inline, OR DashboardTab wraps `<UpcomingBillsPanel>` inside its own `<Panel title="Tagihan Bulan Ini">`. The cleanest approach: DashboardTab wraps the new component inside `<Panel>`, so UpcomingBillsPanel only renders the inner content (bill list + Sisa Aman row), not the outer panel shell. This matches how DashboardTab already wraps inner content for existing panels.

**Warning signs:** `export function Panel` in DashboardTab or `import { Panel } from '@/tabs/DashboardTab'`.

---

## Code Examples

### endOfMonth helper (standalone, inline in hook)

```typescript
// Source: CONTEXT.md <specifics> — native JS [VERIFIED]
const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0)
// new Date(year, month+1, 0) → day 0 of next month = last day of current month
```

### DashboardTab insertion point

```typescript
// Source: src/tabs/DashboardTab.tsx lines 135–193 [VERIFIED]
// After the closing </div> of the md:grid-cols-2 grid, before the closing </div> of space-y-6:

<Panel title="Tagihan Bulan Ini">
  <UpcomingBillsPanel income={monthly.income} expense={monthly.expense} />
</Panel>
```

### UpcomingBillsPanel inner content pattern

```typescript
// Source: mirrors Transaksi Terakhir pattern, DashboardTab lines 141–162 [VERIFIED]
<ul className={`divide-y ${bills.length > 6 ? 'max-h-64 overflow-y-auto' : ''}`}>
  {sortedBills.map((bill) => {
    const diff = dayDiff(bill.next_due_date)
    const urgency = getUrgency(diff)
    return (
      <li key={bill.id} className="flex items-center gap-3 py-2.5">
        <span className={`h-2 w-2 shrink-0 rounded-full ${urgencyDotClass[urgency]}`} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{bill.name}</div>
          <div className={`text-xs ${urgencyTextClass[urgency]}`}>{dueSubText(diff)}</div>
        </div>
        <span className="text-sm font-semibold tabular-nums">{formatRupiah(bill.amount)}</span>
      </li>
    )
  })}
</ul>
<div className="border-t mt-2 pt-2 flex items-center justify-between">
  <span className="text-sm font-semibold">Sisa Aman Bulan Ini</span>
  <span className={`text-sm font-semibold tabular-nums ${sisaAman < 0 ? 'text-red-500' : ''}`}>
    {formatRupiah(sisaAman)}
  </span>
</div>
```

---

## Runtime State Inventory

> Phase 3 is a greenfield UI addition (read-only) — no rename or migration involved.

Step 2.5: SKIPPED — this is not a rename/refactor/migration phase.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build tooling | ✓ | (project running) | — |
| Vite | Dev server / build | ✓ | ^8.0.4 (package.json) | — |
| @tanstack/react-query | `useUpcomingBills` hook | ✓ | ^5.99.1 | — |
| @supabase/supabase-js | `listUpcomingBills` query | ✓ | ^2.103.3 | — |
| tailwindcss | Urgency dot classes | ✓ | ^4.2.2 | — |
| date-fns | UI-SPEC suggested for dayDiff | ✗ NOT INSTALLED | — | Native JS Date API (Pattern 3) |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:**
- `date-fns` — referenced by UI-SPEC but not installed. Use native `dayDiff()` helper instead (see Pattern 3). Zero added dependencies.

---

## Validation Architecture

> `workflow.nyquist_validation` not set in `.planning/config.json` — treated as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected — no test config files, no `src/**/*.test.*` files [VERIFIED: glob scan] |
| Config file | None — Wave 0 must create if tests are added |
| Quick run command | N/A |
| Full suite command | N/A |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BILL-01 | listUpcomingBills filters correctly (is_active, type=expense, lte endOfMonth) | unit (pure function logic) | manual-only — no test runner configured | ❌ Wave 0 (if tests are set up) |
| BILL-02 | dayDiff + getUrgency + dueSubText returns correct values for overdue/today/soon/later | unit (pure functions) | manual-only | ❌ Wave 0 |
| BILL-04 | Sisa Aman = income - expense - totalBills computed correctly | unit (pure arithmetic) | manual-only | ❌ Wave 0 |
| NAV-02 | UpcomingBillsPanel renders as Row 3, does not break Row 1/2 | smoke (visual/manual) | manual-only | ❌ |

### Sampling Rate

No automated test runner is configured for this project. Validation is manual:
- **Per task commit:** Manual browser check of Dashboard renders without errors.
- **Per wave merge:** Full Dashboard tab smoke-test (all 5 MetricCards visible, Row 2 intact, Row 3 shows bills/empty state).
- **Phase gate:** Manual verification of all 4 success criteria before marking phase complete.

### Wave 0 Gaps

No test framework is installed. Since the project has zero test files and no test configuration, the planner may choose to:
1. Skip formal test setup (pragmatic for this phase given it's pure display logic), OR
2. Add a minimal Vitest setup for the pure utility functions (`dayDiff`, `getUrgency`, `dueSubText`, `sisaAman` arithmetic).

If tests are desired: `npm install -D vitest @testing-library/react @testing-library/jest-dom`

For Phase 3 specifically, the three pure utility functions (`dayDiff`, `getUrgency`, `dueSubText`) are ideal unit test candidates — they have no dependencies on React or Supabase.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No bills widget | UpcomingBillsPanel as Row 3 | Phase 3 | Dashboard now shows upcoming bills |
| Sisa Aman not tracked | Computed from existing data | Phase 3 | User sees safe spending estimate |

**Deprecated/outdated approaches for this phase:**
- `date-fns` for day diff: Not applicable — codebase never used it. Native JS is the established pattern.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `UpcomingBillsPanel` receives `income` and `expense` as props from DashboardTab (not re-fetching via its own `useAggregateByPeriod` call) | Architecture Patterns, Pattern 4 | Low — D-08 explicitly says no new query; either approach works but props is cleaner |
| A2 | DashboardTab wraps `<UpcomingBillsPanel>` inside its own local `<Panel>` component, so UpcomingBillsPanel only renders inner content | Common Pitfalls, Pitfall 5 | Low — alternative is to duplicate Panel shell inside UpcomingBillsPanel. Either works; wrapping is simpler. |
| A3 | `endOfMonth` `useMemo` with `[]` dependency is correct (page won't be open across midnight of month-end) | Pattern 2 | Very low — PFM users don't keep tabs open for 30 days |

---

## Open Questions

1. **Panel wrapper strategy for UpcomingBillsPanel**
   - What we know: `Panel` is a local (non-exported) function in DashboardTab
   - What's unclear: Should UpcomingBillsPanel include its own panel shell, or should DashboardTab wrap it in `<Panel>`?
   - Recommendation: DashboardTab wraps with `<Panel title="Tagihan Bulan Ini"><UpcomingBillsPanel .../></Panel>` — keeps UpcomingBillsPanel as a pure content component reusable in Phase 4 (mark-as-paid will also live in a panel).

2. **Sisa Aman when bills query is loading**
   - What we know: During `isLoading`, the bill list shows "Memuat...". Sisa Aman can't be computed yet.
   - What's unclear: Should the Sisa Aman row show a dash/placeholder, or be entirely hidden during load?
   - Recommendation: Hide the entire Sisa Aman row (and the divider) when `isLoading || isError || bills.length === 0`. The loading placeholder div replaces the full panel content. This avoids a misleading Rp 0 display.

---

## Sources

### Primary (HIGH confidence)
- `src/tabs/DashboardTab.tsx` [VERIFIED] — Panel pattern, MetricCard pattern, Transaksi Terakhir row pattern (lines 141–162, 258–265), layout structure
- `src/db/recurringTransactions.ts` [VERIFIED] — `RecurringTemplate` type, `listRecurringTemplates()` pattern, native date arithmetic style
- `src/queries/recurringTransactions.ts` [VERIFIED] — `useRecurringTemplates()` hook pattern, `useTargetUserId()` usage, `useQuery` structure
- `src/lib/format.ts` [VERIFIED] — `formatRupiah`, `todayISO`, `shortRupiah` availability
- `package.json` [VERIFIED] — confirmed date-fns NOT in dependencies; all other required libraries present
- `node_modules` scan [VERIFIED] — confirmed date-fns NOT installed
- `.planning/phases/03-bills-display/03-UI-SPEC.md` [VERIFIED] — approved visual/interaction contract; urgency colors, typography, spacing, state contracts, copywriting
- `.planning/phases/03-bills-display/03-CONTEXT.md` [VERIFIED] — all locked decisions D-01 through D-12
- `supabase/migrations/0010_recurring_transactions.sql` [VERIFIED] — RLS policy, table schema, field types

### Secondary (MEDIUM confidence)
- `src/queries/reports.ts` [VERIFIED] — `useAggregateByPeriod` shape confirms `monthly.income`/`monthly.expense` are computed numbers accessible to DashboardTab

### Tertiary (LOW confidence — none)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified in package.json and node_modules
- Architecture: HIGH — patterns verified from existing codebase files
- Pitfalls: HIGH — date-fns absence verified by grep; other pitfalls derived from codebase analysis
- date-fns absence: HIGH — confirmed absent in both package.json and node_modules

**Research date:** 2026-04-24
**Valid until:** 2026-05-24 (stable codebase — no external dependencies change in this phase)

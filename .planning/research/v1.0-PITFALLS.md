# Domain Pitfalls: Net Worth Tracker + Upcoming Bills Calendar

**Domain:** Adding financial snapshot and bill-tracking features to existing brownfield PFM app
**App:** Kantong Pintar — React 19 + Supabase + RLS + admin view-as mode
**Researched:** 2026-04-23

---

## Critical Pitfalls

Mistakes that cause data corruption, security holes, or user-visible breakage requiring rewrites.

---

### Pitfall 1: "Mark as Paid" Collides with Auto-Process in `useProcessRecurring`

**What goes wrong:** The existing `useProcessRecurring` hook in `TransactionsTab.tsx` auto-creates transactions for any `recurring_templates` where `next_due_date <= today`. If "mark as paid" in the Upcoming Bills UI also creates a transaction AND advances `next_due_date`, and the user visits TransactionsTab afterward, the hook will not re-fire (it only runs on mount via `useEffect`). But if they reload or the component remounts, there is a timing window where `next_due_date` may not yet have been advanced, causing the hook to create a second transaction for the same bill period.

**Why it happens:** The hook has no deduplication guard. It checks `next_due_date <= today` and fires without knowing whether the user already manually paid that cycle from the Upcoming Bills UI.

**Consequences:** Duplicate expense transactions. Net Worth and monthly summaries become wrong. User does not notice until they manually audit.

**Prevention:**
- "Mark as paid" must atomically: (1) create the transaction and (2) advance `next_due_date` to the next cycle in a single Supabase call sequence — not two separate awaits.
- Consider adding a `source` column to transactions (e.g., `'manual' | 'recurring_auto' | 'bill_paid'`) to make duplicates detectable in the future.
- Alternatively, make `useProcessRecurring` idempotent by querying for existing transactions on `date = due_date AND note LIKE templateName` before inserting. This is the safer long-term fix but adds query cost.
- Document clearly that `next_due_date` is the single source of truth for "has this cycle been paid."

**Detection warning signs:** User reports double expenses in their monthly summary right after using the new "Bayar" button.

**Phase to address:** Phase 1 (Upcoming Bills) — must be designed correctly before first release.

---

### Pitfall 2: RLS Policy Missing `user_id` Filter on New Tables

**What goes wrong:** New tables (`net_worth_accounts`, `net_worth_snapshots`, `net_worth_liabilities`) get created with RLS enabled but the policy is written incorrectly — e.g., `USING (true)` instead of `USING (auth.uid() = user_id)`. All users can read each other's balance data.

**Why it happens:** Supabase enables RLS per-table but default policy is deny-all; incorrect policies are easy to write when copy-pasting. The app uses `uid` parameters in queries for admin view-as mode, meaning the app-level query filter is present but the database-level guard is not.

**Consequences:** Privacy breach. User A can query User B's bank balances and debts if they know the API shape.

**Prevention:**
- Standard policy template for every new table:
  ```sql
  CREATE POLICY "owner only"
  ON net_worth_accounts
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
  ```
- Test RLS by logging in as User B and attempting to select User A's rows directly via Supabase client — expect 0 rows.
- Never use service-role key from the frontend. The app already uses anon key correctly; keep this pattern.

**Detection warning signs:** `listNetWorthAccounts()` called without a `uid` filter returns rows from other users in Supabase Table Editor.

**Phase to address:** Phase 1 and Phase 2 — every migration file must be reviewed before applying.

---

### Pitfall 3: Net Worth Snapshot Timing Causes Incorrect Monthly Trend

**What goes wrong:** The monthly snapshot is taken when a user first visits the feature in a given month. If they visit on the 3rd of March, the March snapshot captures balances that are not yet representative of end-of-February or end-of-March. Two users visiting on different days get incomparable trend points.

**Why it happens:** "When to take the snapshot" is ambiguous. Snapshots taken on arbitrary visit days produce jagged trend charts that confuse users.

**Consequences:** The trend chart shows noise instead of meaningful month-over-month change. Users lose trust in the numbers.

**Prevention:**
- Lock snapshots to the first day of each month (or last day of previous month). The `firstDayOfMonth()` pattern already exists in `DashboardTab.tsx`.
- Store snapshot with `snapshot_month` as `YYYY-MM` (not a full timestamp) so there is exactly one row per user per month. Use an upsert with `ON CONFLICT (user_id, snapshot_month) DO UPDATE` to allow re-snapshot within the same month if the user updates balances.
- Never derive the snapshot month from wall-clock time in the browser — derive it on the DB side or use a deterministic ISO date string (`YYYY-MM-01`).
- Do NOT auto-snapshot on every page visit. Trigger it explicitly: when the user saves a balance change, upsert the current month's snapshot.

**Detection warning signs:** Trend chart shows the same net worth jumping +Rp 50 jt and back in consecutive months because visits happened mid-month.

**Phase to address:** Phase 2 (Net Worth Trend Chart) — snapshot schema must be defined upfront.

---

### Pitfall 4: Investment Double-Counting in Net Worth

**What goes wrong:** The Investasi tab already tracks portfolio value. If the new Net Worth Tracker includes an "Investasi" account type where users also enter their portfolio value manually, the Net Worth total counts investments twice — once from the manual entry and once if it's also pulled from the investments table.

**Why it happens:** The user thinks "I should list all my assets" and enters a manual line for "Saham BRI: Rp 20 jt" not realizing the app already tracks this.

**Consequences:** Net Worth is inflated. The user makes financial decisions based on wrong data.

**Prevention:**
- Auto-include investment portfolio value from the existing `investments` table in the Net Worth calculation (read-only, not user-editable in Net Worth UI).
- In the account input form, show a warning if the user tries to create an account with `asset_type = 'investasi'`: "Nilai investasi sudah dihitung otomatis dari tab Investasi."
- In the Net Worth summary breakdown, show the investment line as "Portofolio Investasi (otomatis)" clearly separated from manually entered assets.
- Document this decision in PROJECT.md Key Decisions.

**Detection warning signs:** Net Worth total is suspiciously high; user has both "Saham" in Investasi tab and a manual line in Net Worth accounts.

**Phase to address:** Phase 2 (Net Worth) — architecture decision before schema design.

---

## Moderate Pitfalls

Mistakes that cause UX problems, stale data, or extra complexity that accumulates as tech debt.

---

### Pitfall 5: `todayISO()` Uses Browser Local Time — Timezone Drift for Due Dates

**What goes wrong:** `todayISO()` in `format.ts` uses `new Date()` without timezone specification. Same for `nextDueDate()` in `recurringTransactions.ts` which uses `new Date(y, m-1, d)` (local time). For a user in WIB (UTC+7), on 2026-05-01 at 00:30 local time, the server (UTC) is still 2026-04-30. Any server-side logic that recalculates due dates will produce a different date than client-side logic.

**Why it happens:** All date logic runs client-side today and is self-consistent. The problem emerges when the Upcoming Bills calendar shows dates from a server-side query that uses `now()` (PostgreSQL UTC) compared to client-calculated `todayISO()`.

**Consequences:** A bill due "today" (WIB) shows as "tomorrow" in the upcoming bills list if the query filters server-side by `next_due_date <= now()::date`. Bills appear to be one day late.

**Prevention:**
- Keep all due-date comparisons client-side: fetch all active templates and filter in JavaScript using `next_due_date <= todayISO()`. The existing `useProcessRecurring` already does this correctly.
- Upcoming Bills query: use `next_due_date <= <client_today + 14 days>` as string comparison (ISO date strings sort lexicographically correctly). Do NOT use `now()` in Supabase RPC.
- For net worth snapshots, derive the month key client-side: `new Date().toISOString().slice(0, 7)` is acceptable because month boundaries are forgiving (off by an hour does not change the month in practice for WIB users).
- Document: "All date calculations are client-side ISO strings. No server-side `now()` comparisons."

**Detection warning signs:** Upcoming Bills list on the Transactions tab processes a template that the bills calendar showed as "not yet due."

**Phase to address:** Phase 1 — date filter logic in the upcoming bills query.

---

### Pitfall 6: Editing a Recurring Template Invalidates the Bills Calendar Silently

**What goes wrong:** A user sees "Listrik PLN — due in 3 days" in the Upcoming Bills. They go to the recurring templates editor (already exists in `RecurringListDialog`) and change the amount from Rp 500k to Rp 800k. The calendar does not re-fetch automatically because the `recurring-templates` query cache is not invalidated from the bills component — only from `RecurringListDialog`'s own mutations.

**Why it happens:** React Query cache keys for recurring templates may not be shared between the bills component and the existing dialogs if query keys are defined differently.

**Consequences:** User sees stale bill amount until page refresh. Could cause confusion about "safe remaining budget" calculation if it's based on cached template amounts.

**Prevention:**
- Use a single canonical query key: `['recurring-templates', uid]` everywhere. Check that the upcoming bills query uses the same key as `RecurringListDialog`.
- When `RecurringDialog` or `RecurringListDialog` mutates, it already calls `qc.invalidateQueries({ queryKey: ['recurring-templates'] })` — the bills component just needs to use the same key to benefit from this.
- Do not derive a separate "upcoming bills" data structure with a different key that caches independently.

**Detection warning signs:** Bill amount shown in the upcoming bills panel differs from the amount shown in the recurring templates list.

**Phase to address:** Phase 1 — when defining the upcoming bills query hook.

---

### Pitfall 7: Dashboard Performance Degradation from Too Many New Queries

**What goes wrong:** The Dashboard currently runs 4 queries on mount (aggregate by period ×2, investments, goals, recent transactions). Adding Upcoming Bills adds 1 more query. Adding a Net Worth card adds 1-2 more queries (current accounts total, latest snapshot). That is 7-8 parallel queries on every dashboard load.

**Why it happens:** Each feature gets its own query hook. Nobody audits total query count at dashboard level.

**Consequences:** Dashboard feels slower on mobile (common usage). Supabase connection pool pressure on shared plan.

**Prevention:**
- Net Worth on the Dashboard should be a single aggregation query: `SELECT SUM(balance) FROM net_worth_accounts WHERE user_id = $1` — not a full list + client-side sum.
- Upcoming Bills on the Dashboard should reuse the already-fetched `recurring-templates` query, not issue a separate query. Filter client-side to `next_due_date <= today+14`.
- Set `staleTime` on dashboard queries to 5 minutes (they currently use default 0). Users do not need real-time balance updates.
- Benchmark: open DevTools Network tab, measure dashboard load time before and after adding new queries.

**Phase to address:** Phase 1 and Phase 2 — design queries for reuse; add `staleTime` in both phases.

---

### Pitfall 8: Admin "View-As" Mode Not Threaded Through New Query Hooks

**What goes wrong:** New `useNetWorthAccounts()` or `useUpcomingBills()` hooks forget to call `useTargetUserId()` and instead use `useAuthContext().user.id` directly. When the admin switches to view-as mode, the new components show the admin's own data instead of the target user's data.

**Why it happens:** The view-as pattern requires every data hook to use `useTargetUserId()` — it is easy to miss in new code. The existing pattern is established (all existing queries use it), but a developer writing new hooks might use the more obvious `useAuthContext` import.

**Consequences:** Admin sees their own (possibly empty) net worth when trying to help a user. Feature appears broken from admin perspective.

**Prevention:**
- Every new query hook must start with: `const uid = useTargetUserId()` and pass `uid` to the db function as the second argument.
- Follow the exact pattern in `useInvestments`, `useTransactions`, etc. — `queryKey: ['key', uid, ...]`, `enabled: !!uid`, `queryFn: () => dbFn(params, uid)`.
- Code review checklist item: "Does this hook use `useTargetUserId()`, not `useAuthContext().user?.id`?"

**Detection warning signs:** Admin navigates to a user's net worth and sees Rp 0 or their own balance instead of the target user's data.

**Phase to address:** Phase 1 and Phase 2 — at time of writing each new hook.

---

### Pitfall 9: "Sisa Aman Bulan Ini" Projected Cashflow Overcomplicated by Edge Cases

**What goes wrong:** The projected cashflow formula (`income_this_month − unpaid_bills_this_month`) becomes a rabbit hole when developers try to handle: bills that span across months, bills already processed by `useProcessRecurring` (so they appear as real transactions, not upcoming templates), bills where `next_due_date` is next month but the amount should be "reserved now," and income templates (the `recurring_templates` table has `type: 'income'`).

**Why it happens:** The "safe remaining" calculation sounds simple but has degenerate cases that lead to rounding, double-counting, or negative projections.

**Consequences:** The projection shows confusing or negative numbers. Users stop trusting it.

**Prevention:**
- Define the formula explicitly and stick to it: `sisa_aman = income_bulan_ini (real transactions) − pengeluaran_sudah_bayar (real transactions) − tagihan_belum_bayar (active templates with next_due_date in current month, not yet processed)`.
- Only look at bills where `next_due_date` is within the current calendar month AND `next_due_date > today` (future bills). Already-processed bills already exist as real transactions — do not double-count them.
- Exclude income templates from the bills sum. Filter to `type = 'expense'` only.
- Display the formula breakdown to the user (e.g., "Pemasukan Rp X − Pengeluaran Rp Y − Tagihan Terjadwal Rp Z = Sisa Aman Rp N") so they can verify the logic.
- Do NOT attempt to project multi-month cashflows in MVP. One current month only.

**Detection warning signs:** "Sisa aman" shows a negative number when the user clearly has more income than expenses this month.

**Phase to address:** Phase 1 — define formula in spec before implementation.

---

## Minor Pitfalls

Annoyances that reduce UX quality but do not cause data errors.

---

### Pitfall 10: Manual Balance Staleness — No Last-Updated Indicator

**What goes wrong:** User enters their BCA savings balance as Rp 15 jt. Three months later they have Rp 22 jt in BCA. They forgot to update the app. The Net Worth trend shows stale data but looks accurate to a new viewer.

**Why it happens:** Manual data entry requires user discipline. Without a "last updated" timestamp visible to the user, there is no reminder to update.

**Consequences:** Net Worth numbers drift from reality. User loses confidence in the app.

**Prevention:**
- Store `updated_at` on each account balance row (Supabase sets this automatically with `DEFAULT now()` and an update trigger).
- Show "Terakhir diperbarui: 23 Apr 2026" next to each account balance.
- If any account has not been updated in 30+ days, show a subtle warning badge: "Saldo mungkin perlu diperbarui."
- This is a UX reminder, not enforcement. Keep it non-intrusive.

**Phase to address:** Phase 2 — when building the account balance input form.

---

### Pitfall 11: Mobile Calendar UI Becomes Unusable for Date-Heavy Display

**What goes wrong:** Upcoming bills shown as a full calendar grid (month view with day cells) does not work on a 375px screen. Each day cell becomes too small to tap. 30 days × 7 columns = cells of ~50px each with bill names truncated to 3 characters.

**Why it happens:** "Calendar" implies a grid calendar. Developers implement a grid calendar. It looks fine on desktop, broken on mobile.

**Consequences:** Core feature is unusable for the primary access device (mobile).

**Prevention:**
- Do NOT implement a grid calendar for the MVP. Use a chronological list view grouped by date: "3 hari lagi — Listrik PLN — Rp 800k" with a "Bayar" button.
- A mini date-range header ("14 hari ke depan") is sufficient to frame the view.
- Reserve calendar grid view for a later milestone if explicitly requested.
- The app already uses card-stack pattern for mobile (referenced in PROJECT.md constraints) — apply the same pattern here.

**Phase to address:** Phase 1 — UX decision before building the UI component.

---

### Pitfall 12: `nextDueDate()` Bug on Month-End Dates

**What goes wrong:** The existing `nextDueDate()` function uses `date.setMonth(date.getMonth() + 1)` for monthly frequency. For a bill due on January 31, `setMonth(1)` (February) with day 31 causes JavaScript to overflow into March 2 or 3 (depending on leap year). The bill's next due date silently shifts forward.

**Why it happens:** This is a known JavaScript `Date` behavior. The existing code in `recurringTransactions.ts` line 34 has this bug but it hasn't caused user-visible issues yet because `useProcessRecurring` auto-processes and the date drift is small.

**Consequences:** A monthly bill set to the 31st slowly drifts to the 1st-3rd of the following month over several cycles. Users notice their bill calendar is consistently "off by a few days."

**Prevention:**
- Fix `nextDueDate()` to clamp to the last valid day of the target month:
  ```typescript
  case 'monthly': {
    const originalDay = date.getDate()
    date.setDate(1) // prevent overflow
    date.setMonth(date.getMonth() + 1)
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
    date.setDate(Math.min(originalDay, lastDay))
    break
  }
  ```
- This fix applies to the existing `useProcessRecurring` as well — fix it in the same PR as the Upcoming Bills feature.
- Write a unit test for the 31st-of-month case before fixing.

**Detection warning signs:** Template created with `next_due_date = 2026-01-31` has `next_due_date = 2026-03-03` after one monthly cycle.

**Phase to address:** Phase 1 — fix during Upcoming Bills implementation since the same function is used.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|----------------|------------|
| Upcoming Bills — "Bayar" button | Duplicate transaction with auto-process hook | Advance `next_due_date` atomically with transaction creation |
| Upcoming Bills — query hook | view-as mode not working | Use `useTargetUserId()`, not `useAuthContext()` |
| Upcoming Bills — due date filter | Timezone drift off-by-one | Client-side ISO string comparison only |
| Upcoming Bills — cashflow formula | Overcomplicated with edge cases | One-month window, real transactions only, define formula first |
| Upcoming Bills — mobile UI | Calendar grid unusable | Use chronological list, not grid |
| Net Worth — schema | RLS policy wrong or missing | Policy: `USING (auth.uid() = user_id)`, test with second user |
| Net Worth — investment line | Double-counting from Investasi tab | Auto-pull from `investments` table, block manual "investasi" account type |
| Net Worth — snapshot timing | Jagged trend chart from visit-day snapshots | Upsert monthly snapshot keyed to `YYYY-MM`, trigger on balance save |
| Net Worth — view-as mode | Admin sees own data | `useTargetUserId()` in every new hook |
| Dashboard — query count | 7-8 parallel queries slow mobile | Reuse recurring-templates cache; `staleTime: 5min`; aggregate queries |
| Both features — `nextDueDate()` | Month-end date overflow | Fix clamping logic, add unit test |

---

## Sources

- Codebase analysis: `src/hooks/useProcessRecurring.ts`, `src/db/recurringTransactions.ts`, `src/tabs/DashboardTab.tsx`, `src/auth/useTargetUserId.ts`, `src/auth/ViewAsContext.tsx`
- JavaScript `Date.setMonth()` overflow: known language behavior, documented at MDN
- Supabase RLS policy patterns: Supabase official docs (auth.uid() policy pattern)
- All findings: HIGH confidence — based on direct code inspection of the production codebase

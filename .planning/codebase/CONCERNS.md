# Codebase Concerns

**Analysis Date:** 2026-04-22

---

## Actual Bugs / Potential Runtime Errors

**`withdrawFromGoal` uses stale client-side data — race condition:**
- Issue: `src/db/goals.ts` `withdrawFromGoal()` reads `goal.current_amount` passed from the caller and subtracts client-side. If the value is stale (e.g., `addMoneyToGoal` was called in another tab), the resulting `newAmount` can be incorrect, and an over-withdraw is possible at the DB level because no DB-side check exists in the `UPDATE` statement.
- Files: `src/db/goals.ts` (lines 97–113), `src/components/AddMoneyDialog.tsx`
- Impact: Over-withdrawal of goal funds; `current_amount` can go below 0 in the DB if the RLS `CHECK` constraint does not catch it. The DB schema has `CHECK (current_amount >= 0)` which would cause a 400 error, but the user-facing error message would be cryptic.
- Fix approach: Mirror `addMoneyToGoal` — create a `withdraw_from_goal` RPC in PostgreSQL that does an atomic `UPDATE ... WHERE id = p_id AND current_amount >= p_amount`, returning the new amount.

**`createInvestment` records price_history on `buy_date`, not price update date:**
- Issue: `src/db/investments.ts` lines 79–86 insert into `price_history` with `date: i.buy_date` when the investment is first created. If `buy_date` is months in the past, the price history entry is backdated, which makes the price chart misleading.
- Files: `src/db/investments.ts`
- Impact: Price history chart (shown in `PriceUpdateDialog`) shows an incorrect historical data point pinned to the buy date.
- Fix approach: Use `todayISO()` (or the actual update date) as the price history date rather than `buy_date`.

**`useRencanaInit` fires on every new user without a guard per user:**
- Issue: `src/lib/useRencanaInit.ts` stores the `rencana_seeded` flag in `localStorage` with a key that is not user-scoped. If a second user logs in on the same browser, the seed will never run for them (the flag is already set from the first user).
- Files: `src/lib/useRencanaInit.ts`, `src/lib/rencanaNames.ts`
- Impact: New user accounts on a shared browser never get the Rencana seed data in their Goals/Investments.
- Fix approach: Key the localStorage flag with the user ID: `rencana_seeded_${userId}`.

**`listAssetTypes` does not filter out zero-quantity investments:**
- Issue: `src/db/investments.ts` `listAssetTypes()` queries `asset_type` from ALL investments without the `gt('quantity', 0)` guard that `listInvestments()` uses. Asset types from deleted/sold investments (quantity=0) remain in the dropdown.
- Files: `src/db/investments.ts` (line 140), `src/components/InvestmentDialog.tsx`
- Impact: Users see asset types that no longer have any active positions.
- Fix approach: Add `.gt('quantity', 0)` to the `listAssetTypes` query.

**ErrorBoundary message references `.db` file (stale copy from offline version):**
- Issue: `src/components/ErrorBoundary.tsx` line 37 says "Data Anda di file `.db` tetap aman." This is copied from the old local SQL.js version; the app now uses Supabase in the cloud.
- Files: `src/components/ErrorBoundary.tsx`
- Impact: Misleading user-facing text — there is no `.db` file.
- Fix approach: Replace with "Data Anda di cloud (Supabase) tetap aman."

**`TransactionsTab` totals include ALL loaded rows, ignoring active filters:**
- Issue: `src/tabs/TransactionsTab.tsx` `totals` are computed from `rows`, which is the filtered server result. This is correct when a date/type filter is active, but the summary cards label is "Pemasukan" without clarifying it is for the filtered period. If no date filter is set, it totals ALL transactions ever — potentially summing thousands of rows returned by the server.
- Files: `src/tabs/TransactionsTab.tsx`, `src/db/transactions.ts`
- Impact: No server-side `limit` is set when filters are empty, so the query can return the entire transactions table. On large datasets this is a performance and UX problem.
- Fix approach: Either (a) always enforce a default date range (e.g., current month) or (b) add server-side aggregation via an RPC similar to `aggregate_by_period`.

---

## Data Integrity Issues

**`goal_investments.allocation_pct` can exceed 100% across all goals for one investment:**
- Issue: The DB constraint on `goal_investments` (`CHECK (allocation_pct > 0 AND allocation_pct <= 100)`) only enforces that a single row is between 1–100%. The application logic in `LinkInvestmentDialog.tsx` (lines 46–51) enforces a cross-goal total, but this check is purely client-side with no DB trigger or RPC guard.
- Files: `supabase/migrations/0005_goal_investments.sql`, `src/components/LinkInvestmentDialog.tsx`
- Impact: If two browser sessions save simultaneously, or if data is inserted directly via API/SQL, an investment can be over-allocated.
- Fix approach: Add a DB trigger or RPC that verifies `SUM(allocation_pct) <= 100` for an investment across all goals before inserting/updating.

**`price_history` has no unique constraint on `(investment_id, date)`:**
- Issue: `supabase/migrations/0001_init.sql` creates `price_history` without a unique constraint. Every call to `updatePrice` (including `useRefreshPrices`) inserts a new row even if the same date already has a price.
- Files: `src/db/investments.ts` (line 123), `supabase/migrations/0001_init.sql`
- Impact: Clicking "Refresh Harga" multiple times on the same day creates duplicate price history entries, polluting the chart in `PriceUpdateDialog`.
- Fix approach: Add `UNIQUE(investment_id, date)` or use `ON CONFLICT (investment_id, date) DO UPDATE SET price = EXCLUDED.price`.

**`importInvestmentsCsv` inserts `user_id` via DB default, not explicitly:**
- Issue: `src/db/csvInvestments.ts` (line 77) inserts rows into `investments` without a `user_id` column. It relies on the `DEFAULT auth.uid()` added in migration `0006`. If the RLS `SECURITY DEFINER` default ever changes or the session token is not passed correctly, records could be inserted without a user.
- Files: `src/db/csvInvestments.ts`, `src/db/csvTransactions.ts`
- Impact: Silent data ownership ambiguity. The same pattern exists in `csvTransactions.ts`.
- Fix approach: Explicitly pass `user_id` in the insert payload (requires reading `auth.uid()` on the client or switching to an RPC).

**`withdrawFromGoal` does not update `status` back to `active` for `paused` goals:**
- Issue: `src/db/goals.ts` (lines 104–108) only reverts `completed → active` if the withdrawal brings `current_amount < target_amount`. A `paused` goal that had reached 100% and was manually marked `completed` is not handled. More critically, withdrawing from a `paused` goal leaves the status as `paused` even if the logic check `goal.status === 'completed'` is false — this is fine, but the status will never auto-revert.
- Files: `src/db/goals.ts`
- Impact: Minor logic gap — not a critical bug but behavior is inconsistent with `addMoneyToGoal`, which auto-sets `completed`.

---

## Security Concerns

**`profiles` table is readable by all authenticated users — exposes display names:**
- Issue: `supabase/migrations/0006_multi_user.sql` line 15: `CREATE POLICY profiles_select ON profiles FOR SELECT TO authenticated USING (true)` — every authenticated user can read every other user's profile, including `display_name` and the `is_admin` flag.
- Files: `supabase/migrations/0006_multi_user.sql`, `src/db/profiles.ts`
- Risk: An authenticated user (even a non-admin) can enumerate all users and know who is admin by querying the `profiles` table directly or via the Supabase client.
- Current mitigation: None.
- Recommendations: Restrict `profiles_select` to `id = auth.uid() OR is_admin()`. The admin "View As" feature can use a service-role edge function or a separate admin-only RPC instead of full table access.

**`allowed_emails` is readable by all authenticated users:**
- Issue: `supabase/migrations/0006_multi_user.sql` line 29: `CREATE POLICY allowed_emails_select ON allowed_emails FOR SELECT TO authenticated USING (true)` — every logged-in user can read the full allowlist.
- Files: `supabase/migrations/0006_multi_user.sql`
- Risk: Leaks the list of all allowed email addresses to any authenticated user.
- Recommendations: Change the `SELECT` policy to `USING (is_admin())`.

**Admin status is checked only on the client via `isAdmin` state:**
- Issue: `src/auth/AuthProvider.tsx` sets `isAdmin` from a DB query result at login time. The admin-gated UI sections in `SettingsTab.tsx` use `isAdmin` to conditionally render, but write operations to `allowed_emails` are also gated by RLS. However, the `listProfiles()` function is available to any component without the admin check — if a non-admin calls it directly it succeeds.
- Files: `src/auth/AuthProvider.tsx`, `src/tabs/SettingsTab.tsx`
- Risk: Low, given RLS is enforced at DB level for writes. But the global readable profiles/allowed_emails RLS are the bigger exposure.

**Edge function `fetch-prices` has no authentication check:**
- Issue: `supabase/functions/fetch-prices/index.ts` does not validate the `Authorization` header or confirm the caller is authenticated before hitting Yahoo Finance or metals.dev.
- Files: `supabase/functions/fetch-prices/index.ts`
- Risk: The function can be invoked by anyone who knows the Supabase project URL and the function name (no secret needed beyond the anon key, which is public). This can cause unexpected usage of API quota and charges.
- Recommendations: Add `const authHeader = req.headers.get('Authorization'); if (!authHeader) return new Response('Unauthorized', { status: 401 })` at the top. Supabase Edge Functions can verify the JWT with the service role key.

**CORS on edge function is `*`:**
- Issue: `supabase/functions/fetch-prices/index.ts` line 3: `'Access-Control-Allow-Origin': '*'`. Any website can call this function from a browser.
- Files: `supabase/functions/fetch-prices/index.ts`
- Recommendations: Restrict to the app's domain or rely on the Authorization JWT check above to limit callers.

---

## Performance Issues

**`TransactionsTab` loads unlimited rows when no filters are set:**
- Issue: `src/db/transactions.ts` `listTransactions()` applies `f.limit` only if it is set. When `TransactionsTab` is first opened with no filters (`{}`), it fetches all rows the user has ever entered.
- Files: `src/tabs/TransactionsTab.tsx`, `src/db/transactions.ts`
- Impact: Users with years of transaction history will see slow initial loads and large memory usage.
- Fix approach: Add a default `limit` (e.g., 200) or a default date range (e.g., current month) on the tab. Add a "load more" / infinite scroll pattern.

**`useRencanaInit` runs `seedRencanaGoals` + `seedRencanaInvestments` sequentially in a loop:**
- Issue: `src/db/goals.ts` `seedRencanaGoals()` and `src/db/investments.ts` `seedRencanaInvestments()` both call `listGoals()` / `listInvestments()` first, then insert missing items one by one with `for (const g of toInsert) await createGoal(g)`.
- Files: `src/db/goals.ts` (line 124–128), `src/db/investments.ts` (line 187–192)
- Impact: Seed inserts are serialized — up to 5+3=8 sequential round-trips on first Dashboard load.
- Fix approach: Use `supabase.from(...).insert([...all items...])` as a batch insert.

**`listAssetTypes` fetches all investments every time the InvestmentDialog opens:**
- Issue: `src/db/investments.ts` `listAssetTypes()` runs a full table scan on `investments` to extract distinct `asset_type` values with no pagination.
- Files: `src/db/investments.ts` (line 139), `src/queries/investments.ts`
- Impact: As the investments table grows, this becomes slow.
- Fix approach: Query `SELECT DISTINCT asset_type FROM investments WHERE user_id = auth.uid()` directly, or cache the result aggressively with a long `staleTime`.

**`ReportsTab` always loads all investments regardless of period filter:**
- Issue: `src/tabs/ReportsTab.tsx` calls `useInvestments()` which always fetches all user investments, even though the "Kinerja Investasi" chart is not date-filtered.
- Files: `src/tabs/ReportsTab.tsx`
- Impact: Minor — investments are already loaded by other tabs. Acceptable given the current data scale.

---

## UX / Usability Problems

**`TransactionsTab` — income badge shows wrong arrow icon:**
- Issue: `src/tabs/TransactionsTab.tsx` lines 154–156 show `ArrowDownCircle` for income (`isIncome = true`) and `ArrowUpCircle` for expense. Arrows are semantically backwards — income = money flowing in (up arrow) and expense = money flowing out (down arrow).
- Files: `src/tabs/TransactionsTab.tsx`
- Impact: Visual confusion — the icon says "down" but represents incoming money.
- Fix approach: Swap: `isIncome ? <ArrowUpCircle />  : <ArrowDownCircle />`.

**No pagination or "load more" in any list tab:**
- Issue: Transactions, Investments, Goals, and Notes all render every record in a single render pass with no virtualization.
- Files: `src/tabs/TransactionsTab.tsx`, `src/tabs/InvestmentsTab.tsx`, `src/tabs/GoalsTab.tsx`, `src/tabs/NotesTab.tsx`
- Impact: Performance degradation for users with large datasets. All data is fetched in one shot.
- Fix approach: Add server-side pagination (`limit` + `offset` or cursor-based) for Transactions at minimum.

**`NotesTab` truncates content at 200 characters with no "expand" option:**
- Issue: `src/tabs/NotesTab.tsx` line 47: `n.content.length > 200 ? n.content.slice(0, 200) + '…' : n.content`. There is no way to read the full note from the list view without clicking Edit.
- Files: `src/tabs/NotesTab.tsx`
- Impact: Poor UX for longer notes — user must open the edit dialog just to read.
- Fix approach: Add an expand/collapse toggle, or a read-only "view" dialog.

**`DashboardTab` shows only top 4 active goals — no indication that more exist:**
- Issue: `src/tabs/DashboardTab.tsx` line 47: `.slice(0, 4)`. If there are 5+ active goals the user has no way of knowing from the dashboard.
- Files: `src/tabs/DashboardTab.tsx`
- Fix approach: Add a "Lihat semua N goals →" link when `activeGoals.length > 4`.

**`AddMoneyDialog` shows `goal.current_amount` (cash only) as "Saldo kas tersedia" in "Tarik Dana" mode, but GoalsTab displays `totalCurrent` (cash + investment allocation):**
- Issue: The "Tarik Dana" tab description (`src/components/AddMoneyDialog.tsx` line 74) shows `goal.current_amount` which is only the cash portion. The `GoalsTab` shows `totalCurrent = current_amount + investedAmount`. This inconsistency may confuse users about how much they can withdraw.
- Files: `src/components/AddMoneyDialog.tsx`, `src/tabs/GoalsTab.tsx`
- Fix approach: Pass `totalCurrent` into `AddMoneyDialog` and display it, while keeping the withdrawal logic restricted to `current_amount` (since the investment portion cannot be directly "withdrawn").

**`RencanaBar` shows `bulanLagi` as 0 or negative without any warning:**
- Issue: `src/components/RencanaBar.tsx` line 43: `{bulanLagi !== null && bulanLagi > 0 && ...}` — when `bulanLagi <= 0` (deadline passed), nothing is shown. There is no overdue indicator.
- Files: `src/components/RencanaBar.tsx`
- Fix approach: Add an overdue label like `Deadline terlewat ${Math.abs(bulanLagi)} bulan lalu` when `bulanLagi < 0`.

**`ReportsTab` — "Bulan ini" granularity defaults to `day` which can produce 30+ bars:**
- Issue: `src/tabs/ReportsTab.tsx` the granularity default is `'day'`. For "Bulan ini", 30 day-bars is useful but no label rotation is configured in Recharts, causing X-axis label overlap on mobile.
- Files: `src/tabs/ReportsTab.tsx`
- Fix approach: Set default granularity to `'month'` and auto-suggest `'day'` when preset is `'month'`, or add `angle` rotation to the XAxis.

**No search/filter in Investasi, Goals, or Catatan tabs:**
- Issue: None of the list tabs except Transaksi offer any filtering or search by name/type/status.
- Files: `src/tabs/InvestmentsTab.tsx`, `src/tabs/GoalsTab.tsx`, `src/tabs/NotesTab.tsx`
- Impact: As data grows, finding specific records is difficult.
- Fix approach: At minimum, add a text search input that does client-side filtering on the already-loaded `rows`.

---

## Missing Features / Obvious Gaps

**No budget / anggaran feature:**
- Problem: Users can see income vs. expense totals but cannot set monthly budgets per category and track against them.
- Blocks: Any budget vs. actual analysis, overspending alerts.

**No recurring transactions:**
- Problem: There is no way to mark a transaction (e.g., monthly salary, monthly rent) as recurring. Users must manually enter each month.
- Files: `src/db/transactions.ts`
- Impact: Data entry overhead for regular transactions.

**`notes.linked_transaction_id` is never used in the UI:**
- Issue: `src/db/notes.ts` includes `linked_transaction_id` in the `Note` interface and schema, but the `NoteDialog` hard-codes it as `editing?.linked_transaction_id ?? null` with no way to pick a transaction from the UI.
- Files: `src/db/notes.ts`, `src/components/NoteDialog.tsx`, `src/tabs/NotesTab.tsx`
- Impact: Dead field — the feature is scaffolded but not implemented. Notes cannot be linked to transactions from the app.
- Fix approach: Implement a transaction-picker in `NoteDialog`, or remove the field if the feature is out of scope.

**`settings` table is never read or written in the app:**
- Issue: `supabase/migrations/0001_init.sql` creates a `settings` table (comment: "belum dipakai aktif di MVP"). Migration `0006` migrates its PK to multi-user. No code in `src/` queries or writes to this table.
- Files: `supabase/migrations/0001_init.sql`, `supabase/migrations/0006_multi_user.sql`
- Impact: Dead table. If future features need per-user settings stored in DB, the table exists but has no service layer.

**`bei_stocks`, `dividend_transactions` tables exist in DB but all UI code was removed:**
- Issue: Migration `0007_dividends.sql` creates `bei_stocks`, `dividend_transactions`, the `create_dividend_transaction` and `get_dividend_holdings` RPCs, and adds `bei_stock_id` to `investments`. The entire Dividen tab was then deleted (commits `7d4d7ad`, `ca45ead`, `cac00f8`). The `bei_stock_id` FK column remains on the `investments` table.
- Files: `supabase/migrations/0007_dividends.sql`, `src/db/investments.ts` (the `Investment` type does NOT include `bei_stock_id`, but the DB column exists)
- Impact: Orphaned schema objects. The dividend workflow cannot function without UI. The `bei_stock_id` column on `investments` is never set by the standard `InvestmentDialog`, meaning any stocks managed via the regular investments tab will never be linked to `bei_stocks`.
- Fix approach: Either re-implement the dividend tab or create a migration to drop the dividend-specific tables/columns.

**No export for Goals or Notes:**
- Issue: `InvestmentsTab` and `TransactionsTab` have CSV export. Goals and Notes have no export at all.
- Files: `src/tabs/GoalsTab.tsx`, `src/tabs/NotesTab.tsx`
- Impact: User cannot back up or analyze goal progress or notes outside the app.

**`kalkulator-pensiun-bumn.html` is a standalone file in the repo root with no connection to the app:**
- Issue: `kalkulator-pensiun-bumn.html` is an untracked standalone HTML tool. It is not listed in `.gitignore`, not served by Vite, and not linked from the main app.
- Files: `kalkulator-pensiun-bumn.html`
- Impact: Confusing presence in the repo. Not accessible via the deployed app URL.
- Fix approach: Either integrate it as a route in the React app, host it separately, or add it to `.gitignore`.

---

## Tech Debt

**`date-fns` is listed as a dependency but never imported:**
- Issue: `package.json` lists `date-fns ^4.1.0`. No `import` of `date-fns` exists anywhere in `src/`.
- Files: `package.json`
- Impact: Unused dependency adds ~50 KB to the bundle if tree-shaking fails.
- Fix approach: Remove `date-fns` from `package.json`.

**`next-themes` is listed as a dependency but not used:**
- Issue: `package.json` lists `next-themes ^0.4.6`. Theme management is done via a custom Zustand store in `src/lib/theme.ts`. `next-themes` is never imported.
- Files: `package.json`, `src/lib/theme.ts`
- Impact: Unused dependency in bundle. `next-themes` is a Next.js utility and is largely pointless in a Vite/React SPA.
- Fix approach: Remove `next-themes` from `package.json`.

**`@types/sql.js` is a devDependency but the app no longer uses SQL.js:**
- Issue: `package.json` devDependencies includes `@types/sql.js ^1.4.11`. The app migrated to Supabase.
- Files: `package.json`
- Fix approach: Remove `@types/sql.js`.

**`src/assets/react.svg` and `src/assets/vite.svg` are Vite scaffold defaults — not used:**
- Issue: `src/assets/react.svg` and `src/assets/vite.svg` are boilerplate assets from `create-vite` and are not imported anywhere.
- Files: `src/assets/react.svg`, `src/assets/vite.svg`
- Fix approach: Delete both files.

**`export-pdf.ts` casts `doc` to an intersection type as a workaround for missing types:**
- Issue: `src/lib/export-pdf.ts` lines 50, 69, 88 cast `doc` as `jsPDF & { lastAutoTable: { finalY: number } }` to access `lastAutoTable` because `jspdf-autotable` types do not augment `jsPDF` automatically.
- Files: `src/lib/export-pdf.ts`
- Impact: Type safety gap — `lastAutoTable` could be `undefined` if no table has been rendered, causing a runtime TypeError when accessing `.finalY`.
- Fix approach: Check `(doc as any).lastAutoTable?.finalY ?? someDefault` or install `@types/jspdf-autotable` if it exists.

**Hard-coded personal data in seed constants:**
- Issue: `src/lib/rencanaNames.ts` contains personal goal names ('Dana Pernikahan', 'DP + Akad Kredit Xpander') and `src/db/investments.ts` has specific personal investment values hard-coded as constants. While this is a personal-use app, these are embedded in source code committed to git.
- Files: `src/lib/rencanaNames.ts`, `src/db/investments.ts` (lines 169–173), `src/db/goals.ts` (lines 116–122)
- Impact: Anyone with repo access can see personal financial goals and investment values. Not a security risk for a private repo, but worth noting if the repo is ever made public.

**`supabase.auth.getUser()` called redundantly in `addAllowedEmail`:**
- Issue: `src/db/allowedEmails.ts` line 20 calls `await supabase.auth.getUser()` to get `user?.id` for `added_by`. But `user_id` on `allowed_emails` is already populated by RLS / the policy's `auth.uid()`. The `added_by` field is a separate column, but the pattern still adds a redundant round-trip on every email add.
- Files: `src/db/allowedEmails.ts`
- Fix approach: Pass `user.id` from the component's `useAuthContext()` directly, avoiding the extra network call.

---

## Test Coverage Gaps

**No automated tests exist in the entire codebase:**
- What's not tested: All business logic, DB layer, CSV import/export, price fetch edge function, goal progress calculations, auth flows, and UI components.
- Files: Entire `src/` directory, `supabase/functions/`
- Risk: Any regression in `parseRupiah`, `costBasis/currentValue/gainLoss`, `withdrawFromGoal`, or CSV import could silently produce wrong financial data.
- Priority: High for `src/lib/format.ts` (parseRupiah), `src/db/investments.ts` (computation helpers), `src/db/csvInvestments.ts`, `src/db/csvTransactions.ts`.

---

*Concerns audit: 2026-04-22*

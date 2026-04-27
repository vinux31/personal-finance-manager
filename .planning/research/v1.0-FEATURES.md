# Feature Landscape: Net Worth Tracker + Upcoming Bills Calendar

**Domain:** Personal Finance Management (PFM) — Indonesian users
**Researched:** 2026-04-23
**Confidence:** MEDIUM-HIGH (cross-referenced Monarch Money, Empower, YNAB, PocketGuard, Finku, Indonesian financial context)

---

## Part 1: Net Worth Tracker

### What the Top Apps Do

**Empower (formerly Personal Capital):** Real-time net worth = assets minus liabilities. Pie chart of asset breakdown. Historical chart with 90-day window. Weekly email snapshot digest. Assets are grouped: Cash, Investments, Property, Other. Liabilities: mortgage, student loans, credit cards.

**Monarch Money:** Drag-and-drop dashboard widget. Net worth chart filterable by account type (Cash, Investments, Loans, Credit Cards). Accounts renamed and grouped by user. Manual "manual accounts" for property, cars, other assets that don't connect to a bank. Clicking the chart shows breakdown at that point in time.

**Copilot Money / Kubera:** Net worth trend line with asset class breakdown stacked area chart. Snapshot history stored per period. Supports illiquid assets (real estate, business equity) via manual valuation.

**Finku (Indonesia):** Does not have explicit "net worth" feature per research. Has Cash Flow Score (penilaian arus kas). Integrates 22 financial accounts via screen scraping. No separate assets/liabilities breakdown found.

---

### Table Stakes — Net Worth Tracker

These are features users expect. Missing = product feels incomplete.

| Feature | Why Expected | Complexity | Dependency on Existing Code |
|---------|--------------|------------|----------------------------|
| Total net worth number (aset − liabilitas) | Core concept of net worth | Low | None — new calculation |
| Manual account entry with name + balance | No open banking in Indonesia | Low | New `accounts` table |
| Account grouped into: Aset vs Liabilitas | Mental model users already have | Low | Grouping logic in UI |
| Sub-grouping: Kas, Investasi, Properti, Utang | Makes the breakdown readable | Low | Enum/type field on account |
| Net worth displayed on Dashboard | Users want at-a-glance view | Low | Dashboard widget component |
| Monthly trend line chart (6-12 months) | Direction matters more than a single number | Medium | New `net_worth_snapshots` table |
| Investments auto-included in net worth | Investments tab already tracks this | Low | Query existing `investments` table |

### Differentiators — Net Worth Tracker

Features that set Kantong Pintar apart. Not expected, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Stacked area chart (Aset vs Liabilitas over time) | Shows the gap widening visually — motivating | Medium | Recharts already in stack |
| Net worth breakdown donut/pie by account sub-type | "Berapa % dari kekayaan saya itu investasi vs kas?" | Low | Single Recharts component |
| Snapshot taken automatically on first login of month | Zero-effort history — user doesn't need to do anything | Medium | One-time insert logic per month |
| Delta badge: "+Rp X vs bulan lalu" | Instant progress feedback on dashboard widget | Low | Subtract latest two snapshots |
| BPJS JHT balance as an asset | Relevant to Indonesian context; already in Pensiun tab | Low | Read from pensiun data or manual input |

### Anti-Features / Scope Traps — Net Worth Tracker

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Bank account auto-sync | No open banking API in Indonesia (OJK sandbox still limited); building this means scraping e-banking screens, which is fragile and against ToS | Manual input only, as confirmed in PROJECT.md |
| Real-time balance updates | No sync = stale immediately; creates trust problem | Snapshot model (monthly or on-demand) |
| Account-level transaction history inside net worth tracker | That's already the Transactions tab; duplicating creates two sources of truth | Link "Lihat transaksi" to existing Transactions tab filtered by account name |
| Net worth "goals" (reach Rp X by year Y) | Scope creep; Goals tab already exists | Use existing Goals tab and link investments there |
| Currency conversion (USD assets) | Adds exchange rate complexity; not in scope | Crypto/foreign stocks stay in Investments tab in IDR |
| Credit score display | Indonesia has SLIK OJK — no public API, not relevant for this app | Out of scope entirely |

---

### Indonesian-Specific Account Types

**Aset (Assets):**

| Account Type | Indonesian Label | Notes |
|-------------|-----------------|-------|
| Tabungan | Rekening Tabungan | BCA, Mandiri, BRI, BNI, BSI — most common |
| Giro | Rekening Giro | Less common for individuals |
| Kas | Uang Tunai / Kas | Cash on hand |
| Deposito | Deposito Berjangka | Fixed deposits, 1-12 month tenors, 4-7% interest; illiquid but common |
| Dompet Digital | GoPay, OVO, DANA, LinkAja, ShopeePay | Ubiquitous in Indonesia; users track these separately from bank |
| Investasi | (auto-pulled from Investments tab) | Saham IDX, Reksadana, Emas, Obligasi |
| BPJS JHT | Saldo BPJS Ketenagakerjaan JHT | Can be looked up via BPJSTK Mobile; manual input |
| Properti | Rumah / Tanah / Apartemen | Manual valuation — no Zillow equivalent in Indonesia |
| Kendaraan | Motor / Mobil | Manual valuation; depreciates; common asset |
| Piutang | Uang yang dipinjamkan | Optional; nice-to-have |

**Liabilitas (Liabilities):**

| Account Type | Indonesian Label | Notes |
|-------------|-----------------|-------|
| KPR | Kredit Pemilikan Rumah | Home mortgage; very common; tracked as outstanding principal |
| KPM | Kredit Pemilikan Motor | Motorcycle financing; min 20% DP required |
| KKB | Kredit Kendaraan Bermotor | Car loan; similar to KPM |
| Kartu Kredit | Saldo Kartu Kredit | Outstanding balance, not credit limit |
| Paylater | GoPay Later, Akulaku, Kredivo, ShopeePayLater | Digital paylater — increasingly common |
| KTA | Kredit Tanpa Agunan | Unsecured personal loan |
| Utang Pribadi | Utang ke Keluarga/Teman | Informal debt; manual input |
| BPJS iuran tertunggak | Iuran BPJS yang belum dibayar | Edge case but relevant |

**Recommended default account sub-types for MVP (keep list short):**

Aset: Tabungan, Dompet Digital, Deposito, Investasi (auto), Properti, Kendaraan, Lainnya
Liabilitas: KPR, Cicilan Kendaraan, Kartu Kredit, Paylater, KTA, Utang Lainnya

---

### Net Worth Snapshot Strategy

**Recommended approach: on-demand + auto-monthly**

- When user opens Net Worth page: check if current month has a snapshot. If not, create one automatically.
- Snapshot stores: `date` (YYYY-MM-01 for month boundary), `total_assets`, `total_liabilities`, `net_worth`, `user_id`.
- Individual account balances do NOT need to be snapshotted per account — only the totals. Keeps the schema simple.
- Trend chart reads from `net_worth_snapshots` table ordered by date.
- Manual "ambil snapshot sekarang" button for users who update balances mid-month.

**Schema hint:**
```
net_worth_snapshots: id, user_id, snapshot_date (DATE), total_assets, total_liabilities, net_worth
accounts: id, user_id, name, account_type (enum), sub_type, balance, is_asset (bool), is_active, note
```

**Investments integration:** Sum of `currentValue(inv)` from existing `investments` table is auto-included as "Investasi" asset — do not duplicate data in `accounts`.

---

## Part 2: Upcoming Bills Calendar

### What the Top Apps Do

**YNAB:** "Scheduled Transactions" appear in the account register with upcoming dates. Users can see what's coming but the UI is register-centric (rows), not calendar-centric. Mark as paid = enter the transaction for that date. No dedicated bills calendar widget — budget category view is the primary forward view.

**Monarch Money:** Dedicated recurring expenses calendar with month view. Clicking a bill shows its amounts over the last 3 months. Bills are auto-detected from bank transaction history (not applicable here). Upcoming bills also appear in dashboard as a list widget sorted by due date.

**PocketGuard "In My Pocket":** Single number: income minus bills minus necessities = what's safe to spend. Updated in real time. Most users love this simplicity.

**Quicken Simplifi "Projected Balance":** Shows your bank balance on any future date, accounting for upcoming bills and expected income. Day-by-day projection.

**PocketSmith:** Calendar view with projected daily balances. Most powerful cashflow calendar in the market but complex.

**Finku (Indonesia):** Has "catat tagihan" (bill recording) feature. Listed as a recurring bill tracker. No calendar UI confirmed — likely a list view.

---

### Table Stakes — Upcoming Bills Calendar

| Feature | Why Expected | Complexity | Dependency on Existing Code |
|---------|--------------|------------|----------------------------|
| List of bills due in next 14 days | Core promised feature per PROJECT.md | Low | Read from existing `recurring_templates` where `next_due_date <= today+14` and `is_active = true` and `type = 'expense'` |
| Bills sorted by due date ascending | Natural reading order for "what's due soonest" | Low | ORDER BY next_due_date |
| Each bill shows: nama, jumlah, tanggal jatuh tempo | Minimum info needed to act | Low | Already in RecurringTemplate type |
| "Tandai Lunas" (mark as paid) button per bill | Core flow — prevents anxiety about "did I pay that?" | Medium | Creates transaction, advances next_due_date |
| Dashboard widget: upcoming bills (3-5 items max) | Quick glance without navigating away | Low | Reuse list component, limit=5 |
| "Sisa aman" calculation: income this month − upcoming bills | Projected safe-to-spend — highly valued by users | Low | Sum income recurring − sum expense recurring due this month |
| Visual urgency indicator (overdue, due today, due soon) | Helps users prioritize | Low | Color/badge based on days delta |

### Differentiators — Upcoming Bills Calendar

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| 30-day calendar grid view (toggle from list) | Spatial overview of the whole month — power-user friendly | Medium | React calendar grid; shadcn/ui has no calendar grid but one can be built with CSS Grid |
| Income entries shown alongside bills | Answers "do I have enough before this bill hits?" | Low | Include `type = 'income'` recurring templates in the view |
| "Bayar Sekarang" flow creates a real transaction | Mark-as-paid directly creates a transaction record in Transactions tab | Medium | createTransaction() + advance next_due_date logic already exists in useProcessRecurring |
| Overdue bills highlighted in red with badge | Users often forget past-due recurring items | Low | `next_due_date < today` logic |
| Monthly cashflow summary: total masuk vs total tagihan | Month-level view before drilling into days | Low | Aggregate recurring templates by month |
| "Lewati Bulan Ini" (skip this occurrence) | Tagihan tidak selalu dibayar tiap bulan (e.g., cicilan sudah selesai) | Medium | Advance next_due_date without creating transaction |

### Anti-Features / Scope Traps — Upcoming Bills Calendar

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Bill detection from transaction history (AI auto-detect) | Needs bank sync OR pattern ML — out of scope | User manually creates recurring templates (already exists) |
| Push notifications / reminder alerts | No backend notification infrastructure; Vercel serverless doesn't support this easily | Out of scope for this milestone; note for future |
| Bill payment initiation (pay from app) | Requires fintech license, bank integration — not possible | "Tandai Lunas" only |
| "Safe to spend" that accounts for variable spend categories | Budget categories don't exist yet (next milestone) | Simple: income templates − expense templates due this month |
| Multi-month cashflow forecast (3-6 months out) | Overly complex for the value; PocketSmith territory | Stick to 14-day and current-month view |
| Separate "Bills" tab with full CRUD | Bills ARE recurring templates — don't duplicate; confuse the user | Reuse existing recurring templates; upcoming bills is a view/filter of existing data |

---

### Mark-as-Paid UX Flow

Based on PFM app patterns and the existing `useProcessRecurring` hook:

**Recommended flow (minimal friction):**

1. User sees bill card: "Listrik PLN — Rp 450.000 — Jatuh tempo: 25 Apr"
2. User taps "Tandai Lunas"
3. Confirm dialog (optional, keep it simple): "Catat pembayaran Rp 450.000 sebagai pengeluaran hari ini?"
4. On confirm:
   a. Call `createTransaction({ date: today, type: 'expense', category_id: template.category_id, amount: template.amount, note: template.name })`
   b. Advance `next_due_date` using existing `nextDueDate(current, frequency)` function
   c. Update `recurring_templates.next_due_date` in DB
5. Bill disappears from upcoming list (next occurrence now falls outside 14-day window)
6. Toast: "Pembayaran dicatat. Tagihan berikutnya: 25 Mei."

**Key insight from existing code:** `nextDueDate()` function already exists in `recurringTransactions.ts`. The "advance due date" logic is already implemented in `useProcessRecurring.ts`. Mark-as-paid can reuse this infrastructure — it is NOT a new behavior, just a user-triggered version of the auto-process.

---

### Indonesian-Specific Bills Context

**Common recurring bills in Indonesia:**

| Bill Type | Indonesian Name | Frequency | Notes |
|-----------|----------------|-----------|-------|
| Listrik PLN | Token Listrik / Tagihan PLN | Monthly | Prabayar (token) or pascabayar |
| Air PDAM | Tagihan PDAM / PAM | Monthly | Regional; some areas use prepaid |
| BPJS Kesehatan | Iuran BPJS Kesehatan | Monthly | Mandatory; Rp 35k-150k/mo depending on class |
| BPJS Ketenagakerjaan | Iuran BPJS TK | Monthly | Employee-paid portion |
| Internet / WiFi | IndiHome, First Media, MyRepublic | Monthly | Very common household expense |
| Telepon / Pulsa | Paket Data | Monthly | Often manual top-up, not invoice |
| KPR cicilan | Cicilan KPR | Monthly | Auto-debit from bank account |
| Cicilan motor/mobil | Cicilan kendaraan | Monthly | Auto-debit |
| Kartu kredit | Tagihan kartu kredit | Monthly | Due date varies by card |
| Sekolah | SPP/Uang Sekolah | Monthly | Common family expense |
| Asuransi jiwa | Premi asuransi | Monthly/Yearly | Increasingly common |
| Iuran kebersihan/keamanan | RT/RW iuran | Monthly | Common in perumahan |

**UI language note:** Use "Jatuh Tempo" for due date (not "Deadline" or "Due"). Use "Tandai Lunas" for mark-as-paid (not "Mark Paid"). Use "Sisa Aman" for safe-to-spend (colloquial, understood by Indonesian users).

---

## Feature Dependencies Map

```
Upcoming Bills Calendar
  └── Requires: recurring_templates table (EXISTS)
  └── Requires: nextDueDate() function (EXISTS in recurringTransactions.ts)
  └── Requires: createTransaction() (EXISTS in transactions.ts)
  └── New: mark-as-paid UI action
  └── New: 14-day filter query
  └── New: dashboard widget component

Net Worth Tracker
  └── Requires: investments table (EXISTS) — for auto-including investment value
  └── Requires: currentValue() helper (EXISTS in investments.ts)
  └── New: accounts table (manual balances)
  └── New: net_worth_snapshots table
  └── New: Net Worth page/tab
  └── New: Dashboard widget for net worth number + delta
```

---

## MVP Recommendation

**Upcoming Bills (build first — lower complexity, higher immediate value):**
1. List view of bills due in 14 days — filter on existing recurring_templates
2. Visual urgency (overdue red, today orange, upcoming neutral)
3. "Tandai Lunas" flow — reuses createTransaction + nextDueDate
4. Dashboard widget — 5 soonest bills
5. "Sisa aman bulan ini" calculation — simple arithmetic on recurring templates

**Net Worth Tracker (build second — needs new DB tables):**
1. `accounts` table + CRUD UI — manual balance entry
2. Net worth calculation = sum(accounts where is_asset) + investmentValue − sum(accounts where !is_asset)
3. Monthly snapshot on page load if none exists for current month
4. Trend chart (Recharts LineChart or AreaChart) from snapshots
5. Dashboard widget — total net worth number + delta vs last month

**Defer:**
- Calendar grid view (nice-to-have, build after list view proves valuable)
- "Lewati bulan ini" / skip occurrence (edge case, defer to v2)
- BPJS JHT as a named asset sub-type (can be entered as "Lainnya" for now)
- Stacked area chart breaking down assets vs liabilities (nice-to-have chart variant)

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Table stakes features | HIGH | Cross-referenced Monarch, Empower, YNAB behavior |
| Indonesian account types | MEDIUM-HIGH | Based on major Indonesian banks + fintech news; no OJK official taxonomy found |
| Mark-as-paid UX flow | HIGH | Matches existing useProcessRecurring.ts pattern exactly |
| Snapshot strategy | HIGH | Confirmed via Monarch/Empower patterns + open-source PFM implementations |
| Finku feature set | LOW-MEDIUM | Limited English documentation; Indonesian sources vague on specifics |
| "Sisa aman" formula | MEDIUM | PocketGuard "In My Pocket" is closest reference; formula is simple |

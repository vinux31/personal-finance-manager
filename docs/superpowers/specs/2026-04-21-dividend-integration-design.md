# Dividend Integration Design
**Date:** 2026-04-21  
**Status:** Approved  
**Scope:** v1 — Portfolio Tracking, Transaction Log, Price Updates, Sector Analysis

---

## 1. Architecture

### Tab Structure
pfm-web gains an 8th tab: **"Dividen"**, inserted after "Investasi" in `App.tsx`.

```
App.tsx (8 tabs)
├── Dashboard
├── Transaksi
├── Investasi   ← shows summary + link icon for BEI stocks
├── Dividen     ← new tab, full dividend detail
├── Goals
├── Catatan
├── Laporan
└── Pengaturan
```

### Data Ownership
- `bei_stocks` → global master data (10 preloaded BEI stocks, no user_id)
- `dividend_transactions` → user's BUY/SELL log (source of truth)
- Holdings = computed from transactions on-the-fly (no separate holdings table)
- `investments` record = derived summary, auto-upserted after each transaction

### Auto-link Flow (BUY 5 lot BMRI)
```
1. Insert into dividend_transactions
2. Recalculate: total_lots + avg_buy_price for this bei_stock_id + user
3. Upsert investments record:
   - asset_type = 'Saham'
   - asset_name = ticker (e.g. 'BMRI')
   - quantity = total_lots × 100
   - buy_price = avg_price_per_share (integer)
   - bei_stock_id = link FK
4. Investasi tab shows BMRI row with link icon → navigates to Dividen tab
```
Steps 1–3 are wrapped in a single Supabase RPC for atomicity.

### Tab Navigation
`App.tsx` tabs are currently uncontrolled (`defaultValue`). To support programmatic navigation from Investasi → Dividen, add a Zustand atom `activeTab` and convert `<Tabs>` to controlled (`value={activeTab}`).

### Price Updates
The existing `fetch-prices` edge function already handles `asset_type = 'Saham'`. BEI stocks stored with `asset_type = 'Saham'` will be picked up automatically. Only change needed: edge function must append `.JK` suffix for BEI tickers. Existing `price_history` table is reused.

---

## 2. Database Schema

### New Table: `bei_stocks`
```sql
CREATE TABLE bei_stocks (
  id              BIGSERIAL PRIMARY KEY,
  ticker          TEXT NOT NULL UNIQUE,   -- 'BBCA', 'BMRI'
  name            TEXT NOT NULL,           -- 'Bank Central Asia'
  sector          TEXT NOT NULL,           -- 'Finance', 'Energy'
  dividend_yield  NUMERIC(5,2),            -- 4.50 = 4.5%
  dividend_growth NUMERIC(5,2),            -- 8.00 = 8%
  is_preloaded    BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
-- No RLS: master data is public read, no user_id
```

10 preloaded stocks (seeded in migration):

| Ticker | Name | Sector | Yield | Growth |
|--------|------|--------|-------|--------|
| BBCA | Bank Central Asia | Finance | 2.50 | 8.00 |
| UNVR | Unilever Indonesia | Consumer Staples | 3.20 | — |
| TLKM | Telkom Indonesia | Telecom | 4.50 | — |
| ICBP | Indofood CBP | Consumer Staples | 2.80 | — |
| GGRM | Gudang Garam | Consumer Staples | 6.50 | — |
| PGAS | Perusahaan Gas Negara | Energy | 5.20 | — |
| ITMG | Indo Tambangraya | Energy | 8.00 | — |
| AALI | Astra Agro Lestari | Plantation | 4.80 | — |
| ADRO | Adaro Energy | Energy | 7.00 | — |
| BSDE | Bumi Serpong Damai | Real Estate | 5.50 | — |

### New Table: `dividend_transactions`
```sql
CREATE TABLE dividend_transactions (
  id               BIGSERIAL PRIMARY KEY,
  user_id          UUID NOT NULL REFERENCES auth.users(id),
  bei_stock_id     BIGINT NOT NULL REFERENCES bei_stocks(id),
  type             TEXT NOT NULL CHECK (type IN ('BUY', 'SELL')),
  lots             INTEGER NOT NULL CHECK (lots > 0),
  price_per_share  INTEGER NOT NULL CHECK (price_per_share > 0), -- Rupiah integer
  transaction_date DATE NOT NULL,
  note             TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE dividend_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY dtxn_select ON dividend_transactions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR is_admin());
CREATE POLICY dtxn_write ON dividend_transactions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

### Modified Table: `investments`
```sql
ALTER TABLE investments ADD COLUMN bei_stock_id BIGINT REFERENCES bei_stocks(id);
-- nullable: only set for BEI dividend stocks
-- index for fast lookup from InvestmentsTab
CREATE INDEX idx_investments_bei_stock ON investments(bei_stock_id) WHERE bei_stock_id IS NOT NULL;
```

### Holdings Query (computed, no separate table)
```sql
SELECT
  bei_stock_id,
  SUM(CASE WHEN type = 'BUY' THEN lots ELSE -lots END) AS total_lots,
  SUM(CASE WHEN type = 'BUY' THEN lots * price_per_share ELSE 0 END) /
    NULLIF(SUM(CASE WHEN type = 'BUY' THEN lots ELSE 0 END), 0) AS avg_price_per_share
FROM dividend_transactions
WHERE user_id = auth.uid()
GROUP BY bei_stock_id
HAVING SUM(CASE WHEN type = 'BUY' THEN lots ELSE -lots END) > 0
```

---

## 3. Components & File Structure

### New Files
```
src/
├── tabs/
│   └── DividenTab.tsx               -- main tab layout + state
├── components/
│   ├── DividenHoldingsTable.tsx     -- holdings computed from transactions
│   ├── DividenTransactionDialog.tsx -- BUY/SELL form (stock dropdown, lots, price, date)
│   ├── DividenSummaryCards.tsx      -- 4 cards: Total Value, Annual Income, Avg Yield, YoC
│   └── SectorPieChart.tsx           -- Recharts PieChart, sector allocation
├── db/
│   └── dividends.ts                 -- DB operations + pure calculation helpers
├── queries/
│   └── dividends.ts                 -- React Query hooks (all use useTargetUserId)
└── supabase/migrations/
    └── 0007_dividends.sql           -- schema + seed data
```

### Modified Files
```
src/App.tsx                          -- add 8th tab + convert to controlled Tabs
src/tabs/InvestmentsTab.tsx          -- show link icon for rows with bei_stock_id
supabase/functions/fetch-prices/     -- append .JK suffix for BEI tickers
```

### DividenTab Layout
```
┌─────────────────────────────────────────────────────┐
│  Summary Cards (4 columns)                          │
│  Total Value | Annual Income | Avg Yield | YoC      │
├───────────────────────────┬─────────────────────────┤
│  Holdings Table           │  Sector Pie Chart       │
│  Ticker | Lots | Value    │  (Recharts PieChart)    │
│  Yield | Annual Income    │                         │
│  [+ Tambah Transaksi]     │                         │
├───────────────────────────┴─────────────────────────┤
│  Transaction Log                                    │
│  Date | Ticker | BUY/SELL | Lots | Harga/share      │
└─────────────────────────────────────────────────────┘
```

### Calculations in `db/dividends.ts` (integer arithmetic)
```typescript
// All prices in Rupiah (integer), no floating point
// shares = lots × 100
// cost_basis = total_buy_lots × avg_price_per_share × 100
// current_value = shares × current_price_per_share
// annual_income = current_value × (dividend_yield / 10000)  // yield in basis points
// yield_on_cost = annual_income / cost_basis × 10000        // result in basis points
// avg_portfolio_yield = weighted avg by current_value
```

### React Query Pattern (follows existing codebase)
```typescript
// queries/dividends.ts
export function useBeiStocks() { ... }
export function useDividendTransactions() { ... useTargetUserId() ... }
export function useDividendHoldings() { ... useTargetUserId() ... }
export function useCreateDividendTransaction() { ... }
```

---

## 4. Error Handling

| Scenario | Handling |
|----------|----------|
| Yahoo Finance timeout | Toast warning, retain last known price, show "—" for unknown |
| SELL > current lots | Validate in `db/dividends.ts` before insert: throw `"Tidak bisa jual N lot — hanya punya M lot TICKER"` |
| Transaction + investments sync failure | Single Supabase RPC wraps both writes; rollback on failure, toast error |
| Holdings reach 0 lots | `investments` row kept with `quantity = 0`; filtered out of InvestmentsTab display |
| Unknown ticker input | Dialog uses dropdown from `bei_stocks` only — no free-text ticker in v1 |

---

## 5. Out of Scope (v1)

- Dividend Calendar (12-month view) — requires `dividend_schedule` table, deferred to v2
- 10-Year Projection calculator — deferred to v2
- Top-up Planner — deferred to v2
- Adding custom BEI stocks beyond the 10 preloaded — deferred to v2
- CSV import for dividend transactions — deferred to v2

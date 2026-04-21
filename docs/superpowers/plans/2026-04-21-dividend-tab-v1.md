# Dividend Tab v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Dividen" tab to pfm-web for tracking BEI dividend stock holdings, transactions, and sector allocation — with automatic sync to the existing Investasi tab.

**Architecture:** New `bei_stocks` master table + `dividend_transactions` log power a DividenTab; a PostgreSQL RPC atomically inserts a transaction and upserts the corresponding `investments` row; the Investasi tab gains a link icon that navigates to the Dividen tab via a Zustand-controlled tab store.

**Tech Stack:** React 19, TypeScript, Supabase (PostgreSQL + RPC), Zustand v5, Recharts v3, shadcn/ui, React Query v5, Tailwind CSS, Lucide React

**Spec:** `docs/superpowers/specs/2026-04-21-dividend-integration-design.md`

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `supabase/migrations/0007_dividends.sql` | Schema, seed, RPC |
| `src/lib/tabStore.ts` | Zustand store for controlled tab navigation |
| `src/db/dividends.ts` | DB operations + pure calculation helpers |
| `src/queries/dividends.ts` | React Query hooks |
| `src/components/SectorPieChart.tsx` | Recharts pie chart for sector allocation |
| `src/components/DividenSummaryCards.tsx` | 4 summary cards (value, income, yield, YoC) |
| `src/components/DividenHoldingsTable.tsx` | Holdings table computed from transactions |
| `src/components/DividenTransactionDialog.tsx` | BUY/SELL transaction form |
| `src/tabs/DividenTab.tsx` | Main tab layout |

### Modified Files
| File | Change |
|------|--------|
| `src/App.tsx` | Add tab 8 "Dividen", convert to controlled tabs via tabStore |
| `src/db/investments.ts` | Add `bei_stock_id` to `Investment` type + filter zero-quantity BEI stocks |
| `src/tabs/InvestmentsTab.tsx` | Link icon on BEI stock rows → navigates to Dividen tab |

---

## Task 1: DB Migration — Schema, Seed, and RPC

**Files:**
- Create: `supabase/migrations/0007_dividends.sql`

- [ ] **Step 1: Create migration file**

```sql
-- supabase/migrations/0007_dividends.sql
-- ============================================================
-- 0007_dividends: Tab Dividen — BEI stock dividend tracking
-- ============================================================

-- ----- bei_stocks: master data saham BEI --------------------

CREATE TABLE bei_stocks (
  id              BIGSERIAL PRIMARY KEY,
  ticker          TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  sector          TEXT NOT NULL,
  dividend_yield  NUMERIC(5,2),
  dividend_growth NUMERIC(5,2),
  is_preloaded    BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- No RLS: master data, public read for authenticated users

-- ----- dividend_transactions: log BUY/SELL per user ---------

CREATE TABLE dividend_transactions (
  id               BIGSERIAL PRIMARY KEY,
  user_id          UUID NOT NULL REFERENCES auth.users(id),
  bei_stock_id     BIGINT NOT NULL REFERENCES bei_stocks(id),
  type             TEXT NOT NULL CHECK (type IN ('BUY', 'SELL')),
  lots             INTEGER NOT NULL CHECK (lots > 0),
  price_per_share  BIGINT NOT NULL CHECK (price_per_share > 0),
  transaction_date DATE NOT NULL,
  note             TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE dividend_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY dtxn_select ON dividend_transactions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR is_admin());
CREATE POLICY dtxn_write ON dividend_transactions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ----- investments: add bei_stock_id FK ---------------------

ALTER TABLE investments ADD COLUMN bei_stock_id BIGINT REFERENCES bei_stocks(id);
CREATE INDEX idx_investments_bei_stock ON investments(bei_stock_id)
  WHERE bei_stock_id IS NOT NULL;

-- ----- Seed: 10 preloaded BEI stocks ------------------------

INSERT INTO bei_stocks (ticker, name, sector, dividend_yield, dividend_growth, is_preloaded) VALUES
  ('BBCA', 'Bank Central Asia',      'Finance',          2.50, 8.00, true),
  ('UNVR', 'Unilever Indonesia',     'Consumer Staples', 3.20, NULL, true),
  ('TLKM', 'Telkom Indonesia',       'Telecom',          4.50, NULL, true),
  ('ICBP', 'Indofood CBP',           'Consumer Staples', 2.80, NULL, true),
  ('GGRM', 'Gudang Garam',           'Consumer Staples', 6.50, NULL, true),
  ('PGAS', 'Perusahaan Gas Negara',  'Energy',           5.20, NULL, true),
  ('ITMG', 'Indo Tambangraya',       'Energy',           8.00, NULL, true),
  ('AALI', 'Astra Agro Lestari',     'Plantation',       4.80, NULL, true),
  ('ADRO', 'Adaro Energy',           'Energy',           7.00, NULL, true),
  ('BSDE', 'Bumi Serpong Damai',     'Real Estate',      5.50, NULL, true);

-- ----- RPC: create_dividend_transaction (atomic) ------------
-- Inserts transaction + upserts investments record in one call.

CREATE OR REPLACE FUNCTION create_dividend_transaction(
  p_bei_stock_id    BIGINT,
  p_type            TEXT,
  p_lots            INTEGER,
  p_price_per_share BIGINT,
  p_transaction_date DATE,
  p_note            TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticker          TEXT;
  v_total_lots      INTEGER;
  v_avg_price       BIGINT;
  v_first_buy_date  DATE;
  v_investment_id   BIGINT;
BEGIN
  -- Validate SELL does not exceed current holdings
  IF p_type = 'SELL' THEN
    SELECT COALESCE(SUM(CASE WHEN type = 'BUY' THEN lots ELSE -lots END), 0)
    INTO v_total_lots
    FROM dividend_transactions
    WHERE user_id = auth.uid() AND bei_stock_id = p_bei_stock_id;

    IF v_total_lots < p_lots THEN
      RAISE EXCEPTION 'Tidak bisa jual % lot — hanya punya % lot', p_lots, v_total_lots;
    END IF;
  END IF;

  -- Get ticker for investments record
  SELECT ticker INTO v_ticker FROM bei_stocks WHERE id = p_bei_stock_id;

  -- Insert the transaction
  INSERT INTO dividend_transactions (user_id, bei_stock_id, type, lots, price_per_share, transaction_date, note)
  VALUES (auth.uid(), p_bei_stock_id, p_type, p_lots, p_price_per_share, p_transaction_date, p_note);

  -- Recalculate holdings after insert
  SELECT
    COALESCE(SUM(CASE WHEN type = 'BUY' THEN lots ELSE -lots END), 0),
    COALESCE(
      SUM(CASE WHEN type = 'BUY' THEN lots * price_per_share ELSE 0 END) /
      NULLIF(SUM(CASE WHEN type = 'BUY' THEN lots ELSE 0 END), 0),
      0
    ),
    MIN(CASE WHEN type = 'BUY' THEN transaction_date ELSE NULL END)
  INTO v_total_lots, v_avg_price, v_first_buy_date
  FROM dividend_transactions
  WHERE user_id = auth.uid() AND bei_stock_id = p_bei_stock_id;

  -- Upsert investments record
  SELECT id INTO v_investment_id
  FROM investments
  WHERE user_id = auth.uid() AND bei_stock_id = p_bei_stock_id;

  IF v_investment_id IS NULL THEN
    INSERT INTO investments (user_id, asset_type, asset_name, quantity, buy_price, buy_date, bei_stock_id)
    VALUES (auth.uid(), 'Saham', v_ticker, v_total_lots * 100, v_avg_price, v_first_buy_date, p_bei_stock_id);
  ELSE
    UPDATE investments
    SET quantity  = v_total_lots * 100,
        buy_price = v_avg_price,
        buy_date  = v_first_buy_date
    WHERE id = v_investment_id AND user_id = auth.uid();
  END IF;
END;
$$;

-- ----- RPC: get_dividend_holdings ---------------------------
-- Returns computed holdings joined with current price from investments.
-- Supports admin view-as via p_user_id param.

CREATE OR REPLACE FUNCTION get_dividend_holdings(p_user_id UUID DEFAULT NULL)
RETURNS TABLE (
  bei_stock_id    BIGINT,
  ticker          TEXT,
  name            TEXT,
  sector          TEXT,
  dividend_yield  NUMERIC,
  dividend_growth NUMERIC,
  total_lots      INTEGER,
  avg_price       BIGINT,
  current_price   NUMERIC,
  investment_id   BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    bs.id                                                         AS bei_stock_id,
    bs.ticker,
    bs.name,
    bs.sector,
    bs.dividend_yield,
    bs.dividend_growth,
    CAST(SUM(CASE WHEN dt.type = 'BUY' THEN dt.lots ELSE -dt.lots END) AS INTEGER) AS total_lots,
    CAST(
      SUM(CASE WHEN dt.type = 'BUY' THEN dt.lots * dt.price_per_share ELSE 0 END) /
      NULLIF(SUM(CASE WHEN dt.type = 'BUY' THEN dt.lots ELSE 0 END), 0)
    AS BIGINT)                                                    AS avg_price,
    inv.current_price,
    inv.id                                                        AS investment_id
  FROM dividend_transactions dt
  JOIN bei_stocks bs ON dt.bei_stock_id = bs.id
  LEFT JOIN investments inv
    ON inv.bei_stock_id = bs.id
   AND inv.user_id = COALESCE(p_user_id, auth.uid())
  WHERE dt.user_id = COALESCE(p_user_id, auth.uid())
  GROUP BY bs.id, bs.ticker, bs.name, bs.sector, bs.dividend_yield, bs.dividend_growth,
           inv.current_price, inv.id
  HAVING SUM(CASE WHEN dt.type = 'BUY' THEN dt.lots ELSE -dt.lots END) > 0
  ORDER BY bs.ticker;
$$;

GRANT EXECUTE ON FUNCTION create_dividend_transaction TO authenticated;
GRANT EXECUTE ON FUNCTION get_dividend_holdings TO authenticated;
```

- [ ] **Step 2: Apply migration to local Supabase**

```bash
npx supabase db push
```

Expected: migration runs without error. Verify in Supabase Studio that `bei_stocks` has 10 rows.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0007_dividends.sql
git commit -m "feat(db): tambah schema dividen — bei_stocks, dividend_transactions, RPC"
```

---

## Task 2: DB Layer — `src/db/dividends.ts`

**Files:**
- Create: `src/db/dividends.ts`

- [ ] **Step 1: Create the file with interfaces and DB functions**

```typescript
// src/db/dividends.ts
import { supabase } from '@/lib/supabase'

export interface BeiStock {
  id: number
  ticker: string
  name: string
  sector: string
  dividend_yield: number | null
  dividend_growth: number | null
  is_preloaded: boolean
}

export interface DividendTransaction {
  id: number
  user_id: string
  bei_stock_id: number
  type: 'BUY' | 'SELL'
  lots: number
  price_per_share: number
  transaction_date: string
  note: string | null
}

export interface DividendHolding {
  bei_stock_id: number
  ticker: string
  name: string
  sector: string
  dividend_yield: number | null
  dividend_growth: number | null
  total_lots: number
  avg_price: number
  current_price: number | null
  investment_id: number | null
}

export interface CreateDividendTransactionInput {
  bei_stock_id: number
  type: 'BUY' | 'SELL'
  lots: number
  price_per_share: number
  transaction_date: string
  note?: string
}

export async function listBeiStocks(): Promise<BeiStock[]> {
  const { data, error } = await supabase
    .from('bei_stocks')
    .select('id, ticker, name, sector, dividend_yield, dividend_growth, is_preloaded')
    .order('ticker')
  if (error) throw error
  return data as BeiStock[]
}

export async function listDividendTransactions(uid?: string): Promise<DividendTransaction[]> {
  let query = supabase
    .from('dividend_transactions')
    .select('id, user_id, bei_stock_id, type, lots, price_per_share, transaction_date, note')
    .order('transaction_date', { ascending: false })
    .order('id', { ascending: false })
  if (uid) query = query.eq('user_id', uid)
  const { data, error } = await query
  if (error) throw error
  return data as DividendTransaction[]
}

export async function getDividendHoldings(uid?: string): Promise<DividendHolding[]> {
  const { data, error } = await supabase.rpc('get_dividend_holdings', {
    p_user_id: uid ?? null,
  })
  if (error) throw error
  return (data ?? []) as DividendHolding[]
}

export async function createDividendTransaction(
  input: CreateDividendTransactionInput,
): Promise<void> {
  const { error } = await supabase.rpc('create_dividend_transaction', {
    p_bei_stock_id:    input.bei_stock_id,
    p_type:            input.type,
    p_lots:            input.lots,
    p_price_per_share: input.price_per_share,
    p_transaction_date: input.transaction_date,
    p_note:            input.note ?? null,
  })
  if (error) throw error
}

// --- Pure calculation helpers (no network) ---

/** Total shares = lots × 100 */
export function shares(holding: DividendHolding): number {
  return holding.total_lots * 100
}

/** Cost basis in Rupiah */
export function dividendCostBasis(holding: DividendHolding): number {
  return shares(holding) * holding.avg_price
}

/** Current value in Rupiah — falls back to avg_price if no current_price */
export function dividendCurrentValue(holding: DividendHolding): number {
  const price = holding.current_price ?? holding.avg_price
  return shares(holding) * price
}

/** Annual dividend income in Rupiah — 0 if yield unknown */
export function annualIncome(holding: DividendHolding): number {
  if (holding.dividend_yield == null) return 0
  return Math.round(dividendCurrentValue(holding) * holding.dividend_yield / 100)
}

/** Yield on Cost in percent (2 decimal places) */
export function yieldOnCost(holding: DividendHolding): number {
  const cb = dividendCostBasis(holding)
  if (cb === 0) return 0
  return annualIncome(holding) / cb * 100
}

/** Portfolio-level weighted average yield (weighted by current value) */
export function weightedAvgYield(holdings: DividendHolding[]): number {
  const totalValue = holdings.reduce((s, h) => s + dividendCurrentValue(h), 0)
  if (totalValue === 0) return 0
  const weighted = holdings.reduce((s, h) => {
    if (h.dividend_yield == null) return s
    return s + (dividendCurrentValue(h) * h.dividend_yield)
  }, 0)
  return weighted / totalValue
}

/** Sector allocation: { sector, value }[] sorted by value desc */
export function sectorAllocation(
  holdings: DividendHolding[],
): { sector: string; value: number }[] {
  const map = new Map<string, number>()
  for (const h of holdings) {
    const v = dividendCurrentValue(h)
    map.set(h.sector, (map.get(h.sector) ?? 0) + v)
  }
  return [...map.entries()]
    .map(([sector, value]) => ({ sector, value }))
    .sort((a, b) => b.value - a.value)
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build
```

Expected: compiles without errors.

- [ ] **Step 3: Commit**

```bash
git add src/db/dividends.ts
git commit -m "feat(db): tambah dividends DB layer — interfaces, queries, calc helpers"
```

---

## Task 3: React Query Hooks — `src/queries/dividends.ts`

**Files:**
- Create: `src/queries/dividends.ts`

- [ ] **Step 1: Create hooks file**

```typescript
// src/queries/dividends.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  listBeiStocks,
  listDividendTransactions,
  getDividendHoldings,
  createDividendTransaction,
  type BeiStock,
  type DividendTransaction,
  type DividendHolding,
  type CreateDividendTransactionInput,
  shares,
  dividendCostBasis,
  dividendCurrentValue,
  annualIncome,
  yieldOnCost,
  weightedAvgYield,
  sectorAllocation,
} from '@/db/dividends'
import { mapSupabaseError } from '@/lib/errors'
import { useTargetUserId } from '@/auth/useTargetUserId'

export {
  shares, dividendCostBasis, dividendCurrentValue,
  annualIncome, yieldOnCost, weightedAvgYield, sectorAllocation,
}
export { type BeiStock, type DividendTransaction, type DividendHolding }

export function useBeiStocks() {
  return useQuery({
    queryKey: ['bei-stocks'],
    queryFn: () => listBeiStocks(),
  })
}

export function useDividendTransactions() {
  const uid = useTargetUserId()
  return useQuery({
    queryKey: ['dividend-transactions', uid],
    queryFn: () => listDividendTransactions(uid),
    enabled: !!uid,
  })
}

export function useDividendHoldings() {
  const uid = useTargetUserId()
  return useQuery({
    queryKey: ['dividend-holdings', uid],
    queryFn: () => getDividendHoldings(uid),
    enabled: !!uid,
  })
}

export function useCreateDividendTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateDividendTransactionInput) => createDividendTransaction(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dividend-transactions'] })
      qc.invalidateQueries({ queryKey: ['dividend-holdings'] })
      qc.invalidateQueries({ queryKey: ['investments'] })
      toast.success('Transaksi berhasil disimpan')
    },
    onError: (e) => toast.error(mapSupabaseError(e)),
  })
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build
```

Expected: compiles without errors.

- [ ] **Step 3: Commit**

```bash
git add src/queries/dividends.ts
git commit -m "feat(queries): tambah React Query hooks untuk tab Dividen"
```

---

## Task 4: Controlled Tab Navigation — `src/lib/tabStore.ts` + `src/App.tsx`

**Files:**
- Create: `src/lib/tabStore.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create tab store**

```typescript
// src/lib/tabStore.ts
import { create } from 'zustand'

interface TabStore {
  activeTab: string
  setActiveTab: (tab: string) => void
}

export const useTabStore = create<TabStore>((set) => ({
  activeTab: 'dashboard',
  setActiveTab: (tab) => set({ activeTab: tab }),
}))
```

- [ ] **Step 2: Update `src/App.tsx`**

Replace the entire file with:

```tsx
// src/App.tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Toaster } from '@/components/ui/sonner'
import {
  LayoutDashboard,
  Wallet,
  TrendingUp,
  Banknote,
  Target,
  StickyNote,
  BarChart3,
  Settings as SettingsIcon,
} from 'lucide-react'
import DashboardTab from '@/tabs/DashboardTab'
import TransactionsTab from '@/tabs/TransactionsTab'
import InvestmentsTab from '@/tabs/InvestmentsTab'
import DividenTab from '@/tabs/DividenTab'
import GoalsTab from '@/tabs/GoalsTab'
import NotesTab from '@/tabs/NotesTab'
import ReportsTab from '@/tabs/ReportsTab'
import SettingsTab from '@/tabs/SettingsTab'
import LoginScreen from '@/components/LoginScreen'
import OfflineBanner from '@/components/OfflineBanner'
import ViewAsBanner from '@/components/ViewAsBanner'
import AccountMenu from '@/components/AccountMenu'
import { useAuth } from '@/auth/useAuth'
import { useTabStore } from '@/lib/tabStore'

const TABS = [
  { value: 'dashboard',    label: 'Dashboard',  icon: LayoutDashboard, Comp: DashboardTab },
  { value: 'transactions', label: 'Transaksi',  icon: Wallet,          Comp: TransactionsTab },
  { value: 'investments',  label: 'Investasi',  icon: TrendingUp,      Comp: InvestmentsTab },
  { value: 'dividen',      label: 'Dividen',    icon: Banknote,        Comp: DividenTab },
  { value: 'goals',        label: 'Goals',      icon: Target,          Comp: GoalsTab },
  { value: 'notes',        label: 'Catatan',    icon: StickyNote,      Comp: NotesTab },
  { value: 'reports',      label: 'Laporan',    icon: BarChart3,       Comp: ReportsTab },
  { value: 'settings',     label: 'Pengaturan', icon: SettingsIcon,    Comp: SettingsTab },
] as const

function App() {
  const { session, loading } = useAuth()
  const { activeTab, setActiveTab } = useTabStore()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="text-muted-foreground text-sm">Memuat...</span>
      </div>
    )
  }

  if (!session) {
    return (
      <>
        <LoginScreen />
        <Toaster richColors position="top-right" />
      </>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <OfflineBanner />
      <ViewAsBanner />
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Personal Finance Manager
          </h1>
          <p className="text-sm text-muted-foreground">
            Kelola keuangan pribadi Anda
          </p>
        </div>
        <AccountMenu />
      </header>

      <main className="p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-6">
            {TABS.map(({ value, label, icon: Icon }) => (
              <TabsTrigger key={value} value={value} className="gap-2">
                <Icon className="h-4 w-4" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          {TABS.map(({ value, Comp }) => (
            <TabsContent key={value} value={value}>
              <Comp />
            </TabsContent>
          ))}
        </Tabs>
      </main>

      <Toaster richColors position="top-right" />
    </div>
  )
}

export default App
```

Note: `DividenTab` import will cause a compile error until Task 9. Create a stub first:

```bash
echo 'export default function DividenTab() { return <div>Dividen</div> }' > src/tabs/DividenTab.tsx
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npm run build
```

Expected: compiles without errors (stub DividenTab is valid).

- [ ] **Step 4: Commit**

```bash
git add src/lib/tabStore.ts src/App.tsx src/tabs/DividenTab.tsx
git commit -m "feat(nav): tambah tab Dividen dan controlled tab navigation via Zustand"
```

---

## Task 5: SectorPieChart Component

**Files:**
- Create: `src/components/SectorPieChart.tsx`

- [ ] **Step 1: Create component**

```tsx
// src/components/SectorPieChart.tsx
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { formatRupiah } from '@/lib/format'

const COLORS = [
  '#2563eb', '#16a34a', '#dc2626', '#d97706', '#7c3aed',
  '#0891b2', '#be185d', '#65a30d', '#ea580c', '#6366f1',
]

interface Props {
  data: { sector: string; value: number }[]
}

export default function SectorPieChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        Belum ada data sektor
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="sector"
          cx="50%"
          cy="50%"
          outerRadius={90}
          label={false}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number) => [formatRupiah(value), 'Nilai']}
        />
        <Legend
          formatter={(value) => (
            <span className="text-xs text-foreground">{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build
```

Expected: compiles without errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/SectorPieChart.tsx
git commit -m "feat(ui): tambah SectorPieChart komponen dengan Recharts"
```

---

## Task 6: DividenSummaryCards Component

**Files:**
- Create: `src/components/DividenSummaryCards.tsx`

- [ ] **Step 1: Create component**

```tsx
// src/components/DividenSummaryCards.tsx
import { formatRupiah } from '@/lib/format'

interface Props {
  totalValue: number
  totalAnnualIncome: number
  avgYield: number
  avgYieldOnCost: number
}

export default function DividenSummaryCards({
  totalValue,
  totalAnnualIncome,
  avgYield,
  avgYieldOnCost,
}: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Card label="Total Nilai" value={formatRupiah(totalValue)} />
      <Card label="Income / Tahun" value={formatRupiah(totalAnnualIncome)} />
      <Card label="Avg Yield" value={`${avgYield.toFixed(2)}%`} />
      <Card label="Yield on Cost" value={`${avgYieldOnCost.toFixed(2)}%`} />
    </div>
  )
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build
```

Expected: compiles without errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/DividenSummaryCards.tsx
git commit -m "feat(ui): tambah DividenSummaryCards komponen"
```

---

## Task 7: DividenHoldingsTable Component

**Files:**
- Create: `src/components/DividenHoldingsTable.tsx`

- [ ] **Step 1: Create component**

```tsx
// src/components/DividenHoldingsTable.tsx
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Plus } from 'lucide-react'
import { formatRupiah } from '@/lib/format'
import {
  dividendCurrentValue,
  annualIncome,
  type DividendHolding,
} from '@/queries/dividends'

interface Props {
  holdings: DividendHolding[]
  isLoading: boolean
  onAddTransaction: (holding?: DividendHolding) => void
}

export default function DividenHoldingsTable({ holdings, isLoading, onAddTransaction }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Holdings
        </h2>
        <Button size="sm" onClick={() => onAddTransaction()}>
          <Plus className="h-4 w-4" />
          Tambah Transaksi
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ticker</TableHead>
              <TableHead>Sektor</TableHead>
              <TableHead className="text-right">Lot</TableHead>
              <TableHead className="text-right">Harga Saat Ini</TableHead>
              <TableHead className="text-right">Nilai</TableHead>
              <TableHead className="text-right">Yield</TableHead>
              <TableHead className="text-right">Income / Tahun</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  Memuat…
                </TableCell>
              </TableRow>
            ) : holdings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  Belum ada holdings. Klik "Tambah Transaksi" untuk mulai.
                </TableCell>
              </TableRow>
            ) : (
              holdings.map((h) => (
                <TableRow key={h.bei_stock_id}>
                  <TableCell className="font-semibold">{h.ticker}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{h.sector}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{h.total_lots} lot</TableCell>
                  <TableCell className="text-right">
                    {h.current_price != null ? formatRupiah(h.current_price) : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatRupiah(dividendCurrentValue(h))}
                  </TableCell>
                  <TableCell className="text-right">
                    {h.dividend_yield != null ? `${h.dividend_yield.toFixed(2)}%` : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    {annualIncome(h) > 0 ? formatRupiah(annualIncome(h)) : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onAddTransaction(h)}
                    >
                      + Transaksi
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build
```

Expected: compiles without errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/DividenHoldingsTable.tsx
git commit -m "feat(ui): tambah DividenHoldingsTable komponen"
```

---

## Task 8: DividenTransactionDialog Component

**Files:**
- Create: `src/components/DividenTransactionDialog.tsx`

- [ ] **Step 1: Create component**

```tsx
// src/components/DividenTransactionDialog.tsx
import { useState, useEffect } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { todayISO } from '@/lib/format'
import { useBeiStocks, useCreateDividendTransaction, type DividendHolding } from '@/queries/dividends'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultHolding?: DividendHolding
}

export default function DividenTransactionDialog({ open, onOpenChange, defaultHolding }: Props) {
  const { data: stocks = [] } = useBeiStocks()
  const create = useCreateDividendTransaction()

  const [bei_stock_id, setBeiStockId] = useState<string>('')
  const [type, setType] = useState<'BUY' | 'SELL'>('BUY')
  const [lots, setLots] = useState('')
  const [price_per_share, setPricePerShare] = useState('')
  const [transaction_date, setTransactionDate] = useState(todayISO())
  const [note, setNote] = useState('')

  useEffect(() => {
    if (open) {
      setBeiStockId(defaultHolding ? String(defaultHolding.bei_stock_id) : '')
      setType('BUY')
      setLots('')
      setPricePerShare('')
      setTransactionDate(todayISO())
      setNote('')
    }
  }, [open, defaultHolding])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const lotsNum = parseInt(lots, 10)
    const priceNum = parseInt(price_per_share, 10)
    if (!bei_stock_id || lotsNum <= 0 || priceNum <= 0 || !transaction_date) return

    create.mutate(
      {
        bei_stock_id: parseInt(bei_stock_id, 10),
        type,
        lots: lotsNum,
        price_per_share: priceNum,
        transaction_date,
        note: note.trim() || undefined,
      },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tambah Transaksi Dividen</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label>Saham</Label>
            <Select value={bei_stock_id} onValueChange={setBeiStockId}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih saham…" />
              </SelectTrigger>
              <SelectContent>
                {stocks.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.ticker} — {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Jenis</Label>
            <Select value={type} onValueChange={(v) => setType(v as 'BUY' | 'SELL')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BUY">BUY — Beli</SelectItem>
                <SelectItem value="SELL">SELL — Jual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Lot</Label>
              <Input
                type="number"
                min={1}
                placeholder="5"
                value={lots}
                onChange={(e) => setLots(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label>Harga / Saham (Rp)</Label>
              <Input
                type="number"
                min={1}
                placeholder="5000"
                value={price_per_share}
                onChange={(e) => setPricePerShare(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Tanggal Transaksi</Label>
            <Input
              type="date"
              value={transaction_date}
              onChange={(e) => setTransactionDate(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1">
            <Label>Catatan (opsional)</Label>
            <Input
              placeholder="Catatan transaksi…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build
```

Expected: compiles without errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/DividenTransactionDialog.tsx
git commit -m "feat(ui): tambah DividenTransactionDialog komponen"
```

---

## Task 9: DividenTab — Wire Everything Together

**Files:**
- Modify: `src/tabs/DividenTab.tsx` (replace stub from Task 4)

- [ ] **Step 1: Replace stub with full implementation**

```tsx
// src/tabs/DividenTab.tsx
import { useMemo, useState } from 'react'
import {
  useDividendHoldings,
  useDividendTransactions,
  annualIncome,
  dividendCurrentValue,
  dividendCostBasis,
  yieldOnCost,
  weightedAvgYield,
  sectorAllocation,
  type DividendHolding,
} from '@/queries/dividends'
import { useBeiStocks } from '@/queries/dividends'
import DividenSummaryCards from '@/components/DividenSummaryCards'
import DividenHoldingsTable from '@/components/DividenHoldingsTable'
import DividenTransactionDialog from '@/components/DividenTransactionDialog'
import SectorPieChart from '@/components/SectorPieChart'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { formatRupiah, formatDateID } from '@/lib/format'

export default function DividenTab() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [defaultHolding, setDefaultHolding] = useState<DividendHolding | undefined>()

  const { data: holdings = [], isLoading: holdingsLoading } = useDividendHoldings()
  const { data: transactions = [], isLoading: txLoading } = useDividendTransactions()
  const { data: stocks = [] } = useBeiStocks()

  const stockMap = useMemo(
    () => new Map(stocks.map((s) => [s.id, s])),
    [stocks],
  )

  const totals = useMemo(() => {
    const totalValue = holdings.reduce((s, h) => s + dividendCurrentValue(h), 0)
    const totalIncome = holdings.reduce((s, h) => s + annualIncome(h), 0)
    const avgYield = weightedAvgYield(holdings)
    const totalCost = holdings.reduce((s, h) => s + dividendCostBasis(h), 0)
    const avgYoC = totalCost === 0 ? 0 : (totalIncome / totalCost) * 100
    return { totalValue, totalIncome, avgYield, avgYoC }
  }, [holdings])

  const sectors = useMemo(() => sectorAllocation(holdings), [holdings])

  function openDialog(holding?: DividendHolding) {
    setDefaultHolding(holding)
    setDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      <DividenSummaryCards
        totalValue={totals.totalValue}
        totalAnnualIncome={totals.totalIncome}
        avgYield={totals.avgYield}
        avgYieldOnCost={totals.avgYoC}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <DividenHoldingsTable
            holdings={holdings}
            isLoading={holdingsLoading}
            onAddTransaction={openDialog}
          />
        </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="mb-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Alokasi Sektor
          </div>
          <SectorPieChart data={sectors} />
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Log Transaksi
        </h2>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Ticker</TableHead>
                <TableHead>Jenis</TableHead>
                <TableHead className="text-right">Lot</TableHead>
                <TableHead className="text-right">Harga / Saham</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Catatan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {txLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    Memuat…
                  </TableCell>
                </TableRow>
              ) : transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    Belum ada transaksi.
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((tx) => {
                  const stock = stockMap.get(tx.bei_stock_id)
                  const total = tx.lots * 100 * tx.price_per_share
                  return (
                    <TableRow key={tx.id}>
                      <TableCell>{formatDateID(tx.transaction_date)}</TableCell>
                      <TableCell className="font-semibold">{stock?.ticker ?? '—'}</TableCell>
                      <TableCell>
                        <Badge variant={tx.type === 'BUY' ? 'default' : 'destructive'}>
                          {tx.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{tx.lots} lot</TableCell>
                      <TableCell className="text-right">
                        {formatRupiah(tx.price_per_share)}
                      </TableCell>
                      <TableCell className="text-right">{formatRupiah(total)}</TableCell>
                      <TableCell className="text-muted-foreground">{tx.note ?? '—'}</TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <DividenTransactionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        defaultHolding={defaultHolding}
      />
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build
```

Expected: compiles without errors.

- [ ] **Step 3: Start dev server and verify tab renders**

```bash
npm run dev
```

- Open browser → navigate to Dividen tab
- Summary cards show Rp 0 values (no data yet)
- Holdings table shows empty state message
- Sector chart shows "Belum ada data sektor"
- Transaction log shows empty state message
- "Tambah Transaksi" button opens dialog with stock dropdown showing 10 BEI stocks

- [ ] **Step 4: Add a test transaction**

In the dialog: select BBCA, BUY, 5 lot, Rp 9500/saham, today. Submit.

Expected:
- Toast "Transaksi berhasil disimpan"
- Holdings table shows BBCA row: 5 lot, Nilai = Rp 4.750.000
- Sector pie chart shows Finance 100%
- Investasi tab shows BBCA row (auto-linked)

- [ ] **Step 5: Commit**

```bash
git add src/tabs/DividenTab.tsx
git commit -m "feat(tab): implementasi DividenTab lengkap — holdings, sektor, transaksi"
```

---

## Task 10: InvestmentsTab — Link Icon to Dividen Tab

**Files:**
- Modify: `src/tabs/InvestmentsTab.tsx`
- Modify: `src/db/investments.ts`

- [ ] **Step 1: Add `bei_stock_id` to `Investment` interface in `src/db/investments.ts`**

In `src/db/investments.ts`, update the `Investment` interface:

```typescript
export interface Investment {
  id: number
  asset_type: string
  asset_name: string
  quantity: number
  buy_price: number
  current_price: number | null
  buy_date: string
  note: string | null
  bei_stock_id: number | null   // ← add this line
}
```

Update the select string in `listInvestments` and `getInvestment` to include `bei_stock_id`:

```typescript
// In listInvestments():
.select('id, asset_type, asset_name, quantity, buy_price, current_price, buy_date, note, bei_stock_id')

// In getInvestment():
.select('id, asset_type, asset_name, quantity, buy_price, current_price, buy_date, note, bei_stock_id')
```

- [ ] **Step 2: Add filter to hide zero-quantity BEI stocks in `listInvestments`**

In `listInvestments()`, add a filter after `.order(...)`:

```typescript
export async function listInvestments(uid?: string): Promise<Investment[]> {
  let query = supabase
    .from('investments')
    .select('id, asset_type, asset_name, quantity, buy_price, current_price, buy_date, note, bei_stock_id')
    .or('bei_stock_id.is.null,quantity.gt.0')   // ← add this line
    .order('buy_date', { ascending: false })
    .order('id', { ascending: false })
  if (uid) query = query.eq('user_id', uid)
  const { data, error } = await query
  if (error) throw error
  return data as Investment[]
}
```

- [ ] **Step 3: Add link icon to `src/tabs/InvestmentsTab.tsx`**

Add import at top of file:

```tsx
import { ExternalLink } from 'lucide-react'
import { useTabStore } from '@/lib/tabStore'
```

Add inside `InvestmentsTab` function (after existing state declarations):

```tsx
const { setActiveTab } = useTabStore()
```

In the table row actions cell, add a link button that appears only for BEI stocks. Find the actions `TableCell` and add before the Edit button:

```tsx
<TableCell className="text-right">
  {r.bei_stock_id != null && (
    <Button
      variant="ghost"
      size="icon"
      title="Lihat di tab Dividen"
      onClick={() => setActiveTab('dividen')}
    >
      <ExternalLink className="h-4 w-4 text-blue-500" />
    </Button>
  )}
  <Button variant="ghost" size="icon" title="Update harga" onClick={() => { setPriceFor(r); setPriceOpen(true) }}>
    <TrendingUp className="h-4 w-4" />
  </Button>
  <Button variant="ghost" size="icon" title="Edit" onClick={() => { setEditing(r); setDialogOpen(true) }}>
    <Pencil className="h-4 w-4" />
  </Button>
  <Button variant="ghost" size="icon" title="Hapus" onClick={() => onDelete(r)}>
    <Trash2 className="h-4 w-4 text-red-600" />
  </Button>
</TableCell>
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npm run build
```

Expected: compiles without errors.

- [ ] **Step 5: Verify in dev server**

```bash
npm run dev
```

- In Investasi tab, BBCA row should show blue ExternalLink icon
- Clicking it should navigate to Dividen tab

- [ ] **Step 6: Commit**

```bash
git add src/db/investments.ts src/tabs/InvestmentsTab.tsx
git commit -m "feat(investasi): tambah link icon ke tab Dividen untuk saham BEI"
```

---

## Task 11: End-to-End Verification

- [ ] **Step 1: Full manual test — buy flow**

Start dev server (`npm run dev`). In Dividen tab:
1. Tambah BUY 5 lot BBCA @ Rp 9.500 — expect holdings table shows BBCA, annual income ~Rp 1.187.500 (5×100×9500×2.5%)
2. Tambah BUY 3 lot TLKM @ Rp 3.200 — expect TLKM appears, sector pie shows Finance + Telecom
3. Summary cards update correctly

- [ ] **Step 2: Sell flow**

Tambah SELL 2 lot BBCA @ Rp 9.800 — expect:
- BBCA holding drops to 3 lot
- Investasi tab BBCA quantity = 300 (3 lot × 100)

- [ ] **Step 3: Invalid sell**

Tambah SELL 10 lot BBCA (more than held) — expect:
- Toast error: "Tidak bisa jual 10 lot — hanya punya 3 lot"
- No data changed

- [ ] **Step 4: Final build check**

```bash
npm run build
```

Expected: zero TypeScript errors, zero lint warnings.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: tab Dividen v1 selesai — holdings, transaksi, sektor, link investasi"
```

---

## Self-Review Checklist

| Spec Requirement | Task |
|-----------------|------|
| Tab "Dividen" ke-8 di App.tsx | Task 4 |
| bei_stocks master table + 10 BEI stocks | Task 1 |
| dividend_transactions table + RLS | Task 1 |
| investments.bei_stock_id FK | Task 1 |
| Atomic RPC create_dividend_transaction | Task 1 |
| get_dividend_holdings RPC | Task 1 |
| DB layer: interfaces + calc helpers | Task 2 |
| React Query hooks + useTargetUserId | Task 3 |
| Zustand controlled tab navigation | Task 4 |
| SectorPieChart (Recharts) | Task 5 |
| DividenSummaryCards (4 cards) | Task 6 |
| DividenHoldingsTable | Task 7 |
| DividenTransactionDialog (BUY/SELL form) | Task 8 |
| DividenTab full layout | Task 9 |
| InvestmentsTab link icon | Task 10 |
| investments.ts filter zero-quantity BEI | Task 10 |
| SELL validation error handling | Task 1 (RPC) + Task 11 (manual test) |
| Auto-link investments on transaction | Task 1 (RPC) |
| buy_date = first BUY transaction | Task 1 (RPC MIN clause) |
| Edge function — no changes needed | (confirmed, not in plan) |
| Admin view-as support (p_user_id param) | Task 1 (RPC param) + Task 3 (useTargetUserId) |

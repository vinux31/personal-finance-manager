# Periode Gaji (Pay Period) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Track siklus gaji (pay periods) berdasarkan tanggal masuk gaji — bukan bulan kalender — dengan menampilkan sisa gaji periode aktif di Dashboard dan riwayat per periode di tab Laporan.

**Architecture:** Tabel `pay_periods` menyimpan setiap siklus gaji (label + start_date). Period boundaries dihitung dari start_date periode berikutnya sehingga backdating transaksi bekerja otomatis tanpa menyimpan end_date. Saat transaksi berkategori "Gaji" disimpan, dialog konfirmasi kecil muncul untuk membuat periode baru. Semua data diambil via Supabase client dengan TanStack Query hooks. Summary (total income, expense, sisa) dihitung client-side dari data transaksi yang sudah ada di cache.

**Tech Stack:** React 19, TypeScript, Supabase (PostgreSQL + RLS), TanStack Query v5, Radix UI Dialog/Tabs, Tailwind CSS, Lucide React icons

**Spec:** `docs/superpowers/specs/2026-05-02-gaji-bulanan-design.md`

---

## File Map

| File | Action | Tanggung Jawab |
|---|---|---|
| `supabase/migrations/0026_pay_periods.sql` | Create | DDL tabel + RLS policy + unique constraint |
| `src/db/payPeriods.ts` | Create | Types + fungsi CRUD ke Supabase |
| `src/queries/payPeriods.ts` | Create | TanStack Query hooks + summary computation |
| `src/components/PayPeriodConfirmDialog.tsx` | Create | Dialog konfirmasi saat gaji diinput |
| `src/components/PayPeriodCard.tsx` | Create | Card sisa gaji untuk Dashboard |
| `src/components/PayPeriodList.tsx` | Create | List semua periode di Laporan |
| `src/components/PayPeriodDetail.tsx` | Create | Detail transaksi dalam satu periode |
| `src/components/TransactionDialog.tsx` | Modify | Deteksi kategori Gaji + trigger dialog |
| `src/tabs/DashboardTab.tsx` | Modify | Tambah PayPeriodCard |
| `src/tabs/ReportsTab.tsx` | Modify | Tambah tab "Periode Gaji" |

---

## Task 1: Database Migration — Tabel `pay_periods`

**Files:**
- Create: `supabase/migrations/0026_pay_periods.sql`

- [ ] **Step 1: Buat file migration**

Buat file `supabase/migrations/0026_pay_periods.sql`:

```sql
CREATE TABLE pay_periods (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label      TEXT        NOT NULL,
  start_date DATE        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, start_date)
);

ALTER TABLE pay_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own pay_periods"
  ON pay_periods FOR ALL
  USING      (auth.uid() = user_id OR is_admin())
  WITH CHECK (auth.uid() = user_id);
```

`UNIQUE (user_id, start_date)` mencegah duplikat periode pada tanggal yang sama.

- [ ] **Step 2: Jalankan migration di Supabase**

Buka Supabase Dashboard → SQL Editor → paste seluruh isi file di atas → Run.

Verifikasi: tabel `pay_periods` muncul di Table Editor dengan kolom id, user_id, label, start_date, created_at.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0026_pay_periods.sql
git commit -m "feat(db): add pay_periods table with RLS"
```

---

## Task 2: DB Layer — `src/db/payPeriods.ts`

**Files:**
- Create: `src/db/payPeriods.ts`

- [ ] **Step 1: Buat file**

```typescript
import { supabase } from '../lib/supabase'

export interface PayPeriod {
  id: number
  user_id: string
  label: string
  start_date: string   // 'YYYY-MM-DD'
  created_at: string
}

export interface PayPeriodSummary extends PayPeriod {
  end_date: string | null   // null = periode aktif; otherwise start_date periode lebih baru
  total_income: number
  total_expense: number
  remaining: number
}

export async function listPayPeriods(): Promise<PayPeriod[]> {
  const { data, error } = await supabase
    .from('pay_periods')
    .select('id, user_id, label, start_date, created_at')
    .order('start_date', { ascending: false })
  if (error) throw error
  return data as PayPeriod[]
}

export async function createPayPeriod(input: {
  label: string
  start_date: string
}): Promise<PayPeriod> {
  const { data, error } = await supabase
    .from('pay_periods')
    .insert({ label: input.label, start_date: input.start_date })
    .select('id, user_id, label, start_date, created_at')
    .single()
  if (error) throw error
  return data as PayPeriod
}

export async function payPeriodExistsOnDate(date: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('pay_periods')
    .select('id')
    .eq('start_date', date)
    .maybeSingle()
  if (error) throw error
  return data !== null
}
```

- [ ] **Step 2: Commit**

```bash
git add src/db/payPeriods.ts
git commit -m "feat: add payPeriods DB layer"
```

---

## Task 3: Query Hooks — `src/queries/payPeriods.ts`

**Files:**
- Create: `src/queries/payPeriods.ts`

Summary per periode dihitung client-side dengan join ke cache transaksi. Periode di-sort DESC (terbaru di index 0). `end_date` periode[i] = `start_date` periode[i-1] (lebih baru).

- [ ] **Step 1: Buat file**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listPayPeriods,
  createPayPeriod,
  payPeriodExistsOnDate,
  PayPeriod,
  PayPeriodSummary,
} from '../db/payPeriods'
import { listTransactions } from '../db/transactions'

export function usePayPeriods() {
  return useQuery({
    queryKey: ['payPeriods'],
    queryFn: listPayPeriods,
  })
}

export function useCurrentPayPeriod() {
  return useQuery({
    queryKey: ['payPeriods'],
    queryFn: listPayPeriods,
    select: (periods) => periods[0] ?? null,
  })
}

// Hitung summary per periode dengan join ke semua transaksi
export function usePayPeriodSummaries() {
  const periodsQuery = useQuery({
    queryKey: ['payPeriods'],
    queryFn: listPayPeriods,
  })

  const txQuery = useQuery({
    queryKey: ['transactions', 'all'],
    queryFn: () => listTransactions(),
    enabled: (periodsQuery.data?.length ?? 0) > 0,
  })

  const summaries: PayPeriodSummary[] | undefined = periodsQuery.data?.map(
    (period, index) => {
      const periods = periodsQuery.data!
      // Sorted DESC: periods[0] = paling baru.
      // end_date untuk period[i] = start_date period[i-1] (lebih baru), atau null jika i=0
      const end_date = index === 0 ? null : periods[index - 1].start_date

      const txInPeriod = (txQuery.data ?? []).filter((tx) => {
        const afterStart = tx.date >= period.start_date
        const beforeEnd = end_date ? tx.date < end_date : true
        return afterStart && beforeEnd
      })

      const total_income = txInPeriod
        .filter((tx) => tx.type === 'income')
        .reduce((sum, tx) => sum + tx.amount, 0)

      const total_expense = txInPeriod
        .filter((tx) => tx.type === 'expense')
        .reduce((sum, tx) => sum + tx.amount, 0)

      return {
        ...period,
        end_date,
        total_income,
        total_expense,
        remaining: total_income - total_expense,
      }
    }
  )

  return {
    data: summaries,
    isLoading: periodsQuery.isLoading || txQuery.isLoading,
    error: periodsQuery.error ?? txQuery.error,
  }
}

// Transaksi dalam satu periode — fetch dari dateFrom, filter client-side sampai endDate
export function usePayPeriodTransactions(
  period: PayPeriod | null,
  endDate: string | null
) {
  return useQuery({
    queryKey: ['transactions', 'period', period?.id],
    queryFn: async () => {
      if (!period) return []
      const all = await listTransactions({ dateFrom: period.start_date })
      return endDate ? all.filter((tx) => tx.date < endDate) : all
    },
    enabled: !!period,
  })
}

export function useCreatePayPeriod() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createPayPeriod,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payPeriods'] })
    },
  })
}

export function usePayPeriodExistsOnDate(date: string) {
  return useQuery({
    queryKey: ['payPeriods', 'exists', date],
    queryFn: () => payPeriodExistsOnDate(date),
    enabled: !!date,
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/queries/payPeriods.ts
git commit -m "feat: add payPeriods query hooks"
```

---

## Task 4: Dialog Konfirmasi — `src/components/PayPeriodConfirmDialog.tsx`

Dialog kecil yang muncul setelah transaksi "Gaji" berhasil disimpan, menawarkan opsi mulai periode baru.

**Files:**
- Create: `src/components/PayPeriodConfirmDialog.tsx`

- [ ] **Step 1: Buat komponen**

```typescript
import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { useCreatePayPeriod } from '../queries/payPeriods'
import { toast } from 'sonner'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  transactionDate: string   // 'YYYY-MM-DD' — tanggal transaksi gaji (bukan hari ini)
  suggestedLabel: string    // e.g. "Gaji Februari 2026"
}

export function PayPeriodConfirmDialog({
  open,
  onOpenChange,
  transactionDate,
  suggestedLabel,
}: Props) {
  const [label, setLabel] = useState(suggestedLabel)
  const createPeriod = useCreatePayPeriod()

  // Sync label tiap kali suggestedLabel berubah (dialog dibuka untuk gaji berbeda)
  useEffect(() => {
    setLabel(suggestedLabel)
  }, [suggestedLabel])

  async function handleConfirm() {
    if (!label.trim()) return
    try {
      await createPeriod.mutateAsync({ label: label.trim(), start_date: transactionDate })
      toast.success(`Periode "${label.trim()}" dimulai`)
      onOpenChange(false)
    } catch (err: any) {
      toast.error('Gagal membuat periode: ' + (err?.message ?? 'Unknown error'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mulai Periode Gaji Baru?</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">
            Gaji terdeteksi pada{' '}
            <strong>
              {new Date(transactionDate).toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </strong>
            . Beri nama periode ini:
          </p>
          <div className="space-y-1">
            <Label htmlFor="period-label">Label Periode</Label>
            <Input
              id="period-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Gaji Februari 2026"
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!label.trim() || createPeriod.isPending}
          >
            {createPeriod.isPending ? 'Menyimpan...' : 'Ya, Mulai Periode'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/PayPeriodConfirmDialog.tsx
git commit -m "feat: add PayPeriodConfirmDialog component"
```

---

## Task 5: Modifikasi TransactionDialog — Trigger Konfirmasi Gaji

**Files:**
- Modify: `src/components/TransactionDialog.tsx`

- [ ] **Step 1: Baca file**

Baca `src/components/TransactionDialog.tsx` sepenuhnya sebelum edit.

- [ ] **Step 2: Tambah helper suggestPeriodLabel**

Tambah fungsi ini di luar komponen, sebelum `export function TransactionDialog`:

```typescript
function suggestPeriodLabel(date: string): string {
  const d = new Date(date)
  d.setMonth(d.getMonth() + 1)   // Gaji Des → label Januari; Gaji Jan → label Februari
  const bulan = d.toLocaleString('id-ID', { month: 'long' })
  const tahun = d.getFullYear()
  return `Gaji ${bulan.charAt(0).toUpperCase() + bulan.slice(1)} ${tahun}`
}
```

- [ ] **Step 3: Tambah import**

Di bagian import atas file, tambah:

```typescript
import { PayPeriodConfirmDialog } from './PayPeriodConfirmDialog'
import { payPeriodExistsOnDate } from '../db/payPeriods'
```

- [ ] **Step 4: Tambah state baru di dalam komponen**

Di dalam komponen TransactionDialog, setelah deklarasi state yang sudah ada, tambah:

```typescript
const [showPeriodDialog, setShowPeriodDialog] = useState(false)
const [pendingGajiDate, setPendingGajiDate] = useState('')
const [suggestedPeriodLabel, setSuggestedPeriodLabel] = useState('')
```

- [ ] **Step 5: Modifikasi handleSubmit**

Temukan fungsi `handleSubmit`. Setelah baris `onOpenChange(false)` (setelah dialog transaksi ditutup), tambah blok deteksi Gaji berikut:

```typescript
// Deteksi: apakah kategori yang dipilih adalah "Gaji" (income)?
const selectedCat = categories.find((c) => c.id === Number(categoryId))
const isGaji =
  selectedCat?.name === 'Gaji' && selectedCat?.type === 'income' && !editing

if (isGaji) {
  const alreadyExists = await payPeriodExistsOnDate(date)
  if (!alreadyExists) {
    setPendingGajiDate(date)
    setSuggestedPeriodLabel(suggestPeriodLabel(date))
    setShowPeriodDialog(true)
  }
}
```

Catatan: `categories` sudah tersedia di scope komponen dari `useCategories(type)` yang ada. `date` adalah state tanggal yang sudah ada di komponen.

- [ ] **Step 6: Tambah PayPeriodConfirmDialog di JSX return**

Di JSX return, setelah closing tag `</Dialog>` yang sudah ada, tambah:

```typescript
<PayPeriodConfirmDialog
  open={showPeriodDialog}
  onOpenChange={setShowPeriodDialog}
  transactionDate={pendingGajiDate}
  suggestedLabel={suggestedPeriodLabel}
/>
```

- [ ] **Step 7: Test manual**

1. Buka app → tambah transaksi Pemasukan, kategori **Gaji** → simpan
   - Dialog "Mulai Periode Gaji Baru?" harus muncul
   - Label default harus berupa "Gaji [bulan+1] [tahun]"
   - Edit label → klik "Ya, Mulai Periode" → toast sukses muncul
   - Cek Supabase Dashboard → tabel `pay_periods` punya 1 record baru
2. Tambah transaksi Pemasukan, kategori **Insentif IKI** → simpan
   - Dialog **TIDAK** boleh muncul
3. Tambah transaksi Gaji kedua dengan **tanggal yang sama** → simpan
   - Dialog **TIDAK** boleh muncul (duplikat dicegah)

- [ ] **Step 8: Commit**

```bash
git add src/components/TransactionDialog.tsx
git commit -m "feat: trigger pay period dialog when Gaji transaction is saved"
```

---

## Task 6: Dashboard Card — `src/components/PayPeriodCard.tsx`

**Files:**
- Create: `src/components/PayPeriodCard.tsx`

- [ ] **Step 1: Cek lokasi `formatRupiah`**

Cari fungsi `formatRupiah` di codebase:

```bash
grep -r "formatRupiah" src/ --include="*.ts" --include="*.tsx" -l
```

Catat path file-nya untuk digunakan di import.

- [ ] **Step 2: Buat komponen**

Ganti `'../lib/utils'` di import dengan path aktual dari Step 1.

```typescript
import { usePayPeriodSummaries } from '../queries/payPeriods'
import { formatRupiah } from '../lib/utils'   // sesuaikan path jika berbeda

export function PayPeriodCard() {
  const { data: summaries, isLoading } = usePayPeriodSummaries()
  const current = summaries?.[0]

  if (isLoading || !current) return null

  const pct =
    current.total_income > 0
      ? Math.min(Math.round((current.total_expense / current.total_income) * 100), 100)
      : 0
  const isLow = current.total_income > 0 && current.remaining / current.total_income < 0.1

  const startLabel = new Date(current.start_date).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
  })
  const endLabel = current.end_date
    ? new Date(current.end_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
    : 'sekarang'

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div>
        <p className="text-sm font-medium">{current.label}</p>
        <p className="text-xs text-muted-foreground">
          {startLabel} – {endLabel}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Total Masuk</p>
          <p className="font-semibold">{formatRupiah(current.total_income)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Terpakai</p>
          <p className="font-semibold">{formatRupiah(current.total_expense)}</p>
        </div>
      </div>
      <div className="space-y-1">
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              isLow ? 'bg-red-500' : 'bg-primary'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">{pct}% terpakai</span>
          <span className={isLow ? 'text-red-500 font-medium' : ''}>
            Sisa {formatRupiah(current.remaining)}
          </span>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/PayPeriodCard.tsx
git commit -m "feat: add PayPeriodCard dashboard component"
```

---

## Task 7: Tambah PayPeriodCard ke DashboardTab

**Files:**
- Modify: `src/tabs/DashboardTab.tsx`

- [ ] **Step 1: Baca file**

Baca `src/tabs/DashboardTab.tsx` sepenuhnya.

- [ ] **Step 2: Tambah import**

```typescript
import { PayPeriodCard } from '../components/PayPeriodCard'
```

- [ ] **Step 3: Tambah card di JSX**

Di dalam JSX DashboardTab, tambah `<PayPeriodCard />` setelah section summary utama (Net Bulan Ini), sebelum section Investasi atau Goals. Posisi tepat disesuaikan dengan struktur yang ada:

```typescript
{/* Periode Gaji Aktif */}
<PayPeriodCard />
```

- [ ] **Step 4: Test manual**

1. Buka app → tab Dashboard
2. Jika ada `pay_period` → card "Gaji [label]" muncul dengan progress bar
3. Jika `remaining` < 10% dari `total_income` → progress bar dan teks sisa berwarna merah
4. Jika belum ada `pay_period` → card tidak tampil sama sekali

- [ ] **Step 5: Commit**

```bash
git add src/tabs/DashboardTab.tsx
git commit -m "feat: add PayPeriodCard to Dashboard"
```

---

## Task 8: Komponen Laporan — `PayPeriodDetail` dan `PayPeriodList`

**Files:**
- Create: `src/components/PayPeriodDetail.tsx`
- Create: `src/components/PayPeriodList.tsx`

- [ ] **Step 1: Buat PayPeriodDetail.tsx**

```typescript
import { PayPeriod } from '../db/payPeriods'
import { usePayPeriodTransactions } from '../queries/payPeriods'
import { formatRupiah } from '../lib/utils'   // sesuaikan path jika berbeda
import { Button } from './ui/button'

interface Props {
  period: PayPeriod
  endDate: string | null   // start_date periode lebih baru; null = periode aktif
  onBack: () => void
}

export function PayPeriodDetail({ period, endDate, onBack }: Props) {
  const { data: txs = [], isLoading } = usePayPeriodTransactions(period, endDate)

  const grouped = txs.reduce<Record<string, typeof txs>>((acc, tx) => {
    if (!acc[tx.date]) acc[tx.date] = []
    acc[tx.date].push(tx)
    return acc
  }, {})

  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}>
        ← Kembali
      </Button>
      <h3 className="font-semibold text-base">{period.label}</h3>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Memuat transaksi...</p>
      )}

      {sortedDates.map((date) => (
        <div key={date} className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            {new Date(date).toLocaleDateString('id-ID', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </p>
          {grouped[date].map((tx) => (
            <div
              key={tx.id}
              className="flex justify-between items-center py-1.5 border-b last:border-0"
            >
              <div>
                <p className="text-sm">{tx.category_name}</p>
                {tx.note && (
                  <p className="text-xs text-muted-foreground">{tx.note}</p>
                )}
              </div>
              <span
                className={`text-sm font-medium ${
                  tx.type === 'income' ? 'text-green-600' : ''
                }`}
              >
                {tx.type === 'income' ? '+' : '-'}
                {formatRupiah(tx.amount)}
              </span>
            </div>
          ))}
        </div>
      ))}

      {!isLoading && txs.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-10">
          Tidak ada transaksi dalam periode ini
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Buat PayPeriodList.tsx**

```typescript
import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { usePayPeriodSummaries } from '../queries/payPeriods'
import { PayPeriodSummary } from '../db/payPeriods'
import { PayPeriodDetail } from './PayPeriodDetail'
import { formatRupiah } from '../lib/utils'   // sesuaikan path jika berbeda

export function PayPeriodList() {
  const { data: summaries = [], isLoading } = usePayPeriodSummaries()
  const [selected, setSelected] = useState<PayPeriodSummary | null>(null)

  if (selected) {
    return (
      <PayPeriodDetail
        period={selected}
        endDate={selected.end_date}
        onBack={() => setSelected(null)}
      />
    )
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground p-4">Memuat...</p>
  }

  if (summaries.length === 0) {
    return (
      <div className="text-center py-14 space-y-2">
        <p className="text-sm font-medium">Belum ada periode gaji</p>
        <p className="text-xs text-muted-foreground">
          Catat transaksi dengan kategori &quot;Gaji&quot; untuk memulai periode pertama
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {summaries.map((s) => {
        const startLabel = new Date(s.start_date).toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'short',
        })
        const endLabel = s.end_date
          ? new Date(s.end_date).toLocaleDateString('id-ID', {
              day: 'numeric',
              month: 'short',
            })
          : 'sekarang'
        const isDeficit = s.remaining < 0

        return (
          <button
            key={s.id}
            onClick={() => setSelected(s)}
            className="w-full text-left rounded-lg border p-3 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="space-y-0.5 min-w-0">
                <p className="text-sm font-medium truncate">{s.label}</p>
                <p className="text-xs text-muted-foreground">
                  {startLabel} – {endLabel}
                </p>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs pt-1">
                  <span className="text-green-600">
                    Masuk {formatRupiah(s.total_income)}
                  </span>
                  <span className="text-muted-foreground">
                    Keluar {formatRupiah(s.total_expense)}
                  </span>
                  <span className={isDeficit ? 'text-red-500 font-medium' : ''}>
                    {isDeficit ? 'Defisit' : 'Sisa'}{' '}
                    {formatRupiah(Math.abs(s.remaining))}
                  </span>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </div>
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/PayPeriodDetail.tsx src/components/PayPeriodList.tsx
git commit -m "feat: add PayPeriodList and PayPeriodDetail components"
```

---

## Task 9: Tab "Periode Gaji" di Laporan

**Files:**
- Modify: `src/tabs/ReportsTab.tsx`

- [ ] **Step 1: Baca file**

Baca `src/tabs/ReportsTab.tsx` sepenuhnya.

- [ ] **Step 2: Tambah import**

```typescript
import { PayPeriodList } from '../components/PayPeriodList'
```

- [ ] **Step 3: Tambah tab trigger**

Di dalam komponen `<TabsList>` yang sudah ada, tambah trigger baru di akhir:

```typescript
<TabsTrigger value="periode-gaji">Periode Gaji</TabsTrigger>
```

- [ ] **Step 4: Tambah tab content**

Setelah `<TabsContent>` terakhir yang ada, tambah:

```typescript
<TabsContent value="periode-gaji" className="mt-4">
  <PayPeriodList />
</TabsContent>
```

- [ ] **Step 5: Test manual end-to-end**

1. Buka app → tab Laporan → tab **"Periode Gaji"** harus muncul
2. Jika ada periode → list tampil, tiap item menampilkan label, rentang tanggal, Masuk/Keluar/Sisa
3. Klik salah satu periode → `PayPeriodDetail` muncul dengan transaksi grouped by tanggal
4. Klik "← Kembali" → kembali ke list
5. Jika belum ada periode → empty state muncul dengan instruksi

- [ ] **Step 6: Commit**

```bash
git add src/tabs/ReportsTab.tsx   # atau LaporanTab.tsx sesuai nama aktual
git commit -m "feat: add Periode Gaji tab to Reports"
```

---

## Verification Checklist

Setelah semua task selesai, verifikasi skenario berikut:

- [ ] Input transaksi "Gaji" → dialog konfirmasi muncul dengan label auto-suggest "+1 bulan"
- [ ] Input transaksi "Insentif IKI" → dialog **tidak** muncul
- [ ] Input dua transaksi "Gaji" di tanggal yang sama → dialog hanya muncul sekali
- [ ] Backdate transaksi Gaji (set tanggal 5 hari lalu) → pengeluaran antara tanggal itu dan hari ini otomatis masuk periode baru di Dashboard
- [ ] Dashboard card periode aktif muncul dengan label, progress bar, angka sisa
- [ ] Progress bar & teks sisa merah jika sisa < 10% dari total masuk
- [ ] Belum ada periode → Dashboard card tidak tampil; tab Laporan tampilkan empty state
- [ ] Tab Laporan → Periode Gaji → list semua periode, terbaru di atas
- [ ] Klik periode → detail transaksi grouped by tanggal, income hijau, expense normal
- [ ] Insentif/Bonus dalam periode → terhitung di "Total Masuk" periode tersebut

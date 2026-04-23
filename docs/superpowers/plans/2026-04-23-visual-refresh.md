# Visual Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade pfm-web dari tampilan plain/bland menjadi Modern & Bold (Stripe/Vercel style) — brand indigo, header berkarakter, MetricCard informatif, toolbar rapi, mobile-friendly, empty states engaging.

**Architecture:** Visual refresh murni — tidak ada perubahan routing, data layer, atau logika bisnis. Semua perubahan di layer presentasi: CSS tokens, komponen UI baru (ConfirmDialog, EmptyState), dan redesign tiap tab secara incremental. Design tokens didefinisikan sekali di `index.css`, dipakai konsisten via Tailwind arbitrary values dan CSS vars.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, shadcn/ui (Radix), Lucide React, Zustand, Vite

---

## File Structure

**Baru:**
- `src/components/ui/confirm-dialog.tsx` — custom ConfirmDialog menggantikan `window.confirm()`
- `src/components/ui/empty-state.tsx` — reusable EmptyState component

**Dimodifikasi:**
- `src/index.css` — tambah brand design tokens (`--brand-*`)
- `src/lib/format.ts` — tambah `shortRupiah()` untuk MetricCard
- `src/App.tsx` — header dark gradient + tab nav underline + mobile scroll
- `src/tabs/DashboardTab.tsx` — MetricCard dengan border-top warna + trend badge
- `src/tabs/TransactionsTab.tsx` — toolbar 2 baris, badge pill, tooltip catatan, overflow-x
- `src/tabs/GoalsTab.tsx` — summary bar + card border-left polish
- `src/tabs/InvestmentsTab.tsx` — card view di mobile via Tailwind responsive
- `src/tabs/SettingsTab.tsx` — section icons Lucide, rencana polish, tema pill switcher
- `src/tabs/NotesTab.tsx` — minor spacing polish
- `src/tabs/ReportsTab.tsx` — minor spacing polish
- `src/tabs/PensiunTab.tsx` — minor spacing polish

---

## Task 1: Design Tokens + shortRupiah()

**Files:**
- Modify: `src/index.css`
- Modify: `src/lib/format.ts`

- [ ] **Step 1: Tambah brand tokens ke `src/index.css`**

Di dalam blok `@theme inline { ... }`, tambah setelah baris `--radius-4xl`:

```css
    /* Brand indigo */
    --color-brand: #6366f1;
    --color-brand-dark: #4f46e5;
    --color-brand-light: #ede9fe;
    --color-brand-muted: #a5b4fc;
    --color-brand-header: #1e1b4b;
    --color-brand-header-end: #312e81;
```

Di dalam blok `:root { ... }`, tambah setelah `--gold-text`:

```css
    /* Brand indigo tokens */
    --brand: #6366f1;
    --brand-dark: #4f46e5;
    --brand-light: #ede9fe;
    --brand-muted: #a5b4fc;
    --brand-header: #1e1b4b;
    --brand-header-end: #312e81;
```

Di dalam blok `.dark { ... }`, tambah setelah `--gold-text`:

```css
    /* Brand indigo tokens dark */
    --brand: #818cf8;
    --brand-dark: #6366f1;
    --brand-light: #2e1065;
    --brand-muted: #6366f1;
    --brand-header: #1e1b4b;
    --brand-header-end: #312e81;
```

- [ ] **Step 2: Tambah `shortRupiah()` ke `src/lib/format.ts`**

Tambah fungsi baru di akhir file:

```typescript
export function shortRupiah(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} M`
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} jt`
  if (abs >= 1_000) return `${(n / 1_000).toFixed(0)} rb`
  return formatRupiah(n)
}
```

- [ ] **Step 3: Verifikasi — jalankan dev server dan pastikan tidak ada error**

```bash
npm run dev
```

Buka browser, pastikan app muat normal. Tidak ada visual change di step ini.

- [ ] **Step 4: Commit**

```bash
git add src/index.css src/lib/format.ts
git commit -m "feat: tambah brand design tokens dan shortRupiah()"
```

---

## Task 2: ConfirmDialog Component

**Files:**
- Create: `src/components/ui/confirm-dialog.tsx`

- [ ] **Step 1: Buat `src/components/ui/confirm-dialog.tsx`**

```tsx
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'destructive' | 'default'
  onConfirm: () => void
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Hapus',
  cancelLabel = 'Batal',
  variant = 'destructive',
  onConfirm,
}: ConfirmDialogProps) {
  function handleConfirm() {
    onConfirm()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && (
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant === 'destructive' ? 'destructive' : 'default'}
            onClick={handleConfirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Verifikasi TypeScript compile**

```bash
npm run build 2>&1 | head -20
```

Expected: tidak ada TypeScript error untuk file baru ini.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/confirm-dialog.tsx
git commit -m "feat: tambah ConfirmDialog component"
```

---

## Task 3: EmptyState Component

**Files:**
- Create: `src/components/ui/empty-state.tsx`

- [ ] **Step 1: Buat `src/components/ui/empty-state.tsx`**

```tsx
import { Button } from '@/components/ui/button'
import { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  iconBg?: string
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({
  icon: Icon,
  iconBg = 'bg-[var(--brand-light)]',
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className={`flex h-14 w-14 items-center justify-center rounded-xl ${iconBg}`}>
        <Icon className="h-7 w-7 text-[var(--brand)]" />
      </div>
      <div className="font-semibold text-foreground">{title}</div>
      <p className="max-w-[220px] text-sm text-muted-foreground">{description}</p>
      {actionLabel && onAction && (
        <Button
          size="sm"
          className="mt-1 bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white"
          onClick={onAction}
        >
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verifikasi compile**

```bash
npm run build 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/empty-state.tsx
git commit -m "feat: tambah EmptyState component"
```

---

## Task 4: Header & Tab Navigasi

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Ganti seluruh return statement `App()` di `src/App.tsx`**

Ganti blok `return (` sampai akhir fungsi `App` dengan:

```tsx
  return (
    <div className="min-h-screen bg-background text-foreground">
      <OfflineBanner />
      <ViewAsBanner />

      {/* Header — selalu dark, tidak ikut tema */}
      <header
        className="flex items-center justify-between px-6 py-3"
        style={{ background: 'linear-gradient(135deg, var(--brand-header), var(--brand-header-end))' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #818cf8, #6366f1)' }}
          >
            ₱
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight text-white">PFM</div>
            <div className="text-[10px]" style={{ color: 'var(--brand-muted)' }}>Personal Finance</div>
          </div>
        </div>

        {/* Kanan: bulan + avatar */}
        <div className="flex items-center gap-3">
          <span
            className="hidden rounded-full px-3 py-1 text-[11px] sm:block"
            style={{ background: 'rgba(165,180,252,0.15)', color: 'var(--brand-muted)' }}
          >
            {new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
          </span>
          <AccountMenu />
        </div>
      </header>

      <main className="p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Tab list — scrollable horizontal di mobile */}
          <div className="mb-6 overflow-x-auto">
            <TabsList className="inline-flex w-max min-w-full rounded-none border-b border-border bg-transparent p-0">
              {TABS.map(({ value, label, icon: Icon }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="gap-1.5 whitespace-nowrap rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors data-[state=active]:border-[var(--brand)] data-[state=active]:text-[var(--brand)] data-[state=active]:shadow-none"
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

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
```

- [ ] **Step 2: Jalankan dev server dan verifikasi visual**

```bash
npm run dev
```

Cek:
- Header gelap indigo dengan logo "₱" dan teks "PFM" muncul
- Tab aktif bergaris bawah indigo (bukan pill background)
- Di mobile (resize browser ke <640px): tab dapat di-scroll horizontal, tidak wrap

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: redesign header dark gradient + tab nav underline scrollable"
```

---

## Task 5: Dashboard MetricCard Redesign

**Files:**
- Modify: `src/tabs/DashboardTab.tsx`

- [ ] **Step 1: Tambah import `shortRupiah` di bagian atas file**

Ubah baris import format:
```tsx
import { formatRupiah, todayISO, formatDateID, shortRupiah } from '@/lib/format'
```

- [ ] **Step 2: Tambah query trend bulan lalu**

Setelah baris `const monthStart = firstDayOfMonth()`, tambah:

```tsx
  const prevMonthStart = useMemo(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  }, [])

  const prevMonthEnd = useMemo(() => {
    const d = new Date()
    d.setDate(0) // hari terakhir bulan lalu
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, [])

  const { data: prevPeriodData = [] } = useAggregateByPeriod('month', prevMonthStart, prevMonthEnd)
```

- [ ] **Step 3: Tambah kalkulasi trend**

Setelah blok `const monthly = useMemo(...)`, tambah:

```tsx
  const prevMonthly = useMemo(() => {
    let income = 0; let expense = 0
    for (const p of prevPeriodData) { income += Number(p.income); expense += Number(p.expense) }
    return { income, expense }
  }, [prevPeriodData])

  function trendPct(curr: number, prev: number): number | null {
    if (prev === 0) return null
    return Math.round(((curr - prev) / prev) * 100)
  }
```

- [ ] **Step 4: Ganti komponen `MetricCard` dan grid di return statement**

Ganti blok `{/* Summary cards */}` beserta `<div className="grid grid-cols-2 ...">` dengan:

```tsx
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard
          label="Pemasukan"
          value={shortRupiah(monthly.income)}
          accentColor="#10b981"
          trend={trendPct(monthly.income, prevMonthly.income)}
          trendUp="good"
        />
        <MetricCard
          label="Pengeluaran"
          value={shortRupiah(monthly.expense)}
          accentColor="#ef4444"
          trend={trendPct(monthly.expense, prevMonthly.expense)}
          trendUp="bad"
        />
        <MetricCard
          label="Net Bulan Ini"
          value={shortRupiah(monthly.net)}
          gradient
          trend={null}
        />
        <MetricCard
          label="Nilai Investasi"
          value={shortRupiah(inv.totalNilai)}
          accentColor="#6366f1"
          sub={inv.totalModal > 0
            ? `${inv.gl >= 0 ? '+' : ''}${inv.pct.toFixed(1)}%`
            : undefined}
          trend={null}
        />
      </div>
```

- [ ] **Step 5: Ganti implementasi fungsi `MetricCard`**

Hapus `MetricCard` yang lama dan ganti dengan:

```tsx
function MetricCard({
  label,
  value,
  sub,
  accentColor,
  gradient,
  trend,
  trendUp,
}: {
  label: string
  value: string
  sub?: string
  accentColor?: string
  gradient?: boolean
  trend?: number | null
  trendUp?: 'good' | 'bad'
}) {
  if (gradient) {
    return (
      <div
        className="rounded-xl p-4 text-white"
        style={{ background: 'linear-gradient(135deg, #6366f1, #818cf8)' }}
      >
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-indigo-200">{label}</div>
        <div className="text-xl font-extrabold tracking-tight">{value}</div>
      </div>
    )
  }

  const trendPosIsGood = trendUp === 'good'
  const trendColor = trend == null ? '' :
    (trend >= 0 && trendPosIsGood) || (trend < 0 && !trendPosIsGood)
      ? 'bg-emerald-100 text-emerald-700'
      : 'bg-red-100 text-red-700'
  const trendArrow = trend == null ? '' : trend >= 0 ? '↑' : '↓'

  return (
    <div
      className="rounded-xl border bg-card p-4"
      style={accentColor ? { borderTop: `3px solid ${accentColor}` } : {}}
    >
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-xl font-extrabold tracking-tight text-foreground">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
      {trend != null && (
        <span className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${trendColor}`}>
          {trendArrow} {Math.abs(trend)}% vs bln lalu
        </span>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Verifikasi visual di browser**

```bash
npm run dev
```

Cek Dashboard:
- Kartu Pemasukan border-top hijau, Pengeluaran merah, Investasi indigo
- Kartu Net berwarna gradient indigo penuh
- Trend badge muncul di Pemasukan dan Pengeluaran
- Angka disingkat ("12,5 jt" bukan "Rp 12.500.000")

- [ ] **Step 7: Commit**

```bash
git add src/tabs/DashboardTab.tsx src/lib/format.ts
git commit -m "feat: redesign Dashboard MetricCard dengan trend badge dan shortRupiah"
```

---

## Task 6: TransactionsTab — Toolbar + Badge + Tabel

**Files:**
- Modify: `src/tabs/TransactionsTab.tsx`

- [ ] **Step 1: Ganti blok toolbar (filter + buttons) di return statement**

Cari blok `<div className="flex flex-wrap items-end gap-3">` sampai penutup `</div>` sebelum tabel, ganti dengan:

```tsx
      {/* Toolbar — filter baris 1, aksi baris 2 */}
      <div className="rounded-xl border border-[#e0e7ff] bg-card p-3">
        {/* Baris 1: Filter */}
        <div className="flex flex-wrap items-end gap-2 mb-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground self-center">Filter:</span>
          <div className="grid gap-0.5">
            <Label htmlFor="f-from" className="text-[10px]">Dari</Label>
            <Input id="f-from" type="date" value={filters.dateFrom ?? ''} onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value || undefined }))} className="h-7 w-36 text-xs" />
          </div>
          <div className="grid gap-0.5">
            <Label htmlFor="f-to" className="text-[10px]">Sampai</Label>
            <Input id="f-to" type="date" value={filters.dateTo ?? ''} onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value || undefined }))} className="h-7 w-36 text-xs" />
          </div>
          <div className="grid gap-0.5">
            <Label className="text-[10px]">Jenis</Label>
            <Select value={filters.type || ALL} onValueChange={(v) => setFilters((f) => ({ ...f, type: v === ALL ? '' : (v as 'income' | 'expense'), categoryId: null }))}>
              <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Semua</SelectItem>
                <SelectItem value="income">Pemasukan</SelectItem>
                <SelectItem value="expense">Pengeluaran</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-0.5">
            <Label className="text-[10px]">Kategori</Label>
            <Select value={filters.categoryId ? String(filters.categoryId) : ALL} onValueChange={(v) => setFilters((f) => ({ ...f, categoryId: v === ALL ? null : Number(v) }))}>
              <SelectTrigger className="h-7 w-40 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Semua</SelectItem>
                {filteredCategories.map((c) => (
                  <SelectItem key={`${c.type}-${c.id}`} value={String(c.id)}>{c.name} ({c.type === 'income' ? 'masuk' : 'keluar'})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Baris 2: Aksi */}
        <div className="flex items-center justify-between gap-2 border-t border-[#e0e7ff] pt-2">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-7 text-xs text-[var(--brand)] border-[#e0e7ff]" onClick={async () => {
              const csv = await exportTransactionsCsv()
              downloadCsv(`transactions-${todayISO()}.csv`, csv)
              toast.success('CSV diekspor')
            }}>
              <Download className="h-3 w-3" />Ekspor
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs text-[var(--brand)] border-[#e0e7ff]" onClick={async () => {
              const text = await pickCsvFile()
              if (!text) return
              try {
                const r = await importTransactionsCsv(text)
                if (r.inserted > 0) {
                  await qc.invalidateQueries({ queryKey: ['transactions'] })
                  toast.success(`${r.inserted} transaksi diimpor${r.skipped ? `, ${r.skipped} dilewati` : ''}`)
                }
                if (r.errors.length > 0) toast.error(`${r.errors.length} baris bermasalah. Contoh: baris ${r.errors[0].line} — ${r.errors[0].message}`)
              } catch (err) {
                toast.error(String(err instanceof Error ? err.message : err))
              }
            }}>
              <Upload className="h-3 w-3" />Impor
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs text-[var(--brand)] border-[#e0e7ff]" onClick={() => setRecurringOpen(true)}>
              <RefreshCw className="h-3 w-3" />Rutin
            </Button>
          </div>
          <Button size="sm" className="h-7 text-xs bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white" onClick={() => { setEditing(null); setDialogOpen(true) }}>
            <Plus className="h-3 w-3" />Tambah Transaksi
          </Button>
        </div>
      </div>
```

- [ ] **Step 2: Ganti summary cards menjadi strip compact**

Ganti blok `<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">` dengan:

```tsx
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard label="Pemasukan" value={formatRupiah(totals.income)} tone="income" />
        <SummaryCard label="Pengeluaran" value={formatRupiah(totals.expense)} tone="expense" />
        <SummaryCard label="Net" value={formatRupiah(totals.net)} tone={totals.net >= 0 ? 'income' : 'expense'} />
      </div>
```

- [ ] **Step 3: Ganti badge jenis transaksi di tabel — pill lembut**

Cari `<Badge variant={isIncome ? 'default' : 'destructive'} className="gap-1">` dan ganti baris itu beserta isinya dengan:

```tsx
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${isIncome ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                        {isIncome ? <ArrowUpCircle className="h-3 w-3" /> : <ArrowDownCircle className="h-3 w-3" />}
                        {isIncome ? 'Masuk' : 'Keluar'}
                      </span>
```

- [ ] **Step 4: Tambah overflow-x pada wrapper tabel + hilangkan kolom Catatan, ganti header uppercase**

Ganti `<div className="rounded-lg border">` sampai `</div>` penutup tabel dengan:

```tsx
      <div className="overflow-x-auto rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28 text-[10px] font-semibold uppercase tracking-wider">Tanggal</TableHead>
              <TableHead className="w-24 text-[10px] font-semibold uppercase tracking-wider">Jenis</TableHead>
              <TableHead className="text-[10px] font-semibold uppercase tracking-wider">Kategori</TableHead>
              <TableHead className="text-right text-[10px] font-semibold uppercase tracking-wider">Jumlah</TableHead>
              <TableHead className="hidden sm:table-cell text-[10px] font-semibold uppercase tracking-wider">Catatan</TableHead>
              <TableHead className="w-20 text-right text-[10px] font-semibold uppercase tracking-wider">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Memuat…</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Belum ada transaksi. Klik "Tambah Transaksi" untuk mulai.</TableCell></TableRow>
            ) : (
              rows.map((r) => {
                const isIncome = r.type === 'income'
                return (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">{formatDateID(r.date)}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${isIncome ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                        {isIncome ? <ArrowUpCircle className="h-3 w-3" /> : <ArrowDownCircle className="h-3 w-3" />}
                        {isIncome ? 'Masuk' : 'Keluar'}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">{r.category_name}</TableCell>
                    <TableCell className={`text-right font-semibold tabular-nums ${isIncome ? 'text-emerald-600' : 'text-red-600'}`}>
                      {isIncome ? '+' : '−'} {formatRupiah(r.amount)}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{r.note ?? ''}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(r); setDialogOpen(true) }}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => void onDelete(r.id)}><Trash2 className="h-3.5 w-3.5 text-red-500" /></Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
```

- [ ] **Step 5: Verifikasi visual**

```bash
npm run dev
```

Cek TransactionsTab:
- Filter di baris atas, tombol aksi di baris bawah dalam satu card
- Badge "Masuk"/"Keluar" berbentuk pill hijau/merah lembut
- Header tabel uppercase kecil
- Di mobile (<640px): kolom Catatan tersembunyi

- [ ] **Step 6: Commit**

```bash
git add src/tabs/TransactionsTab.tsx
git commit -m "feat: redesign TransactionsTab toolbar 2 baris, badge pill, tabel responsive"
```

---

## Task 7: GoalsTab — Summary Bar + Card Polish

**Files:**
- Modify: `src/tabs/GoalsTab.tsx`

- [ ] **Step 1: Tambah kalkulasi summary bar**

Di dalam fungsi `GoalsTab`, setelah deklarasi hooks (setelah `const deleteGoal = useDeleteGoal()`), tambah:

```tsx
  const activeGoals = goals.filter((g) => g.status === 'active')
  const totalCollected = activeGoals.reduce((sum, g) => {
    const linked = allAllocs.filter((a) => a.goal_id === g.id)
    const invested = linked.reduce((s, a) => {
      const inv = investments.find((i) => i.id === a.investment_id)
      return s + (inv ? currentValue(inv) * a.allocation_pct / 100 : 0)
    }, 0)
    return sum + g.current_amount + invested
  }, 0)
  const totalTarget = activeGoals.reduce((sum, g) => sum + g.target_amount, 0)
  const totalPct = totalTarget > 0 ? Math.min(100, (totalCollected / totalTarget) * 100) : 0
```

- [ ] **Step 2: Tambah import `formatRupiah` dan `Progress` jika belum**

Pastikan baris import sudah mencakup:
```tsx
import { formatRupiah, formatDateID } from '@/lib/format'
import { Progress } from '@/components/ui/progress'
```

- [ ] **Step 3: Tambah summary bar di return statement, sebelum filter row**

Setelah `<div className="space-y-6">`, tambah sebelum `<div className="flex flex-wrap ...">`:

```tsx
      {/* Summary bar — hanya tampil jika ada goal aktif */}
      {activeGoals.length > 0 && (
        <div
          className="rounded-xl p-4 text-white"
          style={{ background: 'linear-gradient(135deg, #1e1b4b, #312e81)' }}
        >
          <div className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-indigo-300">
            Ringkasan Goals Aktif
          </div>
          <div className="flex items-end justify-between">
            <div>
              <div className="text-2xl font-extrabold tracking-tight">{formatRupiah(totalCollected)}</div>
              <div className="text-xs text-indigo-300">dari {formatRupiah(totalTarget)} target total</div>
            </div>
            <div className="text-right">
              <div className="text-xl font-bold text-indigo-200">{totalPct.toFixed(0)}%</div>
              <div className="text-xs text-indigo-300">{activeGoals.length} goals aktif</div>
            </div>
          </div>
          <div className="mt-3 h-1.5 rounded-full bg-white/10">
            <div
              className="h-1.5 rounded-full bg-indigo-400 transition-all"
              style={{ width: `${totalPct}%` }}
            />
          </div>
        </div>
      )}
```

- [ ] **Step 4: Update goal card — border-left, badge pill, progress warna indigo**

Cari `<div key={g.id} className="rounded-lg border bg-card p-5">` dan ganti dengan:

```tsx
              <div key={g.id} className="rounded-xl border bg-card p-4" style={{ borderLeft: '4px solid var(--brand)' }}>
```

Cari komponen `<StatusBadge status={g.status} />` dan ganti fungsi `StatusBadge` di bawah file:

```tsx
function StatusBadge({ status }: { status: Goal['status'] }) {
  if (status === 'completed') return <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700">Tercapai</span>
  if (status === 'paused') return <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[10px] font-semibold text-gray-600">Jeda</span>
  return <span className="rounded-full bg-[var(--brand-light)] px-2.5 py-0.5 text-[10px] font-semibold text-[var(--brand)]">Aktif</span>
}
```

- [ ] **Step 5: Verifikasi visual**

```bash
npm run dev
```

Cek GoalsTab:
- Summary bar gradient indigo muncul di atas (jika ada goals aktif)
- Goal card border-left indigo
- Badge status berbentuk pill lembut

- [ ] **Step 6: Commit**

```bash
git add src/tabs/GoalsTab.tsx
git commit -m "feat: GoalsTab summary bar + card border-left + badge pill"
```

---

## Task 8: InvestmentsTab — Card View Mobile

**Files:**
- Modify: `src/tabs/InvestmentsTab.tsx`

- [ ] **Step 1: Ganti wrapper tabel dengan struktur desktop/mobile**

Cari `<div className="rounded-lg border">` sampai `</div>` penutup tabel investasi. Ganti dengan:

```tsx
      {/* Desktop: tabel normal */}
      <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[10px] font-semibold uppercase tracking-wider">Jenis</TableHead>
              <TableHead className="text-[10px] font-semibold uppercase tracking-wider">Nama</TableHead>
              <TableHead className="text-right text-[10px] font-semibold uppercase tracking-wider">Qty</TableHead>
              <TableHead className="text-right text-[10px] font-semibold uppercase tracking-wider">H.Beli</TableHead>
              <TableHead className="text-right text-[10px] font-semibold uppercase tracking-wider">H.Kini</TableHead>
              <TableHead className="text-right text-[10px] font-semibold uppercase tracking-wider">Modal</TableHead>
              <TableHead className="text-right text-[10px] font-semibold uppercase tracking-wider">Nilai</TableHead>
              <TableHead className="text-right text-[10px] font-semibold uppercase tracking-wider">G/L</TableHead>
              <TableHead className="w-28 text-[10px] font-semibold uppercase tracking-wider">Tgl Beli</TableHead>
              <TableHead className="w-28 text-right text-[10px] font-semibold uppercase tracking-wider">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={10} className="py-8 text-center text-muted-foreground">Memuat…</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={10} className="py-8 text-center text-muted-foreground">Belum ada investasi.</TableCell></TableRow>
            ) : (
              rows.map((r) => {
                const gl = gainLoss(r)
                const pct = gainLossPercent(r)
                const tone = gl >= 0 ? 'text-emerald-600' : 'text-red-600'
                return (
                  <TableRow key={r.id}>
                    <TableCell><span className="rounded-full bg-[var(--brand-light)] px-2 py-0.5 text-[10px] font-semibold text-[var(--brand)]">{r.asset_type}</span></TableCell>
                    <TableCell className="font-medium">{r.asset_name}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.quantity}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatRupiah(r.buy_price)}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.current_price != null ? formatRupiah(r.current_price) : '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatRupiah(costBasis(r))}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatRupiah(currentValue(r))}</TableCell>
                    <TableCell className={`text-right font-semibold ${tone}`}>
                      {gl >= 0 ? '+' : '−'} {formatRupiah(Math.abs(gl))}
                      <div className="text-xs font-normal">{pct >= 0 ? '+' : ''}{pct.toFixed(2)}%</div>
                    </TableCell>
                    <TableCell>{formatDateID(r.buy_date)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Update harga" onClick={() => { setPriceFor(r); setPriceOpen(true) }}><TrendingUp className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit" onClick={() => { setEditing(r); setDialogOpen(true) }}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Hapus" onClick={() => onDelete(r)}><Trash2 className="h-3.5 w-3.5 text-red-500" /></Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile: card per aset */}
      <div className="grid gap-3 md:hidden">
        {isLoading ? (
          <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">Memuat…</div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">Belum ada investasi.</div>
        ) : (
          rows.map((r) => {
            const gl = gainLoss(r)
            const pct = gainLossPercent(r)
            const isUp = gl >= 0
            return (
              <div key={r.id} className="rounded-xl border bg-card p-4" style={{ borderLeft: '4px solid var(--brand)' }}>
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <span className="mb-1 inline-block rounded-full bg-[var(--brand-light)] px-2 py-0.5 text-[10px] font-semibold text-[var(--brand)]">{r.asset_type}</span>
                    <div className="text-base font-bold">{r.asset_name}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{formatRupiah(currentValue(r))}</div>
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${isUp ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {isUp ? '↑' : '↓'} {pct.toFixed(2)}%
                    </span>
                  </div>
                </div>
                <div className="mb-3 grid grid-cols-3 gap-2">
                  {[
                    { label: 'QTY', value: String(r.quantity) },
                    { label: 'H.BELI', value: formatRupiah(r.buy_price) },
                    { label: 'H.KINI', value: r.current_price != null ? formatRupiah(r.current_price) : '—' },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-lg bg-muted/40 p-2">
                      <div className="text-[9px] font-semibold uppercase text-muted-foreground">{label}</div>
                      <div className="truncate text-xs font-semibold">{value}</div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end gap-1.5">
                  <Button variant="outline" size="sm" className="h-7 text-xs border-[#e0e7ff] text-[var(--brand)]" onClick={() => { setPriceFor(r); setPriceOpen(true) }}>
                    <TrendingUp className="h-3 w-3" />Update Harga
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(r); setDialogOpen(true) }}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDelete(r)}><Trash2 className="h-3.5 w-3.5 text-red-500" /></Button>
                </div>
              </div>
            )
          })
        )}
      </div>
```

- [ ] **Step 2: Verifikasi visual**

```bash
npm run dev
```

Cek InvestmentsTab:
- Di desktop (≥768px): tabel normal dengan header uppercase
- Di mobile (<768px): card per aset dengan info terkondensasi

- [ ] **Step 3: Commit**

```bash
git add src/tabs/InvestmentsTab.tsx
git commit -m "feat: InvestmentsTab card view di mobile, tabel di desktop"
```

---

## Task 9: SettingsTab Polish

**Files:**
- Modify: `src/tabs/SettingsTab.tsx`

- [ ] **Step 1: Tambah import Lucide icons untuk section headers**

Cari baris import `lucide-react` yang sudah ada:
```tsx
import { BookOpen, Eye, Info, LogOut, Users } from 'lucide-react'
```

Ganti dengan:
```tsx
import { BookOpen, Eye, HelpCircle, LogOut, Palette, Target, User, Users } from 'lucide-react'
```

- [ ] **Step 2: Buat helper `SectionHeader` di bawah file (sebelum export default)**

Tambah sebelum `export default function SettingsTab()`:

```tsx
function SectionHeader({ icon: Icon, label, iconBg }: { icon: React.ElementType; label: string; iconBg: string }) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${iconBg}`}>
        <Icon className="h-4 w-4 text-foreground/70" />
      </div>
      <h2 className="text-base font-bold">{label}</h2>
    </div>
  )
}
```

- [ ] **Step 3: Ganti semua `<h2 className="mb-3 text-lg font-semibold">` dengan `SectionHeader`**

Tampilan:
```tsx
<SectionHeader icon={Palette} label="Tampilan" iconBg="bg-[#ede9fe]" />
```

Rencana:
```tsx
<SectionHeader icon={Target} label="Rencana" iconBg="bg-[#fef3c7]" />
```

Akun:
```tsx
<SectionHeader icon={User} label="Akun" iconBg="bg-[#dcfce7]" />
```

Manajemen Pengguna (section admin):
```tsx
<SectionHeader icon={Users} label="Manajemen Pengguna" iconBg="bg-[#e0f2fe]" />
```

Bantuan:
```tsx
<SectionHeader icon={HelpCircle} label="Bantuan" iconBg="bg-[#fef9c3]" />
```

- [ ] **Step 4: Ganti dropdown tema dengan 3 pill button**

Cari blok `<div className="grid max-w-sm gap-2">` sampai `</div>` penutupnya, ganti dengan:

```tsx
        <div className="flex gap-2">
          {(['light', 'dark', 'system'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
                theme === t
                  ? 'border-[var(--brand)] text-[var(--brand)] bg-[var(--brand-light)]'
                  : 'border-border text-muted-foreground hover:border-[var(--brand-muted)]'
              }`}
            >
              {t === 'light' ? '☀️ Terang' : t === 'dark' ? '🌙 Gelap' : '💻 Sistem'}
            </button>
          ))}
        </div>
```

- [ ] **Step 5: Update card akun — avatar gradient, tombol Keluar merah lembut**

Cari div card akun `<div className="rounded-lg border bg-card p-4">` dan ganti isinya:

```tsx
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {user?.user_metadata?.avatar_url ? (
                <img src={user.user_metadata.avatar_url} alt="avatar" className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, #818cf8, #6366f1)' }}
                >
                  {(user?.user_metadata?.full_name ?? user?.email ?? '?')[0].toUpperCase()}
                </div>
              )}
              <div>
                <div className="font-semibold">{user?.user_metadata?.full_name ?? '—'}</div>
                <div className="text-sm text-muted-foreground">{user?.email}</div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={async () => {
                if (!confirm('Keluar dari aplikasi?')) return
                await signOut()
              }}
            >
              <LogOut className="h-3.5 w-3.5" />Keluar
            </Button>
          </div>
```

Hapus tombol Keluar terpisah di bawah (`<div className="mt-3">...`).

- [ ] **Step 6: Update section Rencana — spacing + border konsisten**

Cari `<div className="rounded-lg border bg-card p-4 space-y-3">` di section Rencana dan ganti `rounded-lg` dengan `rounded-xl` dan tambah `border-[#e0e7ff]`.

- [ ] **Step 7: Verifikasi visual**

```bash
npm run dev
```

Cek SettingsTab:
- Section header punya ikon berwarna di kotak rounded
- Tema switcher: 3 pill button (bukan dropdown)
- Akun card: avatar gradient indigo, tombol Keluar inline merah lembut

- [ ] **Step 8: Commit**

```bash
git add src/tabs/SettingsTab.tsx
git commit -m "feat: SettingsTab section icons, tema pill switcher, akun card polish"
```

---

## Task 10: Ganti Semua `window.confirm()` dengan ConfirmDialog

**Files:**
- Modify: `src/tabs/TransactionsTab.tsx`
- Modify: `src/tabs/InvestmentsTab.tsx`
- Modify: `src/tabs/GoalsTab.tsx`
- Modify: `src/tabs/NotesTab.tsx`
- Modify: `src/tabs/SettingsTab.tsx`

- [ ] **Step 1: Update `TransactionsTab.tsx`**

Tambah import:
```tsx
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
```

Tambah state di dalam fungsi:
```tsx
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmId, setConfirmId] = useState<number | null>(null)
```

Ganti fungsi `onDelete`:
```tsx
  function onDelete(id: number) {
    setConfirmId(id)
    setConfirmOpen(true)
  }
```

Tambah sebelum `<TransactionDialog ...>`:
```tsx
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Hapus Transaksi"
        description="Transaksi ini akan dihapus permanen. Tindakan ini tidak dapat dibatalkan."
        onConfirm={() => { if (confirmId != null) deleteTransaction.mutate(confirmId) }}
      />
```

- [ ] **Step 2: Update `InvestmentsTab.tsx`**

Tambah import:
```tsx
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
```

Tambah state:
```tsx
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmInv, setConfirmInv] = useState<Investment | null>(null)
```

Ganti fungsi `onDelete`:
```tsx
  function onDelete(inv: Investment) {
    setConfirmInv(inv)
    setConfirmOpen(true)
  }
```

Tambah sebelum `<InvestmentDialog ...>`:
```tsx
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Hapus "${confirmInv?.asset_name ?? ''}"`}
        description="Investasi dan riwayat harganya akan dihapus permanen."
        onConfirm={() => { if (confirmInv) deleteInvestment.mutate(confirmInv.id) }}
      />
```

- [ ] **Step 3: Update `GoalsTab.tsx`**

Tambah import:
```tsx
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
```

Tambah state:
```tsx
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmGoal, setConfirmGoal] = useState<Goal | null>(null)
```

Ganti fungsi `onDelete`:
```tsx
  function onDelete(g: Goal) {
    setConfirmGoal(g)
    setConfirmOpen(true)
  }
```

Tambah sebelum `<GoalDialog ...>`:
```tsx
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Hapus "${confirmGoal?.name ?? ''}"`}
        description="Goal ini akan dihapus permanen."
        onConfirm={() => { if (confirmGoal) deleteGoal.mutate(confirmGoal.id) }}
      />
```

- [ ] **Step 4: Update `NotesTab.tsx`**

Tambah import:
```tsx
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
```

Tambah state:
```tsx
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmNote, setConfirmNote] = useState<Note | null>(null)
```

Ganti fungsi `onDelete`:
```tsx
  function onDelete(n: Note) {
    setConfirmNote(n)
    setConfirmOpen(true)
  }
```

Tambah sebelum `<NoteDialog ...>`:
```tsx
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Hapus "${confirmNote?.title ?? ''}"`}
        description="Catatan ini akan dihapus permanen."
        onConfirm={() => { if (confirmNote) deleteNote.mutate(confirmNote.id) }}
      />
```

- [ ] **Step 5: Update `SettingsTab.tsx` — tombol hapus email + keluar**

Ganti `if (!confirm('Keluar dari aplikasi?')) return` di tombol Keluar dengan ConfirmDialog terpisah (tambah state `logoutConfirmOpen`):

```tsx
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
```

Tombol Keluar menjadi:
```tsx
              onClick={() => setLogoutConfirmOpen(true)}
```

Tambah di akhir return sebelum `</div>` penutup:
```tsx
      <ConfirmDialog
        open={logoutConfirmOpen}
        onOpenChange={setLogoutConfirmOpen}
        title="Keluar dari aplikasi?"
        description="Anda akan keluar dari sesi ini."
        confirmLabel="Keluar"
        onConfirm={async () => { await signOut() }}
      />
```

- [ ] **Step 6: Verifikasi — semua hapus pakai dialog branded**

```bash
npm run dev
```

Coba hapus satu transaksi — dialog konfirmasi branded harus muncul (bukan native browser alert).

- [ ] **Step 7: Commit**

```bash
git add src/tabs/TransactionsTab.tsx src/tabs/InvestmentsTab.tsx src/tabs/GoalsTab.tsx src/tabs/NotesTab.tsx src/tabs/SettingsTab.tsx
git commit -m "feat: ganti semua window.confirm() dengan ConfirmDialog branded"
```

---

## Task 11: Apply EmptyState ke Semua Tab

**Files:**
- Modify: `src/tabs/TransactionsTab.tsx`
- Modify: `src/tabs/InvestmentsTab.tsx`
- Modify: `src/tabs/GoalsTab.tsx`
- Modify: `src/tabs/NotesTab.tsx`

- [ ] **Step 1: TransactionsTab — ganti empty row tabel**

Tambah import:
```tsx
import { EmptyState } from '@/components/ui/empty-state'
import { Wallet } from 'lucide-react'
```

Ganti baris `<TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Belum ada transaksi...` dengan:
```tsx
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <EmptyState
                    icon={Wallet}
                    title="Belum ada transaksi"
                    description="Catat pemasukan dan pengeluaran pertama Anda untuk mulai melacak keuangan."
                    actionLabel="+ Tambah Transaksi"
                    onAction={() => { setEditing(null); setDialogOpen(true) }}
                  />
                </TableCell>
              </TableRow>
```

- [ ] **Step 2: InvestmentsTab — ganti empty state di tabel dan card mobile**

Tambah import:
```tsx
import { EmptyState } from '@/components/ui/empty-state'
import { TrendingUp as TrendingUpIcon } from 'lucide-react'
```

Di tabel desktop, ganti `<TableRow><TableCell colSpan={10} className="py-8 text-center ...">Belum ada investasi.`:
```tsx
              <TableRow>
                <TableCell colSpan={10}>
                  <EmptyState
                    icon={TrendingUpIcon}
                    title="Belum ada investasi"
                    description="Tambahkan aset pertama Anda untuk mulai memantau portofolio."
                    actionLabel="+ Tambah Investasi"
                    onAction={() => { setEditing(null); setDialogOpen(true) }}
                  />
                </TableCell>
              </TableRow>
```

Di card mobile, ganti `<div className="rounded-xl border bg-card p-8 text-center ...">Belum ada investasi.`:
```tsx
          <EmptyState
            icon={TrendingUpIcon}
            title="Belum ada investasi"
            description="Tambahkan aset pertama Anda untuk mulai memantau portofolio."
            actionLabel="+ Tambah Investasi"
            onAction={() => { setEditing(null); setDialogOpen(true) }}
          />
```

- [ ] **Step 3: GoalsTab — ganti empty state**

Tambah import:
```tsx
import { EmptyState } from '@/components/ui/empty-state'
import { Target } from 'lucide-react'
```

Ganti `<div className="rounded-lg border bg-card p-12 text-center text-muted-foreground">Belum ada goal...`:
```tsx
        <EmptyState
          icon={Target}
          title="Belum ada goal"
          description="Tetapkan target keuangan Anda dan pantau progresnya dari sini."
          actionLabel="+ Buat Goal Pertama"
          onAction={() => { setEditing(null); setDialogOpen(true) }}
        />
```

- [ ] **Step 4: NotesTab — ganti empty state**

Tambah import:
```tsx
import { EmptyState } from '@/components/ui/empty-state'
import { StickyNote } from 'lucide-react'
```

Ganti `<div className="rounded-lg border bg-card p-12 text-center text-muted-foreground">Belum ada catatan...`:
```tsx
        <EmptyState
          icon={StickyNote}
          title="Belum ada catatan"
          description="Simpan pemikiran atau reminder terkait keuangan Anda."
          actionLabel="+ Tambah Catatan"
          onAction={() => { setEditing(null); setDialogOpen(true) }}
        />
```

- [ ] **Step 5: Verifikasi**

```bash
npm run dev
```

Buat akun baru atau hapus semua data satu tab — empty state dengan ikon dan CTA harus muncul.

- [ ] **Step 6: Commit**

```bash
git add src/tabs/TransactionsTab.tsx src/tabs/InvestmentsTab.tsx src/tabs/GoalsTab.tsx src/tabs/NotesTab.tsx
git commit -m "feat: apply EmptyState component ke semua tab"
```

---

## Task 12: Minor Polish — Catatan, Laporan, Pensiun

**Files:**
- Modify: `src/tabs/NotesTab.tsx`
- Modify: `src/tabs/ReportsTab.tsx`
- Modify: `src/tabs/PensiunTab.tsx`

- [ ] **Step 1: NotesTab — `rounded-lg` → `rounded-xl`, border warna konsisten**

Di `NotesTab.tsx`, ganti semua `rounded-lg border bg-card` dengan `rounded-xl border bg-card`.

- [ ] **Step 2: ReportsTab — panel header uppercase, rounded-xl**

Di `ReportsTab.tsx`:
- Ganti semua `rounded-lg border bg-card p-5` dengan `rounded-xl border bg-card p-5`
- Di fungsi `Panel`, ganti `<h3 className="mb-4 text-sm font-semibold">` dengan `<h3 className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">`

- [ ] **Step 3: PensiunTab — spacing konsisten**

Di `PensiunTab.tsx`, ganti `<div className="space-y-4">` dengan `<div className="space-y-6">`.

- [ ] **Step 4: Verifikasi akhir — semua tab**

```bash
npm run dev
```

Klik semua 8 tab, pastikan:
- Tidak ada error di console
- Visual konsisten (rounded-xl, spacing, warna)
- Mobile: resize browser ke <640px, semua tab masih terbaca

- [ ] **Step 5: Final commit**

```bash
git add src/tabs/NotesTab.tsx src/tabs/ReportsTab.tsx src/tabs/PensiunTab.tsx
git commit -m "feat: minor visual polish Catatan, Laporan, Pensiun — spacing dan radius konsisten"
```

---

## Checklist Spec Coverage

| Spec Section | Task |
|---|---|
| Design tokens brand indigo | Task 1 |
| shortRupiah() | Task 1 |
| Header dark gradient + logo | Task 4 |
| Tab nav underline + mobile scroll | Task 4 |
| MetricCard border-top + trend badge | Task 5 |
| Toolbar Transaksi 2 baris | Task 6 |
| Badge pill lembut | Task 6 |
| Tabel responsive + kolom Catatan hidden mobile | Task 6 |
| Goals summary bar | Task 7 |
| Goal card border-left + badge | Task 7 |
| InvestmentsTab card mobile | Task 8 |
| SettingsTab section icons Lucide | Task 9 |
| SettingsTab tema pill switcher | Task 9 |
| SettingsTab Rencana polish | Task 9 |
| SettingsTab akun card + avatar | Task 9 |
| ConfirmDialog ganti confirm() | Task 10 |
| EmptyState global | Task 11 |
| Polish Catatan/Laporan/Pensiun | Task 12 |

# Manajemen Manual Periode Gaji Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Jadikan halaman `/periode-gaji` single source of truth untuk pembuatan, rename, dan hapus periode gaji. Hapus auto-trigger dialog konfirmasi periode dari `TransactionDialog`.

**Architecture:** Tidak ada perubahan schema DB — model "periode = window mulai dari `start_date`" tetap dipakai. Tambah operasi UPDATE & DELETE pada tabel existing, tambah dialog form shared (mode create/rename), tambah header agregat di list view. Hapus side-effect creation dari TransactionDialog. Konfirmasi hapus berbeda copy-nya tergantung posisi periode (paling lama vs tengah/aktif) karena efek window-nya berbeda.

**Tech Stack:** React 19, TypeScript, Supabase (PostgreSQL + RLS), TanStack Query v5, Radix UI Dialog/AlertDialog, Tailwind CSS, Lucide React icons, Sonner toast

**Spec:** `docs/superpowers/specs/2026-05-07-periode-gaji-manual-management-design.md`

**Catatan testing:** Project ini tidak punya test suite otomatis untuk komponen UI (verified — `**/*.test.ts` hanya hit `node_modules`). Verifikasi gate yang dipakai: `npm run check` (TypeScript) + manual UAT script di Task 8. Pattern ini konsisten dengan plan-plan sebelumnya di repo.

---

## File Map

| File | Action | Tanggung Jawab |
|---|---|---|
| `src/components/TransactionDialog.tsx` | Modify | Hapus import + state + logic auto-trigger PayPeriodConfirmDialog |
| `src/db/payPeriods.ts` | Modify | Tambah `updatePayPeriod`, `deletePayPeriod`, `countTransactionsInWindow` |
| `src/queries/payPeriods.ts` | Modify | Tambah `useUpdatePayPeriod`, `useDeletePayPeriod`, `usePayPeriodTransactionCount` |
| `src/components/PayPeriodFormDialog.tsx` | Create | Dialog shared mode `create` & `rename` |
| `src/components/PayPeriodList.tsx` | Modify | Header (judul + tombol "+ Periode Baru" + 2 angka agregat); state untuk dialog create |
| `src/components/PayPeriodDetail.tsx` | Modify | Tombol Rename + Hapus di header; alert konfirmasi hapus dengan copy berbeda |
| `src/components/PayPeriodConfirmDialog.tsx` | Delete | Diganti `PayPeriodFormDialog.tsx` |

---

## Task 1: Lepas Auto-trigger di TransactionDialog

**Files:**
- Modify: `src/components/TransactionDialog.tsx`

Goal: Setelah task ini, input transaksi income kategori "Gaji" jadi transaksi biasa. Tidak ada dialog konfirmasi periode yang muncul. Tidak ada perubahan ke `/periode-gaji` page yet — itu tetap read-only seperti sekarang. Project harus tetap compile.

- [ ] **Step 1: Hapus import & helper yang tidak dipakai**

Edit `src/components/TransactionDialog.tsx`. Hapus baris 2-3:

```tsx
// HAPUS:
import { PayPeriodConfirmDialog } from '@/components/PayPeriodConfirmDialog'
import { payPeriodExistsOnDate } from '@/db/payPeriods'
```

Hapus juga function `suggestPeriodLabel` (baris 35-41) — sudah tidak dipakai.

- [ ] **Step 2: Hapus state Pay Period dari component**

Hapus 3 baris state ini di body `TransactionDialog` (baris 49-51):

```tsx
// HAPUS:
const [showPeriodDialog, setShowPeriodDialog] = useState(false)
const [pendingGajiDate, setPendingGajiDate] = useState('')
const [suggestedPeriodLabel, setSuggestedPeriodLabel] = useState('')
```

- [ ] **Step 3: Hapus blok deteksi Gaji di handleSubmit**

Di function `handleSubmit`, hapus baris 101-111:

```tsx
// HAPUS:
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

`onOpenChange(false)` di baris 99 tetap dipertahankan.

- [ ] **Step 4: Hapus render `<PayPeriodConfirmDialog />` & fragment wrapper**

Di JSX return, hapus:

```tsx
// HAPUS (baris ~175-180):
<PayPeriodConfirmDialog
  open={showPeriodDialog}
  onOpenChange={setShowPeriodDialog}
  transactionDate={pendingGajiDate}
  suggestedLabel={suggestedPeriodLabel}
/>
```

Karena `<PayPeriodConfirmDialog />` adalah satu-satunya alasan kenapa ada fragment `<>...</>` membungkus `<Dialog>`, hapus juga fragment-nya. Result akhir return JSX harus return langsung `<Dialog>...</Dialog>` tanpa fragment wrapper.

Final shape:

```tsx
return (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-md">
      <form onSubmit={handleSubmit}>
        {/* ... existing form body, tidak diubah ... */}
      </form>
    </DialogContent>
  </Dialog>
)
```

- [ ] **Step 5: TypeScript check**

Run: `npm run check`
Expected: PASS, tidak ada error.

Kalau ada error "useEffect imported but not used" atau sejenisnya, bersihkan import di baris 1.

- [ ] **Step 6: Manual smoke test**

Jalankan dev server: `npm run dev`. Buka aplikasi, login, buka halaman Transaksi → klik tombol Tambah → pilih Pemasukan → Gaji → tanggal hari ini → jumlah → submit. **Verifikasi**: transaksi tersimpan, **tidak ada dialog konfirmasi periode** yang muncul. Halaman /periode-gaji tetap menampilkan list periode lama tanpa perubahan.

- [ ] **Step 7: Commit**

```bash
git add src/components/TransactionDialog.tsx
git commit -m "refactor(transactions): lepas auto-trigger PayPeriodConfirmDialog dari TransactionDialog"
```

---

## Task 2: Tambah DB Functions untuk Update, Delete, Count

**Files:**
- Modify: `src/db/payPeriods.ts`

Goal: Tambah 3 fungsi: `updatePayPeriod`, `deletePayPeriod`, `countTransactionsInWindow`. Belum ada UI yang konsumsi — pure addition.

- [ ] **Step 1: Tambah `updatePayPeriod`**

Tambah di `src/db/payPeriods.ts` (setelah `createPayPeriod`):

```ts
export async function updatePayPeriod(
  id: number,
  input: { label: string },
): Promise<PayPeriod> {
  const { data, error } = await supabase
    .from('pay_periods')
    .update({ label: input.label })
    .eq('id', id)
    .select('id, user_id, label, start_date, created_at')
    .single()
  if (error) throw error
  return data as PayPeriod
}
```

Catatan: tidak update `start_date` — geser tanggal di luar scope (lihat spec section 7).

- [ ] **Step 2: Tambah `deletePayPeriod`**

Tambah:

```ts
export async function deletePayPeriod(id: number): Promise<void> {
  const { error } = await supabase
    .from('pay_periods')
    .delete()
    .eq('id', id)
  if (error) throw error
}
```

- [ ] **Step 3: Tambah `countTransactionsInWindow`**

Tambah:

```ts
export async function countTransactionsInWindow(
  startDate: string,
  endDate: string | null,
): Promise<number> {
  let query = supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .gte('date', startDate)
  if (endDate) {
    query = query.lt('date', endDate)
  }
  const { count, error } = await query
  if (error) throw error
  return count ?? 0
}
```

Catatan teknis: pakai `lt` (strictly less than) untuk `endDate` karena window periode adalah `[start_date, end_date)` — exclusive end. RLS filter ke user_id otomatis di-apply via Supabase policy.

- [ ] **Step 4: TypeScript check**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/db/payPeriods.ts
git commit -m "feat(payPeriods): tambah update, delete, dan count transactions helpers"
```

---

## Task 3: Tambah React Query Hooks

**Files:**
- Modify: `src/queries/payPeriods.ts`

Goal: Wrap fungsi DB baru jadi mutation/query hooks dengan invalidation yang benar.

- [ ] **Step 1: Update import**

Di `src/queries/payPeriods.ts`, tambah import yang dibutuhkan:

```ts
import {
  listPayPeriods,
  createPayPeriod,
  updatePayPeriod,
  deletePayPeriod,
  countTransactionsInWindow,
  payPeriodExistsOnDate,
} from '../db/payPeriods'
```

(Tambahkan `updatePayPeriod`, `deletePayPeriod`, `countTransactionsInWindow` ke import existing.)

- [ ] **Step 2: Tambah `useUpdatePayPeriod`**

Tambah setelah `useCreatePayPeriod` (sekitar baris 100):

```ts
export function useUpdatePayPeriod() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { id: number; label: string }) =>
      updatePayPeriod(input.id, { label: input.label }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payPeriods'] })
    },
  })
}
```

- [ ] **Step 3: Tambah `useDeletePayPeriod`**

```ts
export function useDeletePayPeriod() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deletePayPeriod(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payPeriods'] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
    },
  })
}
```

Invalidate `transactions` juga karena summary periode pakai data transaksi — sebenarnya summaries dihitung client-side dari cache, tapi explicit invalidate biar konsisten kalau cache sudah stale.

- [ ] **Step 4: Tambah `usePayPeriodTransactionCount`**

```ts
export function usePayPeriodTransactionCount(
  startDate: string | null,
  endDate: string | null,
) {
  return useQuery({
    queryKey: ['payPeriods', 'txCount', startDate, endDate],
    queryFn: () => countTransactionsInWindow(startDate!, endDate),
    enabled: !!startDate,
    staleTime: 30_000,
  })
}
```

`staleTime` 30s supaya kalau user batalkan dialog hapus & buka lagi cepat, hit cache tanpa request ulang.

- [ ] **Step 5: TypeScript check**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/queries/payPeriods.ts
git commit -m "feat(payPeriods): tambah hooks useUpdate, useDelete, useTxCount"
```

---

## Task 4: Buat `PayPeriodFormDialog` Komponen Shared

**Files:**
- Create: `src/components/PayPeriodFormDialog.tsx`

Goal: Dialog form dengan dua mode — `create` (label + start_date) dan `rename` (label saja). Belum di-wire ke konsumen, tapi sudah bisa standalone.

- [ ] **Step 1: Buat file**

Buat `src/components/PayPeriodFormDialog.tsx`:

```tsx
import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import {
  useCreatePayPeriod,
  useUpdatePayPeriod,
  usePayPeriodExistsOnDate,
} from '../queries/payPeriods'
import { todayISO } from '../lib/format'
import { toast } from 'sonner'

type CreateMode = {
  mode: 'create'
  open: boolean
  onOpenChange: (open: boolean) => void
}

type RenameMode = {
  mode: 'rename'
  open: boolean
  onOpenChange: (open: boolean) => void
  periodId: number
  initialLabel: string
}

type Props = CreateMode | RenameMode

function suggestDefaultLabel(): string {
  const d = new Date()
  const bulan = d.toLocaleString('id-ID', { month: 'long' })
  return `Gaji ${bulan.charAt(0).toUpperCase() + bulan.slice(1)} ${d.getFullYear()}`
}

export function PayPeriodFormDialog(props: Props) {
  const isCreate = props.mode === 'create'
  const [label, setLabel] = useState(
    isCreate ? suggestDefaultLabel() : props.initialLabel,
  )
  const [startDate, setStartDate] = useState(todayISO())

  const createMut = useCreatePayPeriod()
  const updateMut = useUpdatePayPeriod()
  const existsQuery = usePayPeriodExistsOnDate(isCreate ? startDate : '')

  // Reset state setiap dialog dibuka (mis. user batalkan lalu buka lagi)
  useEffect(() => {
    if (!props.open) return
    if (isCreate) {
      setLabel(suggestDefaultLabel())
      setStartDate(todayISO())
    } else {
      setLabel(props.initialLabel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open])

  const isDuplicate = isCreate && existsQuery.data === true
  const labelEmpty = label.trim().length === 0
  const isPending = createMut.isPending || updateMut.isPending

  async function handleSubmit() {
    if (labelEmpty) return
    try {
      if (isCreate) {
        if (isDuplicate) return
        await createMut.mutateAsync({ label: label.trim(), start_date: startDate })
        toast.success(`Periode "${label.trim()}" dimulai`)
      } else {
        await updateMut.mutateAsync({ id: props.periodId, label: label.trim() })
        toast.success('Periode di-rename')
      }
      props.onOpenChange(false)
    } catch (err: any) {
      toast.error('Gagal: ' + (err?.message ?? 'Unknown error'))
    }
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isCreate ? 'Buat Periode Baru' : 'Rename Periode'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label htmlFor="period-label">Label Periode</Label>
            <Input
              id="period-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Gaji Mei 2026"
            />
          </div>

          {isCreate && (
            <div className="space-y-1">
              <Label htmlFor="period-start">Tanggal Mulai</Label>
              <Input
                id="period-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              {isDuplicate && (
                <p className="text-xs text-red-500">
                  Periode dengan tanggal mulai ini sudah ada
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => props.onOpenChange(false)}
            disabled={isPending}
          >
            Batal
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={labelEmpty || isPending || isDuplicate}
          >
            {isPending ? 'Menyimpan...' : 'Simpan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: TypeScript check**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/PayPeriodFormDialog.tsx
git commit -m "feat(payPeriods): tambah PayPeriodFormDialog (mode create + rename)"
```

---

## Task 5: Tambah Header & Tombol Create di PayPeriodList

**Files:**
- Modify: `src/components/PayPeriodList.tsx`

Goal: Tambah header dengan judul, deskripsi, tombol "+ Periode Baru", dan 2 angka agregat (Total Periode + Rata-rata Sisa). Wire dialog create.

- [ ] **Step 1: Update import**

Edit `src/components/PayPeriodList.tsx`. Update import block jadi:

```tsx
import { useState } from 'react'
import { ChevronRight, Plus } from 'lucide-react'
import { usePayPeriodSummaries } from '@/queries/payPeriods'
import type { PayPeriodSummary } from '@/db/payPeriods'
import { PayPeriodDetail } from '@/components/PayPeriodDetail'
import { PayPeriodFormDialog } from '@/components/PayPeriodFormDialog'
import { Button } from '@/components/ui/button'
import { formatRupiah } from '@/lib/format'
```

- [ ] **Step 2: Tambah state untuk dialog create**

Di body `PayPeriodList`, tambah state baru sejajar dengan `selected`:

```tsx
const [selected, setSelected] = useState<PayPeriodSummary | null>(null)
const [showCreateDialog, setShowCreateDialog] = useState(false)
```

- [ ] **Step 3: Hitung agregat**

Tambah perhitungan agregat sebelum return JSX (setelah blok `if (selected)` dan `if (isLoading)`, sebelum `if (summaries.length === 0)`):

```tsx
const totalPeriode = summaries.length
const closedPeriods = summaries.filter((s) => s.end_date !== null)
const avgRemaining =
  closedPeriods.length > 0
    ? closedPeriods.reduce((sum, p) => sum + p.remaining, 0) / closedPeriods.length
    : null
```

- [ ] **Step 4: Tambah header di JSX**

Sekarang struktur return-nya menjadi: header selalu tampil, lalu di bawahnya empty state ATAU list. Ubah blok return final jadi:

```tsx
return (
  <>
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <h2 className="text-lg font-semibold">Periode Gaji</h2>
          <p className="text-xs text-muted-foreground">
            Kelola siklus keuangan dari gajian ke gajian.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Periode Baru
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Total Periode</p>
          <p className="text-lg font-semibold">{totalPeriode}</p>
        </div>
        <div
          className="rounded-lg border p-3"
          title={
            avgRemaining === null
              ? 'Akan muncul setelah ada periode tertutup'
              : undefined
          }
        >
          <p className="text-xs text-muted-foreground">Rata-rata Sisa per Periode</p>
          <p className="text-lg font-semibold">
            {avgRemaining === null ? '—' : formatRupiah(Math.round(avgRemaining))}
          </p>
        </div>
      </div>

      {summaries.length === 0 ? (
        <div className="text-center py-10 space-y-2">
          <p className="text-sm font-medium">Belum ada periode gaji</p>
          <p className="text-xs text-muted-foreground">
            Klik &quot;+ Periode Baru&quot; untuk memulai periode pertama
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {summaries.map((s) => {
            const startLabel = new Date(s.start_date + 'T00:00:00').toLocaleDateString('id-ID', {
              day: 'numeric',
              month: 'short',
            })
            const endLabel = s.end_date
              ? new Date(s.end_date + 'T00:00:00').toLocaleDateString('id-ID', {
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
      )}
    </div>

    <PayPeriodFormDialog
      mode="create"
      open={showCreateDialog}
      onOpenChange={setShowCreateDialog}
    />
  </>
)
```

Catatan: blok `if (selected)` dan `if (isLoading)` di atas tetap dipertahankan persis seperti sekarang. Yang diubah hanya blok return final (yang dulu menangani empty state vs list).

- [ ] **Step 5: Pastikan loading state tetap konsisten**

Cek bahwa blok `if (isLoading)` sekarang hanya men-cover loading awal sebelum data ada. Tetap return `<p className="text-sm text-muted-foreground p-4">Memuat...</p>` apa adanya — tidak ditambah header karena saat loading data masih kosong, agregat belum bisa dihitung.

- [ ] **Step 6: TypeScript check**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 7: Manual smoke test**

Jalankan `npm run dev`. Buka `/periode-gaji`. Verifikasi:
- Header "Periode Gaji" + tombol "+ Periode Baru" muncul di kanan atas
- 2 card agregat tampil dengan angka benar (Total Periode = jumlah periode existing; Rata-rata Sisa = "—" kalau hanya periode aktif yang ada, atau angka kalau ada periode tertutup)
- Klik "+ Periode Baru" → dialog muncul dengan label default "Gaji [Bulan] [Tahun]" + tanggal hari ini
- Submit dengan tanggal yang sudah ada → error inline "Periode dengan tanggal mulai ini sudah ada" + tombol Simpan disabled
- Submit dengan tanggal baru → toast sukses, dialog close, periode baru muncul di list

- [ ] **Step 8: Commit**

```bash
git add src/components/PayPeriodList.tsx
git commit -m "feat(periode-gaji): tambah header agregat + tombol create manual di list view"
```

---

## Task 6: Tambah Aksi Rename & Hapus di PayPeriodDetail

**Files:**
- Modify: `src/components/PayPeriodDetail.tsx`

Goal: Tombol Rename dan Hapus di header detail. Klik Rename → buka `PayPeriodFormDialog` mode rename. Klik Hapus → buka `AlertDialog` dengan copy yang berbeda tergantung posisi periode (paling lama vs lainnya).

- [ ] **Step 1: Update props interface**

Edit `src/components/PayPeriodDetail.tsx`. `PayPeriodDetail` perlu tahu apakah periode ini paling lama untuk pilih copy konfirmasi yang benar. Tambah prop `isOldest`.

Update interface `Props`:

```tsx
interface Props {
  period: PayPeriod
  endDate: string | null
  isOldest: boolean
  onBack: () => void
}
```

Catatan: kita akan pass `isOldest` dari `PayPeriodList` di Task 6 step 8.

- [ ] **Step 2: Update import**

Replace blok import dengan:

```tsx
import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import type { PayPeriod } from '@/db/payPeriods'
import {
  usePayPeriodTransactions,
  usePayPeriodTransactionCount,
  useDeletePayPeriod,
} from '@/queries/payPeriods'
import { formatRupiah } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { PayPeriodFormDialog } from '@/components/PayPeriodFormDialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
```

- [ ] **Step 3: Tambah state & hooks**

Di body component, tambah state untuk dialog rename + alert hapus, plus hooks delete & count:

```tsx
export function PayPeriodDetail({ period, endDate, isOldest, onBack }: Props) {
  const { data: txs = [], isLoading } = usePayPeriodTransactions(period, endDate)
  const [showRename, setShowRename] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const txCountQuery = usePayPeriodTransactionCount(
    showDelete ? period.start_date : null,
    endDate,
  )
  const deleteMut = useDeletePayPeriod()
```

`txCountQuery.queryFn` cuma jalan saat `showDelete=true` (karena `enabled: !!startDate`).

- [ ] **Step 4: Tambah handler hapus**

Tambah function di body component (sebelum `grouped`):

```tsx
async function handleDelete() {
  try {
    await deleteMut.mutateAsync(period.id)
    toast.success('Periode dihapus')
    setShowDelete(false)
    onBack()
  } catch (err: any) {
    toast.error('Gagal hapus: ' + (err?.message ?? 'Unknown error'))
  }
}
```

`onBack()` setelah hapus = otomatis kembali ke list view.

- [ ] **Step 5: Update header detail JSX**

Replace blok header lama:

```tsx
// LAMA:
<Button variant="ghost" size="sm" onClick={onBack}>
  ← Kembali
</Button>
<h3 className="font-semibold text-base">{period.label}</h3>
```

Dengan:

```tsx
<div className="flex items-center justify-between gap-2">
  <Button variant="ghost" size="sm" onClick={onBack}>
    ← Kembali
  </Button>
  <div className="flex gap-1">
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setShowRename(true)}
      aria-label="Rename periode"
    >
      <Pencil className="h-4 w-4" />
    </Button>
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setShowDelete(true)}
      aria-label="Hapus periode"
    >
      <Trash2 className="h-4 w-4 text-red-500" />
    </Button>
  </div>
</div>
<h3 className="font-semibold text-base">{period.label}</h3>
```

- [ ] **Step 6: Tambah dialog & alert di akhir return**

Di akhir JSX (sebelum `</div>` paling luar), tambah `<PayPeriodFormDialog />` dan `<AlertDialog />`. Karena pattern existing return langsung `<div className="space-y-4">...</div>`, kita perlu wrap dalam fragment.

Final return shape:

```tsx
return (
  <>
    <div className="space-y-4">
      {/* ... semua isi existing yang sudah dimodifikasi step 5 ... */}
    </div>

    <PayPeriodFormDialog
      mode="rename"
      open={showRename}
      onOpenChange={setShowRename}
      periodId={period.id}
      initialLabel={period.label}
    />

    <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Hapus periode &quot;{period.label}&quot;?</AlertDialogTitle>
          <AlertDialogDescription>
            {(() => {
              const n = txCountQuery.data
              if (txCountQuery.isLoading) {
                return 'Menghitung jumlah transaksi yang terdampak...'
              }
              if (txCountQuery.isError || n === undefined) {
                return 'Transaksi tidak akan terhapus, tapi keanggotaan periode-nya akan berubah.'
              }
              if (isOldest) {
                return `${n} transaksi tidak akan terhapus, tapi tidak akan masuk ke periode mana pun (masih bisa dilihat di halaman Transaksi).`
              }
              return `${n} transaksi tidak akan terhapus, akan melebur ke periode sebelumnya.`
            })()}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteMut.isPending}>Batal</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleteMut.isPending}
            className="bg-red-500 text-white hover:bg-red-600"
          >
            {deleteMut.isPending ? 'Menghapus...' : 'Hapus'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>
)
```

Catatan: copy konfirmasi tidak menyebut nama periode penampung secara eksplisit untuk mengurangi kompleksitas (kita tidak punya akses ke periode tetangga di sini tanpa prop tambahan). Copy "akan melebur ke periode sebelumnya" sudah cukup informatif untuk user.

- [ ] **Step 7: TypeScript check**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 8: Update `PayPeriodList` untuk pass `isOldest`**

Edit `src/components/PayPeriodList.tsx`. Update bagian `if (selected)` di awal body component:

```tsx
// LAMA:
if (selected) {
  return (
    <PayPeriodDetail
      period={selected}
      endDate={selected.end_date}
      onBack={() => setSelected(null)}
    />
  )
}
```

Dengan:

```tsx
if (selected) {
  // summaries di-sort DESC by start_date — periode paling lama = elemen terakhir
  const isOldest =
    summaries.length > 0 && summaries[summaries.length - 1].id === selected.id
  return (
    <PayPeriodDetail
      period={selected}
      endDate={selected.end_date}
      isOldest={isOldest}
      onBack={() => setSelected(null)}
    />
  )
}
```

Pastikan `summaries` sudah ada sebelum `if (selected)` — di code existing, `useState<PayPeriodSummary | null>` → `selected` baru bisa di-set kalau user klik card, dan card hanya render kalau `summaries` ada. Aman.

- [ ] **Step 9: TypeScript check**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 10: Manual smoke test**

`npm run dev`. Buka `/periode-gaji` → klik salah satu periode untuk masuk detail. Verifikasi:
- Header detail tampilkan: tombol "← Kembali" di kiri, ikon ✏️ Rename + 🗑️ Hapus di kanan
- Klik ✏️ → dialog Rename muncul dengan label pre-filled, simpan → label update di list
- Klik 🗑️ pada periode tengah/aktif → konfirmasi muncul dengan "X transaksi ... akan melebur ke periode sebelumnya"
- Klik 🗑️ pada periode paling lama (scroll ke bawah list, klik yang terakhir) → konfirmasi muncul dengan "X transaksi ... tidak akan masuk ke periode mana pun"
- Konfirmasi hapus → toast sukses, kembali ke list, periode hilang dari list, transaksi tetap ada di /transaksi

- [ ] **Step 11: Commit**

```bash
git add src/components/PayPeriodDetail.tsx src/components/PayPeriodList.tsx
git commit -m "feat(periode-gaji): tambah aksi rename & hapus di detail view"
```

---

## Task 7: Hapus `PayPeriodConfirmDialog.tsx`

**Files:**
- Delete: `src/components/PayPeriodConfirmDialog.tsx`

Goal: Bersihkan file lama yang sudah tidak dipakai.

- [ ] **Step 1: Pastikan tidak ada import yang masih hidup**

Run: `git grep "PayPeriodConfirmDialog" -- "src/"`
Expected: tidak ada hasil. Kalau ada hasil → balik ke task sebelumnya & resolve.

- [ ] **Step 2: Hapus file**

```bash
git rm src/components/PayPeriodConfirmDialog.tsx
```

- [ ] **Step 3: TypeScript check**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(periode-gaji): hapus PayPeriodConfirmDialog yang sudah tidak dipakai"
```

---

## Task 8: UAT Final & Verifikasi

**Goal:** Run end-to-end UAT script per spec section 6.

- [ ] **Step 1: TypeScript check final**

Run: `npm run check`
Expected: PASS, tidak ada warning baru.

- [ ] **Step 2: Build check**

Run: `npm run build`
Expected: build sukses, tidak ada error.

- [ ] **Step 3: UAT script — buat & duplikat**

`npm run dev`. Buka `/periode-gaji`.

✅ **Test 1**: Buat periode baru dengan tanggal hari ini → muncul di list, Total Periode bertambah, Rata-rata Sisa update sesuai aturan (— kalau ini periode aktif satu-satunya).

✅ **Test 2**: Klik "+ Periode Baru" lagi, isi tanggal sama dengan periode existing → error inline muncul, tombol Simpan disabled.

- [ ] **Step 4: UAT script — rename**

✅ **Test 3**: Klik salah satu periode → masuk detail → klik ✏️ → ubah label → Simpan. Verifikasi: label update di:
- List view di /periode-gaji
- Detail view (header `<h3>`)
- `PayPeriodCard` di Dashboard (kalau periode yang di-rename adalah aktif)

- [ ] **Step 5: UAT script — hapus periode tengah**

Setup: minimal 3 periode. Klik periode tengah → 🗑️ → konfirmasi.

✅ **Test 4**: Copy konfirmasi: `"X transaksi tidak akan terhapus, akan melebur ke periode sebelumnya."` (X = jumlah transaksi yang sebenarnya).
✅ **Test 5**: Konfirmasi → toast `"Periode dihapus"`, kembali ke list, periode hilang.
✅ **Test 6**: Buka `/transaksi` → transaksi tanggal yang ada di periode hapus tetap ada.
✅ **Test 7**: Balik ke `/periode-gaji` → transaksi tersebut sekarang ikut dihitung di summary periode sebelumnya.

- [ ] **Step 6: UAT script — hapus periode paling lama**

✅ **Test 8**: Klik periode paling lama (scroll list ke bawah, klik elemen terakhir) → 🗑️ → copy konfirmasi: `"X transaksi tidak akan terhapus, tapi tidak akan masuk ke periode mana pun (masih bisa dilihat di halaman Transaksi)."`
✅ **Test 9**: Konfirmasi → periode hilang, transaksi yang lebih lama dari periode terlama saat ini tidak muncul di summary mana pun (tapi tetap di /transaksi).

- [ ] **Step 7: UAT script — hapus periode aktif**

✅ **Test 10**: Klik periode paling baru (paling atas list) → 🗑️ → konfirmasi → hapus.
✅ **Test 11**: Buka Dashboard → `PayPeriodCard` sekarang tampilkan periode yang sebelumnya kedua (sekarang jadi aktif), `endLabel` = "sekarang".

- [ ] **Step 8: UAT script — regression check TransactionDialog**

✅ **Test 12**: Buka /transaksi → tombol Tambah → pilih Pemasukan → kategori "Gaji" → tanggal yang belum ada periodenya → Simpan. **Verifikasi: tidak ada dialog konfirmasi periode yang muncul**. Transaksi tersimpan biasa.

- [ ] **Step 9: UAT script — edge cases agregat**

Setup yang aneh-aneh untuk verify edge case:

✅ **Test 13** (kalau bisa di-setup): hapus semua periode → empty state muncul, header tetap tampil, Total Periode = 0, Rata-rata Sisa = "—".

✅ **Test 14**: dengan hanya 1 periode (yang aktif) → Total Periode = 1, Rata-rata Sisa = "—" + tooltip on hover "Akan muncul setelah ada periode tertutup".

✅ **Test 15**: dengan ≥2 periode tertutup → Rata-rata Sisa = mean dari periode tertutup (verify dengan kalkulasi manual: jumlahkan `remaining` periode tertutup / jumlah periode tertutup).

- [ ] **Step 10: Commit (kalau ada koreksi)**

Kalau UAT temukan bug → fix dengan commit terpisah, jangan amend. Kalau semua hijau, tidak perlu commit baru di task ini.

- [ ] **Step 11: Update memori project**

Tulis memori bahwa fitur ini SHIPPED + commit hash terakhir, supaya conversation berikutnya tahu state-nya.

---

## Self-Review Checklist (untuk planner — sudah dijalankan)

**1. Spec coverage:**
- ✅ Spec §3 (komponen) → Task 1, 4, 5, 6, 7
- ✅ Spec §4 Flow 1 (create) → Task 4 + Task 5
- ✅ Spec §4 Flow 2 (rename) → Task 4 + Task 6
- ✅ Spec §4 Flow 3 (hapus, 3 kasus) → Task 6 step 6 (logic copy berbeda)
- ✅ Spec §4 Flow 4 (input Gaji setelah perubahan) → Task 1 + Task 8 step 8
- ✅ Spec §4 (header agregat) → Task 5
- ✅ Spec §5 (error handling) → distributed di Task 4 (validasi label, duplikat) + Task 6 (RLS catch, fallback copy)
- ✅ Spec §6 (testing) → Task 8

**2. Placeholder scan:** Tidak ada TBD/TODO. Semua step punya kode lengkap atau perintah eksak.

**3. Type consistency:**
- `useUpdatePayPeriod` mutation input: `{ id: number; label: string }` (Task 3) — match dengan call di `PayPeriodFormDialog` step 4 mode rename: `updateMut.mutateAsync({ id: props.periodId, label: label.trim() })` ✅
- `usePayPeriodTransactionCount(startDate, endDate)` (Task 3) — match dengan call di `PayPeriodDetail` step 3: `usePayPeriodTransactionCount(showDelete ? period.start_date : null, endDate)` ✅
- `Props` di `PayPeriodDetail` punya `isOldest: boolean` (Task 6 step 1) — match dengan caller di `PayPeriodList` step 8 ✅
- `Props` di `PayPeriodFormDialog` discriminated union mode `'create' | 'rename'` (Task 4) — match dengan caller di `PayPeriodList` (mode='create') dan `PayPeriodDetail` (mode='rename') ✅

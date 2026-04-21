# Hapus Tab Dividen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hapus tab Dividen beserta seluruh kode terkait dan bersihkan referensi di file yang masih dipakai.

**Architecture:** Hapus 7 file sepenuhnya, lalu edit 3 file existing untuk menghapus referensi ke Dividen (App.tsx, InvestmentsTab.tsx, db/investments.ts). Tidak ada migrasi database — tabel Supabase dibiarkan.

**Tech Stack:** React, TypeScript, Supabase, Zustand, React Query

---

### Task 1: Hapus 7 file Dividen

**Files:**
- Delete: `src/tabs/DividenTab.tsx`
- Delete: `src/components/DividenSummaryCards.tsx`
- Delete: `src/components/DividenHoldingsTable.tsx`
- Delete: `src/components/DividenTransactionDialog.tsx`
- Delete: `src/components/SectorPieChart.tsx`
- Delete: `src/db/dividends.ts`
- Delete: `src/queries/dividends.ts`

- [ ] **Step 1: Hapus semua file sekaligus**

```bash
cd "src"
rm tabs/DividenTab.tsx \
   components/DividenSummaryCards.tsx \
   components/DividenHoldingsTable.tsx \
   components/DividenTransactionDialog.tsx \
   components/SectorPieChart.tsx \
   db/dividends.ts \
   queries/dividends.ts
```

- [ ] **Step 2: Verifikasi file sudah hilang**

```bash
ls tabs/DividenTab.tsx 2>/dev/null && echo "MASIH ADA" || echo "OK - sudah dihapus"
ls components/SectorPieChart.tsx 2>/dev/null && echo "MASIH ADA" || echo "OK - sudah dihapus"
```

Expected: semua cetak "OK - sudah dihapus"

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: hapus semua file tab Dividen"
```

---

### Task 2: Bersihkan `src/db/investments.ts`

**Files:**
- Modify: `src/db/investments.ts`

- [ ] **Step 1: Hapus field `bei_stock_id` dari interface `Investment`**

Cari blok:
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
  bei_stock_id: number | null
}
```

Ganti menjadi:
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
}
```

- [ ] **Step 2: Bersihkan `listInvestments` — hapus `bei_stock_id` dari select dan sederhanakan filter**

Cari:
```typescript
    .select('id, asset_type, asset_name, quantity, buy_price, current_price, buy_date, note, bei_stock_id')
    .or('bei_stock_id.is.null,quantity.gt.0')
```

Ganti menjadi:
```typescript
    .select('id, asset_type, asset_name, quantity, buy_price, current_price, buy_date, note')
    .gt('quantity', 0)
```

- [ ] **Step 3: Bersihkan `getInvestment` — hapus `bei_stock_id` dari select**

Cari:
```typescript
    .select('id, asset_type, asset_name, quantity, buy_price, current_price, buy_date, note, bei_stock_id')
    .eq('id', id)
```

Ganti menjadi:
```typescript
    .select('id, asset_type, asset_name, quantity, buy_price, current_price, buy_date, note')
    .eq('id', id)
```

- [ ] **Step 4: Commit**

```bash
git add src/db/investments.ts
git commit -m "chore: hapus bei_stock_id dari Investment type dan query"
```

---

### Task 3: Bersihkan `src/tabs/InvestmentsTab.tsx`

**Files:**
- Modify: `src/tabs/InvestmentsTab.tsx`

- [ ] **Step 1: Hapus `ExternalLink` dari lucide imports**

Cari:
```typescript
import { Plus, Pencil, Trash2, TrendingUp, Upload, Download, RefreshCw, ExternalLink } from 'lucide-react'
```

Ganti menjadi:
```typescript
import { Plus, Pencil, Trash2, TrendingUp, Upload, Download, RefreshCw } from 'lucide-react'
```

- [ ] **Step 2: Hapus import `useTabStore`**

Cari:
```typescript
import { useTabStore } from '@/lib/tabStore'
```

Hapus baris ini seluruhnya.

- [ ] **Step 3: Hapus penggunaan `setActiveTab`**

Cari:
```typescript
  const { setActiveTab } = useTabStore()
```

Hapus baris ini seluruhnya.

- [ ] **Step 4: Hapus tombol ExternalLink di baris table**

Cari:
```typescript
                      {r.bei_stock_id != null && (
                        <Button variant="ghost" size="icon" title="Lihat di tab Dividen" onClick={() => setActiveTab('dividen')}>
                          <ExternalLink className="h-4 w-4 text-blue-500" />
                        </Button>
                      )}
```

Hapus block ini seluruhnya.

- [ ] **Step 5: Commit**

```bash
git add src/tabs/InvestmentsTab.tsx
git commit -m "chore: hapus referensi Dividen dari InvestmentsTab"
```

---

### Task 4: Bersihkan `src/App.tsx`

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Hapus import `DividenTab`**

Cari:
```typescript
import DividenTab from '@/tabs/DividenTab'
```

Hapus baris ini seluruhnya.

- [ ] **Step 2: Hapus `Banknote` dari lucide imports**

Cari:
```typescript
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
```

Ganti menjadi:
```typescript
import {
  LayoutDashboard,
  Wallet,
  TrendingUp,
  Target,
  StickyNote,
  BarChart3,
  Settings as SettingsIcon,
} from 'lucide-react'
```

- [ ] **Step 3: Hapus entry `dividen` dari array `TABS`**

Cari:
```typescript
  { value: 'dividen',      label: 'Dividen',    icon: Banknote,        Comp: DividenTab },
```

Hapus baris ini seluruhnya.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "chore: hapus tab Dividen dari App"
```

---

### Task 5: Verifikasi build bersih

**Files:** (tidak ada perubahan)

- [ ] **Step 1: Jalankan TypeScript check**

```bash
npx tsc --noEmit
```

Expected: tidak ada error. Jika ada error, periksa apakah masih ada import yang mereferensikan file yang sudah dihapus.

- [ ] **Step 2: Jalankan dev server dan cek UI**

```bash
npm run dev
```

Buka browser, verifikasi:
- Tab bar menampilkan 7 tab (tidak ada tab "Dividen")
- Tab Investasi terbuka normal, tidak ada error console
- Tombol ExternalLink tidak ada lagi di baris tabel Investasi

- [ ] **Step 3: Commit final jika ada perbaikan, atau tandai selesai**

Jika ada perbaikan tambahan:
```bash
git add -A
git commit -m "fix: bersihkan sisa referensi Dividen"
```

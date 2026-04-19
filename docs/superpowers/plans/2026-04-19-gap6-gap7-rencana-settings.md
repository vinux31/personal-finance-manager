# Gap 6+7 — Rencana Dinamis & Settings Fungsional Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hapus hardcode di RencanaBar (target Rp 257jt & deadline Jan 2027) agar dihitung dinamis dari goals aktif, dan tambah seksi Rencana di Settings dengan info read-only + tombol Reset Seed.

**Architecture:** Buat `src/lib/rencanaNames.ts` sebagai single source of truth untuk nama-nama seed data. RencanaBar menerima prop `goals[]` dan menghitung totalTarget & deadline sendiri. SettingsTab menampilkan info Rencana yang dihitung dari goals aktif dan mengekspos tombol Reset Seed.

**Tech Stack:** React 19, TypeScript, TanStack React Query 5, Sonner (toast), Tailwind CSS, Shadcn/ui

---

## File Map

| File | Aksi | Tanggung Jawab |
|------|------|----------------|
| `src/lib/rencanaNames.ts` | Create | Konstanta nama seed — single source of truth |
| `src/db/goals.ts` | Modify | Import nama dari rencanaNames (hapus duplikasi) |
| `src/db/investments.ts` | Modify | Import nama dari rencanaNames (hapus duplikasi) |
| `src/components/RencanaBar.tsx` | Modify | Hapus hardcode, terima goals[], hitung computed |
| `src/tabs/DashboardTab.tsx` | Modify | Pass prop goals ke RencanaBar |
| `src/tabs/SettingsTab.tsx` | Modify | Tambah seksi Rencana + tombol Reset Seed |

---

## Task 1: Buat `src/lib/rencanaNames.ts`

**Files:**
- Create: `src/lib/rencanaNames.ts`

Ini adalah single source of truth untuk semua nama seed Rencana dan data seed-nya. Tidak mengimpor dari `db/` layer agar tidak ada circular dependency.

- [ ] **Step 1.1: Buat file `src/lib/rencanaNames.ts`**

```ts
export const RENCANA_GOAL_NAMES = [
  'Dana Pernikahan',
  'DP + Akad Kredit Xpander',
  'Non-Budget Nikah',
  'Dana Darurat',
  'Buffer Cadangan',
] as const

export const RENCANA_INVESTMENT_NAMES = [
  'Reksadana Sukuk Sucorinvest Sharia',
  'Emas Tabungan Pegadaian',
  'Saham BMRI',
] as const

export type RencanaGoalName = typeof RENCANA_GOAL_NAMES[number]
export type RencanaInvestmentName = typeof RENCANA_INVESTMENT_NAMES[number]
```

- [ ] **Step 1.2: Verifikasi TypeScript tidak error**

```bash
npx tsc --noEmit
```

Expected: tidak ada error baru.

- [ ] **Step 1.3: Commit**

```bash
git add src/lib/rencanaNames.ts
git commit -m "feat(lib): add rencanaNames — single source of truth untuk nama seed Rencana"
```

---

## Task 2: Update `src/db/goals.ts` — gunakan nama dari rencanaNames

**Files:**
- Modify: `src/db/goals.ts`

Ganti string literal nama di `RENCANA_GOALS` dengan referensi ke `RENCANA_GOAL_NAMES` agar tidak duplikasi.

- [ ] **Step 2.1: Tambah import di awal `src/db/goals.ts`**

Buka file. Di baris 1 (setelah `import { supabase }`), tambahkan:

```ts
import { RENCANA_GOAL_NAMES } from '@/lib/rencanaNames'
```

- [ ] **Step 2.2: Update array `RENCANA_GOALS` (baris 94-100)**

Ganti keseluruhan array `RENCANA_GOALS`:

```ts
const RENCANA_GOALS = [
  { name: RENCANA_GOAL_NAMES[0], target_amount: 100_000_000, current_amount: 0, target_date: '2027-01-01', status: 'active' as const },
  { name: RENCANA_GOAL_NAMES[1], target_amount: 118_000_000, current_amount: 0, target_date: '2027-01-01', status: 'active' as const },
  { name: RENCANA_GOAL_NAMES[2], target_amount: 10_000_000,  current_amount: 0, target_date: '2027-01-01', status: 'active' as const },
  { name: RENCANA_GOAL_NAMES[3], target_amount: 24_000_000,  current_amount: 0, target_date: '2026-12-01', status: 'active' as const },
  { name: RENCANA_GOAL_NAMES[4], target_amount: 5_000_000,   current_amount: 0, target_date: '2027-01-01', status: 'active' as const },
]
```

- [ ] **Step 2.3: Verifikasi TypeScript tidak error**

```bash
npx tsc --noEmit
```

Expected: tidak ada error baru.

- [ ] **Step 2.4: Commit**

```bash
git add src/db/goals.ts
git commit -m "refactor(db): goals RENCANA_GOALS gunakan nama dari rencanaNames"
```

---

## Task 3: Update `src/db/investments.ts` — gunakan nama dari rencanaNames

**Files:**
- Modify: `src/db/investments.ts`

- [ ] **Step 3.1: Tambah import di awal `src/db/investments.ts`**

```ts
import { RENCANA_INVESTMENT_NAMES } from '@/lib/rencanaNames'
```

- [ ] **Step 3.2: Update array `RENCANA_INVESTMENTS` (sekitar baris 160-164)**

Ganti keseluruhan array `RENCANA_INVESTMENTS`:

```ts
const RENCANA_INVESTMENTS = [
  { asset_type: 'Reksadana', asset_name: RENCANA_INVESTMENT_NAMES[0], quantity: 1,      buy_price: 100_000_000, current_price: 100_000_000, buy_date: '2026-04-01', note: 'Seeded dari rencana-keuangan-v2.html' },
  { asset_type: 'Emas',      asset_name: RENCANA_INVESTMENT_NAMES[1], quantity: 5.5278, buy_price: 2_683_000,   current_price: 2_683_000,   buy_date: '2026-04-01', note: 'Seeded dari rencana-keuangan-v2.html' },
  { asset_type: 'Saham',     asset_name: RENCANA_INVESTMENT_NAMES[2], quantity: 1,      buy_price: 6_129_180,   current_price: 6_129_180,   buy_date: '2026-04-01', note: 'Seeded dari rencana-keuangan-v2.html' },
]
```

- [ ] **Step 3.3: Verifikasi TypeScript tidak error**

```bash
npx tsc --noEmit
```

Expected: tidak ada error baru.

- [ ] **Step 3.4: Commit**

```bash
git add src/db/investments.ts
git commit -m "refactor(db): investments RENCANA_INVESTMENTS gunakan nama dari rencanaNames"
```

---

## Task 4: Update `src/components/RencanaBar.tsx` — computed dari goals

**Files:**
- Modify: `src/components/RencanaBar.tsx`

Hapus dua konstanta hardcoded, tambah prop `goals`, hitung totalTarget dan deadline secara dinamis.

- [ ] **Step 4.1: Ganti seluruh isi `src/components/RencanaBar.tsx`**

```tsx
import { type Goal } from '@/db/goals'
import { Progress } from '@/components/ui/progress'
import { formatRupiah } from '@/lib/format'

interface RencanaBarProps {
  totalNilai: number
  goals: Goal[]
}

export default function RencanaBar({ totalNilai, goals }: RencanaBarProps) {
  const activeGoals = goals.filter((g) => g.status === 'active')
  const totalTarget = activeGoals.reduce((s, g) => s + g.target_amount, 0)

  if (totalTarget === 0) return null

  const deadlineStr = activeGoals
    .filter((g) => g.target_date)
    .reduce((latest, g) => (g.target_date! > latest ? g.target_date! : latest), '')
  const deadline = deadlineStr ? new Date(deadlineStr) : null

  const progress = Math.min(100, (totalNilai / totalTarget) * 100)
  const gap = Math.max(0, totalTarget - totalNilai)

  const now = new Date()
  const bulanLagi = deadline
    ? (deadline.getFullYear() - now.getFullYear()) * 12 +
      (deadline.getMonth() - now.getMonth())
    : null

  const deadlineLabel = deadline
    ? deadline.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
    : null

  return (
    <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
      <div className="flex shrink-0 flex-col items-center rounded-md bg-blue-600 px-3 py-1.5 text-white">
        {deadlineLabel && <span className="text-xs font-medium opacity-80">{deadlineLabel}</span>}
        <span className="text-lg font-bold leading-tight">{progress.toFixed(0)}%</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 text-sm font-medium text-blue-900">
          {formatRupiah(totalNilai)} / {formatRupiah(totalTarget)}
          {bulanLagi !== null && bulanLagi > 0 && (
            <span className="ml-1 font-normal text-blue-700">· {bulanLagi} bulan lagi</span>
          )}
        </div>
        <Progress value={progress} className="h-2" />
      </div>
      {gap > 0 && (
        <div className="shrink-0 text-right">
          <div className="text-xs text-muted-foreground">Gap</div>
          <div className="text-sm font-semibold text-red-600">{formatRupiah(gap)}</div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4.2: Verifikasi TypeScript tidak error**

```bash
npx tsc --noEmit
```

Expected: error di DashboardTab karena prop `goals` belum dipassing — itu normal, akan diperbaiki di Task 5.

- [ ] **Step 4.3: Commit**

```bash
git add src/components/RencanaBar.tsx
git commit -m "feat(RencanaBar): hapus hardcode — target & deadline dihitung dinamis dari goals aktif"
```

---

## Task 5: Update `src/tabs/DashboardTab.tsx` — pass prop `goals`

**Files:**
- Modify: `src/tabs/DashboardTab.tsx`

`goals` sudah di-fetch di baris 24. Hanya perlu menambah prop ke `<RencanaBar>`.

- [ ] **Step 5.1: Update baris 79 di `src/tabs/DashboardTab.tsx`**

Cari baris:
```tsx
{inv.totalNilai > 0 && <RencanaBar totalNilai={inv.totalNilai} />}
```

Ganti dengan:
```tsx
{inv.totalNilai > 0 && <RencanaBar totalNilai={inv.totalNilai} goals={goals} />}
```

- [ ] **Step 5.2: Verifikasi TypeScript tidak error**

```bash
npx tsc --noEmit
```

Expected: tidak ada error.

- [ ] **Step 5.3: Verifikasi visual di browser**

Jalankan dev server jika belum:
```bash
npm run dev
```

Buka `http://localhost:5173`. Pastikan:
- RencanaBar masih tampil di Dashboard (jika ada goals aktif dan investasi)
- Deadline label menampilkan "Januari 2027" (dari goals)
- Progress % dan gap masih benar

- [ ] **Step 5.4: Commit**

```bash
git add src/tabs/DashboardTab.tsx
git commit -m "feat(Dashboard): pass goals ke RencanaBar untuk computed target"
```

---

## Task 6: Update `src/tabs/SettingsTab.tsx` — tambah seksi Rencana

**Files:**
- Modify: `src/tabs/SettingsTab.tsx`

Tambah seksi "Rencana" yang menampilkan info computed dari goals aktif dan tombol Reset Seed.

- [ ] **Step 6.1: Ganti seluruh isi `src/tabs/SettingsTab.tsx`**

```tsx
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useThemeStore, type Theme } from '@/lib/theme'
import { useAuth } from '@/auth/useAuth'
import { useGoals } from '@/queries/goals'
import { useInvestments } from '@/queries/investments'
import { deleteGoal } from '@/db/goals'
import { deleteInvestment } from '@/db/investments'
import { RENCANA_GOAL_NAMES, RENCANA_INVESTMENT_NAMES } from '@/lib/rencanaNames'
import { formatRupiah } from '@/lib/format'
import { BookOpen, Info, LogOut } from 'lucide-react'
import PanduanDialog from '@/components/PanduanDialog'
import TentangDialog from '@/components/TentangDialog'

export default function SettingsTab() {
  const { theme, setTheme } = useThemeStore()
  const { user, signOut } = useAuth()
  const [panduanOpen, setPanduanOpen] = useState(false)
  const [tentangOpen, setTentangOpen] = useState(false)
  const [resetting, setResetting] = useState(false)
  const qc = useQueryClient()

  const { data: goals = [] } = useGoals()
  const { data: invRows = [] } = useInvestments()

  const activeGoals = goals.filter((g) => g.status === 'active')
  const totalTarget = activeGoals.reduce((s, g) => s + g.target_amount, 0)
  const deadlineStr = activeGoals
    .filter((g) => g.target_date)
    .reduce((latest, g) => (g.target_date! > latest ? g.target_date! : latest), '')
  const deadlineLabel = deadlineStr
    ? new Date(deadlineStr).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
    : '—'

  async function handleResetSeed() {
    if (!confirm('Reset seed Rencana? Goals dan investasi hasil seed akan dihapus.')) return
    setResetting(true)
    try {
      const goalsToDelete = goals.filter((g) =>
        (RENCANA_GOAL_NAMES as readonly string[]).includes(g.name)
      )
      const invsToDelete = invRows.filter((i) =>
        (RENCANA_INVESTMENT_NAMES as readonly string[]).includes(i.asset_name)
      )
      await Promise.all([
        ...goalsToDelete.map((g) => deleteGoal(g.id)),
        ...invsToDelete.map((i) => deleteInvestment(i.id)),
      ])
      localStorage.removeItem('rencana_seeded')
      qc.invalidateQueries({ queryKey: ['goals'] })
      qc.invalidateQueries({ queryKey: ['investments'] })
      toast.success('Seed direset. Buka Dashboard untuk inisialisasi ulang.')
    } catch {
      toast.error('Gagal mereset seed. Coba lagi.')
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-8">
      {/* Tampilan */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Tampilan</h2>
        <div className="grid max-w-sm gap-2">
          <Label>Tema</Label>
          <Select value={theme} onValueChange={(v) => setTheme(v as Theme)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">Terang</SelectItem>
              <SelectItem value="dark">Gelap</SelectItem>
              <SelectItem value="system">Ikuti sistem</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      {/* Rencana */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Rencana</h2>
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <div className="grid grid-cols-2 gap-y-2 text-sm">
            <span className="text-muted-foreground">Total Target</span>
            <span className="font-medium">{totalTarget > 0 ? formatRupiah(totalTarget) : '—'}</span>
            <span className="text-muted-foreground">Deadline</span>
            <span className="font-medium">{deadlineLabel}</span>
            <span className="text-muted-foreground">Goals Aktif</span>
            <span className="font-medium">{activeGoals.length} goals</span>
          </div>
          <div className="pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetSeed}
              disabled={resetting}
            >
              {resetting ? 'Mereset...' : 'Reset Seed Rencana'}
            </Button>
            <p className="mt-1.5 text-xs text-muted-foreground">
              ⚠ Menghapus goals &amp; investasi hasil seed. Buka Dashboard untuk inisialisasi ulang.
            </p>
          </div>
        </div>
      </section>

      {/* Akun */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Akun</h2>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-3">
            {user?.user_metadata?.avatar_url && (
              <img
                src={user.user_metadata.avatar_url}
                alt="avatar"
                className="h-10 w-10 rounded-full object-cover"
              />
            )}
            <div>
              <div className="font-medium">{user?.user_metadata?.full_name ?? '—'}</div>
              <div className="text-sm text-muted-foreground">{user?.email}</div>
            </div>
          </div>
        </div>
        <div className="mt-3">
          <Button
            variant="outline"
            onClick={async () => {
              if (!confirm('Keluar dari aplikasi?')) return
              await signOut()
            }}
          >
            <LogOut className="h-4 w-4" />
            Keluar
          </Button>
        </div>
      </section>

      {/* Bantuan */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Bantuan</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setPanduanOpen(true)}>
            <BookOpen className="h-4 w-4" />
            Panduan Pengguna
          </Button>
          <Button variant="outline" onClick={() => setTentangOpen(true)}>
            <Info className="h-4 w-4" />
            Tentang
          </Button>
        </div>
      </section>

      <PanduanDialog open={panduanOpen} onOpenChange={setPanduanOpen} />
      <TentangDialog open={tentangOpen} onOpenChange={setTentangOpen} />
    </div>
  )
}
```

- [ ] **Step 6.2: Verifikasi TypeScript tidak error**

```bash
npx tsc --noEmit
```

Expected: tidak ada error.

- [ ] **Step 6.3: Verifikasi visual di browser**

Buka `http://localhost:5173`, navigasi ke tab **Pengaturan**. Pastikan:
- Seksi "Rencana" muncul di antara Tampilan dan Akun
- Total Target menampilkan jumlah benar (misal Rp 257.000.000)
- Deadline menampilkan bulan dan tahun yang benar (misal "Januari 2027")
- Jumlah Goals Aktif sesuai dengan tab Goals
- Tombol "Reset Seed Rencana" tampil dan bisa diklik

- [ ] **Step 6.4: Test tombol Reset Seed (opsional — hati-hati)**

Klik tombol Reset Seed → konfirmasi → pastikan:
- Toast sukses muncul
- Goals dan investasi seed terhapus dari tab Goals & Investasi
- Kembali ke Dashboard → seed berjalan ulang otomatis
- RencanaBar muncul kembali dengan data fresh

- [ ] **Step 6.5: Commit**

```bash
git add src/tabs/SettingsTab.tsx
git commit -m "feat(Settings): tambah seksi Rencana — info computed + tombol Reset Seed"
```

---

## Self-Review Checklist

### Spec Coverage

| Requirement dari Spec | Task yang Mengimplementasi |
|-----------------------|---------------------------|
| Hapus `TARGET_RENCANA` hardcoded | Task 4 |
| Hapus deadline `2027-01-01` hardcoded | Task 4 |
| Hitung totalTarget dari goals aktif | Task 4 |
| Hitung deadline dari target_date terpanjang | Task 4 |
| Pass `goals[]` dari DashboardTab | Task 5 |
| Guard: `totalTarget === 0` → tidak tampil | Task 4 |
| Guard: `deadline === null` → sembunyikan label | Task 4 |
| Settings: tampilkan totalTarget, deadline, jumlah goals | Task 6 |
| Settings: tombol Reset Seed | Task 6 |
| Reset: hapus goals by name | Task 6 |
| Reset: hapus investasi by name | Task 6 |
| Reset: hapus localStorage flag | Task 6 |
| Reset: invalidate React Query cache | Task 6 |
| Reset: toast sukses/error | Task 6 |
| rencanaNames.ts sebagai single source of truth | Task 1, 2, 3 |

Semua requirement tercakup. ✅

### Type Consistency

- `Goal` type diimpor dari `@/db/goals` di Task 4 — konsisten dengan penggunaan di seluruh codebase ✅
- `RENCANA_GOAL_NAMES` dan `RENCANA_INVESTMENT_NAMES` diekspor dari `rencanaNames.ts`, diimpor di Task 2, 3, 6 ✅
- `deleteGoal(id: number)` dan `deleteInvestment(id: number)` tersedia di db layer ✅
- `useGoals()` dan `useInvestments()` tersedia di queries layer ✅

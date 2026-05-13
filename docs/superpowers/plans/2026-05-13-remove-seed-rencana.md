# Remove Auto-Seed RENCANA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hapus sistem auto-seed RENCANA (goals + investments hardcoded) sehingga akun baru mulai kosong, dan tutup IDOR write vulnerability di `seed_rencana` DB function.

**Architecture:** Frontend-only removal (delete hook + lib files, clean up UI), ditambah DB migration yang REVOKE execute permission dari authenticated users. Tidak ada DROP tabel/fungsi — tabel `user_seed_markers` dipertahankan karena ada data admin.

**Tech Stack:** React, TypeScript, Supabase (PostgreSQL migration)

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| DELETE | `src/lib/useRencanaInit.ts` | Hook yang memanggil seed_rencana RPC |
| DELETE | `src/lib/rencanaNames.ts` | Konstanta nama RENCANA goals/investments |
| MODIFY | `src/tabs/DashboardTab.tsx` | Hapus import + hook call |
| MODIFY | `src/tabs/SettingsTab.tsx` | Hapus section Rencana + semua state/fungsi/import terkait |
| CREATE | `supabase/migrations/0030_revoke_seed_rencana.sql` | REVOKE execute permission fungsi seed |

---

### Task 1: Tambah migration 0030_revoke_seed_rencana.sql

**Files:**
- Create: `supabase/migrations/0030_revoke_seed_rencana.sql`

- [ ] **Step 1: Buat file migration**

```sql
-- Revoke client access to seed functions (closes IDOR write vulnerability BUG-2).
-- Functions retained in DB for audit trail; uncallable via REST API after this migration.
REVOKE EXECUTE ON FUNCTION seed_rencana(UUID) FROM authenticated;
REVOKE EXECUTE ON FUNCTION reset_rencana_marker() FROM authenticated;
```

Simpan ke `supabase/migrations/0030_revoke_seed_rencana.sql`.

- [ ] **Step 2: Verify file ada**

```bash
ls supabase/migrations/0030_revoke_seed_rencana.sql
```

Expected: file listed.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0030_revoke_seed_rencana.sql
git commit -m "feat(migration): revoke seed_rencana + reset_rencana_marker from authenticated"
```

---

### Task 2: Hapus file lib yang tidak diperlukan

**Files:**
- Delete: `src/lib/useRencanaInit.ts`
- Delete: `src/lib/rencanaNames.ts`

- [ ] **Step 1: Hapus kedua file**

```bash
rm src/lib/useRencanaInit.ts
rm src/lib/rencanaNames.ts
```

- [ ] **Step 2: Verify TypeScript masih compile (akan gagal — ada import yang masih aktif)**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: error tentang import di DashboardTab dan SettingsTab. Ini expected — akan difix di Task 3 dan 4.

- [ ] **Step 3: Commit file deletion**

```bash
git add -A
git commit -m "chore: delete useRencanaInit.ts + rencanaNames.ts"
```

---

### Task 3: Bersihkan DashboardTab.tsx

**Files:**
- Modify: `src/tabs/DashboardTab.tsx`

- [ ] **Step 1: Hapus import useRencanaInit (line 12)**

Ubah blok import dari:
```tsx
import RencanaBar from '@/components/RencanaBar'
import { useRencanaInit } from '@/lib/useRencanaInit'
import UpcomingBillsPanel from '@/components/UpcomingBillsPanel'
```

Menjadi:
```tsx
import RencanaBar from '@/components/RencanaBar'
import UpcomingBillsPanel from '@/components/UpcomingBillsPanel'
```

- [ ] **Step 2: Hapus hook call useRencanaInit() (line 29)**

Ubah dari:
```tsx
  const { data: nwSnapshots = [] } = useNetWorthSnapshots()
  useRencanaInit()

  const monthly = useMemo(() => {
```

Menjadi:
```tsx
  const { data: nwSnapshots = [] } = useNetWorthSnapshots()

  const monthly = useMemo(() => {
```

- [ ] **Step 3: Verify TypeScript — DashboardTab clean**

```bash
npx tsc --noEmit 2>&1 | grep DashboardTab
```

Expected: tidak ada error untuk DashboardTab.tsx.

- [ ] **Step 4: Commit**

```bash
git add src/tabs/DashboardTab.tsx
git commit -m "feat: remove useRencanaInit from DashboardTab"
```

---

### Task 4: Bersihkan SettingsTab.tsx

**Files:**
- Modify: `src/tabs/SettingsTab.tsx`

- [ ] **Step 1: Ganti blok import di bagian atas file**

Ubah dari:
```tsx
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useThemeStore, type Theme } from '@/lib/theme'
import { useAuthContext } from '@/auth/AuthProvider'
import { useViewAs } from '@/auth/useViewAs'
import { useGoals } from '@/queries/goals'
import { useInvestments } from '@/queries/investments'
import { deleteGoal } from '@/db/goals'
import { deleteInvestment } from '@/db/investments'
import { listAllowedEmails, addAllowedEmail, removeAllowedEmail } from '@/db/allowedEmails'
import { listProfiles } from '@/db/profiles'
import { RENCANA_GOAL_NAMES, RENCANA_INVESTMENT_NAMES } from '@/lib/rencanaNames'
import { formatRupiah } from '@/lib/format'
import { mapSupabaseError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import { Eye, HelpCircle, LogOut, Palette, Target, User, Users } from 'lucide-react'
import TentangDialog from '@/components/TentangDialog'
import PanduanWelcomeCard from '@/components/PanduanWelcomeCard'
```

Menjadi:
```tsx
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useThemeStore, type Theme } from '@/lib/theme'
import { useAuthContext } from '@/auth/AuthProvider'
import { useViewAs } from '@/auth/useViewAs'
import { listAllowedEmails, addAllowedEmail, removeAllowedEmail } from '@/db/allowedEmails'
import { listProfiles } from '@/db/profiles'
import { mapSupabaseError } from '@/lib/errors'
import { Eye, HelpCircle, LogOut, Palette, User, Users } from 'lucide-react'
import TentangDialog from '@/components/TentangDialog'
import PanduanWelcomeCard from '@/components/PanduanWelcomeCard'
```

- [ ] **Step 2: Hapus state + hooks yang tidak diperlukan di dalam komponen**

Ubah dari:
```tsx
  const { theme, setTheme } = useThemeStore()
  const { user, signOut, isAdmin } = useAuthContext()
  const { setViewingAs } = useViewAs()
  const [tentangOpen, setTentangOpen] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const [removeEmailConfirmOpen, setRemoveEmailConfirmOpen] = useState(false)
  const [removeEmailTarget, setRemoveEmailTarget] = useState<{ id: number; email: string } | null>(null)
  const [resetSeedConfirmOpen, setResetSeedConfirmOpen] = useState(false)
  const qc = useQueryClient()

  const { data: goals = [] } = useGoals()
  const { data: invRows = [] } = useInvestments()
```

Menjadi:
```tsx
  const { theme, setTheme } = useThemeStore()
  const { user, signOut, isAdmin } = useAuthContext()
  const { setViewingAs } = useViewAs()
  const [tentangOpen, setTentangOpen] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const [removeEmailConfirmOpen, setRemoveEmailConfirmOpen] = useState(false)
  const [removeEmailTarget, setRemoveEmailTarget] = useState<{ id: number; email: string } | null>(null)
  const qc = useQueryClient()
```

- [ ] **Step 3: Hapus variables + functions Rencana**

Hapus blok berikut seluruhnya (setelah `addEmailMutation` + `removeEmailMutation` + `handleAddEmail`):

```tsx
  const activeGoals = goals.filter((g) => g.status === 'active')
  const totalTarget = activeGoals.reduce((s, g) => s + g.target_amount, 0)
  const deadlineStr = activeGoals
    .filter((g) => g.target_date)
    .reduce((latest, g) => (g.target_date! > latest ? g.target_date! : latest), '')
  const deadlineLabel = deadlineStr
    ? new Date(deadlineStr).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
    : '—'

  async function handleResetSeed() {
    setResetSeedConfirmOpen(true)
  }

  async function doResetSeed() {
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

      // D-07.3: atomic DB marker reset via RPC (strict self-only — no admin override)
      const { error: rpcErr } = await supabase.rpc('reset_rencana_marker')
      if (rpcErr) throw rpcErr

      // D-07.4 (fix UX-01): per-user localStorage key
      if (user?.id) {
        localStorage.removeItem(`rencana_seeded_${user.id}`)
      }
      // D-07.5: cleanup legacy global key (one-shot inline migration)
      localStorage.removeItem('rencana_seeded')

      qc.invalidateQueries({ queryKey: ['goals'] })
      qc.invalidateQueries({ queryKey: ['investments'] })
      toast.success('Seed direset. Buka Dashboard untuk inisialisasi ulang.')
    } catch (e) {
      toast.error(mapSupabaseError(e))
    } finally {
      setResetting(false)
    }
  }
```

- [ ] **Step 4: Hapus section Rencana dari JSX**

Hapus seluruh blok berikut dari return statement:

```tsx
      {/* Rencana */}
      <section>
        <SectionHeader icon={Target} label="Rencana" iconBg="bg-[#fef3c7]" />
        <div className="rounded-xl border border-[#e0e7ff] bg-card p-4 space-y-3">
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
```

- [ ] **Step 5: Hapus ConfirmDialog reset seed dari JSX**

Hapus blok berikut:

```tsx
      <ConfirmDialog
        open={resetSeedConfirmOpen}
        onOpenChange={setResetSeedConfirmOpen}
        title="Reset Seed Rencana?"
        description="Goals dan investasi hasil seed akan dihapus permanen."
        confirmLabel="Reset"
        onConfirm={doResetSeed}
      />
```

- [ ] **Step 6: Verify TypeScript build bersih**

```bash
npx tsc --noEmit 2>&1
```

Expected: tidak ada output error (exit 0).

- [ ] **Step 7: Commit**

```bash
git add src/tabs/SettingsTab.tsx
git commit -m "feat: remove Rencana seed section from SettingsTab"
```

---

### Task 5: Verify end-to-end + push migration

- [ ] **Step 1: Jalankan dev server**

```bash
npm run dev
```

- [ ] **Step 2: Manual test checklist**

Buka browser, login sebagai user baru (atau akun yang belum punya data):

1. Buka `/` → Dashboard loads, tidak ada toast error dari seed, Console tidak ada `seed_rencana RPC failed`
2. Buka `/pengaturan` → tidak ada section "Rencana", tidak ada tombol "Reset Seed Rencana"
3. Buka `/tujuan` → kosong (tidak ada goals pre-populated)
4. Buka `/aset` → kosong (tidak ada investments pre-populated)

Login sebagai admin:
5. Data lama admin tetap ada (goals/investments tidak hilang)
6. `/pengaturan` admin: section "Manajemen Pengguna" tetap berfungsi (tambah/hapus email)

- [ ] **Step 3: Push migration ke Supabase**

Jalankan via Supabase SQL Editor (paste isi migration 0030) atau:

```bash
npx supabase db push
```

- [ ] **Step 4: Verify REVOKE berhasil**

Di Supabase SQL Editor, jalankan sebagai authenticated user:

```sql
SELECT seed_rencana('00000000-0000-0000-0000-000000000000'::uuid);
```

Expected: `ERROR: permission denied for function seed_rencana`

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: remove auto-seed RENCANA system — new accounts start empty"
```

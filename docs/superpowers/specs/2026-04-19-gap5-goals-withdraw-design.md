# Design: Gap 5 — Goals Tarik Dana

**Tanggal:** 2026-04-19
**Status:** Approved
**Scope:** Tambah fitur tarik dana dari goal, dengan auto-reset status jika goal completed

---

## Ringkasan

Saat ini goals hanya bisa menambah dana (satu arah). Tidak ada cara menarik dana kembali tanpa menghapus goal. Fitur ini menambah kemampuan tarik dana dengan:
- Validasi: tidak boleh tarik lebih dari saldo kas
- Auto-reset status `completed` → `active` jika saldo turun di bawah target
- UI: extend `AddMoneyDialog` dengan dua mode (Tambah / Tarik)

**Pendekatan:** Fungsi baru `withdrawFromGoal()` di `db/goals.ts` — targeted update dua field saja (`current_amount`, `status`). Tidak perlu migration database baru.

---

## Arsitektur

```
GoalsTab
└── <AddMoneyDialog goal={g} />  ← sudah ada, di-extend
        ├── mode: 'tambah' → useAddMoneyToGoal()  (existing)
        └── mode: 'tarik'  → useWithdrawFromGoal() (baru)
                                    ↓
                              withdrawFromGoal(id, amount, goal)
                                    ↓
                              supabase.update({ current_amount, status })
```

**File yang diubah:** 4
**File baru:** 0
**Migration DB:** tidak ada

---

## Seksi 1: Data Layer

### `src/db/goals.ts` — tambah `withdrawFromGoal()`

```ts
export async function withdrawFromGoal(
  id: number,
  amount: number,
  goal: Goal
): Promise<void> {
  if (amount <= 0) throw new Error('Jumlah harus > 0')
  const newAmount = goal.current_amount - amount
  if (newAmount < 0) throw new Error('Dana tidak cukup')
  const newStatus: GoalStatus =
    goal.status === 'completed' && newAmount < goal.target_amount
      ? 'active'
      : goal.status
  const { error } = await supabase
    .from('goals')
    .update({ current_amount: newAmount, status: newStatus })
    .eq('id', id)
  if (error) throw error
}
```

**Logika status:**
- `completed` + `newAmount < target` → reset ke `'active'`
- `paused` → tetap `'paused'`
- `active` → tetap `'active'`

### `src/queries/goals.ts` — tambah `useWithdrawFromGoal()`

```ts
export function useWithdrawFromGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, amount, goal }: { id: number; amount: number; goal: Goal }) =>
      withdrawFromGoal(id, amount, goal),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goals'] })
      toast.success('Dana berhasil ditarik')
    },
    onError: (e) => toast.error(mapSupabaseError(e)),
  })
}
```

---

## Seksi 2: UI

### `src/components/AddMoneyDialog.tsx` — mode Tambah / Tarik

**State tambahan:**
```ts
const [mode, setMode] = useState<'tambah' | 'tarik'>('tambah')
```

**Reset saat dialog dibuka:**
```ts
useEffect(() => {
  if (open) {
    setAmountStr('')
    setMode('tambah')  // ← tambahan baru
  }
}, [open])
```

**Toggle UI** (dua Button, bukan tab library):
```tsx
<div className="flex gap-1 rounded-lg border p-1">
  <Button
    type="button"
    variant={mode === 'tambah' ? 'default' : 'ghost'}
    size="sm"
    className="flex-1"
    onClick={() => { setMode('tambah'); setAmountStr('') }}
  >
    Tambah Uang
  </Button>
  <Button
    type="button"
    variant={mode === 'tarik' ? 'default' : 'ghost'}
    size="sm"
    className="flex-1"
    onClick={() => { setMode('tarik'); setAmountStr('') }}
  >
    Tarik Dana
  </Button>
</div>
```

**Info kontekstual** (di bawah input):
- Mode tambah: `Sisa yang perlu dikumpulkan: Rp X` (dari `goal.target_amount - goal.current_amount`)
- Mode tarik: `Saldo kas tersedia: Rp X` (dari `goal.current_amount` — **bukan** totalCurrent)

> **Penting:** Saldo tarik menggunakan `goal.current_amount` saja, tidak termasuk `investedAmount`. Investasi yang ter-link tidak bisa ditarik melalui fitur ini.

**Submit handler:**
```ts
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault()
  if (!goal) return
  const amount = parseRupiah(amountStr)
  if (amount <= 0) { toast.error('Jumlah harus > 0'); return }
  try {
    if (mode === 'tambah') {
      const result = await addMoney.mutateAsync({ id: goal.id, amount })
      if (result?.status === 'completed') toast.success('Selamat! Goal tercapai 🎉')
    } else {
      await withdraw.mutateAsync({ id: goal.id, amount, goal })
    }
    onOpenChange(false)
  } catch {
    // error toast handled by mutation hooks
  }
}
```

**Judul dialog** — dinamis:
```tsx
<DialogTitle>
  {mode === 'tambah' ? 'Tambah Uang' : 'Tarik Dana'} — {goal.name}
</DialogTitle>
```

**Tombol submit** — label dinamis:
```tsx
<Button type="submit" disabled={addMoney.isPending || withdraw.isPending}>
  {addMoney.isPending || withdraw.isPending ? 'Menyimpan…' : mode === 'tambah' ? 'Tambah' : 'Tarik'}
</Button>
```

### `src/tabs/GoalsTab.tsx` — hapus disabled

```tsx
// sebelum
<Button ... disabled={g.status === 'completed'}>
  <PiggyBank className="h-4 w-4" />Tambah Uang
</Button>

// sesudah — hapus disabled, goal completed tetap bisa dibuka untuk tarik
<Button ...>
  <PiggyBank className="h-4 w-4" />Tambah Uang
</Button>
```

---

## Seksi 3: Edge Cases

| Kondisi | Perilaku |
|---------|----------|
| Tarik > saldo kas | Error: "Dana tidak cukup" |
| Tarik = saldo kas | Berhasil — `current_amount = 0`, status tidak auto-complete |
| Tarik dari goal completed | Berhasil — status reset ke `'active'` |
| Tarik dari goal paused | Berhasil — status tetap `'paused'` |
| Tarik `amount = 0` | Error: "Jumlah harus > 0" |
| Ganti mode saat input terisi | Input di-reset ke kosong |
| Dialog dibuka ulang | Mode reset ke `'tambah'`, amount reset ke kosong |
| `current_amount = 0`, mode tarik | Submit gagal validasi "Dana tidak cukup" |

---

## Daftar File

| File | Aksi | Keterangan |
|------|------|------------|
| `src/db/goals.ts` | Modify | Tambah `withdrawFromGoal()` |
| `src/queries/goals.ts` | Modify | Tambah `useWithdrawFromGoal()` |
| `src/components/AddMoneyDialog.tsx` | Modify | Extend dengan mode Tambah/Tarik |
| `src/tabs/GoalsTab.tsx` | Modify | Hapus `disabled` untuk completed |

---

## Tidak Dalam Scope

- Riwayat penarikan (history log)
- Konfirmasi dialog sebelum tarik
- Tarik dari nilai investasi yang ter-link
- Perubahan database / migration baru

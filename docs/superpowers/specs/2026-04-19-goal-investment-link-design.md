# Design Spec: Goal–Investment Link

**Tanggal:** 2026-04-19
**Status:** Approved

---

## Ringkasan

Menghubungkan investasi ke goal finansial sehingga nilai investasi (real-time) otomatis terhitung sebagai bagian dari progress goal, di samping uang tunai manual.

---

## Keputusan Desain

| Pertanyaan | Keputusan |
|---|---|
| Bagaimana nilai investasi dihitung terhadap goal? | Otomatis — nilai saat ini (`currentValue`) langsung jadi progress |
| Satu investasi ke berapa goal? | Banyak (one-to-many) — dengan persentase alokasi |
| Goal boleh gabung cash + investasi? | Ya — `total = current_amount + invested_amount` |
| Progress ikut fluktuasi harga? | Ya — real-time saat `current_price` diupdate |
| Link dari mana? | Dari kartu Goal (GoalsTab) |

---

## Data Model

### Tabel Baru: `goal_investments`

```sql
-- Migration: supabase/migrations/0005_goal_investments.sql

CREATE TABLE goal_investments (
  id            BIGSERIAL PRIMARY KEY,
  goal_id       BIGINT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  investment_id BIGINT NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
  allocation_pct NUMERIC(5,2) NOT NULL CHECK (allocation_pct > 0 AND allocation_pct <= 100),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(goal_id, investment_id)
);

ALTER TABLE goal_investments ENABLE ROW LEVEL SECURITY;
CREATE POLICY auth_all_goal_investments
  ON goal_investments FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
```

**Tidak ada perubahan** pada tabel `goals` atau `investments`.

### Aturan Validasi

- `allocation_pct` per baris: 0 < pct ≤ 100 (dijaga DB)
- Total `allocation_pct` satu investasi ke semua goal ≤ 100% (dijaga application layer — ditampilkan sebagai error message)
- Satu investasi hanya bisa muncul sekali per goal — update persen lewat upsert, bukan insert baru

---

## Kalkulasi Progress

```ts
// Per goal card di GoalsTab
const linkedAllocs = goalInvestments.filter(a => a.goal_id === g.id)
const investedAmount = linkedAllocs.reduce((sum, a) => {
  const inv = investments.find(i => i.id === a.investment_id)
  return sum + (inv ? currentValue(inv) * a.allocation_pct / 100 : 0)
}, 0)

const totalCurrent = g.current_amount + investedAmount
const pct = Math.min(100, (totalCurrent / g.target_amount) * 100)
```

`currentValue(inv)` = `inv.quantity × (inv.current_price ?? inv.buy_price)` — fungsi yang sudah ada di `src/db/investments.ts`.

---

## Backend Layer

### File Baru: `src/db/goalInvestments.ts`

```ts
export interface GoalInvestment {
  id: number
  goal_id: number
  investment_id: number
  allocation_pct: number
}

listGoalInvestments(goalId: number): Promise<GoalInvestment[]>
upsertGoalInvestment(goalId: number, investmentId: number, pct: number): Promise<void>
deleteGoalInvestment(goalId: number, investmentId: number): Promise<void>
```

### File Baru: `src/queries/goalInvestments.ts`

```ts
useGoalInvestments(goalId: number)    // query key: ['goal-investments', goalId]
useUpsertGoalInvestment()             // onSuccess: invalidate ['goal-investments', goalId]
useDeleteGoalInvestment()             // onSuccess: invalidate ['goal-investments', goalId]
```

### Cache Invalidation

- Saat harga investasi diupdate (`updatePrice`), cache `['investments']` sudah di-invalidate — GoalsTab otomatis recompute karena membaca dari cache yang sama.
- Tidak perlu invalidasi tambahan untuk price updates.

---

## UI

### GoalsTab — Kartu Goal (perubahan)

Tambahkan di bawah progress bar:
- List investasi ter-link: nama, persentase alokasi, nilai Rp saat ini
- Tombol **"Hubungkan Investasi"** (icon link) di baris aksi bawah

Progress bar menampilkan total (cash + investasi). Label di bawah bar menunjukkan breakdown:
```
Rp 5.000.000 (tunai) + Rp 100.000.000 (investasi) = 105%
```

### Komponen Baru: `src/components/LinkInvestmentDialog.tsx`

Props: `{ open, onOpenChange, goal: Goal }`

Isi dialog:
1. **Dropdown** — tampilkan semua investasi. Jika investasi sudah ter-link ke goal ini, pre-fill persen dengan nilai saat ini (mode edit).
2. **Input persen** — tampil preview nilai Rp real-time: `currentValue(inv) × pct / 100`
3. **Info sisa alokasi** — "Sisa alokasi investasi ini: X%" (100% minus total alokasi investasi tersebut ke semua goal lain, tidak termasuk goal ini)
4. **Tombol Simpan** — upsert: insert jika belum ada, update jika sudah ada
5. **Tombol Hapus Link** — muncul hanya jika investasi yang dipilih sudah ter-link ke goal ini

---

## Error Handling

| Kondisi | Handling |
|---|---|
| Total alokasi investasi > 100% | Toast error: "Alokasi melebihi 100% — sisa X%" |
| Investasi dihapus (investment deleted) | `ON DELETE CASCADE` — link otomatis terhapus |
| Goal dihapus | `ON DELETE CASCADE` — semua link terhapus |
| `current_price` null | Fallback ke `buy_price` (sudah ada di `currentValue()`) |

---

## File yang Diubah / Dibuat

| File | Aksi |
|---|---|
| `supabase/migrations/0005_goal_investments.sql` | Baru |
| `src/db/goalInvestments.ts` | Baru |
| `src/queries/goalInvestments.ts` | Baru |
| `src/components/LinkInvestmentDialog.tsx` | Baru |
| `src/tabs/GoalsTab.tsx` | Diubah — tambah query, kalkulasi, UI baru |

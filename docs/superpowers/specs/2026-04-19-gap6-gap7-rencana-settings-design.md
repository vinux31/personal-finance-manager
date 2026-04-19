# Design: Gap 6+7 — Rencana Dinamis & Settings Fungsional

**Tanggal:** 2026-04-19
**Status:** Approved
**Scope:** Gap 6 (Rencana hardcoded) + Gap 7 (Settings kosong)

---

## Ringkasan

Dua perubahan kecil pada file yang sudah ada. Tidak ada migration database, tidak ada file baru.

**Masalah:**
- `RencanaBar.tsx` menggunakan konstanta hardcoded `TARGET_RENCANA = 257_000_000` dan deadline `2027-01-01`
- `SettingsTab.tsx` kosong — tidak ada konfigurasi yang berguna

**Solusi (Opsi A — Computed):**
- Hitung `totalTarget` dan `deadline` dinamis dari goals aktif
- Tambah seksi "Rencana" di Settings sebagai info read-only + tombol Reset Seed

---

## Arsitektur

```
DashboardTab
├── useGoals()          → goals[] (sudah ada, baris 24)
├── useInvestments()    → inv.totalNilai (sudah ada)
└── <RencanaBar totalNilai={inv.totalNilai} goals={goals} />
        ↓
        hitung totalTarget = sum(active goals target_amount)
        hitung deadline    = max(active goals target_date)

SettingsTab
└── useGoals()          → goals[] (fetch baru, ringan — cached React Query)
        ↓
        tampilkan: totalTarget, deadline, jumlah goals aktif
        tombol: Reset Seed Rencana
```

**File yang diubah:** 3
**File baru:** 1 (`src/lib/rencanaNames.ts`)
**Migration DB:** tidak ada

---

## Seksi 1: RencanaBar

**File:** `src/components/RencanaBar.tsx`

### Perubahan Props

```tsx
// Sebelum
interface RencanaBarProps { totalNilai: number }

// Sesudah
interface RencanaBarProps {
  totalNilai: number
  goals: Goal[]
}
```

### Logika Computed

```tsx
const activeGoals = goals.filter(g => g.status === 'active')
const totalTarget = activeGoals.reduce((s, g) => s + g.target_amount, 0)
const deadlineStr = activeGoals
  .filter(g => g.target_date)
  .reduce((latest, g) => g.target_date! > latest ? g.target_date! : latest, '')
const deadline = deadlineStr ? new Date(deadlineStr) : null
```

### Guard Conditions

- Jika `totalTarget === 0` → komponen return `null` (tidak tampil)
- Jika `deadline === null` → sembunyikan bagian "X bulan lagi"
- Progress cap di 100% (`Math.min(100, ...)` — sudah ada)
- Gap section hanya tampil jika `totalNilai < totalTarget`

### Perubahan di DashboardTab

**Baris 79** — tambah prop `goals`:
```tsx
// sebelum
{inv.totalNilai > 0 && <RencanaBar totalNilai={inv.totalNilai} />}

// sesudah
{inv.totalNilai > 0 && <RencanaBar totalNilai={inv.totalNilai} goals={goals} />}
```

---

## Seksi 2: SettingsTab — Seksi Rencana

**File:** `src/tabs/SettingsTab.tsx`

### Posisi

Tambah seksi "Rencana" **di antara** seksi Tampilan dan Akun.

### Data

```tsx
const { data: goals = [] } = useGoals()
const activeGoals = goals.filter(g => g.status === 'active')
const totalTarget = activeGoals.reduce((s, g) => s + g.target_amount, 0)
const deadlineStr = activeGoals
  .filter(g => g.target_date)
  .reduce((latest, g) => g.target_date! > latest ? g.target_date! : latest, '')
```

### Tampilan

```
┌──────────────────────────────────────────────┐
│ Rencana                                       │
│                                              │
│ Total Target    Rp 257.000.000               │
│ Deadline        Januari 2027                 │
│ Goals Aktif     5 goals                      │
│                                              │
│ [Reset Seed Rencana]                         │
│ ⚠ Menghapus goals & investasi hasil seed     │
└──────────────────────────────────────────────┘
```

Semua info adalah read-only. Edit goals dilakukan di tab Goals.

### Logika Reset Seed

```
1. confirm('Reset seed Rencana? Goals dan investasi hasil seed akan dihapus.')
2. Hapus goals yang namanya ada di RENCANA_GOAL_NAMES
3. Hapus investasi yang namanya ada di RENCANA_INVESTMENT_NAMES
4. localStorage.removeItem('rencana_seeded')
5. qc.invalidateQueries(['goals', 'investments'])
6. Toast sukses: "Seed direset. Buka Dashboard untuk inisialisasi ulang."
```

Konstanta nama seed dipindah ke file terpisah `src/lib/rencanaNames.ts` agar bisa diimpor oleh `db/goals.ts`, `db/investments.ts`, dan `SettingsTab.tsx` tanpa duplikasi.

---

## Seksi 3: Edge Cases

| Kondisi | Perilaku |
|---------|----------|
| Tidak ada goals aktif | `totalTarget = 0` → RencanaBar tidak tampil |
| Goals aktif semua tanpa `target_date` | Deadline tidak ditampilkan di bar |
| `totalNilai > totalTarget` | Progress 100%, gap section disembunyikan |
| Reset: goals/inv seed sudah dihapus manual | Skip yang tidak ada, tetap clear localStorage |
| Reset: delete gagal sebagian | Toast error, localStorage **tidak** dihapus |
| User cancel konfirmasi reset | Tidak ada aksi |

---

## Daftar File

| File | Aksi | Keterangan |
|------|------|------------|
| `src/components/RencanaBar.tsx` | Modify | Hapus hardcode, terima `goals[]`, hitung computed |
| `src/tabs/DashboardTab.tsx` | Modify | Pass `goals` ke `RencanaBar` |
| `src/tabs/SettingsTab.tsx` | Modify | Tambah seksi Rencana + tombol Reset Seed |
| `src/lib/rencanaNames.ts` | Create | Konstanta nama seed (DRY) |

---

## Tidak Dalam Scope

- Form untuk edit target atau deadline Rencana (edit lewat tab Goals)
- Migration database baru
- Perubahan pada `useRencanaInit.ts` atau logika seeding
- Fitur lain di Settings selain seksi Rencana

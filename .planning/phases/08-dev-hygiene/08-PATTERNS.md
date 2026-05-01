# Phase 8: Dev Hygiene - Pattern Map

**Mapped:** 2026-04-29
**Files analyzed:** 3
**Analogs found:** 2 / 3

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/tabs/ReportsTab.tsx` | component | request-response | `src/tabs/KekayaanTab.tsx`, `src/tabs/pensiun/SimulasiPanel.tsx` | role-match (Recharts import pattern) |
| `supabase/seed.sql` | config | — | none | no analog (file does not exist yet) |
| `.planning/PROJECT.md` | config | — | `.planning/PROJECT.md` itself (append to Context section) | self-reference |

---

## Pattern Assignments

### `src/tabs/ReportsTab.tsx` (component — DEV-02: type fix)

**Change scope:** Lines 199 and 212 only — two `label` props on `<Pie>` components.

**Current code — line 199** (`src/tabs/ReportsTab.tsx`):
```tsx
<Pie data={expenseByCat} dataKey="total" nameKey="category" outerRadius={100} label={(e) => String((e as { category?: string }).category ?? '')}>
```

**Current code — line 212** (`src/tabs/ReportsTab.tsx`):
```tsx
<Pie data={incomeByCat} dataKey="total" nameKey="category" outerRadius={100} label={(e) => String((e as { category?: string }).category ?? '')}>
```

**Target — both lines** (replace `label` prop only):
```tsx
label={(e: PieLabelRenderProps) => String(e.name ?? '')}
```

**Import pattern analog — `src/tabs/KekayaanTab.tsx` lines 2-10:**
```tsx
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
```

**Import pattern analog — `src/tabs/pensiun/SimulasiPanel.tsx` line 9:**
```tsx
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
```

**Rule:** Semua Recharts components di-import langsung dari `'recharts'` — satu import statement, named imports. `PieLabelRenderProps` mengikuti pola yang sama: tambahkan ke import block yang sudah ada di baris 2-5 `ReportsTab.tsx`.

**Current import block — `src/tabs/ReportsTab.tsx` lines 2-5:**
```tsx
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
```

**Target import block** (tambah `PieLabelRenderProps`):
```tsx
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
  type PieLabelRenderProps,
} from 'recharts'
```

---

### `supabase/seed.sql` (config — DEV-03: buat file baru)

**Analog:** Tidak ada file seed.sql yang sudah exist di codebase.

**Context dari `supabase/config.toml` lines 60-65:**
```toml
[db.seed]
# If enabled, seeds the database after migrations during a db reset.
enabled = true
# Specifies an ordered list of seed files to load during db reset.
# Supports glob patterns relative to supabase directory: "./seeds/*.sql"
sql_paths = ["./seed.sql"]
```

**Target file content** (buat baru, path `supabase/seed.sql`):
```sql
-- Dev seed (empty). Add sample data here for local development.
```

**Rule:** File harus berada di `supabase/seed.sql` (relative ke project root), bukan `supabase/supabase/seed.sql`. Path di `config.toml` adalah `"./seed.sql"` relative dari `supabase/` directory.

---

### `.planning/PROJECT.md` (config — DEV-04: tambah note ke Context section)

**Insertion target — `## Context` section, lines 74-82:**

Baris terakhir Context section sebelum blank line menuju `## Constraints` adalah line 82:
```
- **Migrations:** 0001 → 0021 (21 migrations applied to cloud — v1.1 Phase 5 added 0017+0018, v1.1 Phase 6 added 0019+0020+0021)
```

**Entry yang ditambahkan** (append sebagai bullet baru setelah baris `Migrations` tersebut):
```markdown
- **Performance:** Dashboard `recentTx` query pakai `useTransactions({ limit: 5 })` + index `transactions_date_idx` — sufficient untuk dataset < 50k rows; pertimbangkan migrasi ke materialized view jika dataset user aktif melewati threshold tersebut.
```

**Style analog — existing Context bullets** (`PROJECT.md` lines 74-82):
```markdown
- **Stack:** React 19 + TypeScript + Vite + Supabase …
- **Auth:** Google OAuth only, signup dibatasi via `allowed_emails` table
- **DB:** Supabase dengan Row Level Security …
- **RPC:** `mark_bill_paid`, `process_due_recurring` …
- **Deployment:** Vercel auto-deploy dari `master` (build time ~15-30s)
- **Existing recurring data:** Tabel `recurring_templates` sudah ada …
- **Multi-user:** Admin bisa view-as user lain …
- **Migrations:** 0001 → 0021 …
```

**Rule:** Format `- **Bold key:** sentence` — wording exact sesuai D-08 di CONTEXT.md, tidak diubah.

---

## Shared Patterns

Tidak ada shared cross-cutting patterns antar ketiga item ini — masing-masing berdiri sendiri (type fix, file creation, doc append).

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `supabase/seed.sql` | config | — | File tidak exist sebelumnya; tidak ada seed file lain di codebase untuk dijadikan referensi |

---

## Metadata

**Analog search scope:** `src/tabs/`, `supabase/`, `.planning/`
**Files scanned:** `ReportsTab.tsx` (294 lines), `KekayaanTab.tsx` (30 lines sampled), `SimulasiPanel.tsx` (30 lines sampled), `config.toml` (lines 60-69), `PROJECT.md` (132 lines)
**Pattern extraction date:** 2026-04-29

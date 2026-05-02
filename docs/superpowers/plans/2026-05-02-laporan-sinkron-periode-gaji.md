# Laporan Filter Sinkron Periode Gaji — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tab Laporan otomatis menampilkan range periode gaji aktif (bukan "bulan ini") saat pertama dibuka.

**Architecture:** Tambah `useCurrentPayPeriod()` di `ReportsTab`, gunakan `useEffect` + `useRef` untuk auto-set `preset = 'custom'`, `from = activePeriod.start_date`, `to = todayISO()` sekali saat data pertama tersedia. Pola identik dengan TransactionsTab yang sudah diimplementasi.

**Tech Stack:** React 19, TanStack Query v5, TypeScript (verbatimModuleSyntax)

---

### Task 1: Auto-set filter Laporan ke periode gaji aktif

**Files:**
- Modify: `src/tabs/ReportsTab.tsx`

- [ ] **Step 1: Baca file**

```
Baca src/tabs/ReportsTab.tsx untuk memastikan kondisi terkini.
```

- [ ] **Step 2: Tambah `useEffect` dan `useRef` ke React import (baris 1)**

```typescript
// Sebelum:
import { useMemo, useState } from 'react'

// Sesudah:
import { useEffect, useMemo, useRef, useState } from 'react'
```

- [ ] **Step 3: Tambah import `useCurrentPayPeriod` setelah baris import terakhir (setelah baris `report-insights`)**

```typescript
import { useCurrentPayPeriod } from '@/queries/payPeriods'
```

- [ ] **Step 4: Tambah hook + useEffect di dalam komponen, setelah deklarasi state `to` (setelah `const [to, setTo] = useState('')`)**

```typescript
const { data: activePeriod } = useCurrentPayPeriod()
const autoApplied = useRef(false)

useEffect(() => {
  if (activePeriod && !autoApplied.current) {
    autoApplied.current = true
    setPreset('custom')
    setFrom(activePeriod.start_date)
    setTo(todayISO())
  }
}, [activePeriod])
```

`todayISO` sudah di-import dari `@/lib/format` di baris 16 — tidak perlu tambah.

- [ ] **Step 5: Commit**

```bash
git add src/tabs/ReportsTab.tsx
git commit -m "feat(laporan): auto-set filter ke start_date periode gaji aktif"
```

- [ ] **Step 6: Push dan verifikasi**

```bash
git push origin master
```

Buka `kantongpintar.vercel.app` → tab **Laporan**:
- Dropdown Periode menampilkan "Kustom"
- Field "Dari" menampilkan `start_date` periode aktif (contoh: 2026-04-28)
- Field "Sampai" menampilkan hari ini
- Grafik menampilkan data dari periode gaji, bukan hanya bulan kalender

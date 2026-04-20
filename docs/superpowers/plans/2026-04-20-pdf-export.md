# PDF Export Laporan Keuangan — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tambah tombol "Export PDF" di tab Laporan yang menghasilkan file PDF berisi summary keuangan dan tabel data per periode yang sedang dipilih.

**Architecture:** Fungsi pure `exportReportPDF` di `src/lib/export-pdf.ts` menerima data mentah dan menghasilkan dokumen PDF via jsPDF + AutoTable, lalu trigger browser download. `ReportsTab` memanggil fungsi ini dari tombol di header filter, menyuplai data yang sudah tersedia di state.

**Tech Stack:** `jspdf` ^2.x, `jspdf-autotable` ^3.x, React 19, TypeScript 6, Vite 8

---

## File Map

| File | Aksi | Tanggung jawab |
|------|------|----------------|
| `src/lib/export-pdf.ts` | Buat baru | Fungsi pure `exportReportPDF` — generate & download PDF |
| `src/tabs/ReportsTab.tsx` | Modifikasi | Tambah tombol Export PDF + helper `buildPeriodeLabel` / `buildFilenameMonth` |

---

### Task 1: Install dependencies

**Files:**
- Modify: `package.json` (via npm)

- [ ] **Step 1: Install jspdf dan jspdf-autotable**

```bash
npm install jspdf jspdf-autotable
```

Expected output: kedua package masuk ke `dependencies` di `package.json`.

- [ ] **Step 2: Verifikasi tipe tersedia**

```bash
npx tsc --noEmit 2>&1 | head -5
```

Expected: tidak ada error terkait jspdf (types sudah bundled di dalamnya).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install jspdf + jspdf-autotable untuk export PDF"
```

---

### Task 2: Buat `src/lib/export-pdf.ts`

**Files:**
- Create: `src/lib/export-pdf.ts`

- [ ] **Step 1: Buat file dengan interface dan implementasi lengkap**

Buat file `src/lib/export-pdf.ts` dengan isi berikut:

```ts
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatRupiah } from './format'

export interface ExportReportParams {
  periodeLabel: string
  filenameMonth: string
  totals: { income: number; expense: number; net: number }
  expenseByCat: { category: string; total: number }[]
  incomeByCat: { category: string; total: number }[]
  investments: { name: string; modal: number; nilai: number }[]
}

export function exportReportPDF(params: ExportReportParams): void {
  const { periodeLabel, filenameMonth, totals, expenseByCat, incomeByCat, investments } = params
  const doc = new jsPDF()

  // Header
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('Laporan Keuangan', 14, 22)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(periodeLabel, 14, 30)

  // Summary
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Ringkasan', 14, 44)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)

  const summaryRows: [string, string, string][] = [
    ['Total Pemasukan', formatRupiah(totals.income), ''],
    ['Total Pengeluaran', formatRupiah(totals.expense), ''],
    ['Net', formatRupiah(totals.net), ''],
  ]
  autoTable(doc, {
    startY: 48,
    head: [['Keterangan', 'Jumlah', '']],
    body: summaryRows,
    headStyles: { fillColor: [30, 41, 59] },
    columnStyles: { 2: { cellWidth: 0 } },
    showHead: false,
    theme: 'plain',
    styles: { fontSize: 10 },
    margin: { left: 14 },
  })

  let cursorY: number = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10

  // Pengeluaran per Kategori
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Pengeluaran per Kategori', 14, cursorY)
  cursorY += 4

  autoTable(doc, {
    startY: cursorY,
    head: [['Kategori', 'Total']],
    body: expenseByCat.length > 0
      ? expenseByCat.map((r) => [r.category, formatRupiah(r.total)])
      : [['Tidak ada data pada periode ini', '']],
    headStyles: { fillColor: [239, 68, 68] },
    styles: { fontSize: 10 },
    margin: { left: 14 },
  })

  cursorY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10

  // Pemasukan per Kategori
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Pemasukan per Kategori', 14, cursorY)
  cursorY += 4

  autoTable(doc, {
    startY: cursorY,
    head: [['Kategori', 'Total']],
    body: incomeByCat.length > 0
      ? incomeByCat.map((r) => [r.category, formatRupiah(r.total)])
      : [['Tidak ada data pada periode ini', '']],
    headStyles: { fillColor: [16, 185, 129] },
    styles: { fontSize: 10 },
    margin: { left: 14 },
  })

  cursorY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10

  // Kinerja Investasi
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Kinerja Investasi', 14, cursorY)
  cursorY += 4

  autoTable(doc, {
    startY: cursorY,
    head: [['Nama Aset', 'Modal', 'Nilai Kini', 'Gain/Loss']],
    body: investments.length > 0
      ? investments.map((i) => [
          i.name,
          formatRupiah(i.modal),
          formatRupiah(i.nilai),
          formatRupiah(i.nilai - i.modal),
        ])
      : [['Belum ada investasi', '', '', '']],
    headStyles: { fillColor: [14, 165, 233] },
    styles: { fontSize: 10 },
    margin: { left: 14 },
  })

  doc.save(`laporan-keuangan-${filenameMonth}.pdf`)
}
```

- [ ] **Step 2: Verifikasi TypeScript compile**

```bash
npx tsc --noEmit 2>&1
```

Expected: tidak ada error.

- [ ] **Step 3: Commit**

```bash
git add src/lib/export-pdf.ts
git commit -m "feat(lib): tambah exportReportPDF untuk generate PDF laporan"
```

---

### Task 3: Tambah tombol Export PDF di ReportsTab

**Files:**
- Modify: `src/tabs/ReportsTab.tsx`

- [ ] **Step 1: Tambah import**

Di bagian atas `src/tabs/ReportsTab.tsx`, tambah import berikut setelah import yang sudah ada:

```ts
import { useState } from 'react'  // sudah ada, tidak perlu duplikat
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { exportReportPDF, type ExportReportParams } from '@/lib/export-pdf'
```

Catatan: `useState` sudah diimport, cukup tambah `Download`, `Button`, dan `exportReportPDF`.

- [ ] **Step 2: Tambah state `exporting` dan helper functions**

Tambah state dan dua fungsi helper di dalam komponen `ReportsTab`, tepat setelah deklarasi state yang sudah ada (`preset`, `gran`, `from`, `to`):

```ts
const [exporting, setExporting] = useState(false)

function buildPeriodeLabel(p: PeriodPreset, f: string, t: string): string {
  const d = new Date()
  if (p === 'month') return `Bulan ini: ${d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}`
  if (p === 'year') return `Tahun ini: ${d.getFullYear()}`
  if (p === 'today') return `Hari ini: ${todayISO()}`
  if (p === 'all') return 'Semua periode'
  if (f && t) return `${f} s/d ${t}`
  if (f) return `Dari ${f}`
  return 'Periode kustom'
}

function buildFilenameMonth(p: PeriodPreset, f: string): string {
  const d = new Date()
  if (p === 'month') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  if (p === 'year') return String(d.getFullYear())
  if (p === 'today') return todayISO()
  if (p === 'all') return 'semua'
  if (f) return f.slice(0, 7)
  return 'kustom'
}

function handleExport() {
  setExporting(true)
  try {
    const params: ExportReportParams = {
      periodeLabel: buildPeriodeLabel(preset, from, to),
      filenameMonth: buildFilenameMonth(preset, from),
      totals,
      expenseByCat,
      incomeByCat,
      investments,
    }
    exportReportPDF(params)
  } catch {
    // sonner toast sudah di-setup di App.tsx
    import('sonner').then(({ toast }) => toast.error('Gagal membuat PDF'))
  } finally {
    setExporting(false)
  }
}
```

- [ ] **Step 3: Tambah tombol di baris filter**

Cari baris `<div className="flex flex-wrap items-end gap-3">` yang membungkus kontrol filter. Tambah tombol di **akhir** div tersebut, sebelum tag penutup `</div>`:

```tsx
<div className="ml-auto">
  <Button
    variant="outline"
    size="sm"
    disabled={exporting}
    onClick={handleExport}
  >
    <Download className="mr-2 h-4 w-4" />
    Export PDF
  </Button>
</div>
```

- [ ] **Step 4: Verifikasi TypeScript compile**

```bash
npx tsc --noEmit 2>&1
```

Expected: tidak ada error.

- [ ] **Step 5: Commit**

```bash
git add src/tabs/ReportsTab.tsx
git commit -m "feat(ReportsTab): tambah tombol Export PDF ke laporan keuangan"
```

---

### Task 4: Verifikasi manual di browser

**Files:** tidak ada perubahan kode

- [ ] **Step 1: Jalankan dev server**

```bash
npm run dev
```

Buka `http://localhost:5173`, masuk ke tab **Laporan**.

- [ ] **Step 2: Test preset "Bulan ini"**

Pastikan tombol "Export PDF" muncul di ujung kanan baris filter. Klik tombol. Browser harus mengunduh file `laporan-keuangan-2026-04.pdf`. Buka file — verifikasi:
- Header "Laporan Keuangan" dan label periode ada
- Summary Pemasukan/Pengeluaran/Net tampil
- Tabel Pengeluaran per Kategori ada
- Tabel Pemasukan per Kategori ada
- Tabel Kinerja Investasi ada

- [ ] **Step 3: Test preset "Semua"**

Ganti preset ke "Semua", klik Export PDF. File harus bernama `laporan-keuangan-semua.pdf`.

- [ ] **Step 4: Test preset "Kustom" tanpa tanggal**

Ganti ke "Kustom", kosongkan input tanggal, klik Export PDF. File harus bernama `laporan-keuangan-kustom.pdf`.

- [ ] **Step 5: Test data kosong**

Jika ada periode tanpa transaksi, pilih periode tersebut dan export. PDF harus tetap berhasil di-download dengan baris "Tidak ada data pada periode ini" di tabel.

- [ ] **Step 6: Commit final (jika ada fix)**

```bash
git add -p
git commit -m "fix(ReportsTab): <deskripsi fix jika ada>"
```

Jika tidak ada fix, skip step ini.

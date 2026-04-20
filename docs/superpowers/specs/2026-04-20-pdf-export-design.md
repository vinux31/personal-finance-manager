# Design Spec: Export Laporan ke PDF (Gap 8)

**Tanggal:** 2026-04-20
**Status:** Approved

---

## Ringkasan

Tambah fitur export laporan keuangan ke PDF dari tab Laporan. Tombol "Export PDF" ditempatkan di header filter (ujung kanan), sejajar dengan kontrol Periode dan Kelompokkan per. PDF berisi summary numerik dan tabel data — tanpa screenshot grafik.

---

## Dependencies Baru

```
jspdf
jspdf-autotable
```

Bundle tambahan: ~250KB (moderat, acceptable).

---

## File yang Terlibat

| File | Perubahan |
|------|-----------|
| `src/lib/export-pdf.ts` | File baru — fungsi pure `exportReportPDF(params)` |
| `src/tabs/ReportsTab.tsx` | Tambah tombol Export PDF di baris filter |

Tidak ada file lain yang diubah.

---

## Arsitektur

```
ReportsTab (state: periodData, expenseByCat, incomeByCat, invRows)
  → klik tombol "Export PDF"
  → panggil exportReportPDF({ periodeLabel, filenameMonth, totals, expenseByCat, incomeByCat, investments })
  → jsPDF + AutoTable generate dokumen
  → browser auto-download file PDF
```

`exportReportPDF` adalah fungsi pure — menerima data mentah, tidak mengakses DOM, tidak ada side effect selain trigger download.

---

## Struktur PDF

1. **Header** — "Laporan Keuangan" + label periode (contoh: "Bulan ini: April 2026")
2. **Summary** — 3 baris teks: Total Pemasukan, Total Pengeluaran, Net
3. **Tabel: Pengeluaran per Kategori** — kolom: Kategori | Total
4. **Tabel: Pemasukan per Kategori** — kolom: Kategori | Total
5. **Tabel: Kinerja Investasi** — kolom: Nama Aset | Modal | Nilai Kini | Gain/Loss

---

## Nama File

Format: `laporan-keuangan-{filenameMonth}.pdf`

| Preset | filenameMonth |
|--------|--------------|
| `month` | `2026-04` |
| `year` | `2026` |
| `today` | `2026-04-20` |
| `all` | `semua` |
| `custom` (ada `from`) | ambil YYYY-MM dari `from` |
| `custom` (tanpa `from`) | `kustom` |

---

## Interface `exportReportPDF`

```ts
interface ExportReportParams {
  periodeLabel: string        // ditampilkan di PDF header
  filenameMonth: string       // bagian nama file
  totals: {
    income: number
    expense: number
    net: number
  }
  expenseByCat: { category: string; total: number }[]
  incomeByCat:  { category: string; total: number }[]
  investments:  { name: string; modal: number; nilai: number }[]
}
```

---

## Edge Cases

| Kondisi | Perilaku |
|---------|----------|
| `expenseByCat` kosong | Tabel tampil dengan baris "Tidak ada data pada periode ini" |
| `incomeByCat` kosong | Sama seperti di atas |
| `investments` kosong | Tabel tampil dengan baris "Belum ada investasi" |
| Semua data 0 | PDF tetap di-generate, tidak di-block |
| jsPDF throw error | `try/catch` → toast error via `sonner` |

---

## UI Tombol

- Komponen: `Button` (dari `src/components/ui/button.tsx`)
- Icon: `Download` dari `lucide-react`
- Label: "Export PDF"
- Posisi: ujung kanan baris filter di `ReportsTab`
- State: `disabled` selama generate berlangsung (cegah double-click)
- Generate bersifat sinkron, tidak perlu loading spinner

---

## Yang Tidak Dikerjakan

- Grafik/chart tidak di-include ke PDF (tidak pakai `html2canvas`)
- Tidak ada preview PDF sebelum download
- Tidak ada opsi konfigurasi konten oleh user

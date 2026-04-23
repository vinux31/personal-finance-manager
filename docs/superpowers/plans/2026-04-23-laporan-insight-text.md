# Laporan Insight Text Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tambahkan teks analisis/kesimpulan otomatis di bawah tiap grafik di tab Laporan, dihasilkan secara rule-based dari data aktual.

**Architecture:** Satu file baru `src/lib/report-insights.ts` berisi 4 pure functions yang masing-masing menerima data dan mengembalikan `InsightLine[]`. Komponen `Panel` di `ReportsTab.tsx` diperluas dengan prop `insight?` yang merender baris teks berdot-warna di bawah grafik.

**Tech Stack:** TypeScript, React, Tailwind CSS. Tidak ada dependency baru.

---

## File Map

| File | Action | Keterangan |
|---|---|---|
| `src/lib/report-insights.ts` | Create | 4 pure functions + type `InsightLine` |
| `src/tabs/ReportsTab.tsx` | Modify | Extend `Panel`, tambah `useMemo` per section |

---

## Task 1: Buat `src/lib/report-insights.ts` dengan type dan fungsi Period

**Files:**
- Create: `src/lib/report-insights.ts`

- [ ] **Step 1: Buat file dengan type InsightLine dan fungsi generatePeriodInsight**

Buat file `src/lib/report-insights.ts` dengan konten berikut:

```ts
import { shortRupiah } from '@/lib/format'
import type { PeriodAgg, CategoryAgg } from '@/db/reports'

export type InsightLine = { text: string; tone: 'positive' | 'negative' | 'neutral' }

type Totals = { income: number; expense: number; net: number }
type InvestmentRow = { name: string; modal: number; nilai: number }

export function generatePeriodInsight(totals: Totals, periodData: PeriodAgg[]): InsightLine[] {
  const lines: InsightLine[] = []

  if (totals.net === 0) {
    lines.push({ text: 'Pemasukan dan pengeluaran seimbang pada periode ini.', tone: 'neutral' })
  } else if (totals.net > 0) {
    lines.push({ text: `Net surplus sebesar ${shortRupiah(totals.net)} pada periode ini.`, tone: 'positive' })
  } else {
    lines.push({ text: `Net defisit sebesar ${shortRupiah(Math.abs(totals.net))} pada periode ini.`, tone: 'negative' })
  }

  if (periodData.length > 0) {
    const peak = periodData.reduce((a, b) => Number(b.expense) > Number(a.expense) ? b : a)
    lines.push({ text: `Pengeluaran terbesar terjadi pada ${peak.period} (${shortRupiah(Number(peak.expense))}).`, tone: 'neutral' })
  }

  if (periodData.length >= 2) {
    const last = Number(periodData[periodData.length - 1].expense)
    const prev = Number(periodData[periodData.length - 2].expense)
    if (last > prev) {
      lines.push({ text: 'Pengeluaran meningkat dibanding periode sebelumnya.', tone: 'negative' })
    } else if (last < prev) {
      lines.push({ text: 'Pengeluaran menurun dibanding periode sebelumnya.', tone: 'positive' })
    }
  }

  return lines
}

export function generateExpenseCatInsight(expenseByCat: CategoryAgg[]): InsightLine[] {
  if (expenseByCat.length === 0) return []
  const lines: InsightLine[] = []
  const total = expenseByCat.reduce((s, c) => s + Number(c.total), 0)
  const sorted = [...expenseByCat].sort((a, b) => Number(b.total) - Number(a.total))

  const top = sorted[0]
  const pct = total > 0 ? Math.round((Number(top.total) / total) * 100) : 0
  lines.push({ text: `Kategori terbesar: ${top.category} sebesar ${shortRupiah(Number(top.total))} (${pct}%).`, tone: 'neutral' })

  if (sorted.length >= 2) {
    const second = sorted[1]
    const pct2 = total > 0 ? Math.round((Number(second.total) / total) * 100) : 0
    lines.push({ text: `Diikuti oleh ${second.category} (${shortRupiah(Number(second.total))}, ${pct2}%).`, tone: 'neutral' })
  }

  if (pct > 50) {
    lines.push({ text: `${top.category} mendominasi lebih dari separuh total pengeluaran.`, tone: 'negative' })
  }

  return lines
}

export function generateIncomeCatInsight(incomeByCat: CategoryAgg[], periodData: PeriodAgg[]): InsightLine[] {
  if (incomeByCat.length === 0) return []
  const lines: InsightLine[] = []
  const total = incomeByCat.reduce((s, c) => s + Number(c.total), 0)
  const sorted = [...incomeByCat].sort((a, b) => Number(b.total) - Number(a.total))

  const top = sorted[0]
  const pct = total > 0 ? Math.round((Number(top.total) / total) * 100) : 0
  lines.push({ text: `Sumber pemasukan terbesar: ${top.category} (${shortRupiah(Number(top.total))}, ${pct}%).`, tone: 'neutral' })

  lines.push({ text: `Total ${incomeByCat.length} sumber pemasukan aktif pada periode ini.`, tone: 'neutral' })

  if (periodData.length >= 2) {
    const last = Number(periodData[periodData.length - 1].income)
    const prev = Number(periodData[periodData.length - 2].income)
    if (last > prev) {
      lines.push({ text: 'Pemasukan meningkat dibanding periode sebelumnya.', tone: 'positive' })
    } else if (last < prev) {
      lines.push({ text: 'Pemasukan menurun dibanding periode sebelumnya.', tone: 'negative' })
    }
  }

  return lines
}

export function generateInvestmentInsight(investments: InvestmentRow[]): InsightLine[] {
  if (investments.length === 0) return []
  const lines: InsightLine[] = []

  const totalModal = investments.reduce((s, i) => s + i.modal, 0)
  const totalNilai = investments.reduce((s, i) => s + i.nilai, 0)
  const returnNominal = totalNilai - totalModal
  const returnPct = totalModal > 0 ? ((returnNominal / totalModal) * 100).toFixed(1) : '0.0'

  if (returnNominal >= 0) {
    lines.push({ text: `Total investasi untung ${shortRupiah(returnNominal)} dari modal ${shortRupiah(totalModal)} (return ${returnPct}%).`, tone: 'positive' })
  } else {
    lines.push({ text: `Total investasi rugi ${shortRupiah(Math.abs(returnNominal))} dari modal ${shortRupiah(totalModal)} (return ${returnPct}%).`, tone: 'negative' })
  }

  const withReturn = investments.map(i => ({ ...i, ret: i.nilai - i.modal }))
  const best = withReturn.reduce((a, b) => b.ret > a.ret ? b : a)
  const worst = withReturn.reduce((a, b) => b.ret < a.ret ? b : a)

  if (best.ret > 0) {
    lines.push({ text: `Aset dengan return terbaik: ${best.name} (+${shortRupiah(best.ret)}).`, tone: 'positive' })
  }
  if (worst.ret < 0) {
    lines.push({ text: `Aset dengan return terburuk: ${worst.name} (-${shortRupiah(Math.abs(worst.ret))}).`, tone: 'negative' })
  }

  return lines
}
```

- [ ] **Step 2: Verifikasi TypeScript compile**

```bash
npx tsc --noEmit
```

Expected: tidak ada error. Jika ada error tipe, perbaiki sebelum lanjut.

- [ ] **Step 3: Commit**

```bash
git add src/lib/report-insights.ts
git commit -m "feat: tambah report-insights pure functions"
```

---

## Task 2: Update komponen `Panel` di `ReportsTab.tsx`

**Files:**
- Modify: `src/tabs/ReportsTab.tsx`

- [ ] **Step 1: Import InsightLine dan fungsi-fungsi insight**

Di bagian atas `src/tabs/ReportsTab.tsx`, tambahkan import:

```ts
import {
  type InsightLine,
  generatePeriodInsight,
  generateExpenseCatInsight,
  generateIncomeCatInsight,
  generateInvestmentInsight,
} from '@/lib/report-insights'
```

- [ ] **Step 2: Tambah prop `insight` ke komponen Panel**

Cari fungsi `Panel` di bagian bawah file (sekitar baris 228):

```tsx
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <h3 className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      {children}
    </div>
  )
}
```

Ganti dengan:

```tsx
function Panel({ title, children, insight }: { title: string; children: React.ReactNode; insight?: InsightLine[] }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <h3 className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      {children}
      {insight && insight.length > 0 && (
        <div className="mt-4 border-t pt-3 space-y-1">
          {insight.map((line, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                line.tone === 'positive' ? 'bg-emerald-500' :
                line.tone === 'negative' ? 'bg-red-500' :
                'bg-muted-foreground/40'
              }`} />
              <span className="text-sm text-muted-foreground">{line.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Tambah useMemo untuk tiap insight di dalam ReportsTab**

Di dalam fungsi `ReportsTab`, setelah blok `useMemo` untuk `investments` (sekitar baris 36–39), tambahkan 4 blok useMemo baru:

```tsx
const periodInsight = useMemo(
  () => generatePeriodInsight(totals, periodData),
  [totals, periodData]
)

const expenseCatInsight = useMemo(
  () => generateExpenseCatInsight(expenseByCat),
  [expenseByCat]
)

const incomeCatInsight = useMemo(
  () => generateIncomeCatInsight(incomeByCat, periodData),
  [incomeByCat, periodData]
)

const investmentInsight = useMemo(
  () => generateInvestmentInsight(investments),
  [investments]
)
```

Catatan: `totals` dan `investments` sudah ada sebagai `useMemo` sebelumnya — gunakan nilai tersebut langsung.

- [ ] **Step 4: Pasang prop insight ke tiap Panel**

Di dalam JSX `ReportsTab`, update tiap `<Panel>` dengan prop `insight`:

```tsx
<Panel title="Pemasukan vs Pengeluaran" insight={periodInsight}>
```

```tsx
<Panel title="Pengeluaran per Kategori" insight={expenseCatInsight}>
```

```tsx
<Panel title="Pemasukan per Kategori" insight={incomeCatInsight}>
```

```tsx
<Panel title="Kinerja Investasi" insight={investmentInsight}>
```

- [ ] **Step 5: Verifikasi TypeScript compile**

```bash
npx tsc --noEmit
```

Expected: tidak ada error.

- [ ] **Step 6: Jalankan dev server dan buka tab Laporan**

```bash
npm run dev
```

Buka browser di `http://localhost:5173` → tab Laporan.

Verifikasi manual:
- Tiap panel menampilkan 2–3 baris teks di bawah grafik
- Dot hijau muncul untuk kondisi positif (net surplus, return positif)
- Dot merah muncul untuk kondisi negatif (defisit, rugi investasi)
- Dot abu-abu untuk teks informatif/netral
- Jika tidak ada data pada satu panel, tidak ada teks insight yang muncul
- Periode dengan hanya 1 data point tidak menampilkan baris tren

- [ ] **Step 7: Commit**

```bash
git add src/tabs/ReportsTab.tsx
git commit -m "feat: tampilkan teks insight otomatis di tiap panel Laporan"
```

# Design: Teks Insight Otomatis di Tab Laporan

**Tanggal:** 2026-04-23
**Status:** Approved

## Ringkasan

Menambahkan teks analisis/kesimpulan otomatis di tab Laporan, di bawah tiap section grafik. Teks dihasilkan oleh rule-based logic di frontend berdasarkan data aktual, bukan AI/LLM. Tujuannya agar pengguna langsung memahami makna dari data yang ditampilkan tanpa harus menginterpretasi sendiri.

## Arsitektur

### File Baru: `src/lib/report-insights.ts`

Berisi 4 pure functions, masing-masing menerima data dan mengembalikan `InsightLine[]`:

```ts
type InsightLine = { text: string; tone: 'positive' | 'negative' | 'neutral' }
```

| Fungsi | Input | Output |
|---|---|---|
| `generatePeriodInsight(totals, periodData)` | Totals + array periode | Insight panel "Pemasukan vs Pengeluaran" |
| `generateExpenseCatInsight(expenseByCat)` | Array kategori pengeluaran | Insight panel "Pengeluaran per Kategori" |
| `generateIncomeCatInsight(incomeByCat)` | Array kategori pemasukan | Insight panel "Pemasukan per Kategori" |
| `generateInvestmentInsight(investments)` | Array investasi (modal, nilai) | Insight panel "Kinerja Investasi" |

Semua fungsi adalah pure functions — tidak ada side effects, mudah di-test.

### Perubahan di `src/tabs/ReportsTab.tsx`

- Komponen `Panel` ditambah prop opsional `insight?: InsightLine[]`
- Di dalam `Panel`, jika `insight` ada dan tidak kosong, render section insight di bawah grafik
- Tiap `Panel` memanggil fungsi insight-nya masing-masing via `useMemo`

## Logika Insight per Section

### Panel "Pemasukan vs Pengeluaran"
1. Net positif/negatif: `"Net [surplus/defisit] sebesar Rp X pada periode ini."` → tone positive/negative
2. Periode tertinggi pengeluaran: `"Pengeluaran terbesar terjadi pada [periode] (Rp X)."` → tone neutral
3. Tren (jika data ≥ 2 periode): `"Pengeluaran [meningkat/menurun] dibanding periode sebelumnya."` → tone negative/positive

### Panel "Pengeluaran per Kategori"
1. Kategori terbesar: `"Kategori terbesar: [nama] sebesar Rp X (Y%)."` → tone neutral
2. Kategori kedua (jika ada): `"Diikuti oleh [nama] (Rp X, Y%)."` → tone neutral
3. Dominasi (jika satu kategori >50%): `"[Nama] mendominasi lebih dari separuh total pengeluaran."` → tone negative

### Panel "Pemasukan per Kategori"
1. Sumber terbesar: `"Sumber pemasukan terbesar: [nama] (Rp X, Y%)."` → tone neutral
2. Jumlah sumber: `"Total [N] sumber pemasukan aktif pada periode ini."` → tone neutral

### Panel "Kinerja Investasi"
1. Total return: `"Total investasi [untung/rugi] Rp X dari modal Rp Y (return Z%)."` → tone positive/negative. Z% = (totalNilai - totalModal) / totalModal × 100, dibulatkan 1 desimal.
2. Aset terbaik (jika ada profit): `"Aset dengan return terbaik: [nama] (+Rp X)."` → tone positive
3. Aset terburuk (jika ada rugi): `"Aset dengan return terburuk: [nama] (-Rp X)."` → tone negative

## Tampilan UI

Lokasi: Di dalam `Panel`, di bawah grafik, dipisah oleh `border-t mt-4 pt-3`.

Tiap `InsightLine` ditampilkan sebagai satu baris:
- Dot berwarna di kiri: hijau (`bg-emerald-500`) = positive, merah (`bg-red-500`) = negative, abu-abu = neutral
- Teks: `text-sm text-muted-foreground`

Jika data kosong (tidak ada transaksi/investasi), section insight tidak dirender — tidak ada teks placeholder.

## Constraints

- Tidak menggunakan AI/LLM — semua logika rule-based di frontend
- Tidak ada network request tambahan
- Insight menggunakan data yang sudah di-fetch oleh komponen (tidak ada query baru)
- Jika data periode hanya 1 titik, insight tren tidak ditampilkan

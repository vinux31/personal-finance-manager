# Diskusi: Integrasi DividendTracker ke pfm-web

**Tanggal:** 2026-04-21

## Konteks

Ada project terpisah bernama **DividendTracker** di Desktop yang belum dimulai eksekusinya. Setelah dibandingkan dengan pfm-web, diputuskan lebih baik digabung.

## Tentang DividendTracker (project yang akan digabung)

**Tujuan:** Tracker portofolio saham dividen Indonesia (BEI) dengan strategi Harvard Endowment.

**Detail investasi:**
- Modal awal: Rp 10 juta (10 saham BEI)
- Top-up bulanan: Rp 1 juta
- Target yield: 3-5% dengan pertumbuhan dividen 6-10%
- Proyeksi Year 10: ~Rp 157.500/bulan income dividen

**10 Saham Pre-loaded:**
1. BBCA (Bank Central Asia) - Finance, 2.5% yield, 8% growth
2. UNVR (Unilever Indonesia) - Consumer Staples, 3.2% yield
3. TLKM (Telkom Indonesia) - Telecom, 4.5% yield
4. ICBP (Indofood CBP) - Consumer Staples, 2.8% yield
5. GGRM (Gudang Garam) - Consumer Staples, 6.5% yield
6. PGAS (Perusahaan Gas Negara) - Energy, 5.2% yield
7. ITMG (Indo Tambangraya) - Energy/Coal, 8% yield
8. AALI (Astra Agro Lestari) - Plantation, 4.8% yield
9. ADRO (Adaro Energy) - Energy/Coal, 7% yield
10. BSDE (Bumi Serpong Damai) - Real Estate, 5.5% yield

## Fitur yang Direncanakan (dari DividendTracker)

1. **Portfolio Tracking** — Tabel holdings: ticker, lot, harga, nilai, yield, income tahunan
2. **Dividend Calendar** — Kalender visual 12 bulan menampilkan jadwal dividen tiap saham
3. **10-Year Projection** — Kalkulator interaktif pertumbuhan portofolio dengan top-up bulanan
4. **Sector Analysis** — Pie chart alokasi sektor (Finance, Consumer Staples, Energy, dll.)
5. **Top-up Planner** — Rencana & tracking top-up Rp 1 juta/bulan dengan saran alokasi
6. **Hybrid Price Updates** — Fetch harga live (Yahoo Finance `.JK`) + manual override
7. **Transaction Log** — Catat beli/jual saham dengan cost basis dan realized gains

## Keputusan: Gabung ke pfm-web

**Alasan:**
- pfm-web sudah punya tab Investments — dividend tracking adalah natural extension
- pfm-web jauh lebih powerful: Supabase cloud sync, auth, dark mode, PDF export
- DividendTracker belum dimulai, tidak ada kode yang terbuang
- Satu app untuk semua financial tracking = UX lebih baik

**Pendekatan:** Tambah tab baru **"Dividen"** di pfm-web dengan semua fitur di atas.

## Yang Perlu Dilakukan

- [ ] Design skema Supabase untuk data dividen BEI (stocks, holdings, dividend_schedule, transactions)
- [ ] Buat tab "Dividen" baru di pfm-web
- [ ] Implementasi kalender dividen (komponen baru)
- [ ] Implementasi 10-year projection calculator
- [ ] Implementasi top-up planner
- [ ] Integrasi fetch harga Yahoo Finance `.JK` + manual fallback
- [ ] Integer arithmetic untuk currency Rupiah (hindari floating-point errors)
- [ ] Pre-load 10 saham BEI di atas sebagai data awal

## Referensi

- Project DividendTracker: `../DividendTracker/` (ada research & planning lengkap di `.planning/`)
- Research stack: `.planning/research/STACK.md`
- Requirements lengkap: `.planning/REQUIREMENTS.md`
- Roadmap original: `.planning/ROADMAP.md`

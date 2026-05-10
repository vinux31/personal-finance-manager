// Port verbatim dari docs/financial_framework.html lines 1167-1383 (Phase 15 D-01).
// Inline HTML markup (<em>, <strong>, <p class="pull">) preserved as raw strings.
// [[term]]label[[/term]] markers untuk inline glossary tooltip — replaced runtime di ModulRenderer.
//
// SECURITY: ALL strings here are trusted authored content. NEVER concat user input
// into these fields. Wave 2 ModulRenderer feeds them to dangerouslySetInnerHTML.

import type { GlossaryTerm } from '@/data/glossary'

export type ModulSlug =
  | 'arus-kas'
  | 'tujuan'
  | 'alokasi-aset'
  | 'instrumen'
  | 'pajak-biaya-inflasi'
  | 'perilaku'

export type ModulTheory = {
  head: string
  body: string         // inline HTML allowed
  list?: string[]      // inline HTML allowed per item
  body2?: string       // optional second body block (modul 03/05/06)
}

export type ModulPractice = {
  head: string
  case: {
    title: string
    body: string       // inline HTML allowed
    tag: string
  }
}

export type ModulCheckOption = {
  t: string
  correct: boolean     // kept for future v2 quiz interactive; D-04 prose-only ignores
}

export type ModulCheck = {
  q: string
  opts: ModulCheckOption[]
  feedback: string     // shown prose-only per D-04 sebagai "Jawaban + penjelasan" reveal-style atau collapsed
}

export type ModulData = {
  n: string            // '01' .. '06' (display number, two-digit string)
  title: string        // inline HTML allowed (<em> wraps)
  desc: string         // 1-line teaser, no HTML
  time: string         // '2 JAM' format
  stage: string        // 'PROTECTION' | 'PLANNING' | etc — display tag
  theory: ModulTheory
  practice: ModulPractice
  check: ModulCheck
}

export const MODUL_CONTENT: Record<ModulSlug, ModulData> = {
  'arus-kas': {
    n: '01',
    title: 'Pondasi & <em>Cash Flow</em>',
    desc: 'Anggaran 50/30/20, dana darurat, dan mengapa stabilitas cash flow lebih penting dari return.',
    time: '2 JAM',
    stage: 'PROTECTION',
    theory: {
      head: 'Teori Inti',
      body: `<p>Stabilitas cash flow adalah <em>oksigen</em> untuk semua keputusan finansial selanjutnya. Tanpa surplus bulanan yang konsisten, investasi hanya akan dilikuidasi saat darurat — sering pada timing terburuk.</p>
<p class="pull">"Investing should be more like watching paint dry. If you want excitement, take Rp 12 juta and go to Las Vegas." — Paul Samuelson</p>
<p>Tiga metrik dasar yang harus Anda hitung bulan ini juga:</p>`,
      list: [
        '<strong>[[savings-rate-marker]]Savings Rate[[/savings-rate-marker]]:</strong> (Pemasukan − Pengeluaran) / Pemasukan. Target intermediate: 20–30%.',
        '<strong>Emergency Fund Ratio:</strong> Dana likuid / pengeluaran bulanan. Target: 6–12× untuk freelancer, 3–6× untuk karyawan tetap.',
        '<strong>Debt-to-Income:</strong> Cicilan bulanan / take-home. Maksimal 30%, idealnya kurang dari 20%.',
      ],
    },
    practice: {
      head: 'Praktik & Studi Kasus',
      case: {
        title: 'Studi Kasus: Rio, 31, marketing manager Jakarta',
        body: `<p>Take-home Rp 18 juta. Cicilan KPR Rp 6,5 jt + cicilan mobil Rp 3,5 jt = DTI 55%. Dana darurat hanya Rp 5 jt.</p><p>Diagnosis: <em>Wealth protection bocor.</em> Sebelum bicara saham atau crypto, prioritas Rio adalah refinance/jual mobil, lalu bangun dana darurat 6 bulan (≈ Rp 60 jt) di reksadana pasar uang.</p>`,
        tag: 'KONTEKS: INDONESIA',
      },
    },
    check: {
      q: 'Anda punya bonus tahunan Rp 50 juta. Dana darurat Anda baru 1 bulan pengeluaran, dan Anda punya cicilan kartu kredit 24% p.a. sebesar Rp 30 jt. Prioritas pertama:',
      opts: [
        { t: 'Investasi semua di reksadana saham — 50jt × 9% adalah Rp 4,5jt setahun.', correct: false },
        { t: 'Lunasi kartu kredit dulu (24% guaranteed return), sisanya ke dana darurat.', correct: true },
        { t: 'Bagi rata: 1/3 saham, 1/3 emas, 1/3 deposito.', correct: false },
      ],
      feedback: 'Bunga utang konsumtif 24% adalah "investasi" dengan return tertinggi yang pasti — Anda mustahil dapat 24% guaranteed di pasar. Setelah itu, dana darurat menjadi prioritas berikutnya sebelum aset risk-on.',
    },
  },

  'tujuan': {
    n: '02',
    title: 'Tujuan, <em>Time Horizon</em>, & Risiko',
    desc: 'Memetakan tujuan ke alokasi aset. Mengapa "agresif" untuk tujuan 3 tahun adalah salah kaprah.',
    time: '2,5 JAM',
    stage: 'PLANNING',
    theory: {
      head: 'Teori Inti',
      body: `<p>Setiap tujuan finansial punya <em>time horizon</em> berbeda — dan time horizon adalah penentu utama alokasi yang tepat, bukan "[[risk-tolerance]]profil risiko[[/risk-tolerance]]" Anda secara umum.</p>
<p class="pull">Anda bisa agresif di dana pensiun (30 tahun) dan konservatif di DP rumah (3 tahun) — di waktu yang sama.</p>
<p>Pemetaan klasik:</p>`,
      list: [
        '<strong>&lt; 1 tahun (likuid):</strong> Reksadana pasar uang, deposito. Tujuan: kepastian, bukan return.',
        '<strong>1–3 tahun (jangka pendek):</strong> RDPU + obligasi tenor pendek (SBR/ORI). Saham = terlalu berisiko.',
        '<strong>3–7 tahun (menengah):</strong> Mix obligasi & saham 40/60 atau 60/40. DP rumah masuk sini.',
        '<strong>&gt; 7 tahun (panjang):</strong> Boleh agresif: 70–90% saham, sisanya obligasi/emas.',
      ],
    },
    practice: {
      head: 'Praktik & Studi Kasus',
      case: {
        title: 'Studi Kasus: Salah alokasi yang umum',
        body: `<p>Maya, 28, ingin DP rumah Rp 200jt dalam 2 tahun. Dia "tahu" investasi jangka panjang menang, jadi semua tabungan DP-nya di reksadana saham. 18 bulan kemudian, IHSG turun 22%.</p><p>Pelajaran: <em>Time horizon mengalahkan keyakinan.</em> Untuk tujuan 2 tahun, recovery dari [[drawdown]]drawdown[[/drawdown]] sering tidak cukup waktu. Maya seharusnya pakai SBR atau RDPU.</p>`,
        tag: 'KONTEKS: GLOBAL & INDONESIA',
      },
    },
    check: {
      q: 'Anda 35 tahun, ingin pensiun di 60. Tujuan pensiun ini paling tepat dialokasikan:',
      opts: [
        { t: '100% deposito — uang pensiun harus aman.', correct: false },
        { t: '70–90% saham (campuran IDX + global), sisanya obligasi/emas. Rebalance tahunan.', correct: true },
        { t: '100% saham emerging market untuk return maksimal.', correct: false },
      ],
      feedback: 'Time horizon 25 tahun memungkinkan menyerap volatilitas saham, dan deposito akan kalah dari inflasi. Tapi 100% emerging market saja terlalu terkonsentrasi — diversifikasi geografis (mis. ETF S&P 500 + IDX) menurunkan risiko tanpa banyak korban return.',
    },
  },

  'alokasi-aset': {
    n: '03',
    title: '<em>Asset Allocation</em> & Diversifikasi',
    desc: 'Mengapa alokasi menentukan ~90% return jangka panjang, bukan stock picking.',
    time: '3 JAM',
    stage: 'STRATEGY',
    theory: {
      head: 'Teori Inti',
      body: `<p>Studi Brinson, Hood, & Beebower (1986, diperbarui berkali-kali) menunjukkan bahwa <em>[[asset-allocation]]asset allocation[[/asset-allocation]]</em> menjelaskan sebagian besar variasi return portofolio jangka panjang — pemilihan saham individual jauh lebih kecil pengaruhnya.</p>
<p>Untuk membandingkan efisiensi alokasi antar portofolio, akademisi & manajer investasi pakai [[sharpe-ratio]]rasio Sharpe[[/sharpe-ratio]] — semakin tinggi rasio, semakin baik return per unit risiko.</p>
<p>Diversifikasi bekerja di tiga dimensi:</p>`,
      list: [
        '<strong>Antar kelas aset:</strong> Saham, obligasi, kas, properti, komoditas. Korelasi rendah = portfolio lebih stabil.',
        '<strong>Antar geografi:</strong> IDX saja terlalu terkonsentrasi. Tambahkan global (S&P 500, MSCI World) lewat reksadana indeks atau ETF.',
        '<strong>Antar waktu (time diversification):</strong> [[dca]]DCA[[/dca]] mengurangi risiko entry pada satu titik harga.',
      ],
      body2: `<p class="pull">Don't look for the needle in the haystack. Just buy the haystack. — John C. Bogle</p>`,
    },
    practice: {
      head: 'Praktik & Studi Kasus',
      case: {
        title: 'Portofolio Lazy 3-Fund (versi Indonesia)',
        body: `<p>Kerangka sederhana yang mengalahkan mayoritas reksadana aktif jangka panjang:</p><p>• 50% reksadana indeks IHSG / LQ45<br>• 30% reksadana indeks global (S&P 500 atau MSCI World)<br>• 20% obligasi (SBN ritel, SBR, ORI, FR via reksadana)</p><p>[[rebalancing]]Rebalance[[/rebalancing]] tahunan. Total [[expense-ratio]]expense ratio[[/expense-ratio]]: ~0,5%. Strategi ini "membosankan" — dan itulah kekuatannya.</p>`,
        tag: 'TEMPLATE: ALOKASI',
      },
    },
    check: {
      q: 'Portofolio Anda awalnya 60% saham, 40% obligasi. Setelah 1 tahun bull market saham, alokasi jadi 75% saham, 25% obligasi. Tindakan rebalancing yang benar:',
      opts: [
        { t: 'Tidak melakukan apa-apa — saham sedang menang, biarkan saja.', correct: false },
        { t: 'Jual sebagian saham, beli obligasi sampai kembali ke 60/40.', correct: true },
        { t: 'Setor uang baru hanya ke saham karena momentumnya bagus.', correct: false },
      ],
      feedback: 'Rebalancing memaksa disiplin "sell high, buy low" — kebalikan dari naluri kebanyakan investor. Tanpa rebalancing, profil risiko Anda diam-diam berubah dan saat market koreksi, drawdown akan jauh lebih besar.',
    },
  },

  'instrumen': {
    n: '04',
    title: 'Instrumen <em>Indonesia</em> & Global',
    desc: 'Dari SBN ritel sampai ETF, dari reksadana sampai REIT — peta lengkap medan.',
    time: '3 JAM',
    stage: 'INSTRUMENTS',
    theory: {
      head: 'Teori Inti',
      body: `<p>Mengetahui instrumen yang ada bukan untuk dipakai semua — tapi untuk memilih yang <em>cocok dengan tujuan</em>. Berikut peta utama yang harus dikuasai investor intermediate:</p>`,
      list: [
        '<strong>SBN Ritel (SBR, ORI, ST, SR):</strong> Surat utang negara untuk ritel. Aman, kupon di atas deposito BUMN. Tenor 2–6 tahun.',
        '<strong>Reksadana Indeks IHSG/LQ45:</strong> Eksposur pasar Indonesia, biaya rendah (0,3–0,5%). Default untuk core portfolio.',
        '<strong>Reksadana Indeks Global:</strong> Akses ke S&P 500 / MSCI World via manajer investasi lokal. Penting untuk diversifikasi mata uang.',
        '<strong>ETF di IDX:</strong> R-LQ45, XIIT, XPLF, XISI dll. Lebih efisien biaya dari reksadana untuk dana besar.',
        '<strong>Saham individual:</strong> Setelah core terbentuk, maks 10–20% portofolio untuk eksplorasi tematik.',
        '<strong>Emas (logam mulia / digital):</strong> Hedge inflasi & geopolitik. 5–10% portofolio cukup.',
        '<strong>P2P Lending & Crypto:</strong> Risiko tinggi. Maks 5% portofolio. Bukan pengganti core.',
      ],
    },
    practice: {
      head: 'Praktik & Studi Kasus',
      case: {
        title: 'Mengapa "deposito BCA" sering bukan jawaban',
        body: `<p>Deposito BUMN/swasta besar 2026: ~4–5% p.a. Inflasi rata-rata Indonesia 2,5–4%. [[real-return]]Real return[[/real-return]]: ~0–2%. Pajak bunga 20% memotong lebih jauh.</p><p>SBR di OJK/Kemenkeu sering memberikan kupon 5,5–6,5% dengan pajak 10% — secara matematis hampir selalu mengalahkan deposito untuk fungsi yang sama (uang aman, jangka pendek-menengah).</p>`,
        tag: 'KONTEKS: INDONESIA 2026',
      },
    },
    check: {
      q: 'Untuk dana darurat 6 bulan pengeluaran, instrumen paling tepat:',
      opts: [
        { t: 'Reksadana saham — agar uangnya tumbuh sambil "menganggur".', correct: false },
        { t: 'Reksadana pasar uang (RDPU) atau tabungan dengan auto-debit.', correct: true },
        { t: 'SBR 4 tahun — kuponnya lebih tinggi dari deposito.', correct: false },
      ],
      feedback: 'Dana darurat butuh dua hal: (1) likuiditas instan, (2) tidak fluktuatif. RDPU mencairkan dalam 1–2 hari kerja dengan return ~3–4% p.a. SBR punya tenor mengikat — saat darurat, pasar sekunder mungkin rugi.',
    },
  },

  'pajak-biaya-inflasi': {
    n: '05',
    title: 'Pajak, <em>Biaya</em>, & Inflasi',
    desc: 'Tiga musuh diam yang menggerogoti return — dan cara menetralisirnya secara sistematis.',
    time: '2 JAM',
    stage: 'OPTIMIZATION',
    theory: {
      head: 'Teori Inti',
      body: `<p>Return brutto yang Anda lihat di brosur jarang sama dengan return yang masuk kantong. Tiga gerigi yang mengurangi setiap tahun:</p>`,
      list: [
        '<strong>Inflasi (~3% rata-rata):</strong> Mengikis daya beli. Yang Anda kejar adalah <em>[[real-return]]real return[[/real-return]]</em>, bukan nominal.',
        '<strong>Biaya manajer (0,3% – 3% p.a.):</strong> Reksadana aktif sering 1,5–2,5%. Indeks fund 0,3–0,5%. Selisih 1,5% × 30 tahun = portofolio Anda hanya separuhnya.',
        '<strong>Pajak:</strong> Bunga deposito 20%, kupon obligasi 10%, capital gain saham 0,1% transaksi. Reksadana: pajak ada di level instrumen, redemption tax-free.',
      ],
      body2: `<p class="pull">In investing, you get what you don't pay for. — John C. Bogle</p>`,
    },
    practice: {
      head: 'Praktik & Studi Kasus',
      case: {
        title: 'Aritmatika biaya 1% — yang sering diremehkan',
        body: `<p>Dua investor menyetor Rp 5jt/bulan selama 30 tahun di pasar yang sama-sama memberi 9% gross.</p><p>Investor A (reksadana indeks, [[expense-ratio]]biaya[[/expense-ratio]] 0,5%): Rp 7,8 miliar.<br>Investor B (reksadana aktif, biaya 2%): Rp 5,6 miliar.</p><p>Selisih Rp 2,2 miliar — dari 1,5% biaya per tahun. <em>Ini bukan biaya, ini transfer kekayaan.</em></p>`,
        tag: 'PERHITUNGAN: COMPOUND',
      },
    },
    check: {
      q: 'Reksadana saham A: return 5 tahun rata-rata 12%, biaya 2,5%. Reksadana indeks B: return 5 tahun rata-rata 10%, biaya 0,5%. Mana yang lebih masuk akal untuk core jangka panjang?',
      opts: [
        { t: 'A — 12% lebih besar dari 10%, jelas menang.', correct: false },
        { t: 'B — net return-nya 9,5% vs 9,5% sama, tapi B konsisten dengan benchmark dan tidak bergantung pada manajer.', correct: true },
        { t: 'Bagi rata 50/50 untuk diversifikasi.', correct: false },
      ],
      feedback: 'Studi SPIVA berulang kali menunjukkan: 70–85% reksadana aktif kalah dari indeks-nya dalam 10–15 tahun. Past outperformance jarang berlanjut. Indeks fund memberikan return pasar dikurangi biaya minimal — pilihan default yang rasional untuk core.',
    },
  },

  'perilaku': {
    n: '06',
    title: 'Behavioral Finance & <em>Disiplin</em>',
    desc: 'Mengapa investor pintar masih kalah dari pasar — dan checklist untuk tidak mengulanginya.',
    time: '2,5 JAM',
    stage: 'MASTERY',
    theory: {
      head: 'Teori Inti',
      body: `<p>Studi DALBAR tahunan menemukan: investor reksadana saham AS rata-rata mendapat ~3–4% lebih rendah dari reksadana yang mereka pegang. Penyebab: masuk-keluar di waktu salah. <em>Behavior gap.</em></p>
<p>Bias kognitif yang paling sering memakan portofolio:</p>`,
      list: [
        '<strong>Loss aversion:</strong> Kerugian terasa 2× lebih sakit dari keuntungan setara. Memicu jual saat panik.',
        '<strong>Recency bias:</strong> Asumsi tren terkini akan berlanjut. Mendorong "kejar yang lagi naik".',
        '<strong>Confirmation bias:</strong> Hanya mencari info yang membenarkan posisi. Buta terhadap red flag.',
        '<strong>Overconfidence:</strong> Setelah beberapa win, merasa "punya feeling". Memicu over-trading.',
        '<strong>FOMO:</strong> Takut ketinggalan crypto/saham viral. Membeli di puncak.',
      ],
      body2: `<p class="pull">The investor's chief problem — and even his worst enemy — is likely to be himself. — Benjamin Graham</p>`,
    },
    practice: {
      head: 'Praktik & Studi Kasus',
      case: {
        title: 'Investment Policy Statement (IPS) — Pertahanan Anda',
        body: `<p>IPS adalah dokumen 1 halaman yang Anda tulis saat <em>tenang</em> dan baca saat <em>panik</em>. Isinya:</p><p>1. Tujuan finansial & time horizon<br>2. Alokasi target & batas drift sebelum [[rebalancing]]rebalancing[[/rebalancing]]<br>3. Aturan setoran (mis. tanggal 5 setiap bulan)<br>4. Aturan eksplisit: "Saya tidak akan menjual saat IHSG turun > 20%"<br>5. Review schedule: 1× setahun, bukan setiap minggu</p><p>IPS adalah Ulysses mengikat dirinya ke tiang kapal — perlindungan dari diri sendiri.</p>`,
        tag: 'TOOL: TEMPLATE',
      },
    },
    check: {
      q: 'IHSG turun 30% dalam 2 bulan. Berita penuh prediksi resesi. IPS Anda mengatakan target alokasi 70/30 (saham/obligasi). Karena penurunan, alokasi sekarang 60/40. Tindakan terbaik:',
      opts: [
        { t: 'Jual semua saham, tunggu sampai jelas pasar pulih.', correct: false },
        { t: 'Rebalance ke 70/30 sesuai IPS — beli saham yang sudah diskon dengan dana obligasi.', correct: true },
        { t: 'Berhenti setor sampai pasar stabil.', correct: false },
      ],
      feedback: 'Rebalancing saat market crash adalah momen tersulit secara psikologis dan paling menguntungkan secara matematis. Setiap koreksi besar adalah test apakah IPS Anda nyata atau hanya teori. Investor yang membeli saat panik pada 2008, 2020, dan 2022 mendapat return luar biasa dalam 3–5 tahun setelahnya.',
    },
  },
}

// Catalog order untuk footer prev/next nav (D-05 wrap-around). Source: MODUL_CATALOG.
export const MODUL_ORDER: readonly ModulSlug[] = [
  'arus-kas',
  'tujuan',
  'alokasi-aset',
  'instrumen',
  'pajak-biaya-inflasi',
  'perilaku',
] as const

// Re-export for ModulRenderer marker validation (avoid duplicate union maintenance).
export type { GlossaryTerm }

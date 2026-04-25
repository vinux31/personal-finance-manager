export type PanduanStep = {
  number: number
  text: string
  detail?: string
}

export type PanduanSection = {
  heading: string
  intro?: string
  steps: PanduanStep[]
  tip?: string
}

export type PanduanTopic = {
  slug: string
  title: string
  category: 'fitur' | 'skenario'
  summary: string
  sections: PanduanSection[]
}

export const PANDUAN_TOPICS: PanduanTopic[] = [
  {
    slug: 'dashboard',
    title: 'Dashboard',
    category: 'fitur',
    summary: 'Baca ringkasan keuangan harian dan progress Rencana.',
    sections: [
      {
        heading: 'Memahami kartu ringkasan',
        intro: 'Dashboard menampilkan ringkasan keuangan bulan berjalan saat dibuka.',
        steps: [
          { number: 1, text: 'Buka tab Dashboard.' },
          { number: 2, text: 'Lihat 3 kartu di atas: Pemasukan, Pengeluaran, dan Net (selisih) bulan ini.' },
          { number: 3, text: 'Lihat kartu Portofolio Investasi: total modal, nilai sekarang, dan persentase gain/loss.' },
          { number: 4, text: 'Scroll ke bawah untuk widget 5 transaksi terbaru dan 4 goals teratas dengan progress bar.' },
        ],
        tip: 'Net hijau = surplus, merah = defisit bulan ini.',
      },
      {
        heading: 'Membaca RencanaBar',
        steps: [
          { number: 1, text: 'Cari progress bar "Rencana Keuangan" di area atas Dashboard.' },
          { number: 2, text: 'Bar menampilkan total terkumpul vs target Rencana (default Rp 257 juta, Jan 2027).' },
          { number: 3, text: 'Persentase kanan = (terkumpul ÷ target) × 100%.' },
        ],
        tip: 'Target & nama Rencana bisa diubah dari Pengaturan → Rencana.',
      },
    ],
  },
  {
    slug: 'transaksi',
    title: 'Transaksi',
    category: 'fitur',
    summary: 'Catat pemasukan & pengeluaran harian.',
    sections: [
      {
        heading: 'Menambah transaksi baru',
        steps: [
          { number: 1, text: 'Buka tab Transaksi.' },
          { number: 2, text: 'Klik tombol "Tambah Transaksi" di kanan atas.' },
          { number: 3, text: 'Pilih Jenis: Pemasukan atau Pengeluaran.' },
          { number: 4, text: 'Isi tanggal, kategori, jumlah (Rp), dan catatan opsional.' },
          { number: 5, text: 'Klik "Simpan".', detail: 'Transaksi langsung muncul di daftar dan ringkasan Dashboard ter-update.' },
        ],
        tip: 'Warna hijau = pemasukan, merah = pengeluaran.',
      },
      {
        heading: 'Menyaring transaksi',
        steps: [
          { number: 1, text: 'Gunakan filter periode di atas tabel: Bulan ini / Tahun ini / Semua / Kustom.' },
          { number: 2, text: 'Pilih kategori untuk lihat hanya jenis tertentu.' },
          { number: 3, text: 'Klik header kolom (Tanggal, Jumlah) untuk sorting.' },
        ],
      },
      {
        heading: 'Mengedit atau menghapus transaksi',
        steps: [
          { number: 1, text: 'Klik baris transaksi di daftar.' },
          { number: 2, text: 'Pilih "Edit" untuk ubah, "Hapus" untuk menghilangkan.' },
          { number: 3, text: 'Konfirmasi dialog jika menghapus.' },
        ],
      },
    ],
  },
  {
    slug: 'investasi',
    title: 'Investasi',
    category: 'fitur',
    summary: 'Pantau portofolio aset & performa gain/loss.',
    sections: [
      {
        heading: 'Menambah aset baru',
        steps: [
          { number: 1, text: 'Buka tab Investasi.' },
          { number: 2, text: 'Klik "Tambah Investasi".' },
          { number: 3, text: 'Pilih jenis aset (saham, reksadana, emas, kripto, obligasi, dll).' },
          { number: 4, text: 'Isi nama aset, jumlah unit/lot, harga beli per unit, dan tanggal beli.' },
          { number: 5, text: 'Klik "Simpan".' },
        ],
      },
      {
        heading: 'Update harga terkini',
        steps: [
          { number: 1, text: 'Cari aset di daftar Investasi.' },
          { number: 2, text: 'Klik ikon grafik (↗) di baris aset.' },
          { number: 3, text: 'Masukkan harga terkini per unit.' },
          { number: 4, text: 'Simpan — gain/loss otomatis terhitung dan riwayat harga tersimpan.' },
        ],
        tip: 'Riwayat harga dipakai grafik di tab Laporan untuk melihat tren portofolio.',
      },
    ],
  },
  {
    slug: 'kekayaan',
    title: 'Finansial → Kekayaan',
    category: 'fitur',
    summary: 'Catat aset & kewajiban untuk hitung Net Worth.',
    sections: [
      {
        heading: 'Membuka sub-tab Kekayaan',
        steps: [
          { number: 1, text: 'Buka tab Finansial.' },
          { number: 2, text: 'Pilih sub-tab "Kekayaan" (default).' },
        ],
      },
      {
        heading: 'Menambah aset',
        intro: 'Aset = hal yang Anda miliki (rumah, mobil, deposito, dll).',
        steps: [
          { number: 1, text: 'Klik "Tambah Aset".' },
          { number: 2, text: 'Isi nama aset, jenis (kas, properti, kendaraan, lainnya), dan nilai estimasi.' },
          { number: 3, text: 'Klik "Simpan".' },
        ],
      },
      {
        heading: 'Menambah kewajiban',
        intro: 'Kewajiban = utang/kredit yang harus Anda bayar.',
        steps: [
          { number: 1, text: 'Klik "Tambah Kewajiban".' },
          { number: 2, text: 'Isi nama (mis. KPR, KMG), saldo terutang, dan jenis.' },
          { number: 3, text: 'Klik "Simpan".' },
        ],
        tip: 'Net Worth = Total Aset − Total Kewajiban. Update nilai tiap bulan untuk tracking tren.',
      },
    ],
  },
  {
    slug: 'goals',
    title: 'Finansial → Goals',
    category: 'fitur',
    summary: 'Buat target keuangan dan tabung secara berkala.',
    sections: [
      {
        heading: 'Membuat goal baru',
        steps: [
          { number: 1, text: 'Buka tab Finansial → sub-tab Goals.' },
          { number: 2, text: 'Klik "Tambah Goal".' },
          { number: 3, text: 'Isi nama goal (mis. "Dana Darurat"), target jumlah (Rp), dan target tanggal.' },
          { number: 4, text: 'Simpan.' },
        ],
      },
      {
        heading: 'Menabung ke goal',
        steps: [
          { number: 1, text: 'Klik tombol "Tambah Uang" di kartu goal.' },
          { number: 2, text: 'Masukkan jumlah yang ditabung dan tanggal.' },
          { number: 3, text: 'Simpan — progress bar bergerak otomatis.' },
        ],
        tip: 'Jika terkumpul ≥ target, status goal otomatis berubah jadi "Tercapai".',
      },
      {
        heading: 'Menarik uang dari goal',
        steps: [
          { number: 1, text: 'Klik "Tarik Uang" di kartu goal.' },
          { number: 2, text: 'Masukkan jumlah penarikan dan alasan.' },
          { number: 3, text: 'Simpan — saldo goal berkurang.' },
        ],
      },
      {
        heading: 'Menghubungkan goal ke investasi',
        intro: 'Goal bisa dilink ke aset investasi — saldo ikut nilai investasi terkini.',
        steps: [
          { number: 1, text: 'Klik "Link Investasi" di kartu goal.' },
          { number: 2, text: 'Pilih aset investasi yang akan dihubungkan.' },
          { number: 3, text: 'Simpan — kontribusi goal mengikuti nilai aset terkini.' },
        ],
      },
    ],
  },
  {
    slug: 'pensiun',
    title: 'Pensiun',
    category: 'fitur',
    summary: 'Hitung dana pensiun terkumpul dan simulasi kebutuhan.',
    sections: [
      {
        heading: 'Hitung Total dana pensiun',
        steps: [
          { number: 1, text: 'Buka tab Pensiun.' },
          { number: 2, text: 'Pilih panel "Hitung Total".' },
          { number: 3, text: 'Sistem menjumlahkan saldo dari aset & investasi yang ditandai sebagai dana pensiun.' },
        ],
      },
      {
        heading: 'Menjalankan simulasi',
        steps: [
          { number: 1, text: 'Pilih panel "Simulasi" di tab Pensiun.' },
          { number: 2, text: 'Isi usia sekarang, usia pensiun target, dan estimasi pengeluaran bulanan saat pensiun.' },
          { number: 3, text: 'Atur asumsi inflasi dan return investasi.' },
          { number: 4, text: 'Lihat hasil: kebutuhan total saat pensiun + kekurangan/kelebihan vs dana terkumpul.' },
        ],
        tip: 'Panel "Panduan" di tab Pensiun berisi penjelasan asumsi simulasi.',
      },
    ],
  },
  {
    slug: 'laporan',
    title: 'Laporan',
    category: 'fitur',
    summary: 'Visualisasi grafik & insight teks dari data Anda.',
    sections: [
      {
        heading: 'Memilih periode laporan',
        steps: [
          { number: 1, text: 'Buka tab Laporan.' },
          { number: 2, text: 'Pilih periode di dropdown atas: Bulan ini / Tahun ini / Semua / Kustom.' },
        ],
      },
      {
        heading: 'Membaca grafik',
        steps: [
          { number: 1, text: 'Bar chart: pemasukan vs pengeluaran per hari/minggu/bulan.' },
          { number: 2, text: 'Pie chart: distribusi pengeluaran per kategori.' },
          { number: 3, text: 'Line chart: tren modal vs nilai investasi sepanjang waktu.' },
          { number: 4, text: 'Hover titik grafik untuk lihat angka detail.' },
        ],
      },
      {
        heading: 'Insight teks otomatis',
        steps: [
          { number: 1, text: 'Scroll ke section "Insight" di bawah grafik.' },
          { number: 2, text: 'Sistem otomatis menulis ringkasan: kategori pengeluaran terbesar, perubahan vs periode sebelumnya, dan saran.' },
        ],
      },
    ],
  },
  {
    slug: 'catatan',
    title: 'Catatan',
    category: 'fitur',
    summary: 'Catat pemikiran atau reminder keuangan.',
    sections: [
      {
        heading: 'Membuat catatan',
        steps: [
          { number: 1, text: 'Buka tab Catatan.' },
          { number: 2, text: 'Klik "Tambah Catatan".' },
          { number: 3, text: 'Isi judul, tanggal, dan isi bebas.' },
          { number: 4, text: 'Simpan.' },
        ],
        tip: 'Catatan panjang dipotong dengan "..." di tampilan kartu — klik untuk lihat lengkap.',
      },
      {
        heading: 'Mengedit/menghapus catatan',
        steps: [
          { number: 1, text: 'Klik kartu catatan.' },
          { number: 2, text: 'Pilih "Edit" untuk ubah, "Hapus" untuk hilangkan.' },
        ],
      },
    ],
  },
  {
    slug: 'pengaturan',
    title: 'Pengaturan',
    category: 'fitur',
    summary: 'Atur tema, target Rencana, akses pengguna, dan ekspor.',
    sections: [
      {
        heading: 'Mengubah tema',
        steps: [
          { number: 1, text: 'Buka tab Pengaturan.' },
          { number: 2, text: 'Section "Tampilan" → pilih Terang, Gelap, atau Sistem.' },
        ],
      },
      {
        heading: 'Mengatur Rencana Keuangan',
        steps: [
          { number: 1, text: 'Section "Rencana" menampilkan Total Target, Deadline, dan jumlah Goals aktif.' },
          { number: 2, text: 'Klik "Reset Seed Rencana" jika ingin menghapus goals & investasi hasil seed default.' },
          { number: 3, text: 'Buka Dashboard untuk inisialisasi ulang seed setelah reset.' },
        ],
      },
      {
        heading: 'Mengelola akses pengguna (admin)',
        steps: [
          { number: 1, text: 'Section "Pengguna" hanya muncul untuk akun admin.' },
          { number: 2, text: 'Tambah email baru ke allowlist via form di section.' },
          { number: 3, text: 'Klik "Hapus" untuk mencabut akses email yang sudah ada.' },
          { number: 4, text: 'Pakai "Lihat Keuangan" untuk view-as data pengguna lain (read-only).' },
        ],
      },
      {
        heading: 'Logout dari aplikasi',
        steps: [
          { number: 1, text: 'Klik avatar di kanan atas header.' },
          { number: 2, text: 'Pilih "Keluar".' },
          { number: 3, text: 'Konfirmasi dialog logout.' },
        ],
      },
    ],
  },
  {
    slug: 'skenario-gaji-tagihan',
    title: 'Mencatat gaji bulanan + tagihan rutin',
    category: 'skenario',
    summary: 'Setup template berulang untuk pemasukan tetap dan tagihan bulanan.',
    sections: [
      {
        heading: 'Persiapan',
        intro: 'Skenario ini cocok untuk pemasukan/pengeluaran tetap setiap bulan, mis. gaji Pertamina + tagihan listrik/internet.',
        steps: [
          { number: 1, text: 'Pastikan tab Transaksi sudah aktif dan Anda hafal nominal serta tanggal jatuh tempo.' },
        ],
      },
      {
        heading: 'Setup pemasukan gaji bulanan',
        steps: [
          { number: 1, text: 'Klik "Tambah Transaksi" di tab Transaksi.' },
          { number: 2, text: 'Pilih Jenis: Pemasukan, kategori "Gaji" (atau spesifik Pertamina jika tersedia).' },
          { number: 3, text: 'Aktifkan opsi "Berulang" → pilih frekuensi Bulanan, tanggal payday (mis. 25).' },
          { number: 4, text: 'Isi jumlah dan catatan, lalu Simpan sebagai template.' },
        ],
        tip: 'Template berulang otomatis muncul di panel Tagihan/Recurring tiap bulan.',
      },
      {
        heading: 'Setup tagihan rutin (listrik, internet, dll)',
        steps: [
          { number: 1, text: 'Klik "Tambah Transaksi" → pilih Pengeluaran.' },
          { number: 2, text: 'Pilih kategori (mis. "Listrik", "Internet"), aktifkan "Berulang" Bulanan.' },
          { number: 3, text: 'Set tanggal jatuh tempo dan estimasi nominal.' },
          { number: 4, text: 'Simpan template untuk setiap tagihan.' },
        ],
      },
      {
        heading: 'Verifikasi di Dashboard',
        steps: [
          { number: 1, text: 'Buka Dashboard.' },
          { number: 2, text: 'Cek panel "Tagihan Mendatang" — semua tagihan template harus muncul.' },
          { number: 3, text: 'Saat tagihan dibayar, klik "Tandai Dibayar" → transaksi otomatis tercatat.' },
        ],
      },
    ],
  },
  {
    slug: 'skenario-dana-darurat',
    title: 'Tracking dana darurat dari nol sampai tercapai',
    category: 'skenario',
    summary: 'Buat goal dana darurat, tabung berkala, pantau progress.',
    sections: [
      {
        heading: 'Membuat goal Dana Darurat',
        steps: [
          { number: 1, text: 'Buka Finansial → Goals → "Tambah Goal".' },
          { number: 2, text: 'Nama: "Dana Darurat".' },
          { number: 3, text: 'Target: 6× pengeluaran bulanan (cek angka di Laporan jika belum yakin).' },
          { number: 4, text: 'Target tanggal: realistis, mis. 18 bulan dari sekarang.' },
          { number: 5, text: 'Simpan.' },
        ],
      },
      {
        heading: 'Menabung berkala',
        steps: [
          { number: 1, text: 'Tiap kali transfer ke rekening dana darurat, klik "Tambah Uang" di kartu goal.' },
          { number: 2, text: 'Masukkan jumlah dan tanggal transfer.' },
          { number: 3, text: 'Progress bar otomatis bergerak.' },
        ],
        tip: 'Konsistensi > nominal besar. Tabung tiap payday meski sedikit.',
      },
      {
        heading: 'Memantau progress',
        steps: [
          { number: 1, text: 'Cek widget "Goals Aktif" di Dashboard tiap minggu.' },
          { number: 2, text: 'Lihat persentase progress vs sisa hari menuju target.' },
          { number: 3, text: 'Saat tercapai, status otomatis berubah jadi "Tercapai" dengan badge hijau.' },
        ],
      },
    ],
  },
  {
    slug: 'skenario-update-investasi',
    title: 'Update harga investasi & lihat performa',
    category: 'skenario',
    summary: 'Refresh harga aset dan baca grafik tren portofolio.',
    sections: [
      {
        heading: 'Update harga semua aset',
        steps: [
          { number: 1, text: 'Buka tab Investasi.' },
          { number: 2, text: 'Untuk setiap aset, klik ikon grafik (↗) di baris.' },
          { number: 3, text: 'Cek harga terkini dari sumber Anda (saham → IDX, reksadana → Bareksa, dll).' },
          { number: 4, text: 'Masukkan harga, simpan — gain/loss langsung ter-update.' },
        ],
        tip: 'Update minimal 1× per minggu untuk grafik tren yang berarti.',
      },
      {
        heading: 'Membaca performa portofolio',
        steps: [
          { number: 1, text: 'Lihat kartu "Portofolio Investasi" di Dashboard untuk total nilai + gain/loss persen.' },
          { number: 2, text: 'Buka Laporan → line chart "Modal vs Nilai" untuk tren historis.' },
          { number: 3, text: 'Hover titik grafik untuk angka detail per tanggal update.' },
        ],
      },
      {
        heading: 'Identifikasi aset terbaik/terburuk',
        steps: [
          { number: 1, text: 'Di tab Investasi, sort kolom "Gain/Loss %" descending.' },
          { number: 2, text: 'Aset paling atas = top performer; paling bawah = under-performer.' },
          { number: 3, text: 'Gunakan info ini untuk keputusan rebalancing.' },
        ],
      },
    ],
  },
  {
    slug: 'skenario-rencana-jangka-menengah',
    title: 'Set target Rencana Keuangan jangka menengah',
    category: 'skenario',
    summary: 'Hubungkan goals + investasi ke RencanaBar (mis. Jan 2027).',
    sections: [
      {
        heading: 'Memahami Rencana default',
        intro: 'RencanaBar di Dashboard mengakumulasi saldo dari goals & investasi yang ditandai sebagai bagian Rencana.',
        steps: [
          { number: 1, text: 'Buka Dashboard, cari progress bar "Rencana Keuangan".' },
          { number: 2, text: 'Total target default: Rp 257 juta, deadline Jan 2027 (bisa diubah).' },
        ],
      },
      {
        heading: 'Menambah goal ke Rencana',
        steps: [
          { number: 1, text: 'Buat goal sesuai kebutuhan (mis. "Nikah", "DP Rumah") di Finansial → Goals.' },
          { number: 2, text: 'Beri nama persis sama dengan daftar Rencana di Pengaturan jika ingin auto-include (lihat panduan Pengaturan).' },
          { number: 3, text: 'Tambah uang ke goal seperti biasa.' },
        ],
      },
      {
        heading: 'Menghubungkan investasi ke Rencana',
        steps: [
          { number: 1, text: 'Buat aset di tab Investasi dengan nama yang masuk dalam daftar Rencana.' },
          { number: 2, text: 'Update harga rutin agar nilai aktual terbawa ke RencanaBar.' },
        ],
        tip: 'RencanaBar update real-time setiap kali Anda menabung atau update harga.',
      },
    ],
  },
  {
    slug: 'skenario-net-worth-bulanan',
    title: 'Cek progress kekayaan bersih bulanan',
    category: 'skenario',
    summary: 'Update aset & kewajiban tiap bulan dan baca tren Net Worth.',
    sections: [
      {
        heading: 'Update Aset awal bulan',
        steps: [
          { number: 1, text: 'Buka Finansial → Kekayaan di awal bulan.' },
          { number: 2, text: 'Untuk tiap aset (rumah, mobil, deposito), update nilai estimasi terbaru.' },
          { number: 3, text: 'Tambah aset baru jika ada akuisisi sejak update terakhir.' },
        ],
      },
      {
        heading: 'Update Kewajiban awal bulan',
        steps: [
          { number: 1, text: 'Cek saldo terutang dari aplikasi bank/kreditur (KPR, KMG, kartu kredit).' },
          { number: 2, text: 'Update angka di tiap entri kewajiban.' },
          { number: 3, text: 'Hapus entri yang sudah lunas.' },
        ],
      },
      {
        heading: 'Baca tren Net Worth',
        steps: [
          { number: 1, text: 'Lihat angka Net Worth di header sub-tab Kekayaan: Total Aset − Total Kewajiban.' },
          { number: 2, text: 'Bandingkan dengan bulan sebelumnya — naik = aset bertambah/utang berkurang.' },
          { number: 3, text: 'Catat hasil di tab Catatan jika ingin punya log historis.' },
        ],
        tip: 'Konsistensi tanggal update (mis. selalu tanggal 1) membuat tren lebih akurat.',
      },
    ],
  },
  {
    slug: 'skenario-kelola-hutang',
    title: 'Mengelola hutang dan kewajiban',
    category: 'skenario',
    summary: 'Catat semua utang, update saldo bulanan, pantau progress pelunasan.',
    sections: [
      {
        heading: 'Mendaftarkan semua hutang',
        intro: 'Tujuannya: punya satu daftar lengkap berapa total yang harus dibayar dan ke siapa.',
        steps: [
          { number: 1, text: 'Buka Finansial → sub-tab Kekayaan.' },
          { number: 2, text: 'Klik "Tambah Kewajiban" untuk setiap utang yang Anda miliki (KPR, KMG, kartu kredit, pinjaman pribadi, dll).' },
          { number: 3, text: 'Isi nama (mis. "KPR BTN", "Kartu Kredit Mandiri"), jenis, dan saldo terutang saat ini.' },
          { number: 4, text: 'Simpan tiap entri.' },
        ],
        tip: 'Daftarkan walau utang kecil — total kewajiban yang akurat penting untuk hitung Net Worth.',
      },
      {
        heading: 'Update saldo bulanan',
        steps: [
          { number: 1, text: 'Cek saldo terutang dari aplikasi kreditur (mis. mobile banking, billing kartu kredit).' },
          { number: 2, text: 'Buka Kekayaan, klik entri kewajiban yang mau di-update.' },
          { number: 3, text: 'Ganti angka saldo terutang dengan nilai terbaru.' },
          { number: 4, text: 'Simpan.' },
        ],
        tip: 'Lakukan update di tanggal yang konsisten tiap bulan (mis. tanggal 1 atau setelah bayar) supaya tren akurat.',
      },
      {
        heading: 'Tracking progress pelunasan',
        steps: [
          { number: 1, text: 'Bandingkan saldo bulan ini vs bulan sebelumnya — turun = pelunasan berjalan.' },
          { number: 2, text: 'Lihat angka Total Kewajiban di header Kekayaan untuk gambaran agregat.' },
          { number: 3, text: 'Saat utang lunas, hapus entri agar daftar tetap rapi.' },
          { number: 4, text: 'Catat milestone pelunasan di tab Catatan jika ingin log historis.' },
        ],
      },
    ],
  },
  {
    slug: 'skenario-cicilan-kredit',
    title: 'Tracking cicilan kredit KPR atau kendaraan',
    category: 'skenario',
    summary: 'Setup pembayaran cicilan bulanan + sinkronkan saldo terutang.',
    sections: [
      {
        heading: 'Daftarkan kredit di Kekayaan',
        intro: 'Cicilan butuh dua tracking: pembayaran rutin (transaksi keluar) + saldo pokok yang terus turun (kewajiban).',
        steps: [
          { number: 1, text: 'Buka Finansial → Kekayaan → "Tambah Kewajiban".' },
          { number: 2, text: 'Isi nama (mis. "KPR Rumah", "Cicilan Xpander"), jenis, dan saldo pokok awal kredit.' },
          { number: 3, text: 'Simpan.' },
        ],
      },
      {
        heading: 'Setup tagihan cicilan rutin',
        steps: [
          { number: 1, text: 'Buka tab Transaksi → "Tambah Transaksi".' },
          { number: 2, text: 'Pilih Pengeluaran, kategori "Cicilan" atau buat kategori baru sesuai jenis kredit.' },
          { number: 3, text: 'Aktifkan opsi "Berulang" → Bulanan, set tanggal jatuh tempo cicilan.' },
          { number: 4, text: 'Isi jumlah cicilan tetap (pokok + bunga total per bulan), lalu Simpan sebagai template.' },
        ],
        tip: 'Template cicilan otomatis muncul di panel "Tagihan Mendatang" Dashboard tiap bulan.',
      },
      {
        heading: 'Sinkronisasi saldo bulanan setelah bayar',
        steps: [
          { number: 1, text: 'Saat tagihan jatuh tempo, klik "Tandai Dibayar" di Dashboard — pengeluaran otomatis tercatat.' },
          { number: 2, text: 'Buka Kekayaan, edit entri kewajiban kredit.' },
          { number: 3, text: 'Update saldo terutang: kurangi sebesar pokok bulan itu (cek dari skedul amortisasi atau app bank).' },
          { number: 4, text: 'Simpan.' },
        ],
        tip: 'Bunga sudah masuk transaksi pengeluaran; saldo kewajiban hanya menampilkan pokok yang tersisa.',
      },
      {
        heading: 'Cek progress menuju lunas',
        steps: [
          { number: 1, text: 'Buka Dashboard → kartu Net Worth.' },
          { number: 2, text: 'Net Worth naik tiap bulan = cicilan jalan + pokok turun + aset stabil/naik.' },
          { number: 3, text: 'Bandingkan saldo kewajiban awal vs sekarang untuk lihat berapa persen sudah dilunasi.' },
        ],
      },
    ],
  },
  {
    slug: 'skenario-tagihan-rutin',
    title: 'Mengelola tagihan rutin bulanan',
    category: 'skenario',
    summary: 'Setup, monitor, dan tandai bayar untuk semua tagihan tetap (di luar gaji).',
    sections: [
      {
        heading: 'Setup template tagihan',
        intro: 'Tagihan rutin = pengeluaran tetap tiap bulan: listrik, air, internet, BPJS, langganan streaming, dll.',
        steps: [
          { number: 1, text: 'Buka tab Transaksi → "Tambah Transaksi".' },
          { number: 2, text: 'Pilih Pengeluaran, kategori sesuai jenis tagihan (mis. "Listrik", "Internet", "Langganan").' },
          { number: 3, text: 'Aktifkan "Berulang" → Bulanan, set tanggal jatuh tempo perkiraan.' },
          { number: 4, text: 'Isi estimasi nominal (boleh berdasarkan rata-rata bulan-bulan sebelumnya).' },
          { number: 5, text: 'Simpan sebagai template — ulangi untuk tiap tagihan.' },
        ],
      },
      {
        heading: 'Monitor di Dashboard',
        steps: [
          { number: 1, text: 'Buka Dashboard.' },
          { number: 2, text: 'Cek panel "Tagihan Mendatang" — semua template aktif yang jatuh tempo bulan ini muncul di sini.' },
          { number: 3, text: 'Urutan biasanya berdasarkan tanggal jatuh tempo terdekat.' },
        ],
        tip: 'Tagihan yang sudah dibayar bulan ini tidak muncul lagi di panel — hanya yang masih outstanding.',
      },
      {
        heading: 'Tandai dibayar',
        steps: [
          { number: 1, text: 'Klik tagihan di panel "Tagihan Mendatang".' },
          { number: 2, text: 'Pilih "Tandai Dibayar".' },
          { number: 3, text: 'Konfirmasi tanggal pembayaran dan nominal aktual (boleh edit jika beda dari estimasi template).' },
          { number: 4, text: 'Simpan — transaksi pengeluaran otomatis tercatat di tab Transaksi.' },
        ],
      },
      {
        heading: 'Edit atau hapus template',
        steps: [
          { number: 1, text: 'Buka tab Transaksi → daftar template berulang.' },
          { number: 2, text: 'Klik template yang mau diubah.' },
          { number: 3, text: 'Edit nominal/tanggal/kategori jika berubah (mis. naik tarif listrik), lalu Simpan.' },
          { number: 4, text: 'Hapus template jika langganan dihentikan supaya tidak muncul lagi di Tagihan Mendatang.' },
        ],
        tip: 'Untuk tagihan yang nominalnya fluktuatif (listrik, pulsa), template hanya jadi reminder — nominal aktual diisi saat "Tandai Dibayar".',
      },
    ],
  },
]

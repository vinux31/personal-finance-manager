import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const SECTIONS: Array<{ title: string; body: string }> = [
  {
    title: 'Selamat Datang',
    body: `Dompetku membantu Anda mencatat keuangan sehari-hari dengan cara yang sederhana.

Aplikasi ini berjalan di browser Anda — data tersimpan di file .db di laptop, tidak dikirim ke server manapun.`,
  },
  {
    title: 'Transaksi',
    body: `Tab Transaksi dipakai untuk mencatat pemasukan dan pengeluaran harian.

- Klik "Tambah Transaksi" untuk entri baru
- Pilih Jenis (Pemasukan/Pengeluaran), tanggal, kategori, jumlah (Rp)
- Gunakan filter untuk melihat data periode tertentu
- Warna hijau = pemasukan, merah = pengeluaran`,
  },
  {
    title: 'Investasi',
    body: `Tab Investasi untuk memantau portofolio Anda.

- Tambah aset (saham, reksadana, emas, dll) dengan kuantitas & harga beli
- Klik ikon grafik (↗) untuk update harga terkini → gain/loss terhitung otomatis
- Riwayat harga tersimpan setiap kali Anda update`,
  },
  {
    title: 'Goals',
    body: `Tab Goals untuk tujuan keuangan (misal: dana darurat, liburan).

- Tetapkan nama, target jumlah, dan target tanggal
- Klik "Tambah Uang" tiap kali menabung → progress bar bergerak otomatis
- Jika jumlah terkumpul ≥ target, goal otomatis berstatus "Tercapai"`,
  },
  {
    title: 'Catatan',
    body: `Tab Catatan untuk mencatat pemikiran atau reminder terkait keuangan.

- Buat catatan dengan judul, tanggal, dan isi bebas
- Catatan panjang otomatis dipotong dengan "..." di tampilan kartu`,
  },
  {
    title: 'Laporan',
    body: `Tab Laporan menampilkan grafik visual dari data Anda.

- Pilih periode (Hari ini / Bulan ini / Tahun ini / Semua / Kustom)
- Bar chart: Pemasukan vs Pengeluaran per hari/minggu/bulan
- Pie chart: distribusi per kategori
- Line chart: modal vs nilai investasi saat ini`,
  },
  {
    title: 'Impor & Ekspor CSV',
    body: `Untuk backup atau pindah data dari spreadsheet Excel.

Transaksi CSV — kolom wajib: date (YYYY-MM-DD), type (income/expense), category, amount. Opsional: note.

Investasi CSV — kolom wajib: asset_type, asset_name, quantity, buy_price, buy_date. Opsional: current_price, note.`,
  },
  {
    title: 'Lokasi File Data',
    body: `File .db Anda adalah satu-satunya tempat semua data tersimpan.

- Bisa Anda backup dengan cara menyalin file .db ke flashdisk atau cloud
- Jika disimpan di dalam folder Google Drive Desktop, data otomatis ter-sync antar perangkat
- File bisa dibuka dengan aplikasi "DB Browser for SQLite" (gratis) kalau ingin lihat isinya langsung`,
  },
  {
    title: 'Tema Tampilan',
    body: `Ubah tema di tab Pengaturan.

- Terang (light): tampilan putih
- Gelap (dark): tampilan hitam, nyaman untuk mata di malam hari
- Ikuti sistem: mengikuti setting Windows`,
  },
  {
    title: 'Privasi & Keamanan',
    body: `Aplikasi ini 100% offline — tidak ada akun, tidak ada server.

- Semua data tersimpan di file .db di laptop Anda
- Tidak ada telemetri, analytics, atau iklan
- Browser akan minta izin sekali untuk menulis ke file — izinkan supaya auto-save jalan`,
  },
]

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function PanduanDialog({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Panduan Pengguna</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          {SECTIONS.map((s, i) => (
            <section key={i}>
              <h3 className="mb-2 font-semibold">{s.title}</h3>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {s.body}
              </p>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// src/tabs/pensiun/PanduanPanel.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const SUMBER_DANA = [
  { nama: 'BPJS JHT', badge: 'Wajib', warna: 'bg-blue-100 text-blue-800', deskripsi: 'Jaminan Hari Tua — 5.7% upah/bln (2% karyawan + 3.7% perusahaan), lump sum saat pensiun/resign.', formula: 'Iuran × bulan, dikompound ~5.5%/thn' },
  { nama: 'BPJS JP', badge: 'Wajib', warna: 'bg-blue-100 text-blue-800', deskripsi: 'Jaminan Pensiun — manfaat bulanan seumur hidup setelah pensiun.', formula: '1% × masa kepesertaan (max 30 thn) × upah terakhir' },
  { nama: 'DPPK', badge: 'Perusahaan', warna: 'bg-purple-100 text-purple-800', deskripsi: 'Dana Pensiun Pemberi Kerja — PPMP (benefit pasti) atau PPIP (iuran pasti).', formula: 'PPMP: masa kerja × faktor × PhDP' },
  { nama: 'DPLK', badge: 'Sukarela', warna: 'bg-green-100 text-green-800', deskripsi: 'Dana Pensiun Lembaga Keuangan — rekening investasi individual, bisa dibuka sendiri di bank/asuransi.', formula: 'Iuran + saldo awal dikompound sesuai return pilihan' },
  { nama: 'Taspen', badge: 'ASN/PNS', warna: 'bg-orange-100 text-orange-800', deskripsi: 'Khusus Aparatur Sipil Negara. Terdiri dari pensiun bulanan (seumur hidup) dan THT (lump sum).', formula: 'Pensiun: 2.5% × masa kerja × gaji pensiun' },
  { nama: 'Pesangon', badge: 'PKWTT', warna: 'bg-red-100 text-red-800', deskripsi: 'Uang pesangon saat PHK atau pensiun. Dihitung berdasarkan UU 11/2020 Cipta Kerja.', formula: '2× UP + 1× UPMK + 15% UPH' },
]

const STRATEGI_ALOKASI = [
  { usia: '20–30', emas: '10%', saham: '50%', rd: '30%', obligasi: '10%', profil: 'Agresif' },
  { usia: '30–40', emas: '20%', saham: '40%', rd: '30%', obligasi: '10%', profil: 'Moderat-Agresif' },
  { usia: '40–50', emas: '30%', saham: '30%', rd: '25%', obligasi: '15%', profil: 'Moderat' },
  { usia: '50–55', emas: '40%', saham: '15%', rd: '20%', obligasi: '25%', profil: 'Konservatif' },
  { usia: '55+', emas: '20%', saham: '5%', rd: '15%', obligasi: '60%', profil: 'Sangat Konservatif' },
]

const INSTRUMEN = [
  { nama: 'Deposito', return: '4–5%', risiko: 'Sangat Rendah', r10: 'Rp 73jt', r20: 'Rp 182jt', r30: 'Rp 398jt' },
  { nama: 'Obligasi Negara', return: '6–7%', risiko: 'Rendah', r10: 'Rp 82jt', r20: 'Rp 233jt', r30: 'Rp 566jt' },
  { nama: 'RD Pasar Uang', return: '5–6%', risiko: 'Rendah', r10: 'Rp 77jt', r20: 'Rp 208jt', r30: 'Rp 484jt' },
  { nama: 'RD Pendapatan Tetap', return: '7–8%', risiko: 'Rendah-Sedang', r10: 'Rp 87jt', r20: 'Rp 261jt', r30: 'Rp 681jt' },
  { nama: 'RD Campuran', return: '9–11%', risiko: 'Sedang', r10: 'Rp 97jt', r20: 'Rp 321jt', r30: 'Rp 937jt' },
  { nama: 'RD Saham', return: '12–15%', risiko: 'Tinggi', r10: 'Rp 113jt', r20: 'Rp 449jt', r30: 'Rp 1,56M' },
  { nama: 'Emas', return: '8–12%', risiko: 'Sedang', r10: 'Rp 97jt', r20: 'Rp 321jt', r30: 'Rp 937jt' },
  { nama: 'Saham Individu', return: '12–20%', risiko: 'Sangat Tinggi', r10: 'Rp 113jt', r20: 'Rp 449jt', r30: 'Rp 1,56M' },
]

export default function PanduanPanel() {
  return (
    <div className="space-y-6">
      {/* 6 Sumber Dana */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base" style={{ color: 'var(--gold)' }}>6 Sumber Dana Pensiun</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SUMBER_DANA.map((s) => (
              <div key={s.nama} className="rounded-lg border p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{s.nama}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.warna}`}>{s.badge}</span>
                </div>
                <p className="text-xs text-muted-foreground">{s.deskripsi}</p>
                <p className="text-xs font-mono" style={{ color: 'var(--gold)' }}>{s.formula}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Strategi Alokasi per Usia */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base" style={{ color: 'var(--gold)' }}>Strategi Alokasi per Usia</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 font-medium">Usia</th>
                  <th className="text-right py-2 px-2 font-medium">Emas</th>
                  <th className="text-right py-2 px-2 font-medium">Saham</th>
                  <th className="text-right py-2 px-2 font-medium">Reksadana</th>
                  <th className="text-right py-2 px-2 font-medium">Obligasi</th>
                  <th className="text-left py-2 pl-4 font-medium">Profil Risiko</th>
                </tr>
              </thead>
              <tbody>
                {STRATEGI_ALOKASI.map((row) => (
                  <tr key={row.usia} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{row.usia}</td>
                    <td className="text-right py-2 px-2 text-yellow-600">{row.emas}</td>
                    <td className="text-right py-2 px-2 text-blue-600">{row.saham}</td>
                    <td className="text-right py-2 px-2 text-green-600">{row.rd}</td>
                    <td className="text-right py-2 px-2 text-gray-500">{row.obligasi}</td>
                    <td className="pl-4 py-2 text-muted-foreground">{row.profil}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Perbandingan Instrumen */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base" style={{ color: 'var(--gold)' }}>Perbandingan 8 Instrumen (investasi Rp 500rb/bln)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 font-medium">Instrumen</th>
                  <th className="text-right py-2 px-2 font-medium">Return/thn</th>
                  <th className="text-right py-2 px-2 font-medium">Risiko</th>
                  <th className="text-right py-2 px-2 font-medium">10 thn</th>
                  <th className="text-right py-2 px-2 font-medium">20 thn</th>
                  <th className="text-right py-2 px-2 font-medium">30 thn</th>
                </tr>
              </thead>
              <tbody>
                {INSTRUMEN.map((r) => (
                  <tr key={r.nama} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{r.nama}</td>
                    <td className="text-right py-2 px-2 text-green-600">{r.return}</td>
                    <td className="text-right py-2 px-2 text-muted-foreground">{r.risiko}</td>
                    <td className="text-right py-2 px-2">{r.r10}</td>
                    <td className="text-right py-2 px-2">{r.r20}</td>
                    <td className="text-right py-2 px-2 font-medium">{r.r30}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Tips */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base" style={{ color: 'var(--gold)' }}>Tips & Kesalahan Umum</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="font-medium text-sm text-green-700 mb-2">✓ Yang Harus Dilakukan</p>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li>• Mulai menabung pensiun sedini mungkin — manfaat compounding terbesar di 10 tahun pertama</li>
                <li>• Diversifikasi ke minimal 3 instrumen berbeda</li>
                <li>• Naikkan investasi setiap tahun minimal sesuai inflasi (4–5%)</li>
                <li>• Pastikan BPJS JHT & JP aktif — ini jaring pengaman dasar</li>
                <li>• Review alokasi setiap 5 tahun — sesuaikan dengan usia dan profil risiko</li>
                <li>• Target dana pensiun = 25× pengeluaran tahunan (aturan 4%)</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-sm text-red-700 mb-2">✗ Kesalahan Umum</p>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li>• Mengandalkan hanya 1 sumber (misalnya cuma pesangon)</li>
                <li>• Tidak memperhitungkan inflasi — daya beli turun 50% dalam 18 tahun di inflasi 4%</li>
                <li>• Mengambil JHT terlalu dini sebelum pensiun</li>
                <li>• Terlalu agresif di usia 50+ — volatilitas tinggi bisa merusak dana pensiun</li>
                <li>• Tidak punya dana darurat terpisah dari dana pensiun</li>
                <li>• Lupa bahwa pensiun bisa 20–30 tahun — dana harus cukup panjang</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

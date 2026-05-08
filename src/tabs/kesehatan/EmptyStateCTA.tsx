import { useNavigate } from 'react-router-dom'
import { Wallet, Landmark, Target } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

/**
 * DIAG-11 empty state — welcome banner untuk user baru (total rows < 3).
 *
 * 3 quick-link CTA per CONTEXT.md decisions:
 *   - Catat transaksi pertama → /transaksi
 *   - Tambah akun bank → /kekayaan
 *   - Bikin tujuan finansial → /goals
 *
 * Tampil di atas piramida grayed (PiramidaShell variant="grayed-empty").
 * Banner kalkulator + grid 6 modul tetap render di bawah (handled by KesehatanLanding).
 */
export default function EmptyStateCTA() {
  const navigate = useNavigate()

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader>
        <CardTitle className="text-xl">Mulai dari mana?</CardTitle>
        <CardDescription>
          Yuk isi data dasar dulu — minimal 3 entri (transaksi, akun, atau goal) supaya piramida kesehatan bisa kasih warna sesuai kondisi keuangan kamu.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-3">
          <Button
            variant="outline"
            className="h-auto justify-start gap-3 py-4 text-left"
            onClick={() => navigate('/transaksi')}
          >
            <Wallet className="h-5 w-5 shrink-0 text-primary" />
            <span className="flex flex-col items-start gap-0.5">
              <span className="text-sm font-semibold">Catat transaksi pertama</span>
              <span className="text-xs text-muted-foreground">Income atau expense</span>
            </span>
          </Button>

          <Button
            variant="outline"
            className="h-auto justify-start gap-3 py-4 text-left"
            onClick={() => navigate('/kekayaan')}
          >
            <Landmark className="h-5 w-5 shrink-0 text-primary" />
            <span className="flex flex-col items-start gap-0.5">
              <span className="text-sm font-semibold">Tambah akun bank</span>
              <span className="text-xs text-muted-foreground">Tabungan, e-wallet, dll</span>
            </span>
          </Button>

          <Button
            variant="outline"
            className="h-auto justify-start gap-3 py-4 text-left"
            onClick={() => navigate('/goals')}
          >
            <Target className="h-5 w-5 shrink-0 text-primary" />
            <span className="flex flex-col items-start gap-0.5">
              <span className="text-sm font-semibold">Bikin tujuan finansial</span>
              <span className="text-xs text-muted-foreground">Dana darurat, beli rumah</span>
            </span>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

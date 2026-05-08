import { useNavigate } from 'react-router-dom'
import { Calculator, ArrowRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function KalkulatorBanner() {
  const navigate = useNavigate()
  return (
    <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
      <CardContent className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3 sm:items-center">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Calculator className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-medium">
              Hitung target investasimu dengan kalkulator compound interest
            </p>
            <p className="text-xs text-muted-foreground">
              Lihat proyeksi tahun-per-tahun dari setoran rutin kamu.
            </p>
          </div>
        </div>
        <Button
          variant="default"
          size="sm"
          className="shrink-0"
          onClick={() => navigate('/kesehatan/kalkulator')}
        >
          Buka kalkulator
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  )
}

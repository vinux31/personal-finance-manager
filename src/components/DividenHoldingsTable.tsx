import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Plus } from 'lucide-react'
import { formatRupiah } from '@/lib/format'
import {
  dividendCurrentValue,
  annualIncome,
  type DividendHolding,
} from '@/queries/dividends'

interface Props {
  holdings: DividendHolding[]
  isLoading: boolean
  onAddTransaction: (holding?: DividendHolding) => void
}

export default function DividenHoldingsTable({ holdings, isLoading, onAddTransaction }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Holdings
        </h2>
        <Button size="sm" onClick={() => onAddTransaction()}>
          <Plus className="h-4 w-4" />
          Tambah Transaksi
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ticker</TableHead>
              <TableHead>Sektor</TableHead>
              <TableHead className="text-right">Lot</TableHead>
              <TableHead className="text-right">Harga Saat Ini</TableHead>
              <TableHead className="text-right">Nilai</TableHead>
              <TableHead className="text-right">Yield</TableHead>
              <TableHead className="text-right">Income / Tahun</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  Memuat…
                </TableCell>
              </TableRow>
            ) : holdings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  Belum ada holdings. Klik "Tambah Transaksi" untuk mulai.
                </TableCell>
              </TableRow>
            ) : (
              holdings.map((h) => (
                <TableRow key={h.bei_stock_id}>
                  <TableCell className="font-semibold">{h.ticker}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{h.sector}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{h.total_lots} lot</TableCell>
                  <TableCell className="text-right">
                    {h.current_price != null ? formatRupiah(h.current_price) : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatRupiah(dividendCurrentValue(h))}
                  </TableCell>
                  <TableCell className="text-right">
                    {h.dividend_yield != null ? `${h.dividend_yield.toFixed(2)}%` : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    {annualIncome(h) > 0 ? formatRupiah(annualIncome(h)) : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => onAddTransaction(h)}>
                      + Transaksi
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

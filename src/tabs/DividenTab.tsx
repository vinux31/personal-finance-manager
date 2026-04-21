import { useMemo, useState } from 'react'
import {
  useDividendHoldings,
  useDividendTransactions,
  useBeiStocks,
  annualIncome,
  dividendCurrentValue,
  dividendCostBasis,
  weightedAvgYield,
  sectorAllocation,
  type DividendHolding,
} from '@/queries/dividends'
import DividenSummaryCards from '@/components/DividenSummaryCards'
import DividenHoldingsTable from '@/components/DividenHoldingsTable'
import DividenTransactionDialog from '@/components/DividenTransactionDialog'
import SectorPieChart from '@/components/SectorPieChart'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { formatRupiah, formatDateID } from '@/lib/format'

export default function DividenTab() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [defaultHolding, setDefaultHolding] = useState<DividendHolding | undefined>()

  const { data: holdings = [], isLoading: holdingsLoading } = useDividendHoldings()
  const { data: transactions = [], isLoading: txLoading } = useDividendTransactions()
  const { data: stocks = [] } = useBeiStocks()

  const stockMap = useMemo(
    () => new Map(stocks.map((s) => [s.id, s])),
    [stocks],
  )

  const totals = useMemo(() => {
    const totalValue = holdings.reduce((s, h) => s + dividendCurrentValue(h), 0)
    const totalIncome = holdings.reduce((s, h) => s + annualIncome(h), 0)
    const avgYield = weightedAvgYield(holdings)
    const totalCost = holdings.reduce((s, h) => s + dividendCostBasis(h), 0)
    const avgYoC = totalCost === 0 ? 0 : (totalIncome / totalCost) * 100
    return { totalValue, totalIncome, avgYield, avgYoC }
  }, [holdings])

  const sectors = useMemo(() => sectorAllocation(holdings), [holdings])

  function openDialog(holding?: DividendHolding) {
    setDefaultHolding(holding)
    setDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      <DividenSummaryCards
        totalValue={totals.totalValue}
        totalAnnualIncome={totals.totalIncome}
        avgYield={totals.avgYield}
        avgYieldOnCost={totals.avgYoC}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <DividenHoldingsTable
            holdings={holdings}
            isLoading={holdingsLoading}
            onAddTransaction={openDialog}
          />
        </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Alokasi Sektor
          </div>
          <SectorPieChart data={sectors} />
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Log Transaksi
        </h2>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Ticker</TableHead>
                <TableHead>Jenis</TableHead>
                <TableHead className="text-right">Lot</TableHead>
                <TableHead className="text-right">Harga / Saham</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Catatan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {txLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    Memuat…
                  </TableCell>
                </TableRow>
              ) : transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    Belum ada transaksi.
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((tx) => {
                  const stock = stockMap.get(tx.bei_stock_id)
                  const total = tx.lots * 100 * tx.price_per_share
                  return (
                    <TableRow key={tx.id}>
                      <TableCell>{formatDateID(tx.transaction_date)}</TableCell>
                      <TableCell className="font-semibold">{stock?.ticker ?? '—'}</TableCell>
                      <TableCell>
                        <Badge variant={tx.type === 'BUY' ? 'default' : 'destructive'}>
                          {tx.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{tx.lots} lot</TableCell>
                      <TableCell className="text-right">
                        {formatRupiah(tx.price_per_share)}
                      </TableCell>
                      <TableCell className="text-right">{formatRupiah(total)}</TableCell>
                      <TableCell className="text-muted-foreground">{tx.note ?? '—'}</TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <DividenTransactionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        defaultHolding={defaultHolding}
      />
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import {
  listInvestments,
  deleteInvestment,
  costBasis,
  currentValue,
  gainLoss,
  gainLossPercent,
  type Investment,
} from '@/db/investments'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Trash2, TrendingUp, Upload, Download } from 'lucide-react'
import { formatRupiah, formatDateID, todayISO } from '@/lib/format'
import InvestmentDialog from '@/components/InvestmentDialog'
import PriceUpdateDialog from '@/components/PriceUpdateDialog'
import { toast } from 'sonner'
import { downloadCsv, pickCsvFile } from '@/lib/csv'
import {
  exportInvestmentsCsv,
  importInvestmentsCsv,
} from '@/db/csvInvestments'

export default function InvestmentsTab() {
  const [rows, setRows] = useState<Investment[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Investment | null>(null)
  const [priceOpen, setPriceOpen] = useState(false)
  const [priceFor, setPriceFor] = useState<Investment | null>(null)

  function refresh() {
    setRows(listInvestments())
  }

  useEffect(() => {
    refresh()
  }, [])

  const totals = useMemo(() => {
    let cost = 0
    let value = 0
    for (const r of rows) {
      cost += costBasis(r)
      value += currentValue(r)
    }
    const gl = value - cost
    const pct = cost === 0 ? 0 : (gl / cost) * 100
    return { cost, value, gl, pct }
  }, [rows])

  async function onDelete(inv: Investment) {
    if (!confirm(`Hapus investasi "${inv.asset_name}" beserta riwayat harganya?`))
      return
    await deleteInvestment(inv.id)
    toast.success('Investasi dihapus')
    refresh()
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard label="Total Modal" value={formatRupiah(totals.cost)} />
        <SummaryCard label="Nilai Saat Ini" value={formatRupiah(totals.value)} />
        <SummaryCard
          label="Gain / Loss"
          value={`${totals.gl >= 0 ? '+' : '−'} ${formatRupiah(Math.abs(totals.gl))}`}
          sub={`${totals.pct >= 0 ? '+' : ''}${totals.pct.toFixed(2)}%`}
          tone={totals.gl >= 0 ? 'up' : 'down'}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => {
            downloadCsv(`investments-${todayISO()}.csv`, exportInvestmentsCsv())
            toast.success('CSV diekspor')
          }}
        >
          <Download className="h-4 w-4" />
          Ekspor
        </Button>
        <Button
          variant="outline"
          onClick={async () => {
            const text = await pickCsvFile()
            if (!text) return
            try {
              const r = await importInvestmentsCsv(text)
              if (r.inserted > 0)
                toast.success(
                  `${r.inserted} investasi diimpor${r.skipped ? `, ${r.skipped} dilewati` : ''}`,
                )
              if (r.errors.length > 0)
                toast.error(
                  `${r.errors.length} baris bermasalah. Contoh: baris ${r.errors[0].line} — ${r.errors[0].message}`,
                )
              refresh()
            } catch (err) {
              toast.error(String(err instanceof Error ? err.message : err))
            }
          }}
        >
          <Upload className="h-4 w-4" />
          Impor
        </Button>
        <Button
          onClick={() => {
            setEditing(null)
            setDialogOpen(true)
          }}
        >
          <Plus className="h-4 w-4" />
          Tambah Investasi
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Jenis</TableHead>
              <TableHead>Nama</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Harga Beli</TableHead>
              <TableHead className="text-right">Harga Kini</TableHead>
              <TableHead className="text-right">Modal</TableHead>
              <TableHead className="text-right">Nilai</TableHead>
              <TableHead className="text-right">G/L</TableHead>
              <TableHead className="w-32">Tgl Beli</TableHead>
              <TableHead className="w-32 text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="py-8 text-center text-muted-foreground">
                  Belum ada investasi. Klik "Tambah Investasi" untuk mulai.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => {
                const gl = gainLoss(r)
                const pct = gainLossPercent(r)
                const tone = gl >= 0 ? 'text-emerald-600' : 'text-red-600'
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Badge variant="secondary">{r.asset_type}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{r.asset_name}</TableCell>
                    <TableCell className="text-right">{r.quantity}</TableCell>
                    <TableCell className="text-right">
                      {formatRupiah(r.buy_price)}
                    </TableCell>
                    <TableCell className="text-right">
                      {r.current_price != null ? formatRupiah(r.current_price) : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatRupiah(costBasis(r))}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatRupiah(currentValue(r))}
                    </TableCell>
                    <TableCell className={`text-right font-medium ${tone}`}>
                      {gl >= 0 ? '+' : '−'} {formatRupiah(Math.abs(gl))}
                      <div className="text-xs font-normal">
                        {pct >= 0 ? '+' : ''}
                        {pct.toFixed(2)}%
                      </div>
                    </TableCell>
                    <TableCell>{formatDateID(r.buy_date)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Update harga"
                        onClick={() => {
                          setPriceFor(r)
                          setPriceOpen(true)
                        }}
                      >
                        <TrendingUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Edit"
                        onClick={() => {
                          setEditing(r)
                          setDialogOpen(true)
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Hapus"
                        onClick={() => void onDelete(r)}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <InvestmentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={refresh}
        editing={editing}
      />
      <PriceUpdateDialog
        open={priceOpen}
        onOpenChange={setPriceOpen}
        onSaved={refresh}
        investment={priceFor}
      />
    </div>
  )
}

function SummaryCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string
  value: string
  sub?: string
  tone?: 'up' | 'down'
}) {
  const color =
    tone === 'up'
      ? 'text-emerald-600'
      : tone === 'down'
        ? 'text-red-600'
        : 'text-foreground'
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${color}`}>{value}</div>
      {sub && <div className={`text-sm ${color}`}>{sub}</div>}
    </div>
  )
}

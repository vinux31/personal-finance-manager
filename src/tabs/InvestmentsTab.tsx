import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useInvestments, useAssetTypes, useDeleteInvestment, useRefreshPrices, costBasis, currentValue, gainLoss, gainLossPercent, type Investment, type InvestmentFilters } from '@/queries/investments'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Plus, Pencil, Trash2, TrendingUp, Upload, Download, RefreshCw } from 'lucide-react'
import { formatRupiah, formatDateID, todayISO } from '@/lib/format'
import InvestmentDialog from '@/components/InvestmentDialog'
import PriceUpdateDialog from '@/components/PriceUpdateDialog'
import { toast } from 'sonner'
import { downloadCsv, pickCsvFile } from '@/lib/csv'
import { exportInvestmentsCsv, importInvestmentsCsv } from '@/db/csvInvestments'

export default function InvestmentsTab() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Investment | null>(null)
  const [priceOpen, setPriceOpen] = useState(false)
  const [priceFor, setPriceFor] = useState<Investment | null>(null)
  const [filters, setFilters] = useState<InvestmentFilters>({})
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmInv, setConfirmInv] = useState<Investment | null>(null)
  const qc = useQueryClient()

  const { data: rows = [], isLoading } = useInvestments(filters)
  const { data: assetTypes = [] } = useAssetTypes()
  const deleteInvestment = useDeleteInvestment()
  const refreshPrices = useRefreshPrices()

  const totals = useMemo(() => {
    let cost = 0; let value = 0
    for (const r of rows) { cost += costBasis(r); value += currentValue(r) }
    const gl = value - cost
    const pct = cost === 0 ? 0 : (gl / cost) * 100
    return { cost, value, gl, pct }
  }, [rows])

  function onDelete(inv: Investment) {
    setConfirmInv(inv)
    setConfirmOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard label="Total Modal" value={formatRupiah(totals.cost)} />
        <SummaryCard label="Nilai Saat Ini" value={formatRupiah(totals.value)} />
        <SummaryCard label="Gain / Loss" value={`${totals.gl >= 0 ? '+' : '−'} ${formatRupiah(Math.abs(totals.gl))}`} sub={`${totals.pct >= 0 ? '+' : ''}${totals.pct.toFixed(2)}%`} tone={totals.gl >= 0 ? 'up' : 'down'} />
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={async () => {
          const csv = await exportInvestmentsCsv()
          downloadCsv(`investments-${todayISO()}.csv`, csv)
          toast.success('CSV diekspor')
        }}>
          <Download className="h-4 w-4" />Ekspor
        </Button>
        <Button variant="outline" onClick={async () => {
          const text = await pickCsvFile()
          if (!text) return
          try {
            const r = await importInvestmentsCsv(text)
            if (r.inserted > 0) {
              await qc.invalidateQueries({ queryKey: ['investments'] })
              await qc.invalidateQueries({ queryKey: ['asset-types'] })
              toast.success(`${r.inserted} investasi diimpor${r.skipped ? `, ${r.skipped} dilewati` : ''}`)
            }
            if (r.errors.length > 0) toast.error(`${r.errors.length} baris bermasalah. Contoh: baris ${r.errors[0].line} — ${r.errors[0].message}`)
          } catch (err) {
            toast.error(String(err instanceof Error ? err.message : err))
          }
        }}>
          <Upload className="h-4 w-4" />Impor
        </Button>
        <Button
          variant="outline"
          disabled={refreshPrices.isPending || rows.length === 0}
          onClick={() => refreshPrices.mutate(rows)}
        >
          <RefreshCw className={`h-4 w-4 ${refreshPrices.isPending ? 'animate-spin' : ''}`} />
          {refreshPrices.isPending ? 'Memperbarui…' : 'Refresh Harga'}
        </Button>
        <Button onClick={() => { setEditing(null); setDialogOpen(true) }}>
          <Plus className="h-4 w-4" />Tambah Investasi
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Input
          placeholder="Cari nama aset…"
          value={filters.search ?? ''}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value || undefined }))}
          className="h-8 w-48"
        />
        <Select
          value={filters.assetType ?? '__all__'}
          onValueChange={(v) => setFilters((f) => ({ ...f, assetType: v === '__all__' ? undefined : v }))}
        >
          <SelectTrigger className="h-8 w-36">
            <SelectValue placeholder="Semua jenis" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Semua jenis</SelectItem>
            {assetTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Desktop: tabel normal */}
      <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[10px] font-semibold uppercase tracking-wider">Jenis</TableHead>
              <TableHead className="text-[10px] font-semibold uppercase tracking-wider">Nama</TableHead>
              <TableHead className="text-right text-[10px] font-semibold uppercase tracking-wider">Qty</TableHead>
              <TableHead className="text-right text-[10px] font-semibold uppercase tracking-wider">H.Beli</TableHead>
              <TableHead className="text-right text-[10px] font-semibold uppercase tracking-wider">H.Kini</TableHead>
              <TableHead className="text-right text-[10px] font-semibold uppercase tracking-wider">Modal</TableHead>
              <TableHead className="text-right text-[10px] font-semibold uppercase tracking-wider">Nilai</TableHead>
              <TableHead className="text-right text-[10px] font-semibold uppercase tracking-wider">G/L</TableHead>
              <TableHead className="w-28 text-[10px] font-semibold uppercase tracking-wider">Tgl Beli</TableHead>
              <TableHead className="w-28 text-right text-[10px] font-semibold uppercase tracking-wider">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={10} className="py-8 text-center text-muted-foreground">Memuat…</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={10} className="py-8 text-center text-muted-foreground">Belum ada investasi.</TableCell></TableRow>
            ) : (
              rows.map((r) => {
                const gl = gainLoss(r)
                const pct = gainLossPercent(r)
                const tone = gl >= 0 ? 'text-emerald-600' : 'text-red-600'
                return (
                  <TableRow key={r.id}>
                    <TableCell><span className="rounded-full bg-[var(--brand-light)] px-2 py-0.5 text-[10px] font-semibold text-[var(--brand)]">{r.asset_type}</span></TableCell>
                    <TableCell className="font-medium">{r.asset_name}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.quantity}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatRupiah(r.buy_price)}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.current_price != null ? formatRupiah(r.current_price) : '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatRupiah(costBasis(r))}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatRupiah(currentValue(r))}</TableCell>
                    <TableCell className={`text-right font-semibold ${tone}`}>
                      {gl >= 0 ? '+' : '−'} {formatRupiah(Math.abs(gl))}
                      <div className="text-xs font-normal">{pct >= 0 ? '+' : ''}{pct.toFixed(2)}%</div>
                    </TableCell>
                    <TableCell>{formatDateID(r.buy_date)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Update harga" onClick={() => { setPriceFor(r); setPriceOpen(true) }}><TrendingUp className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit" onClick={() => { setEditing(r); setDialogOpen(true) }}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Hapus" onClick={() => onDelete(r)}><Trash2 className="h-3.5 w-3.5 text-red-500" /></Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile: card per aset */}
      <div className="grid gap-3 md:hidden">
        {isLoading ? (
          <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">Memuat…</div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">Belum ada investasi.</div>
        ) : (
          rows.map((r) => {
            const gl = gainLoss(r)
            const pct = gainLossPercent(r)
            const isUp = gl >= 0
            return (
              <div key={r.id} className="rounded-xl border bg-card p-4" style={{ borderLeft: '4px solid var(--brand)' }}>
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <span className="mb-1 inline-block rounded-full bg-[var(--brand-light)] px-2 py-0.5 text-[10px] font-semibold text-[var(--brand)]">{r.asset_type}</span>
                    <div className="text-base font-bold">{r.asset_name}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{formatRupiah(currentValue(r))}</div>
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${isUp ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {isUp ? '↑' : '↓'} {pct.toFixed(2)}%
                    </span>
                  </div>
                </div>
                <div className="mb-3 grid grid-cols-3 gap-2">
                  {[
                    { label: 'QTY', value: String(r.quantity) },
                    { label: 'H.BELI', value: formatRupiah(r.buy_price) },
                    { label: 'H.KINI', value: r.current_price != null ? formatRupiah(r.current_price) : '—' },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-lg bg-muted/40 p-2">
                      <div className="text-[9px] font-semibold uppercase text-muted-foreground">{label}</div>
                      <div className="truncate text-xs font-semibold">{value}</div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end gap-1.5">
                  <Button variant="outline" size="sm" className="h-7 text-xs border-[#e0e7ff] text-[var(--brand)]" onClick={() => { setPriceFor(r); setPriceOpen(true) }}>
                    <TrendingUp className="h-3 w-3" />Update Harga
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(r); setDialogOpen(true) }}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDelete(r)}><Trash2 className="h-3.5 w-3.5 text-red-500" /></Button>
                </div>
              </div>
            )
          })
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Hapus "${confirmInv?.asset_name ?? ''}"`}
        description="Investasi dan riwayat harganya akan dihapus permanen."
        onConfirm={() => { if (confirmInv) deleteInvestment.mutate(confirmInv.id) }}
      />
      <InvestmentDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />
      <PriceUpdateDialog open={priceOpen} onOpenChange={setPriceOpen} investment={priceFor} />
    </div>
  )
}

function SummaryCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'up' | 'down' }) {
  const color = tone === 'up' ? 'text-emerald-600' : tone === 'down' ? 'text-red-600' : 'text-foreground'
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${color}`}>{value}</div>
      {sub && <div className={`text-sm ${color}`}>{sub}</div>}
    </div>
  )
}

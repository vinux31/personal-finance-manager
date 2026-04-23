import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTransactions, useDeleteTransaction, type TransactionFilters, type Transaction } from '@/queries/transactions'
import { useCategories } from '@/queries/categories'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus, Pencil, Trash2, ArrowDownCircle, ArrowUpCircle, Upload, Download, RefreshCw } from 'lucide-react'
import { formatRupiah, formatDateID, todayISO } from '@/lib/format'
import TransactionDialog from '@/components/TransactionDialog'
import RecurringListDialog from '@/components/RecurringListDialog'
import { useProcessRecurring } from '@/hooks/useProcessRecurring'
import { toast } from 'sonner'
import { downloadCsv, pickCsvFile } from '@/lib/csv'
import { exportTransactionsCsv, importTransactionsCsv } from '@/db/csvTransactions'

const ALL = '__all__'

export default function TransactionsTab() {
  const [filters, setFilters] = useState<TransactionFilters>({})
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [recurringOpen, setRecurringOpen] = useState(false)
  const qc = useQueryClient()

  useProcessRecurring()

  const { data: rows = [], isLoading } = useTransactions(filters)
  const { data: categories = [] } = useCategories()
  const deleteTransaction = useDeleteTransaction()

  const totals = useMemo(() => {
    let income = 0; let expense = 0
    for (const r of rows) {
      if (r.type === 'income') income += r.amount
      else expense += r.amount
    }
    return { income, expense, net: income - expense }
  }, [rows])

  async function onDelete(id: number) {
    if (!confirm('Hapus transaksi ini?')) return
    deleteTransaction.mutate(id)
  }

  const filteredCategories = filters.type ? categories.filter((c) => c.type === filters.type) : categories

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard label="Pemasukan" value={formatRupiah(totals.income)} tone="income" />
        <SummaryCard label="Pengeluaran" value={formatRupiah(totals.expense)} tone="expense" />
        <SummaryCard label="Net" value={formatRupiah(totals.net)} tone={totals.net >= 0 ? 'income' : 'expense'} />
      </div>

      {/* Toolbar — filter baris 1, aksi baris 2 */}
      <div className="rounded-xl border border-[#e0e7ff] bg-card p-3">
        {/* Baris 1: Filter */}
        <div className="flex flex-wrap items-end gap-2 mb-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground self-center">Filter:</span>
          <div className="grid gap-0.5">
            <Label htmlFor="f-from" className="text-[10px]">Dari</Label>
            <Input id="f-from" type="date" value={filters.dateFrom ?? ''} onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value || undefined }))} className="h-7 w-36 text-xs" />
          </div>
          <div className="grid gap-0.5">
            <Label htmlFor="f-to" className="text-[10px]">Sampai</Label>
            <Input id="f-to" type="date" value={filters.dateTo ?? ''} onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value || undefined }))} className="h-7 w-36 text-xs" />
          </div>
          <div className="grid gap-0.5">
            <Label className="text-[10px]">Jenis</Label>
            <Select value={filters.type || ALL} onValueChange={(v) => setFilters((f) => ({ ...f, type: v === ALL ? '' : (v as 'income' | 'expense'), categoryId: null }))}>
              <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Semua</SelectItem>
                <SelectItem value="income">Pemasukan</SelectItem>
                <SelectItem value="expense">Pengeluaran</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-0.5">
            <Label className="text-[10px]">Kategori</Label>
            <Select value={filters.categoryId ? String(filters.categoryId) : ALL} onValueChange={(v) => setFilters((f) => ({ ...f, categoryId: v === ALL ? null : Number(v) }))}>
              <SelectTrigger className="h-7 w-40 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Semua</SelectItem>
                {filteredCategories.map((c) => (
                  <SelectItem key={`${c.type}-${c.id}`} value={String(c.id)}>{c.name} ({c.type === 'income' ? 'masuk' : 'keluar'})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Baris 2: Aksi */}
        <div className="flex items-center justify-between gap-2 border-t border-[#e0e7ff] pt-2">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-7 text-xs text-[var(--brand)] border-[#e0e7ff]" onClick={async () => {
              const csv = await exportTransactionsCsv()
              downloadCsv(`transactions-${todayISO()}.csv`, csv)
              toast.success('CSV diekspor')
            }}>
              <Download className="h-3 w-3" />Ekspor
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs text-[var(--brand)] border-[#e0e7ff]" onClick={async () => {
              const text = await pickCsvFile()
              if (!text) return
              try {
                const r = await importTransactionsCsv(text)
                if (r.inserted > 0) {
                  await qc.invalidateQueries({ queryKey: ['transactions'] })
                  toast.success(`${r.inserted} transaksi diimpor${r.skipped ? `, ${r.skipped} dilewati` : ''}`)
                }
                if (r.errors.length > 0) toast.error(`${r.errors.length} baris bermasalah. Contoh: baris ${r.errors[0].line} — ${r.errors[0].message}`)
              } catch (err) {
                toast.error(String(err instanceof Error ? err.message : err))
              }
            }}>
              <Upload className="h-3 w-3" />Impor
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs text-[var(--brand)] border-[#e0e7ff]" onClick={() => setRecurringOpen(true)}>
              <RefreshCw className="h-3 w-3" />Rutin
            </Button>
          </div>
          <Button size="sm" className="h-7 text-xs bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white" onClick={() => { setEditing(null); setDialogOpen(true) }}>
            <Plus className="h-3 w-3" />Tambah Transaksi
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28 text-[10px] font-semibold uppercase tracking-wider">Tanggal</TableHead>
              <TableHead className="w-24 text-[10px] font-semibold uppercase tracking-wider">Jenis</TableHead>
              <TableHead className="text-[10px] font-semibold uppercase tracking-wider">Kategori</TableHead>
              <TableHead className="text-right text-[10px] font-semibold uppercase tracking-wider">Jumlah</TableHead>
              <TableHead className="hidden sm:table-cell text-[10px] font-semibold uppercase tracking-wider">Catatan</TableHead>
              <TableHead className="w-20 text-right text-[10px] font-semibold uppercase tracking-wider">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Memuat…</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Belum ada transaksi. Klik "Tambah Transaksi" untuk mulai.</TableCell></TableRow>
            ) : (
              rows.map((r) => {
                const isIncome = r.type === 'income'
                return (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">{formatDateID(r.date)}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${isIncome ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                        {isIncome ? <ArrowUpCircle className="h-3 w-3" /> : <ArrowDownCircle className="h-3 w-3" />}
                        {isIncome ? 'Masuk' : 'Keluar'}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">{r.category_name}</TableCell>
                    <TableCell className={`text-right font-semibold tabular-nums ${isIncome ? 'text-emerald-600' : 'text-red-600'}`}>
                      {isIncome ? '+' : '−'} {formatRupiah(r.amount)}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{r.note ?? ''}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(r); setDialogOpen(true) }}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => void onDelete(r.id)}><Trash2 className="h-3.5 w-3.5 text-red-500" /></Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <TransactionDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />
      <RecurringListDialog open={recurringOpen} onOpenChange={setRecurringOpen} />
    </div>
  )
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone: 'income' | 'expense' }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${tone === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>{value}</div>
    </div>
  )
}

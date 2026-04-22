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
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Trash2, ArrowDownCircle, ArrowUpCircle, Upload, Download } from 'lucide-react'
import { formatRupiah, formatDateID, todayISO } from '@/lib/format'
import TransactionDialog from '@/components/TransactionDialog'
import { toast } from 'sonner'
import { downloadCsv, pickCsvFile } from '@/lib/csv'
import { exportTransactionsCsv, importTransactionsCsv } from '@/db/csvTransactions'

const ALL = '__all__'

export default function TransactionsTab() {
  const [filters, setFilters] = useState<TransactionFilters>({})
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const qc = useQueryClient()

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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard label="Pemasukan" value={formatRupiah(totals.income)} tone="income" />
        <SummaryCard label="Pengeluaran" value={formatRupiah(totals.expense)} tone="expense" />
        <SummaryCard label="Net" value={formatRupiah(totals.net)} tone={totals.net >= 0 ? 'income' : 'expense'} />
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1">
          <Label htmlFor="f-from" className="text-xs">Dari</Label>
          <Input id="f-from" type="date" value={filters.dateFrom ?? ''} onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value || undefined }))} className="w-40" />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="f-to" className="text-xs">Sampai</Label>
          <Input id="f-to" type="date" value={filters.dateTo ?? ''} onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value || undefined }))} className="w-40" />
        </div>
        <div className="grid gap-1">
          <Label className="text-xs">Jenis</Label>
          <Select value={filters.type || ALL} onValueChange={(v) => setFilters((f) => ({ ...f, type: v === ALL ? '' : (v as 'income' | 'expense'), categoryId: null }))}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Semua</SelectItem>
              <SelectItem value="income">Pemasukan</SelectItem>
              <SelectItem value="expense">Pengeluaran</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1">
          <Label className="text-xs">Kategori</Label>
          <Select value={filters.categoryId ? String(filters.categoryId) : ALL} onValueChange={(v) => setFilters((f) => ({ ...f, categoryId: v === ALL ? null : Number(v) }))}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Semua</SelectItem>
              {filteredCategories.map((c) => (
                <SelectItem key={`${c.type}-${c.id}`} value={String(c.id)}>{c.name} ({c.type === 'income' ? 'masuk' : 'keluar'})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={async () => {
            const csv = await exportTransactionsCsv()
            downloadCsv(`transactions-${todayISO()}.csv`, csv)
            toast.success('CSV diekspor')
          }}>
            <Download className="h-4 w-4" />Ekspor
          </Button>
          <Button variant="outline" onClick={async () => {
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
            <Upload className="h-4 w-4" />Impor
          </Button>
          <Button onClick={() => { setEditing(null); setDialogOpen(true) }}>
            <Plus className="h-4 w-4" />Tambah Transaksi
          </Button>
        </div>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">Tanggal</TableHead>
              <TableHead className="w-28">Jenis</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead className="text-right">Jumlah</TableHead>
              <TableHead>Catatan</TableHead>
              <TableHead className="w-24 text-right">Aksi</TableHead>
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
                    <TableCell>{formatDateID(r.date)}</TableCell>
                    <TableCell>
                      <Badge variant={isIncome ? 'default' : 'destructive'} className="gap-1">
                        {isIncome ? <ArrowUpCircle className="h-3 w-3" /> : <ArrowDownCircle className="h-3 w-3" />}
                        {isIncome ? 'Masuk' : 'Keluar'}
                      </Badge>
                    </TableCell>
                    <TableCell>{r.category_name}</TableCell>
                    <TableCell className={`text-right font-medium ${isIncome ? 'text-emerald-600' : 'text-red-600'}`}>
                      {isIncome ? '+' : '−'} {formatRupiah(r.amount)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{r.note ?? ''}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => { setEditing(r); setDialogOpen(true) }}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => void onDelete(r.id)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <TransactionDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />
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

import { useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTransactions, useDeleteTransaction, type TransactionFilters, type Transaction } from '@/queries/transactions'
import { useCategories } from '@/queries/categories'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
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
import { Plus, Pencil, Trash2, ArrowDownCircle, ArrowUpCircle, Upload, Download, RefreshCw, Wallet, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatRupiah, formatDateID, todayISO, categoryLabel, currentMonthRange } from '@/lib/format'
import TransactionDialog from '@/components/TransactionDialog'
import RecurringListDialog from '@/components/RecurringListDialog'
import { useProcessRecurring } from '@/hooks/useProcessRecurring'
import { toast } from 'sonner'
import { downloadCsv, pickCsvFile } from '@/lib/csv'
import { EmptyState } from '@/components/ui/empty-state'
import { exportTransactionsCsv, importTransactionsCsv } from '@/db/csvTransactions'
import { useViewAs } from '@/auth/useViewAs'
import { useCurrentPayPeriod } from '@/queries/payPeriods'

const ALL = '__all__'

export default function TransactionsTab() {
  const [filters, setFilters] = useState<TransactionFilters>(() => currentMonthRange())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [recurringOpen, setRecurringOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const qc = useQueryClient()
  const { viewingAs } = useViewAs()
  const isViewAs = viewingAs !== null

  const { data: activePeriod } = useCurrentPayPeriod()
  const autoApplied = useRef(false)

  useEffect(() => {
    if (activePeriod && !autoApplied.current) {
      autoApplied.current = true
      setFilters({ dateFrom: activePeriod.start_date, dateTo: todayISO() })
    }
  }, [activePeriod])

  // Debounce search 300ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  // Reset ke halaman 1 saat filter atau search berubah
  useEffect(() => {
    setPage(1)
  }, [filters.dateFrom, filters.dateTo, filters.type, filters.categoryId, debouncedSearch])

  // Ctrl+N → buka modal tambah transaksi
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === 'n' && !dialogOpen && !recurringOpen && !confirmOpen) {
        e.preventDefault()
        setEditing(null)
        setDialogOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [dialogOpen, recurringOpen, confirmOpen])

  useProcessRecurring()

  const { data: categories = [] } = useCategories()
  const deleteTransaction = useDeleteTransaction()

  // Resolve category ID yang cocok dengan search term (dari cache categories)
  const searchCategoryIds = useMemo(() => {
    if (!debouncedSearch || !categories.length) return []
    const lower = debouncedSearch.toLowerCase()
    return categories.filter((c) => c.name.toLowerCase().includes(lower)).map((c) => c.id)
  }, [debouncedSearch, categories])

  // Query 1: semua baris tanpa paginasi — untuk summary cards (income/expense/net)
  const { data: allRows = [] } = useTransactions(filters)

  // Query 2: baris terpaginasi + ter-search — untuk tabel
  const txFilters: TransactionFilters = {
    ...filters,
    search: debouncedSearch || undefined,
    searchCategoryIds: searchCategoryIds.length ? searchCategoryIds : undefined,
    page,
    pageSize,
  }
  const { data: rows = [], total, isLoading } = useTransactions(txFilters)

  const totals = useMemo(() => {
    let income = 0; let expense = 0
    for (const r of allRows) {
      if (r.type === 'income') income += r.amount
      else expense += r.amount
    }
    return { income, expense, net: income - expense }
  }, [allRows])

  function onDelete(id: number) {
    setConfirmId(id)
    setConfirmOpen(true)
  }

  const filteredCategories = filters.type ? categories.filter((c) => c.type === filters.type) : categories

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  )

  const startItem = rows.length === 0 ? 0 : (page - 1) * pageSize + 1
  const endItem = Math.min(page * pageSize, total)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard label="Pemasukan" value={formatRupiah(totals.income)} tone="income" />
        <SummaryCard label="Pengeluaran" value={formatRupiah(totals.expense)} tone="expense" />
        <SummaryCard label="Net" value={formatRupiah(totals.net)} tone={totals.net >= 0 ? 'income' : 'expense'} />
      </div>

      {/* Toolbar — filter baris 1, aksi baris 2, search baris 3 */}
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
                  <SelectItem key={`${c.type}-${c.id}`} value={String(c.id)}>{categoryLabel(c)} ({c.type === 'income' ? 'masuk' : 'keluar'})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Baris 2: Aksi */}
        <div className="flex items-center justify-between gap-2 border-t border-[#e0e7ff] pt-2 mb-2">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-7 text-xs text-[var(--brand)] border-[#e0e7ff]" onClick={async () => {
              const csv = await exportTransactionsCsv()
              downloadCsv(`transactions-${todayISO()}.csv`, csv)
              toast.success('CSV diekspor')
            }}>
              <Download className="h-3 w-3" />Ekspor
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs text-[var(--brand)] border-[#e0e7ff]"
              disabled={isViewAs}
              title={isViewAs ? 'Tidak tersedia saat View-As' : ''}
              onClick={async () => {
                // D-24: handler-level early-return guard (defense in depth — keyboard tab+Enter, dev console)
                if (viewingAs) {
                  toast.error('Impor CSV tidak tersedia saat View-As')
                  return
                }
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
              }}
            >
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

        {/* Baris 3: Search */}
        <div className="relative border-t border-[#e0e7ff] pt-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 mt-1 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-9 h-8 text-sm"
            placeholder="Cari catatan, kategori, jumlah..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
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
              <TableRow>
                <TableCell colSpan={6}>
                  <EmptyState
                    icon={Wallet}
                    title="Belum ada transaksi"
                    description="Catat pemasukan dan pengeluaran pertama Anda untuk mulai melacak keuangan."
                    actionLabel="+ Tambah Transaksi"
                    onAction={() => { setEditing(null); setDialogOpen(true) }}
                  />
                </TableCell>
              </TableRow>
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
                    <TableCell className="font-medium">{(() => {
                      const c = categoryById.get(r.category_id)
                      return c ? categoryLabel(c) : (r.category_name || '—')
                    })()}</TableCell>
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

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">
          {total === 0
            ? 'Tidak ada transaksi'
            : `Menampilkan ${startItem}–${endItem} dari ${total} transaksi`}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Tampil</span>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => { setPageSize(Number(v)); setPage(1) }}
          >
            <SelectTrigger className="h-7 w-16 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[10, 20, 50].map((n) => (
                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">/ hal</span>
          <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="h-4 w-4" />Prev
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs" disabled={endItem >= total} onClick={() => setPage((p) => p + 1)}>
            Next<ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Hapus Transaksi"
        description="Transaksi ini akan dihapus permanen. Tindakan ini tidak dapat dibatalkan."
        onConfirm={() => { if (confirmId != null) deleteTransaction.mutate(confirmId) }}
      />
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

import { useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
  type PieLabelRenderProps,
} from 'recharts'
import { Download } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useAggregateByPeriod, useAggregateByCategory, type PeriodGranularity } from '@/queries/reports'
import { useInvestments, costBasis, currentValue } from '@/queries/investments'
import { formatRupiah, shortRupiah, todayISO } from '@/lib/format'
import { exportReportPDF, type ExportReportParams } from '@/lib/export-pdf'
import {
  type InsightLine,
  generatePeriodInsight,
  generateExpenseCatInsight,
  generateIncomeCatInsight,
  generateInvestmentInsight,
} from '@/lib/report-insights'

type PeriodPreset = 'today' | 'month' | 'year' | 'all' | 'custom'

const PIE_COLORS = [
  '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
]

export default function ReportsTab() {
  const [preset, setPreset] = useState<PeriodPreset>('month')
  const [gran, setGran] = useState<PeriodGranularity>('day')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const range = useMemo(() => resolvePreset(preset, from, to), [preset, from, to])

  const { data: periodData = [] } = useAggregateByPeriod(gran, range.from, range.to)
  const { data: expenseByCat = [] } = useAggregateByCategory('expense', range.from, range.to)
  const { data: incomeByCat = [] } = useAggregateByCategory('income', range.from, range.to)
  const { data: invRows = [] } = useInvestments()

  const investments = useMemo(() =>
    invRows.map((i) => ({ name: i.asset_name, modal: costBasis(i), nilai: currentValue(i) })),
    [invRows]
  )

  const totals = useMemo(() => {
    let income = 0; let expense = 0
    for (const p of periodData) { income += Number(p.income); expense += Number(p.expense) }
    return { income, expense, net: income - expense }
  }, [periodData])

  const periodInsight = useMemo(
    () => generatePeriodInsight(totals, periodData),
    [totals, periodData]
  )

  const expenseCatInsight = useMemo(
    () => generateExpenseCatInsight(expenseByCat),
    [expenseByCat]
  )

  const incomeCatInsight = useMemo(
    () => generateIncomeCatInsight(incomeByCat, periodData),
    [incomeByCat, periodData]
  )

  const investmentInsight = useMemo(
    () => generateInvestmentInsight(investments),
    [investments]
  )

  const [exporting, setExporting] = useState(false)

  function buildPeriodeLabel(p: PeriodPreset, f: string, t: string): string {
    const d = new Date()
    if (p === 'month') return `Bulan ini: ${d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}`
    if (p === 'year') return `Tahun ini: ${d.getFullYear()}`
    if (p === 'today') return `Hari ini: ${todayISO()}`
    if (p === 'all') return 'Semua periode'
    if (f && t) return `${f} s/d ${t}`
    if (f) return `Dari ${f}`
    return 'Periode kustom'
  }

  function buildFilenameMonth(p: PeriodPreset, f: string): string {
    const d = new Date()
    if (p === 'month') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (p === 'year') return String(d.getFullYear())
    if (p === 'today') return todayISO()
    if (p === 'all') return 'semua'
    if (f) return f.slice(0, 7)
    return 'kustom'
  }

  function handleExport() {
    setExporting(true)
    try {
      const params: ExportReportParams = {
        periodeLabel: buildPeriodeLabel(preset, from, to),
        filenameMonth: buildFilenameMonth(preset, from),
        totals,
        expenseByCat,
        incomeByCat,
        investments,
      }
      exportReportPDF(params)
    } catch {
      import('sonner').then(({ toast }) => toast.error('Gagal membuat PDF'))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1">
          <Label className="text-xs">Periode</Label>
          <Select value={preset} onValueChange={(v) => setPreset(v as PeriodPreset)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hari ini</SelectItem>
              <SelectItem value="month">Bulan ini</SelectItem>
              <SelectItem value="year">Tahun ini</SelectItem>
              <SelectItem value="all">Semua</SelectItem>
              <SelectItem value="custom">Kustom</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {preset === 'custom' && (
          <>
            <div className="grid gap-1">
              <Label className="text-xs">Dari</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Sampai</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
            </div>
          </>
        )}

        <div className="grid gap-1">
          <Label className="text-xs">Kelompokkan per</Label>
          <Select value={gran} onValueChange={(v) => setGran(v as PeriodGranularity)}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Hari</SelectItem>
              <SelectItem value="week">Minggu</SelectItem>
              <SelectItem value="month">Bulan</SelectItem>
              <SelectItem value="year">Tahun</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="ml-auto">
          <Button
            variant="outline"
            size="sm"
            disabled={exporting}
            onClick={handleExport}
          >
            <Download className="mr-2 h-4 w-4" />
            Export PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard label="Pemasukan" value={formatRupiah(totals.income)} tone="up" />
        <SummaryCard label="Pengeluaran" value={formatRupiah(totals.expense)} tone="down" />
        <SummaryCard label="Net" value={formatRupiah(totals.net)} tone={totals.net >= 0 ? 'up' : 'down'} />
      </div>

      <Panel title="Pemasukan vs Pengeluaran" insight={periodInsight}>
        {periodData.length === 0 ? <EmptyChart /> : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={periodData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis tickFormatter={shortRupiah} />
              <Tooltip formatter={(v) => formatRupiah(Number(v))} />
              <Legend />
              <Bar dataKey="income" name="Pemasukan" fill="#10b981" />
              <Bar dataKey="expense" name="Pengeluaran" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Panel>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Panel title="Pengeluaran per Kategori" insight={expenseCatInsight}>
          {expenseByCat.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={expenseByCat} dataKey="total" nameKey="category" outerRadius={100} label={(e: PieLabelRenderProps) => String(e.name ?? '')}>
                  {expenseByCat.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => formatRupiah(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel title="Pemasukan per Kategori" insight={incomeCatInsight}>
          {incomeByCat.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={incomeByCat} dataKey="total" nameKey="category" outerRadius={100} label={(e: PieLabelRenderProps) => String(e.name ?? '')}>
                  {incomeByCat.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => formatRupiah(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>

      <Panel title="Kinerja Investasi" insight={investmentInsight}>
        {investments.length === 0 ? <EmptyChart text="Belum ada investasi untuk ditampilkan." /> : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={investments}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis tickFormatter={shortRupiah} />
              <Tooltip formatter={(v) => formatRupiah(Number(v))} />
              <Legend />
              <Bar dataKey="modal" name="Modal" fill="#64748b" />
              <Bar dataKey="nilai" name="Nilai Kini" fill="#0ea5e9" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Panel>
    </div>
  )
}

function resolvePreset(preset: PeriodPreset, from: string, to: string): { from?: string; to?: string } {
  if (preset === 'all') return {}
  if (preset === 'custom') return { from: from || undefined, to: to || undefined }
  const today = todayISO()
  if (preset === 'today') return { from: today, to: today }
  const d = new Date()
  if (preset === 'month') {
    const first = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
    return { from: first, to: today }
  }
  return { from: `${d.getFullYear()}-01-01`, to: today }
}


function Panel({ title, children, insight }: { title: string; children: React.ReactNode; insight?: InsightLine[] }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <h3 className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      {children}
      {insight && insight.length > 0 && (
        <div className="mt-4 border-t pt-3 space-y-1">
          {insight.map((line, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                line.tone === 'positive' ? 'bg-emerald-500' :
                line.tone === 'negative' ? 'bg-red-500' :
                'bg-muted-foreground/40'
              }`} />
              <span className="text-sm text-muted-foreground">{line.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function EmptyChart({ text }: { text?: string }) {
  return (
    <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
      {text ?? 'Belum ada data pada periode ini.'}
    </div>
  )
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone: 'up' | 'down' }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${tone === 'up' ? 'text-emerald-600' : 'text-red-600'}`}>{value}</div>
    </div>
  )
}

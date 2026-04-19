import { useMemo } from 'react'
import { useAggregateByPeriod } from '@/queries/reports'
import { useInvestments, costBasis, currentValue } from '@/queries/investments'
import { useGoals, goalProgress } from '@/queries/goals'
import { useTransactions } from '@/queries/transactions'
import { formatRupiah, todayISO, formatDateID } from '@/lib/format'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { ArrowUpCircle, ArrowDownCircle, TrendingUp, TrendingDown } from 'lucide-react'
import RencanaBar from '@/components/RencanaBar'
import { useRencanaInit } from '@/lib/useRencanaInit'

function firstDayOfMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export default function DashboardTab() {
  const today = todayISO()
  const monthStart = firstDayOfMonth()

  const { data: periodData = [] } = useAggregateByPeriod('month', monthStart, today)
  const { data: invRows = [] } = useInvestments()
  const { data: goals = [] } = useGoals()
  const { data: recentTx = [] } = useTransactions({ limit: 5 })
  useRencanaInit()

  const monthly = useMemo(() => {
    let income = 0; let expense = 0
    for (const p of periodData) { income += Number(p.income); expense += Number(p.expense) }
    return { income, expense, net: income - expense }
  }, [periodData])

  const inv = useMemo(() => {
    let totalModal = 0; let totalNilai = 0
    for (const i of invRows) { totalModal += costBasis(i); totalNilai += currentValue(i) }
    const gl = totalNilai - totalModal
    const pct = totalModal === 0 ? 0 : (gl / totalModal) * 100
    return { totalModal, totalNilai, gl, pct }
  }, [invRows])

  const activeGoals = useMemo(() =>
    goals
      .filter((g) => g.status === 'active')
      .sort((a, b) => goalProgress(b) - goalProgress(a))
      .slice(0, 4),
    [goals]
  )

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard
          label="Pemasukan Bulan Ini"
          value={formatRupiah(monthly.income)}
          tone="income"
        />
        <MetricCard
          label="Pengeluaran Bulan Ini"
          value={formatRupiah(monthly.expense)}
          tone="expense"
        />
        <MetricCard
          label="Net Bulan Ini"
          value={formatRupiah(monthly.net)}
          tone={monthly.net >= 0 ? 'income' : 'expense'}
        />
        <MetricCard
          label="Nilai Investasi"
          value={formatRupiah(inv.totalNilai)}
          sub={inv.totalModal > 0
            ? `${inv.gl >= 0 ? '+' : ''}${formatRupiah(inv.gl)} (${inv.pct >= 0 ? '+' : ''}${inv.pct.toFixed(1)}%)`
            : undefined}
          tone={inv.gl >= 0 ? 'income' : 'expense'}
        />
      </div>

      {inv.totalNilai > 0 && <RencanaBar totalNilai={inv.totalNilai} goals={goals} />}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Recent transactions */}
        <Panel title="Transaksi Terakhir">
          {recentTx.length === 0 ? (
            <Empty text="Belum ada transaksi." />
          ) : (
            <ul className="divide-y">
              {recentTx.map((r) => {
                const isIncome = r.type === 'income'
                return (
                  <li key={r.id} className="flex items-center gap-3 py-2.5">
                    <span className={isIncome ? 'text-emerald-600' : 'text-red-500'}>
                      {isIncome
                        ? <ArrowUpCircle className="h-4 w-4" />
                        : <ArrowDownCircle className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{r.category_name}</div>
                      <div className="text-xs text-muted-foreground">{formatDateID(r.date)}{r.note ? ` · ${r.note}` : ''}</div>
                    </div>
                    <span className={`text-sm font-semibold tabular-nums ${isIncome ? 'text-emerald-600' : 'text-red-500'}`}>
                      {isIncome ? '+' : '−'}{formatRupiah(r.amount)}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>

        {/* Active goals */}
        <Panel title="Goals Aktif">
          {activeGoals.length === 0 ? (
            <Empty text="Belum ada goal aktif." />
          ) : (
            <ul className="space-y-4">
              {activeGoals.map((g) => {
                const pct = goalProgress(g)
                const remaining = Math.max(0, g.target_amount - g.current_amount)
                return (
                  <li key={g.id}>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{g.name}</span>
                      <Badge variant="outline" className="shrink-0 text-xs">{pct.toFixed(0)}%</Badge>
                    </div>
                    <Progress value={pct} className="h-2" />
                    <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                      <span>{formatRupiah(g.current_amount)}</span>
                      {remaining > 0
                        ? <span>Sisa {formatRupiah(remaining)}</span>
                        : <span className="text-emerald-600 font-medium">Tercapai</span>}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  )
}

function MetricCard({ label, value, sub, tone }: {
  label: string
  value: string
  sub?: string
  tone: 'income' | 'expense'
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        {tone === 'income'
          ? <TrendingUp className="h-3 w-3 text-emerald-500" />
          : <TrendingDown className="h-3 w-3 text-red-500" />}
        {label}
      </div>
      <div className={`text-xl font-semibold ${tone === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <h3 className="mb-4 text-sm font-semibold">{title}</h3>
      {children}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">{text}</div>
  )
}

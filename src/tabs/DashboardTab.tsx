import { useMemo } from 'react'
import { useAggregateByPeriod } from '@/queries/reports'
import { useInvestments, costBasis, currentValue } from '@/queries/investments'
import { useNetWorthAccounts, useNetWorthLiabilities, useNetWorthSnapshots } from '@/queries/netWorth'
import { useGoals, goalProgress } from '@/queries/goals'
import { useTransactions } from '@/queries/transactions'
import { formatRupiah, todayISO, formatDateID, shortRupiah } from '@/lib/format'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { ArrowUpCircle, ArrowDownCircle } from 'lucide-react'
import RencanaBar from '@/components/RencanaBar'
import { useRencanaInit } from '@/lib/useRencanaInit'
import UpcomingBillsPanel from '@/components/UpcomingBillsPanel'

function firstDayOfMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export default function DashboardTab() {
  const today = todayISO()
  const monthStart = firstDayOfMonth()

  const prevMonthStart = useMemo(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  }, [])

  const prevMonthEnd = useMemo(() => {
    const d = new Date()
    d.setDate(0) // hari terakhir bulan lalu
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, [])

  const { data: prevPeriodData = [] } = useAggregateByPeriod('month', prevMonthStart, prevMonthEnd)

  const { data: periodData = [] } = useAggregateByPeriod('month', monthStart, today)
  const { data: invRows = [] } = useInvestments()
  const { data: goals = [] } = useGoals()
  const { data: recentTx = [] } = useTransactions({ limit: 5 })
  const { data: nwAccounts = [] } = useNetWorthAccounts()
  const { data: nwLiabilities = [] } = useNetWorthLiabilities()
  const { data: nwSnapshots = [] } = useNetWorthSnapshots()
  useRencanaInit()

  const monthly = useMemo(() => {
    let income = 0; let expense = 0
    for (const p of periodData) { income += Number(p.income); expense += Number(p.expense) }
    return { income, expense, net: income - expense }
  }, [periodData])

  const prevMonthly = useMemo(() => {
    let income = 0; let expense = 0
    for (const p of prevPeriodData) { income += Number(p.income); expense += Number(p.expense) }
    return { income, expense }
  }, [prevPeriodData])

  function trendPct(curr: number, prev: number): number | null {
    if (prev === 0) return null
    return Math.round(((curr - prev) / prev) * 100)
  }

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

  const netWorth = useMemo(() => {
    const totalAccounts = nwAccounts.reduce((s, a) => s + Number(a.balance), 0)
    const totalInvestments = invRows.reduce((s, i) => s + currentValue(i), 0)
    const totalLiabilities = nwLiabilities.reduce((s, l) => s + Number(l.amount), 0)
    return totalAccounts + totalInvestments - totalLiabilities
  }, [nwAccounts, nwLiabilities, invRows])

  const netWorthTrend = useMemo(() => {
    const lastTwo = nwSnapshots.slice(-2)
    if (lastTwo.length < 2) return null
    return trendPct(Number(lastTwo[1].net_worth), Number(lastTwo[0].net_worth))
  }, [nwSnapshots])

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
        <MetricCard
          label="Pemasukan"
          value={shortRupiah(monthly.income)}
          accentColor="#10b981"
          trend={trendPct(monthly.income, prevMonthly.income)}
          trendUp="good"
        />
        <MetricCard
          label="Pengeluaran"
          value={shortRupiah(monthly.expense)}
          accentColor="#ef4444"
          trend={trendPct(monthly.expense, prevMonthly.expense)}
          trendUp="bad"
        />
        <MetricCard
          label="Net Bulan Ini"
          value={shortRupiah(monthly.net)}
          gradient
          trend={null}
        />
        <MetricCard
          label="Nilai Investasi"
          value={shortRupiah(inv.totalNilai)}
          accentColor="#6366f1"
          sub={inv.totalModal > 0
            ? `${inv.gl >= 0 ? '+' : ''}${inv.pct.toFixed(1)}%`
            : undefined}
          trend={null}
        />
        <MetricCard
          label="Net Worth"
          value={shortRupiah(netWorth)}
          gradient
          trend={netWorthTrend}
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

      <Panel title="Tagihan Bulan Ini">
        <UpcomingBillsPanel income={monthly.income} expense={monthly.expense} />
      </Panel>
    </div>
  )
}

function MetricCard({
  label,
  value,
  sub,
  accentColor,
  gradient,
  trend,
  trendUp,
}: {
  label: string
  value: string
  sub?: string
  accentColor?: string
  gradient?: boolean
  trend?: number | null
  trendUp?: 'good' | 'bad'
}) {
  if (gradient) {
    const trendColor = trend == null ? '' : trend >= 0 ? 'bg-emerald-500/30 text-emerald-100' : 'bg-red-500/30 text-red-100'
    const trendArrow = trend == null ? '' : trend >= 0 ? '↑' : '↓'
    return (
      <div
        className="rounded-xl p-4 text-white"
        style={{ background: 'linear-gradient(135deg, #6366f1, #818cf8)' }}
      >
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-indigo-200">{label}</div>
        <div className="text-xl font-extrabold tracking-tight">{value}</div>
        {trend != null && (
          <span className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${trendColor}`}>
            {trendArrow} {Math.abs(trend)}% vs bln lalu
          </span>
        )}
      </div>
    )
  }

  const trendPosIsGood = trendUp === 'good'
  const trendColor = trend == null ? '' :
    (trend >= 0 && trendPosIsGood) || (trend < 0 && !trendPosIsGood)
      ? 'bg-emerald-100 text-emerald-700'
      : 'bg-red-100 text-red-700'
  const trendArrow = trend == null ? '' : trend >= 0 ? '↑' : '↓'

  return (
    <div
      className="rounded-xl border bg-card p-4"
      style={accentColor ? { borderTop: `3px solid ${accentColor}` } : {}}
    >
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-xl font-extrabold tracking-tight text-foreground">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
      {trend != null && (
        <span className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${trendColor}`}>
          {trendArrow} {Math.abs(trend)}% vs bln lalu
        </span>
      )}
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

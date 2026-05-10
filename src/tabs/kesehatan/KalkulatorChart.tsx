import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { YearlyBreakdown } from './CompoundInterestMath'
import { formatRupiah } from '@/lib/format'

type ChartTooltipPayload = {
  payload: YearlyBreakdown
}

function ChartTooltipContent({
  active,
  payload,
}: {
  active?: boolean
  payload?: ChartTooltipPayload[]
}) {
  if (!active || !payload || payload.length === 0) return null
  const row = payload[0]?.payload
  if (!row) return null
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-popover-foreground shadow-md font-sans text-sm">
      <div className="font-semibold mb-1">Tahun {row.year}</div>
      <div className="text-xs text-muted-foreground">Total setoran</div>
      <div className="tabular-nums mb-1">{formatRupiah(row.totalContrib)}</div>
      <div className="text-xs text-muted-foreground">Total bunga</div>
      <div className="tabular-nums mb-1 text-green-700">{formatRupiah(row.totalInterest)}</div>
      <div className="text-xs text-muted-foreground">Nilai akhir</div>
      <div className="tabular-nums font-semibold">{formatRupiah(row.finalValue)}</div>
    </div>
  )
}

export type KalkulatorChartProps = {
  data: YearlyBreakdown[]
}

export default function KalkulatorChart({ data }: KalkulatorChartProps) {
  if (data.length === 0) {
    return (
      <div className="aspect-[4/3] md:aspect-[16/9] w-full flex items-center justify-center bg-muted/30 rounded-md">
        <span className="text-sm text-muted-foreground">Tidak ada data untuk ditampilkan</span>
      </div>
    )
  }

  return (
    <div className="aspect-[4/3] md:aspect-[16/9] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="year"
            tick={{ fontSize: 11, fill: '#6b7280' }}
            tickFormatter={(v) => `Tahun ${v}`}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#6b7280' }}
            width={70}
            tickFormatter={(v: number) => `Rp ${(v / 1_000_000).toFixed(0)}jt`}
          />
          <Tooltip
            content={<ChartTooltipContent />}
            cursor={{ stroke: '#9ca3af', strokeDasharray: '3 3' }}
          />
          <Line
            type="monotone"
            dataKey="finalValue"
            stroke="#10b981"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 5, fill: '#10b981', stroke: '#ffffff', strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

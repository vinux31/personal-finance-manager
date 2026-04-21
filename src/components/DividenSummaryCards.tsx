import { formatRupiah } from '@/lib/format'

interface Props {
  totalValue: number
  totalAnnualIncome: number
  avgYield: number
  avgYieldOnCost: number
}

export default function DividenSummaryCards({
  totalValue,
  totalAnnualIncome,
  avgYield,
  avgYieldOnCost,
}: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Card label="Total Nilai" value={formatRupiah(totalValue)} />
      <Card label="Income / Tahun" value={formatRupiah(totalAnnualIncome)} />
      <Card label="Avg Yield" value={`${avgYield.toFixed(2)}%`} />
      <Card label="Yield on Cost" value={`${avgYieldOnCost.toFixed(2)}%`} />
    </div>
  )
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  )
}

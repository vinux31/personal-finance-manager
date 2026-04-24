import { useMemo } from 'react'
import { useUpcomingBills } from '@/queries/recurringTransactions'
import { formatRupiah } from '@/lib/format'

interface UpcomingBillsPanelProps {
  income: number
  expense: number
}

const urgencyDotClass = {
  overdue: 'bg-red-500',
  soon: 'bg-yellow-500',
  later: 'bg-gray-400',
} as const

const urgencyTextClass = {
  overdue: 'text-red-600',
  soon: 'text-yellow-600',
  later: 'text-muted-foreground',
} as const

function dayDiff(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number)
  const due = new Date(y, m - 1, d)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  due.setHours(0, 0, 0, 0)
  return Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function getUrgency(diff: number): 'overdue' | 'soon' | 'later' {
  if (diff <= 0) return 'overdue'
  if (diff <= 7) return 'soon'
  return 'later'
}

function dueSubText(diff: number): string {
  if (diff < 0) return `terlambat ${Math.abs(diff)} hari`
  if (diff === 0) return 'jatuh tempo hari ini'
  if (diff === 1) return 'besok'
  return `${diff} hari lagi`
}

export default function UpcomingBillsPanel({ income, expense }: UpcomingBillsPanelProps) {
  const { data, isLoading, isError } = useUpcomingBills()
  const bills = data ?? []

  const totalBills = useMemo(
    () => bills.reduce((sum, b) => sum + Number(b.amount), 0),
    [bills],
  )
  const sisaAman = income - expense - totalBills

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        Memuat…
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        Gagal memuat tagihan. Coba lagi.
      </div>
    )
  }

  if (bills.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        Tidak ada tagihan bulan ini.
      </div>
    )
  }

  const listClass = `divide-y ${bills.length > 6 ? 'max-h-64 overflow-y-auto' : ''}`

  return (
    <div>
      <ul className={listClass}>
        {bills.map((bill) => {
          const diff = dayDiff(bill.next_due_date)
          const urgency = getUrgency(diff)
          return (
            <li key={bill.id} className="flex items-center gap-3 py-2.5">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${urgencyDotClass[urgency]}`}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{bill.name}</div>
                <div className={`text-xs ${urgencyTextClass[urgency]}`}>
                  {dueSubText(diff)}
                </div>
              </div>
              <span className="text-sm font-semibold tabular-nums">
                {formatRupiah(bill.amount)}
              </span>
            </li>
          )
        })}
      </ul>
      <div className="border-t mt-2 pt-2 flex items-center justify-between">
        <span className="text-sm font-semibold">Sisa Aman Bulan Ini</span>
        <span
          className={`text-sm font-semibold tabular-nums ${sisaAman < 0 ? 'text-red-500' : ''}`}
        >
          {formatRupiah(sisaAman)}
        </span>
      </div>
    </div>
  )
}

import { shortRupiah } from '@/lib/format'
import type { PeriodAgg, CategoryAgg } from '@/db/reports'

export type InsightLine = { text: string; tone: 'positive' | 'negative' | 'neutral' }

type Totals = { income: number; expense: number; net: number }
type InvestmentRow = { name: string; modal: number; nilai: number }

export function generatePeriodInsight(totals: Totals, periodData: PeriodAgg[]): InsightLine[] {
  const lines: InsightLine[] = []

  if (totals.net === 0) {
    lines.push({ text: 'Pemasukan dan pengeluaran seimbang pada periode ini.', tone: 'neutral' })
  } else if (totals.net > 0) {
    lines.push({ text: `Net surplus sebesar ${shortRupiah(totals.net)} pada periode ini.`, tone: 'positive' })
  } else {
    lines.push({ text: `Net defisit sebesar ${shortRupiah(Math.abs(totals.net))} pada periode ini.`, tone: 'negative' })
  }

  if (periodData.length > 0) {
    const peak = periodData.reduce((a, b) => Number(b.expense) > Number(a.expense) ? b : a)
    lines.push({ text: `Pengeluaran terbesar terjadi pada ${peak.period} (${shortRupiah(Number(peak.expense))}).`, tone: 'neutral' })
  }

  if (periodData.length >= 2) {
    const last = Number(periodData[periodData.length - 1].expense)
    const prev = Number(periodData[periodData.length - 2].expense)
    if (last > prev) {
      lines.push({ text: 'Pengeluaran meningkat dibanding periode sebelumnya.', tone: 'negative' })
    } else if (last < prev) {
      lines.push({ text: 'Pengeluaran menurun dibanding periode sebelumnya.', tone: 'positive' })
    }
  }

  return lines
}

export function generateExpenseCatInsight(expenseByCat: CategoryAgg[]): InsightLine[] {
  if (expenseByCat.length === 0) return []
  const lines: InsightLine[] = []
  const total = expenseByCat.reduce((s, c) => s + Number(c.total), 0)
  const sorted = [...expenseByCat].sort((a, b) => Number(b.total) - Number(a.total))

  const top = sorted[0]
  const pct = total > 0 ? Math.round((Number(top.total) / total) * 100) : 0
  lines.push({ text: `Kategori terbesar: ${top.category} sebesar ${shortRupiah(Number(top.total))} (${pct}%).`, tone: 'neutral' })

  if (sorted.length >= 2) {
    const second = sorted[1]
    const pct2 = total > 0 ? Math.round((Number(second.total) / total) * 100) : 0
    lines.push({ text: `Diikuti oleh ${second.category} (${shortRupiah(Number(second.total))}, ${pct2}%).`, tone: 'neutral' })
  }

  if (pct > 50) {
    lines.push({ text: `${top.category} mendominasi lebih dari separuh total pengeluaran.`, tone: 'negative' })
  }

  return lines
}

export function generateIncomeCatInsight(incomeByCat: CategoryAgg[], periodData: PeriodAgg[]): InsightLine[] {
  if (incomeByCat.length === 0) return []
  const lines: InsightLine[] = []
  const total = incomeByCat.reduce((s, c) => s + Number(c.total), 0)
  const sorted = [...incomeByCat].sort((a, b) => Number(b.total) - Number(a.total))

  const top = sorted[0]
  const pct = total > 0 ? Math.round((Number(top.total) / total) * 100) : 0
  lines.push({ text: `Sumber pemasukan terbesar: ${top.category} (${shortRupiah(Number(top.total))}, ${pct}%).`, tone: 'neutral' })

  lines.push({ text: `Total ${incomeByCat.length} sumber pemasukan aktif pada periode ini.`, tone: 'neutral' })

  if (periodData.length >= 2) {
    const last = Number(periodData[periodData.length - 1].income)
    const prev = Number(periodData[periodData.length - 2].income)
    if (last > prev) {
      lines.push({ text: 'Pemasukan meningkat dibanding periode sebelumnya.', tone: 'positive' })
    } else if (last < prev) {
      lines.push({ text: 'Pemasukan menurun dibanding periode sebelumnya.', tone: 'negative' })
    }
  }

  return lines
}

export function generateInvestmentInsight(investments: InvestmentRow[]): InsightLine[] {
  if (investments.length === 0) return []
  const lines: InsightLine[] = []

  const totalModal = investments.reduce((s, i) => s + i.modal, 0)
  const totalNilai = investments.reduce((s, i) => s + i.nilai, 0)
  const returnNominal = totalNilai - totalModal
  const returnPct = totalModal > 0 ? ((returnNominal / totalModal) * 100).toFixed(1) : '0.0'

  if (returnNominal > 0) {
    lines.push({ text: `Total investasi untung ${shortRupiah(returnNominal)} dari modal ${shortRupiah(totalModal)} (return ${returnPct}%).`, tone: 'positive' })
  } else if (returnNominal === 0) {
    lines.push({ text: `Total investasi impas dari modal ${shortRupiah(totalModal)}.`, tone: 'neutral' })
  } else {
    lines.push({ text: `Total investasi rugi ${shortRupiah(Math.abs(returnNominal))} dari modal ${shortRupiah(totalModal)} (return ${returnPct}%).`, tone: 'negative' })
  }

  const withReturn = investments.map(i => ({ ...i, ret: i.nilai - i.modal }))
  const best = withReturn.reduce((a, b) => b.ret > a.ret ? b : a)
  const worst = withReturn.reduce((a, b) => b.ret < a.ret ? b : a)

  if (best.ret > 0) {
    lines.push({ text: `Aset dengan return terbaik: ${best.name} (+${shortRupiah(best.ret)}).`, tone: 'positive' })
  }
  if (worst.ret < 0) {
    lines.push({ text: `Aset dengan return terburuk: ${worst.name} (-${shortRupiah(Math.abs(worst.ret))}).`, tone: 'negative' })
  }

  return lines
}

const rupiahFmt = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const pad2 = (n: number) => String(n).padStart(2, '0')

export function formatRupiah(n: number): string {
  return rupiahFmt.format(n)
}

export function parseRupiah(s: string): number {
  let cleaned = s.trim()
  // Handle Indonesian format: "5.107,65" (dot=thousands, comma=decimal)
  if (cleaned.includes(',') && cleaned.includes('.')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.')
  } else if (cleaned.includes(',')) {
    // "5107,65" → treat comma as decimal separator
    cleaned = cleaned.replace(',', '.')
  } else {
    // No comma: dots are thousands separators (e.g. "Rp 10.000.000" → "10000000")
    cleaned = cleaned.replace(/\./g, '')
  }
  // Remove anything except digits and decimal dot
  cleaned = cleaned.replace(/[^\d.]/g, '')
  return cleaned === '' ? 0 : Number(cleaned)
}

export function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function formatDateID(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function shortRupiah(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} M`
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} jt`
  if (abs >= 1_000) return `${(n / 1_000).toFixed(0)} rb`
  return formatRupiah(n)
}

export function categoryLabel(cat: { name: string; icon: string | null }): string {
  return cat.icon ? `${cat.icon} ${cat.name}` : cat.name
}

export function currentMonthRange(): { dateFrom: string; dateTo: string } {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const lastDay = new Date(y, m + 1, 0).getDate()
  return {
    dateFrom: `${y}-${pad2(m + 1)}-01`,
    dateTo: `${y}-${pad2(m + 1)}-${pad2(lastDay)}`,
  }
}

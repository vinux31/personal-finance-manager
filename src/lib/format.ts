const rupiahFmt = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

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
  }
  // Remove anything except digits and decimal dot
  cleaned = cleaned.replace(/[^\d.]/g, '')
  return cleaned === '' ? 0 : Number(cleaned)
}

export function todayISO(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
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

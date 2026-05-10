// Source: design spec §6 + Phase 15 CONTEXT.md D-13.
// 8 istilah teknis untuk inline tooltip di prose modul.
// Trusted authored content — NEVER concat user input into label/definition fields.

export type GlossaryTerm =
  | 'asset-allocation'
  | 'real-return'
  | 'sharpe-ratio'
  | 'dca'
  | 'drawdown'
  | 'expense-ratio'
  | 'rebalancing'
  | 'risk-tolerance'

export type GlossaryEntry = {
  label: string       // display text (e.g. "DCA (Dollar-Cost Averaging)")
  definition: string  // 1-2 kalimat Indonesian
}

export const GLOSSARY: Record<GlossaryTerm, GlossaryEntry> = {
  'asset-allocation': {
    label: 'Asset Allocation',
    definition: 'Strategi pembagian portofolio antar kelas aset (saham, obligasi, kas, properti, emas) untuk menyeimbangkan return dan risiko sesuai tujuan finansial.',
  },
  'real-return': {
    label: 'Real Return',
    definition: 'Return investasi setelah dikurangi inflasi dan pajak. Inilah angka sesungguhnya yang menambah daya beli kamu.',
  },
  'sharpe-ratio': {
    label: 'Sharpe Ratio',
    definition: 'Ukuran return per unit risiko. Semakin tinggi nilainya, semakin efisien portofolio mengonversi risiko menjadi imbal hasil.',
  },
  'dca': {
    label: 'DCA (Dollar-Cost Averaging)',
    definition: 'Strategi investasi rutin dengan jumlah tetap, terlepas dari naik-turun harga. Mengurangi risiko salah waktu masuk pasar.',
  },
  'drawdown': {
    label: 'Drawdown',
    definition: 'Persentase penurunan portofolio dari puncak ke titik terendahnya. Mengukur seberapa dalam loss yang harus kamu tahan secara mental.',
  },
  'expense-ratio': {
    label: 'Expense Ratio',
    definition: 'Biaya tahunan reksadana atau ETF yang dipotong otomatis dari nilai aset. Selisih 1–2% per tahun bisa jadi miliaran dalam 30 tahun.',
  },
  'rebalancing': {
    label: 'Rebalancing',
    definition: 'Mengembalikan komposisi aset ke target awal — biasanya jual yang naik tinggi, beli yang turun. Disiplin "sell high, buy low".',
  },
  'risk-tolerance': {
    label: 'Risk Tolerance',
    definition: 'Kemampuan emosional dan finansial kamu menahan fluktuasi nilai investasi tanpa panik jual di titik terburuk.',
  },
}

export const GLOSSARY_TERMS: readonly GlossaryTerm[] = [
  'asset-allocation',
  'real-return',
  'sharpe-ratio',
  'dca',
  'drawdown',
  'expense-ratio',
  'rebalancing',
  'risk-tolerance',
] as const

export function isGlossaryTerm(s: string): s is GlossaryTerm {
  return (GLOSSARY_TERMS as readonly string[]).includes(s)
}

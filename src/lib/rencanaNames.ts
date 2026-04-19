export const RENCANA_GOAL_NAMES = [
  'Dana Pernikahan',
  'DP + Akad Kredit Xpander',
  'Non-Budget Nikah',
  'Dana Darurat',
  'Buffer Cadangan',
] as const

export const RENCANA_INVESTMENT_NAMES = [
  'Reksadana Sukuk Sucorinvest Sharia',
  'Emas Tabungan Pegadaian',
  'Saham BMRI',
] as const

export type RencanaGoalName = typeof RENCANA_GOAL_NAMES[number]
export type RencanaInvestmentName = typeof RENCANA_INVESTMENT_NAMES[number]

// Verification script for nextDueDate() month-end clamping fix (FOUND-01)
// Run: node scripts/test-nextDueDate.mjs
// Expected: 6 PASS lines and exit code 0

import { nextDueDate } from '../src/db/recurringTransactions.ts'

const cases = [
  // Monthly — month-end clamping (these FAIL before the fix)
  ['2024-01-31', 'monthly', '2024-02-29'], // leap year clamp
  ['2025-01-31', 'monthly', '2025-02-28'], // non-leap clamp
  ['2024-03-31', 'monthly', '2024-04-30'], // April 30-day clamp
  ['2024-05-31', 'monthly', '2024-06-30'], // June 30-day clamp
  // Monthly — no clamp needed (these PASS already)
  ['2024-12-31', 'monthly', '2025-01-31'], // year rollover
  ['2024-01-15', 'monthly', '2024-02-15'], // day <= 28
  // Other frequencies — must remain unchanged
  ['2024-01-15', 'daily',   '2024-01-16'],
  ['2024-01-15', 'weekly',  '2024-01-22'],
]

let ok = true
for (const [input, freq, expected] of cases) {
  const actual = nextDueDate(input, freq)
  if (actual !== expected) {
    console.error('FAIL', input, freq, '->', actual, 'expected', expected)
    ok = false
  } else {
    console.log('PASS', input, freq, '->', actual)
  }
}
if (!ok) process.exit(1)
console.log('\nAll tests passed.')

/**
 * Compound interest calculator (D-10 formula).
 * Pure math util — no React, no DOM, no I/O.
 *
 * Formula: per-month iteration of FV annuity.
 *   value(t+1) = value(t) * (1 + r_monthly) + monthly_contribution
 *   r_monthly = annualReturn / 12
 *   total iterations = tenorYears * 12 (max 480)
 *
 * Aggregated per year for chart display.
 */

export type FVInput = {
  principal: number      // Rupiah, saldo awal (Rp 0 .. 1_000_000_000)
  monthly: number        // Rupiah/bulan, setoran rutin (Rp 0 .. 50_000_000)
  annualReturn: number   // decimal, 0.08 = 8% (0 .. 0.25)
  tenorYears: number     // integer years (1 .. 40)
}

export type YearlyBreakdown = {
  year: number             // 1, 2, ..., tenorYears
  totalContrib: number     // principal + (monthly × 12 × year)
  totalInterest: number    // value - totalContrib
  finalValue: number       // value at end of year
}

export type FVResult = {
  summary: {
    totalContrib: number
    totalInterest: number
    finalValue: number
  }
  yearly: YearlyBreakdown[]
}

export const FV_BOUNDS = {
  principalMin: 0,
  principalMax: 1_000_000_000,
  monthlyMin: 0,
  monthlyMax: 50_000_000,
  annualReturnMin: 0,
  annualReturnMax: 0.25,
  tenorYearsMin: 1,
  tenorYearsMax: 40,
} as const

/**
 * Clamp raw inputs ke valid range. Idempotent.
 * Threat T-15-03 mitigation: prevents overflow / infinite loop di useMemo consumer.
 */
export function clampInputs(raw: Partial<FVInput>): FVInput {
  const principal = Math.max(
    FV_BOUNDS.principalMin,
    Math.min(FV_BOUNDS.principalMax, Number(raw.principal) || 0),
  )
  const monthly = Math.max(
    FV_BOUNDS.monthlyMin,
    Math.min(FV_BOUNDS.monthlyMax, Number(raw.monthly) || 0),
  )
  const annualReturn = Math.max(
    FV_BOUNDS.annualReturnMin,
    Math.min(FV_BOUNDS.annualReturnMax, Number(raw.annualReturn) || 0),
  )
  const tenorYearsRaw = Number(raw.tenorYears) || FV_BOUNDS.tenorYearsMin
  const tenorYears = Math.max(
    FV_BOUNDS.tenorYearsMin,
    Math.min(FV_BOUNDS.tenorYearsMax, Math.floor(tenorYearsRaw)),
  )
  return { principal, monthly, annualReturn, tenorYears }
}

/**
 * Compute FV per-month, aggregate per year. D-10 formula.
 * Returns yearly breakdown + summary. Pure function, deterministic.
 */
export function computeFV(rawInput: FVInput): FVResult {
  const input = clampInputs(rawInput)
  const { principal, monthly, annualReturn, tenorYears } = input
  const rMonthly = annualReturn / 12

  const yearly: YearlyBreakdown[] = []
  let value = principal
  let cumulativeContrib = principal

  for (let year = 1; year <= tenorYears; year++) {
    for (let m = 0; m < 12; m++) {
      // Apply monthly compound + monthly contribution
      value = value * (1 + rMonthly) + monthly
      cumulativeContrib += monthly
    }
    yearly.push({
      year,
      totalContrib: round(cumulativeContrib),
      totalInterest: round(value - cumulativeContrib),
      finalValue: round(value),
    })
  }

  const summary = yearly[yearly.length - 1] ?? {
    // Defensive: tenorYears clamped to ≥1, this branch unreachable.
    totalContrib: principal,
    totalInterest: 0,
    finalValue: principal,
  }

  return {
    summary: {
      totalContrib: summary.totalContrib,
      totalInterest: summary.totalInterest,
      finalValue: summary.finalValue,
    },
    yearly,
  }
}

function round(n: number): number {
  // Round to nearest Rupiah (no fractional). Avoids floating-point display noise.
  return Math.round(n)
}

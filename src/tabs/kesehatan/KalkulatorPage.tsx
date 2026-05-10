import { useMemo, useReducer } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  computeFV,
  clampInputs,
  FV_BOUNDS,
  type FVInput,
  type YearlyBreakdown,
} from './CompoundInterestMath'
import { formatRupiah, parseRupiah } from '@/lib/format'
import KalkulatorChart from './KalkulatorChart'

// UI-SPEC defaults (D-06)
const DEFAULT_STATE: FVInput = {
  principal: 10_000_000,
  monthly: 1_000_000,
  annualReturn: 0.08,
  tenorYears: 10,
}

type Action =
  | { type: 'SET_PRINCIPAL'; value: number }
  | { type: 'SET_MONTHLY'; value: number }
  | { type: 'SET_RETURN'; value: number } // decimal (0.08 = 8%)
  | { type: 'SET_TENOR'; value: number }
  | { type: 'RESET' }

function reducer(state: FVInput, action: Action): FVInput {
  switch (action.type) {
    case 'SET_PRINCIPAL':
      return clampInputs({ ...state, principal: action.value })
    case 'SET_MONTHLY':
      return clampInputs({ ...state, monthly: action.value })
    case 'SET_RETURN':
      return clampInputs({ ...state, annualReturn: action.value })
    case 'SET_TENOR':
      return clampInputs({ ...state, tenorYears: action.value })
    case 'RESET':
      return DEFAULT_STATE
    default:
      return state
  }
}

const FIVE_YEAR_ROWS = [5, 10, 15, 20, 25, 30, 35, 40] as const

export default function KalkulatorPage() {
  const [state, dispatch] = useReducer(reducer, DEFAULT_STATE)
  const result = useMemo(() => computeFV(state), [state])

  const visibleRows: YearlyBreakdown[] = useMemo(() => {
    return FIVE_YEAR_ROWS
      .filter((y) => y <= state.tenorYears)
      .map((y) => result.yearly.find((r) => r.year === y))
      .filter((r): r is YearlyBreakdown => r != null)
  }, [result.yearly, state.tenorYears])

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 pb-16 space-y-8">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link to="/kesehatan" className="text-brand hover:underline underline-offset-4">
          Kesehatan
        </Link>
        <span className="mx-2 text-border">/</span>
        <span className="text-foreground font-medium">Kalkulator</span>
      </nav>

      {/* Header */}
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold leading-tight tracking-tight">
          Kalkulator Compound Interest
        </h1>
        <p className="text-base text-muted-foreground">
          Hitung target investasimu dengan bunga berbunga.
        </p>
      </header>

      {/* Input + Output grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Input Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Atur Skenario</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <SliderRow
              label="Saldo awal"
              helper="Modal yang sudah kamu punya hari ini"
              kind="rupiah"
              value={state.principal}
              min={FV_BOUNDS.principalMin}
              max={FV_BOUNDS.principalMax}
              step={100_000}
              onChange={(v) => dispatch({ type: 'SET_PRINCIPAL', value: v })}
            />
            <SliderRow
              label="Setoran bulanan"
              helper="Berapa yang kamu setor rutin tiap bulan"
              kind="rupiah"
              value={state.monthly}
              min={FV_BOUNDS.monthlyMin}
              max={FV_BOUNDS.monthlyMax}
              step={50_000}
              onChange={(v) => dispatch({ type: 'SET_MONTHLY', value: v })}
            />
            <SliderRow
              label="Return tahunan"
              helper="Estimasi imbal hasil per tahun, sebelum pajak"
              kind="percent"
              value={state.annualReturn}
              min={FV_BOUNDS.annualReturnMin}
              max={FV_BOUNDS.annualReturnMax}
              step={0.005}
              onChange={(v) => dispatch({ type: 'SET_RETURN', value: v })}
            />
            <SliderRow
              label="Tenor (tahun)"
              helper="Berapa tahun kamu akan investasi"
              kind="years"
              value={state.tenorYears}
              min={FV_BOUNDS.tenorYearsMin}
              max={FV_BOUNDS.tenorYearsMax}
              step={1}
              onChange={(v) => dispatch({ type: 'SET_TENOR', value: v })}
            />
          </CardContent>
        </Card>

        {/* Output Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Hasil</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm text-muted-foreground">
                Nilai akhir setelah {state.tenorYears} tahun
              </div>
              <div className="text-4xl font-semibold tabular-nums tracking-tight mt-1">
                {formatRupiah(result.summary.finalValue)}
              </div>
            </div>
            <div className="pt-2 space-y-1">
              <div className="text-sm">
                <span className="text-muted-foreground">Total setoran: </span>
                <span className="tabular-nums">{formatRupiah(result.summary.totalContrib)}</span>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">Total bunga compound: </span>
                <span className="tabular-nums text-green-700 font-medium">
                  {formatRupiah(result.summary.totalInterest)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Pertumbuhan tahun-per-tahun</CardTitle>
        </CardHeader>
        <CardContent>
          <KalkulatorChart data={result.yearly} />
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Breakdown 5-tahunan</CardTitle>
        </CardHeader>
        <CardContent>
          {state.tenorYears < 5 ? (
            <p className="text-sm text-muted-foreground italic">
              Atur tenor minimal 5 tahun untuk lihat breakdown.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs uppercase tracking-wide font-semibold">
                    Tahun
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wide font-semibold text-right">
                    Total Setoran
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wide font-semibold text-right">
                    Total Bunga
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wide font-semibold text-right">
                    Nilai Akhir
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.map((row) => (
                  <TableRow key={row.year}>
                    <TableCell className="tabular-nums">Tahun {row.year}</TableCell>
                    <TableCell className="tabular-nums text-right">
                      {formatRupiah(row.totalContrib)}
                    </TableCell>
                    <TableCell className="tabular-nums text-right text-green-700">
                      {formatRupiah(row.totalInterest)}
                    </TableCell>
                    <TableCell className="tabular-nums text-right font-medium">
                      {formatRupiah(row.finalValue)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ---------- SliderRow sub-component ----------

type SliderRowProps = {
  label: string
  helper: string
  kind: 'rupiah' | 'percent' | 'years'
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
}

function SliderRow({ label, helper, kind, value, min, max, step, onChange }: SliderRowProps) {
  const displayValue = (() => {
    if (kind === 'rupiah') return value === 0 ? '' : formatRupiah(value)
    if (kind === 'percent') return (value * 100).toFixed(1) // 0.08 -> "8.0"
    return String(value)
  })()

  const handleInputChange = (raw: string) => {
    if (kind === 'rupiah') {
      onChange(parseRupiah(raw))
    } else if (kind === 'percent') {
      const pct = Number(raw) || 0
      onChange(pct / 100) // 8.0 -> 0.08
    } else {
      onChange(Math.round(Number(raw) || 0))
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-normal tracking-wide uppercase text-muted-foreground">
            {label}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">{helper}</div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {kind === 'percent' ? (
            <>
              <Input
                type="number"
                step="0.5"
                inputMode="decimal"
                value={displayValue}
                onChange={(e) => handleInputChange(e.target.value)}
                className="w-20 text-lg tabular-nums text-right"
              />
              <span className="text-muted-foreground">%</span>
            </>
          ) : kind === 'years' ? (
            <Input
              type="number"
              inputMode="numeric"
              value={displayValue}
              onChange={(e) => handleInputChange(e.target.value)}
              className="w-20 text-lg tabular-nums text-right"
            />
          ) : (
            <Input
              type="text"
              inputMode="numeric"
              placeholder="Rp 0"
              value={displayValue}
              onChange={(e) => handleInputChange(e.target.value)}
              className="w-40 text-lg tabular-nums text-right"
            />
          )}
        </div>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
      />
    </div>
  )
}

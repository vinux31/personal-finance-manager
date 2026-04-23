// src/tabs/pensiun/SimulasiPanel.tsx
import { useState, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { calcDCA } from '@/lib/pensiun-calc'
import { formatRupiah, parseRupiah, shortRupiah } from '@/lib/format'
import type { PensionSimInput } from '@/queries/pensiun'

interface Props {
  form: PensionSimInput
  onChange: (patch: Partial<PensionSimInput>) => void
}

const RD_OPTIONS = [
  { value: 'pu', label: 'Pasar Uang (5%/thn)' },
  { value: 'pt', label: 'Pendapatan Tetap (7%/thn)' },
  { value: 'cp', label: 'Campuran (10%/thn)' },
  { value: 'sh', label: 'Saham (14%/thn)' },
]


export default function SimulasiPanel({ form, onChange }: Props) {
  const [step, setStep] = useState(1)

  const result = useMemo(() => calcDCA({
    usia: form.usia,
    usiaPensiun: form.usia_pensiun,
    investasiBulanan: form.sim_investasi_bulanan,
    kenaikanPct: form.sim_kenaikan_pct,
    inflasiPct: form.sim_inflasi_pct,
    targetBulanan: form.sim_target_spend,
    alokasiEmas: form.sim_alokasi_emas,
    alokasiSaham: form.sim_alokasi_saham,
    alokasiRd: form.sim_alokasi_rd,
    rdType: form.sim_rd_type as 'pu' | 'pt' | 'cp' | 'sh',
  }), [form])

  const tahunInvestasi = form.usia_pensiun - form.usia

  function normalizeAlokasi(key: 'emas' | 'saham' | 'rd', newVal: number) {
    const keys = ['emas', 'saham', 'rd'] as const
    const dbKeys = { emas: 'sim_alokasi_emas', saham: 'sim_alokasi_saham', rd: 'sim_alokasi_rd' } as const
    const current = { emas: form.sim_alokasi_emas, saham: form.sim_alokasi_saham, rd: form.sim_alokasi_rd }
    const others = keys.filter((k) => k !== key)
    const remaining = 100 - newVal
    const total = others.reduce((s, k) => s + current[k], 0)
    const patch: Partial<PensionSimInput> = { [dbKeys[key]]: newVal }
    if (total === 0) {
      const each = Math.floor(remaining / 2)
      patch[dbKeys[others[0]]] = each
      patch[dbKeys[others[1]]] = remaining - each
    } else {
      for (const k of others) {
        patch[dbKeys[k]] = Math.round((current[k] / total) * remaining)
      }
      // fix rounding
      const sum = newVal + (patch[dbKeys[others[0]]] ?? 0) + (patch[dbKeys[others[1]]] ?? 0)
      if (sum !== 100) patch[dbKeys[others[1]]] = (patch[dbKeys[others[1]]] ?? 0) + (100 - sum)
    }
    onChange(patch)
  }

  return (
    <div className="space-y-4">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <button
            key={s}
            onClick={() => setStep(s)}
            className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition-colors ${
              s === step
                ? 'text-white'
                : s < step
                ? 'bg-green-100 text-green-700'
                : 'bg-muted text-muted-foreground'
            }`}
            style={s === step ? { background: 'var(--gold)' } : {}}
          >
            {s < step ? '✓' : s}
          </button>
        ))}
        <span className="text-xs text-muted-foreground ml-1">
          {step === 1 && 'Parameter Investasi'}
          {step === 2 && 'Alokasi Aset'}
          {step === 3 && 'Hasil Simulasi'}
        </span>
      </div>

      {/* Step 1: Parameter */}
      {step === 1 && (
        <Card>
          <CardContent className="pt-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Investasi per bulan</Label>
                <Input
                  value={form.sim_investasi_bulanan === 0 ? '' : formatRupiah(form.sim_investasi_bulanan)}
                  placeholder="Rp 500.000"
                  onChange={(e) => onChange({ sim_investasi_bulanan: parseRupiah(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Kenaikan investasi per tahun (%)</Label>
                <Input
                  type="number"
                  value={form.sim_kenaikan_pct}
                  min={0}
                  max={30}
                  step={0.5}
                  onChange={(e) => onChange({ sim_kenaikan_pct: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Asumsi inflasi (%/thn)</Label>
                <Input
                  type="number"
                  value={form.sim_inflasi_pct}
                  min={0}
                  max={20}
                  step={0.5}
                  onChange={(e) => onChange({ sim_inflasi_pct: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Target pengeluaran saat pensiun/bulan</Label>
                <Input
                  value={form.sim_target_spend === 0 ? '' : formatRupiah(form.sim_target_spend)}
                  placeholder="Rp 10.000.000"
                  onChange={(e) => onChange({ sim_target_spend: parseRupiah(e.target.value) })}
                />
              </div>
            </div>
            <div className="mt-4 text-sm text-muted-foreground">
              Lama investasi: <strong>{tahunInvestasi > 0 ? tahunInvestasi : 0} tahun</strong> ({form.usia} → {form.usia_pensiun} thn)
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={() => setStep(2)} style={{ background: 'var(--gold)', color: 'white' }}>
                Atur Alokasi →
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Alokasi */}
      {step === 2 && (
        <Card>
          <CardContent className="pt-5 space-y-5">
            <p className="text-sm text-muted-foreground">Total alokasi harus 100%. Slider otomatis menyesuaikan.</p>

            {/* Emas */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium text-yellow-600">Emas (10%/thn)</span>
                <span className="font-bold">{form.sim_alokasi_emas}%</span>
              </div>
              <Slider
                value={[form.sim_alokasi_emas]}
                min={0} max={100} step={5}
                onValueChange={([v]) => normalizeAlokasi('emas', v)}
                className="[&_[role=slider]]:border-yellow-500"
              />
            </div>

            {/* Saham */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium text-blue-600">Saham BMRI (15%/thn)</span>
                <span className="font-bold">{form.sim_alokasi_saham}%</span>
              </div>
              <Slider
                value={[form.sim_alokasi_saham]}
                min={0} max={100} step={5}
                onValueChange={([v]) => normalizeAlokasi('saham', v)}
                className="[&_[role=slider]]:border-blue-500"
              />
            </div>

            {/* Reksadana */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium text-green-600">Reksadana</span>
                <span className="font-bold">{form.sim_alokasi_rd}%</span>
              </div>
              <Slider
                value={[form.sim_alokasi_rd]}
                min={0} max={100} step={5}
                onValueChange={([v]) => normalizeAlokasi('rd', v)}
                className="[&_[role=slider]]:border-green-500"
              />
            </div>

            {/* Alokasi bar */}
            <div className="flex h-4 overflow-hidden rounded-full">
              <div className="bg-yellow-400 transition-all" style={{ width: `${form.sim_alokasi_emas}%` }} />
              <div className="bg-blue-400 transition-all" style={{ width: `${form.sim_alokasi_saham}%` }} />
              <div className="bg-green-400 transition-all" style={{ width: `${form.sim_alokasi_rd}%` }} />
            </div>

            <div className="space-y-1.5">
              <Label>Tipe Reksadana</Label>
              <Select
                value={form.sim_rd_type}
                onValueChange={(v) => onChange({ sim_rd_type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RD_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-between mt-4">
              <Button variant="outline" onClick={() => setStep(1)}>← Ubah Parameter</Button>
              <Button onClick={() => setStep(3)} style={{ background: 'var(--gold)', color: 'white' }}>
                Lihat Hasil →
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Hasil */}
      {step === 3 && (
        <div className="space-y-4">
          {/* Hero */}
          <Card style={{ background: 'var(--gold-bg)', borderColor: 'var(--gold-border)' }}>
            <CardContent className="pt-5 text-center">
              <p className="text-sm font-medium" style={{ color: 'var(--gold-text)' }}>Total Dana Terkumpul</p>
              <p className="text-4xl font-bold mt-1" style={{ color: 'var(--gold)' }}>
                {shortRupiah(result.totalDana)}
              </p>
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium"
                style={{
                  background: result.danaCukupTahun >= 20 ? '#dcfce7' : '#fee2e2',
                  color: result.danaCukupTahun >= 20 ? '#15803d' : '#b91c1c',
                }}>
                {result.danaCukupTahun >= 20
                  ? `✓ Dana cukup untuk ${result.danaCukupTahun} tahun`
                  : `⚠ Dana hanya cukup ${result.danaCukupTahun} tahun`}
              </div>
            </CardContent>
          </Card>

          {/* 4 Metrics */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Total Dana', value: shortRupiah(result.totalDana) },
              { label: 'Total Modal', value: shortRupiah(result.totalModal) },
              { label: 'Keuntungan', value: shortRupiah(result.keuntungan) },
              { label: 'Cukup Untuk', value: `${result.danaCukupTahun} thn` },
            ].map((m) => (
              <Card key={m.label}>
                <CardContent className="pt-4 pb-4 text-center">
                  <p className="text-xs text-muted-foreground">{m.label}</p>
                  <p className="text-lg font-bold mt-0.5">{m.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Chart + Breakdown */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            <Card className="lg:col-span-3">
              <CardContent className="pt-4">
                <p className="text-sm font-medium mb-3">Proyeksi Pertumbuhan per Tahun</p>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={result.yearlyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="tahun" tick={{ fontSize: 11 }} label={{ value: 'Tahun ke-', position: 'insideBottom', offset: -2, fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => shortRupiah(v)} tick={{ fontSize: 10 }} width={70} />
                    <Tooltip formatter={(v: unknown) => formatRupiah(typeof v === 'number' ? v : 0)} />
                    <Legend />
                    <Area type="monotone" dataKey="emas" name="Emas" stackId="1" stroke="#d97706" fill="#fde68a" />
                    <Area type="monotone" dataKey="saham" name="Saham" stackId="1" stroke="#2563eb" fill="#bfdbfe" />
                    <Area type="monotone" dataKey="rd" name="Reksadana" stackId="1" stroke="#16a34a" fill="#bbf7d0" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className="lg:col-span-2">
              <CardContent className="pt-4 space-y-3">
                <p className="text-sm font-medium">Breakdown per Aset</p>
                {[
                  { label: 'Emas', value: result.perAset.emas, color: '#d97706' },
                  { label: 'Saham', value: result.perAset.saham, color: '#2563eb' },
                  { label: 'Reksadana', value: result.perAset.rd, color: '#16a34a' },
                ].map((a) => (
                  <div key={a.label} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>{a.label}</span>
                      <span className="font-medium">{shortRupiah(a.value)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${result.totalDana > 0 ? Math.round((a.value / result.totalDana) * 100) : 0}%`,
                          background: a.color,
                        }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {result.totalDana > 0 ? Math.round((a.value / result.totalDana) * 100) : 0}% dari total
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(2)}>← Ubah Alokasi</Button>
          </div>
        </div>
      )}
    </div>
  )
}

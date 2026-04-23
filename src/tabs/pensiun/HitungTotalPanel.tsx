// src/tabs/pensiun/HitungTotalPanel.tsx
import { useState, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import {
  calcBPJS,
  calcDPPK,
  calcDPLK,
  calcTaspen,
  calcPesangon,
  calcInvestasiMandiri,
} from '@/lib/pensiun-calc'
import { formatRupiah, parseRupiah, shortRupiah } from '@/lib/format'
import type { PensionSimInput } from '@/queries/pensiun'

interface Props {
  form: PensionSimInput
  onChange: (patch: Partial<PensionSimInput>) => void
}

const GOLONGAN_OPTIONS = [
  'Ia','Ib','Ic','Id','IIa','IIb','IIc','IId',
  'IIIa','IIIb','IIIc','IIId','IVa','IVb','IVc','IVd','IVe',
]


export default function HitungTotalPanel({ form, onChange }: Props) {
  const [step, setStep] = useState(1)
  const [open, setOpen] = useState<string | null>('bpjs')

  const masaKerja = form.masa_kerja

  const sumber = useMemo(() => {
    const bpjs = form.ht_en_bpjs ? calcBPJS({ upahBulanan: form.ht_bpjs_upah || form.gaji_pokok, masaKerja }) : null
    const dppk = form.ht_en_dppk ? calcDPPK({ type: form.ht_dppk_type as 'ppmp' | 'ppip', phdp: form.ht_dppk_phdp, faktor: form.ht_dppk_faktor, iuranBulanan: form.ht_dppk_iuran, masaKerja }) : null
    const dplk = form.ht_en_dplk ? calcDPLK({ iuranBulanan: form.ht_dplk_iuran, returnPct: form.ht_dplk_return, saldoAwal: form.ht_dplk_saldo, masaKerja }) : null
    const taspen = form.ht_en_taspen ? calcTaspen({ gajiTerakhir: form.ht_taspen_gaji || form.gaji_pokok, golongan: form.ht_taspen_gol, masaKerja }) : null
    const pesangon = form.ht_en_pesangon ? calcPesangon(form.gaji_pokok, masaKerja) : null
    const invest = form.ht_en_invest ? calcInvestasiMandiri({ iuranBulanan: form.ht_inv_bulanan, returnPct: form.ht_inv_return, saldoAwal: form.ht_inv_saldo, kenaikanPct: form.ht_inv_kenaikan, masaKerja }) : null

    return { bpjs, dppk, dplk, taspen, pesangon, invest }
  }, [form])

  const totalLumpSum = useMemo(() => {
    let t = 0
    if (sumber.bpjs) t += sumber.bpjs.jht + sumber.bpjs.jpBulanan * 12 * 20
    if (sumber.dppk) t += sumber.dppk.total
    if (sumber.dplk) t += sumber.dplk.total
    if (sumber.taspen) t += sumber.taspen.tht + sumber.taspen.bulanan * 12 * 20
    if (sumber.pesangon) t += sumber.pesangon.total
    if (sumber.invest) t += sumber.invest.total
    return t
  }, [sumber])

  const estimasiBulanan = useMemo(() => {
    let b = 0
    if (sumber.bpjs) b += sumber.bpjs.jpBulanan + sumber.bpjs.jht / (20 * 12)
    if (sumber.dppk) b += sumber.dppk.total / (20 * 12)
    if (sumber.dplk) b += sumber.dplk.total / (20 * 12)
    if (sumber.taspen) b += sumber.taspen.bulanan + sumber.taspen.tht / (20 * 12)
    if (sumber.pesangon) b += sumber.pesangon.total / (20 * 12)
    if (sumber.invest) b += sumber.invest.total / (20 * 12)
    return b
  }, [sumber])

  const barData = [
    { name: 'BPJS JHT', value: sumber.bpjs ? Math.round(sumber.bpjs.jht / (20 * 12)) : 0, active: form.ht_en_bpjs },
    { name: 'BPJS JP', value: sumber.bpjs ? sumber.bpjs.jpBulanan : 0, active: form.ht_en_bpjs },
    { name: 'DPPK', value: sumber.dppk ? Math.round(sumber.dppk.total / (20 * 12)) : 0, active: form.ht_en_dppk },
    { name: 'DPLK', value: sumber.dplk ? Math.round(sumber.dplk.total / (20 * 12)) : 0, active: form.ht_en_dplk },
    { name: 'Taspen', value: sumber.taspen ? sumber.taspen.bulanan : 0, active: form.ht_en_taspen },
    { name: 'Pesangon', value: sumber.pesangon ? Math.round(sumber.pesangon.total / (20 * 12)) : 0, active: form.ht_en_pesangon },
    { name: 'Investasi', value: sumber.invest ? Math.round(sumber.invest.total / (20 * 12)) : 0, active: form.ht_en_invest },
  ].filter((d) => d.active && d.value > 0)

  const selisih = estimasiBulanan - form.target_bulanan
  const surplus = selisih >= 0

  return (
    <div className="space-y-4">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {[1, 2].map((s) => (
          <button
            key={s}
            onClick={() => setStep(s)}
            className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition-colors ${
              s === step ? 'text-white' : s < step ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'
            }`}
            style={s === step ? { background: 'var(--gold)' } : {}}
          >
            {s < step ? '✓' : s}
          </button>
        ))}
        <span className="text-xs text-muted-foreground ml-1">
          {step === 1 && 'Pilih Sumber & Input Parameter'}
          {step === 2 && 'Hasil Total'}
        </span>
      </div>

      {/* Step 1: Sumber */}
      {step === 1 && (
        <div className="space-y-3">
          {/* BPJS */}
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3 cursor-pointer" onClick={() => setOpen(open === 'bpjs' ? null : 'bpjs')}>
                <Checkbox
                  checked={form.ht_en_bpjs}
                  onCheckedChange={(v) => onChange({ ht_en_bpjs: !!v })}
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="flex-1">
                  <p className="text-sm font-medium">BPJS JHT + JP</p>
                  {sumber.bpjs && (
                    <p className="text-xs text-muted-foreground">
                      JHT: {shortRupiah(sumber.bpjs.jht)} · JP: {shortRupiah(sumber.bpjs.jpBulanan)}/bln
                    </p>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">{open === 'bpjs' ? '▲' : '▼'}</span>
              </div>
              {open === 'bpjs' && form.ht_en_bpjs && (
                <div className="mt-3 pt-3 border-t space-y-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Upah BPJS per bulan (kosong = gaji pokok)</Label>
                    <Input
                      value={form.ht_bpjs_upah === 0 ? '' : formatRupiah(form.ht_bpjs_upah)}
                      placeholder={formatRupiah(form.gaji_pokok)}
                      onChange={(e) => onChange({ ht_bpjs_upah: parseRupiah(e.target.value) })}
                      className="h-8 text-sm"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Masa kerja dari profil: {masaKerja} tahun</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* DPPK */}
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3 cursor-pointer" onClick={() => setOpen(open === 'dppk' ? null : 'dppk')}>
                <Checkbox
                  checked={form.ht_en_dppk}
                  onCheckedChange={(v) => onChange({ ht_en_dppk: !!v })}
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="flex-1">
                  <p className="text-sm font-medium">DPPK (Dana Pensiun Pemberi Kerja)</p>
                  {sumber.dppk && (
                    <p className="text-xs text-muted-foreground">Total: {shortRupiah(sumber.dppk.total)}</p>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">{open === 'dppk' ? '▲' : '▼'}</span>
              </div>
              {open === 'dppk' && form.ht_en_dppk && (
                <div className="mt-3 pt-3 border-t space-y-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Tipe DPPK</Label>
                    <Select value={form.ht_dppk_type} onValueChange={(v) => onChange({ ht_dppk_type: v })}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ppmp">PPMP (Manfaat Pasti)</SelectItem>
                        <SelectItem value="ppip">PPIP (Iuran Pasti)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {form.ht_dppk_type === 'ppmp' ? (
                    <>
                      <div className="space-y-1">
                        <Label className="text-xs">PhDP (Penghasilan Dasar Pensiun)</Label>
                        <Input value={form.ht_dppk_phdp === 0 ? '' : formatRupiah(form.ht_dppk_phdp)} placeholder="Rp 0" onChange={(e) => onChange({ ht_dppk_phdp: parseRupiah(e.target.value) })} className="h-8 text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Faktor manfaat (%/thn)</Label>
                        <Input type="number" value={form.ht_dppk_faktor} min={0} max={5} step={0.1} onChange={(e) => onChange({ ht_dppk_faktor: Number(e.target.value) })} className="h-8 text-sm" />
                      </div>
                    </>
                  ) : (
                    <div className="space-y-1">
                      <Label className="text-xs">Iuran bulanan</Label>
                      <Input value={form.ht_dppk_iuran === 0 ? '' : formatRupiah(form.ht_dppk_iuran)} placeholder="Rp 0" onChange={(e) => onChange({ ht_dppk_iuran: parseRupiah(e.target.value) })} className="h-8 text-sm" />
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* DPLK */}
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3 cursor-pointer" onClick={() => setOpen(open === 'dplk' ? null : 'dplk')}>
                <Checkbox
                  checked={form.ht_en_dplk}
                  onCheckedChange={(v) => onChange({ ht_en_dplk: !!v })}
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="flex-1">
                  <p className="text-sm font-medium">DPLK (Dana Pensiun Lembaga Keuangan)</p>
                  {sumber.dplk && (
                    <p className="text-xs text-muted-foreground">Total: {shortRupiah(sumber.dplk.total)}</p>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">{open === 'dplk' ? '▲' : '▼'}</span>
              </div>
              {open === 'dplk' && form.ht_en_dplk && (
                <div className="mt-3 pt-3 border-t grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Iuran bulanan</Label>
                    <Input value={form.ht_dplk_iuran === 0 ? '' : formatRupiah(form.ht_dplk_iuran)} placeholder="Rp 0" onChange={(e) => onChange({ ht_dplk_iuran: parseRupiah(e.target.value) })} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Return (%/thn)</Label>
                    <Input type="number" value={form.ht_dplk_return} min={0} max={20} step={0.5} onChange={(e) => onChange({ ht_dplk_return: Number(e.target.value) })} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <Label className="text-xs">Saldo awal</Label>
                    <Input value={form.ht_dplk_saldo === 0 ? '' : formatRupiah(form.ht_dplk_saldo)} placeholder="Rp 0" onChange={(e) => onChange({ ht_dplk_saldo: parseRupiah(e.target.value) })} className="h-8 text-sm" />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Taspen */}
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3 cursor-pointer" onClick={() => setOpen(open === 'taspen' ? null : 'taspen')}>
                <Checkbox
                  checked={form.ht_en_taspen}
                  onCheckedChange={(v) => onChange({ ht_en_taspen: !!v })}
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="flex-1">
                  <p className="text-sm font-medium">Taspen (ASN/PNS)</p>
                  {sumber.taspen && (
                    <p className="text-xs text-muted-foreground">
                      Pensiun: {shortRupiah(sumber.taspen.bulanan)}/bln · THT: {shortRupiah(sumber.taspen.tht)}
                    </p>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">{open === 'taspen' ? '▲' : '▼'}</span>
              </div>
              {open === 'taspen' && form.ht_en_taspen && (
                <div className="mt-3 pt-3 border-t grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Gaji terakhir (kosong = gaji pokok)</Label>
                    <Input value={form.ht_taspen_gaji === 0 ? '' : formatRupiah(form.ht_taspen_gaji)} placeholder={formatRupiah(form.gaji_pokok)} onChange={(e) => onChange({ ht_taspen_gaji: parseRupiah(e.target.value) })} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Golongan</Label>
                    <Select value={form.ht_taspen_gol} onValueChange={(v) => onChange({ ht_taspen_gol: v })}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {GOLONGAN_OPTIONS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pesangon */}
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={form.ht_en_pesangon}
                  onCheckedChange={(v) => onChange({ ht_en_pesangon: !!v })}
                />
                <div className="flex-1">
                  <p className="text-sm font-medium">Pesangon (UU 11/2020)</p>
                  {sumber.pesangon && (
                    <p className="text-xs text-muted-foreground">Total: {shortRupiah(sumber.pesangon.total)} (otomatis dari gaji pokok + masa kerja)</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Investasi Mandiri */}
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3 cursor-pointer" onClick={() => setOpen(open === 'invest' ? null : 'invest')}>
                <Checkbox
                  checked={form.ht_en_invest}
                  onCheckedChange={(v) => onChange({ ht_en_invest: !!v })}
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="flex-1">
                  <p className="text-sm font-medium">Investasi Mandiri</p>
                  {sumber.invest && (
                    <p className="text-xs text-muted-foreground">Total: {shortRupiah(sumber.invest.total)}</p>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">{open === 'invest' ? '▲' : '▼'}</span>
              </div>
              {open === 'invest' && form.ht_en_invest && (
                <div className="mt-3 pt-3 border-t grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Investasi bulanan</Label>
                    <Input value={form.ht_inv_bulanan === 0 ? '' : formatRupiah(form.ht_inv_bulanan)} placeholder="Rp 500.000" onChange={(e) => onChange({ ht_inv_bulanan: parseRupiah(e.target.value) })} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Return (%/thn)</Label>
                    <Input type="number" value={form.ht_inv_return} min={0} max={30} step={0.5} onChange={(e) => onChange({ ht_inv_return: Number(e.target.value) })} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Saldo awal</Label>
                    <Input value={form.ht_inv_saldo === 0 ? '' : formatRupiah(form.ht_inv_saldo)} placeholder="Rp 0" onChange={(e) => onChange({ ht_inv_saldo: parseRupiah(e.target.value) })} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Kenaikan/thn (%)</Label>
                    <Input type="number" value={form.ht_inv_kenaikan} min={0} max={20} step={0.5} onChange={(e) => onChange({ ht_inv_kenaikan: Number(e.target.value) })} className="h-8 text-sm" />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button
              onClick={() => setStep(2)}
              style={{ background: 'var(--gold)', color: 'white' }}
            >
              🧮 Hitung Total Pensiun
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Hasil */}
      {step === 2 && (
        <div className="space-y-4">
          {/* Grand total hero */}
          <Card style={{ background: 'var(--gold-bg)', borderColor: 'var(--gold-border)' }}>
            <CardContent className="pt-5 text-center">
              <p className="text-sm font-medium" style={{ color: 'var(--gold-text)' }}>Estimasi Total Dana Pensiun</p>
              <p className="text-4xl font-bold mt-1" style={{ color: 'var(--gold)' }}>
                {shortRupiah(totalLumpSum)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">(ekuivalen lump sum, asumsi 20 tahun pensiun)</p>
            </CardContent>
          </Card>

          {/* 2 metrics */}
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="pt-4 pb-4 text-center">
                <p className="text-xs text-muted-foreground">Estimasi/bulan</p>
                <p className="text-xl font-bold mt-0.5">{shortRupiah(estimasiBulanan)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 text-center">
                <p className="text-xs text-muted-foreground">Target/bulan</p>
                <p className="text-xl font-bold mt-0.5">{shortRupiah(form.target_bulanan)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Gap pill */}
          <div
            className="flex items-center justify-between rounded-lg px-4 py-3"
            style={{
              background: surplus ? '#dcfce7' : '#fee2e2',
              color: surplus ? '#15803d' : '#b91c1c',
            }}
          >
            <span className="font-medium text-sm">
              {surplus ? `✓ Surplus ${shortRupiah(selisih)}/bulan` : `⚠ Defisit ${shortRupiah(Math.abs(selisih))}/bulan`}
            </span>
            <span className="text-xs">
              {surplus
                ? 'Dana pensiun Anda cukup untuk mencapai target'
                : 'Pertimbangkan menambah investasi mandiri atau DPLK'}
            </span>
          </div>

          {/* Horizontal bars per sumber */}
          <Card>
            <CardContent className="pt-4 space-y-3">
              <p className="text-sm font-medium">Estimasi per Sumber (bulanan)</p>
              {barData.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">Tidak ada sumber yang dipilih.</p>
              )}
              {barData.map((d) => (
                <div key={d.name} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{d.name}</span>
                    <span className="font-medium">{shortRupiah(d.value)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${estimasiBulanan > 0 ? Math.min(100, Math.round((d.value / estimasiBulanan) * 100)) : 0}%`,
                        background: 'var(--gold)',
                      }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* BarChart */}
          {barData.length > 0 && (
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm font-medium mb-3">Kontribusi Bulanan per Sumber + Target</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={[...barData, { name: 'Target', value: form.target_bulanan, active: true }]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tickFormatter={(v) => shortRupiah(v)} tick={{ fontSize: 10 }} width={65} />
                    <Tooltip formatter={(v: unknown) => formatRupiah(typeof v === 'number' ? v : 0)} />
                    <Bar
                      dataKey="value"
                      name="Estimasi/bulan"
                      fill="var(--gold)"
                      radius={[3, 3, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>← Ubah Sumber</Button>
          </div>
        </div>
      )}
    </div>
  )
}

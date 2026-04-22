// src/tabs/PensiunTab.tsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { usePensionSim, useUpsertPensionSim, type PensionSimInput } from '@/queries/pensiun'
import { DEFAULT_PENSION_SIM } from '@/db/pensiun'
import { formatRupiah, parseRupiah } from '@/lib/format'
import SimulasiPanel from './pensiun/SimulasiPanel'
import HitungTotalPanel from './pensiun/HitungTotalPanel'
import PanduanPanel from './pensiun/PanduanPanel'

export default function PensiunTab() {
  const { data, isLoading } = usePensionSim()
  const { mutate: upsert } = useUpsertPensionSim()
  const [form, setForm] = useState<PensionSimInput>(DEFAULT_PENSION_SIM)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initializedRef = useRef(false)

  useEffect(() => {
    if (data && !initializedRef.current) {
      initializedRef.current = true
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id: _id, user_id: _uid, updated_at: _ua, created_at: _ca, ...rest } = data
      setForm(rest)
    } else if (data === null && !initializedRef.current) {
      upsert(DEFAULT_PENSION_SIM, {
        onSuccess: () => { initializedRef.current = true },
      })
    }
  }, [data, upsert])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const handleChange = useCallback((patch: Partial<PensionSimInput>) => {
    setSaveStatus('saving')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setForm((prev) => {
      const next = { ...prev, ...patch }
      debounceRef.current = setTimeout(() => {
        upsert(next, {
          onSuccess: () => {
            setSaveStatus('saved')
            setTimeout(() => setSaveStatus('idle'), 2000)
          },
          onError: () => setSaveStatus('idle'),
        })
      }, 1500)
      return next
    })
  }, [upsert])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="text-muted-foreground text-sm">Memuat data pensiun...</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Profil Strip */}
      <Card className="p-4" style={{ borderTop: '3px solid var(--gold)' }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-sm" style={{ color: 'var(--gold-text)' }}>
            Profil Pensiun
          </h2>
          <span className="text-xs text-muted-foreground">
            {saveStatus === 'saving' && 'Menyimpan...'}
            {saveStatus === 'saved' && '✓ Tersimpan'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <div className="space-y-1">
            <Label className="text-xs">Usia saat ini</Label>
            <Input
              type="number"
              value={form.usia}
              min={18}
              max={65}
              onChange={(e) => handleChange({ usia: Number(e.target.value) })}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Usia pensiun</Label>
            <Input
              type="number"
              value={form.usia_pensiun}
              min={45}
              max={65}
              onChange={(e) => handleChange({ usia_pensiun: Number(e.target.value) })}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Gaji pokok</Label>
            <Input
              value={form.gaji_pokok === 0 ? '' : formatRupiah(form.gaji_pokok)}
              placeholder="Rp 0"
              onChange={(e) => handleChange({ gaji_pokok: parseRupiah(e.target.value) })}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Masa kerja (thn)</Label>
            <Input
              type="number"
              value={form.masa_kerja}
              min={0}
              max={40}
              onChange={(e) => handleChange({ masa_kerja: Number(e.target.value) })}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Target/bulan saat pensiun</Label>
            <Input
              value={form.target_bulanan === 0 ? '' : formatRupiah(form.target_bulanan)}
              placeholder="Rp 10.000.000"
              onChange={(e) => handleChange({ target_bulanan: parseRupiah(e.target.value) })}
              className="h-8 text-sm"
            />
          </div>
        </div>
      </Card>

      {/* Sub-tab Navigation */}
      <Tabs defaultValue="simulasi" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="simulasi">Simulasi Investasi</TabsTrigger>
          <TabsTrigger value="hitung">Hitung Total</TabsTrigger>
          <TabsTrigger value="panduan">Panduan</TabsTrigger>
        </TabsList>

        <TabsContent value="simulasi">
          <SimulasiPanel form={form} onChange={handleChange} />
        </TabsContent>
        <TabsContent value="hitung">
          <HitungTotalPanel form={form} onChange={handleChange} />
        </TabsContent>
        <TabsContent value="panduan">
          <PanduanPanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}

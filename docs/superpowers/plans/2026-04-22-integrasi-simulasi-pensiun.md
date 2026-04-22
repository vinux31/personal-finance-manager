# Integrasi Simulasi Pensiun Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrasikan kalkulator pensiun standalone ke pfm-web sebagai tab "Pensiun" dengan 3 sub-tab (Simulasi, Hitung Total, Panduan), data persisted di Supabase, auto-save debounce 1.5s.

**Architecture:** PensiunTab shell memuat data dari `pension_simulations` (1 row/user) dan merender 3 sub-tab via Radix Tabs. Semua kalkulasi pure functions di `pensiun-calc.ts`, tidak ada state di luar PensiunTab kecuali local step state di tiap panel.

**Tech Stack:** React 19, TypeScript 6, Tailwind CSS v4, shadcn/ui (Card, Input, Label, Slider, Checkbox), Recharts (AreaChart, BarChart), TanStack Query v5, Supabase, Lucide React (PiggyBank)

---

## File Structure

| File | Action | Tanggung Jawab |
|------|--------|----------------|
| `src/index.css` | Modify | Tambah CSS variables gold accent |
| `supabase/migrations/0011_pension_simulations.sql` | Create | Tabel + RLS policy |
| `src/lib/pensiun-calc.ts` | Create | Pure functions: calcDCA, calcBPJS, calcDPPK, calcDPLK, calcTaspen, calcPesangon, calcInvestasiMandiri |
| `src/db/pensiun.ts` | Create | DB layer: PensionSimRow type, getPensionSim, upsertPensionSim |
| `src/queries/pensiun.ts` | Create | React Query hooks: usePensionSim, useUpsertPensionSim |
| `src/tabs/PensiunTab.tsx` | Create | Shell: profil strip, sub-tab nav, debounce auto-save |
| `src/App.tsx` | Modify | Tambah entry Pensiun ke TABS array |
| `src/tabs/pensiun/PanduanPanel.tsx` | Create | Static: 6 sumber, tabel strategi, perbandingan instrumen, tips |
| `src/tabs/pensiun/SimulasiPanel.tsx` | Create | Wizard 3 step: Parameter → Alokasi → Hasil (AreaChart) |
| `src/tabs/pensiun/HitungTotalPanel.tsx` | Create | Wizard 2 step: Pilih Sumber → Hasil Total (BarChart) |

---

## Task 1: Gold CSS Variables

**Files:**
- Modify: `src/index.css:84` (end of `:root` block) dan `:118` (end of `.dark` block)

- [ ] **Step 1: Tambah gold variables ke :root dan .dark**

Edit `src/index.css` — tambah sebelum `}` penutup `:root` (setelah `--sidebar-ring` di line 83):

```css
    /* Pension gold accent */
    --gold: #d97706;
    --gold-light: #f59e0b;
    --gold-bg: #fef9ee;
    --gold-border: #fde68a;
    --gold-text: #92400e;
```

Tambah sebelum `}` penutup `.dark` (setelah `--sidebar-ring` di line 117):

```css
    /* Pension gold accent */
    --gold: #d4a437;
    --gold-light: #e6bb4a;
    --gold-bg: rgba(212,164,55,0.08);
    --gold-border: rgba(212,164,55,0.25);
    --gold-text: #fbbf24;
```

- [ ] **Step 2: Verifikasi TypeScript compile**

```bash
npx tsc -b --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "feat: tambah CSS variables gold accent untuk tab Pensiun"
```

---

## Task 2: Supabase Migration

**Files:**
- Create: `supabase/migrations/0011_pension_simulations.sql`

- [ ] **Step 1: Buat file migration**

`supabase/migrations/0011_pension_simulations.sql`:

```sql
create table pension_simulations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  updated_at  timestamptz not null default now(),

  -- Profil Dasar
  usia            int not null default 30,
  usia_pensiun    int not null default 56,
  gaji_pokok      bigint not null default 0,
  masa_kerja      int not null default 0,
  target_bulanan  bigint not null default 10000000,

  -- Panel Simulasi Investasi
  sim_investasi_bulanan   bigint not null default 500000,
  sim_kenaikan_pct        numeric(5,2) not null default 5,
  sim_inflasi_pct         numeric(5,2) not null default 4,
  sim_target_spend        bigint not null default 10000000,
  sim_alokasi_emas        int not null default 40,
  sim_alokasi_saham       int not null default 30,
  sim_alokasi_rd          int not null default 30,
  sim_rd_type             text not null default 'cp',

  -- Panel Hitung Total: enable flags
  ht_en_bpjs      boolean not null default true,
  ht_en_dppk      boolean not null default false,
  ht_en_dplk      boolean not null default false,
  ht_en_taspen    boolean not null default false,
  ht_en_pesangon  boolean not null default true,
  ht_en_invest    boolean not null default true,

  -- BPJS
  ht_bpjs_upah    bigint not null default 0,

  -- DPPK
  ht_dppk_type    text not null default 'ppmp',
  ht_dppk_phdp    bigint not null default 0,
  ht_dppk_faktor  numeric(5,2) not null default 2.5,
  ht_dppk_iuran   bigint not null default 0,

  -- DPLK
  ht_dplk_iuran   bigint not null default 0,
  ht_dplk_return  numeric(5,2) not null default 7,
  ht_dplk_saldo   bigint not null default 0,

  -- Taspen
  ht_taspen_gaji  bigint not null default 0,
  ht_taspen_gol   text not null default 'IIIa',

  -- Investasi Mandiri (Hitung Total)
  ht_inv_bulanan  bigint not null default 500000,
  ht_inv_return   numeric(5,2) not null default 10,
  ht_inv_saldo    bigint not null default 0,
  ht_inv_kenaikan numeric(5,2) not null default 5,

  unique(user_id)
);

alter table pension_simulations enable row level security;

create policy "Users manage own pension sim"
  on pension_simulations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

- [ ] **Step 2: Jalankan migration ke Supabase**

```bash
npx supabase db push
```

Expected: "Finished supabase db push" tanpa error

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0011_pension_simulations.sql
git commit -m "feat: migration tabel pension_simulations dengan RLS"
```

---

## Task 3: Pure Calculation Functions

**Files:**
- Create: `src/lib/pensiun-calc.ts`

- [ ] **Step 1: Buat file pensiun-calc.ts**

```typescript
// src/lib/pensiun-calc.ts

// ─── Simulasi DCA ──────────────────────────────────────────────────────────

export interface SimulasiParams {
  usia: number
  usiaPensiun: number
  investasiBulanan: number
  kenaikanPct: number
  inflasiPct: number
  targetBulanan: number
  alokasiEmas: number   // 0-100
  alokasiSaham: number  // 0-100
  alokasiRd: number     // 0-100
  rdType: 'pu' | 'pt' | 'cp' | 'sh'
}

export interface SimulasiResult {
  totalDana: number
  totalModal: number
  keuntungan: number
  danaCukupTahun: number
  perAset: { emas: number; saham: number; rd: number }
  yearlyData: { tahun: number; emas: number; saham: number; rd: number; total: number }[]
}

const RD_RETURNS: Record<string, number> = { pu: 0.05, pt: 0.07, cp: 0.10, sh: 0.14 }
const EMAS_RETURN = 0.10
const SAHAM_RETURN = 0.15

export function calcDCA(p: SimulasiParams): SimulasiResult {
  const tahun = p.usiaPensiun - p.usia
  if (tahun <= 0) {
    return { totalDana: 0, totalModal: 0, keuntungan: 0, danaCukupTahun: 0, perAset: { emas: 0, saham: 0, rd: 0 }, yearlyData: [] }
  }

  const rdReturn = RD_RETURNS[p.rdType] ?? 0.10
  const allocEmas = p.alokasiEmas / 100
  const allocSaham = p.alokasiSaham / 100
  const allocRd = p.alokasiRd / 100

  const rEmas = Math.pow(1 + EMAS_RETURN, 1 / 12) - 1
  const rSaham = Math.pow(1 + SAHAM_RETURN, 1 / 12) - 1
  const rRd = Math.pow(1 + rdReturn, 1 / 12) - 1

  let sEmas = 0, sSaham = 0, sRd = 0, totalModal = 0
  let invest = p.investasiBulanan
  const yearlyData: SimulasiResult['yearlyData'] = []

  for (let yr = 1; yr <= tahun; yr++) {
    for (let mo = 0; mo < 12; mo++) {
      sEmas = sEmas * (1 + rEmas) + invest * allocEmas
      sSaham = sSaham * (1 + rSaham) + invest * allocSaham
      sRd = sRd * (1 + rRd) + invest * allocRd
      totalModal += invest
    }
    yearlyData.push({
      tahun: yr,
      emas: Math.round(sEmas),
      saham: Math.round(sSaham),
      rd: Math.round(sRd),
      total: Math.round(sEmas + sSaham + sRd),
    })
    invest *= 1 + p.kenaikanPct / 100
  }

  const totalDana = sEmas + sSaham + sRd
  const targetTahunan = p.targetBulanan * 12
  const danaCukupTahun = targetTahunan > 0 ? Math.floor(totalDana / targetTahunan) : 999

  return {
    totalDana: Math.round(totalDana),
    totalModal: Math.round(totalModal),
    keuntungan: Math.round(totalDana - totalModal),
    danaCukupTahun,
    perAset: { emas: Math.round(sEmas), saham: Math.round(sSaham), rd: Math.round(sRd) },
    yearlyData,
  }
}

// ─── BPJS ──────────────────────────────────────────────────────────────────

export interface BPJSParams {
  upahBulanan: number
  masaKerja: number
}

export interface BPJSResult {
  jht: number
  jpBulanan: number
}

export function calcBPJS(p: BPJSParams): BPJSResult {
  // JHT: 5.7% upah/bln dikompound 5.5%/thn
  const iuranJHT = p.upahBulanan * 0.057
  const rJHT = Math.pow(1 + 0.055, 1 / 12) - 1
  let jht = 0
  for (let i = 0; i < p.masaKerja * 12; i++) {
    jht = jht * (1 + rJHT) + iuranJHT
  }

  // JP: 1% × min(masaKerja, 30) × min(upah, 9jt)
  const jpBulanan = 0.01 * Math.min(p.masaKerja, 30) * Math.min(p.upahBulanan, 9_000_000)

  return { jht: Math.round(jht), jpBulanan: Math.round(jpBulanan) }
}

// ─── DPPK ──────────────────────────────────────────────────────────────────

export interface DPPKParams {
  type: 'ppmp' | 'ppip'
  phdp: number          // PhDP untuk PPMP
  faktor: number        // faktor manfaat % per tahun (PPMP)
  iuranBulanan: number  // untuk PPIP
  masaKerja: number
}

export interface DPPKResult {
  total: number
}

export function calcDPPK(p: DPPKParams): DPPKResult {
  if (p.type === 'ppmp') {
    // PPMP: masa_kerja × faktor% × PhDP
    const total = p.masaKerja * (p.faktor / 100) * p.phdp
    return { total: Math.round(total) }
  }
  // PPIP: iuran dikompound 8%/thn
  const r = Math.pow(1 + 0.08, 1 / 12) - 1
  let total = 0
  for (let i = 0; i < p.masaKerja * 12; i++) {
    total = total * (1 + r) + p.iuranBulanan
  }
  return { total: Math.round(total) }
}

// ─── DPLK ──────────────────────────────────────────────────────────────────

export interface DPLKParams {
  iuranBulanan: number
  returnPct: number
  saldoAwal: number
  masaKerja: number
}

export interface DPLKResult {
  total: number
}

export function calcDPLK(p: DPLKParams): DPLKResult {
  const r = Math.pow(1 + p.returnPct / 100, 1 / 12) - 1
  let total = p.saldoAwal
  for (let i = 0; i < p.masaKerja * 12; i++) {
    total = total * (1 + r) + p.iuranBulanan
  }
  return { total: Math.round(total) }
}

// ─── Taspen (ASN/PNS) ──────────────────────────────────────────────────────

const TASPEN_GAJI: Record<string, number> = {
  Ia: 1_560_800, Ib: 1_704_500, Ic: 1_776_600, Id: 1_851_800,
  IIa: 2_022_200, IIb: 2_208_400, IIc: 2_301_800, IId: 2_399_200,
  IIIa: 2_802_300, IIIb: 2_928_300, IIIc: 3_059_700, IIId: 3_196_500,
  IVa: 3_339_100, IVb: 3_487_100, IVc: 3_641_400, IVd: 3_802_200, IVe: 3_969_300,
}

export interface TaspenParams {
  gajiTerakhir: number
  golongan: string
  masaKerja: number
}

export interface TaspenResult {
  bulanan: number
  tht: number
}

export function calcTaspen(p: TaspenParams): TaspenResult {
  const gajiPensiun = TASPEN_GAJI[p.golongan] ?? p.gajiTerakhir
  // Pensiun bulanan: 2.5% × masa_kerja × gaji_pensiun, max 75%
  const pct = Math.min(p.masaKerja * 0.025, 0.75)
  const bulanan = pct * gajiPensiun

  // THT (lump sum): 0.36% × gaji × 12 × masa_kerja (simplified)
  const tht = 0.0036 * gajiPensiun * 12 * p.masaKerja

  return { bulanan: Math.round(bulanan), tht: Math.round(tht) }
}

// ─── Pesangon ──────────────────────────────────────────────────────────────

export interface PesangonResult {
  total: number
}

function upMasaKerja(mk: number): number {
  if (mk < 1) return 1
  if (mk < 2) return 2
  if (mk < 3) return 3
  if (mk < 4) return 4
  if (mk < 5) return 5
  if (mk < 6) return 6
  if (mk < 7) return 7
  if (mk < 8) return 8
  return 9
}

function upmkMasaKerja(mk: number): number {
  if (mk < 3) return 0
  if (mk < 6) return 2
  if (mk < 9) return 3
  if (mk < 12) return 4
  if (mk < 15) return 5
  if (mk < 18) return 6
  if (mk < 21) return 7
  if (mk < 24) return 8
  return 10
}

export function calcPesangon(gajiPokok: number, masaKerja: number): PesangonResult {
  const up = upMasaKerja(masaKerja) * gajiPokok
  const upmk = upmkMasaKerja(masaKerja) * gajiPokok
  const uph = (up + upmk) * 0.15
  // 2× UP + 1× UPMK + UPH (pensiun sukarela / efisiensi)
  const total = 2 * up + upmk + uph
  return { total: Math.round(total) }
}

// ─── Investasi Mandiri (Hitung Total) ─────────────────────────────────────

export interface InvestasiMandiriParams {
  iuranBulanan: number
  returnPct: number
  saldoAwal: number
  kenaikanPct: number
  masaKerja: number
}

export interface InvestasiMandiriResult {
  total: number
}

export function calcInvestasiMandiri(p: InvestasiMandiriParams): InvestasiMandiriResult {
  const r = Math.pow(1 + p.returnPct / 100, 1 / 12) - 1
  let total = p.saldoAwal
  let iuran = p.iuranBulanan
  for (let yr = 0; yr < p.masaKerja; yr++) {
    for (let mo = 0; mo < 12; mo++) {
      total = total * (1 + r) + iuran
    }
    iuran *= 1 + p.kenaikanPct / 100
  }
  return { total: Math.round(total) }
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc -b --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/pensiun-calc.ts
git commit -m "feat: pure calculation functions untuk simulasi pensiun"
```

---

## Task 4: DB Layer

**Files:**
- Create: `src/db/pensiun.ts`

- [ ] **Step 1: Buat file src/db/pensiun.ts**

```typescript
// src/db/pensiun.ts
import { supabase } from '@/lib/supabase'

export interface PensionSimRow {
  id: string
  user_id: string
  updated_at: string
  usia: number
  usia_pensiun: number
  gaji_pokok: number
  masa_kerja: number
  target_bulanan: number
  sim_investasi_bulanan: number
  sim_kenaikan_pct: number
  sim_inflasi_pct: number
  sim_target_spend: number
  sim_alokasi_emas: number
  sim_alokasi_saham: number
  sim_alokasi_rd: number
  sim_rd_type: string
  ht_en_bpjs: boolean
  ht_en_dppk: boolean
  ht_en_dplk: boolean
  ht_en_taspen: boolean
  ht_en_pesangon: boolean
  ht_en_invest: boolean
  ht_bpjs_upah: number
  ht_dppk_type: string
  ht_dppk_phdp: number
  ht_dppk_faktor: number
  ht_dppk_iuran: number
  ht_dplk_iuran: number
  ht_dplk_return: number
  ht_dplk_saldo: number
  ht_taspen_gaji: number
  ht_taspen_gol: string
  ht_inv_bulanan: number
  ht_inv_return: number
  ht_inv_saldo: number
  ht_inv_kenaikan: number
}

export type PensionSimInput = Omit<PensionSimRow, 'id' | 'user_id' | 'updated_at'>

export const DEFAULT_PENSION_SIM: PensionSimInput = {
  usia: 30,
  usia_pensiun: 56,
  gaji_pokok: 0,
  masa_kerja: 0,
  target_bulanan: 10_000_000,
  sim_investasi_bulanan: 500_000,
  sim_kenaikan_pct: 5,
  sim_inflasi_pct: 4,
  sim_target_spend: 10_000_000,
  sim_alokasi_emas: 40,
  sim_alokasi_saham: 30,
  sim_alokasi_rd: 30,
  sim_rd_type: 'cp',
  ht_en_bpjs: true,
  ht_en_dppk: false,
  ht_en_dplk: false,
  ht_en_taspen: false,
  ht_en_pesangon: true,
  ht_en_invest: true,
  ht_bpjs_upah: 0,
  ht_dppk_type: 'ppmp',
  ht_dppk_phdp: 0,
  ht_dppk_faktor: 2.5,
  ht_dppk_iuran: 0,
  ht_dplk_iuran: 0,
  ht_dplk_return: 7,
  ht_dplk_saldo: 0,
  ht_taspen_gaji: 0,
  ht_taspen_gol: 'IIIa',
  ht_inv_bulanan: 500_000,
  ht_inv_return: 10,
  ht_inv_saldo: 0,
  ht_inv_kenaikan: 5,
}

export async function getPensionSim(uid: string): Promise<PensionSimRow | null> {
  const { data, error } = await supabase
    .from('pension_simulations')
    .select('*')
    .eq('user_id', uid)
    .maybeSingle()
  if (error) throw error
  return data as PensionSimRow | null
}

export async function upsertPensionSim(uid: string, input: PensionSimInput): Promise<void> {
  const { error } = await supabase
    .from('pension_simulations')
    .upsert(
      { ...input, user_id: uid, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
  if (error) throw error
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc -b --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/db/pensiun.ts
git commit -m "feat: DB layer pension_simulations (getPensionSim, upsertPensionSim)"
```

---

## Task 5: React Query Hooks

**Files:**
- Create: `src/queries/pensiun.ts`

- [ ] **Step 1: Buat file src/queries/pensiun.ts**

```typescript
// src/queries/pensiun.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  getPensionSim,
  upsertPensionSim,
  type PensionSimRow,
  type PensionSimInput,
} from '@/db/pensiun'
import { mapSupabaseError } from '@/lib/errors'
import { useTargetUserId } from '@/auth/useTargetUserId'

export type { PensionSimRow, PensionSimInput }

export function usePensionSim() {
  const uid = useTargetUserId()
  return useQuery({
    queryKey: ['pension-sim', uid],
    queryFn: () => getPensionSim(uid!),
    enabled: !!uid,
    staleTime: 5 * 60 * 1000,
  })
}

export function useUpsertPensionSim() {
  const uid = useTargetUserId()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: PensionSimInput) => upsertPensionSim(uid!, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pension-sim', uid] })
    },
    onError: (e) => toast.error(mapSupabaseError(e)),
  })
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc -b --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/queries/pensiun.ts
git commit -m "feat: React Query hooks usePensionSim dan useUpsertPensionSim"
```

---

## Task 6: PensiunTab Shell

**Files:**
- Create: `src/tabs/PensiunTab.tsx`

- [ ] **Step 1: Buat folder dan file**

```bash
mkdir -p "src/tabs/pensiun"
```

Buat `src/tabs/PensiunTab.tsx`:

```typescript
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
  const upsert = useUpsertPensionSim()
  const [form, setForm] = useState<PensionSimInput>(DEFAULT_PENSION_SIM)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initializedRef = useRef(false)

  useEffect(() => {
    if (data && !initializedRef.current) {
      initializedRef.current = true
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id: _id, user_id: _uid, updated_at: _ua, ...rest } = data as any
      setForm(rest as PensionSimInput)
    } else if (data === null && !initializedRef.current) {
      initializedRef.current = true
      // first open — insert defaults
      upsert.mutate(DEFAULT_PENSION_SIM)
    }
  }, [data])

  const handleChange = useCallback((patch: Partial<PensionSimInput>) => {
    setForm((prev) => {
      const next = { ...prev, ...patch }
      setSaveStatus('saving')
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        upsert.mutate(next, {
          onSuccess: () => setSaveStatus('saved'),
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
```

- [ ] **Step 2: Type check (akan error karena panel belum ada — expected)**

```bash
npx tsc -b --noEmit 2>&1 | head -20
```

Expected: error "Cannot find module './pensiun/SimulasiPanel'" — ini normal, panel dibuat di task berikutnya.

- [ ] **Step 3: Commit (tanpa type check)**

```bash
git add src/tabs/PensiunTab.tsx
git commit -m "feat: PensiunTab shell dengan profil strip dan auto-save debounce"
```

---

## Task 7: Register Tab di App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Tambah PiggyBank import dan PensiunTab ke App.tsx**

Edit `src/App.tsx` — tambah `PiggyBank` ke lucide-react import:

```typescript
import {
  LayoutDashboard,
  Wallet,
  TrendingUp,
  Target,
  StickyNote,
  BarChart3,
  Settings as SettingsIcon,
  PiggyBank,
} from 'lucide-react'
```

Tambah import PensiunTab setelah `import SettingsTab`:

```typescript
import PensiunTab from '@/tabs/PensiunTab'
```

Tambah entry ke TABS array (sebelum `settings`):

```typescript
const TABS = [
  { value: 'dashboard',    label: 'Dashboard',  icon: LayoutDashboard, Comp: DashboardTab },
  { value: 'transactions', label: 'Transaksi',  icon: Wallet,          Comp: TransactionsTab },
  { value: 'investments',  label: 'Investasi',  icon: TrendingUp,      Comp: InvestmentsTab },
  { value: 'goals',        label: 'Goals',      icon: Target,          Comp: GoalsTab },
  { value: 'notes',        label: 'Catatan',    icon: StickyNote,      Comp: NotesTab },
  { value: 'reports',      label: 'Laporan',    icon: BarChart3,       Comp: ReportsTab },
  { value: 'pensiun',      label: 'Pensiun',    icon: PiggyBank,       Comp: PensiunTab },
  { value: 'settings',     label: 'Pengaturan', icon: SettingsIcon,    Comp: SettingsTab },
] as const
```

- [ ] **Step 2: Commit**

```bash
git add src/App.tsx
git commit -m "feat: register tab Pensiun di App.tsx"
```

---

## Task 8: PanduanPanel (Static)

**Files:**
- Create: `src/tabs/pensiun/PanduanPanel.tsx`

- [ ] **Step 1: Buat PanduanPanel.tsx**

```typescript
// src/tabs/pensiun/PanduanPanel.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const SUMBER_DANA = [
  { nama: 'BPJS JHT', badge: 'Wajib', warna: 'bg-blue-100 text-blue-800', deskripsi: 'Jaminan Hari Tua — 5.7% upah/bln (2% karyawan + 3.7% perusahaan), lump sum saat pensiun/resign.', formula: 'Iuran × bulan, dikompound ~5.5%/thn' },
  { nama: 'BPJS JP', badge: 'Wajib', warna: 'bg-blue-100 text-blue-800', deskripsi: 'Jaminan Pensiun — manfaat bulanan seumur hidup setelah pensiun.', formula: '1% × masa kepesertaan (max 30 thn) × upah terakhir' },
  { nama: 'DPPK', badge: 'Perusahaan', warna: 'bg-purple-100 text-purple-800', deskripsi: 'Dana Pensiun Pemberi Kerja — PPMP (benefit pasti) atau PPIP (iuran pasti).', formula: 'PPMP: masa kerja × faktor × PhDP' },
  { nama: 'DPLK', badge: 'Sukarela', warna: 'bg-green-100 text-green-800', deskripsi: 'Dana Pensiun Lembaga Keuangan — rekening investasi individual, bisa dibuka sendiri di bank/asuransi.', formula: 'Iuran + saldo awal dikompound sesuai return pilihan' },
  { nama: 'Taspen', badge: 'ASN/PNS', warna: 'bg-orange-100 text-orange-800', deskripsi: 'Khusus Aparatur Sipil Negara. Terdiri dari pensiun bulanan (seumur hidup) dan THT (lump sum).', formula: 'Pensiun: 2.5% × masa kerja × gaji pensiun' },
  { nama: 'Pesangon', badge: 'PKWTT', warna: 'bg-red-100 text-red-800', deskripsi: 'Uang pesangon saat PHK atau pensiun. Dihitung berdasarkan UU 11/2020 Cipta Kerja.', formula: '2× UP + 1× UPMK + 15% UPH' },
]

const STRATEGI_ALOKASI = [
  { usia: '20–30', emas: '10%', saham: '50%', rd: '30%', obligasi: '10%', profil: 'Agresif' },
  { usia: '30–40', emas: '20%', saham: '40%', rd: '30%', obligasi: '10%', profil: 'Moderat-Agresif' },
  { usia: '40–50', emas: '30%', saham: '30%', rd: '25%', obligasi: '15%', profil: 'Moderat' },
  { usia: '50–55', emas: '40%', saham: '15%', rd: '20%', obligasi: '25%', profil: 'Konservatif' },
  { usia: '55+', emas: '20%', saham: '5%', rd: '15%', obligasi: '60%', profil: 'Sangat Konservatif' },
]

const INSTRUMEN = [
  { nama: 'Deposito', return: '4–5%', risiko: 'Sangat Rendah', r10: 'Rp 73jt', r20: 'Rp 182jt', r30: 'Rp 398jt' },
  { nama: 'Obligasi Negara', return: '6–7%', risiko: 'Rendah', r10: 'Rp 82jt', r20: 'Rp 233jt', r30: 'Rp 566jt' },
  { nama: 'RD Pasar Uang', return: '5–6%', risiko: 'Rendah', r10: 'Rp 77jt', r20: 'Rp 208jt', r30: 'Rp 484jt' },
  { nama: 'RD Pendapatan Tetap', return: '7–8%', risiko: 'Rendah-Sedang', r10: 'Rp 87jt', r20: 'Rp 261jt', r30: 'Rp 681jt' },
  { nama: 'RD Campuran', return: '9–11%', risiko: 'Sedang', r10: 'Rp 97jt', r20: 'Rp 321jt', r30: 'Rp 937jt' },
  { nama: 'RD Saham', return: '12–15%', risiko: 'Tinggi', r10: 'Rp 113jt', r20: 'Rp 449jt', r30: 'Rp 1,56M' },
  { nama: 'Emas', return: '8–12%', risiko: 'Sedang', r10: 'Rp 97jt', r20: 'Rp 321jt', r30: 'Rp 937jt' },
  { nama: 'Saham Individu', return: '12–20%', risiko: 'Sangat Tinggi', r10: 'Rp 113jt', r20: 'Rp 449jt', r30: 'Rp 1,56M' },
]

export default function PanduanPanel() {
  return (
    <div className="space-y-6">
      {/* 6 Sumber Dana */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base" style={{ color: 'var(--gold)' }}>6 Sumber Dana Pensiun</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SUMBER_DANA.map((s) => (
              <div key={s.nama} className="rounded-lg border p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{s.nama}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.warna}`}>{s.badge}</span>
                </div>
                <p className="text-xs text-muted-foreground">{s.deskripsi}</p>
                <p className="text-xs font-mono" style={{ color: 'var(--gold)' }}>{s.formula}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Strategi Alokasi per Usia */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base" style={{ color: 'var(--gold)' }}>Strategi Alokasi per Usia</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 font-medium">Usia</th>
                  <th className="text-right py-2 px-2 font-medium">Emas</th>
                  <th className="text-right py-2 px-2 font-medium">Saham</th>
                  <th className="text-right py-2 px-2 font-medium">Reksadana</th>
                  <th className="text-right py-2 px-2 font-medium">Obligasi</th>
                  <th className="text-left py-2 pl-4 font-medium">Profil Risiko</th>
                </tr>
              </thead>
              <tbody>
                {STRATEGI_ALOKASI.map((row) => (
                  <tr key={row.usia} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{row.usia}</td>
                    <td className="text-right py-2 px-2 text-yellow-600">{row.emas}</td>
                    <td className="text-right py-2 px-2 text-blue-600">{row.saham}</td>
                    <td className="text-right py-2 px-2 text-green-600">{row.rd}</td>
                    <td className="text-right py-2 px-2 text-gray-500">{row.obligasi}</td>
                    <td className="pl-4 py-2 text-muted-foreground">{row.profil}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Perbandingan Instrumen */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base" style={{ color: 'var(--gold)' }}>Perbandingan 8 Instrumen (investasi Rp 500rb/bln)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 font-medium">Instrumen</th>
                  <th className="text-right py-2 px-2 font-medium">Return/thn</th>
                  <th className="text-right py-2 px-2 font-medium">Risiko</th>
                  <th className="text-right py-2 px-2 font-medium">10 thn</th>
                  <th className="text-right py-2 px-2 font-medium">20 thn</th>
                  <th className="text-right py-2 px-2 font-medium">30 thn</th>
                </tr>
              </thead>
              <tbody>
                {INSTRUMEN.map((r) => (
                  <tr key={r.nama} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{r.nama}</td>
                    <td className="text-right py-2 px-2 text-green-600">{r.return}</td>
                    <td className="text-right py-2 px-2 text-muted-foreground">{r.risiko}</td>
                    <td className="text-right py-2 px-2">{r.r10}</td>
                    <td className="text-right py-2 px-2">{r.r20}</td>
                    <td className="text-right py-2 px-2 font-medium">{r.r30}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Tips */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base" style={{ color: 'var(--gold)' }}>Tips & Kesalahan Umum</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="font-medium text-sm text-green-700 mb-2">✓ Yang Harus Dilakukan</p>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li>• Mulai menabung pensiun sedini mungkin — manfaat compounding terbesar di 10 tahun pertama</li>
                <li>• Diversifikasi ke minimal 3 instrumen berbeda</li>
                <li>• Naikkan investasi setiap tahun minimal sesuai inflasi (4–5%)</li>
                <li>• Pastikan BPJS JHT & JP aktif — ini jaring pengaman dasar</li>
                <li>• Review alokasi setiap 5 tahun — sesuaikan dengan usia dan profil risiko</li>
                <li>• Target dana pensiun = 25× pengeluaran tahunan (aturan 4%)</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-sm text-red-700 mb-2">✗ Kesalahan Umum</p>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li>• Mengandalkan hanya 1 sumber (misalnya cuma pesangon)</li>
                <li>• Tidak memperhitungkan inflasi — daya beli turun 50% dalam 18 tahun di inflasi 4%</li>
                <li>• Mengambil JHT terlalu dini sebelum pensiun</li>
                <li>• Terlalu agresif di usia 50+ — volatilitas tinggi bisa merusak dana pensiun</li>
                <li>• Tidak punya dana darurat terpisah dari dana pensiun</li>
                <li>• Lupa bahwa pensiun bisa 20–30 tahun — dana harus cukup panjang</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc -b --noEmit
```

Expected: masih error karena SimulasiPanel dan HitungTotalPanel belum ada.

- [ ] **Step 3: Commit**

```bash
git add src/tabs/pensiun/PanduanPanel.tsx
git commit -m "feat: PanduanPanel static content (sumber dana, strategi, perbandingan, tips)"
```

---

## Task 9: SimulasiPanel — Wizard 3 Step

**Files:**
- Create: `src/tabs/pensiun/SimulasiPanel.tsx`

- [ ] **Step 1: Buat SimulasiPanel.tsx**

```typescript
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
import { formatRupiah, parseRupiah } from '@/lib/format'
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

function shortRupiah(n: number): string {
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)}M`
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(0)}jt`
  return formatRupiah(n)
}

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
                    <Tooltip formatter={(v: number) => formatRupiah(v)} />
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
```

- [ ] **Step 2: Type check**

```bash
npx tsc -b --noEmit
```

Expected: masih 1 error (HitungTotalPanel belum ada).

- [ ] **Step 3: Commit**

```bash
git add src/tabs/pensiun/SimulasiPanel.tsx
git commit -m "feat: SimulasiPanel wizard 3 step dengan DCA chart"
```

---

## Task 10: HitungTotalPanel — Wizard 2 Step

**Files:**
- Create: `src/tabs/pensiun/HitungTotalPanel.tsx`

- [ ] **Step 1: Buat HitungTotalPanel.tsx**

```typescript
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
import { formatRupiah, parseRupiah } from '@/lib/format'
import type { PensionSimInput } from '@/queries/pensiun'

interface Props {
  form: PensionSimInput
  onChange: (patch: Partial<PensionSimInput>) => void
}

const GOLONGAN_OPTIONS = [
  'Ia','Ib','Ic','Id','IIa','IIb','IIc','IId',
  'IIIa','IIIb','IIIc','IIId','IVa','IVb','IVc','IVd','IVe',
]

function shortRupiah(n: number): string {
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)}M`
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(0)}jt`
  return formatRupiah(n)
}

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
  }, [form, masaKerja])

  // Total lump sum + annuity (convert bulanan to 20-year lump sum equivalent)
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
                      placeholder={`Rp ${formatRupiah(form.gaji_pokok)}`}
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
                    <Input value={form.ht_taspen_gaji === 0 ? '' : formatRupiah(form.ht_taspen_gaji)} placeholder={`Rp ${formatRupiah(form.gaji_pokok)}`} onChange={(e) => onChange({ ht_taspen_gaji: parseRupiah(e.target.value) })} className="h-8 text-sm" />
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
                <p className="text-sm font-medium mb-3">Estimasi Bulanan vs Target per Sumber</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={[...barData, { name: 'Target', value: form.target_bulanan, active: true }]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tickFormatter={(v) => shortRupiah(v)} tick={{ fontSize: 10 }} width={65} />
                    <Tooltip formatter={(v: number) => formatRupiah(v)} />
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
```

- [ ] **Step 2: Type check — semua panel sudah ada, harus clean**

```bash
npx tsc -b --noEmit
```

Expected: no errors

- [ ] **Step 3: Build untuk memastikan tidak ada error Vite**

```bash
npm run build 2>&1 | tail -20
```

Expected: "✓ built in X.XXs" tanpa error

- [ ] **Step 4: Commit**

```bash
git add src/tabs/pensiun/HitungTotalPanel.tsx
git commit -m "feat: HitungTotalPanel wizard 2 step dengan accordion sumber dan BarChart"
```

---

## Task 11: Verifikasi End-to-End

- [ ] **Step 1: Jalankan dev server**

```bash
npm run dev
```

- [ ] **Step 2: Buka browser, navigasi ke tab Pensiun**

Verifikasi checklist:

1. ✅ Tab "Pensiun" muncul di nav bar dengan ikon PiggyBank
2. ✅ Profil strip muncul di atas sub-tab dengan 5 field input
3. ✅ Ubah usia → 1.5s → "✓ Tersimpan" muncul → refresh → usia tetap ada
4. ✅ Sub-tab Simulasi: step indicator → step 1 parameter → step 2 alokasi slider → step 3 chart
5. ✅ Step 3: AreaChart tampil dengan 3 area (emas/saham/reksadana)
6. ✅ Sub-tab Hitung Total: checkbox accordion → klik BPJS expand → isi upah → Hitung Total
7. ✅ Step 2 Hitung Total: grand total + gap pill + horizontal bars + BarChart
8. ✅ Sub-tab Panduan: 4 card section, tabel responsive
9. ✅ Toggle dark mode di Pengaturan → semua elemen ikut + gold accent tetap kontras
10. ✅ Light mode default: clear localStorage → buka fresh → tab Pensiun tampil light

- [ ] **Step 3: Final commit**

```bash
git add .
git commit -m "feat: integrasi tab Pensiun lengkap — Simulasi, Hitung Total, Panduan"
```

---

## Catatan Implementasi

**Gold accent usage** — gunakan CSS variable langsung di `style={}` prop, bukan Tailwind class:
```tsx
style={{ color: 'var(--gold)' }}
style={{ background: 'var(--gold-bg)', borderColor: 'var(--gold-border)' }}
```

**Auto-save pattern** — `handleChange` di PensiunTab adalah single point of truth. Panel hanya memanggil `onChange(patch)`, tidak pernah akses Supabase langsung.

**Alokasi normalisasi** — `normalizeAlokasi` di SimulasiPanel memastikan emas + saham + rd = 100 setiap kali slider digeser.

**Estimasi bulanan Hitung Total** — karena berbagai sumber menghasilkan lump sum vs annuity, formula yang dipakai: `lumpSum / (20 * 12)` untuk konversi ke bulanan (asumsi 20 tahun pensiun). Ini sederhana tapi cukup untuk perbandingan.

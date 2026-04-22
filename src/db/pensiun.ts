// src/db/pensiun.ts
import { supabase } from '@/lib/supabase'

export interface PensionSimRow {
  id: string
  user_id: string
  updated_at: string
  created_at: string
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

export type PensionSimInput = Omit<PensionSimRow, 'id' | 'user_id' | 'updated_at' | 'created_at'>

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

import { supabase } from '@/lib/supabase'

export type AccountType =
  | 'tabungan'
  | 'giro'
  | 'cash'
  | 'deposito'
  | 'dompet_digital'
  | 'properti'
  | 'kendaraan'

export type LiabilityType =
  | 'kpr'
  | 'cicilan_kendaraan'
  | 'kartu_kredit'
  | 'paylater'
  | 'kta'

export interface NetWorthAccount {
  id: number
  user_id: string
  name: string
  type: AccountType
  balance: number
  created_at: string
}

export interface NetWorthAccountInput {
  name: string
  type: AccountType
  balance: number
}

export interface NetWorthLiability {
  id: number
  user_id: string
  name: string
  type: LiabilityType
  amount: number
  created_at: string
}

export interface NetWorthLiabilityInput {
  name: string
  type: LiabilityType
  amount: number
}

export interface NetWorthSnapshot {
  id: number
  user_id: string
  snapshot_month: string // 'YYYY-MM-01' from DATE column
  total_accounts: number
  total_investments: number
  total_liabilities: number
  net_worth: number // GENERATED ALWAYS AS column from DB
  created_at: string
}

// Account CRUD

export async function listAccounts(uid: string): Promise<NetWorthAccount[]> {
  const { data, error } = await supabase
    .from('net_worth_accounts')
    .select('id, user_id, name, type, balance, created_at')
    .eq('user_id', uid)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data as NetWorthAccount[]
}

export async function createAccount(uid: string, input: NetWorthAccountInput): Promise<number> {
  if (input.balance <= 0) throw new Error('Saldo harus > 0')
  if (!input.name.trim()) throw new Error('Nama wajib diisi')
  const { data, error } = await supabase
    .from('net_worth_accounts')
    .insert({ user_id: uid, name: input.name.trim(), type: input.type, balance: input.balance })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

export async function updateAccount(id: number, input: NetWorthAccountInput): Promise<void> {
  if (input.balance <= 0) throw new Error('Saldo harus > 0')
  if (!input.name.trim()) throw new Error('Nama wajib diisi')
  const { error } = await supabase
    .from('net_worth_accounts')
    .update({ name: input.name.trim(), type: input.type, balance: input.balance })
    .eq('id', id)
  if (error) throw error
}

export async function deleteAccount(id: number): Promise<void> {
  const { error } = await supabase.from('net_worth_accounts').delete().eq('id', id)
  if (error) throw error
}

// Liability CRUD

export async function listLiabilities(uid: string): Promise<NetWorthLiability[]> {
  const { data, error } = await supabase
    .from('net_worth_liabilities')
    .select('id, user_id, name, type, amount, created_at')
    .eq('user_id', uid)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data as NetWorthLiability[]
}

export async function createLiability(uid: string, input: NetWorthLiabilityInput): Promise<number> {
  if (input.amount <= 0) throw new Error('Outstanding harus > 0')
  if (!input.name.trim()) throw new Error('Nama wajib diisi')
  const { data, error } = await supabase
    .from('net_worth_liabilities')
    .insert({ user_id: uid, name: input.name.trim(), type: input.type, amount: input.amount })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

export async function updateLiability(id: number, input: NetWorthLiabilityInput): Promise<void> {
  if (input.amount <= 0) throw new Error('Outstanding harus > 0')
  if (!input.name.trim()) throw new Error('Nama wajib diisi')
  const { error } = await supabase
    .from('net_worth_liabilities')
    .update({ name: input.name.trim(), type: input.type, amount: input.amount })
    .eq('id', id)
  if (error) throw error
}

export async function deleteLiability(id: number): Promise<void> {
  const { error } = await supabase.from('net_worth_liabilities').delete().eq('id', id)
  if (error) throw error
}

// Snapshots

export async function listSnapshots(uid: string): Promise<NetWorthSnapshot[]> {
  const { data, error } = await supabase
    .from('net_worth_snapshots')
    .select('id, user_id, snapshot_month, total_accounts, total_investments, total_liabilities, net_worth, created_at')
    .eq('user_id', uid)
    .order('snapshot_month', { ascending: true })
  if (error) throw error
  return data as NetWorthSnapshot[]
}

export async function insertSnapshotIfNeeded(
  uid: string,
  snapshotMonth: string, // MUST be 'YYYY-MM-01' (Pitfall 4)
  totalAccounts: number,
  totalInvestments: number,
  totalLiabilities: number,
): Promise<void> {
  // net_worth column is GENERATED ALWAYS AS (total_accounts + total_investments - total_liabilities) STORED
  // — do NOT include net_worth in the payload
  const { error } = await supabase
    .from('net_worth_snapshots')
    .upsert(
      {
        user_id: uid,
        snapshot_month: snapshotMonth,
        total_accounts: totalAccounts,
        total_investments: totalInvestments,
        total_liabilities: totalLiabilities,
      },
      { onConflict: 'user_id,snapshot_month', ignoreDuplicates: true },
    )
  if (error) throw error
}

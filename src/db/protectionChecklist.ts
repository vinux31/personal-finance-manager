import { supabase } from '@/lib/supabase'

/**
 * Full row shape of protection_checklist table (migration 0029).
 * Phase 14 widens from Phase 13 narrow shell (health_coverage only) to all 10 columns.
 * All business columns nullable per schema — first interaction lazy-creates row
 * with whatever fields user fills; unspecified fields stay NULL.
 */
export type ProtectionChecklistRow = {
  user_id: string
  health_coverage: 'kantor' | 'bpjs' | 'pribadi' | 'kombinasi' | 'tidak' | null
  has_dependents: boolean | null
  life_coverage: 'kantor' | 'pribadi' | 'keduanya' | 'tidak' | null
  life_coverage_sufficient: boolean | null
  life_coverage_post_employment: 'ya' | 'tidak' | 'tidak_yakin' | null
  estate_heirs_documented: boolean | null
  estate_assets_documented: boolean | null
  estate_will_exists: boolean | null
  updated_at: string
  created_at: string
}

/** Patch type — partial update over business columns (excludes user_id + timestamps). */
export type ProtectionChecklistPatch = Partial<
  Omit<ProtectionChecklistRow, 'user_id' | 'created_at' | 'updated_at'>
>

/** SELECT * — Phase 14 widens from Phase 13's 'user_id, health_coverage' projection. */
export async function getProtectionChecklist(
  uid: string,
): Promise<ProtectionChecklistRow | null> {
  const { data, error } = await supabase
    .from('protection_checklist')
    .select('*')
    .eq('user_id', uid)
    .maybeSingle()
  if (error) throw error
  return data as ProtectionChecklistRow | null
}

/**
 * Lazy-create or update via PostgreSQL UPSERT ON CONFLICT (user_id).
 * Pattern verbatim from src/db/pensiun.ts:92-100 (Phase 7 v1.1 canonical).
 * Partial patch is OK — unspecified columns NULL on INSERT, preserved on UPDATE.
 */
export async function upsertProtectionChecklist(
  uid: string,
  patch: ProtectionChecklistPatch,
): Promise<void> {
  const { error } = await supabase
    .from('protection_checklist')
    .upsert(
      { ...patch, user_id: uid, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    )
  if (error) throw error
}

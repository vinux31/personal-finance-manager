# Remove Auto-Seed RENCANA — Design Spec

**Date:** 2026-05-13  
**Status:** Approved

## Background

`seed_rencana` adalah RPC Supabase yang meng-insert 5 goals + 3 investments hardcoded (RENCANA) ke akun user baru saat pertama buka Dashboard. Sistem ini tidak relevan untuk akun selain admin dan menyebabkan 3 bug:

1. **BUG-1 (Breaking):** `useRencanaInit.ts` memanggil `.rpc('seed_rencana', { p_uid: null })` tapi migration 0027 rename param ke `p_user_id` → RPC gagal diam-diam, seed tidak jalan.
2. **BUG-2 (IDOR Write):** Migration 0027 menghapus auth guard dari `seed_rencana`. Fungsi `SECURITY DEFINER` tanpa access check → authenticated user bisa inject goals/investments ke akun orang lain.
3. **BUG-3:** Tidak ada NULL check pada `v_uid` di 0027 → jika dipanggil dengan NULL, INSERT gagal dengan FK error tidak informatif.

## Decision

**Hapus sistem seed sepenuhnya.** Akun baru mulai kosong. Tidak ada auto-seed.  
Security hole ditutup via REVOKE (bukan DROP — tabel `user_seed_markers` masih ada data admin).

## Changes

### Files Deleted
- `src/lib/useRencanaInit.ts`
- `src/lib/rencanaNames.ts`

### Files Modified

#### `src/tabs/DashboardTab.tsx`
- Remove: `import { useRencanaInit } from '@/lib/useRencanaInit'`
- Remove: `useRencanaInit()` call

#### `src/tabs/SettingsTab.tsx`
Remove seluruh Rencana section dan semua kode terkait:
- Section UI "Rencana" (lines 168–194)
- ConfirmDialog reset seed
- State: `resetting`, `resetSeedConfirmOpen`
- Functions: `handleResetSeed`, `doResetSeed`
- Variables: `activeGoals`, `totalTarget`, `deadlineStr`, `deadlineLabel`
- Hooks: `useGoals()`, `useInvestments()`
- Imports: `useGoals`, `useInvestments`, `deleteGoal`, `deleteInvestment`, `RENCANA_GOAL_NAMES`, `RENCANA_INVESTMENT_NAMES`, `Target` (lucide)

Settings tampilan post-change: Tampilan → Akun → Manajemen Pengguna (admin only) → Bantuan.

### Files Added

#### `supabase/migrations/0030_revoke_seed_rencana.sql`
```sql
-- Revoke client access to seed functions (closes BUG-2 IDOR write).
-- Functions retained in DB for audit trail; uncallable via REST API.
REVOKE EXECUTE ON FUNCTION seed_rencana(UUID) FROM authenticated;
REVOKE EXECUTE ON FUNCTION reset_rencana_marker() FROM authenticated;
```

## Not Changed
- Tabel `user_seed_markers` — tidak di-DROP (ada data admin, tidak perlu clean)
- Semua RLS policies — tidak berubah
- `useTargetUserId` / view-as admin logic — tidak berubah
- Global master data (`categories`, `bei_stocks`) — tidak berubah

## Testing

1. Login sebagai user baru → Dashboard kosong, tidak ada goals/investments auto-populated
2. Settings tidak ada section "Rencana" atau tombol "Reset Seed"
3. Call langsung `supabase.rpc('seed_rencana', { p_user_id: uuid })` via REST → error 42501 (permission denied)
4. Login sebagai admin → data lama tetap ada (tidak terhapus)
5. TypeScript build: tidak ada error import dari file yang dihapus

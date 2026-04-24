import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  listAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
  listLiabilities,
  createLiability,
  updateLiability,
  deleteLiability,
  listSnapshots,
  type NetWorthAccount,
  type NetWorthAccountInput,
  type NetWorthLiability,
  type NetWorthLiabilityInput,
  type NetWorthSnapshot,
  type AccountType,
  type LiabilityType,
} from '@/db/netWorth'
import { mapSupabaseError } from '@/lib/errors'
import { useTargetUserId } from '@/auth/useTargetUserId'

export {
  type NetWorthAccount,
  type NetWorthAccountInput,
  type NetWorthLiability,
  type NetWorthLiabilityInput,
  type NetWorthSnapshot,
  type AccountType,
  type LiabilityType,
}

// Account hooks

export function useNetWorthAccounts() {
  const uid = useTargetUserId()
  return useQuery({
    queryKey: ['net-worth-accounts', uid],
    queryFn: () => listAccounts(uid!),
    enabled: !!uid,
  })
}

export function useCreateNetWorthAccount() {
  const qc = useQueryClient()
  const uid = useTargetUserId()
  return useMutation({
    mutationFn: (input: NetWorthAccountInput) => createAccount(uid!, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['net-worth-accounts'] })
      toast.success('Akun berhasil ditambahkan')
    },
    onError: (e) => toast.error(mapSupabaseError(e)),
  })
}

export function useUpdateNetWorthAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: NetWorthAccountInput }) =>
      updateAccount(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['net-worth-accounts'] })
      toast.success('Akun berhasil diubah')
    },
    onError: (e) => toast.error(mapSupabaseError(e)),
  })
}

export function useDeleteNetWorthAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteAccount(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['net-worth-accounts'] })
      toast.success('Akun dihapus')
    },
    onError: (e) => toast.error(mapSupabaseError(e)),
  })
}

// Liability hooks

export function useNetWorthLiabilities() {
  const uid = useTargetUserId()
  return useQuery({
    queryKey: ['net-worth-liabilities', uid],
    queryFn: () => listLiabilities(uid!),
    enabled: !!uid,
  })
}

export function useCreateNetWorthLiability() {
  const qc = useQueryClient()
  const uid = useTargetUserId()
  return useMutation({
    mutationFn: (input: NetWorthLiabilityInput) => createLiability(uid!, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['net-worth-liabilities'] })
      toast.success('Liabilitas berhasil ditambahkan')
    },
    onError: (e) => toast.error(mapSupabaseError(e)),
  })
}

export function useUpdateNetWorthLiability() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: NetWorthLiabilityInput }) =>
      updateLiability(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['net-worth-liabilities'] })
      toast.success('Liabilitas berhasil diubah')
    },
    onError: (e) => toast.error(mapSupabaseError(e)),
  })
}

export function useDeleteNetWorthLiability() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteLiability(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['net-worth-liabilities'] })
      toast.success('Liabilitas dihapus')
    },
    onError: (e) => toast.error(mapSupabaseError(e)),
  })
}

// Snapshot hook (read-only — no mutations; insertSnapshotIfNeeded called directly from KekayaanTab useEffect)

export function useNetWorthSnapshots() {
  const uid = useTargetUserId()
  return useQuery({
    queryKey: ['net-worth-snapshots', uid],
    queryFn: () => listSnapshots(uid!),
    enabled: !!uid,
  })
}

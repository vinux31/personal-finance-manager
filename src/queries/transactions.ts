import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  listTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  type Transaction,
  type TransactionFilters,
  type TransactionInput,
} from '@/db/transactions'
import { mapSupabaseError } from '@/lib/errors'

export { type Transaction, type TransactionFilters, type TransactionInput }

export function useTransactions(filters: TransactionFilters = {}) {
  return useQuery({
    queryKey: ['transactions', filters],
    queryFn: () => listTransactions(filters),
  })
}

export function useCreateTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: TransactionInput) => createTransaction(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      toast.success('Transaksi berhasil ditambahkan')
    },
    onError: (e) => toast.error(mapSupabaseError(e)),
  })
}

export function useUpdateTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: TransactionInput }) =>
      updateTransaction(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      toast.success('Transaksi berhasil diubah')
    },
    onError: (e) => toast.error(mapSupabaseError(e)),
  })
}

export function useDeleteTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteTransaction(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      toast.success('Transaksi dihapus')
    },
    onError: (e) => toast.error(mapSupabaseError(e)),
  })
}

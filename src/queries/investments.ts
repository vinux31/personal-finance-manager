import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  listInvestments,
  createInvestment,
  updateInvestment,
  deleteInvestment,
  updatePrice,
  getPriceHistory,
  listAssetTypes,
  costBasis,
  currentValue,
  gainLoss,
  gainLossPercent,
  type Investment,
  type InvestmentInput,
  type PriceHistoryEntry,
} from '@/db/investments'
import { mapSupabaseError } from '@/lib/errors'

export { costBasis, currentValue, gainLoss, gainLossPercent }
export { type Investment, type InvestmentInput, type PriceHistoryEntry }

export function useInvestments() {
  return useQuery({
    queryKey: ['investments'],
    queryFn: listInvestments,
  })
}

export function useAssetTypes() {
  return useQuery({
    queryKey: ['asset-types'],
    queryFn: listAssetTypes,
  })
}

export function usePriceHistory(investmentId: number) {
  return useQuery({
    queryKey: ['price-history', investmentId],
    queryFn: () => getPriceHistory(investmentId),
    enabled: investmentId > 0,
  })
}

export function useCreateInvestment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: InvestmentInput) => createInvestment(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['investments'] })
      qc.invalidateQueries({ queryKey: ['asset-types'] })
      toast.success('Investasi berhasil ditambahkan')
    },
    onError: (e) => toast.error(mapSupabaseError(e)),
  })
}

export function useUpdateInvestment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: InvestmentInput }) =>
      updateInvestment(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['investments'] })
      toast.success('Investasi berhasil diubah')
    },
    onError: (e) => toast.error(mapSupabaseError(e)),
  })
}

export function useDeleteInvestment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteInvestment(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['investments'] })
      qc.invalidateQueries({ queryKey: ['asset-types'] })
      toast.success('Investasi dihapus')
    },
    onError: (e) => toast.error(mapSupabaseError(e)),
  })
}

export function useUpdatePrice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, price, date }: { id: number; price: number; date: string }) =>
      updatePrice(id, price, date),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['investments'] })
      qc.invalidateQueries({ queryKey: ['price-history', id] })
      toast.success('Harga berhasil diperbarui')
    },
    onError: (e) => toast.error(mapSupabaseError(e)),
  })
}

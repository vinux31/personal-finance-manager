import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  listBeiStocks,
  listDividendTransactions,
  getDividendHoldings,
  createDividendTransaction,
  shares,
  dividendCostBasis,
  dividendCurrentValue,
  annualIncome,
  yieldOnCost,
  weightedAvgYield,
  sectorAllocation,
  type BeiStock,
  type DividendTransaction,
  type DividendHolding,
  type CreateDividendTransactionInput,
} from '@/db/dividends'
import { mapSupabaseError } from '@/lib/errors'
import { useTargetUserId } from '@/auth/useTargetUserId'

export {
  shares, dividendCostBasis, dividendCurrentValue,
  annualIncome, yieldOnCost, weightedAvgYield, sectorAllocation,
}
export { type BeiStock, type DividendTransaction, type DividendHolding }

export function useBeiStocks() {
  return useQuery({
    queryKey: ['bei-stocks'],
    queryFn: () => listBeiStocks(),
  })
}

export function useDividendTransactions() {
  const uid = useTargetUserId()
  return useQuery({
    queryKey: ['dividend-transactions', uid],
    queryFn: () => listDividendTransactions(uid),
    enabled: !!uid,
  })
}

export function useDividendHoldings() {
  const uid = useTargetUserId()
  return useQuery({
    queryKey: ['dividend-holdings', uid],
    queryFn: () => getDividendHoldings(uid),
    enabled: !!uid,
  })
}

export function useCreateDividendTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateDividendTransactionInput) => createDividendTransaction(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dividend-transactions'] })
      qc.invalidateQueries({ queryKey: ['dividend-holdings'] })
      qc.invalidateQueries({ queryKey: ['investments'] })
      toast.success('Transaksi berhasil disimpan')
    },
    onError: (e) => toast.error(mapSupabaseError(e)),
  })
}

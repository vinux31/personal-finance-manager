import { useQuery } from '@tanstack/react-query'
import { listCategories, type Category } from '@/db/categories'

export { type Category }

export function useCategories(type?: 'income' | 'expense') {
  return useQuery({
    queryKey: ['categories', type ?? 'all'],
    queryFn: () => listCategories(type),
  })
}

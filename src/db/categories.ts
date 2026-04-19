import { all } from './repo'

export interface Category {
  id: number
  name: string
  type: 'income' | 'expense'
}

export function listCategories(type?: 'income' | 'expense'): Category[] {
  if (type) {
    return all<Category>(
      'SELECT id, name, type FROM categories WHERE type = ? ORDER BY name',
      [type],
    )
  }
  return all<Category>('SELECT id, name, type FROM categories ORDER BY type, name')
}

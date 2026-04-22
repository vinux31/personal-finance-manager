import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { useRecurringTemplates, useDeleteRecurringTemplate, useUpdateRecurringTemplate, type RecurringTemplate } from '@/queries/recurringTransactions'
import { useCategories } from '@/queries/categories'
import { formatRupiah, formatDateID } from '@/lib/format'
import RecurringDialog from '@/components/RecurringDialog'

const FREQ_LABEL: Record<string, string> = {
  daily: 'Harian',
  weekly: 'Mingguan',
  monthly: 'Bulanan',
  yearly: 'Tahunan',
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function RecurringListDialog({ open, onOpenChange }: Props) {
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<RecurringTemplate | null>(null)

  const { data: templates = [], isLoading } = useRecurringTemplates()
  const { data: categories = [] } = useCategories()
  const deleteTemplate = useDeleteRecurringTemplate()
  const updateTemplate = useUpdateRecurringTemplate()

  function getCategoryName(id: number) {
    return categories.find((c) => c.id === id)?.name ?? String(id)
  }

  function onDelete(t: RecurringTemplate) {
    if (!confirm(`Hapus template "${t.name}"?`)) return
    deleteTemplate.mutate(t.id)
  }

  function toggleActive(t: RecurringTemplate) {
    updateTemplate.mutate({
      id: t.id,
      input: { ...t, is_active: !t.is_active },
    })
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Transaksi Rutin</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => { setEditing(null); setEditOpen(true) }}>
                <Plus className="h-4 w-4" />Tambah Template
              </Button>
            </div>

            {isLoading ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Memuat…</p>
            ) : templates.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Belum ada template. Buat template untuk transaksi yang terjadi secara rutin.
              </p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {templates.map((t) => (
                  <div key={t.id} className={`rounded-lg border p-3 ${!t.is_active ? 'opacity-50' : ''}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{t.name}</span>
                          <Badge variant={t.type === 'income' ? 'default' : 'destructive'} className="text-xs">
                            {t.type === 'income' ? 'Masuk' : 'Keluar'}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">{FREQ_LABEL[t.frequency]}</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {getCategoryName(t.category_id)} · {formatRupiah(t.amount)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Jatuh tempo: {formatDateID(t.next_due_date)}
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => toggleActive(t)}
                        >
                          {t.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7"
                          onClick={() => { setEditing(t); setEditOpen(true) }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7"
                          onClick={() => onDelete(t)}>
                          <Trash2 className="h-3.5 w-3.5 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <RecurringDialog open={editOpen} onOpenChange={setEditOpen} editing={editing} />
    </>
  )
}

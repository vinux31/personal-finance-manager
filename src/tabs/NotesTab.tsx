import { useState } from 'react'
import { useNotes, useDeleteNote, type Note, type NoteFilters } from '@/queries/notes'
import { useTransactions } from '@/queries/transactions'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { Plus, Pencil, Trash2, Link2, ChevronLeft, ChevronRight, StickyNote } from 'lucide-react'
import { formatDateID, formatRupiah } from '@/lib/format'
import NoteDialog from '@/components/NoteDialog'
import { EmptyState } from '@/components/ui/empty-state'

const PAGE_SIZE = 20

export default function NotesTab() {
  const [editing, setEditing] = useState<Note | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [filters, setFilters] = useState<NoteFilters>({ page: 0 })
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmNote, setConfirmNote] = useState<Note | null>(null)

  const { data: result, isLoading } = useNotes(filters)
  const notes = result?.data ?? []
  const total = result?.count ?? 0
  const page = filters.page ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  const { data: transactions = [] } = useTransactions({})
  const deleteNote = useDeleteNote()

  function setSearch(search: string) {
    setFilters((f) => ({ ...f, search: search || undefined, page: 0 }))
  }
  function setDateFrom(dateFrom: string) {
    setFilters((f) => ({ ...f, dateFrom: dateFrom || undefined, page: 0 }))
  }
  function setDateTo(dateTo: string) {
    setFilters((f) => ({ ...f, dateTo: dateTo || undefined, page: 0 }))
  }

  function onDelete(n: Note) {
    setConfirmNote(n)
    setConfirmOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2 flex-wrap">
          <Input
            placeholder="Cari judul…"
            value={filters.search ?? ''}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-44"
          />
          <Input
            type="date"
            value={filters.dateFrom ?? ''}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-8 w-36"
          />
          <Input
            type="date"
            value={filters.dateTo ?? ''}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-8 w-36"
          />
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true) }}>
          <Plus className="h-4 w-4" />Tambah Catatan
        </Button>
      </div>

      {isLoading ? (
        <div className="rounded-lg border bg-card p-12 text-center text-muted-foreground">Memuat…</div>
      ) : notes.length === 0 ? (
        <EmptyState
          icon={StickyNote}
          title="Belum ada catatan"
          description="Simpan pemikiran atau reminder terkait keuangan Anda."
          actionLabel="+ Tambah Catatan"
          onAction={() => { setEditing(null); setDialogOpen(true) }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {notes.map((n) => (
            <div key={n.id} className="rounded-lg border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold leading-tight">{n.title}</h3>
                <div className="flex shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => { setEditing(n); setDialogOpen(true) }}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => onDelete(n)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                </div>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{formatDateID(n.date)}</div>
              <p className="mt-3 whitespace-pre-wrap text-sm">
                {n.content.length > 200 ? n.content.slice(0, 200) + '…' : n.content}
              </p>
              {n.linked_transaction_id && (() => {
                const t = transactions.find((tx) => tx.id === n.linked_transaction_id)
                if (!t) return null
                return (
                  <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground border rounded px-2 py-1 w-fit">
                    <Link2 className="h-3 w-3 shrink-0" />
                    {formatDateID(t.date)} · {t.category_name} · {formatRupiah(t.amount)}
                  </div>
                )
              })()}
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} dari {total}
          </span>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 0}
              onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 0) - 1 }))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages - 1}
              onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 0) + 1 }))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Hapus "${confirmNote?.title ?? ''}"`}
        description="Catatan ini akan dihapus permanen."
        onConfirm={() => { if (confirmNote) deleteNote.mutate(confirmNote.id) }}
      />
      <NoteDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />
    </div>
  )
}

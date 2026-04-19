import { useEffect, useState } from 'react'
import { listNotes, deleteNote, type Note } from '@/db/notes'
import { Button } from '@/components/ui/button'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { formatDateID } from '@/lib/format'
import NoteDialog from '@/components/NoteDialog'
import { toast } from 'sonner'

export default function NotesTab() {
  const [notes, setNotes] = useState<Note[]>([])
  const [editing, setEditing] = useState<Note | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  function refresh() {
    setNotes(listNotes())
  }

  useEffect(() => refresh(), [])

  async function onDelete(n: Note) {
    if (!confirm(`Hapus catatan "${n.title}"?`)) return
    await deleteNote(n.id)
    toast.success('Catatan dihapus')
    refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button
          onClick={() => {
            setEditing(null)
            setDialogOpen(true)
          }}
        >
          <Plus className="h-4 w-4" />
          Tambah Catatan
        </Button>
      </div>

      {notes.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center text-muted-foreground">
          Belum ada catatan. Simpan pemikiran atau reminder terkait keuangan Anda.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {notes.map((n) => (
            <div key={n.id} className="rounded-lg border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold leading-tight">{n.title}</h3>
                <div className="flex shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditing(n)
                      setDialogOpen(true)
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => void onDelete(n)}
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {formatDateID(n.date)}
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm">
                {n.content.length > 200
                  ? n.content.slice(0, 200) + '…'
                  : n.content}
              </p>
            </div>
          ))}
        </div>
      )}

      <NoteDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={refresh}
        editing={editing}
      />
    </div>
  )
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  listNotes,
  createNote,
  updateNote,
  deleteNote,
  type Note,
  type NoteInput,
} from '@/db/notes'
import { mapSupabaseError } from '@/lib/errors'

export { type Note, type NoteInput }

export function useNotes() {
  return useQuery({
    queryKey: ['notes'],
    queryFn: listNotes,
  })
}

export function useCreateNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: NoteInput) => createNote(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notes'] })
      toast.success('Catatan berhasil ditambahkan')
    },
    onError: (e) => toast.error(mapSupabaseError(e)),
  })
}

export function useUpdateNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: NoteInput }) => updateNote(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notes'] })
      toast.success('Catatan berhasil diubah')
    },
    onError: (e) => toast.error(mapSupabaseError(e)),
  })
}

export function useDeleteNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteNote(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notes'] })
      toast.success('Catatan dihapus')
    },
    onError: (e) => toast.error(mapSupabaseError(e)),
  })
}

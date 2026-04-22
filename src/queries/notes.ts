import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  listNotes,
  createNote,
  updateNote,
  deleteNote,
  type Note,
  type NoteInput,
  type NoteFilters,
} from '@/db/notes'
import { mapSupabaseError } from '@/lib/errors'
import { useTargetUserId } from '@/auth/useTargetUserId'

export { type Note, type NoteInput, type NoteFilters }

export function useNotes(filters: NoteFilters = {}) {
  const uid = useTargetUserId()
  return useQuery({
    queryKey: ['notes', uid, filters],
    queryFn: () => listNotes(filters, uid),
    enabled: !!uid,
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

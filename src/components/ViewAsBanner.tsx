import { useViewAsContext } from '@/auth/ViewAsContext'
import { Button } from '@/components/ui/button'
import { Eye } from 'lucide-react'

export default function ViewAsBanner() {
  const { viewingAs, setViewingAs } = useViewAsContext()
  if (!viewingAs) return null

  return (
    <div className="flex items-center justify-between bg-amber-50 dark:bg-amber-950 border-b border-amber-200 dark:border-amber-800 px-6 py-2 text-sm">
      <span className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
        <Eye className="h-4 w-4" />
        Sedang melihat data <strong>{viewingAs.displayName || viewingAs.email}</strong> (hanya baca)
      </span>
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-xs"
        onClick={() => setViewingAs(null)}
      >
        Kembali ke data saya
      </Button>
    </div>
  )
}

import { ArrowRight, BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePanduanStore } from '@/lib/panduanStore'

export default function PanduanWelcomeCard() {
  const { openPanduan } = usePanduanStore()

  return (
    <div className="rounded-xl border border-[var(--brand-muted)] bg-card p-5">
      <div className="flex items-start gap-4">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
          style={{ background: 'var(--brand-light)' }}
        >
          <BookOpen className="h-5 w-5 text-[var(--brand)]" />
        </div>
        <div className="flex-1">
          <h2 className="text-base font-bold">Panduan Penggunaan</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Pelajari cara pakai semua fitur Kantong Pintar lewat tutorial step-by-step.
          </p>
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <Button onClick={() => openPanduan()}>
          Lihat Panduan Lengkap
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

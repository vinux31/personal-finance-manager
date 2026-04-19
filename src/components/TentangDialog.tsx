import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Wallet } from 'lucide-react'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function TentangDialog({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tentang Aplikasi</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Wallet className="h-6 w-6" />
            </div>
            <div>
              <div className="font-semibold">Personal Finance Manager</div>
              <div className="text-xs text-muted-foreground">Versi 1.0.0 (web)</div>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            Aplikasi pengelola keuangan pribadi yang berjalan sepenuhnya offline
            di browser Anda.
          </p>

          <div className="text-sm">
            <div className="font-medium">Dibangun dengan</div>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
              <li>React + TypeScript + Vite</li>
              <li>Tailwind CSS + shadcn/ui</li>
              <li>SQLite (sql.js) + File System Access API</li>
              <li>Recharts (grafik)</li>
            </ul>
          </div>

          <p className="text-xs text-muted-foreground">
            100% gratis, open source, tanpa iklan, tanpa telemetri. Semua data
            tersimpan di file <code>.db</code> di laptop Anda.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
